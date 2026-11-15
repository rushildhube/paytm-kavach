import { clientKey, RateLimited, takeToken } from "@backend/ratelimit";
import { SarvamUnavailable, transcribe } from "@voice/sarvam";
import { parseLanguageField } from "@voice/voices";

/** A tag is one short utterance (the recorder stops at 7 s); anything far bigger is refused. */
const MAX_AUDIO_BYTES = 1_000_000;

/** Browser-recorded audio in, transcript out. The Sarvam key stays on the server. */
export async function POST(request: Request) {
  try {
    takeToken("voice", clientKey(request));
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_AUDIO_BYTES * 1.1) {
      return Response.json({ error: "audio too long" }, { status: 413 });
    }
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return Response.json({ error: "no audio received" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "audio too long" }, { status: 413 });
    }
    // Form field `language`: a VoiceLanguage (default hi-IN), or "auto" to
    // let Sarvam detect it. The Soundbox sends the merchant's setting.
    const raw = form.get("language");
    const lang = raw === "auto" ? "unknown" : parseLanguageField(raw);
    if (!lang) return Response.json({ error: "unsupported language" }, { status: 400 });
    const { transcript, languageCode } = await transcribe(audio, lang);
    return Response.json({ transcript, languageCode });
  } catch (err) {
    if (err instanceof RateLimited) return Response.json({ error: err.message }, { status: 429 });
    const status = err instanceof SarvamUnavailable ? 503 : 502;
    const message = err instanceof Error ? err.message : "speech to text failed";
    return Response.json({ error: message }, { status });
  }
}
