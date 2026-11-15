/**
 * Sarvam speech APIs, called from the server only so the key never
 * reaches the browser. Field names follow docs.sarvam.ai (checked 2026-11-15).
 */
const BASE = "https://api.sarvam.ai";

export class SarvamUnavailable extends Error {}

function key(): string {
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
  const form = new FormData();
  form.append("file", audio, "sale.webm");
  form.append("model", "saaras:v4");
  form.append("language_code", languageCode);
  const res = await fetch(`${BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": key() },
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
      "api-subscription-key": key(),
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
