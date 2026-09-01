/**
 * Service Worker for Media Relay Sandbox
 * 
 * This Service Worker intercepts requests to videobello.net and skylayer64.online
 * and routes them through our backend relay to apply the required Referer header.
 * 
 * NOTE: At this stage, actual interception logic is not yet implemented.
 * This is a bootstrap stub that registers successfully and claims clients.
 * Ticket #2 will implement the actual fetch interception and relay logic.
 */

// Install event - cache nothing for now
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - claim all clients immediately
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    // Claim all clients so the SW controls the page immediately
    self.clients.claim()
  );
});

// Message handler for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLAIM_CLIENTS') {
    console.log('[Service Worker] Claiming clients...');
    event.waitUntil(self.clients.claim());
  }
});

// Fetch event - pass through for now (no interception yet)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // TODO (Ticket #2): Intercept videobello.net and skylayer64.online requests
  // and route them through /api/media/relay
  // For now, just pass through all requests unchanged
  
  // Log requests to the domains we'll eventually intercept
  if (url.hostname.includes('videobello.net') || url.hostname.includes('skylayer64.online')) {
    console.log('[Service Worker] Would intercept:', url.href);
    // TODO: Implement relay logic here in ticket #2
  }
  
  // Pass through - no interception yet
  event.respondWith(fetch(event.request));
});
