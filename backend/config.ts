/** Payments at or above this amount prompt the merchant for a voice tag. */
export const TAG_THRESHOLD_INR = Number(process.env.TAG_THRESHOLD_INR ?? 500);

/** A sale tag is only accepted this long after the payment. No back-dating. */
export const TAG_WINDOW_SECONDS = 120;

/**
 * Accounts with this many earlier reports get no certificate.
 * Placeholder value for the demo; the real cut-off is a policy decision.
 */
export const REPEAT_REPORT_LIMIT = 3;

export const DISCLAIMER =
  "Draft only. Not legal advice. Kavach does not file anything and cannot guarantee that held money will be released.";

export const DISCLAIMER_HI =
  "यह केवल एक ड्राफ्ट है, कानूनी सलाह नहीं। कवच आपकी ओर से कुछ भी जमा नहीं करता और रकम छूटने की कोई गारंटी नहीं देता।";
