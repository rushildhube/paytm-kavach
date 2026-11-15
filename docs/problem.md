# Open problems

Two gaps in the tagging flow that the demo hides but a real shop would hit on day one. Neither has a decision yet; this file states the problem, the options and the guardrails any answer must keep. Discussion: GitHub issue #15.

---

## Problem 1: many payments at the same time

### The situation

A kirana counter at 7 pm: four customers pay within a minute, ₹826, ₹120, ₹560 and ₹826 again. The Soundbox announces each one. The merchant is handing over goods, counting change and talking to the next customer. Later, a hold lands on one of those payments. Which sale was it, and did the merchant tag the right one?

### What the code does today

- Each payment of ₹500 or more gets a 120-second tagging window (`TAG_WINDOW_SECONDS` in `backend/config.ts`).
- The UI shows **one** pending payment at a time (`frontend/KavachApp.tsx`, the first transaction with `canTag`), and the demo **disables the Pay button** while a tag is pending. So the demo never has two open windows at once.
- A spoken tag is bound to whichever payment the screen is showing. Nothing in the tag itself says which payment it belongs to.

### Why it matters

- **Missed tags.** In a rush the merchant will not speak within 120 seconds, so the busiest hours, where most money moves, get the least proof.
- **Wrong tags are worse than missing ones.** If the merchant says "do kilo cheeni" while the screen has already moved to the next payment, the proof is attached to the wrong sale. A certificate built on a mismatched tag can be torn apart by the bank or police, and it damages trust in every other certificate.
- **Two payments of the same amount** (the two ₹826 above) cannot be told apart by amount alone.
- **The merchant cannot "remember later".** Back-dated tagging is forbidden by design; that rule is what stops fraudsters manufacturing proof. So the fix cannot be "let them tag at closing time".

### Options

| | Option | How it works | Strength | Weakness |
|---|---|---|---|---|
| A | **Queue of open windows** | Every qualifying payment gets its own card and countdown; the merchant taps a card, then speaks. | Simple; no binding ambiguity because the tap chooses the payment. | Needs a tap and a look at the screen during a rush; the Soundbox has no screen. |
| B | **Say the amount in the tag** | "Aath sau chhabbis wala: do kilo cheeni, ek tel." The parser matches the spoken amount to an open payment. | Voice only; works from the Soundbox. | Fails for two equal amounts; adds speech-recognition risk on numbers. |
| C | **Short code per payment** | The Soundbox says a two-digit code with the announcement ("₹826 mila, code 47"); the merchant starts the tag with "47". | Works for equal amounts; voice only. | One more thing to say; codes repeat across the day. |
| D | **Bill before payment** | The merchant states or scans the items first; Paytm creates a dynamic QR for that amount with the order attached; the customer pays that QR. | The proof exists **before** the money moves and is bound by order id, not by timing. Strongest proof; no race at all. | Changes the merchant's habit; needs dynamic QR or a billing screen at the counter. |

### Leaning

D is the strongest answer and fits the product line ("the proof already exists before the freeze happens"), but it is a bigger change. A is the practical fix for the demo and the static-QR shop. B and C can sit on top of A for Soundbox-only merchants.

Whatever is chosen:

- If the system is not sure which payment a tag belongs to, it **leaves the payment untagged** and asks; it never guesses.
- Tags stay append-only and inside a short window per payment. A queue changes how many windows are open, not how long each lasts.
- The certificate says how the tag was bound (tap, spoken amount, code, or order id), so a reader can judge its weight.
- An untagged sale is still allowed and still gets a certificate from Paytm's own records, without the merchant's words.

### Open questions

- Should the window be longer when several payments are open at once, or does that weaken the proof too much?
- How common are equal-amount payments within two minutes? (Needs real Soundbox data.)
- Is dynamic QR with an order attached available to small Soundbox merchants today? Check before claiming it.

---

## Problem 2: attach an invoice instead of speaking

### The situation

Many merchants already make a bill: a GST billing app, a printed bill book, a photo of a handwritten parchi. For them, speaking the items again is extra work, and the bill is better evidence than a voice note: it has item lines, quantities, rates and a bill number. They want to attach the invoice from a dashboard.

### Why it is not as simple as an upload button

Kavach's whole claim is that the proof was recorded **at payment time** and tied to Paytm's own data. An upload screen breaks that unless it is designed carefully:

- **Back-dating.** A merchant (or a fraudster) can make an invoice after a hold appears. An invoice uploaded the day after the freeze is exactly the "letter written after the fact" Kavach says it is not.
- **Editing.** A dashboard invites "fix the invoice". Proof is append-only.
- **Buyer data.** GST invoices often carry the buyer's name, phone, address or GSTIN. That is personal data under the DPDP Act; we store only what we need and mask the rest.
- **Matching.** The invoice total has to match the payment, and the invoice has to be linked to one payment, which is Problem 1 again.

### Options

| | Option | How it works | Weight as proof |
|---|---|---|---|
| A | **Attach inside the payment window** | From the open payment card, the merchant attaches a photo or PDF of the bill within the same short window as a voice tag. We store a hash, the time and the extracted items; the total must equal the payment amount. | Same as a voice tag: recorded at payment time. |
| B | **Invoice first, then pay** | The billing app or Kavach dashboard creates the invoice, which creates the payment request (dynamic QR or payment link). Invoice id and payment id are linked before money moves. | Strongest: the invoice provably existed before the payment. Same idea as Problem 1, option D. |
| C | **Billing-app link** | The merchant's existing billing software sends each bill (number, total, items, time) to Kavach as it is created; Kavach matches it to the payment by amount and time. | Good if the billing app's timestamp is trustworthy; weaker than B because matching is after the fact. |
| D | **Upload later, labelled** | Allowed at any time, but shown on the certificate as "added by the merchant on <date>, after the payment, not verified by Paytm" and kept apart from the payment-time proof. | Weak; useful only as supporting material. Must never be blended into the verified section. |

### Leaning

Offer A now (it is the voice tag with a different input) and design toward B. Allow D only if it is clearly separated and labelled, or not at all; it is the feature most likely to be abused and the one that most weakens the pitch.

Whatever is chosen:

- The invoice is fixed once attached: store a hash and the time; a later "correction" is a new, separately dated record, never an overwrite.
- The invoice total must match the payment amount; a mismatch is shown, not hidden.
- Strip or mask buyer details before storing; keep the items, quantities, totals, bill number and time.
- No back-dated attachment counts as payment-time proof.
- The certificate keeps three things apart: Paytm's records, what the merchant said or attached at payment time, and anything added later.

### Open questions

- Which billing apps do our target merchants use, and do any of them expose an API or webhook?
- Do we read the items from the invoice image (OCR via Sarvam or similar), or store only the file and its total?
- Should a photo of a handwritten parchi count the same as a GST invoice?
- Where would the dashboard live: Paytm for Business app, web, or both?
