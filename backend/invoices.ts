import { createHash } from "node:crypto";
import { TAG_WINDOW_SECONDS } from "./config";
import { run, tx } from "./db/connection";
import { rows } from "./db/rows";
import { getTransaction, LedgerError } from "./ledger";
import { activeMerchant, now } from "./store";
import type { Invoice } from "./types";

/**
 * Attaching an invoice at payment time, for merchants who would rather show a
 * bill than speak (issues #15, #19). The same rules as a spoken tag: the
 * merchant's own payment, inside the tag window, before any hold, once.
 *
 * Only the file's SHA-256 fingerprint is stored. The bytes and the file name
 * are dropped: an invoice can carry the buyer's name or number (DPDP Act), and
 * the fingerprint is enough to show later that the merchant's copy is the file
 * attached at the time of sale.
 */
export const MAX_INVOICE_BYTES = 2 * 1024 * 1024;

/** The file's real type, read from its first bytes rather than trusting the client. */
export function invoiceKind(bytes: Uint8Array): Invoice["kind"] | null {
  const at = (i: number, ...b: number[]) => b.every((v, k) => bytes[i + k] === v);
  if (at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return "pdf"; // %PDF-
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp"; // RIFF....WEBP
  return null;
}

export function getInvoice(txnId: string): Invoice | undefined {
  return rows.invoice(txnId);
}

export function recordInvoice(input: {
  txnId: string;
  bytes: Uint8Array;
  totalInr?: number | null;
}): Invoice {
  const { bytes } = input;
  if (bytes.byteLength === 0) throw new LedgerError("the invoice file is empty");
  if (bytes.byteLength > MAX_INVOICE_BYTES) throw new LedgerError("the invoice file is larger than 2 MB");
  const kind = invoiceKind(bytes);
  if (!kind) throw new LedgerError("the invoice must be a PDF, JPEG, PNG or WebP file");

  return tx(() => {
    const txn = getTransaction(input.txnId);
    if (txn.merchantId !== activeMerchant().id) {
      throw new LedgerError("this payment belongs to another merchant");
    }
    if (getInvoice(txn.id)) {
      throw new LedgerError("an invoice is already attached to this payment and cannot be changed");
    }
    if (rows.holdForTxn(txn.id)) {
      throw new LedgerError("an invoice cannot be attached after a hold is placed");
    }
    const at = now();
    if ((at.getTime() - Date.parse(txn.at)) / 1000 > TAG_WINDOW_SECONDS) {
      throw new LedgerError(
        "the window has closed; an invoice can only be attached at payment time",
      );
    }
    const totalInr = input.totalInr ?? null;
    if (totalInr !== null && Math.abs(totalInr - txn.amountInr) > 0.001) {
      throw new LedgerError("the invoice total does not match the payment");
    }
    run(
      `INSERT INTO invoices (txn_id, attached_at, sha256, kind, size_bytes, total_inr)
       VALUES (?, ?, ?, ?, ?, ?)`,
      txn.id,
      at.toISOString(),
      createHash("sha256").update(bytes).digest("hex"),
      kind,
      bytes.byteLength,
      totalInr,
    );
    const invoice = getInvoice(txn.id);
    if (!invoice) throw new Error("invoice was not stored");
    return invoice;
  });
}
