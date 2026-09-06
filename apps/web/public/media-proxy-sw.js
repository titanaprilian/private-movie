/**
 * Service Worker for Media Relay Sandbox
 * 
 * This Service Worker intercepts requests to videobello.net, skylayer64.online,
 * cloudremux.online, cloudflow, streamflow, and medialayer domains and routes them through
 * our backend relay to apply the required Referer header.
 * 
 * This allows BelloCloud video streams to bypass CDN restrictions and play
 * seamlessly in the local environment.
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

// Fetch event - intercept and relay targeted requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if this request should be intercepted
  const shouldIntercept =
    url.hostname.includes('videobello.net') ||
    url.hostname.includes('skylayer64.online') ||
    url.hostname.includes('cloudremux.online') ||
    url.hostname.includes('cloudflow') ||
    url.hostname.includes('streamflow') ||
    url.hostname.includes('medialayer');

  if (!shouldIntercept) {
    // If not targeted, return immediately and do NOT call event.respondWith()
    // so the browser handles standard API requests, uploads, and assets natively.
    return;
  }

  console.log('[Service Worker] Intercepting:', url.href);
  
  // Route through our backend relay
  event.respondWith(
    (async () => {
      try {
        // Construct relay URL
        const relayUrl = `/api/media/relay?url=${encodeURIComponent(url.href)}`;
        
        // Build headers to forward
        const headers = new Headers();
        
        // Forward all headers from the original request except unsafe ones
        for (const [key, value] of event.request.headers.entries()) {
          const lowerKey = key.toLowerCase();
          // Don't forward host, origin, referer, or cookies - let the backend handle these securely
          if (!['host', 'origin', 'referer', 'cookie'].includes(lowerKey)) {
            headers.set(key, value);
          }
        }
        
        // Build fetch options
        const fetchOptions = {
          method: event.request.method,
          headers: headers,
          credentials: 'omit',
        };

        // If the request has a body (POST, PUT, PATCH), we must forward it
        if (['POST', 'PUT', 'PATCH'].includes(event.request.method.toUpperCase())) {
           // Use arrayBuffer to safely copy the data, some browsers struggle to pipe ReadableStreams
           fetchOptions.body = await event.request.clone().arrayBuffer();
        }

        // Make the relay request
        const response = await fetch(relayUrl, fetchOptions);
        
        console.log(
          '[Service Worker] Relay response:',
          response.status,
          response.statusText
        );
        
        // We must return a synthetically constructed Response. 
        // If we return the raw fetch() response, the browser updates the 
        // resolved URL of the script module to the backend relay URL.
        // That breaks relative ES imports (Dynamic chunks like ./chunks/...).
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch (error) {
        console.error('[Service Worker] Relay failed:', error);
        // Return error response
        return new Response('Service Worker relay failed', {
          status: 502,
          statusText: 'Bad Gateway',
        });
      }
    })()
  );
});
