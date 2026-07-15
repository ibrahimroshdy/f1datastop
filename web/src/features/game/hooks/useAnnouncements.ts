import { useQuery } from "@tanstack/react-query";
import { getAnnouncements } from "../api/announcementsClient";

/** The League's Race Control feed. Anon-safe, so it powers the public landing too. */
export function useAnnouncements(limit = 10) {
  return useQuery({
    queryKey: ["game", "announcements", limit],
    queryFn: () => getAnnouncements(limit),
    staleTime: 60 * 1000,
  });
}
