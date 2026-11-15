import type { SaleCertificate } from "@backend/certificate";

/**
 * Fixed-wording drafts. Used as the offline fallback and as the shape the
 * model is asked to follow. Legal references are written as [rule:<id>]
 * markers, which are resolved against rules/ when the draft is rendered.
 */

export type DraftKind = "explanation" | "grievance" | "escalation";

export type DraftFacts = {
  certificate: SaleCertificate;
  ownerName: string;
  /** Present for escalation drafts. */
  filedAt?: string;
  daysSinceFiled?: number;
  nextLevel?: string;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

function saleLine(c: SaleCertificate): string {
  if (!c.saleTag) {
    return "No description of the sale was recorded at the time of payment.";
  }
  return `At the time of payment (${c.saleTag.secondsAfterPayment} seconds after it arrived, and before any hold) I recorded the sale as: "${c.saleTag.transcript}".`;
}

export function explanationHi({ certificate: c }: DraftFacts): string {
  const amount = inr(c.hold.heldAmountInr);
  return [
    `घबराइए मत। आपके खाते में सिर्फ़ एक पेमेंट के ${amount} पर रोक लगी है, पूरे खाते पर नहीं।`,
    `यह रोक इसलिए लगी है क्योंकि इस पेमेंट की शिकायत दर्ज हुई है। यह आप पर कोई आरोप नहीं है।`,
    c.saleTag
      ? `अच्छी बात यह है कि आपने उसी समय बता दिया था कि क्या बेचा: "${c.saleTag.transcript}"। यह सबूत पहले से दर्ज है।`
      : `इस पेमेंट पर बिक्री का विवरण दर्ज नहीं हुआ था, फिर भी पेमेंट का रिकॉर्ड मौजूद है।`,
    `आगे दो छोटे सवालों के जवाब दीजिए। फिर मैं बिक्री का प्रमाण पत्र और बैंक के लिए शिकायत का ड्राफ्ट तैयार करूँगा, जिसे आप पढ़कर खुद अपने बैंक में जमा करेंगे।`,
  ].join(" ");
}

export function grievanceLetter({ certificate: c, ownerName }: DraftFacts): string {
  return `To
The Branch Manager
${c.merchant.bankName}

Subject: Grievance regarding a hold of ${inr(c.hold.heldAmountInr)} on my account ending ${c.merchant.accountLast4} (reference ${c.hold.reference})

Sir/Madam,

I run ${c.merchant.shopName} in ${c.merchant.city}. A hold of ${inr(c.hold.heldAmountInr)} was placed on my account on ${when(c.hold.placedAt)} in connection with one UPI payment.

That payment was received in the ordinary course of my business:

- Transaction ID: ${c.transaction.id}
- Amount: ${inr(c.transaction.amountInr)}
- Received: ${when(c.transaction.at)}
- Payer (masked): ${c.transaction.payerVpaMasked}

${saleLine(c)} A sale certificate drawn from the payment company's records is attached as my explanation of this payment [rule:merchant-sale-details].

I do not know the payer personally and had no reason to doubt the payment. I request that you file this grievance on the Grievance Redressal Module [rule:grievance-via-bank] within the time the procedure allows, and share its reference with me [rule:mha-procedure-2026]. I also request confirmation that the hold applies only to the reported amount of ${inr(c.hold.heldAmountInr)} and not to the rest of my balance [rule:hold-limited-to-amount], and the contact details of the police unit that ordered it [rule:police-contact-from-bank].

I will provide any further document you need.

Yours faithfully,
${ownerName}
${c.merchant.shopName}
Account ending ${c.merchant.accountLast4}

Attachment: Sale certificate ${c.certificateId}`;
}

export function escalationLetter(f: DraftFacts): string {
  const c = f.certificate;
  return `To
${f.nextLevel ?? "The next officer on the grievance ladder"}
Through: The Branch Manager, ${c.merchant.bankName}

Subject: Grievance on a hold of ${inr(c.hold.heldAmountInr)} still undecided (reference ${c.hold.reference})

Sir/Madam,

I run ${c.merchant.shopName} in ${c.merchant.city}. On ${f.filedAt ? when(f.filedAt) : "an earlier date"} I filed a grievance through ${c.merchant.bankName} about a hold of ${inr(c.hold.heldAmountInr)} on my account ending ${c.merchant.accountLast4}.

${f.daysSinceFiled ?? "Several"} days have passed and I have not been told of any decision. The grievance procedure sets time limits for the bank and the police officer, and passes an undecided grievance to the District Grievance Officer [rule:mha-procedure-2026]. All States have been directed to put this grievance system into operation [rule:sc-directions-2026-08-04].

The payment in question (${c.transaction.id}, ${inr(c.transaction.amountInr)}, received ${when(c.transaction.at)}) was an ordinary sale at my shop. ${saleLine(c)} The sale certificate and my original grievance are attached.

I request a decision on my grievance.

Yours faithfully,
${f.ownerName}
${c.merchant.shopName}
Account ending ${c.merchant.accountLast4}

Attachments: Sale certificate ${c.certificateId}; original grievance`;
}

export const LEGAL_AID_REFERRAL_HI =
  "आपने बताया कि इस खाते का इस्तेमाल किसी और ने किया या आपने किसी और के लिए पैसा लिया। ऐसे मामले में चिट्ठी काफ़ी नहीं है। कृपया किसी वकील या अपने ज़िले के विधिक सेवा प्राधिकरण (निःशुल्क कानूनी सहायता) से मिलिए।";

export const LEGAL_AID_REFERRAL_EN =
  "This situation needs a lawyer, not a letter. Please speak to an advocate or your District Legal Services Authority, which provides free legal aid.";

export function templateDraft(kind: DraftKind, facts: DraftFacts): string {
  if (kind === "explanation") return explanationHi(facts);
  if (kind === "grievance") return grievanceLetter(facts);
  return escalationLetter(facts);
}
