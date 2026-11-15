// Re-mixes the voice-over onto an existing recording, without recording again.
//   node demo/video/mix.mjs <recording.webm>
// Uses demo/video/cues.json (written by record.mjs) and the MP3s in audio/.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";

const here = dirname(fileURLToPath(import.meta.url));
const webm = process.argv[2];
if (!webm) throw new Error("usage: node demo/video/mix.mjs <recording.webm>");
const { cues, endT } = JSON.parse(readFileSync(join(here, "cues.json"), "utf8"));
const inputs = ["-i", webm];
const filters = [];
cues.forEach((c, i) => {
  inputs.push("-i", join(here, "audio", `${c.id}.mp3`));
  const ms = Math.round(c.t * 1000);
  filters.push(`[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`);
});
filters.push(`${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0:dropout_transition=0[aout]`);
const start = Math.max(0, cues[0].t - 1.2).toFixed(2);
const out = join(here, "kavach-demo.mp4");
execFileSync(
  ffmpeg,
  ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[aout]",
    "-ss", start, "-t", (endT - Number(start)).toFixed(2),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out],
  { stdio: "inherit" },
);
console.log(`wrote ${out}`);
