import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Top-level error boundary. Catches render-phase throws (e.g. an unexpected
 * null/shape from an RPC or a chart) and shows a recovery screen instead of a
 * white page. MUST be a class — function components cannot catch render errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for the console / monitoring; keep the UI recoverable.
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-bold uppercase tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred. Reloading usually fixes it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="min-h-11" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              this.setState({ error: null });
              window.location.assign("/");
            }}
          >
            Go home
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
