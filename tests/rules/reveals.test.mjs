import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { ref, set, get, update } from 'firebase/database';

test('private content stays unreadable by players, reveal uses only reviewed public fields and withdrawal propagates', async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-dd-reveals',
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
          dm: { uid: 'dm', role: 'Giocatore', dmPriv: true },
          alice: { uid: 'alice', role: 'Giocatore' },
          bob: { uid: 'bob', role: 'Giocatore', dmPriv: true },
        },
        userAccess: { dm: 'dm', alice: 'alice', bob: 'bob' },
        campaigns: {
          first: {
            meta: { name: 'First', description: '', owner: 'dm', createdAt: 1 },
            members: { dm: 'dm', alice: 'player' },
          },
          second: {
            meta: { name: 'Second', description: '', owner: 'bob', createdAt: 1 },
            members: { bob: 'dm' },
          },
        },
      })
    );
    const dm = env.authenticatedContext('dm').database(),
      alice = env.authenticatedContext('alice').database(),
      bob = env.authenticatedContext('bob').database();
    const base = 'campaigns/first/data/',
      privatePath = base + 'secretContent/one',
      publicPath = base + 'revealedContent/one';
    const ctx = vm.createContext({ URL });
    vm.runInContext(fs.readFileSync('js/features/reveals/model.js', 'utf8'), ctx);
    const model = ctx.RevealModel;
    const draft = model.draft(
      {
        type: 'npc',
        title: 'Guardiano',
        text: 'Salute',
        image: 'data:image/png;base64,AAAA',
        masterNotes: 'È il traditore',
      },
      null,
      'dm',
      1
    );
    const shared = model.publicCopy(draft, 'dm', 2);
    await assertSucceeds(set(ref(dm, privatePath), draft));
    await assertFails(get(ref(alice, base + 'secretContent')));
    await assertFails(get(ref(alice, privatePath)));
    await assertFails(get(ref(alice, privatePath + '/image')));
    await assertFails(get(ref(bob, privatePath)));
    await assertFails(get(ref(env.unauthenticatedContext().database(), privatePath)));
    await assertFails(set(ref(alice, privatePath), draft));
    await assertFails(set(ref(alice, publicPath), shared));
    await assertFails(set(ref(dm, publicPath), { ...shared, masterNotes: draft.masterNotes }));
    await assertFails(set(ref(dm, publicPath), { ...shared, text: 'Contenuto non revisionato' }));
    await assertFails(set(ref(dm, publicPath), { ...shared, revealedBy: 'alice' }));
    await assertSucceeds(set(ref(dm, publicPath), shared));
    const visible = (await get(ref(alice, publicPath))).val();
    assert.equal(visible.title, 'Guardiano');
    assert.equal(visible.masterNotes, undefined);
    await assertFails(get(ref(bob, publicPath)));
    await assertFails(set(ref(alice, publicPath), null));
    const revised = model.draft({ ...draft, title: 'Guardiano svelato' }, draft, 'dm', 3);
    await assertSucceeds(set(ref(dm, privatePath), revised));
    await assertFails(set(ref(dm, privatePath), revised));
    assert.equal((await get(ref(alice, publicPath + '/title'))).val(), 'Guardiano');
    await assertFails(set(ref(dm, publicPath), shared));
    await assertSucceeds(set(ref(dm, publicPath), model.publicCopy(revised, 'dm', 4)));
    await assertSucceeds(set(ref(dm, publicPath), null));
    assert.equal((await get(ref(alice, publicPath))).exists(), false);
    assert.equal((await get(ref(dm, privatePath))).exists(), true);
    await assertFails(get(ref(alice, 'campaigns/second/data/revealedContent')));
    await assertSucceeds(update(ref(dm), { [privatePath]: null, [publicPath]: null }));
    await env.withSecurityRulesDisabled((ctx) =>
      set(ref(ctx.database(), 'campaigns/first/members/alice'), null)
    );
    await assertFails(get(ref(alice, base + 'revealedContent')));
  } finally {
    await env.cleanup();
  }
});
