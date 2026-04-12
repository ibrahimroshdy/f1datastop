
import { Loader2 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const MapLoadingOverlay = () => {
  const { isGlass } = useTheme();

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/50 backdrop-blur-md">
      <div
        className={cn(
          "mx-4 flex w-full max-w-sm flex-col items-center rounded-xl border px-6 py-8 text-center shadow-lg",
          isGlass
            ? "glass-panel border-white/10"
            : "border-border bg-card"
        )}
      >
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
          <Loader2 className="relative h-10 w-10 animate-spin text-primary" aria-hidden />
        </div>
        <p className="text-sm font-semibold text-foreground">Loading calendar</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fetching race locations for the globe. This is usually quick.
        </p>
      </div>
    </div>
  );
};

export default MapLoadingOverlay;
