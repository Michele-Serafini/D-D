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
import { auditWrites } from '../helpers/sheet-history.mjs';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync('js/core/data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/features/shop/commerce-model.js', 'utf8'), context);
const model = context.CommerceModel;
const item = model.product({ id: 'potion', nome: 'Pozione' }, 'emporio');

test('commerce enforces approval, atomic version checks, immutable receipts and campaign isolation', async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-dd-commerce',
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules: fs.readFileSync('database.rules.json', 'utf8'),
    },
  });
  try {
    await env.withSecurityRulesDisabled(async (ctx) =>
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
            data: {
              schedePG: {
                alice: { _v2: true, chars: { hero: { oro: 100, nomePersonaggio: 'Aria' } } },
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
    const base = 'campaigns/first/data/';
    const char = base + 'schedePG/alice/chars/hero';
    const order = (id) => base + 'commerceRequests/alice/hero/' + id;
    const receipt = (id) => base + 'commerceReceipts/alice/hero/' + id;
    const create = () =>
      model.request(
        { kind: 'purchase', item, quantity: 1, unitPrice: 50, currency: 'mo' },
        'alice',
        1
      );
    const writes = (id, result) => ({
      [char + '/trade/version']: result.sheet.trade.version,
      [char + '/trade/lastOperation']: id,
      ...(result.operation.item
        ? {
            [char + '/trade/inventory/' + result.operation.item.key]:
              result.sheet.trade.inventory[result.operation.item.key],
          }
        : {}),
      [char + '/oro']: result.sheet.oro,
      [char + '/platino']: result.sheet.platino,
      [char + '/argento']: result.sheet.argento,
      [char + '/rame']: result.sheet.rame,
      [order(id)]: result.operation,
      [receipt(id)]: result.receipt,
    });
    const audited = (db, changes, actor) => auditWrites(db, changes, actor, { get, ref });
    const editCoins = (oro) => ({ [char + '/oro']: oro });
    const first = create();
    await assertSucceeds(set(ref(alice, order('one')), first));
    await assertFails(get(ref(bob, order('one'))));
    await assertFails(set(ref(alice, base + 'commercePolicy/requireApproval'), false));
    await assertFails(update(ref(alice, order('one')), { unitPrice: 1 }));
    const unauthorized = model.apply({ oro: 100 }, 'one', first, 'alice', 2);
    await assertFails(update(ref(alice), writes('one', unauthorized)));
    const approved = model.apply({ oro: 100 }, 'one', first, 'dm', 2);
    await assertSucceeds(update(ref(alice), await audited(alice, editCoins(90), 'alice')));
    await assertFails(update(ref(dm), await audited(dm, writes('one', approved), 'dm')));
    await assertSucceeds(update(ref(alice), await audited(alice, editCoins(100), 'alice')));
    await assertSucceeds(update(ref(dm), await audited(dm, writes('one', approved), 'dm')));
    assert.equal(
      (await get(ref(alice, char + '/trade/inventory/' + item.key + '/quantity'))).val(),
      1
    );
    await assertFails(update(ref(dm), await audited(dm, writes('one', approved), 'dm')));
    await assertFails(set(ref(alice, receipt('one')), null));
    await assertFails(set(ref(alice, char + '/trade'), null));
    await assertFails(set(ref(alice, char + '/trade/inventory/' + item.key + '/quantity'), 99));
    await assertFails(
      set(
        ref(alice, order('reward')),
        model.request({ kind: 'reward', currency: 'mo', coins: 10 }, 'alice', 3)
      )
    );
    await assertSucceeds(set(ref(dm, base + 'commercePolicy/requireApproval'), false));
    const second = create(),
      third = create();
    await assertSucceeds(set(ref(alice, order('two')), second));
    await assertSucceeds(set(ref(alice, order('three')), third));
    const current = (await get(ref(alice, char))).val();
    const auto = model.apply(current, 'two', second, 'alice', 4);
    const stale = model.apply(current, 'three', third, 'alice', 4);
    await assertSucceeds(update(ref(alice), await audited(alice, writes('two', auto), 'alice')));
    await assertFails(update(ref(alice), await audited(alice, writes('three', stale), 'alice')));
    assert.equal(
      (await get(ref(alice, char + '/trade/inventory/' + item.key + '/quantity'))).val(),
      2
    );
    assert.equal((await get(ref(alice, receipt('three')))).exists(), false);
    const cash = model.request({ kind: 'reward', currency: 'mo', coins: 10 }, 'dm', 5);
    await assertSucceeds(set(ref(dm, order('cash')), cash));
    await assertSucceeds(
      update(
        ref(dm),
        await audited(
          dm,
          writes('cash', model.apply((await get(ref(dm, char))).val(), 'cash', cash, 'dm', 5)),
          'dm'
        )
      )
    );
    const reward = model.request(
      { kind: 'reward', currency: 'mo', coins: 25, item, quantity: 2 },
      'dm',
      5
    );
    await assertSucceeds(set(ref(dm, order('reward')), reward));
    const granted = model.apply((await get(ref(dm, char))).val(), 'reward', reward, 'dm', 6);
    await assertSucceeds(update(ref(dm), await audited(dm, writes('reward', granted), 'dm')));
    await assertSucceeds(update(ref(alice), await audited(alice, { [char + '/hp']: 9 }, 'alice')));
    assert.equal(
      (await get(ref(alice, char + '/trade/inventory/' + item.key + '/quantity'))).val(),
      4
    );
    await assertFails(get(ref(alice, 'campaigns/second/data/commerceRequests')));
  } finally {
    await env.cleanup();
  }
});
