-- supabase/migrations/003_add_word_examples.sql
ALTER TABLE words
  ADD COLUMN IF NOT EXISTS part_of_speech  text,
  ADD COLUMN IF NOT EXISTS english_example text,
  ADD COLUMN IF NOT EXISTS thai_example    text;

-- Allow image_url to be null (needed for bulk-imported words without images)
ALTER TABLE words
  ALTER COLUMN image_url DROP NOT NULL;
