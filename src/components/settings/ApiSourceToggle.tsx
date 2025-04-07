
import { Button } from "@/components/ui/button";
import { ServerIcon, CloudIcon } from "lucide-react";
import { useApi } from "@/context/ApiContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ApiSourceToggle() {
  const { apiSource, toggleApiSource } = useApi();
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleApiSource}
          className={`transition-colors ${
            apiSource === 'backend' 
              ? 'bg-green-900/20 border-green-800 hover:bg-green-900/30' 
              : 'bg-blue-900/20 border-blue-800 hover:bg-blue-900/30'
          }`}
        >
          {apiSource === 'backend' ? (
            <ServerIcon className="h-4 w-4 text-green-400 mr-2" />
          ) : (
            <CloudIcon className="h-4 w-4 text-blue-400 mr-2" />
          )}
          {apiSource === 'backend' ? 'Python Backend' : 'Direct API'}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Click to switch to {apiSource === 'direct' ? 'Python Backend' : 'Direct API'}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default ApiSourceToggle;
