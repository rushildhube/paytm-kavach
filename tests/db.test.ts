/**
 * The SQLite store (backend/db): append-only proof in SQL, bills, and the
 * API actions that write to the database.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "@backend/api";
import { createBill } from "@backend/bills";
import { db, dbFile, SCHEMA_VERSION } from "@backend/db/connection";
import { getTransaction, recordPayment, recordSaleTag } from "@backend/ledger";
import { activeMerchant, resetStore, setMerchantLanguage, store } from "@backend/store";
import type { Bill, SaleTag, Transaction } from "@backend/types";

process.env.KAVACH_USE_MODEL = "0";

beforeEach(() => {
  resetStore();
});

const count = (table: string) =>
  (db().prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

async function call<T>(body: Record<string, unknown>): Promise<T> {
  return (await handle(body)).result as T;
}

describe("the database", () => {
  it("is in memory under Vitest and migrated to the current schema version", () => {
    expect(dbFile()).toBe(":memory:");
    const row = db().prepare("PRAGMA user_version").get() as { user_version: number };
    expect(row.user_version).toBe(SCHEMA_VERSION);
  });

  it("refuses to UPDATE or DELETE a stored sale tag", () => {
    const txn = recordPayment(826, "victim@okdemo");
    recordSaleTag({ txnId: txn.id, transcript: "do kilo cheeni", items: [], source: "voice" });
    expect(() =>
      db().prepare("UPDATE sale_tags SET transcript = 'edited' WHERE txn_id = ?").run(txn.id),
    ).toThrow(/append-only/);
    expect(() => db().prepare("DELETE FROM sale_tags WHERE txn_id = ?").run(txn.id)).toThrow(
      /append-only/,
    );
    const row = db().prepare("SELECT transcript FROM sale_tags WHERE txn_id = ?").get(txn.id) as {
      transcript: string;
    };
    expect(row.transcript).toBe("do kilo cheeni");
  });

  it("refuses an unmasked payer handle and a full account number", () => {
    expect(() =>
      db()
        .prepare(
          `INSERT INTO transactions (id, merchant_id, amount_inr, at, payer_vpa_masked, settlement_status)
           VALUES ('TXNX', 'm_kirana', 10, '2026-11-15T00:00:00Z', 'victim.fullname@okdemo', 'unsettled')`,
        )
        .run(),
    ).toThrow(/CHECK/);
    expect(() =>
      db().prepare("UPDATE merchants SET account_last4 = '123456789012' WHERE id = 'm_kirana'").run(),
    ).toThrow(/CHECK/);
  });

  it("keeps bill content fixed and lets a bill leave 'open' only once", () => {
    const bill = createBill(826, "do kilo cheeni");
    expect(() => db().prepare("UPDATE bills SET amount_inr = 1 WHERE id = ?").run(bill.id)).toThrow(
      /cannot be changed/,
    );
    db().prepare("UPDATE bills SET status = 'cancelled' WHERE id = ?").run(bill.id);
    expect(() => db().prepare("UPDATE bills SET status = 'open' WHERE id = ?").run(bill.id)).toThrow(
      /only an open bill/,
    );
  });

  it("store() is a read-only view", () => {
    const view = store();
    expect(() => {
      (view as { epoch: number }).epoch = 99;
    }).toThrow();
    expect(() => {
      (view.merchants[0] as { language: string }).language = "en-IN";
    }).toThrow();
  });

  it("reset drops everything added and reseeds, tags included", () => {
    const txn = recordPayment(826, "victim@okdemo");
    recordSaleTag({ txnId: txn.id, transcript: "ek tel", items: [], source: "voice" });
    const before = store();
    resetStore();
    const after = store();
    expect(after.epoch).toBe(before.epoch + 1);
    expect(after.transactions.map((t) => t.id)).toEqual(["TXN1001", "TXN1002", "TXN1003"]);
    expect(after.saleTags.map((t) => t.txnId)).toEqual(["TXN1001", "TXN1003"]);
    expect(after.clockOffsetMs).toBe(0);
    expect(recordPayment(100, "a@b").id).toBe("TXN2001");
  });

  it("a stored tag reads back frozen with its fields", () => {
    const txn = recordPayment(826, "victim@okdemo");
    const tag = recordSaleTag({
      txnId: txn.id,
      transcript: "do kilo cheeni",
      items: [{ name: "cheeni", quantity: 2, unit: "kilo" }],
      source: "voice",
      boundBy: "tap",
    });
    expect(Object.isFrozen(tag)).toBe(true);
    expect(tag).toMatchObject({ txnId: txn.id, source: "voice", boundBy: "tap" });
    expect(tag.items).toEqual([{ name: "cheeni", quantity: 2, unit: "kilo" }]);
    expect("billId" in tag).toBe(false);
  });
});

describe("bill-first payments (#15)", () => {
  it("paying a bill binds its text as the tag, bound by 'bill'", async () => {
    const bill = await call<Bill>({ action: "bill-create", amountInr: 826, text: "do kilo cheeni, ek tel" });
    const paid = await call<{ txn: Transaction; bill: Bill; tag: SaleTag; needsTag: boolean }>({
      action: "pay",
      billId: bill.id,
      role: "customer",
    });
    expect(paid.needsTag).toBe(false);
    expect(paid.tag).toMatchObject({ txnId: paid.txn.id, source: "bill", boundBy: "bill", billId: bill.id });
    expect(paid.bill).toMatchObject({ status: "paid", txnId: paid.txn.id });
    expect(getTransaction(paid.txn.id).billId).toBe(bill.id);
  });

  it("refuses a paid bill, a cancelled bill and a wrong amount, writing nothing", async () => {
    const bill = await call<Bill>({ action: "bill-create", amountInr: 826, text: "ek tel" });
    const txnsBefore = count("transactions");
    await expect(handle({ action: "pay", billId: bill.id, amountInr: 800 })).rejects.toThrow(
      /does not match/,
    );
    expect(count("transactions")).toBe(txnsBefore);

    await handle({ action: "pay", billId: bill.id });
    await expect(handle({ action: "pay", billId: bill.id })).rejects.toThrow(/not open/);

    const other = await call<Bill>({ action: "bill-create", amountInr: 300, text: "namak" });
    await handle({ action: "bill-cancel", billId: other.id });
    await expect(handle({ action: "pay", billId: other.id })).rejects.toThrow(/not open/);
    await expect(handle({ action: "bill-cancel", billId: other.id })).rejects.toThrow(/only an open bill/);
    expect(count("transactions")).toBe(txnsBefore + 1);
  });

  it("refuses to pay or cancel another merchant's bill", async () => {
    const bill = await call<Bill>({ action: "bill-create", amountInr: 826, text: "ek tel" });
    await handle({ action: "merchant", merchantId: "m_mule" });
    await expect(handle({ action: "pay", billId: bill.id })).rejects.toThrow(/another merchant/);
    await expect(handle({ action: "bill-cancel", billId: bill.id })).rejects.toThrow(/another merchant/);
  });

  it("bill-lookup shows the customer only id, amount, status and shop name", async () => {
    const bill = await call<Bill>({ action: "bill-create", amountInr: 826, text: "do kilo cheeni" });
    const seen = await call<Record<string, unknown>>({ action: "bill-lookup", billId: bill.id, role: "customer" });
    expect(Object.keys(seen).sort()).toEqual(["amountInr", "id", "shopName", "status"]);
    expect(seen).toEqual({ id: bill.id, amountInr: 826, status: "open", shopName: "Sharma Kirana Store" });
  });
});

describe("tag-auto binds only when unambiguous (#15, #19)", () => {
  const pay = async (amountInr: number) =>
    (await call<{ txn: Transaction }>({ action: "pay", amountInr })).txn;
  type AutoResult =
    | { outcome: "bound"; txnId: string; method: string }
    | { outcome: "ambiguous"; candidates: { id: string }[] }
    | { outcome: "none_open" };

  it("reports none_open when nothing waits for a tag", async () => {
    expect(await call<AutoResult>({ action: "tag-auto", transcript: "ek tel" })).toEqual({ outcome: "none_open" });
  });

  it("binds the only open payment", async () => {
    const txn = await pay(826);
    expect(await call<AutoResult>({ action: "tag-auto", transcript: "ek tel" })).toEqual({
      outcome: "bound",
      txnId: txn.id,
      method: "only_open",
    });
    expect(store().saleTags.find((t) => t.txnId === txn.id)?.boundBy).toBe("only_open");
  });

  it("binds by spoken amount when exactly one open payment matches", async () => {
    await pay(560);
    const target = await pay(826);
    expect(await call<AutoResult>({ action: "tag-auto", transcript: "826, do kilo cheeni" })).toEqual({
      outcome: "bound",
      txnId: target.id,
      method: "amount",
    });
  });

  it("returns ambiguous and writes no tag when it cannot tell", async () => {
    await pay(826);
    await pay(826);
    const tagsBefore = count("sale_tags");
    const out = await call<AutoResult>({ action: "tag-auto", transcript: "826, ek tel" });
    expect(out.outcome).toBe("ambiguous");
    if (out.outcome === "ambiguous") expect(out.candidates).toHaveLength(2);
    expect(count("sale_tags")).toBe(tagsBefore);
  });
});

describe("merchant settings", () => {
  it("stores the Soundbox language in the database", async () => {
    await handle({ action: "settings", language: "ta-IN" });
    expect(activeMerchant().language).toBe("ta-IN");
    const state = (await handle({ action: "state" })).state as { settings: { language: string } };
    expect(state.settings.language).toBe("ta-IN");
  });

  it("rejects an unknown language", async () => {
    await expect(handle({ action: "settings", language: "xx-XX" })).rejects.toThrow(/unsupported language/);
    expect(() => setMerchantLanguage("m_kirana", "klingon")).toThrow(/unsupported language/);
    expect(activeMerchant().language).toBe("hi-IN");
  });
});
