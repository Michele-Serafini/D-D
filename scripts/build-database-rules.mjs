import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import accountPolicy from '../config/accounts.json' with { type: 'json' };

// RTDB rules cannot declare helpers. Keep permission expressions here and generate JSON.
export function buildDatabaseRules() {
  const adminUid = JSON.stringify(accountPolicy.adminUid);
  const masterRole = JSON.stringify(accountPolicy.roles.master.name);
  const name = "root.child('userAccess').child(auth.uid).val()";
  const profile = `root.child('users').child(${name})`;
  const active = `auth != null && (auth.uid === ${adminUid} || (root.child('userAccess').child(auth.uid).isString() && ${profile}.exists() && ${profile}.child('disabled').val() !== true))`;
  const admin = `(${active}) && (auth.uid === ${adminUid} || ${profile}.child('role').val() === ${masterRole})`;
  const dm = `(${active}) && (auth.uid === ${adminUid} || ${profile}.child('role').val() === ${masterRole} || ${profile}.child('dmPriv').val() === true)`;
  const owner = `auth != null && ${name} === $name`;
  const activeOwner = `(${active}) && (${owner})`;
  const rules = {
    '.read': admin,
    '.write': admin,
    userAccess: { $uid: { '.read': 'auth != null && auth.uid === $uid' } },
    users: {
      '.read': active,
      $name: {
        '.read': owner,
        '.write': `${activeOwner} && ${['role', 'dmPriv', 'disabled', 'uid'].map((field) => `newData.child('${field}').val() === data.child('${field}').val()`).join(' && ')}`,
        password: { '.validate': false },
      },
    },
    schedePG: { '.read': dm, $name: { '.read': activeOwner, '.write': activeOwner } },
    presence: { '.read': active, $name: { '.write': activeOwner } },
    libri: {
      '.read': active,
      books: { '.write': dm },
      preferiti: { $name: { '.write': activeOwner } },
    },
    state: {
      $section: {
        '.read': `(${active}) && $section !== 'config' && $section !== 'legacyUserContent'`,
        '.write': `(${dm}) || ((${active}) && ($section === 'iniziativa' || $section === 'caos' || $section === 'notes' || $section === 'tavolo'))`,
      },
    },
    diceRolls: { '.read': active, '.write': active },
    dmConfig: { '.read': dm, '.write': dm },
  };
  for (const node of ['meta', 'groups', 'archivioIdee']) rules[node] = { '.read': active };
  for (const node of ['storia_private', 'storie_private', 'storia_markers_private']) {
    rules[node] = { $name: { '.read': activeOwner, '.write': activeOwner } };
  }
  return { rules };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(
    new URL('../database.rules.json', import.meta.url),
    JSON.stringify(buildDatabaseRules(), null, 2) + '\n'
  );
}
