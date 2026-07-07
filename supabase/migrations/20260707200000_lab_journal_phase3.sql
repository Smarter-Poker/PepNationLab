-- Lab Journal Phase 3 Tables

CREATE TABLE researcher_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_researcher_goals_user_id ON researcher_goals(user_id);

ALTER TABLE researcher_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Researchers can manage their own goals"
  ON researcher_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
