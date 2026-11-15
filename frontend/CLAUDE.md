# frontend/

The merchant-facing demo UI, styled as a feature inside the Paytm merchant app. Rendered by `src/app/page.tsx`.

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
