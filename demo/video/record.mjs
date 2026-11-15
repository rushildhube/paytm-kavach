// Records the four-screen Kavach demo with the Sarvam voice-over (refs #14).
//
//   1. node demo/video/gen-voiceover.mjs        (Sarvam TTS → demo/video/audio/*.mp3)
//   2. npx next build                           (once; uses the production server)
//   3. node demo/video/record.mjs               (→ demo/video/kavach-demo.mp4)
//
// Starts its own `next start` on PORT (default 3217) with a throw-away
// database, so the presenter's dev server and data are untouched. Drives the
// installed Chrome (playwright-core, channel "chrome"), clicks through the real
// flow on /customer, /soundbox, /merchant and /bank, logs when each narration
// segment starts, then mixes the MP3s onto the video with ffmpeg-static.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { chromium } from "playwright-core";
import ffmpeg from "ffmpeg-static";
import QRCode from "qrcode";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const PORT = Number(process.env.PORT ?? 3217);
const BASE = `http://localhost:${PORT}`;
const work = join(process.env.CLAUDE_JOB_DIR ?? tmpdir(), `kavach-video-${Date.now()}`);
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const vo = JSON.parse(readFileSync(join(here, "voiceover.json"), "utf8"));
const audioDir = join(here, "audio");
const dur = {};
for (const s of vo.segments) {
  const f = join(audioDir, `${s.id}.mp3`);
  if (!existsSync(f)) throw new Error(`missing ${f}; run gen-voiceover.mjs first`);
  let out = "";
  try {
    execFileSync(ffmpeg, ["-hide_banner", "-i", f], { stdio: "pipe" });
  } catch (e) {
    out = String(e.stderr);
  }
  const m = out.match(/Duration: (\d+):(\d+):([\d.]+)/);
  dur[s.id] = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// ── server ──────────────────────────────────────────────────────────────────
try {
  await fetch(BASE);
  throw new Error(`port ${PORT} is already in use; set PORT to a free port`);
} catch (e) {
  if (String(e.message).startsWith("port ")) throw e;
}
const server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT)], {
  cwd: root,
  env: { ...process.env, KAVACH_DB: join(work, "demo.db"), KAVACH_WATCH_FEEDS: "0", PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stderr.on("data", (d) => process.stderr.write(`[next] ${d}`));
const stopServer = () => server.kill();
process.on("exit", stopServer);
for (let i = 0; ; i++) {
  try {
    if ((await fetch(BASE + "/bank")).ok) break;
  } catch {}
  if (i > 120) throw new Error("server did not start");
  await new Promise((r) => setTimeout(r, 500));
}
const api = (body) =>
  fetch(`${BASE}/api/kavach`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
await api({ action: "reset", role: "bank" });

// A Hindi phrase for the Soundbox mic (Chrome's fake microphone plays it).
const micWav = join(work, "mic.wav");
{
  const key =
    process.env.SARVAM_API_KEY ??
    readFileSync(join(root, ".env"), "utf8").match(/^SARVAM_API_KEY=(.+)$/m)?.[1].trim();
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "एक तेल, दो साबुन", language_code: "hi-IN", model: "bulbul:v3", speaker: "rahul", pace: 0.95, output_audio_codec: "wav" }),
  });
  const json = await res.json();
  const raw = join(work, "mic-raw.wav");
  writeFileSync(raw, Buffer.from(json.audios.join(""), "base64"));
  // speech first, then a long silence, so the recorder stops on silence
  execFileSync(ffmpeg, ["-y", "-i", raw, "-af", "apad=pad_dur=4", "-ar", "48000", "-ac", "1", micWav], { stdio: "pipe" });
}

// ── stage ───────────────────────────────────────────────────────────────────
const W = 1920, H = 1080;
const stage = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:"Segoe UI",system-ui,sans-serif;background:linear-gradient(160deg,#002E6E,#00205A 60%,#001233);color:#fff}
.row{position:absolute;top:44px;left:0;right:0;display:flex;justify-content:center;gap:26px;align-items:flex-start}
.col{display:flex;flex-direction:column;align-items:center;gap:10px;transition:opacity .4s,transform .4s}
.lbl{font-size:17px;font-weight:600;letter-spacing:.02em;color:#BFE9FA}
.lbl b{color:#fff}
.dev{border-radius:30px;overflow:hidden;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.45);outline:4px solid transparent;transition:outline-color .35s,box-shadow .35s}
.on .dev{outline-color:#00AEEF;box-shadow:0 0 0 10px rgba(0,174,239,.25),0 10px 40px rgba(0,0,0,.5)}
.dim .col:not(.on){opacity:.55}
iframe{border:0;display:block;background:#fff}
#bank .dev{border-radius:14px}
#cap{position:absolute;left:80px;right:80px;bottom:26px;min-height:72px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:27px;line-height:1.3;font-weight:500;background:rgba(0,18,51,.82);border:1px solid rgba(0,174,239,.4);border-radius:18px;padding:12px 28px;transition:opacity .3s}
#card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:linear-gradient(160deg,#002E6E,#00205A 60%,#001233);transition:opacity .9s;z-index:5;text-align:center;padding:0 200px}
#card h1{font-size:96px;font-weight:800;letter-spacing:-.02em}
#card h1 span{color:#00AEEF}
#card p{font-size:34px;color:#CFEFFC;max-width:1300px;line-height:1.35}
#card small{font-size:20px;color:#8FB8D8}
.hide{opacity:0;pointer-events:none}
</style></head><body>
<div class="row" id="row">
 <div class="col" id="customer"><div class="lbl"><b>Buyer</b> · phone</div><div class="dev"><iframe src="${BASE}/customer" width="390" height="844" allow="camera; microphone; autoplay"></iframe></div></div>
 <div class="col" id="soundbox"><div class="lbl"><b>Soundbox</b> · on the counter</div><div class="dev"><iframe src="${BASE}/soundbox" width="410" height="844" allow="camera; microphone; autoplay"></iframe></div></div>
 <div class="col" id="merchant"><div class="lbl"><b>Shopkeeper</b> · AITM for Business</div><div class="dev"><iframe src="${BASE}/merchant" width="390" height="844" allow="microphone; autoplay"></iframe></div></div>
 <div class="col" id="bank"><div class="lbl"><b>Bank</b> · presenter console</div><div class="dev"><iframe src="${BASE}/bank" width="600" height="844" allow="autoplay"></iframe></div></div>
</div>
<div id="cap" class="hide"></div>
<div id="card"><h1>Kavach <span>by AITM</span></h1><p id="cardText">Proof of sale, recorded at the moment of payment</p><small>Hackathon demo · synthetic data · draft, not legal advice</small></div>
<script>
window.cap=(t)=>{const c=document.getElementById('cap');if(!t){c.classList.add('hide');return}c.textContent=t;c.classList.remove('hide')};
window.focusOn=(ids)=>{const row=document.getElementById('row');document.querySelectorAll('.col').forEach(e=>e.classList.toggle('on',ids.includes(e.id)));row.classList.toggle('dim',ids.length>0)};
window.card=(show,text)=>{const c=document.getElementById('card');if(text)document.getElementById('cardText').textContent=text;c.classList.toggle('hide',!show)};
</script></body></html>`;

// Playwright records video with its own ffmpeg build; ffmpeg-static (VP8 included)
// stands in, so nothing else is downloaded. The folder name is playwright-core's.
if (process.platform === "win32") {
  const pw = join(process.env.LOCALAPPDATA, "ms-playwright", "ffmpeg-1013");
  if (!existsSync(join(pw, "ffmpeg-win64.exe"))) {
    mkdirSync(pw, { recursive: true });
    copyFileSync(ffmpeg, join(pw, "ffmpeg-win64.exe"));
  }
}
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${micWav}`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: work, size: { width: W, height: H } },
  permissions: ["microphone", "camera"],
});
await context.grantPermissions(["microphone", "camera"], { origin: BASE });
const t0 = Date.now();
const page = await context.newPage();
await page.setContent(stage, { waitUntil: "load" });
const fr = (id) => page.frameLocator(`#${id} iframe`);
const customer = fr("customer"), soundbox = fr("soundbox"), merchant = fr("merchant"), bank = fr("bank");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cues = [];
page.setDefaultTimeout(15_000);
/** Runs a UI step; if it fails, does the same through the API and keeps recording. */
async function guard(name, ui, fallback) {
  try {
    await ui();
  } catch (e) {
    console.warn(`step "${name}" fell back to the API: ${String(e.message).split(String.fromCharCode(10))[0]}`);
    try { await fallback(); } catch (f) { console.warn(`fallback for "${name}" failed: ${f.message}`); }
  }
}
const segText = Object.fromEntries(vo.segments.map((s) => [s.id, s.text]));
/** Starts a narration segment; resolves when it has been spoken (plus a pause). */
async function say(id, caption, pauseMs = 450) {
  cues.push({ id, t: (Date.now() - t0) / 1000 });
  if (caption !== undefined) await page.evaluate((c) => window.cap(c), caption);
  await sleep(dur[id] * 1000 + pauseMs);
}
const focus = (...ids) => page.evaluate((x) => window.focusOn(x), ids);
const scroll = (frame, y) => frame.locator("body").evaluate((_, dy) => window.scrollBy({ top: dy, behavior: "smooth" }), y);
const scrollTop = (frame) => frame.locator("body").evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

try {
  // Wait for all four screens, then switch the Soundbox on (behind the title card).
  await soundbox.getByText("Tap to switch on").waitFor({ timeout: 60_000 });
  await bank.getByText("Report", { exact: false }).first().waitFor({ timeout: 60_000 });
  // under the title card, so press it directly rather than by pointer
  await soundbox.getByText("Tap to switch on").evaluate((el) => el.closest("button").click());
  await sleep(1500);

  // 1 · problem (title card)
  await say("01-problem", undefined, 300);
  await page.evaluate(() => window.card(false));
  await sleep(900);

  // 2 · idea, the four screens
  await page.evaluate(() => window.cap("Other tools write the letter after the freeze. Kavach makes sure the proof already exists."));
  const p2 = say("02-idea");
  await sleep(dur["02-idea"] * 400);
  for (const id of ["customer", "soundbox", "merchant", "bank"]) {
    await focus(id);
    await sleep(dur["02-idea"] * 130);
  }
  await p2;
  await focus();

  // 3 · merchant makes a bill and sends it to the Soundbox with voice
  await focus("merchant");
  const p3 = say("03-bill", "The shopkeeper makes a bill: ₹826 for 2 kg sugar and 1 oil, and sends it to the Soundbox.");
  await merchant.getByText("बिल बनाइए").first().click();
  await sleep(700);
  await merchant.getByLabel("Bill amount in rupees").pressSequentially("826", { delay: 140 });
  await merchant.getByPlaceholder("दो किलो चीनी, एक तेल").pressSequentially("दो किलो चीनी, एक तेल", { delay: 70 });
  await merchant.getByText("🔊 Soundbox बोलकर माँगे").first().click();
  await sleep(500);
  await p3.then(() => {});
  await merchant.getByRole("button", { name: "बिल बनाकर Soundbox पर भेजिए" }).click();
  await focus("merchant", "soundbox");
  await soundbox.getByText("826", { exact: false }).first().waitFor();
  await sleep(600);
  await say("03s-request", "Soundbox: “Please pay ₹826 for 2 kg sugar, 1 oil.”", 600);

  // 4 · buyer scans the Soundbox QR and pays
  await focus("customer", "soundbox");
  // the same UPI URI the Soundbox's bill QR carries (frontend/upi.ts buildUpiUri)
  const sbState = (await api({ action: "state", role: "soundbox" })).state;
  const req = sbState.request;
  const uri =
    "upi://pay?" +
    [
      ["pa", sbState.payee.vpa],
      ["pn", sbState.payee.shopName],
      ["am", req.amountInr.toFixed(2)],
      ["cu", "INR"],
      ["tr", req.billId],
      ["tn", `Bill ${req.billId}`],
    ]
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
  const qrPng = join(work, "bill-qr.png");
  await QRCode.toFile(qrPng, uri, { width: 600, margin: 4 });
  const p4 = say("04-pay", "The buyer scans the QR on the Soundbox and pays with their UPI PIN.");
  await guard("bill pay", async () => {
await customer.getByRole("button", { name: /Scan & Pay/ }).click();
  await sleep(1400);
  await customer.locator('input[type="file"]').setInputFiles(qrPng);
  await customer.getByRole("button", { name: /^Pay ₹/ }).waitFor();
  await sleep(1600);
  await customer.getByRole("button", { name: /^Pay ₹/ }).click();
  for (const d of ["1", "2", "3", "4"]) {
    await sleep(380);
    await customer.getByRole("button", { name: d, exact: true }).click();
  }
  await sleep(400);
  await customer.getByRole("button", { name: "Submit PIN" }).click();
}, async () => { await api({ action: "pay", role: "customer", billId: req.billId, amountInr: req.amountInr, payerVpa: "buyer@okdemo" }); });
  await p4;
  await focus("soundbox");
  await say("04s-received", "Soundbox: “₹826 received on AITM. Bill paid.”", 500);

  // the proof on the merchant's phone
  await focus("merchant");
  await merchant.getByText("पेमेंट", { exact: true }).last().click().catch(() => {});
  const p4b = say("04b-proof", "Bill and payment are joined the instant the money arrives. Append-only: never edited, never added later.");
  await sleep(dur["04b-proof"] * 600);
  await merchant.getByText("सबूत", { exact: true }).last().click().catch(() => {});
  await p4b;

  // 5 · a direct payment on the shop QR, tagged by voice on the Soundbox
  await focus("customer", "soundbox");
  const p5 = say("05-direct", "No bill? The Soundbox asks what was sold. One tap on the mic, say it, done.");
  await guard("direct pay", async () => {
await customer.getByRole("button", { name: /New payment|Done|Back to home|Pay again/ }).first().click().catch(() => {});
  await sleep(600);
  await customer.getByRole("button", { name: /Scan & Pay/ }).click();
  await sleep(900);
  await customer.getByText("Can't scan? Pick the shop").click();
  await customer.getByLabel("Amount").fill("");
  await customer.getByLabel("Amount").pressSequentially("640", { delay: 120 });
  await sleep(500);
  await customer.getByRole("button", { name: /^Pay ₹/ }).click();
  for (const d of ["4", "3", "2", "1"]) {
    await sleep(300);
    await customer.getByRole("button", { name: d, exact: true }).click();
  }
  await customer.getByRole("button", { name: "Submit PIN" }).click();
  await soundbox.getByText("640", { exact: false }).first().waitFor();
}, async () => { await api({ action: "pay", role: "customer", amountInr: 640, payerVpa: "b3@okdemo" }); });
  await sleep(4500); // the Soundbox announces and asks
  await soundbox.getByRole("button", { name: "Speak" }).click().catch(() => {});
  // wait for the tag; fall back to the API with the same words if the fake mic misfires
  let tagged = false;
  for (let i = 0; i < 24 && !tagged; i++) {
    await sleep(500);
    const st = await api({ action: "state", role: "merchant" });
    tagged = st.state.transactions.some((t) => t.amountInr === 640 && t.tag);
  }
  if (!tagged) {
    console.warn("voice tag did not bind; tagging with the same words via the API");
    await api({ action: "tag-auto", role: "soundbox", transcript: "एक तेल, दो साबुन" });
  }
  await p5;

  // 6 · bank receives the report; merchant and Soundbox see nothing
  await focus("bank");
  const p6 = say("06-report", "Days later, the ₹826 is reported as stolen money. The merchant is not warned before a hold exists.");
  await sleep(2500);
  await guard("report", async () => {
await bank.locator("li", { hasText: "826" }).getByRole("button", { name: "Report" }).click();
}, async () => { const st = (await api({ action: "state", role: "bank" })).state; const t = st.transactions.find((x) => x.amountInr === 826 && x.billId); await api({ action: "report", role: "bank", txnId: (t ?? st.transactions[0]).id }); });
  await sleep(2500);
  await focus("bank", "merchant", "soundbox");
  await p6;

  // 7 · lien on that one payment; merchant screen turns red and explains
  await focus("bank");
  const p7 = say("07-hold", "The bank puts a lien on that one payment. The merchant's app explains, in Hindi: only ₹826 is held.");
  await sleep(2200);
  await guard("hold", async () => {
await bank.getByRole("button", { name: "Apply restriction" }).click();
}, async () => { const st = (await api({ action: "state", role: "bank" })).state; await api({ action: "hold", role: "bank", txnId: st.reports[0].txnId }); });
  await sleep(1800);
  await focus("merchant");
  await p7;

  // 8 · two screening questions
  const p8 = say("08-screen", "Two questions first. Anyone who lent their account is sent to legal aid, not given an innocence letter.");
  await guard("questions", async () => {
await merchant.getByRole("button", { name: "नहीं", exact: true }).first().scrollIntoViewIfNeeded();
  await sleep(dur["08-screen"] * 500);
  await merchant.getByRole("button", { name: "नहीं", exact: true }).nth(0).click();
  await sleep(1200);
  await merchant.getByRole("button", { name: "नहीं", exact: true }).nth(1).click();
}, async () => {  });
  await p8;

  // 9 · certificate and grievance draft
  await guard("packet button", async () => {
await merchant.getByRole("button", { name: "मेरे काग़ज़ तैयार कीजिए" }).click();
}, async () => {  });
  const p9 = say("09-packet", "A sale certificate from the payment records, and a grievance draft where every rule shows its source and check date.");
  await guard("packet scroll", async () => {
await merchant.getByText("मैंने इसे अपने बैंक में जमा कर दिया है").waitFor({ timeout: 90_000 });
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    await sleep((dur["09-packet"] * 1000) / (steps + 2));
    await scroll(merchant, 420);
  }
}, async () => {  });
  await p9;
  const p9b = say("09b-human", "Draft, not legal advice, no guaranteed release. The shopkeeper files it through their own bank.");
  await guard("filed", async () => {
await merchant.getByText("मैंने इसे अपने बैंक में जमा कर दिया है").scrollIntoViewIfNeeded();
  await sleep(dur["09b-human"] * 650);
  await merchant.getByText("मैंने इसे अपने बैंक में जमा कर दिया है").click();
}, async () => {  });
  await p9b;

  // 10 · day 22, escalation
  await focus("bank", "merchant");
  const p10 = say("10-day22", "Bank: 7 days. Police officer: 15 more. On day 22 the escalation draft is ready.");
  await sleep(1800);
  await guard("day 22", async () => {
await bank.getByRole("button", { name: /Simulate day/ }).click();
}, async () => { await api({ action: "advance", role: "bank", days: 22 }); });
  await sleep(4000);
  await scroll(merchant, 900);
  await p10;

  // 11 · close
  await focus();
  await page.evaluate(() => window.cap(""));
  await page.evaluate(() => window.card(true, "Proof at the moment of sale · verified against payment records · in the shopkeeper's own language"));
  await say("11-close", undefined, 1800);
} catch (e) {
  console.error("recording failed:", e);
  await page.screenshot({ path: join(work, "failure.png") });
  console.error("screenshot:", join(work, "failure.png"));
  await context.close();
  await browser.close();
  stopServer();
  process.exit(1);
}

const endT = (Date.now() - t0) / 1000;
const video = page.video();
await context.close();
await browser.close();
stopServer();
const webm = await video.path();
writeFileSync(join(here, "cues.json"), JSON.stringify({ cues, endT }, null, 2));

// ── mix ─────────────────────────────────────────────────────────────────────
const out = join(here, "kavach-demo.mp4");
const inputs = ["-i", webm];
const filters = [];
cues.forEach((c, i) => {
  inputs.push("-i", join(audioDir, `${c.id}.mp3`));
  const ms = Math.round(c.t * 1000);
  filters.push(`[${i + 1}:a]adelay=${ms}|${ms},volume=1.0[a${i}]`);
});
filters.push(`${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0:dropout_transition=0[aout]`);
const start = Math.max(0, cues[0].t - 1.2).toFixed(2);
execFileSync(
  ffmpeg,
  [
    "-y", ...inputs,
    "-filter_complex", filters.join(";"),
    "-map", "0:v", "-map", "[aout]",
    "-ss", start, "-t", (endT - Number(start)).toFixed(2),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    out,
  ],
  { stdio: "inherit" },
);
console.log(`\nwrote ${out}`);
process.exit(0);
