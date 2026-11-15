# Making the merchant's proof stronger

Written 2026-11-15. Proposals, not decisions. Each item says what it adds, what it costs, and which guardrail it touches. Nothing here is built yet unless marked **(built)**.

## Where the proof stands today

What a sale record holds on `main` (d6ccf35, after PR #32):

| Part | Source | Status |
|---|---|---|
| Amount, time, UTR, masked payer, settlement | Payment and settlement data | **(built)** |
| What was sold, said on the Soundbox within the tag window | Merchant's voice, `source: "voice"` | **(built)** |
| What was sold, from a bill made before payment | Bill QR, `source: "bill"`, `boundBy: "bill"` | **(built)** |
| Bill sent to the Soundbox (QR shown, or spoken "please pay ₹X for …") | `bill-create {soundbox}`, `bill-to-soundbox` | **(built)** |
| Bill spoken on the Soundbox (amount = largest number heard, shown before payment) | `bill-voice` | **(built)** |
| Typed description for a direct payment, inside the same 120 s window | `bill-for-payment`, `source: "typed"`, `boundBy: "tap"` | **(built)** |
| How the words were tied to the payment | `boundBy`: `bill`, `tap`, `only_open`, `amount` | **(built)** |
| Invoice fingerprint (SHA-256), attached inside the window | `POST /api/invoice` | **(built)** |
| Append-only storage | SQLite triggers on `sale_tags` and `bills` | **(built)** |
| Certificate with provenance lines and disclaimer | `backend/certificate.ts` | **(built)** |

**The weak point:** nearly everything that says *what was sold* comes from the merchant. Paytm can vouch that a payment happened and when, and that the words were recorded at payment time. It cannot vouch that the words are true. A bank officer reading the certificate sees "the merchant said so, promptly". The proposals below add evidence that does not come from the merchant alone.

The other session's own list of weak spots (2026-11-15) matches this one:
- A typed description is the merchant's word, written seconds after the payment.
- Bill text and items are self-declared, with no check against stock or GST invoices.
- The invoice is a fingerprint only.
- No third party signs or timestamps anything.
- The buyer never confirms what they bought.
- A phone scanning the Soundbox screen has not been tested.

Already ruled out: matching static-QR payments to bills by amount (guessing), and any tag or bill after the window or after a hold.

## Proposals, strongest first

### 1. The buyer sees the bill and approves it

**Status: built (2026-11-15, decided on #19).** `bill-lookup` returns the bill's items, the customer screen shows them before the PIN, `pay` records `buyerApproved` only when the text it showed matches the bill, an approved bill is graded strong, and every bill QR carries the items in `tn` (`billNote`, 50 characters). Whether `tn` reaches the payer bank's statement is still unverified.

**What:** When a buyer pays a bill QR, their payment screen shows the bill text ("1 ghee, 2 soap, ₹826") before the PIN. The payment record then shows the buyer saw and approved that description. The text can also travel in the UPI note field (`tn`), so it lands in the **payer's own bank record**, not just ours.

**Why it matters:** The fraud report comes from the payer's side of the money. A description the payer's own app showed, and that sits in the payer bank's record, is the strongest single answer to "was this a real sale?" It is the closest thing to a receipt signed by both sides.

This also covers bills on the Soundbox screen, which now always shows a QR: the buyer scanning it would see the same text.

**Cost:** Small for the demo: `bill-lookup` already returns the bill to the customer screen; it would also return the text, and the pay screen would show it. For real: needs Paytm to carry the note through UPI (unverified whether `tn` survives to the payer bank's statement for every PSP).

**Guardrails:** The buyer sees only their own purchase. The note must not carry the merchant's other data. Today `bill-lookup` deliberately hides the text from the customer (#19); this changes that decision, so it needs agreement on #19 first.

### 2. A certificate the bank can check for itself

**What:**
- Paytm signs each certificate.
- The certificate carries a short verify code and QR. A bank officer opens a Paytm page with the code and sees the same record served from Paytm, not from the merchant's PDF.
- The page shows only what the certificate shows.

**Why it matters:** A PDF from the merchant can be edited. A record the bank fetches from Paytm cannot. This is the "verified proof" claim in `CLAUDE.md`, made checkable by the reader.

**Cost:** Demo: a `/verify/[code]` route that reads the ledger, plus a hash of the certificate body printed on it. Real: key management and a public verify page.

**Guardrails:** The verify page must not reveal anything beyond the certificate, and must not exist for a sale until a hold exists, so it can't tip anyone off.

### 3. A tamper-evident ledger, not just a protected table

**What:**
- Each sale record stores the hash of the previous one (a hash chain).
- Once a day Paytm publishes the day's final hash, or has it timestamped by an outside timestamping authority (RFC 3161), so someone other than Paytm can vouch for the date.
- The certificate includes the record's position in the chain.

**Why it matters:** SQLite triggers stop *our app* from editing a record. They don't convince an outsider, because the database owner could still rewrite history. A chain whose daily end-point was published earlier proves the record existed *before* the freeze, which is the whole pitch.

**Cost:** Small: one extra column, one hash at insert time, a daily job. For the demo, show "recorded before the hold: chain position N, day hash published 14 Nov".

**Guardrails:** Hashes only. No buyer data leaves the ledger.

### 4. A proof strength label on every sale

**What:** Each payment gets a plain label the merchant sees in the Proofs tab and on the Soundbox:
- **Strong:** a bill the buyer approved, or a bill plus an invoice.
- **Good:** a voice tag bound by `tap` or `only_open`.
- **Basic (typed):** a typed description written just after the payment; the certificate already says so.
- **Basic:** a voice tag bound by `amount`.
- **None:** no tag.

The certificate shows the same label with its reason.

**Why it matters:** The merchant learns, at the counter, which habits make a payment defensible. It also stops anyone overselling a weak record to a bank officer.

**Cost:** A pure function over the existing fields, plus a chip in the UI.

**Guardrails:**
- It's a description, not a promise. The disclaimer still applies.
- Never phrase it as "safe from freezes".
- Show it on every payment, not only on reported ones, so it doesn't tip anyone off.

### 5. Fewer missed tags, without late tags

Proof must stay append-only, so the answer to missed tags is to miss fewer, never to add them later.

- **Favourite items on the Soundbox buttons:** one press tags "milk" or "recharge" for repeat sales.
- **Push bills as the default for ₹500 and above:** the merchant app suggests making a bill when they open the app during a sale.
- **Repeat last tag:** for queues of identical sales, such as tea or bus tickets.
- **End-of-day summary:** shows untagged payments ₹500 and above as "no proof". It's for awareness only and has no add button. Next day the merchant can switch on bills for that kind of sale.

**Guardrails:** No back-dating, ever. The summary must not show reports or holds (no tipping off).

### 6. Context that makes the sale believable

**What:** Facts Paytm already has that make a sale plausible, shown as context and never as proof of innocence:
- The Soundbox device ID and its registered shop location.
- How long the merchant has used Paytm.
- Their usual payment size, and whether this payment fits it.
- The share of their payments ₹500 and above that were tagged.

**Why it matters:** "₹826 at a kirana, normal for this shop, 92% of big payments tagged for 8 months" reads very differently from a one-off ₹49,000.

**Cost:** Mostly data we already mock in `data/`.

**Guardrails:**
- This works both ways. If the context looks like a mule account (sudden large inflows, no tags, a new account), the mule screen routes the merchant to legal aid and no certificate is issued (`CLAUDE.md`).
- Minimise data: aggregates only, no other buyers' details.

### 7. A file the bank and police can actually use

**What:** One pack per hold, containing:
- The certificate.
- The verify code (item 2).
- The bill or tag for each held payment.
- The invoice fingerprints.
- A one-page summary in the format a nodal officer expects.

When many payments are held, the pack covers all of them, not one at a time.

**Indian evidence law:** this probably needs a certificate for electronic records. It is **not in `rules/` yet**. Add it only after checking the primary source, per the "facts from a table" rule.

**Guardrails:** The merchant reviews the pack and files it themselves. Kavach never sends it.

## What we will not do

- Accept tags or invoices after the window, or after a hold. This would mean back-dated proof.
- Store buyer names, phone numbers or full account numbers to "strengthen" a record.
- Score or label merchants in a way they can see before a hold exists.
- Tell a merchant their proof guarantees release.

## Suggested order for the demo

1. **Proof strength label (4):** cheap, and visible on stage.
2. **Buyer sees the bill (1):** the strongest story; needs a #19 decision.
3. **Verify code and hash chain (2, 3):** together they make the "verified, before the freeze" line demonstrable.
4. **Fewer missed tags (5):** the favourite buttons and the end-of-day summary.
5. **Context and the hold pack (6, 7):** these come later, after the rules check.

## Open questions

- Does the UPI note field reach the payer bank's statement for all PSPs? (unverified)
- Is a merchant-side "proof strength" label acceptable under the no-tipping-off guardrail if it is shown on every payment, all the time? We think yes, because it is about the merchant's own records, not about any report.
- Who holds the daily chain hash in a real deployment: Paytm, a bank, or a public log?
