import { parseSaleItems } from "@voice/parser";
import { LedgerError } from "./ledger";
import { activeMerchant, now, store } from "./store";
import type { Bill } from "./types";

/**
 * Bill-first tagging (issue #15). The merchant makes a bill for an amount
 * before the buyer pays; the bill's QR carries its id, and the payment is
 * bound to the bill by id. The bill content becomes the sale tag at payment
 * time, so no voice tag (and no 2-minute window) is needed for that payment.
 *
 * In-memory for now; the database workstream replaces the storage, not this API.
 */
export function createBill(amountInr: number, text: string): Bill {
  if (!Number.isFinite(amountInr) || amountInr <= 0 || amountInr > 1_00_000) {
    throw new LedgerError("bill amount must be between ₹1 and ₹1,00,000");
  }
  const clean = text.trim().slice(0, 300);
  const s = store();
  const bill: Bill = {
    id: `BILL-${String(s.nextBill++).padStart(4, "0")}`,
    merchantId: activeMerchant().id,
    amountInr: Math.round(amountInr * 100) / 100,
    text: clean,
    items: clean ? parseSaleItems(clean) : [],
    createdAt: now().toISOString(),
    status: "open",
    txnId: null,
  };
  s.bills.push(bill);
  return bill;
}

export function getBill(id: string): Bill {
  const bill = store().bills.find((b) => b.id === id);
  if (!bill) throw new LedgerError("unknown bill");
  return bill;
}

/**
 * A bill the merchant's screen acts on, or that a payment settles, must be that
 * merchant's own. Otherwise one shop's bill text would become the sale tag on
 * another shop's payment: proof for a sale that never happened there.
 */
export function ownBill(id: string): Bill {
  const bill = getBill(id);
  if (bill.merchantId !== activeMerchant().id) {
    throw new LedgerError("this bill belongs to another merchant");
  }
  return bill;
}

export function cancelBill(id: string): Bill {
  const bill = ownBill(id);
  if (bill.status !== "open") throw new LedgerError("only an open bill can be cancelled");
  bill.status = "cancelled";
  return bill;
}

/** Called by the payment path. Refuses a paid/cancelled bill or a wrong amount. */
export function settleBill(id: string, amountInr: number, txnId: string): Bill {
  const bill = ownBill(id);
  if (bill.status !== "open") throw new LedgerError("this bill is not open");
  if (Math.abs(bill.amountInr - amountInr) > 0.001) {
    throw new LedgerError("amount does not match the bill");
  }
  bill.status = "paid";
  bill.txnId = txnId;
  return bill;
}

export function merchantBills(): Bill[] {
  const id = activeMerchant().id;
  return store()
    .bills.filter((b) => b.merchantId === id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
