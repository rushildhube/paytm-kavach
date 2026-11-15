# templates/

Fixed document layouts. Templates hold the structure and the mandatory wording; the backend fills verified data and the agent fills the narrative parts.

## What belongs here

- **Sale certificate** — Paytm-record proof of a sale: transaction id, amount, date and time, settlement status, the sale tag captured at payment time, merchant identity with last four account digits.
- **Grievance to the bank** — the representation the merchant gives their bank, which files it on the government Grievance Redressal Module, with slots for facts and for rule citations pulled from `rules/`.
- **Escalation letter** — the next rung of the grievance ladder when a deadline passes without reply.
- **Bank-hold explanation** — the merchant's response within the 20-day window for a bank-initiated hold (draft rule; label accordingly).
- **Legal-aid referral** — the hand-off given when the mule screen fails.
- Language variants (Hindi and English first).

## Rules for this folder

- Every template carries the footer: draft, not legal advice, no guaranteed release.
- Rule citations are slots filled from `rules/` with source and last-checked date, never hard-coded text.
- Buyer details are masked in every template.
- The certificate must make clear which fields come from Paytm records and which is the merchant's own tag.
- Templates are addressed from the merchant, for the merchant to file. Nothing is written as if Paytm or Kavach is the filer.
