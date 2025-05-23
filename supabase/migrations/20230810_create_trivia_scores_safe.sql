-- Safe Trivia Scores Migration (No DROP operations)
-- Enable the uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the trivia_scores table
CREATE TABLE IF NOT EXISTS trivia_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 1,
  time_spent INTEGER NOT NULL DEFAULT 1, -- in seconds
  game_mode TEXT NOT NULL DEFAULT 'normal', -- 'normal' or 'destructive'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Ensure score is non-negative
  CONSTRAINT positive_score CHECK (score >= 0),
  -- Ensure counts are valid
  CONSTRAINT valid_answers CHECK (correct_answers <= total_questions),
  CONSTRAINT positive_questions CHECK (total_questions > 0),
  CONSTRAINT positive_time CHECK (time_spent > 0),
  -- Ensure valid game mode
  CONSTRAINT valid_game_mode CHECK (game_mode IN ('normal', 'destructive'))
);

-- Add indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS trivia_scores_user_id_idx ON trivia_scores(user_id);
CREATE INDEX IF NOT EXISTS trivia_scores_score_idx ON trivia_scores(score DESC);
CREATE INDEX IF NOT EXISTS trivia_scores_created_at_idx ON trivia_scores(created_at DESC);
CREATE INDEX IF NOT EXISTS trivia_scores_game_mode_idx ON trivia_scores(game_mode);

-- Create function to update updated_at timestamp (replace if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_trivia_scores_updated_at') THEN
        CREATE TRIGGER update_trivia_scores_updated_at 
            BEFORE UPDATE ON trivia_scores 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Enable row level security
ALTER TABLE trivia_scores ENABLE ROW LEVEL SECURITY;

-- Create policies (only if they don't exist)
DO $$
BEGIN
    -- Policy to allow users to read any score (for leaderboard)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_any_score' AND tablename = 'trivia_scores') THEN
        CREATE POLICY read_any_score ON trivia_scores 
          FOR SELECT 
          USING (true);
    END IF;

    -- Policy to allow authenticated users to insert only their own scores
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'insert_own_score' AND tablename = 'trivia_scores') THEN
        CREATE POLICY insert_own_score ON trivia_scores 
          FOR INSERT 
          TO authenticated 
          WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Policy to allow users to update only their own scores
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'update_own_score' AND tablename = 'trivia_scores') THEN
        CREATE POLICY update_own_score ON trivia_scores 
          FOR UPDATE 
          TO authenticated 
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Policy to allow users to delete only their own scores
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delete_own_score' AND tablename = 'trivia_scores') THEN
        CREATE POLICY delete_own_score ON trivia_scores 
          FOR DELETE 
          TO authenticated 
          USING (auth.uid() = user_id);
    END IF;
END $$; 