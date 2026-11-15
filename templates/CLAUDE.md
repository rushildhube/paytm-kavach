# templates/

Fixed document wording. Templates hold the structure and the mandatory wording; the backend fills verified data. They are also the offline fallback and the reference draft the model is asked to improve on.

## What belongs here

- **Hold explanation** — short Hindi text read aloud when the hold appears.
- **Grievance to the bank** — the representation the merchant gives their bank, which files it on the government Grievance Redressal Module, with slots for facts and for rule citations from `rules/`.
- **Escalation letter** — the next rung of the grievance ladder when a deadline passes without reply.
- **Legal-aid referral** — the hand-off given when the mule screen fails.
- **Sale certificate** — not a template here: the data is assembled by `backend/certificate.ts` and laid out by `CertificateCard` in `frontend/parts.tsx`.
- **Bank-hold explanation** — the merchant's response within the 20-day window for a bank-initiated hold (not built yet; draft rule, label accordingly).
- Language variants — today the explanation and referral are Hindi, the letters English only (other variants not built yet).

## What is here now

- `drafts.ts`:
  - Types `DraftKind` (`explanation` | `grievance` | `escalation`) and `DraftFacts` (`certificate`, `ownerName`, and for escalation `filedAt`, `daysSinceFiled`, `nextLevel`).
  - `explanationHi`, `grievanceLetter`, `escalationLetter`, and `templateDraft(kind, facts)` which picks one.
  - `LEGAL_AID_REFERRAL_HI`, `LEGAL_AID_REFERRAL_EN` (used by the `packet` action in `backend/api.ts`).
- Legal references are `[rule:<id>]` markers (`merchant-sale-details`, `grievance-via-bank`, `mha-procedure-2026`, `hold-limited-to-amount`, `police-contact-from-bank`, `sc-directions-2026-08-04`), resolved into numbered citations by `agent/checks.ts`.
- Dates are printed in IST. Amounts come only from the certificate.

## Rules for this folder

- Every draft carries the disclaimer: draft, not legal advice, no guaranteed release. It is attached as `Draft.disclaimer` by `agent/drafts.ts` and appended on copy and download, not written into the template text.
- Rule citations are `[rule:id]` markers filled from `rules/` with source and last-checked date, never hard-coded law text. Template wording must pass `checkDraft` (no law names outside markers, no promises, no amounts outside the facts); a test enforces this.
- Buyer details are masked in every template.
- The certificate must make clear which fields come from Paytm records and which is the merchant's own tag.
- Templates are addressed from the merchant, for the merchant to file. Nothing is written as if Paytm or Kavach is the filer.
