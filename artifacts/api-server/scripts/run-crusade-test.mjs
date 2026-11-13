import { build } from "esbuild";
import { spawnSync } from "node:child_process";
const output = new URL("../dist/crusade-tools/test.mjs", import.meta.url);
await build({
  entryPoints: [new URL("./test-crusade.ts", import.meta.url).pathname],
  outfile: output.pathname, bundle: true, platform: "node", format: "esm", target: "node20",
  external: ["pg", "pg-native"],
});
const result = spawnSync(process.execPath, [output.pathname], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
