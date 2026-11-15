/**
 * Sarvam speech and chat APIs, called from the server only so the key never
 * reaches the browser. Field names follow docs.sarvam.ai (checked 2026-11-15).
 */
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

/** Short audio (under 30 seconds) to text. */
export async function speechToText(
  audio: Blob,
  languageCode = "hi-IN",
): Promise<string> {
  // Browsers label recordings "audio/webm;codecs=opus"; Sarvam rejects the
  // codecs parameter but accepts the bare type.
  const type = audio.type.split(";")[0].trim() || "audio/webm";
  const form = new FormData();
  form.append("file", new Blob([audio], { type }), `sale.${type.split("/")[1] ?? "webm"}`);
  form.append("model", "saaras:v4");
  form.append("language_code", languageCode);
  const res = await fetch(`${BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": sarvamKey() },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) await fail(res);
  const json = (await res.json()) as { transcript?: string };
  return (json.transcript ?? "").trim();
}

/** Text to WAV audio bytes. */
export async function textToSpeech(
  text: string,
  languageCode = "hi-IN",
): Promise<Buffer> {
  const res = await fetch(`${BASE}/text-to-speech`, {
    method: "POST",
    headers: {
      "api-subscription-key": sarvamKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text.slice(0, 2500),
      language_code: languageCode,
      model: "bulbul:v3",
      speaker: "priya",
    }),
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
