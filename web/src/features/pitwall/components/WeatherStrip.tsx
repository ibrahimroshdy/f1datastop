import type { LucideIcon } from "lucide-react";
import { CloudRain, Droplets, Gauge, Sun, Thermometer, Wind } from "lucide-react";
import { useDbWeather } from "@/hooks/useWarehouse";

interface Props {
  year: number;
  round: number | null;
  session: string;
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-2.5 py-2">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <div className="instrument-label text-[9px] text-muted-foreground">{label}</div>
        <div className="readout text-sm leading-none">{value}</div>
      </div>
    </div>
  );
}

export function WeatherStrip({ year, round, session }: Props) {
  const { data, isLoading } = useDbWeather(year, round ?? 0, session);
  if (!round) return null;
  if (isLoading) {
    return <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">Loading weather…</div>;
  }
  const rows = (data ?? []) as unknown as Record<string, number | boolean>[];
  if (!rows.length) {
    return <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">No weather data for this session.</div>;
  }
  const avg = (k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0) / rows.length;
  const rain = rows.some((r) => r.rainfall);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <Stat icon={Thermometer} label="Air" value={`${avg("air_temp").toFixed(1)}°C`} />
        <Stat icon={Sun} label="Track" value={`${avg("track_temp").toFixed(1)}°C`} />
        <Stat icon={Droplets} label="Humidity" value={`${Math.round(avg("humidity"))}%`} />
        <Stat icon={Wind} label="Wind" value={`${avg("wind_speed").toFixed(1)} m/s`} />
        <Stat icon={rain ? CloudRain : Gauge} label={rain ? "Rain" : "Pressure"} value={rain ? "Wet" : `${Math.round(avg("pressure"))} mb`} />
      </div>
      <div className="text-2xs text-muted-foreground">Session average across {rows.length} samples.</div>
    </div>
  );
}
