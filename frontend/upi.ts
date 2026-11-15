/**
 * UPI payment URIs (the text inside every UPI QR code), built and parsed by
 * hand so the result matches what real UPI apps produce and accept.
 *
 *   static shop QR: upi://pay?pa=<vpa>&pn=<shop>&cu=INR
 *   bill QR:        upi://pay?pa=<vpa>&pn=<shop>&am=826.00&cu=INR&tr=BILL-0001&tn=Bill%20BILL-0001
 *
 * Pure functions, no DOM: safe on the server, in the browser and in tests.
 */

/** Same ceiling the bill store uses (₹1,00,000). */
export const MAX_UPI_AMOUNT_INR = 100_000;

export type UpiPayment = {
  /** Payee VPA, e.g. sharmakirana@demosaakshi */
  pa: string;
  /** Payee name shown by the paying app */
  pn: string;
  /** Fixed amount in rupees; absent on a static QR */
  am?: number;
  /** Transaction reference: the Kavach bill id */
  tr?: string;
  /** Short note */
  tn?: string;
};

export type UpiParse =
  | { ok: true; payment: UpiPayment }
  | { ok: false; reason: "not-upi" | "wrong-payee" | "bad-amount" | "bad-currency" | "bad-ref" };

const VPA = /^[\w.-]{2,64}@[\w.-]{2,32}$/;
const REF = /^[A-Za-z0-9-]{1,64}$/;
const AMOUNT = /^\d{1,7}(\.\d{1,2})?$/;

export function buildUpiUri(p: UpiPayment): string {
  const parts: [string, string][] = [
    ["pa", p.pa],
    ["pn", p.pn],
  ];
  if (p.am !== undefined) parts.push(["am", p.am.toFixed(2)]);
  parts.push(["cu", "INR"]);
  if (p.tr) parts.push(["tr", p.tr]);
  if (p.tn) parts.push(["tn", p.tn]);
  return "upi://pay?" + parts.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

function decode(v: string): string {
  try {
    return decodeURIComponent(v.replace(/\+/g, " "));
  } catch {
    return v;
  }
}

/**
 * Reads a scanned QR. Accepts only a `upi://pay` URI for `expectedVpa`
 * (case-insensitive), in INR, with a sane amount when one is given.
 */
export function parseUpiUri(text: string, expectedVpa: string): UpiParse {
  const raw = text.trim();
  const m = /^upi:\/\/pay\?(.*)$/i.exec(raw);
  if (!m) return { ok: false, reason: "not-upi" };

  const params = new Map<string, string>();
  for (const pair of m[1].split("&")) {
    if (!pair) continue;
    const i = pair.indexOf("=");
    const key = (i < 0 ? pair : pair.slice(0, i)).toLowerCase();
    const value = i < 0 ? "" : decode(pair.slice(i + 1));
    if (!params.has(key)) params.set(key, value);
  }

  const pa = params.get("pa")?.trim() ?? "";
  if (!VPA.test(pa)) return { ok: false, reason: "not-upi" };
  if (pa.toLowerCase() !== expectedVpa.trim().toLowerCase()) return { ok: false, reason: "wrong-payee" };

  const cu = params.get("cu");
  if (cu !== undefined && cu.toUpperCase() !== "INR") return { ok: false, reason: "bad-currency" };

  const payment: UpiPayment = { pa, pn: (params.get("pn") ?? "").trim().slice(0, 100) };

  const am = params.get("am");
  if (am !== undefined && am !== "") {
    if (!AMOUNT.test(am)) return { ok: false, reason: "bad-amount" };
    const n = Number(am);
    if (!(n > 0) || n > MAX_UPI_AMOUNT_INR) return { ok: false, reason: "bad-amount" };
    payment.am = n;
  }

  const tr = params.get("tr");
  if (tr !== undefined && tr !== "") {
    if (!REF.test(tr)) return { ok: false, reason: "bad-ref" };
    payment.tr = tr;
  }

  const tn = params.get("tn");
  if (tn) payment.tn = tn.slice(0, 80);

  return { ok: true, payment };
}

/** Words for the scanner when a QR is refused. */
export const UPI_REJECT_TEXT: Record<Exclude<UpiParse, { ok: true }>["reason"], string> = {
  "not-upi": "This is not a UPI payment QR",
  "wrong-payee": "This QR is for a different shop (demo pays only the demo shop)",
  "bad-amount": "The amount in this QR is not valid",
  "bad-currency": "Only INR payments are supported",
  "bad-ref": "The bill reference in this QR is not valid",
};
