"use client";

import { useState, useSyncExternalStore } from "react";
import type { BankSnapshot } from "@backend/api";
import { DEMO_PAYMENT } from "@data/seed";
import type { HoldScope } from "@backend/types";
import { inr, when } from "./parts";
import { BTN, CARD, PAGE, ScreenHeader, StepNumber } from "./ui";
import { useLive } from "./useLive";


/**
 * The bank and cybercrime side of the story, on the presenter's laptop.
 * It stands in for the 1930 helpline / NCRP and the bank acting on the
 * resulting notice. It is the only screen that sees a report before a hold.
 */
export default function BankConsole() {
  const { state, error, busy, call } = useLive<BankSnapshot>("bank");
  const [scope, setScope] = useState<HoldScope>("lien");
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  if (!state) return <div className="p-10 text-slate-500">{error ?? "Loading…"}</div>;

  const report = state.reports.at(-1) ?? null;
  const reportedTxn = report ? state.transactions.find((t) => t.id === report.txnId) : null;
  // The script reports the ₹826 bill payment; point at it, else the newest payment.
  const target =
    state.transactions.find((t) => t.amountInr === DEMO_PAYMENT.amountInr && !t.reported) ??
    state.transactions[0] ??
    null;
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
    <div className={`min-h-dvh ${PAGE}`}>
      <ScreenHeader
        title={`${state.merchant.bankName} · Cyber fraud desk`}
        subtitle="Simulation · synthetic data"
        right={
          <>
            {state.simulatedDays > 0 && (
              <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-navy">
                Simulated day {state.simulatedDays}
              </span>
            )}
            <button onClick={reset} disabled={busy !== null} className={BTN.quiet}>
              Reset whole demo
            </button>
          </>
        }
        className="sticky top-0 z-10"
      />
      <div className="mx-auto max-w-6xl p-4 sm:p-6">

      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* step 1 */}
        <section className={`${CARD} p-5`}>
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
                  <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-navy">Reported</span>
                ) : (
                  <button
                    onClick={() => call({ action: "report", txnId: t.id })}
                    disabled={busy !== null || report !== null}
                    className={BTN.outline}
                  >
                    Report
                  </button>
                )}
              </li>
            ))}
          </ul>
          {report && (
            <div className="mt-3 rounded-xl bg-brand-tint p-3 text-sm">
              <div className="font-semibold text-brand-navy">Complaint registered</div>
              <div className="text-brand-navy">Ack no. {report.ackNo}</div>
              <div className="mt-1 text-xs text-slate-600">
                The merchant&apos;s phone and Soundbox show nothing yet. Kavach never warns a
                merchant before a hold exists.
              </div>
            </div>
          )}
          {!report && target && (
            <p className="mt-3 text-xs text-slate-500">
              On stage: report the {inr(target.amountInr)} payment ({when(target.at)}).
            </p>
          )}
        </section>

        {/* step 2 */}
        <section className={`${CARD} p-5`}>
          <Step n={2} title="Bank acts on the notice" />
          <p className="mt-2 text-sm text-slate-600">
            The complaint system sends a notice to the bank that received the money. The bank
            restricts account •••• {state.merchant.accountLast4}.
          </p>
          <fieldset className="mt-3 space-y-2" disabled={!report || !!hold}>
            <ScopeOption
              checked={scope === "lien"}
              onChange={() => setScope("lien")}
              title={`Hold ${reportedTxn ? inr(reportedTxn.amountInr) : "the reported amount"} only`}
              sub="Only the reported amount is blocked; the rest stays usable. The usual action for a single report."
            />
            <ScopeOption
              checked={scope === "debit_freeze"}
              onChange={() => setScope("debit_freeze")}
              title="Debit freeze on the whole account"
              sub="No withdrawals at all. Shows the over-reach case, where the merchant asks for it to be narrowed."
            />
          </fieldset>
          <button
            onClick={() => report && call({ action: "hold", txnId: report.txnId, scope })}
            disabled={busy !== null || !report || !!hold}
            className={`${BTN.danger} mt-3 w-full`}
          >
            Apply restriction
          </button>
          {hold && (
            <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
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
        <section className={`${CARD} p-5`}>
          <Step n={3} title="Merchant's grievance" />
          <p className="mt-2 text-sm text-slate-600">
            Kavach drafts; the merchant reviews it and files it at this bank themselves.
          </p>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
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
            className={`${BTN.navy} mt-3 w-full`}
          >
            Simulate day {tracker?.escalateAfterDays ?? 15} with no reply
          </button>
        </section>
      </div>

      {/* law watcher */}
      <section className={`${CARD} mt-4 p-5`}>
        <Step n={4} title="Law watcher" />
        <p className="mt-2 text-sm text-slate-600">
          Kavach watches official feeds and flags rules that may have changed. It never edits a
          rule itself; a person re-reads the source.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => call({ action: "check-feeds" })} disabled={busy !== null} className={BTN.quiet}>
            Check feeds now
          </button>
          <button onClick={() => call({ action: "simulate-law-change" })} disabled={busy !== null} className={BTN.outline}>
            Simulate a change to the MHA procedure
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {Object.keys(state.lawWatch.alertsByRule).length} rule(s) flagged ·{" "}
          {state.lawWatch.lastRun ? `last check ${when(state.lawWatch.lastRun)}` : "not checked yet"}
        </p>
      </section>

      {/* links */}
      <section className={`${CARD} mt-4 p-5`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Open on the phones</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["Customer (buyer)", "/customer"],
            ["Soundbox", "/soundbox"],
            ["Merchant app", "/merchant"],
          ].map(([label, path]) => (
            <a key={path} href={path} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 p-3 hover:border-brand hover:bg-brand-tint">
              <div className="font-semibold text-brand-navy">{label}</div>
              <div className="break-all font-mono text-xs text-slate-500">{origin}{path}</div>
            </a>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2 font-semibold text-brand-navy">
      <StepNumber n={n} />
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
    <label className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${checked ? "border-brand bg-brand-tint" : "border-slate-200"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 accent-brand" />
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-600">{sub}</span>
      </span>
    </label>
  );
}
