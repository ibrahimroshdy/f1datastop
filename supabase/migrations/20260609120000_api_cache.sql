-- Phase 4.1 / 4.5: server-side F1 API cache + request metrics

CREATE TABLE IF NOT EXISTS public.api_cache (
  cache_key text PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('ergast', 'openf1')),
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_cache_expires_at_idx ON public.api_cache (expires_at);
CREATE INDEX IF NOT EXISTS api_cache_source_idx ON public.api_cache (source);

ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;

-- Public read of non-expired rows (debugging / optional direct reads)
CREATE POLICY api_cache_public_read
  ON public.api_cache
  FOR SELECT
  TO anon, authenticated
  USING (expires_at > now());

-- Writes are service-role only (edge functions bypass RLS)

CREATE TABLE IF NOT EXISTS public.api_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  cache_key text,
  cache_hit boolean NOT NULL,
  status_code integer,
  is_rate_limit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_metrics_created_at_idx ON public.api_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS api_metrics_source_idx ON public.api_metrics (source);

ALTER TABLE public.api_metrics ENABLE ROW LEVEL SECURITY;
-- No public policies — metrics are service-role only
