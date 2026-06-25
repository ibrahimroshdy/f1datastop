import { useQuery } from "@tanstack/react-query";
import { Activity, Download, Loader2 } from "lucide-react";
import { getAnalysisCharts } from "@/services/analysisService";
import { Button } from "@/components/ui/button";

interface AnalysisChartsProps {
  year: number;
  round: string;
}

export default function AnalysisCharts({ year, round }: AnalysisChartsProps) {
  const r = parseInt(round, 10);
  const { data, isLoading } = useQuery({
    queryKey: ["analysisCharts", year, r],
    queryFn: () => getAnalysisCharts(year, r),
    staleTime: 60 * 60 * 1000,
    enabled: !!year && !!r,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
        <Activity className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No deep-dive charts yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Advanced telemetry &amp; strategy charts are generated automatically
          after each race weekend.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 px-4 pb-4 lg:grid-cols-2">
      {data.map((c) => (
        <figure
          key={c.id}
          className="overflow-hidden rounded-lg border border-border bg-muted/20"
        >
          <img src={c.public_url} alt={c.title} loading="lazy" className="w-full" />
          <figcaption className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{c.title}</p>
              {c.description ? (
                <p className="truncate text-xs text-muted-foreground">{c.description}</p>
              ) : null}
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <a
                href={c.public_url}
                download
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Download ${c.title}`}
              >
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
