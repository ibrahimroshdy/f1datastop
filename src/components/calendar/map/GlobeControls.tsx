
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
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const GlobeControls = ({ 
  showPaths, 
  onTogglePaths,
  detailLevel,
  onChangeDetailLevel 
}: GlobeControlsProps) => {
  const { isGlass } = useTheme();
  const shell = cn(
    "shadow-sm",
    isGlass ? "border-white/10 bg-background/70 backdrop-blur-md" : "border-border bg-card/90 backdrop-blur-sm"
  );

  return (
    <div className="absolute bottom-3 right-3 z-20 flex gap-2 sm:bottom-4 sm:right-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className={cn("h-10 w-10 border", shell)}
            onClick={onTogglePaths}
          >
            {showPaths ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            <span className="sr-only">{showPaths ? "Hide race paths" : "Show race paths"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {showPaths ? "Hide race paths" : "Show race paths"}
        </TooltipContent>
      </Tooltip>

      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className={cn("h-10 w-10 border", shell)}
              >
                <Settings2 className="h-5 w-5" />
                <span className="sr-only">Globe settings</span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">Globe quality</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-64 border-border bg-popover p-3 text-popover-foreground" align="end">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Globe quality
            </h4>
            <RadioGroup 
              value={detailLevel} 
              onValueChange={value => onChangeDetailLevel(value as GlobeDetailLevel)}
              className="grid gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="globe-low" />
                <Label htmlFor="globe-low" className="text-sm font-normal leading-none">
                  Low — fastest
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="globe-medium" />
                <Label htmlFor="globe-medium" className="text-sm font-normal leading-none">
                  Medium — balanced
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="globe-high" />
                <Label htmlFor="globe-high" className="text-sm font-normal leading-none">
                  High — smoothest
                </Label>
              </div>
            </RadioGroup>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default GlobeControls;
