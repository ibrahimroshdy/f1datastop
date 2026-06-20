import { toast } from "sonner";

// Helper function to create exponential backoff retry logic with jitter
export const createRetryConfig = (retryDelayBase = 2000, maxRetryAttempts = 5) => ({
  retry: maxRetryAttempts,
  retryDelay: (attemptIndex: number) => {
    // Enhanced exponential backoff with jitter to avoid thundering herd
    // Add random jitter (80-120% of the base value) to prevent all clients retrying at the same time
    const delay = Math.min(retryDelayBase * (2 ** attemptIndex) * (0.8 + Math.random() * 0.4), 60000);
    
    if (attemptIndex > 0) {
      toast.info(`Rate limit reached. Retrying in ${Math.round(delay/1000)} seconds...`, {
        id: `retry-toast-${attemptIndex}`,
        duration: delay,
      });
      console.log(`Rate limit retry attempt ${attemptIndex + 1} in ${Math.round(delay/1000)} seconds`);
    }
    
    return delay;
  }
});

// Default retry config with moderate settings
export const defaultRetryConfig = createRetryConfig(2000, 5);

// Specialized retry config for lap times with higher delay and more attempts
export const lapTimesRetryConfig = createRetryConfig(5000, 10);
