-- Remove public access to trivia_scores (which exposed user_id)
DROP POLICY IF EXISTS read_scores ON public.trivia_scores;

-- Create a public leaderboard view that excludes user_id
CREATE OR REPLACE VIEW public.public_leaderboard
WITH (security_invoker = true) AS
SELECT
  id,
  username,
  score,
  correct_answers,
  total_questions,
  time_spent,
  game_mode,
  created_at,
  updated_at
FROM public.trivia_scores
WHERE is_public = true;

GRANT SELECT ON public.public_leaderboard TO anon, authenticated;

-- Re-add a policy so the view (running as invoker) can read public rows
CREATE POLICY read_public_scores
ON public.trivia_scores
FOR SELECT
TO anon, authenticated
USING (is_public = true OR auth.uid() = user_id);