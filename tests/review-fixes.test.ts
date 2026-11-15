/**
 * Regression tests for the code review in issue #12. Each block names the
 * finding it guards.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { checkDraft } from "@agent/checks";
import { templateDraft } from "@templates/drafts";
import { handle, MAX_TRANSCRIPT_CHARS } from "@backend/api";
import { buildCertificate } from "@backend/certificate";
import { RateLimited, resetRateLimits, takeToken, RATE_LIMITS } from "@backend/ratelimit";
import { rulesFor } from "@backend/rules";
import { now, resetStore } from "@backend/store";
import { istDate, matchItems, parseFeed } from "@backend/watcher";
import { merchants } from "@data/seed";
import { parseSaleItems } from "@voice/parser";

process.env.KAVACH_USE_MODEL = "0";

const clean = { lentAccount: false, receivedForCommission: false };

type State = { hold: { id: string } | null; tracker: { stage: string } | null };

async function payAndHold(merchantId = "m_kirana") {
  await handle({ action: "merchant", merchantId });
  const paid = (await handle({ action: "pay" })).result as { txn: { id: string } };
  const hold = (await handle({ action: "hold", txnId: paid.txn.id })).result as { id: string };
  return { txnId: paid.txn.id, holdId: hold.id };
}

beforeEach(() => {
  resetStore();
  resetRateLimits();
});

describe("#12.1 the payment's merchant decides, not the screen", () => {
  it("a reported account gets no certificate after switching to a clean merchant", async () => {
    const { holdId } = await payAndHold("m_reported");
    await handle({ action: "merchant", merchantId: "m_kirana" });
    await expect(handle({ action: "packet", holdId, answers: clean })).rejects.toThrow(
      /another merchant/,
    );
    await handle({ action: "merchant", merchantId: "m_reported" });
    const packet = (await handle({ action: "packet", holdId, answers: clean })).result as {
      eligibility: { outcome: string };
      certificate?: unknown;
    };
    expect(packet.eligibility.outcome).toBe("no_certificate");
    expect(packet.certificate).toBeUndefined();
  });

  it("refuses to tag, report or hold another merchant's payment", async () => {
    await handle({ action: "merchant", merchantId: "m_reported" });
    const paid = (await handle({ action: "pay" })).result as { txn: { id: string } };
    await handle({ action: "merchant", merchantId: "m_kirana" });
    const txnId = paid.txn.id;
    await expect(handle({ action: "tag", txnId, transcript: "do kilo cheeni" })).rejects.toThrow(/another merchant/);
    await expect(handle({ action: "report", txnId })).rejects.toThrow(/another merchant/);
    await expect(handle({ action: "hold", txnId })).rejects.toThrow(/another merchant/);
  });

  it("does not show another merchant's hold", async () => {
    await payAndHold("m_reported");
    const { state } = await handle({ action: "merchant", merchantId: "m_kirana" });
    expect((state as State).hold).toBeNull();
    const bank = await handle({ action: "state", role: "bank" });
    expect((bank.state as State).hold).toBeNull();
  });

  it("signs letters with the owner of the held payment", async () => {
    const { holdId } = await payAndHold("m_kirana");
    const packet = (await handle({ action: "packet", holdId, answers: clean })).result as {
      grievance: { text: string };
    };
    const owner = merchants.find((m) => m.id === "m_kirana")!.ownerName;
    expect(packet.grievance.text).toContain(owner);
  });
});

describe("#12.2 filing and escalation need an eligible screen", () => {
  it("a reported account cannot mark filed or get an escalation letter", async () => {
    const { holdId } = await payAndHold("m_reported");
    await handle({ action: "packet", holdId, answers: clean });
    await expect(handle({ action: "filed", holdId })).rejects.toThrow(/cannot prepare letters/);
    await handle({ action: "advance", days: 22 });
    await expect(handle({ action: "escalation", holdId })).rejects.toThrow(/cannot prepare letters/);
  });

  it("a merchant who lent the account gets no escalation letter", async () => {
    const { holdId } = await payAndHold();
    await handle({ action: "packet", holdId, answers: { ...clean, lentAccount: true } });
    await expect(handle({ action: "filed", holdId })).rejects.toThrow(/cannot prepare letters/);
  });

  it("filing before the screen is refused", async () => {
    const { holdId } = await payAndHold();
    await expect(handle({ action: "filed", holdId })).rejects.toThrow(/screening questions/);
  });

  it("the eligible path still reaches the day-22 escalation", async () => {
    const { holdId } = await payAndHold();
    await handle({ action: "packet", holdId, answers: clean });
    await handle({ action: "filed", holdId });
    const { state } = await handle({ action: "advance", days: 22 });
    expect((state as State).tracker?.stage).toBe("escalation_due");
    const letter = (await handle({ action: "escalation", holdId })).result as { text: string };
    expect(letter.text.length).toBeGreaterThan(0);
  });
});

describe("#12.3 screening answers are validated and the first result stands", () => {
  it("refuses missing or non-boolean answers", async () => {
    const { holdId } = await payAndHold();
    await expect(handle({ action: "packet", holdId, answers: {} })).rejects.toThrow(/invalid request/);
    await expect(
      handle({ action: "packet", holdId, answers: { lentAccount: "no", receivedForCommission: false } }),
    ).rejects.toThrow(/invalid request/);
  });

  it("a legal-aid result cannot be overturned by answering again", async () => {
    const { holdId } = await payAndHold();
    const first = (await handle({ action: "packet", holdId, answers: { ...clean, lentAccount: true } }))
      .result as { eligibility: { outcome: string } };
    expect(first.eligibility.outcome).toBe("legal_aid");
    const second = (await handle({ action: "packet", holdId, answers: clean })).result as {
      eligibility: { outcome: string };
      certificate?: unknown;
    };
    expect(second.eligibility.outcome).toBe("legal_aid");
    expect(second.certificate).toBeUndefined();
  });

  it("the screen result never reaches the bank console", async () => {
    const { holdId } = await payAndHold();
    await handle({ action: "packet", holdId, answers: { ...clean, lentAccount: true } });
    const bank = await handle({ action: "state", role: "bank" });
    expect(JSON.stringify(bank.state)).not.toMatch(/lentAccount|legal_aid|screening/);
  });
});

describe("#12.4 request bodies are validated", () => {
  it("refuses an absurd clock jump and keeps the app usable", async () => {
    await expect(handle({ action: "advance", days: 1e9 })).rejects.toThrow(/invalid request/);
    await expect(handle({ action: "advance", days: 0 })).rejects.toThrow(/invalid request/);
    const { state } = await handle({ action: "state" });
    expect(Number.isNaN(Date.parse((state as { now: string }).now))).toBe(false);
  });

  it("refuses unknown actions, sources, roles and oversized input", async () => {
    await expect(handle({ action: "drop-tables" })).rejects.toThrow(/invalid request/);
    await expect(handle(null)).rejects.toThrow(/invalid request/);
    const paid = (await handle({ action: "pay" })).result as { txn: { id: string } };
    const txnId = paid.txn.id;
    await expect(handle({ action: "tag", txnId, transcript: "x", source: "typed_later" })).rejects.toThrow(/invalid request/);
    await expect(
      handle({ action: "tag", txnId, transcript: "a".repeat(MAX_TRANSCRIPT_CHARS + 1) }),
    ).rejects.toThrow(/invalid request/);
    await expect(handle({ action: "pay", amountInr: 1e12 })).rejects.toThrow(/invalid request/);
    await expect(handle({ action: "state", role: "admin" })).rejects.toThrow(/invalid request/);
  });
});

describe("#12.5 draft checks catch more law references and promises", () => {
  const bad = [
    "Under Sections 106 and 107 this is void.",
    "Sec. 106 of the Bharatiya Nagarik Suraksha Sanhita applies.",
    "As held in Sharma versus Union of India.",
    "This violates Article 21.",
    "The Information Technology Act requires it.",
    "u/s 106 the police may act.",
    "Your money will be returned.",
    "पैसा जल्द वापस मिल जाएगा।",
    "₹१,००० पर रोक लगी है।",
  ];
  for (const text of bad) {
    it(`rejects: ${text}`, () => {
      expect(checkDraft(text, [826]).ok).toBe(false);
    });
  }

  it("accepts Devanagari digits when the amount is in the facts", () => {
    expect(checkDraft("केवल ₹८२६ पर रोक है।", [826]).ok).toBe(true);
  });

  it("rejects a known rule the model was not given", () => {
    expect(checkDraft("See [rule:bnss-106].", [826], ["hold-limited-to-amount"]).ok).toBe(false);
    expect(checkDraft("See [rule:hold-limited-to-amount].", [826], ["hold-limited-to-amount"]).ok).toBe(true);
  });

  it("templates cite only the rules given for a police hold", async () => {
    const { holdId } = await payAndHold();
    const facts = {
      certificate: buildCertificate(holdId, now()),
      ownerName: "Ramesh Sharma",
      filedAt: now().toISOString(),
      daysSinceFiled: 22,
      nextLevel: "District Grievance Officer",
    };
    const ids = rulesFor("police").map((r) => r.id);
    for (const kind of ["explanation", "grievance", "escalation"] as const) {
      const result = checkDraft(templateDraft(kind, facts), [826], ids);
      expect(result, kind).toMatchObject({ ok: true });
    }
  });
});

describe("#12.7 parser reads Devanagari decimals and joined units", () => {
  it("reads १.५ as 1.5", () => {
    expect(parseSaleItems("१.५ किलो चीनी")).toEqual([{ name: "चीनी", quantity: 1.5, unit: "किलो" }]);
  });

  it("splits 2kg into quantity and unit", () => {
    expect(parseSaleItems("2kg cheeni")).toEqual([{ name: "cheeni", quantity: 2, unit: "kg" }]);
  });
});

describe("#12.8 watcher edge cases", () => {
  it("dates items by the Indian calendar", () => {
    expect(istDate("2026-11-14T21:30:00Z")).toBe("2026-11-15");
    const feed = { id: "rbi", name: "RBI" };
    const item = {
      title: "Temporary debit hold on money mule accounts",
      link: "https://rbi.org.in/x",
      published: "2026-11-14T21:30:00.000Z",
      text: "money mule",
    };
    const ruleIds = matchItems(feed, [item], () => false, "2026-11-15T00:00:00Z").map((a) => a.ruleId);
    expect(ruleIds).toContain("rbi-draft-bank-hold");
  });

  it("survives an out-of-range entity and drops non-web links", () => {
    const xml = `<rss><channel>
      <item><title>Bad &#99999999; entity</title><link>javascript:alert(1)</link></item>
      <item><title>Fine</title><link>https://pib.gov.in/x</link></item>
    </channel></rss>`;
    const items = parseFeed(xml);
    expect(items[0].title).toContain("�");
    expect(items[0].link).toBe("");
    expect(items[1].link).toBe("https://pib.gov.in/x");
  });
});

describe("#12.6 paid Sarvam calls are rate limited", () => {
  it("refuses once a client uses up its bucket", () => {
    for (let i = 0; i < RATE_LIMITS.draft; i++) takeToken("draft", "1.2.3.4", 1000);
    expect(() => takeToken("draft", "1.2.3.4", 1000)).toThrow(RateLimited);
    expect(() => takeToken("draft", "5.6.7.8", 1000)).not.toThrow();
    expect(() => takeToken("draft", "1.2.3.4", 62_000)).not.toThrow();
  });
});
