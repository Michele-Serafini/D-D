/**
 * ============================================================================
 * SISTEMA UNIFICATO UTENTI, RUOLI E AUTENTICAZIONE (js/users.js)
 * ============================================================================
 * Modulo centralizzato che gestisce in un unico punto:
 * 1. Elenco account predefiniti (DEFAULT_USERS) facile da leggere e modificare
 * 2. Controllo ruoli e permessi (isAdmin, isDM, isPG)
 * 3. Login unificato (online con Firebase + fallback offline immediato)
 * 4. Registrazione nuovi account, cambio password e gestione privilegi DM
 * 5. Presenza utenti online in tempo reale e Pannello Impostazioni Utenti
 * 6. Cerimonia scenografica di accesso ("Sigillo Arcano & Portale del Grimorio")
 * ============================================================================
 */

/* ── 1. Configurazione Firebase Condivisa ── */
var FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC5yPmvgP1re9KAYnCnQnReuV1djq9ugLg',
  authDomain: 'mercante-errante.firebaseapp.com',
  databaseURL: 'https://mercante-errante-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'mercante-errante',
  storageBucket: 'mercante-errante.firebasestorage.app',
  messagingSenderId: '1079281517271',
  appId: '1:1079281517271:web:24bd4c8ef039079eece692',
  measurementId: 'G-R9CKK7NMNW'
};

var _firebaseApp = null;
var _db = null;
var _fbConnected = false;
var _fbListeners = [];

/* ── 2. Elenco Unificato degli Account Predefiniti ──
 * Per aggiungere un nuovo utente o modificare una password predefinita,
 * basta aggiungere o modificare una riga in questo array:
 * - role: 'DM' (Master principale/Admin) oppure 'Giocatore'
 * - dmPriv: true per dare i permessi Dungeon Master, false per Giocatore
 */
var ADMIN_EMAIL = 'chitarra1000@gmail.com';

var DEFAULT_USERS = [
  { username: 'Matteo',   password: 'Dungeonmaster!', role: 'DM',        dmPriv: true,  crest: '👑', title: 'Dungeon Master' },
  { username: 'Luca',     password: 'player1',        role: 'Giocatore', dmPriv: false, crest: '🛡', title: 'Avventuriero' },
  { username: 'Michele',  password: 'player2',        role: 'Giocatore', dmPriv: false, crest: '⚔', title: 'Avventuriero' },
  { username: 'Silvia',   password: 'player3',        role: 'Giocatore', dmPriv: false, crest: '✨', title: 'Avventuriera' },
  { username: 'Giada',    password: 'player4',        role: 'Giocatore', dmPriv: false, crest: '🏹', title: 'Avventuriera' },
  { username: 'Enrico',   password: 'player5',        role: 'Giocatore', dmPriv: false, crest: '🪓', title: 'Avventuriero' },
  { username: 'Chiliano', password: 'player6',        role: 'Giocatore', dmPriv: false, crest: '🔮', title: 'Avventuriero' }
];

/* Stato globale di autenticazione e presenza (sincronizzato con Firebase) */
var _authUser = null;      // Oggetto utente autenticato corrente
var _authRole = null;      // 'admin' | 'dm' | 'pg' | null
var _remoteUsers = {};     // { username: { password, role, dmPriv } } da Firebase
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
        if (!_firebaseApp) {
          _firebaseApp = firebase.apps && firebase.apps.length
            ? firebase.app()
            : firebase.initializeApp(FIREBASE_CONFIG);
        }
        _db = firebase.database();
        // Pulizia mappe legacy duplicate se presenti
        _db.ref('state/multiverso/mappa/maps').once('value', function (s) {
          var m = s.val() || {};
          Object.keys(m).forEach(function (k) {
            if (m[k] && m[k].nome === 'Mappe del Mondo di One Piece') {
              _db.ref('state/multiverso/mappa/maps/' + k).remove();
            }
          });
        });
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
   * Restituisce l'elenco unificato di tutti gli utenti (DEFAULT_USERS + Firebase).
   */
  getAllUsers: function () {
    var map = {};
    DEFAULT_USERS.forEach(function (u) {
      map[u.username] = {
        username: u.username,
        role: u.role || 'Giocatore',
        dmPriv: !!u.dmPriv,
        crest: u.crest || (u.role === 'DM' ? '👑' : '🛡'),
        title: u.title || (u.role === 'DM' ? 'Dungeon Master' : 'Avventuriero')
      };
    });
    if (_remoteUsers && typeof _remoteUsers === 'object') {
      Object.keys(_remoteUsers).forEach(function (uname) {
        var ru = _remoteUsers[uname] || {};
        var base = map[uname] || {};
        var isMaster = ru.role === 'DM' || base.role === 'DM';
        map[uname] = {
          username: uname,
          role: ru.role || base.role || 'Giocatore',
          dmPriv: isMaster ? true : !!ru.dmPriv,
          crest: base.crest || (isMaster ? '👑' : (ru.dmPriv ? '⚔' : '🛡')),
          title: base.title || (isMaster ? 'Dungeon Master' : 'Avventuriero')
        };
      });
    }
    return Object.keys(map).map(function (k) {
      return map[k];
    });
  },

  /**
   * Verifica se la password inserita corrisponde a quella remota o a quella predefinita.
   */
  passwordMatch: function (remoteUserObj, username, password) {
    if (remoteUserObj && remoteUserObj.password && remoteUserObj.password === password) {
      return true;
    }
    var defUser = this.findDefaultUser(username);
    if (defUser && defUser.password === password) {
      return true;
    }
    return false;
  },

  /**
   * Esegue il login unificato controllando:
   * 1) Utenti predefiniti / cache remota
   * 2) Database Firebase `users/<username>` per account creati dinamicamente
   */
  signIn: function (customUser, customPass) {
    var uEl =
      document.getElementById('login-username-input') ||
      document.getElementById('login-user');
    var pEl =
      document.getElementById('login-password-input') ||
      document.getElementById('login-pass');
    var errEl = document.getElementById('login-error');

    var u = typeof customUser === 'string' ? customUser.trim() : (uEl ? uEl.value.trim() : '');
    var p = typeof customPass === 'string' ? customPass : (pEl ? pEl.value : '');

    if (!u || !p) {
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = 'Inserisci username e password per aprire il Grimorio.';
      }
      return;
    }

    this.ensureDatabase();

    // 1. Verifica in _remoteUsers se già sincronizzato
    if (_remoteUsers && _remoteUsers[u] && this.passwordMatch(_remoteUsers[u], u, p)) {
      if (errEl) errEl.style.display = 'none';
      this.completeLogin(u, _remoteUsers[u]);
      return;
    }

    // 2. Verifica immediata in DEFAULT_USERS (funziona anche 100% offline)
    var defMatch = this.findDefaultUser(u);
    if (defMatch && defMatch.password === p) {
      if (errEl) errEl.style.display = 'none';
      var mergedRecord = Object.assign(
        { password: defMatch.password, role: defMatch.role, dmPriv: !!defMatch.dmPriv },
        (_remoteUsers && _remoteUsers[defMatch.username]) ? _remoteUsers[defMatch.username] : {}
      );
      this.completeLogin(defMatch.username, mergedRecord);
      return;
    }

    // 3. Verifica su Firebase per account creati dinamicamente o password aggiornate
    if (!_db) {
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = 'Credenziali non valide (modalità offline).';
      }
      return;
    }

    var self = this;
    var loginDone = false;
    var btn = document.querySelector('#login-cred-area .login-btn');
    if (btn) btn.innerHTML = '<span class="login-btn-ico">⏳</span><span>Verifica Sigillo...</span>';

    var loginTimeout = setTimeout(function () {
      if (loginDone) return;
      loginDone = true;
      if (btn) btn.innerHTML = '<span class="login-btn-ico">⚔</span><span>Entra nel Compendium</span>';
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = 'Username o password errati (o server non raggiungibile).';
      }
    }, 3500);

    _db.ref('users/' + u).once(
      'value',
      function (snap) {
        if (loginDone) return;
        loginDone = true;
        clearTimeout(loginTimeout);
        if (btn) btn.innerHTML = '<span class="login-btn-ico">⚔</span><span>Entra nel Compendium</span>';
        var ud = snap.val();
        if (!ud || !self.passwordMatch(ud, u, p)) {
          if (errEl) {
            errEl.style.display = 'block';
            errEl.textContent = 'Username o password errati.';
          }
          return;
        }
        _remoteUsers[u] = ud;
        if (errEl) errEl.style.display = 'none';
        self.completeLogin(u, ud);
      },
      function () {
        if (loginDone) return;
        loginDone = true;
        clearTimeout(loginTimeout);
        if (btn) btn.innerHTML = '<span class="login-btn-ico">⚔</span><span>Entra nel Compendium</span>';
        if (errEl) {
          errEl.style.display = 'block';
          errEl.textContent = 'Impossibile verificare l\'account remoto.';
        }
      }
    );
  },

  /**
   * Finalizza il login, imposta lo stato utente unificato, avvia la cerimonia
   * di apertura del Portale Runico (senza esplosione di luce bianca) e carica i dati.
   */
  completeLogin: function (username, ud) {
    var record = ud || {};
    var defUser = this.findDefaultUser(username);
    var role = record.role || (defUser ? defUser.role : 'Giocatore');
    var hasDmPriv = role === 'DM' || !!record.dmPriv || !!(defUser && defUser.dmPriv);

    _authRole = role === 'DM' ? 'admin' : (hasDmPriv ? 'dm' : 'pg');
    _authUser = {
      uid: username,
      displayName: username,
      email: username.toLowerCase() + '@mercante.local'
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

    // Assicura che DEFAULT_USERS siano popolati in _remoteUsers locale se vuoti
    DEFAULT_USERS.forEach(function (du) {
      if (!_remoteUsers[du.username]) {
        _remoteUsers[du.username] = {
          password: du.password,
          role: du.role,
          dmPriv: !!du.dmPriv
        };
      }
    });

    this.ensureDatabase();

    // Se è il DM e il nodo 'users' su Firebase non esiste ancora, lo inizializza
    if (hasDmPriv && _db) {
      _db.ref('users').once('value', function (snap) {
        if (!snap.val()) {
          var usersObj = {};
          DEFAULT_USERS.forEach(function (u) {
            usersObj[u.username] = {
              password: u.password,
              role: u.role,
              dmPriv: !!u.dmPriv
            };
          });
          _db.ref('users').set(usersObj);
        }
      });
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
   * Crea un nuovo account Giocatore su Firebase e accede automaticamente.
   */
  createAccount: function () {
    var uEl = document.getElementById('new-username');
    var pEl = document.getElementById('new-password');
    var p2El = document.getElementById('new-password2');
    var errEl = document.getElementById('create-error');

    var u = uEl ? uEl.value.trim() : '';
    var p = pEl ? pEl.value : '';
    var p2 = p2El ? p2El.value : '';

    if (errEl) errEl.style.display = 'none';

    if (!u) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Inserisci un username.'; }
      return;
    }
    if (u.length < 3) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Username troppo corto (min 3 caratteri).'; }
      return;
    }
    if (!p || p.length < 4) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Password troppo corta (min 4 caratteri).'; }
      return;
    }
    if (p !== p2) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Le password non coincidono.'; }
      return;
    }

    this.ensureDatabase();
    var self = this;

    if (this.findDefaultUser(u)) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Questo username appartiene già al party principale.'; }
      return;
    }

    if (!_db) {
      // Fallback locale se offline
      var localUser = { password: p, role: 'Giocatore', dmPriv: false };
      _remoteUsers[u] = localUser;
      this.completeLogin(u, localUser);
      return;
    }

    _db.ref('users/' + u).once('value', function (snap) {
      if (snap.val()) {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Username già in uso.'; }
        return;
      }
      var newRecord = { password: p, role: 'Giocatore', dmPriv: false };
      _db.ref('users/' + u).set(newRecord, function (err) {
        if (err) {
          if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Errore salvataggio: ' + err.message; }
          return;
        }
        _remoteUsers[u] = newRecord;
        self.completeLogin(u, newRecord);
      });
    });
  },

  /**
   * Alterna tra la schermata di Login e quella di Creazione Account.
   */
  toggleCreateAccount: function () {
    var loginArea = document.getElementById('login-cred-area');
    var createArea = document.getElementById('create-account-area');
    if (!loginArea || !createArea) return;
    var showing = createArea.style.display === 'flex';
    loginArea.style.display = showing ? 'flex' : 'none';
    createArea.style.display = showing ? 'none' : 'flex';
    var lErr = document.getElementById('login-error');
    var cErr = document.getElementById('create-error');
    if (lErr) lErr.style.display = 'none';
    if (cErr) cErr.style.display = 'none';
  },

  /**
   * Disconnette l'utente corrente e riporta al portale di accesso.
   */
  signOut: function () {
    if (_db && state && state.currentUser) {
      try {
        _db.ref('presence/' + state.currentUser.username).set({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
      } catch (e) {}
    }
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
    connRef.on('value', function (snap) {
      _fbConnected = !!snap.val();
      if (_fbConnected) {
        ref.onDisconnect().set({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
        ref.set({ online: true, username: uid });
      }
    });
  },

  /**
   * Inizializza l'autenticazione all'avvio della pagina (supporta ?autostart=1).
   */
  initAuth: function () {
    this.ensureDatabase();

    // Pre-popola _remoteUsers con i DEFAULT_USERS così l'elenco utenti è sempre pronto
    DEFAULT_USERS.forEach(function (du) {
      if (!_remoteUsers[du.username]) {
        _remoteUsers[du.username] = {
          password: du.password,
          role: du.role,
          dmPriv: !!du.dmPriv
        };
      }
    });

    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        var roleParam = (params.get('role') || 'dm').toLowerCase();
        var userParam = params.get('user');
        if (userParam) {
          var found = this.findDefaultUser(userParam) || DEFAULT_USERS[0];
          this.completeLogin(found.username, found);
        } else if (roleParam === 'pg') {
          var pgUser = this.findDefaultUser('Luca');
          this.completeLogin(pgUser.username, pgUser);
        } else {
          var dmUser = this.findDefaultUser('Matteo');
          this.completeLogin(dmUser.username, dmUser);
        }
        return;
      }
    } catch (e) {}

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
            cu.username +
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

    /* 2. Elenco Unificato Gilda / Utenti (DEFAULT_USERS + Remoti) */
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
      pwBtn.onclick = function () {
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
        if (newP.length < 4) {
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

        var rem = _remoteUsers[cu.username] || {};
        if (!self.passwordMatch(rem, cu.username, oldP)) {
          pwMsg.style.color = '#f87171';
          pwMsg.textContent = 'Password attuale non corretta.';
          pwMsg.style.display = 'block';
          return;
        }

        _remoteUsers[cu.username] = Object.assign({}, rem, { password: newP });
        if (_db) {
          _db.ref('users/' + cu.username + '/password').set(newP);
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

function doSignIn()            { UserManager.signIn(); }
function tentaLogin()          { UserManager.signIn(); }
function googleSignIn()        { UserManager.signIn(); }
function dmLocalSignIn()       { UserManager.signIn(); }
function _completeLogin(u, ud) { UserManager.completeLogin(u, ud); }
function doSignOut()           { UserManager.signOut(); }
function googleSignOut()       { UserManager.signOut(); }
function toggleCreateAccount() { UserManager.toggleCreateAccount(); }
function doCreateAccount()     { UserManager.createAccount(); }
function setupPresence()       { UserManager.setupPresence(); }
function renderUserBadge()     { UserManager.renderUserBadge(); }
function renderSettingsPanel() { UserManager.renderSettingsPanel(); }
function getAllUsers()         { return UserManager.getAllUsers(); }
function passwordMatch(r,u,p)  { return UserManager.passwordMatch(r, u, p); }
function initAuth()            { UserManager.initAuth(); }

function initFirebase() {
  UserManager.ensureDatabase();
  UserManager.initAuth();
}

function pgEntra() {
  var nameEl = document.getElementById('pg-name-input');
  var name = nameEl ? nameEl.value.trim() : '';
  if (!name) return;
  UserManager.completeLogin(name, { role: 'Giocatore', dmPriv: false });
}

window.quickDemoLogin = function (username, password) {
  var uEl = document.getElementById('login-username-input');
  var pEl = document.getElementById('login-password-input');
  if (uEl) uEl.value = username;
  if (pEl) pEl.value = password;
  UserManager.signIn(username, password);
};

function _buildCurrentUserFromAuth(fbUser) {
  if (!fbUser) return;
  var role = (fbUser.email === ADMIN_EMAIL) ? 'admin' : 'dm';
  _authRole = role;
  _authUser = fbUser;
  if (typeof state !== 'undefined') {
    state.currentUser = {
      username: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'DM'),
      email: fbUser.email,
      uid: fbUser.uid,
      role: 'DM',
      dmPriv: role === 'admin'
    };
  }
}

var state_pre_init_user = null;

window.doSignIn = doSignIn;
window.tentaLogin = tentaLogin;
window.doSignOut = doSignOut;
window.toggleCreateAccount = toggleCreateAccount;
window.doCreateAccount = doCreateAccount;
window.getAllUsers = getAllUsers;
window.renderUserBadge = renderUserBadge;
window.renderSettingsPanel = renderSettingsPanel;
