# backend/

API and deterministic core logic. Anything that must be trustworthy and repeatable lives here, not in the LLM.

## Multi-screen additions (branch `feat/multi-screen-demo`, issue #4)

These supersede the matching lines under "What is here now" once the branch is merged.

- **Roles.** Every action may carry `role`: `merchant` (default), `soundbox`, `customer`, `bank`. The reply is `{ result, state: snapshotFor(role) }`.
  - `snapshot()` (merchant): as below, plus `epoch` and `tagWindowSeconds`. No report data.
  - `soundboxSnapshot()`: `epoch`, `shopName`, `thresholdInr`, `tagWindowSeconds`, `speechConfigured`, last 5 `payments` (`id`, `amountInr`, `at`, `transcript`, `canTag`, `secondsLeft`, `needsTag`). No holds, no reports.
  - `customerSnapshot()`: `epoch`, `payee` (`shopName`, `city`, `vpa`). Nothing about the merchant's account.
  - `bankSnapshot()`: `epoch`, `now`, `simulatedDays`, merchant (bank name, last 4 digits), transactions with `reported`/`held`, `reports`, `hold`, `grievance`, `tracker`, `ladder`, `lawWatch`.
- **New actions.** `report {txnId}` → `FraudReport` (bank side only). `hold {txnId, scope?: "lien" | "debit_freeze"}` (default `lien`; the hold's `reference` is the report's ack number when one exists). `pay {amountInr?, payerVpa?}` (payer masked before storage).
- **Types.** `FraudReport { id, txnId, ackNo, reportedAt, amountInr }`; `HoldScope`; `Hold.scope`. The certificate's hold block carries `scope`.
- **Store.** `reports[]`, `nextReport`, `epoch` (bumped by every `resetStore()`). A store from older code is replaced on the next call.
- **Tests guard this:** report data never reaches merchant, Soundbox or customer snapshots; hold data never reaches customer or Soundbox.

## What belongs here

- **Proof-of-sale ledger** — append-only store of sale tags, each bound to a transaction id and written at payment time. No endpoint may create or edit a tag for a past transaction after the fact.
- **Payment event intake** — receives (simulated) payment events and works out whether the amount meets the tagging threshold.
- **Hold handling** — receives a hold event, links it to the transaction, and records the hold type and held amount. Only police holds are placed today; the bank-hold path is not built yet.
- **Sale certificate builder** — assembles the certificate from transaction, settlement and sale-tag records. Pure data assembly, no model involved.
- **Eligibility and mule screen checks** — the hard rules: no certificate for repeatedly reported accounts; mule indicators route to legal aid.
- **Grievance tracker** — day count over the grievance ladder from `rules/`, with a simulated clock for the demo. An "escalated" stage is not built yet.
- **Rules loader** — reads and validates `rules/` and serves entries with source and last-checked date.
- **Law watcher** — polls official feeds and flags rules that may have changed. It never edits `rules/`.
- **Agent calls** — call into `agent/` for drafting, passing only verified facts.

## What is here now

The store is in memory on `globalThis.__kavachStore` (survives dev hot reload, lost on server restart). There is no database.

- `api.ts` — `handle(input)`, the single entry point behind `POST /api/kavach` (`src/app/api/kavach/route.ts`). Every reply is `{ result, state: snapshot() }`; errors become HTTP 400. Actions: `state`, `reset`, `merchant`, `pay`, `tag`, `hold`, `explain`, `packet`, `filed`, `advance`, `escalation`, `check-feeds`, `simulate-law-change`. `packet` runs the eligibility check first and returns either certificate + grievance draft or a referral. `escalation` throws unless the tracker stage is `escalation_due`.
- `api.ts` also exports `snapshot()` / `Snapshot` (fields: `now`, `simulatedDays`, `merchant`, `merchants`, `thresholdInr`, `transactions` with `tag`, `hold`, `canTag`, `secondsLeft`, plus `hold` (latest), `grievance`, `tracker`, `ladder`, `lawWatch`, `speechConfigured`, `disclaimer`, `disclaimerHi`) and the `Packet` type.
- `store.ts` — `store()`, `resetStore()`, `now()` (real time plus `clockOffsetMs`), `advanceClock(days)` (forward only), `activeMerchant()`, `setActiveMerchant(id)`. Seeds from `data/seed.ts`.
- `ledger.ts` — `recordPayment`, `getTransaction`, `getSaleTag`, `needsTag`, `recordSaleTag` (the only write path for tags: one per transaction, refused after a hold or after `TAG_WINDOW_SECONDS`, stored frozen), `LedgerError`.
- `holds.ts` — `placeHold(txnId, type = "police")` (holds only that payment's amount), `getHold`, `checkEligibility(merchant, answers)` (`no_certificate` / `legal_aid` / `eligible`), `markFiled`, `getGrievance`, `trackerStatus` (`not_filed` / `awaiting_reply` / `escalation_due`, plus `currentStep`).
- `certificate.ts` — `buildCertificate(holdId, at)` and `SaleCertificate`; keeps Paytm-record fields separate from the merchant's `saleTag` and adds `provenance` lines and the disclaimer.
- `rules.ts` — zod schema and `validateRules`; loads `rules/rules.json` at import (bad data fails at startup). Exports `allRules`, `getRule`, `rulesFor(holdType)`, `ladder`, `escalateAfterDays()` (sum of `days` of every step but the last: 7 + 15 = 22), `ladderStepOn(days)`, `escalationTarget()`.
- `watcher.ts` — loads `rules/feeds.json`; `checkFeeds`, `parseFeed` (RSS/Atom), `matchItems`, `ensureWatcher` (polls every `poll_minutes`; off under Vitest or `KAVACH_WATCH_FEEDS=0`), `alertsByRule`, `watchStatus`, `injectDemoItem`, `clearDemoAlerts`, `resetWatcher`. A matching item newer than a rule's `last_checked` flags it "possibly changed, under review"; a failing feed is reported, not treated as no change.
- `config.ts` — `TAG_THRESHOLD_INR` (env, default 500), `TAG_WINDOW_SECONDS` (120), `REPEAT_REPORT_LIMIT` (3, placeholder), `DISCLAIMER`, `DISCLAIMER_HI`.
- `mask.ts` — `maskVpa`, `last4`.
- `types.ts` — `Merchant`, `Transaction`, `Settlement`, `SaleTag`, `SaleItem`, `Hold`, `HoldType`, `Grievance`, `MuleScreenAnswers`, `Eligibility`, `TrackerStatus`.

## Rules for this folder

- The backend never files, emails or submits anything to a bank, police or portal. It produces drafts for the merchant to file.
- Certificates use Paytm-side records only. Merchant-typed text appears solely as the sale tag captured at payment time, labelled as such.
- Store last four account digits; mask buyer details in every response and log.
- Record purpose and consent for any buyer data held (DPDP Act). Not built yet: no purpose or consent record exists.
- Every draft response carries the disclaimer fields: draft, not legal advice, no guaranteed release.
- No pre-hold warnings to merchants.
- Nothing here writes to `rules/`. The watcher only flags.
