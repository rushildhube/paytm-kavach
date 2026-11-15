import { SarvamUnavailable, textToSpeech } from "@voice/sarvam";

/** Text in, WAV audio out. */
export async function POST(request: Request) {
  try {
    const { text } = (await request.json()) as { text?: string };
    if (!text?.trim()) {
      return Response.json({ error: "no text" }, { status: 400 });
    }
    const wav = await textToSpeech(text);
    return new Response(new Uint8Array(wav), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const status = err instanceof SarvamUnavailable ? 503 : 502;
    const message = err instanceof Error ? err.message : "text to speech failed";
    return Response.json({ error: message }, { status });
  }
}
