import { minifySync } from 'rolldown/utils';

export function optimizeAsset(fileName, source) {
  if (fileName.endsWith('.js')) {
    // Preserve globals, property keys and function names used by classic scripts and inline handlers.
    const result = minifySync(fileName, source.toString('utf8'), {
      module: false, compress: false, mangle: { toplevel: false, keepNames: true },
      codegen: { removeWhitespace: true, legalComments: 'inline' },
    });
    if (result.errors.length) throw new Error(`Impossibile ottimizzare ${fileName}.`);
    return Buffer.from(result.code);
  }
  if (fileName.endsWith('.json')) return Buffer.from(JSON.stringify(JSON.parse(source.toString('utf8'))) + '\n');
  return source;
}
