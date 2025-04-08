import React from "react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, InfoIcon } from "lucide-react";

interface DataLoadingProgressProps {
  isLoading: boolean;
  progress?: number;
  message?: string | null;
  isError?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

const DataLoadingProgress: React.FC<DataLoadingProgressProps> = ({
  isLoading,
  progress = 0,
  message,
  isError = false,
  retryCount = 0,
  maxRetries = 15
}) => {
  if (!isLoading && !message) return null;

  return (
    <div className="w-full space-y-2">
      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {retryCount > 0
                  ? `Retry attempt ${retryCount}/${maxRetries}...`
                  : "Loading data..."}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {progress.toFixed(2)}%
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {message && (
        <Alert className={`py-2 ${isError ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {isError ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <InfoIcon className="h-4 w-4" />
          )}
          <AlertDescription className="text-sm">{message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default DataLoadingProgress;
