
import React from 'react';
import { Route, MapPin, Circle } from 'lucide-react';

const MapLegend = () => {
  return (
    <div className="absolute bottom-4 right-4 text-xs text-white bg-black/70 backdrop-blur-sm rounded-md px-4 py-3 shadow-lg border border-gray-700 z-10">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-600">
        <span className="font-medium">Race Status</span>
      </div>
      
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-400/50"></div>
        <span>First Race of Season</span>
      </div>
      
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-3 h-3 rounded-full bg-red-600 shadow-sm shadow-red-500/50"></div>
        <span>Upcoming Races</span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-white shadow-sm shadow-white/50"></div>
        <span>Completed Races</span>
      </div>
      
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600 mb-2">
        <span className="font-medium">Race Sequence</span>
      </div>
      
      <div className="flex items-center gap-2 mb-1.5">
        <Route className="h-3 w-3 text-red-500" />
        <span>Upcoming Race Path</span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <Route className="h-3 w-3 text-blue-400" />
        <span>Completed Race Path</span>
      </div>
      
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600 mb-2">
        <span className="font-medium">Navigation</span>
      </div>
      
      <div className="text-gray-300 mb-1">
        • Click and drag to rotate globe
      </div>
      
      <div className="text-gray-300">
        • Scroll to zoom in/out
      </div>
    </div>
  );
};

export default MapLegend;
