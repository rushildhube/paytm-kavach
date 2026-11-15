import type { VoiceLanguage } from "@voice/languages";

export type { VoiceLanguage };

export type Merchant = {
  id: string;
  shopName: string;
  ownerName: string;
  city: string;
  /** Language the Soundbox speaks and listens in. Set by the merchant (`settings` action). */
  language: VoiceLanguage;
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
  /** Set when the buyer paid a bill's QR. The bill existed before the payment. */
  billId?: string | null;
};

/**
 * A bill the merchant makes before the customer pays (bill-first, issue #15
 * option D). Its QR carries the bill id, so the payment is bound to it by id,
 * not by timing. Content is fixed once created; only `status`/`txnId` change.
 */
export type Bill = {
  id: string;
  merchantId: string;
  amountInr: number;
  /** What the merchant typed or said for the bill, as given. */
  text: string;
  items: SaleItem[];
  createdAt: string;
  status: "open" | "paid" | "cancelled";
  txnId: string | null;
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
  source: "voice" | "recorded_clip" | "bill";
  /**
   * How the tag was tied to its payment, shown on the certificate so a reader
   * can judge its weight (docs/problem.md, issue #19):
   * - "bill": the payment was made against a bill created before it
   * - "tap": the merchant picked the payment
   * - "only_open": only one payment was waiting for a tag
   * - "amount" / "amount_and_name": the spoken amount (and name) matched exactly one open payment
   */
  boundBy?: "bill" | "tap" | "only_open" | "amount" | "amount_and_name";
  billId?: string;
};

/**
 * An invoice file the merchant attached at payment time, instead of or as well
 * as speaking. Only its SHA-256 fingerprint is kept: the merchant's own copy
 * can later be checked against it, and no buyer details are stored.
 */
/** Why one stored column of buyer-related data is held, and for how long (issue #25). */
export type DataPurpose = {
  table: string;
  column: string;
  data: string;
  purpose: string;
  minimised: string;
  retention: string;
};

export type Invoice = {
  txnId: string;
  attachedAt: string;
  sha256: string;
  kind: "pdf" | "jpeg" | "png" | "webp";
  sizeBytes: number;
  /** The total the merchant entered; equal to the payment when present. */
  totalInr: number | null;
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

/**
 * The mule-screen result for one hold. Written once; later answers cannot
 * change it. Kept apart from the hold so the bank console never sees it.
 */
export type Screening = {
  holdId: string;
  answers: MuleScreenAnswers;
  eligibility: Eligibility;
  at: string;
};

export type TrackerStage = "not_filed" | "awaiting_reply" | "escalation_due";

export type TrackerStatus = {
  stage: TrackerStage;
  daysSinceFiled: number | null;
  escalateAfterDays: number;
  /** Index into the ladder steps of who should hold the grievance now; null before filing. */
  currentStep: number | null;
};
