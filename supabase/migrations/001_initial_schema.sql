-- NOTE: This migration must be run manually in Supabase SQL Editor
-- See supabase/README.md for instructions on how to run migrations

-- Enable moddatetime extension for updated_at triggers
create extension if not exists moddatetime schema extensions;

-- words
create table words (
  id uuid primary key default gen_random_uuid(),
  english_word text not null,
  thai_translation text not null,
  image_url text not null,
  audio_url text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger handle_updated_at before update on words
  for each row execute procedure extensions.moddatetime(updated_at);

-- daily_sets
create table daily_sets (
  id uuid primary key default gen_random_uuid(),
  set_date date not null unique,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- daily_set_words
create table daily_set_words (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references daily_sets(id) on delete cascade,
  word_id uuid not null references words(id) on delete restrict,
  position integer not null check (position between 1 and 10),
  unique (set_id, position),
  unique (set_id, word_id)
);

-- users
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  oauth_provider text not null,
  is_approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- user_progress
create table user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  set_id uuid not null references daily_sets(id) on delete cascade,
  word_id uuid not null references words(id) on delete restrict,
  result text not null check (result in ('got_it', 'nope')),
  played_at timestamptz not null default now(),
  unique (user_id, set_id, word_id)
);

create index user_progress_user_set_idx on user_progress(user_id, set_id);

-- site_settings
create table site_settings (
  id integer primary key check (id = 1),
  random_exclusion_days integer not null default 7
    check (random_exclusion_days between 1 and 60)
);
