import fs from 'node:fs';
import path from 'node:path';
import { appSources } from '../config/assets.mjs';

// One source list for development, production builds and regression tests.
export function readAppSource(root = process.cwd()) {
  return (
    '"use strict";\n' +
    appSources.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')
  );
}
