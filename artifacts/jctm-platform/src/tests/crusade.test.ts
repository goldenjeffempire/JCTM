import { describe, expect, it } from "vitest";
import { DEFAULT_CRUSADE, nextCrusadeOccurrence } from "@workspace/content";
import { isoToWatLocal, watLocalToIso, scheduleSummary, campaignInvitationText, directionsUrl, campaignSignature } from "@/lib/crusade-format";
import { renderInvitation } from "@/components/crusade/invitation-canvas";

describe("crusade schedule and sharing", () => {
  it("recognizes a clean saved draft despite database JSON key reordering", () => {
    const reordered = JSON.parse(JSON.stringify(DEFAULT_CRUSADE, Object.keys(DEFAULT_CRUSADE).concat(["id", "description", "startsAt"]).sort()));
    // Program keys are also rearranged by JSONB serialization.
    expect(campaignSignature(reordered)).toBe(campaignSignature(DEFAULT_CRUSADE));
    expect(campaignSignature({ ...DEFAULT_CRUSADE, title: "Changed title" })).not.toBe(campaignSignature(DEFAULT_CRUSADE));
  });
  it("roundtrips Nigeria wall time independently of the device zone", () => {
    expect(isoToWatLocal("2026-12-31T19:00:00Z")).toBe("2026-12-31T20:00");
    expect(watLocalToIso("2027-01-01T20:00")).toBe("2027-01-01T20:00:00+01:00");
    expect(watLocalToIso("garbage")).toBeNull();
    expect(nextCrusadeOccurrence(DEFAULT_CRUSADE, Date.parse("2026-12-31T19:00:00Z"))?.program.id).toBe("first-all-night");
  });
  it("calls only consecutive daily occurrences daily", () => {
    expect(scheduleSummary(DEFAULT_CRUSADE.programs[0])).toContain("daily");
    expect(scheduleSummary({ ...DEFAULT_CRUSADE.programs[0], startsAt: ["2026-12-28T08:00:00+01:00", "2026-12-30T08:00:00+01:00"] })).not.toContain("daily");
  });
  it("shares the whole crusade, all live schedules and the name with the public domain", () => {
    const campaign = { ...DEFAULT_CRUSADE, minister: "Updated minister", venue: "Updated venue in Effurun, Delta State" };
    const text = campaignInvitationText(campaign, "Grace");
    expect(text).toContain("3 Jan 2027");
    expect(text).toContain("Updated minister");
    expect(text).toContain(campaign.venue);
    expect(text).toContain("Grace");
    for (const program of campaign.programs) expect(text).toContain(program.title);
    expect(text).toContain("https://jctm.org.ng/events/end-of-year-crusade-2026");
    expect(text).toContain(campaign.contactPhone);
    expect(text).toContain(campaign.contactEmail);
    expect(new URL(directionsUrl(campaign.venue)).searchParams.get("destination")).toBe(campaign.venue);
  });
  it("does not include unpublished programmes in campaign invitations", () => {
    const campaign = { ...DEFAULT_CRUSADE, programs: DEFAULT_CRUSADE.programs.map((p, i) => ({ ...p, published: i !== 0 })) };
    const text = campaignInvitationText(campaign, "Grace");
    expect(text).not.toContain("Baptism Program");
    expect(text).toContain("Holy Spirit Impartation");
  });
});

describe("high-resolution invitation rendering", () => {
  for (const format of ["square", "portrait"] as const) {
    for (const aspect of ["landscape", "portrait"] as const) {
      it(`keeps the name, all programmes and artwork inside ${format} with ${aspect} artwork`, () => {
        const texts: { text: string; x: number; y: number; font: string }[] = [];
        const images: { image: unknown; coordinates: number[] }[] = [];
        const gradient = { addColorStop() {} };
        const ctx = {
          font: "20px sans-serif", textBaseline: "", textAlign: "", fillStyle: "", strokeStyle: "", lineWidth: 1,
          shadowColor: "", shadowBlur: 0, shadowOffsetY: 0,
          createLinearGradient: () => gradient, createRadialGradient: () => gradient,
          fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, arc() {}, fill() {}, stroke() {}, save() {}, restore() {}, clip() {},
          measureText(text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 20) * 0.52 }; },
          fillText(text: string, x: number, y: number) { texts.push({ text, x, y, font: this.font }); },
          drawImage(image: unknown, ...coordinates: number[]) { images.push({ image, coordinates }); },
        };
        const canvas = { width: 0, height: 0, getContext: () => ctx };
        const name = "Grace and the entire extended family of worshippers in our community";
        const campaign = { ...DEFAULT_CRUSADE, title: "The live campaign title", minister: "The live minister" };
        const photo = { image: { naturalWidth: 800, naturalHeight: 1200 } as HTMLImageElement,
          crop: { x: 50, y: 250, width: 600, height: 600 } };
        const background = { naturalWidth: 552, naturalHeight: 491 } as HTMLImageElement;
        renderInvitation(canvas as unknown as HTMLCanvasElement, {
          format, flyer: { naturalWidth: aspect === "landscape" ? 2048 : 800, naturalHeight: aspect === "landscape" ? 1144 : 1600 } as HTMLImageElement,
          campaign, name, photo, background,
        });
        expect(canvas.width).toBe(1080);
        expect(canvas.height).toBe(format === "square" ? 1080 : 1350);
        const all = texts.map(t => t.text).join(" ").replace(/\s+/g, " ");
        expect(all).toContain(name);
        expect(all).toContain("THE LIVE CAMPAIGN TITLE");
        expect(all).toContain("The live minister");
        expect(all).toContain("BAPTISM PROGRAM");
        for (const program of campaign.programs) expect(all.toUpperCase()).toContain(program.title.toUpperCase());
        expect(all).toContain("CONFIRMED & ATTENDING");
        expect(all).toContain(campaign.contactPhone);
        expect(all).toContain(campaign.contactEmail);
        const cropped = images.find(call => call.image === photo.image);
        expect(cropped?.coordinates.slice(0, 4)).toEqual([50, 250, 600, 600]);
        expect(images.some(call => call.image === background)).toBe(true);
        expect(texts.every(t => t.y > 0 && t.y < canvas.height)).toBe(true);
        for (const { image, coordinates: coords } of images) {
          if (image === background) continue; // Background cover may extend beyond the canvas and be clipped.
          const [x, y, w, h] = coords.length === 8 ? coords.slice(4) : coords;
          expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
          expect(x + w).toBeLessThanOrEqual(canvas.width); expect(y + h).toBeLessThanOrEqual(canvas.height);
        }
      });
    }
  }
});
