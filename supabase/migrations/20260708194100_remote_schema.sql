drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";

drop trigger if exists "profiles_updated_at" on "public"."profiles";

drop trigger if exists "f1_circuit_updated_at" on "public"."f1_circuit";

drop trigger if exists "f1_constructor_updated_at" on "public"."f1_constructor";

drop trigger if exists "f1_constructor_career_updated_at" on "public"."f1_constructor_career";

drop trigger if exists "f1_constructor_standing_updated_at" on "public"."f1_constructor_standing";

drop trigger if exists "f1_driver_updated_at" on "public"."f1_driver";

drop trigger if exists "f1_driver_career_updated_at" on "public"."f1_driver_career";

drop trigger if exists "f1_driver_standing_updated_at" on "public"."f1_driver_standing";

drop trigger if exists "f1_qualifying_result_updated_at" on "public"."f1_qualifying_result";

drop trigger if exists "f1_race_updated_at" on "public"."f1_race";

drop trigger if exists "f1_race_result_updated_at" on "public"."f1_race_result";

drop trigger if exists "f1_season_updated_at" on "public"."f1_season";

drop trigger if exists "f1_session_updated_at" on "public"."f1_session";

drop trigger if exists "f1_session_driver_updated_at" on "public"."f1_session_driver";

drop trigger if exists "f1_sprint_result_updated_at" on "public"."f1_sprint_result";

drop trigger if exists "f1_sync_state_updated_at" on "public"."f1_sync_state";

drop policy "profiles_delete_own" on "public"."profiles";

drop policy "profiles_insert_own" on "public"."profiles";

drop policy "profiles_select_own" on "public"."profiles";

drop policy "profiles_update_own" on "public"."profiles";

alter table "public"."f1_constructor_career" drop constraint "f1_constructor_career_ergast_id_fkey";

alter table "public"."f1_constructor_standing" drop constraint "f1_constructor_standing_constructor_id_fkey";

alter table "public"."f1_driver_career" drop constraint "f1_driver_career_ergast_id_fkey";

alter table "public"."f1_driver_standing" drop constraint "f1_driver_standing_constructor_id_fkey";

alter table "public"."f1_driver_standing" drop constraint "f1_driver_standing_driver_id_fkey";

alter table "public"."f1_lap" drop constraint "f1_lap_driver_id_fkey";

alter table "public"."f1_lap" drop constraint "f1_lap_race_id_fkey";

alter table "public"."f1_pit_stop" drop constraint "f1_pit_stop_driver_id_fkey";

alter table "public"."f1_pit_stop" drop constraint "f1_pit_stop_race_id_fkey";

alter table "public"."f1_qualifying_result" drop constraint "f1_qualifying_result_constructor_id_fkey";

alter table "public"."f1_qualifying_result" drop constraint "f1_qualifying_result_driver_id_fkey";

alter table "public"."f1_qualifying_result" drop constraint "f1_qualifying_result_race_id_fkey";

alter table "public"."f1_race" drop constraint "f1_race_circuit_id_fkey";

alter table "public"."f1_race" drop constraint "f1_race_season_fkey";

alter table "public"."f1_race_result" drop constraint "f1_race_result_constructor_id_fkey";

alter table "public"."f1_race_result" drop constraint "f1_race_result_driver_id_fkey";

alter table "public"."f1_race_result" drop constraint "f1_race_result_race_id_fkey";

alter table "public"."f1_session" drop constraint "f1_session_race_id_fkey";

alter table "public"."f1_session_driver" drop constraint "f1_session_driver_ergast_driver_id_fkey";

alter table "public"."f1_sprint_result" drop constraint "f1_sprint_result_constructor_id_fkey";

alter table "public"."f1_sprint_result" drop constraint "f1_sprint_result_driver_id_fkey";

alter table "public"."f1_sprint_result" drop constraint "f1_sprint_result_race_id_fkey";

drop function if exists "public"."_f1_result_obj"(rr f1_race_result);


  create table "public"."analysis_charts" (
    "id" uuid not null default gen_random_uuid(),
    "season" integer not null,
    "round" integer not null,
    "session" text not null default 'R'::text,
    "chart_type" text not null,
    "title" text not null,
    "description" text,
    "storage_path" text not null,
    "public_url" text not null,
    "drivers" text[],
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."analysis_charts" enable row level security;


  create table "public"."push_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "endpoint" text not null,
    "p256dh" text not null,
    "auth" text not null,
    "user_agent" text,
    "topics" text[] default '{race_reminders}'::text[],
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."push_subscriptions" enable row level security;

alter table "public"."profiles" alter column "first_name" set not null;

alter table "public"."profiles" alter column "last_name" set not null;

alter table "public"."profiles" alter column "username" set not null;

CREATE UNIQUE INDEX analysis_charts_pkey ON public.analysis_charts USING btree (id);

CREATE UNIQUE INDEX analysis_charts_season_round_session_chart_type_key ON public.analysis_charts USING btree (season, round, session, chart_type);

CREATE INDEX idx_analysis_charts_race ON public.analysis_charts USING btree (season, round, session);

CREATE INDEX idx_push_subs_user ON public.push_subscriptions USING btree (user_id);

CREATE UNIQUE INDEX push_subscriptions_endpoint_key ON public.push_subscriptions USING btree (endpoint);

CREATE UNIQUE INDEX push_subscriptions_pkey ON public.push_subscriptions USING btree (id);

alter table "public"."analysis_charts" add constraint "analysis_charts_pkey" PRIMARY KEY using index "analysis_charts_pkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY using index "push_subscriptions_pkey";

alter table "public"."analysis_charts" add constraint "analysis_charts_season_round_session_chart_type_key" UNIQUE using index "analysis_charts_season_round_session_chart_type_key";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_endpoint_key" UNIQUE using index "push_subscriptions_endpoint_key";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."push_subscriptions" validate constraint "push_subscriptions_user_id_fkey";

alter table "public"."f1_constructor_career" add constraint "f1_constructor_career_ergast_id_fkey" FOREIGN KEY (ergast_id) REFERENCES public.f1_constructor(ergast_id) ON DELETE CASCADE not valid;

alter table "public"."f1_constructor_career" validate constraint "f1_constructor_career_ergast_id_fkey";

alter table "public"."f1_constructor_standing" add constraint "f1_constructor_standing_constructor_id_fkey" FOREIGN KEY (constructor_id) REFERENCES public.f1_constructor(ergast_id) not valid;

alter table "public"."f1_constructor_standing" validate constraint "f1_constructor_standing_constructor_id_fkey";

alter table "public"."f1_driver_career" add constraint "f1_driver_career_ergast_id_fkey" FOREIGN KEY (ergast_id) REFERENCES public.f1_driver(ergast_id) ON DELETE CASCADE not valid;

alter table "public"."f1_driver_career" validate constraint "f1_driver_career_ergast_id_fkey";

alter table "public"."f1_driver_standing" add constraint "f1_driver_standing_constructor_id_fkey" FOREIGN KEY (constructor_id) REFERENCES public.f1_constructor(ergast_id) not valid;

alter table "public"."f1_driver_standing" validate constraint "f1_driver_standing_constructor_id_fkey";

alter table "public"."f1_driver_standing" add constraint "f1_driver_standing_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.f1_driver(ergast_id) not valid;

alter table "public"."f1_driver_standing" validate constraint "f1_driver_standing_driver_id_fkey";

alter table "public"."f1_lap" add constraint "f1_lap_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.f1_driver(ergast_id) not valid;

alter table "public"."f1_lap" validate constraint "f1_lap_driver_id_fkey";

alter table "public"."f1_lap" add constraint "f1_lap_race_id_fkey" FOREIGN KEY (race_id) REFERENCES public.f1_race(id) ON DELETE CASCADE not valid;

alter table "public"."f1_lap" validate constraint "f1_lap_race_id_fkey";

alter table "public"."f1_pit_stop" add constraint "f1_pit_stop_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.f1_driver(ergast_id) not valid;

alter table "public"."f1_pit_stop" validate constraint "f1_pit_stop_driver_id_fkey";

alter table "public"."f1_pit_stop" add constraint "f1_pit_stop_race_id_fkey" FOREIGN KEY (race_id) REFERENCES public.f1_race(id) ON DELETE CASCADE not valid;

alter table "public"."f1_pit_stop" validate constraint "f1_pit_stop_race_id_fkey";

alter table "public"."f1_qualifying_result" add constraint "f1_qualifying_result_constructor_id_fkey" FOREIGN KEY (constructor_id) REFERENCES public.f1_constructor(ergast_id) not valid;

alter table "public"."f1_qualifying_result" validate constraint "f1_qualifying_result_constructor_id_fkey";

alter table "public"."f1_qualifying_result" add constraint "f1_qualifying_result_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.f1_driver(ergast_id) not valid;

alter table "public"."f1_qualifying_result" validate constraint "f1_qualifying_result_driver_id_fkey";

alter table "public"."f1_qualifying_result" add constraint "f1_qualifying_result_race_id_fkey" FOREIGN KEY (race_id) REFERENCES public.f1_race(id) ON DELETE CASCADE not valid;

alter table "public"."f1_qualifying_result" validate constraint "f1_qualifying_result_race_id_fkey";

alter table "public"."f1_race" add constraint "f1_race_circuit_id_fkey" FOREIGN KEY (circuit_id) REFERENCES public.f1_circuit(circuit_id) not valid;

alter table "public"."f1_race" validate constraint "f1_race_circuit_id_fkey";

alter table "public"."f1_race" add constraint "f1_race_season_fkey" FOREIGN KEY (season) REFERENCES public.f1_season(year) not valid;

alter table "public"."f1_race" validate constraint "f1_race_season_fkey";

alter table "public"."f1_race_result" add constraint "f1_race_result_constructor_id_fkey" FOREIGN KEY (constructor_id) REFERENCES public.f1_constructor(ergast_id) not valid;

alter table "public"."f1_race_result" validate constraint "f1_race_result_constructor_id_fkey";

alter table "public"."f1_race_result" add constraint "f1_race_result_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.f1_driver(ergast_id) not valid;

alter table "public"."f1_race_result" validate constraint "f1_race_result_driver_id_fkey";

alter table "public"."f1_race_result" add constraint "f1_race_result_race_id_fkey" FOREIGN KEY (race_id) REFERENCES public.f1_race(id) ON DELETE CASCADE not valid;

alter table "public"."f1_race_result" validate constraint "f1_race_result_race_id_fkey";

alter table "public"."f1_session" add constraint "f1_session_race_id_fkey" FOREIGN KEY (race_id) REFERENCES public.f1_race(id) ON DELETE CASCADE not valid;

alter table "public"."f1_session" validate constraint "f1_session_race_id_fkey";

alter table "public"."f1_session_driver" add constraint "f1_session_driver_ergast_driver_id_fkey" FOREIGN KEY (ergast_driver_id) REFERENCES public.f1_driver(ergast_id) not valid;

alter table "public"."f1_session_driver" validate constraint "f1_session_driver_ergast_driver_id_fkey";

alter table "public"."f1_sprint_result" add constraint "f1_sprint_result_constructor_id_fkey" FOREIGN KEY (constructor_id) REFERENCES public.f1_constructor(ergast_id) not valid;

alter table "public"."f1_sprint_result" validate constraint "f1_sprint_result_constructor_id_fkey";

alter table "public"."f1_sprint_result" add constraint "f1_sprint_result_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.f1_driver(ergast_id) not valid;

alter table "public"."f1_sprint_result" validate constraint "f1_sprint_result_driver_id_fkey";

alter table "public"."f1_sprint_result" add constraint "f1_sprint_result_race_id_fkey" FOREIGN KEY (race_id) REFERENCES public.f1_race(id) ON DELETE CASCADE not valid;

alter table "public"."f1_sprint_result" validate constraint "f1_sprint_result_race_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._f1_result_obj(rr public.f1_race_result)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'number',       rr.car_number::text,
    'position',     rr.position::text,
    'positionText', rr.position_text,
    'points',       rr.points::text,
    'Driver',       public._f1_driver_obj(rr.driver_id),
    'Constructor',  public._f1_constructor_obj(rr.constructor_id),
    'grid',         rr.grid::text,
    'laps',         rr.laps::text,
    'status',       rr.status,
    'Time',         CASE WHEN rr.time_text IS NOT NULL
                     THEN jsonb_strip_nulls(jsonb_build_object(
                            'millis', rr.time_millis::text,
                            'time',   rr.time_text)) END,
    'FastestLap',   CASE WHEN rr.fastest_lap_number IS NOT NULL
                     THEN jsonb_strip_nulls(jsonb_build_object(
                            'rank', rr.fastest_lap_rank::text,
                            'lap',  rr.fastest_lap_number::text,
                            'Time', jsonb_build_object('time', rr.fastest_lap_time),
                            'AverageSpeed', jsonb_strip_nulls(jsonb_build_object(
                              'units', rr.fastest_lap_speed_units,
                              'speed', rr.fastest_lap_avg_speed::text)))) END
  ));
$function$
;

create or replace view "public"."f1_constructor_profile" as  SELECT cstr.ergast_id,
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
   FROM (public.f1_constructor cstr
     LEFT JOIN public.f1_constructor_career c ON ((c.ergast_id = cstr.ergast_id)));


create or replace view "public"."f1_driver_profile" as  SELECT d.ergast_id,
    d.given_name,
    d.family_name,
    d.code,
    d.permanent_number,
    d.nationality,
    d.date_of_birth,
    d.slug,
    d.portrait_path,
    d.headshot_url,
    COALESCE(d.display_name_override, ((d.given_name || ' '::text) || d.family_name)) AS display_name,
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
   FROM (public.f1_driver d
     LEFT JOIN public.f1_driver_career c ON ((c.ergast_id = d.ergast_id)));


create or replace view "public"."f1_v_schedule" as  SELECT r.season,
    jsonb_agg(jsonb_build_object('season', (r.season)::text, 'round', (r.round)::text, 'raceName', r.race_name, 'date', to_char((r.date)::timestamp with time zone, 'YYYY-MM-DD'::text), 'time', r."time", 'Circuit', jsonb_build_object('circuitId', c.circuit_id, 'circuitName', c.name, 'Location', jsonb_build_object('lat', (c.lat)::text, 'long', (c.lng)::text, 'locality', c.locality, 'country', c.country)), 'sessions', ( SELECT jsonb_object_agg(s.session_type, jsonb_build_object('date', to_char((s.scheduled_date)::timestamp with time zone, 'YYYY-MM-DD'::text), 'time', s.scheduled_time)) AS jsonb_object_agg
           FROM public.f1_session s
          WHERE (s.race_id = r.id))) ORDER BY r.round) AS races
   FROM (public.f1_race r
     LEFT JOIN public.f1_circuit c ON ((c.circuit_id = r.circuit_id)))
  GROUP BY r.season;


CREATE OR REPLACE FUNCTION public.get_lap_positions(p_season integer, p_round integer, p_session text DEFAULT 'R'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(l) order by l.lap_number, l.position), '[]'::jsonb)
  from (
    select lap_number, driver_id, position, time_text, time_millis
    from public.f1_lap
    where season = p_season and round = p_round and session_type = p_session
  ) l;
$function$
;

CREATE OR REPLACE FUNCTION public.get_laps(p_season integer, p_round integer, p_session text DEFAULT 'R'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'Races',
    jsonb_build_array(
      jsonb_build_object(
        'season', p_season::text,
        'round', p_round::text,
        'Laps', coalesce((
          select jsonb_agg(lap_obj order by lap_num)
          from (
            select l.lap_number as lap_num,
                   jsonb_build_object(
                     'number', l.lap_number::text,
                     'Timings', jsonb_agg(
                       jsonb_build_object(
                         'driverId', l.driver_id,
                         'position', l.position::text,
                         'time', l.time_text
                       ) order by l.position
                     )
                   ) as lap_obj
            from public.f1_lap l
            where l.season = p_season and l.round = p_round and l.session_type = p_session
            group by l.lap_number
          ) x
        ), '[]'::jsonb)
      )
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_overtakes(p_season integer, p_round integer, p_session text DEFAULT 'R'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(o) order by o.lap_number, o.position), '[]'::jsonb)
  from (
    select lap_number, overtaking_driver_id, overtaken_driver_id, position
    from public.f1_overtake
    where season = p_season and round = p_round and session_type = p_session
  ) o;
$function$
;

CREATE OR REPLACE FUNCTION public.get_race_control(p_season integer, p_round integer, p_session text DEFAULT 'R'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.time_utc), '[]'::jsonb)
  from (
    select time_utc, lap_number, category, message, flag, scope, sector, driver_number
    from public.f1_race_control
    where season = p_season and round = p_round and session_type = p_session
  ) r;
$function$
;

CREATE OR REPLACE FUNCTION public.get_sessions(p_season integer, p_round integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.round, s.date_start), '[]'::jsonb)
  from (
    select season, round, session_type, session_name, date_start, date_end
    from public.f1_session
    where season = p_season and (p_round is null or round = p_round)
  ) s;
$function$
;

CREATE OR REPLACE FUNCTION public.get_telemetry_index(p_season integer, p_round integer, p_session text DEFAULT 'R'::text)
 RETURNS SETOF public.f1_telemetry_index
 LANGUAGE sql
 STABLE
AS $function$
  select * from public.f1_telemetry_index
  where season = p_season and round = p_round and session = p_session
  order by top_speed desc nulls last, driver_code;
$function$
;

CREATE OR REPLACE FUNCTION public.get_weather(p_season integer, p_round integer, p_session text DEFAULT 'R'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(w) order by w.time_seconds), '[]'::jsonb)
  from (
    select time_seconds, air_temp, track_temp, humidity, pressure,
           wind_speed, wind_direction, rainfall
    from public.f1_weather
    where season = p_season and round = p_round and session_type = p_session
  ) w;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, first_name, last_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)), 
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''), 
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."analysis_charts" to "anon";

grant insert on table "public"."analysis_charts" to "anon";

grant references on table "public"."analysis_charts" to "anon";

grant select on table "public"."analysis_charts" to "anon";

grant trigger on table "public"."analysis_charts" to "anon";

grant truncate on table "public"."analysis_charts" to "anon";

grant update on table "public"."analysis_charts" to "anon";

grant delete on table "public"."analysis_charts" to "authenticated";

grant insert on table "public"."analysis_charts" to "authenticated";

grant references on table "public"."analysis_charts" to "authenticated";

grant select on table "public"."analysis_charts" to "authenticated";

grant trigger on table "public"."analysis_charts" to "authenticated";

grant truncate on table "public"."analysis_charts" to "authenticated";

grant update on table "public"."analysis_charts" to "authenticated";

grant delete on table "public"."analysis_charts" to "service_role";

grant insert on table "public"."analysis_charts" to "service_role";

grant references on table "public"."analysis_charts" to "service_role";

grant select on table "public"."analysis_charts" to "service_role";

grant trigger on table "public"."analysis_charts" to "service_role";

grant truncate on table "public"."analysis_charts" to "service_role";

grant update on table "public"."analysis_charts" to "service_role";

grant delete on table "public"."push_subscriptions" to "anon";

grant insert on table "public"."push_subscriptions" to "anon";

grant references on table "public"."push_subscriptions" to "anon";

grant select on table "public"."push_subscriptions" to "anon";

grant trigger on table "public"."push_subscriptions" to "anon";

grant truncate on table "public"."push_subscriptions" to "anon";

grant update on table "public"."push_subscriptions" to "anon";

grant delete on table "public"."push_subscriptions" to "authenticated";

grant insert on table "public"."push_subscriptions" to "authenticated";

grant references on table "public"."push_subscriptions" to "authenticated";

grant select on table "public"."push_subscriptions" to "authenticated";

grant trigger on table "public"."push_subscriptions" to "authenticated";

grant truncate on table "public"."push_subscriptions" to "authenticated";

grant update on table "public"."push_subscriptions" to "authenticated";

grant delete on table "public"."push_subscriptions" to "service_role";

grant insert on table "public"."push_subscriptions" to "service_role";

grant references on table "public"."push_subscriptions" to "service_role";

grant select on table "public"."push_subscriptions" to "service_role";

grant trigger on table "public"."push_subscriptions" to "service_role";

grant truncate on table "public"."push_subscriptions" to "service_role";

grant update on table "public"."push_subscriptions" to "service_role";


  create policy "analysis_charts_public_read"
  on "public"."analysis_charts"
  as permissive
  for select
  to public
using (true);



  create policy "Users can delete their own profile"
  on "public"."profiles"
  as permissive
  for delete
  to public
using ((auth.uid() = id));



  create policy "Users can insert their own profile"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "Users can update their own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Users can view their own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.uid() = id));



  create policy "push_subs_delete_own"
  on "public"."push_subscriptions"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "push_subs_select_own"
  on "public"."push_subscriptions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));


CREATE TRIGGER f1_circuit_updated_at BEFORE UPDATE ON public.f1_circuit FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_constructor_updated_at BEFORE UPDATE ON public.f1_constructor FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_constructor_career_updated_at BEFORE UPDATE ON public.f1_constructor_career FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_constructor_standing_updated_at BEFORE UPDATE ON public.f1_constructor_standing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_driver_updated_at BEFORE UPDATE ON public.f1_driver FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_driver_career_updated_at BEFORE UPDATE ON public.f1_driver_career FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_driver_standing_updated_at BEFORE UPDATE ON public.f1_driver_standing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_qualifying_result_updated_at BEFORE UPDATE ON public.f1_qualifying_result FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_race_updated_at BEFORE UPDATE ON public.f1_race FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_race_result_updated_at BEFORE UPDATE ON public.f1_race_result FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_season_updated_at BEFORE UPDATE ON public.f1_season FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_session_updated_at BEFORE UPDATE ON public.f1_session FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_session_driver_updated_at BEFORE UPDATE ON public.f1_session_driver FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_sprint_result_updated_at BEFORE UPDATE ON public.f1_sprint_result FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER f1_sync_state_updated_at BEFORE UPDATE ON public.f1_sync_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

drop trigger if exists "on_auth_user_created" on "auth"."users";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "charts_public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'charts'::text));



