/**
 * Languages the merchant can pick for the Soundbox voice. These are the
 * Indian languages Sarvam's speech models list (docs.sarvam.ai, checked
 * 2026-11-15). Shared by the backend (merchant settings) and the screens.
 */
export const VOICE_LANGUAGES = [
  { code: "hi-IN", name: "Hindi", native: "हिन्दी" },
  { code: "en-IN", name: "English", native: "English" },
  { code: "bn-IN", name: "Bengali", native: "বাংলা" },
  { code: "gu-IN", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn-IN", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml-IN", name: "Malayalam", native: "മലയാളം" },
  { code: "mr-IN", name: "Marathi", native: "मराठी" },
  { code: "od-IN", name: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "pa-IN", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ta-IN", name: "Tamil", native: "தமிழ்" },
  { code: "te-IN", name: "Telugu", native: "తెలుగు" },
] as const;

export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number]["code"];

export const DEFAULT_VOICE_LANGUAGE: VoiceLanguage = "hi-IN";

export function isVoiceLanguage(x: unknown): x is VoiceLanguage {
  return VOICE_LANGUAGES.some((l) => l.code === x);
}
