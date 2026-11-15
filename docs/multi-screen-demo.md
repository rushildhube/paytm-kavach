# Multi-screen demo: design and context

Status: **in progress** on branch `feat/multi-screen-demo` (started 2026-11-15).
Read this before touching the demo screens. It explains what we are building, why, and what is decided.

## Why we are doing this

The first version (`/`) is one merchant screen with "demo controls" buttons for the payment and the hold. Judges have to imagine the Soundbox, the buyer and the bank.

The new version puts each actor on its own screen, on real devices, so the story plays out live:

> A buyer pays on their phone → the Soundbox announces it and the shopkeeper tags the sale by voice → later the victim reports the payment → the bank freezes the account → Kavach on the merchant's phone already has the proof.

The point the judges must see: **the proof was recorded three steps before anyone froze anything.** That is the novelty (see root `CLAUDE.md`). The letter is not the novelty.

## The four screens

All four read the same in-memory server state (`backend/store.ts`) through `POST /api/kavach`, and poll it about once a second.

| Route | Device | Who it plays | What happens there |
|---|---|---|---|
| `/customer` | Phone 1 | The buyer (secretly paying with stolen money) | Paytm-style pay flow: scan shop QR → ₹826 → UPI PIN → success. Payer handle is synthetic and masked server-side. |
| `/soundbox` | Phone 2 | The Paytm Soundbox on the counter | Announces "Paytm पर ₹826 प्राप्त हुए", asks "क्या बेचा?", records the shopkeeper's voice tag within the 2-minute window, confirms it is saved. Needs one "power on" tap so the browser allows audio. Never shows reports or holds. |
| `/merchant` | Phone 3 or laptop | The shopkeeper's Paytm for Business app with Kavach | Payment list with tags. When a hold appears: red alert, Hindi explanation, mule screen, sale certificate, grievance draft, "I filed it myself", tracker, escalation at day 15. |
| `/bank` | Laptop | Bank + 1930/NCRP cybercrime side, and the presenter's control panel | 1) Victim files a complaint on a payment → acknowledgement number. 2) The bank applies a hold with a chosen scope. 3) Simulate day 15. 4) Reset the whole demo. Also shows the links for the other screens. |

`/` stays as the single-screen fallback.

## Demo order on stage

1. **Customer** pays ₹826 to Sharma Kirana Store.
2. **Soundbox** announces it. The shopkeeper says "do kilo cheeni, ek tel" and the box confirms it.
3. **Merchant** shows ₹826 with the 🛡 tag. All normal.
4. **Bank**: the victim reports the payment. *The merchant and Soundbox screens show nothing.* That is the no-tipping-off guardrail.
5. **Bank**: the bank applies a debit freeze. The merchant screen turns red.
6. **Merchant**: explanation → two screening questions → certificate and grievance → "I filed it at my bank".
7. **Bank**: simulate day 15 → the escalation draft appears on the merchant screen.

## How it works in real life (research, 2026-11-15)

We searched for how UPI cyber-fraud freezes reach merchants. Summary, with confidence levels:

- **The chain.** Victim calls 1930 or files on NCRP → the complaint goes into CFCFRMS → an electronic notice goes to the bank(s) that received the money → the bank restricts the account. The merchant usually finds out only when a withdrawal or settlement fails. *(Blogs and explainers. Consistent, but not primary.)*
- **Lien vs debit freeze.** A *lien* blocks only the disputed amount. A *debit freeze* stops all withdrawals. Merchants report whole-account freezes over small amounts. *(Blogs and forum posts.)*
- **MHA SOP, reported as 2 January 2026.** Reportedly makes a lien on the disputed amount the norm and a full freeze the exception. Reportedly a 90-day limit without a court or restoration order, and fast refunds under ₹50,000. *(News reports only. We have not seen the SOP itself.)*
- **Paytm-specific handling** (whether the restriction lands on the merchant's own bank account or on Paytm's settlement) is **unknown**. We found nothing authoritative. Ask Paytm merchant support or a bank nodal officer before claiming it in the pitch.

Sources:
- [The Week, bank account freeze over UPI cyber fraud](https://www.theweek.in/news/biz-tech/2026/09/25/bank-account-freeze-over-upi-cyber-fraud-what-are-your-rights.html)
- [Business Standard, new MHA SOP](https://www.business-standard.com/india-news/mha-sop-cyber-fraud-refunds-below-50000-no-court-order-126011500706_1.html)
- [Drishti IAS, MHA's new SOP on cyber financial frauds](https://www.drishtiias.com/daily-updates/daily-news-analysis/mhas-new-sop-on-cyber-financial-frauds)
- [MediaNama, Delhi HC asks MHA for a freezing policy](https://www.medianama.com/2025/03/223-cybercrime-impact-on-bank-accounts-delhi-hc-urges-mha-to-address-blanket-bank-account-freezes/)
- [LiveLaw, from stolen data to frozen bank account](https://www.livelaw.in/articles/stolen-data-frozen-bank-account-552599)
- [Vyapar Gateway, merchant account freezes](https://vyapargateway.com/blog/cyber-crime-1930-bank-account-freeze-unfreeze)

**Rule:** anything from this research that appears in a screen or draft (lien as the norm, 90 days, ₹50,000) must come from `rules/rules.json` with its source and `verified: false` until someone checks the primary SOP. Never hardcode it in UI copy.

## Decisions

- **Hold scope is chosen on the bank console:** `debit_freeze` (default, the real-world pain) or `lien` (what the SOP reportedly intends). With a debit freeze, Kavach explains that the complaint concerns only ₹826, and the grievance asks the bank to narrow the freeze to a lien on ₹826. It never promises release.
- **Report and hold are separate events.** `report` creates a bank-side complaint record; `hold` acts on it.
- **Per-screen snapshots.** `snapshot(role)` returns different data per screen. The merchant and Soundbox never receive reports. The customer receives no merchant hold data at all.
- **Reset epoch.** `store.epoch` goes up on every reset. Screens that see a new epoch return to their start state, and the Soundbox does not re-announce old payments.
- **Devices:** real phones and a laptop on the same Wi-Fi. Phone browsers only allow the mic over HTTPS, so run `next dev --experimental-https -H 0.0.0.0` (self-signed certificate: accept the warning on each phone) and add the LAN IP range to `allowedDevOrigins`. Plan B: a cloudflared or ngrok tunnel. Plan C: the "Use recorded clip" button.
- **Speech:** Sarvam TTS when `SARVAM_API_KEY` is set. Otherwise the Soundbox uses the browser's own `speechSynthesis` (hi-IN) so it is never silent on stage.
- **Single long-lived process.** The store is in memory, so run on the laptop. Do not deploy serverless.

## Data model changes (`backend/`)

- `types.ts`: new `FraudReport { id, txnId, ackNo, reportedAt, amountInr }`, and `HoldScope = "lien" | "debit_freeze"` on `Hold`.
- `store.ts`: `reports[]`, `nextReport`, `epoch`.
- `holds.ts`: `reportFraud(txnId)`; `placeHold(txnId, type, scope)` uses the report's ack number as the hold reference.
- `certificate.ts`: the certificate's hold block carries `scope`.

## Work plan

- [x] Branch, research, this document
- [x] Backend types: report, hold scope, reset epoch
- [ ] `api.ts`: role-scoped snapshots; `report` action; `hold` with scope; `pay` with payer handle
- [ ] Tests: no report data in merchant/soundbox snapshots before a hold; scope stored; epoch increments
- [ ] `rules.json`: SOP lien entry (news source, unverified); templates and prompts handle `debit_freeze`
- [ ] Shared polling hook in `frontend/`
- [ ] `/customer`, `/soundbox`, `/bank`, `/merchant` pages
- [ ] `dev:lan` script and `allowedDevOrigins`
- [ ] Try it on real phones: mic over HTTPS, iOS recording format, audio unlock
- [ ] Rewrite `demo/script.md` for four screens; fix README wording (drafting is Sarvam now, not Claude)

## Conventions for whoever continues

- Commit on `feat/multi-screen-demo`, not `main`. No Claude co-author lines in commits.
- Keep the guardrails in root `CLAUDE.md`, especially no tipping off, human submits, and dated sources.
