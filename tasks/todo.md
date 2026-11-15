# Plan: end-to-end demo path (₹826 flow)

Goal: a thin but complete run of the demo script in `demo/CLAUDE.md`, in one Next.js app.

## Decisions

- Tagging threshold: ₹500 and above, configurable
- Stack: Next.js full stack, TypeScript, app at repo root
- Voice: browser records, Sarvam does STT and TTS via server routes
- Drafting model: Claude, via server route

## Needed from the user

- [ ] Sarvam API key (`SARVAM_API_KEY` in `.env.local`)
- [ ] Anthropic API key (`ANTHROPIC_API_KEY` in `.env.local`)

Without keys the app runs on the cached fallbacks in `demo/`.

## Steps

- [ ] 1. Scaffold Next.js + TypeScript at root, path aliases for `backend/`, `agent/`, `voice/`, `frontend/`, `.env.example`, `.gitignore`
- [ ] 2. `data/`: synthetic merchant, transactions, settlement, the ₹826 seed, one repeatedly-reported account
- [ ] 3. `rules/`: schema, validator, first entries (hold limited to reported amount, grievance ladder and deadlines), each with source and last-checked date
- [ ] 4. `backend/`: append-only sale ledger with payment-time window, threshold trigger, hold handling, certificate builder, eligibility check, tracker with simulated clock
- [ ] 5. `voice/`: browser recorder, Sarvam STT route, item parser, Sarvam TTS route, recorded-clip fallback
- [ ] 6. `agent/`: prompts for hold explanation (Hindi), grievance draft, escalation draft; citation and disclaimer checks
- [ ] 7. `templates/`: sale certificate, grievance, escalation, with disclaimer footer
- [ ] 8. `frontend/`: payment and tagging screen, red hold alert, explanation, packet view, tracker, demo controls (pay, hold, simulate day 15)
- [ ] 9. `demo/`: reset command, cached model and audio outputs for offline run, `script.md`
- [ ] 10. `tests/`: guardrail tests (no back-dated tags, no certificate for reported accounts, disclaimers present, citations map to rules, masking) and the ₹826 scenario test
- [ ] 11. Verify: run tests, run the app, walk the five demo steps

## Review

(to be filled in when done)
