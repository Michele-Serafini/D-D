import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync('js/features/shop/commerce-model.js', 'utf8'), context);
const model = context.CommerceModel;
const product = model.product({ id: 'potion', nome: 'Pozione' }, 'emporio');
const purchase = (quantity = 1) =>
  model.request(
    { kind: 'purchase', item: product, quantity, unitPrice: 15.5, currency: 'mo' },
    'alice',
    1
  );

test('purchases exchange denominations exactly and stack quantities without touching legacy equipment', () => {
  const original = { oro: '20', argento: '5', equipaggiamento: 'Corda' };
  const first = model.apply(original, 'one', purchase(), 'dm', 2);
  assert.equal(model.balance(first.sheet, 'mo'), 500);
  assert.equal(first.sheet.trade.inventory[product.key].quantity, 1);
  assert.equal(first.sheet.equipaggiamento, 'Corda');
  assert.equal(original.oro, '20');
  const reward = model.request(
    { kind: 'reward', item: product, quantity: 2, coins: 25, currency: 'mo' },
    'dm',
    3
  );
  const second = model.apply(first.sheet, 'two', reward, 'dm', 4);
  assert.equal(Object.keys(second.sheet.trade.inventory).length, 1);
  assert.equal(second.sheet.trade.inventory[product.key].quantity, 3);
  assert.equal(model.balance(second.sheet, 'mo'), 3000);
  assert.equal(second.sheet.trade.version, 2);
  assert.throws(() => model.apply(second.sheet, 'one', first.operation, 'dm', 5), /conclusa/);
});

test('insufficient funds and invalid prices or quantities never mutate the sheet', () => {
  const original = { oro: 1 };
  assert.throws(() => model.apply(original, 'one', purchase(), 'dm', 2), /insufficienti/);
  assert.deepEqual(original, { oro: 1 });
  for (const quantity of [0, -1, 0.5, 1000, Infinity]) assert.throws(() => purchase(quantity));
  for (const value of [-1, Infinity, NaN, 0.001]) assert.throws(() => model.amount(value, 'mo'));
  assert.throws(() => model.balance({ oro: 'non numerico' }, 'mo'));
});

test('independent currencies use the existing sheet fields without converting other balances', () => {
  for (const [currency, field] of [
    ['crediti', 'crediti'],
    ['berry', 'berry'],
    ['poke', 'soldi'],
    ['ryo', 'ryo'],
  ]) {
    const request = model.request({ kind: 'reward', currency, coins: 100 }, 'dm', 1);
    const result = model.apply({ [field]: '5', oro: 12 }, currency, request, 'dm', 2);
    assert.equal(result.sheet[field], 105);
    assert.equal(result.sheet.oro, 12);
  }
  assert.notEqual(
    model.product({ id: 'same', nome: 'Uno' }, 'first').key,
    model.product({ id: 'same', nome: 'Due' }, 'second').key
  );
});

test('ordinary sheet edits preserve remote purchases and nested input model identities', async () => {
  const updates = [];
  const ctx = vm.createContext({
    state: {
      currentUser: { username: 'alice' },
      schedaAttivaId: 'hero',
      schedePGViewMode: false,
      scheda: { id: 'hero', oro: 100, hp: 10, inventory: { mainPocket: 'Corda' } },
    },
    _schedaFix: (raw) => structuredClone(raw),
    _campaignDb: {
      ref: (path) => ({ update: async (changes) => updates.push({ path, changes }) }),
    },
    document: { querySelectorAll: () => [] },
  });
  vm.runInContext(fs.readFileSync('js/features/sheets/store.js', 'utf8'), ctx);
  const store = ctx.SheetStore;
  store.seed('alice', ctx.state.scheda);
  const nested = ctx.state.scheda.inventory;
  ctx.state.scheda.hp = 9;
  const preparedBeforePurchase = store.prepare('alice', 'hero', ctx.state.scheda);
  store.observe('alice', 'hero', {
    oro: 50,
    hp: 10,
    inventory: { mainPocket: 'Corda' },
    trade: { version: 1 },
  });
  assert.equal(ctx.state.scheda.oro, 50);
  assert.equal(ctx.state.scheda.hp, 9);
  assert.equal(ctx.state.scheda.inventory, nested);
  await store.saveChanges('alice', 'hero', preparedBeforePurchase);
  assert.deepEqual(JSON.parse(JSON.stringify(updates[0])), {
    path: 'schedePG/alice',
    changes: { _v2: true, 'chars/hero/hp': 9 },
  });
  assert.equal(ctx.state.scheda.trade.version, 1);
});

test('simultaneous purchases retry stale versions and repeated operation IDs only apply once', async () => {
  const values = new Map([['schedePG/alice/chars/hero', { oro: 100 }]]);
  const read = (path) => structuredClone(values.get(path) ?? null);
  let conflicts = 0;
  const ctx = vm.createContext({
    state: { currentUser: { username: 'alice' }, schedaAttivaId: null },
    isDM: () => false,
    crypto: { randomUUID: () => 'fixture' },
    _campaignDb: {
      ref(path) {
        return {
          once: async () => {
            const snapshot = read(path);
            return { val: () => structuredClone(snapshot), exists: () => snapshot !== null };
          },
          transaction: async (callback) => {
            const next = callback(read(path));
            if (next !== undefined) values.set(path, structuredClone(next));
            return { committed: next !== undefined };
          },
          update: async (changes) => {
            const characterPath = 'schedePG/alice/chars/hero';
            const current = read(characterPath);
            if (changes[characterPath + '/trade/version'] !== (current.trade?.version || 0) + 1) {
              conflicts++;
              throw new Error('permission_denied');
            }
            for (const [key, value] of Object.entries(changes)) {
              if (key.startsWith(characterPath + '/')) {
                const fields = key.slice(characterPath.length + 1).split('/');
                let node = current;
                for (const field of fields.slice(0, -1)) node = node[field] ??= {};
                node[fields.at(-1)] = structuredClone(value);
              } else values.set(key, structuredClone(value));
            }
            values.set(characterPath, current);
          },
        };
      },
    },
  });
  vm.runInContext(fs.readFileSync('js/features/shop/commerce-model.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('js/features/shop/commerce-service.js', 'utf8'), ctx);
  const service = ctx.CommerceService;
  service.ready = true;
  service.approval = false;
  const command = {
    action: 'submit',
    kind: 'purchase',
    quantity: 1,
    unitPrice: 15.5,
    currency: 'mo',
    item: product,
  };
  const target = { username: 'alice', id: 'hero' };
  await Promise.all([service.run(target, 'one', command), service.run(target, 'two', command)]);
  assert.equal(conflicts, 1);
  const beforeRetry = read('schedePG/alice/chars/hero');
  await service.run(target, 'one', command);
  assert.deepEqual(read('schedePG/alice/chars/hero'), beforeRetry);
  assert.equal(beforeRetry.trade.inventory[product.key].quantity, 2);
  assert.equal(ctx.CommerceModel.balance(beforeRetry, 'mo'), 6900);
});
