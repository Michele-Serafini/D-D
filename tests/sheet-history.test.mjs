import test from 'node:test';
import assert from 'node:assert/strict';
import { historyContext } from './helpers/sheet-history.mjs';

test('deltas reverse nested fields, arrays, empty values and removed keys without copying unchanged data', () => {
  const { SheetHistoryModel: model } = historyContext({});
  const before = {
    id: 'hero',
    _rev: 'old',
    hp: 10,
    skills: { stealth: 2 },
    items: ['Corda'],
    extra: 'remove',
    large: 'x'.repeat(10000),
  };
  const after = { ...before, _rev: 'new', hp: 0, skills: { stealth: 5 }, items: [], blank: '' };
  delete after.extra;
  const delta = model.diff(before, after);
  assert.deepEqual(JSON.parse(JSON.stringify(delta.after)), {
    hp: 0,
    'skills/stealth': 5,
    items: null,
    extra: null,
    blank: '',
  });
  assert.equal(Object.keys(model.diff(model.apply(before, delta.after), after).after).length, 0);
  assert.equal(Object.keys(model.diff(model.apply(after, delta.before), before).after).length, 0);
  assert.throws(() => model.apply({}, JSON.parse('{"__proto__/polluted":true}')), /non valido/);
});

test('concurrent editors rebase only their fields and keep contiguous versions with truthful before values', async () => {
  const values = { schedePG: { alice: { chars: { hero: { hp: 10, nome: 'Aria' } } } } };
  const one = historyContext(values),
    two = historyContext(values, 'dm');
  await Promise.all([
    one.SheetHistory.save('alice', 'hero', { hp: 8 }),
    two.SheetHistory.save('alice', 'hero', { nome: 'Aria II' }),
  ]);
  assert.equal(values.schedePG.alice.chars.hero.hp, 8);
  assert.equal(values.schedePG.alice.chars.hero.nome, 'Aria II');
  const entries = one.SheetHistoryModel.ordered(values.sheetHistory.alice.hero.entries);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].version, 1);
  assert.equal(entries[1].version, 2);
  assert.equal(entries[1].actor, 'dm');
  assert.equal(JSON.parse(entries[0].before).hp, 10);
  await one.SheetHistory.save('alice', 'hero', { hp: 8 });
  await one.SheetHistory.save('alice', 'hero', { boardImages: [], annotations: {} });
  assert.equal(values.sheetHistory.alice.hero.head.version, 2);
});

test('restore creates a new revision, can undo itself and refuses stale previews or incomplete history', async () => {
  const values = { schedePG: { alice: { chars: { hero: { hp: 10, nome: 'Aria' } } } } };
  const ctx = historyContext(values),
    service = ctx.SheetHistory;
  await service.save('alice', 'hero', { hp: 8 });
  await service.save('alice', 'hero', { hp: 2, nome: 'Errore' });
  const head = structuredClone(values.sheetHistory.alice.hero.head);
  await service.restore('alice', 'hero', values.sheetHistory.alice.hero.entries, 0, head);
  assert.equal(values.schedePG.alice.chars.hero.hp, 10);
  assert.equal(values.schedePG.alice.chars.hero.nome, 'Aria');
  const history = values.sheetHistory.alice.hero;
  assert.equal(history.head.version, 3);
  assert.equal(history.entries[history.head.revision].kind, 'restore');
  await assert.rejects(service.restore('alice', 'hero', history.entries, 1, head), /cambiata/);
  assert.throws(
    () => ctx.SheetHistoryModel.restore(values.schedePG.alice.chars.hero, {}, 1, history.head),
    /incompleto/
  );
  await service.restore('alice', 'hero', history.entries, 2, structuredClone(history.head));
  assert.equal(values.schedePG.alice.chars.hero.nome, 'Errore');
  assert.equal(values.schedePG.alice.chars.hero.hp, 2);
});

test('restoring old data preserves later shop inventory, receipts and balances while ordinary coin errors remain reversible', async () => {
  const values = { schedePG: { alice: { chars: { hero: { hp: 10, oro: 100 } } } } };
  const ctx = historyContext(values),
    service = ctx.SheetHistory;
  await service.save('alice', 'hero', { oro: 1 });
  await service.restore(
    'alice',
    'hero',
    values.sheetHistory.alice.hero.entries,
    0,
    structuredClone(values.sheetHistory.alice.hero.head)
  );
  assert.equal(values.schedePG.alice.chars.hero.oro, 100);
  await service.save(
    'alice',
    'hero',
    { oro: 50, trade: { version: 1, inventory: { potion: { quantity: 1 } } } },
    { kind: 'purchase' }
  );
  await service.save('alice', 'hero', { hp: 1 });
  await service.restore(
    'alice',
    'hero',
    values.sheetHistory.alice.hero.entries,
    0,
    structuredClone(values.sheetHistory.alice.hero.head)
  );
  assert.equal(values.schedePG.alice.chars.hero.hp, 10);
  assert.equal(values.schedePG.alice.chars.hero.oro, 50);
  assert.equal(values.schedePG.alice.chars.hero.trade.inventory.potion.quantity, 1);
});
