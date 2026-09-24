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

- **Extraction** (`src/lib/extract/`): Claude reads the PDF into a fixed schema (`src/lib/types.ts`). Without an API key, a rule-based parser handles TNB bills only. Names and addresses are never extracted.
- **Tariff engine** (`src/lib/tariffs/tnb.ts`): the TNB domestic tariff from July 2025, including EEI bands, AFA proration, SST above 600 kWh and KWTBB. It reproduces a real bill to the sen (see `tnb.test.ts`).
- **Insights** (`src/lib/insights/`): deterministic rules. RM figures come from code, never from the model.
- **Storage** (`src/lib/store.ts`): Supabase (Postgres, a private Storage bucket, and a magic-link login limited to `ALLOWED_EMAIL`) when configured. Otherwise the `.data/` folder on disk, which is git-ignored.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
npm test
```

## Deploy (Vercel + Supabase)

1. Create a Supabase project and run `supabase/migrations/0001_bills.sql` in the SQL editor.
2. In Supabase Auth → URL configuration, add `https://<your-app>.vercel.app/auth/callback` as a redirect URL.
3. Import this repo into Vercel and set `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `ALLOWED_EMAIL`.

## Privacy

Bills contain names, addresses and account numbers. Never commit real bills: `*.pdf` and `.data/` are git-ignored. Test fixtures are anonymised.
