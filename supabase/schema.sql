-- Run this in Supabase SQL Editor for PopValue profile-backed collections.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  username text,
  collection_public boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists username text,
  add column if not exists collection_public boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public profile avatars are readable" on storage.objects;
create policy "Public profile avatars are readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'profile-avatars');

drop policy if exists "Users can upload their own profile avatars" on storage.objects;
create policy "Users can upload their own profile avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own profile avatars" on storage.objects;
create policy "Users can delete their own profile avatars"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (username is null or username ~ '^[a-z0-9][a-z0-9_-]{2,29}$');
  end if;
end;
$$;

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Anyone can read public profiles" on public.profiles;
create policy "Anyone can read public profiles"
  on public.profiles
  for select
  to anon, authenticated
  using (collection_public = true and username is not null);

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

drop policy if exists "Anyone can read public collections" on public.collection_entries;
create policy "Anyone can read public collections"
  on public.collection_entries
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = collection_entries.user_id
        and profiles.collection_public = true
        and profiles.username is not null
    )
  );

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
