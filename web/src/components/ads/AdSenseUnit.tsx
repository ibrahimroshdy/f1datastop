import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { ADSENSE_CLIENT_ID } from "@/config/adsense";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export type AdSenseFormat = "auto" | "rectangle" | "horizontal" | "vertical" | "fluid";

export interface AdSenseUnitProps {
  /** Numeric slot ID from the AdSense ad unit. */
  adSlot: string;
  className?: string;
  /** Wrapper min-height (px) to reduce layout shift while the ad loads. */
  minHeight?: number;
  /** Passed to `data-ad-format`. */
  format?: AdSenseFormat;
  /** `data-full-width-responsive` — usually true for in-content display units. */
  fullWidthResponsive?: boolean;
  style?: CSSProperties;
}

/**
 * Single AdSense display unit. Requires `adsbygoogle.js` in `index.html` with the same `client`.
 */
export function AdSenseUnit({
  adSlot,
  className,
  minHeight = 100,
  format = "auto",
  fullWidthResponsive = true,
  style,
}: AdSenseUnitProps) {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!adSlot || !ADSENSE_CLIENT_ID) return;
    if (pushedRef.current) return;
    if (!insRef.current) return;
    pushedRef.current = true;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      pushedRef.current = false;
    }
  }, [adSlot]);

  if (!adSlot || !ADSENSE_CLIENT_ID) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30",
        className
      )}
      style={{ minHeight }}
    >
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", ...style }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format={format}
        {...(fullWidthResponsive && format === "auto"
          ? { "data-full-width-responsive": "true" as const }
          : {})}
      />
    </div>
  );
}
