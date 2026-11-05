import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const offlineFiles = [
  'offline.html',
  'manifest.webmanifest',
  'pwa/offline.css',
  'pwa/icon-180.png',
  'pwa/icon-192.png',
  'pwa/icon-512.png',
  'js/pwa/offline-store.js',
  'js/pwa/install.js',
  'js/pwa/reader.js',
];
export function renderServiceWorker(root) {
  const hash = createHash('sha256');
  for (const file of offlineFiles) hash.update(fs.readFileSync(path.join(root, file)));
  const template = fs.readFileSync(path.join(root, 'scripts/service-worker-template.js'), 'utf8');
  hash.update(template);
  return template
    .replace('__OFFLINE_VERSION__', hash.digest('hex').slice(0, 16))
    .replace('__OFFLINE_FILES__', JSON.stringify(offlineFiles));
}
