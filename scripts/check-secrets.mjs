import fs from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

export function secretLocations(text) {
  const patterns = [
    /AIza[0-9A-Za-z_-]{25,}/g,
    /(?:ghp|github_pat)_[0-9A-Za-z_]{30,}/g,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]{32,}?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
  ];
  return patterns.flatMap(pattern => [...text.matchAll(pattern)].map(match => text.slice(0, match.index).split('\n').length));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {stdout} = await promisify(execFile)('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding:'utf8'});
  const files = new Set(stdout.split('\0').filter(Boolean));
  let failed = false;
  for (const file of files) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile() || !/\.(?:[cm]?js|tsx?|json|html|css|md|ya?ml|example)$/.test(file)) continue;
    for (const line of secretLocations(fs.readFileSync(file, 'utf8'))) {
      // Report locations only; never repeat credential values in logs.
      console.error(`Possibile credenziale versionata: ${file}:${line}`);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
  else console.log('Nessuna credenziale riconosciuta nei file versionabili.');
}
