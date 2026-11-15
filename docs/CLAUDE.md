# docs/

Human-readable material: the pitch, the research behind it, and the legal landscape. Nothing here is read by code at runtime; machine-readable rules live in `rules/`.

## What belongs here

- `pitch.md` — the six slides:
  1. The line
  2. The problem (Faridabad scam with 36,000+ frozen accounts; a ₹1,000 payment freezing ₹8.26 lakh; Indore traders boycotting UPI)
  3. Why now (January Home Ministry procedure, August Supreme Court directions, September RBI draft on bank-initiated holds)
  4. What only Paytm can do (proof at sale, verified proof, reach and language)
  5. The demo
  6. What Paytm gains (retention, a reason to pay for the device, standing with regulators)
- `judge-qa.md` — likely questions and answers: "letter generators exist", "how is this growth", "won't fraudsters use it", "is this legal advice".
- `competitors.md` — who has built what and the overlap: government grievance portal (the destination, not a competitor), Wapas (high overlap), lawyer/finance letter sites (medium), Clari5 (bank side, none), other Paytm hackathon entries (none found).
- `legal-landscape.md` — narrative on the freeze laws (BNSS 168/94, 106, 107; PMLA 12AA; Home Ministry procedure of 2 Jan 2026; Supreme Court directions of 4 Aug 2026; RBI draft KYC amendment of 11 Sep 2026), laws on Paytm (payment aggregator licence, duties in the freeze procedure, fraud scoring, UPI fee rules), and governance on the product (DPDP Act, RBI FREE-AI, Advocates Act, tipping off).
- `sources.md` — every citation with URL and the date it was last checked.

The facts listed above come from the November 2026 research notes. In the docs built from them, anything not checked against `sources.md` or its primary source is marked "(unverified, from Nov 2026 research notes)".

## What is here now

- `sources.md` — the primary source behind each entry in `rules/rules.json`, checked 2026-11-15, with the quoted words and section numbers. It opens with a table of six claims from the research notes that turned out wrong (for example: BNSS 168/94 do not themselves limit a hold; the ladder is bank 7 + police 15 days, so escalation is day 22, not 15; Allahabad and Karnataka allow police freezing under s.106, not the reverse; the RBI draft lifts the hold on day 31, with 60 days as the ceiling). It ends with a "Not yet done" list (Allahabad and Karnataka judgments read only through reports, RBI draft PDF not opened, MHA procedure read via a High Court annex).

- `problem.md` — open product problems with options and the guardrails any answer must keep: (1) many payments at once, so tags can be missed or bound to the wrong sale; (2) attaching an invoice from a dashboard instead of speaking, without allowing back-dated proof.

- `legal-landscape.md` — freeze laws with a status label each (MHA procedure, BNSS 168/94, 106, 107, Supreme Court order, RBI draft), the one verified duty on Paytm (s.9.5 settlement upload), product governance (DPDP, FREE-AI, Advocates Act, tipping off), and a still-to-check list. Laws on Paytm and governance items are mostly unverified.

- `competitors.md` — overlap table (grievance module, Wapas, letter sites, Clari5, other hackathon entries) and a letter-tool vs Kavach comparison. Wapas could not be found by web search on 2026-11-15.

- `judge-qa.md` — short sourced answers on novelty, growth, fraudster abuse, tipping off, privacy, legal advice, release, s.106, the RBI draft, and the `problem.md` questions (many payments at once, missed windows, invoices, dynamic QR, Soundbox payer name, the ₹500 threshold).

- `pitch.md` — the six slides with on-screen text, talk track and a source per fact. Notes the corrected figures: ₹1,000 froze ₹8,26,633 (AP HC, *Sri Sai Wines*), Faridabad 36,000+ is trade press, Indore protest was December 2024.

## Rules for this folder

- Be honest about prior art. Say plainly that letter drafting exists and that the novelty is pre-freeze, payment-company-verified proof.
- Mark the status of each legal instrument: statute, contested, administrative, binding direction, or draft. Section 106 is contested between High Courts; the RBI amendment is a draft (proposed start 1 April 2027; the Supreme Court expects final rules by the end of 2026). See `sources.md` for what each claim rests on.
- Every factual claim needs a source and a checked date. This area changed three times in 2026.
- No claim that Kavach guarantees release of funds.
- When `rules/rules.json` changes, update `sources.md` in the same change.
