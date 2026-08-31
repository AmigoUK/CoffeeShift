import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };
import { VitePWA } from 'vite-plugin-pwa';

// Deploying anywhere other than a domain root needs this set at build time, e.g.
// VITE_BASE=/coffeeshift/ npm run build. It rewrites asset URLs, the service worker
// registration scope and the PWA manifest's start_url together — they must agree.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Coffee Shift',
        short_name: 'Coffee Shift',
        description: 'Learn café-quality coffee, one shift at a time.',
        theme_color: '#6f4e37',
        background_color: '#fdf6ec',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        orientation: 'portrait',
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Set VITE_PREVIEW_HOST when previewing behind a named host; unset means Vite's default.
  preview: process.env.VITE_PREVIEW_HOST != null ? { allowedHosts: [process.env.VITE_PREVIEW_HOST] } : {},
  server: { host: true, port: Number(process.env.VITE_PORT ?? 5173) },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
