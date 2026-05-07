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
  status      text not null default 'active', -- 'active' | 'inactive'
  created_at  timestamptz default now()
);

-- Row Level Security
alter table road_tests     enable row level security;
alter table uniform_orders enable row level security;
alter table trucks         enable row level security;
alter table injury_reports enable row level security;
alter table users          enable row level security;

-- Allow full access via the anon key (internal tool).
create policy "allow_all" on road_tests     for all using (true) with check (true);
create policy "allow_all" on uniform_orders for all using (true) with check (true);
create policy "allow_all" on trucks         for all using (true) with check (true);
create policy "allow_all" on injury_reports for all using (true) with check (true);
create policy "allow_all" on users          for all using (true) with check (true);

-- Seed master admin user (admin / admin)
insert into users (name, username, password, role, status)
values ('Administrator', 'admin', 'admin', 'admin', 'active')
on conflict (username) do nothing;
