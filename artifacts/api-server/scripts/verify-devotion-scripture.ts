import { DEVOTION_SEEDS } from "../src/lib/devotion-seeds.js";
import { verifyScripture } from "../src/lib/devotion-expansion.js";
import { pool } from "@workspace/db";

try {
  const failures: string[] = [];
  for (const [index, devotion] of DEVOTION_SEEDS.entries()) {
    try {
      await verifyScripture(devotion);
      console.log(`Verified ${index + 1}/${DEVOTION_SEEDS.length}: ${devotion.reference}`);
    } catch (error) {
      failures.push(devotion.reference);
      console.error(`FAILED ${devotion.reference}: ${(error as Error).message}`);
    }
    // Respect the public Scripture service; do not flood it with parallel work.
    await new Promise(resolve => setTimeout(resolve, 2200));
  }
  if (failures.length) throw new Error(`${failures.length} quotations need attention: ${failures.join(", ")}`);
} catch (error) {
  console.error("Scripture verification stopped:", (error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
