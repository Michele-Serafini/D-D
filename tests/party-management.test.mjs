import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { staticAssets } from '../scripts/static-assets.mjs';

const code = fs.readFileSync('js/users.js', 'utf8');
const resetCode = fs.readFileSync('js/party-reset.js', 'utf8');
function setup() {
  const error = { style: {}, textContent: '' };
  const ctx = {
    window: {}, state: { currentUser: null }, localStorage: { setItem() {} }, console,
    setTimeout, clearTimeout, setInterval, URLSearchParams,
    document: { getElementById(id) { return id === 'login-error' ? error : null; }, querySelector() { return null; }, addEventListener() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  vm.runInContext(resetCode, ctx);
  vm.runInContext(fs.readFileSync('js/party-admin.js', 'utf8'), ctx);
  return { ctx, manager: ctx.UserManager, reset: ctx.PartyReset, error };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('reset removes only party data, preserves catalogs and archives personal maps', () => {
  const { ctx, reset } = setup();
  const old = { users: { Old: { password: 'old', role: 'DM', mappa: { url: 'map' }, worldbuilding: ['story'] } },
    schedePG: { Old: { chars: { hero: {} }, companions: { wolf: {} } } }, presence: { Old: true },
    libri: { books: { b: { title: 'Libro', file: 'pdf' } } },
    state: { pet: ['wolf'], armi: ['sword'], bestiario: ['dragon'], personaggi: ['npc'], mappa: { url: 'world' } },
    dmConfig: { apiKeys: { secret: 'preserve' } }, meta: { another: 1 } };
  const original = JSON.stringify(old);
  const next = reset.plan(old, ctx.DEFAULT_USERS);
  assert.equal(JSON.stringify(old), original, 'the input snapshot is immutable');
  assert.deepEqual(Object.keys(next.users), ['sebastiano', 'michele', 'montre', 'alessio']);
  assert.equal(next.users.sebastiano.password, 'dungeonmaster');
  for (const name of ['michele', 'montre', 'alessio']) assert.equal(next.users[name].password, 'player');
  assert.equal(next.schedePG, undefined);
  assert.equal(next.presence, undefined);
  assert.equal(next.state.pet, undefined);
  for (const key of ['libri', 'dmConfig']) assert.deepEqual(next[key], old[key]);
  for (const key of ['armi', 'bestiario', 'personaggi', 'mappa']) assert.deepEqual(next.state[key], old.state[key]);
  assert.deepEqual(plain(next.state.legacyUserContent.Old), { mappa: { url: 'map' }, worldbuilding: ['story'] });
  assert.equal(next.meta.another, 1);
  assert.equal(reset.plan(next, ctx.DEFAULT_USERS), null, 'a second reset cannot delete new player data');
});

test('login checks the current database; disabled/deleted defaults never return', async () => {
  const { ctx, manager, error } = setup();
  let record = { password: 'changed', role: 'Giocatore' }, signedIn = [];
  ctx._db = { ref() { return { once: async () => ({ val: () => record ? { michele: record } : {} }) }; } };
  manager.completeLogin = (name, value) => signedIn.push({ name, value });
  await manager.signIn(' MICHELE ', 'changed');
  assert.equal(signedIn.length, 1);
  assert.equal(signedIn[0].name, 'michele');
  await manager.signIn('michele', 'player');
  assert.equal(signedIn.length, 1, 'seed password must not override changed password');
  record = { password: 'changed', disabled: true };
  await manager.signIn('michele', 'changed');
  record = null;
  await manager.signIn('michele', 'player');
  assert.equal(signedIn.length, 1, 'disabled/deleted seeded users cannot log in');
  assert.match(error.textContent, /errati/);
  await manager.signIn('admin', 'wrong');
  assert.equal(signedIn.length, 1);
  await manager.signIn('admin', 'admin');
  assert.equal(signedIn[1].name, 'admin');
  assert.equal(signedIn[1].value.role, 'Admin');
  assert.equal(manager.normalizeUsername(' Alessio '), 'alessio');
  assert.throws(() => manager.normalizeUsername('a/b'));
});

test('admin player lifecycle rejects duplicates, protects master and revokes a removed session', async () => {
  const { ctx, manager } = setup();
  let users = { sebastiano: { role: 'DM', password: 'dungeonmaster' } }, listener;
  ctx._db = { ref(path) {
    return {
      transaction: async update => {
        const next = update(structuredClone(path === 'users' ? users : users[path.split('/')[1]]));
        if (next === undefined) return { committed: false };
        if (path === 'users') users = next;
        else users[path.split('/')[1]] = next;
        return { committed: true };
      },
      on(event, callback) { listener = callback; },
    };
  } };
  await assert.rejects(manager.addPlayer('new', 'player'), /riservato/);
  ctx._authRole = 'admin';
  await manager.addPlayer(' Nuovo ', 'player');
  assert.equal(users.nuovo.role, 'Giocatore');
  assert.equal(users.nuovo.dmPriv, false);
  await assert.rejects(manager.addPlayer('NUOVO', 'other'), /presente/);
  await assert.rejects(manager.removePlayer('sebastiano'), /solo i giocatori/);
  users.nuovo.worldbuilding = ['keep'];
  await manager.removePlayer('nuovo');
  assert.equal(users.nuovo.disabled, true);
  assert.equal(users.nuovo.password, undefined);
  assert.deepEqual(users.nuovo.worldbuilding, ['keep']);
  ctx.state.currentUser = { username: 'nuovo' };
  let revoked = 0;
  manager.signOut = () => revoked++;
  manager.watchUsers();
  listener({ val: () => users });
  assert.equal(revoked, 1);
  assert.equal(manager.getAllUsers().some(u => u.username === 'nuovo'), false);
});

test('production assets include admin page and all canonical data, images, scripts and sheets', () => {
  const emitted = new Map();
  staticAssets().generateBundle.call({ emitFile(asset) { emitted.set(asset.fileName, asset.source); } });
  for (const name of ['admin.html', 'js/users.js', 'js/party-admin.js', 'js/party-reset.js', 'data/catalog-data.js', 'database_armi.json', 'css/legacy.css', 'img/login_mobile.jpg', 'schede/7th_sea.webp']) {
    assert.ok(emitted.has(name), `${name} is published`);
    assert.deepEqual(emitted.get(name), fs.readFileSync(name));
  }
  assert.equal(fs.existsSync('public/js/users.js'), false, 'no second account source');
});

test('password changes compare the current server record and preserve personal content', async () => {
  const { ctx, manager } = setup();
  let record = { password: 'current', role: 'Giocatore', worldbuilding: ['keep'] };
  ctx._db = { ref() { return { transaction: async update => {
    const next = update(structuredClone(record));
    if (next === undefined) return { committed: false };
    record = next;
    return { committed: true };
  } }; } };
  await assert.rejects(manager.changePassword('michele', 'current', 'changed'), /Accedi/);
  ctx.state.currentUser = { username: 'michele' };
  await assert.rejects(manager.changePassword('michele', 'player', 'changed'), /attuale/);
  assert.equal(record.password, 'current');
  await manager.changePassword('michele', 'current', 'changed');
  assert.equal(record.password, 'changed');
  assert.deepEqual(record.worldbuilding, ['keep']);
  record.disabled = true;
  await assert.rejects(manager.changePassword('michele', 'changed', 'new-password'), /rimosso/);
});
