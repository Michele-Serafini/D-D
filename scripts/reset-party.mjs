import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = { window: {}, document: {}, localStorage: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/users.js'), 'utf8'), context);
// Il file browser non è un modulo: valutarlo senza dipendenze Firebase.
const resetContext = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/party-reset.js'), 'utf8'), resetContext);
const { plan, version } = resetContext.module.exports;
const url = new URL(context.FIREBASE_CONFIG.databaseURL + '/.json');
if (process.env.PARTY_DATABASE_TOKEN) url.searchParams.set('auth', process.env.PARTY_DATABASE_TOKEN);
try {
  const response = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Lettura Firebase rifiutata: HTTP ${response.status}`);
  const current = await response.json();
  const next = plan(current, context.DEFAULT_USERS);
  if (!next) { console.log('Reset già eseguito; nessuna modifica.'); process.exit(0); }
  console.log('Piano: 4 account, schedePG, presence e state/pet vuoti. Tutti gli altri nodi conservati.');
  if (!process.argv.includes('--apply')) { console.log('Nessuna modifica. Aggiungi --apply per applicare il piano.'); process.exit(0); }
  const etag = response.headers.get('etag');
  if (!etag) throw new Error('ETag assente: reset annullato per evitare sovrascritture concorrenti.');
  const backupDir = path.join(root, 'work/party-backups');
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backup = path.join(backupDir, Date.now() + '.json');
  fs.writeFileSync(backup, JSON.stringify(current, null, 2), { mode: 0o600 });
  const write = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify(next), signal: AbortSignal.timeout(15000) });
  if (write.status === 412) throw new Error('Il database è cambiato: nessun reset applicato. Ripeti il comando.');
  if (!write.ok) throw new Error(`Scrittura Firebase rifiutata: HTTP ${write.status}`);
  // Controllo locale del piano; la risposta al PUT conferma lo stato scritto.
  const written = await write.json();
  if (written?.meta?.partyResetVersion !== version || Object.keys(written.users || {}).length !== 4 || written.schedePG || written.state?.pet) throw new Error('Verifica del reset fallita. Il backup è disponibile in work/party-backups.');
  console.log('Reset verificato. Backup privato salvato in work/party-backups.');
} catch (error) {
  console.error('Reset non completato:', error.message, error.cause?.code || '');
  process.exitCode = 1;
}
