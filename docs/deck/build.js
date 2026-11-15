// Builds docs/deck/kavach-pitch.pptx.
//
//   NODE_PATH=<folder holding pptxgenjs, react, react-dom, react-icons, sharp> node build.js
//
// Needs: pptxgenjs, react, react-dom, react-icons, sharp (npm). Optional: the pptx skill's
// apply_theme.js (set APPLY_THEME to its path) to write the palette into the theme part.
// Screenshots come from assets/ (made by prep_images.py from the app's review captures).
//
// Every figure and legal point on these slides comes from docs/pitch.md, docs/judge-qa.md,
// docs/legal-landscape.md, docs/competitors.md and rules/rules.json (checked 2026-11-15).
// Do not add a number here without a source in those files.

const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Lu = require("react-icons/lu");

const HERE = __dirname;
const OUT = path.join(HERE, "kavach-pitch.pptx");
const A = (f) => path.join(HERE, "assets", f);

// ---------- theme ----------
const HEX = {
  ink: "0F172A", navy: "0B1437", white: "FFFFFF", tint: "EEF1FA",
  indigo: "3446B5", saffron: "F5A524", green: "12A150", red: "D92D20",
  muted: "5B6478", ice: "C7D2FE",
};
const THEME = {
  name: "Kavach",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: HEX.ink, lt1: HEX.white, dk2: HEX.navy, lt2: HEX.tint,
    accent1: HEX.indigo, accent2: HEX.saffron, accent3: HEX.green, accent4: HEX.red,
    accent5: HEX.muted, accent6: HEX.ice, hlink: HEX.indigo, folHlink: HEX.muted,
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.title = "Kavach: proof of sale before the freeze";
pres.author = "Kavach team";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const K = {
  ink: C.text1, navy: C.text2, white: C.background1, tint: C.background2,
  indigo: C.accent1, saffron: C.accent2, green: C.accent3, red: C.accent4,
  muted: C.accent5, ice: C.accent6,
};

const W = 10, H = 5.625, M = 0.5;
const DISCLAIMER = "Kavach produces drafts, not legal advice. It cannot guarantee that held money will be released.";

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "Kavach Dark Title",
  background: { color: K.navy },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 1.5, w: 6.3, h: 2.5, fontSize: 28, bold: true, color: K.white, align: "left", valign: "top", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.45, w: 6.3, h: 0.4, fontSize: 14, color: K.ice, align: "left", valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "Kavach Content",
  background: { color: K.white },
  margin: [0.4, M, 0.45, M],
  objects: [
    { text: { text: DISCLAIMER, options: { x: M, y: 5.25, w: 8.2, h: 0.25, fontSize: 10, color: K.muted, margin: 0, valign: "middle" } } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.3, w: 9, h: 0.75, fontSize: 30, bold: true, color: K.navy, align: "left", valign: "middle", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 9.1, y: 5.25, w: 0.4, h: 0.25, fontSize: 10, color: K.muted, align: "right" },
});
pres.defineSlideMaster({
  title: "Kavach Dark Content",
  background: { color: K.navy },
  objects: [
    { text: { text: DISCLAIMER, options: { x: M, y: 5.25, w: 8.2, h: 0.25, fontSize: 10, color: K.ice, margin: 0, valign: "middle" } } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.3, w: 9, h: 0.75, fontSize: 30, bold: true, color: K.white, align: "left", valign: "middle", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 9.1, y: 5.25, w: 0.4, h: 0.25, fontSize: 10, color: K.ice, align: "right" },
});

// ---------- helpers ----------
const iconCache = {};
async function icon(name, hex, size = 256) {
  const key = name + hex;
  if (iconCache[key]) return iconCache[key];
  const Comp = Lu[name];
  if (!Comp) throw new Error("no icon " + name);
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + hex, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  return (iconCache[key] = "image/png;base64," + buf.toString("base64"));
}

// Icon in a filled circle: the deck's motif.
async function badge(slide, name, x, y, d, fillK, iconHex, objName) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fillK }, line: { type: "none" }, objectName: objName + " circle" });
  const p = d * 0.24;
  slide.addImage({ data: await icon(name, iconHex), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, objectName: objName + " icon", altText: name.replace(/^Lu/, "") + " icon" });
}

const shadow = () => ({ type: "outer", color: "0B1437", opacity: 0.14, blur: 8, offset: 2, angle: 90 });

function card(slide, x, y, w, h, fillK, objName, withShadow = true) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.12, fill: { color: fillK }, line: { type: "none" },
    shadow: withShadow ? shadow() : undefined, objectName: objName,
  });
}

function txt(slide, text, opts) {
  slide.addText(text, { isTextBox: true, margin: 0, valign: "top", color: K.ink, fontSize: 14, ...opts });
}

function pill(slide, text, x, y, w, fillK, colorK, objName) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.26, rectRadius: 0.13, fill: { color: fillK }, line: { type: "none" }, objectName: objName + " pill" });
  txt(slide, text, { x, y, w, h: 0.26, fontSize: 10, bold: true, color: colorK, align: "center", valign: "middle", objectName: objName + " label" });
}

// A screenshot in a rounded device frame. Image keeps its aspect ratio; returns its box.
function phone(slide, file, pxW, pxH, x, y, h, objName, cropTopPx = 0, cropH = null) {
  const visH = cropH || pxH - cropTopPx;
  const w = h * (pxW / visH);
  const b = 0.07;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - b, y: y - b, w: w + 2 * b, h: h + 2 * b, rectRadius: 0.16, fill: { color: K.navy }, line: { type: "none" }, shadow: shadow(), objectName: objName + " frame" });
  const opts = { path: A(file), x, y, w, h, objectName: objName, altText: objName };
  if (cropTopPx || cropH) {
    // pptxgenjs crops via sizing:{type:'crop'} in inches of the full-size image
    const scale = h / visH;
    opts.sizing = { type: "crop", x: 0, y: cropTopPx * scale, w, h };
    opts.w = w; opts.h = pxH * scale;
  }
  slide.addImage(opts);
  return { x, y, w, h };
}

const S = (master, section) => pres.addSlide({ masterName: master, sectionTitle: section });

// ---------- slides ----------
async function build() {
  // 1. Title ---------------------------------------------------------------
  pres.addSection({ title: "Opening" });
  let s = S("Kavach Dark Title", "Opening");
  txt(s, [
    { text: "KAVACH", options: { bold: true, color: K.saffron, charSpacing: 6 } },
    { text: "  ·  कवच  ·  proof of sale before the freeze", options: { color: K.ice } },
  ], { x: M, y: 0.9, w: 6.5, h: 0.35, fontSize: 14 });
  s.addText([
    { text: "Other tools help a merchant write a letter after the account is frozen.", options: { color: K.ice, fontSize: 20, bold: false, breakLine: true } },
    { text: "Kavach makes sure the proof already exists before the freeze happens.", options: { color: K.white, fontSize: 28, bold: true } },
  ], { placeholder: "title", paraSpaceAfter: 10 });
  s.addText("A Paytm hackathon prototype", { placeholder: "body" });
  await badge(s, "LuShieldCheck", 7.15, 1.45, 2.3, K.saffron, HEX.navy, "Shield");
  s.addNotes(
    "Open with the line, slowly.\n\n" +
    "Kavach records what was sold at the moment of payment, so an honest merchant already has the evidence if a fraud report later puts that payment on hold.\n\n" +
    "Kavach means armour. It is a prototype we built for Paytm; on screen you'll see a made-up brand, AITM, because we don't use Paytm's logo."
  );

  // 2. Problem -------------------------------------------------------------
  pres.addSection({ title: "Problem" });
  s = S("Kavach Content", "Problem");
  s.addText("An honest sale can freeze a shop", { placeholder: "title" });
  const stats = [
    { big: "36,000+", label: "accounts frozen across India after one ₹4.43 crore fraud case in Faridabad", src: "the420.in, trade press", flag: "NOT AN OFFICIAL FIGURE" },
    { big: "₹8,26,633", label: "frozen over a single ₹1,000 UPI payment; the Andhra Pradesh High Court called it illegal", src: "Sri Sai Wines v. Union of India, 22 Jun 2026, via SCC Online", flag: "JUDGMENT NOT OPENED" },
    { big: "Indore", label: "garment traders told shops to stop accepting UPI over account freezes", src: "Devdiscourse, 27 Dec 2024", flag: null },
  ];
  const cw = 2.8, gap = 0.3, cy = 1.35, ch = 3.55;
  for (let i = 0; i < 3; i++) {
    const x = M + i * (cw + gap), st = stats[i];
    card(s, x, cy, cw, ch, K.tint, "Stat card " + (i + 1), false);
    txt(s, st.big, { x: x + 0.25, y: cy + 0.3, w: cw - 0.5, h: 0.75, fontSize: 36, bold: true, fontFace: "Arial", color: i === 1 ? K.red : K.navy, fit: "none" });
    txt(s, st.label, { x: x + 0.25, y: cy + 1.15, w: cw - 0.5, h: 1.25, fontSize: 14 });
    if (st.flag) pill(s, st.flag, x + 0.25, cy + 2.5, 2.0, K.saffron, K.navy, "Flag " + (i + 1));
    txt(s, st.src + ". Checked 15 Nov 2026", { x: x + 0.25, y: cy + 2.85, w: cw - 0.5, h: 0.6, fontSize: 10, color: K.muted, italic: true });
  }
  s.addNotes(
    "Shopkeepers take a payment, the payer's money turns out to be stolen, and the shopkeeper's money is held. To get it released, they have to show the sale was real, weeks after it happened.\n\n" +
    "Faridabad: one ₹4.43 crore fraud case led to over 36,000 accounts frozen across India. That number is from trade press (the420.in), not an official release; say so.\n\n" +
    "Sri Sai Wines: a ₹1,000 UPI payment to a liquor shop froze ₹8,26,633 (about ₹8.27 lakh, not '₹8.26 lakh'). The AP High Court, 22 June 2026, called it 'unsustainable, contrary to law and illegal' and directed SBI to unfreeze. We read it through SCC Online's report; the judgment itself was not opened.\n\n" +
    "Indore: garment traders told shops to stop taking UPI over freezes. That was December 2024, not 2026."
  );

  // 3. Why now ---------------------------------------------------------------
  s = S("Kavach Content", "Problem");
  s.addText("2026 gave freezes a fixed route", { placeholder: "title" });
  const events = [
    { date: "2 Jan 2026", who: "Home Ministry procedure", status: "ADMINISTRATIVE", body: "Hold only the reported amount. Bank files a grievance in 7 days; police decide in 15." },
    { date: "4 Aug 2026", who: "Supreme Court", status: "BINDING DIRECTION", body: "All states and police must run the grievance and money-restoration modules." },
    { date: "11 Sep 2026", who: "RBI draft", status: "DRAFT · NOT IN FORCE", body: "Banks could hold flagged ₹1,000+ payments themselves; lifted on day 31, 60-day ceiling." },
  ];
  const lineY = 1.62;
  s.addShape(pres.shapes.LINE, { x: M + 0.2, y: lineY, w: 8.6, h: 0, line: { color: K.ice, width: 2 }, objectName: "Timeline line" });
  for (let i = 0; i < 3; i++) {
    const x = M + i * 3.1, ev = events[i];
    s.addShape(pres.shapes.OVAL, { x: x + 0.05, y: lineY - 0.13, w: 0.26, h: 0.26, fill: { color: K.saffron }, line: { color: K.white, width: 2 }, objectName: "Timeline dot " + (i + 1) });
    txt(s, ev.date, { x, y: lineY + 0.25, w: 2.8, h: 0.4, fontSize: 20, bold: true, fontFace: "Arial", color: K.navy });
    txt(s, ev.who, { x, y: lineY + 0.68, w: 2.8, h: 0.3, fontSize: 14, bold: true, color: K.indigo });
    pill(s, ev.status, x, lineY + 1.05, i === 2 ? 1.75 : 1.55, i === 2 ? K.saffron : K.tint, K.navy, "Status " + (i + 1));
    txt(s, ev.body, { x, y: lineY + 1.45, w: 2.8, h: 0.85, fontSize: 14 });
  }
  card(s, M, 4.15, 9, 0.85, K.navy, "Quote card", false);
  txt(s, [
    { text: "The bank files only “if convinced about the bonafides of the transaction.”", options: { bold: true, color: K.white, breakLine: true } },
    { text: "MHA procedure s.10.1(a). It lists no fixed set of documents.", options: { color: K.ice, fontSize: 12 } },
  ], { x: M + 0.3, y: 4.15, w: 8.4, h: 0.85, fontSize: 16, valign: "middle" });
  s.addNotes(
    "For the first time there is a fixed route with deadlines, and it runs on the merchant's explanation.\n\n" +
    "2 Jan 2026: Home Ministry procedure (administrative, read via a Meghalaya High Court annex). Hold only the reported amount; bank files within 7 days, police decide within 15, then the District Grievance Officer within 15.\n" +
    "4 Aug 2026: Supreme Court binding direction: states and police must run the grievance and money-restoration modules. Do NOT say the court ordered quick disposal of freeze cases; it did not.\n" +
    "11 Sep 2026: RBI draft, NOT in force, proposed start 1 April 2027. Banks could hold a flagged transaction of ₹1,000 or more; lifts on day 31 unless police instruct otherwise; 60-day ceiling.\n\n" +
    "The procedure lists no fixed documents. The bank files only if convinced about the bonafides. A merchant with clear proof of sale is better placed.\n\nAll sources checked 2026-11-15."
  );

  // 4. Letter tools fail ----------------------------------------------------
  pres.addSection({ title: "Solution" });
  s = S("Kavach Content", "Solution");
  s.addText("Letter tools start after the freeze", { placeholder: "title" });
  const rows = [
    ["When the proof is made", "After the freeze, from memory", "At the sale, within 120 seconds"],
    ["Whose data", "What the merchant types", "Paytm's transaction and settlement records"],
    ["Can it be back-dated", "Yes", "No. Append-only, window only"],
    ["How the merchant uses it", "Type a form", "Speak, in their own language"],
  ];
  const tx = M, ty = 1.3, labW = 2.4, colW = 3.15, rh = 0.58;
  card(s, tx + labW + 0.1, ty, colW, 0.5 + rows.length * rh + 0.1, K.tint, "Letter tools column", false);
  card(s, tx + labW + colW + 0.25, ty, colW, 0.5 + rows.length * rh + 0.1, K.navy, "Kavach column");
  txt(s, "Letter tools", { x: tx + labW + 0.3, y: ty + 0.12, w: colW - 0.4, h: 0.35, fontSize: 16, bold: true, color: K.muted });
  txt(s, "Kavach", { x: tx + labW + colW + 0.45, y: ty + 0.12, w: colW - 0.4, h: 0.35, fontSize: 16, bold: true, color: K.saffron });
  rows.forEach((r, i) => {
    const y = ty + 0.55 + i * rh;
    txt(s, r[0], { x: tx, y, w: labW, h: rh, fontSize: 14, bold: true, color: K.navy, valign: "middle" });
    txt(s, r[1], { x: tx + labW + 0.3, y, w: colW - 0.4, h: rh, fontSize: 14, color: K.ink, valign: "middle" });
    txt(s, r[2], { x: tx + labW + colW + 0.45, y, w: colW - 0.4, h: rh, fontSize: 14, color: K.white, valign: "middle" });
  });
  txt(s, "Letter generators exist: a student prototype (Wapas) and lawyer and finance sites (unverified, from Nov 2026 research notes). We don't compete on the letter.", {
    x: M, y: 4.45, w: 9, h: 0.55, fontSize: 12, italic: true, color: K.muted,
  });
  s.addNotes(
    "Letter generators already exist; we are not pitching one. A letter tool sees only what the merchant types after the freeze, from memory. Paytm sees the payment as it happens.\n\n" +
    "Be honest: Wapas and the lawyer/finance letter sites are from our research notes and unverified; a web search on 2026-11-15 found no trace of Wapas. The point stands either way: the letter is the last, least novel step.\n\n" +
    "Who files: always the merchant, through their own bank."
  );

  // 5. Three novelties ------------------------------------------------------
  s = S("Kavach Content", "Solution");
  s.addText("Three things only Paytm can do", { placeholder: "title" });
  const nov = [
    { ic: "LuMic", h: "Proof at the moment of sale", b: "The Soundbox announces the payment; the merchant says what was sold. Accepted only within 120 seconds, append-only." },
    { ic: "LuBadgeCheck", h: "Verified against payment data", b: "The certificate is built from Paytm's own transaction and settlement records, kept apart from the merchant's words." },
    { ic: "LuLanguages", h: "Voice, in their language", b: "Inside the app and Soundbox merchants already use. No typing; Indian languages." },
  ];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 3.1, n = nov[i];
    card(s, x, 1.35, 2.8, 3.55, K.white, "Novelty card " + (i + 1));
    await badge(s, n.ic, x + 0.3, 1.65, 0.85, K.saffron, HEX.navy, "Novelty " + (i + 1));
    txt(s, String(i + 1), { x: x + 2.1, y: 1.65, w: 0.45, h: 0.6, fontSize: 32, bold: true, fontFace: "Arial", color: K.ice, align: "right" });
    txt(s, n.h, { x: x + 0.3, y: 2.7, w: 2.25, h: 0.7, fontSize: 18, bold: true, fontFace: "Arial", color: K.navy });
    txt(s, n.b, { x: x + 0.3, y: 3.45, w: 2.25, h: 1.35, fontSize: 14 });
  }
  s.addNotes(
    "This is the novelty. Not the letter.\n\n" +
    "1. Proof at the moment of sale: the Soundbox announces the payment and asks what was sold. The answer is accepted only within 120 seconds and can never be edited or added later.\n" +
    "2. Verified proof: the sale certificate comes from Paytm's own transaction and settlement records, and keeps them visibly separate from what the merchant said.\n" +
    "3. Reach and language: it lives in the app and Soundbox merchants already use. Voice, no typing, Indian languages.\n\n" +
    "The Home Ministry procedure already expects payment aggregators to upload settlement and order details for a held payment (s.9.5)."
  );

  // 6. Four screens ---------------------------------------------------------
  pres.addSection({ title: "How it works" });
  s = S("Kavach Content", "How it works");
  s.addText("Four screens, one ₹826 sale", { placeholder: "title" });
  const scr = [
    { n: "1", who: "Customer", what: "pays ₹826 to the shop", file: "customer.png", pw: 780, ph: 1668 },
    { n: "2", who: "Soundbox", what: "₹826 on BILL-0001, items already tagged", file: "soundbox.png", pw: 780, ph: 1133 },
    { n: "3", who: "Bank", what: "gets the report, holds only ₹826", file: "bank.png", pw: 2240, ph: 1300 },
    { n: "4", who: "Merchant", what: "“₹826 पर रोक”, with proof ready", file: "merchant-hold.png", pw: 780, ph: 1560 },
  ];
  const colW4 = 2.1, gap4 = 0.2, imgTop = 1.3, imgH = 2.55;
  for (let i = 0; i < 4; i++) {
    const x = M + i * (colW4 + gap4), c = scr[i];
    let ih = imgH, iw = ih * c.pw / c.ph;
    if (iw > colW4 - 0.2) { iw = colW4 - 0.2; ih = iw * c.ph / c.pw; }
    phone(s, c.file, c.pw, c.ph, x + (colW4 - iw) / 2, imgTop + (imgH - ih) / 2, ih, c.who + " screen");
    s.addShape(pres.shapes.OVAL, { x, y: 4.1, w: 0.4, h: 0.4, fill: { color: K.saffron }, line: { type: "none" }, objectName: "Step " + c.n });
    txt(s, c.n, { x, y: 4.1, w: 0.4, h: 0.4, fontSize: 16, bold: true, color: K.navy, align: "center", valign: "middle" });
    txt(s, c.who, { x: x + 0.5, y: 4.1, w: colW4 - 0.5, h: 0.4, fontSize: 16, bold: true, color: K.navy, valign: "middle" });
    txt(s, c.what, { x, y: 4.55, w: colW4, h: 0.55, fontSize: 12, color: K.muted });
  }
  s.addNotes(
    "The live demo runs on four screens, on real devices, all reading the same server state.\n\n" +
    "1. Customer: a buyer, secretly paying with stolen money, pays ₹826 to Sharma Kirana Store.\n" +
    "2. Soundbox: the shopkeeper has spoken the bill first, amount and items ('दो किलो चीनी, एक तेल'); the box shows that bill's QR, and the ₹826 arrives on BILL-0001, already tagged. The screenshot shows exactly that, with 'Good proof' in the recent list. A payment without a bill gets the 'क्या बेचा?' prompt and a 120-second window instead.\n" +
    "3. Bank: the victim reports the payment; the bank holds only ₹826.\n" +
    "4. Merchant: the red banner reads '₹826 पर रोक · सिर्फ़ एक पेमेंट', a hold on one payment only, and the proof was already there.\n\n" +
    "The point to land: the proof was recorded three steps before anyone froze anything. The screens use a made-up brand, AITM, on purpose.\n\n" +
    "Why ₹826: the420.in's report on the Faridabad freezes quotes a Mumbai shopkeeper whose ₹826 UPI payment was caught up in it."
  );

  // 7. Soundbox ---------------------------------------------------------------
  s = S("Kavach Content", "How it works");
  s.addText("The proof is made at the counter", { placeholder: "title" });
  phone(s, "soundbox.png", 780, 1133, M + 0.07, 1.3, 3.55, "Soundbox screen");
  phone(s, "merchant-proofs.png", 780, 1555, M + 2.72, 1.3, 3.55, "Merchant proofs screen");
  const sb = [
    { ic: "LuAudioLines", h: "“बोलकर बिल बनाइए”", b: "The shopkeeper says the amount and items; the box shows that bill’s QR." },
    { ic: "LuReceipt", h: "Bound by the bill", b: "The ₹826 payment lands on BILL-0001, items already on it." },
    { ic: "LuClock", h: "No bill? 120 seconds", b: "“क्या बेचा?”, then spoken amount or a tap. Never later." },
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.35 + i * 1.2;
    await badge(s, sb[i].ic, 5.15, y, 0.55, K.saffron, HEX.navy, "Soundbox point " + (i + 1));
    txt(s, sb[i].h, { x: 5.85, y: y - 0.02, w: 3.65, h: 0.35, fontSize: 16, bold: true, color: K.navy });
    txt(s, sb[i].b, { x: 5.85, y: y + 0.36, w: 3.65, h: 0.7, fontSize: 14 });
  }
  s.addNotes(
    "Here is the novelty in action. Before the customer pays, the shopkeeper speaks the bill: 'बोलकर बिल बनाइए: रक़म और सामान', the amount and then what is sold, 'दो किलो चीनी, एक तेल'. The box shows that bill's QR. The ₹826 payment arrives on BILL-0001, so the items are tied to the payment's own transaction id. On the left, the recent list shows it: ₹826, BILL-0001, 'दो किलो चीनी, एक तेल', Good proof.\n\n" +
    "No bill? The Soundbox announces the payment and asks 'क्या बेचा?'. That tag is accepted only within 120 seconds. After that the payment stays untagged; it still gets a certificate from the payment records, just without the merchant's words. Letting merchants tag later would let fraudsters do the same.\n\n" +
    "If several payments are open, the tag binds by a bill made before the payment, or the spoken amount, or the merchant taps. It never guesses: a wrong tag is worse than a missing one.\n\n" +
    "₹500 threshold is a product choice, configurable. The RBI draft's own trigger is ₹1,000, so ₹500 covers everything that draft would touch.\n\n" +
    "Right: the merchant's सबूत (Proofs) tab, 'Kavach · बिक्री का सबूत': every sale with its proof strength. ₹826 shows 'दो किलो चीनी, एक तेल' with Good proof; two payments still show 'सबूत का समय चालू · Recording open'."
  );

  // 8. Bank -------------------------------------------------------------------
  s = S("Kavach Content", "How it works");
  s.addText("The bank holds ₹826, not the shop", { placeholder: "title" });
  phone(s, "bank.png", 1104, 624, M + 0.07, 1.35, 3.4, "Bank console screen");
  const bx = 6.75;
  await badge(s, "LuEyeOff", bx, 1.35, 0.6, K.saffron, HEX.navy, "No tip-off");
  txt(s, "No tipping off", { x: bx, y: 2.05, w: 2.75, h: 0.35, fontSize: 16, bold: true, color: K.navy });
  txt(s, "The report reaches only the bank. Merchant and Soundbox screens show nothing until a hold exists.", { x: bx, y: 2.4, w: 2.75, h: 0.95, fontSize: 14 });
  await badge(s, "LuLock", bx, 3.4, 0.6, K.saffron, HEX.navy, "Lien");
  txt(s, "Only the reported amount", { x: bx, y: 4.1, w: 2.75, h: 0.35, fontSize: 16, bold: true, color: K.navy });
  txt(s, "MHA procedure s.9.1(i).", { x: bx, y: 4.45, w: 2.75, h: 0.35, fontSize: 14 });
  s.addNotes(
    "The bank console is also the presenter's control panel.\n\n" +
    "Step 1: the victim reports the ₹826 payment and gets an acknowledgement number. Look at the merchant and Soundbox: nothing. Kavach never warns a merchant before a hold exists. That is the no-tipping-off guardrail.\n\n" +
    "Step 2: the bank applies a lien on ₹826 only, which is what the MHA procedure s.9.1(i) prescribes for a single report. We can also show the over-reach case, a debit freeze on the whole account; Kavach then explains the complaint concerns only ₹826 and asks for the restriction to be narrowed. It never promises release.\n\n" +
    "After a hold, the procedure (s.9.1(ii)) lets the bank tell the account holder which police unit ordered it; that is not a tip-off. The complainant's details are never shared."
  );

  // 9. Merchant ---------------------------------------------------------------
  s = S("Kavach Content", "How it works");
  s.addText("When the hold lands, the proof is ready", { placeholder: "title" });
  phone(s, "merchant-hold.png", 390, 770, M + 0.07, 1.3, 3.65, "Merchant hold screen");
  const steps = [
    ["Calm Hindi explanation", "One payment is held, not the account. Not an accusation."],
    ["Two screening questions", "Lent your account? Then legal aid, not a letter."],
    ["Sale certificate", "Paytm's records kept apart from the merchant's words."],
    ["Grievance draft", "Cites only verified rules, each with source and date."],
    ["Merchant files it", "At their own bank. Kavach sends nothing."],
  ];
  steps.forEach((st, i) => {
    const y = 1.3 + i * 0.75;
    s.addShape(pres.shapes.OVAL, { x: 2.85, y: y + 0.02, w: 0.42, h: 0.42, fill: { color: i === 2 ? K.saffron : K.navy }, line: { type: "none" }, objectName: "Merchant step " + (i + 1) });
    txt(s, String(i + 1), { x: 2.85, y: y + 0.02, w: 0.42, h: 0.42, fontSize: 14, bold: true, color: i === 2 ? K.navy : K.white, align: "center", valign: "middle" });
    txt(s, st[0], { x: 3.45, y: y - 0.02, w: 6.0, h: 0.3, fontSize: 16, bold: true, color: K.navy });
    txt(s, st[1], { x: 3.45, y: y + 0.28, w: 6.0, h: 0.35, fontSize: 14, color: K.ink });
  });
  s.addNotes(
    "The merchant's screen turns red, but the banner says ₹826 only, one payment. Kavach explains in Hindi, and can read it aloud: this is a hold on one payment, not an accusation, and you already recorded what you sold.\n\n" +
    "Two screening questions come first. Anyone who lent out their account or moved money for a commission is sent to legal aid, not given an 'I'm innocent' letter. Accounts with repeated reports get no certificate.\n\n" +
    "Then the sale certificate, built from the payment records with the merchant's spoken tag kept separate, and the grievance draft. Every rule in it shows its source and the date it was checked. The AI writes the words; the facts come from the rules table.\n\n" +
    "The merchant reads it and files it at their own bank, then taps 'मैंने इसे अपने बैंक में जमा कर दिया है' (I filed it at my bank). Kavach never sends anything."
  );

  // 10. Ladder ----------------------------------------------------------------
  s = S("Kavach Content", "How it works");
  s.addText("If no one answers, day 22 is ready", { placeholder: "title" });
  const lad = [
    { ic: "LuBuilding2", who: "Bank", d: "7 days", b: "files the grievance on the government module" },
    { ic: "LuShield", who: "Police officer", d: "15 days", b: "releases the hold or records reasons" },
    { ic: "LuLandmark", who: "District Grievance Officer", d: "15 days", b: "decides; Addl. SP or Dy. SP rank" },
  ];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 3.1;
    card(s, x, 1.35, 2.8, 2.35, i === 2 ? K.navy : K.tint, "Ladder card " + (i + 1), i === 2);
    const dark = i === 2;
    await badge(s, lad[i].ic, x + 0.25, 1.6, 0.6, K.saffron, HEX.navy, "Ladder " + (i + 1));
    txt(s, lad[i].d, { x: x + 1.0, y: 1.6, w: 1.6, h: 0.6, fontSize: 26, bold: true, fontFace: "Arial", color: dark ? K.saffron : K.navy, valign: "middle" });
    txt(s, lad[i].who, { x: x + 0.25, y: 2.4, w: 2.4, h: 0.35, fontSize: 16, bold: true, color: dark ? K.white : K.navy });
    txt(s, lad[i].b, { x: x + 0.25, y: 2.78, w: 2.4, h: 0.8, fontSize: 14, color: dark ? K.ice : K.ink });
    if (i < 2) s.addImage({ data: await icon("LuChevronRight", HEX.indigo), x: x + 2.82, y: 2.3, w: 0.26, h: 0.26, objectName: "Arrow " + (i + 1), altText: "next" });
  }
  card(s, M, 3.95, 9, 1.05, K.white, "Day 22 card");
  await badge(s, "LuCalendarClock", M + 0.25, 4.15, 0.65, K.navy, HEX.saffron, "Day 22");
  txt(s, [
    { text: "Day 22 = 7 + 15. ", options: { bold: true, color: K.navy } },
    { text: "No decision? The letter to the District Grievance Officer is drafted. No lawful direction within 90 days of filing: the bank lifts the hold on request.", options: {} },
  ], { x: M + 1.1, y: 3.95, w: 7.7, h: 1.05, fontSize: 14, valign: "middle" });
  s.addNotes(
    "The escalation ladder comes straight from the rules table, from the MHA procedure of 2 January 2026, s.10.1 (read via the Meghalaya High Court annex, checked 2026-11-15).\n\n" +
    "The bank must file within 7 calendar days. The police officer on the case must release the hold or record reasons within 15. If not, the grievance goes automatically to the District Grievance Officer, who decides within 15.\n\n" +
    "So escalation is due on day 22, not day 15. In the demo we press 'Simulate day 22' and the escalation draft appears.\n\n" +
    "90-day fallback: if no lawful direction to continue arrives within 90 days of filing, the bank removes the hold on request, unless police extend it by up to 90 more days.\n\nWe never promise release."
  );

  // 11. Guardrails --------------------------------------------------------------
  pres.addSection({ title: "Trust" });
  s = S("Kavach Content", "Trust");
  s.addText("Built so it cannot be abused", { placeholder: "title" });
  const g = [
    { ic: "LuBookOpen", h: "Facts from a table", b: "Laws come only from a dated rules table. The AI never adds one." },
    { ic: "LuUserX", h: "Mule screen", b: "Lent your account? Legal aid. Repeat reports: no certificate." },
    { ic: "LuEyeOff", h: "Minimal data", b: "Last four digits, masked UPI handle. No buyer names." },
    { ic: "LuSend", h: "Human submits", b: "The merchant files at their bank. Kavach sends nothing." },
    { ic: "LuBell", h: "No tipping off", b: "Nothing is shown before a hold exists." },
    { ic: "LuLock", h: "Append-only proof", b: "The database rejects any edit or delete of a tag." },
    { ic: "LuCalendarClock", h: "Dated sources", b: "Every rule shows its source and last-checked date." },
    { ic: "LuScale", h: "Draft, not advice", b: "Not legal advice. No guaranteed release." },
  ];
  const gw = 2.1, gh = 1.7, gg = 0.2;
  for (let i = 0; i < 8; i++) {
    const r = Math.floor(i / 4), c = i % 4;
    const x = M + c * (gw + gg), y = 1.3 + r * (gh + gg);
    const hi = i === 7;
    card(s, x, y, gw, gh, hi ? K.navy : K.tint, "Guardrail card " + (i + 1), hi);
    if (!Lu[g[i].ic]) throw new Error(g[i].ic);
    await badge(s, g[i].ic, x + 0.2, y + 0.2, 0.5, hi ? K.saffron : K.navy, hi ? HEX.navy : HEX.saffron, "Guardrail " + (i + 1));
    txt(s, g[i].h, { x: x + 0.8, y: y + 0.2, w: gw - 0.95, h: 0.5, fontSize: 14, bold: true, color: hi ? K.white : K.navy, valign: "middle" });
    txt(s, g[i].b, { x: x + 0.2, y: y + 0.82, w: gw - 0.35, h: 0.8, fontSize: 12, color: hi ? K.ice : K.ink });
  }
  s.addNotes(
    "The question judges ask: won't fraudsters use this to manufacture proof? The design is built against that.\n\n" +
    "Facts from a table, words from the AI: laws, deadlines and procedures come only from the verified rules table; the model never invents a law, section or case.\n" +
    "Mule screen: anyone who lent out their account goes to legal aid. Accounts with repeated reports get no certificate (the demo cut-off of 3 is a placeholder; the real value is a policy decision).\n" +
    "Minimal data: last four account digits, payer UPI handle masked; the database refuses an unmasked one. No payer name, phone or address. An attached invoice is kept only as a SHA-256 fingerprint. Every buyer-data column has a recorded purpose and retention. (DPDP Act: say buyer details are personal data; the Act's exact terms are unverified in our notes.)\n" +
    "Human submits: Kavach never sends anything.\n" +
    "No tipping off: nothing until a hold exists.\n" +
    "Append-only: SQLite triggers abort any update or delete on sale tags.\n" +
    "Dated sources, and every screen says: draft, not legal advice, no guaranteed release."
  );

  // 12. Tech -----------------------------------------------------------------
  s = S("Kavach Content", "Trust");
  s.addText("A small stack with strict rules", { placeholder: "title" });
  // left: four screens
  const scrNames = ["/customer", "/soundbox", "/bank", "/merchant"];
  scrNames.forEach((n, i) => {
    card(s, M, 1.3 + i * 0.9, 1.7, 0.7, K.tint, "Screen box " + n, false);
    txt(s, n, { x: M, y: 1.3 + i * 0.9, w: 1.7, h: 0.7, fontSize: 14, bold: true, color: K.navy, align: "center", valign: "middle", fontFace: "Arial" });
  });
  s.addImage({ data: await icon("LuArrowRight", HEX.indigo), x: 2.35, y: 2.75, w: 0.4, h: 0.4, objectName: "Arrow screens to server", altText: "calls" });
  // middle: Next.js
  card(s, 2.95, 1.3, 2.9, 3.6, K.navy, "Server box");
  await badge(s, "LuServer", 3.2, 1.55, 0.6, K.saffron, HEX.navy, "Server");
  txt(s, "Next.js + TypeScript", { x: 3.2, y: 2.3, w: 2.45, h: 0.4, fontSize: 16, bold: true, color: K.white });
  txt(s, "One app. Server routes only. Each screen asks with a role and gets only what that actor would see.", { x: 3.2, y: 2.75, w: 2.45, h: 1.3, fontSize: 14, color: K.ice });
  txt(s, "/api/kavach\nsnapshotFor(role)", { x: 3.2, y: 4.2, w: 2.5, h: 0.5, fontSize: 11, color: K.saffron, fontFace: "Courier New" });
  s.addImage({ data: await icon("LuArrowRight", HEX.indigo), x: 6.0, y: 2.75, w: 0.4, h: 0.4, objectName: "Arrow server to services", altText: "uses" });
  // right: three services
  const svc = [
    { ic: "LuDatabase", h: "SQLite ledger", b: "Triggers reject edits and deletes" },
    { ic: "LuMic", h: "Sarvam", b: "Speech to text, text to speech, sarvam-105b drafting" },
    { ic: "LuBookOpen", h: "Rules table", b: "Verified, dated; a law watcher flags changes" },
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.3 + i * 1.25;
    card(s, 6.55, y, 2.95, 1.1, K.white, "Service " + svc[i].h);
    await badge(s, svc[i].ic, 6.7, y + 0.25, 0.6, K.tint, HEX.navy, "Service " + (i + 1));
    txt(s, svc[i].h, { x: 7.45, y: y + 0.12, w: 1.95, h: 0.32, fontSize: 14, bold: true, color: K.navy });
    txt(s, svc[i].b, { x: 7.45, y: y + 0.45, w: 1.95, h: 0.6, fontSize: 11, color: K.ink });
  }
  s.addNotes(
    "One Next.js app in TypeScript. The browser only records audio; everything else runs in server routes, so the one Sarvam API key never reaches the browser.\n\n" +
    "Each screen calls /api/kavach with its role, and snapshotFor(role) decides what it may see. That is how no-tipping-off is enforced: a fraud report reaches only the bank screen until a hold exists, and tests check it.\n\n" +
    "SQLite ledger: triggers abort any UPDATE or DELETE on sale tags, invoices and screenings. Account numbers are checked to be four digits; payer handles must be masked.\n\n" +
    "Sarvam does speech to text, text to speech and the drafting with sarvam-105b. Without the key, the demo runs fully offline: a recorded clip and fixed template drafts labelled 'Standard wording'.\n\n" +
    "Rules come from rules.json, each with source and date. A law watcher polls RBI and PIB feeds and flags rules that may have changed; it never edits a rule. A test suite includes the guardrail tests."
  );

  // 13. Demo flow --------------------------------------------------------------
  pres.addSection({ title: "Demo" });
  s = S("Kavach Content", "Demo");
  s.addText("Live demo: seven steps", { placeholder: "title" });
  const flow = [
    ["Customer", "Pays ₹826 to Sharma Kirana Store"],
    ["Soundbox", "Bill spoken first; ₹826 lands already tagged"],
    ["Merchant", "₹826 shows with its proof tag. All normal"],
    ["Bank", "Victim reports it. Merchant sees nothing"],
    ["Bank", "Holds ₹826. Merchant screen turns red"],
    ["Merchant", "Explains, screens, drafts; merchant files"],
    ["Bank", "Simulate day 22: escalation draft appears"],
  ];
  flow.forEach((f, i) => {
    const col = i < 4 ? 0 : 1, row = i < 4 ? i : i - 4;
    const x = M + col * 4.6, y = 1.3 + row * 0.92;
    card(s, x, y, 4.4, 0.75, i === 1 ? K.navy : K.tint, "Demo step card " + (i + 1), i === 1);
    const dark = i === 1;
    s.addShape(pres.shapes.OVAL, { x: x + 0.15, y: y + 0.15, w: 0.45, h: 0.45, fill: { color: K.saffron }, line: { type: "none" }, objectName: "Demo step " + (i + 1) });
    txt(s, String(i + 1), { x: x + 0.15, y: y + 0.15, w: 0.45, h: 0.45, fontSize: 16, bold: true, color: K.navy, align: "center", valign: "middle" });
    txt(s, f[0].toUpperCase(), { x: x + 0.75, y: y + 0.08, w: 3.5, h: 0.25, fontSize: 10, bold: true, color: dark ? K.saffron : K.indigo, charSpacing: 2 });
    txt(s, f[1], { x: x + 0.75, y: y + 0.33, w: 3.55, h: 0.35, fontSize: 14, color: dark ? K.white : K.ink });
  });
  card(s, M + 4.6, 1.3 + 3 * 0.92, 4.4, 0.75, K.white, "Fallback card");
  txt(s, "Fallback: recorded clip and template drafts run fully offline", { x: M + 4.75, y: 1.3 + 3 * 0.92, w: 4.1, h: 0.75, fontSize: 12, italic: true, color: K.muted, valign: "middle" });
  s.addNotes(
    "Reset from the bank console first.\n\n" +
    "1. Customer pays ₹826.\n2. Soundbox: the shopkeeper speaks the bill, 'दो किलो चीनी, एक तेल'; the box shows the bill QR; the ₹826 lands on BILL-0001, already tagged. Say: the sale is recorded in the shopkeeper's own words, before the payment or within seconds of it, and it can never be added later.\n" +
    "3. Merchant shows ₹826 with the tag.\n4. Bank: the victim reports. Point at the merchant and Soundbox: nothing changes. No tipping off.\n" +
    "5. Bank holds ₹826 only. Merchant turns red.\n6. Merchant: Hindi explanation, answer 'नहीं' to both questions, certificate and grievance ('मेरे काग़ज़ तैयार कीजिए'), then 'मैंने इसे अपने बैंक में जमा कर दिया है'.\n" +
    "7. Bank: simulate day 22. The bank had 7 days and the police officer 15; no decision, so the letter to the District Grievance Officer is ready.\n\n" +
    "To show guardrails: answer 'हाँ' for the legal-aid referral; wait two minutes to show the tag window close.\n" +
    "Plan B if the phone mic fails: 'Use recorded clip'. Without the Sarvam key, drafts use the fixed template wording."
  );

  // 14. Why Paytm ---------------------------------------------------------------
  pres.addSection({ title: "Close" });
  s = S("Kavach Content", "Close");
  s.addText("Why this has to be a payments company", { placeholder: "title" });
  txt(s, "ONLY PAYTM HAS", { x: M, y: 1.3, w: 4.3, h: 0.3, fontSize: 12, bold: true, color: K.indigo, charSpacing: 2 });
  const only = [
    { ic: "LuIndianRupee", h: "The transaction", b: "The procedure already expects aggregators to upload settlement and order details (s.9.5)." },
    { ic: "LuSpeaker", h: "The Soundbox", b: "On the counter, at the moment of sale." },
    { ic: "LuSmartphone", h: "The merchant's app", b: "Already in their hand, in their language." },
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.72 + i * 1.08;
    await badge(s, only[i].ic, M, y, 0.6, K.saffron, HEX.navy, "Only Paytm " + (i + 1));
    txt(s, only[i].h, { x: M + 0.8, y: y - 0.03, w: 3.6, h: 0.32, fontSize: 16, bold: true, color: K.navy });
    txt(s, only[i].b, { x: M + 0.8, y: y + 0.3, w: 3.6, h: 0.7, fontSize: 13 });
  }
  card(s, 5.2, 1.3, 4.3, 3.65, K.navy, "Gains card");
  txt(s, "WHAT PAYTM GAINS", { x: 5.5, y: 1.5, w: 3.8, h: 0.3, fontSize: 12, bold: true, color: K.saffron, charSpacing: 2 });
  txt(s, "Our hypotheses, not measured", { x: 5.5, y: 1.8, w: 3.8, h: 0.3, fontSize: 12, italic: true, color: K.ice });
  const gains = [
    ["Retention", "A merchant whose money is held may stop taking UPI. Indore traders did in 2024."],
    ["A reason to keep the Soundbox", "It protects the merchant's money, not just announces it."],
    ["Standing with regulators", "Clean, dated settlement data; mules screened out."],
  ];
  gains.forEach((gn, i) => {
    const y = 2.25 + i * 0.88;
    txt(s, gn[0], { x: 5.5, y, w: 3.8, h: 0.3, fontSize: 15, bold: true, color: K.white });
    txt(s, gn[1], { x: 5.5, y: y + 0.3, w: 3.8, h: 0.5, fontSize: 12, color: K.ice });
  });
  s.addNotes(
    "A letter tool sees only what the merchant types after the freeze. Paytm sees the payment as it happens, owns the Soundbox on the counter, and is already in the merchant's hand.\n\n" +
    "The Home Ministry procedure (s.9.5) already expects payment aggregators to upload settlement and order details for a held payment. Kavach's certificate is built from exactly that data.\n\n" +
    "What Paytm gains: these are hypotheses, not measured results; say them as such. We have no numbers on churn after a freeze.\n" +
    "Retention: Indore garment traders told shops to stop taking UPI over freezes in December 2024. Kavach gives merchants a reason to stay.\n" +
    "Device value: the Soundbox becomes the thing that protects the merchant's money.\n" +
    "Regulators: settlement data in a clean, dated form, and mules screened out instead of helped."
  );

  // 15. Roadmap -----------------------------------------------------------------
  s = S("Kavach Content", "Close");
  s.addText("Built, next, later", { placeholder: "title" });
  const road = [
    { t: "BUILT", ic: "LuCircleCheck", items: ["Voice tag in a 120-second window", "Binding by bill, spoken amount or tap", "Invoice kept as a fingerprint", "Law watcher on official feeds"] },
    { t: "NEXT", ic: "LuClock", items: ["Rehearse on real phones", "Pilot on real Soundbox data", "Update rules when RBI's final directions land"] },
    { t: "LATER", ic: "LuQrCode", items: ["Bill before payment via dynamic QR, if small merchants can get it", "More Indian languages"] },
  ];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 3.1, r = road[i];
    const dark = i === 0;
    card(s, x, 1.3, 2.8, 3.65, dark ? K.navy : K.tint, "Roadmap " + r.t, dark);
    await badge(s, r.ic, x + 0.25, 1.5, 0.55, K.saffron, HEX.navy, "Roadmap " + (i + 1));
    txt(s, r.t, { x: x + 0.95, y: 1.5, w: 1.7, h: 0.55, fontSize: 18, bold: true, fontFace: "Arial", color: dark ? K.white : K.navy, valign: "middle", charSpacing: 2 });
    txt(s, r.items.map((it, j) => ({ text: it, options: { bullet: { indent: 14 }, breakLine: j < r.items.length - 1 } })), {
      x: x + 0.25, y: 2.3, w: 2.4, h: 2.5, fontSize: 14, color: dark ? K.ice : K.ink, paraSpaceAfter: 8,
    });
  }
  s.addNotes(
    "Built today: the voice tag inside a 120-second window; binding a tag to the right payment by a bill made before the payment, by the spoken amount, or by a tap, never a guess; an invoice attached inside the window kept only as a SHA-256 fingerprint; a law watcher that flags rules official feeds may have changed.\n\n" +
    "Next: rehearse on real phones (mic over HTTPS); pilot on real Soundbox data, for example to learn how often two equal amounts arrive within two minutes; update the rules table when RBI's final directions land. The Supreme Court's 29 October order expects them by the end of 2026, with a hearing on 23 November 2026.\n\n" +
    "Later: bill-before-payment via dynamic QR is the strongest proof, but Paytm's dynamic QR is documented for merchants with a billing system or POS. We found no sign a small shop can make one from the Soundbox; not confirmed with Paytm. More Indian languages."
  );

  // 16. Close -------------------------------------------------------------------
  s = S("Kavach Dark Content", "Close");
  s.addText("The proof should exist before the freeze", { placeholder: "title" });
  txt(s, "Other tools help a merchant write a letter after the account is frozen.", { x: M, y: 1.45, w: 5.9, h: 0.7, fontSize: 18, color: K.ice });
  txt(s, "Kavach makes sure the proof already exists before the freeze happens.", { x: M, y: 2.2, w: 5.9, h: 0.9, fontSize: 22, bold: true, fontFace: "Arial", color: K.white });
  card(s, M, 3.4, 5.9, 1.3, K.saffron, "Ask card", false);
  txt(s, "THE ASK", { x: M + 0.3, y: 3.55, w: 5.3, h: 0.3, fontSize: 12, bold: true, color: K.navy, charSpacing: 2 });
  txt(s, "Test Kavach with real Soundbox payments and settlement records, with a group of Paytm merchants.", { x: M + 0.3, y: 3.88, w: 5.3, h: 0.7, fontSize: 16, bold: true, color: K.navy });
  await badge(s, "LuShieldCheck", 7.15, 1.6, 2.3, K.saffron, HEX.navy, "Close shield");
  s.addNotes(
    "Close with the line from slide 1.\n\n" +
    "Other tools help a merchant write a letter after the account is frozen. Kavach makes sure the proof already exists before the freeze happens.\n\n" +
    "The ask: a chance to test it with real Soundbox payments and settlement records, with a group of merchants. That would answer the open questions we can't answer with demo data, such as how often tags are missed in a rush.\n\n" +
    "Reminder: Kavach is a drafting aid. Draft, not legal advice; no guaranteed release. The merchant always files."
  );

  await pres.writeFile({ fileName: OUT });
  if (process.env.APPLY_THEME) {
    const { applyTheme } = require(process.env.APPLY_THEME);
    await applyTheme(OUT, THEME);
  }
  console.log("wrote", OUT);
}

build().catch((e) => { console.error(e); process.exit(1); });
