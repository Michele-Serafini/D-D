import { defineConfig, loadEnv } from 'vite';
import { staticAssets } from './scripts/static-assets.mjs';
import { buildTargets, cssCompilerOptions } from './config/browsers.mjs';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'FIREBASE_');
  const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY || env.FIREBASE_WEB_API_KEY;
  return {
    publicDir: false as const,
    css: { transformer: 'lightningcss', lightningcss: cssCompilerOptions },
    plugins: [staticAssets(process.cwd(), { firebaseApiKey })],
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      copyPublicDir: false,
      target: buildTargets,
      cssTarget: buildTargets,
      cssMinify: 'lightningcss',
      rolldownOptions: { input: { main: resolve('index.html'), admin: resolve('admin.html') } },
    },
  };
});
