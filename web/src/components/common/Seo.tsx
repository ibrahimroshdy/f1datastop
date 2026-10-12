import { Helmet } from "react-helmet-async";

/**
 * Per-route metadata. Every public page should render one of these.
 *
 * Why it exists: index.html can only describe a single page, but this is an SPA with ~18
 * indexable routes. Before this, every route served the homepage's title, description and
 * canonical — so search engines saw one page repeated, and social crawlers (which don't
 * run JS) showed the generic homepage card for every shared link.
 *
 * The canonical host is www: the apex 301s to it, so canonicalising to the apex would
 * point at a redirect.
 */

export const SITE_URL = "https://www.f1datastop.com";
export const SITE_NAME = "F1 DataStop";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
const DEFAULT_DESCRIPTION =
  "F1 DataStop turns raw Formula 1 telemetry and race stats into clear insights — lap time deltas, stint strategy breakdowns, and driver vs. teammate comparisons.";

export interface SeoProps {
  /** Page title, without the site name — appended automatically. */
  title?: string;
  description?: string;
  /** Canonical path beginning with "/" (e.g. "/race-analysis/2026/9"). */
  path?: string;
  /** Absolute image URL for social cards. */
  image?: string;
  type?: "website" | "article" | "profile";
  /** Keep private/auth/utility routes out of the index. */
  noIndex?: boolean;
  /** Schema.org objects rendered as JSON-LD. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/** Absolute, trailing-slash-free canonical for a path. */
export const canonicalFor = (path?: string) => {
  if (!path || path === "/") return `${SITE_URL}/`;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean.replace(/\/+$/, "")}`;
};

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  noIndex = false,
  jsonLd,
}: SeoProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Formula 1 Data Analysis and Insights`;
  const url = canonicalFor(path);
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  // react-helmet-async only accepts a flat list of plain elements as children. A
  // `{cond && <meta/>}` that evaluates false, or a nested array from .map(), makes it
  // bail without touching the DOM and without an error — which looks exactly like
  // "Helmet isn't working". Build the list explicitly and filter, so every child is a
  // real element.
  const children = [
    <title key="title">{fullTitle}</title>,
    <meta key="desc" name="description" content={description} />,
    <link key="canonical" rel="canonical" href={url} />,
    noIndex ? <meta key="robots" name="robots" content="noindex,nofollow" /> : null,
    <meta key="og:title" property="og:title" content={fullTitle} />,
    <meta key="og:desc" property="og:description" content={description} />,
    <meta key="og:url" property="og:url" content={url} />,
    <meta key="og:image" property="og:image" content={image} />,
    <meta key="og:type" property="og:type" content={type} />,
    <meta key="og:site" property="og:site_name" content={SITE_NAME} />,
    <meta key="tw:card" name="twitter:card" content="summary_large_image" />,
    <meta key="tw:title" name="twitter:title" content={fullTitle} />,
    <meta key="tw:desc" name="twitter:description" content={description} />,
    <meta key="tw:image" name="twitter:image" content={image} />,
    ...blocks.map((block, i) => (
      <script key={`ld-${i}`} type="application/ld+json">
        {JSON.stringify(block)}
      </script>
    )),
  ].filter(Boolean);

  return <Helmet prioritizeSeoTags>{children}</Helmet>;
}
