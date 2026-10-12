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
// index.html + matching chunks. A session flag prevents a reload loop; it is
// cleared only after the page has stayed up for 10 s, so a permanently missing
// chunk (which fails again right after the reload) cannot loop.
if (typeof window !== "undefined") {
  const RELOAD_FLAG = "vite-preload-reloaded";
  window.addEventListener("vite:preloadError", (e) => {
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    e.preventDefault();
    window.location.reload();
  });
  // Chunks matched and the page survived — let a future deploy trigger its own
  // one-shot reload.
  window.addEventListener("load", () => {
    window.setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 10_000);
  });
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
    <SpeedInsights />
  </>,
);
