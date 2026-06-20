import { lazy, Suspense } from "react";
import { F1Card, F1CardContent } from "@/components/f1";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const F1GlobeContainer = lazy(() => import("@/components/calendar/map/F1GlobeContainer"));

interface RaceCalendarGlobeViewProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  cardVariant: "default" | "glass";
  glassVariant: "default" | "panel";
  isGlass: boolean;
}

export default function RaceCalendarGlobeView({
  selectedYear,
  onYearChange,
  cardVariant,
  glassVariant,
  isGlass,
}: RaceCalendarGlobeViewProps) {
  return (
    <Suspense
      fallback={
        <F1Card
          variant={cardVariant}
          glassVariant={glassVariant}
          className={cn(
            "flex h-[min(70vh,780px)] min-h-[420px] items-center justify-center p-0",
            isGlass && "border-white/10",
          )}
        >
          <F1CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">Loading 3D globe</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Preparing the map module. First load can take a moment on slower networks.
              </p>
            </div>
          </F1CardContent>
        </F1Card>
      }
    >
      <F1GlobeContainer selectedYear={selectedYear} onYearChange={onYearChange} />
    </Suspense>
  );
}
