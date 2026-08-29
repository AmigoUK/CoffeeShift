import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
        display: 'standalone',
        orientation: 'portrait',
        icons: [],
      },
    }),
  ],
  server: { host: true, port: 5173 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
