import fs from 'node:fs';
import path from 'node:path';

// Script classici e risorse vengono pubblicati direttamente dai sorgenti canonici.
// Niente cartella public duplicata, né copie obsolete che prevalgono durante il dev.
export function staticAssets(root = process.cwd()) {
  return {
    name: 'compendium-static-assets',
    generateBundle() {
      const emit = (relative) => {
        const absolute = path.join(root, relative);
        if (!fs.existsSync(absolute)) throw new Error(`Risorsa mancante: ${relative}`);
        if (fs.statSync(absolute).isDirectory()) {
          for (const name of fs.readdirSync(absolute)) emit(`${relative}/${name}`);
        } else {
          this.emitFile({ type: 'asset', fileName: relative, source: fs.readFileSync(absolute) });
        }
      };
      for (const relative of ['audio', 'css', 'data', 'img', 'js', 'schede', 'admin.html', 'database_armi.json', 'database_bestiario.json', 'database_npc.json', 'brancalonia.js', 'naruto.js', 'pokemon.js', 'sw5e.js']) emit(relative);
    },
  };
}
