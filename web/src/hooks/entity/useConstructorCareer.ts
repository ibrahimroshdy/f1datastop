import { useQuery } from "@tanstack/react-query";
import { entityKeys } from "@/lib/entity/queryKeys";
import {
  getConstructorProfile,
  isEntityDbConfigured,
} from "@/services/entityService";
import { defaultRetryConfig } from "@/hooks/f1/retryConfig";

export interface UseConstructorCareerOptions {
  slug?: string;
  ergastId?: string;
  enabled?: boolean;
}

export function useConstructorCareer({
  slug,
  ergastId,
  enabled = true,
}: UseConstructorCareerOptions) {
  const lookupKey = slug ?? ergastId ?? "";
  const hasLookup = !!(slug || ergastId);

  return useQuery({
    queryKey: entityKeys.constructors.profile(lookupKey),
    queryFn: () =>
      getConstructorProfile(slug ? { slug } : { ergastId: ergastId! }),
    enabled: enabled && hasLookup && isEntityDbConfigured(),
    staleTime: 1000 * 60 * 30,
    ...defaultRetryConfig,
  });
}
