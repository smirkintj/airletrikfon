# Billsight

A personal portal for your household bills: upload TNB, Air Selangor, Maxis or CelcomDigi PDF bills and get charts and insights. The insights include what the last few kWh above 600 actually cost you, arrears and disconnection warnings, and unusual spikes. You can also ask Claude questions about your bills.

No utility API is involved, because TNB, Air Selangor and the telcos don't offer public ones for customers. Everything comes from the bill PDFs.

## How it works

```
PDF ──► extract ──────────────► bill JSON ──► insights (plain code) ──► dashboard
        Claude (any provider)       │          tariff maths, trends
        or built-in TNB parser      │
                                    └──────► Ask: Claude answers from your bills,
                                              calling the TNB tariff calculator for what-ifs
```

- **Extraction** (`src/lib/extract/`): TNB and Air Selangor bills go through rule-based parsers, which are free, instant and exact. Other layouts, or a known layout the parser can't handle, go to Claude, which reads the PDF into a fixed schema (`src/lib/types.ts`). Line items from Claude are checked against the printed total. Names and addresses are never extracted.
- **Tariff engines** (`src/lib/tariffs/`): the TNB domestic tariff from July 2025 (EEI bands, AFA proration, SST above 600 kWh, KWTBB), matching TNB's printed bills to the sen, and the Air Selangor domestic tariff from September 2025.
- **Insights** (`src/lib/insights/`): deterministic rules. RM figures come from code, never from the model.
- **Storage and login** (`src/lib/store.ts`, `src/lib/auth.ts`, `neon.ts`): on Neon, bills are rows in Postgres, original PDFs go to private buckets (`electricbill`, `waterbill`, `phonebill`), and login is Neon Auth (email + password) limited to `ALLOWED_EMAIL`. Without Neon settings, bills are kept in the git-ignored `.data/` folder with no login, for local use only.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
npm test
```

## Deploy (Vercel + Neon)

1. Provision Neon (needs a Neon login or `NEON_API_KEY`). This creates the auth service and buckets, and writes their settings to `.env.local`:
   ```bash
   neon link --project-id <project-id> --branch production -y
   neon deploy
   ```
2. In Vercel → Project → Settings → Environment Variables, add every value from `.env.local`: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, the four `AWS_*` values, plus `NEON_AUTH_COOKIE_SECRET` (generate with `openssl rand -base64 32`), `ALLOWED_EMAIL` and `ANTHROPIC_API_KEY`. Redeploy.
3. Allow the site in Neon Auth: `neon neon-auth domain add https://<your-app>.vercel.app`
4. Open the site, choose "First time here? Create your account" with the allowed email, then sign in.

## Privacy

Bills contain names, addresses and account numbers. Never commit real bills: `*.pdf` and `.data/` are git-ignored. Test fixtures are anonymised.
