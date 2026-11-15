/**
 * Smoke test of a running Kavach deploy: pages, Sarvam voice, and the whole
 * ₹826 story on the four screens in a real browser (bill → buyer approves →
 * Soundbox → report → hold → documents → day 22), plus the guardrails that
 * can be seen from outside (no tipping off, hold limited to the amount, mule
 * screen, answers fixed once given).
 *
 *   npm run smoke:live                      # https://kavach-demo.onrender.com
 *   KAVACH_URL=http://localhost:3000 npm run smoke:live
 *
 * It RESETS the demo it runs against, twice. Don't run it during a live demo.
 * Screenshots and results.json go to SMOKE_OUT (default smoke-out/).
 * Exits 1 if any check fails. Calls Sarvam a few times (TTS, STT, drafts).
 */
import { chromium } from "playwright-core";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";

const U = (process.env.KAVACH_URL ?? "https://kavach-demo.onrender.com").replace(/\/$/, "");
const OUT = process.env.SMOKE_OUT ?? "smoke-out";
fs.mkdirSync(OUT, { recursive: true });
// A locally installed Playwright Chromium on Windows, if present; otherwise playwright-core's own download.
const winExe = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1254", "chrome-win64", "chrome.exe")
  : null;
const exe = winExe && fs.existsSync(winExe) ? winExe : undefined;
console.log(`Smoke test against ${U}`);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
/** fetch that retries a dropped connection or a 502/503 from the host (free plans drop some). */
const fetchRetry = async (url, init, tries = 4) => {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, init);
      if ((r.status === 502 || r.status === 503) && i < tries && !url.includes("/api/voice")) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (i >= tries) throw e;
      console.log(`  retry ${i} ${url.replace(U, "")}: ${e.cause?.code ?? e.message}`);
      await new Promise((ok) => setTimeout(ok, 2000 * i));
    }
  }
};
const api = async (body) => {
  const r = await fetchRetry(`${U}/api/kavach`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${body.action}: ${j.error}`);
  return j;
};
const timed = async (fn) => { const t = Date.now(); const v = await fn(); return [v, Date.now() - t]; };

let browser;
try {
  // 1. pages and APIs
  for (const p of ["/", "/customer", "/soundbox", "/merchant", "/bank", "/qr"]) {
    const [r, ms] = await timed(() => fetchRetry(U + p));
    check(`GET ${p}`, r.status === 200, `${r.status}, ${ms} ms`);
  }
  await api({ action: "reset" });
  const [tts, ttsMs] = await timed(() => fetchRetry(`${U}/api/voice/tts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "आठ सौ छब्बीस रुपये मिले", language: "hi-IN" }) }));
  const audio = Buffer.from(await tts.arrayBuffer());
  check("Sarvam TTS (Hindi)", tts.status === 200 && audio.length > 1000, `${tts.status}, ${audio.length} bytes, ${ttsMs} ms`);
  fs.writeFileSync(path.join(OUT, "tts.mp3"), audio);
  const form = new FormData();
  form.append("audio", new Blob([audio], { type: "audio/mpeg" }), "clip.mp3");
  form.append("language", "hi-IN");
  const [stt, sttMs] = await timed(() => fetchRetry(`${U}/api/voice/stt`, { method: "POST", body: form }));
  const sttBody = await stt.json().catch(() => ({}));
  check("Sarvam STT (round trip of the TTS clip)", stt.status === 200 && JSON.stringify(sttBody).length > 10, `${stt.status}, ${sttMs} ms, ${JSON.stringify(sttBody).slice(0, 90)}`);
  const purposes = (await api({ action: "data-purposes", role: "customer" })).result;
  check("data-purposes readable", purposes.length === 4);

  // 2. four screens in a browser
  browser = await chromium.launch({ executablePath: exe });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const laptop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const open = async (ctx, p) => {
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${p}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${p}: ${m.text().slice(0, 160)}`));
    await page.goto(U + p, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    return page;
  };
  const customer = await open(phone, "/customer");
  const soundbox = await open(phone, "/soundbox");
  const merchant = await open(phone, "/merchant");
  const bank = await open(laptop, "/bank");
  await soundbox.getByText("Tap to switch on").click().catch((e) => errors.push("power on: " + e.message));

  // bill made by the merchant, paid by the buyer through the real UI (QR upload)
  const st = await api({ action: "state" });
  const bill = (await api({ action: "bill-create", amountInr: 826, text: "दो किलो चीनी, एक तेल" })).result;
  const uri = `upi://pay?pa=${encodeURIComponent(st.state.merchant.vpa)}&pn=${encodeURIComponent(st.state.merchant.shopName)}&am=826.00&cu=INR&tr=${bill.id}&tn=${encodeURIComponent(bill.id + " · " + bill.text)}`;
  const qrPng = path.join(OUT, "bill-qr.png");
  await QRCode.toFile(qrPng, uri, { width: 600 });
  await customer.getByText("Scan", { exact: false }).first().click();
  await customer.waitForTimeout(800);
  await customer.locator('input[type="file"]').setInputFiles(qrPng);
  const shown = await customer.getByText("दो किलो चीनी, एक तेल").first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  check("customer sees the bill items before paying", shown);
  await customer.screenshot({ path: path.join(OUT, "1-customer-bill.png") });
  await customer.getByRole("button", { name: /Pay/ }).last().click();
  for (const k of ["1", "2", "3", "4"]) await customer.getByRole("button", { name: k, exact: true }).click();
  await customer.getByRole("button", { name: "Submit PIN" }).click();
  const paidOk = await customer.getByText("Paid Successfully").waitFor({ timeout: 15000 }).then(() => true, () => false);
  check("customer payment succeeds", paidOk);
  await customer.screenshot({ path: path.join(OUT, "2-customer-paid.png") });

  await soundbox.waitForTimeout(4000);
  const sbText = await soundbox.innerText("body");
  check("Soundbox shows the ₹826 bill payment", /826/.test(sbText) && sbText.includes(bill.id), "");
  await soundbox.screenshot({ path: path.join(OUT, "3-soundbox.png") });

  // a plain payment tagged by voice-equivalent (server path) inside the window
  const plain = (await api({ action: "pay", amountInr: 650, payerVpa: "asha@okdemo", role: "customer" })).result.txn;
  const tagged = (await api({ action: "tag-auto", transcript: "छह सौ पचास, एक घी", role: "soundbox" })).result;
  check("tag-auto binds the open ₹650 payment", tagged.outcome === "bound" && tagged.txnId === plain.id, JSON.stringify(tagged));

  let m = (await api({ action: "state" })).state;
  const t826 = m.transactions.find((t) => t.billId === bill.id);
  check("₹826 is strong proof, buyer approved", t826?.strength.level === "strong" && t826?.tag?.buyerApproved === true);
  check("merchant sees no report before the hold", !JSON.stringify(m).match(/ackNo|NCRP/));

  // bank reports and holds; merchant hold flow
  await api({ action: "report", txnId: t826.id, role: "bank" });
  m = (await api({ action: "state" })).state;
  check("no tipping off after report (merchant snapshot clean)", !m.hold && !JSON.stringify(m).match(/ackNo|NCRP/));
  // Look for report/hold *fields and values*, not substrings ("thresholdInr" contains "hold").
  const leaks = (obj) => {
    const found = [];
    const walk = (v, at) => {
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`));
      if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          if (/^(hold|holds|held|heldAmountInr|report|reports|reported|ackNo|grievance|tracker)$/i.test(k)) found.push(`${at}.${k}`);
          walk(x, `${at}.${k}`);
        }
      } else if (typeof v === "string" && /NCRP|रोक/.test(v)) found.push(`${at}="${v.slice(0, 40)}"`);
    };
    walk(obj, "state");
    return found;
  };
  const sbs = (await api({ action: "state", role: "soundbox" })).state;
  const sbLeaks = leaks(sbs);
  check("Soundbox snapshot has no report or hold", sbLeaks.length === 0, sbLeaks.join(", "));
  const hold = (await api({ action: "hold", txnId: t826.id, role: "bank" })).result;
  check("hold limited to ₹826", hold.heldAmountInr === 826, JSON.stringify({ scope: hold.scope, amount: hold.heldAmountInr }));
  await merchant.waitForTimeout(5000);
  const mText = await merchant.innerText("body");
  check("merchant screen shows the hold", mText.includes("₹826 पर रोक"));
  check("merchant hold screen shows the disclaimer", /legal advice|कानूनी सलाह/.test(mText));
  await merchant.screenshot({ path: path.join(OUT, "4-merchant-hold.png") });
  await bank.waitForTimeout(2000);
  await bank.screenshot({ path: path.join(OUT, "5-bank.png") });
  const cText = await customer.innerText("body");
  check("customer screen shows nothing about the hold", !/रोक|hold|lien/i.test(cText));

  // documents: explanation (Sarvam), packet, filed, day 22, escalation
  const [exp, expMs] = await timed(() => api({ action: "explain", holdId: hold.id }));
  check("Hindi explanation drafted", (exp.result.text ?? JSON.stringify(exp.result)).length > 50, `${expMs} ms, model: ${exp.result.byModel ?? exp.result.source ?? "?"}`);
  const [pk, pkMs] = await timed(() => api({ action: "packet", holdId: hold.id, answers: { lentAccount: false, receivedForCommission: false } }));
  const packet = pk.result;
  const cert = packet.certificate;
  check("packet: certificate + grievance", !!cert && !!packet.grievance, `${pkMs} ms`);
  check("certificate carries buyer approval and disclaimer", cert?.saleTag?.buyerApproved === true && !!cert?.disclaimer);
  // The screening answers are fixed once given, so test the mule path on its own fresh hold.
  const again = (await api({ action: "packet", holdId: hold.id, answers: { lentAccount: true, receivedForCommission: false } })).result;
  check("screening answers cannot be changed after the fact", !!again.certificate && again.eligibility?.outcome === "eligible");
  await api({ action: "filed", holdId: hold.id });
  await api({ action: "advance", days: 22, role: "bank" });
  const [esc, escMs] = await timed(() => api({ action: "escalation", holdId: hold.id }));
  check("day-22 escalation draft", JSON.stringify(esc.result).length > 200, `${escMs} ms`);

  // Mule screen on a fresh hold: "someone else used my account" → legal aid, never a certificate.
  await api({ action: "reset" });
  const mp = (await api({ action: "pay", amountInr: 900, payerVpa: "ravi@okdemo", role: "customer" })).result.txn;
  await api({ action: "report", txnId: mp.id, role: "bank" });
  const mh = (await api({ action: "hold", txnId: mp.id, role: "bank" })).result;
  const mule = (await api({ action: "packet", holdId: mh.id, answers: { lentAccount: true, receivedForCommission: false } })).result;
  check("lent account → legal aid, no certificate", !mule.certificate && mule.eligibility?.outcome === "legal_aid");

  await api({ action: "reset" });
  const after = (await api({ action: "state" })).state;
  check("reset returns to the seed", after.transactions.length === 3 && !after.hold);
  check("no page errors on the four screens", errors.length === 0, errors.slice(0, 5).join(" | "));
} catch (e) {
  // A crash midway (a refused action, a dropped connection after retries) is a failed run, not a lost one.
  check("run finished without crashing", false, e.stack?.split("\n").slice(0, 3).join(" | ") ?? String(e));
} finally {
  await browser?.close().catch(() => {});
}
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
if (failed) process.exitCode = 1;
