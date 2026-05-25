-- PND Logistics Management — Supabase schema
-- Run this in the Supabase SQL Editor for your project.

-- Road Tests
create table if not exists road_tests (
  id           text primary key,
  data         jsonb not null,
  inserted_at  timestamptz default now()
);

-- Uniform Orders
create table if not exists uniform_orders (
  id           text primary key,
  data         jsonb not null,
  inserted_at  timestamptz default now()
);

-- Fleet / Trucks
create table if not exists trucks (
  id           text primary key,
  data         jsonb not null,
  inserted_at  timestamptz default now()
);

-- Injury Reports
-- Note: attachments are stored as base64 inside the data column.
-- Large files (videos, multiple images) may impact row size.
-- Consider migrating attachments to Supabase Storage for files > 1 MB.
create table if not exists injury_reports (
  id           text primary key,
  data         jsonb not null,
  inserted_at  timestamptz default now()
);

-- Accidents
create table if not exists accidents (
  id           text primary key,
  data         jsonb not null,
  inserted_at  timestamptz default now()
);

-- Hiring Requests
create table if not exists hiring_requests (
  id           text primary key,
  data         jsonb not null,
  inserted_at  timestamptz default now()
);

-- Insurance Requests
create table if not exists insurance_requests (
  id           text primary key,
  data         jsonb not null,
  inserted_at  timestamptz default now()
);

-- DOT Cards
create table if not exists dot_cards (
  id           text primary key,
  data         jsonb not null,
  terminal_id  text references terminals(id),
  inserted_at  timestamptz default now()
);

-- If the table already exists, add terminal_id idempotently
alter table dot_cards add column if not exists terminal_id text references terminals(id);

-- Trigger: auto-populate terminal_id from data->>'terminal_id' on every upsert
create or replace function sync_dot_cards_terminal_id()
returns trigger language plpgsql as $$
begin
  new.terminal_id = new.data->>'terminal_id';
  return new;
end;
$$;

drop trigger if exists trg_dot_cards_terminal_id on dot_cards;
create trigger trg_dot_cards_terminal_id
  before insert or update on dot_cards
  for each row execute function sync_dot_cards_terminal_id();

-- Terminals
create table if not exists terminals (
  id           text primary key,
  data         jsonb not null,
  inserted_at  timestamptz default now()
);

-- Insert default terminals if table is empty
insert into terminals (id, data)
values
  ('fort-worth-761', '{"name":"Fort Worth Terminal - 761","address":"4901 Village Creek Rd, Fort Worth TX 76119","city":"Fort Worth","state":"TX","zip":"76119","manager":"Alexis Rodriguez","phone":"+1 (787) 672-8847","id":"fort-worth-761"}'::jsonb),
  ('nfw-762', '{"name":"North Fort Worth Terminal - 762","address":"2701 Texas Longhorn Way, Fort Worth, TX 76177","city":"Fort Worth","state":"TX","zip":"76177","manager":"Rebeca Davila","phone":"+1 (775) 440-3156","id":"nfw-762"}'::jsonb),
  ('arlington-764', '{"name":"Arlington Terminal - 764","address":"2251 E Bardin Rd, Arlington, TX 76018","city":"Arlington","state":"TX","zip":"76018","manager":"Anthony Tapia","phone":"+1 (920) 866-0324","id":"arlington-764"}'::jsonb),
  ('irving-752', '{"name":"Irving Terminal - 752","address":"3215 Spur 482, Irving, TX 75062","city":"Irving","state":"TX","zip":"75062","manager":"Albert Ochoa","phone":"+1 (972) 966-9619","id":"irving-752"}'::jsonb),
  ('nky-410', '{"name":"North Kentucky Terminal - 410","address":"11000 Toebben Dr, Independence, KY 41051","city":"Independence","state":"KY","zip":"41051","manager":"Carson Lafavers","phone":"+1 (469) 601-1992","id":"nky-410"}'::jsonb),
  ('savannah-314', '{"name":"Savannah Terminal - 314","address":"135 Coleman Blvd, Savannah, GA 31408","city":"Savannah","state":"GA","zip":"31408","manager":"Jeremy Gonzalez","phone":"+1 (786) 302-8160","id":"savannah-314"}'::jsonb)
on conflict (id) do nothing;

-- Users / Authentication
create table if not exists users (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  username    text unique not null,
  password    text not null,
  role        text not null default 'user',   -- 'admin' | 'user'
  terminal    text,
  phone       text,
  email       text,
  fedex_id    text,
  status      text not null default 'active', -- 'active' | 'inactive'
  created_at  timestamptz default now()
);

-- If the table already exists, add the column idempotently
alter table users add column if not exists fedex_id text;

-- Enforce: at most one active user per terminal (NULLs are excluded from the index)
create unique index if not exists users_one_active_per_terminal
  on users (terminal)
  where status = 'active' and terminal is not null;

-- Email List (per-module recipient addresses)
create table if not exists email_list (
  module  text primary key,
  emails  text not null default ''
);

-- Row Level Security
alter table terminals      enable row level security;
alter table road_tests     enable row level security;
alter table uniform_orders enable row level security;
alter table trucks         enable row level security;
alter table injury_reports enable row level security;
alter table accidents          enable row level security;
alter table hiring_requests    enable row level security;
alter table insurance_requests enable row level security;
alter table dot_cards          enable row level security;
alter table users              enable row level security;
alter table email_list         enable row level security;

-- Allow full access via the anon key (internal tool).
create policy "allow_all" on terminals           for all using (true) with check (true);
create policy "allow_all" on road_tests          for all using (true) with check (true);
create policy "allow_all" on uniform_orders      for all using (true) with check (true);
create policy "allow_all" on trucks              for all using (true) with check (true);
create policy "allow_all" on injury_reports      for all using (true) with check (true);
create policy "allow_all" on accidents           for all using (true) with check (true);
create policy "allow_all" on hiring_requests     for all using (true) with check (true);
create policy "allow_all" on insurance_requests  for all using (true) with check (true);
create policy "allow_all" on dot_cards           for all using (true) with check (true);
create policy "allow_all" on users               for all using (true) with check (true);
create policy "allow_all" on email_list          for all using (true) with check (true);

-- Seed master admin user (admin / admin)
insert into users (name, username, password, role, status)
values ('Administrator', 'admin', 'admin', 'admin', 'active')
on conflict (username) do nothing;

-- ───── Storage Bucket Policies ─────
-- Create terminal-pdfs bucket (if not exists)
insert into storage.buckets (id, name, public)
values ('terminal-pdfs', 'terminal-pdfs', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

-- Drop existing policies (if any) to avoid conflicts
drop policy if exists "Allow public upload" on storage.objects;
drop policy if exists "Allow public read" on storage.objects;
drop policy if exists "Allow public delete" on storage.objects;

-- Allow all users (anon + authenticated) to upload to terminal-pdfs
create policy "Allow public upload" on storage.objects
  for insert
  with check (bucket_id = 'terminal-pdfs');

-- Allow all users to update existing objects in terminal-pdfs (required for upsert)
create policy "Allow public update" on storage.objects
  for update
  with check (bucket_id = 'terminal-pdfs');

-- Allow all users to read from terminal-pdfs
create policy "Allow public read" on storage.objects
  for select
  using (bucket_id = 'terminal-pdfs');

-- Allow all users to delete from terminal-pdfs
create policy "Allow public delete" on storage.objects
  for delete
  using (bucket_id = 'terminal-pdfs');

-- ───── dot-cards Storage Bucket ─────
insert into storage.buckets (id, name, public)
values ('dot-cards', 'dot-cards', true)
on conflict (id) do nothing;

create policy "dot_cards_upload" on storage.objects
  for insert
  with check (bucket_id = 'dot-cards');

create policy "dot_cards_update" on storage.objects
  for update
  with check (bucket_id = 'dot-cards');

create policy "dot_cards_read" on storage.objects
  for select
  using (bucket_id = 'dot-cards');

create policy "dot_cards_delete" on storage.objects
  for delete
  using (bucket_id = 'dot-cards');

/*
-- Seed terminals from TERMINAL_DATA
insert into terminals (name, code, fulladdress, address, city, state, zipcode, status, rt_employer_name) values
  ('Fort Worth Terminal',       '761', '4901 Village Creek Rd, Fort Worth TX 76119',    '4901 Village Creek Rd',   'Fort Worth',   'TX', '76119', 'Active', ''),
  ('North Fort Worth Terminal', '762', '2701 Texas Longhorn Way, Fort Worth, TX 76177', '2701 Texas Longhorn Way', 'Fort Worth',   'TX', '76177', 'Active', ''),
  ('Arlington Terminal',        '764', '2251 E Bardin Rd, Arlington, TX 76018',         '2251 E Bardin Rd',        'Arlington',    'TX', '76018', 'Active', ''),
  ('Irving Terminal',           '752', '3215 Spur 482, Irving, TX 75062',               '3215 Spur 482',           'Irving',       'TX', '75062', 'Active', 'PITA CHONG DISTRIBUTION INC.'),
  ('North Kentucky Terminal',   '410', '11000 Toebben Dr, Independence, KY 41051',      '11000 Toebben Dr',        'Independence', 'KY', '41051', 'Active', 'PND KENTUCKY INC'),
  ('Savannah Terminal',         '314', '135 Coleman Blvd, Savannah, GA 31408',          '135 Coleman Blvd',        'Savannah',     'GA', '31408', 'Active', '')
on conflict (code) do nothing;

*/


