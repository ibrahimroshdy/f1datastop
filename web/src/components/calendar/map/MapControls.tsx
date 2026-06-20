
import { useState } from "react";
import { Info } from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

const MapControls = () => {
  const [showInfo, setShowInfo] = useState(false);
  
  return (
    <TooltipProvider>
      <div className="absolute top-16 left-4 z-20">
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              className="w-9 h-9 flex items-center justify-center bg-black/70 backdrop-blur-sm hover:bg-black/80 rounded-full text-white"
              onClick={() => setShowInfo(!showInfo)}
              aria-label="Globe navigation information"
            >
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-black text-white border-gray-700">
            Globe navigation controls
          </TooltipContent>
        </Tooltip>
        
        {showInfo && (
          <div className="absolute left-11 top-0 bg-black/80 backdrop-blur-md p-3 rounded-md text-xs text-white border border-gray-700 w-64 shadow-xl">
            <h3 className="font-semibold mb-2">Navigation Tips</h3>
            <ul className="space-y-1.5">
              <li>• Left-click + drag to rotate the globe</li>
              <li>• Right-click + drag to pan the view</li>
              <li>• Scroll to zoom in and out</li>
              <li>• Click on race markers to view details</li>
              <li>• Search for races by name or location</li>
              <li>• Use filter buttons to show/hide race types</li>
            </ul>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default MapControls;
