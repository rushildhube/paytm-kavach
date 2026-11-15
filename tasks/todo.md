# Plan: verify the rules table and watch for law changes (branch `verify/rules`)

Goal: every entry in `rules/rules.json` checked against its primary source, and a feed watcher that flags rules whose law may have changed.

Decision: the watcher **flags, it does not rewrite**. A matching feed item marks the rule "possibly changed, under review" in the app and in the model prompt; a person reads the source and edits `rules.json` by hand. Reason: the guardrail that facts come only from a reviewed table (an auto-edited table would let one misread headline into every merchant's letter).

- [x] 1. Research each rule's primary source (BNSS text, MHA procedure, Supreme Court order, RBI draft) and the official feeds available
- [x] 2. Update `rules.json`: corrected summaries, `source_url`, `last_checked`, `verified`; real grievance ladder and deadlines if the source gives them
- [x] 3. Fix any app text or template that relied on a claim that turned out wrong
- [x] 4. Feed watcher: `rules/feeds.json` (official feeds + per-rule keywords), `backend/watcher.ts` (poll, parse RSS/Atom, match items newer than `last_checked`), alerts in the app state
- [x] 5. Show alerts: citation badge "possibly changed, under review" with the headline and link; tell the model the rule is under review
- [x] 6. Tests for the watcher (parsing, matching, no writes to `rules/`); typecheck, lint, build, browser check
- [x] 7. Commit in focused pieces, push the branch

## Review

Done 2026-11-15. 38 tests pass, typecheck and lint clean, production build passes, browser walkthrough passes (including the simulated law change), live feed check read all three feeds.

- All 10 rules verified (2 new). Six claims in the research notes were wrong; see the table at the top of `docs/sources.md`.
- Escalation is now due on day 22 (bank 7 + police officer 15), addressed to the District Grievance Officer through the bank.
- Watched feeds: RBI notifications, RBI press releases, PIB. MHA, I4C, the Supreme Court and India Code have no feed, so changes there are not caught automatically.
- Still open: the Allahabad and Karnataka judgments were read only through reports; the RBI draft PDF was not opened; final RBI directions are expected by 30 November 2026 and the Supreme Court sits again on 23 November 2026.

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
