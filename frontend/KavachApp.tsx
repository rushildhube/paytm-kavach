"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Draft } from "@agent/drafts";
import type { Packet, Snapshot } from "@backend/api";
import type { Bill } from "@backend/types";
import { DEMO_PAYEE_VPA, DEMO_PAYMENT } from "@data/seed";
import { useRecorder } from "@voice/useRecorder";
import { BillsTab } from "./merchant/bills";
import { QrCode } from "./QrCode";
import { buildUpiUri } from "./upi";
import { AppBar, BottomNav, Card, NAVY, type Tab } from "./merchant/chrome";
import { HoldAlert, MuleScreen, PacketView, TrackerCard, type Answers } from "./merchant/hold";
import { CollectionCard, PaymentList, type Tagging } from "./merchant/payments";
import { ProofsTab } from "./merchant/proofs";
import { SoundboxTab } from "./merchant/soundbox";
import { Disclaimer, DraftCard, inr } from "./parts";
import { speak as speakText, stopSpeaking } from "./speech";
import { useLive } from "./useLive";

const NO_ANSWERS: Answers = { lentAccount: null, receivedForCommission: null };

const btn =
  "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The merchant's Paytm for Business app with Kavach.
 * With `controls`, it also shows the single-screen demo controls (the `/`
 * fallback). Without them it is the phone screen in the multi-screen demo,
 * driven by the Soundbox, customer and bank screens.
 *
 * All hold-flow state lives here, not in the tabs, so switching tabs never
 * loses the packet or repeats the spoken explanation.
 */
export default function KavachApp({ controls = true }: { controls?: boolean }) {
  const [explanation, setExplanation] = useState<Draft | null>(null);
  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS);
  const [packet, setPacket] = useState<Packet | null>(null);
  const [escalation, setEscalation] = useState<Draft | null>(null);
  const [listening, setListening] = useState(false);
  /** Tab picked by the merchant, and the hold that was showing when they picked it. */
  const [picked, setPicked] = useState<{ tab: Tab; holdId: string | null }>({
    tab: "home",
    holdId: null,
  });
  const [tagTarget, setTagTarget] = useState<string | null>(null);
  const tagTargetRef = useRef<string | null>(null);
  const requested = useRef<{ explain?: string; escalation?: string }>({});

  const onReset = useCallback(() => {
    stopSpeaking();
    requested.current = {};
    setExplanation(null);
    setAnswers(NO_ANSWERS);
    setPacket(null);
    setEscalation(null);
    setPicked({ tab: "home", holdId: null });
  }, []);
  const live = useLive<Snapshot>("merchant", { onReset });
  const { state, error, setError, call } = live;
  const busy = listening ? "listening" : live.busy;

  const hold = state?.hold ?? null;
  // A new hold always brings the merchant back to Home, where the hold flow is.
  const tab: Tab = hold && hold.id !== picked.holdId ? "home" : picked.tab;
  const goTo = useCallback((t: Tab) => setPicked({ tab: t, holdId: hold?.id ?? null }), [hold]);

  /** Speak Hindi aloud: Sarvam if configured, otherwise the browser voice. */
  const speak = useCallback(
    (text: string) => speakText(text, state?.speechConfigured ?? false),
    [state?.speechConfigured],
  );

  const latest = state?.transactions[0] ?? null;
  const pending = state?.transactions.find((t) => t.canTag) ?? null;

  // ---- sale tags: always for the payment card the merchant used ------------

  const saveTag = useCallback(
    async (txnId: string, transcript: string, source: "voice" | "recorded_clip") => {
      await call({ action: "tag", txnId, transcript, source });
    },
    [call],
  );

  const onRecorded = useCallback(
    async (clip: Blob) => {
      const txnId = tagTargetRef.current;
      if (!txnId) return;
      setListening(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("audio", clip, "sale.webm");
        const res = await fetch("/api/voice/stt", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not understand the audio");
        if (!json.transcript) throw new Error("Nothing was heard. Please say it again.");
        await saveTag(txnId, json.transcript, "voice");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not understand the audio");
      } finally {
        setListening(false);
      }
    },
    [saveTag, setError],
  );
  const recorder = useRecorder(onRecorded);

  const tagging: Tagging = {
    activeTxnId: tagTarget,
    recording: recorder.recording,
    busy,
    speechConfigured: state?.speechConfigured ?? false,
    recorderError: recorder.error,
    onMic: (txnId) => {
      if (recorder.recording) {
        if (tagTargetRef.current === txnId) recorder.stop();
        return;
      }
      tagTargetRef.current = txnId;
      setTagTarget(txnId);
      recorder.start();
    },
    onClip: (txnId) => {
      tagTargetRef.current = txnId;
      setTagTarget(txnId);
      void saveTag(txnId, DEMO_PAYMENT.spokenTag, "recorded_clip");
    },
  };

  // ---- hold flow -----------------------------------------------------------

  // A hold can arrive from the bank screen at any moment: explain it once.
  useEffect(() => {
    if (!hold || requested.current.explain === hold.id) return;
    requested.current.explain = hold.id;
    void call<Draft>({ action: "explain", holdId: hold.id }).then((reply) => {
      if (reply) {
        setExplanation(reply.result);
        void speak(reply.result.text);
      }
    });
  }, [hold, call, speak]);

  // When the deadline passes without a reply, prepare the escalation once.
  const stage = state?.tracker?.stage;
  useEffect(() => {
    if (!hold || stage !== "escalation_due" || requested.current.escalation === hold.id) return;
    requested.current.escalation = hold.id;
    void call<Draft>({ action: "escalation", holdId: hold.id }).then((reply) => {
      if (reply) setEscalation(reply.result);
    });
  }, [hold, stage, call]);

  const preparePacket = async () => {
    if (!hold || answers.lentAccount === null || answers.receivedForCommission === null) return;
    const reply = await call<Packet>({ action: "packet", holdId: hold.id, answers });
    if (reply) setPacket(reply.result);
  };

  // ---- bills and settings --------------------------------------------------

  const createBill = async (amountInr: number, text: string) =>
    (await call<Bill>({ action: "bill-create", amountInr, text })) !== null;
  const cancelBill = (billId: string) => void call({ action: "bill-cancel", billId });
  const setLanguage = (language: string) => void call({ action: "settings", language });

  /** Invoice photo/PDF for one payment (#22). Only its SHA-256 is kept server-side. */
  const attachInvoice = async (txnId: string, file: File) => {
    setError(null);
    const form = new FormData();
    form.set("txnId", txnId);
    form.set("file", file);
    try {
      const res = await fetch("/api/invoice", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          res.status === 413
            ? "The file is larger than 2 MB."
            : res.status === 429
              ? "Too many uploads. Try again in a minute."
              : (body.error ?? "Could not attach the invoice."),
        );
      }
    } catch {
      setError("Could not attach the invoice.");
    }
    await call({ action: "state" });
  };

  // ---- demo controls -------------------------------------------------------

  const pay = async () => {
    const reply = await call<{ needsTag: boolean }>({ action: "pay" });
    if (reply) {
      void speak(`पेटीएम पर ${DEMO_PAYMENT.amountInr} रुपये प्राप्त हुए। क्या बेचा, बताइए।`);
    }
  };

  const triggerHold = async () => {
    if (!latest) return;
    await call({ action: "report", txnId: latest.id });
    await call({ action: "hold", txnId: latest.id });
  };

  const simulateEscalationDay = async () => {
    if (!hold || !state?.tracker) return;
    const days = state.tracker.escalateAfterDays - (state.tracker.daysSinceFiled ?? 0);
    await call({ action: "advance", days: Math.max(days, 1) });
  };

  const reset = () => call({ action: "reset" });

  if (!state) {
    return <div className="p-10 text-slate-500">{error ?? "Loading…"}</div>;
  }

  const tracker = state.tracker;
  const filed = !!tracker && tracker.stage !== "not_filed";
  const openBills = state.bills.filter((b) => b.status === "open").length;

  const holdFlow = hold && (
    <>
      <HoldAlert
        hold={hold}
        explanation={explanation}
        explaining={busy === "explain"}
        canSpeak={state.speechConfigured}
        onSpeak={speak}
      />
      {explanation && !packet && (
        <MuleScreen answers={answers} onAnswers={setAnswers} busy={busy} onSubmit={preparePacket} />
      )}
      {packet && (
        <PacketView
          packet={packet}
          alerts={state.lawWatch.alertsByRule}
          filed={filed}
          busy={busy}
          onFiled={() => call({ action: "filed", holdId: hold.id })}
        />
      )}
      {filed && tracker && <TrackerCard tracker={tracker} ladder={state.ladder} />}
      {escalation && (
        <DraftCard
          title="Escalation letter"
          draft={escalation}
          filename={`escalation-${hold.reference}.txt`}
          alerts={state.lawWatch.alertsByRule}
        />
      )}
      <Disclaimer text={`${state.disclaimerHi} ${state.disclaimer}`} />
    </>
  );

  return (
    <div
      className={
        controls
          ? "mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:flex-row lg:items-start lg:p-8"
          : "mx-auto w-full max-w-md"
      }
    >
      {/* ---------------- merchant phone ---------------- */}
      <main
        className={
          controls
            ? "mx-auto flex w-full max-w-md flex-col overflow-clip rounded-[2rem] border border-slate-200 bg-[#F3F6FA] shadow-xl"
            : "flex min-h-dvh w-full flex-col bg-[#F3F6FA]"
        }
      >
        <AppBar
          merchant={state.merchant}
          simulatedDays={state.simulatedDays}
          hold={hold}
          onHoldTap={() => goTo("home")}
        />

        <div className="flex-1 space-y-3 p-3">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {tab === "home" && (
            <>
              {holdFlow}
              <CollectionCard transactions={state.transactions} />
              <Card>
                <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-medium text-slate-700">
                  <QuickAction icon="▤" label="Create bill" badge={openBills} onClick={() => goTo("bills")} />
                  <QuickAction icon="₹" label="Payments" onClick={() => goTo("payments")} />
                  <QuickAction icon="🔊" label="Soundbox" onClick={() => goTo("soundbox")} />
                  <QuickAction icon="🛡" label="Proofs" onClick={() => goTo("proofs")} />
                </div>
              </Card>
              {!hold && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <span className="text-xl" aria-hidden>
                    🛡
                  </span>
                  <p>
                    <span className="font-semibold">Kavach is on.</span> Payments of{" "}
                    {inr(state.thresholdInr)} and above are tagged at the moment of sale, so the proof
                    already exists if a payment is ever questioned.
                  </p>
                </div>
              )}
              <PaymentList
                transactions={state.transactions}
                thresholdInr={state.thresholdInr}
                accountLast4={state.merchant.accountLast4}
                tagging={hold ? undefined : tagging}
                limit={5}
                onSeeAll={() => goTo("payments")}
              />
            </>
          )}

          {tab === "payments" && (
            <PaymentList
              transactions={state.transactions}
              thresholdInr={state.thresholdInr}
              accountLast4={state.merchant.accountLast4}
              tagging={hold ? undefined : tagging}
            />
          )}

          {tab === "bills" && (
            <BillsTab
              bills={state.bills}
              busy={busy}
              onCreate={createBill}
              onCancel={cancelBill}
              renderQr={(b: Bill) => (
                <div className="flex flex-col items-center rounded-2xl border-4 border-[#00BAF2] bg-white p-3">
                  <QrCode
                    text={buildUpiUri({
                      pa: DEMO_PAYEE_VPA,
                      pn: state.merchant.shopName,
                      am: b.amountInr,
                      tr: b.id,
                      tn: `Bill ${b.id}`,
                    })}
                    size={240}
                    label={`UPI QR for bill ${b.id}`}
                  />
                  <div className="mt-2 text-sm font-semibold">
                    {b.id} · {inr(b.amountInr)}
                  </div>
                  <div className="text-xs text-slate-500">Customer scans this to pay · DEMO</div>
                </div>
              )}
            />
          )}

          {tab === "proofs" && <ProofsTab state={state} busy={busy} onAttach={attachInvoice} />}

          {tab === "soundbox" && <SoundboxTab state={state} busy={busy} onLanguage={setLanguage} />}

          <p className="pb-1 text-center text-[10px] text-slate-400">
            Demo for a Paytm hackathon. Not the real Paytm for Business app. Synthetic data only.
          </p>
        </div>

        <BottomNav tab={tab} onTab={goTo} />
      </main>

      {/* ---------------- demo controls ---------------- */}
      {controls && (
        <aside className="w-full rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-8 lg:max-w-xs">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Demo controls</h2>
          <p className="mt-1 text-xs text-slate-500">
            These stand in for Paytm&apos;s payment and hold events. Synthetic data only.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={pay}
              disabled={busy !== null || !!hold || !!pending}
              className={`${btn} bg-[#00BAF2] text-[#002E6E]`}
            >
              1 · {inr(DEMO_PAYMENT.amountInr)} payment arrives
            </button>
            <button
              onClick={triggerHold}
              disabled={busy !== null || !!hold || !latest}
              className={`${btn} bg-red-600 text-white`}
            >
              2 · Hold placed on latest payment
            </button>
            <button
              onClick={simulateEscalationDay}
              disabled={busy !== null || !filed || tracker?.stage === "escalation_due"}
              className={`${btn} bg-slate-800 text-white`}
            >
              3 · Simulate day {tracker?.escalateAfterDays ?? 22}
            </button>
            <button
              onClick={reset}
              disabled={busy !== null}
              className={`${btn} border border-slate-300 text-slate-700`}
            >
              Reset demo
            </button>
          </div>
          <dl className="mt-5 space-y-1 text-xs text-slate-500">
            <div>Tag prompt at {inr(state.thresholdInr)} and above</div>
            <div>Speech (Sarvam): {state.speechConfigured ? "on" : "off"}</div>
            {busy && <div className="text-slate-700">Working: {busy}…</div>}
          </dl>
          <LawWatch
            watch={state.lawWatch}
            busy={busy !== null}
            onCheck={() => call({ action: "check-feeds" })}
            onSimulate={() => call({ action: "simulate-law-change" })}
          />
        </aside>
      )}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: string;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="relative flex flex-col items-center gap-1">
      <span
        className="grid size-11 place-items-center rounded-2xl bg-[#E5F8FE] text-lg"
        style={{ color: NAVY }}
        aria-hidden
      >
        {icon}
      </span>
      {label}
      {!!badge && (
        <span className="absolute -top-1 right-2 rounded-full bg-[#00BAF2] px-1.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function LawWatch({
  watch,
  busy,
  onCheck,
  onSimulate,
}: {
  watch: Snapshot["lawWatch"];
  busy: boolean;
  onCheck: () => void;
  onSimulate: () => void;
}) {
  const flagged = Object.entries(watch.alertsByRule);
  return (
    <section className="mt-6 border-t border-slate-200 pt-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Law watch</h2>
      <p className="mt-1 text-xs text-slate-500">
        Checks official feeds every {watch.pollMinutes} min. A match flags the rule for review; a person
        updates the rules table.
      </p>
      <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
        {watch.feeds.map((f) => (
          <li key={f.id}>
            {"ok" in f && f.ok === false ? "⚠" : "ok" in f && f.ok ? "✓" : "…"} {f.name}
            {"items" in f && f.ok ? ` · ${f.items} items` : ""}
            {"error" in f && f.error ? ` · ${f.error}` : ""}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs font-medium text-slate-700">
        {flagged.length === 0
          ? "No rule flagged."
          : `${flagged.length} rule${flagged.length > 1 ? "s" : ""} flagged: ${flagged.map(([id]) => id).join(", ")}`}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button onClick={onCheck} disabled={busy} className={`${btn} border border-slate-300 text-slate-700`}>
          Check feeds now
        </button>
        <button onClick={onSimulate} disabled={busy} className={`${btn} border border-amber-400 text-amber-800`}>
          4 · Simulate a change to the MHA procedure
        </button>
      </div>
    </section>
  );
}
