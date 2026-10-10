import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import * as f1Service from "@/services/f1Service";
import { f1Keys } from "@/lib/f1/queryKeys";
import { lapTimesRetryConfig } from "./retryConfig";

export const useLapTimes = (year: number, round: string, firstDriverOnly: boolean = false) => {
  const [loadingState, setLoadingState] = useState({
    pagesLoaded: 0,
    totalPages: 0,
    progress: 0,
    retryAttempts: {}
  });

  return useQuery({
    queryKey: f1Keys.lapTimes(year, round, firstDriverOnly ? "firstDriverOnly" : "allDrivers"),
    queryFn: async () => {
      try {
        // Add a small delay before making the request to avoid immediate rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Instead of passing 'false' as a string, we should either pass a valid driver ID or omit it completely
        // to get all drivers' lap times
        const data = await f1Service.getLapTimes(year, round, firstDriverOnly ? "true" : undefined, 
          // Add progress callback to update loading state
          (progress, pagesLoaded, totalPages, retryInfo) => {
            setLoadingState({
              pagesLoaded,
              totalPages,
              progress: Math.round(progress * 100),
              retryAttempts: retryInfo
            });
          }
        );
        
        // Mark as fully loaded when complete
        setLoadingState(prev => ({
          ...prev,
          progress: 100,
          pagesLoaded: prev.totalPages
        }));
        
        return {
          ...data,
          loadingState // Include loading state in the return
        };
      } catch (error: any) {
        if (error?.status === 429) {
          toast.error("Rate limit exceeded. System will retry automatically.", {
            description: "The F1 API has strict rate limits. Waiting before retry...",
            duration: 5000,
          });
        }
        throw error; // Re-throw the error to let React Query handle retries
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...lapTimesRetryConfig,
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
    meta: {
      loadingState // Expose loading state in meta
    }
  });
};
