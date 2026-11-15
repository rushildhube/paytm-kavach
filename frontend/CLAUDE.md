# frontend/

The demo UI. The merchant app is styled as a feature inside the Paytm merchant app. `src/app/page.tsx` renders the single-screen version; `src/app/{customer,soundbox,merchant,bank}/page.tsx` render the four live screens (issue #4, `docs/multi-screen-demo.md`).

## The four live screens (branch `feat/multi-screen-demo`)

All four poll the shared in-memory state through `useLive(role)` and receive only their role's snapshot. A reset from any screen bumps `epoch`, and every screen returns to its start state.

- `useLive.ts` — `useLive<S>(role, { intervalMs, onReset })` returns `{ state, error, setError, busy, call }`. Polls `POST /api/kavach {action: "state", role}`; `call(body)` adds `role` to every action. `onReset` fires when `epoch` changes.
- `speech.ts` — one queue for everything spoken. `enqueue(text, lang, useSarvam, englishFallback?)` starts fetching Sarvam audio (`/api/voice/tts` with `language`) at once and plays phrases strictly one after another through one `AudioContext`, so overlapping payments never cut each other off. `prefetch` caches decoded audio by language and text (failures are not cached). If Sarvam is off, rate-limited, failing or slower than 6 s, the browser voice for that language speaks (`od-IN` → `or-IN`); if the device has no voice for it, the English fallback is said in `en-IN`. `pauseSpeech`/`resumeSpeech` (pausing cuts the current phrase; fetching continues), `onSpeaking(listener)`, `stopSpeaking` (drops the queue), `unlockAudio` (call inside a tap; it creates the shared AudioContext). `speak(text, useSarvam, lang = "hi-IN")` is kept for the merchant screen.
- `CustomerApp.tsx` (`/customer`) — buyer's Paytm-style flow: Scan & Pay → amount (₹826 prefilled) → any 4-digit UPI PIN → success. Sends `pay` with the synthetic `DEMO_PAYER_VPA`; the server masks it.
- `SoundboxApp.tsx` (`/soundbox`) — a Paytm Soundbox mock (Paytm logo from `public/brand/paytm-logo.svg` with a "Demo" label, LED, LCD with the last amount, speaker grille) above a touch panel. Needs one "Tap to switch on". Speaks in the snapshot's `language` (merchant setting) using `voice/announce.ts`. Announces every payment that arrives after power-on, oldest first, queued; a bill payment adds "bill N paid" and is not asked about; one "what did you sell?" follows a batch with an open payment. The fixed phrases are prefetched per language, so each payment costs one TTS call.
  - **Open payments** (`canTag`, not `billId`; a bill with no text is still open) are cards with live countdowns. One big mic: hold to talk (release stops) or tap once (stops on 1.2 s of silence, a second tap, or 7 s); a level meter; status "Listening / Understanding / Saving". Speech is paused while recording and transcribing.
  - A voice tag goes `/api/voice/stt` (with `language`) → `tag-auto`. `bound` → saved; `ambiguous` → the candidate cards light up and a tap calls `tag {txnId, transcript}` (the transcript is kept if that fails); `none_open` → message. Tapping a card first, then speaking, tags that card directly. Without a key: "Use recorded clip", or a card tap tags `DEMO_PAYMENT.spokenTag`.
  - Recent list: tagged, bill-tagged, under-threshold and "window closed". Never shows reports or holds.
- `KavachApp.tsx` with `controls={false}` (`/merchant`) — same merchant app without the demo-controls panel. It reacts to a hold placed from the bank screen (fetches and speaks the explanation once per hold) and fetches the escalation draft once the tracker reaches `escalation_due`. The hold alert has wording for both scopes: `lien` ("₹826 पर रोक") and `debit_freeze` ("खाते से निकासी पर रोक", complaint on one payment).
- `BankConsole.tsx` (`/bank`) — presenter's laptop. 1) Report a payment (victim on 1930/NCRP) → ack number. 2) Apply a restriction: `lien` (default, MHA SOP s.9.1) or `debit_freeze` (over-reach case). 3) Simulate day `tracker.escalateAfterDays` (22). 4) Law watcher buttons. Also "Reset whole demo" and links to the phone screens.

## What belongs here

- **Payment screen** — a payment lands, the announcement is spoken, the merchant tags the sale by voice.
- **Sales list** — today's payments with their tags, or why they are untagged.
- **Hold alert** — the screen turns red for a hold, showing the held amount (for example ₹826) and making clear that only that amount is held.
- **Explanation view** — the plain-language Hindi explanation, with a play button when speech is on.
- **Mule screen** — two yes/no questions before any documents are prepared.
- **Packet view** — the sale certificate and the drafted grievance, with copy and download. The merchant files it themselves. Share is not built yet.
- **Tracker** — where the grievance stands on the ladder, days elapsed, and the escalation draft when due.
- **Demo controls** — trigger a payment, trigger a hold, "simulate day 22", reset, and the law-watch panel.
- A merchant switcher is not built yet (the `merchant` API action exists but no UI calls it).

## What is here now

- `KavachApp.tsx` — the whole client app (`"use client"`). Holds UI state and calls `POST /api/kavach` with actions `state`, `pay`, `tag`, `hold`, then `explain`, `packet`, `filed`, `advance` then `escalation`, `reset`, `check-feeds`, `simulate-law-change`. Each reply's `state` (`Snapshot` from `backend/api.ts`) replaces local state. Voice: `useRecorder` → `POST /api/voice/stt` → `tag`; announcements and the explanation are spoken via `POST /api/voice/tts` only when `speechConfigured`. Internal components `LawWatch` and `Question`.
- The "Simulate day N" button advances the clock by `tracker.escalateAfterDays - daysSinceFiled` (22 days with today's ladder), then requests the escalation draft. Its handler is still named `day15` and the label falls back to 15 before a hold exists; the real figure comes from the ladder.
- `parts.tsx` — `inr`, `when` (browser-local time), `Disclaimer`, `Citations` (status label, source link, "Checked <date>" or "Not yet verified", and "Possibly changed, under review" alerts), `CertificateCard` (separate "From Paytm records" and "Said by the merchant at payment time" sections), `DraftCard` (Draft badge, "Worded by AI" vs "Standard wording", Copy, Download with disclaimer appended), type `AlertsByRule`.

## Rules for this folder

- Every screen showing a draft or legal information displays: draft, not legal advice, no guaranteed release.
- Each rule shown carries its source and last-checked date.
- No "submit to bank" or "send" button that implies Kavach files anything. Actions are review, copy, download (and share when built). "मैंने इसे अपने बैंक में जमा कर दिया है" only records that the merchant filed it.
- Show masked buyer details and last four account digits only.
- Hindi first, large text, minimal typing. Design for a shopkeeper at a counter.
- The hold screen must reassure before it instructs: a hold on one payment, not an accusation.
- Import server code only as types. Never import `voice/sarvam.ts` or call Sarvam from the browser.
