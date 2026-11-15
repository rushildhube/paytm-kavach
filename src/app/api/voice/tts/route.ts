import { clientKey, RateLimited, takeToken } from "@backend/ratelimit";
import { SarvamUnavailable, textToSpeech } from "@voice/sarvam";
import { parseLanguageField, TTS_CONTENT_TYPE } from "@voice/voices";

/** Longest text spoken in one request (the hold explanation is well under this). */
const MAX_TEXT_CHARS = 2500;

/**
 * `{ text, language? }` in, MP3 audio out. `language` is a VoiceLanguage
 * (default hi-IN); the speaker is chosen on the server, never by the client.
 */
export async function POST(request: Request) {
  try {
    takeToken("voice", clientKey(request));
    const { text, language } = (await request.json()) as { text?: unknown; language?: unknown };
    if (typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "no text" }, { status: 400 });
    }
    if (text.length > MAX_TEXT_CHARS) {
      return Response.json({ error: "text too long" }, { status: 413 });
    }
    const lang = parseLanguageField(language);
    if (!lang) return Response.json({ error: "unsupported language" }, { status: 400 });
    const audio = await textToSpeech(text, lang);
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": TTS_CONTENT_TYPE, "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof RateLimited) return Response.json({ error: err.message }, { status: 429 });
    const status = err instanceof SarvamUnavailable ? 503 : 502;
    const message = err instanceof Error ? err.message : "text to speech failed";
    return Response.json({ error: message }, { status });
  }
}
