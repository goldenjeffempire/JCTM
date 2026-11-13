import { describe, expect, it } from "vitest";
import {
  sniffImageType, checkPhotoLimits, clampCrop, defaultSquareCrop, inviteFileName, PHOTO_MAX_BYTES,
} from "@/components/crusade/photo-utils";
import { containRect, splitTitle } from "@/components/crusade/invitation-canvas";

describe("private attendee photo handling", () => {
  it("adapts the reference heading to live campaign titles instead of copying Warri text", () => {
    expect(splitTitle("End of Year Crusade 2026")).toEqual({ gold: "END OF YEAR", white: "CRUSADE 2026" });
    expect(splitTitle("A Different Ministry Gathering")).toEqual({ gold: "A DIFFERENT MINISTRY GATHERING", white: "" });
    expect(splitTitle("New Year 2027 Gathering")).toEqual({ gold: "NEW YEAR", white: "2027 GATHERING" });
  });
  it("recognizes JPEG, PNG and WebP by their contents", () => {
    expect(sniffImageType(new Uint8Array([255, 216, 255, 224]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFFxxxxWEBPxxxx"))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg>pretend PNG</svg>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
  it("rejects oversized, tiny and excessively large decoded photos", () => {
    expect(checkPhotoLimits(PHOTO_MAX_BYTES + 1, 1080, 1920)).toMatch(/10 MB/);
    expect(checkPhotoLimits(1000, 30, 1920)).toMatch(/too small/);
    expect(checkPhotoLimits(1000, 10000, 10000)).toMatch(/too many pixels/);
    expect(checkPhotoLimits(2000000, 2048, 3072)).toBeNull();
  });
  it("centres both portrait and landscape photos and clamps repositioned crops", () => {
    expect(defaultSquareCrop(800, 1200)).toEqual({ x: 0, y: 200, width: 800, height: 800 });
    expect(defaultSquareCrop(1200, 800)).toEqual({ x: 200, y: 0, width: 800, height: 800 });
    expect(clampCrop({ x: -100, y: 900, width: 500, height: 500 }, 800, 1200))
      .toEqual({ x: 0, y: 700, width: 500, height: 500 });
    expect(clampCrop({ x: 100, y: -20, width: 2000, height: 2000 }, 800, 1200))
      .toEqual({ x: 0, y: 0, width: 800, height: 1200 });
  });
  it("contains complete portrait artwork and never puts visitor names in filenames", () => {
    expect(containRect(800, 1600, 100, 100, 250, 150)).toEqual({ x: 188, y: 100, w: 75, h: 150 });
    expect(inviteFileName("holy-spirit", "portrait")).toBe("jctm-crusade-2026-holy-spirit-portrait.png");
    expect(inviteFileName("../../unsafe path", "<portrait>")).toBe("jctm-crusade-2026-unsafe-path-portrait.png");
  });
});
