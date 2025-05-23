-- Add is_public column to trivia_scores table
-- This allows users to choose whether their scores appear on the public leaderboard

-- Add the is_public column with default value of true for backward compatibility
ALTER TABLE trivia_scores 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- Add index for performance when filtering by is_public
CREATE INDEX IF NOT EXISTS trivia_scores_is_public_idx ON trivia_scores(is_public);

-- Add composite index for efficient leaderboard queries
CREATE INDEX IF NOT EXISTS trivia_scores_public_score_idx ON trivia_scores(is_public, score DESC) WHERE is_public = true;

-- Update the RLS policy for reading scores to allow filtering by is_public
-- Drop the existing read policy and create a new one
DROP POLICY IF EXISTS read_any_score ON trivia_scores;

-- Create new policy that allows reading public scores, or own scores regardless of is_public setting
CREATE POLICY read_scores ON trivia_scores 
  FOR SELECT 
  USING (is_public = true OR auth.uid() = user_id);

-- Create a separate policy for reading own scores (both public and private)
CREATE POLICY read_own_scores ON trivia_scores 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id); 