import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { readCatalogSource, catalogSources } from '../scripts/catalog-data.mjs';

const load = (file, context = {}) => {
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  return context;
};
const plain = (value) => JSON.parse(JSON.stringify(value));

test('shared patches preserve unrelated values, normalize Firebase empties and reject unsafe paths', () => {
  const { DataUtils: data } = load('js/core/data.js');
  const original = { hp: 10, inventory: { rope: 1 }, notes: { old: 'remove' } };
  const next = data.apply(original, { hp: 7, 'notes/old': null, 'notes/new': 'Keep' });
  assert.deepEqual(plain(next), { hp: 7, inventory: { rope: 1 }, notes: { new: 'Keep' } });
  assert.equal(original.hp, 10);
  assert.deepEqual(
    plain(data.diff({ empty: [], notes: { a: null } }, {}, { firebase: true }).after),
    {}
  );
  assert.deepEqual(plain(data.diff({ x: { a: 1, b: 2 } }, { x: { b: 2, a: 1 } }).after), {});
  const changes = data.diff(
    { hp: 10, trade: { version: 1 } },
    { hp: 7, trade: { version: 2 } },
    { exclude: ['trade'] }
  );
  assert.deepEqual(plain(changes.after), { hp: 7 });
  for (const key of ['__proto__/polluted', 'constructor/prototype/polluted', 'invalid.field'])
    assert.throws(() => data.apply(original, { [key]: true }), /non valido/);
  assert.equal({}.polluted, undefined);
});

test('theme preferences keep the last choice across campaigns and still work when storage is unavailable', () => {
  const storage = new Map([['sium_theme_mode', 'halloween']]);
  const attributes = new Map();
  const ctx = {
    state: {},
    document: {
      documentElement: { setAttribute: (key, value) => attributes.set(key, value) },
      getElementById: () => null,
    },
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
  };
  ctx.window = ctx;
  load('js/core/preferences.js', ctx);
  assert.equal(ctx.ThemePreferences.read('light'), 'halloween');
  assert.equal(ctx.state.theme, 'halloween');
  assert.equal(Object.keys(ctx.ThemePreferences.themes).length, 6);
  ctx.localStorage.getItem = ctx.localStorage.setItem = () => {
    throw new Error('restricted');
  };
  ctx.setAppTheme('easter');
  assert.equal(attributes.get('data-theme'), 'easter');
  assert.equal(ctx.state.theme, 'easter');
  assert.equal(ctx.ThemePreferences.read('christmas'), 'christmas');
  assert.equal(ctx.ThemePreferences.normalize('unknown'), 'dark');
});

test('collection reads and writes share paths and a server removal clears stale client items', async () => {
  const listeners = new Map(),
    writes = [];
  let renders = 0;
  const ctx = load('js/core/collections.js', {
    state: { section: 'emporio', emporioTab: 'cyber' },
    scheduleRenderMain: () => renders++,
    _campaignDb: {
      ref: (path) => ({
        on: (_, callback) => listeners.set(path, callback),
        set: async (value) => writes.push({ path, value }),
      }),
    },
  });
  ctx.AppCollections.connect();
  const receive = listeners.get('state/impianti');
  receive({ val: () => [{ id: 'one' }] });
  assert.equal(ctx.state.impiantiCibernetici.length, 1);
  receive({ val: () => null });
  assert.equal(ctx.state.impiantiCibernetici.length, 0);
  assert.equal(renders, 2);
  await ctx.fbSaveImpianti();
  assert.deepEqual(writes, [{ path: 'state/impianti', value: null }]);
});

test('catalog searches coalesce typing, preserve the caret and cancel rendering when leaving the section', () => {
  const timers = new Map(),
    cleanups = [],
    restored = [];
  let sequence = 0,
    renders = 0;
  const input = {
    dataset: {},
    value: '',
    isConnected: true,
    selectionStart: 3,
    selectionEnd: 3,
    selectionDirection: 'none',
  };
  const replacement = { focus() {}, setSelectionRange: (...value) => restored.push(value) };
  const ctx = load('js/ui/catalog-controls.js', {
    state: { section: 'emporio' },
    document: { activeElement: input, querySelector: () => replacement },
    onSectionCleanup: (callback) => cleanups.push(callback),
    setTimeout: (callback) => {
      timers.set(++sequence, callback);
      return sequence;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  ctx.bindCatalogSearch(input, 'search', () => {
    renders++;
    input.isConnected = false;
  });
  for (const value of ['s', 'sp', 'spa']) {
    input.value = value;
    input.oninput();
  }
  assert.equal(ctx.state.search, 'spa');
  assert.equal(timers.size, 1);
  assert.equal(renders, 0);
  const pending = [...timers.values()][0];
  timers.clear();
  pending();
  assert.equal(renders, 1);
  assert.deepEqual(restored, [[3, 3, 'none']]);
  input.isConnected = true;
  input.oninput();
  cleanups.forEach((callback) => callback());
  assert.equal(timers.size, 0);
});

test('opening the library through different navigation entries creates only one pair of subscriptions', () => {
  const listeners = new Map();
  const ctx = load('js/features/library.js', {
    state: { libriCustom: null, currentUser: { username: 'alice' }, section: 'libri' },
    scheduleRenderMain() {},
    _campaignDb: {
      ref: (path) => ({
        on: (_, callback) => {
          assert.equal(listeners.has(path), false);
          listeners.set(path, callback);
        },
      }),
    },
  });
  ctx.connectLibrary();
  ctx.connectLibrary();
  assert.deepEqual([...listeners.keys()], ['libri/books', 'libri/preferiti/alice']);
  listeners.get('libri/books')({ val: () => ({ newBook: { title: 'Grimorio' } }) });
  assert.equal(ctx.state.libriCustom.newBook.title, 'Grimorio');
});

test('generated catalogs use canonical JSON data and externalized images retain their original bytes', () => {
  const ctx = {};
  const script = readCatalogSource();
  vm.runInNewContext(script, ctx);
  for (const [name, file] of Object.entries(catalogSources))
    assert.deepEqual(plain(ctx[name]), JSON.parse(fs.readFileSync(file, 'utf8')));
  assert.equal(script.includes('data:image/jpeg;base64'), false);
  const images = new Set(
    ctx.SRD_BESTIARIO.map((item) => item.immagine).filter((url) => url?.startsWith('img/catalog/'))
  );
  assert.ok(images.size > 0);
  for (const file of images) assert.ok(fs.existsSync(file));
  for (const name of fs.readdirSync('img/catalog')) {
    const file = 'img/catalog/' + name;
    const digest = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 20);
    assert.ok(file.includes(digest));
  }
});

test('effects are restored once and later choices remain persistent', () => {
  const storage = new Map([['sium_fx_enabled', '0']]);
  const ctx = {
    document: { documentElement: { setAttribute() {} }, getElementById: () => null },
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
  };
  load('js/core/preferences.js', ctx);
  assert.equal(ctx.EffectPreferences.read(), true);
  ctx.EffectPreferences.set(false);
  assert.equal(ctx.EffectPreferences.read(), false);
  ctx.EffectPreferences.set(true);
  assert.equal(ctx.EffectPreferences.read(), true);
});

test('catalog saves merge concurrent items, reuse draft IDs and deny player or offline writes', async () => {
  const server = { 'state/armi': [{ id: 'old', nome: 'Corda' }] };
  let master = true;
  const ctx = load('js/core/data.js', {
    state: { armi: structuredClone(server['state/armi']) },
    _localWrite: {},
    isDM: () => master,
    OfflineSheets: { connected: true },
    UserManager: { withTimeout: (promise) => promise },
    _campaignDb: {
      ref: (path) => ({
        transaction: async (change) => {
          const next = change(structuredClone(server[path] || null));
          if (next !== undefined) server[path] = plain(next);
          return {
            committed: next !== undefined,
            snapshot: { val: () => structuredClone(server[path]) },
          };
        },
      }),
    },
  });
  load('js/features/catalogs/editor.js', ctx);
  const form = { nome: 'Lama', prezzo: 17.5, valuta: 'ma' };
  await ctx.CatalogEditor.save('object', form, 'item_stable', false);
  server['state/armi'].push({ id: 'remote', nome: 'Aggiunto da un altro master' });
  await ctx.CatalogEditor.save('object', form, 'item_stable', false);
  assert.equal(server['state/armi'].filter((item) => item.id === 'item_stable').length, 1);
  assert.equal(server['state/armi'].length, 3);
  assert.equal(server['state/armi'][0]._customized, true);
  assert.equal(server['state/armi'][0].prezzo, 17.5);
  await assert.rejects(ctx.CatalogEditor.save('object', form, 'gone', true), /eliminata/);
  master = false;
  await assert.rejects(
    ctx.CatalogEditor.save('object', form, 'forbidden', false),
    /Solo il master/
  );
  master = true;
  ctx.OfflineSheets.connected = false;
  await assert.rejects(ctx.CatalogEditor.save('object', form, 'offline', false), /Riconnettiti/);
  assert.equal(server['state/armi'].length, 3);
  load('js/features/catalogs/sync.js', ctx);
  ctx.CatalogSync.deletedSpells = ['removed'];
  ctx.CatalogEditor.receive('spell', { val: () => [{ id: 'removed' }, { id: 'visible' }] });
  assert.deepEqual(plain(ctx.state.incantesimiAggiuntivi), [{ id: 'visible' }]);
});
