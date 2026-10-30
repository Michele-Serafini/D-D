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
  // A membership index is only a listing aid. All access checks use the members
  // stored with the campaign, including for users with global DM privileges.
  const campaign = "root.child('campaigns').child($campaign)";
  const role = `${campaign}.child('members').child(${name}).val()`;
  const member = `(${active}) && (${role} === 'player' || ${role} === 'dm')`;
  const campaignDM = `(${active}) && ${role} === 'dm'`;
  const scopedOwner = `(${member}) && (${owner})`;
  const creator = `(${dm}) && !data.exists() && newData.child('meta').child('owner').val() === ${name} && newData.child('members').child(${name}).val() === 'dm'`;
  const nextRoot = 'newData.parent().parent().parent()';
  const nextCampaign = `${nextRoot}.child('campaigns').child($campaign)`;
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
    campaignAccess: {
      $name: {
        '.read': activeOwner,
        $campaign: {
          '.write': `(${campaignDM}) || ((${dm}) && ${nextCampaign}.child('meta').child('owner').val() === ${name})`,
          '.validate': `newData.isBoolean() && newData.val() === true && ${nextCampaign}.child('members').child($name).exists()`,
        },
      },
    },
    campaigns: {
      $campaign: {
        '.write': creator,
        '.validate': "newData.hasChildren(['meta', 'members'])",
        meta: {
          '.read': member,
          '.write': campaignDM,
          '.validate': "newData.hasChildren(['name', 'description', 'owner', 'createdAt'])",
          name: {
            '.validate':
              'newData.isString() && newData.val().length > 0 && newData.val().length <= 80',
          },
          description: { '.validate': 'newData.isString() && newData.val().length <= 500' },
          owner: {
            '.validate':
              "newData.isString() && (!data.exists() || newData.val() === data.val()) && newData.parent().parent().child('members').child(newData.val()).val() === 'dm'",
          },
          createdAt: {
            '.validate': 'newData.isNumber() && (!data.exists() || newData.val() === data.val())',
          },
          $other: { '.validate': false },
        },
        members: {
          '.read': member,
          '.write': campaignDM,
          '.validate':
            "newData.child(newData.parent().child('meta').child('owner').val()).val() === 'dm'",
          $name: {
            '.read': activeOwner,
            '.validate': `(newData.val() === 'dm' || newData.val() === 'player') && ($name === ${JSON.stringify(accountPolicy.adminUsername)} || (root.child('users').child($name).exists() && root.child('users').child($name).child('disabled').val() !== true))`,
          },
        },
        data: {
          schedePG: {
            '.read': campaignDM,
            '.write': campaignDM,
            $name: { '.read': scopedOwner, '.write': scopedOwner },
          },
          presence: { '.read': member, $name: { '.write': scopedOwner } },
          libri: {
            '.read': member,
            books: { '.write': campaignDM },
            preferiti: { $name: { '.write': scopedOwner } },
          },
          state: {
            $section: {
              '.read': `(${campaignDM}) || ((${member}) && $section !== 'config' && $section !== 'legacyUserContent')`,
              '.write': `(${campaignDM}) || ((${member}) && ($section === 'iniziativa' || $section === 'caos' || $section === 'notes' || $section === 'tavolo'))`,
            },
          },
          users: {
            $name: {
              mappa: { '.read': member, '.write': campaignDM },
              worldbuilding: { '.read': campaignDM, '.write': campaignDM },
            },
          },
          diceRolls: { '.read': member, '.write': member },
          dmConfig: { '.read': campaignDM, '.write': campaignDM },
          groups: { '.read': member, '.write': campaignDM },
          meta: { '.read': member, '.write': campaignDM },
          archivioIdee: {
            $name: {
              '.read': `(${scopedOwner}) || (${campaignDM})`,
              '.write': `(${scopedOwner}) || (${campaignDM})`,
            },
          },
        },
        $other: { '.validate': false },
      },
    },
  };
  for (const node of ['storia_private', 'storie_private', 'storia_markers_private']) {
    rules.campaigns.$campaign.data[node] = {
      $name: { '.read': scopedOwner, '.write': scopedOwner },
    };
  }
  return { rules };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(
    new URL('../database.rules.json', import.meta.url),
    JSON.stringify(buildDatabaseRules(), null, 2) + '\n'
  );
}
