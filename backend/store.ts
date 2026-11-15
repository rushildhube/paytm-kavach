import { isVoiceLanguage } from "@voice/languages";
import { getMeta, resetDb, run, setMeta, tx } from "./db/connection";
import { rows } from "./db/rows";
import type {
  Bill,
  FraudReport,
  Grievance,
  Hold,
  Merchant,
  SaleTag,
  Screening,
  Transaction,
  VoiceLanguage,
} from "./types";

/**
 * Stand-in for Paytm's transaction and settlement systems, kept in SQLite
 * (`backend/db/`). This module holds the clock, the active merchant and a
 * read-only view of everything for tests and debugging.
 */
export type StoreView = Readonly<{
  merchants: readonly Merchant[];
  activeMerchantId: string;
  transactions: readonly Transaction[];
  /** Append-only: entries are added once and never changed (enforced by a trigger). */
  saleTags: readonly SaleTag[];
  /** Bank-side only. Never sent to the merchant or Soundbox views. */
  reports: readonly FraudReport[];
  bills: readonly Bill[];
  holds: readonly Hold[];
  screenings: readonly Screening[];
  grievances: readonly Grievance[];
  /** Simulated clock offset, used by "simulate day 22". */
  clockOffsetMs: number;
  /** Bumped on every reset so all connected screens return to their start. */
  epoch: number;
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/**
 * A frozen copy of the whole database. Reading only: writing to it throws.
 * All writes go through the functions in backend/ (ledger, holds, bills, store).
 */
export function store(): StoreView {
  return deepFreeze({
    merchants: rows.merchants(),
    activeMerchantId: getMeta("active_merchant_id"),
    transactions: rows.transactions(),
    saleTags: rows.saleTags(),
    reports: rows.reports(),
    bills: rows.bills(),
    holds: rows.holds(),
    screenings: rows.screenings(),
    grievances: rows.grievances(),
    clockOffsetMs: clockOffsetMs(),
    epoch: epoch(),
  });
}

/** Drop and reseed the whole database from data/seed.ts; bumps `epoch`. */
export function resetStore(): StoreView {
  resetDb();
  return store();
}

export function epoch(): number {
  return Number(getMeta("epoch"));
}

export function clockOffsetMs(): number {
  return Number(getMeta("clock_offset_ms"));
}

export function now(): Date {
  return new Date(Date.now() + clockOffsetMs());
}

export function advanceClock(days: number): void {
  if (!(days > 0)) throw new Error("the clock can only move forward");
  tx(() => setMeta("clock_offset_ms", clockOffsetMs() + days * 86_400_000));
}

export function allMerchants(): Merchant[] {
  return rows.merchants();
}

export function activeMerchant(): Merchant {
  const m = rows.merchant(getMeta("active_merchant_id"));
  if (!m) throw new Error("active merchant not found");
  return m;
}

export function getMerchant(id: string): Merchant {
  const m = rows.merchant(id);
  if (!m) throw new Error("unknown merchant");
  return m;
}

export function setActiveMerchant(id: string): void {
  getMerchant(id);
  setMeta("active_merchant_id", id);
}

/** The language the merchant's Soundbox speaks and listens in. */
export function setMerchantLanguage(id: string, language: string): VoiceLanguage {
  if (!isVoiceLanguage(language)) throw new Error("unsupported language");
  const { changes } = run("UPDATE merchants SET language = ? WHERE id = ?", language, id);
  if (changes !== 1) throw new Error("unknown merchant");
  return language;
}
