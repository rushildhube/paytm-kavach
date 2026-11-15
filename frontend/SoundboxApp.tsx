"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SoundboxSnapshot } from "@backend/api";
import { DEMO_PAYMENT } from "@data/seed";
import { useRecorder } from "@voice/useRecorder";
import { inr } from "./parts";
import { speak, stopSpeaking, unlockAudio } from "./speech";
import { useLive } from "./useLive";

/**
 * The Paytm Soundbox on the shop counter. It announces each payment and,
 * for payments at or above the threshold, asks what was sold and records
 * the shopkeeper's answer as proof of sale. It never shows reports or holds.
 */
export default function SoundboxApp() {
  const [powered, setPowered] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  const onReset = useCallback(() => {
    stopSpeaking();
    seen.current = null;
    setCurrentId(null);
  }, []);
  const { state, error, setError, busy, call } = useLive<SoundboxSnapshot>("soundbox", {
    intervalMs: 800,
    onReset,
  });

  const say = useCallback(
    async (text: string) => {
      setSpeaking(true);
      await speak(text, state?.speechConfigured ?? false);
      setSpeaking(false);
    },
    [state?.speechConfigured],
  );

  // Announce payments that arrive after the box is switched on.
  useEffect(() => {
    if (!powered || !state) return;
    if (seen.current === null) {
      seen.current = new Set(state.payments.map((p) => p.id));
      return;
    }
    const fresh = state.payments.find((p) => !seen.current!.has(p.id));
    if (!fresh) return;
    seen.current.add(fresh.id);
    setCurrentId(fresh.id);
    void (async () => {
      await say(`पेटीएम पर ${fresh.amountInr} रुपये प्राप्त हुए।`);
      if (fresh.needsTag) await say("क्या बेचा? बोलकर बताइए।");
    })();
  }, [powered, state, say]);

  const current = state?.payments.find((p) => p.id === currentId) ?? null;

  const saveTag = useCallback(
    async (transcript: string, source: "voice" | "recorded_clip") => {
      if (!current) return;
      const reply = await call({ action: "tag", txnId: current.id, transcript, source });
      if (reply) void say("बिक्री दर्ज हो गई। धन्यवाद।");
    },
    [call, current, say],
  );

  const onClip = useCallback(
    async (clip: Blob) => {
      setError(null);
      try {
        const form = new FormData();
        form.append("audio", clip, "sale.webm");
        const res = await fetch("/api/voice/stt", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "आवाज़ समझ नहीं आई");
        if (!json.transcript) throw new Error("कुछ सुनाई नहीं दिया। फिर से बोलिए।");
        await saveTag(json.transcript, "voice");
      } catch (err) {
        setError(err instanceof Error ? err.message : "आवाज़ समझ नहीं आई");
      }
    },
    [saveTag, setError],
  );
  const recorder = useRecorder(onClip);

  const powerOn = () => {
    unlockAudio();
    setPowered(true);
    void say("साउंडबॉक्स चालू है।");
  };

  const asking = current && current.needsTag && !current.transcript && current.canTag;
  const missed = current && current.needsTag && !current.transcript && !current.canTag;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-800 p-4">
      <div className="relative w-full max-w-sm rounded-[2.5rem] bg-gradient-to-b from-slate-900 to-black p-6 shadow-2xl ring-1 ring-white/10">
        {/* brand strip */}
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-[#00BAF2] px-2 py-0.5 text-sm font-bold text-white">paytm</span>
          <span className="text-xs text-slate-400">Soundbox · demo</span>
          <span
            className={`h-3 w-3 rounded-full ${powered ? (speaking ? "animate-pulse bg-emerald-400" : "bg-emerald-500") : "bg-slate-600"}`}
            aria-label={powered ? "on" : "off"}
          />
        </div>

        {/* display */}
        <div className="mt-5 rounded-2xl bg-[#0d1f16] p-4 font-mono text-emerald-300 shadow-inner">
          <div className="truncate text-xs text-emerald-500/80">{state?.shopName ?? "…"}</div>
          {current ? (
            <>
              <div className="mt-1 text-4xl font-bold tracking-wide">{inr(current.amountInr)}</div>
              <div className="mt-1 text-sm">प्राप्त हुए ✓</div>
            </>
          ) : (
            <div className="mt-2 text-lg">{powered ? "पेमेंट का इंतज़ार…" : "बंद है"}</div>
          )}
        </div>

        {/* speaker grill */}
        <div className="mx-auto mt-5 grid w-40 grid-cols-8 gap-1.5">
          {Array.from({ length: 32 }).map((_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${speaking ? "bg-slate-500" : "bg-slate-700"}`} />
          ))}
        </div>

        {/* tagging */}
        <div className="mt-5 min-h-40">
          {asking && (
            <div className="text-center">
              <p className="text-lg font-semibold text-white">क्या बेचा? बोलकर बताइए</p>
              <button
                onClick={recorder.recording ? recorder.stop : recorder.start}
                disabled={!state?.speechConfigured || (busy !== null && !recorder.recording)}
                className={`mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-full text-4xl shadow-lg transition active:scale-95 disabled:opacity-40 ${
                  recorder.recording ? "animate-pulse bg-red-600" : "bg-[#00BAF2]"
                }`}
                aria-label={recorder.recording ? "रोकें" : "बोलिए"}
              >
                🎙
              </button>
              <p className="mt-2 text-xs text-slate-400">
                {recorder.recording
                  ? "सुन रहे हैं… दोबारा दबाकर रोकें"
                  : busy === "tag"
                    ? "दर्ज कर रहे हैं…"
                    : `${current.secondsLeft} सेकंड बाकी · बाद में नहीं जोड़ सकते`}
              </p>
              <button
                onClick={() => saveTag(DEMO_PAYMENT.spokenTag, "recorded_clip")}
                disabled={busy !== null || recorder.recording}
                className="mt-3 text-xs text-slate-400 underline"
              >
                Use recorded clip
              </button>
              {!state?.speechConfigured && (
                <p className="mt-1 text-[11px] text-amber-400">Live speech is off (no SARVAM_API_KEY).</p>
              )}
            </div>
          )}

          {current?.transcript && (
            <div className="rounded-2xl bg-emerald-950/60 p-4 text-center text-emerald-200">
              <div className="text-sm">🛡 बिक्री दर्ज हो गई</div>
              <div className="mt-1 text-xl font-semibold text-white">“{current.transcript}”</div>
              <div className="mt-1 text-[11px] text-emerald-400">
                Saved with the payment. Cannot be changed later.
              </div>
            </div>
          )}

          {missed && (
            <p className="text-center text-sm text-slate-400">
              समय निकल गया। यह बिक्री अब दर्ज नहीं हो सकती।
            </p>
          )}

          {current && !current.needsTag && (
            <p className="text-center text-sm text-slate-400">
              {inr(state?.thresholdInr ?? 500)} से कम, बिक्री बताने की ज़रूरत नहीं।
            </p>
          )}

          {(error || recorder.error) && (
            <p className="mt-2 text-center text-sm text-red-400">{error ?? recorder.error}</p>
          )}
        </div>

        {!powered && (
          <button
            onClick={powerOn}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[2.5rem] bg-black/85 text-white"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#00BAF2] text-3xl">⏻</span>
            <span className="text-lg font-semibold">Tap to switch on</span>
            <span className="text-xs text-slate-400">Needed once so the phone can play sound</span>
          </button>
        )}
      </div>
    </div>
  );
}
