import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkDraft, renderCitations } from "@agent/checks";
import { makeDraft } from "@agent/drafts";
import { buildCertificate } from "@backend/certificate";
import { DISCLAIMER, TAG_THRESHOLD_INR } from "@backend/config";
import { checkEligibility, placeHold } from "@backend/holds";
import { LedgerError, needsTag, recordPayment, recordSaleTag } from "@backend/ledger";
import { maskVpa } from "@backend/mask";
import { allRules, validateRules } from "@backend/rules";
import { advanceClock, now, resetStore, store } from "@backend/store";
import { merchants } from "@data/seed";
import { parseSaleItems } from "@voice/parser";

const clean = { lentAccount: false, receivedForCommission: false };
const tag = (txnId: string, transcript = "do kilo cheeni, ek tel") =>
  recordSaleTag({ txnId, transcript, items: parseSaleItems(transcript), source: "voice" });

beforeEach(() => {
  resetStore();
});

describe("proof of sale is recorded at payment time only", () => {
  it("accepts a tag right after the payment", () => {
    const txn = recordPayment(826, "victim@okdemo");
    expect(tag(txn.id).txnId).toBe(txn.id);
  });

  it("refuses a second tag for the same sale", () => {
    const txn = recordPayment(826, "victim@okdemo");
    tag(txn.id);
    expect(() => tag(txn.id, "something else")).toThrow(LedgerError);
  });

  it("refuses a tag once the window has closed", () => {
    const txn = recordPayment(826, "victim@okdemo");
    advanceClock(1);
    expect(() => tag(txn.id)).toThrow(/window has closed/);
  });

  it("refuses a tag after a hold is placed", () => {
    const txn = recordPayment(826, "victim@okdemo");
    placeHold(txn.id);
    expect(() => tag(txn.id)).toThrow(/after a hold/);
  });

  it("stored tags cannot be mutated", () => {
    const txn = recordPayment(826, "victim@okdemo");
    const saved = tag(txn.id);
    expect(() => {
      (saved as { transcript: string }).transcript = "edited";
    }).toThrow();
  });

  it("prompts only at or above the threshold", () => {
    expect(needsTag(TAG_THRESHOLD_INR)).toBe(true);
    expect(needsTag(TAG_THRESHOLD_INR - 1)).toBe(false);
  });
});

describe("data minimisation", () => {
  it("masks the payer before storing", () => {
    const txn = recordPayment(826, "victim.fullname@okdemo");
    expect(txn.payerVpaMasked).toBe("vi***@okdemo");
    expect(JSON.stringify(store())).not.toContain("victim.fullname");
  });

  it("masking is idempotent", () => {
    expect(maskVpa("vi***@okdemo")).toBe("vi***@okdemo");
  });

  it("holds only four account digits", () => {
    for (const m of merchants) expect(m.accountLast4).toMatch(/^\d{4}$/);
  });
});

describe("holds and eligibility", () => {
  it("holds only the reported payment's amount", () => {
    const txn = recordPayment(826, "victim@okdemo");
    expect(placeHold(txn.id).heldAmountInr).toBe(826);
  });

  it("gives no certificate to a repeatedly reported account", () => {
    const reported = merchants.find((m) => m.id === "m_reported")!;
    expect(checkEligibility(reported, clean).outcome).toBe("no_certificate");
  });

  it("routes a lent account to legal aid", () => {
    const m = merchants.find((x) => x.id === "m_mule")!;
    expect(checkEligibility(m, { ...clean, lentAccount: true }).outcome).toBe("legal_aid");
    expect(checkEligibility(m, { ...clean, receivedForCommission: true }).outcome).toBe("legal_aid");
  });

  it("passes an ordinary merchant", () => {
    expect(checkEligibility(merchants[0], clean).outcome).toBe("eligible");
  });
});

describe("rules table", () => {
  it("every rule names a source", () => {
    for (const r of allRules()) expect(r.source_name.length).toBeGreaterThan(0);
  });

  it("a rule cannot be marked verified without a URL and a checked date", () => {
    const bad = {
      rules: [{ ...allRules()[0], verified: true, source_url: null, last_checked: null }],
      ladder: { placeholder: true, note: "", steps: [] },
    };
    expect(() => validateRules(bad)).toThrow();
  });
});

describe("draft checks", () => {
  it("accepts a draft that cites only known rules", () => {
    const r = checkDraft("Only ₹826 is held [rule:hold-limited-to-amount].", [826]);
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown rule", () => {
    expect(checkDraft("See [rule:made-up-law].", [826]).ok).toBe(false);
  });

  it("rejects a law named outside the table", () => {
    expect(checkDraft("Under Section 420 of the IPC this is void.", [826]).ok).toBe(false);
  });

  it("rejects a promised outcome", () => {
    expect(checkDraft("Your money will be released in a week.", [826]).ok).toBe(false);
    expect(checkDraft("We guarantee release.", [826]).ok).toBe(false);
  });

  it("rejects an amount that is not in the facts", () => {
    expect(checkDraft("A hold of ₹8,26,000 was placed.", [826]).ok).toBe(false);
    expect(checkDraft("A hold of Rs 8,260 was placed.", [826]).ok).toBe(false);
    expect(checkDraft("8260 रुपये पर रोक लगी है।", [826]).ok).toBe(false);
    expect(checkDraft("826 रुपये पर रोक लगी है, Rs 826 only.", [826]).ok).toBe(true);
  });

  it("renders markers as numbered references", () => {
    const { text, citations } = renderCitations(
      "A [rule:mha-procedure-2026] B [rule:grievance-via-bank] C [rule:mha-procedure-2026]",
    );
    expect(text).toBe("A [1] B [2] C [1]");
    expect(citations.map((c) => c.id)).toEqual(["mha-procedure-2026", "grievance-via-bank"]);
  });
});

describe("the ₹826 demo scenario", () => {
  it("runs from payment to certificate and drafts", async () => {
    const txn = recordPayment(826, "victim@okdemo");
    tag(txn.id, "दो किलो चीनी, एक तेल");
    const hold = placeHold(txn.id);
    const cert = buildCertificate(hold.id, now());

    expect(cert.saleTag?.items).toEqual([
      { name: "चीनी", quantity: 2, unit: "किलो" },
      { name: "तेल", quantity: 1, unit: null },
    ]);
    expect(Date.parse(cert.saleTag!.recordedAt)).toBeLessThanOrEqual(Date.parse(cert.hold.placedAt));
    expect(cert.disclaimer).toBe(DISCLAIMER);
    expect(JSON.stringify(cert)).not.toMatch(/\d{9,}/); // no full account numbers

    const facts = { certificate: cert, ownerName: "R. Sharma" };
    for (const kind of ["explanation", "grievance", "escalation"] as const) {
      const draft = await makeDraft(kind, facts, "police", { useModel: false });
      expect(draft.generatedBy).toBe("template");
      expect(draft.disclaimer.length).toBeGreaterThan(0);
      expect(draft.text).not.toContain("[rule:");
      // The fixed wording must pass the same gate as model output.
      expect(checkDraft(draft.text, [826]).ok).toBe(true);
    }
    const grievance = await makeDraft("grievance", facts, "police", { useModel: false });
    expect(grievance.citations.length).toBeGreaterThan(0);
    expect(grievance.text).toContain("₹826");
  });
});

describe("item parsing", () => {
  it("parses romanised Hindi", () => {
    expect(parseSaleItems("do kilo cheeni, ek tel")).toEqual([
      { name: "cheeni", quantity: 2, unit: "kilo" },
      { name: "tel", quantity: 1, unit: null },
    ]);
  });

  it("treats a sentence end as a break between items", () => {
    expect(parseSaleItems("2 किलो चीनी, 1 तेल। 2 किलो चीनी।")).toEqual([
      { name: "चीनी", quantity: 2, unit: "किलो" },
      { name: "तेल", quantity: 1, unit: null },
      { name: "चीनी", quantity: 2, unit: "किलो" },
    ]);
  });

  it("keeps items it cannot quantify", () => {
    expect(parseSaleItems("namak aur haldi")).toEqual([
      { name: "namak", quantity: null, unit: null },
      { name: "haldi", quantity: null, unit: null },
    ]);
  });
});

describe("speech to text request", () => {
  it("sends browser recordings without the codecs parameter Sarvam rejects", async () => {
    const { speechToText } = await import("@voice/sarvam");
    const sent: FormData[] = [];
    vi.stubEnv("SARVAM_API_KEY", "test-key");
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent.push(init.body as FormData);
      return Response.json({ transcript: "दो किलो चीनी" });
    });
    try {
      const clip = new Blob([new Uint8Array(8)], { type: "audio/webm;codecs=opus" });
      expect(await speechToText(clip)).toBe("दो किलो चीनी");
      const file = sent[0].get("file") as File;
      expect(file.type).toBe("audio/webm");
      expect(file.name).toBe("sale.webm");
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});

describe("model prompt", () => {
  it("gives the model Indian time, never raw UTC timestamps", async () => {
    const { buildUserPrompt } = await import("@agent/prompts");
    const txn = recordPayment(826, "victim@okdemo");
    const hold = placeHold(txn.id);
    const facts = { certificate: buildCertificate(hold.id, now()), ownerName: "R. Sharma" };
    const prompt = buildUserPrompt("grievance", facts, allRules(), "");
    expect(prompt).not.toMatch(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/);
    expect(prompt).toContain("IST");
  });
});
