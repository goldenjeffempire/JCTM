import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const rawClientId = (
  process.env.VITE_ADSENSE_CLIENT_ID ??
  process.env.VITE_GOOGLE_ADSENSE_CLIENT ??
  ""
).trim();

const publisherId = rawClientId.startsWith("ca-pub-")
  ? rawClientId.replace("ca-pub-", "")
  : rawClientId;

if (/^\d+$/.test(publisherId)) {
  const publicDir = path.resolve("public");
  await mkdir(publicDir, { recursive: true });
  await writeFile(
    path.join(publicDir, "ads.txt"),
    `google.com, pub-${publisherId}, DIRECT, f08c47fec0942fa0\n`,
  );
}