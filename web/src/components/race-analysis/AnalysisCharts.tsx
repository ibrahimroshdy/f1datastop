import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, DownloadCloud, Loader2 } from "lucide-react";
import { getAnalysisCharts } from "@/services/analysisService";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type ChartSize = "s" | "m" | "l";

// Display size → grid columns. Fewer columns = larger images.
const SIZE_GRID: Record<ChartSize, string> = {
  s: "grid-cols-2 xl:grid-cols-3",
  m: "grid-cols-1 md:grid-cols-2",
  l: "grid-cols-1",
};

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

function ChartImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-md border border-border">
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
        className="w-full"
      />
    </div>
  );
}

export default function AnalysisCharts({ year, round, session = "R" }: AnalysisChartsProps) {
  const r = parseInt(round, 10);
  const { cardVariant, glassVariant } = useThemeVariant();
  const [size, setSize] = useState<ChartSize>("m");
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["analysisCharts", year, r, session],
    queryFn: () => getAnalysisCharts(year, r, session),
    staleTime: 60 * 60 * 1000,
    enabled: !!year && !!r,
  });

  const downloadAll = async () => {
    if (!data || downloadingAll) return;
    setDownloadingAll(true);
    for (const c of data) {
      try {
        await saveImage(c.public_url, `${year}-r${r}-${slugify(c.title)}.png`);
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
      {/* Controls: image size + download all */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="instrument-label text-muted-foreground">
          {data.length} chart{data.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Select value={size} onValueChange={(v) => setSize(v as ChartSize)}>
            <SelectTrigger className="h-10 w-[120px]" aria-label="Image size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="s">Small</SelectItem>
              <SelectItem value="m">Medium</SelectItem>
              <SelectItem value="l">Large</SelectItem>
            </SelectContent>
          </Select>
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

      <div className={`grid gap-4 ${SIZE_GRID[size]}`}>
        {data.map((c) => (
          <F1Card key={c.id} variant={cardVariant} glassVariant={glassVariant} size="sm">
            <F1CardContent className="flex flex-col gap-2.5">
              <ChartImage src={c.public_url} alt={c.title} />
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
                  onClick={() => saveImage(c.public_url, `${year}-r${r}-${slugify(c.title)}.png`)}
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
