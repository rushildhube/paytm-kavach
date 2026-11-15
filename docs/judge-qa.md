# Judge Q&A

Likely questions and short answers. Legal facts are from `sources.md` (checked 2026-11-15). Anything marked "unverified" must be said as such, or not said.

---

## The idea

**"Letter generators already exist. What is new?"**
Yes, they do: student prototypes like Wapas and lawyer and finance sites (unverified, from Nov 2026 research notes). We do not compete on the letter. Those tools start after the freeze, from what the merchant remembers and types. Kavach records what was sold at the moment of payment, ties it to Paytm's own transaction and settlement data, and captures it by voice in the merchant's language. Only a payments company can do those three things. The letter is the last, least novel step.

**"Why does proof at sale matter if the procedure has no document list?"**
The MHA procedure (s.10.1(a)) says the bank weighs the merchant's justification and files only "if convinced about the bonafides of the transaction". It names no fixed documents. So the quality of the explanation is what decides whether the grievance is filed at all. A dated record made at the sale, matched to Paytm's settlement data, is stronger than a story written weeks later. Source: [MHA SOP via Meghalaya HC](https://meghalayahighcourt.nic.in/sites/default/files/news/N347.pdf), checked 2026-11-15.

**"How is this growth for Paytm?"**
Our hypotheses, not measured: a merchant whose money was held is likely to stop taking UPI. Indore garment traders told shops to refuse UPI over account freezes in December 2024 ([Devdiscourse, 27 Dec 2024](https://www.devdiscourse.com/article/business/3208368-garment-traders-protest-upi-payment-freeze-in-indore), checked 2026-11-15). Kavach gives a reason to stay on Paytm (retention), a reason to keep paying for the Soundbox (it now protects, not just announces), and standing with regulators (the procedure already expects payment aggregators to upload settlement details, s.9.5). We have no numbers on churn after a freeze.

---

## Abuse and safety

**"Won't fraudsters use it to manufacture proof?"**
The design is built against that:
- A tag is only accepted within 120 seconds of the payment. No back-dating, no editing; the ledger is append-only.
- The certificate separates Paytm's own records from what the merchant said, so a reader sees which part is verified.
- Two screening questions come first. Anyone who lent out their account is sent to legal aid, not given an "I'm innocent" letter.
- Accounts reported repeatedly get no certificate. (The cut-off in the demo is a placeholder, 3 reports; the real value is a policy decision.)
- The bank and police still decide. Kavach adds evidence; it does not remove anyone's judgment.

**"Doesn't explaining a hold tip off a criminal?"**
Kavach says nothing until a hold exists. After a hold, the MHA procedure (s.9.1(ii)) lets the bank tell the account holder which police unit ordered it, and says this "may not be considered as a tip-off". The complainant's details are never shared.

**"What about the buyer's privacy?"**
Kavach stores only the last four account digits and the payer's UPI handle masked (vi***@okdemo); the database refuses an unmasked one. It never stores a payer's name, phone or address. An attached invoice is kept only as a SHA-256 fingerprint, never the file. The Soundbox asks what was sold, not who bought it. Every stored piece of buyer-related data has a recorded purpose and retention (`data_purposes` table, #25). Buyer details are personal data under the DPDP Act (unverified, from Nov 2026 research notes, for the Act's exact terms).

---

## Legal

**"Is this legal advice?"**
No. Every screen and document says: draft only, not legal advice, no guarantee that money will be released. The merchant reviews it and files it through their own bank. Kavach never sends anything. Every rule it cites comes from a fixed table with its source and checked date; the AI writes the words but cannot add a law.

**"Will the merchant get their money back?"**
We cannot promise that. What we can say: the procedure holds only the reported amount, not the whole balance (s.9.1(i)); the bank must file within 7 days; police decide within 15; then the District Grievance Officer within 15 more. If nothing happens, Kavach has the escalation ready on day 22. If no lawful direction to continue arrives within 90 days of filing, the bank removes the hold on request, unless police extend it by up to 90 days.

**"Can police even freeze an account? I read courts said no."**
Contested. Delhi, Bombay and Kerala High Courts say s.106 BNSS does not let police freeze accounts; Allahabad and Karnataka say it does, Allahabad only up to the suspect amount (Allahabad and Karnataka from secondary reports; judgments not opened). The Supreme Court has not decided. Kavach does not argue the point; it uses the grievance route the Supreme Court told states to run on 4 August 2026.

**"What about the RBI rules on bank holds?"**
Draft only, released 11 September 2026, proposed start 1 April 2027. Under the draft the bank gives 20 days to explain and lifts the hold on day 31 unless police instruct otherwise; 60 days is the ceiling. A Supreme Court order of 29 October 2026 expects final rules by the end of 2026. Kavach keeps these in the rules table marked "draft" and will update when they are final. Source: [RBI press release 2026-2027/1109](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63587), checked 2026-11-15.

**"Is the problem real?"**
- A Faridabad fraud case of ₹4.43 crore led to over 36,000 accounts being frozen across India by the Home Ministry's automated fund-tracing system ([the420.in](https://the420.in/faridabad-cyber-scam-upi-fraud-accounts-frozen-home-ministry/), checked 2026-11-15; trade press, not an official figure).
- One ₹1,000 UPI payment for liquor led to ₹8,26,633 being frozen; the Andhra Pradesh High Court called it illegal and ordered SBI to unfreeze (*Sri Sai Wines v. Union of India*, 22 June 2026, via [SCC Online](https://www.scconline.com/blog/post/2026/08/01/ap-hc-directs-unfreezing-bank-account-upi-transaction/), checked 2026-11-15).

---

## Questions from `problem.md`

**"What if four customers pay in the same minute?"**
Each payment of ₹500 or more gets its own 120-second window. The merchant says the amount in the tag ("aath sau chhabbis: do kilo cheeni"), and Kavach binds it to the open payment with that amount (Hindi or English number words, or digits). If two open payments have the same amount, or none matches, it asks the merchant to tap the right payment. It never guesses. A wrong tag is worse than a missing one. A bill made before the payment avoids the question entirely: the bill id binds it. Built and in the demo. We decided not to use the payer's name as a tiebreak: it would mean holding buyer data for a case a tap settles in a second (#19).

**"What if the merchant misses the window in a rush?"**
The payment stays untagged. It still gets a certificate from Paytm's own records, just without the merchant's words. Letting them tag later would let fraudsters do the same.

**"Can a merchant attach an invoice instead of speaking?"**
Leaning yes, inside the same payment window: attach a photo or PDF of the bill from the open payment card. We store a hash, the time and the items; the total must match the payment. An invoice uploaded after a hold is not payment-time proof. If we allow it at all, it is labelled "added later, not verified by Paytm" and kept apart. Not built.

**"Why not use a dynamic QR so the bill exists before payment?"**
That is the strongest form of proof, and we would like it. But Paytm's dynamic QR is documented for merchants with a billing system or POS that calls Paytm's API ([Paytm docs](https://paytmpayments.com/docs/dynamic-qr-code-payments), checked 2026-11-15). We found no sign that a small shop can create one from the Soundbox or app. ICICI and Razorpay sell a "dynamic Soundbox", so it is possible in principle. Not confirmed with Paytm, so we treat it as a future option.

**"Can't the Soundbox just announce who paid?"**
Every Soundbox report we found mentions announcing the amount only, never the payer's name ([Outlook Business](https://www.outlookbusiness.com/apps/paytm-introduces-soundbox-20-to-ease-payments-acceptance-6373), checked 2026-11-15). That is why the merchant says the amount in the tag.

**"Why ₹500?"**
A product choice, not a legal one: asking for a tag on every small payment would be noise. It is configurable. (The RBI draft's own trigger for bank holds is ₹1,000, so ₹500 covers every payment that draft would touch.)
