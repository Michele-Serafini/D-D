/* Accounts are global; every game reference belongs to one immutable page scope. */
var _campaignDb = null;
function createCampaignDatabase(id) {
  var pending = new Set();
  var references = new WeakMap();
  function wrap(reference) {
    if (references.has(reference)) return references.get(reference);
    var proxy = new Proxy(reference, {
      get: function (target, key) {
        var value = Reflect.get(target, key, target);
        if (typeof value !== 'function') return value;
        return function () {
          var result = value.apply(target, arguments);
          if (['set', 'update', 'remove', 'transaction'].includes(key) && result?.then) {
            pending.add(result);
            result.then(
              function () {
                pending.delete(result);
              },
              function () {
                pending.delete(result);
              }
            );
          }
          return [
            'child',
            'push',
            'limitToFirst',
            'limitToLast',
            'orderByChild',
            'orderByKey',
            'orderByValue',
            'startAt',
            'endAt',
            'equalTo',
          ].includes(key)
            ? wrap(result)
            : result;
        };
      },
    });
    references.set(reference, proxy);
    return proxy;
  }
  return Object.freeze({
    ref: function (path) {
      return wrap(_db.ref(CampaignManager.dataPath(id, path)));
    },
    flush: async function () {
      while (pending.size) await Promise.all(Array.from(pending));
    },
  });
}
var CampaignManager = {
  current: null,
  ready: false,
  campaigns: [],
  resumeKey: 'mercante_campaign_switch',

  canCreate: function () {
    return _authRole === 'admin' || _authRole === 'dm';
  },
  canManage: function (campaign) {
    return UserManager.isAdmin() || campaign.members[UserManager.getUsername()] === 'dm';
  },
  profiles: function () {
    if (!this.current) return {};
    var members = this.current.members;
    return Object.fromEntries(
      Object.entries(
        Object.assign(
          {
            [ACCOUNT_POLICY.adminUsername]: UserManager.getProfile(ACCOUNT_POLICY.adminUsername, {
              role: ACCOUNT_POLICY.roles.admin.name,
            }),
          },
          _remoteUsers
        )
      ).filter(function (entry) {
        return members[entry[0]] && !entry[1].disabled;
      })
    );
  },
  storageKey: function () {
    return 'mercante_v2:' + UserManager.getUsername() + ':' + this.current.id;
  },
  dataPath: function (id, path) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Campagna non valida.');
    path = String(path || '');
    if (/[.#$\[\]]/.test(path) || path.startsWith('/')) throw new Error('Percorso non valido.');
    return 'campaigns/' + id + '/data' + (path ? '/' + path : '');
  },
  start: async function (resumeId) {
    await UserManager.loadUsers();
    UserManager.watchUsers();
    if (UserManager.isAdmin()) await this.migrateLegacy();
    await this.load();
    if (
      resumeId &&
      this.campaigns.some(function (campaign) {
        return campaign.id === resumeId;
      })
    ) {
      await this.enter(resumeId);
    } else {
      this.showSelector();
    }
  },
  load: async function () {
    var name = UserManager.getUsername();
    var index =
      (await UserManager.withTimeout(_db.ref('campaignAccess/' + name).once('value'))).val() || {};
    if (UserManager.isAdmin()) {
      var all =
        (await UserManager.withTimeout(_db.ref('campaignAccess').once('value'))).val() || {};
      Object.values(all).forEach(function (entries) {
        Object.assign(index, entries);
      });
    }
    var campaigns = await Promise.all(
      Object.keys(index).map(async function (id) {
        var parts = await Promise.all([
          _db.ref('campaigns/' + id + '/meta').once('value'),
          _db.ref('campaigns/' + id + '/members').once('value'),
        ]).catch(function () {
          return null;
        });
        if (!parts || !parts[0].exists()) return null;
        var members = parts[1].val() || {};
        if (!UserManager.isAdmin() && !members[name]) return null;
        return { id: id, meta: parts[0].val(), members: members };
      })
    );
    this.campaigns = campaigns.filter(Boolean).sort(function (a, b) {
      return a.meta.name.localeCompare(b.meta.name, 'it');
    });
    if (this.current) {
      var refreshed = this.campaigns.find(function (campaign) {
        return campaign.id === CampaignManager.current.id;
      });
      if (refreshed) Object.assign(this.current, refreshed);
    }
    return this.campaigns;
  },
  create: async function (values) {
    if (!this.canCreate()) throw new Error('Solo un master può creare una campagna.');
    var name = String(values.name || '').trim();
    if (!name || name.length > 80) throw new Error('Il nome deve contenere da 1 a 80 caratteri.');
    var owner = UserManager.getUsername();
    var members = {};
    (values.players || []).forEach(function (username) {
      if (!_remoteUsers[username] || _remoteUsers[username].disabled)
        throw new Error('Giocatore non disponibile.');
      members[username] = 'player';
    });
    members[owner] = 'dm';
    var id = _db.ref('campaigns').push().key;
    var changes = {};
    changes['campaigns/' + id] = {
      meta: {
        name: name,
        description: String(values.description || '')
          .trim()
          .slice(0, 500),
        owner: owner,
        createdAt: Date.now(),
      },
      members: members,
    };
    Object.keys(members).forEach(function (username) {
      changes['campaignAccess/' + username + '/' + id] = true;
    });
    await UserManager.withTimeout(_db.ref().update(changes));
    await this.load();
    return id;
  },
  setMembers: async function (id, members) {
    var campaign = this.campaigns.find(function (item) {
      return item.id === id;
    });
    if (!campaign || !this.canManage(campaign))
      throw new Error('Operazione riservata al master della campagna.');
    members = Object.assign({}, members);
    if (members[campaign.meta.owner] !== 'dm')
      throw new Error('Il proprietario deve rimanere master.');
    Object.entries(members).forEach(function (entry) {
      if (
        !['player', 'dm'].includes(entry[1]) ||
        (entry[0] !== ACCOUNT_POLICY.adminUsername &&
          (!_remoteUsers[entry[0]] || _remoteUsers[entry[0]].disabled))
      )
        throw new Error('Membro o ruolo non valido.');
    });
    var changes = {};
    changes['campaigns/' + id + '/members'] = members;
    new Set(Object.keys(campaign.members).concat(Object.keys(members))).forEach(
      function (username) {
        changes['campaignAccess/' + username + '/' + id] = members[username] ? true : null;
      }
    );
    await UserManager.withTimeout(_db.ref().update(changes));
    await this.load();
  },
  migrateLegacy: async function () {
    var policy = window.__CAMPAIGN_POLICY__;
    if ((await UserManager.withTimeout(_db.ref('meta/campaignMigration').once('value'))).exists())
      return;
    var owner = UserManager.getUsername();
    // A transaction prevents two administrators from overwriting the first
    // campaign when they log in together. Legacy content is retained atomically.
    await UserManager.withTimeout(
      _db.ref().transaction(function (root) {
        root = root || {};
        if (root.meta?.campaignMigration) return;
        var id = policy.legacyId;
        root.campaigns = root.campaigns || {};
        if (!root.campaigns[id]) {
          var data = {};
          policy.dataNodes.forEach(function (node) {
            if (root[node] !== undefined)
              data[node] = node === 'meta' ? Object.assign({}, root[node]) : root[node];
          });
          var members = {};
          Object.entries(root.users || {}).forEach(function (entry) {
            var username = entry[0],
              profile = entry[1];
            if (!profile.disabled)
              members[username] = UserManager.getPrivileges(profile).dmPriv ? 'dm' : 'player';
            ['mappa', 'worldbuilding'].forEach(function (field) {
              if (profile[field] === undefined) return;
              data.users = data.users || {};
              data.users[username] = data.users[username] || {};
              data.users[username][field] = profile[field];
              root.legacyCampaignArchive = root.legacyCampaignArchive || {};
              root.legacyCampaignArchive.users = root.legacyCampaignArchive.users || {};
              root.legacyCampaignArchive.users[username] =
                root.legacyCampaignArchive.users[username] || {};
              root.legacyCampaignArchive.users[username][field] = profile[field];
              delete profile[field];
            });
          });
          members[owner] = 'dm';
          root.campaigns[id] = {
            meta: {
              name: policy.legacyName,
              description: 'Contenuti precedenti conservati nella campagna iniziale.',
              owner: owner,
              createdAt: Date.now(),
            },
            members: members,
            data: data,
          };
        }
        root.campaignAccess = root.campaignAccess || {};
        Object.keys(root.campaigns[id].members).forEach(function (username) {
          root.campaignAccess[username] = root.campaignAccess[username] || {};
          root.campaignAccess[username][id] = true;
        });
        root.meta = root.meta || {};
        root.meta.campaignMigration = { campaign: id, version: 1 };
        return root;
      }),
      60000
    );
  },
  enter: async function (id) {
    var campaign = this.campaigns.find(function (item) {
      return item.id === id;
    });
    if (!campaign || (!UserManager.isAdmin() && !campaign.members[UserManager.getUsername()]))
      throw new Error('Non sei abilitato a questa campagna.');
    if (this.current && (this.current.id !== id || !this.ready)) return this.reloadForCampaign(id);
    if (this.current) {
      document.getElementById('campaign-selector')?.remove();
      return;
    }
    this.current = campaign;
    _campaignDb = createCampaignDatabase(id);
    LS_KEY = this.storageKey();
    await new Promise(function (resolve) {
      loadFromStorageAsync(resolve);
    });
    migrateImagesToDB();
    setupRealtimeListeners();
    UserManager.setupPresence();
    fbLoadApiKeys();
    render();
    renderUserBadge();
    this.ready = true;
    document.getElementById('campaign-selector')?.remove();
    var username = UserManager.getUsername();
    var initialRole = campaign.members[username];
    if (campaign.members[username])
      _db.ref('campaigns/' + id + '/members/' + username).on('value', function (snap) {
        if (snap.val() !== initialRole) CampaignManager.reloadForCampaign(null);
      });
  },
  reloadForCampaign: async function (id) {
    storiaFlushSave();
    await flushStorage();
    if (id !== null) {
      // Flush debounced edits before the old page and its listeners are released.
      if (_schedaSaveTimer) fbSaveScheda(true);
      if (_fbSaveIniziativaTimer) {
        clearTimeout(_fbSaveIniziativaTimer);
        _doFbSaveIniziativa();
      }
      var notes = document.getElementById('notes-area');
      if (notes?._fbTimer) {
        clearTimeout(notes._fbTimer);
        fbSaveNotes();
      }
      if (window._smSaveTimer) {
        clearTimeout(window._smSaveTimer);
        fbSaveStoriaMarkers();
      }
      await UserManager.withTimeout(_campaignDb.flush());
    }
    var identity = firebase.auth().currentUser;
    try {
      sessionStorage.setItem(this.resumeKey, JSON.stringify({ uid: identity.uid, campaign: id }));
    } catch (_) {}
    // A fresh page releases every feature timer, map instance and cached sheet.
    location.reload();
  },
};
window.CampaignManager = CampaignManager;
