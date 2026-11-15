import { makeDraft, type Draft } from "@agent/drafts";
import { DEMO_PAYEE_VPA, DEMO_PAYMENT } from "@data/seed";
import {
  LEGAL_AID_REFERRAL_EN,
  LEGAL_AID_REFERRAL_HI,
  type DraftFacts,
} from "@templates/drafts";
import { parseSaleItems } from "@voice/parser";
import { sarvamConfigured } from "@voice/sarvam";
import { isVoiceLanguage, VOICE_LANGUAGES } from "@voice/languages";
import { cancelBill, createBill, getBill, merchantBills, settleBill } from "./bills";
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
import { getSaleTag, LedgerError, needsTag, recordPayment, recordSaleTag } from "./ledger";
import { escalationTarget, ladder } from "./rules";
import { checkFeeds, clearDemoAlerts, ensureWatcher, injectDemoItem, watchStatus } from "./watcher";
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
    bills: merchantBills(),
    settings: { language: merchant.language },
    voiceLanguages: VOICE_LANGUAGES,
    hold,
    grievance: hold ? (getGrievance(hold.id) ?? null) : null,
    tracker: hold ? trackerStatus(hold.id) : null,
    ladder: ladder(),
    lawWatch: watchStatus(),
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
    language: activeMerchant().language,
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
        billId: t.billId ?? null,
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
    ladder: ladder(),
    lawWatch: watchStatus(),
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

/** Whole-number rupee amounts written as digits in a transcript ("826", "₹1,200"). */
function spokenAmounts(transcript: string): number[] {
  return [...transcript.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, "")));
}

const VPA = /^[\w.-]{2,64}@[\w.-]{2,32}$/;

type Action = { role?: Role } & (
  | { action: "state" }
  | { action: "reset" }
  | { action: "merchant"; merchantId: string }
  | { action: "pay"; amountInr?: number; payerVpa?: string; billId?: string }
  | { action: "tag"; txnId: string; transcript: string; source?: SaleTag["source"] }
  | { action: "tag-auto"; transcript: string; source?: SaleTag["source"] }
  | { action: "settings"; language: string }
  | { action: "bill-create"; amountInr: number; text?: string }
  | { action: "bill-cancel"; billId: string }
  | { action: "bill-lookup"; billId: string }
  | { action: "report"; txnId: string }
  | { action: "hold"; txnId: string; scope?: HoldScope }
  | { action: "explain"; holdId: string }
  | { action: "packet"; holdId: string; answers: MuleScreenAnswers }
  | { action: "filed"; holdId: string }
  | { action: "advance"; days: number }
  | { action: "escalation"; holdId: string }
  | { action: "check-feeds" }
  | { action: "simulate-law-change" }
);

/** Single entry point used by the API route. Returns fresh state for the asking screen. */
export async function handle(input: Action) {
  ensureWatcher();
  let result: unknown = null;

  switch (input.action) {
    case "state":
      break;
    case "reset":
      resetStore();
      clearDemoAlerts();
      break;
    case "check-feeds":
      await checkFeeds();
      break;
    case "simulate-law-change":
      // Demo: a made-up feed item, clearly labelled, run through the real matcher.
      injectDemoItem({
        title: "[Simulated] MHA revises the NCRP-CFCFRMS grievance procedure",
        link: "",
        published: null,
        text: "Simulated item for the demo, not real news.",
      });
      break;
    case "merchant":
      setActiveMerchant(input.merchantId);
      break;
    case "pay": {
      const payer =
        typeof input.payerVpa === "string" && VPA.test(input.payerVpa)
          ? input.payerVpa
          : DEMO_PAYMENT.payerVpaMasked;
      if (input.billId) {
        // Bill-first: the bill was made before the payment, so it becomes the tag.
        const bill = getBill(input.billId);
        if (bill.status !== "open") throw new LedgerError("this bill is not open");
        if (input.amountInr !== undefined && Math.abs(input.amountInr - bill.amountInr) > 0.001) {
          throw new LedgerError("amount does not match the bill");
        }
        const txn = recordPayment(bill.amountInr, payer, bill.id);
        settleBill(bill.id, bill.amountInr, txn.id);
        const tag = bill.text
          ? recordSaleTag({
              txnId: txn.id,
              transcript: bill.text,
              items: bill.items,
              source: "bill",
              binding: "bill",
              billId: bill.id,
            })
          : null;
        result = { txn, needsTag: false, bill, tag };
        break;
      }
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
        binding: "tap",
      });
      break;
    case "tag-auto": {
      // Static-QR queue (#15): bind only when it is unambiguous. Never guess.
      const open = merchantTransactions().filter((t) => t.canTag);
      if (open.length === 0) throw new LedgerError("no payment is waiting for a tag");
      let target = open.length === 1 ? open[0] : undefined;
      let binding: "single" | "amount" = "single";
      if (!target) {
        const spoken = spokenAmounts(input.transcript);
        const hits = open.filter((t) => spoken.includes(t.amountInr));
        if (hits.length === 1) {
          target = hits[0];
          binding = "amount";
        }
      }
      if (!target) {
        result = { needsChoice: true, open: open.map((t) => ({ id: t.id, amountInr: t.amountInr })) };
        break;
      }
      result = recordSaleTag({
        txnId: target.id,
        transcript: input.transcript,
        items: parseSaleItems(input.transcript),
        source: input.source ?? "voice",
        binding,
      });
      break;
    }
    case "settings":
      if (!isVoiceLanguage(input.language)) throw new Error("unsupported language");
      activeMerchant().language = input.language;
      result = { language: input.language };
      break;
    case "bill-create":
      result = createBill(Number(input.amountInr), String(input.text ?? ""));
      break;
    case "bill-cancel":
      result = cancelBill(input.billId);
      break;
    case "bill-lookup": {
      // What a buyer's phone may see after scanning: shop and amount, nothing else.
      const bill = getBill(input.billId);
      result = {
        id: bill.id,
        amountInr: bill.amountInr,
        status: bill.status,
        shopName: activeMerchant().shopName,
      };
      break;
    }
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
      const next = escalationTarget().to;
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
