import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import type { ProxyOptions } from 'vite';
import { resolveVersion } from "./scripts/semver.mjs";

// Same resolver as scripts/generate-version.mjs (never throws; falls back to package.json).
const appInfo = resolveVersion({ cwd: import.meta.dirname });

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const devProxy: Record<string, ProxyOptions> = {
    '/api/openf1': {
      target: 'https://api.openf1.org/v1',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/openf1/, ''),
      secure: false, // Accept self-signed certificates if needed
      configure: (proxy, _options) => {
        proxy.on('error', (err, _req, _res) => {
          console.log('proxy error', err);
        });
        proxy.on('proxyReq', (proxyReq, req, _res) => {
          console.log('Sending Request to the Target:', req.method, req.url);
        });
        proxy.on('proxyRes', (proxyRes, req, _res) => {
          console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
        });
      }
    },
    '/api/ergast': {
      target: 'https://api.jolpi.ca/ergast',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/ergast/, ''),
      secure: true,
    }
  };

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: mode === 'development' ? devProxy : undefined
    },
    // Same proxy for `vite preview` so Ergast works (dev uses /api/ergast; preview must too)
    preview: {
      port: 8080,
      proxy: devProxy,
    },
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appInfo.version),
      __APP_SHA__: JSON.stringify(appInfo.sha),
      __APP_REPO_URL__: JSON.stringify(appInfo.repo ?? ""),
      __APP_RELEASED__: JSON.stringify(appInfo.released),
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Match exact package directories (substring matching sent every
            // @radix-ui/react-* and lucide-react into the react chunk). Only
            // the framework core is pinned; everything else follows the default
            // route-based splitting so charts/d3/supabase load with the routes
            // that need them.
            const core = ['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'];
            if (core.some((pkg) => id.includes(`/node_modules/${pkg}/`))) {
              return 'vendor-react';
            }
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
  };
});
