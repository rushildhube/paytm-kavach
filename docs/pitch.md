# Pitch: six slides

Each slide has what goes on screen, what to say, and the source behind each fact (checked 2026-11-15 unless marked otherwise). Do not add a number to a slide without a source here.

Footer on every slide: *Kavach produces drafts, not legal advice. It cannot guarantee that held money will be released.*

---

## 1. The line

**On screen:**
> Other tools help a merchant write a letter after the account is frozen.
> Kavach makes sure the proof already exists before the freeze happens.

**Say:** Kavach records what was sold at the moment of payment, so an honest merchant already has the evidence if a fraud report later puts that payment on hold.

---

## 2. The problem

**On screen:**

| | | Source |
|---|---|---|
| 36,000+ | accounts frozen across India after one ₹4.43 crore fraud case in Faridabad | [the420.in](https://the420.in/faridabad-cyber-scam-upi-fraud-accounts-frozen-home-ministry/) (trade press) |
| ₹1,000 → ₹8,26,633 | one UPI payment to a liquor shop froze the whole account; Andhra Pradesh HC called it illegal | *Sri Sai Wines v. Union of India*, 22 June 2026, via [SCC Online](https://www.scconline.com/blog/post/2026/08/01/ap-hc-directs-unfreezing-bank-account-upi-transaction/) |
| Indore | garment traders told shops to stop accepting UPI over account freezes (Dec 2024) | [Devdiscourse, 27 Dec 2024](https://www.devdiscourse.com/article/business/3208368-garment-traders-protest-upi-payment-freeze-in-indore) |

**Say:** Shopkeepers take a payment, the payer's money turns out to be stolen, and the shopkeeper's money is held. To get it released, they have to show the sale was real, weeks after it happened.

**Careful:** the research notes said "₹8.26 lakh"; the reported figure is ₹8,26,633 (about ₹8.27 lakh). The Faridabad figure is from trade press, not an official release. The Indore protest is from 2024, not 2026. The judgment was read only through SCC Online's report.

---

## 3. Why now

**On screen:** three dates in 2026.

| Date | What | Status | Source |
|---|---|---|---|
| 2 Jan 2026 | Home Ministry procedure: hold only the reported amount; bank files a grievance within 7 days, police decide within 15, then the District Grievance Officer within 15 | administrative | [MHA SOP via Meghalaya HC](https://meghalayahighcourt.nic.in/sites/default/files/news/N347.pdf) |
| 4 Aug 2026 | Supreme Court directs all states and police to run the grievance and money-restoration modules | binding direction | [SC order](https://api.sci.gov.in/supremecourt/2025/59769/59769_2025_1_30_72575_Order_04-Aug-2026.pdf) |
| 11 Sep 2026 | RBI draft lets banks themselves hold a flagged transaction of ₹1,000+; lifts on day 31 unless police instruct otherwise, 60-day ceiling | draft (proposed start 1 Apr 2027) | [RBI press release 2026-2027/1109](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63587) |

**Say:** For the first time there is a fixed route with deadlines, and it runs on the merchant's explanation. The procedure lists no fixed documents; the bank files only "if convinced about the bonafides of the transaction". A merchant with clear proof of sale is better placed. And from 2027, banks may start placing holds of their own.

**Careful:** do not say the Supreme Court ordered quick disposal of freeze cases (it did not). Do not say the RBI rules are in force.

---

## 4. What only Paytm can do

**On screen:**

1. **Proof at the moment of sale.** The Soundbox announces the payment; the merchant says what was sold. Accepted only within 120 seconds; append-only.
2. **Verified proof.** The certificate is built from Paytm's own transaction and settlement records, kept apart from the merchant's words.
3. **Reach and language.** Inside the app and Soundbox merchants already use. Voice, no typing, Indian languages.

**Say:** Letter generators already exist; we are not pitching one. A letter tool sees only what the merchant types after the freeze. Paytm sees the payment as it happens. The Home Ministry procedure already expects payment aggregators to upload settlement and order details for a held payment (s.9.5).

---

## 5. The demo

Follow `demo/script.md`. The short version:

1. A ₹826 payment arrives; the merchant says "do kilo cheeni, ek tel".
2. Days later a hold lands; only ₹826 is held, and Kavach says so in Hindi.
3. Two screening questions; anyone who lent out their account goes to legal aid.
4. Certificate and grievance draft, each rule with its source and date.
5. The merchant files at their own bank. Kavach sends nothing.
6. "Simulate day 22": no decision from bank (7 days) and police (15), so the letter to the District Grievance Officer is ready.

**Say:** ₹826 is not made up for effect: the420.in's report on the Faridabad freezes quotes a Mumbai shopkeeper whose ₹826 UPI payment was caught up in it.

---

## 6. What Paytm gains

These are our hypotheses, not measured results. Say them as such.

| Gain | Why we think so |
|---|---|
| Retention | A merchant whose money is held is likely to stop taking UPI; Indore traders did exactly that in 2024. Kavach gives them a reason to stay. |
| A reason to pay for the device | The Soundbox stops being only a speaker and becomes the thing that protects the merchant's money. |
| Standing with regulators | The procedure already asks payment aggregators for settlement data; Kavach supplies it in a clean, dated form, and screens out mules instead of helping them. |

**Close with the line from slide 1.**
