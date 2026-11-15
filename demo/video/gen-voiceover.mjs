// Generates the demo voice-over through Sarvam TTS (model from voiceover.json), one MP3 per
// segment in demo/video/audio/, plus durations.json (seconds per segment).
// Runs on the presenter's machine only; the key is read from .env or the
// environment and never reaches a browser.
//   node demo/video/gen-voiceover.mjs [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const force = process.argv.includes("--force");

function key() {
  if (process.env.SARVAM_API_KEY) return process.env.SARVAM_API_KEY;
  for (const f of [".env.local", ".env"]) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/^SARVAM_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("SARVAM_API_KEY not set (env, .env.local or .env)");
}

const vo = JSON.parse(readFileSync(join(here, "voiceover.json"), "utf8"));
const out = join(here, "audio");
mkdirSync(out, { recursive: true });
const apiKey = key();

for (const seg of vo.segments) {
  const file = join(out, `${seg.id}.mp3`);
  if (existsSync(file) && !force) continue;
  const v = vo[seg.voice];
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: seg.text,
      language_code: v.language,
      model: vo.model ?? "bulbul:v3",
      speaker: v.speaker,
      pace: v.pace,
      output_audio_codec: "mp3",
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${seg.id}: Sarvam ${res.status} ${await res.text()}`);
  const json = await res.json();
  writeFileSync(file, Buffer.from(json.audios.join(""), "base64"));
  console.log(`wrote ${seg.id}.mp3`);
}
