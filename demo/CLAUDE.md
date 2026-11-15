# demo/

Everything needed to run the live demo reliably in front of judges.

## What belongs here

- `script.md` — the spoken walkthrough, step by step:
  1. A ₹826 payment lands. The merchant says "do kilo cheeni, ek tel" and the sale is tagged.
  2. The screen turns red: a hold on ₹826.
  3. Kavach explains in Hindi that this is a hold on one payment, not an accusation.
  4. It produces a sale certificate from Paytm's records, plus the drafted grievance for the bank.
  5. Click "simulate day 15": the officer has not replied, and the escalation draft appears.
- Seed and reset scripts that put the app into the starting state.
- Clock-simulation controls for jumping to day 15.
- Pre-recorded audio and cached model outputs as a fallback if the mic or network fails.
- Screenshots or a backup recording.

## Rules for this folder

- The demo must be repeatable from a single reset command.
- Keep a fully offline fallback path; never depend on live speech recognition or a live model call working on stage.
- The demo shows the same guardrails as the product: disclaimers visible, merchant files the draft, nothing auto-sent.
- Demo data is synthetic and comes from `data/`.
