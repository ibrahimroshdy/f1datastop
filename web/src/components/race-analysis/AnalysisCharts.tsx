import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, DownloadCloud, Loader2, Rows3, Grid2x2, LayoutGrid } from "lucide-react";
import {
  getAnalysisCharts,
  baseChartType,
  chartFormatOf,
  type AnalysisChart,
  type ChartFormat,
  type ChartTheme,
} from "@/services/analysisService";
import { useTheme } from "@/context/ThemeContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getRequestState, submitChartRequest } from "@/services/chartRequestService";
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

// Layout density, independent of export format — lets a viewer skim a 4-up grid or read
// one big chart at a time. Overrides the format's own column count when set.
type ViewMode = "list" | "grid2" | "grid5";
const VIEWS: Record<ViewMode, { grid: string; icon: typeof Rows3; label: string }> = {
  // "list" is a compact scan — thumbnail + title rows, not full-size charts (see render).
  list: { grid: "", icon: Rows3, label: "Compact list" },
  grid2: { grid: "grid-cols-1 md:grid-cols-2", icon: Grid2x2, label: "2 columns" },
  grid5: { grid: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5", icon: LayoutGrid, label: "Grid" },
};
const VIEW_ORDER: ViewMode[] = ["list", "grid2", "grid5"];

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
  const { theme } = useTheme();
  // Two chart renders only: light for light mode, dark for both dark and glass modes
  // (glass shows the dark chart on its frosted card — the transparent render was dropped).
  const chartTheme: ChartTheme = theme === "light" ? "light" : "dark";
  const [format, setFormat] = useState<ChartFormat>("landscape");
  const [view, setView] = useState<ViewMode>("grid5");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<AnalysisChart | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["analysisCharts", year, r, session, chartTheme],
    queryFn: () => getAnalysisCharts(year, r, session, chartTheme),
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
          {/* view density — list / 2-up / grid. Pure layout, doesn't touch the images. */}
          <div className="flex gap-1" role="group" aria-label="Layout">
            {VIEW_ORDER.map((v) => {
              const Icon = VIEWS[v].icon;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  aria-label={VIEWS[v].label}
                  title={VIEWS[v].label}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-md transition-colors",
                    view === v
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          {/* format picker — only when more than one format is actually stored (bulk runs
              pre-render landscape only; other sizes are rendered on demand at download) */}
          {formatsAvailable.size > 1 && (
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
          )}
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

      {view === "list" ? (
        // Compact scan — hairline rows, small thumbnail + title, quick to skim the whole set.
        <div className="hairline-grid overflow-hidden rounded-lg border border-border">
          {charts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40"
            >
              <img
                src={c.thumb_url ?? c.public_url}
                alt=""
                loading="lazy"
                className="h-10 w-16 shrink-0 rounded border border-border/60 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.title}</p>
                {c.description ? (
                  <p className="truncate text-xs text-muted-foreground">{c.description}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setDownloadTarget(c)}
                aria-label={`Download ${c.title}`}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className={`grid gap-4 ${VIEWS[view].grid}`}>
          {charts.map((c) => (
            <F1Card key={c.id} variant={cardVariant} glassVariant={glassVariant} size="sm">
              <F1CardContent className="flex flex-col gap-2.5">
                <ChartImage src={c.thumb_url ?? c.public_url} alt={c.title} aspect={FORMATS[format].aspect} />
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
                    onClick={() => setDownloadTarget(c)}
                    aria-label={`Download ${c.title}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </F1CardContent>
            </F1Card>
          ))}
        </div>
      )}
      <ChartDownloadDialog
        chart={downloadTarget}
        year={year}
        round={r}
        session={session}
        theme={chartTheme}
        onClose={() => setDownloadTarget(null)}
      />
    </div>
  );
}

// ── Download size picker ──────────────────────────────────────────────────────
// Bulk runs store only the landscape master (+ thumbnail). Other sizes are separate full
// renders, so they're produced on request: enqueue f1_chart_requests → GitHub Actions
// renders exactly that format/theme → we poll and hand the file over. Landscape is instant.

type DlPhase = "idle" | "queued" | "processing" | "done" | "error" | "unauthenticated";

const SIZE_HINT: Record<ChartFormat, string> = {
  landscape: "2560 × 1440 · ready now",
  twitter: "2560 × 1440 · X/Twitter card",
  instagram: "2160 × 2700 · 4:5 post",
  story: "2160 × 3840 · 9:16 story",
};

function ChartDownloadDialog({
  chart, year, round, session, theme, onClose,
}: {
  chart: AnalysisChart | null;
  year: number;
  round: number;
  session: string;
  theme: ChartTheme;
  onClose: () => void;
}) {
  const [fmt, setFmt] = useState<ChartFormat>("landscape");
  const [phase, setPhase] = useState<DlPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  // reset per chart
  useEffect(() => {
    setFmt("landscape");
    setPhase("idle");
    setError(null);
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  }, [chart?.id]);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  if (!chart) return null;
  const filename = (f: ChartFormat) => `${year}-r${round}-${slugify(chart.title)}-${f}.png`;
  // chart_type carries "_format" + an optional "__DRV-DRV" custom-driver key
  const [baseType, driverKey] = baseChartType(chart.chart_type).split("__");
  const codes = driverKey ? driverKey.split("-") : [];

  const finish = async (url: string) => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setPhase("done");
    await saveImage(url, filename(fmt));
    onClose();
  };

  const start = async () => {
    if (fmt === "landscape") {
      await saveImage(chart.public_url, filename("landscape"));
      onClose();
      return;
    }
    setError(null);
    const res = await submitChartRequest(year, round, session, baseType, codes, fmt, theme);
    if (res.status === "done" && res.charts[0]) return finish(res.charts[0].public_url);
    if (res.status === "unauthenticated") return setPhase("unauthenticated");
    if (res.status === "error") { setError(res.error); return setPhase("error"); }
    setPhase(res.status === "processing" ? "processing" : "queued");
    timer.current = window.setInterval(async () => {
      const st = await getRequestState(year, round, session, baseType, codes, fmt, theme);
      if (st.status === "done" && st.charts[0]) return finish(st.charts[0].public_url);
      if (st.status === "error") {
        if (timer.current) window.clearInterval(timer.current);
        timer.current = null;
        setError(st.error);
        setPhase("error");
      } else if (st.status === "processing") setPhase("processing");
    }, 5000);
  };

  const busy = phase === "queued" || phase === "processing";
  return (
    <Dialog open={!!chart} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download · {chart.title}</DialogTitle>
          <DialogDescription>
            Choose a size. Landscape is stored and downloads instantly; the other sizes are
            rendered for you on request and take a few minutes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="radiogroup" aria-label="Size">
          {FORMAT_ORDER.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={fmt === f}
              disabled={busy}
              onClick={() => setFmt(f)}
              className={cn(
                "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                fmt === f ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40",
                busy && "opacity-60",
              )}
            >
              <span className="font-medium">{FORMATS[f].label.split("·")[0].trim()}</span>
              <span className="text-xs text-muted-foreground">{SIZE_HINT[f]}</span>
            </button>
          ))}
        </div>
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {phase === "processing" ? "Rendering your chart…" : "Queued — rendering starts shortly…"} You can keep this open; the file will download when it's ready.
          </p>
        )}
        {phase === "unauthenticated" && (
          <p className="text-sm text-muted-foreground">Sign in to request other sizes. Landscape downloads without an account.</p>
        )}
        {phase === "error" && <p className="text-sm text-destructive">{error ?? "Rendering failed — try again."}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={start} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="ml-1.5">{fmt === "landscape" ? "Download" : busy ? "Rendering" : "Render & download"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
