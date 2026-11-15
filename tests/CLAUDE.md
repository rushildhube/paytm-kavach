# tests/

Automated tests. The guardrails are the product's credibility, so they get tests of their own.

On `feat/multi-screen-demo` there are 45 tests (152 on `feat/db-bills` after merging 2457dbd). The extra ones in `guardrails.test.ts` cover: a fraud report reaches only the bank snapshot; the merchant sees the hold with the report's reference; customer and Soundbox snapshots never carry hold data; the payer from the customer screen is stored masked; holds default to `lien`; reset bumps `epoch`; debit-freeze explanation and grievance pass `checkDraft` and cite `hold-limited-to-amount`.

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
- `voice-language.test.ts` — announcement phrases for all 11 languages (digits, paise, bill number, Hindi/English amounts round-trip through `spokenAmountsInr`), language validation and speaker map (v3 short names only), Sarvam TTS/STT request bodies, and the voice routes (language passed, `auto` → `unknown`, default `hi-IN`, 400 on unknown, no client-chosen speaker, 503 without a key). Fetch is stubbed.
- `db.test.ts` (branch `feat/db-bills`) — the database: in memory under Vitest at the current schema version; `sale_tags` UPDATE and DELETE refused by trigger; CHECKs refuse an unmasked payer handle and a full account number; bill content fixed and status leaves `open` once; `store()` is read-only; reset drops and reseeds (tags included) and bumps `epoch`; stored tags read back frozen. Restarts and schema changes: reopening an existing file keeps its data and triggers without reseeding; reset works with a table no migration knows; every row read back is frozen. Bills: paying a bill binds its text as a `source: "bill"`, `boundBy: "bill"` tag; a paid or cancelled bill, a wrong amount and another merchant's bill are refused, and a refused payment writes no transaction; customer `bill-lookup` shows only `id`, `amountInr`, `status`, `shopName`; the customer `pay` reply is `{ txn: { id, amountInr, at } }` only; bill ids match the UPI `tr` pattern and bills cap at ₹1,00,000; the merchant snapshot carries `merchant.vpa`. `tag-auto`: `none_open`; binds the only open payment (`only_open`) or a unique amount match (`amount`); returns `ambiguous` and writes no tag otherwise. `settings` stores the language in the database and rejects an unknown one.
- `guardrails.test.ts` also checks that the database itself refuses to change or delete a stored tag.
- `invoice.test.ts` — attaching an invoice: type from magic bytes; only hash, kind, size and total stored (no column for bytes or name); second attach, closed window, after a hold, wrong total, another merchant's payment, unknown type, empty and over 2 MB all refused; the database refuses UPDATE and DELETE; the certificate shows the fingerprint as unverified merchant content; `POST /api/invoice` 200/400/413/429; a version-1 database upgrades to the invoices schema keeping its rows.
- `bill-ownership.test.ts` — another merchant's bill cannot be paid or cancelled; lookup names the bill's own shop.
- `watcher.test.ts` — RSS/Atom parsing, matching only items on or after `last_checked`, undated-item baseline, failing feed reported, the watcher never writes to `rules/`, and the simulated law change flags rules while reset clears only simulated alerts.

## Rules for this folder

- Tests use synthetic fixtures from `data/`.
- LLM-dependent tests assert properties (citations valid, disclaimers present, no promises), not exact wording.
- A guardrail test failing blocks the demo build.
- Call `resetStore()` (and `resetWatcher()` for watcher tests) in `beforeEach`. Each test file's worker has its own in-memory SQLite database (`KAVACH_DB=:memory:` in `vitest.config.mts`), and `resetStore()` drops and reseeds it.
- To prove a guarantee holds in SQL too, use the raw handle `db()` from `@backend/db/connection` and expect the statement to throw.
