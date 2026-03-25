-- NOTE: This migration must be run manually in Supabase SQL Editor
-- See supabase/README.md for instructions on how to run migrations

-- Enable RLS on all tables
alter table words enable row level security;
alter table daily_sets enable row level security;
alter table daily_set_words enable row level security;
alter table users enable row level security;
alter table user_progress enable row level security;
alter table site_settings enable row level security;

-- words: authenticated users can read; service-role handles writes
create policy "words_read" on words for select to authenticated using (true);

-- daily_sets: authenticated users can read
create policy "daily_sets_read" on daily_sets for select to authenticated using (true);

-- daily_set_words: authenticated users can read
create policy "daily_set_words_read" on daily_set_words for select to authenticated using (true);

-- users: user reads own row; service-role reads all
create policy "users_read_own" on users for select to authenticated
  using (id = auth.uid());

-- user_progress: user reads and writes own rows
create policy "progress_read_own" on user_progress for select to authenticated
  using (user_id = auth.uid());
create policy "progress_write_own" on user_progress for insert to authenticated
  with check (user_id = auth.uid());
create policy "progress_update_own" on user_progress for update to authenticated
  using (user_id = auth.uid());
