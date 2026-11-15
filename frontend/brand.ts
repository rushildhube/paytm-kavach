import type { VoiceLanguage } from "@voice/languages";

/**
 * The demo's payments brand: one fictional company, defined only here.
 * Every screen, the spoken announcement and the demo VPA read from this
 * file, so renaming the brand means editing this file and nothing else.
 *
 * "AITM" stands for AI Transfer Money. Kavach is the feature
 * ("Kavach by AITM"). Safe to import in the browser.
 */
const name = "AITM";

export const BRAND = {
  name,
  payName: name,
  business: `${name} for Business`,
  /** The name in Devanagari, for Hindi text. */
  hi: "एआईटीएम",
  /** What the letters stand for. */
  expansion: "AI Transfer Money",
  tagline: "AI Transfer Money",
  /** Feature line shown with the Kavach screens. */
  kavach: `Kavach by ${name}`,

  // Palette: sky blue and navy (the look of Indian UPI apps) with a saffron accent.
  /** Buttons, active states, rings. White text on it is below WCAG AA; keep button text bold and large. */
  primary: "#00AEEF",
  /** Headings and dark surfaces. */
  navy: "#002E6E",
  /** Highlights in the logo and small accents. Do not put white text on it. */
  accent: "#F59E0B",
  /** Pale background for chips, icon tiles and selected items. */
  tint: "#E6F7FD",
  /** Second stop of dark gradients. */
  deep: "#00205A",

  /** Domain part of the demo payee VPA (not a real UPI handle). */
  vpaDomain: `demo${name.toLowerCase()}`,

  /**
   * "On AITM", as the Soundbox says it in each language, with the
   * grammar each language needs. Written for the demo; needs a native
   * speaker's check before a pitch. Update these if the name changes.
   */
  spokenOn: {
    "hi-IN": "एआईटीएम पर",
    "en-IN": "on AITM",
    "bn-IN": "এআইটিএম-এ",
    "gu-IN": "એઆઈટીએમ પર",
    "kn-IN": "ಎಐಟಿಎಂನಲ್ಲಿ",
    "ml-IN": "എഐടിഎമ്മിൽ",
    "mr-IN": "एआयटीएमवर",
    "od-IN": "ଏଆଇଟିଏମରେ",
    "pa-IN": "ਏਆਈਟੀਐਮ 'ਤੇ",
    "ta-IN": "ஏஐடிஎம்-இல்",
    "te-IN": "ఏఐటీఎంలో",
  } satisfies Record<VoiceLanguage, string>,
} as const;

/** CSS variables for the palette, set on <html> so Tailwind's brand colours follow brand.ts. */
export function brandCssVars(): Record<string, string> {
  return {
    "--brand-primary": BRAND.primary,
    "--brand-navy": BRAND.navy,
    "--brand-accent": BRAND.accent,
    "--brand-tint": BRAND.tint,
    "--brand-deep": BRAND.deep,
  };
}
