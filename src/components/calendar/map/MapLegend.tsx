
import { Info } from "lucide-react";

const MapLegend = () => {
  return (
    <div className="absolute bottom-4 left-4 p-3 bg-black/70 text-white z-20 rounded-lg text-xs max-w-[300px] backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        <Info className="h-4 w-4 text-gray-400" />
        <span className="font-bold">Race Legend</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>First Race</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600"></div>
          <span>Upcoming Race</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white"></div>
          <span>Completed Race</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-10 bg-red-600 opacity-70"></div>
          <span>Upcoming Path</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-10 bg-white opacity-70"></div>
          <span>Completed Path</span>
        </div>
      </div>
      <div className="text-gray-400 text-[10px] mt-2">
        Click on race markers for details. Drag to rotate, scroll to zoom.
      </div>
    </div>
  );
};

export default MapLegend;
