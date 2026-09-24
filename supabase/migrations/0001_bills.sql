-- Bills: one row per uploaded bill. The extracted JSON lives in `data`; a few columns are
-- copied out for sorting and grouping.
create table public.bills (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null,
  account_no text not null,
  bill_date date not null,
  data jsonb not null,
  extracted_by text not null,
  pdf_path text,
  created_at timestamptz not null default now()
);

create index bills_user_date on public.bills (user_id, bill_date);

alter table public.bills enable row level security;

create policy "own bills" on public.bills
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private bucket for the original PDFs, stored under <user_id>/<bill_id>.pdf.
insert into storage.buckets (id, name, public) values ('bills', 'bills', false);

create policy "own bill pdfs" on storage.objects
  for all using (bucket_id = 'bills' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'bills' and (storage.foldername(name))[1] = auth.uid()::text);
