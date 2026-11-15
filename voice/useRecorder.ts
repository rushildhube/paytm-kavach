"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderOptions = {
  /**
   * Called about 30 times a second with the input level (0–1) while
   * recording. Drive a meter through a ref with it; it does not re-render.
   */
  onLevel?: (level: number) => void;
  /** Stop after this much quiet once speech was heard. 0 turns it off. */
  silenceMs?: number;
  /** Called instead of `onClip` when the recording came out empty. */
  onEmpty?: () => void;
};

/** RMS above this counts as speech. Tuned for a phone mic at arm's length. */
const SPEECH_LEVEL = 0.04;

/**
 * Records a short clip in the browser. The browser only captures audio;
 * recognition happens on the server through Sarvam.
 *
 * Stops on `stop()`, after `maxMs`, or (with `silenceMs`) once the speaker
 * has said something and gone quiet. Echo cancellation and noise
 * suppression are requested so the Soundbox's own voice and shop noise are
 * kept out of the clip.
 */
export function useRecorder(
  onClip: (clip: Blob) => void,
  maxMs = 7000,
  { onLevel, silenceMs = 0, onEmpty }: RecorderOptions = {},
) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const meterCtx = useRef<AudioContext | null>(null);
  const clipRef = useRef(onClip);
  const levelRef = useRef(onLevel);
  const emptyRef = useRef(onEmpty);
  useEffect(() => {
    clipRef.current = onClip;
    levelRef.current = onLevel;
    emptyRef.current = onEmpty;
  }, [onClip, onLevel, onEmpty]);

  const stopMeter = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    void meterCtx.current?.close().catch(() => {});
    meterCtx.current = null;
    levelRef.current?.(0);
  }, []);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  /** Resolves true once recording has started, false if the mic is unavailable. */
  const start = useCallback(async (): Promise<boolean> => {
    if (recorder.current?.state === "recording") return true;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopMeter();
        setRecording(false);
        const clip = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (clip.size > 0) clipRef.current(clip);
        else emptyRef.current?.();
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      timer.current = setTimeout(stop, maxMs);

      // Level meter and silence detection share one analyser.
      try {
        const ctx = new AudioContext();
        meterCtx.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Float32Array(analyser.fftSize);
        const startedAt = performance.now();
        let heard = false;
        let quietSince = performance.now();
        const tick = () => {
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += v * v;
          const rms = Math.sqrt(sum / data.length);
          levelRef.current?.(Math.min(1, rms * 6));
          const t = performance.now();
          if (rms > SPEECH_LEVEL) {
            heard = true;
            quietSince = t;
          }
          if (silenceMs > 0 && heard && t - quietSince > silenceMs && t - startedAt > 800) {
            stop();
            return;
          }
          frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
      } catch {
        // No meter; recording still works and stops on tap or at maxMs.
      }
      return true;
    } catch {
      setError("Microphone is not available.");
      return false;
    }
  }, [maxMs, silenceMs, stop, stopMeter]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stopMeter();
    },
    [stopMeter],
  );

  return { recording, start, stop, error };
}
