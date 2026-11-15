import { TAG_THRESHOLD_INR, TAG_WINDOW_SECONDS } from "./config";
import { maskVpa } from "./mask";
import { activeMerchant, now, store } from "./store";
import type { SaleItem, SaleTag, Transaction } from "./types";

export class LedgerError extends Error {}

export function needsTag(amountInr: number): boolean {
  return amountInr >= TAG_THRESHOLD_INR;
}

/** A payment arrives (simulated Paytm payment event). */
export function recordPayment(
  amountInr: number,
  payerVpa: string,
  billId: string | null = null,
): Transaction {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    throw new LedgerError("amount must be positive");
  }
  const s = store();
  const txn: Transaction = {
    id: `TXN${s.nextTxn++}`,
    merchantId: activeMerchant().id,
    amountInr,
    at: now().toISOString(),
    payerVpaMasked: maskVpa(payerVpa),
    settlement: { status: "unsettled" },
    billId,
  };
  s.transactions.push(txn);
  return txn;
}

export function getTransaction(txnId: string): Transaction {
  const txn = store().transactions.find((t) => t.id === txnId);
  if (!txn) throw new LedgerError("unknown transaction");
  return txn;
}

export function getSaleTag(txnId: string): SaleTag | undefined {
  return store().saleTags.find((t) => t.txnId === txnId);
}

/**
 * Append a proof-of-sale tag. The only write path for sale tags.
 * A tag can be written once, and only within the short window after the
 * payment, so proof cannot be manufactured after a hold appears.
 */
export function recordSaleTag(input: {
  txnId: string;
  transcript: string;
  items: SaleItem[];
  source: SaleTag["source"];
  binding?: SaleTag["binding"];
  billId?: string;
}): SaleTag {
  const txn = getTransaction(input.txnId);
  const transcript = input.transcript.trim();
  if (!transcript) throw new LedgerError("nothing was said");
  if (getSaleTag(txn.id)) {
    throw new LedgerError("this sale is already tagged and cannot be changed");
  }
  if (store().holds.some((h) => h.txnId === txn.id)) {
    throw new LedgerError("a sale cannot be tagged after a hold is placed");
  }
  const at = now();
  const elapsed = (at.getTime() - Date.parse(txn.at)) / 1000;
  if (elapsed > TAG_WINDOW_SECONDS) {
    throw new LedgerError(
      "the tagging window has closed; a sale can only be tagged at payment time",
    );
  }
  const tag: SaleTag = Object.freeze({
    txnId: txn.id,
    recordedAt: at.toISOString(),
    transcript,
    items: input.items,
    source: input.source,
    ...(input.binding ? { binding: input.binding } : {}),
    ...(input.billId ? { billId: input.billId } : {}),
  });
  store().saleTags.push(tag);
  return tag;
}
