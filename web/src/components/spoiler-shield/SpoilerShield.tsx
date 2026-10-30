import { Button } from "@/components/ui/button";
import { F1Card, F1CardContent } from "@/components/f1";
import { EyeOff } from "lucide-react";

interface SpoilerShieldProps {
  /** Hide `children` behind a "Show results" button when true. */
  isShielded: boolean;
  onShowResults: () => void;
  children: React.ReactNode;
}

/**
 * Reveals results content behind one clear "Show results" action. When
 * `isShielded` the content is replaced by a call-to-action card; clicking the
 * button invokes `onShowResults` (the caller persists the choice) and the
 * children render in place.
 */
export function SpoilerShield({ isShielded, onShowResults, children }: SpoilerShieldProps) {
  if (!isShielded) return <>{children}</>;

  return (
    <F1Card variant="default" glassVariant="default" className="border-border">
      <F1CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <EyeOff className="h-10 w-10 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="text-lg font-semibold">Results hidden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Results for the latest race weekend are hidden to avoid spoilers.
        </p>
        <Button onClick={onShowResults}>Show results</Button>
      </F1CardContent>
    </F1Card>
  );
}
