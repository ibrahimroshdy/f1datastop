
import { MousePointer, MousePointerClick, Maximize } from "lucide-react";

const MapTips = () => {
  return (
    <div className="absolute bottom-4 right-4 text-xs text-white bg-black/70 backdrop-blur-sm rounded-md px-4 py-2 shadow-lg border border-gray-700 z-10">
      <div className="flex items-center gap-2">
        <MousePointer className="h-3 w-3" /> 
        <span>Click and drag to rotate</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <Maximize className="h-3 w-3" />
        <span>Scroll to zoom</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <MousePointerClick className="h-3 w-3" />
        <span>Click markers for details</span>
      </div>
    </div>
  );
};

export default MapTips;
