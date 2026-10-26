import fs from 'node:fs';
import path from 'node:path';
import { renderFirebaseConfig } from './firebase-runtime.mjs';
import { optimizeAsset } from './optimize-assets.mjs';

// Old download URLs are generated from the canonical sources; no second files to edit.
export const assetAliases = Object.fromEntries([
  ...['armi', 'bestiario', 'npc'].map(name => [`database_${name}.json`, `data/database_${name}.json`]),
  ...['brancalonia', 'naruto', 'pokemon', 'sw5e'].map(name => [`${name}.js`, `js/sheets/${name}.js`]),
]);

export function staticAssets(root = process.cwd(), options = {}) {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'config/firebase.web.json'), 'utf8'));
  const runtimeConfig = () => renderFirebaseConfig(metadata, options.firebaseApiKey);
  const configPath = 'js/firebase-config.js';
  return {
    name: 'compendium-static-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = new URL(req.url || '/', 'http://localhost').pathname.slice(1);
        if (name === configPath) {
          try {
            res.setHeader('Content-Type', 'text/javascript');
            res.setHeader('Cache-Control', 'no-store');
            return res.end(runtimeConfig());
          } catch (error) { return next(error); }
        }
        const source = Object.hasOwn(assetAliases, name) ? assetAliases[name] : null;
        if (!source) return next();
        res.setHeader('Content-Type', name.endsWith('.json') ? 'application/json' : 'text/javascript');
        fs.createReadStream(path.join(root, source)).on('error', next).pipe(res);
      });
    },
    generateBundle() {
      const sources = new Map();
      const config = runtimeConfig();
      const emit = relative => {
        if (relative === configPath) return;
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
      for (const relative of ['audio', 'css', 'data', 'img', 'js', 'schede', 'admin.html']) emit(relative);
      this.emitFile({ type: 'asset', fileName: configPath, source: config });
      for (const [fileName, canonical] of Object.entries(assetAliases)) {
        this.emitFile({ type: 'asset', fileName, source: sources.get(canonical) });
      }
    },
  };
}
