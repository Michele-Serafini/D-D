import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {renderFirebaseConfig} from '../scripts/firebase-runtime.mjs';
import {optimizeAsset} from '../scripts/optimize-assets.mjs';
import {secretLocations} from '../scripts/check-secrets.mjs';

const metadata=JSON.parse(fs.readFileSync('config/firebase.web.json','utf8'));

test('Firebase configuration requires a deployment value and keeps credentials out of tracked metadata',()=>{
 assert.throws(()=>renderFirebaseConfig(metadata,''),/FIREBASE_WEB_API_KEY/);
 assert.equal(metadata.apiKey,undefined);
 const context={window:{}};
 vm.runInNewContext(renderFirebaseConfig(metadata,'test-deployment-key'),context);
 assert.equal(context.window.__FIREBASE_CONFIG__.projectId,metadata.projectId);
 assert.equal(context.window.__FIREBASE_CONFIG__.apiKey,'test-deployment-key');
 assert.deepEqual(secretLocations(JSON.stringify(metadata)),[]);
});

test('secret detection returns line numbers without disclosing matched values',()=>{
 const key='AIza'+'x'.repeat(35);
 assert.deepEqual(secretLocations('safe\n'+key+'\n'),[2]);
 assert.deepEqual(secretLocations('FIREBASE_WEB_API_KEY=\n'),[]);
 assert.deepEqual(secretLocations('ghp_'+'x'.repeat(36)),[1]);
});

test('optimized classic scripts retain shared globals and all catalog values',()=>{
 const users=fs.readFileSync('js/users.js');
 const compactUsers=optimizeAsset('js/users.js',users);
 const context={window:{}};
 vm.runInNewContext(compactUsers.toString(),context);
 assert.equal(typeof context.UserManager.signIn,'function');
 assert.equal(typeof context.doSignIn,'function');
 assert.equal(typeof context.isDM,'function');
 assert.equal(context.window.UserManager,context.UserManager);
 assert.ok(compactUsers.length<users.length);
 const originalCatalog=fs.readFileSync('data/catalog-data.js');
 const original={window:{}},compact={window:{}};
 vm.runInNewContext(originalCatalog.toString(),original);
 vm.runInNewContext(optimizeAsset('data/catalog-data.js',originalCatalog).toString(),compact);
 for(const key of Object.keys(original).filter(key=>key!=='window')){
  if(typeof original[key]!=='function') assert.deepEqual(JSON.parse(JSON.stringify(compact[key])),JSON.parse(JSON.stringify(original[key])),key);
 }
});

test('JSON compaction preserves data and binary media pass through unchanged',()=>{
 const json=Buffer.from('{\n  "book": {"title":"Grimorio", "pages": [1,2]}\n}');
 const compact=optimizeAsset('book.json',json);
 assert.deepEqual(JSON.parse(compact),JSON.parse(json));
 assert.ok(compact.length<json.length);
 const image=Buffer.from([0,128,255]);assert.equal(optimizeAsset('image.png',image),image);
});
