"use client";

import { useState, useSyncExternalStore } from "react";
import type { BankSnapshot } from "@backend/api";
import type { HoldScope } from "@backend/types";
import { inr, when } from "./parts";
import { useLive } from "./useLive";

const btn =
  "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

/**
 * The bank and cybercrime side of the story, on the presenter's laptop.
 * It stands in for the 1930 helpline / NCRP and the bank acting on the
 * resulting notice. It is the only screen that sees a report before a hold.
 */
export default function BankConsole() {
  const { state, error, busy, call } = useLive<BankSnapshot>("bank");
  const [scope, setScope] = useState<HoldScope>("debit_freeze");
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  if (!state) return <div className="p-10 text-slate-500">{error ?? "Loading…"}</div>;

  const report = state.reports.at(-1) ?? null;
  const reportedTxn = report ? state.transactions.find((t) => t.id === report.txnId) : null;
  const latest = state.transactions[0] ?? null;
  const hold = state.hold;
  const tracker = state.tracker;
  const filed = tracker && tracker.stage !== "not_filed";

  const reset = () => call({ action: "reset" });

  const day15 = async () => {
    if (!tracker) return;
    const days = tracker.escalateAfterDays - (tracker.daysSinceFiled ?? 0);
    await call({ action: "advance", days: Math.max(days, 1) });
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 px-6 py-4 text-white">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Simulation · synthetic data</div>
          <h1 className="text-xl font-semibold">{state.merchant.bankName} · Cyber fraud desk</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {state.simulatedDays > 0 && (
            <span className="rounded-full bg-amber-500 px-3 py-1 font-semibold text-black">
              Simulated day {state.simulatedDays}
            </span>
          )}
          <button onClick={reset} disabled={busy !== null} className={`${btn} bg-white/10 text-white hover:bg-white/20`}>
            Reset whole demo
          </button>
        </div>
      </header>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* step 1 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <Step n={1} title="Victim calls 1930 / files on NCRP" />
          <p className="mt-2 text-sm text-slate-600">
            The real owner of the payer&apos;s account finds money missing and reports it. The
            complaint names one payment that reached {state.merchant.shopName}.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {state.transactions.slice(0, 4).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <div className="font-semibold">{inr(t.amountInr)}</div>
                  <div className="text-xs text-slate-500">
                    {when(t.at)} · {t.payerVpaMasked}
                  </div>
                </div>
                {t.reported ? (
                  <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Reported</span>
                ) : (
                  <button
                    onClick={() => call({ action: "report", txnId: t.id })}
                    disabled={busy !== null || report !== null}
                    className={`${btn} bg-amber-500 text-black`}
                  >
                    Report
                  </button>
                )}
              </li>
            ))}
          </ul>
          {report && (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
              <div className="font-semibold text-amber-900">Complaint registered</div>
              <div className="text-amber-900">Ack no. {report.ackNo}</div>
              <div className="mt-1 text-xs text-amber-800">
                The merchant&apos;s phone and Soundbox show nothing yet. Kavach never warns a
                merchant before a hold exists.
              </div>
            </div>
          )}
          {!report && latest && (
            <p className="mt-3 text-xs text-slate-500">On stage: report the latest payment ({inr(latest.amountInr)}).</p>
          )}
        </section>

        {/* step 2 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <Step n={2} title="Bank acts on the notice" />
          <p className="mt-2 text-sm text-slate-600">
            The complaint system sends a notice to the bank that received the money. The bank
            restricts account •••• {state.merchant.accountLast4}.
          </p>
          <fieldset className="mt-3 space-y-2" disabled={!report || !!hold}>
            <ScopeOption
              checked={scope === "debit_freeze"}
              onChange={() => setScope("debit_freeze")}
              title="Debit freeze on the whole account"
              sub="No withdrawals at all. What merchants often face in practice."
            />
            <ScopeOption
              checked={scope === "lien"}
              onChange={() => setScope("lien")}
              title={`Lien on ${reportedTxn ? inr(reportedTxn.amountInr) : "the reported amount"} only`}
              sub="Only the disputed amount is blocked; the rest stays usable."
            />
          </fieldset>
          <button
            onClick={() => report && call({ action: "hold", txnId: report.txnId, scope })}
            disabled={busy !== null || !report || !!hold}
            className={`${btn} mt-3 w-full bg-red-600 text-white`}
          >
            Apply restriction
          </button>
          {hold && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
              <div className="font-semibold">
                {hold.scope === "debit_freeze" ? "Debit freeze applied" : `Lien of ${inr(hold.heldAmountInr)} applied`}
              </div>
              <div className="text-xs">
                Ref {hold.reference} · {when(hold.placedAt)}. The merchant&apos;s screen has now turned red.
              </div>
            </div>
          )}
        </section>

        {/* step 3 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <Step n={3} title="Merchant's grievance" />
          <p className="mt-2 text-sm text-slate-600">
            Kavach drafts; the merchant reviews it and files it at this bank themselves.
          </p>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
            {!hold && "No restriction yet."}
            {hold && !filed && "Waiting for the merchant to file."}
            {filed && tracker && (
              <>
                <div className="font-semibold">Grievance filed by the merchant</div>
                <div>
                  Day {tracker.daysSinceFiled} of {tracker.escalateAfterDays}.{" "}
                  {tracker.stage === "escalation_due"
                    ? "No reply from the bank. Escalation draft is on the merchant's screen."
                    : "Awaiting the bank's reply."}
                </div>
              </>
            )}
          </div>
          <button
            onClick={day15}
            disabled={busy !== null || !filed || tracker?.stage === "escalation_due"}
            className={`${btn} mt-3 w-full bg-slate-900 text-white`}
          >
            Simulate day {tracker?.escalateAfterDays ?? 15} with no reply
          </button>
        </section>
      </div>

      {/* links */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Open on the phones</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["Customer (buyer)", "/customer"],
            ["Soundbox", "/soundbox"],
            ["Merchant app", "/merchant"],
          ].map(([label, path]) => (
            <a key={path} href={path} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <div className="font-semibold text-slate-900">{label}</div>
              <div className="break-all font-mono text-xs text-slate-500">{origin}{path}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2 font-semibold text-slate-900">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm text-white">{n}</span>
      {title}
    </h2>
  );
}

function ScopeOption({
  checked,
  onChange,
  title,
  sub,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  sub: string;
}) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${checked ? "border-red-500 bg-red-50" : "border-slate-200"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-1" />
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-600">{sub}</span>
      </span>
    </label>
  );
}
