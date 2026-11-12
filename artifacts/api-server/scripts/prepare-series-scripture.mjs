import { readFile, writeFile } from "node:fs/promises";
const dir = new URL("../src/lib/devotion-series/", import.meta.url);
const refs = JSON.parse(await readFile(new URL("references.json", dir), "utf8"));
let quotes = {};
try { quotes = JSON.parse(await readFile(new URL("scripture.json", dir), "utf8")); } catch {}
for (const reference of refs) {
  if (quotes[reference]) continue;
  const r = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Scripture verification failed ${r.status}: ${reference}`);
  const result = await r.json();
  if (result.translation_id !== "kjv" || !result.verses?.length || !result.text?.trim()) throw new Error(`Invalid KJV response: ${reference}`);
  quotes[reference] = result.text.replace(/\s+/g, " ").trim();
  await writeFile(new URL("scripture.json", dir), JSON.stringify(quotes, null, 2) + "\n");
  console.log(`Verified ${Object.keys(quotes).length}/90: ${reference}`);
  await new Promise(resolve => setTimeout(resolve, 2500));
}
if (refs.length !== 90 || Object.keys(quotes).length !== 90) throw new Error("Expected exactly 90 verified passages");
