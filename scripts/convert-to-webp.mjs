import sharp from "sharp";
import { readdir, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = path.join(__dirname, "../attached_assets");
const OUTPUT_DIR = path.join(__dirname, "../attached_assets/webp");

const QUALITY = 80;
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

async function convert() {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  const files = (await readdir(INPUT_DIR)).filter((f) =>
    /\.(jpg|jpeg|JPG|JPEG)$/.test(f)
  );

  console.log(`Converting ${files.length} images to WebP...`);

  let done = 0;
  let skipped = 0;
  const errors = [];

  await Promise.all(
    files.map(async (file) => {
      const inputPath = path.join(INPUT_DIR, file);
      const baseName = path.basename(file, path.extname(file));
      const outputPath = path.join(OUTPUT_DIR, `${baseName}.webp`);

      if (existsSync(outputPath)) {
        skipped++;
        return;
      }

      try {
        const meta = await sharp(inputPath).metadata();
        const isLandscape = (meta.width ?? 0) >= (meta.height ?? 0);

        await sharp(inputPath)
          .resize(
            isLandscape ? MAX_WIDTH : undefined,
            isLandscape ? undefined : MAX_HEIGHT,
            { fit: "inside", withoutEnlargement: true }
          )
          .webp({ quality: QUALITY, effort: 4 })
          .toFile(outputPath);

        done++;
        if (done % 20 === 0) {
          console.log(`  ${done}/${files.length - skipped} converted...`);
        }
      } catch (err) {
        errors.push({ file, err: err.message });
      }
    })
  );

  console.log(`\nDone! Converted: ${done}, Skipped (already exist): ${skipped}`);
  if (errors.length > 0) {
    console.warn(`\nErrors (${errors.length}):`);
    errors.forEach(({ file, err }) => console.warn(`  ${file}: ${err}`));
  }
}

convert().catch(console.error);
