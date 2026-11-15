# Plan: end-to-end demo path (₹826 flow)

Goal: a thin but complete run of the demo script in `demo/CLAUDE.md`, in one Next.js app.

## Decisions

- Tagging threshold: ₹500 and above, configurable
- Stack: Next.js full stack, TypeScript, app at repo root
- Voice: browser records, Sarvam does STT and TTS via server routes
- Drafting model: Sarvam `sarvam-105b`, via server route (changed from Claude on 2026-11-15 at the user's request)

## Needed from the user

- [x] Sarvam API key (`SARVAM_API_KEY` in `.env`), used for speech and drafting

Without keys the app runs on the cached fallbacks in `demo/`.

## Steps

- [x] 1. Scaffold Next.js + TypeScript at root, path aliases for `backend/`, `agent/`, `voice/`, `frontend/`, `.env.example`, `.gitignore`
- [x] 2. `data/`: synthetic merchant, transactions, settlement, the ₹826 seed, one repeatedly-reported account
- [x] 3. `rules/`: schema, validator, first entries (hold limited to reported amount, grievance ladder and deadlines), each with source and last-checked date
- [x] 4. `backend/`: append-only sale ledger with payment-time window, threshold trigger, hold handling, certificate builder, eligibility check, tracker with simulated clock
- [x] 5. `voice/`: browser recorder, Sarvam STT route, item parser, Sarvam TTS route, recorded-clip fallback
- [x] 6. `agent/`: prompts for hold explanation (Hindi), grievance draft, escalation draft; citation and disclaimer checks
- [x] 7. `templates/`: sale certificate, grievance, escalation, with disclaimer footer
- [x] 8. `frontend/`: payment and tagging screen, red hold alert, explanation, packet view, tracker, demo controls (pay, hold, simulate day 15)
- [x] 9. `demo/`: reset command, cached model and audio outputs for offline run, `script.md`
- [x] 10. `tests/`: guardrail tests (no back-dated tags, no certificate for reported accounts, disclaimers present, citations map to rules, masking) and the ₹826 scenario test
- [x] 11. Verify: run tests, run the app, walk the five demo steps

## Review

Built 2026-11-15. The ₹826 flow runs end to end.

- Verified: 24 tests pass, typecheck and lint clean, production build succeeds, the full flow was driven through the API on a dev server, and the home screen was rendered in headless Chrome.
- Not verified: live Sarvam speech and live Claude drafting (no keys were available), and the hold, packet and tracker screens were not clicked through in a browser.
- Step 9 is partial: there are no cached audio files; offline mode uses the recorded-clip transcript and template drafts instead.
- Rules in rules/rules.json are unverified research notes with no source URLs, and the 15-day escalation deadline is a placeholder.

---

# Plan: multi-screen demo (customer, Soundbox, merchant, bank)

In progress on branch `feat/multi-screen-demo`. Full design, research and checklist: `docs/multi-screen-demo.md`.
