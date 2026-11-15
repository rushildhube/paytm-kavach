import { clientKey, RateLimited, takeToken } from "@backend/ratelimit";
import { SarvamUnavailable, textToSpeech } from "@voice/sarvam";

/** Longest text spoken in one request (the hold explanation is well under this). */
const MAX_TEXT_CHARS = 2500;

/** Text in, WAV audio out. */
export async function POST(request: Request) {
  try {
    takeToken("voice", clientKey(request));
    const { text } = (await request.json()) as { text?: unknown };
    if (typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "no text" }, { status: 400 });
    }
    if (text.length > MAX_TEXT_CHARS) {
      return Response.json({ error: "text too long" }, { status: 413 });
    }
    const wav = await textToSpeech(text);
    return new Response(new Uint8Array(wav), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof RateLimited) return Response.json({ error: err.message }, { status: 429 });
    const status = err instanceof SarvamUnavailable ? 503 : 502;
    const message = err instanceof Error ? err.message : "text to speech failed";
    return Response.json({ error: message }, { status });
  }
}
