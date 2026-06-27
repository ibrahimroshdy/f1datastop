import { useEffect, useState } from "react";
import { Plus, Share, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isIOS, isStandalone } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "f1ds_a2hs_dismissed";

/**
 * "Add to Home Screen" nudge. Android/Chromium uses the native install prompt;
 * iOS Safari can't trigger install programmatically, so we show the manual
 * Share -> Add to Home Screen steps. Hidden once installed or dismissed.
 *
 * Rendered as a dismissible bottom card that sits above the mobile bottom nav.
 */
export function AddToHome() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;

  const ios = isIOS();
  if (!ios && !deferred) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    dismiss();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(3.5rem+0.75rem+env(safe-area-inset-bottom))] md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <Card className="pointer-events-auto relative w-full max-w-[420px] border-primary/30 bg-card/95 p-4 shadow-lg backdrop-blur animate-slide-up">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="pr-6 text-sm font-semibold text-foreground">
          Install F1 Data Stop
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Add it to your home screen for a full-screen, app-like experience.
        </p>

        {ios ? (
          <ol className="mt-3 space-y-1.5 text-xs text-foreground">
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold ring-1 ring-border">
                1
              </span>
              Tap the
              <Share
                className="mx-0.5 inline h-4 w-4 text-primary"
                aria-label="Share"
              />
              Share button in Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold ring-1 ring-border">
                2
              </span>
              Scroll down (or tap <strong>More</strong>) in the share sheet
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold ring-1 ring-border">
                3
              </span>
              Choose
              <Plus className="mx-0.5 inline h-4 w-4 text-primary" aria-hidden />
              Add to Home Screen
            </li>
          </ol>
        ) : (
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={() => void install()}
          >
            <Plus className="h-4 w-4" />
            Add to Home Screen
          </Button>
        )}
      </Card>
    </div>
  );
}

export default AddToHome;
