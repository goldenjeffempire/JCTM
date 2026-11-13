import flyer640 from "@/assets/crusade/flyer-640.webp";
import flyer960 from "@/assets/crusade/flyer-960.webp";
import flyer1280 from "@/assets/crusade/flyer-1280.webp";

const OFFICIAL_FLYER = "/images/end-of-year-crusade-2026.webp";

/** Only substitute derivatives of the bundled flyer, never an administrator's replacement. */
export function crusadeFlyerImage(src: string) {
  if (src !== OFFICIAL_FLYER) return { src };
  return {
    src: flyer960,
    srcSet: `${flyer640} 640w, ${flyer960} 960w, ${flyer1280} 1280w, ${OFFICIAL_FLYER} 2048w`,
    width: 2048,
    height: 1143,
  };
}
