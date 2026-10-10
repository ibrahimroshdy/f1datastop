// F1 DataStop service worker — installable PWA (no offline precache, no push).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
