import { DISCLAIMER } from "./config";
import { getHold } from "./holds";
import { getSaleTag, getTransaction } from "./ledger";
import { store } from "./store";
import type { Hold, SaleItem } from "./types";

export type SaleCertificate = {
  certificateId: string;
  generatedAt: string;
  merchant: {
    shopName: string;
    city: string;
    bankName: string;
    accountLast4: string;
  };
  /** From Paytm's transaction and settlement records. */
  transaction: {
    id: string;
    amountInr: number;
    at: string;
    payerVpaMasked: string;
    settlementStatus: "settled" | "unsettled";
    utr: string | null;
  };
  /** The merchant's own words, captured at payment time. Null if untagged. */
  saleTag: {
    recordedAt: string;
    secondsAfterPayment: number;
    transcript: string;
    items: SaleItem[];
  } | null;
  hold: Pick<Hold, "reference" | "type" | "heldAmountInr" | "placedAt">;
  provenance: string[];
  disclaimer: string;
};

/** Pure assembly from records. No model involved. */
export function buildCertificate(holdId: string, generatedAt: Date): SaleCertificate {
  const hold = getHold(holdId);
  const txn = getTransaction(hold.txnId);
  const merchant = store().merchants.find((m) => m.id === txn.merchantId);
  if (!merchant) throw new Error("merchant not found");
  const tag = getSaleTag(txn.id);

  return {
    certificateId: `KVC-${txn.id}`,
    generatedAt: generatedAt.toISOString(),
    merchant: {
      shopName: merchant.shopName,
      city: merchant.city,
      bankName: merchant.bankName,
      accountLast4: merchant.accountLast4,
    },
    transaction: {
      id: txn.id,
      amountInr: txn.amountInr,
      at: txn.at,
      payerVpaMasked: txn.payerVpaMasked,
      settlementStatus: txn.settlement.status,
      utr: txn.settlement.status === "settled" ? txn.settlement.utr : null,
    },
    saleTag: tag
      ? {
          recordedAt: tag.recordedAt,
          secondsAfterPayment: Math.round(
            (Date.parse(tag.recordedAt) - Date.parse(txn.at)) / 1000,
          ),
          transcript: tag.transcript,
          items: tag.items,
        }
      : null,
    hold: {
      reference: hold.reference,
      type: hold.type,
      heldAmountInr: hold.heldAmountInr,
      placedAt: hold.placedAt,
    },
    provenance: [
      "Transaction and settlement fields come from the payment company's own records.",
      tag
        ? "The sale description is the merchant's own statement, recorded at payment time and before any hold. It cannot be added or edited later."
        : "No sale description was recorded at payment time for this payment.",
    ],
    disclaimer: DISCLAIMER,
  };
}
