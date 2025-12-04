import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Database, Wifi, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type DataSource = 'ergast' | 'openf1';

interface DataSourceBadgeProps {
  source: DataSource;
  className?: string;
  showTooltip?: boolean;
}

const sourceConfig = {
  ergast: {
    label: 'Jolpica',
    icon: Database,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20',
    description: 'Historical F1 data from Jolpica F1 API (1950-present)',
    url: 'https://github.com/jolpica/jolpica-f1'
  },
  openf1: {
    label: 'OpenF1',
    icon: Wifi,
    color: 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20',
    description: 'Real-time telemetry data from OpenF1 API (2023+)',
    url: 'https://openf1.org/'
  }
};

const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({ 
  source, 
  className,
  showTooltip = true 
}) => {
  const config = sourceConfig[source];
  const Icon = config.icon;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(config.url, '_blank', 'noopener,noreferrer');
  };

  const badge = (
    <Badge 
      variant="outline" 
      className={cn(
        "text-[10px] px-1.5 py-0 h-5 gap-1 font-normal cursor-pointer transition-colors",
        config.color,
        className
      )}
      onClick={handleClick}
    >
      <Icon className="h-3 w-3" />
      {config.label}
      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
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
        <TooltipContent side="bottom" className="text-xs max-w-[220px]">
          <p>{config.description}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Click to view API docs</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default DataSourceBadge;
