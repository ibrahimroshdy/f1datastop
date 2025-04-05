
import { GlobeControlsProps, GlobeDetailLevel } from "./types";
import { Eye, EyeOff, Settings2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const GlobeControls = ({ 
  showPaths, 
  onTogglePaths,
  detailLevel,
  onChangeDetailLevel 
}: GlobeControlsProps) => {
  return (
    <div className="absolute bottom-4 right-4 z-20 flex gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            onClick={onTogglePaths}
            className="p-2 bg-black/60 backdrop-blur-sm border border-gray-700 rounded-md text-white hover:bg-black/80 transition-colors"
          >
            {showPaths ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {showPaths ? "Hide race paths" : "Show race paths"}
        </TooltipContent>
      </Tooltip>

      <Popover>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button 
              className="p-2 bg-black/60 backdrop-blur-sm border border-gray-700 rounded-md text-white hover:bg-black/80 transition-colors"
            >
              <Settings2 className="h-5 w-5" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <PopoverContent className="w-60 bg-black/80 backdrop-blur-sm border border-gray-700 text-white">
          <div className="space-y-2 p-2">
            <h4 className="font-medium text-xs uppercase text-gray-400">Globe Settings</h4>
            <RadioGroup 
              value={detailLevel} 
              onValueChange={value => onChangeDetailLevel(value as GlobeDetailLevel)}
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="low" className="border-white" />
                <Label htmlFor="low">Low Detail (Fastest)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="medium" className="border-white" />
                <Label htmlFor="medium">Medium Detail</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="high" className="border-white" />
                <Label htmlFor="high">High Detail (Slowest)</Label>
              </div>
            </RadioGroup>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default GlobeControls;
