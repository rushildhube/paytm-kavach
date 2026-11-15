import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import path from "node:path";
import { DEMO_MERCHANT_ID, merchants, seedTransactions } from "@data/seed";
import { MIGRATIONS } from "./schema";

/**
 * The SQLite database behind the demo (node:sqlite, built into Node 24).
 *
 * - File: `data/kavach.db`, or `KAVACH_DB` if set. Under Vitest it is
 *   `:memory:`, so every test worker gets its own empty database.
 * - The handle is kept on globalThis so dev hot reload reuses it.
 * - All state, including the simulated clock, lives in the file, so it
 *   survives a server restart (only `reset` clears it).
 */
export const SCHEMA_VERSION = MIGRATIONS.length;

type Holder = { db: DatabaseSync; file: string; version: number };
const g = globalThis as unknown as { __kavachDb?: Holder };

export function dbFile(): string {
  if (process.env.KAVACH_DB) return process.env.KAVACH_DB;
  if (process.env.VITEST) return ":memory:";
  return path.join(process.cwd(), "data", "kavach.db");
}

/** The open database, migrated to SCHEMA_VERSION and seeded on first use. */
export function db(): DatabaseSync {
  const file = dbFile();
  let h = g.__kavachDb;
  if (!h || h.file !== file) {
    try {
      h?.db.close();
    } catch {
      // already closed
    }
    const conn = new DatabaseSync(file);
    conn.exec("PRAGMA foreign_keys = ON");
    if (file !== ":memory:") {
      conn.exec("PRAGMA journal_mode = WAL");
      conn.exec("PRAGMA busy_timeout = 2000");
    }
    h = { db: conn, file, version: -1 };
    g.__kavachDb = h;
  }
  // Hot reload can bring in newer migrations while the handle stays open.
  if (h.version !== SCHEMA_VERSION) {
    migrate(h.db);
    h.version = SCHEMA_VERSION;
  }
  return h.db;
}

function userVersion(conn: DatabaseSync): number {
  const row = conn.prepare("PRAGMA user_version").get() as { user_version: number };
  return row.user_version;
}

function migrate(conn: DatabaseSync): void {
  const from = userVersion(conn);
  if (from === SCHEMA_VERSION) return;
  if (from > SCHEMA_VERSION) {
    // Written by newer code (another branch). Demo data only: rebuild.
    rebuild(conn, readEpoch(conn));
    return;
  }
  transaction(conn, () => {
    for (let v = from; v < SCHEMA_VERSION; v++) conn.exec(MIGRATIONS[v]);
    conn.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    if (from === 0) seed(conn, 0);
  });
}

function readEpoch(conn: DatabaseSync): number {
  try {
    const row = conn.prepare("SELECT value FROM meta WHERE key = 'epoch'").get() as
      | { value: string }
      | undefined;
    return row ? Number(row.value) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Drop every table and build the schema and seed again. This is the only
 * way sale tags are ever removed: the append-only triggers go with the table.
 */
function rebuild(conn: DatabaseSync, epoch: number): void {
  conn.exec("PRAGMA foreign_keys = OFF");
  try {
    transaction(conn, () => {
      // Every table that exists, not a fixed list, so tables from a newer
      // migration (or another branch) never block a rebuild.
      const tables = conn
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];
      for (const { name } of tables) conn.exec(`DROP TABLE IF EXISTS "${name.replace(/"/g, '""')}"`);
      for (const m of MIGRATIONS) conn.exec(m);
      conn.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      seed(conn, epoch);
    });
  } finally {
    conn.exec("PRAGMA foreign_keys = ON");
  }
}

/** Drop and reseed the whole database; the reset epoch goes up by one. */
export function resetDb(): void {
  const conn = db();
  rebuild(conn, readEpoch(conn) + 1);
}

function seed(conn: DatabaseSync, epoch: number): void {
  const insMerchant = conn.prepare(
    `INSERT INTO merchants (id, shop_name, owner_name, city, language, bank_name, account_last4, prior_reports)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const m of merchants) {
    insMerchant.run(m.id, m.shopName, m.ownerName, m.city, m.language, m.bankName, m.accountLast4, m.priorReports);
  }
  const { transactions, saleTags } = seedTransactions(Date.now());
  const insTxn = conn.prepare(
    `INSERT INTO transactions (id, merchant_id, amount_inr, at, payer_vpa_masked, settlement_status, settled_at, utr, bill_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const t of transactions) {
    const settled = t.settlement.status === "settled" ? t.settlement : null;
    insTxn.run(
      t.id,
      t.merchantId,
      t.amountInr,
      t.at,
      t.payerVpaMasked,
      t.settlement.status,
      settled?.settledAt ?? null,
      settled?.utr ?? null,
      t.billId ?? null,
    );
  }
  const insTag = conn.prepare(
    `INSERT INTO sale_tags (txn_id, recorded_at, transcript, items, source, bound_by, bill_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const s of saleTags) {
    insTag.run(s.txnId, s.recordedAt, s.transcript, JSON.stringify(s.items), s.source, s.boundBy ?? null, s.billId ?? null);
  }
  const insMeta = conn.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
  const meta: Record<string, string | number> = {
    epoch,
    clock_offset_ms: 0,
    active_merchant_id: DEMO_MERCHANT_ID,
    next_txn: 2001,
    next_hold: 1,
    next_report: 1,
    next_bill: 1,
  };
  for (const [k, v] of Object.entries(meta)) insMeta.run(k, String(v));
}

function transaction<T>(conn: DatabaseSync, fn: () => T): T {
  if (conn.isTransaction) return fn();
  conn.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    conn.exec("COMMIT");
    return out;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

/** Run `fn` atomically. Nested calls join the outer transaction. */
export function tx<T>(fn: () => T): T {
  return transaction(db(), fn);
}

export function getMeta(key: string): string {
  const row = db().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (!row) throw new Error(`missing meta key ${key}`);
  return row.value;
}

export function setMeta(key: string, value: string | number): void {
  db().prepare("UPDATE meta SET value = ? WHERE key = ?").run(String(value), key);
}

/** Take the next number from a counter in meta (next_txn, next_hold, ...). */
export function nextCounter(key: string): number {
  return tx(() => {
    const n = Number(getMeta(key));
    setMeta(key, n + 1);
    return n;
  });
}

export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db().prepare(sql).all(...params) as unknown as T[];
}

export function one<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return db().prepare(sql).get(...params) as unknown as T | undefined;
}

export function run(sql: string, ...params: SQLInputValue[]): { changes: number } {
  const r = db().prepare(sql).run(...params);
  return { changes: Number(r.changes) };
}
