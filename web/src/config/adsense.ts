/**
 * AdSense client + slot IDs from env (Vite `VITE_*`).
 * Units render only when client id and slot id are set.
 */
export {
  adsenseClientId as ADSENSE_CLIENT_ID,
  adsenseSlots,
  isAdSenseEnabled,
} from "@/config/integrations";
