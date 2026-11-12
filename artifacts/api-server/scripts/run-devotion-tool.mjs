import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const tool = process.argv[2];
if (!["expand-devotions", "test-devotions", "verify-devotion-scripture"].includes(tool)) throw new Error("Unknown devotion tool");
const root = fileURLToPath(new URL("../", import.meta.url));
const output = `${root}dist/devotion-tools/${tool}.mjs`;
await build({
  entryPoints: [`${root}scripts/${tool}.ts`],
  outfile: output, bundle: true, platform: "node", format: "esm", target: "node20",
  external: ["pg", "pg-native", "openai"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const result = spawnSync(process.execPath, [output, ...process.argv.slice(3)], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
