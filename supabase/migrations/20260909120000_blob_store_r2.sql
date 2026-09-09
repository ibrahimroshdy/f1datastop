-- Blob storage moved from Supabase Storage to Cloudflare R2 (analysis/blob_store.py).
-- Public URLs are now composed client-side as VITE_BLOB_HOST/{bucket}/{storage_path};
-- the stored public_url columns are kept as a fallback only.

-- Deep Dive grid/list render a small WebP thumbnail instead of the full PNG.
alter table public.analysis_charts add column if not exists thumb_path text;

-- On-demand chart requests are now per format/theme: bulk runs pre-render only the
-- landscape master + thumbnail; social formats are rendered when a user asks to download.
alter table public.f1_chart_requests add column if not exists format text not null default 'landscape';
alter table public.f1_chart_requests add column if not exists theme  text not null default 'dark';

do $$
declare c record;
begin
  -- replace the old (season, round, session, chart, driver_key) uniqueness with one
  -- that includes format + theme, whatever the auto-generated constraint was named.
  for c in
    select conname from pg_constraint
    where conrelid = 'public.f1_chart_requests'::regclass and contype = 'u'
  loop
    execute format('alter table public.f1_chart_requests drop constraint %I', c.conname);
  end loop;
  alter table public.f1_chart_requests
    add constraint f1_chart_requests_variant_key
    unique (season, round, session, chart, driver_key, format, theme);
end $$;
