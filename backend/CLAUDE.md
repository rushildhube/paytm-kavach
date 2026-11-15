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
- Migration 3 adds `data_purposes` (issue #25): one row per stored column of buyer-related data (`transactions.payer_vpa_masked`, `sale_tags.transcript`, `bills.text`, `invoices.sha256`) with what it is, why it is held, how it is minimised and how long it is kept. It is Kavach's policy, not a legal citation (the DPDP Act is not yet in `rules/`). It changes only by a new migration (UPDATE and DELETE refused) and survives Reset. Read it with the `data-purposes` action (any role). A new buyer-related column needs a row here, and `tests/data-purposes.test.ts` lists them.
- Migration 2 adds `invoices` (one per payment: `sha256`, `kind` pdf/jpeg/png/webp, `size_bytes` ≤ 2 MB, optional `total_inr`; no file bytes or name). UPDATE and DELETE are refused by trigger ("invoices are append-only").
- Triggers: `sale_tags` refuses every UPDATE and DELETE ("sale tags are append-only"); `bills` refuses changes to its content and any status change once it has left `open`, and refuses DELETE; `screenings` refuses UPDATE.
- `db/connection.ts` — `db()`, `dbFile()`, `SCHEMA_VERSION`, `resetDb()` (drops every table listed in `sqlite_master`, whatever migration made it, re-runs the migrations, reseeds from `data/seed.ts`, epoch + 1; dropping the table is the only way a tag goes away), `tx(fn)` (atomic; nested calls join), `getMeta`/`setMeta`/`nextCounter`, and `all`/`one`/`run` query helpers.
- `db/rows.ts` — row types and mappers back to `types.ts` shapes, ordered by insertion (`rowid`). Every row comes back frozen (so a leftover `obj.field = x` throws instead of silently losing the write); tags have no `boundBy`/`billId` keys when those are null, and `Transaction.billId` is always present (`null` when there is no bill).
- Writes happen only through backend functions. Nothing may mutate an object it read; change the row instead.

- `api.ts` — `handle(input)`, the single entry point behind `POST /api/kavach` (`src/app/api/kavach/route.ts`). Every reply is `{ result, state: snapshot() }`; errors become HTTP 400. Actions: `state`, `reset`, `merchant`, `pay`, `tag`, `hold`, `explain`, `packet`, `filed`, `advance`, `escalation`, `check-feeds`, `simulate-law-change`. `packet` runs the eligibility check first and returns either certificate + grievance draft or a referral. `escalation` throws unless the tracker stage is `escalation_due`.
- `api.ts` also exports `snapshot()` / `Snapshot` (fields: `now`, `simulatedDays`, `merchant`, `merchants`, `thresholdInr`, `transactions` with `tag`, `hold`, `canTag`, `secondsLeft`, plus `hold` (latest), `grievance`, `tracker`, `ladder`, `lawWatch`, `speechConfigured`, `disclaimer`, `disclaimerHi`) and the `Packet` type.
- `store.ts` — `store()` (a deep-frozen read-only view of the whole database, for tests and debugging; writing to it throws), `resetStore()`, `now()` (real time plus `clockOffsetMs`), `advanceClock(days)` (forward only), `epoch()`, `clockOffsetMs()`, `allMerchants()`, `activeMerchant()`, `getMerchant(id)`, `setActiveMerchant(id)`, `setMerchantLanguage(id, lang)` (refuses a language not in `voice/languages.ts`; used by the `settings` action).
- `bills.ts` — `createBill`, `getBill`, `cancelBill` (own merchant's open bill only), `settleBill` (`UPDATE … WHERE status = 'open'`), `merchantBills`. The `pay {billId}` action writes the payment, the bill status and the `source: "bill"`, `boundBy: "bill"` tag in one transaction, and refuses another merchant's bill, a paid or cancelled bill, or a wrong amount. `bill-lookup` takes the shop name from the bill's merchant and returns `{id, amountInr, status, shopName, text}`: the buyer sees this bill's items, nothing else.
- **Buyer approves the bill (#19, docs/proof-improvements.md item 1).** `pay {billId, approvedText}` from role `customer`: `approvedText` must equal the bill text exactly (else refused, nothing written), and the bill tag is stored with `buyerApproved: true` (migration 5: `sale_tags.buyer_approved`, 0/1, written once with the tag; only a `source: "bill"` tag can carry it). From any other role `approvedText` is ignored. Proof strength: approved bill → strong. The certificate's `saleTag.buyerApproved` and a provenance line say the buyer's screen showed the items before the PIN, and that the UPI note reaching the payer bank is not verified. Migration 5 also replaces the `bills.text` row in `data_purposes`. Tests: `tests/buyer-approves-bill.test.ts`.
- **Soundbox bills (branch `feat/soundbox-bill`).** `bill-create {…, soundbox?: "qr" | "voice"}`, `bill-to-soundbox {billId, mode}`, `soundbox-clear`, `bill-voice {transcript}` (spoken on the box: largest amount heard, bill sent with voice), `bill-for-payment {txnId, text}` (a payment that came without a bill: `recordSaleTag` with `source: "typed"`, `boundBy: "tap"`, same window/hold/once rules; the certificate says it was written after the payment, never "before"). `bills.ts` keeps only a pointer in `meta` (`soundbox_request:<merchantId>`); `soundboxRequest()` derives `{billId, amountInr, text, items, mode, nonce}` on read, so paying or cancelling clears it. Soundbox snapshot gains `payee {shopName, vpa}` and `request`; merchant snapshot gains `soundboxBillId`. Migration 4 rebuilds `sale_tags` to allow `source = 'typed'`. Tests: `tests/soundbox-bill.test.ts`.
- `proofStrength.ts` — `proofStrength({tag, invoice})` → `{level: "strong" | "good" | "basic" | "none", reasons}` (docs/proof-improvements.md item 4). Base: a bill the buyer approved before the PIN → strong; bill made before the payment, or a voice tag bound by `tap`/`only_open` → good; amount match, typed, or unknown binding → basic; nothing → none. An invoice lifts it one step. Pure function of the tag and invoice only, so a report never changes it (no tipping off). On every merchant transaction (`strength`), every Soundbox payment (`strength` level) and the certificate (`strength`). A description, never a promise. Tests: `tests/proof-strength.test.ts`.
- `ledger.ts` — `recordPayment`, `getTransaction`, `listTransactions(merchantId)`, `getSaleTag`, `needsTag`, `recordSaleTag` (the only write path for tags: one per transaction, refused after a hold or after `TAG_WINDOW_SECONDS`, returned frozen, and the database refuses to change it), `LedgerError`.
- `invoices.ts` — `recordInvoice({ txnId, bytes, totalInr? })`, the only write path for invoices: the active merchant's own payment, inside `TAG_WINDOW_SECONDS`, before any hold, once; type from the magic bytes (`invoiceKind`), not the client MIME; `totalInr`, if given, must equal the payment. Stores the SHA-256 and drops the bytes. `getInvoice`, `MAX_INVOICE_BYTES`. Served by `POST /api/invoice` (`src/app/api/invoice/route.ts`, multipart `txnId`, `file`, `totalInr?`; 413 over 2 MB, 429 past the `upload` rate limit of 20/min, 400 otherwise) through `attachInvoice` in `api.ts`, which replies `{ result, state }` like `/api/kavach`. The merchant snapshot's transactions carry `invoice` and `canAttachInvoice` (any amount); the certificate carries an `invoice` block and a provenance line saying the contents are the merchant's, not verified.
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
- Record the purpose and retention of any buyer data held (DPDP Act): add a row to `data_purposes` by migration. Consent is not recorded (the buyer never interacts with Kavach), and automatic erasure when a hold and grievance close is not built yet.
- Every draft response carries the disclaimer fields: draft, not legal advice, no guaranteed release.
- No pre-hold warnings to merchants.
- Nothing here writes to `rules/`. The watcher only flags.
