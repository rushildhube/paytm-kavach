import type { Snapshot } from "@backend/api";
import { inr, when } from "../parts";
import { BoundByChip, Card, NAVY } from "./chrome";

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
            t.hold ? "bg-red-100 text-red-700" : "bg-[#E5F8FE]"
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
  return (
    <div className="mt-2 rounded-xl bg-[#E5F8FE] p-3">
      <p className="text-sm font-semibold" style={{ color: NAVY }}>
        क्या बेचा? बोलकर बताइए
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
      </div>
      <p className="mt-1.5 text-xs text-slate-600">
        {tagging.speechConfigured
          ? `${t.secondsLeft}s left. It cannot be added later.`
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
          <button onClick={onSeeAll} className="text-sm font-semibold" style={{ color: "#0098D1" }}>
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
      style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0B4FA0 100%)` }}
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
