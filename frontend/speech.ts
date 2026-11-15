"use client";

import { DEFAULT_VOICE_LANGUAGE, type VoiceLanguage } from "@voice/languages";
import { browserLang } from "@voice/voices";

/**
 * Speech for the screens. Sarvam audio comes through `/api/voice/tts` (the
 * key stays on the server) and plays through one AudioContext unlocked by
 * the power-on tap. If Sarvam is off, slow to answer, rate-limited or
 * failing, the browser's own voice for that language speaks instead, so the
 * Soundbox is never silent.
 *
 * Announcements go through a queue: each one is fetched as soon as it is
 * queued (prefetch) and played strictly one after another, so overlapping
 * payments never cut each other off. The queue can be paused while the
 * microphone is live, so the box never speaks into a recording.
 */

type Item = {
  text: string;
  lang: VoiceLanguage;
  audio: Promise<AudioBuffer | null>;
  /** Said by the browser voice if it has no voice for `lang`. */
  fallback?: string;
  resolve: () => void;
};

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let queue: Item[] = [];
let playing = false;
let paused = false;
let generation = 0;
const cache = new Map<string, Promise<AudioBuffer | null>>();
const listeners = new Set<(speaking: boolean) => void>();

/** How long to wait for Sarvam audio before the browser voice takes over. */
const SARVAM_WAIT_MS = 6000;

function setPlaying(v: boolean) {
  playing = v;
  listeners.forEach((l) => l(v));
}

/** Subscribe to "is the box speaking". Returns the unsubscribe function. */
export function onSpeaking(listener: (speaking: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

/**
 * Fetch and decode one phrase, cached by language and text. Resolves to null
 * when Sarvam is unavailable (no key, 429, network), which means "use the
 * browser voice".
 */
export function prefetch(text: string, lang: VoiceLanguage, useSarvam: boolean): Promise<AudioBuffer | null> {
  if (!useSarvam) return Promise.resolve(null);
  const key = `${lang}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = (async () => {
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: lang }),
      });
      if (!res.ok) return null;
      const c = audioContext();
      if (!c) return null;
      return await c.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  })();
  cache.set(key, job);
  // A failure is not cached, so the next payment tries Sarvam again.
  void job.then((buf) => {
    if (!buf) cache.delete(key);
  });
  return job;
}

/**
 * Queue a phrase. Starts fetching now; plays after everything queued before
 * it. Resolves when it has been spoken (or dropped by `stopSpeaking`).
 */
export function enqueue(
  text: string,
  lang: VoiceLanguage,
  useSarvam: boolean,
  fallback?: string,
): Promise<void> {
  return new Promise((resolve) => {
    queue.push({ text, lang, audio: prefetch(text, lang, useSarvam), fallback, resolve });
    void pump();
  });
}

/** Hold the queue (e.g. while the mic records). Fetching continues. */
export function pauseSpeech() {
  paused = true;
}

export function resumeSpeech() {
  paused = false;
  void pump();
}

async function pump() {
  if (playing || paused) return;
  const item = queue.shift();
  if (!item) return;
  const gen = generation;
  setPlaying(true);
  try {
    const buf = await Promise.race([
      item.audio,
      new Promise<null>((r) => setTimeout(() => r(null), SARVAM_WAIT_MS)),
    ]);
    if (gen !== generation) return;
    if (buf && ctx) await playBuffer(buf);
    else await browserSpeak(item.text, item.lang, item.fallback);
  } finally {
    item.resolve();
    if (gen === generation) {
      setPlaying(false);
      void pump();
    }
  }
}

function playBuffer(buf: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    if (!ctx) return resolve();
    void ctx.resume().catch(() => {});
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    source = src;
    src.onended = () => {
      if (source === src) source = null;
      resolve();
    };
    try {
      src.start();
    } catch {
      resolve();
    }
  });
}

function findVoice(tag: string): SpeechSynthesisVoice | undefined {
  const prefix = tag.slice(0, 2).toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(prefix))
  );
}

/**
 * The browser's voice for `lang`. If the device has none (common for Odia
 * or Punjabi), say the English `fallback` with an English voice rather than
 * feed Tamil script to a Hindi voice.
 */
function browserSpeak(text: string, lang: VoiceLanguage, fallback?: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve();
  }
  let tag = browserLang(lang);
  let voice = findVoice(tag);
  let say = text;
  if (!voice && fallback && lang !== "en-IN") {
    tag = "en-IN";
    voice = findVoice(tag);
    say = fallback;
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(say);
    u.lang = tag;
    if (voice) u.voice = voice;
    u.rate = 1;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
    // Some browsers never fire onend; do not hang the queue.
    setTimeout(finish, Math.max(3000, say.length * 110));
  });
}

/**
 * Speak now, dropping anything queued. Kept for the merchant screen
 * (`speak(text, useSarvam)`); `lang` defaults to Hindi.
 */
export async function speak(
  text: string,
  useSarvam: boolean,
  lang: VoiceLanguage = DEFAULT_VOICE_LANGUAGE,
): Promise<void> {
  stopSpeaking();
  await enqueue(text, lang, useSarvam);
}

/** Stop the current phrase and drop the queue. */
export function stopSpeaking() {
  generation++;
  const dropped = queue;
  queue = [];
  dropped.forEach((i) => i.resolve());
  try {
    source?.stop();
  } catch {
    // already stopped
  }
  source = null;
  if (playing) setPlaying(false);
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Must run inside a tap. Phone browsers block audio until the user has
 * interacted with the page, so the Soundbox has a one-time "power on".
 */
export function unlockAudio() {
  const c = audioContext();
  if (c) {
    try {
      void c.resume();
      const buf = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    } catch {
      // ignore
    }
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
  }
}
