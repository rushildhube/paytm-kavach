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
- **Store.** Reports, holds, screenings, bills and `epoch` (bumped by every `resetStore()`) live in the SQLite database described below.
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

### Database (`backend/db/`, branch `feat/db-bills`, issues #12, #15)

State lives in SQLite through `node:sqlite` (`DatabaseSync`, built into Node 24; no npm dependency). The file is `data/kavach.db` (gitignored, with its `-wal`/`-shm` files), or `KAVACH_DB` if set. Under Vitest it is `:memory:` (`vitest.config.mts` sets `KAVACH_DB`, and `process.env.VITEST` is the fallback), so each test worker has its own database. The handle is kept on `globalThis.__kavachDb` for dev hot reload. State, including the simulated clock, now survives a server restart; only `reset` clears it. Turbopack bundles `node:sqlite` as a Node built-in with no `serverExternalPackages` entry; `/api/kavach` runs on the default Node.js runtime and must stay there (no `runtime = "edge"`).

- `db/schema.ts` — `MIGRATIONS` (numbered SQL strings; `PRAGMA user_version` is the number applied). To change the schema, **append** a migration; never edit an old one. A database newer than the code (e.g. after switching branches) is dropped and reseeded, since it holds demo data only.
- Tables: `merchants` (`account_last4` CHECKed to four digits), `transactions` (`bill_id`; `payer_vpa_masked` CHECKed to contain `*`), `sale_tags` (`items` JSON, `bound_by`, `bill_id`), `bills`, `reports`, `holds`, `screenings`, `grievances`, `meta` (`epoch`, `clock_offset_ms`, `active_merchant_id`, `next_txn`/`next_hold`/`next_report`/`next_bill` counters).
- Triggers: `sale_tags` refuses every UPDATE and DELETE ("sale tags are append-only"); `bills` refuses changes to its content and any status change once it has left `open`, and refuses DELETE; `screenings` refuses UPDATE.
- `db/connection.ts` — `db()`, `dbFile()`, `SCHEMA_VERSION`, `resetDb()` (drops every table listed in `sqlite_master`, whatever migration made it, re-runs the migrations, reseeds from `data/seed.ts`, epoch + 1; dropping the table is the only way a tag goes away), `tx(fn)` (atomic; nested calls join), `getMeta`/`setMeta`/`nextCounter`, and `all`/`one`/`run` query helpers.
- `db/rows.ts` — row types and mappers back to `types.ts` shapes, ordered by insertion (`rowid`). Every row comes back frozen (so a leftover `obj.field = x` throws instead of silently losing the write); tags have no `boundBy`/`billId` keys when those are null, and `Transaction.billId` is always present (`null` when there is no bill).
- Writes happen only through backend functions. Nothing may mutate an object it read; change the row instead.

- `api.ts` — `handle(input)`, the single entry point behind `POST /api/kavach` (`src/app/api/kavach/route.ts`). Every reply is `{ result, state: snapshot() }`; errors become HTTP 400. Actions: `state`, `reset`, `merchant`, `pay`, `tag`, `hold`, `explain`, `packet`, `filed`, `advance`, `escalation`, `check-feeds`, `simulate-law-change`. `packet` runs the eligibility check first and returns either certificate + grievance draft or a referral. `escalation` throws unless the tracker stage is `escalation_due`.
- `api.ts` also exports `snapshot()` / `Snapshot` (fields: `now`, `simulatedDays`, `merchant`, `merchants`, `thresholdInr`, `transactions` with `tag`, `hold`, `canTag`, `secondsLeft`, plus `hold` (latest), `grievance`, `tracker`, `ladder`, `lawWatch`, `speechConfigured`, `disclaimer`, `disclaimerHi`) and the `Packet` type.
- `store.ts` — `store()` (a deep-frozen read-only view of the whole database, for tests and debugging; writing to it throws), `resetStore()`, `now()` (real time plus `clockOffsetMs`), `advanceClock(days)` (forward only), `epoch()`, `clockOffsetMs()`, `allMerchants()`, `activeMerchant()`, `getMerchant(id)`, `setActiveMerchant(id)`, `setMerchantLanguage(id, lang)` (refuses a language not in `voice/languages.ts`; used by the `settings` action).
- `bills.ts` — `createBill`, `getBill`, `cancelBill` (own merchant's open bill only), `settleBill` (`UPDATE … WHERE status = 'open'`), `merchantBills`. The `pay {billId}` action writes the payment, the bill status and the `source: "bill"`, `boundBy: "bill"` tag in one transaction, and refuses another merchant's bill, a paid or cancelled bill, or a wrong amount. `bill-lookup` takes the shop name from the bill's merchant.
- `ledger.ts` — `recordPayment`, `getTransaction`, `listTransactions(merchantId)`, `getSaleTag`, `needsTag`, `recordSaleTag` (the only write path for tags: one per transaction, refused after a hold or after `TAG_WINDOW_SECONDS`, returned frozen, and the database refuses to change it), `LedgerError`.
- `holds.ts` — `placeHold(txnId, type = "police")` (holds only that payment's amount), `getHold`, `holdForTransaction`, `latestHoldFor(merchantId)`, `reportFraud`, `listReports` (bank side only), `checkEligibility(merchant, answers)` (`no_certificate` / `legal_aid` / `eligible`), `markFiled`, `getGrievance`, `trackerStatus` (`not_filed` / `awaiting_reply` / `escalation_due`, plus `currentStep`).
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
