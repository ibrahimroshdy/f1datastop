# Apply Trivia Scores Migration to Supabase

## Option 1: Using Supabase CLI (Recommended)

If you have the Supabase CLI installed:

```bash
# Make sure you're in your project directory
cd /Users/ibrahimroshdy/PycharmProjects/f1datastop

# Apply the migration
supabase db push

# Or if you want to apply just this specific migration
supabase migration up --include-all
```

## Option 2: Using Supabase Dashboard

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to the **SQL Editor** tab
4. Copy and paste the contents of `20230810_create_trivia_scores_safe.sql`
5. Click **Run** to execute the migration

## Option 3: Manual SQL Execution

Copy this SQL and run it in your Supabase SQL editor:

```sql
-- Enable the uuid-ossp extension if not already enabled
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
```

## Verify the Migration

After running the migration, verify it worked by:

1. Check that the table exists:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'trivia_scores';
```

2. Check the table structure:
```sql
\d trivia_scores;
```

3. Test inserting a record (replace with your actual user ID):
```sql
INSERT INTO trivia_scores (user_id, username, score, correct_answers, total_questions, time_spent)
VALUES (auth.uid(), 'Test Player', 50, 5, 10, 120);
```

4. Test the leaderboard query:
```sql
SELECT username, score, correct_answers, total_questions, created_at 
FROM trivia_scores 
ORDER BY score DESC 
LIMIT 10;
```

## Troubleshooting

### Error: "extension uuid-ossp does not exist"
- Make sure you're running this as a superuser or the extension is enabled
- In Supabase dashboard, this should work automatically

### Error: "relation auth.users does not exist"
- Make sure Supabase Auth is properly set up in your project
- Check that you have users in your auth.users table

### RLS Policy Issues
- Make sure your user is authenticated when testing
- Check that `auth.uid()` returns your user ID

### Permission Issues
- Ensure you have the necessary permissions in your Supabase project
- Try running the SQL as the project owner

## Next Steps

Once the migration is successful:

1. The trivia game will automatically start saving scores to the database
2. The leaderboard component will fetch and display scores
3. Users can see both global and personal leaderboards
4. All scores are protected by Row Level Security (RLS) 