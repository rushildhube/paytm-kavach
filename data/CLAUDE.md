# data/

Mock data standing in for Paytm's own records. In the real product these would be Paytm's transaction and settlement systems; here they are fixtures.

## What belongs here

- `merchants` — demo merchants (shop name, category, language, last four account digits only).
- `transactions` — UPI payments with id, amount, timestamp, masked payer handle, merchant id.
- `settlements` — settlement records linked to transactions (settled or unsettled matters for what the procedure requires).
- `sale_tags` — seed proof-of-sale records linked to transaction ids.
- `hold_events` — simulated holds: transaction id, held amount, hold type (police or bank-initiated), date, reporting reference.
- The demo scenario seed: a ₹826 payment tagged "do kilo cheeni, ek tel", followed by a hold on ₹826.

## Rules for this folder

- Synthetic data only. No real names, phone numbers, UPI IDs or account numbers.
- Follow the same minimisation as production: last four digits of accounts, masked buyer details.
- Include at least one mule-like merchant and one repeatedly-reported account so the screening path can be tested.
- Include sales below the tagging threshold so the untagged path is exercised.
