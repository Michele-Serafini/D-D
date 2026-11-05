import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

export function historyContext(values, username = 'alice') {
  const read = (path) =>
    structuredClone(
      path
        .split('/')
        .filter(Boolean)
        .reduce((node, key) => node?.[key], values) ?? null
    );
  function write(path, value) {
    const keys = path.split('/').filter(Boolean);
    let node = values;
    for (const key of keys.slice(0, -1)) node = node[key] ??= {};
    if (value == null) delete node[keys.at(-1)];
    else node[keys.at(-1)] = structuredClone(value);
  }
  const ctx = vm.createContext({
    firebase: { database: { ServerValue: { TIMESTAMP: Date.now() } } },
    crypto: { randomUUID },
    state: { currentUser: { username } },
    SheetStore: { observe() {} },
    _schedaFix: (x) => structuredClone(x),
    _campaignDb: {
      ref(path) {
        return {
          once: async () => {
            const value = read(path);
            return { val: () => value, exists: () => value !== null };
          },
          update: async (changes) => {
            for (const [key, value] of Object.entries(changes)) {
              if (key.endsWith('/head') && value.version !== (read(key)?.version || 0) + 1)
                throw new Error('permission_denied');
            }
            for (const [key, value] of Object.entries(changes)) write(key, value);
          },
        };
      },
    },
  });
  for (const file of ['history-model', 'history-service'])
    vm.runInContext(fs.readFileSync('js/features/sheets/' + file + '.js', 'utf8'), ctx);
  return ctx;
}

// Actual SDK reads and writes are supplied by the emulator test.
export async function auditWrites(database, changes, actor, { get, ref }) {
  const base = 'campaigns/first/data/';
  const path = base + 'schedePG/alice/chars/hero';
  const before = (await get(ref(database, path))).val();
  const head = (await get(ref(database, base + 'sheetHistory/alice/hero/head'))).val() || {
    version: 0,
  };
  const ctx = historyContext({}, actor),
    patch = {};
  ctx.firebase.database.ServerValue.TIMESTAMP = { '.sv': 'timestamp' };
  for (const [key, value] of Object.entries(changes))
    if (key.startsWith(path + '/')) patch[key.slice(path.length + 1)] = value;
  const after = ctx.SheetHistoryModel.apply(before, patch);
  const history = ctx.SheetHistory.record('alice', 'hero', before, after, head);
  return {
    ...changes,
    ...Object.fromEntries(Object.entries(history || {}).map(([key, value]) => [base + key, value])),
  };
}
