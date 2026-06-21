import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** True when the browser supports Web Push and a VAPID key is configured. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC
  );
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Request permission, subscribe, and persist the subscription server-side. */
export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported() || !VAPID_PUBLIC) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
  });

  const { error } = await supabase.functions.invoke("save-push-subscription", {
    body: { subscription: sub.toJSON(), userAgent: navigator.userAgent },
  });
  if (error) {
    await sub.unsubscribe();
    return false;
  }
  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getPushSubscription();
  if (sub) await sub.unsubscribe();
}
