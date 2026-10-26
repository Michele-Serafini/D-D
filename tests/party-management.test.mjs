import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { staticAssets, assetAliases } from '../scripts/static-assets.mjs';

function setup() {
  const error = { style: {}, textContent: '' }, profiles = { michele: { uid: 'michele', role: 'Giocatore' } };
  const passwords = { michele: 'current', admin: 'admin' };
  const listeners = new Map(), writes = [];
  const identity = name => ({ uid: name, email: name + '@dd.local',
    async reauthenticateWithCredential(c) { if (passwords[name] !== c.password) throw new Error('wrong password'); },
    async updatePassword(p) { passwords[name] = p; }, async delete() { delete passwords[name]; } });
  const auth = { currentUser: null, async signInWithEmailAndPassword(email, password) {
    const name = email.split('@')[0];
    if (!passwords[name] || passwords[name] !== password) { const e = new Error('bad credentials');e.code='auth/invalid-credential';throw e; }
    this.currentUser=identity(name);return { user: this.currentUser };
  }, async signOut() { this.currentUser=null; } };
  const authFn = Object.assign(() => auth, { EmailAuthProvider: { credential: (email,password) => ({email,password}) } });
  let secondaryDeleted = 0;
  const firebase = { auth: authFn, initializeApp() { return { auth: () => ({ async createUserWithEmailAndPassword(email,password) {
    const name=email.split('@')[0];passwords[name]=password;return {user:identity(name)};
  },async signOut(){} }), async delete() { secondaryDeleted++; } }; } };
  const ctx = { window:{}, state:{currentUser:null},localStorage:{setItem(){}},console,setTimeout,clearTimeout,setInterval,URLSearchParams,firebase,
    document:{getElementById(id){return id==='login-error'?error:null;},querySelector(){return null;},addEventListener(){}} };
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/users.js','utf8'),ctx);vm.runInContext(fs.readFileSync('js/party-admin.js','utf8'),ctx);
  const mapping={michele:'michele'};
  ctx._db={ref(path='') {return {
    async once(){return {val:()=>path==='users'?profiles:path.startsWith('userAccess/')?mapping[path.split('/')[1]]:profiles[path.split('/')[1]]};},
    async update(changes){writes.push(changes);for(const [key,value]of Object.entries(changes)){const [type,name]=key.split('/');if(type==='users')profiles[name]=value;else mapping[name]=value;}},
    async set(value){if(path.endsWith('/disabled'))profiles[path.split('/')[1]].disabled=value;},
    async transaction(fn){const key=path.split('/')[1];const next=fn(profiles[key]?structuredClone(profiles[key]):null);if(next===undefined)return{committed:false};profiles[key]=next;return{committed:true};},
    on(event,callback){listeners.set(path,callback);},
    off(event,callback){if(listeners.get(path)===callback)listeners.delete(path);},
  };}};
  return{ctx,manager:ctx.UserManager,error,profiles,passwords,auth,listeners,writes,get secondaryDeleted(){return secondaryDeleted;}};
}

test('login requires Firebase Auth, resolves UID and rejects disabled users without default fallback',async()=>{
 const {ctx,manager,error,profiles}=setup(),signed=[];
 manager.completeLogin=(name,record)=>signed.push({name,record});
 await manager.signIn(' MICHELE ','current');assert.equal(signed[0].name,'michele');
 await manager.signIn('michele','player');assert.equal(signed.length,1);assert.match(error.textContent,/Accesso non riuscito/);
 profiles.michele.disabled=true;await manager.signIn('michele','current');assert.equal(signed.length,1);
 delete profiles.michele;await manager.signIn('michele','current');assert.equal(signed.length,1);
 await manager.signIn('admin','wrong');assert.equal(signed.length,1);
 await manager.signIn('admin','admin');assert.equal(signed[1].record.role,'Admin');assert.equal(ctx.firebase.auth().currentUser.uid,'admin');
});

test('admin creates a separate Firebase Auth identity and publishes metadata without passwords',async()=>{
 const fixture=setup(),{ctx,manager,profiles,auth,writes}=fixture;
 await assert.rejects(manager.addPlayer('nuovo','player'),/riservato/);
 ctx._authRole='admin';auth.currentUser={uid:'admin'};
 await manager.addPlayer(' Nuovo ','player');
 assert.equal(auth.currentUser.uid,'admin');assert.equal(profiles.nuovo.uid,'nuovo');
 assert.equal(profiles.nuovo.password,undefined);assert.equal(writes[0]['userAccess/nuovo'],'nuovo');
 assert.equal(fixture.secondaryDeleted,1);
 await assert.rejects(manager.addPlayer('nuovo','player'),/già utilizzato/);
 await assert.rejects(manager.addPlayer('admin','player'),/riservato/);
 await assert.rejects(manager.addPlayer('other','short'),/6 caratteri/);
});

test('removal revokes a live session, protects the master and supports reactivation',async()=>{
 const{ctx,manager,profiles,listeners}=setup();ctx._authRole='admin';
 profiles.sebastiano={role:'DM'};await assert.rejects(manager.removePlayer('sebastiano'),/solo i giocatori/);
 profiles.michele.worldbuilding=['keep'];await manager.removePlayer('michele');
 assert.equal(profiles.michele.disabled,true);assert.deepEqual(profiles.michele.worldbuilding,['keep']);
 ctx.state.currentUser={username:'michele'};let revoked=0;manager.signOut=()=>revoked++;
 manager.watchUsers();listeners.get('users/michele')({val:()=>profiles.michele});assert.equal(revoked,1);
 await manager.reactivatePlayer('michele');assert.equal(profiles.michele.disabled,false);
 manager.stopWatchingUsers();assert.equal(listeners.size,0);
 manager.watchUsers();assert.equal(listeners.size,2);
 manager.watchUsers();assert.equal(listeners.size,2);
});

test('password changes reauthenticate in Firebase Auth and never write credentials into the database',async()=>{
 const{ctx,manager,auth,passwords,writes}=setup();
 await assert.rejects(manager.changePassword('michele','current','changed'),/Accedi/);
 ctx.state.currentUser={username:'michele'};await auth.signInWithEmailAndPassword('michele@dd.local','current');
 await assert.rejects(manager.changePassword('michele','wrong','changed'),/wrong/);
 await manager.changePassword('michele','current','changed');assert.equal(passwords.michele,'changed');assert.equal(writes.length,0);
 await assert.rejects(manager.changePassword('michele','changed','short'),/6 caratteri/);
});

test('production assets include the new config, admin, catalogs and original media without duplicates',()=>{
 const emitted=new Map();staticAssets().generateBundle.call({emitFile(asset){emitted.set(asset.fileName,asset.source);}});
 for(const name of ['admin.html','js/firebase-config.js','js/users.js','js/party-admin.js','data/catalog-data.js','database_armi.json','css/legacy.css','img/login_mobile.jpg','schede/7th_sea.webp']){
 assert.ok(emitted.has(name),name);assert.deepEqual(emitted.get(name),fs.readFileSync(assetAliases[name] || name));}
 assert.equal(fs.existsSync('public/js/users.js'),false);
 assert.equal(fs.existsSync('scripts/reset-party.mjs'),false);
});
