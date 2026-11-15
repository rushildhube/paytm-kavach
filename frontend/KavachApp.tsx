"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Draft } from "@agent/drafts";
import type { Packet, Snapshot } from "@backend/api";
import { DEMO_PAYMENT } from "@data/seed";
import { useRecorder } from "@voice/useRecorder";
import { CertificateCard, Disclaimer, DraftCard, inr, when } from "./parts";

type Reply<T> = { result: T; state: Snapshot };
type Answers = { lentAccount: boolean | null; receivedForCommission: boolean | null };
const NO_ANSWERS: Answers = { lentAccount: null, receivedForCommission: null };

const btn =
  "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export default function KavachApp() {
  const [state, setState] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<Draft | null>(null);
  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS);
  const [packet, setPacket] = useState<Packet | null>(null);
  const [escalation, setEscalation] = useState<Draft | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const call = useCallback(
    async <T,>(body: Record<string, unknown>): Promise<Reply<T> | null> => {
      setBusy(String(body.action));
      setError(null);
      try {
        const res = await fetch("/api/kavach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Something went wrong");
        setState(json.state);
        return json as Reply<T>;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  useEffect(() => {
    let live = true;
    fetch("/api/kavach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "state" }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!live) return;
        if (json.state) setState(json.state);
        else setError(json.error ?? "Could not load");
      })
      .catch(() => live && setError("Could not load"));
    return () => {
      live = false;
    };
  }, []);

  /** Speak through Sarvam. Silent no-op if speech is not configured. */
  const speak = useCallback(
    async (text: string) => {
      if (!state?.speechConfigured) return;
      try {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        audio.current?.pause();
        audio.current = new Audio(URL.createObjectURL(await res.blob()));
        await audio.current.play();
      } catch {
        // Audio is a nicety; the text is always on screen.
      }
    },
    [state?.speechConfigured],
  );

  const pending = state?.transactions.find((t) => t.canTag) ?? null;
  const latest = state?.transactions[0] ?? null;
  const hold = state?.hold ?? null;

  const saveTag = useCallback(
    async (transcript: string, source: "voice" | "recorded_clip") => {
      if (!pending) return;
      await call({ action: "tag", txnId: pending.id, transcript, source });
    },
    [call, pending],
  );

  const onClip = useCallback(
    async (clip: Blob) => {
      setBusy("listening");
      setError(null);
      try {
        const form = new FormData();
        form.append("audio", clip, "sale.webm");
        const res = await fetch("/api/voice/stt", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not understand the audio");
        if (!json.transcript) throw new Error("Nothing was heard. Please say it again.");
        await saveTag(json.transcript, "voice");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not understand the audio");
        setBusy(null);
      }
    },
    [saveTag],
  );
  const recorder = useRecorder(onClip);

  // ---- demo controls -------------------------------------------------------

  const pay = async () => {
    const reply = await call<{ needsTag: boolean }>({ action: "pay" });
    if (reply) {
      void speak(
        `पेटीएम पर ${DEMO_PAYMENT.amountInr} रुपये प्राप्त हुए। क्या बेचा, बताइए।`,
      );
    }
  };

  const triggerHold = async () => {
    if (!latest) return;
    const placed = await call<{ id: string }>({ action: "hold", txnId: latest.id });
    if (!placed) return;
    const reply = await call<Draft>({ action: "explain", holdId: placed.result.id });
    if (reply) {
      setExplanation(reply.result);
      void speak(reply.result.text);
    }
  };

  const preparePacket = async () => {
    if (!hold || answers.lentAccount === null || answers.receivedForCommission === null) return;
    const reply = await call<Packet>({ action: "packet", holdId: hold.id, answers });
    if (reply) setPacket(reply.result);
  };

  const day15 = async () => {
    if (!hold || !state?.tracker) return;
    const days = state.tracker.escalateAfterDays - (state.tracker.daysSinceFiled ?? 0);
    const moved = await call({ action: "advance", days: Math.max(days, 1) });
    if (moved?.state.tracker?.stage === "escalation_due") {
      const reply = await call<Draft>({ action: "escalation", holdId: hold.id });
      if (reply) setEscalation(reply.result);
    }
  };

  const reset = async () => {
    audio.current?.pause();
    setExplanation(null);
    setAnswers(NO_ANSWERS);
    setPacket(null);
    setEscalation(null);
    await call({ action: "reset" });
  };

  if (!state) {
    return <div className="p-10 text-slate-500">{error ?? "Loading…"}</div>;
  }

  const tracker = state.tracker;
  const filed = tracker && tracker.stage !== "not_filed";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:flex-row lg:items-start lg:p-8">
      {/* ---------------- merchant phone ---------------- */}
      <main className="mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 shadow-xl">
        <header className={`px-5 py-4 text-white ${hold ? "bg-red-600" : "bg-[#002E6E]"}`}>
          <div className="text-xs opacity-80">Paytm for Business · Kavach</div>
          <div className="text-lg font-semibold">{state.merchant.shopName}</div>
          <div className="text-xs opacity-80">
            {state.merchant.city} · A/c •••• {state.merchant.accountLast4}
            {state.simulatedDays > 0 && ` · simulated day ${state.simulatedDays}`}
          </div>
        </header>

        <div className="space-y-4 p-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {/* hold alert */}
          {hold && (
            <section className="rounded-xl border-2 border-red-500 bg-red-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Hold on one payment
              </div>
              <div className="mt-1 text-3xl font-bold text-red-700">
                {inr(hold.heldAmountInr)} पर रोक
              </div>
              <p className="mt-1 text-sm font-medium text-red-900">
                सिर्फ़ इस एक पेमेंट पर, पूरे खाते पर नहीं। यह कोई आरोप नहीं है।
              </p>
              <p className="mt-1 text-xs text-red-800">
                Reference {hold.reference} · {when(hold.placedAt)}
              </p>
              {explanation ? (
                <div className="mt-3 rounded-lg bg-white p-3">
                  <p className="text-[15px] leading-relaxed text-slate-900">{explanation.text}</p>
                  {state.speechConfigured && (
                    <button
                      onClick={() => speak(explanation.text)}
                      className="mt-2 text-sm font-semibold text-[#002E6E]"
                    >
                      ▶ सुनिए
                    </button>
                  )}
                </div>
              ) : (
                busy === "explain" && <p className="mt-3 text-sm text-red-800">समझा रहे हैं…</p>
              )}
            </section>
          )}

          {/* mule screen */}
          {hold && explanation && !packet && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900">दो छोटे सवाल</h3>
              <Question
                text="क्या आपने यह खाता या QR किसी और को इस्तेमाल करने दिया?"
                sub="Did you let anyone else use this account or QR?"
                value={answers.lentAccount}
                onChange={(v) => setAnswers((a) => ({ ...a, lentAccount: v }))}
              />
              <Question
                text="क्या आपने किसी और के लिए पैसा लेकर आगे भेजा या कमीशन लिया?"
                sub="Did you receive money for someone else, or for a commission?"
                value={answers.receivedForCommission}
                onChange={(v) => setAnswers((a) => ({ ...a, receivedForCommission: v }))}
              />
              <button
                onClick={preparePacket}
                disabled={
                  busy !== null ||
                  answers.lentAccount === null ||
                  answers.receivedForCommission === null
                }
                className={`${btn} mt-3 w-full bg-[#002E6E] text-white`}
              >
                {busy === "packet" ? "काग़ज़ तैयार हो रहे हैं…" : "मेरे काग़ज़ तैयार कीजिए"}
              </button>
            </section>
          )}

          {/* packet */}
          {packet && packet.eligibility.outcome !== "eligible" && (
            <section className="rounded-xl border border-slate-300 bg-white p-4">
              <h3 className="font-semibold text-slate-900">
                {packet.eligibility.outcome === "legal_aid"
                  ? "कृपया कानूनी सहायता लीजिए"
                  : "Certificate not available"}
              </h3>
              <p className="mt-1 text-sm text-slate-700">{packet.eligibility.reason}</p>
              {"referral" in packet && packet.referral && (
                <>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-900">{packet.referral.hi}</p>
                  <p className="mt-1 text-sm text-slate-600">{packet.referral.en}</p>
                </>
              )}
            </section>
          )}

          {packet && "certificate" in packet && (
            <>
              <CertificateCard cert={packet.certificate} />
              <DraftCard
                title="Grievance to your bank"
                draft={packet.grievance}
                filename={`grievance-${packet.certificate.hold.reference}.txt`}
                alerts={state.lawWatch.alertsByRule}
              />
              {!filed && (
                <button
                  onClick={() => hold && call({ action: "filed", holdId: hold.id })}
                  disabled={busy !== null}
                  className={`${btn} w-full border border-[#002E6E] bg-white text-[#002E6E]`}
                >
                  मैंने इसे अपने बैंक में जमा कर दिया है
                </button>
              )}
            </>
          )}

          {/* tracker */}
          {filed && tracker && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900">Grievance tracker</h3>
              <ol className="mt-2 space-y-2 text-sm">
                {state.ladder.steps.map((step, i) => (
                  <li
                    key={step.level}
                    className={`rounded-lg p-2 ${i === tracker.currentStep ? "bg-blue-50 font-medium text-[#002E6E]" : "text-slate-500"}`}
                  >
                    {step.level}. {step.to}
                    <div className="text-[11px] font-normal">{step.deadline}</div>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-sm text-slate-700">
                Day {tracker.daysSinceFiled} since you complained at your bank.{" "}
                {tracker.stage === "escalation_due"
                  ? `No decision after ${tracker.escalateAfterDays} days. A letter to the next level is ready below.`
                  : `If there is no decision by day ${tracker.escalateAfterDays}, Kavach will draft a letter to the next level.`}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {state.ladder.placeholder
                  ? `The ${tracker.escalateAfterDays}-day figure is a demo placeholder, not a verified deadline.`
                  : state.ladder.note}
              </p>
            </section>
          )}

          {escalation && (
            <DraftCard
              title="Escalation letter"
              draft={escalation}
              filename={`escalation-${hold?.reference ?? "draft"}.txt`}
              alerts={state.lawWatch.alertsByRule}
            />
          )}

          {(hold || packet) && <Disclaimer text={`${state.disclaimerHi} ${state.disclaimer}`} />}

          {/* tag prompt */}
          {pending && !hold && (
            <section className="rounded-xl bg-[#00BAF2] p-4 text-[#002E6E]">
              <div className="text-sm font-medium">Payment received</div>
              <div className="text-4xl font-bold">{inr(pending.amountInr)}</div>
              <p className="mt-1 text-base font-semibold">क्या बेचा? बोलकर बताइए</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={recorder.recording ? recorder.stop : recorder.start}
                  disabled={!state.speechConfigured || (busy !== null && !recorder.recording)}
                  className={`${btn} ${recorder.recording ? "bg-red-600 text-white" : "bg-[#002E6E] text-white"}`}
                >
                  {recorder.recording
                    ? "● सुन रहे हैं… रोकें"
                    : busy === "listening"
                      ? "समझ रहे हैं…"
                      : "🎙 बोलिए"}
                </button>
                <button
                  onClick={() => saveTag(DEMO_PAYMENT.spokenTag, "recorded_clip")}
                  disabled={busy !== null || recorder.recording}
                  className={`${btn} bg-white/80 text-[#002E6E]`}
                >
                  Use recorded clip
                </button>
              </div>
              <p className="mt-2 text-xs">
                {state.speechConfigured
                  ? `${pending.secondsLeft}s left to tag this sale. It cannot be added later.`
                  : "Live speech is off (no SARVAM_API_KEY). Use the recorded clip."}
              </p>
              {recorder.error && <p className="mt-1 text-xs text-red-800">{recorder.error}</p>}
            </section>
          )}

          {/* sales */}
          <section className="rounded-xl bg-white p-4">
            <h3 className="font-semibold text-slate-900">Today&apos;s payments</h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {state.transactions.map((t) => (
                <li key={t.id} className="py-2">
                  <div className="flex items-baseline justify-between">
                    <span className={`font-semibold ${t.hold ? "text-red-600" : "text-slate-900"}`}>
                      {inr(t.amountInr)}
                      {t.hold && <span className="ml-2 text-xs font-medium">on hold</span>}
                    </span>
                    <span className="text-xs text-slate-500">{when(t.at)}</span>
                  </div>
                  <div className="text-xs text-slate-500">from {t.payerVpaMasked}</div>
                  {t.tag ? (
                    <div className="mt-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-sm text-emerald-800">
                      🛡 {t.tag.transcript}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-slate-400">
                      {t.amountInr < state.thresholdInr
                        ? `Below ${inr(state.thresholdInr)}, not tagged`
                        : t.canTag
                          ? "Waiting for tag"
                          : "Not tagged"}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      {/* ---------------- demo controls ---------------- */}
      <aside className="w-full rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-8 lg:max-w-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Demo controls</h2>
        <p className="mt-1 text-xs text-slate-500">
          These stand in for Paytm&apos;s payment and hold events. Synthetic data only.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button onClick={pay} disabled={busy !== null || !!hold || !!pending} className={`${btn} bg-[#00BAF2] text-[#002E6E]`}>
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
            onClick={day15}
            disabled={busy !== null || !filed || tracker?.stage === "escalation_due"}
            className={`${btn} bg-slate-800 text-white`}
          >
            3 · Simulate day {tracker?.escalateAfterDays ?? 15}
          </button>
          <button onClick={reset} disabled={busy !== null} className={`${btn} border border-slate-300 text-slate-700`}>
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
    </div>
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

function Question({
  text,
  sub,
  value,
  onChange,
}: {
  text: string;
  sub: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const pill = (selected: boolean) =>
    `rounded-lg border px-4 py-1.5 text-sm font-semibold ${
      selected ? "border-[#002E6E] bg-[#002E6E] text-white" : "border-slate-300 text-slate-700"
    }`;
  return (
    <div className="mt-3">
      <p className="text-[15px] text-slate-900">{text}</p>
      <p className="text-xs text-slate-500">{sub}</p>
      <div className="mt-1.5 flex gap-2">
        <button className={pill(value === true)} onClick={() => onChange(true)}>
          हाँ
        </button>
        <button className={pill(value === false)} onClick={() => onChange(false)}>
          नहीं
        </button>
      </div>
    </div>
  );
}
