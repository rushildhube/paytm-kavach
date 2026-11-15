import { merchants, seedTransactions, DEMO_MERCHANT_ID } from "@data/seed";
import type {
  Bill,
  FraudReport,
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
  /** Bank-side only. Never sent to the merchant or Soundbox views. */
  reports: FraudReport[];
  /** Bills made before payment (bill-first). Content fixed; status/txnId change once. */
  bills: Bill[];
  holds: Hold[];
  grievances: Grievance[];
  /** Simulated clock offset, used by "simulate day 15". */
  clockOffsetMs: number;
  nextTxn: number;
  nextHold: number;
  nextReport: number;
  nextBill: number;
  /** Bumped on every reset so all connected screens return to their start. */
  epoch: number;
};

function fresh(epoch = 0): Store {
  const seeded = seedTransactions(Date.now());
  return {
    merchants: merchants.map((m) => ({ ...m })),
    activeMerchantId: DEMO_MERCHANT_ID,
    transactions: seeded.transactions,
    saleTags: seeded.saleTags,
    reports: [],
    bills: [],
    holds: [],
    grievances: [],
    clockOffsetMs: 0,
    nextTxn: 2001,
    nextHold: 1,
    nextReport: 1,
    nextBill: 1,
    epoch,
  };
}

const g = globalThis as unknown as { __kavachStore?: Store };

export function store(): Store {
  // Also replaces a store left over from an older code version during hot reload.
  if (!g.__kavachStore || !Array.isArray(g.__kavachStore.bills)) g.__kavachStore = fresh();
  return g.__kavachStore;
}

export function resetStore(): Store {
  g.__kavachStore = fresh((g.__kavachStore?.epoch ?? 0) + 1);
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
