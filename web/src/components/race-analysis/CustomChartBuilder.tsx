import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Sparkles, Download, LogIn, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { F1Card, F1CardContent, F1CardHeader } from "@/components/f1";
import { useDriverStandings } from "@/hooks/f1";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  CUSTOMIZABLE_CHARTS,
  getRequestState,
  submitChartRequest,
  type ChartRequestState,
} from "@/services/chartRequestService";
import {
  CHART_FORMATS,
  chartFormatOf,
  type AnalysisChart,
  type ChartFormat,
} from "@/services/analysisService";

interface CustomChartBuilderProps {
  year: number;
  round: number;
  session: string;
}

const MAX_DRIVERS = 5;

export default function CustomChartBuilder({ year, round, session }: CustomChartBuilderProps) {
  const { user } = useAuth();
  const { data: standings } = useDriverStandings(year);

  const drivers = useMemo(
    () =>
      ((standings?.data ?? []) as Array<{ Driver: { code: string; givenName: string; familyName: string } }>)
        .map((s) => ({ code: s.Driver?.code, name: `${s.Driver?.givenName} ${s.Driver?.familyName}` }))
        .filter((d) => !!d.code),
    [standings],
  );

  const [chart, setChart] = useState<string>(CUSTOMIZABLE_CHARTS[0].key);
  const [picked, setPicked] = useState<string[]>([]);
  const [state, setState] = useState<ChartRequestState>({ status: "idle" });
  const [fmt, setFmt] = useState<ChartFormat>("landscape");
  const pollRef = useRef<number | null>(null);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => stopPoll, []);

  const reset = () => {
    stopPoll();
    setState({ status: "idle" });
  };

  const toggle = (code: string) => {
    reset();
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : p.length >= MAX_DRIVERS ? p : [...p, code]));
  };

  const busy = state.status === "checking" || state.status === "queued" || state.status === "processing";

  const generate = async () => {
    if (picked.length < 2) return;
    setState({ status: "checking" });
    const res = await submitChartRequest(year, round, session, chart, picked);
    setState(res);
    if (res.status === "queued" || res.status === "processing") {
      stopPoll();
      let tries = 0;
      pollRef.current = window.setInterval(async () => {
        tries += 1;
        const s = await getRequestState(year, round, session, chart, picked);
        setState(s);
        if (s.status === "done" || s.status === "error" || tries > 40) stopPoll();
      }, 5000);
    }
  };

  const shown: AnalysisChart | undefined = useMemo(() => {
    if (state.status !== "done") return undefined;
    return state.charts.find((c) => chartFormatOf(c.chart_type) === fmt) ?? state.charts[0];
  }, [state, fmt]);

  return (
    <F1Card className="overflow-hidden p-0">
      <F1CardHeader className="px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="instrument-label text-foreground">Build a custom chart</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Pick a chart and 2–{MAX_DRIVERS} drivers — we generate it on demand (about a minute).
        </p>
      </F1CardHeader>
      <F1CardContent className="space-y-3 px-4 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={chart}
            onValueChange={(v) => {
              setChart(v);
              reset();
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMIZABLE_CHARTS.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="instrument-label text-muted-foreground">
            {picked.length}/{MAX_DRIVERS} selected
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {drivers.map((d) => {
            const on = picked.includes(d.code);
            const dim = !on && picked.length >= MAX_DRIVERS;
            return (
              <button
                key={d.code}
                type="button"
                onClick={() => toggle(d.code)}
                disabled={dim}
                title={d.name}
                className={cn(
                  "timing rounded-md border px-2 py-1 text-xs font-semibold tabular-nums transition-colors",
                  on
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  dim && "cursor-not-allowed opacity-40",
                )}
              >
                {d.code}
              </button>
            );
          })}
        </div>

        {!user ? (
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/auth/login">
              <LogIn className="mr-1.5 h-4 w-4" /> Sign in to build charts
            </Link>
          </Button>
        ) : (
          <Button onClick={generate} disabled={picked.length < 2 || busy} className="w-full sm:w-auto">
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-4 w-4" /> Generate chart
              </>
            )}
          </Button>
        )}

        {(state.status === "queued" || state.status === "processing") && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            Building your chart — usually under a minute. It appears here automatically.
          </div>
        )}

        {state.status === "error" && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-loss/40 bg-loss/5 px-3 py-2.5 text-xs">
            <span className="text-loss">{state.error}</span>
            <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={generate}>
              <RefreshCw className="mr-1 h-3 w-3" /> Retry
            </Button>
          </div>
        )}

        {state.status === "done" && shown && (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              {CHART_FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFmt(f)}
                  className={cn(
                    "rounded px-2 py-0.5 text-2xs uppercase tracking-wide transition-colors",
                    fmt === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
              <a
                href={shown.public_url}
                download
                className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
            <img
              src={shown.public_url}
              alt="Custom chart"
              className="w-full rounded-lg border border-border"
              loading="lazy"
            />
          </div>
        )}
      </F1CardContent>
    </F1Card>
  );
}
