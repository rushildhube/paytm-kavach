/**
 * DPDP minimisation (issue #25): every stored column of buyer-related data
 * has a recorded purpose and retention, and no column can hold buyer identity.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "@backend/api";
import { db } from "@backend/db/connection";
import { resetStore } from "@backend/store";
import type { DataPurpose } from "@backend/types";

process.env.KAVACH_USE_MODEL = "0";

/** Columns that hold data about, or derived from, the buyer or what they bought. */
const BUYER_DATA = [
  "transactions.payer_vpa_masked",
  "sale_tags.transcript",
  "bills.text",
  "invoices.sha256",
];

function columns(): string[] {
  const tables = (
    db().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as {
      name: string;
    }[]
  ).map((t) => t.name);
  return tables.flatMap((t) =>
    (db().prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => `${t}.${c.name}`),
  );
}

async function purposes(role?: string) {
  return (await handle({ action: "data-purposes", ...(role ? { role } : {}) })).result as DataPurpose[];
}

beforeEach(() => resetStore());

describe("data purposes (DPDP, #25)", () => {
  it("records a purpose, minimisation and retention for exactly the buyer-data columns", async () => {
    const list = await purposes();
    expect(list.map((p) => `${p.table}.${p.column}`).sort()).toEqual([...BUYER_DATA].sort());
    for (const p of list) {
      expect(p.data.length).toBeGreaterThan(10);
      expect(p.purpose.length).toBeGreaterThan(10);
      expect(p.minimised.length).toBeGreaterThan(10);
      expect(p.retention.length).toBeGreaterThan(10);
    }
  });

  it("every recorded column exists in the schema", () => {
    const all = columns();
    for (const c of BUYER_DATA) expect(all).toContain(c);
  });

  it("no column can hold a buyer's name, phone, email, address, GSTIN or full account number", () => {
    const risky = columns().filter((c) =>
      /(payer|buyer|customer)_?(name|phone|email|address)|phone|mobile|email|address|gstin|account_number|full_vpa/i.test(
        c.split(".")[1],
      ),
    );
    expect(risky).toEqual([]);
  });

  it("the record changes only by migration", () => {
    expect(() => db().prepare("UPDATE data_purposes SET retention = 'forever'").run()).toThrow(/only by migration/);
    expect(() => db().prepare("DELETE FROM data_purposes").run()).toThrow(/only by migration/);
  });

  it("survives a reset, and any screen may read it", async () => {
    await handle({ action: "reset" });
    expect((await purposes("customer")).length).toBe(BUYER_DATA.length);
    expect((await purposes("bank")).length).toBe(BUYER_DATA.length);
  });

  it("does not claim a law it cannot cite", async () => {
    for (const p of await purposes()) {
      expect(`${p.purpose} ${p.retention}`).not.toMatch(/\b(section|s\.\s?\d|Act)\b/);
    }
  });
});
