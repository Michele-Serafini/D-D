/**
 * ============================================================================
 * SISTEMA UNIFICATO UTENTI, RUOLI E AUTENTICAZIONE (js/users.js)
 * ============================================================================
 * Modulo centralizzato che gestisce in un unico punto:
 * 1. Elenco account predefiniti (DEFAULT_USERS) facile da leggere e modificare
 * 2. Controllo ruoli e permessi (isAdmin, isDM, isPG)
 * 3. Login unificato con verifica Firebase e revoca degli account eliminati
 * 4. Account amministrati centralmente, cambio password e gestione privilegi DM
 * 5. Presenza utenti online in tempo reale e Pannello Impostazioni Utenti
 * 6. Cerimonia scenografica di accesso ("Sigillo Arcano & Portale del Grimorio")
 * ============================================================================
 */

/* Configurazione caricata da js/firebase-config.js prima di questo modulo. */
var FIREBASE_CONFIG = window.__FIREBASE_CONFIG__ || {};

var _firebaseApp = null;
var _db = null;
var _fbConnected = false;

/* Profili iniziali usati soltanto per icone e titoli.
 * Le identità e le password sono gestite esclusivamente da Firebase Authentication.
 * Nessun fallback di accesso e nessuna ricreazione automatica degli utenti rimossi.
 */
var DEFAULT_USERS = [
  { username: 'sebastiano', role: 'DM', dmPriv: true, crest: '👑', title: 'Dungeon Master' },
  { username: 'michele', role: 'Giocatore', dmPriv: false, crest: '⚔', title: 'Avventuriero' },
  { username: 'montre', role: 'Giocatore', dmPriv: false, crest: '✨', title: 'Avventuriero' },
  { username: 'alessio', role: 'Giocatore', dmPriv: false, crest: '🛡', title: 'Avventuriero' }
];
var PARTY_RESET_VERSION = '2026-10-26-party-v1';


/* Stato globale di autenticazione e presenza (sincronizzato con Firebase) */
var _authUser = null;      // Oggetto utente autenticato corrente
var _authRole = null;      // 'admin' | 'dm' | 'pg' | null
var _remoteUsers = {};     // Profili Firebase, senza password
var _presenceMap = {};     // { username: { online, lastSeen } } da Firebase

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
        if (!FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.databaseURL) throw new Error('Configurazione Firebase non disponibile.');
        if (!_firebaseApp) {
          _firebaseApp = firebase.apps && firebase.apps.length
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
    return _authRole === 'admin' || _authRole === 'dm';
  },

  isPG: function () {
    return _authRole === 'pg';
  },

  getCurrentUser: function () {
    return (typeof state !== 'undefined' && state.currentUser) ? state.currentUser : null;
  },

  getUsername: function (fallback) {
    var cu = this.getCurrentUser();
    return (cu && cu.username) ? cu.username : (fallback || '_guest');
  },

  /**
   * Cerca un utente nell'elenco predefinito DEFAULT_USERS (case-insensitive).
   */
  findDefaultUser: function (username) {
    if (!username) return null;
    var target = String(username).trim().toLowerCase();
    for (var i = 0; i < DEFAULT_USERS.length; i++) {
      if (DEFAULT_USERS[i].username.toLowerCase() === target) {
        return DEFAULT_USERS[i];
      }
    }
    return null;
  },

  /**
   * Restituisce gli account attivi presenti in Firebase.
   */
  getAllUsers: function (includeDisabled) {
    return Object.keys(_remoteUsers).filter(function (name) {
      return _remoteUsers[name] && (includeDisabled || !_remoteUsers[name].disabled);
    }).map(function (name) {
      var u = _remoteUsers[name];
      return { username: name, role: u.role || 'Giocatore', dmPriv: !!u.dmPriv, disabled: !!u.disabled,
        crest: u.crest || (u.role === 'DM' ? '👑' : '🛡'), title: u.title || 'Avventuriero' };
    });
  },

  /** Normalizza il nome del giocatore prima dell'accesso. */
  normalizeUsername: function (value) {
    var name = String(value || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,32}$/.test(name) || ['__proto__', 'constructor', 'prototype'].indexOf(name) !== -1) throw new Error('Usa da 3 a 32 lettere, numeri, trattini o underscore.');
    return name;
  },

  withTimeout: function (operation) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('Database non raggiungibile. Riprova.')); }, 8000);
      Promise.resolve(operation).then(function (result) { clearTimeout(timer); resolve(result); }, function (error) { clearTimeout(timer); reject(error); });
    });
  },

  loadUsers: function () {
    var db = this.ensureDatabase();
    if (!db) return Promise.reject(new Error('Database non disponibile. Riprova quando sei online.'));
    return this.withTimeout(db.ref('users').once('value')).then(function (snap) {
      _remoteUsers = snap.val() || {};
      return _remoteUsers;
    });
  },

  getPrivileges: function (profile) {
    var role = profile.role || 'Giocatore';
    var dmPriv = role === 'Admin' || role === 'DM' || !!profile.dmPriv;
    return { role: role, dmPriv: dmPriv, authRole: role === 'Admin' || role === 'DM' ? 'admin' : (dmPriv ? 'dm' : 'pg') };
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
    if (current && current.username !== 'admin') {
      // Own profile remains readable after removal, so the session can be revoked.
      watch('users/' + current.username, function (snap) {
        var profile = snap.val();
        if (!profile || profile.disabled) { manager.signOut(); return; }
        var privileges = manager.getPrivileges(profile);
        var changed = _authRole !== privileges.authRole;
        _authRole = privileges.authRole;
        current.role = privileges.role;
        current.dmPriv = privileges.dmPriv;
        if (changed && typeof render === 'function') render();
      });
    }
  },

  stopWatchingUsers: function () {
    (this._userWatchers || []).forEach(function (watcher) { watcher.ref.off('value', watcher.handler); });
    this._userWatchers = null;
  },

  addPlayer: async function (name, password) {
    var db = this.requireAdminDatabase();
    name = this.normalizeUsername(name);
    if (name === 'admin') throw new Error('Nome riservato.');
    if (typeof password !== 'string' || password.length < 6) throw new Error('Password: minimo 6 caratteri.');
    var existing = (await this.withTimeout(db.ref('users/' + name).once('value'))).val();
    if (existing) throw new Error('Nome già utilizzato. Per riattivare un account usa il suo pulsante Riattiva.');
    // L’app secondaria crea l’identità senza disconnettere l’amministratore.
    var secondary = firebase.initializeApp(FIREBASE_CONFIG, 'create-player-' + Date.now());
    var created;
    try {
      created = (await secondary.auth().createUserWithEmailAndPassword(name + '@dd.local', password)).user;
      var changes = {};
      changes['users/' + name] = { uid: created.uid, role: 'Giocatore', dmPriv: false, disabled: false };
      changes['userAccess/' + created.uid] = name;
      await db.ref().update(changes);
    } catch (error) {
      if (created) { try { await created.delete(); } catch (_) {} }
      throw error;
    } finally {
      try { await secondary.auth().signOut(); } catch (_) {}
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
      if (!record || record.role === 'DM' || record.role === 'Admin') return;
      // Conserva mappe e altro contenuto personale; disabilita solo l'accesso.
      record.disabled = true;
      return record;
    });
    if (!result.committed) throw new Error('Puoi rimuovere solo i giocatori.');
  },

  changePassword: async function (username, oldPassword, newPassword) {
    var user = firebase.auth().currentUser;
    var cu = this.getCurrentUser();
    if (!user || !cu || cu.username !== username) throw new Error('Accedi prima di cambiare password.');
    if (typeof newPassword !== 'string' || newPassword.length < 6) throw new Error('Password: minimo 6 caratteri.');
    var credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPassword);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
  },

  /**
   * Esegue il login unificato controllando:
   * Le credenziali correnti vengono lette da Firebase a ogni accesso.
   */
  signIn: async function (customUser, customPass) {
    var uEl = document.getElementById('login-username-input') || document.getElementById('login-user');
    var pEl = document.getElementById('login-password-input') || document.getElementById('login-pass');
    var errEl = document.getElementById('login-error');
    var btn = document.querySelector('#login-cred-area .login-btn');
    if (this._signingIn) return;
    this._signingIn = true;
    if (btn) btn.disabled = true;
    try {
      var u = this.normalizeUsername(typeof customUser === 'string' ? customUser : (uEl ? uEl.value : ''));
      var p = typeof customPass === 'string' ? customPass : (pEl ? pEl.value : '');
      if (!p) throw new Error('Inserisci la password.');
      if (!this.ensureDatabase()) throw new Error('Database non disponibile. Riprova.');
      var credential = await this.withTimeout(firebase.auth().signInWithEmailAndPassword(u + '@dd.local', p));
      var firebaseUid = credential.user.uid;
      var record;
      if (firebaseUid === 'admin') {
        u = 'admin';
        record = { role: 'Admin', dmPriv: true };
      } else {
        var mapping = await this.withTimeout(_db.ref('userAccess/' + firebaseUid).once('value'));
        u = mapping.val();
        if (!u) throw new Error('Account non abilitato al party.');
        var profile = await this.withTimeout(_db.ref('users/' + u).once('value'));
        record = profile.val();
        if (!record || record.disabled) throw new Error('Account rimosso o disabilitato.');
      }
      if (document.getElementById('admin-panel') && record.role !== 'DM' && record.role !== 'Admin') throw new Error('Accesso riservato agli amministratori.');
      if (errEl) errEl.style.display = 'none';
      this.completeLogin(u, record);
    } catch (error) {
      try { if (typeof firebase !== 'undefined' && firebase.auth) await firebase.auth().signOut(); } catch (_) {}
      var message = /^auth\//.test(error.code || '') ? 'Accesso non riuscito. Verifica username e password o riprova.' : error.message;
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = message; }
    } finally {
      this._signingIn = false;
      if (btn) btn.disabled = false;
    }
  },

  /**
   * Finalizza il login, imposta lo stato utente unificato, avvia la cerimonia
   * di apertura del Portale Runico (senza esplosione di luce bianca) e carica i dati.
   */
  completeLogin: function (username, ud) {
    var record = ud || {};
    var defUser = this.findDefaultUser(username);
    var privileges = this.getPrivileges(record);
    var role = privileges.role;
    var hasDmPriv = privileges.dmPriv;
    _authRole = privileges.authRole;
    _authUser = {
      uid: username,
      displayName: username,
      email: username.toLowerCase() + '@dd.local'
    };

    if (typeof state !== 'undefined') {
      state.currentUser = {
        username: username,
        uid: username,
        role: role,
        dmPriv: hasDmPriv,
        crest: (defUser && defUser.crest) || (role === 'DM' ? '👑' : (hasDmPriv ? '⚔' : '🛡'))
      };
    }

    try {
      localStorage.setItem('mercante_session', JSON.stringify(state.currentUser));
    } catch (e) {}

    this.ensureDatabase();
    if ((username === 'admin' || (document.getElementById('admin-panel') && this.isAdmin())) && typeof window.openAdminPanel === 'function') {
      window.openAdminPanel();
      return;
    }

    this.setupPresence();
    if (typeof setupRealtimeListeners === 'function') setupRealtimeListeners();
    if (typeof fbLoadApiKeys === 'function') fbLoadApiKeys();

    // Avvia la nuova cerimonia scenografica del Portale Arcano
    this.playLoginPortalCeremony(username, role, hasDmPriv);

    // Autosave periodico di sicurezza
    if (!window._armiAutosaveInterval) {
      window._armiAutosaveInterval = setInterval(function () {
        if (_db && typeof state !== 'undefined' && state.armi && state.armi.length > 0 && typeof _localWrite !== 'undefined' && !_localWrite.armi) {
          if (typeof fbSaveArmi === 'function') fbSaveArmi();
        }
      }, 120000);
    }

    var self = this;
    setTimeout(function () {
      if (typeof render === 'function') render();
      self.renderUserBadge();
    }, 240);
  },

  /**
   * Cerimonia di accesso: Sigillo Runico rotante + Doppio Portale del Grimorio che si spalanca.
   * Sostituisce il vecchio whiteout / esplosione di luce con una transizione dark-fantasy elegante.
   */
  playLoginPortalCeremony: function (username, role, hasDmPriv) {
    var ov = document.getElementById('login-overlay');
    if (!ov) return;

    var isFast = !!(navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || ''));
    var roleTitle = role === 'DM' ? 'Dungeon Master Supremo' : (hasDmPriv ? 'Custode del Compendium (DM)' : 'Avventuriero del Party');
    var roleIcon = role === 'DM' ? '👑' : (hasDmPriv ? '⚔' : '🛡');

    // Crea o aggiorna i battenti del Portale Runico se non presenti
    var portal = document.getElementById('sium-login-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'sium-login-portal';
      portal.className = 'sium-login-portal';
      portal.innerHTML =
        '<div class="portal-door portal-door-left">' +
          '<div class="portal-door-filigree"></div>' +
        '</div>' +
        '<div class="portal-door portal-door-right">' +
          '<div class="portal-door-filigree"></div>' +
        '</div>' +
        '<div class="portal-seal-center">' +
          '<div class="portal-seal-rings">' +
            '<svg class="seal-ring-outer" viewBox="0 0 200 200">' +
              '<circle cx="100" cy="100" r="92" fill="none" stroke="#d8b25c" stroke-width="1.5" stroke-dasharray="8 5" />' +
              '<circle cx="100" cy="100" r="82" fill="none" stroke="#c93b2b" stroke-width="1" stroke-dasharray="3 6" />' +
              '<polygon points="100,10 190,100 100,190 10,100" fill="none" stroke="#d8b25c" stroke-width="1.2" opacity="0.55" />' +
              '<polygon points="100,24 176,100 100,176 24,100" fill="none" stroke="#f5d98e" stroke-width="1" opacity="0.4" transform="rotate(45 100 100)" />' +
            '</svg>' +
            '<svg class="seal-ring-inner" viewBox="0 0 120 120">' +
              '<polygon points="60,8 106,34 106,86 60,112 14,86 14,34" fill="rgba(18,13,9,0.92)" stroke="#f5d98e" stroke-width="2.2" />' +
              '<polygon points="60,22 92,78 28,78" fill="rgba(216,178,92,0.12)" stroke="#d8b25c" stroke-width="1.4" />' +
            '</svg>' +
            '<div class="portal-seal-crest" id="portal-seal-crest">⚜</div>' +
          '</div>' +
          '<div class="portal-welcome-box">' +
            '<div class="portal-welcome-sub">Sigillo Riconosciuto</div>' +
            '<div class="portal-welcome-name" id="portal-welcome-name"></div>' +
            '<div class="portal-welcome-role" id="portal-welcome-role"></div>' +
          '</div>' +
        '</div>';
      ov.appendChild(portal);
    }

    var crestEl = document.getElementById('portal-seal-crest');
    var nameEl = document.getElementById('portal-welcome-name');
    var roleEl = document.getElementById('portal-welcome-role');
    if (crestEl) crestEl.textContent = roleIcon;
    if (nameEl) nameEl.textContent = username;
    if (roleEl) roleEl.textContent = roleTitle;

    ov.classList.add('opening');

    var duration = isFast ? 450 : 1450;
    setTimeout(function () {
      ov.style.display = 'none';
      ov.classList.remove('opening');
    }, duration);
  },

  /**
   * Disconnette l'utente corrente e riporta al portale di accesso.
   */
  signOut: async function () {
    if (this._signingOut) return;
    this._signingOut = true;
    this.stopWatchingUsers();
    if (this._presenceRef && this._presenceHandler) this._presenceRef.off('value', this._presenceHandler);
    if (_db && state && state.currentUser) {
      try {
        _db.ref('presence/' + state.currentUser.username).set({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
      } catch (e) {}
    }
    try { await firebase.auth().signOut(); } catch (_) {}
    _authUser = null;
    _authRole = null;
    if (typeof state !== 'undefined') state.currentUser = null;
    try {
      localStorage.removeItem('mercante_session');
    } catch (e) {}
    location.reload();
  },

  /**
   * Registra la presenza online dell'utente corrente su Firebase.
   */
  setupPresence: function () {
    var cu = this.getCurrentUser();
    if (!_db || !cu) return;
    var uid = cu.username;
    var ref = _db.ref('presence/' + uid);
    var connRef = _db.ref('.info/connected');
    if (this._presenceRef && this._presenceHandler) this._presenceRef.off('value', this._presenceHandler);
    this._presenceRef = connRef;
    this._presenceHandler = function (snap) {
      _fbConnected = !!snap.val();
      if (_fbConnected) {
        ref.onDisconnect().set({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
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

    // Nessun autologin né ripristino degli account eliminati dai valori predefiniti.
    var ov = document.getElementById('login-overlay');
    if (ov) ov.style.display = 'grid';
  },

  /**
   * Renderizza il badge dell'utente attivo e il pulsante Impostazioni (⚙).
   */
  renderUserBadge: function () {
    var ex = document.getElementById('user-badge-el');
    if (ex) ex.remove();
    var ex2 = document.getElementById('gear-btn-el');
    if (ex2) ex2.remove();

    var cu = this.getCurrentUser();
    if (!cu) return;

    var self = this;

    // Pulsante Impostazioni (Ingranaggio)
    var gear = document.createElement('button');
    gear.type = 'button';
    gear.className = 'gear-btn';
    gear.id = 'gear-btn-el';
    gear.setAttribute('aria-label', 'Impostazioni Account e Party');
    gear.innerHTML = (typeof ICON !== 'undefined' && ICON.gear) ? ICON.gear : '⚙';
    gear.title = 'Impostazioni Account & Gestione Party';
    gear.onclick = function () {
      self.renderSettingsPanel();
    };
    document.body.appendChild(gear);

    // Badge Utente Attivo
    var badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'user-badge';
    badge.id = 'user-badge-el';
    badge.style.cursor = 'pointer';
    var roleText = this.isAdmin() ? 'Admin / DM' : (this.isDM() ? 'Dungeon Master' : 'Giocatore');
    badge.title = cu.username + ' (' + roleText + ') — Clicca per aprire le impostazioni utente';

    var dot = document.createElement('span');
    dot.className = 'online-dot';
    badge.appendChild(dot);

    var nameSpan = document.createElement('span');
    var roleEmoji = this.isAdmin() ? ' 👑' : (this.isDM() ? ' ⚔' : ' 🛡');
    nameSpan.textContent = (cu.username || '') + roleEmoji;
    badge.appendChild(nameSpan);

    badge.onclick = function () {
      self.renderSettingsPanel();
    };
    document.body.appendChild(badge);
  },

  /**
   * Renderizza il Pannello Impostazioni unificato (Profilo, Party Online, Privilegi DM, Password, Tema).
   */
  renderSettingsPanel: function () {
    var self = this;
    var ex = document.getElementById('settings-overlay');
    if (ex) ex.remove();

    var ov = document.createElement('div');
    ov.id = 'settings-overlay';
    ov.onclick = function (e) {
      if (e.target === ov) ov.remove();
    };

    var box = document.createElement('div');
    box.className = 'settings-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Impostazioni Compendium e Party');

    // Header
    var hdr = document.createElement('div');
    hdr.className = 'settings-header';
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.75rem;';
    var titleEl = document.createElement('div');
    titleEl.className = 'settings-title';
    titleEl.innerHTML = 'Impostazioni &amp; Gilda Avventurieri';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sium-ctrl-btn';
    closeBtn.setAttribute('aria-label', 'Chiudi Impostazioni');
    closeBtn.style.cssText = 'padding:0.25rem 0.55rem;font-size:12px;';
    closeBtn.textContent = 'Chiudi';
    closeBtn.onclick = function () {
      ov.remove();
    };
    hdr.appendChild(titleEl);
    hdr.appendChild(closeBtn);
    box.appendChild(hdr);

    var body = document.createElement('div');
    body.className = 'settings-body';

    var cu = this.getCurrentUser();

    /* 1. Profilo Utente Corrente */
    if (cu) {
      var profLbl = document.createElement('div');
      profLbl.className = 'settings-section-lbl';
      profLbl.textContent = 'Profilo Attivo';
      body.appendChild(profLbl);

      var profCard = document.createElement('div');
      profCard.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.75rem 0.9rem;background:rgba(216,178,92,0.08);border:1px solid var(--border-gold);border-radius:8px;';
      var roleBadgeText = this.isAdmin()
        ? 'Dungeon Master (Admin) 👑'
        : this.isDM()
        ? 'Co-Master (DM) ⚔'
        : 'Avventuriero (PG) 🛡';

      profCard.innerHTML =
        '<div>' +
          '<div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--gold-bright);">' +
            String(cu.username).replace(/[&<>"']/g, function(c) { return '&#' + c.charCodeAt(0) + ';'; }) +
          '</div>' +
          '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">' +
            roleBadgeText +
          '</div>' +
        '</div>';

      // Cambio rapido account per test o cambio giocatore al volo
      var switchBtn = document.createElement('button');
      switchBtn.type = 'button';
      switchBtn.className = 'sium-ctrl-btn';
      switchBtn.textContent = 'Cambia Account';
      switchBtn.onclick = function () {
        ov.remove();
        self.signOut();
      };
      profCard.appendChild(switchBtn);
      body.appendChild(profCard);
    }

    /* 2. Account attivi della Gilda */
    var usersLbl = document.createElement('div');
    usersLbl.className = 'settings-section-lbl';
    usersLbl.textContent = 'Membri del Party (' + this.getAllUsers().length + ')';
    body.appendChild(usersLbl);

    var usersWrap = document.createElement('div');
    usersWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;';

    var allUsers = this.getAllUsers();
    allUsers.forEach(function (uObj) {
      var uname = uObj.username;
      var pres = _presenceMap[uname] || {};
      var isSelf = cu && cu.username.toLowerCase() === uname.toLowerCase();
      var isOnline = isSelf || !!pres.online;
      var isMaster = uObj.role === 'DM';

      var row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.7rem;border-radius:6px;background:var(--bg-card);border:1px solid ' +
        (isSelf ? 'var(--border-gold)' : 'var(--border-subtle)') + ';';

      var dot = document.createElement('span');
      dot.style.cssText =
        'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' +
        (isOnline ? '#34d399' : '#6b7280') +
        ';box-shadow:' +
        (isOnline ? '0 0 6px #34d399' : 'none') + ';';

      var nameEl = document.createElement('span');
      nameEl.style.cssText =
        'flex:1;font-family:var(--font-display);font-size:12.5px;font-weight:600;color:' +
        (isOnline ? 'var(--text-primary)' : 'var(--text-secondary)') + ';';
      nameEl.textContent = uname + ' ' + (uObj.crest || '') + (isSelf ? ' (Tu)' : '');

      var statusEl = document.createElement('span');
      statusEl.style.cssText =
        'font-size:10px;font-family:var(--font-display);letter-spacing:0.06em;color:' +
        (isOnline ? '#34d399' : 'var(--text-muted)') + ';min-width:48px;text-align:right;';
      statusEl.textContent = isOnline ? 'Online' : 'Offline';

      row.appendChild(dot);
      row.appendChild(nameEl);
      row.appendChild(statusEl);

      // Se l'utente attivo è Admin, può promuovere/revocare privilegi DM agli altri giocatori
      if (self.isAdmin() && !isMaster) {
        var hasDM = !!uObj.dmPriv;
        var togBtn = document.createElement('button');
        togBtn.type = 'button';
        togBtn.style.cssText =
          'font-size:10px;font-family:var(--font-display);padding:0.22rem 0.55rem;border-radius:4px;cursor:pointer;border:1px solid ' +
          (hasDM ? 'var(--gold)' : 'var(--border-subtle)') +
          ';background:transparent;color:' +
          (hasDM ? 'var(--gold-bright)' : 'var(--text-muted)') + ';margin-left:0.35rem;';
        togBtn.textContent = hasDM ? '⚔ DM' : '🛡 PG';
        togBtn.onclick = (function (targetName, btn, currentPriv) {
          return function () {
            var newVal = !currentPriv;
            _remoteUsers[targetName] = Object.assign({}, _remoteUsers[targetName], { dmPriv: newVal });
            if (_db) {
              _db.ref('users/' + targetName + '/dmPriv').set(newVal);
            }
            currentPriv = newVal;
            btn.style.borderColor = newVal ? 'var(--gold)' : 'var(--border-subtle)';
            btn.style.color = newVal ? 'var(--gold-bright)' : 'var(--text-muted)';
            btn.textContent = newVal ? '⚔ DM' : '🛡 PG';
            if (typeof notify === 'function') {
              notify(targetName + (newVal ? ' ora ha i privilegi DM.' : ' è tornato Giocatore.'));
            }
          };
        })(uname, togBtn, hasDM);
        row.appendChild(togBtn);
      }

      usersWrap.appendChild(row);
    });
    body.appendChild(usersWrap);

    /* 3. Cambio Password */
    if (cu) {
      var pwLbl = document.createElement('div');
      pwLbl.className = 'settings-section-lbl';
      pwLbl.textContent = 'Cambio Password';
      body.appendChild(pwLbl);

      var pwWrap = document.createElement('div');
      pwWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.45rem;';

      var mkPwInp = function (ph, id) {
        var inp = document.createElement('input');
        inp.type = 'password';
        inp.placeholder = ph;
        inp.id = id;
        inp.style.cssText =
          'width:100%;background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary);padding:0.45rem 0.65rem;border-radius:6px;font-size:13px;';
        return inp;
      };

      pwWrap.appendChild(mkPwInp('Password attuale', 'pw-old'));
      pwWrap.appendChild(mkPwInp('Nuova password', 'pw-new'));
      pwWrap.appendChild(mkPwInp('Conferma nuova password', 'pw-new2'));

      var pwMsg = document.createElement('div');
      pwMsg.style.cssText = 'font-size:12px;display:none;text-align:center;';

      var pwBtn = document.createElement('button');
      pwBtn.type = 'button';
      pwBtn.className = 'btn-secondary';
      pwBtn.style.cssText = 'width:100%;justify-content:center;font-size:11px;padding:0.5rem;';
      pwBtn.textContent = '🔑 Aggiorna Password';
      pwBtn.onclick = async function () {
        var oldP = document.getElementById('pw-old').value;
        var newP = document.getElementById('pw-new').value;
        var newP2 = document.getElementById('pw-new2').value;
        pwMsg.style.display = 'none';

        if (!oldP || !newP || !newP2) {
          pwMsg.style.color = '#f87171';
          pwMsg.textContent = 'Compila tutti i campi.';
          pwMsg.style.display = 'block';
          return;
        }
        if (newP.length < 6) {
          pwMsg.style.color = '#f87171';
          pwMsg.textContent = 'La nuova password deve avere almeno 4 caratteri.';
          pwMsg.style.display = 'block';
          return;
        }
        if (newP !== newP2) {
          pwMsg.style.color = '#f87171';
          pwMsg.textContent = 'Le nuove password non coincidono.';
          pwMsg.style.display = 'block';
          return;
        }

        pwBtn.disabled = true;
        try {
          await self.changePassword(cu.username, oldP, newP);
        } catch (error) {
          pwMsg.style.color = '#f87171';
          pwMsg.textContent = error.message;
          pwMsg.style.display = 'block';
          return;
        } finally {
          pwBtn.disabled = false;
        }
        pwMsg.style.color = '#34d399';
        pwMsg.textContent = 'Password aggiornata con successo!';
        pwMsg.style.display = 'block';
        document.getElementById('pw-old').value = '';
        document.getElementById('pw-new').value = '';
        document.getElementById('pw-new2').value = '';
      };

      pwWrap.appendChild(pwBtn);
      pwWrap.appendChild(pwMsg);
      body.appendChild(pwWrap);
    }

    /* 4. Tema & Effetti Visivi */
    var themeLbl = document.createElement('div');
    themeLbl.className = 'settings-section-lbl';
    themeLbl.textContent = 'Aspetto & Atmosfera';
    body.appendChild(themeLbl);

    var themeRow = document.createElement('div');
    themeRow.style.cssText = 'display:flex;gap:0.5rem;';
    var curTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    [
      ['dark', '🌙 Taverna (Scuro)'],
      ['light', '☀ Pergamena (Chiaro)']
    ].forEach(function (t) {
      var tb = document.createElement('button');
      tb.type = 'button';
      tb.className = 'btn-secondary';
      tb.style.cssText =
        'flex:1;justify-content:center;font-size:11px;padding:0.45rem;' +
        (curTheme === t[0] ? 'border-color:var(--gold);color:var(--gold-bright);' : '');
      tb.textContent = t[1];
      tb.onclick = function () {
        if (typeof state !== 'undefined') state.theme = t[0];
        document.documentElement.setAttribute('data-theme', t[0]);
        if (typeof saveToStorage === 'function') saveToStorage();
        if (typeof render === 'function') render();
        ov.remove();
      };
      themeRow.appendChild(tb);
    });
    body.appendChild(themeRow);

    /* 5. Disconnessione */
    if (_authUser) {
      var logoutBtn = document.createElement('button');
      logoutBtn.type = 'button';
      logoutBtn.className = 'btn-blood';
      logoutBtn.style.cssText = 'margin-top:0.65rem;width:100%;justify-content:center;padding:0.55rem;';
      logoutBtn.textContent = '⤻ Disconnetti dal Compendium';
      logoutBtn.onclick = function () {
        ov.remove();
        self.signOut();
      };
      body.appendChild(logoutBtn);
    }

    box.appendChild(body);
    ov.appendChild(box);
    document.body.appendChild(ov);
  }
};

/* ============================================================================
   ESPORTAZIONE FUNZIONI GLOBALI (Compatibilità 100% con tutto il Compendium)
   ============================================================================ */
window.UserManager = UserManager;

function isAdmin() { return UserManager.isAdmin(); }
function isDM()    { return UserManager.isDM(); }
function isPG()    { return UserManager.isPG(); }

function dmRef(path) {
  if (!_db || !_authUser) return null;
  if (UserManager.isAdmin()) return _db.ref('state/' + path);
  return _db.ref('users/' + _authUser.uid + '/' + path);
}

function doSignIn()            { return UserManager.signIn(); }
function doSignOut()           { return UserManager.signOut(); }
function renderUserBadge()     { UserManager.renderUserBadge(); }
function renderSettingsPanel() { UserManager.renderSettingsPanel(); }
function getAllUsers()         { return UserManager.getAllUsers(); }
function initAuth()            { UserManager.initAuth(); }
