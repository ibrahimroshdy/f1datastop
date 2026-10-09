import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { F1Loader } from "@/components/f1";
import {
  pushSupported,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { needsInstallForPush } from "@/lib/pwa";

export function NotificationToggle() {
  const [supported] = useState(() => pushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    getPushSubscription().then((s) => setSubscribed(!!s));
  }, [supported]);

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        {needsInstallForPush()
          ? "Add F1 DataStop to your home screen to enable notifications."
          : "Push notifications aren't supported in this browser."}
      </p>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
        toast.success("Race reminders turned off");
      } else {
        const ok = await subscribeToPush();
        setSubscribed(ok);
        toast[ok ? "success" : "error"](
          ok ? "Race reminders enabled" : "Could not enable notifications",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={subscribed ? "outline" : "default"}
      size="sm"
      onClick={toggle}
      disabled={busy}
    >
      {busy ? (
        <F1Loader size="sm" className="mr-2" />
      ) : subscribed ? (
        <BellOff className="mr-2 h-4 w-4" />
      ) : (
        <Bell className="mr-2 h-4 w-4" />
      )}
      {subscribed ? "Disable race reminders" : "Enable race reminders"}
    </Button>
  );
}

export default NotificationToggle;
