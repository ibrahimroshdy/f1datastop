import { useQuery } from "@tanstack/react-query";
import { entityKeys } from "@/lib/entity/queryKeys";
import { getDriverProfile, isEntityDbConfigured } from "@/services/entityService";
import { defaultRetryConfig } from "@/hooks/f1/retryConfig";

export interface UseDriverCareerOptions {
  slug?: string;
  ergastId?: string;
  enabled?: boolean;
}

export function useDriverCareer({
  slug,
  ergastId,
  enabled = true,
}: UseDriverCareerOptions) {
  const lookupKey = slug ?? ergastId ?? "";
  const hasLookup = !!(slug || ergastId);

  return useQuery({
    queryKey: entityKeys.drivers.profile(lookupKey),
    queryFn: () =>
      getDriverProfile(slug ? { slug } : { ergastId: ergastId! }),
    enabled: enabled && hasLookup && isEntityDbConfigured(),
    staleTime: 1000 * 60 * 30,
    ...defaultRetryConfig,
  });
}
