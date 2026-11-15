import { merchants, seedTransactions, DEMO_MERCHANT_ID } from "@data/seed";
import type {
  Grievance,
  Hold,
  Merchant,
  SaleTag,
  Transaction,
} from "./types";

/**
 * In-memory stand-in for Paytm's transaction and settlement systems.
 * Kept on globalThis so it survives hot reloads in dev.
 */
type Store = {
  merchants: Merchant[];
  activeMerchantId: string;
  transactions: Transaction[];
  /** Append-only: entries are added once and never changed. */
  saleTags: SaleTag[];
  holds: Hold[];
  grievances: Grievance[];
  /** Simulated clock offset, used by "simulate day 15". */
  clockOffsetMs: number;
  nextTxn: number;
  nextHold: number;
};

function fresh(): Store {
  const seeded = seedTransactions(Date.now());
  return {
    merchants,
    activeMerchantId: DEMO_MERCHANT_ID,
    transactions: seeded.transactions,
    saleTags: seeded.saleTags,
    holds: [],
    grievances: [],
    clockOffsetMs: 0,
    nextTxn: 2001,
    nextHold: 1,
  };
}

const g = globalThis as unknown as { __kavachStore?: Store };

export function store(): Store {
  if (!g.__kavachStore) g.__kavachStore = fresh();
  return g.__kavachStore;
}

export function resetStore(): Store {
  g.__kavachStore = fresh();
  return g.__kavachStore;
}

export function now(): Date {
  return new Date(Date.now() + store().clockOffsetMs);
}

export function advanceClock(days: number): void {
  if (!(days > 0)) throw new Error("the clock can only move forward");
  store().clockOffsetMs += days * 86_400_000;
}

export function activeMerchant(): Merchant {
  const s = store();
  const m = s.merchants.find((x) => x.id === s.activeMerchantId);
  if (!m) throw new Error("active merchant not found");
  return m;
}

export function setActiveMerchant(id: string): void {
  const s = store();
  if (!s.merchants.some((m) => m.id === id)) throw new Error("unknown merchant");
  s.activeMerchantId = id;
}
