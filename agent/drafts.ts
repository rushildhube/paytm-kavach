import Anthropic from "@anthropic-ai/sdk";
import { DISCLAIMER, DISCLAIMER_HI } from "@backend/config";
import { rulesFor, type Rule } from "@backend/rules";
import type { HoldType } from "@backend/types";
import {
  templateDraft,
  type DraftFacts,
  type DraftKind,
} from "@templates/drafts";
import { checkDraft, renderCitations } from "./checks";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompts";

export type Draft = {
  kind: DraftKind;
  text: string;
  /** Rules the draft relies on, each with its source and last-checked date. */
  citations: Rule[];
  generatedBy: "claude" | "template";
  /** Why the model's version was not used, if it was not. */
  fallbackReason?: string;
  disclaimer: string;
};

const MODEL = "claude-opus-5-5";

async function askClaude(
  kind: DraftKind,
  facts: DraftFacts,
  rules: Rule[],
  example: string,
): Promise<string> {
  const client = new Anthropic();
  const response = await client.beta.messages.create(
    {
      model: MODEL,
      max_tokens: 4000,
      // If the model declines, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildUserPrompt(kind, facts, rules, example) },
      ],
    },
    { timeout: 60_000, maxRetries: 1 },
  );
  if (response.stop_reason === "refusal") throw new Error("model declined");
  if (response.stop_reason === "max_tokens") throw new Error("draft was cut off");
  return response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
}

function describe(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "no valid Anthropic credentials";
  if (err instanceof Anthropic.RateLimitError) return "rate limited";
  if (err instanceof Anthropic.APIConnectionError) return "could not reach the model";
  if (err instanceof Anthropic.APIError) return `model API error ${err.status}`;
  if (err instanceof Anthropic.AnthropicError) return "Anthropic credentials are not set";
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
    const raw = await askClaude(kind, facts, rules, template);
    const check = checkDraft(raw, amounts);
    if (!check.ok) {
      return finish(template, "template", `model draft rejected: ${check.problems.join("; ")}`);
    }
    return finish(raw, "claude");
  } catch (err) {
    return finish(template, "template", describe(err));
  }
}
