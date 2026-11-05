import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { historyContext } from './helpers/sheet-history.mjs';
import { renderServiceWorker, offlineFiles } from '../scripts/pwa-assets.mjs';

function memoryStore() {
  const stores = { operations: new Map(), snapshots: new Map(), meta: new Map() };
  let sequence = 0;
  return {
    stores,
    get: async (store, key) => structuredClone(stores[store].get(key)),
    put: async (store, value, key) =>
      stores[store].set(key || value.id || value.scope, structuredClone(value)),
    remove: async (store, key) => stores[store].delete(key),
    operations: async (scope) =>
      [...stores.operations.values()]
        .filter((op) => op.scope === scope)
        .map((op) => structuredClone(op))
        .sort((a, b) => a.order - b.order),
    enqueue: async (op) => {
      op.order = ++sequence;
      stores.operations.set(op.id, structuredClone(op));
    },
  };
}
function setup(values, store = memoryStore()) {
  const ctx = historyContext(values);
  vm.runInContext(fs.readFileSync('js/pwa/offline-store.js', 'utf8'), ctx);
  ctx.OfflineStore = store;
  ctx.navigator = { onLine: true };
  ctx.UserManager = { withTimeout: (value) => value };
  ctx.state.schedeList = [];
  ctx.state.section = 'telefono';
  vm.runInContext(fs.readFileSync('js/features/offline/service.js', 'utf8'), ctx);
  const service = ctx.OfflineSheets;
  Object.assign(service, {
    ready: true,
    connected: false,
    uid: 'alice',
    owner: 'alice',
    scope: 'alice:first',
    campaign: 'first',
  });
  return { ctx, service, store };
}
const initial = () => ({
  schedePG: { alice: { chars: { hero: { nomePersonaggio: 'Aria', hp: 10, oro: 100 } } } },
});

test('offline edits survive a new page, merge unrelated server fields and are removed only after ACK', async () => {
  const values = initial(),
    { service, store } = setup(values);
  await service.stage('alice', 'hero', { hp: 8 }, values.schedePG.alice.chars.hero);
  assert.equal(values.schedePG.alice.chars.hero.hp, 10);
  assert.equal(service.operations.length, 1);
  const next = setup(values, store);
  values.schedePG.alice.chars.hero.oro = 50;
  await next.service.refresh();
  next.service.connected = true;
  await next.service.flush();
  assert.equal(values.schedePG.alice.chars.hero.hp, 8);
  assert.equal(values.schedePG.alice.chars.hero.oro, 50);
  assert.equal((await store.operations('alice:first')).length, 0);
  assert.equal(Object.keys(values.sheetHistory.alice.hero.entries).length, 1);
});
test('a committed operation left on disk is not replayed over a later edit', async () => {
  const values = initial(),
    { service, store, ctx } = setup(values);
  await service.stage('alice', 'hero', { hp: 8 }, values.schedePG.alice.chars.hero);
  const operation = structuredClone(service.operations[0]);
  service.connected = true;
  await service.flush();
  await ctx.SheetHistory.save('alice', 'hero', { hp: 5 });
  await store.put('operations', operation);
  const next = setup(values, store);
  next.service.connected = true;
  await next.service.flush();
  assert.equal(values.schedePG.alice.chars.hero.hp, 5);
  assert.equal(next.service.operations.length, 0);
  assert.equal(Object.keys(values.sheetHistory.alice.hero.entries).length, 2);
});
test('overlapping remote changes stop synchronization until the owner chooses a version', async () => {
  const values = initial(),
    { service } = setup(values);
  await service.stage('alice', 'hero', { hp: 8 }, values.schedePG.alice.chars.hero);
  values.schedePG.alice.chars.hero.hp = 5;
  service.connected = true;
  await service.flush();
  assert.equal(values.schedePG.alice.chars.hero.hp, 5);
  assert.deepEqual(Array.from(service.operations[0].conflicts), ['hp']);
  await service.resolve(service.operations[0].id, true);
  assert.equal(values.schedePG.alice.chars.hero.hp, 8);
  assert.equal(service.operations.length, 0);
});
test('multiple local edits preserve arrival order and failed persistence never reports success', async () => {
  const values = initial(),
    { service, store } = setup(values);
  await service.stage('alice', 'hero', { hp: 9 }, values.schedePG.alice.chars.hero);
  await service.stage('alice', 'hero', { hp: 7 }, { ...values.schedePG.alice.chars.hero, hp: 9 });
  assert.equal(service.overlay('alice', 'hero', values.schedePG.alice.chars.hero).hp, 7);
  assert.equal((await store.operations('other:first')).length, 0);
  service.connected = true;
  await service.flush();
  assert.equal(values.schedePG.alice.chars.hero.hp, 7);
  store.enqueue = async () => {
    throw new Error('quota');
  };
  await assert.rejects(service.stage('alice', 'hero', { hp: 6 }, { hp: 7 }), /quota/);
  assert.equal(service.staging.size, 0);
  assert.equal(service.operations.length, 0);
});
test('service worker precaches only the read-only reader and ignores Firebase/auth requests', async () => {
  const code = renderServiceWorker(process.cwd()),
    handlers = {},
    cache = new Map(),
    names = [];
  let response;
  const ctx = vm.createContext({
    URL,
    Request,
    Set,
    self: {
      registration: { scope: 'https://example.com/D-D/' },
      addEventListener: (name, fn) => (handlers[name] = fn),
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
    },
    caches: {
      open: async () => ({
        put: async (key, value) => cache.set(key.url || key, value),
        match: async (key) => cache.get(key.url || key),
      }),
      keys: async () => ['other-app', 'mercante-reader:/D-D/:old'],
      delete: async (name) => names.push(name),
    },
    fetch: async (request) => ({ ok: true, type: 'basic', url: request.url }),
  });
  vm.runInContext(code, ctx);
  await new Promise((resolve, reject) =>
    handlers.install({ waitUntil: (promise) => promise.then(resolve, reject) })
  );
  assert.equal(cache.size, offlineFiles.length);
  assert.equal(
    [...cache.keys()].some((url) => /firebase|app.js|users.js/.test(url)),
    false
  );
  for (const url of [
    'https://database.firebasedatabase.app/users.json',
    'https://example.com/D-D/admin.html',
    'https://example.com/D-D/js/firebase-config.js',
  ]) {
    handlers.fetch({
      request: { url, method: 'GET', mode: 'cors' },
      respondWith: () => assert.fail('Private resources must bypass the worker'),
    });
  }
  ctx.fetch = async () => {
    throw new Error('offline');
  };
  handlers.fetch({
    request: { url: 'https://example.com/D-D/index.html', method: 'GET', mode: 'navigate' },
    respondWith: (promise) => (response = promise),
  });
  assert.equal((await response).url, 'https://example.com/D-D/offline.html');
  await new Promise((resolve, reject) =>
    handlers.activate({ waitUntil: (promise) => promise.then(resolve, reject) })
  );
  assert.deepEqual(names, ['mercante-reader:/D-D/:old']);
  const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'standalone');
});

test('an optimistic source update remains pending until its write promise is acknowledged', async () => {
  const values = initial(),
    { service, ctx } = setup(values);
  await service.stage('alice', 'hero', { hp: 8 }, values.schedePG.alice.chars.hero);
  let acknowledge;
  const gate = new Promise((resolve) => {
    acknowledge = resolve;
  });
  const original = ctx._campaignDb.ref;
  ctx._campaignDb.ref = (path) => {
    const reference = original(path);
    if (path === '')
      reference.update = async (changes) => {
        await original(path).update(changes);
        await gate;
      };
    return reference;
  };
  service.connected = true;
  const sync = service.flush();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(values.schedePG.alice.chars.hero.hp, 8);
  assert.equal(service.operations.length, 1);
  assert.equal(service.inflight, service.operations[0].id);
  acknowledge();
  await sync;
  assert.equal(service.operations.length, 0);
});

test('switching sheets before debounce expires preserves both edits and flushes even after leaving the editor', async () => {
  const source = fs.readFileSync('js/features/sheets/persistence.js', 'utf8');
  const schedule = source.slice(
    source.indexOf('var _schedaSaveTimer = null;'),
    source.indexOf('function fbLoadSchede(cb)')
  );
  const writes = [];
  const ctx = vm.createContext({
    state: { currentUser: { username: 'alice' }, schedaAttivaId: 'one', scheda: { hp: 9 } },
    _campaignDb: {},
    notify() {},
    setTimeout: () => 1,
    clearTimeout() {},
    SheetStore: {
      prepare: (_, __, value) => value,
      saveChanges: async (owner, id, patch) =>
        writes.push({ owner, id, patch: JSON.parse(JSON.stringify(patch)) }),
    },
  });
  vm.runInContext(fs.readFileSync('js/core/data.js', 'utf8'), ctx);
  vm.runInContext(schedule, ctx);
  ctx.fbSaveScheda();
  ctx.state.schedaAttivaId = 'two';
  ctx.state.scheda = { hp: 7 };
  ctx.fbSaveScheda();
  ctx.state.scheda = { hp: 6 };
  ctx.fbSaveScheda();
  ctx.state.schedaAttivaId = null;
  ctx.state.scheda = {};
  await ctx.fbSaveScheda(true);
  assert.deepEqual(writes, [
    { owner: 'alice', id: 'one', patch: { hp: 9 } },
    { owner: 'alice', id: 'two', patch: { hp: 6 } },
  ]);
});
