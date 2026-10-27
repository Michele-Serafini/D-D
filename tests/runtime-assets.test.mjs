import accountPolicy from '../config/accounts.json' with { type: 'json' };
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { renderFirebaseConfig } from '../scripts/firebase-runtime.mjs';
import { optimizeAsset } from '../scripts/optimize-assets.mjs';
import { secretLocations, protectedFileReason, scanRepository } from '../scripts/check-secrets.mjs';

const metadata = JSON.parse(fs.readFileSync('config/firebase.web.json', 'utf8'));

test('Firebase configuration requires a deployment value and keeps credentials out of tracked metadata', () => {
  assert.throws(() => renderFirebaseConfig(metadata, ''), /FIREBASE_WEB_API_KEY/);
  assert.equal(metadata.apiKey, undefined);
  const context = { window: { __ACCOUNT_POLICY__: accountPolicy } };
  vm.runInNewContext(renderFirebaseConfig(metadata, 'test-deployment-key'), context);
  assert.equal(context.window.__FIREBASE_CONFIG__.projectId, metadata.projectId);
  assert.equal(context.window.__FIREBASE_CONFIG__.apiKey, 'test-deployment-key');
  assert.deepEqual(secretLocations(JSON.stringify(metadata)), []);
});

test('secret detection returns line numbers without disclosing matched values', () => {
  const key = 'AIza' + 'x'.repeat(35);
  assert.deepEqual(secretLocations('safe\n' + key + '\n'), [2]);
  assert.deepEqual(secretLocations('FIREBASE_WEB_API_KEY=\n'), []);
  assert.deepEqual(secretLocations('ghp_' + 'x'.repeat(36)), [1]);
});

test('environment files and generated runtime configuration cannot be versioned', () => {
  for (const file of [
    '.env',
    '.env.local',
    'nested/.env.production',
    'js/firebase-config.js',
    'public/js/firebase-config.js',
    'dist/js/firebase-config.js',
  ]) {
    assert.ok(protectedFileReason(file), file);
  }
  for (const file of ['.env.example', 'config/firebase.web.json', 'scripts/firebase-runtime.mjs']) {
    assert.equal(protectedFileReason(file), null, file);
  }
});

test('repository scanner catches staged secrets and extensionless text without reading ignored local settings', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-secret-scan-'));
  const run = promisify(execFile);
  const git = (...args) => run('git', args, { cwd: root });
  const key = 'AIza' + 'x'.repeat(35);
  try {
    await git('init', '-q');
    fs.writeFileSync(path.join(root, '.gitignore'), '.env*\n!.env.example\ndist/\n');
    fs.writeFileSync(path.join(root, '.env.local'), 'FIREBASE_WEB_API_KEY=' + key);
    fs.writeFileSync(path.join(root, '.env.example'), 'FIREBASE_WEB_API_KEY=\n');
    assert.deepEqual(await scanRepository(root), []);
    fs.writeFileSync(path.join(root, 'settings'), 'header\n' + key + '\n');
    let issues = await scanRepository(root);
    assert.equal(issues[0].file, 'settings');
    assert.equal(issues[0].line, 2);
    await git('add', 'settings');
    fs.writeFileSync(path.join(root, 'settings'), 'safe working copy\n');
    issues = await scanRepository(root);
    assert.equal(issues[0].source, 'index');
    assert.equal(issues[0].line, 2);
    assert.equal(JSON.stringify(issues).includes(key), false);
    fs.writeFileSync(path.join(root, '.env.production'), 'FIREBASE_WEB_API_KEY=\n');
    await git('add', '-f', '.env.production');
    assert.ok(
      (await scanRepository(root)).some(
        (issue) => issue.file === '.env.production' && issue.message.includes('ambiente')
      )
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('optimized classic scripts retain shared globals and all catalog values', () => {
  const users = fs.readFileSync('js/users.js');
  const compactUsers = optimizeAsset('js/users.js', users);
  const context = { window: { __ACCOUNT_POLICY__: accountPolicy } };
  vm.runInNewContext(compactUsers.toString(), context);
  assert.equal(typeof context.UserManager.signIn, 'function');
  assert.equal(typeof context.doSignIn, 'function');
  assert.equal(typeof context.isDM, 'function');
  assert.equal(context.window.UserManager, context.UserManager);
  assert.ok(compactUsers.length < users.length);
  const originalCatalog = fs.readFileSync('data/catalog-data.js');
  const original = { window: { __ACCOUNT_POLICY__: accountPolicy } },
    compact = { window: { __ACCOUNT_POLICY__: accountPolicy } };
  vm.runInNewContext(originalCatalog.toString(), original);
  vm.runInNewContext(optimizeAsset('data/catalog-data.js', originalCatalog).toString(), compact);
  for (const key of Object.keys(original).filter((key) => key !== 'window')) {
    if (typeof original[key] !== 'function')
      assert.deepEqual(
        JSON.parse(JSON.stringify(compact[key])),
        JSON.parse(JSON.stringify(original[key])),
        key
      );
  }
});

test('JSON compaction preserves data and binary media pass through unchanged', () => {
  const json = Buffer.from('{\n  "book": {"title":"Grimorio", "pages": [1,2]}\n}');
  const compact = optimizeAsset('book.json', json);
  assert.deepEqual(JSON.parse(compact), JSON.parse(json));
  assert.ok(compact.length < json.length);
  const image = Buffer.from([0, 128, 255]);
  assert.equal(optimizeAsset('image.png', image), image);
});
