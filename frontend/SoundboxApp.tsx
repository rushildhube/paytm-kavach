"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SoundboxSnapshot } from "@backend/api";
import { DEMO_PAYMENT } from "@data/seed";
import { announcePayment, phrasesFor } from "@voice/announce";
import { DEFAULT_VOICE_LANGUAGE, isVoiceLanguage, VOICE_LANGUAGES, type VoiceLanguage } from "@voice/languages";
import { useRecorder } from "@voice/useRecorder";
import { inr, when } from "./parts";
import { enqueue, onSpeaking, pauseSpeech, prefetch, resumeSpeech, stopSpeaking, unlockAudio } from "./speech";
import { useLive } from "./useLive";

type Payment = SoundboxSnapshot["payments"][number];
type Source = "voice" | "recorded_clip";
type TagAutoResult =
  | { outcome: "bound"; txnId: string; method: string }
  | { outcome: "ambiguous"; candidates: { id: string; amountInr: number; at: string; secondsLeft: number }[] }
  | { outcome: "none_open" };

type Phase =
  | { kind: "idle" }
  | { kind: "transcribing" }
  | { kind: "saving"; transcript: string }
  | { kind: "saved"; transcript: string; txnId: string }
  | { kind: "choose"; transcript: string; source: Source; candidates: string[] };

/** A tag is one short utterance. */
const MAX_RECORD_MS = 7000;
/** Stop listening after this much quiet once the shopkeeper has spoken. */
const SILENCE_MS = 1200;
/** Pressing longer than this is hold-to-talk: release stops. Shorter is a tap. */
const HOLD_MS = 350;
const METER_BARS = [0.5, 0.8, 1, 0.75, 0.95, 0.6, 0.85, 0.55, 0.9, 0.7, 0.45];

/**
 * The Paytm Soundbox on the shop counter, as a phone-screen mock. It
 * announces every payment in the merchant's language, queued so that
 * payments arriving together never cut each other off, and keeps a queue of
 * payments still waiting for a sale tag. The shopkeeper speaks once; the
 * server binds the tag when only one payment is open or the spoken amount
 * matches exactly one, and otherwise the open payments become tap targets.
 * It never guesses, and it never shows reports or holds.
 */
export default function SoundboxApp() {
  const [powered, setPowered] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [target, setTarget] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const meter = useRef<HTMLDivElement | null>(null);
  const pressedAt = useRef(0);

  useEffect(() => onSpeaking(setSpeaking), []);

  const onReset = useCallback(() => {
    stopSpeaking();
    seen.current = null;
    setLastId(null);
    setTarget(null);
    setPhase({ kind: "idle" });
  }, []);
  const { state, error, setError, busy, call } = useLive<SoundboxSnapshot>("soundbox", {
    intervalMs: 800,
    onReset,
  });

  const lang: VoiceLanguage = isVoiceLanguage(state?.language) ? state.language : DEFAULT_VOICE_LANGUAGE;
  const phrases = phrasesFor(lang);
  const english = phrasesFor("en-IN");
  const sarvam = state?.speechConfigured ?? false;
  const langName = VOICE_LANGUAGES.find((l) => l.code === lang)?.native ?? lang;

  const say = useCallback(
    (text: string, fallback?: string) => enqueue(text, lang, sarvam, fallback),
    [lang, sarvam],
  );

  // Fetch the fixed phrases once per language so only the amount costs a call.
  useEffect(() => {
    if (!powered) return;
    for (const t of [phrases.ask, phrases.saved, phrases.choose]) void prefetch(t, lang, sarvam);
  }, [powered, lang, sarvam, phrases]);

  // Announce payments that arrive after power-on, oldest first, one at a time.
  useEffect(() => {
    if (!powered || !state) return;
    if (seen.current === null) {
      seen.current = new Set(state.payments.map((p) => p.id));
      return;
    }
    const fresh = state.payments.filter((p) => !seen.current!.has(p.id)).reverse();
    if (fresh.length === 0) return;
    let ask = false;
    for (const p of fresh) {
      seen.current.add(p.id);
      void say(announcePayment(p, lang), announcePayment(p, "en-IN"));
      if (p.canTag) ask = true;
    }
    if (ask) void say(phrases.ask, english.ask);
    setLastId(fresh.at(-1)!.id);
  }, [powered, state, say, lang, phrases, english]);

  const open = useMemo(
    () => (state?.payments ?? []).filter((p) => p.canTag).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    [state],
  );
  const done = useMemo(() => (state?.payments ?? []).filter((p) => !p.canTag), [state]);
  const last = state?.payments.find((p) => p.id === lastId) ?? null;

  const finishSaved = useCallback(
    (transcript: string, txnId: string) => {
      setPhase({ kind: "saved", transcript, txnId });
      setTarget(null);
      resumeSpeech();
      void say(phrases.saved, english.saved);
    },
    [say, phrases, english],
  );

  /** Bind a transcript to the payment the shopkeeper tapped. */
  const tagTo = useCallback(
    async (txnId: string, transcript: string, source: Source) => {
      setPhase({ kind: "saving", transcript });
      const reply = await call({ action: "tag", txnId, transcript, source });
      if (reply) finishSaved(transcript, txnId);
      else {
        // Keep the words so another card can still be tapped.
        setPhase((p) => (p.kind === "saving" ? { kind: "choose", transcript, source, candidates: [] } : p));
        resumeSpeech();
      }
    },
    [call, finishSaved],
  );

  const submit = useCallback(
    async (transcript: string, source: Source) => {
      if (!transcript.trim()) return;
      if (target) return tagTo(target, transcript, source);
      setPhase({ kind: "saving", transcript });
      const reply = await call<TagAutoResult>({ action: "tag-auto", transcript, source });
      const result = reply?.result;
      if (!result) {
        setPhase({ kind: "idle" });
        resumeSpeech();
        return;
      }
      if (result.outcome === "bound") return finishSaved(transcript, result.txnId);
      if (result.outcome === "ambiguous") {
        setPhase({ kind: "choose", transcript, source, candidates: result.candidates.map((c) => c.id) });
        resumeSpeech();
        void say(phrases.choose, english.choose);
        return;
      }
      setPhase({ kind: "idle" });
      resumeSpeech();
      setError("No payment is waiting for a tag.");
    },
    [target, tagTo, call, finishSaved, say, phrases, english, setError],
  );

  const onClip = useCallback(
    async (clip: Blob) => {
      setError(null);
      setPhase({ kind: "transcribing" });
      try {
        const form = new FormData();
        form.append("audio", clip, "sale.webm");
        form.append("language", lang);
        const res = await fetch("/api/voice/stt", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not understand the audio");
        if (!json.transcript) throw new Error("Nothing heard. Speak again.");
        await submit(json.transcript, "voice");
      } catch (err) {
        setPhase({ kind: "idle" });
        resumeSpeech();
        setError(err instanceof Error ? err.message : "Could not understand the audio");
      }
    },
    [lang, submit, setError],
  );

  const onLevel = useCallback((level: number) => {
    meter.current?.style.setProperty("--lvl", level.toFixed(3));
  }, []);
  const recorder = useRecorder(onClip, MAX_RECORD_MS, { onLevel, silenceMs: SILENCE_MS });

  const startListening = useCallback(
    (forTxn: string | null) => {
      // The box never speaks into the microphone: a spoken "₹500" in the
      // clip could bind the tag to the wrong payment.
      pauseSpeech();
      setTarget(forTxn);
      setError(null);
      setPhase({ kind: "idle" });
      // No microphone: let the announcements carry on.
      void recorder.start().then((ok) => {
        if (!ok) resumeSpeech();
      });
    },
    [recorder, setError],
  );

  const working = phase.kind === "transcribing" || phase.kind === "saving" || busy !== null;
  const micReady = powered && sarvam && open.length > 0 && !working;

  const onMicDown = () => {
    if (recorder.recording) {
      recorder.stop();
      return;
    }
    if (!micReady) return;
    pressedAt.current = Date.now();
    startListening(null);
  };
  const onMicUp = () => {
    if (recorder.recording && pressedAt.current && Date.now() - pressedAt.current > HOLD_MS) {
      recorder.stop();
    }
    pressedAt.current = 0;
  };

  const onCard = (p: Payment) => {
    if (working || recorder.recording) return;
    if (phase.kind === "choose") return void tagTo(p.id, phase.transcript, phase.source);
    if (!sarvam) return void tagTo(p.id, DEMO_PAYMENT.spokenTag, "recorded_clip");
    startListening(p.id);
  };

  const powerOn = () => {
    unlockAudio();
    setPowered(true);
    void enqueue(phrases.poweredOn, lang, sarvam, english.poweredOn);
  };

  const status = recorder.recording
    ? { big: "Listening…", small: "Speak now. Tap again or pause to finish." }
    : phase.kind === "transcribing"
      ? { big: "Understanding…", small: "Sarvam speech to text" }
      : phase.kind === "saving"
        ? { big: "Saving…", small: `“${phase.transcript}”` }
        : phase.kind === "choose"
          ? { big: phrases.choose, small: `“${phase.transcript}” matches more than one payment. Tap the right one.` }
          : open.length > 0
            ? { big: phrases.ask, small: sarvam ? "Hold to talk, or tap once and speak" : "Live speech is off (no SARVAM_API_KEY)" }
            : { big: "", small: "" };

  return (
    <div className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-slate-200 to-slate-300 px-4 py-6">
      {/* ---------- the device ---------- */}
      <div className="relative w-full max-w-sm">
        <div className="rounded-[2.25rem] bg-gradient-to-b from-[#0b2a5b] to-[#071d40] p-3 shadow-[0_20px_40px_-12px_rgba(7,29,64,0.6)] ring-1 ring-black/20">
          {/* top: brand plate, LED */}
          <div className="flex items-center justify-between rounded-t-[1.75rem] rounded-b-xl bg-white px-4 py-2.5">
            <Image src="/brand/paytm-logo.svg" alt="Paytm" width={84} height={26} unoptimized priority />
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Demo
              </span>
              <span
                aria-label={powered ? (recorder.recording ? "listening" : "on") : "off"}
                className={`h-3 w-3 rounded-full ring-2 ring-white ${
                  !powered
                    ? "bg-slate-300"
                    : recorder.recording
                      ? "animate-pulse bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.7)]"
                      : speaking
                        ? "animate-pulse bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.8)]"
                        : "bg-emerald-500"
                }`}
              />
            </div>
          </div>

          {/* LCD */}
          <div className="mt-3 rounded-xl bg-[#c9d8b6] p-3 font-mono text-[#1d2a12] shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]">
            <div className="flex justify-between text-[11px] opacity-70">
              <span className="truncate">{state?.shopName ?? "…"}</span>
              <span>{langName}</span>
            </div>
            <div className="mt-1 text-4xl font-bold tabular-nums tracking-wider">
              {powered ? (last ? inr(last.amountInr) : "₹ ----") : ""}
            </div>
            <div className="mt-0.5 h-4 text-xs">
              {powered && last ? (last.billId ? `${last.billId} ✓` : "RECEIVED ✓") : powered ? "READY" : ""}
            </div>
          </div>

          {/* speaker grille */}
          <div className="relative mx-auto mt-4 aspect-square w-44 rounded-full bg-[#0a2450] p-3 shadow-[inset_0_3px_8px_rgba(0,0,0,0.6)]">
            <div
              className={`h-full w-full rounded-full transition-opacity ${speaking ? "opacity-100" : "opacity-70"}`}
              style={{
                backgroundImage: "radial-gradient(circle, #6b84b3 1.6px, transparent 1.9px)",
                backgroundSize: "9px 9px",
                WebkitMaskImage: "radial-gradient(circle, #000 68%, transparent 70%)",
                maskImage: "radial-gradient(circle, #000 68%, transparent 70%)",
              }}
            />
            {speaking && <div className="absolute inset-0 animate-ping rounded-full ring-2 ring-[#00BAF2]/40" />}
          </div>

          {/* physical buttons */}
          <div className="mt-4 flex justify-center gap-6 pb-1">
            {["−", "⏻", "+"].map((b) => (
              <span
                key={b}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#123366] text-sm text-white/70 shadow-[0_2px_0_#051534]"
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        {!powered && (
          <button
            onClick={powerOn}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[2.25rem] bg-black/80 text-white"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#00BAF2] text-3xl">⏻</span>
            <span className="text-lg font-semibold">Tap to switch on</span>
            <span className="text-xs text-slate-300">Needed once so the phone can play sound</span>
          </button>
        )}
      </div>

      {/* ---------- tagging panel ---------- */}
      {powered && (
        <div className="mt-5 w-full max-w-sm space-y-4">
          {/* voice */}
          {(open.length > 0 || phase.kind !== "idle" || recorder.recording) && (
            <div className="rounded-3xl bg-white p-4 text-center shadow">
              {status.big && <p className="text-xl font-semibold text-slate-900">{status.big}</p>}
              {status.small && <p className="mt-1 text-sm text-slate-500">{status.small}</p>}

              <button
                onPointerDown={onMicDown}
                onPointerUp={onMicUp}
                onPointerLeave={onMicUp}
                onContextMenu={(e) => e.preventDefault()}
                disabled={!recorder.recording && !micReady}
                aria-label={recorder.recording ? "Stop" : "Speak"}
                className={`relative mx-auto mt-4 flex h-28 w-28 touch-none select-none items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-40 ${
                  recorder.recording ? "bg-red-600" : "bg-[#00BAF2]"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-12 w-12" fill="currentColor" aria-hidden>
                  <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
                </svg>
                {working && <span className="absolute inset-0 animate-spin rounded-full border-4 border-white/30 border-t-white" />}
              </button>

              {/* level meter, driven by --lvl without re-rendering */}
              <div ref={meter} className="mx-auto mt-3 flex h-8 items-center justify-center gap-1" style={{ ["--lvl" as string]: 0 }}>
                {METER_BARS.map((w, i) => (
                  <span
                    key={i}
                    className={`h-8 w-1.5 origin-center rounded-full transition-transform duration-75 ${recorder.recording ? "bg-red-500" : "bg-slate-200"}`}
                    style={{ transform: `scaleY(calc(0.12 + var(--lvl) * ${w}))` }}
                  />
                ))}
              </div>

              {phase.kind === "choose" && (
                <button
                  onClick={() => setPhase({ kind: "idle" })}
                  className="mt-2 text-sm text-slate-500 underline"
                >
                  Discard and speak again
                </button>
              )}
              {!sarvam && open.length > 0 && phase.kind !== "choose" && (
                <button
                  onClick={() => submit(DEMO_PAYMENT.spokenTag, "recorded_clip")}
                  disabled={working}
                  className="mt-2 text-sm text-slate-500 underline"
                >
                  Use recorded clip (“{DEMO_PAYMENT.spokenTag}”)
                </button>
              )}
            </div>
          )}

          {phase.kind === "saved" && (
            <div className="rounded-3xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
              <div className="text-sm font-medium text-emerald-700">🛡 {phrases.saved}</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">“{phase.transcript}”</div>
              <div className="mt-1 text-xs text-emerald-700">Saved with the payment. Cannot be changed later.</div>
            </div>
          )}

          {(error || recorder.error) && (
            <p className="rounded-2xl bg-red-50 p-3 text-center text-sm text-red-700">{error ?? recorder.error}</p>
          )}

          {/* open payments */}
          {open.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Waiting for a tag · {open.length}
              </h2>
              <ul className="space-y-2">
                {open.map((p) => {
                  const hot = phase.kind === "choose" && (phase.candidates.length === 0 || phase.candidates.includes(p.id));
                  const listeningFor = recorder.recording && target === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => onCard(p)}
                        disabled={working || (recorder.recording && !listeningFor)}
                        className={`flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-left shadow transition active:scale-[0.98] ${
                          hot ? "ring-4 ring-[#00BAF2]" : listeningFor ? "ring-4 ring-red-400" : "ring-1 ring-slate-200"
                        }`}
                      >
                        <span>
                          <span className="block text-2xl font-bold text-slate-900">{inr(p.amountInr)}</span>
                          <span className="text-xs text-slate-500">{when(p.at)}</span>
                        </span>
                        <span className="text-right">
                          <span
                            className={`block text-lg font-semibold tabular-nums ${p.secondsLeft <= 20 ? "text-red-600" : "text-slate-700"}`}
                          >
                            {p.secondsLeft}s
                          </span>
                          <span className="text-xs text-slate-500">
                            {phase.kind === "choose" ? "Tap: this one" : sarvam ? "Tap and speak" : "Tap to tag"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                A tag can only be added within {state?.tagWindowSeconds ?? 120}s of the payment. Never later.
              </p>
            </section>
          )}

          {/* recent */}
          {done.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Recent</h2>
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white/80 shadow-sm">
                {done.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="font-semibold text-slate-900">{inr(p.amountInr)}</span>
                    <span className="truncate text-right text-slate-600">
                      {p.transcript
                        ? `${p.billId ? `${p.billId} · ` : "🛡 "}${p.transcript}`
                        : p.billId
                          ? `${p.billId} paid`
                          : p.needsTag
                            ? "Not tagged (window closed)"
                            : `Under ${inr(state?.thresholdInr ?? 500)}, no tag needed`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {open.length === 0 && done.length === 0 && phase.kind === "idle" && (
            <p className="text-center text-sm text-slate-600">Waiting for a payment…</p>
          )}
        </div>
      )}
    </div>
  );
}
