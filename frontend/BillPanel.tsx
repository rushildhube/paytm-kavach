"use client";

import { useCallback, useState } from "react";
import type { Snapshot } from "@backend/api";
import { DEMO_PAYEE_VPA } from "@data/seed";
import { inr, when } from "./parts";
import { QrCode } from "./QrCode";
import { buildUpiUri, MAX_UPI_AMOUNT_INR } from "./upi";
import { useLive } from "./useLive";

type Bill = Snapshot["bills"][number];

const STATUS: Record<Bill["status"], { hi: string; en: string; cls: string }> = {
  open: { hi: "भुगतान का इंतज़ार", en: "Waiting for payment", cls: "bg-amber-100 text-amber-800" },
  paid: { hi: "भुगतान हो गया", en: "Paid", cls: "bg-green-100 text-green-800" },
  cancelled: { hi: "रद्द", en: "Cancelled", cls: "bg-slate-200 text-slate-600" },
};

/**
 * Bill-first selling (issue #15): the shopkeeper enters the amount and what
 * is being sold, and shows the buyer a bill QR. The bill id rides in the UPI
 * `tr` field, so when the buyer pays it the bill text becomes the sale tag at
 * payment time. Status updates live (open → paid).
 *
 * Self-contained: polls as the merchant. Mounted at /merchant/bill and meant
 * to be mounted inside the merchant app too. Shows nothing about holds.
 */
export default function BillPanel() {
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const [billId, setBillId] = useState<string | null>(null);

  const clear = useCallback(() => {
    setAmount("");
    setText("");
    setBillId(null);
  }, []);
  const { state, error, busy, call } = useLive<Snapshot>("merchant", { intervalMs: 1000, onReset: clear });

  const bill = billId ? (state?.bills.find((b) => b.id === billId) ?? null) : null;
  const n = Number(amount);
  const amountOk = /^\d+(\.\d{1,2})?$/.test(amount) && n > 0 && n <= MAX_UPI_AMOUNT_INR;

  const create = async () => {
    const reply = await call<Bill>({ action: "bill-create", amountInr: n, text: text.trim() });
    if (reply) setBillId(reply.result.id);
  };

  const cancel = async () => {
    if (bill) await call({ action: "bill-cancel", billId: bill.id });
  };

  if (!state) return <p className="p-6 text-slate-500">{error ?? "Loading…"}</p>;
  const shopName = state.merchant.shopName;

  return (
    <section className="w-full rounded-2xl bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#002E6E]">बिल QR बनाएँ</h2>
          <p className="text-xs text-slate-500">Bill QR · proof of sale before the money moves</p>
        </div>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Demo</span>
      </header>

      {!bill && (
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">राशि · Amount</span>
            <div className="mt-1 flex items-center rounded-xl border-2 border-slate-200 px-3 focus-within:border-[#00BAF2]">
              <span className="text-2xl text-slate-500">₹</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))}
                inputMode="decimal"
                placeholder="826"
                className="w-full bg-transparent px-2 py-3 text-3xl font-bold outline-none placeholder:text-slate-300"
                aria-label="Amount"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">क्या बेचा? · What was sold</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              placeholder="दो किलो चीनी, एक तेल"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-3 text-lg outline-none focus:border-[#00BAF2]"
            />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            disabled={!amountOk || busy !== null}
            onClick={() => void create()}
            className="w-full rounded-xl bg-[#00BAF2] py-4 text-lg font-semibold text-white disabled:opacity-40"
          >
            {busy === "bill-create" ? "बन रहा है…" : `QR बनाएँ ${amountOk ? inr(n) : ""}`}
          </button>
          <p className="text-xs text-slate-500">
            The buyer scans this QR in any UPI app. The amount is fixed, and what you type here is saved
            as the sale record the moment the payment lands. It cannot be changed afterwards.
          </p>
        </div>
      )}

      {bill && (
        <div className="mt-5 flex flex-col items-center text-center">
          <div className="text-sm text-slate-500">{shopName}</div>
          <div className="text-4xl font-bold text-slate-900">{inr(bill.amountInr)}</div>
          {bill.text && <div className="mt-1 text-slate-700">{bill.text}</div>}

          <div className={`relative mt-4 rounded-2xl border-4 p-2 ${bill.status === "open" ? "border-[#00BAF2]" : "border-slate-200"}`}>
            <QrCode
              text={buildUpiUri({
                pa: DEMO_PAYEE_VPA,
                pn: shopName,
                am: bill.amountInr,
                tr: bill.id,
                tn: `Bill ${bill.id}`,
              })}
              size={260}
              label={`UPI QR for bill ${bill.id}`}
              className={bill.status === "open" ? "" : "opacity-15"}
            />
            {bill.status === "paid" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="kavach-pop flex h-20 w-20 items-center justify-center rounded-full bg-[#21C17A] text-5xl text-white">
                  ✓
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 font-mono text-sm text-slate-600">{bill.id}</div>
          <div className={`mt-2 rounded-full px-3 py-1 text-sm font-semibold ${STATUS[bill.status].cls}`}>
            {STATUS[bill.status].hi} · {STATUS[bill.status].en}
          </div>
          {bill.status === "paid" && bill.txnId && (
            <p className="mt-2 text-xs text-slate-500">
              Payment {bill.txnId}. The bill text is saved as the sale record.
            </p>
          )}
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="mt-5 flex w-full gap-3">
            {bill.status === "open" && (
              <button
                disabled={busy !== null}
                onClick={() => void cancel()}
                className="flex-1 rounded-xl border-2 border-slate-300 py-3 font-semibold text-slate-700 disabled:opacity-40"
              >
                रद्द करें · Cancel
              </button>
            )}
            <button onClick={clear} className="flex-1 rounded-xl bg-[#002E6E] py-3 font-semibold text-white">
              नया बिल · New bill
            </button>
          </div>
        </div>
      )}

      {state.bills.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent bills</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {state.bills.slice(0, 5).map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => setBillId(b.id)}
                  className="flex w-full items-center justify-between gap-2 py-2 text-left"
                >
                  <span className="font-mono text-xs text-slate-500" title={when(b.createdAt)}>{b.id}</span>
                  <span className="flex-1 truncate text-slate-700">{b.text || "—"}</span>
                  <span className="font-semibold">{inr(b.amountInr)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS[b.status].cls}`}>
                    {STATUS[b.status].en}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
