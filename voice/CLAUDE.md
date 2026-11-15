# voice/

Voice sale tagging: the moment-of-sale capture that makes Kavach different. The Soundbox announces a payment and the merchant says what was sold.

## What belongs here

- **Recording** — the browser captures the audio only (MediaRecorder); it does no recognition.
- **Speech to text** — Sarvam transcribes short utterances in Hindi and other Indian languages, including code-mixed speech. Called from a server route; the API key stays server-side.
- **Text to speech** — Sarvam voices the Soundbox announcement and the hold explanation.
- **Item parsing** — turning "do kilo cheeni, ek tel" into structured items (item, quantity, unit) while keeping the raw transcript.
- **Tagging trigger** — the threshold logic that decides when to prompt. Prompt for payments of ₹500 and above. Keep the value configurable.
- **Soundbox simulator** — a stand-in for the device: plays the payment announcement and opens the listening window.
- **Fallbacks** — what happens when the merchant says nothing, speech is unclear, or the shop is noisy (untagged sale, optional quick-tap categories).

## Rules for this folder

- A tag is bound to the transaction at payment time, inside a short window. No back-dated tagging, ever; this is what stops fraudsters manufacturing proof.
- Keep the raw transcript alongside the parsed items so the record is what the merchant actually said.
- Do not capture or store buyer speech or identity. Tag the goods, not the customer.
- Keep the interaction to one short utterance. No typing, no download.
- A missing tag must never block or delay the payment flow.
