import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_CRUSADE } from "@workspace/content";
import { InvitationGenerator } from "@/components/crusade/InvitationGenerator";

describe("simplified crusade invitation form", () => {
  it("offers name and photo personalization for the whole crusade, without a message or programme selector", () => {
    const html = renderToStaticMarkup(createElement(InvitationGenerator, { campaign: DEFAULT_CRUSADE }));
    expect(html).toContain('data-testid="input-invite-name"');
    expect(html).toContain('data-testid="input-invite-photo"');
    expect(html).toContain('data-testid="input-invite-newsletter-email"');
    expect(html).toContain('type="email"');
    expect(html).not.toContain('data-testid="checkbox-invite-newsletter-consent"');
    expect(html).not.toContain('data-testid="button-newsletter-subscribe"');
    expect(html).toContain("never appears on your card");
    expect(html).toContain('data-testid="text-invite-event"');
    expect(html.toLowerCase()).toContain("end of year crusade 2026");
    expect(html).not.toContain('data-testid="input-invite-message"');
    expect(html).not.toContain('data-testid="select-invite-program"');
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<textarea");
  });
});
