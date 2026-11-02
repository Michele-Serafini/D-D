import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/features/dashboard/notes.js', 'utf8');

function notesFixture({ master = true, draft = null, remote = 'Remote notes', save } = {}) {
  const key = 'mercante_v2:alice:first:dashboardNotes';
  const storage = new Map(draft === null ? [] : [[key, draft]]);
  const timers = new Map();
  const writes = [];
  const paths = [];
  let receive;
  let cancel;
  let timerId = 0;
  const context = {
    SessionJournal: { recordNotes: async () => {} },
    isDM: () => master,
    CampaignManager: { storageKey: () => 'mercante_v2:alice:first' },
    localStorage: {
      getItem: (name) => storage.get(name) ?? null,
      setItem: (name, text) => storage.set(name, text),
      removeItem: (name) => storage.delete(name),
    },
    setTimeout(callback) {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    _campaignDb: {
      ref(path) {
        paths.push(path);
        return {
          on(_event, callback, error) {
            receive = (value) => callback({ val: () => value });
            cancel = error;
            receive(remote);
          },
          set(text) {
            writes.push(text);
            receive(text); // Firebase sends an optimistic local echo before ACK.
            return save ? save(text) : Promise.resolve();
          },
        };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const notes = context.MasterDashboardNotes;
  notes.connect();
  return {
    notes,
    paths,
    writes,
    storage,
    timers,
    key,
    receive: (v) => receive(v),
    cancel: () => cancel(),
  };
}

test('master notes use a private campaign path, debounce edits and accept remote changes', async () => {
  const f = notesFixture();
  f.notes.connect();
  assert.deepEqual(f.paths, ['dmConfig/dashboardNotes']);
  assert.equal(f.notes.text, 'Remote notes');
  f.notes.update('First edit');
  f.notes.update('Latest edit');
  assert.equal(f.timers.size, 1);
  assert.equal(f.storage.get(f.key), 'Latest edit');
  assert.equal(f.writes.length, 0);
  const timer = [...f.timers.values()][0];
  timer();
  await f.notes.flush();
  assert.deepEqual(f.writes, ['Latest edit']);
  assert.equal(f.storage.has(f.key), false);
  assert.equal(f.notes.dirty, false);
  f.receive('Updated by another master');
  assert.equal(f.notes.text, 'Updated by another master');
});

test('edits during an in-flight save survive its ACK and are serialized into a second save', async () => {
  const commits = [];
  const f = notesFixture({ save: () => new Promise((resolve) => commits.push(resolve)) });
  f.notes.update('First');
  const saving = f.notes.flush();
  await Promise.resolve();
  assert.deepEqual(f.writes, ['First']);
  f.notes.update('Second');
  f.receive('Optimistic/remote echo');
  assert.equal(f.notes.text, 'Second');
  commits.shift()();
  for (let n = 0; n < 10 && f.writes.length < 2; n++) await Promise.resolve();
  assert.deepEqual(f.writes, ['First', 'Second']);
  assert.equal(f.storage.get(f.key), 'Second');
  commits.shift()();
  await saving;
  assert.equal(f.storage.has(f.key), false);
  assert.equal(f.notes.dirty, false);
});

test('a failed save retains the draft and a recovered draft waits for explicit editing or save', async () => {
  let fail = true;
  const f = notesFixture({
    draft: '',
    save: () => (fail ? Promise.reject(new Error('offline')) : Promise.resolve()),
  });
  assert.equal(f.notes.text, '');
  assert.equal(f.notes.dirty, true);
  assert.equal(f.timers.size, 0);
  await assert.rejects(f.notes.flush(), /offline/);
  assert.equal(f.notes.dirty, true);
  assert.equal(f.storage.get(f.key), '');
  assert.match(f.notes.status, /non riuscito/);
  fail = false;
  await f.notes.flush();
  assert.equal(f.storage.has(f.key), false);
  f.notes.update('Unsaved');
  f.cancel();
  await assert.rejects(f.notes.flush(), /non disponibili/);
  assert.equal(f.storage.get(f.key), 'Unsaved');
});

test('players never attach a private listener or store dashboard notes', async () => {
  const f = notesFixture({ master: false });
  f.notes.update('Forbidden');
  await f.notes.flush();
  assert.deepEqual(f.paths, []);
  assert.deepEqual(f.writes, []);
  assert.equal(f.storage.size, 0);
});
