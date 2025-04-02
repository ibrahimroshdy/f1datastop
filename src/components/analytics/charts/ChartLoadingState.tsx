
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

interface ChartLoadingStateProps {
  isLoading: boolean;
  isProcessingData: boolean;
  isError: boolean;
  retryCount: number;
  totalLaps: number;
  errorMessage?: string;
}

const ChartLoadingState: React.FC<ChartLoadingStateProps> = ({
  isLoading,
  isProcessingData,
  isError,
  retryCount,
  totalLaps,
  errorMessage = "Unable to load position data after multiple attempts"
}) => {
  if (isLoading || (isError && retryCount < 5)) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Skeleton className="h-[500px] w-full" />
        {isProcessingData && (
          <p className="text-sm text-muted-foreground mt-2">
            Processing race data with {totalLaps} laps...
          </p>
        )}
        {isError && retryCount < 5 && (
          <div className="absolute flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">
              Loading data... (retry {retryCount + 1}/5)
            </p>
          </div>
        )}
      </div>
    );
  }

  if (isError && retryCount >= 5) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-muted-foreground">
          {errorMessage}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Please try again later or select a different race
        </p>
      </div>
    );
  }

  return null;
};

export default ChartLoadingState;
