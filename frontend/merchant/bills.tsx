"use client";

import { useState } from "react";
import type { Bill } from "@backend/types";
import { inr, when } from "../parts";
import { Card, NAVY } from "./chrome";

const STATUS: Record<Bill["status"], { label: string; cls: string }> = {
  open: { label: "Waiting for payment", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  paid: { label: "Paid", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

/**
 * Bill-first sales (#15): the merchant writes what is being sold before the
 * buyer pays, so the proof exists before the money moves. A bill cannot be
 * edited; an open one can only be cancelled.
 *
 * `renderQr` is the slot for the bill's QR (BillPanel from feat/scan-qr).
 * Until it is merged, the bill id is shown instead.
 */
export function BillsTab({
  bills,
  busy,
  onCreate,
  onCancel,
  renderQr,
}: {
  bills: Bill[];
  busy: string | null;
  onCreate: (amountInr: number, text: string) => Promise<boolean>;
  onCancel: (billId: string) => void;
  renderQr?: (bill: Bill) => React.ReactNode;
}) {
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const amountInr = Number(amount);
  const valid = Number.isFinite(amountInr) && amountInr > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    if (await onCreate(amountInr, text.trim())) {
      setAmount("");
      setText("");
    }
  };

  const open = bills.filter((b) => b.status === "open");

  return (
    <div className="space-y-3">
      <Card title="Create bill · बिल बनाइए">
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Amount · रक़म</span>
            <div className="mt-1 flex items-center rounded-xl border border-slate-300 px-3 focus-within:border-[#00BAF2]">
              <span className="text-2xl font-semibold text-slate-400">₹</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                className="w-full bg-transparent px-2 py-2 text-2xl font-semibold text-slate-900 outline-none"
                aria-label="Bill amount in rupees"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">What is being sold · क्या बेचा</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              placeholder="दो किलो चीनी, एक तेल"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[15px] text-slate-900 outline-none focus:border-[#00BAF2]"
            />
          </label>
          <button
            type="submit"
            disabled={!valid || busy !== null}
            className="w-full rounded-full py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: BLUE_BTN }}
          >
            {busy === "bill-create" ? "Creating…" : "Create bill"}
          </button>
          <p className="text-xs text-slate-500">
            The buyer pays against this bill, so the sale is recorded before the payment. A bill
            cannot be changed afterwards.
          </p>
        </form>
      </Card>

      {open.length > 0 && renderQr && open.map((b) => <div key={b.id}>{renderQr(b)}</div>)}

      <Card title="Bills">
        {bills.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No bills yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {bills.map((b) => (
              <li key={b.id} className="py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold text-slate-900">{inr(b.amountInr)}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS[b.status].cls}`}
                  >
                    {STATUS[b.status].label}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  <span className="font-mono" style={{ color: NAVY }}>
                    {b.id}
                  </span>{" "}
                  · {when(b.createdAt)}
                  {b.txnId && <> · paid in {b.txnId}</>}
                </div>
                {b.text && <div className="mt-1 text-sm text-slate-800">{b.text}</div>}
                {b.status === "open" && (
                  <button
                    onClick={() => onCancel(b.id)}
                    disabled={busy !== null}
                    className="mt-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-50"
                  >
                    Cancel bill
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const BLUE_BTN = "#00BAF2";
