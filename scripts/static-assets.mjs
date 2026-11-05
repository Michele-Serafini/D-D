import fs from 'node:fs';
import path from 'node:path';
import { renderFirebaseConfig } from './firebase-runtime.mjs';
import { optimizeAsset } from './optimize-assets.mjs';
import { appSources } from '../config/assets.mjs';
import { readAppSource } from './app-source.mjs';
import { renderServiceWorker } from './pwa-assets.mjs';

// Old download URLs are generated from the canonical sources; no second files to edit.
export const assetAliases = Object.fromEntries([
  ...['armi', 'bestiario', 'npc'].map((name) => [
    `database_${name}.json`,
    `data/database_${name}.json`,
  ]),
  ...['brancalonia', 'naruto', 'pokemon', 'sw5e'].map((name) => [
    `${name}.js`,
    `js/sheets/${name}.js`,
  ]),
]);
export const vendorAssets = Object.fromEntries(
  [
    'leaflet.js',
    'leaflet.css',
    'images/layers.png',
    'images/layers-2x.png',
    'images/marker-icon.png',
    'images/marker-icon-2x.png',
    'images/marker-shadow.png',
  ].map((file) => ['vendor/leaflet/' + file, 'node_modules/leaflet/dist/' + file])
);

export function staticAssets(root = process.cwd(), options = {}) {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'config/firebase.web.json'), 'utf8'));
  const runtimeConfig = () => renderFirebaseConfig(metadata, options.firebaseApiKey);
  const configPath = 'js/firebase-config.js';
  const appPath = 'js/app.js';
  let base = '/';
  return {
    name: 'compendium-static-assets',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // SW-controlled WebKit frames can bypass Playwright request interception.
        // Test builds use the injected SDK fixture and must never load a real SDK.
        if (options.browserTest)
          html = html.replace(
            /<script\b[^>]*src="https:\/\/www\.gstatic\.com\/firebasejs\/[^\"]+"[^>]*>\s*<\/script>/g,
            ''
          );
        if (ctx.filename.endsWith('admin.html')) return html;
        return {
          html,
          tags: [
            {
              tag: 'link',
              attrs: { rel: 'manifest', href: base + 'manifest.webmanifest' },
              injectTo: 'head',
            },
            {
              tag: 'link',
              attrs: { rel: 'apple-touch-icon', href: base + 'pwa/icon-180.png' },
              injectTo: 'head',
            },
            { tag: 'meta', attrs: { name: 'theme-color', content: '#120d09' }, injectTo: 'head' },
            {
              tag: 'meta',
              attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' },
              injectTo: 'head',
            },
          ],
        };
      },
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = new URL(req.url || '/', 'http://localhost').pathname.slice(1);
        if (name === 'sw.js') {
          res.setHeader('Content-Type', 'text/javascript');
          res.setHeader('Cache-Control', 'no-store');
          return res.end(renderServiceWorker(root));
        }
        if (name === configPath || name === appPath) {
          try {
            res.setHeader('Content-Type', 'text/javascript');
            res.setHeader('Cache-Control', 'no-store');
            return res.end(name === configPath ? runtimeConfig() : readAppSource(root));
          } catch (error) {
            return next(error);
          }
        }
        const source = Object.hasOwn(assetAliases, name)
          ? assetAliases[name]
          : Object.hasOwn(vendorAssets, name)
            ? vendorAssets[name]
            : null;
        if (!source) return next();
        res.setHeader(
          'Content-Type',
          name.endsWith('.json')
            ? 'application/json'
            : name.endsWith('.css')
              ? 'text/css'
              : name.endsWith('.png')
                ? 'image/png'
                : 'text/javascript'
        );
        fs.createReadStream(path.join(root, source)).on('error', next).pipe(res);
      });
    },
    generateBundle() {
      const sources = new Map();
      const config = runtimeConfig();
      const emit = (relative) => {
        if (relative === configPath || relative === appPath || appSources.includes(relative))
          return;
        const absolute = path.join(root, relative);
        if (!fs.existsSync(absolute)) throw new Error(`Risorsa mancante: ${relative}`);
        if (fs.statSync(absolute).isDirectory()) {
          for (const name of fs.readdirSync(absolute)) emit(`${relative}/${name}`);
        } else {
          const original = fs.readFileSync(absolute);
          const source = options.optimize === false ? original : optimizeAsset(relative, original);
          sources.set(relative, source);
          this.emitFile({ type: 'asset', fileName: relative, source });
        }
      };
      for (const relative of [
        'audio',
        'css',
        'data',
        'img',
        'js',
        'schede',
        'pwa',
        'offline.html',
        'manifest.webmanifest',
      ])
        emit(relative);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: renderServiceWorker(root) });
      // The source-integrity check can still inspect the unprocessed admin page.
      if (options.optimize === false) emit('admin.html');
      this.emitFile({ type: 'asset', fileName: configPath, source: config });
      const app = Buffer.from(readAppSource(root));
      this.emitFile({
        type: 'asset',
        fileName: appPath,
        source: options.optimize === false ? app : optimizeAsset(appPath, app),
      });
      for (const [fileName, canonical] of Object.entries(assetAliases)) {
        this.emitFile({ type: 'asset', fileName, source: sources.get(canonical) });
      }
      for (const [fileName, canonical] of Object.entries(vendorAssets)) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: fs.readFileSync(path.join(root, canonical)),
        });
      }
    },
  };
}
