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

-- Terminals
create table if not exists terminals (
  id               uuid default gen_random_uuid() primary key,
  name             text not null,
  code             text not null unique,
  fulladdress      text,
  address          text,
  city             text,
  state            text,
  zipcode          text,
  status           text not null default 'Active',   -- 'Active' | 'Inactive'
  rt_employer_name text,
  inserted_at      timestamptz default now()
);

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

-- Row Level Security
alter table terminals      enable row level security;
alter table road_tests     enable row level security;
alter table uniform_orders enable row level security;
alter table trucks         enable row level security;
alter table injury_reports enable row level security;
alter table accidents          enable row level security;
alter table hiring_requests    enable row level security;
alter table insurance_requests enable row level security;
alter table users              enable row level security;

-- Allow full access via the anon key (internal tool).
create policy "allow_all" on terminals           for all using (true) with check (true);
create policy "allow_all" on road_tests          for all using (true) with check (true);
create policy "allow_all" on uniform_orders      for all using (true) with check (true);
create policy "allow_all" on trucks              for all using (true) with check (true);
create policy "allow_all" on injury_reports      for all using (true) with check (true);
create policy "allow_all" on accidents           for all using (true) with check (true);
create policy "allow_all" on hiring_requests     for all using (true) with check (true);
create policy "allow_all" on insurance_requests  for all using (true) with check (true);
create policy "allow_all" on users               for all using (true) with check (true);

-- Seed master admin user (admin / admin)
insert into users (name, username, password, role, status)
values ('Administrator', 'admin', 'admin', 'admin', 'active')
on conflict (username) do nothing;

-- Seed terminals from TERMINAL_DATA
insert into terminals (name, code, fulladdress, address, city, state, zipcode, status, rt_employer_name) values
  ('Fort Worth Terminal',       '761', '4901 Village Creek Rd, Fort Worth TX 76119',    '4901 Village Creek Rd',   'Fort Worth',   'TX', '76119', 'Active', ''),
  ('North Fort Worth Terminal', '762', '2701 Texas Longhorn Way, Fort Worth, TX 76177', '2701 Texas Longhorn Way', 'Fort Worth',   'TX', '76177', 'Active', ''),
  ('Arlington Terminal',        '764', '2251 E Bardin Rd, Arlington, TX 76018',         '2251 E Bardin Rd',        'Arlington',    'TX', '76018', 'Active', ''),
  ('Irving Terminal',           '752', '3215 Spur 482, Irving, TX 75062',               '3215 Spur 482',           'Irving',       'TX', '75062', 'Active', 'PITA CHONG DISTRIBUTION INC.'),
  ('North Kentucky Terminal',   '410', '11000 Toebben Dr, Independence, KY 41051',      '11000 Toebben Dr',        'Independence', 'KY', '41051', 'Active', 'PND KENTUCKY INC'),
  ('Savannah Terminal',         '314', '135 Coleman Blvd, Savannah, GA 31408',          '135 Coleman Blvd',        'Savannah',     'GA', '31408', 'Active', '')
on conflict (code) do nothing;
