import { Trophy, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { F1Card, F1CardContent } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useGameActivation } from "../hooks/useGameActivation";

export default function GameHub() {
  const { isActivated, isLoading, activate, activating, error } = useGameActivation();

  if (isLoading) {
    return (
      <div className={cn(pageShell, pageStack)}>
        <F1Card>
          <F1CardContent className="py-6 text-sm text-muted-foreground">Loading…</F1CardContent>
        </F1Card>
      </div>
    );
  }

  if (!isActivated) {
    return (
      <div className={cn(pageShell, pageStack, "animate-fade-in")}>
        <div className="space-y-1.5">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <Trophy className="h-3 w-3" /> Prediction Game
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            Join the F1 League
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Predict qualifying &amp; race top-10s every weekend, pick your champions, and climb your
            league. Activate to start playing the 2026 season.
          </p>
        </div>
        <F1Card>
          <F1CardContent className="flex flex-col items-start gap-3 py-6">
            <Button
              size="lg"
              className="min-h-11 gap-2"
              onClick={() => activate()}
              disabled={activating}
            >
              <Flag className="h-4 w-4" />
              {activating ? "Joining…" : "Join the F1 League"}
            </Button>
            {error ? (
              <p className="text-xs text-destructive">{error.message}</p>
            ) : null}
          </F1CardContent>
        </F1Card>
      </div>
    );
  }

  // Activated — placeholder hub; filled out in Phase 2 (predictions, standings).
  return (
    <div className={cn(pageShell, pageStack, "animate-fade-in")}>
      <div className="space-y-1.5">
        <div className="instrument-label flex items-center gap-1.5 text-primary">
          <Trophy className="h-3 w-3" /> Prediction Game
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Your F1 League</h1>
      </div>
      <F1Card>
        <F1CardContent className="py-6 text-sm text-muted-foreground">
          You're in for 2026. Predictions open here each race weekend.
        </F1CardContent>
      </F1Card>
    </div>
  );
}
