/**
 * Sarvam speech and chat APIs, called from the server only so the key never
 * reaches the browser. Field names follow docs.sarvam.ai (checked 2026-11-15).
 */
import { DEFAULT_VOICE_LANGUAGE, type VoiceLanguage } from "./languages";
import {
  ANNOUNCE_PACE,
  speakerFor,
  STT_MODEL,
  TTS_CODEC,
  TTS_MODEL,
  type Speaker,
} from "./voices";

const BASE = "https://api.sarvam.ai";

export class SarvamUnavailable extends Error {}

export function sarvamKey(): string {
  const k = process.env.SARVAM_API_KEY;
  if (!k) throw new SarvamUnavailable("SARVAM_API_KEY is not set");
  return k;
}

export const sarvamConfigured = () => Boolean(process.env.SARVAM_API_KEY);

async function fail(res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  throw new Error(`Sarvam ${res.status}: ${body.slice(0, 300)}`);
}

/** What Sarvam heard, and the language it heard it in. */
export type Transcription = { transcript: string; languageCode: string | null };

/**
 * Short audio (under 30 seconds) to text. `language` is the merchant's
 * language; "unknown" asks Sarvam to detect it.
 */
export async function speechToText(
  audio: Blob,
  language: VoiceLanguage | "unknown" = DEFAULT_VOICE_LANGUAGE,
): Promise<string> {
  return (await transcribe(audio, language)).transcript;
}

/** Like `speechToText`, also returning the language Sarvam heard. */
export async function transcribe(
  audio: Blob,
  language: VoiceLanguage | "unknown" = DEFAULT_VOICE_LANGUAGE,
): Promise<Transcription> {
  // Browsers label recordings "audio/webm;codecs=opus"; Sarvam rejects the
  // codecs parameter but accepts the bare type.
  const type = audio.type.split(";")[0].trim() || "audio/webm";
  const form = new FormData();
  form.append("file", new Blob([audio], { type }), `sale.${type.split("/")[1] ?? "webm"}`);
  form.append("model", STT_MODEL);
  form.append("language_code", language);
  const res = await fetch(`${BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": sarvamKey() },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) await fail(res);
  const json = (await res.json()) as { transcript?: string; language_code?: string | null };
  return { transcript: (json.transcript ?? "").trim(), languageCode: json.language_code ?? null };
}

/** The JSON body sent to /text-to-speech. Exported for tests. */
export function ttsRequestBody(text: string, language: VoiceLanguage, speaker?: Speaker) {
  return {
    text: text.slice(0, 2500),
    language_code: language,
    model: TTS_MODEL,
    speaker: speaker ?? speakerFor(language),
    pace: ANNOUNCE_PACE,
    output_audio_codec: TTS_CODEC,
  };
}

/** Text to MP3 bytes (`TTS_CONTENT_TYPE`) in the language's own voice. */
export async function textToSpeech(
  text: string,
  language: VoiceLanguage = DEFAULT_VOICE_LANGUAGE,
  speaker?: Speaker,
): Promise<Buffer> {
  const res = await fetch(`${BASE}/text-to-speech`, {
    method: "POST",
    headers: {
      "api-subscription-key": sarvamKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ttsRequestBody(text, language, speaker)),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) await fail(res);
  const json = (await res.json()) as { audios?: string[] };
  if (!json.audios?.length) throw new Error("Sarvam returned no audio");
  return Buffer.from(json.audios.join(""), "base64");
}

/** One chat completion from Sarvam's flagship model. Returns the reply text. */
export async function chat(system: string, user: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "api-subscription-key": sarvamKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sarvam-105b",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // null turns reasoning off. With it on, reasoning used the whole token
      // budget and took 25s+; off, a draft comes back in a few seconds.
      reasoning_effort: null,
      max_tokens: 4096,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) await fail(res);
  const json = (await res.json()) as {
    choices?: { finish_reason?: string; message?: { content?: string | null } }[];
  };
  const choice = json.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("draft was cut off");
  if (choice?.finish_reason === "content_filter") throw new Error("model declined");
  return (choice?.message?.content ?? "").trim();
}
