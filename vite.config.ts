import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };
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
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
