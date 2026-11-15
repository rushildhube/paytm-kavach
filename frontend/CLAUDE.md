# frontend/

The merchant-facing demo UI, styled as a feature inside the Paytm merchant app.

## What belongs here

- **Payment screen** — a payment lands, the Soundbox announces it, the merchant tags the sale by voice.
- **Sales list** — recent payments with their tags.
- **Hold alert** — the screen turns red for a hold, showing the held amount (for example ₹826) and making clear that only that amount is held.
- **Explanation view** — the plain-language explanation in the merchant's language.
- **Packet view** — the sale certificate and the drafted grievance, with review and download/share. The merchant files it themselves.
- **Tracker** — where the grievance stands on the ladder, days elapsed, and the escalation draft when due.
- **Demo controls** — trigger a payment, trigger a hold, "simulate day 22".

## Rules for this folder

- Every screen showing a draft or legal information displays: draft, not legal advice, no guaranteed release.
- Each rule shown carries its source and last-checked date.
- No "submit to bank" or "send" button that implies Kavach files anything. Actions are review, download, share.
- Show masked buyer details and last four account digits only.
- Hindi first, large text, minimal typing. Design for a shopkeeper at a counter.
- The hold screen must reassure before it instructs: a hold on one payment, not an accusation.
