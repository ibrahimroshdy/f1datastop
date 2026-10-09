import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, PageHeader } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";

export default function GameRules() {
  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-2xl", pageStack, "animate-fade-in")}>
        <BackLink to="/game">Predictions</BackLink>
        <PageHeader
          eyebrow="How it works"
          title="Rules & Scoring"
        />

        <F1Card>
          <F1CardHeader><F1CardTitle className="text-base">Each race weekend</F1CardTitle></F1CardHeader>
          <F1CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Predict the ordered <strong>top-10 for Qualifying</strong> and the ordered <strong>top-10 for the Race</strong>. On sprint weekends you also predict the <strong>top-8 for the Sprint</strong>.</p>
            <p>All of a weekend's picks lock at the start of that weekend's first competitive session (Qualifying, or Sprint Qualifying on sprint weekends). After that you can view but not change them.</p>
          </F1CardContent>
        </F1Card>

        <F1Card>
          <F1CardHeader><F1CardTitle className="text-base">Points</F1CardTitle></F1CardHeader>
          <F1CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Each slot uses the real F1 points scale <span className="readout">25·18·15·12·10·8·6·4·2·1</span> (sprint: <span className="readout">8·7·6·5·4·3·2·1</span>).</p>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong>Exact position:</strong> full points for that slot.</li>
              <li><strong>Driver in the top-N but wrong slot:</strong> half the slot's points.</li>
              <li><strong>Outside the top-N / DNF:</strong> zero.</li>
            </ul>
            <p>A perfect race prediction is worth 101 points.</p>
          </F1CardContent>
        </F1Card>

        <F1Card>
          <F1CardHeader><F1CardTitle className="text-base">Champions</F1CardTitle></F1CardHeader>
          <F1CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Pick the <strong>World Drivers' Champion</strong> and <strong>Constructors' Champion</strong> for the season. Editable until the mid-season lock round, then frozen.</p>
            <p>Each correct champion pick scores a big bonus at season end (default +25 each).</p>
          </F1CardContent>
        </F1Card>

        <F1Card>
          <F1CardHeader><F1CardTitle className="text-base">Leagues</F1CardTitle></F1CardHeader>
          <F1CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Everyone joins the global league. Create your own public or private leagues and invite friends. Leagues carry across seasons, but every season keeps its own points and leaderboard.</p>
          </F1CardContent>
        </F1Card>
      </div>
    </div>
  );
}
