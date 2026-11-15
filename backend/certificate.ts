import { DISCLAIMER } from "./config";
import { getHold } from "./holds";
import { getSaleTag, getTransaction } from "./ledger";
import { getMerchant } from "./store";
import type { Hold, SaleItem, SaleTag } from "./types";

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
    source: SaleTag["source"];
    /** How the tag was tied to this payment; absent on older records. */
    boundBy: SaleTag["boundBy"] | null;
    billId: string | null;
  } | null;
  hold: Pick<Hold, "reference" | "type" | "scope" | "heldAmountInr" | "placedAt">;
  provenance: string[];
  disclaimer: string;
};

/** How the description was tied to this payment, so a reader can judge its weight (#15, #19). */
const BOUND_BY_LINE: Record<NonNullable<SaleTag["boundBy"]>, string> = {
  bill: "The description is the bill the merchant created before the payment; the buyer paid that bill's QR.",
  tap: "The merchant picked this payment on the Soundbox when recording the description.",
  only_open: "This was the only payment waiting for a description when it was recorded.",
  amount: "The amount the merchant said matched this payment and no other open payment.",
  amount_and_name: "The amount and payer name the merchant said matched this payment and no other open payment.",
};

/** Pure assembly from records. No model involved. */
export function buildCertificate(holdId: string, generatedAt: Date): SaleCertificate {
  const hold = getHold(holdId);
  const txn = getTransaction(hold.txnId);
  const merchant = getMerchant(txn.merchantId);
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
          source: tag.source,
          boundBy: tag.boundBy ?? null,
          billId: tag.billId ?? null,
        }
      : null,
    hold: {
      reference: hold.reference,
      type: hold.type,
      scope: hold.scope,
      heldAmountInr: hold.heldAmountInr,
      placedAt: hold.placedAt,
    },
    provenance: [
      "Transaction and settlement fields come from the payment company's own records.",
      tag
        ? "The sale description is the merchant's own statement, recorded at payment time and before any hold. It cannot be added or edited later."
        : "No sale description was recorded at payment time for this payment.",
      ...(tag?.boundBy ? [BOUND_BY_LINE[tag.boundBy]] : []),
    ],
    disclaimer: DISCLAIMER,
  };
}
