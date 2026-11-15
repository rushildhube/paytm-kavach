# Competitors and prior art

Who has built something close to Kavach, and how much it overlaps.

**The honest summary:** tools that help a merchant write a letter after a freeze already exist. Kavach does not claim that as new. What we have not found anywhere is proof of sale recorded **at payment time**, checked against the payment company's own records, captured by voice in the merchant's language.

Most entries below come from the November 2026 research notes and are marked as such. A web search on 2026-11-15 for "Wapas" letter tools found nothing, so even its existence is unconfirmed.

## Overlap table

| Who | What it does | Side | Overlap with Kavach | Source |
|---|---|---|---|---|
| Government Grievance Redressal Module (NCRP-CFCFRMS) | Where the bank files the grievance and police decide; running since April 2026 | Government | **None: it is the destination.** Kavach prepares what the merchant hands to the bank, which files here. | [PIB release 2287674](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287674), checked 2026-11-15 |
| Wapas | Student prototype that drafts an unfreeze letter (unverified, from Nov 2026 research notes) | Account holder, after the freeze | **High** on drafting. None on proof at sale. | none; web search 2026-11-15 found no trace |
| Lawyer and personal-finance sites | Sample letters and guides for unfreezing an account (unverified, from Nov 2026 research notes) | Account holder, after the freeze | **Medium.** Generic templates; no payment data, no tie to the held transaction. | none in repo |
| Clari5 | Fraud and transaction-monitoring software for banks (unverified, from Nov 2026 research notes) | Bank | **None.** It helps banks flag and hold; Kavach helps the honest merchant show the sale was real. | none in repo |
| Other Paytm hackathon entries | None found doing pre-freeze proof (unverified, from Nov 2026 research notes) | n/a | **None found** | none |

## Where Kavach is different

| | Letter tools (Wapas, legal sites) | Kavach |
|---|---|---|
| When the evidence is made | After the freeze, from memory | At the moment of sale, within a 120-second window |
| Whose data | What the merchant types | Paytm's own transaction and settlement records, plus the merchant's spoken tag |
| Can it be back-dated | Yes | No. Tags are append-only and only accepted inside the window |
| How the merchant uses it | Type a form | Speak in their own language, in the app and Soundbox they already use |
| Who files | Varies | Always the merchant, through their own bank |

The MHA procedure (s.9.5) already expects payment aggregators to upload settlement and order details for a held payment ([SOP via Meghalaya HC](https://meghalayahighcourt.nic.in/sites/default/files/news/N347.pdf), checked 2026-11-15). That is why a payments company, not a letter-writing site, is placed to build this.

## What we did not check

- Whether Wapas exists, what it does, and whether it is live.
- Which lawyer or finance sites offer letter generators, and whether any use payment data.
- Clari5's product scope, from its own site.
- Whether PhonePe, BharatPe, Razorpay or banks offer anything similar for merchants. Not researched.
