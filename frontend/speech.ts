"use client";

/**
 * Speak Hindi text. Uses Sarvam (through the server route) when it is
 * configured, otherwise the browser's own Hindi voice, so the Soundbox is
 * never silent on stage. Resolves when speaking has finished.
 */
let current: HTMLAudioElement | null = null;

export async function speak(text: string, useSarvam: boolean): Promise<void> {
  stopSpeaking();
  if (useSarvam) {
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const audio = new Audio(URL.createObjectURL(await res.blob()));
        current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
        return;
      }
    } catch {
      // fall through to the browser voice
    }
  }
  await browserSpeak(text);
}

function browserSpeak(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "hi-IN";
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("hi"));
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    // Some browsers never fire onend; do not hang the caller.
    setTimeout(resolve, Math.max(4000, text.length * 120));
  });
}

export function stopSpeaking() {
  current?.pause();
  current = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Must run inside a tap. Phone browsers block audio until the user has
 * interacted with the page, so the Soundbox has a one-time "power on".
 */
export function unlockAudio() {
  try {
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // ignore
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
  }
}
