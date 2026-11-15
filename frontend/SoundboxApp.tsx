"use client";

import { BrandLogo } from "./BrandLogo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SoundboxSnapshot } from "@backend/api";
import { DEMO_PAYMENT } from "@data/seed";
import { announcePayment, announceRequest, phrasesFor, statusFor } from "@voice/announce";
import { DEFAULT_VOICE_LANGUAGE, isVoiceLanguage, VOICE_LANGUAGES, type VoiceLanguage } from "@voice/languages";
import { useRecorder } from "@voice/useRecorder";
import { inr, when } from "./parts";
import { QrCode } from "./QrCode";
import { buildUpiUri } from "./upi";
import { enqueue, onSpeaking, pauseSpeech, prefetch, resumeSpeech, stopSpeaking, unlockAudio } from "./speech";
import { DemoPill, PAGE, PowerIcon } from "./ui";
import { useLive } from "./useLive";

/** What a payment card needs. Candidates from tag-auto have the same shape. */
type Card = Pick<SoundboxSnapshot["payments"][number], "id" | "amountInr" | "at" | "secondsLeft">;
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
  | { kind: "choose"; transcript: string; source: Source; candidates: Card[] };

/** A tag is one short utterance. */
const MAX_RECORD_MS = 7000;
/** Stop listening after this much quiet once the shopkeeper has spoken. */
const SILENCE_MS = 1200;
/** Pressing longer than this is hold-to-talk: release stops. Shorter is a tap. */
const HOLD_MS = 350;
/** Said instead of a live voice bill when there is no Sarvam key or no mic. */
const DEMO_BILL_PHRASE = `${DEMO_PAYMENT.amountInr} रुपये, ${DEMO_PAYMENT.spokenTag}`;
const METER_BARS = [0.5, 0.8, 1, 0.75, 0.95, 0.6, 0.85, 0.55, 0.9, 0.7, 0.45];

/**
 * The Soundbox on the shop counter (brand from brand.ts), as a phone-screen mock. It
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
  // The mic failed (no permission, no device, plain http on a phone). Without
  // a fallback every open payment would expire untagged on stage, so the box
  // offers the recorded clip, as it does without a Sarvam key.
  const [micFailed, setMicFailed] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  // Bill requests already spoken (by nonce). Null until the first snapshot after power-on.
  const spokenRequests = useRef<Set<string> | null>(null);
  const meter = useRef<HTMLDivElement | null>(null);
  const pressedAt = useRef(0);

  useEffect(() => onSpeaking(setSpeaking), []);

  const onReset = useCallback(() => {
    stopSpeaking();
    seen.current = null;
    spokenRequests.current = null;
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
    (text: string, fallback?: string, prompt = false) => enqueue(text, lang, sarvam, fallback, { prompt }),
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
    if (ask) void say(phrases.ask, english.ask, true);
    setLastId(fresh.at(-1)!.id);
  }, [powered, state, say, lang, phrases, english]);

  // A bill sent with "voice": ask the buyer to pay, once per send. A request
  // already there at power-on is shown, not spoken.
  useEffect(() => {
    if (!powered || !state) return;
    const r = state.request;
    if (spokenRequests.current === null) {
      spokenRequests.current = new Set(r ? [r.nonce] : []);
      return;
    }
    if (!r || r.mode !== "voice" || spokenRequests.current.has(r.nonce)) return;
    spokenRequests.current.add(r.nonce);
    void say(announceRequest(r, lang), announceRequest(r, "en-IN"));
  }, [powered, state, say, lang]);

  const open = useMemo(
    () => (state?.payments ?? []).filter((p) => p.canTag).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    [state],
  );
  const done = useMemo(() => (state?.payments ?? []).filter((p) => !p.canTag), [state]);
  // While choosing, also show candidates the snapshot's short list left out.
  const cards: Card[] = useMemo(() => {
    if (phase.kind !== "choose") return open;
    const extra = phase.candidates.filter((c) => !open.some((p) => p.id === c.id));
    return [...open, ...extra];
  }, [open, phase]);
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
    async (txnId: string, transcript: string, source: Source, candidates: Card[] = []) => {
      setPhase({ kind: "saving", transcript });
      const reply = await call({ action: "tag", txnId, transcript, source });
      if (reply) finishSaved(transcript, txnId);
      else {
        // Keep the words so another card can still be tapped.
        setPhase((p) => (p.kind === "saving" ? { kind: "choose", transcript, source, candidates } : p));
        resumeSpeech();
      }
    },
    [call, finishSaved],
  );

  const submit = useCallback(
    async (transcript: string, source: Source) => {
      if (!transcript.trim()) return;
      if (target) return tagTo(target, transcript, source);
      if (open.length === 0) {
        // Nothing waiting for a tag: the mic makes a bill ("826 रुपये, दो किलो आटा"),
        // which the box then shows as a bill QR and reads out.
        setPhase({ kind: "saving", transcript });
        await call({ action: "bill-voice", transcript });
        setPhase({ kind: "idle" });
        resumeSpeech();
        return;
      }
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
        setPhase({ kind: "choose", transcript, source, candidates: result.candidates });
        resumeSpeech();
        void say(phrases.choose, english.choose, true);
        return;
      }
      setPhase({ kind: "idle" });
      resumeSpeech();
      setError("No payment is waiting for a tag.");
    },
    [target, open, tagTo, call, finishSaved, say, phrases, english, setError],
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
  const onEmpty = useCallback(() => resumeSpeech(), []);
  const recorder = useRecorder(onClip, MAX_RECORD_MS, { onLevel, silenceMs: SILENCE_MS, onEmpty });

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
        setMicFailed(!ok);
        if (!ok) resumeSpeech();
      });
    },
    [recorder, setError],
  );

  const working = phase.kind === "transcribing" || phase.kind === "saving" || busy !== null;
  const micReady = powered && sarvam && !working;
  const request = state?.request ?? null;
  const qrText = state
    ? buildUpiUri(
        request
          ? { pa: state.payee.vpa, pn: state.payee.shopName, am: request.amountInr, tr: request.billId, tn: `Bill ${request.billId}` }
          : { pa: state.payee.vpa, pn: state.payee.shopName },
      )
    : null;

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

  const onCard = (p: Card) => {
    if (working || recorder.recording) return;
    if (phase.kind === "choose") return void tagTo(p.id, phase.transcript, phase.source, phase.candidates);
    if (!sarvam || micFailed) return void tagTo(p.id, DEMO_PAYMENT.spokenTag, "recorded_clip");
    startListening(p.id);
  };

  const powerOn = () => {
    unlockAudio();
    setPowered(true);
    void enqueue(phrases.poweredOn, lang, sarvam, english.poweredOn);
  };

  const words = statusFor(lang);
  const status = recorder.recording
    ? { big: words.listening, small: "Speak now. Tap again or pause to finish." }
    : phase.kind === "transcribing"
      ? { big: words.understanding, small: "Sarvam speech to text" }
      : phase.kind === "saving"
        ? { big: words.saving, small: `“${phase.transcript}”` }
        : phase.kind === "choose"
          ? { big: phrases.choose, small: `“${phase.transcript}” matches more than one payment. Tap the right one.` }
          : open.length > 0
            ? { big: phrases.ask, small: sarvam ? "Hold to talk, or tap once and speak" : "Live speech is off (no SARVAM_API_KEY)" }
            : request
              ? { big: `${inr(request.amountInr)} · ${request.billId}`, small: "Waiting for the buyer to scan the bill QR. Speak again to make a new bill." }
              : { big: phrases.billHint, small: sarvam ? "Say the amount, then what is sold. The box shows the bill QR." : "Live speech is off (no SARVAM_API_KEY)" };

  return (
    <div className={`flex min-h-dvh flex-col items-center ${PAGE} px-4 py-6`}>
      {/* ---------- the device: a white Soundbox in the brand colours ---------- */}
      <div className="relative w-full max-w-sm">
        <div className="rounded-[2.25rem] bg-white p-3 shadow-[0_18px_40px_-14px_rgba(15,23,42,0.35)] ring-1 ring-slate-200">
          {/* top: brand plate, LED */}
          <div className="flex items-center justify-between rounded-t-[1.75rem] rounded-b-xl bg-brand-tint px-4 py-2.5">
            <BrandLogo size={26} />
            <div className="flex items-center gap-2">
              <DemoPill />
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
          <div className="mt-3 rounded-xl bg-brand-navy p-3 font-mono text-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]">
            <div className="flex justify-between text-[11px] opacity-70">
              <span className="truncate">{state?.shopName ?? "…"}</span>
              <span>{langName}</span>
            </div>
            <div className="mt-1 text-4xl font-bold tabular-nums tracking-wider">
              {powered ? (last ? inr(last.amountInr) : "₹ ----") : ""}
            </div>
            <div className="mt-0.5 h-4 text-xs text-brand">
              {powered && last ? (last.billId ? `${last.billId} ✓` : "RECEIVED ✓") : powered ? "READY" : ""}
            </div>
          </div>

          {/* QR screen: the shop QR, or the bill QR while a bill is waiting */}
          {powered && qrText && (
            <div className="mt-3 flex flex-col items-center rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-navy">
                {request ? `Pay this bill · ${request.billId}` : "Scan & pay · any UPI app"}
              </div>
              <QrCode text={qrText} size={220} label={request ? `UPI QR for bill ${request.billId}` : "Shop UPI QR"} />
              {request ? (
                <div className="w-full text-center">
                  <div className="text-2xl font-bold text-slate-900">{inr(request.amountInr)}</div>
                  {request.text && <div className="mt-0.5 text-sm text-slate-700">{request.text}</div>}
                </div>
              ) : (
                <div className="text-sm font-semibold text-slate-900">{state?.payee.shopName}</div>
              )}
              <div className="text-[10px] text-slate-400">DEMO · not a real payment QR</div>
            </div>
          )}

          <div className="h-1" />
        </div>

        {!powered && (
          <button
            onClick={powerOn}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[2.25rem] bg-white/75 text-brand-navy backdrop-blur-sm"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-8 ring-brand/20">
              <PowerIcon className="h-9 w-9" />
            </span>
            <span className="text-lg font-semibold">Tap to switch on</span>
            <span className="text-xs text-slate-600">Needed once so the phone can play sound</span>
          </button>
        )}
      </div>

      {/* ---------- tagging panel ---------- */}
      {powered && (
        <div className="mt-5 w-full max-w-sm space-y-4">
          {/* voice */}
          {(
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
                  recorder.recording ? "bg-red-600" : "bg-brand"
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
              {request && open.length === 0 && phase.kind === "idle" && !recorder.recording && (
                <button
                  onClick={() => void call({ action: "bill-cancel", billId: request.billId })}
                  disabled={working}
                  className="mt-2 block w-full text-sm text-slate-500 underline"
                >
                  Cancel bill {request.billId} · back to shop QR
                </button>
              )}
              {(!sarvam || micFailed) && phase.kind !== "choose" && (
                <button
                  onClick={() =>
                    open.length > 0
                      ? submit(DEMO_PAYMENT.spokenTag, "recorded_clip")
                      : submit(DEMO_BILL_PHRASE, "recorded_clip")
                  }
                  disabled={working}
                  className="mt-2 text-sm text-slate-500 underline"
                >
                  Use recorded clip (“{open.length > 0 ? DEMO_PAYMENT.spokenTag : DEMO_BILL_PHRASE}”)
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
          {cards.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Waiting for a tag · {cards.length}
              </h2>
              <ul className="space-y-2">
                {cards.map((p) => {
                  const hot =
                    phase.kind === "choose" &&
                    (phase.candidates.length === 0 || phase.candidates.some((c) => c.id === p.id));
                  const listeningFor = recorder.recording && target === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => onCard(p)}
                        disabled={working || (recorder.recording && !listeningFor)}
                        className={`flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-left shadow transition active:scale-[0.98] ${
                          hot ? "ring-4 ring-brand" : listeningFor ? "ring-4 ring-red-400" : "ring-1 ring-slate-200"
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
                            {phase.kind === "choose" ? "Tap: this one" : sarvam && !micFailed ? "Tap and speak" : "Tap to tag"}
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

          {open.length === 0 && done.length === 0 && phase.kind === "idle" && !request && (
            <p className="text-center text-sm text-slate-600">Waiting for a payment…</p>
          )}
        </div>
      )}
    </div>
  );
}
