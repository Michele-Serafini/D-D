import { test as base, expect } from '@playwright/test';

// Isolated in-memory backend: browser tests never contact a real party/database.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:4173') return route.continue();
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
      };
      const data = {
        users,
        userAccess: Object.fromEntries(Object.keys(users).map((name) => [name, name])),
        meta: { partyResetVersion: '2026-10-26-party-v1' },
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
        if (item === null) delete node[keys.at(-1)];
        else node[keys.at(-1)] = structuredClone(item);
        for (const watcher of [...watchers]) {
          if (
            path === watcher.path ||
            path.startsWith(watcher.path + '/') ||
            watcher.path.startsWith(path + '/')
          )
            watcher.callback(snapshot(watcher.path));
        }
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
            write(path, item);
            callback?.(null);
            return Promise.resolve();
          },
          remove() {
            write(path, null);
            return Promise.resolve();
          },
          update(changes) {
            for (const [key, item] of Object.entries(changes))
              write([path, key].filter(Boolean).join('/'), item);
            return Promise.resolve();
          },
          transaction(change) {
            const item = change(structuredClone(value(path)));
            if (item === undefined) return Promise.resolve({ committed: false });
            write(path, item);
            return Promise.resolve({ committed: true });
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
        currentUser: null,
        async signInWithEmailAndPassword(email, password) {
          const name = email.split('@')[0];
          if (passwords[name] !== password)
            throw Object.assign(new Error('Invalid credentials'), {
              code: 'auth/invalid-credential',
            });
          this.currentUser = identity(name);
          return { user: this.currentUser };
        },
        async signOut() {
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
    await expect(page.locator('.main-content')).toBeVisible();
  }
}
