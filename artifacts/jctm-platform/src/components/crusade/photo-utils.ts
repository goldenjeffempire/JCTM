/**
 * Attendee photo helpers — everything here runs in browser memory only.
 * No storage APIs, no network calls. Pure helpers are exported for unit tests.
 */

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const PHOTO_MAX_PIXELS = 40_000_000; // ~40 MP decoded cap
export const PHOTO_MIN_SIDE = 64;
export type PhotoMime = "image/jpeg" | "image/png" | "image/webp";
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

/** Pixel rectangle inside the source image (react-easy-crop `Area` compatible). */
export interface CropArea { x: number; y: number; width: number; height: number }

/** Detect the real image type from leading bytes (ignores the file name / declared type). */
export function sniffImageType(bytes: Uint8Array): PhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Validate size + decoded dimensions. Returns an error message or null. */
export function checkPhotoLimits(bytes: number, width: number, height: number): string | null {
  if (bytes > PHOTO_MAX_BYTES) return "That photo is larger than 10 MB. Please choose a smaller one.";
  if (width < PHOTO_MIN_SIDE || height < PHOTO_MIN_SIDE) return "That photo is too small. Please choose one at least 64 pixels wide.";
  if (width * height > PHOTO_MAX_PIXELS) return "That photo has too many pixels to process on this device. Please choose a smaller one.";
  return null;
}

/** Centred square crop that covers the image (used as the default before the user adjusts). */
export function defaultSquareCrop(width: number, height: number): CropArea {
  const side = Math.min(width, height);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), width: side, height: side };
}

/** Clamp a crop so it always lies fully inside the source image. */
export function clampCrop(area: CropArea, width: number, height: number): CropArea {
  const w = Math.max(1, Math.min(Math.round(area.width), width));
  const h = Math.max(1, Math.min(Math.round(area.height), height));
  const x = Math.min(Math.max(0, Math.round(area.x)), width - w);
  const y = Math.min(Math.max(0, Math.round(area.y)), height - h);
  return { x, y, width: w, height: h };
}

/** Safe, non-identifying download name: only programme id + format (never the visitor name). */
export function inviteFileName(programId: string, format: string) {
  const safe = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "invite";
  return `jctm-crusade-2026-${safe(programId)}-${safe(format)}.png`;
}

export interface LoadedPhoto { url: string; image: HTMLImageElement; width: number; height: number; type: PhotoMime }

/**
 * Validate a user-selected file and decode it into an in-memory object URL.
 * Caller owns the returned `url` and must `URL.revokeObjectURL` it when done.
 */
export async function readPhotoFile(file: File): Promise<LoadedPhoto> {
  if (file.size > PHOTO_MAX_BYTES) throw new Error("That photo is larger than 10 MB. Please choose a smaller one.");
  if (file.size === 0) throw new Error("That file is empty.");
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = sniffImageType(head);
  if (!type) throw new Error("Please choose a JPG, PNG or WEBP photo.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That photo could not be read. It may be damaged or in an unsupported format."));
      img.src = url;
    });
    const limit = checkPhotoLimits(file.size, image.naturalWidth, image.naturalHeight);
    if (limit) throw new Error(limit);
    return { url, image, width: image.naturalWidth, height: image.naturalHeight, type };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}
