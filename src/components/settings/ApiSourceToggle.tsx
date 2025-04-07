
import { Button } from "@/components/ui/button";
import { ServerIcon } from "lucide-react";
import { useApi } from "@/context/ApiContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ApiSourceToggle() {
  const { isBackendConnected } = useApi();
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`transition-colors ${
            isBackendConnected 
              ? 'bg-green-900/20 border-green-800 hover:bg-green-900/30' 
              : 'bg-red-900/20 border-red-800 hover:bg-red-900/30'
          }`}
        >
          <ServerIcon className={`h-4 w-4 ${isBackendConnected ? 'text-green-400' : 'text-red-400'} mr-2`} />
          {isBackendConnected ? 'Backend Connected' : 'Backend Disconnected'}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>FastF1 Python Backend {isBackendConnected ? 'is running' : 'is not running'}</p>
        {!isBackendConnected && <p className="text-xs text-red-400">Start the backend server on port 8000</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export default ApiSourceToggle;
