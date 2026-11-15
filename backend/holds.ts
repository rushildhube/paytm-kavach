import { REPEAT_REPORT_LIMIT } from "./config";
import { getTransaction } from "./ledger";
import { escalateAfterDays } from "./rules";
import { now, store } from "./store";
import type {
  Eligibility,
  Grievance,
  Hold,
  HoldType,
  Merchant,
  MuleScreenAnswers,
  TrackerStatus,
} from "./types";

/** A hold arrives (simulated). Only the reported payment's amount is held. */
export function placeHold(txnId: string, type: HoldType = "police"): Hold {
  const txn = getTransaction(txnId);
  const s = store();
  if (s.holds.some((h) => h.txnId === txnId)) {
    throw new Error("this payment already has a hold");
  }
  const n = s.nextHold++;
  const hold: Hold = {
    id: `HOLD${n}`,
    txnId,
    type,
    heldAmountInr: txn.amountInr,
    placedAt: now().toISOString(),
    reference: `DEMO-ACK-${String(n).padStart(6, "0")}`,
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
