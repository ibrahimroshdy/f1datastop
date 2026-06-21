-- Phase R6: profile views joining identity + career tables

CREATE OR REPLACE VIEW public.f1_driver_profile AS
SELECT
  d.ergast_id,
  d.given_name,
  d.family_name,
  d.code,
  d.permanent_number,
  d.nationality,
  d.date_of_birth,
  d.slug,
  d.portrait_path,
  d.headshot_url,
  COALESCE(d.display_name_override, d.given_name || ' ' || d.family_name) AS display_name,
  d.active_season,
  c.championships,
  c.championship_years,
  c.race_starts,
  c.race_wins,
  c.podiums,
  c.pole_positions,
  c.fastest_laps,
  c.first_gp_year,
  c.last_gp_year,
  c.best_championship_position,
  c.career_points,
  c.bio_short,
  c.notable_records,
  c.scraped_at,
  d.created_at,
  d.updated_at
FROM public.f1_driver d
LEFT JOIN public.f1_driver_career c ON c.ergast_id = d.ergast_id;

CREATE OR REPLACE VIEW public.f1_constructor_profile AS
SELECT
  cstr.ergast_id,
  cstr.name,
  cstr.nationality,
  cstr.slug,
  cstr.logo_path,
  cstr.team_color_hex,
  COALESCE(cstr.display_name_override, cstr.name) AS display_name,
  cstr.active_season,
  c.championships,
  c.championship_years,
  c.race_wins,
  c.podiums,
  c.pole_positions,
  c.first_season,
  c.last_season,
  c.bio_short,
  c.notable_records,
  c.scraped_at,
  cstr.created_at,
  cstr.updated_at
FROM public.f1_constructor cstr
LEFT JOIN public.f1_constructor_career c ON c.ergast_id = cstr.ergast_id;

-- Views inherit underlying table RLS when security_invoker is default;
-- grant SELECT explicitly for anon/authenticated.
GRANT SELECT ON public.f1_driver_profile TO anon, authenticated;
GRANT SELECT ON public.f1_constructor_profile TO anon, authenticated;
