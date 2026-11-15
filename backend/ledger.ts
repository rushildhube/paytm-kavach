import { TAG_THRESHOLD_INR, TAG_WINDOW_SECONDS } from "./config";
import { nextCounter, run, tx } from "./db/connection";
import { rows } from "./db/rows";
import { maskVpa } from "./mask";
import { activeMerchant, now } from "./store";
import type { SaleItem, SaleTag, Transaction } from "./types";

export class LedgerError extends Error {}

export function needsTag(amountInr: number): boolean {
  return amountInr >= TAG_THRESHOLD_INR;
}

/** A payment arrives (simulated Paytm payment event). The payer is masked before it is written. */
export function recordPayment(
  amountInr: number,
  payerVpa: string,
  billId: string | null = null,
): Transaction {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    throw new LedgerError("amount must be positive");
  }
  return tx(() => {
    const txn: Transaction = {
      id: `TXN${nextCounter("next_txn")}`,
      merchantId: activeMerchant().id,
      amountInr,
      at: now().toISOString(),
      payerVpaMasked: maskVpa(payerVpa),
      settlement: { status: "unsettled" },
      billId,
    };
    run(
      `INSERT INTO transactions (id, merchant_id, amount_inr, at, payer_vpa_masked, settlement_status, bill_id)
       VALUES (?, ?, ?, ?, ?, 'unsettled', ?)`,
      txn.id,
      txn.merchantId,
      txn.amountInr,
      txn.at,
      txn.payerVpaMasked,
      billId,
    );
    return txn;
  });
}

export function getTransaction(txnId: string): Transaction {
  const txn = rows.transaction(txnId);
  if (!txn) throw new LedgerError("unknown transaction");
  return txn;
}

/** A merchant's payments in the order they arrived. */
export function listTransactions(merchantId: string): Transaction[] {
  return rows.transactions(merchantId);
}

export function getSaleTag(txnId: string): SaleTag | undefined {
  return rows.saleTag(txnId);
}

/**
 * Append a proof-of-sale tag. The only write path for sale tags.
 * A tag can be written once, and only within the short window after the
 * payment, so proof cannot be manufactured after a hold appears.
 * The database refuses any UPDATE or DELETE on a stored tag.
 */
export function recordSaleTag(input: {
  txnId: string;
  transcript: string;
  items: SaleItem[];
  source: SaleTag["source"];
  boundBy?: SaleTag["boundBy"];
  billId?: string;
  /** Only for a bill tag the buyer's payment screen showed before the PIN. */
  buyerApproved?: boolean;
}): SaleTag {
  return tx(() => {
    const txn = getTransaction(input.txnId);
    const transcript = input.transcript.trim();
    if (!transcript) throw new LedgerError("nothing was said");
    if (getSaleTag(txn.id)) {
      throw new LedgerError("this sale is already tagged and cannot be changed");
    }
    if (rows.holdForTxn(txn.id)) {
      throw new LedgerError("a sale cannot be tagged after a hold is placed");
    }
    const at = now();
    const elapsed = (at.getTime() - Date.parse(txn.at)) / 1000;
    if (elapsed > TAG_WINDOW_SECONDS) {
      throw new LedgerError(
        "the tagging window has closed; a sale can only be tagged at payment time",
      );
    }
    run(
      `INSERT INTO sale_tags (txn_id, recorded_at, transcript, items, source, bound_by, bill_id, buyer_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      txn.id,
      at.toISOString(),
      transcript,
      JSON.stringify(input.items),
      input.source,
      input.boundBy ?? null,
      input.billId ?? null,
      // Approval only means something for a bill the buyer paid.
      input.buyerApproved && input.source === "bill" && input.billId ? 1 : 0,
    );
    const tag = getSaleTag(txn.id);
    if (!tag) throw new Error("sale tag was not stored");
    return tag;
  });
}
