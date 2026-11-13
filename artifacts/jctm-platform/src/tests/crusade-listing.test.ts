import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CRUSADE } from "@workspace/content";
import { useCrusade } from "@/lib/crusade-api";
import { CrusadeListing } from "@/components/crusade/CrusadeFeature";

vi.mock("@/lib/crusade-api", () => ({ useCrusade: vi.fn() }));

function renderListing(data = DEFAULT_CRUSADE) {
  vi.mocked(useCrusade).mockReturnValue({
    data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
  } as ReturnType<typeof useCrusade>);
  return renderToStaticMarkup(createElement(CrusadeListing));
}

describe("Gather With Us upcoming events", () => {
  it("includes the current official flyer beside the published programme list", () => {
    const flyerUrl = "/api/storage/objects/uploads/current-flyer.webp";
    const html = renderListing({ ...DEFAULT_CRUSADE, flyerUrl });
    expect(html).toContain('data-testid="img-upcoming-crusade-flyer"');
    expect(html).toContain(`src="${flyerUrl}"`);
    expect(html).toContain('data-testid="link-upcoming-crusade-flyer"');
    expect(html).toContain('href="/events/end-of-year-crusade-2026"');
    expect(html).toContain('loading="lazy"');
    for (const program of DEFAULT_CRUSADE.programs) expect(html).toContain(program.title);
  });
  it("does not show the flyer when the campaign is unpublished", () => {
    const html = renderListing({ ...DEFAULT_CRUSADE, published: false });
    expect(html).not.toContain('data-testid="img-upcoming-crusade-flyer"');
    expect(html).toContain('data-testid="status-no-upcoming"');
  });
});
