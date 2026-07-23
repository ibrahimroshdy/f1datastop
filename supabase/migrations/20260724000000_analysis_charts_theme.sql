-- Theme variants for Deep Dive charts.
--
-- generate.py now renders each chart in three colour themes — dark, light and glass
-- (a transparent PNG for the frosted glass card) — so the frontend can serve the one
-- matching the viewer's theme. The chart's identity (season, round, session, chart_type)
-- is unchanged; theme is a new axis, so it joins the unique key.
--
-- Every existing row was rendered dark, so the column defaults to 'dark' and the backfill
-- is implicit — nothing needs re-uploading for the dark theme to keep working.

alter table public.analysis_charts
  add column if not exists theme text not null default 'dark';

alter table public.analysis_charts
  drop constraint if exists analysis_charts_season_round_session_chart_type_key;

alter table public.analysis_charts
  add constraint analysis_charts_season_round_session_chart_type_theme_key
  unique (season, round, session, chart_type, theme);

comment on column public.analysis_charts.theme is
  'Colour theme this render targets: dark | light | glass. The frontend picks it from the viewer''s theme (glass and dark both come from the app''s dark base).';
