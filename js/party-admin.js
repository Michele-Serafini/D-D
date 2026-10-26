/* Gestione account: Firebase è l'unica fonte, mai reintegrare DEFAULT_USERS. */
(function () {
  'use strict';
  var manager = window.UserManager;
  manager.watchUsers = function () {
    if (!_db || this._usersHandler) return;
    this._usersHandler = function (snap) {
      _remoteUsers = snap.val() || {};
      var cu = manager.getCurrentUser();
      if (cu && cu.username !== 'admin') {
        var record = _remoteUsers[cu.username];
        if (!record || record.disabled) { manager.signOut(); return; }
        var nextRole = record.role === 'DM' || record.role === 'Admin' ? 'admin' : (record.dmPriv ? 'dm' : 'pg');
        var changed = _authRole !== nextRole;
        _authRole = nextRole;
        cu.role = record.role || 'Giocatore';
        cu.dmPriv = record.role === 'DM' || record.role === 'Admin' || !!record.dmPriv;
        if (changed && typeof render === 'function') render();
      }
      if (typeof window.refreshAdminUsers === 'function') window.refreshAdminUsers();
    };
    _db.ref('users').on('value', this._usersHandler);
    var current = manager.getCurrentUser();
    if (current && current.username !== 'admin') {
      _db.ref('users/' + current.username).on('value', function (snap) {
        if (!snap.val() || snap.val().disabled) manager.signOut();
      });
    }
  };
  function requireAdmin() {
    if (!manager.isAdmin()) throw new Error('Accesso riservato agli amministratori.');
    var db = manager.ensureDatabase();
    if (!db) throw new Error('Database non disponibile.');
    return db;
  }
  manager.addPlayer = async function (name, password) {
    var db = requireAdmin();
    name = manager.normalizeUsername(name);
    if (name === 'admin') throw new Error('Nome riservato.');
    if (typeof password !== 'string' || password.length < 6) throw new Error('Password: minimo 6 caratteri.');
    var existing = (await manager.withTimeout(db.ref('users/' + name).once('value'))).val();
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
  };
  manager.reactivatePlayer = async function (name) {
    var db = requireAdmin();
    name = manager.normalizeUsername(name);
    await db.ref('users/' + name + '/disabled').set(false);
  };
  manager.removePlayer = async function (name) {
    var db = requireAdmin();
    name = manager.normalizeUsername(name);
    var result = await db.ref('users/' + name).transaction(function (record) {
      if (!record || record.role === 'DM' || record.role === 'Admin') return;
      // Conserva mappe e altro contenuto personale; disabilita solo l'accesso.
      record.disabled = true;
      delete record.password;
      return record;
    });
    if (!result.committed) throw new Error('Puoi rimuovere solo i giocatori.');
  };
  var markerRef = null, markerHandler = null;
  function status(message, error) {
    var el = document.getElementById('admin-status');
    el.textContent = message;
    el.style.color = error ? '#ff9b91' : '#b9e5c8';
  }
  function button(label, action) {
    var el = document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    el.onclick = async function () {
      el.disabled = true;
      try { await action(); status('Operazione completata.'); }
      catch (error) { status(error.message, true); }
      finally { el.disabled = false; }
    };
    return el;
  }
  function downloadBackup(value) {
    var blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'party-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  window.refreshAdminUsers = function () {
    var list = document.getElementById('admin-users');
    if (!list || !manager.isAdmin()) return;
    list.replaceChildren();
    Object.keys(_remoteUsers).map(function (name) { return Object.assign({ username: name }, _remoteUsers[name]); }).forEach(function (u) {
      var row = document.createElement('li');
      var text = document.createElement('span');
      text.textContent = u.username + ' · ' + u.role + (u.disabled ? ' (rimosso)' : '');
      row.appendChild(text);
      if (u.role === 'Giocatore') row.appendChild(button(u.disabled ? 'Riattiva' : 'Rimuovi', function () { return u.disabled ? manager.reactivatePlayer(u.username) : manager.removePlayer(u.username); }));
      list.appendChild(row);
    });
  };
  function redact(value, depth) {
    depth = depth || 0;
    if (typeof value === 'string') return value.length > 2000 ? value.slice(0, 2000) + '… [contenuto abbreviato]' : value;
    if (!value || typeof value !== 'object') return value;
    if (depth > 8) return '[espandi il percorso per vedere questo nodo]';
    var copy = Array.isArray(value) ? [] : {};
    Object.keys(value).slice(0, 100).forEach(function (key) {
      copy[key] = /password|secret|token|api.?key|geminiKey|groqKey/i.test(key) ? '••••••' : redact(value[key], depth + 1);
    });
    return copy;
  }
  async function viewDatabase() {
    var path = document.getElementById('database-path').value.trim().replace(/^\/+|\/+$/g, '');
    if (/[.#$\[\]]/.test(path)) throw new Error('Percorso Firebase non valido.');
    var snap = await manager.withTimeout(requireAdmin().ref(path || '/').limitToFirst(25).once('value'));
    document.getElementById('admin-database').textContent = JSON.stringify(redact(snap.val()), null, 2);
  }
  window.openAdminPanel = async function () {
    if (!document.getElementById('admin-panel')) { window.location.assign('admin.html'); return; }
    document.getElementById('login-overlay').hidden = true;
    document.getElementById('admin-panel').hidden = false;
    try {
      var db = requireAdmin();
      await manager.loadUsers();
      manager.watchUsers();
      refreshAdminUsers();
      if (!markerRef) {
        markerRef = db.ref('meta/partyResetVersion');
        markerHandler = function (snap) {
          var done = snap.val() === PARTY_RESET_VERSION;
          document.getElementById('reset-party').disabled = true;
          document.getElementById('reset-party').textContent = done ? 'Reset iniziale già eseguito' : 'Esegui reset iniziale e scarica backup';
        };
        markerRef.on('value', markerHandler, function (error) { status(error.message, true); });
      }
      await viewDatabase();
      status('Database collegato.');
    } catch (error) { status(error.message, true); }
  };
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('add-player');
    if (!form) return;
    form.onsubmit = async function (event) {
      event.preventDefault();
      var submit = form.querySelector('button');
      submit.disabled = true;
      try {
        await manager.addPlayer(document.getElementById('player-name').value, document.getElementById('player-password').value);
        form.reset();
        status('Giocatore aggiunto.');
      } catch (error) { status(error.message, true); }
      finally { submit.disabled = false; }
    };
    document.getElementById('export-backup').onclick = async function () {
      try { downloadBackup((await requireAdmin().ref().once('value')).val()); }
      catch (error) { status(error.message, true); }
    };
    document.getElementById('load-database').onclick = async function () {
      this.disabled = true;
      try { await viewDatabase(); status('Vista aggiornata: massimo 25 elementi per percorso.'); }
      catch (error) { status(error.message, true); }
      finally { this.disabled = false; }
    };
    document.getElementById('admin-logout').onclick = function () {
      if (markerRef) markerRef.off('value', markerHandler);
      manager.signOut();
    };
  });
})();
