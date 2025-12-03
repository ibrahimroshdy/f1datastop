import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Database, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

type DataSource = 'ergast' | 'openf1';

interface DataSourceBadgeProps {
  source: DataSource;
  className?: string;
  showTooltip?: boolean;
}

const sourceConfig = {
  ergast: {
    label: 'Ergast',
    icon: Database,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    description: 'Historical F1 data from Ergast/Jolpica API (1950-present)'
  },
  openf1: {
    label: 'OpenF1',
    icon: Wifi,
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
    description: 'Real-time telemetry data from OpenF1 API (2023+)'
  }
};

const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({ 
  source, 
  className,
  showTooltip = true 
}) => {
  const config = sourceConfig[source];
  const Icon = config.icon;

  const badge = (
    <Badge 
      variant="outline" 
      className={cn(
        "text-[10px] px-1.5 py-0 h-5 gap-1 font-normal",
        config.color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
          {config.description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default DataSourceBadge;

