import fs from 'node:fs';
import { renderFirebaseConfig } from '../../scripts/firebase-runtime.mjs';
import { test as base, expect } from '@playwright/test';

// Isolated in-memory backend: browser tests never contact a real party/database.
const configScript = renderFirebaseConfig(
  JSON.parse(fs.readFileSync('config/firebase.web.json', 'utf8')),
  'browser-test-placeholder'
);

export const test = base.extend({
  page: async ({ page }, use) => {
    // The simulated server lives in the test runner, not browser storage quotas.
    let serverSnapshot = null;
    await page.exposeBinding('__persistTestDatabase', (_, data) => {
      serverSnapshot = data;
    });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:4173') {
        if (url.pathname.endsWith('/js/firebase-config.js')) {
          return route.fulfill({
            contentType: 'application/javascript',
            body:
              configScript +
              '\nwindow.__restoreTestDatabase(' +
              JSON.stringify(serverSnapshot) +
              ');',
          });
        }
        return route.continue();
      }
      if (url.hostname === 'www.gstatic.com')
        return route.fulfill({ contentType: 'application/javascript', body: '' });
      if (url.hostname === 'fonts.googleapis.com')
        return route.fulfill({ contentType: 'text/css', body: '' });
      return route.abort();
    });
    await page.addInitScript(() => {
      const users = {
        sebastiano: { uid: 'sebastiano', role: 'DM', crest: '👑', dmPriv: true },
        michele: { uid: 'michele', role: 'Giocatore', crest: '⚔' },
        montre: { uid: 'montre', role: 'Giocatore', crest: '✨' },
        alessio: { uid: 'alessio', role: 'Giocatore', crest: '🛡' },
      };
      const passwords = {
        admin: 'fixture-password',
        sebastiano: 'fixture-password',
        michele: 'fixture-password',
        montre: 'fixture-password',
        alessio: 'fixture-password',
      };
      const initialData = {
        users,
        userAccess: Object.fromEntries(Object.keys(users).map((name) => [name, name])),
        meta: { partyResetVersion: '2026-10-26-party-v1', campaignMigration: { version: 1 } },
        campaigns: {
          principale: {
            meta: {
              name: 'Campagna principale',
              description: '',
              owner: 'sebastiano',
              createdAt: 1,
            },
            members: { sebastiano: 'dm', michele: 'player', montre: 'player', alessio: 'player' },
          },
          mare: {
            meta: { name: 'Campagna del mare', description: '', owner: 'sebastiano', createdAt: 2 },
            members: { sebastiano: 'dm', michele: 'player' },
          },
        },
        campaignAccess: {
          sebastiano: { principale: true, mare: true },
          michele: { principale: true, mare: true },
          montre: { principale: true },
          alessio: { principale: true },
        },
      };
      const data = JSON.parse(sessionStorage.getItem('__testDatabase') || 'null') || initialData;
      window.__restoreTestDatabase = (snapshot) => {
        if (!snapshot) return;
        Object.keys(data).forEach((key) => delete data[key]);
        Object.assign(data, snapshot);
      };
      const watchers = new Set();
      const value = (path) =>
        path
          .split('/')
          .filter(Boolean)
          .reduce((node, key) => node?.[key], data) ?? null;
      const snapshot = (path) => ({
        key: path.split('/').at(-1),
        val: () => structuredClone(value(path)),
        exists: () => value(path) !== null,
        child: (key) => snapshot(path + '/' + key),
        forEach: (callback) =>
          Object.keys(value(path) || {}).some(
            (key) => callback(snapshot(path + '/' + key)) === true
          ),
      });
      function write(path, item) {
        const keys = path.split('/').filter(Boolean);
        let node = data;
        for (const key of keys.slice(0, -1)) node = node[key] ??= {};
        if (!keys.length) {
          Object.keys(data).forEach((key) => delete data[key]);
          Object.assign(data, structuredClone(item));
        } else if (item === null) delete node[keys.at(-1)];
        else node[keys.at(-1)] = structuredClone(item);
        const persisted = window.__persistTestDatabase(data);
        for (const watcher of [...watchers]) {
          if (
            !path ||
            path === watcher.path ||
            path.startsWith(watcher.path + '/') ||
            watcher.path.startsWith(path + '/')
          )
            watcher.callback(snapshot(watcher.path));
        }
        return persisted;
      }
      function ref(path = '') {
        return {
          key: path.split('/').at(-1),
          once(event, success) {
            const item = snapshot(path);
            success?.(item);
            return Promise.resolve(item);
          },
          on(event, callback) {
            watchers.add({ path, callback });
            callback(snapshot(path));
            return callback;
          },
          off(event, callback) {
            for (const item of watchers)
              if (item.path === path && (!callback || item.callback === callback))
                watchers.delete(item);
          },
          child(key) {
            return ref(path + '/' + key);
          },
          limitToFirst() {
            return this;
          },
          limitToLast() {
            return this;
          },
          push() {
            return ref(path + '/entry-' + Date.now());
          },
          set(item, callback) {
            return write(path, item).then(() => callback?.(null));
          },
          remove() {
            return write(path, null);
          },
          update(changes) {
            return Promise.all(
              Object.entries(changes).map(([key, item]) =>
                write([path, key].filter(Boolean).join('/'), item)
              )
            );
          },
          transaction(change) {
            const item = change(structuredClone(value(path)));
            if (item === undefined) return Promise.resolve({ committed: false });
            return write(path, item).then(() => ({ committed: true }));
          },
          onDisconnect() {
            return { set: () => Promise.resolve() };
          },
        };
      }
      const database = () => ({ ref });
      database.ServerValue = { TIMESTAMP: 0 };
      const identity = (name) => ({
        uid: name,
        email: name + '@dd.local',
        async delete() {
          delete passwords[name];
        },
      });
      const auth = {
        currentUser: sessionStorage.getItem('__testIdentity')
          ? identity(sessionStorage.getItem('__testIdentity'))
          : null,
        onAuthStateChanged(callback) {
          queueMicrotask(() => callback(this.currentUser));
          return () => {};
        },
        async signInWithEmailAndPassword(email, password) {
          const name = email.split('@')[0];
          if (passwords[name] !== password)
            throw Object.assign(new Error('Invalid credentials'), {
              code: 'auth/invalid-credential',
            });
          sessionStorage.setItem('__testIdentity', name);
          this.currentUser = identity(name);
          return { user: this.currentUser };
        },
        async signOut() {
          sessionStorage.removeItem('__testIdentity');
          this.currentUser = null;
        },
      };
      const authFunction = Object.assign(() => auth, {
        EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
      });
      window.firebase = {
        apps: [{}],
        app: () => ({}),
        database,
        auth: authFunction,
        initializeApp() {
          return {
            auth: () => ({
              async createUserWithEmailAndPassword(email, password) {
                const name = email.split('@')[0];
                passwords[name] = password;
                return { user: identity(name) };
              },
              async signOut() {},
            }),
            async delete() {},
          };
        },
      };
      window.__testDatabase = data;
    });
    await use(page);
  },
});
export { expect };

export async function expectViewportFits(page) {
  // Wait for the final responsive layout and report useful dimensions on failure.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const viewport = innerWidth;
        const scroll = document.documentElement.scrollWidth;
        if (scroll <= viewport) return null;
        const title = document.querySelector('.header-title');
        return {
          viewport,
          scroll,
          titleFont: title && getComputedStyle(title).fontSize,
          mobileQuery: matchMedia('(max-width: 600px)').matches,
        };
      })
    )
    .toBeNull();
}

export async function login(page, username = 'michele', admin = false) {
  await page.goto('/D-D/' + (admin ? 'admin.html' : 'index.html'));
  await page.locator('#login-username-input').fill(username);
  await page.locator('#login-password-input').fill('fixture-password');
  await page.locator('#login-cred-area .login-btn').click();
  if (admin) await expect(page.locator('#admin-panel')).toBeVisible();
  else {
    await expect
      .poll(() => page.evaluate(() => window.state?.currentUser?.username))
      .toBe(username.toLowerCase());
    await expect(page.locator('#login-overlay')).toBeHidden();
    await page
      .locator('[data-campaign-id=principale]')
      .getByRole('button', { name: 'Entra', exact: true })
      .click();
    await expect(page.locator('.main-content')).toBeVisible();
  }
}
