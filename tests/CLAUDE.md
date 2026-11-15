# tests/

Automated tests. The guardrails are the product's credibility, so they get tests of their own.

On `feat/multi-screen-demo` there are 45 tests. The extra ones in `guardrails.test.ts` cover: a fraud report reaches only the bank snapshot; the merchant sees the hold with the report's reference; customer and Soundbox snapshots never carry hold data; the payer from the customer screen is stored masked; holds default to `lien`; reset bumps `epoch`; debit-freeze explanation and grievance pass `checkDraft` and cite `hold-limited-to-amount`.

## What belongs here

- **Unit tests** for backend logic: ledger, certificate builder, tracker, threshold trigger, item parsing.
- **Guardrail tests**:
  - a sale tag cannot be created or changed after the payment window
  - no certificate for a repeatedly reported account
  - a failed mule screen yields a legal-aid referral, never an innocence letter
  - every draft carries the disclaimer
  - every legal citation in a draft maps to a `rules/` entry
  - buyer details are masked and only last four account digits appear in outputs
  - no code path sends or submits a document (not built yet)
- **Rules validation** — every `rules/` entry has a source and a `last_checked` date.
- **Demo scenario test** — the ₹826 flow end to end. The day-22 escalation through the tracker and the API (`backend/api.ts` `handle`) is not tested yet.
- **Evals** for live model output (not built yet).

## What is here now

Run with `npm test` (Vitest, `vitest.config.mts`, node environment, same path aliases as `tsconfig.json`). Also run `npm run typecheck` and `npm run lint`. 38 tests at HEAD a19ee9f. No test calls Sarvam or the network: drafts use `{ useModel: false }`, and fetch is stubbed where needed.

- `guardrails.test.ts`
  - proof of sale: tag accepted right after payment; second tag, closed window and tag after hold refused; stored tags frozen; threshold.
  - data minimisation: payer masked before storing, masking idempotent, four account digits only.
  - holds and eligibility: only the payment's amount held; `no_certificate` for the reported merchant; `legal_aid` for a lent account; clean merchant passes.
  - rules table: every rule has a source and is verified with a date; ladder is bank 7, police 15, then the District Grievance Officer; zod refuses a verified rule without URL and date.
  - draft checks: unknown rule, law outside the table, promised outcome, unlisted amount all rejected; markers render as numbered references.
  - ₹826 scenario: payment, Hindi tag, hold, certificate, then all three template drafts pass `checkDraft` and carry a disclaimer.
  - item parsing (romanised Hindi, sentence ends, unquantified items); STT request strips the codecs MIME parameter; the model prompt carries IST, not raw UTC.
- `watcher.test.ts` — RSS/Atom parsing, matching only items on or after `last_checked`, undated-item baseline, failing feed reported, the watcher never writes to `rules/`, and the simulated law change flags rules while reset clears only simulated alerts.

## Rules for this folder

- Tests use synthetic fixtures from `data/`.
- LLM-dependent tests assert properties (citations valid, disclaimers present, no promises), not exact wording.
- A guardrail test failing blocks the demo build.
- Call `resetStore()` (and `resetWatcher()` for watcher tests) in `beforeEach`; the store is a process-wide global.
