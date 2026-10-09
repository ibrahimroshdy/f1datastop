import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { F1ErrorState } from "@/components/f1";

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
        <F1ErrorState
          variant="fullscreen"
          title="Something went wrong"
          message="An unexpected error occurred. Reloading usually fixes it."
          onRetry={() => window.location.reload()}
          className="min-h-0"
        />
        <div className="flex gap-2">
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
