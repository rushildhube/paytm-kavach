/**
 * The buyer approves the bill (issue #19, docs/proof-improvements.md item 1):
 * the buyer's payment screen shows the bill's items and amount before the PIN,
 * the payment records that approval, and the bill QR's UPI note carries the items.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { handle, snapshot } from "@backend/api";
import { buildCertificate } from "@backend/certificate";
import { db } from "@backend/db/connection";
import { getSaleTag } from "@backend/ledger";
import { resetStore } from "@backend/store";
import type { Bill } from "@backend/types";
import { billNote, buildUpiUri, parseUpiUri, UPI_NOTE_MAX } from "@frontend/upi";

process.env.KAVACH_USE_MODEL = "0";

beforeEach(() => resetStore());

const ITEMS = "दो किलो चीनी, एक तेल";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  return (await handle(body)).result as T;
}
const newBill = (text = ITEMS, amountInr = 826) => call<Bill>({ action: "bill-create", amountInr, text });
const payAsBuyer = (bill: Bill, extra: Record<string, unknown> = {}) =>
  call<{ txn: { id: string } }>({ action: "pay", billId: bill.id, amountInr: bill.amountInr, role: "customer", ...extra });

describe("buyer approves the bill (#19)", () => {
  it("the buyer's screen gets this bill's items, and only those", async () => {
    await newBill("एक घी", 560);
    const bill = await newBill();
    const seen = await call<Record<string, unknown>>({ action: "bill-lookup", billId: bill.id, role: "customer" });
    expect(seen.text).toBe(ITEMS);
    expect(JSON.stringify(seen)).not.toContain("एक घी");
    expect(Object.keys(seen).sort()).toEqual(["amountInr", "id", "shopName", "status", "text"]);
  });

  it("paying with the shown text records an approved bill tag, graded strong", async () => {
    const bill = await newBill();
    const { txn } = await payAsBuyer(bill, { approvedText: ITEMS });
    const tag = getSaleTag(txn.id);
    expect(tag).toMatchObject({ source: "bill", boundBy: "bill", billId: bill.id, buyerApproved: true });
    const t = snapshot().transactions.find((x) => x.id === txn.id);
    expect(t?.strength.level).toBe("strong");
    expect(t?.strength.reasons.join(" ")).toMatch(/buyer's payment screen showed/);
  });

  it("the customer reply still carries only the receipt", async () => {
    const bill = await newBill();
    const reply = await call<Record<string, unknown>>({
      action: "pay",
      billId: bill.id,
      amountInr: 826,
      role: "customer",
      approvedText: ITEMS,
    });
    expect(Object.keys(reply)).toEqual(["txn"]);
    expect(Object.keys(reply.txn as object).sort()).toEqual(["amountInr", "at", "id"]);
  });

  it("without the shown text, a bill payment stays good, not strong", async () => {
    const bill = await newBill();
    const { txn } = await payAsBuyer(bill);
    expect(getSaleTag(txn.id)?.buyerApproved).toBeUndefined();
    expect(snapshot().transactions.find((x) => x.id === txn.id)?.strength.level).toBe("good");
  });

  it("only the buyer's own screen can approve: a merchant-side pay with approvedText is not an approval", async () => {
    const bill = await newBill();
    const { txn } = await call<{ txn: { id: string } }>({
      action: "pay",
      billId: bill.id,
      amountInr: 826,
      approvedText: ITEMS,
    });
    expect(getSaleTag(txn.id)?.buyerApproved).toBeUndefined();
  });

  it("refuses text that differs from the bill, and writes nothing", async () => {
    const bill = await newBill();
    const before = snapshot().transactions.length;
    await expect(payAsBuyer(bill, { approvedText: "पाँच किलो चीनी" })).rejects.toThrow(/changed after it was shown/);
    expect(snapshot().transactions.length).toBe(before);
    const reread = await call<{ status: string }>({ action: "bill-lookup", billId: bill.id, role: "customer" });
    expect(reread.status).toBe("open");
  });

  it("a non-bill tag can never be marked approved", async () => {
    const { txn } = await call<{ txn: { id: string } }>({ action: "pay", amountInr: 650 });
    await call({ action: "tag", txnId: txn.id, transcript: "एक घी" });
    expect(getSaleTag(txn.id)?.buyerApproved).toBeUndefined();
  });

  it("the approval is append-only like the rest of the tag", async () => {
    const bill = await newBill();
    const { txn } = await payAsBuyer(bill);
    expect(() =>
      db().prepare("UPDATE sale_tags SET buyer_approved = 1 WHERE txn_id = ?").run(txn.id),
    ).toThrow(/append-only/);
  });

  it("the database refuses an approval value other than 0 or 1", async () => {
    const { txn } = await call<{ txn: { id: string } }>({ action: "pay", amountInr: 650 });
    expect(() =>
      db()
        .prepare(
          `INSERT INTO sale_tags (txn_id, recorded_at, transcript, items, source, buyer_approved)
           VALUES (?, ?, 'x', '[]', 'voice', 2)`,
        )
        .run(txn.id, new Date().toISOString()),
    ).toThrow(/CHECK/);
  });

  it("the certificate says the buyer's screen showed the items, and does not overclaim the UPI note", async () => {
    const bill = await newBill();
    const { txn } = await payAsBuyer(bill, { approvedText: ITEMS });
    await call({ action: "report", txnId: txn.id, role: "bank" });
    const hold = await call<{ id: string }>({ action: "hold", txnId: txn.id, role: "bank" });
    const cert = buildCertificate(hold.id, new Date());
    expect(cert.saleTag?.buyerApproved).toBe(true);
    expect(cert.strength.level).toBe("strong");
    const line = cert.provenance.find((l) => l.includes("before entering their PIN") || l.includes("Before entering"));
    expect(line).toBeDefined();
    expect(line).toMatch(/not verified/);
  });

  it("the bill purpose record now says the buyer sees the items", async () => {
    const rows = await call<{ table: string; column: string; purpose: string; minimised: string }[]>({
      action: "data-purposes",
    });
    const bills = rows.find((r) => r.table === "bills" && r.column === "text");
    expect(bills?.purpose).toMatch(/buyer approves/);
    expect(bills?.minimised).toMatch(/never buyer details/);
  });
});

describe("billNote: the bill QR's UPI note (#19)", () => {
  it("carries the bill id and items, and survives a QR round trip", () => {
    const note = billNote("BILL-0001", ITEMS);
    expect(note).toBe(`BILL-0001 · ${ITEMS}`);
    const uri = buildUpiUri({ pa: "shop@demo", pn: "Shop", am: 826, tr: "BILL-0001", tn: note });
    const parsed = parseUpiUri(uri, "shop@demo");
    expect(parsed.ok && parsed.payment.tn).toBe(note);
  });

  it("falls back to the bill id with no items, and cuts long notes", () => {
    expect(billNote("BILL-0002", "")).toBe("Bill BILL-0002");
    const long = billNote("BILL-0003", "बहुत लंबा सामान ".repeat(10));
    expect(Array.from(long).length).toBe(UPI_NOTE_MAX);
    expect(long.endsWith("…")).toBe(true);
  });
});
