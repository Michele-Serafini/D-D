import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { ref, set, get, update } from 'firebase/database';
import { auditWrites, historyContext } from '../helpers/sheet-history.mjs';

test('sheet audit requires atomic revisions, authentic authors, immutable entries and campaign-scoped access', async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-dd-history',
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
            members: { alice: 'player', bob: 'player', dm: 'dm' },
            data: {
              schedePG: {
                alice: { _v2: true, chars: { hero: { nomePersonaggio: 'Aria', hp: 10 } } },
              },
            },
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
    const base = 'campaigns/first/data/',
      char = base + 'schedePG/alice/chars/hero',
      history = base + 'sheetHistory/alice/hero';
    const edit = (hp) => ({ [char + '/hp']: hp });
    const audit = (db, changes, actor) => auditWrites(db, changes, actor, { ref, get });
    await assertSucceeds(set(ref(alice, char + '/hp'), 10));
    const first = await audit(alice, edit(8), 'alice');
    const stale = await audit(alice, edit(1), 'alice');
    const fake = structuredClone(first);
    Object.keys(fake)
      .filter((key) => key.includes('/sheetHistory/'))
      .forEach((key) => {
        fake[key].actor = 'dm';
      });
    await assertFails(update(ref(alice), fake));
    const half = Object.fromEntries(
      Object.entries(first).filter(([key]) => !key.includes('/sheetHistory/'))
    );
    await assertFails(update(ref(alice), half));
    await assertSucceeds(update(ref(alice), first));
    await assertFails(set(ref(alice, char + '/hp'), 1));
    await assertFails(update(ref(alice), stale));
    const head = (await get(ref(alice, history + '/head'))).val();
    const event = history + '/entries/' + head.revision;
    await assertSucceeds(get(ref(alice, history)));
    await assertSucceeds(get(ref(dm, history)));
    await assertFails(get(ref(bob, history)));
    await assertFails(get(ref(env.unauthenticatedContext().database(), history)));
    await assertFails(get(ref(alice, 'campaigns/second/data/sheetHistory')));
    await assertFails(update(ref(alice, event), { before: '{}' }));
    await assertFails(update(ref(dm, event), { actor: 'dm' }));
    await assertFails(set(ref(alice, event), null));
    await assertFails(set(ref(alice, history + '/head'), null));
    await assertFails(set(ref(alice, history), null));
    const noSource = await audit(alice, edit(2), 'alice');
    await assertFails(
      update(
        ref(alice),
        Object.fromEntries(
          Object.entries(noSource).filter(([key]) => key.includes('/sheetHistory/'))
        )
      )
    );
    await assertSucceeds(update(ref(dm), await audit(dm, edit(3), 'dm')));
    const stored = (await get(ref(alice, history))).val();
    const sheet = (await get(ref(alice, char))).val();
    const { SheetHistoryModel: model } = historyContext({});
    const restored = model.restore(sheet, stored.entries, 0, stored.head);
    assert.equal(restored.hp, 10);
    await assertSucceeds(update(ref(alice), await audit(alice, edit(restored.hp), 'alice')));
    assert.equal((await get(ref(alice, char + '/hp'))).val(), 10);
    const cross = await audit(alice, edit(9), 'alice');
    await assertFails(update(ref(bob), cross));
    await env.withSecurityRulesDisabled((ctx) =>
      set(ref(ctx.database(), 'campaigns/first/members/alice'), null)
    );
    await assertFails(get(ref(alice, history)));
    await assertFails(update(ref(alice), cross));
  } finally {
    await env.cleanup();
  }
});
