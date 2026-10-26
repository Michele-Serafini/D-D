import fs from 'node:fs';
import path from 'node:path';

// Old download URLs are generated from the canonical sources; no second files to edit.
export const assetAliases = Object.fromEntries([
  ...['armi', 'bestiario', 'npc'].map(name => [`database_${name}.json`, `data/database_${name}.json`]),
  ...['brancalonia', 'naruto', 'pokemon', 'sw5e'].map(name => [`${name}.js`, `js/sheets/${name}.js`]),
]);

export function staticAssets(root = process.cwd()) {
  return {
    name: 'compendium-static-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = new URL(req.url || '/', 'http://localhost').pathname.slice(1);
        const source = Object.hasOwn(assetAliases, name) ? assetAliases[name] : null;
        if (!source) return next();
        res.setHeader('Content-Type', name.endsWith('.json') ? 'application/json' : 'text/javascript');
        fs.createReadStream(path.join(root, source)).on('error', next).pipe(res);
      });
    },
    generateBundle() {
      const sources = new Map();
      const emit = relative => {
        const absolute = path.join(root, relative);
        if (!fs.existsSync(absolute)) throw new Error(`Risorsa mancante: ${relative}`);
        if (fs.statSync(absolute).isDirectory()) {
          for (const name of fs.readdirSync(absolute)) emit(`${relative}/${name}`);
        } else {
          const source = fs.readFileSync(absolute);
          sources.set(relative, source);
          this.emitFile({ type: 'asset', fileName: relative, source });
        }
      };
      for (const relative of ['audio', 'css', 'data', 'img', 'js', 'schede', 'admin.html']) emit(relative);
      for (const [fileName, canonical] of Object.entries(assetAliases)) {
        this.emitFile({ type: 'asset', fileName, source: sources.get(canonical) });
      }
    },
  };
}
