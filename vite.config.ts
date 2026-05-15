/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-icon.svg'],
        manifest: {
          name: 'MathDigitizer Pro',
          short_name: 'MathPro',
          description: 'Напредна платформа за дигитализација и учење математика',
          theme_color: '#4f46e5',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-icon.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'pwa-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            },
            {
              src: 'pwa-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallbackDenylist: [/^\/api/, /^\/__\//],
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      manifest: true,
      rolldownOptions: {
        output: {
          codeSplitting: true,
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('react')) {
              return 'vendor-react-core';
            }

            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }

            if (id.includes('@google/genai')) {
              return 'vendor-ai';
            }

            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }

            if (id.includes('/d3-') || id.includes('/d3/')) {
              return 'vendor-d3';
            }

            if (id.includes('katex')) {
              return 'vendor-katex';
            }

            if (id.includes('mathlive')) {
              return 'vendor-mathlive';
            }

            if (id.includes('remark-math') || id.includes('rehype-katex')) {
              return 'vendor-markdown-math';
            }

            if (id.includes('jspdf')) {
              return 'vendor-jspdf';
            }

            if (id.includes('html2canvas')) {
              return 'vendor-html2canvas';
            }

            if (id.includes('pdfjs-dist')) {
              return 'vendor-pdfjs';
            }

            if (id.includes('docx')) {
              return 'vendor-docx';
            }

            if (id.includes('mammoth')) {
              return 'vendor-mammoth';
            }

            if (id.includes('react-konva') || id.includes('konva')) {
              return 'vendor-konva';
            }

            if (id.includes('jsxgraph')) {
              return 'vendor-jsxgraph';
            }

            const pkgMatch = id.match(/node_modules\/(?:\.pnpm\/)?(@?[^\/]+(?:\/[^\/]+)?)/);
            const pkgName = pkgMatch?.[1]?.replace('@', '').replace('/', '-') || 'misc';
            return `vendor-${pkgName}`;
          },
        },
      },
    },
  };
});
