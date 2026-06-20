
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MapDebuggerProps {
  mapLoaded: boolean;
  raceData: any;
}

const MapDebugger = ({ mapLoaded, raceData }: MapDebuggerProps) => {
  const [showDebug, setShowDebug] = useState(false);
  const [debugClicks, setDebugClicks] = useState(0);
  
  // Enable debug mode after 5 clicks on the debug area
  useEffect(() => {
    if (debugClicks >= 5) {
      setShowDebug(true);
      toast.info("Map debug mode enabled");
    }
  }, [debugClicks]);

  if (!showDebug) {
    return (
      <div 
        className="absolute bottom-2 right-2 w-6 h-6 z-50 opacity-5 hover:opacity-50 cursor-pointer"
        onClick={() => setDebugClicks(prev => prev + 1)}
      />
    );
  }

  return (
    <div className="absolute bottom-2 right-2 p-3 bg-black/70 text-white z-50 rounded-lg text-xs max-w-[300px] backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold">Map Debug Info</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-5 text-xs"
          onClick={() => setShowDebug(false)}
        >
          Close
        </Button>
      </div>
      <div className="space-y-1">
        <div>Map Loaded: <span className={mapLoaded ? "text-green-400" : "text-red-400"}>{mapLoaded ? "Yes" : "No"}</span></div>
        <div>Race Data Loading: <span className={raceData.isLoading ? "text-amber-400" : "text-green-400"}>
          {raceData.isLoading ? "Loading..." : "Complete"}
        </span></div>
        <div>Race Count: <span>{raceData.data?.data?.length || 0}</span></div>
        {raceData.error && (
          <div className="text-red-400">Error: {raceData.error.message}</div>
        )}
      </div>
    </div>
  );
};

export default MapDebugger;
