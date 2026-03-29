import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { ProxyOptions } from 'vite';

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
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
