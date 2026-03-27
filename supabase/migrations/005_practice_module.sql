-- supabase/migrations/005_practice_module.sql

-- 1. practice_groups
CREATE TABLE practice_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  icon       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE practice_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read active practice groups"
  ON practice_groups FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- 2. practice_group_words
CREATE TABLE practice_group_words (
  group_id uuid NOT NULL REFERENCES practice_groups(id) ON DELETE CASCADE,
  word_id  uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  position int  NOT NULL CHECK (position BETWEEN 1 AND 20),
  PRIMARY KEY (group_id, word_id)
);

ALTER TABLE practice_group_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read practice group words"
  ON practice_group_words FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. practice_sessions
CREATE TABLE practice_sessions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id  uuid REFERENCES practice_groups(id) ON DELETE SET NULL,
  score_pct int  NOT NULL CHECK (score_pct BETWEEN 0 AND 100),
  played_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own practice sessions"
  ON practice_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own practice sessions"
  ON practice_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 4. RPC: best scores per group for a user
CREATE OR REPLACE FUNCTION get_user_practice_best_scores(p_user_id uuid)
RETURNS TABLE(group_id uuid, best_score int)
LANGUAGE sql STABLE AS $$
  SELECT group_id, MAX(score_pct)::int AS best_score
  FROM practice_sessions
  WHERE user_id = p_user_id
    AND group_id IS NOT NULL
  GROUP BY group_id;
$$;

-- 5. RPC: atomic word replacement (avoids race window with zero words)
CREATE OR REPLACE FUNCTION replace_practice_group_words(
  p_group_id  uuid,
  p_name      text,
  p_icon      text,
  p_is_active boolean,
  p_word_ids  uuid[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE practice_groups
     SET name = p_name, icon = p_icon, is_active = p_is_active
   WHERE id = p_group_id;

  DELETE FROM practice_group_words WHERE group_id = p_group_id;

  INSERT INTO practice_group_words (group_id, word_id, position)
  SELECT p_group_id, unnest(p_word_ids), generate_subscripts(p_word_ids, 1);
END;
$$;
