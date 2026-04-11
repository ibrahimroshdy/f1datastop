import { Info } from "lucide-react";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const MapLegend = () => {
  const { isGlass } = useTheme();
  const variant = isGlass ? ("glass" as const) : ("default" as const);
  const glassVariant = isGlass ? ("panel" as const) : ("default" as const);

  return (
    <F1Card
      variant={variant}
      glassVariant={glassVariant}
      className={cn(
        "absolute bottom-3 left-3 z-20 max-w-[min(100%,280px)] p-0 text-xs shadow-md sm:bottom-4 sm:left-4",
        isGlass && "border-white/10"
      )}
    >
      <F1CardHeader className="space-y-0 pb-2 pt-3">
        <F1CardTitle icon={<Info className="h-4 w-4" />} className="text-xs font-semibold sm:text-sm">
          Markers & paths
        </F1CardTitle>
      </F1CardHeader>
      <F1CardContent className="space-y-1.5 pb-3 pt-0 text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
          <span>Opening round</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
          <span>Upcoming</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/80" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-8 shrink-0 rounded-full bg-primary/70" />
          <span>Upcoming leg</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-8 shrink-0 rounded-full bg-muted-foreground/60" />
          <span>Completed leg</span>
        </div>
        <p className="mt-2 border-t border-border/60 pt-2 text-[10px] leading-snug text-muted-foreground/90">
          Drag to orbit · Scroll to zoom · Click a pin for details
        </p>
      </F1CardContent>
    </F1Card>
  );
};

export default MapLegend;
