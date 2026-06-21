-- Phase R6: F1 entity registry — drivers, constructors, career records
-- Public read; writes via service-role scripts only.

-- ---------------------------------------------------------------------------
-- Core identity tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.f1_driver (
  ergast_id text PRIMARY KEY,
  given_name text NOT NULL,
  family_name text NOT NULL,
  code text,
  permanent_number text,
  nationality text,
  date_of_birth date,
  slug text UNIQUE NOT NULL,
  portrait_path text,
  headshot_url text,
  display_name_override text,
  active_season int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS f1_driver_slug_idx ON public.f1_driver (slug);
CREATE INDEX IF NOT EXISTS f1_driver_active_season_idx ON public.f1_driver (active_season);

CREATE TABLE IF NOT EXISTS public.f1_constructor (
  ergast_id text PRIMARY KEY,
  name text NOT NULL,
  nationality text,
  slug text UNIQUE NOT NULL,
  logo_path text,
  team_color_hex text,
  display_name_override text,
  active_season int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS f1_constructor_slug_idx ON public.f1_constructor (slug);
CREATE INDEX IF NOT EXISTS f1_constructor_active_season_idx ON public.f1_constructor (active_season);

-- ---------------------------------------------------------------------------
-- Career totals (scraped + verified offline)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.f1_driver_career (
  ergast_id text PRIMARY KEY REFERENCES public.f1_driver (ergast_id) ON DELETE CASCADE,
  championships int NOT NULL DEFAULT 0,
  championship_years int[] DEFAULT '{}',
  race_starts int,
  race_wins int,
  podiums int,
  pole_positions int,
  fastest_laps int,
  first_gp_year int,
  last_gp_year int,
  best_championship_position int,
  career_points numeric,
  bio_short text,
  notable_records jsonb DEFAULT '[]'::jsonb,
  source_revision text,
  scraped_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.f1_constructor_career (
  ergast_id text PRIMARY KEY REFERENCES public.f1_constructor (ergast_id) ON DELETE CASCADE,
  championships int NOT NULL DEFAULT 0,
  championship_years int[] DEFAULT '{}',
  race_wins int,
  podiums int,
  pole_positions int,
  first_season int,
  last_season int,
  bio_short text,
  notable_records jsonb DEFAULT '[]'::jsonb,
  source_revision text,
  scraped_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse shared function)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'f1_driver_updated_at') THEN
    CREATE TRIGGER f1_driver_updated_at
      BEFORE UPDATE ON public.f1_driver
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'f1_constructor_updated_at') THEN
    CREATE TRIGGER f1_constructor_updated_at
      BEFORE UPDATE ON public.f1_constructor
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'f1_driver_career_updated_at') THEN
    CREATE TRIGGER f1_driver_career_updated_at
      BEFORE UPDATE ON public.f1_driver_career
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'f1_constructor_career_updated_at') THEN
    CREATE TRIGGER f1_constructor_career_updated_at
      BEFORE UPDATE ON public.f1_constructor_career
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Row level security — public read
-- ---------------------------------------------------------------------------

ALTER TABLE public.f1_driver ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f1_constructor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f1_driver_career ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f1_constructor_career ENABLE ROW LEVEL SECURITY;

CREATE POLICY f1_driver_public_read
  ON public.f1_driver
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY f1_constructor_public_read
  ON public.f1_constructor
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY f1_driver_career_public_read
  ON public.f1_driver_career
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY f1_constructor_career_public_read
  ON public.f1_constructor_career
  FOR SELECT
  TO anon, authenticated
  USING (true);
