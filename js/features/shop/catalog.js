/* ============================================================================
   SEZIONE 4: EMPORIO DEL MERCANTE (Classico, Cyberware, Sostanze, Veicoli, Armi)
   ============================================================================ */
function renderEmporio() {
  if (state.emporioTab === 'cyber') return renderEmporioCyber();
  if (state.emporioTab === 'droghe') return renderEmporioDroghe();
  if (state.emporioTab === 'veicoli') return renderEmporioVeicoli();
  if (state.emporioTab === 'armifuoco') return renderEmporioArmiFuoco();
  var wrap = document.createElement('div');

  var header = document.createElement('header');
  header.className = 'border-b';
  header.style.cssText = 'position:relative;overflow:visible;';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';

  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  top.innerHTML =
    '<div>' +
    '<div class="header-eyebrow mb-3"><span>Compendium Arcanum</span></div>' +
    '<h1 class="header-title">Il Mercante Errante</h1>' +
    '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Database delle armi, pozioni e oggetti magici</p>' +
    '</div>';

  var rightHead = document.createElement('div');
  rightHead.className = 'flex flex-wrap items-center gap-2';
  var btnSave = document.createElement('button');
  btnSave.className = 'btn-dark';
  btnSave.innerHTML = ICON.save + ' Salva su Chiavetta';
  btnSave.onclick = saveArmi;
  rightHead.appendChild(btnSave);
  var btnLoad = document.createElement('button');
  btnLoad.className = 'btn-dark';
  btnLoad.innerHTML = ICON.folder + ' Carica da Chiavetta';
  btnLoad.onclick = loadArmi;
  rightHead.appendChild(btnLoad);

  var btnShop = document.createElement('button');
  btnShop.className = 'btn-dark';
  btnShop.innerHTML = '🏪 Negozio';
  if (_shopOpen) btnShop.style.cssText = 'border-color:var(--gold);color:var(--gold);';
  btnShop.onclick = function () {
    _shopOpen = !_shopOpen;
    _coinsOpen = false;
    renderMain();
  };
  rightHead.appendChild(btnShop);

  var btnCoins = document.createElement('button');
  btnCoins.className = 'btn-dark';
  btnCoins.innerHTML = '💰 Monete';
  if (_coinsOpen) btnCoins.style.cssText = 'border-color:var(--gold);color:var(--gold);';
  btnCoins.onclick = function () {
    _coinsOpen = !_coinsOpen;
    _shopOpen = false;
    renderMain();
  };
  rightHead.appendChild(btnCoins);

  top.appendChild(rightHead);

  hc.appendChild(top);
  if (!state._emporioNoticeDismissed) {
    var notice = document.createElement('div');
    notice.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-top:0.75rem;background:rgba(201,165,92,0.08);border:1px solid rgba(201,165,92,0.25);border-radius:4px;padding:0.55rem 0.9rem;font-size:13px;font-style:italic;color:var(--text-muted);';
    var noticeSpan = document.createElement('span');
    noticeSpan.innerHTML =
      '☁ <strong style="color:var(--gold);font-style:normal;">Salvataggio automatico attivo</strong> — i dati vengono sincronizzati su Firebase ad ogni modifica. Usa <em>Salva su Chiavetta</em> per un backup locale.';
    notice.appendChild(noticeSpan);
    var noticeX = document.createElement('button');
    noticeX.style.cssText =
      'background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:18px;line-height:1;padding:0 0.2rem;flex-shrink:0;';
    noticeX.textContent = '×';
    noticeX.title = 'Chiudi';
    noticeX.onclick = function () {
      state._emporioNoticeDismissed = true;
      notice.remove();
    };
    notice.appendChild(noticeX);
    hc.appendChild(notice);
  }
  header.appendChild(hc);
  wrap.appendChild(header);

  if (_shopOpen || _coinsOpen) {
    var sidePanel = document.createElement('div');
    sidePanel.style.cssText =
      'max-width:720px;margin:1rem auto;padding:1.25rem 1.5rem;background:var(--bg-panel);border:1px solid var(--border-gold);border-radius:10px;box-sizing:border-box;';
    if (_shopOpen) _renderShopPanel(sidePanel);
    else _renderCoinsPanel(sidePanel);
    wrap.appendChild(sidePanel);
  }

  // --- TOGGLE BAR ---
  var cyberBar = document.createElement('div');
  cyberBar.style.cssText =
    'background:var(--bg-card);border-bottom:1px solid var(--border-subtle);';
  var cyberBarInner = document.createElement('div');
  cyberBarInner.className = 'container-main';
  cyberBarInner.style.cssText =
    'display:flex;align-items:center;flex-wrap:wrap;gap:0.5rem;padding-top:0.4rem;padding-bottom:0.4rem;';

  var tabNorm = document.createElement('button');
  tabNorm.type = 'button';
  tabNorm.style.cssText =
    "padding:0.5rem 1.1rem;font-family:'Cinzel',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;border:none;border-bottom:2px solid var(--border-gold);background:transparent;color:var(--gold);cursor:default;white-space:nowrap;";
  tabNorm.textContent = '⚔ Emporio';
  cyberBarInner.appendChild(tabNorm);

  var emporioTabs = [
    { id: 'veicoli', icon: '🚗', label: 'Veicoli', color: '#f5a623' },
    { id: 'droghe', icon: '💊', label: 'Droghe', color: '#7fff7f' },
    { id: 'cyber', icon: '🕷', label: 'Laboratorio Cibernetico', color: '#1af' },
    { id: 'armifuoco', icon: '🔫', label: 'Armi da Fuoco', color: '#e53030' },
  ];
  emporioTabs.forEach(function (t) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText =
      "display:flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;background:transparent;border:1px solid rgba(200,200,200,0.2);color:rgba(200,200,200,0.7);font-family:'Cinzel',serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;white-space:nowrap;";
    btn.innerHTML = t.icon + ' ' + t.label;
    btn.onmouseenter = function () {
      this.style.color = t.color;
      this.style.borderColor = t.color;
    };
    btn.onmouseleave = function () {
      this.style.color = 'rgba(200,200,200,0.7)';
      this.style.borderColor = 'rgba(200,200,200,0.2)';
    };
    btn.onclick = function () {
      state.emporioTab = t.id;
      renderMain();
    };
    cyberBarInner.appendChild(btn);
  });

  cyberBar.appendChild(cyberBarInner);
  wrap.appendChild(cyberBar);

  var section = document.createElement('section');
  section.className = 'container-main';
  section.style.cssText = 'padding-top:2rem;padding-bottom:1rem;';

  var pg = document.createElement('div');
  pg.className = 'panel-glass';
  var row = document.createElement('div');
  row.className = 'flex flex-wrap items-end gap-4';

  var sw = document.createElement('div');
  sw.style.cssText = 'flex:1 1 200px;min-width:180px;';
  sw.innerHTML = '<label class="field-label">Cerca per nome o descrizione</label>';
  var swInputWrap = document.createElement('div');
  swInputWrap.className = 'search-wrap';
  swInputWrap.innerHTML = ICON.search;
  var swInput = document.createElement('input');
  swInput.type = 'text';
  swInput.className = 'field';
  swInput.placeholder = 'es. spada, pozione, runico...';
  swInput.value = state.search;
  swInput.oninput = function () {
    state.search = this.value;
    updateResults();
  };
  swInputWrap.appendChild(swInput);
  sw.appendChild(swInputWrap);
  row.appendChild(sw);

  row.appendChild(
    makeSelectFilter(
      'Tipo',
      state.filtroTipo,
      [''].concat(TIPI),
      function (v) {
        state.filtroTipo = v;
        updateResults();
      },
      '— Tutti i tipi —'
    )
  );
  row.appendChild(
    makeSelectFilter(
      'Valuta',
      state.filtroValuta,
      [''].concat(
        VALUTE.map(function (v) {
          return v.code;
        })
      ),
      function (v) {
        state.filtroValuta = v;
        updateResults();
      },
      '— Tutte —',
      function (v) {
        var f = null;
        VALUTE.forEach(function (x) {
          if (x.code === v) f = x.label + ' (' + x.code + ')';
        });
        return f || v;
      }
    )
  );
  row.appendChild(
    makeSelectFilter(
      'Rarit\u00E0',
      state.filtroRarita,
      [''].concat(RARITA),
      function (v) {
        state.filtroRarita = v;
        updateResults();
      },
      '— Tutte le rarit\u00E0 —'
    )
  );

  /* Checkbox homebrew */
  var hbWrap = document.createElement('div');
  hbWrap.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding-bottom:0.2rem;';
  var hbChk = document.createElement('input');
  hbChk.type = 'checkbox';
  hbChk.id = 'emporio-homebrew-chk';
  hbChk.checked = !!state.emporioShowHomebrew;
  hbChk.style.cssText = 'width:15px;height:15px;cursor:pointer;accent-color:var(--gold);';
  hbChk.onchange = function () {
    state.emporioShowHomebrew = this.checked;
    updateResults();
  };
  var hbLbl = document.createElement('label');
  hbLbl.htmlFor = 'emporio-homebrew-chk';
  hbLbl.style.cssText =
    'font-family:Cinzel,serif;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--gold-dim);cursor:pointer;white-space:nowrap;user-select:none;';
  hbLbl.textContent = 'Mostra Homebrew';
  hbWrap.appendChild(hbChk);
  hbWrap.appendChild(hbLbl);
  row.appendChild(hbWrap);

  var addBtnW = document.createElement('div');
  var addBtn = document.createElement('button');
  addBtn.className = 'btn-gold';
  addBtn.innerHTML = ICON.plus + ' Nuova Arma';
  addBtn.onclick = function () {
    state.editingId = null;
    state.showForm = true;
    document.body.appendChild(renderWeaponForm());
  };
  addBtnW.appendChild(addBtn);
  if (isAdmin()) row.appendChild(addBtnW);

  pg.appendChild(row);

  var activeFilters = document.createElement('div');
  activeFilters.id = 'active-filters';
  pg.appendChild(activeFilters);
  renderActiveFilters(activeFilters);

  section.appendChild(pg);
  wrap.appendChild(section);

  var counterWrap = document.createElement('div');
  counterWrap.className = 'container-main pb-4';
  var counterEl = document.createElement('div');
  counterEl.id = 'results-counter';
  counterWrap.appendChild(counterEl);
  wrap.appendChild(counterWrap);

  var main = document.createElement('section');
  main.className = 'container-main pb-20';
  var grid = document.createElement('div');
  grid.id = 'weapons-grid';
  main.appendChild(grid);
  wrap.appendChild(main);

  var footer = document.createElement('footer');
  footer.className = 'border-t mt-8';
  footer.style.cssText = 'padding:1.75rem 0;';
  var fc = document.createElement('div');
  fc.className = 'container-main';
  fc.innerHTML =
    '<div class="filigree-divider mb-5"></div><div class="flex flex-wrap items-center justify-between gap-3"><div class="font-display tracking-widest font-semibold" style="font-size:11px;color:var(--gold-dim);">\u269C APP PORTABILE \u2014 FUNZIONA OFFLINE DA USB \u269C</div></div>';
  footer.appendChild(fc);
  wrap.appendChild(footer);

  setTimeout(function () {
    updateResults();
  }, 0);
  return wrap;
}

// ---- CYBERPUNK EMPORIO ----
