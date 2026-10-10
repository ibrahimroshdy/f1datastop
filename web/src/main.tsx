import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { bootstrapThirdPartyScripts } from '@/integrations/bootstrapThirdParty'
import { registerServiceWorker } from '@/lib/pwa'
import App from './App.tsx'
import './index.css'

bootstrapThirdPartyScripts()
registerServiceWorker()

// Stale-deploy recovery: after a new deploy, an already-open tab's cached
// index.html references old chunk hashes that 404 (the server SPA-falls-back to
// HTML → "Failed to load module script / MIME text/html"). Vite fires
// `vite:preloadError` on such a failure — reload ONCE to pull the fresh
// index.html + matching chunks. A session flag prevents a reload loop.
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (e) => {
    if (sessionStorage.getItem("vite-preload-reloaded")) return;
    sessionStorage.setItem("vite-preload-reloaded", "1");
    e.preventDefault();
    window.location.reload();
  });
  // A clean load means chunks matched — clear the flag so a future deploy can
  // trigger its own one-shot reload.
  window.addEventListener("load", () => {
    sessionStorage.removeItem("vite-preload-reloaded");
  });
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
    <SpeedInsights />
  </>,
);
