# rules/

The verified rules table. This is the single source of legal and procedural facts for the whole product. The AI supplies the words; this folder supplies the facts.

## What belongs here

- Structured data files (JSON or YAML) with one entry per rule. Each entry has:
  - `id` — stable identifier
  - `instrument` — e.g. BNSS s.106, Home Ministry procedure 2 Jan 2026
  - `status` — `statute`, `contested`, `administrative`, `binding_direction`, or `draft`
  - `summary` — plain-language statement of what it does
  - `applies_when` — the condition under which the rule is relevant
  - `source_url` and `source_name`
  - `last_checked` — ISO date
  - `effective_from` where relevant
- Deadlines and the grievance ladder: who to approach, in what order, and after how many days to escalate (this drives the tracker and the "day 22" escalation).
- Hold types: police-initiated hold limited to the reported amount, and the upcoming bank-initiated hold (flagged transactions of ₹1,000 or more, 20 days to explain, lifted on day 31 unless police instruct otherwise, 60 days at most; still a draft).
- A schema file and a validator that rejects entries missing a source or a `last_checked` date.

## Rules for this folder

- Nothing enters without a primary source that someone has actually read.
- Never state a contested point as settled. Section 106 has conflicting High Court rulings (Delhi, Bombay and Kerala against police freezing; Allahabad and Karnataka for it); the Supreme Court has not resolved it.
- Draft instruments are labelled as drafts everywhere they surface.
- Entries are edited by hand and reviewed. The LLM never writes to this folder at runtime.
- When a rule changes, update `last_checked` and keep the old entry's history in git rather than silently overwriting meaning.
