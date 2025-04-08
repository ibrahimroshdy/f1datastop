
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface DataLoadingState {
  isProcessingData: boolean;
  loadingProgress: number;
  errorMessage: string | null;
  retryCount: number;
  setIsProcessingData: (isProcessing: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  formatProgress: (progress: number) => string;
  handleRetry: (retryFn: () => void, isError: boolean, failureCount: number) => (() => void) | void;
}

export const useDataLoadingState = (maxRetries: number = 15): DataLoadingState => {
  const [isProcessingData, setIsProcessingData] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentFailureCount, setCurrentFailureCount] = useState(0);

  // Format progress to always have exactly 2 decimal places
  const formatProgress = (progress: number): string => {
    return progress.toFixed(2);
  };

  // Handle retry logic
  const handleRetry = (retryFn: () => void, isError: boolean, failureCount: number): (() => void) | void => {
    // Update the current failure count whenever handleRetry is called
    setCurrentFailureCount(failureCount);
    
    if (isError && retryCount < maxRetries) {
      const delaySeconds = Math.min(5 * (2 ** retryCount), 60); // Backoff up to 60 seconds
      
      // Format progress with exactly 2 decimal places
      setLoadingProgress(parseFloat((retryCount * 7).toFixed(2)));
      setErrorMessage(`Rate limit exceeded (429). Automatic retry ${retryCount + 1}/${maxRetries} in ${delaySeconds} seconds...`);
      
      const timer = setTimeout(() => {
        toast.info(`Retrying data... Attempt ${retryCount + 1}/${maxRetries}`, {
          id: `data-retry-${retryCount}`,
          duration: 3000,
        });
        
        setRetryCount(prev => prev + 1);
        retryFn();
      }, delaySeconds * 1000);
      
      return () => clearTimeout(timer);
    } else if (!isError) {
      setErrorMessage(null);
      setLoadingProgress(100.00); // Make sure we show exactly 100.00%
    }
  };

  // Update retry count when failure count changes
  useEffect(() => {
    if (currentFailureCount > retryCount) {
      setRetryCount(currentFailureCount);
    }
  }, [currentFailureCount, retryCount]);

  return {
    isProcessingData,
    loadingProgress,
    errorMessage,
    retryCount,
    setIsProcessingData,
    setErrorMessage,
    formatProgress,
    handleRetry
  };
};
