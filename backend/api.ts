import { makeDraft, type Draft } from "@agent/drafts";
import { DEMO_PAYEE_VPA, DEMO_PAYMENT } from "@data/seed";
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
  reportFraud,
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
import type { Eligibility, HoldScope, MuleScreenAnswers, SaleTag } from "./types";

/** Which screen is asking. Each one sees only what that actor would see. */
export type Role = "merchant" | "soundbox" | "customer" | "bank";
const ROLES: Role[] = ["merchant", "soundbox", "customer", "bank"];

function merchantTransactions() {
  const s = store();
  const merchant = activeMerchant();
  const at = now();
  return s.transactions
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
}

/**
 * What the merchant app needs to draw itself. Contains only minimised data,
 * and nothing about a fraud report until a hold actually exists.
 */
export function snapshot() {
  const s = store();
  const merchant = activeMerchant();
  const hold = s.holds.at(-1) ?? null;
  return {
    epoch: s.epoch,
    now: now().toISOString(),
    simulatedDays: Math.round(s.clockOffsetMs / 86_400_000),
    merchant,
    merchants: s.merchants.map((m) => ({ id: m.id, shopName: m.shopName })),
    thresholdInr: TAG_THRESHOLD_INR,
    tagWindowSeconds: TAG_WINDOW_SECONDS,
    transactions: merchantTransactions(),
    hold,
    grievance: hold ? (getGrievance(hold.id) ?? null) : null,
    tracker: hold ? trackerStatus(hold.id) : null,
    ladder: ladder(),
    speechConfigured: sarvamConfigured(),
    disclaimer: DISCLAIMER,
    disclaimerHi: DISCLAIMER_HI,
  };
}

/** The Soundbox only announces payments and takes sale tags. No holds, no reports. */
export function soundboxSnapshot() {
  const s = store();
  return {
    epoch: s.epoch,
    shopName: activeMerchant().shopName,
    thresholdInr: TAG_THRESHOLD_INR,
    tagWindowSeconds: TAG_WINDOW_SECONDS,
    speechConfigured: sarvamConfigured(),
    payments: merchantTransactions()
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        amountInr: t.amountInr,
        at: t.at,
        transcript: t.tag?.transcript ?? null,
        canTag: t.canTag,
        secondsLeft: t.secondsLeft,
        needsTag: needsTag(t.amountInr),
      })),
  };
}

/** The buyer sees only the shop they are paying. Nothing about the merchant's account. */
export function customerSnapshot() {
  const merchant = activeMerchant();
  return {
    epoch: store().epoch,
    payee: { shopName: merchant.shopName, city: merchant.city, vpa: DEMO_PAYEE_VPA },
  };
}

/** Bank and cybercrime side. Also the presenter's console. */
export function bankSnapshot() {
  const s = store();
  const merchant = activeMerchant();
  const hold = s.holds.at(-1) ?? null;
  return {
    epoch: s.epoch,
    now: now().toISOString(),
    simulatedDays: Math.round(s.clockOffsetMs / 86_400_000),
    merchant: {
      shopName: merchant.shopName,
      city: merchant.city,
      bankName: merchant.bankName,
      accountLast4: merchant.accountLast4,
    },
    transactions: merchantTransactions().map((t) => ({
      id: t.id,
      amountInr: t.amountInr,
      at: t.at,
      payerVpaMasked: t.payerVpaMasked,
      reported: s.reports.some((r) => r.txnId === t.id),
      held: t.hold !== null,
    })),
    reports: s.reports,
    hold,
    grievance: hold ? (getGrievance(hold.id) ?? null) : null,
    tracker: hold ? trackerStatus(hold.id) : null,
  };
}

export function snapshotFor(role: Role = "merchant") {
  switch (role) {
    case "soundbox":
      return soundboxSnapshot();
    case "customer":
      return customerSnapshot();
    case "bank":
      return bankSnapshot();
    default:
      return snapshot();
  }
}

export type Snapshot = ReturnType<typeof snapshot>;
export type SoundboxSnapshot = ReturnType<typeof soundboxSnapshot>;
export type CustomerSnapshot = ReturnType<typeof customerSnapshot>;
export type BankSnapshot = ReturnType<typeof bankSnapshot>;

export type Packet =
  | { eligibility: Extract<Eligibility, { outcome: "eligible" }>; certificate: SaleCertificate; grievance: Draft }
  | { eligibility: Exclude<Eligibility, { outcome: "eligible" }>; referral: { hi: string; en: string } | null };

function factsFor(holdId: string): DraftFacts {
  return {
    certificate: buildCertificate(holdId, now()),
    ownerName: activeMerchant().ownerName,
  };
}

const VPA = /^[\w.-]{2,64}@[\w.-]{2,32}$/;

type Action = { role?: Role } & (
  | { action: "state" }
  | { action: "reset" }
  | { action: "merchant"; merchantId: string }
  | { action: "pay"; amountInr?: number; payerVpa?: string }
  | { action: "tag"; txnId: string; transcript: string; source?: SaleTag["source"] }
  | { action: "report"; txnId: string }
  | { action: "hold"; txnId: string; scope?: HoldScope }
  | { action: "explain"; holdId: string }
  | { action: "packet"; holdId: string; answers: MuleScreenAnswers }
  | { action: "filed"; holdId: string }
  | { action: "advance"; days: number }
  | { action: "escalation"; holdId: string }
);

/** Single entry point used by the API route. Returns fresh state for the asking screen. */
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
      const payer =
        typeof input.payerVpa === "string" && VPA.test(input.payerVpa)
          ? input.payerVpa
          : DEMO_PAYMENT.payerVpaMasked;
      const txn = recordPayment(input.amountInr ?? DEMO_PAYMENT.amountInr, payer);
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
    case "report":
      result = reportFraud(input.txnId);
      break;
    case "hold":
      result = placeHold(
        input.txnId,
        "police",
        input.scope === "debit_freeze" ? "debit_freeze" : "lien",
      );
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

  const role = ROLES.includes(input.role as Role) ? (input.role as Role) : "merchant";
  return { result, state: snapshotFor(role) };
}
