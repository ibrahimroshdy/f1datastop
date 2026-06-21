import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { bootstrapThirdPartyScripts } from '@/integrations/bootstrapThirdParty'
import { registerServiceWorker } from '@/lib/pwa'
import App from './App.tsx'
import './index.css'

bootstrapThirdPartyScripts()
registerServiceWorker()

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
    <SpeedInsights />
  </>,
);
