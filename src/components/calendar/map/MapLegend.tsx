import { Info } from "lucide-react";

const MapLegend = () => {
  return (
    <div className="absolute bottom-4 left-4 p-3 bg-card/90 border border-border text-foreground z-20 rounded-lg text-xs max-w-[280px] backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        <Info className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Race Legend</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
          <span className="text-muted-foreground">First Race</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-f1-red"></div>
          <span className="text-muted-foreground">Upcoming Race</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground"></div>
          <span className="text-muted-foreground">Completed Race</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-8 bg-f1-red/70"></div>
          <span className="text-muted-foreground">Upcoming Path</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-8 bg-muted-foreground/70"></div>
          <span className="text-muted-foreground">Completed Path</span>
        </div>
      </div>
      <div className="text-muted-foreground/70 text-[10px] mt-2 pt-2 border-t border-border">
        Click markers for details. Drag to rotate, scroll to zoom.
      </div>
    </div>
  );
};

export default MapLegend;
