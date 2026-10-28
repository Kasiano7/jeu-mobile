import { defineConfig, type Plugin } from 'vite';

/**
 * Absolute site URL for social previews (og:image must be absolute for most scrapers).
 * Set SITE_URL, or let Vercel provide VERCEL_PROJECT_PRODUCTION_URL; falls back to relative URLs.
 */
function siteUrl(): string {
  const raw = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return raw ? raw.replace(/\/?$/, '/') : './';
}

/** Loud reminder: the legal notice is mandatory for a public site in France. */
const legalCheck = (): Plugin => ({
  name: 'legal-check',
  apply: 'build',
  buildStart() {
    if (!process.env.VITE_LEGAL_PUBLISHER || !process.env.VITE_LEGAL_CONTACT) {
      this.warn(
        'Mentions légales incomplètes : définir VITE_LEGAL_PUBLISHER et VITE_LEGAL_CONTACT (variables d\'environnement Vercel) avant la mise en ligne publique.',
      );
    }
  },
});

const htmlSiteUrl = (): Plugin => ({
  name: 'html-site-url',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl()),
});
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // Relative base keeps the build usable from Vercel, a sub-path or a Capacitor webview.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    legalCheck(),
    htmlSiteUrl(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Money Machine',
        short_name: 'Money Machine',
        description: 'Idle money drop & factory game',
        theme_color: '#1b0f3b',
        background_color: '#1b0f3b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['og-image.png'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
