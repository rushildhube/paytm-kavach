import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { buildUpiUri, parseUpiUri } from "@frontend/upi";

const VPA = "sharmakirana@demopaytm";
const SHOP = "Sharma Kirana Store";

describe("buildUpiUri", () => {
  it("builds a static shop QR with %20, not +", () => {
    expect(buildUpiUri({ pa: VPA, pn: SHOP })).toBe(
      "upi://pay?pa=sharmakirana%40demopaytm&pn=Sharma%20Kirana%20Store&cu=INR",
    );
  });

  it("builds a bill QR with a fixed two-decimal amount and the bill id as tr", () => {
    const uri = buildUpiUri({ pa: VPA, pn: SHOP, am: 826, tr: "BILL-0001", tn: "Bill BILL-0001" });
    expect(uri).toContain("am=826.00");
    expect(uri).toContain("tr=BILL-0001");
    expect(uri).toContain("tn=Bill%20BILL-0001");
  });
});

describe("parseUpiUri", () => {
  it("round-trips a static QR (no amount, no ref)", () => {
    const r = parseUpiUri(buildUpiUri({ pa: VPA, pn: SHOP }), VPA);
    expect(r).toEqual({ ok: true, payment: { pa: VPA, pn: SHOP } });
  });

  it("round-trips a bill QR", () => {
    const r = parseUpiUri(buildUpiUri({ pa: VPA, pn: SHOP, am: 826.5, tr: "BILL-0007" }), VPA);
    expect(r.ok && r.payment).toMatchObject({ am: 826.5, tr: "BILL-0007" });
  });

  it("accepts a plain @ and + for spaces as other apps write them, and matches the payee case-insensitively", () => {
    const r = parseUpiUri("UPI://pay?pa=SharmaKirana@DemoPaytm&pn=Sharma+Kirana&am=10", VPA);
    expect(r.ok && r.payment.pn).toBe("Sharma Kirana");
  });

  it.each(["https://paytm.com", "upi://mandate?pa=" + VPA, "hello", "", "upi://pay?pn=x", "upi://pay?pa=nope"])(
    "rejects a non-UPI or malformed QR: %s",
    (text) => {
      expect(parseUpiUri(text, VPA)).toEqual({ ok: false, reason: "not-upi" });
    },
  );

  it("rejects another payee", () => {
    expect(parseUpiUri("upi://pay?pa=someone@okbank&pn=X", VPA)).toEqual({ ok: false, reason: "wrong-payee" });
  });

  it.each(["0", "-5", "abc", "1e3", "12.345", "100000.01", "1,000", "Infinity", "NaN"])(
    "rejects a bad amount: %s",
    (am) => {
      expect(parseUpiUri(`upi://pay?pa=${VPA}&am=${am}`, VPA)).toEqual({ ok: false, reason: "bad-amount" });
    },
  );

  it("accepts the maximum amount", () => {
    expect(parseUpiUri(`upi://pay?pa=${VPA}&am=100000`, VPA).ok).toBe(true);
  });

  it("rejects a non-INR currency", () => {
    expect(parseUpiUri(`upi://pay?pa=${VPA}&cu=USD`, VPA)).toEqual({ ok: false, reason: "bad-currency" });
  });

  it("rejects a bill reference with odd characters", () => {
    expect(parseUpiUri(`upi://pay?pa=${VPA}&tr=BILL%3Cscript%3E`, VPA)).toEqual({ ok: false, reason: "bad-ref" });
  });
});

describe("QR round trip", () => {
  /** Renders the QR modules to an RGBA bitmap and decodes it with jsQR, as the phone scanner does. */
  function scan(text: string): string | null {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const scale = 4;
    const quiet = 4;
    const size = (n + quiet * 2) * scale;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!qr.modules.get(y, x)) continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = ((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx;
            data[px * 4] = data[px * 4 + 1] = data[px * 4 + 2] = 0;
          }
        }
      }
    }
    return jsQR(data, size, size)?.data ?? null;
  }

  it("a generated bill QR decodes back to the same bill", () => {
    const uri = buildUpiUri({ pa: VPA, pn: SHOP, am: 826, tr: "BILL-0001", tn: "Bill BILL-0001" });
    const text = scan(uri);
    expect(text).toBe(uri);
    const r = parseUpiUri(text!, VPA);
    expect(r.ok && r.payment).toMatchObject({ am: 826, tr: "BILL-0001" });
  });

  it("a generated static QR decodes back without an amount", () => {
    const text = scan(buildUpiUri({ pa: VPA, pn: SHOP }));
    const r = parseUpiUri(text!, VPA);
    expect(r.ok && r.payment.am).toBeUndefined();
  });
});
