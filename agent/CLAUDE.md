# agent/

The LLM layer. It turns verified facts into clear words in the merchant's language. It decides no facts and takes no actions.

## What belongs here

- **Prompts** — the system prompt and per-draft task prompts (TypeScript constants in `prompts.ts`, versioned in git).
- **Hold explainer** — tells the merchant, in Hindi, that this is a hold on one payment and not an accusation, and what happens next.
- **Grievance drafter** — fills the grievance for the bank using facts from the backend and rules from `rules/`.
- **Escalation drafter** — produces the next-level draft when the tracker says a deadline has passed.
- **Output checks** — validation that every legal reference in a draft maps to a `rules/` entry id, with no promises and no invented amounts.
- **Mule screen conversation** — not built here. The two questions are fixed text in `frontend/KavachApp.tsx`, the decision is `checkEligibility` in `backend/holds.ts`, and the referral wording is in `templates/drafts.ts`.
- **Evals** — sample inputs and expected properties of outputs (not built yet).

## What is here now

- `drafts.ts` — `makeDraft(kind, facts, holdType, { useModel? })` returns a `Draft` (`kind`, `text`, `citations`, `generatedBy: "sarvam" | "template"`, `fallbackReason?`, `disclaimer`). It calls `chat()` from `voice/sarvam.ts` (model `sarvam-105b`, `reasoning_effort: null`, temperature 0.2), runs `checkDraft`, and on any failure (no key, timeout, rejected draft) returns the template from `templates/drafts.ts` with the reason. `KAVACH_USE_MODEL=0` skips the model. The explanation gets `DISCLAIMER_HI`, letters get `DISCLAIMER`; the disclaimer is a separate field, not part of the text.
- `prompts.ts` — `SYSTEM_PROMPT` and `buildUserPrompt(kind, facts, rules, example)`. The user prompt has `<task>`, `<facts>` (timestamps pre-converted to IST), `<rules>` (id, instrument, status, summary, and `under_review` when the law watcher has flagged the rule) and `<reference_draft>` (the template text). The model cites rules as `[rule:<id>]` markers.
- `checks.ts` — `checkDraft(text, allowedAmounts)` rejects: unknown `[rule:id]`, law names outside markers (section N, BNSS, BNS, IPC, CrPC, PMLA, IT Act, case "v."/"vs.", धारा), promise wording (guarantee, "will be released", गारंटी), and any rupee amount not in the facts. `renderCitations(text)` turns markers into `[1]`, `[2]` and returns the cited `Rule` objects.

Imported by `backend/api.ts` (`makeDraft`) and `frontend/` (the `Draft` type).

## Rules for this folder

- Facts from the table, words from the AI. Prompts must instruct the model never to invent laws, sections, cases, deadlines or amounts. Anything not supplied in context is left out.
- Reject any draft citing something not in `rules/`. Today a rejected draft falls back to the template; there is no regeneration.
- Never produce an innocence letter for a merchant who fails the mule screen.
- Never promise an outcome. No "your account will be unfrozen".
- Not legal advice: outputs are drafts for the merchant to review and file themselves.
- The agent has no tools that send, submit or contact third parties.
- Pass the model only minimised data (masked buyer details, last four digits).
- Drafting uses Sarvam's chat model (`sarvam-105b`) through `voice/sarvam.ts`, the same key as speech. If the model fails or its draft fails the checks, fall back to the fixed wording in `templates/`.
- Templates must pass `checkDraft` too (asserted in `tests/guardrails.test.ts`), so new template wording cannot name a law outside a `[rule:id]` marker.
