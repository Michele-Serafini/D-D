import test from 'node:test';
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { ref, set, get, update } from 'firebase/database';

test('campaign membership enforces isolation, scoped DM permissions and immediate revocation', async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-dd-campaigns',
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules: fs.readFileSync('database.rules.json', 'utf8'),
    },
  });
  try {
    await env.withSecurityRulesDisabled(async (context) =>
      set(ref(context.database()), {
        users: {
          alice: { uid: 'alice', role: 'Giocatore' },
          bob: { uid: 'bob', role: 'Giocatore' },
          dm1: { uid: 'dm1', role: 'Giocatore', dmPriv: true },
          dm2: { uid: 'dm2', role: 'Giocatore', dmPriv: true },
        },
        userAccess: { alice: 'alice', bob: 'bob', dm1: 'dm1', dm2: 'dm2' },
        campaigns: {
          first: {
            meta: { name: 'First', description: '', owner: 'dm1', createdAt: 1 },
            members: { alice: 'player', dm1: 'dm' },
            data: {
              state: { notes: 'secret first' },
              schedePG: { alice: { name: 'Alice' } },
              dmConfig: { secret: 'fixture' },
            },
          },
          second: {
            meta: { name: 'Second', description: '', owner: 'dm2', createdAt: 2 },
            members: { bob: 'player', dm2: 'dm' },
            data: { state: { notes: 'secret second' } },
          },
        },
        campaignAccess: {
          alice: { first: true },
          dm1: { first: true },
          bob: { second: true },
          dm2: { second: true },
        },
        state: { notes: 'old private data' },
      })
    );
    const alice = env.authenticatedContext('alice').database();
    const dm1 = env.authenticatedContext('dm1').database();
    const anon = env.unauthenticatedContext().database();
    await assertFails(get(ref(anon, 'campaigns/first/data/state/notes')));
    await assertSucceeds(get(ref(alice, 'campaigns/first/data/state/notes')));
    await assertSucceeds(set(ref(alice, 'campaigns/first/data/schedePG/alice/name'), 'Hero'));
    await assertFails(get(ref(alice, 'campaigns/second/meta')));
    await assertFails(get(ref(alice, 'campaigns/second/data/state/notes')));
    await assertFails(set(ref(alice, 'campaigns/second/data/state/notes'), 'overwrite'));
    await assertFails(get(ref(alice, 'campaigns/first/data/dmConfig')));
    await assertFails(set(ref(alice, 'campaigns/first/members/alice'), 'dm'));
    await assertFails(set(ref(alice, 'campaignAccess/alice/second'), true));
    await assertFails(update(ref(alice, 'users/alice'), { dmPriv: true }));
    await assertFails(get(ref(alice, 'state/notes')));
    await assertSucceeds(set(ref(dm1, 'campaigns/first/data/state/armi'), ['sword']));
    await assertFails(get(ref(dm1, 'campaigns/second/data/state/notes')));
    await assertFails(set(ref(dm1, 'campaigns/second/members/dm1'), 'dm'));
    // A global DM can create a campaign, with membership and listing in one write.
    await assertSucceeds(
      update(ref(dm1), {
        'campaigns/third': {
          meta: { name: 'Third', description: '', owner: 'dm1', createdAt: 3 },
          members: { dm1: 'dm', bob: 'player' },
        },
        'campaignAccess/dm1/third': true,
        'campaignAccess/bob/third': true,
      })
    );
    await assertFails(set(ref(dm1, 'campaigns/first/meta/owner'), 'alice'));
    await assertFails(set(ref(dm1, 'campaigns/first/members/dm1'), null));
    await assertSucceeds(
      update(ref(dm1), {
        'campaigns/first/members/alice': null,
        'campaignAccess/alice/first': null,
      })
    );
    await assertFails(get(ref(alice, 'campaigns/first/data/state/notes')));
    await assertFails(set(ref(alice, 'campaigns/first/data/schedePG/alice/name'), 'revoked'));
    await assertSucceeds(get(ref(alice, 'campaigns/first/members/alice')));
    await env.withSecurityRulesDisabled(async (context) =>
      update(ref(context.database(), 'users/dm1'), { disabled: true })
    );
    await assertFails(get(ref(dm1, 'campaigns/first/meta')));
  } finally {
    await env.cleanup();
  }
});
