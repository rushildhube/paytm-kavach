import { makeDraft, type Draft } from "@agent/drafts";
import { DEMO_PAYMENT } from "@data/seed";
import {
  LEGAL_AID_REFERRAL_EN,
  LEGAL_AID_REFERRAL_HI,
  type DraftFacts,
} from "@templates/drafts";
import { parseSaleItems } from "@voice/parser";
import { sarvamConfigured } from "@voice/sarvam";
import { buildCertificate, type SaleCertificate } from "./certificate";
import {
  DISCLAIMER,
  DISCLAIMER_HI,
  TAG_THRESHOLD_INR,
  TAG_WINDOW_SECONDS,
} from "./config";
import {
  checkEligibility,
  getGrievance,
  getHold,
  markFiled,
  placeHold,
  trackerStatus,
} from "./holds";
import { getSaleTag, needsTag, recordPayment, recordSaleTag } from "./ledger";
import { ladder } from "./rules";
import {
  activeMerchant,
  advanceClock,
  now,
  resetStore,
  setActiveMerchant,
  store,
} from "./store";
import type { Eligibility, MuleScreenAnswers, SaleTag } from "./types";

/** Everything the UI needs to draw itself. Contains only minimised data. */
export function snapshot() {
  const s = store();
  const merchant = activeMerchant();
  const at = now();
  const transactions = s.transactions
    .filter((t) => t.merchantId === merchant.id)
    .map((t) => {
      const tag = getSaleTag(t.id) ?? null;
      const hold = s.holds.find((h) => h.txnId === t.id) ?? null;
      const secondsLeft = Math.max(
        0,
        Math.round(TAG_WINDOW_SECONDS - (at.getTime() - Date.parse(t.at)) / 1000),
      );
      return {
        ...t,
        tag,
        hold,
        canTag: !tag && !hold && secondsLeft > 0 && needsTag(t.amountInr),
        secondsLeft,
      };
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const hold = s.holds.at(-1) ?? null;
  return {
    now: at.toISOString(),
    simulatedDays: Math.round(s.clockOffsetMs / 86_400_000),
    merchant,
    merchants: s.merchants.map((m) => ({ id: m.id, shopName: m.shopName })),
    thresholdInr: TAG_THRESHOLD_INR,
    transactions,
    hold,
    grievance: hold ? (getGrievance(hold.id) ?? null) : null,
    tracker: hold ? trackerStatus(hold.id) : null,
    ladder: ladder(),
    speechConfigured: sarvamConfigured(),
    disclaimer: DISCLAIMER,
    disclaimerHi: DISCLAIMER_HI,
  };
}

export type Snapshot = ReturnType<typeof snapshot>;

export type Packet =
  | { eligibility: Extract<Eligibility, { outcome: "eligible" }>; certificate: SaleCertificate; grievance: Draft }
  | { eligibility: Exclude<Eligibility, { outcome: "eligible" }>; referral: { hi: string; en: string } | null };

function factsFor(holdId: string): DraftFacts {
  return {
    certificate: buildCertificate(holdId, now()),
    ownerName: activeMerchant().ownerName,
  };
}

type Action =
  | { action: "state" }
  | { action: "reset" }
  | { action: "merchant"; merchantId: string }
  | { action: "pay"; amountInr?: number }
  | { action: "tag"; txnId: string; transcript: string; source?: SaleTag["source"] }
  | { action: "hold"; txnId: string }
  | { action: "explain"; holdId: string }
  | { action: "packet"; holdId: string; answers: MuleScreenAnswers }
  | { action: "filed"; holdId: string }
  | { action: "advance"; days: number }
  | { action: "escalation"; holdId: string };

/** Single entry point used by the API route. Returns fresh state with every reply. */
export async function handle(input: Action) {
  let result: unknown = null;

  switch (input.action) {
    case "state":
      break;
    case "reset":
      resetStore();
      break;
    case "merchant":
      setActiveMerchant(input.merchantId);
      break;
    case "pay": {
      const txn = recordPayment(
        input.amountInr ?? DEMO_PAYMENT.amountInr,
        DEMO_PAYMENT.payerVpaMasked,
      );
      result = { txn, needsTag: needsTag(txn.amountInr) };
      break;
    }
    case "tag":
      result = recordSaleTag({
        txnId: input.txnId,
        transcript: input.transcript,
        items: parseSaleItems(input.transcript),
        source: input.source ?? "voice",
      });
      break;
    case "hold":
      result = placeHold(input.txnId);
      break;
    case "explain": {
      const hold = getHold(input.holdId);
      result = await makeDraft("explanation", factsFor(hold.id), hold.type);
      break;
    }
    case "packet": {
      const hold = getHold(input.holdId);
      const eligibility = checkEligibility(activeMerchant(), input.answers);
      if (eligibility.outcome !== "eligible") {
        const packet: Packet = {
          eligibility,
          referral:
            eligibility.outcome === "legal_aid"
              ? { hi: LEGAL_AID_REFERRAL_HI, en: LEGAL_AID_REFERRAL_EN }
              : null,
        };
        result = packet;
        break;
      }
      const facts = factsFor(hold.id);
      const packet: Packet = {
        eligibility,
        certificate: facts.certificate,
        grievance: await makeDraft("grievance", facts, hold.type),
      };
      result = packet;
      break;
    }
    case "filed":
      result = markFiled(input.holdId);
      break;
    case "advance":
      advanceClock(input.days);
      break;
    case "escalation": {
      const hold = getHold(input.holdId);
      const grievance = getGrievance(hold.id);
      const status = trackerStatus(hold.id);
      if (!grievance || status.stage !== "escalation_due") {
        throw new Error("escalation is not due yet");
      }
      const next = ladder().steps[1]?.to;
      result = await makeDraft(
        "escalation",
        {
          ...factsFor(hold.id),
          filedAt: grievance.filedAt,
          daysSinceFiled: status.daysSinceFiled ?? undefined,
          nextLevel: next,
        },
        hold.type,
      );
      break;
    }
    default:
      throw new Error("unknown action");
  }

  return { result, state: snapshot() };
}
