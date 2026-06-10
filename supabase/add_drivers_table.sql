-- Drivers table — run once in the Supabase SQL Editor.
-- Stores driver records managed by BC and admin users.

create table if not exists drivers (
  id           text primary key,
  data         jsonb not null,
  inserted_at  timestamptz default now()
);

alter table drivers enable row level security;
create policy "allow_all" on drivers for all using (true) with check (true);
