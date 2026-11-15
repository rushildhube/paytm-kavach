# voice/

Voice sale tagging: the moment-of-sale capture that makes Kavach different. The Soundbox announces a payment and the merchant says what was sold.

## What belongs here

- **Recording** — the browser captures the audio only (MediaRecorder); it does no recognition.
- **Speech to text** — Sarvam transcribes short utterances in Hindi, including code-mixed speech. Called from a server route; the API key stays server-side.
- **Text to speech** — Sarvam voices the payment announcement and the hold explanation.
- **Item parsing** — turning "do kilo cheeni, ek tel" into structured items (item, quantity, unit) while keeping the raw transcript.
- **Tagging trigger** — prompt for payments of ₹500 and above, configurable. This lives in `backend/config.ts` (`TAG_THRESHOLD_INR`) and `backend/ledger.ts` (`needsTag`), not here.
- **Soundbox simulator** — a stand-in device that opens the listening window (not built yet; the UI speaks the announcement through TTS when a payment arrives).
- **Fallbacks** — untagged sales are allowed and the payment is never blocked. Quick-tap categories and noise handling are not built yet.

## What is here now

- `sarvam.ts` — server-only Sarvam client, header `api-subscription-key: SARVAM_API_KEY`, base `https://api.sarvam.ai`.
  - `speechToText(blob, "hi-IN")` → `POST /speech-to-text`, model `saaras:v4`, 20 s timeout. It strips the MIME parameters (`audio/webm;codecs=opus` → `audio/webm`) because Sarvam rejects the codecs parameter. Keep this.
  - `textToSpeech(text, "hi-IN")` → `POST /text-to-speech`, model `bulbul:v3`, speaker `priya`, text capped at 2500 chars, returns WAV bytes.
  - `chat(system, user)` → `POST /v1/chat/completions`, model `sarvam-105b`, `reasoning_effort: null` (reasoning on took 25 s+ and used the token budget), `max_tokens` 4096, temperature 0.2, 60 s timeout; throws on `finish_reason` `length` or `content_filter`. Used by `agent/drafts.ts`.
  - `sarvamConfigured()`, `sarvamKey()`, `SarvamUnavailable` (no key).
- `useRecorder.ts` — client hook `useRecorder(onClip, maxMs = 7000)` returning `{ recording, start, stop, error }`.
- `parser.ts` — `parseSaleItems(transcript)`: splits on commas, sentence ends (including `।`), "aur"/"और"/"and"; reads romanised, Devanagari and digit numbers (including aadha, dedh, dhai) and a fixed unit list.

Server routes: `src/app/api/voice/stt/route.ts` (form field `audio` → `{ transcript }`) and `src/app/api/voice/tts/route.ts` (`{ text }` → `audio/wav`). Both return 503 without a key, 502 on a Sarvam error.

Without a key the mic button is disabled and the UI's "Use recorded clip" button saves the fixed transcript `DEMO_PAYMENT.spokenTag` with source `recorded_clip`. There is no audio file.

## Rules for this folder

- A tag is bound to the transaction at payment time, inside a short window (`TAG_WINDOW_SECONDS`, 120 s, enforced in `backend/ledger.ts`). No back-dated tagging, ever; this is what stops fraudsters manufacturing proof.
- Keep the raw transcript alongside the parsed items so the record is what the merchant actually said.
- Do not capture or store buyer speech or identity. Tag the goods, not the customer.
- Keep the interaction to one short utterance. No typing, no download.
- A missing tag must never block or delay the payment flow.
- Never import `sarvam.ts` into client code; the key must not reach the browser.
