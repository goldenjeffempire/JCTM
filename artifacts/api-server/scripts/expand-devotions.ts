import { pool } from "@workspace/db";
import { seedDevotionLibrary, getLibraryStatus } from "../src/lib/devotion-library.js";
import { expandDevotionLibrary } from "../src/lib/devotion-expansion.js";

// Explicit, bounded editorial operation. Does not email subscribers or publish
// anything immediately. The normal scheduler reserves approved future readings.
const batches = Math.max(1, Math.min(12, Number(process.argv.find(v => v.startsWith("--batches="))?.split("=")[1] ?? 1)));
const target = Math.max(1, Math.min(120, Number(process.argv.find(v => v.startsWith("--target="))?.split("=")[1] ?? 90)));
try {
  await seedDevotionLibrary();
  for (let i = 0; i < batches; i++) {
    const status = await getLibraryStatus();
    if ((status.counts.find(c => c.status === "ready")?.count ?? 0) >= target) break;
    const result = await expandDevotionLibrary(undefined, 12);
    console.log(JSON.stringify({ batch: i + 1, ...result }));
    if ("reason" in result && result.added === 0) break;
  }
  console.log(JSON.stringify(await getLibraryStatus()));
} catch (error) {
  // Do not serialize provider errors: they may include request metadata.
  console.error("Devotion expansion stopped safely", {
    type: error instanceof Error ? error.name : "UnknownError",
    status: (error as { status?: number }).status,
    code: (error as { code?: string }).code,
  });
  process.exitCode = 1;
} finally {
  await pool.end();
}
