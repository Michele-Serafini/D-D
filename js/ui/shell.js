/* ============================================================================
   SEZIONE 2: MOTORE DI RENDERING PRINCIPALE (render & renderMain)
   ============================================================================ */
function renderActiveSection() {
  var dmSections = ['dashboard', 'diario', 'worldbuilding', 'storia', 'archivio', 'schedepg'];
  if (dmSections.indexOf(state.section) !== -1 && !isDM()) return renderDadi();
  if (state.section === 'scheda' || (state.section === 'schedepg' && state.schedePGViewMode))
    return _buildSchedaWithLavagna();
  if (state.section === 'tavolo') {
    var table = renderTavolo();
    table.style.height = 'calc(100vh - 120px)';
    return table;
  }
  var renderers = {
    dashboard: renderDashboard,
    diario: renderSessionJournal,
    contenuti: renderRevealedContent,
    telefono: renderPhoneOffline,
    'storico-schede': renderSheetHistory,
    commercio: renderCommerce,
    emporio: renderEmporio,
    iniziativa: renderIniziativa,
    note: renderNote,
    caos: renderCaos,
    generatore: renderGeneratore,
    dadi: renderDadi,
    mappa: renderMappa,
    bestiario: renderBestiario,
    incantesimi: renderIncantesimiAggiuntivi,
    worldbuilding: renderWorldbuilding,
    bacheca: renderBacheca,
    storia: renderStoria,
    archivio: renderArchivio,
    schedepg: renderSchedePG,
    libri: renderLibri,
  };
  try {
    return renderers[state.section]
      ? renderers[state.section]()
      : document.createDocumentFragment();
  } catch (error) {
    if (state.section !== 'storia') throw error;
    var message = document.createElement('pre');
    message.style.cssText = 'padding:2rem;color:#ff9c9c;font-size:13px;';
    message.textContent = 'Errore Storia: ' + String(error);
    return message;
  }
}

var _sectionDisposers = [];
function onSectionCleanup(dispose) {
  _sectionDisposers.push(dispose);
}

function listenInSection(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  function dispose() {
    target.removeEventListener(type, handler, options);
    var index = _sectionDisposers.indexOf(dispose);
    if (index !== -1) _sectionDisposers.splice(index, 1);
  }
  onSectionCleanup(dispose);
  return dispose;
}

var _mainRenderFrame = null;
function scheduleRenderMain() {
  if (_mainRenderFrame !== null) return;
  _mainRenderFrame = requestAnimationFrame(function () {
    _mainRenderFrame = null;
    renderMain();
  });
}

function cleanupActiveSection() {
  _sectionDisposers
    .splice(0)
    .reverse()
    .forEach(function (dispose) {
      dispose();
    });
  if (_sectionCleanup) {
    _sectionCleanup();
    _sectionCleanup = null;
  }
  if (_tavoloRef) {
    _tavoloRef.off('value');
    _tavoloRef = null;
  }
}

function render() {
  cleanupActiveSection();
  document.documentElement.setAttribute('data-theme', state.theme);
  var app = document.getElementById('app');
  app.innerHTML = '';
  try {
    var shell = document.createElement('div');
    shell.className = 'app-shell';

    var mt = document.createElement('button');
    mt.className = 'sidebar-toggle';
    mt.innerHTML = ICON.menu;
    mt.onclick = function () {
      state.sidebarOpen = !state.sidebarOpen;
      render();
    };
    shell.appendChild(mt);

    shell.appendChild(renderSidebar());

    /* Backdrop per chiudere la sidebar cliccando fuori (solo mobile) */
    if (state.sidebarOpen) {
      var backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      backdrop.onclick = function () {
        state.sidebarOpen = false;
        render();
      };
      shell.appendChild(backdrop);
    }

    /* Wrapper contenuto — split quando regia attiva */
    var contentWrap = document.createElement('div');
    contentWrap.className = 'content-wrap' + (state.regiaActive ? ' regia-split' : '');

    var main = document.createElement('main');
    main.className = 'main-content';
    main.appendChild(buildSheetSyncStatus());
    main.appendChild(renderActiveSection());
    contentWrap.appendChild(main);

    if (state.regiaActive) {
      contentWrap.appendChild(renderRegiaSonora());
    }

    shell.appendChild(contentWrap);
    app.appendChild(shell);

    if (state.showForm) document.body.appendChild(renderWeaponForm());
    if (state.doomEventOpen) document.body.appendChild(renderDoomEventModal());

    // Re-render badge after full render
    renderUserBadge();
    if (window.SiumAnimations && window.SiumAnimations.onRender)
      window.SiumAnimations.onRender(false);
  } catch (_renderErr) {
    var failure = document.createElement('pre');
    failure.style.cssText =
      'padding:2rem;color:#ff9c9c;font-family:monospace;font-size:13px;background:#1a0a0a;min-height:100vh;';
    failure.textContent = 'ERRORE RENDER:\n' + String(_renderErr) + '\n' + (_renderErr.stack || '');
    app.replaceChildren(failure);
  }
}

function renderMain() {
  var _scrollX = window.scrollX || document.documentElement.scrollLeft;
  var _scrollY = window.scrollY || document.documentElement.scrollTop;
  var _mcNode = document.querySelector('.main-content');
  var _mcScrollY = _mcNode ? _mcNode.scrollTop : 0;
  if (typeof window._lastRenderedSection === 'undefined')
    window._lastRenderedSection = state.section;
  var _sectionChanged = window._lastRenderedSection !== state.section;
  window._lastRenderedSection = state.section;

  var main = document.querySelector('.main-content');
  if (!main) {
    render();
    return;
  }
  if (state.section === 'storia') {
    var _ed = document.getElementById('storia-editor');
    if (_ed) {
      state.storia.content = _ed.innerHTML;
    }
  }
  cleanupActiveSection();
  main.innerHTML = '';
  main.appendChild(buildSheetSyncStatus());
  main.appendChild(renderActiveSection());

  var sb = document.querySelector('.sidebar');
  if (sb) sb.replaceWith(renderSidebar());

  /* Aggiorna classe split se regia è attiva */
  var cw = document.querySelector('.content-wrap');
  if (cw) {
    cw.className = 'content-wrap' + (state.regiaActive ? ' regia-split' : '');
    var existingRegia = cw.querySelector('.regia-panel');
    if (state.regiaActive && !existingRegia) cw.appendChild(renderRegiaSonora());
    if (!state.regiaActive && existingRegia) existingRegia.remove();
  }

  if (window.SiumAnimations && window.SiumAnimations.onRender)
    window.SiumAnimations.onRender(_sectionChanged);
  if (!_sectionChanged) {
    var _mc = document.querySelector('.main-content');
    if (_mc && typeof _mcScrollY !== 'undefined') {
      _mc.scrollTop = _mcScrollY;
    }
    window.scrollTo({ left: _scrollX, top: _scrollY, behavior: 'auto' });
  }
}
