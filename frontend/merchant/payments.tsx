import { useState } from "react";
import type { Snapshot } from "@backend/api";
import { inr, when } from "../parts";
import { BoundByChip, Card, DEEP, NAVY, PRIMARY } from "./chrome";

type Txn = Snapshot["transactions"][number];

/** What the per-payment tag buttons need from the app. */
export type Tagging = {
  /** Payment the mic is currently recording or transcribing for. */
  activeTxnId: string | null;
  recording: boolean;
  busy: string | null;
  speechConfigured: boolean;
  recorderError: string | null;
  onMic: (txnId: string) => void;
  onClip: (txnId: string) => void;
  /** Type what was sold for a payment that came without a bill. True when saved. */
  onWriteBill: (txnId: string, text: string) => Promise<boolean>;
};

function SettlementLine({ t, accountLast4 }: { t: Txn; accountLast4: string }) {
  if (t.hold) return <span className="font-medium text-red-600">On hold · not settled</span>;
  return t.settlement.status === "settled" ? (
    <span className="text-emerald-700">
      Settled to •••• {accountLast4} · UTR {t.settlement.utr}
    </span>
  ) : (
    <span className="text-slate-500">Settlement pending</span>
  );
}

/** One payment, Paytm-list style, with its sale tag or why it has none. */
export function PaymentRow({
  t,
  thresholdInr,
  accountLast4,
  tagging,
}: {
  t: Txn;
  thresholdInr: number;
  accountLast4: string;
  tagging?: Tagging;
}) {
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
            t.hold ? "bg-red-100 text-red-700" : "bg-brand-tint"
          }`}
          style={t.hold ? undefined : { color: NAVY }}
          aria-hidden
        >
          ₹
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-[15px] font-semibold ${t.hold ? "text-red-600" : "text-slate-900"}`}>
              {inr(t.amountInr)}
            </span>
            <span className="shrink-0 text-xs text-slate-500">{when(t.at)}</span>
          </div>
          <div className="text-xs text-slate-500">
            Received from {t.payerVpaMasked}
            {t.billId && <span> · Bill {t.billId}</span>}
          </div>
          <div className="mt-0.5 text-[11px]">
            <SettlementLine t={t} accountLast4={accountLast4} />
          </div>

          {t.tag ? (
            <div className="mt-1.5 space-y-1">
              <div className="inline-block rounded-lg bg-emerald-50 px-2 py-1 text-sm text-emerald-900">
                🛡 {t.tag.transcript}
              </div>
              <div>
                <BoundByChip boundBy={t.tag.boundBy} />
              </div>
            </div>
          ) : t.canTag && tagging ? (
            <TagControls t={t} tagging={tagging} />
          ) : (
            <div className="mt-1 text-xs text-slate-400">
              {t.amountInr < thresholdInr
                ? `${inr(thresholdInr)} से कम · tag not needed`
                : "Not tagged · cannot be added later"}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** Tag this exact payment. The card's own id is sent, so nothing is guessed. */
function TagControls({ t, tagging }: { t: Txn; tagging: Tagging }) {
  const mine = tagging.activeTxnId === t.id;
  const recordingHere = mine && tagging.recording;
  const otherRecording = tagging.recording && !mine;
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const saveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (await tagging.onWriteBill(t.id, text.trim())) {
      setText("");
      setWriting(false);
    }
  };
  return (
    <div className="mt-2 rounded-xl bg-brand-tint p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
        बिना बिल का पेमेंट · Paid without a bill
      </p>
      <p className="text-sm font-semibold" style={{ color: NAVY }}>
        क्या बेचा? बोलिए या बिल लिखिए
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={() => tagging.onMic(t.id)}
          disabled={
            !tagging.speechConfigured || otherRecording || (tagging.busy !== null && !recordingHere)
          }
          className={`rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
            recordingHere ? "bg-red-600" : ""
          }`}
          style={recordingHere ? undefined : { background: NAVY }}
        >
          {recordingHere
            ? "● सुन रहे हैं… रोकें"
            : mine && tagging.busy === "listening"
              ? "समझ रहे हैं…"
              : "🎙 बोलिए"}
        </button>
        <button
          onClick={() => tagging.onClip(t.id)}
          disabled={tagging.busy !== null || tagging.recording}
          className="rounded-full border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ color: NAVY, borderColor: NAVY }}
        >
          Use recorded clip
        </button>
        <button
          onClick={() => setWriting((w) => !w)}
          disabled={tagging.busy !== null || tagging.recording}
          className="rounded-full border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ color: NAVY, borderColor: NAVY }}
        >
          ✍ बिल लिखिए
        </button>
      </div>
      {writing && (
        <form onSubmit={saveBill} className="mt-2 flex gap-2">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            placeholder="दो किलो चीनी, एक तेल"
            aria-label={`What was sold for ${inr(t.amountInr)}`}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={!text.trim() || tagging.busy !== null}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            Save
          </button>
        </form>
      )}
      <p className="mt-1.5 text-xs text-slate-600">
        {tagging.speechConfigured
          ? `${t.secondsLeft}s left to say or write it. It cannot be added later.`
          : "Live speech is off (no SARVAM_API_KEY). Use the recorded clip."}
      </p>
      {mine && tagging.recorderError && (
        <p className="mt-1 text-xs text-red-700">{tagging.recorderError}</p>
      )}
    </div>
  );
}

export function PaymentList({
  transactions,
  thresholdInr,
  accountLast4,
  tagging,
  limit,
  onSeeAll,
}: {
  transactions: Txn[];
  thresholdInr: number;
  accountLast4: string;
  tagging?: Tagging;
  limit?: number;
  onSeeAll?: () => void;
}) {
  const shown = limit ? transactions.slice(0, limit) : transactions;
  return (
    <Card
      title={limit ? "Recent payments" : "All payments"}
      action={
        onSeeAll && transactions.length > shown.length ? (
          <button onClick={onSeeAll} className="text-sm font-semibold" style={{ color: PRIMARY }}>
            See all ›
          </button>
        ) : undefined
      }
    >
      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">No payments yet today.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((t) => (
            <PaymentRow
              key={t.id}
              t={t}
              thresholdInr={thresholdInr}
              accountLast4={accountLast4}
              tagging={tagging}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Home summary. Only figures computed from the payments in the snapshot. */
export function CollectionCard({ transactions }: { transactions: Txn[] }) {
  const total = transactions.reduce((sum, t) => sum + t.amountInr, 0);
  const tagged = transactions.filter((t) => t.tag).length;
  const settled = transactions.filter((t) => t.settlement.status === "settled").length;
  return (
    <section
      className="rounded-2xl p-4 text-white shadow-sm"
      style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${DEEP} 100%)` }}
    >
      <div className="text-xs font-medium opacity-80">Total collection · कुल कलेक्शन</div>
      <div className="mt-0.5 text-3xl font-bold">{inr(total)}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="Payments" value={transactions.length} />
        <Stat label="Settled" value={settled} />
        <Stat label="🛡 Tagged" value={tagged} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 py-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="opacity-80">{label}</div>
    </div>
  );
}
