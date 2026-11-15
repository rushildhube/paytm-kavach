# Legal landscape

What the law says about freezing a merchant's money, what it asks of Paytm, and what limits apply to Kavach itself.

Verified facts come from `sources.md` and `rules/rules.json`, checked against primary sources on **2026-11-15**. Anything marked "(unverified, from Nov 2026 research notes)" has not been checked and must not go on a slide or into `rules/` until it is.

Status labels: **statute** (an Act of Parliament), **contested** (courts disagree), **administrative** (a government procedure, not a law), **binding direction** (a court order), **draft** (proposed, not in force).

---

## 1. The freeze laws

### At a glance

| Instrument | Status | What it does | Source (checked 2026-11-15) |
|---|---|---|---|
| MHA procedure of 2 January 2026 | administrative | The working rulebook: what the bank holds, how a grievance is filed, the 7 + 15 + 15 day ladder, the 90-day fallback | [Meghalaya HC notification annexing the SOP](https://meghalayahighcourt.nic.in/sites/default/files/news/N347.pdf) |
| BNSS ss.168 and 94 | statute | Police powers to prevent an offence (168) and to require documents or things (94). The procedure tells banks to hold under police directions given under these. They do **not** themselves limit a hold. | [BNSS, Gazette No. 54, 25 Dec 2023](https://egazette.gov.in/WriteReadData/2023/250884.pdf) |
| BNSS s.106 | contested | Police seizure of property suspected to be linked to an offence. High Courts split on whether it covers freezing a bank account. | Same; [Delhi HC, *Malabar Gold*, 16 Jan 2026](https://delhihighcourt.nic.in/app/showlogo/1769248155_eb87a6191c1f9386_596_41982025.pdf/2026) |
| BNSS s.107 | statute | Attachment of proceeds of crime needs a Court or Magistrate; 14 days' notice to show cause, or interim attachment without notice | [BNSS, Gazette No. 54](https://egazette.gov.in/WriteReadData/2023/250884.pdf) |
| Grievance Redressal Module | administrative | The online module where the bank files and police decide; running since April 2026 | [PIB release 2287674, 22 Jul 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287674) |
| Supreme Court order of 4 August 2026 | binding direction | States and police must run the grievance and money-restoration modules; the grievance route comes first but bars no other remedy | [SC record of proceedings](https://api.sci.gov.in/supremecourt/2025/59769/59769_2025_1_30_72575_Order_04-Aug-2026.pdf) |
| RBI draft KYC Amendment Directions, 11 September 2026 | draft | Lets banks themselves place a temporary debit hold on a flagged transaction | [RBI press release 2026-2027/1109](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63587) |
| PMLA s.12AA | not checked | Listed in the research notes as relevant to freezes (unverified, from Nov 2026 research notes). Not read; we do not know what it says on holds. | none |

### The MHA procedure (administrative)

The *Standard Operating Procedure for NCRP-CFCFRMS, Custody, Restoration of Money and Grievance Redressal*, issued by the Ministry of Home Affairs on 2 January 2026. We read it as annexed to a Meghalaya High Court notification; we have not found it on an MHA site.

- **Hold only the reported amount** (s.9.1(i)). The bank holds the reported amount, or the part of it still in the account, under police directions. Suspending digital banking or seizing the account is for accounts reported **multiple times**, and needs separate lawful directions under s.106.
- **Who ordered it** (s.9.1(ii)). If the account holder asks, the bank may share the police unit's address and contact. This "may not be considered as a tip-off". The complainant's details are never shared.
- **What the merchant gives** (s.10.1(a), s.9.5). The bank weighs the account holder's justification, does Enhanced Due Diligence, and if convinced, files the grievance. Payment aggregators upload settlement and order details. There is **no fixed list of documents**.
- **The ladder** (s.10.1):

| Step | Who | Deadline |
|---|---|---|
| 1 | Bank files the grievance on the Grievance Redressal Module | within 7 calendar days of the complaint |
| 2 | Police officer on the case releases the hold or records reasons | within 15 calendar days of the grievance |
| 3 | District Grievance Officer (Addl. SP or Dy. SP rank), notified automatically | decides within 15 calendar days |

  Bank 7 + police 15 = **escalation on day 22**, not day 15. The procedure does not mention a bank "grievance ID"; Kavach asks the bank for the module's reference instead.
- **90-day fallback.** If no lawful direction to continue the hold arrives within 90 calendar days of the bank filing, the bank removes the hold on the account holder's request, after EDD. Police may ask for up to 90 more days.

### BNSS s.106 (contested)

s.106(1) lets police "seize any property which may be alleged or suspected to have been stolen". It does not mention bank accounts.

| View | Courts | Basis |
|---|---|---|
| Police **cannot** freeze an account under s.106 | Delhi (*Malabar Gold and Diamond Ltd v. Union of India*, W.P.(C) 4198/2025, 16 Jan 2026, para 18), relying on Kerala (*Headstar Global*) and Bombay (*Kartik Yogeshwar Chatur*) | Delhi order read |
| Police **can**, within limits | Allahabad (*Ashish Rawat v. Union of India*, Division Bench, 2026; only up to the suspect amount); Karnataka (*State of Karnataka v. Jar Gold Retail*, August 2026) | **Secondary reports only; judgments not opened** |
| Supreme Court | No ruling found. The SLP against *Headstar Global* was dismissed without deciding the merits. | `sources.md` |

Kavach does not cite s.106 as a ground for release. It only says the point is contested.

One related High Court order, found while checking the research notes: *Sri Sai Wines v. Union of India*, 2026 SCC OnLine AP 2469 (Andhra Pradesh HC, 22 June 2026). A ₹1,000 UPI payment led to a freeze of ₹8,26,633; the court called the freeze without verification "unsustainable, contrary to law and illegal" and directed SBI to unfreeze. Read through a [SCC Online report](https://www.scconline.com/blog/post/2026/08/01/ap-hc-directs-unfreezing-bank-account-upi-transaction/), checked 2026-11-15; judgment not opened.

### Supreme Court order of 4 August 2026 (binding direction)

*In Re: Victims of Digital Arrest Related to Forged Documents*, SMW(Crl) No. 3/2025.

- Para 7(ii): States, UTs and police to adopt and run the Grievance Redressal and Money Restoration modules of the MHA procedure.
- Para 7(iii): an aggrieved person "may ordinarily be encouraged" to use that mechanism first; it "shall not be a bar" to other remedies.
- Para 7(i): RBI to adopt an SOP for banks' temporary debit holds within four weeks.
- It did **not** direct states to dispose of freeze cases quickly. That claim in the research notes was wrong.
- A later order of 29 October 2026 (signed copy hosted by LiveLaw) expects RBI's KYC Amendment Directions notified by 30 November 2026 and in force by 31 December 2026. Next hearing 23 November 2026. **Watch this.**

### RBI draft of 11 September 2026 (draft)

Not in force as of 15 November 2026. Read from the [web text](https://www.rbi.org.in/scripts/bs_viewcontent.aspx?Id=5170); the PDF would not download.

| Point | Draft text |
|---|---|
| Trigger | A transaction of ₹1,000 or more flagged by the bank's monitoring systems |
| Explain | 20 days from the hold |
| Decide | within 10 days of the explanation, or 30 days of the hold |
| Default | Hold removed on **day 31** unless police instruct otherwise |
| Ceiling | 60 days |
| Excluded | Nodal, pool, escrow and other special-purpose accounts |
| Applies to | Commercial banks (including payments banks) and urban co-operative banks |
| Start | Proposed 1 April 2027; comments closed 2 October 2026 |

The research notes said the hold lifts at 60 days. Wrong: 60 is the ceiling, day 31 is the normal path.

---

## 2. Laws on Paytm

Verified so far: one duty in the MHA procedure (s.9.5). Payment aggregators and e-commerce companies are expected to upload "the settlement transactions and related details" or order details. Kavach's sale certificate is built from exactly this data.

Not yet checked. Each item below is from the research notes and has no source in this repo:

- Paytm's payment aggregator licence and the conditions that come with it (unverified, from Nov 2026 research notes).
- Further duties on Paytm in the freeze procedure beyond s.9.5 (unverified, from Nov 2026 research notes).
- Fraud risk scoring that payment companies are expected to run (unverified, from Nov 2026 research notes).
- UPI fee (MDR) rules and how they bear on merchant pricing (unverified, from Nov 2026 research notes).

---

## 3. Governance on the product

Rules Kavach must follow as a product. None of these instruments has been checked against its primary source yet.

| Instrument | Status | What it means for Kavach |
|---|---|---|
| Digital Personal Data Protection Act, 2023 | statute (unverified, from Nov 2026 research notes) | Buyer details are personal data. Store only the last four account digits, mask buyer details, keep payer names out of stored transcripts (`problem.md`). |
| RBI FREE-AI framework | not checked (unverified, from Nov 2026 research notes) | Responsible-AI expectations on regulated entities using AI. Status and contents to be confirmed. |
| Advocates Act, 1961 | statute (unverified, from Nov 2026 research notes) | Risk of looking like legal practice. Kavach is a drafting aid: the merchant reviews and files; every screen says "draft, not legal advice". |
| Tipping off | MHA procedure s.9.1(ii) verified; any wider rule unverified | Sharing the police contact **after** a hold is allowed by the procedure. Kavach never warns a merchant about a hold before it exists. |

---

## Still to do

- Open the Allahabad, Karnataka and Andhra Pradesh judgments on the court sites.
- Read the RBI draft PDF.
- Find the MHA procedure on an MHA site.
- Check PMLA s.12AA, the PA licence conditions, the DPDP Act, RBI FREE-AI and the Advocates Act against primary sources before any of them is cited.
- Re-check after the Supreme Court hearing of 23 November 2026 and RBI's final directions.
