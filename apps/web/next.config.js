//@ts-check

const path = require('path');
const withPWAInit = require('@ducanh2912/next-pwa').default;

/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  // The app lives at apps/web within the repo; point Next's file tracer at the
  // repo root so it correctly resolves the @pitchpredict/* libs under libs/.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

const withPWA = withPWAInit({
  dest: 'public',
  // Disable the service worker in development to avoid caching headaches.
  disable: process.env.NODE_ENV === 'development',
  register: true,
  // Precache the app shell so it loads instantly offline.
  cacheStartUrl: true,
  dynamicStartUrl: true,
  reloadOnOnline: true,
  // Serve the offline fallback when a navigation request fails.
  fallbacks: {
    document: '/offline.html',
  },
  workboxOptions: {
    // App-shell precache: handled automatically from the build manifest.
    runtimeCaching: [
      {
        // Network-first for BFF proxy GET requests so live data stays fresh,
        // falling back to the cache when offline.
        urlPattern: ({ url, request, sameOrigin }) =>
          sameOrigin &&
          request.method === 'GET' &&
          url.pathname.startsWith('/api/proxy'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pitchpredict-proxy',
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

module.exports = withPWA(nextConfig);
