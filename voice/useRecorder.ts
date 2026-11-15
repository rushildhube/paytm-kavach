"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Records a short clip in the browser. The browser only captures audio;
 * recognition happens on the server through Sarvam.
 */
export function useRecorder(onClip: (clip: Blob) => void, maxMs = 7000) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const clip = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (clip.size > 0) onClip(clip);
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      timer.current = setTimeout(stop, maxMs);
    } catch {
      setError("Microphone is not available.");
    }
  }, [onClip, maxMs, stop]);

  return { recording, start, stop, error };
}
