/**
 * Proof-strength label (docs/proof-improvements.md, item 4): a description of
 * the merchant's own records, on every payment, never a promise, never a hint
 * of a report.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { handle, snapshot, soundboxSnapshot } from "@backend/api";
import { buildCertificate } from "@backend/certificate";
import { PROOF_LEVELS, proofStrength } from "@backend/proofStrength";
import { resetStore } from "@backend/store";

process.env.KAVACH_USE_MODEL = "0";

beforeEach(() => resetStore());

const inv = { sha256: "a".repeat(64) };

describe("proofStrength", () => {
  it("grades each kind of record", () => {
    expect(proofStrength({ tag: null, invoice: null }).level).toBe("none");
    expect(proofStrength({ tag: { source: "bill", boundBy: "bill" }, invoice: null }).level).toBe("good");
    expect(proofStrength({ tag: { source: "voice", boundBy: "tap" }, invoice: null }).level).toBe("good");
    expect(proofStrength({ tag: { source: "voice", boundBy: "only_open" }, invoice: null }).level).toBe("good");
    expect(proofStrength({ tag: { source: "voice", boundBy: "amount" }, invoice: null }).level).toBe("basic");
    expect(proofStrength({ tag: { source: "voice", boundBy: "amount_and_name" }, invoice: null }).level).toBe("basic");
    expect(proofStrength({ tag: { source: "typed", boundBy: "tap" }, invoice: null }).level).toBe("basic");
  });

  it("an invoice attached to the payment lifts the level one step", () => {
    expect(proofStrength({ tag: null, invoice: inv }).level).toBe("basic");
    expect(proofStrength({ tag: { source: "typed", boundBy: "tap" }, invoice: inv }).level).toBe("good");
    expect(proofStrength({ tag: { source: "bill", boundBy: "bill" }, invoice: inv }).level).toBe("strong");
  });

  it("a typed description is never graded as a voice tap", () => {
    const s = proofStrength({ tag: { source: "typed", boundBy: "tap" }, invoice: null });
    expect(s.reasons.join(" ")).toMatch(/typed/);
    expect(s.reasons.join(" ")).not.toMatch(/picked this payment/);
  });

  it("never promises an outcome", () => {
    const words = [
      ...Object.values(PROOF_LEVELS).flatMap((l) => [l.en, l.hi]),
      ...(["bill", "voice", "typed"] as const).flatMap((source) =>
        proofStrength({ tag: { source, boundBy: "tap" }, invoice: inv }).reasons,
      ),
      proofStrength({ tag: null, invoice: null }).reasons,
      readFileSync("frontend/ProofChip.tsx", "utf8"),
    ].join(" ");
    expect(words).not.toMatch(/\bsafe from\b(?! a hold)|guarantee|will be (released|lifted)|cannot be frozen/i);
  });
});

describe("label in the snapshots and the certificate", () => {
  it("every merchant and Soundbox payment carries a level", async () => {
    await handle({ action: "pay", amountInr: 826 });
    for (const t of snapshot().transactions) expect(t.strength.level).toMatch(/strong|good|basic|none/);
    for (const p of soundboxSnapshot().payments) expect(p.strength).toMatch(/strong|good|basic|none/);
  });

  it("a report does not change the label (no tipping off)", async () => {
    const a = (await handle({ action: "pay", amountInr: 826 })).result as { txn: { id: string } };
    const before = snapshot().transactions.find((t) => t.id === a.txn.id)!.strength;
    await handle({ action: "report", role: "bank", txnId: a.txn.id });
    const after = snapshot().transactions.find((t) => t.id === a.txn.id)!.strength;
    expect(after).toEqual(before);
  });

  it("the certificate carries the same level and reasons", async () => {
    const bill = (await handle({ action: "bill-create", amountInr: 826, text: "do kilo cheeni" })).result as { id: string };
    const paid = (await handle({ action: "pay", billId: bill.id, amountInr: 826 })).result as { txn: { id: string } };
    const listed = snapshot().transactions.find((t) => t.id === paid.txn.id)!.strength;
    await handle({ action: "report", role: "bank", txnId: paid.txn.id });
    const hold = (await handle({ action: "hold", role: "bank", txnId: paid.txn.id })).result as { id: string };
    const cert = buildCertificate(hold.id, new Date());
    expect(cert.strength).toEqual(listed);
    expect(cert.strength.level).toBe("good");
  });
});
