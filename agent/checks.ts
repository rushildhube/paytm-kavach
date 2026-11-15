import { getRule, type Rule } from "@backend/rules";

const MARKER = /\[rule:([a-z0-9-]+)\]/g;

/** Wording that promises an outcome. Drafts containing it are rejected. */
const PROMISES = [
  /guarantee/i,
  /will (surely |definitely |certainly |soon )?be (released|unfrozen|lifted|refunded|returned|restored|unblocked)/i,
  /will (surely |definitely |certainly )?(get|receive) (your |the )?(money|funds|amount|payment) back/i,
  /गारंटी/,
  /पक्का (छूट|मिल)/,
  /वापस (मिल|आ) (जाएगा|जाएँगे|जाएंगे|जायेगा)/,
  /(ज़रूर|जरूर) (मिल|छूट|वापस)/,
];

/** References to law that did not come through a [rule:id] marker. */
const UNSOURCED_LAW = [
  // "Section 106", "Sections 106 and 107", "Sec. 106", "u/s 106", "s. 106"
  /\b(?:sections?|secs?\.?|u\/s\.?)\s*\d+/i,
  /\bs\.\s?\d+/i,
  /\b(?:articles?|art\.)\s*\d+/i,
  /(?:धारा|अनुच्छेद)\s*[\d०-९]+/,
  /\b(BNSS|BNS|BSA|IPC|CrPC|PMLA|IT Act|DPDP)\b/,
  // Act names written out
  /Bharatiya\s+(?:Nagarik|Nyaya|Sakshya)/i,
  /\b(?:Information Technology|Money[- ]Laundering|Penal Code|Criminal Procedure|Data Protection)\b/i,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Act\b/,
  /(?:अधिनियम|संहिता)/,
  // Case names
  /\bv(s)?\.\s+[A-Z]/,
  /\bversus\b/i,
];

/** Devanagari digits read as ASCII, so ₹१,००० is checked like ₹1,000. */
function asciiDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

export type CheckResult =
  | { ok: true; ruleIds: string[] }
  | { ok: false; problems: string[] };

/**
 * Gate every model-written draft: it may only cite rules that exist, may
 * not name laws outside the table, may not promise an outcome, and may not
 * state an amount that is not in the verified facts. With `allowedRuleIds`,
 * it may only cite the rules the model was given.
 */
export function checkDraft(
  text: string,
  allowedAmounts: number[],
  allowedRuleIds?: string[],
): CheckResult {
  const problems: string[] = [];
  if (!text.trim()) problems.push("empty draft");

  const ruleIds = [...new Set([...text.matchAll(MARKER)].map((m) => m[1]))];
  for (const id of ruleIds) {
    if (!getRule(id)) problems.push(`cites unknown rule: ${id}`);
    else if (allowedRuleIds && !allowedRuleIds.includes(id)) {
      problems.push(`cites a rule it was not given: ${id}`);
    }
  }

  const withoutMarkers = text.replace(MARKER, "");
  for (const p of UNSOURCED_LAW) {
    if (p.test(withoutMarkers)) problems.push(`names a law outside the rules table (${p})`);
  }
  for (const p of PROMISES) {
    if (p.test(text)) problems.push(`promises an outcome (${p})`);
  }

  const allowed = new Set(allowedAmounts);
  // Amounts however they are written: ₹826, Rs 826, 826 रुपये, 826 rupees.
  const AMOUNTS = [
    /(?:₹|\bRs\.?|\bINR)\s?([\d,]+(?:\.\d+)?)/gi,
    /([\d,]+(?:\.\d+)?)\s?(?:रुपये|रुपए|rupees)/gi,
  ];
  const digits = asciiDigits(text);
  for (const pattern of AMOUNTS) {
    for (const m of digits.matchAll(pattern)) {
      const n = Number(m[1].replace(/,/g, ""));
      if (!allowed.has(n)) problems.push(`states an amount not in the facts: ${m[0]}`);
    }
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
