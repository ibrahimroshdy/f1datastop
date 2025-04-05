
import React from 'react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Globe, MapPin, Route, Eye, EyeOff, Layers } from 'lucide-react';
import { Button } from "@/components/ui/button";

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
      <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-md px-3 py-2 text-white border border-gray-700">
        <Button 
          onClick={onTogglePaths}
          size="sm"
          variant={showPaths ? "default" : "outline"}
          className={`flex items-center gap-1.5 h-7 text-sm ${showPaths ? 'bg-f1-red hover:bg-f1-red/90' : 'text-gray-300 hover:text-white'}`}
        >
          {showPaths ? <Route className="h-4 w-4" /> : <Route className="h-4 w-4" />}
          <span>Race Paths</span>
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-md px-3 py-2 text-white border border-gray-700">
        <span className="text-sm text-gray-300 mr-1 flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          Detail:
        </span>
        <ToggleGroup type="single" value={detailLevel} onValueChange={(value) => {
          if (value) onChangeDetailLevel(value as 'low' | 'medium' | 'high');
        }}>
          <ToggleGroupItem value="low" size="sm" className="text-xs h-7 px-2 data-[state=on]:bg-f1-red data-[state=on]:text-white">Low</ToggleGroupItem>
          <ToggleGroupItem value="medium" size="sm" className="text-xs h-7 px-2 data-[state=on]:bg-f1-red data-[state=on]:text-white">Medium</ToggleGroupItem>
          <ToggleGroupItem value="high" size="sm" className="text-xs h-7 px-2 data-[state=on]:bg-f1-red data-[state=on]:text-white">High</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
};

export default GlobeControls;
