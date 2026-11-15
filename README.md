# Kavach

Other tools help a merchant write a letter after the account is frozen. Kavach makes sure the proof already exists before the freeze happens.

The merchant says what was sold as the payment arrives. If that payment is later put on hold after a fraud report, Kavach explains the hold in Hindi, produces a sale certificate from the payment records, and drafts the grievance for the merchant to file at their own bank.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add SARVAM_API_KEY (speech and drafting)
npm run dev
```

Open http://localhost:3000 and follow `demo/script.md`. Without the key the demo still runs, using a recorded clip and fixed-wording drafts.

```bash
npm test          # guardrail and scenario tests
npm run typecheck
```

## Live demo and deploy

The demo runs at https://kavach-demo.onrender.com (`/customer`, `/soundbox`, `/merchant`, `/bank`; `/` is the single-screen fallback). It is on Render's free plan: the first request after 15 idle minutes takes about a minute, and a restart reseeds the synthetic data. Press Reset on the bank screen before a run.

- **CI** (`.github/workflows/ci.yml`): every pull request and push to `main` runs typecheck, lint, tests and a production build.
- **CD:** when that passes on `main`, the workflow calls the Render deploy hook stored in the repository secret `RENDER_DEPLOY_HOOK_URL`. Render's own auto-deploy is off, so a failing build never ships.
- **Service settings** are in `render.yaml`. `SARVAM_API_KEY` is set in the Render dashboard only.

## Layout

| Folder | Holds |
|---|---|
| `backend/` | Append-only sale ledger, holds, eligibility, certificate, tracker |
| `agent/` | Sarvam drafting and the checks every draft must pass |
| `voice/` | Browser recording, Sarvam speech to text and text to speech, item parsing |
| `rules/` | The rules table that all legal references come from |
| `templates/` | Fixed-wording drafts used as fallback |
| `frontend/` | Merchant screen and demo controls |
| `data/` | Synthetic demo data |
| `demo/`, `docs/`, `tests/`, `tasks/` | Demo script, pitch material, tests, plan |

Each folder has a `CLAUDE.md` describing what belongs there.

## Status

This is a hackathon prototype on synthetic data. The entries in `rules/rules.json` came from research notes and are marked unverified until checked against primary sources. Kavach produces drafts, not legal advice, and never files anything.
