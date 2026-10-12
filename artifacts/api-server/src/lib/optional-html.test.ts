import { test } from "node:test";
import assert from "node:assert/strict";
import { createOptionalHtmlEnrichment } from "./optional-html.js";

test("healthy enrichment is preserved", async () => {
  const load = createOptionalHtmlEnrichment(async () => "<script>schema</script>", () => {
    assert.fail("Healthy enrichment must not be skipped");
  });
  assert.equal(await load(), "<script>schema</script>");
});

test("a hung dependency cannot hold HTML; concurrent requests share one operation", async () => {
  let calls = 0;
  const skipped: string[] = [];
  const load = createOptionalHtmlEnrichment(() => {
    calls++;
    return new Promise<string>(() => {});
  }, (reason) => skipped.push(reason), 20, 100);
  const start = Date.now();
  const results = await Promise.all(Array.from({ length: 20 }, () => load()));
  assert.deepEqual(results, Array(20).fill(""));
  assert.equal(calls, 1);
  assert.ok(Date.now() - start < 500, "HTML must not wait for a DB connection timeout");
  assert.deepEqual(skipped, ["timeout"]);
  assert.equal(await load(), "");
  assert.equal(calls, 1);
});

test("rejected enrichment is omitted and retries are cooled down", async () => {
  let calls = 0;
  const skipped: string[] = [];
  const load = createOptionalHtmlEnrichment(async () => {
    calls++;
    throw new Error("database unavailable");
  }, (reason) => skipped.push(reason), 20, 100);
  assert.equal(await load(), "");
  assert.equal(await load(), "");
  assert.equal(calls, 1);
  assert.deepEqual(skipped, ["error"]);
});

test("work finishing after the deadline recovers for later requests", async () => {
  let finish!: (value: string) => void;
  let calls = 0;
  const load = createOptionalHtmlEnrichment(() => {
    calls++;
    return calls === 1 ? new Promise<string>((resolve) => { finish = resolve; }) : Promise.resolve("fresh");
  }, () => {}, 20, 100);
  assert.equal(await load(), "");
  finish("finished");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(await load(), "fresh");
  assert.equal(calls, 2);
});
