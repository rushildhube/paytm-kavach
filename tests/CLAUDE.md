# tests/

Automated tests. The guardrails are the product's credibility, so they get tests of their own.

## What belongs here

- **Unit tests** for backend logic: ledger, certificate builder, tracker state machine, threshold trigger, item parsing.
- **Guardrail tests**:
  - a sale tag cannot be created or changed after the payment window
  - no certificate for a repeatedly reported account
  - a failed mule screen yields a legal-aid referral, never an innocence letter
  - every draft contains the disclaimers
  - every legal citation in a draft maps to a `rules/` entry
  - buyer details are masked and only last four account digits appear in outputs and logs
  - no code path sends or submits a document
- **Rules validation** — every `rules/` entry has a source and a `last_checked` date.
- **Demo scenario test** — the ₹826 flow end to end, including the day-15 escalation.

## Rules for this folder

- Tests use synthetic fixtures from `data/`.
- LLM-dependent tests assert properties (citations valid, disclaimers present, no promises), not exact wording.
- A guardrail test failing blocks the demo build.
