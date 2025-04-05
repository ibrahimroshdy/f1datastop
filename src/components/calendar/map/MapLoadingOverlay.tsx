
import { Loader2 } from "lucide-react";

const MapLoadingOverlay = () => {
  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="flex flex-col items-center">
        <Loader2 className="h-10 w-10 text-f1-red animate-spin mb-4" />
        <p className="text-white text-lg font-medium">Loading Race Map...</p>
        <p className="text-gray-400 text-sm mt-2">Please wait while we prepare the F1 globe</p>
        <p className="text-gray-500 text-xs mt-1">This may take a few moments</p>
      </div>
    </div>
  );
};

export default MapLoadingOverlay;
