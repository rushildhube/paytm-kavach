# voice/

Voice sale tagging: the moment-of-sale capture that makes Kavach different. The Soundbox announces a payment and the merchant says what was sold.

## What belongs here

- **Recording** — the browser captures the audio only (MediaRecorder); it does no recognition.
- **Speech to text** — Sarvam transcribes short utterances in the merchant's language (11 languages), including code-mixed speech. Called from a server route; the API key stays server-side.
- **Text to speech** — Sarvam voices the payment announcement and the hold explanation.
- **Item parsing** — turning "do kilo cheeni, ek tel" into structured items (item, quantity, unit) while keeping the raw transcript.
- **Tagging trigger** — prompt for payments of ₹500 and above, configurable. This lives in `backend/config.ts` (`TAG_THRESHOLD_INR`) and `backend/ledger.ts` (`needsTag`), not here.
- **Soundbox simulator** — `frontend/SoundboxApp.tsx` (`/soundbox`).
- **Fallbacks** — untagged sales are allowed and the payment is never blocked. Quick-tap categories and noise handling are not built yet.

## What is here now

- `sarvam.ts` — server-only Sarvam client, header `api-subscription-key: SARVAM_API_KEY`, base `https://api.sarvam.ai`.
  - `speechToText(blob, lang)` → transcript string; `transcribe(blob, lang)` → `{ transcript, languageCode }`. `POST /speech-to-text`, model `saaras:v4`, `language_code` = any `VoiceLanguage` or `"unknown"` (Sarvam auto-detects), 20 s timeout. It strips the MIME parameters (`audio/webm;codecs=opus` → `audio/webm`) because Sarvam rejects the codecs parameter. Keep this. saaras:v4 writes amounts as digits ("₹826"), which `tag-auto` reads.
  - `textToSpeech(text, lang, speaker?)` → `POST /text-to-speech` with `ttsRequestBody`: model `bulbul:v3`, the language's speaker, `pace` 1.1, `output_audio_codec` `mp3`, text capped at 2500 chars; returns MP3 bytes.
  - `chat(system, user)` → `POST /v1/chat/completions`, model `sarvam-105b`, `reasoning_effort: null` (reasoning on took 25 s+ and used the token budget), `max_tokens` 4096, temperature 0.2, 60 s timeout; throws on `finish_reason` `length` or `content_filter`. Used by `agent/drafts.ts`.
  - `sarvamConfigured()`, `sarvamKey()`, `SarvamUnavailable` (no key).
- `languages.ts` — the 11 `VOICE_LANGUAGES`, `isVoiceLanguage`, `DEFAULT_VOICE_LANGUAGE` (`hi-IN`).
- `voices.ts` — model and speaker choice, with sources and the live test (2026-11-15). `bulbul:v3` for every language (v4-flash has no Malayalam or Odia); speaker `priya` for Hindi, `ishita` (docs' top-rated female v3 voice) for the rest; never a v4 persona id. `browserLang` maps `od-IN` → `or-IN` for speechSynthesis. `parseLanguageField`: missing → `hi-IN`, unknown → null (routes answer 400).
- `announce.ts` — what the Soundbox says per language: `announcePayment({amountInr, billId}, lang)` ("साक्षी पर 826 रुपये प्राप्त हुए।"; the brand word comes from `BRAND.spokenOn[lang]` in `frontend/brand.ts`, plus "बिल नंबर 1 का भुगतान हो गया।" for a bill), and `ask`, `saved`, `choose`, `poweredOn`. Amounts stay digits without commas; bulbul reads them as number words in all 11 languages (checked 2026-11-15 by speaking the real announcement and re-transcribing verbatim; Kannada heard 1250 as 1200 once, re-check by ear). Modelled on the real Paytm Soundbox line, which was not confirmed from a primary source; non-Hindi phrases need a native speaker's check.
- `amounts.ts` — `spokenAmountsInr(transcript)`, used by `tag-auto` (from PR #20).
- `useRecorder.ts` — client hook `useRecorder(onClip, maxMs = 7000, { onLevel, silenceMs })` returning `{ recording, start, stop, error }`; `start()` resolves false when there is no mic. Requests echo cancellation and noise suppression; `onLevel` (0–1, per animation frame) drives a meter without re-rendering; `silenceMs` stops after quiet once speech was heard; `onEmpty` fires when the clip came out empty.
- `announce.ts` also has `STATUS` / `statusFor(lang)`: the panel's "listening / understanding / saving" words per language.
- `parser.ts` — `parseSaleItems(transcript)`: splits on commas, sentence ends (including `।`), "aur"/"और"/"and"; reads romanised, Devanagari and digit numbers (including aadha, dedh, dhai) and a fixed unit list.

Server routes: `src/app/api/voice/stt/route.ts` (form fields `audio`, optional `language` = VoiceLanguage or `auto` → `{ transcript, languageCode }`) and `src/app/api/voice/tts/route.ts` (`{ text, language? }` → `audio/mpeg`; the client cannot pick the speaker). Missing language means `hi-IN`; an unknown one is a 400. Both return 503 without a key, 502 on a Sarvam error, 429 past the voice rate limit.

Measured on 2026-11-15 (#17): TTS 0.8–3.6 s per phrase, STT 0.4–6 s (the first call is the slow one). Hence the Soundbox prefetches.

Without a key the mic button is disabled and the UI's "Use recorded clip" button saves the fixed transcript `DEMO_PAYMENT.spokenTag` with source `recorded_clip`. There is no audio file.

## Rules for this folder

- A tag is bound to the transaction at payment time, inside a short window (`TAG_WINDOW_SECONDS`, 120 s, enforced in `backend/ledger.ts`). No back-dated tagging, ever; this is what stops fraudsters manufacturing proof.
- Keep the raw transcript alongside the parsed items so the record is what the merchant actually said.
- Do not capture or store buyer speech or identity. Tag the goods, not the customer.
- Keep the interaction to one short utterance. No typing, no download.
- A missing tag must never block or delay the payment flow.
- Never import `sarvam.ts` into client code; the key must not reach the browser. `voices.ts`, `announce.ts` and `languages.ts` are safe for the browser.
- The box never speaks while the mic records: a spoken "₹500" in the clip could bind the tag to the wrong payment.
