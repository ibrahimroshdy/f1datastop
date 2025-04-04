
import React from 'react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Globe, MapPin, Route, Eye, EyeOff } from 'lucide-react';

interface GlobeControlsProps {
  showPaths: boolean;
  onTogglePaths: () => void;
  detailLevel: 'low' | 'medium' | 'high';
  onChangeDetailLevel: (level: 'low' | 'medium' | 'high') => void;
}

const GlobeControls = ({ 
  showPaths, 
  onTogglePaths, 
  detailLevel,
  onChangeDetailLevel
}: GlobeControlsProps) => {
  return (
    <div className="absolute bottom-4 left-4 z-20 flex gap-2 flex-col sm:flex-row">
      <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-md px-3 py-2 text-white border border-gray-700">
        <button 
          onClick={onTogglePaths}
          className={`flex items-center gap-1.5 text-sm ${showPaths ? 'text-f1-red' : 'text-gray-400'}`}
        >
          {showPaths ? <Route className="h-4 w-4" /> : <Route className="h-4 w-4" />}
          <span>{showPaths ? 'Hide Paths' : 'Show Paths'}</span>
        </button>
      </div>

      <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-md px-3 py-2 text-white border border-gray-700">
        <span className="text-sm text-gray-400 mr-1 flex items-center gap-1">
          <Globe className="h-3.5 w-3.5" />
          Detail:
        </span>
        <ToggleGroup type="single" value={detailLevel} onValueChange={(value) => {
          if (value) onChangeDetailLevel(value as 'low' | 'medium' | 'high');
        }}>
          <ToggleGroupItem value="low" size="sm" className="text-xs h-7 px-2">Low</ToggleGroupItem>
          <ToggleGroupItem value="medium" size="sm" className="text-xs h-7 px-2">Medium</ToggleGroupItem>
          <ToggleGroupItem value="high" size="sm" className="text-xs h-7 px-2">High</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
};

export default GlobeControls;
