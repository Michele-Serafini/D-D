/* Gestione account: Firebase è l'unica fonte, mai reintegrare DEFAULT_USERS. */
(function () {
  'use strict';
  var manager = window.UserManager;
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
    manager.getAllUsers(true).forEach(function (u) {
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
    var snap = await manager.withTimeout(manager.requireAdminDatabase().ref(path || '/').limitToFirst(25).once('value'));
    document.getElementById('admin-database').textContent = JSON.stringify(redact(snap.val()), null, 2);
  }
  window.openAdminPanel = async function () {
    if (!document.getElementById('admin-panel')) { window.location.assign('admin.html'); return; }
    document.getElementById('login-overlay').hidden = true;
    document.getElementById('admin-panel').hidden = false;
    try {
      var db = manager.requireAdminDatabase();
      await manager.loadUsers();
      manager.watchUsers();
      refreshAdminUsers();
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
      try { downloadBackup((await manager.requireAdminDatabase().ref().once('value')).val()); }
      catch (error) { status(error.message, true); }
    };
    document.getElementById('load-database').onclick = async function () {
      this.disabled = true;
      try { await viewDatabase(); status('Vista aggiornata: massimo 25 elementi per percorso.'); }
      catch (error) { status(error.message, true); }
      finally { this.disabled = false; }
    };
    document.getElementById('admin-logout').onclick = function () {
      manager.signOut();
    };
  });
})();
