-- Migration: add password_reset_tokens table for the Forgot Password feature.
-- Run once in the Supabase SQL Editor.

create table if not exists password_reset_tokens (
  token       text primary key,
  user_id     uuid references users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);

alter table password_reset_tokens enable row level security;
create policy "allow_all" on password_reset_tokens for all using (true) with check (true);
