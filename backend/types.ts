export type Merchant = {
  id: string;
  shopName: string;
  ownerName: string;
  city: string;
  language: "hi-IN";
  bankName: string;
  /** Only the last four digits are ever stored. */
  accountLast4: string;
  /** Number of earlier fraud reports naming this account. */
  priorReports: number;
};

export type Settlement =
  | { status: "unsettled" }
  | { status: "settled"; settledAt: string; utr: string };

export type Transaction = {
  id: string;
  merchantId: string;
  amountInr: number;
  at: string;
  /** Always stored masked. */
  payerVpaMasked: string;
  settlement: Settlement;
};

export type SaleItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

export type SaleTag = {
  txnId: string;
  recordedAt: string;
  /** Exactly what the merchant said. */
  transcript: string;
  items: SaleItem[];
  source: "voice" | "recorded_clip";
};

export type HoldType = "police" | "bank";

/**
 * How far the restriction reaches.
 * - "lien": only the reported amount is blocked; the rest of the balance is usable.
 * - "debit_freeze": nothing can be withdrawn from the account, even though the
 *   report concerns one payment. This happens in practice; the merchant can ask
 *   for it to be narrowed to a lien on the reported amount.
 */
export type HoldScope = "lien" | "debit_freeze";

/**
 * A victim's complaint on 1930 / NCRP naming one payment. Seen only by the
 * bank console. The merchant learns nothing until a hold is actually placed.
 */
export type FraudReport = {
  id: string;
  txnId: string;
  /** Acknowledgement number the victim receives (synthetic). */
  ackNo: string;
  reportedAt: string;
  amountInr: number;
};

export type Hold = {
  id: string;
  txnId: string;
  type: HoldType;
  scope: HoldScope;
  /** The amount the complaint concerns. */
  heldAmountInr: number;
  placedAt: string;
  reference: string;
};

export type Grievance = {
  holdId: string;
  /** Set when the merchant confirms they filed it themselves. */
  filedAt: string;
  escalationDraftedAt?: string;
};

export type MuleScreenAnswers = {
  lentAccount: boolean;
  receivedForCommission: boolean;
};

export type Eligibility =
  | { outcome: "eligible" }
  | { outcome: "legal_aid"; reason: string }
  | { outcome: "no_certificate"; reason: string };

export type TrackerStage = "not_filed" | "awaiting_reply" | "escalation_due";

export type TrackerStatus = {
  stage: TrackerStage;
  daysSinceFiled: number | null;
  escalateAfterDays: number;
};
