-- NOTE: This migration must be run manually in Supabase SQL Editor
-- See supabase/README.md for instructions on how to run migrations

insert into site_settings (id, random_exclusion_days) values (1, 7)
  on conflict (id) do nothing;
