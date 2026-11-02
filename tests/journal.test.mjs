import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const modelSource = fs.readFileSync('js/features/journal/model.js', 'utf8');
const serviceSource = fs.readFileSync('js/features/journal/service.js', 'utf8');
function fixture({ failure = false, storage = new Map() } = {}) {
  const data = {},
    watchers = [],
    window = { addEventListener() {} };
  let sequence = 0,
    refuseJournal = failure;
  const read = (path) =>
    structuredClone(
      path
        .split('/')
        .filter(Boolean)
        .reduce((node, key) => node?.[key], data) ?? null
    );
  function write(path, value) {
    const keys = path.split('/');
    let node = data;
    for (const key of keys.slice(0, -1)) node = node[key] ??= {};
    if (value === null) delete node[keys.at(-1)];
    else node[keys.at(-1)] = structuredClone(value);
  }
  function emit(paths) {
    for (const watcher of watchers)
      if (
        paths.some(
          (path) =>
            path === watcher.path ||
            path.startsWith(watcher.path + '/') ||
            watcher.path.startsWith(path + '/')
        )
      )
        watcher.callback({ val: () => read(watcher.path) });
  }
  const db = {
    ref(path) {
      return {
        on(_event, callback) {
          watchers.push({ path, callback });
          callback({ val: () => read(path) });
          return callback;
        },
        once: async () => ({ val: () => read(path) }),
        async set(value) {
          if (refuseJournal && path.includes('/events/')) throw new Error('offline');
          write(path, value);
          emit([path]);
        },
        async update(changes) {
          if (refuseJournal && Object.keys(changes).some((key) => key.includes('/events/')))
            throw new Error('offline');
          for (const [key, value] of Object.entries(changes)) write(key, value);
          emit(Object.keys(changes));
        },
        async transaction(change) {
          const next = change(read(path));
          if (next === undefined) return { committed: false };
          write(path, next);
          emit([path]);
          return { committed: true };
        },
      };
    },
  };
  const ctx = vm.createContext({
    window,
    state: { currentUser: { username: 'dm' }, encounter: null },
    isDM: () => true,
    _campaignDb: db,
    crypto: { randomUUID: () => String(++sequence) },
    CampaignManager: { storageKey: () => 'alice:first' },
    MasterDashboardNotes: { flush: async () => {} },
    notify() {},
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  });
  vm.runInContext(modelSource + '\n' + serviceSource, ctx);
  ctx.SessionJournal.connect();
  return {
    journal: ctx.SessionJournal,
    model: ctx.JournalModel,
    data,
    storage,
    read,
    fail: (value) => {
      refuseJournal = value;
    },
  };
}

test('only one session starts concurrently and closing retains its history', async () => {
  const f = fixture();
  const starts = await Promise.allSettled([
    f.journal.start('Le caverne'),
    f.journal.start('Un’altra sessione'),
  ]);
  assert.equal(starts.filter((result) => result.status === 'fulfilled').length, 1);
  const id = f.journal.active;
  assert.equal(Object.keys(f.journal.control.sessions).length, 1);
  await f.journal.end();
  assert.equal(f.journal.active, null);
  assert.ok(f.journal.control.sessions[id].endedAt >= f.journal.control.sessions[id].startedAt);
});

test('failed journal delivery preserves the game write and retries one queued event', async () => {
  const storage = new Map(),
    f = fixture({ failure: true, storage });
  const id = await f.journal.start('Sessione');
  const event = f.model.event('note_one', 'note', 'Indizio', 'Una porta segreta', 'dm', Date.now());
  await f.journal.commit({ 'state/fixture': 'game saved' }, [{ session: id, data: event }]);
  await f.journal.flush();
  assert.equal(f.read('state/fixture'), 'game saved');
  assert.equal(Object.keys(f.journal.queue).length, 1);
  assert.match(storage.get('alice:first:journal-outbox'), /porta segreta/);
  f.fail(false);
  await f.journal.flush();
  assert.equal(Object.keys(f.journal.queue).length, 0);
  await f.journal.capture(event, id);
  assert.equal(Object.keys(f.read('sessionJournal/events/' + id)).length, 1);
});

test('important rolls distinguish natural critical results from modified totals', () => {
  const f = fixture();
  assert.equal(
    f.model.roll('ordinary', {
      value: 20,
      diceType: 20,
      rolls: [15],
      occurredAt: 1,
      username: 'dm',
    }),
    null
  );
  const critical = f.model.roll('critical', {
    value: 25,
    diceType: 20,
    rolls: [20],
    critical: true,
    occurredAt: 1,
    username: 'dm',
  });
  assert.match(critical.title, /20 naturale/);
  assert.match(critical.body, /totale 25/);
  const formula = f.model.roll('formula', {
    value: 11,
    diceType: 6,
    rolls: [5, 6],
    important: true,
    formula: '2d6',
    occurredAt: 1,
    username: 'dm',
  });
  assert.match(formula.body, /2d6/);
  assert.equal(formula.id, 'roll_formula');
});

test('notes form one checkpoint and recaps use the final combat snapshot once', async () => {
  const f = fixture(),
    id = await f.journal.start('Il ponte');
  await f.journal.recordNotes('Primo appunto');
  await f.journal.recordNotes('Appunto definitivo');
  const encounter = { id: 'one' },
    participants = [{ nome: 'Aria', hp: 10, condizioni: [] }];
  await f.journal.capture(f.model.combat(encounter, 'start', participants, 1, 'dm', 1));
  await f.journal.capture(
    f.model.combat(
      encounter,
      'end',
      [{ nome: 'Aria', hp: 3, condizioni: ['avvelenato'] }],
      4,
      'dm',
      1
    )
  );
  const text = f.model.recap(f.journal.control.sessions[id], f.read('sessionJournal/events/' + id));
  assert.equal((text.match(/Combattimento concluso/g) || []).length, 1);
  assert.doesNotMatch(text, /Combattimento iniziato/);
  assert.match(text, /Round 4/);
  assert.match(text, /Appunto definitivo/);
  assert.doesNotMatch(text, /Primo appunto/);
});
