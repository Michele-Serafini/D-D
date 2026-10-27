import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('local writes coalesce and an explicit flush preserves the most recent state', () => {
  const timers = new Map(),
    snapshots = [];
  let sequence = 0;
  const context = {
    window: {},
    state: { notes: '', storia: { content: '', markers: {} } },
    PARTY_RESET_VERSION: 'fixture',
    localStorage: { setItem: (key, value) => snapshots.push(JSON.parse(value)) },
    setTimeout: (callback) => {
      timers.set(++sequence, callback);
      return sequence;
    },
    clearTimeout: (id) => timers.delete(id),
    console,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/core/storage.js', 'utf8'), context);
  for (const value of ['A', 'Appunti', 'Appunti aggiornati']) {
    context.state.notes = value;
    context.saveToStorage();
  }
  assert.equal(timers.size, 1);
  assert.equal(snapshots.length, 0);
  [...timers.values()][0]();
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].notes, 'Appunti aggiornati');
  context.state.notes = 'Ultimo carattere';
  context.saveToStorage();
  context.flushStorage();
  assert.equal(timers.size, 0);
  assert.equal(snapshots.at(-1).notes, 'Ultimo carattere');
});

test('storage restrictions still complete startup without restoring unauthenticated users', () => {
  const context = {
    window: {},
    state: { currentUser: null },
    console,
    localStorage: {
      getItem() {
        throw new Error('Storage disabled');
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/core/storage.js', 'utf8'), context);
  let ready = 0;
  context.loadFromStorageAsync(() => ready++);
  assert.equal(ready, 1);
  assert.equal(context.state.currentUser, null);
});
