-- Run this in Supabase SQL Editor for PopValue profile-backed collections.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create table if not exists public.collection_entries (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  item jsonb not null,
  valuation jsonb not null,
  condition text not null check (condition in ('mint', 'good', 'damaged', 'out of box')),
  notes text not null default '',
  purchase_price numeric,
  saved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists collection_entries_user_saved_at_idx
  on public.collection_entries (user_id, saved_at desc);

alter table public.collection_entries enable row level security;

drop policy if exists "Users can read their own collection" on public.collection_entries;
create policy "Users can read their own collection"
  on public.collection_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own collection" on public.collection_entries;
create policy "Users can insert their own collection"
  on public.collection_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own collection" on public.collection_entries;
create policy "Users can update their own collection"
  on public.collection_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own collection" on public.collection_entries;
create policy "Users can delete their own collection"
  on public.collection_entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists collection_entries_set_updated_at on public.collection_entries;
create trigger collection_entries_set_updated_at
  before update on public.collection_entries
  for each row
  execute function public.set_updated_at();
