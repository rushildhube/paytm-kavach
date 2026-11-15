# Sources for the rules table

Every entry in `rules/rules.json`, the primary source it was checked against on **2026-11-15**, and the words it rests on. Re-check an entry when the law watcher flags it, then update its `last_checked` date.

## What the research notes got wrong

| Claim in the notes | What the source says |
|---|---|
| BNSS sections 168 and 94 limit a hold to the reported amount | They don't, on their own. s.94 is a power to require documents or things to be produced; s.168 lets police act to prevent an offence. The limit comes from the MHA procedure (s.9.1), which tells banks to hold the reported amount under police directions given under those sections. |
| The grievance ladder escalates after 15 days | Bank files within 7 calendar days; police officer decides within 15; then automatically to the District Grievance Officer, who decides within 15. Tracker now escalates on day 22. |
| The bank issues a "grievance ID" | Not in the procedure. The letter now asks the bank to file on the Grievance Redressal Module and share its reference. |
| The Supreme Court told states to dispose of freeze cases quickly | No such direction. It told states to adopt the grievance and restoration modules, and High Courts to tell courts about the grievance route. |
| Allahabad HC is against police freezing under s.106 | The other way round: Allahabad (and Karnataka) allow it; Delhi, Bombay and Kerala do not. |
| RBI draft: hold lifts at 60 days | The normal path lifts it on day 31 unless police instruct otherwise; 60 days is the ceiling. Also: draft only, banks only, excludes nodal, pool and escrow accounts, proposed start 1 April 2027. |

## MHA procedure of 2 January 2026

*Standard Operating Procedure (SOP) for NCRP-CFCFRMS, Custody, Restoration of money and Grievance Redressal*, issued by the Ministry of Home Affairs, Cyber and Information Security Division. Not found on mha.gov.in; read as annexed to the [Meghalaya High Court notification of 28 April 2026](https://meghalayahighcourt.nic.in/sites/default/files/news/N347.pdf) (98 pages). The same text is published by banks.

- **`hold-limited-to-amount`** (s.9.1(i)): "if the reported amount or any part thereof is available in the beneficiary account, the bank nodal officer … shall put the amount on hold … as per the direction of LEAs issued under S.168 read with S.94 BNSS and under S.106 BNSS." And: "If the account is reported multiple times on NCRP-CFCFRMS, Bank shall also suspend digital banking services … or seize the bank account … as per the lawful directions received from the LEAs under Section 106 of BNSS".
- **`police-contact-from-bank`** (s.9.1(ii)): "On being approached by the account holder, the Bank may inform her about the LEA's address and contact details … such sharing of information may not be considered as a tip-off … In no case, the details of the complainant or victim shall be provided".
- **`merchant-sale-details`** (s.10.1(a), s.9.5): the bank weighs "the justifications submitted by the person, exercise Enhanced Due Diligence (EDD) and if convinced about the bonafides of the transaction, submit the grievance". Payment aggregators and e-commerce companies upload "order details, delivery address, and identifiers of the recipient" or "the settlement transactions and related details". No fixed document list.
- **`mha-procedure-2026`** and the ladder (s.10.1):
  - (a) the bank submits the grievance "at the earliest and not beyond 07 calendar days from the day the aggrieved person complains."
  - (d) if satisfied, the officer directs banks "to remove the hold on the reported amount within 15 calendar days of the receipt of the grievance."
  - (e) if not satisfied, remarks "within 15 calendar days of raising the grievance by the bank, duly recording the reasons", sent by SMS/email.
  - (f) "on the completion of 15 calendar days, the grievance will be automatically notified to the District Grievance Officer." A review request may be filed "within 15 calendar days of receiving intimation by visiting the designated bank branch"; the District Grievance Officer decides "within 15 calendar days of being notified".
  - District Grievance Officers are "of the rank of Addl. SP or Dy SP".
- **`hold-90-days`** (after s.10.1(f)): if "no lawful directions regarding continuation or discontinuation of the hold … are received within 90 calendar days of the grievance being submitted by the bank", the bank "shall remove the hold, after EDD, on a request made by the account holder"; police may ask "for an extension for continuation for up to 90 additional calendar days."

## Grievance Redressal Module (`grievance-via-bank`)

- The procedure, s.10.1(a): the bank will "submit the grievance to the Grievance Redressal Module of CFCFRMS".
- [PIB release 2287674, 22 July 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287674) (MHA reply in Rajya Sabha): the "Grievance Redressal Module … have been made functional from April, 2026."

## Supreme Court order of 4 August 2026 (`sc-directions-2026-08-04`)

*In Re: Victims of Digital Arrest Related to Forged Documents*, SMW(Crl) No. 3/2025, record of proceedings, [court's copy](https://api.sci.gov.in/supremecourt/2025/59769/59769_2025_1_30_72575_Order_04-Aug-2026.pdf).

- Para 7(ii): "All the States, Union Territories and law enforcement agencies are directed for expeditious adoption and operationalisation of the two modules, namely, Grievance Redressal and Money Restoration Modules under the MHA's SOP … dated 02.01.2026."
- Para 7(iii): "An aggrieved person may ordinarily be encouraged to avail that mechanism in the first instance, though it shall not be a bar to any constitutional, statutory or other legal remedy."
- Para 7(i): RBI to adopt and circulate an SOP for banks' temporary debit holds within four weeks.
- Later: an order of 29 October 2026 (signed copy hosted by LiveLaw) expects RBI's KYC Amendment Directions to be notified by 30 November 2026 and in force by 31 December 2026; next hearing 23 November 2026. **Watch this.**

## BNSS sections 106 and 107

Bharatiya Nagarik Suraksha Sanhita, 2023, [Gazette of India Extraordinary No. 54, 25 December 2023](https://egazette.gov.in/WriteReadData/2023/250884.pdf). India Code could not be opened (403 / moved).

- **`bnss-106`** s.106(1): "Any police officer may seize any property which may be alleged or suspected to have been stolen, or which may be found under circumstances which create suspicion of the commission of any offence." Bank accounts are not mentioned. Split in the High Courts:
  - Against freezing under s.106: Delhi, *Malabar Gold and Diamond Ltd v. Union of India*, W.P.(C) 4198/2025, 16 January 2026 ([order](https://delhihighcourt.nic.in/app/showlogo/1769248155_eb87a6191c1f9386_596_41982025.pdf/2026)), para 18; it relies on Kerala (*Headstar Global*) and Bombay (*Kartik Yogeshwar Chatur*).
  - For: Allahabad, *Ashish Rawat v. Union of India* (Division Bench, 2026), limited to the suspect amount; Karnataka, *State of Karnataka v. Jar Gold Retail* (August 2026). **Both from secondary reports only; judgments not opened.**
  - Supreme Court: no ruling on the point found. The SLP against *Headstar Global* was dismissed without deciding the merits.
- **`bnss-107`** s.107(1): police, "with the approval of the Superintendent of Police or Commissioner of Police, make an application to the Court or the Magistrate … for the attachment"; s.107(2) notice "to show cause within a period of fourteen days"; s.107(5) interim attachment ex parte where notice "would defeat the object of attachment".

## RBI draft of 11 September 2026 (`rbi-draft-bank-hold`)

[Press release 2026-2027/1109](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63587) and the [draft text](https://www.rbi.org.in/scripts/bs_viewcontent.aspx?Id=5170) (the PDF would not download).

- A Suspected Money Mule Transaction is "a transaction of ₹1000 and above, flagged by the bank's transaction-monitoring systems". "The bank shall place a Temporary Debit Hold". "The bank shall give 20 days' time from the date of Temporary Debit Hold" to explain. The bank decides within 10 days of an explanation, or 30 days of the hold; without police instruction the hold is removed on day 31. "Maximum duration … is 60 days".
- Not for "nodal accounts, pool accounts, escrow accounts, or other special-purpose accounts". Applies to commercial banks (including payments banks) and urban co-operative banks. Comments closed 2 October 2026; proposed start 1 April 2027. Not final as of 15 November 2026.

## Not yet done

- Open the Allahabad and Karnataka judgments on the court sites.
- Read the RBI draft PDF itself.
- Find the procedure on an MHA site rather than via a High Court annex.
