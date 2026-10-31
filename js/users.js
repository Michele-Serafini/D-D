/**
 * ============================================================================
 * SISTEMA UNIFICATO UTENTI, RUOLI E AUTENTICAZIONE (js/users.js)
 * ============================================================================
 * Modulo centralizzato che gestisce in un unico punto:
 * 1. Account e profili letti esclusivamente dal database
 * 2. Controllo ruoli e permessi (isAdmin, isDM, isPG)
 * 3. Login unificato con verifica Firebase e revoca degli account eliminati
 * 4. Account amministrati centralmente, cambio password e gestione privilegi DM
 * 5. Presenza utenti online in tempo reale
 * Interfaccia e portale: js/ui/account-panel.js
 * ============================================================================
 */

/* Configurazione caricata da js/firebase-config.js prima di questo modulo. */
var FIREBASE_CONFIG = window.__FIREBASE_CONFIG__ || {};
var ACCOUNT_POLICY = window.__ACCOUNT_POLICY__;

var _firebaseApp = null;
var _db = null;
var _fbConnected = false;

// Credentials live in Firebase Auth; names, icons and titles live in users/<name>.
var PARTY_RESET_VERSION = ACCOUNT_POLICY.partyResetVersion;

/* Stato globale di autenticazione e presenza (sincronizzato con Firebase) */
var _authUser = null; // Oggetto utente autenticato corrente
var _authRole = null; // 'admin' | 'dm' | 'pg' | null
var _remoteUsers = {}; // Profili Firebase, senza password
var _presenceMap = {}; // { username: { online, lastSeen } } da Firebase

/* ============================================================================
   MODULO CENTRALIZZATO: window.UserManager
   ============================================================================ */
var UserManager = {
  /**
   * Inizializza la connessione a Firebase Realtime Database se non già attiva.
   */
  ensureDatabase: function () {
    if (_db) return _db;
    try {
      if (typeof firebase !== 'undefined') {
        if (!FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.databaseURL)
          throw new Error('Configurazione Firebase non disponibile.');
        if (!_firebaseApp) {
          _firebaseApp =
            firebase.apps && firebase.apps.length
              ? firebase.app()
              : firebase.initializeApp(FIREBASE_CONFIG);
        }
        _db = firebase.database();
      }
    } catch (e) {
      console.warn('[UserManager] Firebase offline o non disponibile:', e.message);
    }
    return _db;
  },

  /* ── Helpers Ruoli e Permessi ── */
  isAdmin: function () {
    return _authRole === 'admin';
  },

  isDM: function () {
    if (typeof CampaignManager !== 'undefined' && CampaignManager.current)
      return this.isAdmin() || CampaignManager.isMaster(this.getUsername());
    return _authRole === 'admin' || _authRole === 'dm';
  },

  isPG: function () {
    return !!this.getCurrentUser() && !this.isDM();
  },

  getCurrentUser: function () {
    return typeof state !== 'undefined' && state.currentUser ? state.currentUser : null;
  },

  getUsername: function (fallback) {
    var cu = this.getCurrentUser();
    return cu && cu.username ? cu.username : fallback || '_guest';
  },

  getRoleDefaults: function (role) {
    var roles = ACCOUNT_POLICY.roles;
    return (
      Object.keys(roles)
        .map(function (key) {
          return roles[key];
        })
        .find(function (preset) {
          return preset.name === role;
        }) || roles.player
    );
  },

  getProfile: function (username, record) {
    record = record || _remoteUsers[username] || {};
    var defaults = this.getRoleDefaults(record.role);
    return Object.assign({}, defaults, record, this.getPrivileges(record), {
      username: username,
      disabled: !!record.disabled,
    });
  },

  isMasterProfile: function (profile) {
    return !!profile && profile.role === ACCOUNT_POLICY.roles.master.name;
  },

  getMasterUsername: function (profiles) {
    if (!profiles && typeof CampaignManager !== 'undefined' && CampaignManager.current)
      return CampaignManager.current.meta.owner;
    profiles = profiles || _remoteUsers;
    return (
      Object.keys(profiles).find(function (name) {
        return UserManager.isMasterProfile(profiles[name]);
      }) || null
    );
  },

  /**
   * Restituisce gli account attivi presenti in Firebase.
   */
  getAllUsers: function (includeDisabled) {
    var manager = this;
    return Object.keys(_remoteUsers)
      .filter(function (name) {
        return _remoteUsers[name] && (includeDisabled || !_remoteUsers[name].disabled);
      })
      .map(function (name) {
        return manager.getProfile(name);
      });
  },

  getCampaignUsers: function () {
    var profiles =
      typeof CampaignManager !== 'undefined' && CampaignManager.current
        ? CampaignManager.profiles()
        : _remoteUsers;
    return Object.keys(profiles).map(function (name) {
      return UserManager.getProfile(name, profiles[name]);
    });
  },

  /** Normalizza il nome del giocatore prima dell'accesso. */
  normalizeUsername: function (value) {
    var name = String(value || '')
      .trim()
      .toLowerCase();
    if (
      !new RegExp('^(?:' + ACCOUNT_POLICY.usernamePattern + ')$').test(name) ||
      ['__proto__', 'constructor', 'prototype'].indexOf(name) !== -1
    )
      throw new Error(ACCOUNT_POLICY.usernameHint);
    return name;
  },

  emailFor: function (username) {
    return username.toLowerCase() + '@' + ACCOUNT_POLICY.emailDomain;
  },

  validatePassword: function (password) {
    if (typeof password !== 'string' || password.length < ACCOUNT_POLICY.minPasswordLength) {
      throw new Error('Password: minimo ' + ACCOUNT_POLICY.minPasswordLength + ' caratteri.');
    }
  },

  setDmPrivileges: async function (username, enabled) {
    var db = this.requireAdminDatabase();
    username = this.normalizeUsername(username);
    var result = await db.ref('users/' + username).transaction(function (profile) {
      if (!profile || UserManager.getPrivileges(profile).authRole === 'admin') return;
      profile.dmPriv = !!enabled;
      return profile;
    });
    if (!result.committed) throw new Error('Puoi cambiare i privilegi solo ai giocatori.');
  },

  updatePlayerProfile: async function (username, values) {
    var db = this.requireAdminDatabase();
    username = this.normalizeUsername(username);
    var crest = String(values.crest || '')
      .trim()
      .slice(0, 16);
    var title = String(values.title || '')
      .trim()
      .slice(0, 80);
    if (!(await this.withTimeout(db.ref('users/' + username).once('value'))).exists())
      throw new Error('Utente non trovato.');
    await db.ref('users/' + username).update({ crest: crest || null, title: title || null });
  },

  withTimeout: function (operation, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error('Database non raggiungibile. Riprova.'));
      }, timeoutMs || 8000);
      Promise.resolve(operation).then(
        function (result) {
          clearTimeout(timer);
          resolve(result);
        },
        function (error) {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  },

  loadUsers: function () {
    var db = this.ensureDatabase();
    if (!db)
      return Promise.reject(new Error('Database non disponibile. Riprova quando sei online.'));
    return this.withTimeout(db.ref('users').once('value')).then(function (snap) {
      _remoteUsers = snap.val() || {};
      return _remoteUsers;
    });
  },

  getPrivileges: function (profile) {
    var defaults = this.getRoleDefaults(profile.role);
    var dmPriv = defaults.dmPriv || !!profile.dmPriv;
    return {
      role: defaults.name,
      dmPriv: dmPriv,
      authRole: defaults.authRole === 'admin' ? 'admin' : dmPriv ? 'dm' : 'pg',
    };
  },

  requireAdminDatabase: function () {
    if (!this.isAdmin()) throw new Error('Accesso riservato agli amministratori.');
    var db = this.ensureDatabase();
    if (!db) throw new Error('Database non disponibile.');
    return db;
  },

  watchUsers: function () {
    if (!_db || this._userWatchers) return;
    var manager = this;
    this._userWatchers = [];
    function watch(path, handler) {
      var ref = _db.ref(path);
      manager._userWatchers.push({ ref: ref, handler: handler });
      ref.on('value', handler);
    }
    watch('users', function (snap) {
      _remoteUsers = snap.val() || {};
      if (typeof window.refreshAdminUsers === 'function') window.refreshAdminUsers();
    });
    var current = this.getCurrentUser();
    if (current && current.username !== ACCOUNT_POLICY.adminUsername) {
      // Own profile remains readable after removal, so the session can be revoked.
      watch('users/' + current.username, function (snap) {
        var profile = snap.val();
        if (!profile || profile.disabled) {
          manager.signOut();
          return;
        }
        var privileges = manager.getPrivileges(profile);
        var changed = _authRole !== privileges.authRole;
        _authRole = privileges.authRole;
        Object.assign(current, manager.getProfile(current.username, profile));
        if (
          changed &&
          typeof render === 'function' &&
          (typeof CampaignManager === 'undefined' || CampaignManager.current)
        )
          render();
      });
    }
  },

  stopWatchingUsers: function () {
    (this._userWatchers || []).forEach(function (watcher) {
      watcher.ref.off('value', watcher.handler);
    });
    this._userWatchers = null;
  },

  addPlayer: async function (name, password) {
    var db = this.requireAdminDatabase();
    name = this.normalizeUsername(name);
    if (name === ACCOUNT_POLICY.adminUsername) throw new Error('Nome riservato.');
    this.validatePassword(password);
    var existing = (await this.withTimeout(db.ref('users/' + name).once('value'))).val();
    if (existing)
      throw new Error(
        'Nome già utilizzato. Per riattivare un account usa il suo pulsante Riattiva.'
      );
    // L’app secondaria crea l’identità senza disconnettere l’amministratore.
    var secondary = firebase.initializeApp(FIREBASE_CONFIG, 'create-player-' + Date.now());
    var created;
    try {
      created = (
        await secondary.auth().createUserWithEmailAndPassword(this.emailFor(name), password)
      ).user;
      var changes = {};
      changes['users/' + name] = {
        uid: created.uid,
        role: ACCOUNT_POLICY.roles.player.name,
        dmPriv: false,
        disabled: false,
      };
      changes['userAccess/' + created.uid] = name;
      await db.ref().update(changes);
    } catch (error) {
      if (created) {
        try {
          await created.delete();
        } catch (_) {}
      }
      throw error;
    } finally {
      try {
        await secondary.auth().signOut();
      } catch (_) {}
      await secondary.delete();
    }
  },
  reactivatePlayer: async function (name) {
    var db = this.requireAdminDatabase();
    name = this.normalizeUsername(name);
    await db.ref('users/' + name + '/disabled').set(false);
  },
  removePlayer: async function (name) {
    var db = this.requireAdminDatabase();
    name = this.normalizeUsername(name);
    var result = await db.ref('users/' + name).transaction(function (record) {
      if (!record || UserManager.getPrivileges(record).authRole === 'admin') return;
      // Conserva mappe e altro contenuto personale; disabilita solo l'accesso.
      record.disabled = true;
      return record;
    });
    if (!result.committed) throw new Error('Puoi rimuovere solo i giocatori.');
  },

  changePassword: async function (username, oldPassword, newPassword) {
    var user = firebase.auth().currentUser;
    var cu = this.getCurrentUser();
    if (!user || !cu || cu.username !== username)
      throw new Error('Accedi prima di cambiare password.');
    this.validatePassword(newPassword);
    var credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPassword);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
  },

  /**
   * Esegue il login unificato controllando:
   * Le credenziali correnti vengono lette da Firebase a ogni accesso.
   */
  signIn: async function (customUser, customPass) {
    var uEl =
      document.getElementById('login-username-input') || document.getElementById('login-user');
    var pEl =
      document.getElementById('login-password-input') || document.getElementById('login-pass');
    var errEl = document.getElementById('login-error');
    var btn = document.querySelector('#login-cred-area .login-btn');
    if (this._signingIn) return;
    this._signingIn = true;
    if (btn) btn.disabled = true;
    try {
      var u = this.normalizeUsername(
        typeof customUser === 'string' ? customUser : uEl ? uEl.value : ''
      );
      var p = typeof customPass === 'string' ? customPass : pEl ? pEl.value : '';
      if (!p) throw new Error('Inserisci la password.');
      if (!this.ensureDatabase()) throw new Error('Database non disponibile. Riprova.');
      var credential = await this.withTimeout(
        firebase.auth().signInWithEmailAndPassword(this.emailFor(u), p)
      );
      await this.finishAuthenticatedLogin(credential.user);
    } catch (error) {
      try {
        if (typeof firebase !== 'undefined' && firebase.auth) await firebase.auth().signOut();
      } catch (_) {}
      var message = /^auth\//.test(error.code || '')
        ? 'Accesso non riuscito. Verifica username e password o riprova.'
        : error.message;
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = message;
      }
    } finally {
      this._signingIn = false;
      if (btn) btn.disabled = false;
    }
  },

  finishAuthenticatedLogin: async function (identity, resumeId) {
    var username, record;
    if (identity.uid === ACCOUNT_POLICY.adminUid) {
      username = ACCOUNT_POLICY.adminUsername;
      record = { role: ACCOUNT_POLICY.roles.admin.name, dmPriv: true };
    } else {
      username = (
        await this.withTimeout(_db.ref('userAccess/' + identity.uid).once('value'))
      ).val();
      if (!username) throw new Error('Account non abilitato al party.');
      record = (await this.withTimeout(_db.ref('users/' + username).once('value'))).val();
      if (!record || record.disabled) throw new Error('Account rimosso o disabilitato.');
    }
    if (document.getElementById('admin-panel') && this.getPrivileges(record).authRole !== 'admin')
      throw new Error('Accesso riservato agli amministratori.');
    var error = document.getElementById('login-error');
    if (error) error.style.display = 'none';
    await this.completeLogin(username, record, resumeId);
  },

  /**
   * Finalizza il login, imposta lo stato utente unificato, avvia la cerimonia
   * di apertura del Portale Runico (senza esplosione di luce bianca) e carica i dati.
   */
  completeLogin: async function (username, ud, resumeId) {
    var record = ud || {};
    var profile = this.getProfile(username, record);
    var privileges = this.getPrivileges(record);
    var role = privileges.role;
    var hasDmPriv = privileges.dmPriv;
    _authRole = privileges.authRole;
    _authUser = {
      uid: username,
      displayName: username,
      email: this.emailFor(username),
    };

    if (typeof state !== 'undefined') {
      state.currentUser = {
        username: username,
        uid: username,
        role: role,
        dmPriv: hasDmPriv,
        crest: profile.crest,
        title: profile.title,
      };
    }

    try {
      localStorage.setItem('mercante_session', JSON.stringify(state.currentUser));
    } catch (e) {}

    this.ensureDatabase();
    if (
      document.getElementById('admin-panel') &&
      this.isAdmin() &&
      typeof window.openAdminPanel === 'function'
    ) {
      window.openAdminPanel();
      return;
    }
    await CampaignManager.start(resumeId);
    this.playLoginPortalCeremony(username, role, hasDmPriv);

    // Autosave periodico di sicurezza
    if (!window._armiAutosaveInterval) {
      window._armiAutosaveInterval = setInterval(function () {
        if (
          typeof _campaignDb !== 'undefined' &&
          _campaignDb &&
          UserManager.isDM() &&
          typeof state !== 'undefined' &&
          state.armi &&
          state.armi.length > 0 &&
          typeof _localWrite !== 'undefined' &&
          !_localWrite.armi
        ) {
          if (typeof fbSaveArmi === 'function') fbSaveArmi();
        }
      }, 120000);
    }
  },

  /**
   * Disconnette l'utente corrente e riporta al portale di accesso.
   */
  signOut: async function () {
    if (this._signingOut) return;
    this._signingOut = true;
    this.stopWatchingUsers();
    if (this._presenceRef && this._presenceHandler)
      this._presenceRef.off('value', this._presenceHandler);
    if (typeof _campaignDb !== 'undefined' && _campaignDb && state && state.currentUser) {
      try {
        _campaignDb.ref('presence/' + state.currentUser.username).set({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP,
        });
      } catch (e) {}
    }
    try {
      await firebase.auth().signOut();
    } catch (_) {}
    _authUser = null;
    _authRole = null;
    if (typeof state !== 'undefined') state.currentUser = null;
    try {
      localStorage.removeItem('mercante_session');
      sessionStorage.removeItem('mercante_campaign_switch');
    } catch (e) {}
    location.reload();
  },

  /**
   * Registra la presenza online dell'utente corrente su Firebase.
   */
  setupPresence: function () {
    var cu = this.getCurrentUser();
    if (typeof _campaignDb === 'undefined' || !_campaignDb || !cu) return;
    var uid = cu.username;
    var ref = _campaignDb.ref('presence/' + uid);
    var connRef = _db.ref('.info/connected');
    if (this._presenceRef && this._presenceHandler)
      this._presenceRef.off('value', this._presenceHandler);
    this._presenceRef = connRef;
    this._presenceHandler = function (snap) {
      _fbConnected = !!snap.val();
      if (_fbConnected) {
        ref.onDisconnect().set({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP,
        });
        ref.set({ online: true, username: uid });
      }
    };
    connRef.on('value', this._presenceHandler);
  },

  /**
   * Inizializza la schermata di autenticazione senza accessi automatici.
   */
  initAuth: function () {
    this.ensureDatabase();

    // Only an explicit campaign switch resumes Firebase's existing identity.
    var resume = null;
    try {
      resume = JSON.parse(sessionStorage.getItem('mercante_campaign_switch'));
      sessionStorage.removeItem('mercante_campaign_switch');
    } catch (_) {}
    if (resume && typeof firebase.auth().onAuthStateChanged === 'function') {
      var manager = this;
      var unsubscribe = firebase.auth().onAuthStateChanged(async function (identity) {
        unsubscribe();
        if (!identity || identity.uid !== resume.uid) return;
        try {
          await manager.finishAuthenticatedLogin(identity, resume.campaign);
        } catch (error) {
          var message = document.getElementById('login-error');
          if (message) {
            message.style.display = 'block';
            message.textContent = error.message;
          }
        }
      });
    }

    // Nessun autologin né ripristino degli account eliminati dai valori predefiniti.
    var ov = document.getElementById('login-overlay');
    if (ov) ov.style.display = 'grid';
    var button = document.querySelector('#login-cred-area .login-btn');
    if (button) button.disabled = false;
  },
};

/* ============================================================================
   ESPORTAZIONE FUNZIONI GLOBALI (Compatibilità 100% con tutto il Compendium)
   ============================================================================ */
window.UserManager = UserManager;

function isAdmin() {
  return UserManager.isAdmin();
}
function isDM() {
  return UserManager.isDM();
}
function isPG() {
  return UserManager.isPG();
}

function dmRef(path) {
  if (typeof _campaignDb === 'undefined' || !_campaignDb || !_authUser) return null;
  if (UserManager.isAdmin()) return _campaignDb.ref('state/' + path);
  return _campaignDb.ref('users/' + _authUser.uid + '/' + path);
}

function doSignIn() {
  return UserManager.signIn();
}
function doSignOut() {
  return UserManager.signOut();
}
function renderUserBadge() {
  UserManager.renderUserBadge();
}
function renderSettingsPanel() {
  UserManager.renderSettingsPanel();
}
function getAllUsers() {
  return UserManager.getAllUsers();
}
function initAuth() {
  UserManager.initAuth();
}
