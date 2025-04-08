
import React from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  maxRetries = 5
}) => {
  // Format progress to always have exactly 2 decimal places
  const formattedProgress = progress.toFixed(2);
  
  if (!isLoading && !message) return null;
  
  return (
    <div className="flex flex-col items-center justify-center space-y-6 w-3/4 max-w-md">
      {isLoading && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
      
      {(isLoading || message) && (
        <div className="w-full space-y-2">
          {isLoading && (
            <Progress 
              value={progress} 
              className="h-2 w-full" 
              indicatorClassName={isError ? "bg-yellow-500" : "bg-blue-500"}
            />
          )}
          
          {message && (
            <p className="text-center text-muted-foreground text-sm">
              {message}
            </p>
          )}
          
          {isLoading && !message && (
            <p className="text-center text-muted-foreground text-sm">
              Loading data... {formattedProgress}%
            </p>
          )}
          
          {isError && retryCount < maxRetries && (
            <Alert className="mt-4 bg-yellow-50 border-yellow-200 text-yellow-900">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-xs">
                System is automatically retrying... The F1 API has strict rate limits.
              </AlertDescription>
            </Alert>
          )}
          
          {isError && retryCount >= maxRetries && (
            <Alert className="mt-4 bg-red-50 border-red-200 text-red-900">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs">
                Maximum retries reached. Please try again later.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};

export default DataLoadingProgress;
