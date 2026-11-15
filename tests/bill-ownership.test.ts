/**
 * Bills belong to the shop that made them (#19). A bill from one merchant must
 * never become the sale tag on another merchant's payment.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "@backend/api";
import { resetStore, store } from "@backend/store";
import { merchants } from "@data/seed";

process.env.KAVACH_USE_MODEL = "0";

type Bill = { id: string; status: string; txnId: string | null };

async function billFor(merchantId: string, amountInr = 826, text = "do kilo cheeni, ek tel") {
  await handle({ action: "merchant", merchantId });
  return (await handle({ action: "bill-create", amountInr, text })).result as Bill;
}

beforeEach(() => resetStore());

describe("bills are tied to the merchant who made them", () => {
  it("refuses to pay another merchant's bill and leaves no payment or tag behind", async () => {
    const bill = await billFor("m_reported");
    await handle({ action: "merchant", merchantId: "m_kirana" });
    const before = store().transactions.length;
    await expect(handle({ action: "pay", billId: bill.id })).rejects.toThrow(/another merchant/);
    expect(store().transactions.length).toBe(before);
    expect(store().saleTags.some((t) => t.billId === bill.id)).toBe(false);
    expect(store().bills.find((b) => b.id === bill.id)?.status).toBe("open");
  });

  it("still pays the merchant's own bill and tags it from the bill", async () => {
    const bill = await billFor("m_kirana");
    const r = (await handle({ action: "pay", billId: bill.id })).result as {
      txn: { id: string; merchantId: string };
      tag: { boundBy: string; transcript: string } | null;
    };
    expect(r.txn.merchantId).toBe("m_kirana");
    expect(r.tag).toMatchObject({ boundBy: "bill", transcript: "do kilo cheeni, ek tel" });
  });

  it("refuses to cancel another merchant's bill", async () => {
    const bill = await billFor("m_reported");
    await handle({ action: "merchant", merchantId: "m_kirana" });
    await expect(handle({ action: "bill-cancel", billId: bill.id })).rejects.toThrow(/another merchant/);
    expect(store().bills.find((b) => b.id === bill.id)?.status).toBe("open");
  });

  it("bill lookup names the shop that made the bill", async () => {
    const bill = await billFor("m_reported");
    await handle({ action: "merchant", merchantId: "m_kirana" });
    const r = (await handle({ action: "bill-lookup", billId: bill.id, role: "customer" })).result as {
      shopName: string;
    };
    expect(r.shopName).toBe(merchants.find((m) => m.id === "m_reported")!.shopName);
  });

  it("a merchant's snapshot lists only their own bills", async () => {
    await billFor("m_reported");
    await billFor("m_kirana", 560, "ek tel");
    const { state } = await handle({ action: "state" });
    const bills = (state as { bills: { merchantId: string }[] }).bills;
    expect(bills.length).toBe(1);
    expect(bills.every((b) => b.merchantId === "m_kirana")).toBe(true);
  });
});
