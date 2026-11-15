import { parseSaleItems } from "@voice/parser";
import { nextCounter, one, run, tx } from "./db/connection";
import { rows } from "./db/rows";
import { LedgerError } from "./ledger";
import { activeMerchant, now } from "./store";
import type { Bill, SaleItem } from "./types";

/**
 * Bill-first tagging (issue #15). The merchant makes a bill for an amount
 * before the buyer pays; the bill's QR carries its id, and the payment is
 * bound to the bill by id. The bill content becomes the sale tag at payment
 * time, so no voice tag (and no 2-minute window) is needed for that payment.
 *
 * Stored in the `bills` table. Triggers keep the content fixed and let the
 * status move only once, out of "open".
 */
/** Highest amount one bill may carry. The API schema uses the same cap. */
export const MAX_BILL_INR = 1_00_000;

/** Bill ids travel in the UPI QR's `tr` field; frontend/upi.ts accepts only this shape. */
export const BILL_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export function createBill(amountInr: number, text: string): Bill {
  if (!Number.isFinite(amountInr) || amountInr <= 0 || amountInr > MAX_BILL_INR) {
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

/** Only the merchant who made a bill may cancel it, and only while it is open. */
export function cancelBill(id: string): Bill {
  return tx(() => {
    ownBill(id);
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
    const bill = ownBill(id);
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

/**
 * The bill the counter Soundbox is showing (issue #31). "qr": its screen
 * swaps the shop QR for this bill's QR. "voice": it also says "please pay ₹X
 * for …" once. The buyer then pays through the normal `pay {billId}` path, so
 * binding is unchanged. Only a pointer is stored (in `meta`); the request is
 * worked out on every read, so paying or cancelling the bill clears it.
 */
export type SoundboxRequest = {
  billId: string;
  amountInr: number;
  text: string;
  items: SaleItem[];
  mode: "qr" | "voice";
  /** Changes on every send, so the box speaks a request once per send. */
  nonce: string;
};

let sends = 0;
const requestKey = (merchantId: string) => `soundbox_request:${merchantId}`;

export function sendBillToSoundbox(billId: string, mode: SoundboxRequest["mode"]): SoundboxRequest {
  return tx(() => {
    const bill = ownBill(billId);
    if (bill.status !== "open") throw new LedgerError("only an open bill can be sent to the Soundbox");
    const value = JSON.stringify({ billId: bill.id, mode, nonce: `${bill.id}:${Date.now()}:${++sends}` });
    run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", requestKey(bill.merchantId), value);
    const request = soundboxRequest();
    if (!request) throw new Error("soundbox request was not stored");
    return request;
  });
}

/** Back to the shop QR. */
export function clearSoundbox(): void {
  run("DELETE FROM meta WHERE key = ?", requestKey(activeMerchant().id));
}

/** The active merchant's open bill on the Soundbox, or null. */
export function soundboxRequest(): SoundboxRequest | null {
  const merchantId = activeMerchant().id;
  const row = one<{ value: string }>("SELECT value FROM meta WHERE key = ?", requestKey(merchantId));
  if (!row) return null;
  let ptr: { billId?: unknown; mode?: unknown; nonce?: unknown };
  try {
    ptr = JSON.parse(row.value);
  } catch {
    return null;
  }
  if (typeof ptr.billId !== "string") return null;
  const bill = rows.bill(ptr.billId);
  if (!bill || bill.status !== "open" || bill.merchantId !== merchantId) return null;
  return {
    billId: bill.id,
    amountInr: bill.amountInr,
    text: bill.text,
    items: bill.items,
    mode: ptr.mode === "voice" ? "voice" : "qr",
    nonce: typeof ptr.nonce === "string" ? ptr.nonce : bill.id,
  };
}
