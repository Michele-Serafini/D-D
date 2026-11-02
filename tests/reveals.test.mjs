import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function context(master = true) {
  const writes = [];
  const ctx = vm.createContext({
    URL,
    crypto: { randomUUID: () => 'fixture' },
    state: { currentUser: { username: 'dm' } },
    isDM: () => master,
    _campaignDb: {
      ref: (path) => ({
        set: async (value) => writes.push({ path, value }),
        once: async () => ({ val: () => ({ revision: 2 }) }),
      }),
    },
  });
  for (const name of ['model', 'service'])
    vm.runInContext(fs.readFileSync('js/features/reveals/' + name + '.js', 'utf8'), ctx);
  return { ctx, writes };
}
test('published projections exclude all private notes and versioned drafts retain their original creator', () => {
  const { ctx } = context(),
    model = ctx.RevealModel;
  const first = model.draft(
    { type: 'npc', title: 'Guardiano', text: 'Benvenuti', masterNotes: 'È il colpevole' },
    null,
    'dm',
    1
  );
  const second = model.draft({ ...first, title: 'Custode' }, first, 'other-dm', 2);
  assert.equal(second.revision, 2);
  assert.equal(second.createdBy, 'dm');
  assert.equal(second.updatedBy, 'other-dm');
  const shared = model.publicCopy(second, 'dm', 3);
  assert.equal(shared.title, 'Custode');
  assert.equal(shared.masterNotes, undefined);
  assert.equal(JSON.stringify(shared).includes('colpevole'), false);
  assert.equal(first.title, 'Guardiano');
});
test('drafts validate type, lengths and safe image schemes before making requests', () => {
  const { ctx } = context(),
    model = ctx.RevealModel;
  for (const image of [
    'javascript:alert(1)',
    'data:image/svg+xml;base64,abc',
    'http://example.com/a.png',
    'https://user:password@example.com/a.png',
  ])
    assert.throws(() => model.image(image), /HTTPS/);
  assert.equal(model.image('https://example.com/image.png'), 'https://example.com/image.png');
  assert.equal(model.image('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  assert.throws(() => model.draft({ type: 'immagine', title: 'Mappa' }, null, 'dm', 1), /immagine/);
  assert.throws(
    () => model.draft({ type: 'indizio', title: ' '.repeat(3) }, null, 'dm', 1),
    /titolo/
  );
  assert.throws(
    () => model.draft({ type: 'npc', title: 'x', masterNotes: 'a'.repeat(20001) }, null, 'dm', 1),
    /lunghi/
  );
});
test('reveal refuses an unreviewed newer version and players cannot call master writes', async () => {
  const { ctx, writes } = context();
  await assert.rejects(ctx.RevealService.reveal('npc', 1), /cambiato/);
  assert.equal(writes.length, 0);
  const player = context(false);
  await assert.rejects(player.ctx.RevealService.save(null, { type: 'npc', title: 'x' }), /master/);
  await assert.rejects(player.ctx.RevealService.reveal('npc', 1), /master/);
  assert.equal(player.writes.length, 0);
});
