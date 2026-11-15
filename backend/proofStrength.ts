import type { Invoice, SaleTag } from "./types";

/**
 * How much weight a payment's proof of sale can carry, from the records alone
 * (docs/proof-improvements.md, item 4). A description for the merchant, never
 * a promise: no level ever means "safe from a hold", and the disclaimer still
 * applies. Shown on every payment, all the time, so it never hints that any
 * one payment was reported.
 *
 * Base level from the description:
 * - strong: a bill made before the payment that the buyer's own payment
 *   screen showed, items and amount, before the PIN (#19, item 1).
 * - good:  a bill made before the payment, or a voice tag bound by the
 *   merchant's tap or as the only open payment.
 * - basic: a voice tag matched by the spoken amount, or a description typed
 *   after the payment came in.
 * - none:  nothing recorded.
 * An invoice fingerprint attached to this payment (by its id, at payment time)
 * lifts the level one step: none → basic → good → strong.
 */
export type ProofLevel = "strong" | "good" | "basic" | "none";

export type ProofStrength = {
  level: ProofLevel;
  /** Plain reasons, in English, for the certificate and the Proofs tab. */
  reasons: string[];
};

export const PROOF_LEVELS: Record<ProofLevel, { en: string; hi: string }> = {
  strong: { en: "Strong proof", hi: "मज़बूत सबूत" },
  good: { en: "Good proof", hi: "अच्छा सबूत" },
  basic: { en: "Basic proof", hi: "कम सबूत" },
  none: { en: "No proof", hi: "कोई सबूत नहीं" },
};

export function proofStrength(input: {
  tag: Pick<SaleTag, "source" | "boundBy" | "buyerApproved"> | null | undefined;
  invoice: Pick<Invoice, "sha256"> | null | undefined;
}): ProofStrength {
  const { tag, invoice } = input;
  const reasons: string[] = [];
  let base: ProofLevel = "none";

  if (tag) {
    if (tag.source === "bill" && tag.buyerApproved) {
      base = "strong";
      reasons.push(
        "Bill made before the payment; the buyer's payment screen showed its items and amount before the PIN, and the buyer paid it.",
      );
    } else if (tag.source === "bill" || tag.boundBy === "bill") {
      base = "good";
      reasons.push("Bill made before the payment; the buyer paid that bill's QR.");
    } else if (tag.source === "typed") {
      base = "basic";
      reasons.push("Description typed by the merchant after the payment came in, without a bill.");
    } else if (tag.boundBy === "tap" || tag.boundBy === "only_open") {
      base = "good";
      reasons.push(
        tag.boundBy === "tap"
          ? "Said at payment time; the merchant picked this payment."
          : "Said at payment time; it was the only payment waiting.",
      );
    } else if (tag.boundBy === "amount" || tag.boundBy === "amount_and_name") {
      base = "basic";
      reasons.push("Said at payment time; matched to this payment by the spoken amount.");
    } else {
      base = "basic";
      reasons.push("Said at payment time; how it was matched was not recorded.");
    }
  }

  if (invoice) {
    reasons.push("Invoice fingerprint attached at payment time (contents not verified).");
  }

  // The invoice was attached to this payment by id, so it lifts the level one step.
  const level: ProofLevel = !invoice
    ? base
    : base === "strong" || base === "good"
      ? "strong"
      : base === "basic"
        ? "good"
        : "basic";
  if (level === "none") reasons.push("Nothing was recorded for this sale at payment time.");
  return { level, reasons };
}
