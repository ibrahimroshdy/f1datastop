import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Uniform "back" affordance for detail / sub-pages — a quiet text link with a
 * left arrow, sitting above the PageHeader (e.g. "Drivers", "Circuits"). Not a
 * button: back navigation is secondary, so it shouldn't compete with the page's
 * real actions. Carries a 44px touch target (see docs/MOBILE_PATTERNS.md).
 */
export function BackLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 px-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {children}
    </Link>
  );
}

export default BackLink;
