import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { generatedAssets } from '../config/assets.mjs';

const run = promisify(execFile);

export function secretLocations(text) {
  const patterns = [
    /AIza[0-9A-Za-z_-]{25,}/g,
    /(?:ghp|github_pat)_[0-9A-Za-z_]{30,}/g,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{32,}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  ];
  return [
    ...new Set(
      patterns.flatMap((pattern) =>
        [...text.matchAll(pattern)].map((match) => text.slice(0, match.index).split('\n').length)
      )
    ),
  ].sort((a, b) => a - b);
}

export function protectedFileReason(file) {
  const name = file.split('/').at(-1).toLowerCase();
  if ((name === '.env' || name.startsWith('.env.')) && name !== '.env.example') {
    return 'File di ambiente riservato: usare .env.example senza valori reali.';
  }
  if (generatedAssets.includes(file.replace(/^public\//, '')) || /^(?:dist|build)\//.test(file)) {
    return 'Configurazione o artefatto generato: mantenerlo fuori da Git.';
  }
  return null;
}

export async function scanRepository(root = process.cwd()) {
  const git = (args) => run('git', args, { cwd: root, encoding: 'utf8' });
  const [{ stdout }, { stdout: staged }] = await Promise.all([
    git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']),
    git(['diff', '--cached', '--name-only', '--diff-filter=ACMRT', '-z']),
  ]);
  const files = new Set(stdout.split('\0').filter(Boolean));
  const issues = new Map();
  const inspect = (file, content, source) => {
    const reason = protectedFileReason(file);
    if (reason) issues.set(`${file}:protected`, { file, line: 1, message: reason, source });
    if (content.includes(0)) return; // Binary assets are not source text.
    for (const line of secretLocations(content.toString('utf8'))) {
      issues.set(`${file}:${line}`, {
        file,
        line,
        message: 'Possibile credenziale versionata.',
        source,
      });
    }
  };
  for (const file of files) {
    const absolute = `${root}/${file}`;
    if (!fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile()) continue;
    inspect(file, fs.readFileSync(absolute), 'working-tree');
  }
  // A clean working copy can differ from the content already staged for commit.
  for (const file of staged.split('\0').filter(Boolean)) {
    const { stdout: content } = await run('git', ['show', `:${file}`], {
      cwd: root,
      encoding: 'buffer',
      maxBuffer: 128 * 1024 * 1024,
    });
    inspect(file, content, 'index');
  }
  return [...issues.values()];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const issues = await scanRepository();
  for (const { file, line, message, source } of issues) {
    // Report locations only; never repeat credential values in logs.
    console.error(`${file}:${line}${source === 'index' ? ' (staged)' : ''}: ${message}`);
  }
  if (issues.length) process.exitCode = 1;
  else console.log('Nessuna credenziale riconosciuta nei file versionabili.');
}
