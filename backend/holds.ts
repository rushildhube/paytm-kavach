import { REPEAT_REPORT_LIMIT } from "./config";
import { getTransaction } from "./ledger";
import { escalateAfterDays } from "./rules";
import { now, store } from "./store";
import type {
  Eligibility,
  FraudReport,
  Grievance,
  Hold,
  HoldScope,
  HoldType,
  Merchant,
  MuleScreenAnswers,
  TrackerStatus,
} from "./types";

/**
 * The victim reports the payment on 1930 / NCRP (simulated). This is a
 * bank-side event only: it must never reach the merchant before a hold
 * exists (no tipping off).
 */
export function reportFraud(txnId: string): FraudReport {
  const txn = getTransaction(txnId);
  const s = store();
  const existing = s.reports.find((r) => r.txnId === txnId);
  if (existing) return existing;
  const n = s.nextReport++;
  const report: FraudReport = {
    id: `RPT${n}`,
    txnId,
    ackNo: `DEMO-NCRP-${String(31_500_000 + n)}`,
    reportedAt: now().toISOString(),
    amountInr: txn.amountInr,
  };
  s.reports.push(report);
  return report;
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
  const txn = getTransaction(txnId);
  const s = store();
  if (s.holds.some((h) => h.txnId === txnId)) {
    throw new Error("this payment already has a hold");
  }
  const report = s.reports.find((r) => r.txnId === txnId);
  const n = s.nextHold++;
  const hold: Hold = {
    id: `HOLD${n}`,
    txnId,
    type,
    scope,
    heldAmountInr: txn.amountInr,
    placedAt: now().toISOString(),
    reference: report?.ackNo ?? `DEMO-ACK-${String(n).padStart(6, "0")}`,
  };
  s.holds.push(hold);
  return hold;
}

export function getHold(holdId: string): Hold {
  const hold = store().holds.find((h) => h.id === holdId);
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

/** The merchant tells Kavach they have filed the grievance themselves. */
export function markFiled(holdId: string): Grievance {
  getHold(holdId);
  const s = store();
  const existing = s.grievances.find((x) => x.holdId === holdId);
  if (existing) return existing;
  const grievance: Grievance = { holdId, filedAt: now().toISOString() };
  s.grievances.push(grievance);
  return grievance;
}

export function getGrievance(holdId: string): Grievance | undefined {
  return store().grievances.find((x) => x.holdId === holdId);
}

export function trackerStatus(holdId: string): TrackerStatus {
  const limit = escalateAfterDays();
  const grievance = getGrievance(holdId);
  if (!grievance) {
    return { stage: "not_filed", daysSinceFiled: null, escalateAfterDays: limit };
  }
  const days = Math.floor(
    (now().getTime() - Date.parse(grievance.filedAt)) / 86_400_000,
  );
  return {
    stage: days >= limit ? "escalation_due" : "awaiting_reply",
    daysSinceFiled: days,
    escalateAfterDays: limit,
  };
}
