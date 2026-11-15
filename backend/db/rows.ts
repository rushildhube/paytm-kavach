import type {
  Bill,
  DataPurpose,
  FraudReport,
  Grievance,
  Hold,
  Invoice,
  Merchant,
  SaleTag,
  Screening,
  Transaction,
} from "../types";
import { all, one } from "./connection";

/** Row shapes and the mappers that turn them back into the app's types. */

type MerchantRow = {
  id: string;
  shop_name: string;
  owner_name: string;
  city: string;
  language: string;
  bank_name: string;
  account_last4: string;
  prior_reports: number;
};
type TxnRow = {
  id: string;
  merchant_id: string;
  amount_inr: number;
  at: string;
  payer_vpa_masked: string;
  settlement_status: "settled" | "unsettled";
  settled_at: string | null;
  utr: string | null;
  bill_id: string | null;
};
type TagRow = {
  txn_id: string;
  recorded_at: string;
  transcript: string;
  items: string;
  source: SaleTag["source"];
  bound_by: SaleTag["boundBy"] | null;
  bill_id: string | null;
  buyer_approved: number;
};
type BillRow = {
  id: string;
  merchant_id: string;
  amount_inr: number;
  text: string;
  items: string;
  created_at: string;
  status: Bill["status"];
  txn_id: string | null;
};
type ReportRow = { id: string; txn_id: string; ack_no: string; reported_at: string; amount_inr: number };
type HoldRow = {
  id: string;
  txn_id: string;
  type: Hold["type"];
  scope: Hold["scope"];
  held_amount_inr: number;
  placed_at: string;
  reference: string;
};
type ScreeningRow = { hold_id: string; answers: string; eligibility: string; at: string };
type InvoiceRow = {
  txn_id: string;
  attached_at: string;
  sha256: string;
  kind: Invoice["kind"];
  size_bytes: number;
  total_inr: number | null;
};
type GrievanceRow = { hold_id: string; filed_at: string; escalation_drafted_at: string | null };

const toMerchant = (r: MerchantRow): Merchant =>
  Object.freeze({
    id: r.id,
    shopName: r.shop_name,
    ownerName: r.owner_name,
    city: r.city,
    language: r.language as Merchant["language"],
    bankName: r.bank_name,
    accountLast4: r.account_last4,
    priorReports: r.prior_reports,
  });

const toTxn = (r: TxnRow): Transaction =>
  Object.freeze({
    id: r.id,
    merchantId: r.merchant_id,
    amountInr: r.amount_inr,
    at: r.at,
    payerVpaMasked: r.payer_vpa_masked,
    settlement:
      r.settlement_status === "settled"
        ? { status: "settled" as const, settledAt: r.settled_at ?? "", utr: r.utr ?? "" }
        : { status: "unsettled" as const },
    billId: r.bill_id,
  });

/** Tags come back frozen: the record is append-only in code as in SQL. */
const toTag = (r: TagRow): SaleTag =>
  Object.freeze({
    txnId: r.txn_id,
    recordedAt: r.recorded_at,
    transcript: r.transcript,
    items: JSON.parse(r.items) as SaleTag["items"],
    source: r.source,
    ...(r.bound_by ? { boundBy: r.bound_by } : {}),
    ...(r.bill_id ? { billId: r.bill_id } : {}),
    ...(r.buyer_approved ? { buyerApproved: true as const } : {}),
  });

const toBill = (r: BillRow): Bill =>
  Object.freeze({
    id: r.id,
    merchantId: r.merchant_id,
    amountInr: r.amount_inr,
    text: r.text,
    items: JSON.parse(r.items) as Bill["items"],
    createdAt: r.created_at,
    status: r.status,
    txnId: r.txn_id,
  });

const toReport = (r: ReportRow): FraudReport =>
  Object.freeze({
    id: r.id,
    txnId: r.txn_id,
    ackNo: r.ack_no,
    reportedAt: r.reported_at,
    amountInr: r.amount_inr,
  });

const toHold = (r: HoldRow): Hold =>
  Object.freeze({
    id: r.id,
    txnId: r.txn_id,
    type: r.type,
    scope: r.scope,
    heldAmountInr: r.held_amount_inr,
    placedAt: r.placed_at,
    reference: r.reference,
  });

const toScreening = (r: ScreeningRow): Screening =>
  Object.freeze({
    holdId: r.hold_id,
    answers: JSON.parse(r.answers) as Screening["answers"],
    eligibility: JSON.parse(r.eligibility) as Screening["eligibility"],
    at: r.at,
  });

const toGrievance = (r: GrievanceRow): Grievance =>
  Object.freeze({
    holdId: r.hold_id,
    filedAt: r.filed_at,
    ...(r.escalation_drafted_at ? { escalationDraftedAt: r.escalation_drafted_at } : {}),
  });

const toInvoice = (r: InvoiceRow): Invoice =>
  Object.freeze({
    txnId: r.txn_id,
    attachedAt: r.attached_at,
    sha256: r.sha256,
    kind: r.kind,
    sizeBytes: r.size_bytes,
    totalInr: r.total_inr,
  });

// Every list is ordered by insertion (rowid), as the old in-memory arrays were.

export const rows = {
  merchants: () => all<MerchantRow>("SELECT * FROM merchants ORDER BY rowid").map(toMerchant),
  merchant: (id: string) => {
    const r = one<MerchantRow>("SELECT * FROM merchants WHERE id = ?", id);
    return r ? toMerchant(r) : undefined;
  },

  transactions: (merchantId?: string) =>
    (merchantId
      ? all<TxnRow>("SELECT * FROM transactions WHERE merchant_id = ? ORDER BY rowid", merchantId)
      : all<TxnRow>("SELECT * FROM transactions ORDER BY rowid")
    ).map(toTxn),
  transaction: (id: string) => {
    const r = one<TxnRow>("SELECT * FROM transactions WHERE id = ?", id);
    return r ? toTxn(r) : undefined;
  },

  saleTags: () => all<TagRow>("SELECT * FROM sale_tags ORDER BY rowid").map(toTag),
  saleTag: (txnId: string) => {
    const r = one<TagRow>("SELECT * FROM sale_tags WHERE txn_id = ?", txnId);
    return r ? toTag(r) : undefined;
  },

  dataPurposes: (): DataPurpose[] =>
    all<{ table_name: string; column_name: string; data: string; purpose: string; minimised: string; retention: string }>(
      "SELECT * FROM data_purposes ORDER BY rowid",
    ).map((r) =>
      Object.freeze({
        table: r.table_name,
        column: r.column_name,
        data: r.data,
        purpose: r.purpose,
        minimised: r.minimised,
        retention: r.retention,
      }),
    ),

  invoice: (txnId: string) => {
    const r = one<InvoiceRow>("SELECT * FROM invoices WHERE txn_id = ?", txnId);
    return r ? toInvoice(r) : undefined;
  },

  bills: (merchantId?: string) =>
    (merchantId
      ? all<BillRow>("SELECT * FROM bills WHERE merchant_id = ? ORDER BY rowid", merchantId)
      : all<BillRow>("SELECT * FROM bills ORDER BY rowid")
    ).map(toBill),
  bill: (id: string) => {
    const r = one<BillRow>("SELECT * FROM bills WHERE id = ?", id);
    return r ? toBill(r) : undefined;
  },

  reports: () => all<ReportRow>("SELECT * FROM reports ORDER BY rowid").map(toReport),
  reportForTxn: (txnId: string) => {
    const r = one<ReportRow>("SELECT * FROM reports WHERE txn_id = ?", txnId);
    return r ? toReport(r) : undefined;
  },

  holds: () => all<HoldRow>("SELECT * FROM holds ORDER BY rowid").map(toHold),
  hold: (id: string) => {
    const r = one<HoldRow>("SELECT * FROM holds WHERE id = ?", id);
    return r ? toHold(r) : undefined;
  },
  holdForTxn: (txnId: string) => {
    const r = one<HoldRow>("SELECT * FROM holds WHERE txn_id = ?", txnId);
    return r ? toHold(r) : undefined;
  },
  /** The newest hold on any of this merchant's payments. */
  latestHoldFor: (merchantId: string) => {
    const r = one<HoldRow>(
      `SELECT h.* FROM holds h JOIN transactions t ON t.id = h.txn_id
       WHERE t.merchant_id = ? ORDER BY h.rowid DESC LIMIT 1`,
      merchantId,
    );
    return r ? toHold(r) : null;
  },

  screenings: () => all<ScreeningRow>("SELECT * FROM screenings ORDER BY rowid").map(toScreening),
  screening: (holdId: string) => {
    const r = one<ScreeningRow>("SELECT * FROM screenings WHERE hold_id = ?", holdId);
    return r ? toScreening(r) : undefined;
  },

  grievances: () => all<GrievanceRow>("SELECT * FROM grievances ORDER BY rowid").map(toGrievance),
  grievance: (holdId: string) => {
    const r = one<GrievanceRow>("SELECT * FROM grievances WHERE hold_id = ?", holdId);
    return r ? toGrievance(r) : undefined;
  },
};
