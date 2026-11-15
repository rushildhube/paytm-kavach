import { DISCLAIMER, DISCLAIMER_HI } from "@backend/config";
import { rulesFor, type Rule } from "@backend/rules";
import type { HoldType } from "@backend/types";
import {
  templateDraft,
  type DraftFacts,
  type DraftKind,
} from "@templates/drafts";
import { chat, SarvamUnavailable } from "@voice/sarvam";
import { checkDraft, renderCitations } from "./checks";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompts";

export type Draft = {
  kind: DraftKind;
  text: string;
  /** Rules the draft relies on, each with its source and last-checked date. */
  citations: Rule[];
  generatedBy: "sarvam" | "template";
  /** Why the model's version was not used, if it was not. */
  fallbackReason?: string;
  disclaimer: string;
};

function describe(err: unknown): string {
  if (err instanceof SarvamUnavailable) return "SARVAM_API_KEY is not set";
  if (err instanceof Error && err.name === "TimeoutError") return "the model took too long";
  return err instanceof Error ? err.message : "unknown error";
}

/**
 * Produce a draft. The model writes the words; every fact and rule comes
 * from verified inputs, and the result is checked before it is shown.
 * Any failure falls back to the fixed-wording template.
 */
export async function makeDraft(
  kind: DraftKind,
  facts: DraftFacts,
  holdType: HoldType,
  opts: { useModel?: boolean } = {},
): Promise<Draft> {
  const rules = rulesFor(holdType);
  const template = templateDraft(kind, facts);
  const disclaimer = kind === "explanation" ? DISCLAIMER_HI : DISCLAIMER;
  const amounts = [
    facts.certificate.hold.heldAmountInr,
    facts.certificate.transaction.amountInr,
  ];

  const finish = (
    raw: string,
    generatedBy: Draft["generatedBy"],
    fallbackReason?: string,
  ): Draft => {
    const { text, citations } = renderCitations(raw);
    return { kind, text, citations, generatedBy, fallbackReason, disclaimer };
  };

  const useModel = opts.useModel ?? process.env.KAVACH_USE_MODEL !== "0";
  if (!useModel) return finish(template, "template", "model disabled");

  try {
    const raw = await chat(SYSTEM_PROMPT, buildUserPrompt(kind, facts, rules, template));
    const check = checkDraft(raw, amounts, rules.map((r) => r.id));
    if (!check.ok) {
      return finish(template, "template", `model draft rejected: ${check.problems.join("; ")}`);
    }
    return finish(raw, "sarvam");
  } catch (err) {
    return finish(template, "template", describe(err));
  }
}
