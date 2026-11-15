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
  getGrievance,
  getHold,
  markFiled,
  merchantOfHold,
  placeHold,
  reportFraud,
  requireEligible,
  screenHold,
  trackerStatus,
} from "./holds";
import { getSaleTag, getTransaction, needsTag, recordPayment, recordSaleTag } from "./ledger";
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
import type { Eligibility, Hold } from "./types";
import { z } from "zod";

/** Which screen is asking. Each one sees only what that actor would see. */
export type Role = (typeof ROLES)[number];
const ROLES = ["merchant", "soundbox", "customer", "bank"] as const;

/** The newest hold on one of the active merchant's payments, never another merchant's. */
function activeHold(): Hold | null {
  const s = store();
  const merchantId = activeMerchant().id;
  const own = new Set(s.transactions.filter((t) => t.merchantId === merchantId).map((t) => t.id));
  return s.holds.findLast((h) => own.has(h.txnId)) ?? null;
}

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
  const hold = activeHold();
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
  const hold = activeHold();
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
    ownerName: merchantOfHold(holdId).ownerName,
  };
}

const VPA = /^[\w.-]{2,64}@[\w.-]{2,32}$/;

/** Longest spoken tag kept. A sale is one short utterance. */
export const MAX_TRANSCRIPT_CHARS = 500;
/** Highest single payment the demo accepts. */
export const MAX_PAYMENT_INR = 500_000;

const id = z.string().min(1).max(64);
const act = <A extends string, S extends z.ZodRawShape>(action: A, shape: S) =>
  z.object({ action: z.literal(action), role: z.enum(ROLES).optional(), ...shape });

/** Every request body is checked here; anything else is refused with a 400. */
const ActionSchema = z.discriminatedUnion("action", [
  act("state", {}),
  act("reset", {}),
  act("merchant", { merchantId: id }),
  act("pay", {
    amountInr: z.number().positive().max(MAX_PAYMENT_INR).optional(),
    payerVpa: z.string().max(100).optional(),
  }),
  act("tag", {
    txnId: id,
    transcript: z.string().trim().min(1).max(MAX_TRANSCRIPT_CHARS),
    source: z.enum(["voice", "recorded_clip"]).optional(),
  }),
  act("report", { txnId: id }),
  act("hold", { txnId: id, scope: z.enum(["lien", "debit_freeze"]).optional() }),
  act("explain", { holdId: id }),
  act("packet", {
    holdId: id,
    answers: z.object({ lentAccount: z.boolean(), receivedForCommission: z.boolean() }),
  }),
  act("filed", { holdId: id }),
  act("advance", { days: z.number().int().min(1).max(365) }),
  act("escalation", { holdId: id }),
  act("check-feeds", {}),
  act("simulate-law-change", {}),
]);

export type Action = z.infer<typeof ActionSchema>;

function parseAction(input: unknown): Action {
  const parsed = ActionSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  throw new Error(`invalid request: ${where}${issue?.message ?? "bad body"}`);
}

/** A payment the screen acts on must belong to the merchant whose screen it is. */
function ownTransaction(txnId: string): void {
  if (getTransaction(txnId).merchantId !== activeMerchant().id) {
    throw new Error("this payment belongs to another merchant");
  }
}

function ownHold(holdId: string): Hold {
  const hold = getHold(holdId);
  ownTransaction(hold.txnId);
  return hold;
}

/** Single entry point used by the API route. Returns fresh state for the asking screen. */
export async function handle(raw: unknown) {
  const input = parseAction(raw);
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
      const txn = recordPayment(input.amountInr ?? DEMO_PAYMENT.amountInr, payer);
      result = { txn, needsTag: needsTag(txn.amountInr) };
      break;
    }
    case "tag":
      ownTransaction(input.txnId);
      result = recordSaleTag({
        txnId: input.txnId,
        transcript: input.transcript,
        items: parseSaleItems(input.transcript),
        source: input.source ?? "voice",
      });
      break;
    case "report":
      ownTransaction(input.txnId);
      result = reportFraud(input.txnId);
      break;
    case "hold":
      ownTransaction(input.txnId);
      result = placeHold(input.txnId, "police", input.scope ?? "lien");
      break;
    case "explain": {
      const hold = ownHold(input.holdId);
      result = await makeDraft("explanation", factsFor(hold.id), hold.type);
      break;
    }
    case "packet": {
      const hold = ownHold(input.holdId);
      const eligibility = screenHold(hold.id, input.answers);
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
      ownHold(input.holdId);
      result = markFiled(input.holdId);
      break;
    case "advance":
      advanceClock(input.days);
      break;
    case "escalation": {
      const hold = ownHold(input.holdId);
      requireEligible(hold.id);
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

  return { result, state: snapshotFor(input.role ?? "merchant") };
}
