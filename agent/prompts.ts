import type { Rule } from "@backend/rules";
import type { DraftFacts, DraftKind } from "@templates/drafts";

export const SYSTEM_PROMPT = `You write drafts for small Indian shopkeepers whose bank account has a hold on one payment after a cyber-fraud report. The shopkeeper will read your draft, decide whether it is right, and file it with their own bank themselves. You never file or send anything.

You are a drafting aid, not a lawyer. Your job is to put verified facts into clear, respectful words.

Where the facts come from:
- Everything about the payment, the hold and the sale is in the FACTS block. Use those values exactly. If something is not there, leave it out rather than guess.
- Everything about law and procedure is in the RULES block. You may rely only on those entries. Never mention any other law, section, case, court, deadline or authority, even one you are sure exists, because this area changes often and an invented or outdated reference would hurt the shopkeeper.
- When you rely on a rule, put its marker right after the sentence, written exactly as [rule:<id>]. Describe what the rule says in your own plain words; the marker is turned into the proper reference later. Describe a rule only as strongly as its summary and status allow: a "draft" or "contested" rule is not settled law.

What to avoid:
- Do not promise or predict an outcome. Nobody can say the money will be released.
- Do not state any rupee amount other than the ones in FACTS.
- Do not add a disclaimer; one is attached separately.
- Do not use markdown formatting. Plain text only.

Output only the draft itself, with no preface or commentary.`;

const TASKS: Record<DraftKind, string> = {
  explanation: `Write a short spoken explanation in simple, warm Hindi (Devanagari script) that will be read aloud to the shopkeeper the moment they see the hold. Reassure first: this is a hold on one payment, not on the whole account, and it is not an accusation. Then say what proof already exists and that a certificate and a grievance draft are ready for them to read and file at their bank themselves. Keep it under 80 words, in everyday shop-counter language. Do not include rule markers in this one.`,
  grievance: `Write the grievance letter in English from the shopkeeper to the branch manager of their bank. It should identify the hold and the payment, state that the payment was an ordinary sale and give the proof recorded at payment time, ask the bank to register the grievance and give the grievance ID, and ask for confirmation that only the reported amount is held. Mention that the sale certificate is attached. Keep it to one page.`,
  escalation: `Write the escalation letter in English from the shopkeeper to the next level named in FACTS. The original grievance has gone unanswered for the number of days given in FACTS. Say when it was filed, that no reply has come, restate the payment and the proof briefly, and ask for a decision. Mention the attachments. Keep it to one page.`,
};

export function buildUserPrompt(
  kind: DraftKind,
  facts: DraftFacts,
  rules: Rule[],
  example: string,
): string {
  const ruleLines = rules.map((r) => ({
    id: r.id,
    instrument: r.instrument,
    status: r.status,
    summary: r.summary,
  }));
  return `<task>
${TASKS[kind]}
</task>

<facts>
${JSON.stringify(facts, null, 2)}
</facts>

<rules>
${JSON.stringify(ruleLines, null, 2)}
</rules>

<reference_draft>
A plain version of this draft, for the structure and the facts it covers. Improve on its wording; do not add facts or rules it does not have.

${example}
</reference_draft>`;
}
