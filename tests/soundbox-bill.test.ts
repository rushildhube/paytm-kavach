/**
 * Bills on the counter Soundbox, both ways:
 * - a bill made on the phone (or spoken on the box) is shown on the box as a
 *   bill QR, optionally with a spoken "please pay ₹X for …";
 * - a payment that came without a bill can get one written on the phone, but
 *   only inside the tag window and labelled as written after the payment.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { handle, soundboxSnapshot, snapshot } from "@backend/api";
import { buildCertificate } from "@backend/certificate";
import { allMerchants, advanceClock, resetStore } from "@backend/store";
import { announceRequest, PHRASES } from "@voice/announce";
import { VOICE_LANGUAGES } from "@voice/languages";

process.env.KAVACH_USE_MODEL = "0";

beforeEach(() => resetStore());

type Bill = { id: string; amountInr: number; status: string };

async function bill(amountInr: number, text: string, soundbox?: "qr" | "voice"): Promise<Bill> {
  return (await handle({ action: "bill-create", amountInr, text, ...(soundbox ? { soundbox } : {}) })).result as Bill;
}

describe("bill on the Soundbox", () => {
  it("the box shows the shop QR payee and no request by default", () => {
    const s = soundboxSnapshot();
    expect(s.payee.vpa).toMatch(/@/);
    expect(s.request).toBeNull();
  });

  it("a bill sent with voice appears as the box's request, and the merchant sees it is on the box", async () => {
    const b = await bill(826, "दो किलो चीनी, एक तेल", "voice");
    const s = soundboxSnapshot();
    expect(s.request).toMatchObject({ billId: b.id, amountInr: 826, text: "दो किलो चीनी, एक तेल", mode: "voice" });
    expect(snapshot().soundboxBillId).toBe(b.id);
  });

  it("a bill created for the phone only is not on the box", async () => {
    await bill(500, "ek tel");
    expect(soundboxSnapshot().request).toBeNull();
  });

  it("each send gets a new nonce, so the box speaks once per send", async () => {
    const b = await bill(826, "cheeni", "qr");
    const first = soundboxSnapshot().request!;
    expect(first.mode).toBe("qr");
    await handle({ action: "bill-to-soundbox", billId: b.id, mode: "voice" });
    const second = soundboxSnapshot().request!;
    expect(second.mode).toBe("voice");
    expect(second.nonce).not.toBe(first.nonce);
  });

  it("paying the bill clears the request and binds the bill as the tag", async () => {
    const b = await bill(826, "do kilo cheeni", "voice");
    const paid = (await handle({ action: "pay", billId: b.id, amountInr: 826 })).result as { txn: { id: string } };
    expect(soundboxSnapshot().request).toBeNull();
    const t = snapshot().transactions.find((x) => x.id === paid.txn.id)!;
    expect(t.tag).toMatchObject({ source: "bill", boundBy: "bill", billId: b.id });
  });

  it("cancelling the bill, or clearing the box, returns to the shop QR", async () => {
    const b = await bill(300, "biscuit", "qr");
    await handle({ action: "bill-cancel", billId: b.id });
    expect(soundboxSnapshot().request).toBeNull();
    await bill(400, "namkeen", "qr");
    await handle({ action: "soundbox-clear" });
    expect(soundboxSnapshot().request).toBeNull();
  });

  it("refuses a paid bill and another merchant's bill", async () => {
    const b = await bill(826, "cheeni");
    await handle({ action: "pay", billId: b.id, amountInr: 826 });
    await expect(handle({ action: "bill-to-soundbox", billId: b.id, mode: "qr" })).rejects.toThrow(/open bill/);

    const other = await bill(200, "chai");
    const [, second] = allMerchants();
    await handle({ action: "merchant", merchantId: second.id });
    await expect(handle({ action: "bill-to-soundbox", billId: other.id, mode: "qr" })).rejects.toThrow(/another merchant/);
    // And the first shop's request never shows on the second shop's box.
    expect(soundboxSnapshot().request).toBeNull();
  });

  it("the Soundbox snapshot still carries no hold or report data", async () => {
    const paid = (await handle({ action: "pay", amountInr: 826 })).result as { txn: { id: string } };
    await handle({ action: "report", role: "bank", txnId: paid.txn.id });
    await handle({ action: "hold", role: "bank", txnId: paid.txn.id });
    await bill(100, "x", "voice");
    const json = JSON.stringify({ ...soundboxSnapshot(), request: null });
    expect(json).not.toMatch(/"(hold|holds|held|reports?|ackNo|grievance)"/);
  });

  it("a bill spoken on the box takes the largest amount heard and is put on the box with voice", async () => {
    const r = (await handle({ action: "bill-voice", role: "soundbox", transcript: "826 रुपये, दो किलो चीनी" }))
      .result as Bill;
    expect(r.amountInr).toBe(826);
    expect(soundboxSnapshot().request).toMatchObject({ billId: r.id, mode: "voice" });
  });

  it("a spoken bill with no amount is refused", async () => {
    await expect(handle({ action: "bill-voice", transcript: "cheeni aur tel" })).rejects.toThrow(/no amount/);
  });

  it("the spoken request names the amount in every language", () => {
    for (const { code } of VOICE_LANGUAGES) {
      expect(PHRASES[code].payRequest).toBeTypeOf("function");
      expect(announceRequest({ amountInr: 826, text: "cheeni" }, code)).toMatch(/826/);
      expect(announceRequest({ amountInr: 826, text: "" }, code)).toMatch(/826/);
    }
  });
});

describe("writing a bill for a payment that came without one", () => {
  it("records a typed tag, labelled as written after the payment", async () => {
    const paid = (await handle({ action: "pay", amountInr: 826 })).result as { txn: { id: string } };
    const tag = (await handle({ action: "bill-for-payment", txnId: paid.txn.id, text: "do kilo cheeni, ek tel" }))
      .result as { source: string; boundBy: string; billId?: string };
    expect(tag).toMatchObject({ source: "typed", boundBy: "tap" });
    expect(tag.billId).toBeUndefined();

    await handle({ action: "report", role: "bank", txnId: paid.txn.id });
    const hold = (await handle({ action: "hold", role: "bank", txnId: paid.txn.id })).result as { id: string };
    const cert = buildCertificate(hold.id, new Date());
    expect(cert.saleTag?.source).toBe("typed");
    const lines = cert.provenance.join(" ");
    expect(lines).toMatch(/without a bill/);
    expect(lines).not.toMatch(/before the payment/);
  });

  it("is refused a second time, after the window, and after a hold", async () => {
    const a = (await handle({ action: "pay", amountInr: 826 })).result as { txn: { id: string } };
    await handle({ action: "bill-for-payment", txnId: a.txn.id, text: "cheeni" });
    await expect(handle({ action: "bill-for-payment", txnId: a.txn.id, text: "tel" })).rejects.toThrow(/already tagged/);

    const b = (await handle({ action: "pay", amountInr: 700 })).result as { txn: { id: string } };
    await handle({ action: "report", role: "bank", txnId: b.txn.id });
    await handle({ action: "hold", role: "bank", txnId: b.txn.id });
    await expect(handle({ action: "bill-for-payment", txnId: b.txn.id, text: "atta" })).rejects.toThrow(/hold/);

    const c = (await handle({ action: "pay", amountInr: 900 })).result as { txn: { id: string } };
    advanceClock(1);
    await expect(handle({ action: "bill-for-payment", txnId: c.txn.id, text: "chawal" })).rejects.toThrow(/window/);
  });
});
