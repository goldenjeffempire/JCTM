import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CRUSADE } from "@workspace/content";
import {
  CrusadeRequestError,
  crusadeRequest,
  crusadeRetryDelay,
  isCrusadeNotFound,
  shouldRetryCrusadeLoad,
} from "@/lib/crusade-api";

afterEach(() => vi.unstubAllGlobals());

describe("crusade loading and recovery", () => {
  it("uses the same-origin campaign endpoint and preserves the cancellation signal", async () => {
    const signal = new AbortController().signal;
    const campaign = DEFAULT_CRUSADE;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(campaign)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(crusadeRequest("", { signal })).resolves.toEqual(campaign);
    expect(fetchMock).toHaveBeenCalledWith("/api/crusade-2026", { cache: "no-store", signal });
  });

  it("preserves the response status so unpublished events are distinct from outages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "This event is not currently published" }), { status: 404 }),
    ));

    await expect(crusadeRequest()).rejects.toMatchObject({
      status: 404,
      message: "This event is not currently published",
    });
    expect(isCrusadeNotFound(new CrusadeRequestError(404, "This event is not currently published"))).toBe(true);
    expect(isCrusadeNotFound(new CrusadeRequestError(503, "Temporarily unavailable"))).toBe(false);
  });

  it("treats a non-JSON gateway error as temporary instead of unpublished", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<html>Bad Gateway</html>", { status: 503 }),
    ));

    await expect(crusadeRequest()).rejects.toMatchObject({
      status: 503,
      message: "Unable to load crusade information",
    });
  });

  it("rejects incomplete success responses and retries them as temporary failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ published: true, title: "Incomplete crusade" })),
    ));

    await expect(crusadeRequest()).rejects.toMatchObject({
      status: 502,
      message: "The crusade details arrived incomplete. Please try again.",
    });
    expect(shouldRetryCrusadeLoad(0, new CrusadeRequestError(502, "Incomplete"))).toBe(true);
  });

  it("retries temporary failures, but not missing or invalid requests", () => {
    expect(shouldRetryCrusadeLoad(0, new CrusadeRequestError(503, "Unavailable"))).toBe(true);
    expect(shouldRetryCrusadeLoad(1, new CrusadeRequestError(429, "Rate limited"))).toBe(true);
    expect(shouldRetryCrusadeLoad(0, new TypeError("Network error"))).toBe(true);
    expect(shouldRetryCrusadeLoad(2, new TypeError("Network error"))).toBe(false);
    expect(shouldRetryCrusadeLoad(0, new CrusadeRequestError(404, "Not published"))).toBe(false);
    expect(shouldRetryCrusadeLoad(0, new CrusadeRequestError(400, "Invalid request"))).toBe(false);
    expect([0, 1, 2, 3].map(crusadeRetryDelay)).toEqual([500, 1_000, 2_000, 2_000]);
  });
});
