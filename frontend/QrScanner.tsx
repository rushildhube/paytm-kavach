"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { BRAND } from "./brand";
import { BrandLogo } from "./BrandLogo";

/**
 * Full-screen camera QR scanner in the style of Paytm's "Scan any QR".
 * Uses the back camera (getUserMedia, needs HTTPS on phones), decodes frames
 * with jsQR, and stops the camera when it unmounts.
 *
 * `onDecode` gets every QR found. Return null to accept it (the parent then
 * moves on and unmounts the scanner) or a message to show while scanning goes on.
 */
export function QrScanner({
  onDecode,
  onCancel,
  onFallback,
  fallbackLabel = "Can't scan? Pick the shop",
}: {
  onDecode: (text: string) => string | null;
  onCancel: () => void;
  onFallback?: () => void;
  fallbackLabel?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const decodeRef = useRef(onDecode);
  const [camError, setCamError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    decodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastRejected = "";
    let rejectedAt = 0;
    const videoEl = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (stopped) return;
      const video = videoEl;
      if (video && ctx && video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        const scale = Math.min(1, 480 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        // A refused QR is retried after 1.5 s (e.g. it was scanned before the shop data loaded).
        if (code?.data && (code.data !== lastRejected || performance.now() - rejectedAt > 1500)) {
          const problem = decodeRef.current(code.data);
          if (problem === null) {
            stopped = true;
            return;
          }
          lastRejected = code.data;
          rejectedAt = performance.now();
          setNotice(problem);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      // Plain http on a phone: no camera API at all.
      queueMicrotask(() =>
        setCamError("Camera needs HTTPS. Open this page with https:// (npm run dev:lan) or pick the shop below."),
      );
    } else {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        .then((s) => {
          if (stopped) {
            // Unmounted while the permission prompt was open.
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          stream = s;
          const video = videoEl;
          if (video) {
            video.srcObject = s;
            void video.play().catch(() => {});
          }
          raf = requestAnimationFrame(tick);
        })
        .catch((err: unknown) => {
          if (stopped) return;
          const name = err instanceof DOMException ? err.name : "";
          setCamError(
            name === "NotAllowedError"
              ? "Camera permission was denied. Allow it in the browser, or pick the shop below."
              : "Could not open the camera. Pick the shop below.",
          );
        });
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoEl) videoEl.srcObject = null;
    };
  }, []);

  /** Decode a QR from a photo or screenshot (handy on a laptop). */
  const fromFile = async (file: File) => {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height);
      if (!code?.data) return setNotice("No QR code found in that image");
      const problem = decodeRef.current(code.data);
      if (problem) setNotice(problem);
    } catch {
      setNotice("Could not read that image");
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-black text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />
      <header className="relative z-10 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-6 pt-4">
        <button onClick={onCancel} aria-label="Back" className="text-2xl leading-none">
          ←
        </button>
        <span className="text-lg font-semibold">Scan any QR</span>
        <span className="ml-auto flex items-center gap-2">
          <BrandLogo variant="mark" size={22} />
          <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">Demo</span>
        </span>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative h-64 w-64 overflow-hidden">
          {[
            "left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl",
            "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl",
            "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl",
            "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl",
          ].map((c) => (
            <span key={c} className={`absolute h-12 w-12 border-white ${c}`} />
          ))}
          {!camError && <span className="kavach-scanline absolute inset-x-3 h-0.5 bg-brand shadow-[0_0_12px_var(--brand-primary)]" />}
        </div>
        <p className="mt-6 text-center text-sm text-white/85">
          {camError ?? `Point at the shop's ${BRAND.name} QR code`}
        </p>
        {notice && (
          <p role="status" className="mt-3 rounded-lg bg-red-600/90 px-3 py-2 text-center text-sm">
            {notice}
          </p>
        )}
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-6 pb-8 pt-10">
        <label className="cursor-pointer rounded-full border border-white/50 px-5 py-2 text-sm">
          Upload QR image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void fromFile(f);
            }}
          />
        </label>
        {onFallback && (
          <button onClick={onFallback} className="text-sm text-white/80 underline">
            {fallbackLabel}
          </button>
        )}
        <p className="text-[11px] text-white/50">Demo app. No real money moves.</p>
      </footer>
    </div>
  );
}
