import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Per-service dev proxy targets.
 * Each is overridable via .env (e.g. VITE_PROXY_CORE=http://localhost:3100).
 * Override in .env.local for staging/remote service URLs.
 */
const PROXY_SERVICES = [
  { path: '/api/v1/seo', envKey: 'VITE_PROXY_SEO', defaultHost: 'http://localhost:3101' },
  { path: '/api/v1/content', envKey: 'VITE_PROXY_CONTENT', defaultHost: 'http://localhost:3102' },
  { path: '/api/v1/campaign', envKey: 'VITE_PROXY_CAMPAIGN', defaultHost: 'http://localhost:3103' },
  { path: '/api/v1/analytics', envKey: 'VITE_PROXY_ANALYTICS', defaultHost: 'http://localhost:3104' },
  { path: '/api/v1/social', envKey: 'VITE_PROXY_SOCIAL', defaultHost: 'http://localhost:3105' },
  { path: '/api/v1/email', envKey: 'VITE_PROXY_EMAIL', defaultHost: 'http://localhost:3106' },
  { path: '/api/v1/intelligence', envKey: 'VITE_PROXY_INTELLIGENCE', defaultHost: 'http://localhost:3107' },
  { path: '/api/v1/affiliate', envKey: 'VITE_PROXY_AFFILIATE', defaultHost: 'http://localhost:3108' },
  { path: '/api/v1/influencer', envKey: 'VITE_PROXY_INFLUENCER', defaultHost: 'http://localhost:3109' },
  { path: '/api/v1/crm', envKey: 'VITE_PROXY_CRM', defaultHost: 'http://localhost:3110' },
  { path: '/api/v1/media', envKey: 'VITE_PROXY_MEDIA', defaultHost: 'http://localhost:3111' },
  { path: '/api/v1/notification', envKey: 'VITE_PROXY_NOTIFICATION', defaultHost: 'http://localhost:3112' },
  { path: '/api/v1/integration', envKey: 'VITE_PROXY_INTEGRATION', defaultHost: 'http://localhost:3113' },
  // Catch-all → marketing-core. MUST come last so the prefixes above match first.
  { path: '/api', envKey: 'VITE_PROXY_CORE', defaultHost: 'http://localhost:3100' },
] as const;

export default defineConfig(({ mode }) => {
  // Load .env / .env.local / .env.<mode>. Pass '' so we get every key, not just VITE_*-prefixed ones.
  const env = loadEnv(mode, process.cwd(), '');

  const proxy = Object.fromEntries(
    PROXY_SERVICES.map((svc) => [
      svc.path,
      { target: env[svc.envKey] || svc.defaultHost, changeOrigin: true },
    ]),
  );

  const port = Number(env.VITE_DEV_PORT) || 3000;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port,
      proxy,
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            redux: ['@reduxjs/toolkit', 'react-redux'],
          },
        },
      },
    },
  };
});
