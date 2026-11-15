import { SarvamUnavailable, speechToText } from "@voice/sarvam";

/** Browser-recorded audio in, transcript out. The Sarvam key stays on the server. */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return Response.json({ error: "no audio received" }, { status: 400 });
    }
    const transcript = await speechToText(audio);
    return Response.json({ transcript });
  } catch (err) {
    const status = err instanceof SarvamUnavailable ? 503 : 502;
    const message = err instanceof Error ? err.message : "speech to text failed";
    return Response.json({ error: message }, { status });
  }
}
