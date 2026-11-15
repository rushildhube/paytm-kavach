import { parseSaleItems } from "@voice/parser";
import { nextCounter, run, tx } from "./db/connection";
import { rows } from "./db/rows";
import { LedgerError } from "./ledger";
import { activeMerchant, now } from "./store";
import type { Bill } from "./types";

/**
 * Bill-first tagging (issue #15). The merchant makes a bill for an amount
 * before the buyer pays; the bill's QR carries its id, and the payment is
 * bound to the bill by id. The bill content becomes the sale tag at payment
 * time, so no voice tag (and no 2-minute window) is needed for that payment.
 *
 * Stored in the `bills` table. Triggers keep the content fixed and let the
 * status move only once, out of "open".
 */
export function createBill(amountInr: number, text: string): Bill {
  if (!Number.isFinite(amountInr) || amountInr <= 0 || amountInr > 1_00_000) {
    throw new LedgerError("bill amount must be between ₹1 and ₹1,00,000");
  }
  const clean = text.trim().slice(0, 300);
  return tx(() => {
    const bill: Bill = {
      id: `BILL-${String(nextCounter("next_bill")).padStart(4, "0")}`,
      merchantId: activeMerchant().id,
      amountInr: Math.round(amountInr * 100) / 100,
      text: clean,
      items: clean ? parseSaleItems(clean) : [],
      createdAt: now().toISOString(),
      status: "open",
      txnId: null,
    };
    run(
      `INSERT INTO bills (id, merchant_id, amount_inr, text, items, created_at, status, txn_id)
       VALUES (?, ?, ?, ?, ?, ?, 'open', NULL)`,
      bill.id,
      bill.merchantId,
      bill.amountInr,
      bill.text,
      JSON.stringify(bill.items),
      bill.createdAt,
    );
    return bill;
  });
}

export function getBill(id: string): Bill {
  const bill = rows.bill(id);
  if (!bill) throw new LedgerError("unknown bill");
  return bill;
}

/** Only the merchant who made a bill may cancel it, and only while it is open. */
export function cancelBill(id: string): Bill {
  return tx(() => {
    const bill = getBill(id);
    if (bill.merchantId !== activeMerchant().id) {
      throw new LedgerError("this bill belongs to another merchant");
    }
    const { changes } = run(
      "UPDATE bills SET status = 'cancelled' WHERE id = ? AND status = 'open'",
      id,
    );
    if (changes !== 1) throw new LedgerError("only an open bill can be cancelled");
    return getBill(id);
  });
}

/** Called by the payment path. Refuses a paid/cancelled bill or a wrong amount. */
export function settleBill(id: string, amountInr: number, txnId: string): Bill {
  return tx(() => {
    const bill = getBill(id);
    if (bill.status !== "open") throw new LedgerError("this bill is not open");
    if (Math.abs(bill.amountInr - amountInr) > 0.001) {
      throw new LedgerError("amount does not match the bill");
    }
    const { changes } = run(
      "UPDATE bills SET status = 'paid', txn_id = ? WHERE id = ? AND status = 'open'",
      txnId,
      id,
    );
    if (changes !== 1) throw new LedgerError("this bill is not open");
    return getBill(id);
  });
}

/** The active merchant's bills, newest first. */
export function merchantBills(): Bill[] {
  return rows
    .bills(activeMerchant().id)
    .reverse()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
