-- ============================================================================
-- BASELINE — shared objects that predate tracked migration history.
-- ============================================================================
-- The original project (profiles, the two shared functions, the auth trigger)
-- was created via the Supabase/Lovable dashboard BEFORE migrations were tracked,
-- so it lives only on the remote project and was never captured as a file.
-- Later migrations (20260620 harden, 20260621 entity registry, 20260624
-- warehouse) all reference these objects, which means a fresh `supabase db reset`
-- on a LOCAL stack fails with "function ... does not exist".
--
-- This file recreates ONLY those shared objects, idempotently:
--   * public.update_updated_at_column()  — generic updated_at trigger fn
--   * public.profiles                     — auth-linked profile row
--   * public.handle_new_user()            — auth.users -> profiles trigger fn
--   * the on_auth_user_created trigger
--
-- Every statement is CREATE OR REPLACE / IF NOT EXISTS, so on the remote project
-- (where these already exist) re-applying is a harmless no-op. It is safe for the
-- user to ship. Earliest timestamp so it runs before every dependant migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger function (referenced by api_cache, entity
-- registry, and the warehouse tables).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user (the app's user profile table).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username   text UNIQUE,
  first_name text,
  last_name  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own ON public.profiles
      FOR SELECT TO authenticated USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own ON public.profiles
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own ON public.profiles
      FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_delete_own'
  ) THEN
    CREATE POLICY profiles_delete_own ON public.profiles
      FOR DELETE TO authenticated USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_updated_at') THEN
    CREATE TRIGGER profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- handle_new_user — inserts a profiles row when an auth user is created.
-- SECURITY DEFINER so the trigger can write under RLS. The harden migration
-- (20260620000000) pins its search_path and revokes RPC EXECUTE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- ============================================================================
-- END baseline.
-- ============================================================================
