/* ============================================================================
   SEZIONE 8: BESTIARIO INTERATTIVO & PET DEL PARTY (renderBestiario)
   ============================================================================ */
function renderBestiario() {
  var wrap = document.createElement('div');
  if (state.bestShowForm) {
    wrap.appendChild(renderBestiarForm());
  }
  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';
  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  top.innerHTML =
    '<div><div class="header-eyebrow mb-3"><span>Cronache dei Mostri</span></div><h1 class="header-title">Bestiario Custom</h1><p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Database dei mostri del tuo mondo</p></div>';
  var rh = document.createElement('div');
  rh.className = 'flex flex-wrap items-center gap-2';
  var bSave = document.createElement('button');
  bSave.className = 'btn-gold';
  bSave.innerHTML = ICON.save + ' Salva su Chiavetta';
  bSave.onclick = saveBestiario;
  rh.appendChild(bSave);
  var bLoad = document.createElement('button');
  bLoad.className = 'btn-dark';
  bLoad.innerHTML = ICON.folder + ' Carica da Chiavetta';
  bLoad.onclick = loadBestiarioFile;
  rh.appendChild(bLoad);
  top.appendChild(rh);
  hc.appendChild(top);
  var fd = document.createElement('div');
  fd.className = 'filigree-divider mt-7';
  hc.appendChild(fd);
  var notice = document.createElement('div');
  notice.className = 'notice mt-5';
  notice.innerHTML =
    '<strong style="color:var(--gold);font-style:normal;">🐉 Bestiario Locale: </strong>i dati sono sincronizzati via Firebase. Usa <em>"Salva su Chiavetta"</em> per un backup JSON e <em>"Carica da Chiavetta"</em> per ripristinarlo.';
  hc.appendChild(notice);
  header.appendChild(hc);
  wrap.appendChild(header);

  /* ===== TAB BAR ===== */
  /* Giocatori vedono solo la tab "pet" */
  if (!isDM()) state.bestTab = 'pet';
  var tabBar = document.createElement('div');
  tabBar.style.cssText = 'background:var(--bg-card);border-bottom:1px solid var(--border-subtle);';
  var tabInner = document.createElement('div');
  tabInner.className = 'container-main';
  tabInner.style.cssText = 'display:flex;gap:0;padding-top:0;padding-bottom:0;';
  var myPetCount = isDM()
    ? state.pet.length
    : state.pet.filter(function (p) {
        return (
          state.currentUser &&
          (p.proprietario || '').toLowerCase() === state.currentUser.username.toLowerCase()
        );
      }).length;
  var tabDefs = isDM()
    ? [
        { id: 'bestiario', label: '⚔ Bestiario', count: state.bestiario.length },
        { id: 'pet', label: '🐾 Pet del Party', count: state.pet.length },
      ]
    : [{ id: 'pet', label: '🐾 I miei Pet', count: myPetCount }];
  tabDefs.forEach(function (t) {
    var tb = document.createElement('button');
    tb.type = 'button';
    var isActive = state.bestTab === t.id;
    tb.style.cssText =
      "padding:0.7rem 1.25rem;font-family:'Cinzel',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;border:none;border-bottom:2px solid " +
      (isActive ? 'var(--border-gold)' : 'transparent') +
      ';background:transparent;color:' +
      (isActive ? 'var(--gold)' : 'var(--text-muted)') +
      ';cursor:pointer;white-space:nowrap;';
    tb.innerHTML =
      t.label +
      ' <span style="background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:8px;padding:0.05rem 0.4rem;font-size:9px;margin-left:0.3rem;color:var(--text-faint);">' +
      t.count +
      '</span>';
    if (!isActive)
      tb.onclick = function () {
        state.bestTab = t.id;
        renderMain();
      };
    tabInner.appendChild(tb);
  });
  tabBar.appendChild(tabInner);
  wrap.appendChild(tabBar);

  /* ===== TAB BESTIARIO ===== */
  if (state.bestTab === 'bestiario') {
    var sec = document.createElement('section');
    sec.className = 'container-main';
    sec.style.cssText = 'padding-top:2rem;padding-bottom:1rem;';
    var pg = document.createElement('div');
    pg.className = 'panel-glass';
    var row = document.createElement('div');
    row.className = 'flex flex-wrap items-end gap-4';
    var sw = document.createElement('div');
    sw.style.cssText = 'flex:1 1 200px;min-width:180px;';
    sw.innerHTML = '<label class="field-label">Cerca nel bestiario</label>';
    var swW = document.createElement('div');
    swW.className = 'search-wrap';
    swW.innerHTML = ICON.search;
    var swI = document.createElement('input');
    swI.type = 'text';
    swI.className = 'field';
    swI.placeholder = 'es. goblin, draconico, non-morto…';
    swI.value = state.bestSearch || '';
    bindCatalogSearch(swI, 'bestSearch', updateBestiarioGrid);
    swW.appendChild(swI);
    sw.appendChild(swW);
    row.appendChild(sw);
    row.appendChild(
      makeSelectFilter(
        'Taglia',
        state.bestFiltroTaglia,
        [''].concat(TAGLIE_MOSTRO),
        function (v) {
          state.bestFiltroTaglia = v;
          updateBestiarioGrid();
        },
        '— Tutte le taglie —'
      )
    );
    row.appendChild(
      makeSelectFilter(
        'Tipo Creatura',
        state.bestFiltroTipo,
        [''].concat(TIPI_MOSTRO),
        function (v) {
          state.bestFiltroTipo = v;
          updateBestiarioGrid();
        },
        '— Tutti i tipi —'
      )
    );
    (function () {
      var gsVals = [
        '',
        '0',
        '1/8',
        '1/4',
        '1/2',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '15',
        '16',
        '17',
        '18',
        '19',
        '20',
        '21',
        '22',
        '23',
        '24',
        '30',
      ];
      row.appendChild(
        makeSelectFilter(
          'Grado Sfida',
          state.bestFiltroGS,
          gsVals,
          function (v) {
            state.bestFiltroGS = v;
            updateBestiarioGrid();
          },
          '— Tutti i GS —'
        )
      );
    })();
    if (isDM()) {
      var abW = document.createElement('div');
      var ab = document.createElement('button');
      ab.className = 'btn-gold';
      ab.innerHTML = ICON.plus + ' Nuovo Mostro';
      ab.onclick = function () {
        state.bestEditingId = null;
        state.bestShowForm = true;
        render();
      };
      abW.appendChild(ab);
      row.appendChild(abW);
    }
    pg.appendChild(row);
    sec.appendChild(pg);
    wrap.appendChild(sec);
    var cW = document.createElement('div');
    cW.className = 'container-main pb-4';
    var cE = document.createElement('div');
    cE.id = 'best-counter';
    cW.appendChild(cE);
    wrap.appendChild(cW);
    var main = document.createElement('section');
    main.className = 'container-main pb-20';
    var grid = document.createElement('div');
    grid.id = 'bestiario-grid';
    main.appendChild(grid);
    wrap.appendChild(main);
    setTimeout(function () {
      updateBestiarioGrid();
    }, 0);

    /* ===== TAB PET ===== */
  } else {
    var secP = document.createElement('section');
    secP.className = 'container-main';
    secP.style.cssText = 'padding-top:2rem;padding-bottom:1rem;';
    var pgP = document.createElement('div');
    pgP.className = 'panel-glass';
    var rowP = document.createElement('div');
    rowP.className = 'flex flex-wrap items-end gap-4';
    var swP = document.createElement('div');
    swP.style.cssText = 'flex:1 1 200px;min-width:180px;';
    swP.innerHTML = '<label class="field-label">Cerca tra i pet</label>';
    var swWP = document.createElement('div');
    swWP.className = 'search-wrap';
    swWP.innerHTML = ICON.search;
    var swIP = document.createElement('input');
    swIP.type = 'text';
    swIP.className = 'field';
    swIP.placeholder = 'nome, tipo, proprietario…';
    swIP.value = state.petSearch || '';
    bindCatalogSearch(swIP, 'petSearch', updatePetGrid);
    swWP.appendChild(swIP);
    swP.appendChild(swWP);
    rowP.appendChild(swP);
    if (isDM()) {
      var adoptW = document.createElement('div');
      var adoptBtn = document.createElement('button');
      adoptBtn.className = 'btn-gold';
      adoptBtn.innerHTML = '🐾 Adotta dal Bestiario';
      adoptBtn.onclick = adottaDalBestiario;
      adoptW.appendChild(adoptBtn);
      rowP.appendChild(adoptW);
    }
    pgP.appendChild(rowP);
    secP.appendChild(pgP);
    wrap.appendChild(secP);
    var cWP = document.createElement('div');
    cWP.className = 'container-main pb-4';
    var cEP = document.createElement('div');
    cEP.id = 'pet-counter';
    cWP.appendChild(cEP);
    wrap.appendChild(cWP);
    var mainP = document.createElement('section');
    mainP.className = 'container-main pb-20';
    var gridP = document.createElement('div');
    gridP.id = 'pet-grid';
    mainP.appendChild(gridP);
    wrap.appendChild(mainP);
    setTimeout(function () {
      updatePetGrid();
    }, 0);
  }

  var footer = document.createElement('footer');
  footer.className = 'border-t mt-8';
  footer.style.cssText = 'padding:1.75rem 0;';
  var fc = document.createElement('div');
  fc.className = 'container-main';
  fc.innerHTML =
    '<div class="filigree-divider mb-5"></div><div class="flex flex-wrap items-center justify-between gap-3"><div class="font-display tracking-widest font-semibold" style="font-size:11px;color:var(--gold-dim);">⚜ BESTIARIO SINCRONIZZATO VIA FIREBASE ⚜</div></div>';
  footer.appendChild(fc);
  wrap.appendChild(footer);
  return wrap;
}

// ============================================================
// INCANTESIMI AGGIUNTIVI
