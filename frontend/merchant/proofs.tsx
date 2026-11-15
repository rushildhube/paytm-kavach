"use client";

import { useRef, useState } from "react";
import type { Snapshot } from "@backend/api";
import { inr, when } from "../parts";
import { BoundByChip, Card, NAVY } from "./chrome";

type Txn = Snapshot["transactions"][number];

/** Same id the sale certificate uses (`backend/certificate.ts`), so the two can be matched. */
const proofId = (t: Txn) => `KVC-${t.id}`;

function secondsAfter(t: Txn): number | null {
  if (!t.tag) return null;
  return Math.max(0, Math.round((Date.parse(t.tag.recordedAt) - Date.parse(t.at)) / 1000));
}

type Status = { label: string; cls: string };

function statusOf(t: Txn, thresholdInr: number): Status {
  if (t.tag || t.invoice) return { label: "Proof recorded", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  if (t.canTag || t.canAttachInvoice) return { label: "Recording window open", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  if (t.amountInr < thresholdInr) return { label: `Below ₹${thresholdInr}: not asked`, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return { label: "No proof recorded", cls: "bg-slate-100 text-slate-600 border-slate-200" };
}

/** Plain-text record the merchant can copy. Ids and records only; masked payer. */
function proofText(t: Txn, shop: string, accountLast4: string): string {
  const lines = [
    `Kavach proof of sale (draft, not legal advice)`,
    `Proof ID: ${proofId(t)}`,
    `Shop: ${shop} · account •••• ${accountLast4}`,
    `Payment: ${t.id} · ₹${t.amountInr} · ${new Date(t.at).toLocaleString("en-IN")}`,
    `Payer (masked): ${t.payerVpaMasked}`,
    `Settlement: ${t.settlement.status === "settled" ? `settled · UTR ${t.settlement.utr}` : "pending"}`,
  ];
  if (t.billId) lines.push(`Bill: ${t.billId} (created before the payment)`);
  if (t.tag) {
    lines.push(
      `Sale description (merchant's words, recorded ${secondsAfter(t)} s after payment): "${t.tag.transcript}"`,
      `Items: ${t.tag.items.map((i) => [i.quantity, i.unit, i.name].filter(Boolean).join(" ")).join(", ") || "-"}`,
      `Recorded by: ${t.tag.source}${t.tag.boundBy ? ` · matched by ${t.tag.boundBy}` : ""}`,
    );
  }
  if (t.invoice) {
    lines.push(`Invoice: ${t.invoice.kind}, ${t.invoice.sizeBytes} bytes, SHA-256 ${t.invoice.sha256}`);
  }
  return lines.join("\n");
}

function Field({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="shrink-0 text-slate-500">{k}</span>
      <span className={`text-right text-slate-900 ${mono ? "font-mono text-[12px]" : ""}`}>{v}</span>
    </div>
  );
}

function ProofCard({
  t,
  thresholdInr,
  shop,
  accountLast4,
  onAttach,
  busy,
}: {
  t: Txn;
  thresholdInr: number;
  shop: string;
  accountLast4: string;
  onAttach: (txnId: string, file: File) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const status = statusOf(t, thresholdInr);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(proofText(t, shop, accountLast4));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (http on a phone): the text is visible below anyway */
    }
  };

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0">
          <div className={`text-[15px] font-semibold ${t.hold ? "text-red-600" : "text-slate-900"}`}>
            {inr(t.amountInr)} <span className="text-xs font-normal text-slate-500">· {when(t.at)}</span>
          </div>
          <div className="mt-0.5 font-mono text-[12px]" style={{ color: NAVY }}>
            {proofId(t)}
          </div>
          {t.tag && <div className="mt-1 truncate text-sm text-slate-700">“{t.tag.transcript}”</div>}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.cls}`}>
          {status.label}
        </span>
      </button>

      {open && (
        <div className="mt-3 border-t border-slate-100 pt-2 text-[13px]">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">From Paytm records</h4>
          <Field k="Transaction ID" v={t.id} mono />
          <Field k="Amount" v={inr(t.amountInr)} />
          <Field k="Paid at" v={new Date(t.at).toLocaleString("en-IN")} />
          <Field k="Payer" v={t.payerVpaMasked} mono />
          <Field
            k="Settlement"
            v={t.settlement.status === "settled" ? `Settled · •••• ${accountLast4}` : t.hold ? "On hold" : "Pending"}
          />
          {t.settlement.status === "settled" && <Field k="UTR" v={t.settlement.utr} mono />}
          {t.billId && <Field k="Bill ID" v={t.billId} mono />}

          <h4 className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Recorded by you at payment time
          </h4>
          {t.tag ? (
            <div className="mt-1 rounded-lg bg-emerald-50 p-2">
              <div className="font-medium text-emerald-950">“{t.tag.transcript}”</div>
              {t.tag.items.length > 0 && (
                <div className="mt-0.5 text-emerald-900">
                  {t.tag.items.map((i) => [i.quantity, i.unit, i.name].filter(Boolean).join(" ")).join(" · ")}
                </div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-emerald-800">
                <span>{secondsAfter(t)} s after payment</span>
                <span>· {t.tag.source === "bill" ? "from bill" : t.tag.source === "voice" ? "by voice" : "recorded clip"}</span>
                <BoundByChip boundBy={t.tag.boundBy} />
              </div>
            </div>
          ) : (
            <p className="mt-1 text-slate-500">No sale description.</p>
          )}
          {t.invoice ? (
            <div className="mt-2 rounded-lg bg-sky-50 p-2 text-sky-950">
              Invoice attached ({t.invoice.kind.toUpperCase()}, {Math.round(t.invoice.sizeBytes / 1024)} KB)
              <div className="font-mono text-[11px] break-all">SHA-256 {t.invoice.sha256}</div>
            </div>
          ) : (
            t.canAttachInvoice && (
              <>
                <input
                  ref={file}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onAttach(t.id, f);
                    e.target.value = "";
                  }}
                />
                <button
                  disabled={busy}
                  onClick={() => file.current?.click()}
                  className="mt-2 w-full rounded-xl border border-[#00BAF2] py-2 font-medium text-[#0079A8] disabled:opacity-50"
                >
                  📎 Attach invoice photo / PDF ({t.secondsLeft}s left)
                </button>
              </>
            )
          )}

          <button
            onClick={copy}
            className="mt-3 w-full rounded-xl py-2 font-semibold text-white"
            style={{ background: NAVY }}
          >
            {copied ? "Copied ✓" : "Copy proof record"}
          </button>
          <p className="mt-2 text-[11px] text-slate-500">
            Written at payment time and cannot be edited later. Draft record, not legal advice; no guaranteed
            release of any hold.
          </p>
        </div>
      )}
    </li>
  );
}

/**
 * Kavach proof ledger: every payment with its ids and the proof recorded at
 * payment time. This is the merchant's evidence before any freeze happens.
 */
export function ProofsTab({
  state,
  busy,
  onAttach,
}: {
  state: Snapshot;
  busy: string | null;
  onAttach: (txnId: string, file: File) => void;
}) {
  const due = state.transactions.filter((t) => t.amountInr >= state.thresholdInr);
  const proven = due.filter((t) => t.tag || t.invoice).length;
  return (
    <div className="space-y-3">
      <Card title="Kavach · बिक्री का सबूत">
        <p className="text-sm text-slate-600">
          Each payment&apos;s proof is recorded at the moment of sale, tied to Paytm&apos;s own transaction and
          settlement ids.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-[#E5F8FE] p-2">
            <div className="text-lg font-bold" style={{ color: NAVY }}>
              {proven}/{due.length}
            </div>
            <div className="text-[11px] text-slate-600">sales ≥ ₹{state.thresholdInr} with proof</div>
          </div>
          <div className="rounded-xl bg-[#E5F8FE] p-2">
            <div className="text-lg font-bold" style={{ color: NAVY }}>
              {state.transactions.filter((t) => t.billId).length}
            </div>
            <div className="text-[11px] text-slate-600">paid by bill</div>
          </div>
          <div className="rounded-xl bg-[#E5F8FE] p-2">
            <div className="text-lg font-bold" style={{ color: NAVY }}>
              {state.transactions.filter((t) => t.invoice).length}
            </div>
            <div className="text-[11px] text-slate-600">with invoice</div>
          </div>
        </div>
      </Card>
      <ul className="space-y-2">
        {state.transactions.map((t) => (
          <ProofCard
            key={t.id}
            t={t}
            thresholdInr={state.thresholdInr}
            shop={state.merchant.shopName}
            accountLast4={state.merchant.accountLast4}
            onAttach={onAttach}
            busy={busy !== null}
          />
        ))}
      </ul>
    </div>
  );
}
