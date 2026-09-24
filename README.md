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
- **Storage** (`src/lib/store.ts`): Supabase (Postgres, a private Storage bucket, and an email + password login limited to `ALLOWED_EMAIL`) when configured. Otherwise the `.data/` folder on disk, which is git-ignored.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
npm test
```

## Deploy (Vercel + Supabase)

1. Create a Supabase project and run `supabase/migrations/0001_bills.sql` in the SQL editor.
2. In Supabase Authentication → Users, add your user with an email and password (tick auto-confirm). Then under Authentication → Sign In / Providers, turn off new sign-ups.
3. Import this repo into Vercel and set `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `ALLOWED_EMAIL`.

## Privacy

Bills contain names, addresses and account numbers. Never commit real bills: `*.pdf` and `.data/` are git-ignored. Test fixtures are anonymised.
