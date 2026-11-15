import { REPEAT_REPORT_LIMIT } from "./config";
import { getTransaction } from "./ledger";
import { escalateAfterDays, ladderStepOn } from "./rules";
import { nextCounter, run, tx } from "./db/connection";
import { rows } from "./db/rows";
import { getMerchant, now } from "./store";
import type {
  Eligibility,
  FraudReport,
  Grievance,
  Hold,
  HoldScope,
  HoldType,
  Merchant,
  MuleScreenAnswers,
  Screening,
  TrackerStatus,
} from "./types";

/**
 * The victim reports the payment on 1930 / NCRP (simulated). This is a
 * bank-side event only: it must never reach the merchant before a hold
 * exists (no tipping off).
 */
export function reportFraud(txnId: string): FraudReport {
  return tx(() => {
    const txn = getTransaction(txnId);
    const existing = rows.reportForTxn(txnId);
    if (existing) return existing;
    const n = nextCounter("next_report");
    const report: FraudReport = {
      id: `RPT${n}`,
      txnId,
      ackNo: `DEMO-NCRP-${String(31_500_000 + n)}`,
      reportedAt: now().toISOString(),
      amountInr: txn.amountInr,
    };
    run(
      "INSERT INTO reports (id, txn_id, ack_no, reported_at, amount_inr) VALUES (?, ?, ?, ?, ?)",
      report.id,
      report.txnId,
      report.ackNo,
      report.reportedAt,
      report.amountInr,
    );
    return report;
  });
}

/** Bank side only: every fraud report, oldest first. */
export function listReports(): FraudReport[] {
  return rows.reports();
}

/** The hold on this payment, if any. */
export function holdForTransaction(txnId: string): Hold | null {
  return rows.holdForTxn(txnId) ?? null;
}

/** The newest hold on one of this merchant's payments, never another merchant's. */
export function latestHoldFor(merchantId: string): Hold | null {
  return rows.latestHoldFor(merchantId);
}

/**
 * The bank acts on a report (simulated). The complaint always concerns only
 * the reported payment's amount; `scope` records whether the bank blocked just
 * that amount (lien) or stopped all withdrawals from the account.
 */
export function placeHold(
  txnId: string,
  type: HoldType = "police",
  scope: HoldScope = "lien",
): Hold {
  return tx(() => {
    const txn = getTransaction(txnId);
    if (rows.holdForTxn(txnId)) {
      throw new Error("this payment already has a hold");
    }
    const report = rows.reportForTxn(txnId);
    const n = nextCounter("next_hold");
    const hold: Hold = {
      id: `HOLD${n}`,
      txnId,
      type,
      scope,
      heldAmountInr: txn.amountInr,
      placedAt: now().toISOString(),
      reference: report?.ackNo ?? `DEMO-ACK-${String(n).padStart(6, "0")}`,
    };
    run(
      `INSERT INTO holds (id, txn_id, type, scope, held_amount_inr, placed_at, reference)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      hold.id,
      hold.txnId,
      hold.type,
      hold.scope,
      hold.heldAmountInr,
      hold.placedAt,
      hold.reference,
    );
    return hold;
  });
}

export function getHold(holdId: string): Hold {
  const hold = rows.hold(holdId);
  if (!hold) throw new Error("unknown hold");
  return hold;
}

/**
 * Hard rules, decided in code and never by the model.
 * Repeatedly reported accounts get no certificate; anyone who lent out
 * their account is sent to legal aid instead of getting a letter.
 */
export function checkEligibility(
  merchant: Merchant,
  answers: MuleScreenAnswers,
): Eligibility {
  if (merchant.priorReports >= REPEAT_REPORT_LIMIT) {
    return {
      outcome: "no_certificate",
      reason:
        "This account has been reported several times before, so Kavach cannot issue a sale certificate for it.",
    };
  }
  if (answers.lentAccount || answers.receivedForCommission) {
    return {
      outcome: "legal_aid",
      reason:
        "You said someone else used this account or you received money on someone's behalf. That needs a lawyer, not a letter.",
    };
  }
  return { outcome: "eligible" };
}

/** The merchant whose payment is held: always taken from the payment, never from the screen. */
export function merchantOfHold(holdId: string): Merchant {
  return getMerchant(getTransaction(getHold(holdId).txnId).merchantId);
}

/**
 * Run the mule screen for a hold, once. The first result stands: answering
 * again with different answers cannot turn a legal-aid referral into a letter.
 */
export function screenHold(holdId: string, answers: MuleScreenAnswers): Eligibility {
  return tx(() => {
    const existing = rows.screening(holdId);
    if (existing) return existing.eligibility;
    const eligibility = checkEligibility(merchantOfHold(holdId), answers);
    run(
      "INSERT INTO screenings (hold_id, answers, eligibility, at) VALUES (?, ?, ?, ?)",
      holdId,
      JSON.stringify(answers),
      JSON.stringify(eligibility),
      now().toISOString(),
    );
    return eligibility;
  });
}

export function getScreening(holdId: string): Screening | undefined {
  return rows.screening(holdId);
}

/** Letters and the tracker are only for holds that passed the screen. */
export function requireEligible(holdId: string): void {
  const screening = getScreening(holdId);
  if (!screening) throw new Error("answer the two screening questions first");
  if (screening.eligibility.outcome !== "eligible") {
    throw new Error("Kavach cannot prepare letters for this hold");
  }
}

/** The merchant tells Kavach they have filed the grievance themselves. */
export function markFiled(holdId: string): Grievance {
  requireEligible(holdId);
  return tx(() => {
    const existing = rows.grievance(holdId);
    if (existing) return existing;
    const grievance: Grievance = { holdId, filedAt: now().toISOString() };
    run("INSERT INTO grievances (hold_id, filed_at) VALUES (?, ?)", holdId, grievance.filedAt);
    return grievance;
  });
}

export function getGrievance(holdId: string): Grievance | undefined {
  return rows.grievance(holdId);
}

export function trackerStatus(holdId: string): TrackerStatus {
  const limit = escalateAfterDays();
  const grievance = getGrievance(holdId);
  if (!grievance) {
    return { stage: "not_filed", daysSinceFiled: null, escalateAfterDays: limit, currentStep: null };
  }
  const days = Math.floor(
    (now().getTime() - Date.parse(grievance.filedAt)) / 86_400_000,
  );
  return {
    stage: days >= limit ? "escalation_due" : "awaiting_reply",
    daysSinceFiled: days,
    escalateAfterDays: limit,
    currentStep: ladderStepOn(days),
  };
}
