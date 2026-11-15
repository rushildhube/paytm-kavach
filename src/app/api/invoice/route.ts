import { attachInvoice } from "@backend/api";
import { MAX_INVOICE_BYTES } from "@backend/invoices";
import { clientKey, RateLimited, takeToken } from "@backend/ratelimit";

const TXN_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Attach an invoice to a payment at sale time (multipart form).
 * Fields: `txnId`, `file` (PDF, JPEG, PNG or WebP, at most 2 MB) and an
 * optional `totalInr` that must equal the payment. Only the file's SHA-256 is
 * stored; the bytes are hashed here and dropped.
 */
export async function POST(request: Request) {
  try {
    takeToken("upload", clientKey(request));
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_INVOICE_BYTES + 64 * 1024) {
      return Response.json({ error: "the invoice file is larger than 2 MB" }, { status: 413 });
    }
    const form = await request.formData();
    const txnId = form.get("txnId");
    const file = form.get("file");
    const total = form.get("totalInr");
    if (typeof txnId !== "string" || !TXN_ID.test(txnId)) {
      return Response.json({ error: "invalid request: txnId" }, { status: 400 });
    }
    if (!(file instanceof Blob)) {
      return Response.json({ error: "no invoice file received" }, { status: 400 });
    }
    if (file.size > MAX_INVOICE_BYTES) {
      return Response.json({ error: "the invoice file is larger than 2 MB" }, { status: 413 });
    }
    let totalInr: number | null = null;
    if (typeof total === "string" && total.trim() !== "") {
      totalInr = Number(total);
      if (!Number.isFinite(totalInr) || totalInr <= 0) {
        return Response.json({ error: "invalid request: totalInr" }, { status: 400 });
      }
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return Response.json(attachInvoice({ txnId, bytes, totalInr }));
  } catch (err) {
    const status = err instanceof RateLimited ? 429 : 400;
    const message = err instanceof Error ? err.message : "request failed";
    return Response.json({ error: message }, { status });
  }
}
