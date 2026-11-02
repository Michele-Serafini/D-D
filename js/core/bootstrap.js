/* AVVIO */
try {
  (function () {
    document.getElementById('app').hidden = true;
    // Mostra overlay login mentre Firebase Auth controlla la sessione
    document.getElementById('login-overlay').style.display = 'flex';
    // Inizializza Firebase + Auth listener (gestirà lui login/logout)
    try {
      initAuth();
    } catch (e) {
      console.warn('[Mercante] Firebase non disponibile:', e.message);
      // Fallback: mostra login
      document.getElementById('login-overlay').style.display = 'flex';
    }

    // Salva storia prima di chiudere/cambiare tab
    function flushPendingWrites() {
      flushStorage();
      storiaFlushSave();
      if (_schedaSaveTimer) fbSaveScheda(true);
      MasterDashboardNotes.flush().catch(function () {});
      SessionJournal.flush();
    }
    window.addEventListener('beforeunload', flushPendingWrites);
    window.addEventListener('pagehide', flushPendingWrites);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushPendingWrites();
    });

    if (typeof renderMenu === 'function') renderMenu();
    // The authenticated render runs after login; do not build thousands of
    // catalog nodes underneath a closed login overlay.
  })();
} catch (err) {
  console.error('[Mercante] Errore:', err);
  document.getElementById('app').innerHTML =
    '<div style="padding:2rem;color:#ffd8c8;font-family:monospace;font-size:13px;">' +
    '<h2 style="color:#ff9c9c;">Errore avvio</h2>' +
    '<pre>' +
    escapeHtml(err.message || String(err)) +
    '\n\n' +
    escapeHtml(err.stack || '') +
    '</pre>' +
    '</div>';
}
