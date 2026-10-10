import { SITE_NAME, SITE_URL, canonicalFor } from "@/components/common/Seo";

/**
 * Schema.org builders for JSON-LD. Pass the result to <Seo jsonLd={...} />.
 *
 * Structured data is what earns rich results (breadcrumb trails, sitelinks search box,
 * event cards) rather than a plain blue link — worth real click-through on a data site
 * whose pages otherwise look interchangeable in a SERP.
 */

/** Sitewide: names the site and enables the sitelinks search box. */
export const websiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description:
    "Formula 1 telemetry, race analysis and strategy breakdowns — lap time deltas, stint strategy and driver head-to-heads.",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/race-analysis?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

/** Sitewide publisher identity. */
export const organizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/apple-touch-icon.png`,
  sameAs: ["https://x.com/f1datastop", "https://www.producthunt.com/posts/f1-datastop"],
});

/** A Grand Prix as a sporting event. */
export const raceSchema = (opts: {
  name: string;
  season: number;
  round: number;
  circuit?: string;
  country?: string;
  startDate?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  name: opts.name,
  sport: "Formula 1",
  url: canonicalFor(`/race-analysis/${opts.season}/${opts.round}`),
  ...(opts.startDate ? { startDate: opts.startDate } : {}),
  ...(opts.circuit
    ? {
        location: {
          "@type": "Place",
          name: opts.circuit,
          ...(opts.country ? { address: { "@type": "PostalAddress", addressCountry: opts.country } } : {}),
        },
      }
    : {}),
  organizer: { "@type": "Organization", name: "Formula 1" },
});

/** A driver or constructor profile. */
export const personSchema = (opts: { name: string; path: string; nationality?: string; image?: string }) => ({
  "@context": "https://schema.org",
  "@type": "Person",
  name: opts.name,
  url: canonicalFor(opts.path),
  ...(opts.nationality ? { nationality: opts.nationality } : {}),
  ...(opts.image ? { image: opts.image } : {}),
  jobTitle: "Formula 1 Driver",
});

/** Navigation trail — renders as a breadcrumb in search results. */
export const breadcrumbSchema = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: canonicalFor(item.path),
  })),
});

/** Marks a page as a published dataset — eligible for Google Dataset Search. */
export const datasetSchema = (opts: { name: string; description: string; path: string; keywords?: string[] }) => ({
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: opts.name,
  description: opts.description,
  url: canonicalFor(opts.path),
  creator: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
  isAccessibleForFree: true,
  ...(opts.keywords ? { keywords: opts.keywords } : {}),
});
