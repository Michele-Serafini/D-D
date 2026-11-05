import fs from 'node:fs';
import path from 'node:path';

export const catalogSources = {
  SRD_OGGETTI: 'data/database_armi.json',
  SRD_INCANTESIMI: 'data/database_incantesimi.json',
  SRD_BESTIARIO: 'data/database_bestiario.json',
  DATABASE_NPC_DEFAULT: 'data/database_npc.json',
};
export const catalogPath = 'data/catalog-data.js';

// JSON files are the only editable catalogs. Both Vite modes generate the same script.
export function readCatalogSource(root = process.cwd()) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const values = read('config/catalogs.json');
  for (const [name, file] of Object.entries(catalogSources)) {
    const records = read(file);
    if (!Array.isArray(records)) throw new Error(`Il catalogo ${file} deve essere una lista.`);
    values[name] = records;
  }
  return Object.entries(values)
    .map(([name, value]) => `var ${name} = ${JSON.stringify(value)};`)
    .join('\n');
}
