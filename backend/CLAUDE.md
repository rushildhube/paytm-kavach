# backend/

API and deterministic core logic. Anything that must be trustworthy and repeatable lives here, not in the LLM.

## What belongs here

- **Proof-of-sale ledger** — append-only store of sale tags, each bound to a transaction id and written at payment time. No endpoint may create or edit a tag for a past transaction after the fact.
- **Payment event intake** — receives (simulated) payment events and triggers the tagging prompt when the amount meets the threshold.
- **Hold handling** — receives a hold event, links it to the transaction, and works out the hold type and held amount.
- **Sale certificate builder** — assembles the certificate from transaction, settlement and sale-tag records. Pure data assembly, no model involved.
- **Eligibility and mule screen checks** — the hard rules: no certificate for repeatedly reported accounts; mule indicators route to legal aid.
- **Grievance tracker** — state machine over the grievance ladder from `rules/`: filed, awaiting officer, escalation due, escalated. Supports a simulated clock for the demo.
- **Rules loader** — reads and validates `rules/` and serves entries with source and last-checked date.
- **Agent endpoints** — call into `agent/` for drafting, passing only verified facts.

## Rules for this folder

- The backend never files, emails or submits anything to a bank, police or portal. It produces drafts for the merchant to file.
- Certificates use Paytm-side records only. Merchant-typed text appears solely as the sale tag captured at payment time, labelled as such.
- Store last four account digits; mask buyer details in every response and log.
- Record purpose and consent for any buyer data held (DPDP Act).
- Every draft response carries the disclaimer fields: draft, not legal advice, no guaranteed release.
- No pre-hold warnings to merchants.
