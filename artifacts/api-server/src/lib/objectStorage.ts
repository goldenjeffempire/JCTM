import { Storage, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import sharp from "sharp";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// ─── Auth strategy ─────────────────────────────────────────────────────────────
//
// When running inside Replit (development or Replit-hosted deployments), we use
// the Replit Object Storage sidecar at 127.0.0.1:1106 for auth and signed URLs.
//
// When deployed externally (e.g. Render, Railway, Fly.io) the sidecar is not
// present, so the app must authenticate using a GCP service account key stored
// in the GCS_SERVICE_ACCOUNT_KEY environment variable (full JSON content or
// base64-encoded JSON).  Generate one at:
//   Google Cloud Console → IAM → Service Accounts → Keys → Add Key → JSON
// then grant it "Storage Object Admin" on your bucket.

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function decodeJsonSecret(raw: string): object | null {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    Buffer.from(trimmed, "base64").toString("utf-8"),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as object;
    } catch {
      continue;
    }
  }

  return null;
}

function normalizePrivateKey(raw: string): string {
  const normalized = raw
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .trim();

  return `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----\n`;
}

function parseServiceAccountKey(): object | null {
  const raw = process.env.GCS_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  const parsedJson = decodeJsonSecret(raw);
  if (parsedJson) {
    return parsedJson;
  }

  const projectId = process.env.GCS_PROJECT_ID;
  const clientEmail = process.env.GCS_CLIENT_EMAIL;

  if (projectId && clientEmail) {
    return {
      type: "service_account",
      project_id: projectId,
      private_key: normalizePrivateKey(raw),
      client_email: clientEmail,
    };
  }

  throw new Error(
    "GCS_SERVICE_ACCOUNT_KEY is set but could not be parsed. Provide either the full service account JSON, base64-encoded JSON, or set GCS_PROJECT_ID and GCS_CLIENT_EMAIL when using a private-key-only secret.",
  );
}

const serviceAccountKey = parseServiceAccountKey();

/**
 * True when running inside the Replit environment (sidecar available).
 * False when deployed externally — uses GCS_SERVICE_ACCOUNT_KEY instead.
 */
const useReplitSidecar = !serviceAccountKey;

export const objectStorageClient: Storage = serviceAccountKey
  ? new Storage({ credentials: serviceAccountKey as Parameters<typeof Storage>[0]["credentials"] })
  : new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      } as Parameters<typeof Storage>[0]["credentials"],
      projectId: "",
    });

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  /**
   * Downloads an object entity as a raw Buffer.
   * objectPath must be in /objects/... form (same as getObjectEntityFile).
   */
  async downloadObjectAsBuffer(objectPath: string): Promise<Buffer> {
    const objectFile = await this.getObjectEntityFile(objectPath);
    const [buffer] = await objectFile.download();
    return buffer;
  }

  /**
   * Uploads a raw Buffer directly to the private object storage and returns
   * the objectPath (/objects/uploads/<uuid>.<ext>). Use this for server-side uploads
   * where the browser sends the file to the API server instead of GCS directly.
   */
  async uploadBuffer(buffer: Buffer, contentType: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const entityDir = privateObjectDir.endsWith("/") ? privateObjectDir : `${privateObjectDir}/`;
    const objectId = randomUUID();
    const ext = contentTypeToExtension(contentType);
    const filename = ext ? `${objectId}.${ext}` : objectId;
    const fullPath = `${entityDir}uploads/${filename}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(buffer, { contentType, resumable: false });
    return `/objects/uploads/${filename}`;
  }

  /**
   * Deletes an object entity from storage. Silently ignores missing objects.
   * objectPath must be in /objects/... form.
   */
  async deleteObjectEntity(objectPath: string): Promise<void> {
    if (!objectPath || !objectPath.startsWith("/objects/")) return;
    try {
      const file = await this.getObjectEntityFile(objectPath);
      await file.delete({ ignoreNotFound: true });
    } catch {
      // Object already gone — that's fine
    }
  }

  /**
   * Generates a WebP thumbnail from the given object entity, uploads it to storage,
   * and returns the thumbnail's objectPath (/objects/thumbs/<uuid>.webp).
   *
   * @param originalObjectPath   e.g. /objects/uploads/<uuid>
   * @param widthPx              max width in pixels (default 640)
   * @param qualityPct           WebP quality 1–100 (default 80)
   */
  async generateAndStoreThumbnail(
    originalObjectPath: string,
    widthPx = 640,
    qualityPct = 80,
  ): Promise<string> {
    const original = await this.downloadObjectAsBuffer(originalObjectPath);

    const thumbnail = await sharp(original)
      .resize(widthPx, undefined, { withoutEnlargement: true })
      .webp({ quality: qualityPct })
      .toBuffer();

    const thumbnailId = randomUUID();
    const privateObjectDir = this.getPrivateObjectDir();
    const entityDir = privateObjectDir.endsWith("/") ? privateObjectDir : `${privateObjectDir}/`;
    const fullPath = `${entityDir}thumbs/${thumbnailId}.webp`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const bucket = objectStorageClient.bucket(bucketName);
    const file   = bucket.file(objectName);
    await file.save(thumbnail, { contentType: "image/webp", resumable: false });

    return `/objects/thumbs/${thumbnailId}.webp`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  if (!useReplitSidecar) {
    // Non-Replit path: use GCS SDK's own V4 signed URLs (requires service account key)
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: method.toLowerCase() as "read" | "write" | "delete",
      expires: Date.now() + ttlSec * 1000,
    });
    return url;
  }

  // Replit path: delegate to the Object Storage sidecar
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

function contentTypeToExtension(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg":  "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/gif":  "gif",
    "image/avif": "avif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return map[contentType.toLowerCase()] ?? "";
}

/**
 * Inspects the first bytes of a buffer to validate it matches a known image
 * magic byte signature. Returns the detected MIME type or null if unrecognised.
 */
export function detectImageMimeType(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";

  // AVIF/HEIC/HEIF: ftyp box
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.slice(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand === "heic" || brand === "heix" || brand === "hevc") return "image/heic";
    if (brand === "mif1" || brand === "msf1" || brand === "heif") return "image/heif";
  }

  return null;
}
