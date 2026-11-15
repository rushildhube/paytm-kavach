"use client";

import { useState } from "react";
import type { Bill } from "@backend/types";
import { inr, when } from "../parts";
import { Card, NAVY, PRIMARY } from "./chrome";

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
  soundboxBillId,
  onSendToSoundbox,
  renderQr,
}: {
  bills: Bill[];
  busy: string | null;
  onCreate: (amountInr: number, text: string, soundbox?: "qr" | "voice") => Promise<boolean>;
  onCancel: (billId: string) => void;
  /** Bill the counter Soundbox is showing, if any. */
  soundboxBillId: string | null;
  onSendToSoundbox: (billId: string, mode: "qr" | "voice") => void;
  renderQr?: (bill: Bill) => React.ReactNode;
}) {
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const amountInr = Number(amount);
  const valid = Number.isFinite(amountInr) && amountInr > 0;

  const [where, setWhere] = useState<"voice" | "qr" | "phone">("voice");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    if (await onCreate(amountInr, text.trim(), where === "phone" ? undefined : where)) {
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
            <div className="mt-1 flex items-center rounded-xl border border-slate-300 px-3 focus-within:border-brand">
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
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[15px] text-slate-900 outline-none focus:border-brand"
            />
          </label>
          <fieldset>
            <legend className="text-xs font-medium text-slate-500">Where should the buyer pay? · ग्राहक कहाँ पेमेंट करे?</legend>
            <div className="mt-1 grid gap-2">
              {(
                [
                  ["voice", "🔊 Soundbox बोलकर माँगे", "Soundbox shows the bill QR and says “please pay ₹X for …”"],
                  ["qr", "▣ Soundbox पर QR भेजें", "Soundbox shows the bill QR, silently"],
                  ["phone", "📱 इसी फ़ोन पर QR", "Show the bill QR on this phone"],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 ${
                    where === value ? "border-brand bg-brand-tint" : "border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="bill-where"
                    checked={where === value}
                    onChange={() => setWhere(value)}
                    className="mt-1 accent-brand"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={!valid || busy !== null}
            className="w-full rounded-full py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            {busy === "bill-create" ? "Creating…" : where === "phone" ? "Create bill" : "Create bill and send to Soundbox"}
          </button>
          <p className="text-xs text-slate-500">
            The buyer pays against this bill, so the sale is recorded before the payment. A bill
            cannot be changed afterwards.
          </p>
        </form>
      </Card>

      {open.map((b) =>
        b.id === soundboxBillId ? (
          <div key={b.id} className="rounded-2xl border-2 border-brand bg-brand-tint p-3 text-center">
            <div className="text-sm font-semibold" style={{ color: NAVY }}>
              🔊 Showing on the Soundbox · {b.id} · {inr(b.amountInr)}
            </div>
            <div className="text-xs text-slate-600">The buyer scans the QR on the Soundbox. It turns paid here on its own.</div>
            <button
              onClick={() => onSendToSoundbox(b.id, "voice")}
              disabled={busy !== null}
              className="mt-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50"
              style={{ color: NAVY, borderColor: NAVY }}
            >
              Ask again on the Soundbox
            </button>
          </div>
        ) : (
          <div key={b.id} className="space-y-2">
            {renderQr?.(b)}
            <div className="flex gap-2">
              <button
                onClick={() => onSendToSoundbox(b.id, "voice")}
                disabled={busy !== null}
                className="flex-1 rounded-full py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: PRIMARY }}
              >
                🔊 Soundbox बोलकर माँगे
              </button>
              <button
                onClick={() => onSendToSoundbox(b.id, "qr")}
                disabled={busy !== null}
                className="flex-1 rounded-full border py-2 text-xs font-semibold disabled:opacity-50"
                style={{ color: NAVY, borderColor: NAVY }}
              >
                ▣ Soundbox पर QR
              </button>
            </div>
          </div>
        ),
      )}

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
                  {b.id === soundboxBillId && b.status === "open" && <> · 🔊 on Soundbox</>}
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

