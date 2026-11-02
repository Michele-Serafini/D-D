import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { ref, set, get, update } from 'firebase/database';

test('journal keeps drafts private and prevents forged, duplicate or cross-session rolls', async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-dd-journal',
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules: fs.readFileSync('database.rules.json', 'utf8'),
    },
  });
  try {
    await env.withSecurityRulesDisabled((ctx) =>
      set(ref(ctx.database()), {
        users: {
          alice: { uid: 'alice', role: 'Giocatore' },
          dm: { uid: 'dm', role: 'Giocatore', dmPriv: true },
          bob: { uid: 'bob', role: 'Giocatore' },
        },
        userAccess: { alice: 'alice', dm: 'dm', bob: 'bob' },
        campaigns: {
          first: {
            meta: { name: 'First', description: '', owner: 'dm', createdAt: 1 },
            members: { alice: 'player', dm: 'dm' },
          },
          second: {
            meta: { name: 'Second', description: '', owner: 'bob', createdAt: 1 },
            members: { bob: 'dm' },
          },
        },
      })
    );
    const alice = env.authenticatedContext('alice').database(),
      dm = env.authenticatedContext('dm').database(),
      bob = env.authenticatedContext('bob').database();
    const base = 'campaigns/first/data/';
    await assertSucceeds(
      set(ref(dm, base + 'sessionJournal/control'), {
        active: 'one',
        sessions: {
          one: { title: 'Sessione uno', startedAt: 10, createdBy: 'dm' },
          two: { title: 'Sessione due', startedAt: 100, createdBy: 'dm' },
        },
      })
    );
    await assertSucceeds(get(ref(alice, base + 'sessionJournal/control/active')));
    await assertFails(
      get(ref(env.unauthenticatedContext().database(), base + 'sessionJournal/control/active'))
    );
    await assertFails(get(ref(alice, base + 'sessionJournal/control')));
    await assertFails(set(ref(alice, base + 'sessionJournal/control/active'), 'two'));
    const ctx = vm.createContext({});
    vm.runInContext(fs.readFileSync('js/features/journal/model.js', 'utf8'), ctx);
    const roll = {
      username: 'alice',
      value: 25,
      diceType: 20,
      rolls: [20],
      critical: true,
      occurredAt: 20,
      sessionId: 'one',
    };
    const event = ctx.JournalModel.roll('a', roll),
      eventPath = base + 'sessionJournal/events/one/' + event.id;
    await assertFails(set(ref(alice, eventPath), event));
    await assertSucceeds(update(ref(alice), { [base + 'diceRolls/a']: roll, [eventPath]: event }));
    await assertSucceeds(set(ref(alice, eventPath), event));
    await assertFails(set(ref(alice, eventPath), null));
    await assertFails(update(ref(alice, eventPath), { body: 'Alterato' }));
    await assertFails(get(ref(alice, eventPath)));
    await assertFails(set(ref(alice, base + 'sessionJournal/events/two/' + event.id), event));
    await assertFails(
      set(ref(alice, base + 'sessionJournal/events/one/roll_duplicate'), {
        ...event,
        id: 'roll_duplicate',
      })
    );
    await assertFails(
      set(ref(alice, base + 'sessionJournal/events/one/note_fake'), {
        ...event,
        id: 'note_fake',
        kind: 'note',
      })
    );
    await assertFails(get(ref(bob, base + 'sessionJournal')));
    const checkpoint = ctx.JournalModel.event(
      'notes_dm',
      'checkpoint',
      'Appunti',
      'Segreto',
      'dm',
      30
    );
    await assertSucceeds(set(ref(dm, base + 'sessionJournal/events/one/notes_dm'), checkpoint));
    await assertSucceeds(
      set(ref(dm, base + 'sessionJournal/events/one/notes_dm'), {
        ...checkpoint,
        body: 'Segreto aggiornato',
        at: 31,
      })
    );
    await assertFails(set(ref(dm, base + 'sessionJournal/events/one/notes_dm'), checkpoint));
    await assertSucceeds(
      set(ref(dm, base + 'sessionJournal/drafts/one'), {
        text: 'Riepilogo privato',
        updatedBy: 'dm',
        updatedAt: 40,
      })
    );
    await assertFails(get(ref(alice, base + 'sessionJournal/drafts/one')));
    const fight = ctx.JournalModel.combat(
      { id: 'c_one' },
      'checkpoint',
      [{ nome: 'Aria', hp: 8 }],
      2,
      'dm',
      32
    );
    await assertSucceeds(set(ref(dm, base + 'sessionJournal/events/one/' + fight.id), fight));
    await assertSucceeds(
      set(ref(dm, base + 'sessionJournal/events/one/' + fight.id), {
        ...fight,
        body: 'Round 4',
        at: 34,
      })
    );
    assert.equal((await get(ref(dm, base + 'sessionJournal/events/one'))).size, 3);
    await assertSucceeds(
      update(ref(dm, base + 'sessionJournal/control'), { active: null, 'sessions/one/endedAt': 50 })
    );
    const late = { ...roll, occurredAt: 60 },
      lateEvent = ctx.JournalModel.roll('late', late);
    await assertFails(
      update(ref(alice), {
        [base + 'diceRolls/late']: late,
        [base + 'sessionJournal/events/one/' + lateEvent.id]: lateEvent,
      })
    );
  } finally {
    await env.cleanup();
  }
});
