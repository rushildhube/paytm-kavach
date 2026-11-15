/**
 * Attaching an invoice at payment time (issues #15, #19): same rules as a
 * spoken tag, and only a fingerprint of the file is kept.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/invoice/route";
import { attachInvoice, handle } from "@backend/api";
import { buildCertificate } from "@backend/certificate";
import { db, SCHEMA_VERSION } from "@backend/db/connection";
import { MIGRATIONS } from "@backend/db/schema";
import { getInvoice, invoiceKind, MAX_INVOICE_BYTES } from "@backend/invoices";
import { resetRateLimits } from "@backend/ratelimit";
import { advanceClock, now, resetStore } from "@backend/store";

process.env.KAVACH_USE_MODEL = "0";

const PDF = new TextEncoder().encode("%PDF-1.4\n% bill: 2 kg cheeni, 1 tel, total 826\n%%EOF");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function pay(amountInr = 826) {
  const r = (await handle({ action: "pay", amountInr })).result as { txn: { id: string } };
  return r.txn.id;
}

function form(fields: Record<string, string | Blob>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return new Request("http://localhost/api/invoice", { method: "POST", body: f });
}

beforeEach(() => {
  resetStore();
  resetRateLimits();
});

describe("invoice file type", () => {
  it("reads the type from the first bytes, not the name or MIME", () => {
    expect(invoiceKind(PDF)).toBe("pdf");
    expect(invoiceKind(PNG)).toBe("png");
    expect(invoiceKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(invoiceKind(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(invoiceKind(new TextEncoder().encode("<html>not a bill</html>"))).toBeNull();
    expect(invoiceKind(new Uint8Array())).toBeNull();
  });
});

describe("attaching an invoice", () => {
  it("stores only the fingerprint, kind, size and total", async () => {
    const txnId = await pay();
    const { result, state } = attachInvoice({ txnId, bytes: PDF, totalInr: 826 });
    expect(result).toEqual({
      txnId,
      attachedAt: expect.any(String),
      sha256: createHash("sha256").update(PDF).digest("hex"),
      kind: "pdf",
      sizeBytes: PDF.byteLength,
      totalInr: 826,
    });
    const row = state.transactions.find((t) => t.id === txnId)!;
    expect(row.invoice?.sha256).toBe(result.sha256);
    expect(row.canAttachInvoice).toBe(false);
    // No column could hold the file or its name.
    const cols = (db().prepare("PRAGMA table_info(invoices)").all() as { name: string }[]).map((c) => c.name);
    expect(cols.sort()).toEqual(["attached_at", "kind", "sha256", "size_bytes", "total_inr", "txn_id"]);
  });

  it("works for any amount, without a total", async () => {
    const txnId = await pay(120);
    expect(attachInvoice({ txnId, bytes: PNG }).result.totalInr).toBeNull();
  });

  it("is refused a second time; the first stays", async () => {
    const txnId = await pay();
    const first = attachInvoice({ txnId, bytes: PDF }).result;
    expect(() => attachInvoice({ txnId, bytes: PNG })).toThrow(/already attached/);
    expect(getInvoice(txnId)?.sha256).toBe(first.sha256);
  });

  it("is refused after the window closes", async () => {
    const txnId = await pay();
    advanceClock(1);
    expect(() => attachInvoice({ txnId, bytes: PDF })).toThrow(/window has closed/);
    expect(getInvoice(txnId)).toBeUndefined();
  });

  it("is refused after a hold", async () => {
    const txnId = await pay();
    await handle({ action: "hold", txnId });
    expect(() => attachInvoice({ txnId, bytes: PDF })).toThrow(/after a hold/);
  });

  it("is refused when the total differs from the payment", async () => {
    const txnId = await pay();
    expect(() => attachInvoice({ txnId, bytes: PDF, totalInr: 900 })).toThrow(/does not match/);
    expect(getInvoice(txnId)).toBeUndefined();
  });

  it("is refused on another merchant's payment", async () => {
    const txnId = await pay();
    await handle({ action: "merchant", merchantId: "m_reported" });
    expect(() => attachInvoice({ txnId, bytes: PDF })).toThrow(/another merchant/);
  });

  it("is refused for an unknown type, an empty file or one over 2 MB", async () => {
    const txnId = await pay();
    expect(() => attachInvoice({ txnId, bytes: new TextEncoder().encode("hello") })).toThrow(/PDF, JPEG/);
    expect(() => attachInvoice({ txnId, bytes: new Uint8Array() })).toThrow(/empty/);
    const big = new Uint8Array(MAX_INVOICE_BYTES + 1);
    big.set(PDF);
    expect(() => attachInvoice({ txnId, bytes: big })).toThrow(/2 MB/);
  });

  it("the database refuses to change or delete a stored invoice", async () => {
    const txnId = await pay();
    attachInvoice({ txnId, bytes: PDF });
    expect(() => db().prepare("UPDATE invoices SET sha256 = ? WHERE txn_id = ?").run("0".repeat(64), txnId)).toThrow(
      /append-only/,
    );
    expect(() => db().prepare("DELETE FROM invoices WHERE txn_id = ?").run(txnId)).toThrow(/append-only/);
  });

  it("appears on the certificate as a fingerprint the payment company did not verify", async () => {
    const txnId = await pay();
    const inv = attachInvoice({ txnId, bytes: PDF, totalInr: 826 }).result;
    const hold = (await handle({ action: "hold", txnId })).result as { id: string };
    const cert = buildCertificate(hold.id, now());
    expect(cert.invoice).toMatchObject({ sha256: inv.sha256, kind: "pdf", totalInr: 826 });
    expect(cert.invoice!.secondsAfterPayment).toBeLessThanOrEqual(120);
    expect(cert.provenance.join(" ")).toMatch(/not verified by the payment company/);
  });
});

describe("POST /api/invoice", () => {
  it("attaches a file and returns the merchant state", async () => {
    const txnId = await pay();
    const res = await POST(form({ txnId, file: new Blob([PDF], { type: "image/png" }), totalInr: "826" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { kind: string }; state: { transactions: unknown[] } };
    expect(body.result.kind).toBe("pdf"); // the bytes decide, not the claimed MIME
    expect(body.state.transactions.length).toBeGreaterThan(0);
  });

  it("answers 400 for a missing file, bad txnId, bad total or a refused attach", async () => {
    const txnId = await pay();
    expect((await POST(form({ txnId }))).status).toBe(400);
    expect((await POST(form({ txnId: "../x", file: new Blob([PDF]) }))).status).toBe(400);
    expect((await POST(form({ txnId, file: new Blob([PDF]), totalInr: "abc" }))).status).toBe(400);
    const wrong = await POST(form({ txnId, file: new Blob([PDF]), totalInr: "1" }));
    expect(wrong.status).toBe(400);
    expect(((await wrong.json()) as { error: string }).error).toMatch(/does not match/);
  });

  it("answers 413 for a file over 2 MB", async () => {
    const txnId = await pay();
    const res = await POST(form({ txnId, file: new Blob([new Uint8Array(MAX_INVOICE_BYTES + 1)]) }));
    expect(res.status).toBe(413);
  });

  it("answers 429 past the upload rate limit", async () => {
    const txnId = await pay();
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await POST(form({ txnId }))).status;
    expect(last).toBe(429);
  });
});

describe("upgrading a database made before invoices existed", () => {
  const file = path.join(os.tmpdir(), `kavach-invoice-test-${process.pid}.db`);
  const removeFile = () => {
    for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
  };
  afterEach(() => {
    process.env.KAVACH_DB = ":memory:";
    db(); // closes the file handle (Windows keeps open files locked)
    removeFile();
  });

  it("adds the invoices table and keeps the existing rows", async () => {
    removeFile();
    const old = new DatabaseSync(file);
    old.exec(MIGRATIONS[0]);
    old.exec("PRAGMA user_version = 1");
    old.exec(`INSERT INTO meta (key, value) VALUES ('marker', 'kept')`);
    old.close();

    process.env.KAVACH_DB = file;
    const conn = db();
    expect((conn.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(SCHEMA_VERSION);
    expect(conn.prepare("SELECT value FROM meta WHERE key = 'marker'").get()).toEqual({ value: "kept" });
    expect(conn.prepare("SELECT name FROM sqlite_master WHERE name = 'invoices'").get()).toBeTruthy();
  });
});
