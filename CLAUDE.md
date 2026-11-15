# Kavach

Paytm hackathon project. Kavach protects honest merchants from cyber-fraud account holds by recording proof of sale **at payment time**, so the evidence already exists before a freeze happens.

**The line:** "Other tools help a merchant write a letter after the account is frozen. Kavach makes sure the proof already exists before the freeze happens."

## What is and is not the novelty

Letter generators already exist (Wapas student prototype, lawyer/finance sites). Never pitch or build "AI drafts the unfreeze letter" as the new thing. The novelty is the three things only a payments company can do:

1. **Proof at the moment of sale** — the merchant tags what was sold as the Soundbox announces the payment.
2. **Verified proof** — the record is tied to Paytm's own transaction and settlement data, not what the merchant types later.
3. **Reach and language** — inside the app and Soundbox merchants already use; voice, no typing, Indian languages.

## Guardrails (apply to every folder)

- **Facts from a table, words from the AI.** Laws, deadlines and procedures come only from `rules/`. The model never invents a law, section or case.
- **Screen for mules.** Anyone who lent out their account is routed to legal aid, not given an "I'm innocent" letter. Accounts with repeated reports get no certificate.
- **Minimise data.** Store only the last four account digits; mask buyer details. Buyer details are personal data under the DPDP Act.
- **Human submits.** The merchant reviews and files through their own bank. The agent never sends anything itself.
- **Dated sources.** Every rule shown carries its source and the date it was last checked.
- **No promises.** Every screen and document says: draft, not legal advice, no guaranteed release. Position Kavach as a drafting aid.
- **No tipping off.** Never warn a merchant about a hold before the hold exists.
- **Proof is append-only.** A sale record is written at payment time and cannot be added or edited afterwards.

## Folder map

| Folder | Holds |
|---|---|
| `docs/` | Pitch, research, legal landscape, judge Q&A |
| `rules/` | The verified rules table: laws, deadlines, sources, last-checked dates |
| `data/` | Mock transactions, settlements, merchants and hold events for the demo |
| `backend/` | API and core logic: proof-of-sale ledger, hold handling, certificate, tracker |
| `agent/` | LLM prompts and drafting: explanation, grievance draft, escalation, mule screen |
| `voice/` | Voice sale tagging: speech to text, item parsing, tagging threshold |
| `templates/` | Document templates: sale certificate, grievance, escalation |
| `frontend/` | Merchant-facing demo UI |
| `demo/` | Demo script, seeded scenario, "simulate day 15" controls |
| `tests/` | Tests, including guardrail tests |
| `tasks/` | `todo.md` (plan and progress) and `lessons.md` (corrections) |

Each folder has its own `CLAUDE.md` describing what belongs there.

## Decisions (settled 2026-11-15)

- **Tagging threshold:** prompt for a voice tag on payments of ₹500 and above. Keep the value configurable.
- **Tech stack:** Next.js full stack, TypeScript, one app at the repo root. Routes in `src/app` stay thin and import from `backend/`, `agent/`, `voice/` and `frontend/` (components) through path aliases, so the folder map above still holds.
- **Voice and LLM:** Sarvam for both. The browser only records audio; Sarvam does speech to text, text to speech and the drafting (`sarvam-105b`), all called from server routes so the one `SARVAM_API_KEY` never reaches the browser.
- **Build order:** the end-to-end ₹826 demo path first, thin but complete.

## Caveat on facts

The legal and market facts in `docs/` came from a research conversation in November 2026. Verify each against its primary source before it enters `rules/` or the pitch deck.
