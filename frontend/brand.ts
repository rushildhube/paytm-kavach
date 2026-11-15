import type { VoiceLanguage } from "@voice/languages";

/**
 * The demo's payments brand: one fictional company, defined only here.
 * Every screen, the spoken announcement and the demo VPA read from this
 * file, so renaming the brand means editing this file and nothing else.
 *
 * "Saakshi" (साक्षी) means witness: the payment app witnesses the sale.
 * Kavach is the feature ("Kavach by Saakshi"). Safe to import in the browser.
 */
const name = "Saakshi";

export const BRAND = {
  name,
  payName: `${name} Pay`,
  business: `${name} for Business`,
  /** The name in Devanagari, for Hindi text. */
  hi: "साक्षी",
  tagline: "Every sale has a witness",
  /** Feature line shown with the Kavach screens. */
  kavach: `Kavach by ${name}`,

  // Palette: deep indigo with a saffron accent.
  /** Buttons, active states, rings. White text on it passes WCAG AA. */
  primary: "#4338CA",
  /** Headings and dark surfaces. */
  navy: "#1E1B4B",
  /** Highlights in the logo and small accents. Do not put white text on it. */
  accent: "#F59E0B",
  /** Pale background for chips, icon tiles and selected items. */
  tint: "#EEF2FF",
  /** Second stop of dark gradients. */
  deep: "#312E81",

  /** Domain part of the demo payee VPA (not a real UPI handle). */
  vpaDomain: `demo${name.toLowerCase()}`,

  /**
   * "On Saakshi", as the Soundbox says it in each language, with the
   * grammar each language needs. Written for the demo; needs a native
   * speaker's check before a pitch. Update these if the name changes.
   */
  spokenOn: {
    "hi-IN": "साक्षी पर",
    "en-IN": "on Saakshi",
    "bn-IN": "সাক্ষীতে",
    "gu-IN": "સાક્ષી પર",
    "kn-IN": "ಸಾಕ್ಷಿಯಲ್ಲಿ",
    "ml-IN": "സാക്ഷിയിൽ",
    "mr-IN": "साक्षीवर",
    "od-IN": "ସାକ୍ଷୀରେ",
    "pa-IN": "ਸਾਕਸ਼ੀ 'ਤੇ",
    "ta-IN": "சாக்ஷியில்",
    "te-IN": "సాక్షిలో",
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
