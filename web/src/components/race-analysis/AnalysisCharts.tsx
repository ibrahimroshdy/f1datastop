import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { getAnalysisCharts } from "@/services/analysisService";
import { Button } from "@/components/ui/button";
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
  const { data, isLoading } = useQuery({
    queryKey: ["analysisCharts", year, r, session],
    queryFn: () => getAnalysisCharts(year, r, session),
    staleTime: 60 * 60 * 1000,
    enabled: !!year && !!r,
  });

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
    <div className="grid gap-4 px-4 pb-4 lg:grid-cols-2">
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
              <Button asChild variant="outline" size="sm" className="h-11 w-11 shrink-0 p-0">
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
            </div>
          </F1CardContent>
        </F1Card>
      ))}
    </div>
  );
}
