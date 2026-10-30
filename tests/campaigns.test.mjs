import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { appSources } from '../config/assets.mjs';

test('game modules use the campaign database; raw database access stays in the campaign service', () => {
  for (const file of appSources
    .filter((file) => file !== 'js/core/campaigns.js')
    .concat([
      'js/sheets/brancalonia.js',
      'js/sheets/sw5e.js',
      'js/sheets/pokemon.js',
      'js/sheets/naruto.js',
    ])) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\b_db\b|firebase\.database\(/, file);
  }
});

test('a scoped database keeps references in their campaign and waits for pending writes', async () => {
  const paths = [];
  let commit;
  const write = new Promise((resolve) => {
    commit = resolve;
  });
  const context = {
    window: {},
    _db: {
      ref(path) {
        paths.push(path);
        return {
          set() {
            return write;
          },
        };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/core/campaigns.js', 'utf8'), context);
  const database = context.createCampaignDatabase('first');
  context.CampaignManager.current = { id: 'second' };
  database.ref('state/notes').set('First campaign');
  let flushed = false;
  const waiting = database.flush().then(() => {
    flushed = true;
  });
  await Promise.resolve();
  assert.equal(flushed, false);
  commit();
  await waiting;
  assert.equal(flushed, true);
  assert.deepEqual(paths, ['campaigns/first/data/state/notes']);
  assert.throws(() => database.ref('../users'), /Percorso/);
  assert.throws(() => database.ref('/users'), /Percorso/);
});

test('local snapshots and same-named images are isolated by campaign and account', () => {
  let username = 'alice';
  const context = { window: {}, UserManager: { getUsername: () => username } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/core/campaigns.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/core/image-db.js', 'utf8'), context);
  context.CampaignManager.current = { id: 'first' };
  const original = context.window.ImageDB.scopedKey('portrait');
  context.CampaignManager.current = { id: 'second' };
  assert.notEqual(context.window.ImageDB.scopedKey('portrait'), original);
  context.CampaignManager.current = { id: 'first' };
  username = 'bob';
  assert.notEqual(context.window.ImageDB.scopedKey('portrait'), original);
  username = 'alice';
  assert.equal(context.window.ImageDB.scopedKey('portrait'), original);
});
