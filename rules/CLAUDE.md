# rules/

The verified rules table. This is the single source of legal and procedural facts for the whole product. The AI supplies the words; this folder supplies the facts.

## What belongs here

- One JSON file of rule entries plus the grievance ladder (`rules.json`).
- The list of official feeds the law watcher polls, and which keywords map to which rules (`feeds.json`).
- Hold types: police-initiated hold limited to the reported amount, and the proposed bank-initiated hold (flagged transactions of ₹1,000 or more, 20 days to explain, lifted on day 31 unless police instruct otherwise, 60 days at most; still a draft).
- An `effective_from` field is not in the schema yet.

## What is here now

- `rules.json` — `{ _note, rules: [...], ladder: {...} }`. 10 rules, all `verified: true`, checked 2026-11-15. Each rule:
  - `id` (lowercase, digits, hyphens; unique), `instrument`, `summary`
  - `status`: `statute` | `contested` | `administrative` | `binding_direction` | `draft`
  - `applies_when`: array of `police_hold` / `bank_hold` (empty means reference only, e.g. `bnss-106`, `bnss-107`)
  - `source_name`, `source_url` (nullable), `last_checked` (`YYYY-MM-DD`, nullable), `verified` (a verified rule must have both URL and date)
- `ladder` — `{ placeholder, source_rule, note, steps }`; each step `{ level, to, days, deadline }`. `days` is how long that step has to act. Today: bank 7, police officer 15, District Grievance Officer 15 (from `mha-procedure-2026`). Escalation is due on the sum of every step but the last: day 22.
- `feeds.json` — `{ _note, poll_minutes: 30, feeds: [{ id, name, url }], watch: [{ rules: [ids], keywords: [...] }] }`. Feeds: RBI notifications, RBI press releases, PIB. MHA, I4C, the Supreme Court and India Code publish no feed. Every rule id named must exist or the app fails at load.

The schema and validator are not a separate file: they are zod schemas in `backend/rules.ts` (`validateRules`) and `backend/watcher.ts` (`validateFeeds`), run when those modules load. Quotes and section numbers behind each entry are in `docs/sources.md`.

Templates and drafts cite rules as `[rule:<id>]` markers, so renaming an id breaks `templates/drafts.ts` and the draft checks.

## Rules for this folder

- Nothing enters without a primary source that someone has actually read.
- Never state a contested point as settled. Section 106 has conflicting High Court rulings (Delhi, Bombay and Kerala against police freezing; Allahabad and Karnataka for it); the Supreme Court has not resolved it.
- Draft instruments are labelled as drafts everywhere they surface.
- Entries are edited by hand and reviewed. The LLM never writes to this folder at runtime.
- The law watcher flags, it does not edit. When a rule is flagged, a person reads the source, updates the entry and moves `last_checked` past the item's date, which clears the flag.
- When a rule changes, update `last_checked` and keep the old entry's history in git rather than silently overwriting meaning. Update `docs/sources.md` with it.
