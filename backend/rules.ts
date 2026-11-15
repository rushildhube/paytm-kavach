import { z } from "zod";
import raw from "@rules/rules.json";
import type { HoldType } from "./types";

const ruleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    instrument: z.string().min(1),
    status: z.enum([
      "statute",
      "contested",
      "administrative",
      "binding_direction",
      "draft",
    ]),
    summary: z.string().min(1),
    applies_when: z.array(z.enum(["police_hold", "bank_hold"])),
    source_name: z.string().min(1),
    source_url: z.string().url().nullable(),
    last_checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    verified: z.boolean(),
  })
  .refine((r) => !r.verified || (r.source_url && r.last_checked), {
    message: "a verified rule needs a source_url and a last_checked date",
  });

const rulesFileSchema = z.object({
  rules: z.array(ruleSchema),
  ladder: z.object({
    placeholder: z.boolean(),
    note: z.string(),
    steps: z.array(
      z.object({
        level: z.number().int(),
        to: z.string(),
        escalate_after_days: z.number().int().positive().nullable(),
      }),
    ),
  }),
});

export type Rule = z.infer<typeof ruleSchema>;
export type RulesFile = z.infer<typeof rulesFileSchema>;

export function validateRules(input: unknown): RulesFile {
  const parsed = rulesFileSchema.parse(input);
  const ids = new Set<string>();
  for (const r of parsed.rules) {
    if (ids.has(r.id)) throw new Error(`duplicate rule id: ${r.id}`);
    ids.add(r.id);
  }
  return parsed;
}

const file = validateRules(raw);

export const allRules = (): Rule[] => file.rules;
export const ladder = () => file.ladder;

export function getRule(id: string): Rule | undefined {
  return file.rules.find((r) => r.id === id);
}

export function rulesFor(holdType: HoldType): Rule[] {
  const key = holdType === "police" ? "police_hold" : "bank_hold";
  return file.rules.filter((r) => r.applies_when.includes(key));
}

export function escalateAfterDays(): number {
  return file.ladder.steps[0].escalate_after_days ?? 15;
}
