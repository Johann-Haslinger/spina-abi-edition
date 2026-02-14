self.addEventListener('install', (event) => {
  // No precaching — keep it simple.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Registering a fetch handler helps browsers consider the app "installable",
// but we intentionally do not implement offline caching here.
self.addEventListener('fetch', () => {})

