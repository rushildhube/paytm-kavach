# agent/

The LLM layer. It turns verified facts into clear words in the merchant's language. It decides no facts and takes no actions.

## What belongs here

- **Prompts** — system prompts and templates, versioned as files.
- **Hold explainer** — tells the merchant, in Hindi or their language, that this is a hold on one payment and not an accusation, and what happens next.
- **Grievance drafter** — fills the grievance for the bank using facts from the backend and rules from `rules/`.
- **Escalation drafter** — produces the next-level draft when the tracker says a deadline has passed.
- **Mule screen conversation** — the questions that detect an account lent to someone else, and the hand-off message to legal aid.
- **Output checks** — validation that every legal reference in a draft maps to a `rules/` entry id, and that disclaimers are present.
- **Evals** — sample inputs and expected properties of outputs.

## Rules for this folder

- Facts from the table, words from the AI. Prompts must instruct the model never to invent laws, sections, cases, deadlines or amounts. Anything not supplied in context is left out.
- Reject or regenerate any draft citing something not in `rules/`.
- Never produce an innocence letter for a merchant who fails the mule screen.
- Never promise an outcome. No "your account will be unfrozen".
- Not legal advice: outputs are drafts for the merchant to review and file themselves.
- The agent has no tools that send, submit or contact third parties.
- Pass the model only minimised data (masked buyer details, last four digits).
- Drafting uses Sarvam's chat model (`sarvam-105b`) through `voice/sarvam.ts`, the same key as speech. If the model fails or its draft fails the checks, fall back to the fixed wording in `templates/`.
