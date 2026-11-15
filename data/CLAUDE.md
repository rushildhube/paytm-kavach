# data/

Mock data standing in for Paytm's own records. In the real product these would be Paytm's transaction and settlement systems; here they are fixtures seeded into the SQLite database (`data/kavach.db`, see `backend/CLAUDE.md`) on first start and on every reset.

## What belongs here

- Demo merchants (shop name, owner, city, language, bank, last four account digits, number of earlier reports).
- Seed transactions with masked payer handle, settlement status and, where relevant, a sale tag recorded seconds after payment.
- The ₹826 demo payment and its spoken tag.
- Separate `transactions`, `settlements`, `sale_tags` and `hold_events` files are not built; settlements are embedded in each transaction, and holds are created at runtime by the `hold` action, not seeded.

## What is here now

- `seed.ts` (imports types from `backend/types.ts`):
  - `merchants` — `m_kirana` (Sharma Kirana Store, the demo merchant, 0 reports), `m_reported` (4 earlier reports, must never get a certificate), `m_mule` (clean record, for exercising the mule-screen answers).
  - `DEMO_MERCHANT_ID` — `m_kirana`.
  - `DEMO_PAYEE_VPA` — `sharmakirana@` + `BRAND.vpaDomain` (`demoaitm`), the shop's synthetic UPI handle used in every QR. `DEMO_PAYER_VPA` — synthetic buyer handle, masked before storage.
  - `DEMO_PAYMENT` — `{ amountInr: 826, payerVpaMasked: "vi***@okdemo", spokenTag: "दो किलो चीनी, एक तेल" }`. Used by the `pay` action and the "Use recorded clip" button. The ₹826 payment is created live in the demo, not seeded.
  - `seedTransactions(base)` — three earlier sales relative to reset time: `TXN1001` ₹1,240 (settled, tagged), `TXN1002` ₹40 (below threshold, untagged), `TXN1003` ₹560 (unsettled, tagged).

## Rules for this folder

- Synthetic data only. No real names, phone numbers, UPI IDs or account numbers.
- Follow the same minimisation as production: last four digits of accounts, masked buyer details.
- Include at least one mule-like merchant and one repeatedly-reported account so the screening path can be tested.
- Include sales below the tagging threshold so the untagged path is exercised.
- Seed tags must sit inside the tagging window after their payment, like real ones.
