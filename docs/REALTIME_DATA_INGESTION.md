# Realtime F1 Data — Direct Ingestion to Supabase

> Goal: sample F1 timing/telemetry **directly** (not via openf1.org) and show it
> live during sessions, ingesting straight into Supabase. Research 2026-06-21.

## TL;DR

- **Jolpica** (api.jolpi.ca/ergast) = our current historical source. Post-session
  only (hours of latency). Keep it for schedule/results/standings/reference.
- **OpenF1** = real-time but its live tier is **paid** and ~3 s behind; it just
  re-serves the official feed. Fine as a fallback.
- **Official F1 SignalR feed** (`livetiming.formula1.com`) = the **direct source**,
  ~100 ms latency, free. Requires a **persistent worker** (edge functions can't hold
  the socket). This is the path to "sample it ourselves + realtime".

## Source comparison

| | Jolpica | OpenF1 | F1 SignalR (direct) |
|---|---|---|---|
| Latency | hours (post-session) | ~3 s | ~100 ms |
| Cost | free | free hist / **paid** live | free |
| Effort | trivial (REST) | moderate (REST/MQTT) | high (persistent worker) |
| Legal | open | official-ish | ⚠️ personal-use grey area |
| Role | schedule/results cache | fallback | **primary live feed** |

## Architecture (recommended)

```
Jolpica (poll daily) ─┐
                      ├─► always-on Worker (Fly.io / Railway) ─► Supabase Postgres ─► Supabase Realtime ─► React client
F1 SignalR (live) ────┘     (connect during sessions only)        (live_* tables)        (broadcast)        (live dashboard)
```

- **Worker** (Node or Python; FastF1's `SignalRClient` is the reference): a small
  long-running service. State machine: idle → (session within ~4 h, from Jolpica
  schedule) → connect SignalR → subscribe topics → decode → batch-upsert → Realtime
  publish → session end → idle. Auto-reconnect; restart on the ~2 h server timeout.
- **Why not an edge function?** Edge/serverless are short-lived and can't hold the
  WebSocket. The worker is the only persistent piece; everything else stays in Supabase.
- **Realtime**: use Supabase **broadcast** for high-frequency (positions/car data
  ~3.7 Hz) and `postgres_changes` for event-driven (race control, lap completions).

## F1 SignalR recipe

1. `OPTIONS /signalr/negotiate?connectionData=[{"name":"Streaming"}]&clientProtocol=1.5`
   → grab `ConnectionToken` + cookies.
2. `wss://livetiming.formula1.com/signalr/connect?...&transport=webSockets&connectionToken=…`
3. Send `{"H":"Streaming","M":"Subscribe","A":[[<topics>]],"I":1}`.

Topics: `TimingData`, `TimingStats`, `TimingAppData`, `Position.z`, `CarData.z`
(throttle/brake/speed/rpm/gear/DRS), `WeatherData`, `TrackStatus`,
`RaceControlMessages`, `DriverList`, `SessionInfo`, `SessionData`, `TopThree`,
`ExtrapolatedClock`, `Heartbeat`. `.z` topics are **base64 + raw zlib deflate**
(`zlib.decompress(b64decode(x), -zlib.MAX_WBITS)`).

## Supabase schema (live_* tables)

`sessions` (cache, from Jolpica), `live_positions`, `live_car_data`,
`live_lap_times`, `live_weather`, `race_control_messages`, `worker_logs`.
Set `REPLICA IDENTITY FULL` + add to `supabase_realtime` publication; RLS public
read, writes service-role only. (Full DDL in the research notes / saved memory.)

## Legality

F1 timing is © FOM; the feed is "personal, non-commercial use" and F1 banned
automated crawlers in 2025. **For a public product, prefer OpenF1 (they carry the
risk) or license from FOM.** Direct SignalR is best for internal/dev/POC.

## Phased plan

1. **Foundation** — schema + worker skeleton + Jolpica schedule polling.
2. **Live ingest** — subscribe topics, decode `.z`, 50 ms batch upserts, session lifecycle.
3. **Frontend** — Supabase Realtime subscriptions → live standings/telemetry/weather/RC ticker.
4. **Deploy** — worker on Fly.io/Railway (persistent, health check, SIGTERM flush).
5. **Fallback** — switch to OpenF1 MQTT if SignalR drops >30 s.

## Decisions needed
- Is live timing must-have (build the worker) or nice-to-have (poll Jolpica / paid OpenF1)?
- Hosting for the worker (Fly.io vs Railway vs VPS) + comfort with the ToS grey area for a public site.
