import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, DownloadCloud, Loader2 } from "lucide-react";
import {
  getAnalysisCharts,
  baseChartType,
  chartFormatOf,
  type AnalysisChart,
  type ChartFormat,
} from "@/services/analysisService";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  F1Card,
  F1CardContent,
  F1EmptyState,
  F1Skeleton,
  ChartSkeleton,
} from "@/components/f1";
import { useThemeVariant } from "@/hooks/useThemeVariant";

interface AnalysisChartsProps {
  year: number;
  round: string;
  session?: string;
}

// Social export formats — label, aspect hint, and grid density tuned to the
// variant's shape (wide 16:9 → few columns; tall 9:16 story → many columns).
const FORMATS: Record<
  ChartFormat,
  { label: string; grid: string; aspect: string }
> = {
  landscape: { label: "Landscape · 16:9", grid: "grid-cols-1 lg:grid-cols-2", aspect: "16 / 9" },
  twitter: { label: "Twitter · 16:9", grid: "grid-cols-1 lg:grid-cols-2", aspect: "16 / 9" },
  instagram: { label: "Instagram · 1:1", grid: "grid-cols-2 lg:grid-cols-3", aspect: "1 / 1" },
  story: { label: "Story · 9:16", grid: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", aspect: "9 / 16" },
};
const FORMAT_ORDER: ChartFormat[] = ["landscape", "twitter", "instagram", "story"];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Fetch a cross-origin image as a blob and save it (the `download` attribute is
 *  ignored for cross-origin URLs, so a plain <a download> only opens a tab). */
async function saveImage(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function ChartImage({ src, alt, aspect }: { src: string; alt: string; aspect: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="relative overflow-hidden rounded-md border border-border bg-muted/20"
      style={{ aspectRatio: aspect }}
    >
      {!loaded ? (
        <div className="absolute inset-0">
          <F1Skeleton className="h-full w-full rounded-none" />
        </div>
      ) : null}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}

export default function AnalysisCharts({ year, round, session = "R" }: AnalysisChartsProps) {
  const r = parseInt(round, 10);
  const { cardVariant, glassVariant } = useThemeVariant();
  const [format, setFormat] = useState<ChartFormat>("landscape");
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["analysisCharts", year, r, session],
    queryFn: () => getAnalysisCharts(year, r, session),
    staleTime: 60 * 60 * 1000,
    enabled: !!year && !!r,
  });

  // Group every variant by base chart type, then pick the selected format for
  // each (falling back to the landscape variant if a format is missing).
  const { charts, formatsAvailable } = useMemo(() => {
    const rows = data ?? [];
    const groups = new Map<string, Partial<Record<ChartFormat, AnalysisChart>>>();
    const order: string[] = [];
    const available = new Set<ChartFormat>();
    for (const row of rows) {
      const base = baseChartType(row.chart_type);
      const fmt = chartFormatOf(row.chart_type);
      available.add(fmt);
      if (!groups.has(base)) {
        groups.set(base, {});
        order.push(base);
      }
      groups.get(base)![fmt] = row;
    }
    const picked = order
      .map((base) => {
        const g = groups.get(base)!;
        return g[format] ?? g.landscape ?? null;
      })
      .filter((c): c is AnalysisChart => c !== null);
    return { charts: picked, formatsAvailable: available };
  }, [data, format]);

  const downloadAll = async () => {
    if (!charts.length || downloadingAll) return;
    setDownloadingAll(true);
    for (const c of charts) {
      try {
        await saveImage(c.public_url, `${year}-r${r}-${slugify(c.title)}-${format}.png`);
      } catch {
        /* skip failures, keep going */
      }
    }
    setDownloadingAll(false);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 px-4 pb-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartSkeleton key={i} height={220} />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <F1EmptyState
        type="no-data"
        title="No deep-dive charts yet"
        description="Advanced telemetry & strategy charts are generated automatically after each race weekend."
        className="min-h-[300px]"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      {/* Controls: social format + download all */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="instrument-label text-muted-foreground">
          {charts.length} chart{charts.length === 1 ? "" : "s"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {/* format picker — segmented buttons (one tap, all formats visible) */}
          <div className="flex flex-wrap gap-1" role="group" aria-label="Export format">
            {FORMAT_ORDER.filter((f) => formatsAvailable.has(f)).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
                className={cn(
                  "min-h-9 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  format === f
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {FORMATS[f].label.split("·")[0].trim()}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            className="min-h-11 gap-1.5"
            onClick={downloadAll}
            disabled={downloadingAll}
          >
            {downloadingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DownloadCloud className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {downloadingAll ? "Downloading…" : "Download all"}
            </span>
          </Button>
        </div>
      </div>

      <div className={`grid gap-4 ${FORMATS[format].grid}`}>
        {charts.map((c) => (
          <F1Card key={c.id} variant={cardVariant} glassVariant={glassVariant} size="sm">
            <F1CardContent className="flex flex-col gap-2.5">
              <ChartImage src={c.public_url} alt={c.title} aspect={FORMATS[format].aspect} />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.title}</p>
                  {c.description ? (
                    <p className="truncate text-xs text-muted-foreground">{c.description}</p>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  className="h-11 w-11 shrink-0 p-0"
                  onClick={() => saveImage(c.public_url, `${year}-r${r}-${slugify(c.title)}-${format}.png`)}
                  aria-label={`Download ${c.title}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </F1CardContent>
          </F1Card>
        ))}
      </div>
    </div>
  );
}
