/// <reference types='vitest' />
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Backend used by the dev server proxy (pnpm dev runs both).
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 4200,
    host: 'localhost',
    proxy: { '/api': { target: API_URL, changeOrigin: true } },
  },
  preview: {
    port: 4200,
    host: 'localhost',
    proxy: { '/api': { target: API_URL, changeOrigin: true } },
  },
  plugins: [
    // Must run before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Mi consulta',
        short_name: 'Mi consulta',
        description: 'Registro de pacientes para nutricionistas',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1d6b5c',
        background_color: '#f3f6f4',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // API responses contain health data: never serve /api from the
        // service worker or let the SPA fallback swallow API routes.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
  define: {
    'import.meta.vitest': undefined,
  },
  test: {
    name: 'web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
