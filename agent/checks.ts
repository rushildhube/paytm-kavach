import { getRule, type Rule } from "@backend/rules";

const MARKER = /\[rule:([a-z0-9-]+)\]/g;

/** Wording that promises an outcome. Drafts containing it are rejected. */
const PROMISES = [
  /guarantee/i,
  /will (surely |definitely |certainly )?be (released|unfrozen|lifted|refunded)/i,
  /गारंटी/,
  /पक्का (छूट|मिल)/,
];

/** References to law that did not come through a [rule:id] marker. */
const UNSOURCED_LAW = [
  /\bsection\s+\d+/i,
  /\b(BNSS|BNS|IPC|CrPC|PMLA|IT Act)\b/,
  /\bv(s)?\.\s+[A-Z]/,
  /धारा\s*[\d०-९]+/,
];

export type CheckResult =
  | { ok: true; ruleIds: string[] }
  | { ok: false; problems: string[] };

/**
 * Gate every model-written draft: it may only cite rules that exist, may
 * not name laws outside the table, may not promise an outcome, and may not
 * state an amount that is not in the verified facts.
 */
export function checkDraft(text: string, allowedAmounts: number[]): CheckResult {
  const problems: string[] = [];
  if (!text.trim()) problems.push("empty draft");

  const ruleIds = [...new Set([...text.matchAll(MARKER)].map((m) => m[1]))];
  for (const id of ruleIds) {
    if (!getRule(id)) problems.push(`cites unknown rule: ${id}`);
  }

  const withoutMarkers = text.replace(MARKER, "");
  for (const p of UNSOURCED_LAW) {
    if (p.test(withoutMarkers)) problems.push(`names a law outside the rules table (${p})`);
  }
  for (const p of PROMISES) {
    if (p.test(text)) problems.push(`promises an outcome (${p})`);
  }

  const allowed = new Set(allowedAmounts);
  for (const m of text.matchAll(/₹\s?([\d,]+(?:\.\d+)?)/g)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (!allowed.has(n)) problems.push(`states an amount not in the facts: ₹${m[1]}`);
  }

  return problems.length ? { ok: false, problems } : { ok: true, ruleIds };
}

/** Replace [rule:id] markers with a readable reference and list the rules used. */
export function renderCitations(text: string): { text: string; citations: Rule[] } {
  const citations: Rule[] = [];
  const rendered = text.replace(MARKER, (_, id: string) => {
    const rule = getRule(id);
    if (!rule) return "";
    let n = citations.findIndex((r) => r.id === id);
    if (n === -1) n = citations.push(rule) - 1;
    return `[${n + 1}]`;
  });
  return { text: rendered, citations };
}
