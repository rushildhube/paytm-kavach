# demo/

Everything needed to run the live demo reliably in front of judges.

## Four-screen live demo (branch `feat/multi-screen-demo`)

- Run `npm run dev` for laptop tabs, or `npm run dev:lan` for phones (HTTPS on 0.0.0.0 with a self-signed certificate, needed for phone mics; open `https://<laptop-LAN-IP>:3000/<screen>` and accept the warning). Self-signed certificates land in `certificates/` (git-ignored).
- Devices: `/customer` and `/soundbox` on phones, `/merchant` on a phone or the laptop, `/bank` on the laptop as the presenter console. Reset from `/bank`.
- Order: customer pays → Soundbox announces, shopkeeper tags → merchant shows the tag → bank reports (merchant sees nothing) → bank restricts → merchant: explanation, two questions, certificate, grievance, "filed" → bank: simulate day 22 → escalation on the merchant screen.
- `script.md` still describes the single-screen demo; the four-screen rewrite is issue #14. Browser click-through: #13. Phone rehearsal: #16. Tag-window timing: #17.

## What belongs here

- `script.md` — the spoken walkthrough, step by step:
  1. A ₹826 payment lands. The merchant says "do kilo cheeni, ek tel" and the sale is tagged.
  2. The screen turns red: a hold on ₹826.
  3. Kavach explains in Hindi that this is a hold on one payment, not an accusation.
  4. Two screening questions, then a sale certificate from Paytm's records plus the drafted grievance for the bank.
  5. The merchant marks it filed. Click "Simulate day 22": the bank (7 days) and the police officer (15 days) have both had their time with no decision, and the escalation draft to the District Grievance Officer appears.
- Reset and clock controls — built into the app, not scripts here: the **Reset demo** button (`reset` action) and the **Simulate day 22** button (`advance` action) in `frontend/KavachApp.tsx`.
- Pre-recorded audio and cached model outputs (not built yet). The offline path instead uses the fixed transcript behind "Use recorded clip" and the template drafts in `templates/drafts.ts`.
- Screenshots or a backup recording (not built yet).

## What is here now

- `script.md` — run `npm run dev`, open http://localhost:3000, press Reset demo. A seven-step click-and-say table (payment, tag, hold, mule questions, read certificate and grievance, mark filed, simulate day 22), what changes without `SARVAM_API_KEY`, and how to show the guardrails (answer हाँ for legal aid; wait two minutes to show the tag window closing; `npm test`).
- Not yet in `script.md`: the law-watch panel. "4 · Simulate a change to the MHA procedure" (`simulate-law-change`) injects a clearly labelled fake feed item that flags the MHA-procedure rules as "possibly changed, under review" on citations; Reset clears only simulated alerts. "Check feeds now" polls the real RBI and PIB feeds and needs network.

## Rules for this folder

- The demo must be repeatable from a single reset (the Reset demo button; it reseeds the in-memory store and clears simulated alerts).
- Keep a fully offline fallback path; never depend on live speech recognition or a live model call working on stage.
- The demo shows the same guardrails as the product: disclaimers visible, merchant files the draft, nothing auto-sent.
- Demo data is synthetic and comes from `data/`.
- Day counts in the script come from the ladder in `rules/rules.json`; if the ladder changes, update `script.md`.
