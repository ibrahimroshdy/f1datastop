-- Create the trivia_scores table
CREATE TABLE IF NOT EXISTS trivia_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  score INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  time_spent INTEGER NOT NULL, -- in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Ensure score is non-negative
  CONSTRAINT positive_score CHECK (score >= 0),
  -- Ensure counts are valid
  CONSTRAINT valid_answers CHECK (correct_answers <= total_questions),
  CONSTRAINT positive_questions CHECK (total_questions > 0),
  CONSTRAINT positive_time CHECK (time_spent > 0)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS trivia_scores_user_id_idx ON trivia_scores(user_id);
CREATE INDEX IF NOT EXISTS trivia_scores_score_idx ON trivia_scores(score DESC);

-- Create row level security policies
ALTER TABLE trivia_scores ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read any score
CREATE POLICY read_any_score ON trivia_scores 
  FOR SELECT USING (true);

-- Policy to allow users to insert only their own scores
CREATE POLICY insert_own_score ON trivia_scores 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update only their own scores
CREATE POLICY update_own_score ON trivia_scores 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id);

-- Policy to allow users to delete only their own scores
CREATE POLICY delete_own_score ON trivia_scores 
  FOR DELETE TO authenticated 
  USING (auth.uid() = user_id); 