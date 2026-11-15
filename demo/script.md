# Demo script

Run `npm run dev` and open http://localhost:3000. Press **Reset demo** before each run.

| Step | Click | Say |
|---|---|---|
| 1 | **₹826 payment arrives** | "A payment lands. The Soundbox announces it and asks what was sold." |
| 2 | **बोलिए** and say "do kilo cheeni, ek tel" (or **Use recorded clip**) | "The sale is tagged in the shopkeeper's own words, seconds after the payment. It can never be added later." |
| 3 | **Hold placed on latest payment** | "Days later the payer's money turns out to be stolen. The screen turns red, but only ₹826 is held, and Kavach says so in Hindi." |
| 4 | Answer **नहीं** to both questions, then **मेरे काग़ज़ तैयार कीजिए** | "Two screening questions first. Anyone who lent out their account is sent to legal aid instead." |
| 5 | Scroll the certificate and grievance | "The certificate separates Paytm's records from the merchant's statement. Every rule in the letter shows its source." |
| 6 | **मैंने इसे अपने बैंक में जमा कर दिया है** | "The merchant files it themselves. Kavach never sends anything." |
| 7 | **Simulate day 15** | "No reply by the deadline, so the escalation draft is ready." |

## Without API keys

The demo runs fully offline:

- No `SARVAM_API_KEY`: the mic button is disabled; use **Use recorded clip**. Nothing is spoken aloud.
- No Anthropic credentials: drafts use the fixed wording in `templates/drafts.ts` and are labelled "Standard wording".

## Showing the guardrails

- Answer **हाँ** to either question in step 4 to show the legal-aid referral.
- Wait two minutes after a payment before tagging to show that the window closes.
- `npm test` runs the guardrail tests.
