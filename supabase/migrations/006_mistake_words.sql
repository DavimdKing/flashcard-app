-- supabase/migrations/006_mistake_words.sql

CREATE TABLE mistake_words (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id    uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, word_id)
);

ALTER TABLE mistake_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own mistake words"
  ON mistake_words FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own mistake words"
  ON mistake_words FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own mistake words"
  ON mistake_words FOR DELETE
  USING (user_id = auth.uid());
