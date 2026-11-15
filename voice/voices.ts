import { DEFAULT_VOICE_LANGUAGE, isVoiceLanguage, type VoiceLanguage } from "./languages";

/**
 * Which Sarvam model and speaker voices each language. Shared by the server
 * (voice/sarvam.ts) and the screens (browser fallback language).
 *
 * Sources (checked 2026-11-15):
 * - https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert
 *   bulbul:v3 covers all 11 languages; pace 0.5–2.0; output_audio_codec
 *   includes mp3; 2500 chars max.
 * - https://docs.sarvam.ai/api/getting-started/models/bulbul
 *   bulbul:v4-flash has no Malayalam or Odia, so v3 is used for every
 *   language to keep one model and one set of tested speakers.
 * - https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices
 *   "shubh" (male) and "ishita" (female) are the top-rated v3 speakers.
 *
 * Every pair below was spoken live through bulbul:v3 on 2026-11-15 and
 * transcribed back with saaras:v3 verbatim: digits in the text ("826",
 * "1200", "826 ... 50") are read as number words in each language, so the
 * announcement text keeps digits.
 */
export const TTS_MODEL = "bulbul:v3";
export const STT_MODEL = "saaras:v4";

/** A Soundbox speaks a little brisker than conversation. */
export const ANNOUNCE_PACE = 1.1;

/** mp3 is about half the size of the default WAV, so it arrives sooner. */
export const TTS_CODEC = "mp3";
export const TTS_CONTENT_TYPE = "audio/mpeg";

/** bulbul:v3 short-name speakers. Never send a v4 persona id to v3. */
export const BULBUL_V3_SPEAKERS = [
  "shubh", "aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan", "simran",
  "kavya", "amit", "dev", "ishita", "shreya", "ratan", "varun", "manan", "sumit",
  "roopa", "kabir", "aayan", "ashutosh", "advait", "anand", "tanya", "tarun",
  "sunny", "mani", "gokul", "vijay", "shruti", "suhani", "mohit", "kavitha",
  "rehan", "soham", "rupali",
] as const;
export type Speaker = (typeof BULBUL_V3_SPEAKERS)[number];

/**
 * A female voice, like the Soundbox. Hindi keeps "priya" (the voice the demo
 * was rehearsed with); the rest use "ishita", the docs' top-rated female v3
 * speaker for cross-language use.
 */
export const SPEAKER_BY_LANGUAGE: Record<VoiceLanguage, Speaker> = {
  "hi-IN": "priya",
  "en-IN": "ishita",
  "bn-IN": "ishita",
  "gu-IN": "ishita",
  "kn-IN": "ishita",
  "ml-IN": "ishita",
  "mr-IN": "ishita",
  "od-IN": "ishita",
  "pa-IN": "ishita",
  "ta-IN": "ishita",
  "te-IN": "ishita",
};

export function speakerFor(lang: VoiceLanguage): Speaker {
  return SPEAKER_BY_LANGUAGE[lang] ?? SPEAKER_BY_LANGUAGE[DEFAULT_VOICE_LANGUAGE];
}

export function isSpeaker(x: unknown): x is Speaker {
  return BULBUL_V3_SPEAKERS.includes(x as Speaker);
}

/**
 * The tag a browser's speechSynthesis uses. Sarvam writes Odia as "od-IN";
 * BCP-47 (and so browsers) write it "or-IN".
 */
export function browserLang(lang: VoiceLanguage): string {
  return lang === "od-IN" ? "or-IN" : lang;
}

/**
 * Reads the `language` field of a voice request. Missing means the default
 * language (older callers send none); present but unknown is an error.
 */
export function parseLanguageField(x: unknown): VoiceLanguage | null {
  if (x === undefined || x === null || x === "") return DEFAULT_VOICE_LANGUAGE;
  return isVoiceLanguage(x) ? x : null;
}
