// ============================================================
var SCUOLE_MAGIA = [
  'Abiurazione',
  'Ammaliamento',
  'Divinazione',
  'Evocazione',
  'Illusione',
  'Invocazione',
  'Necromanzia',
  'Trasmutazione',
];

/* ============================================================================
   SEZIONE 10: GRIMORIO DEGLI INCANTESIMI (renderIncantesimiAggiuntivi)
   ============================================================================ */
function renderIncantesimiAggiuntivi() {
  var frag = document.createElement('div');

  // Search bar + filtri
  var pg = document.createElement('div');
  pg.className = 'panel-glass';
  pg.style.cssText = 'margin:1.5rem;';
  var row = document.createElement('div');
  row.className = 'flex flex-wrap items-end gap-4';
  var sw = document.createElement('div');
  sw.style.cssText = 'flex:1 1 200px;min-width:180px;';
  sw.innerHTML = '<label class="field-label">Cerca incantesimo</label>';
  var swW = document.createElement('div');
  swW.className = 'search-wrap';
  swW.innerHTML = ICON.search;
  var swI = document.createElement('input');
  swI.type = 'text';
  swI.className = 'field';
  swI.id = 'inc-search-input';
  swI.placeholder = 'nome, scuola, descrizione...';
  swI.value = state.incSearch || '';
  swI.oninput = function () {
    var pos = this.selectionStart;
    state.incSearch = this.value;
    renderMain();
    var ni = document.getElementById('inc-search-input');
    if (ni) {
      ni.focus();
      try {
        ni.setSelectionRange(pos, pos);
      } catch (e) {}
    }
  };
  swW.appendChild(swI);
  sw.appendChild(swW);
  row.appendChild(sw);

  // Filtro livello
  var lvlW = document.createElement('div');
  lvlW.style.cssText = 'min-width:130px;';
  lvlW.innerHTML = '<label class="field-label">Livello</label>';
  var lvlSel = document.createElement('select');
  lvlSel.className = 'field';
  var lvlOpts = [{ v: '', l: 'Tutti i livelli' }].concat(
    [{ v: '0', l: 'Trucchetto' }].concat(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) {
        return { v: String(n), l: 'Livello ' + n };
      })
    )
  );
  lvlOpts.forEach(function (o) {
    var op = document.createElement('option');
    op.value = o.v;
    op.textContent = o.l;
    if ((state.incFilterLivello || '') === o.v) op.selected = true;
    lvlSel.appendChild(op);
  });
  lvlSel.onchange = function () {
    state.incFilterLivello = this.value;
    renderMain();
  };
  lvlW.appendChild(lvlSel);
  row.appendChild(lvlW);

  // Filtro classe
  var clW = document.createElement('div');
  clW.style.cssText = 'min-width:150px;';
  clW.innerHTML = '<label class="field-label">Classe</label>';
  var clSel = document.createElement('select');
  clSel.className = 'field';
  var CLASSI_INC = [
    'Artificere',
    'Bardo',
    'Chierico',
    'Druido',
    'Mago',
    'Paladino',
    'Ranger',
    'Stregone',
    'Warlock',
  ];
  [{ v: '', l: 'Tutte le classi' }]
    .concat(
      CLASSI_INC.map(function (c) {
        return { v: c, l: c };
      })
    )
    .forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.v;
      op.textContent = o.l;
      if ((state.incFilterClasse || '') === o.v) op.selected = true;
      clSel.appendChild(op);
    });
  clSel.onchange = function () {
    state.incFilterClasse = this.value;
    renderMain();
  };
  clW.appendChild(clSel);
  row.appendChild(clW);

  if (isAdmin()) {
    var abW = document.createElement('div');
    var ab = document.createElement('button');
    ab.className = 'btn-gold';
    ab.innerHTML = ICON.plus + ' Nuovo Incantesimo';
    ab.onclick = function () {
      state.incEditingId = null;
      state.incShowForm = true;
      renderMain();
    };
    abW.appendChild(ab);
    row.appendChild(abW);
  }
  pg.appendChild(row);
  frag.appendChild(pg);

  // Filter & sort
  var all = (state.incantesimiAggiuntivi || []).slice().sort(function (a, b) {
    return (a.nome || '').localeCompare(b.nome || '', 'it');
  });
  var q = (state.incSearch || '').toLowerCase();
  var fLv = state.incFilterLivello || '';
  var fCl = state.incFilterClasse || '';
  var filtered = all.filter(function (s) {
    if (fLv !== '' && String(s.livello || 0) !== fLv) return false;
    if (fCl && !(s.classi || []).includes(fCl)) return false;
    if (
      q &&
      !(
        (s.nome || '').toLowerCase().includes(q) ||
        (s.scuola || '').toLowerCase().includes(q) ||
        (s.descrizione || '').toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  var counter = document.createElement('div');
  counter.className = 'container-main';
  counter.style.cssText =
    'padding-bottom:0.5rem;font-size:11px;color:var(--text-faint);letter-spacing:0.1em;';
  counter.textContent = filtered.length + ' incantesim' + (filtered.length === 1 ? 'o' : 'i');
  frag.appendChild(counter);

  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'empty-state panel-glass';
    empty.style.cssText = 'margin:1.5rem;';
    empty.innerHTML =
      '<div class="rune">✨</div><h2>Nessun incantesimo</h2><p>' +
      (isAdmin()
        ? 'Aggiungi il primo incantesimo.'
        : 'Nessun incantesimo aggiuntivo disponibile.') +
      '</p>';
    frag.appendChild(empty);
  } else {
    var grid = document.createElement('div');
    grid.className = 'container-main pb-20';
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1.25rem;padding-top:0.5rem;padding-bottom:4rem;';
    filtered.forEach(function (s) {
      grid.appendChild(renderIncantatesimoCard(s));
    });
    frag.appendChild(grid);
  }

  if (state.incShowForm) frag.appendChild(renderIncantesimoForm());
  return frag;
}

function _openIncantesimoDetail(s) {
  var old = document.getElementById('inc-detail-overlay');
  if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.id = 'inc-detail-overlay';
  overlay.className = 'sium-spell-modal-backdrop modal-backdrop';
  function _closeIncModal() {
    document.removeEventListener('keydown', _incEsc);
    if (window.SiumAnimations && window.SiumAnimations.closeModalAnimated) {
      window.SiumAnimations.closeModalAnimated(overlay);
    } else {
      overlay.remove();
    }
  }
  var _incEsc = function (e) {
    if (e.key === 'Escape') _closeIncModal();
  };
  document.addEventListener('keydown', _incEsc);
  overlay.onclick = function (e) {
    if (e.target === overlay) _closeIncModal();
  };
  var panel = document.createElement('div');
  panel.className = 'sium-spell-modal-panel';
  panel.onclick = function (e) {
    e.stopPropagation();
  };
  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText =
    'position:relative;z-index:2;padding:1.35rem 1.5rem 1rem;border-bottom:1px solid var(--border-gold);background:transparent;';
  var topRow = document.createElement('div');
  topRow.style.cssText =
    'display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;';
  var nameBlock = document.createElement('div');
  var lvlBadge = document.createElement('div');
  lvlBadge.style.cssText =
    'font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--spell-color, var(--gold));border:1px solid var(--spell-color, var(--border-gold));padding:0.15rem 0.55rem;display:inline-block;margin-bottom:0.5rem;';
  lvlBadge.textContent = s.livello == 0 ? '✦ Trucchetto' : '✦ Livello ' + s.livello;
  var orbsWrap = document.createElement('span');
  orbsWrap.className = 'sium-spell-level-orbs';
  var orbCount = Math.max(1, Math.min(9, Number(s.livello) || 1));
  for (var oi = 0; oi < orbCount; oi++) {
    var orb = document.createElement('span');
    orb.className = 'sium-spell-orb';
    orb.style.setProperty('--orb-i', String(oi));
    orbsWrap.appendChild(orb);
  }
  nameBlock.appendChild(lvlBadge);
  nameBlock.appendChild(orbsWrap);
  var nameEl = document.createElement('div');
  nameEl.style.cssText =
    "font-family:'Cinzel',serif;font-size:26px;font-weight:900;color:var(--text-primary);letter-spacing:0.04em;line-height:1.15;";
  nameEl.textContent = s.nome || '';
  nameBlock.appendChild(nameEl);
  if (s.scuola) {
    var scuolaEl = document.createElement('div');
    scuolaEl.style.cssText =
      'font-size:13px;color:var(--spell-color, var(--text-muted));font-style:italic;margin-top:0.25rem;';
    scuolaEl.textContent = 'Scuola di ' + s.scuola;
    nameBlock.appendChild(scuolaEl);
  }
  topRow.appendChild(nameBlock);
  var closeBtn = document.createElement('button');
  closeBtn.className = 'btn-dark';
  closeBtn.style.cssText = 'padding:0.35rem 0.75rem;font-size:18px;flex-shrink:0;line-height:1;';
  closeBtn.textContent = '✕';
  closeBtn.onclick = function () {
    _closeIncModal();
  };
  topRow.appendChild(closeBtn);
  hdr.appendChild(topRow);
  var tagRow = document.createElement('div');
  tagRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.75rem;';
  if (s.concentrazione) {
    var tc = document.createElement('span');
    tc.style.cssText =
      'font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8bc4ff;border:1px solid rgba(139,196,255,0.4);padding:0.15rem 0.5rem;';
    tc.textContent = 'CONCENTRAZIONE';
    tagRow.appendChild(tc);
  }
  if (s.rituale) {
    var tr2 = document.createElement('span');
    tr2.style.cssText =
      'font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#c8a8ff;border:1px solid rgba(200,168,255,0.4);padding:0.15rem 0.5rem;';
    tr2.textContent = 'RITUALE';
    tagRow.appendChild(tr2);
  }
  if (s.classi && s.classi.length) {
    s.classi.forEach(function (c) {
      var tb = document.createElement('span');
      tb.style.cssText =
        'font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);border:1px solid var(--border-subtle);padding:0.1rem 0.45rem;';
      tb.textContent = c;
      tagRow.appendChild(tb);
    });
  }
  if (tagRow.children.length) hdr.appendChild(tagRow);
  panel.appendChild(hdr);
  // Body
  var body2 = document.createElement('div');
  body2.style.cssText = 'padding:1.25rem 1.5rem;';
  var statGrid = document.createElement('div');
  statGrid.style.cssText =
    'display:grid;grid-template-columns:1fr 1fr;gap:0.6rem 2rem;margin-bottom:1.25rem;';
  function statCell(lbl, val) {
    if (!val) return;
    var d = document.createElement('div');
    var l = document.createElement('div');
    l.style.cssText =
      'font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.15rem;';
    l.textContent = lbl;
    var v = document.createElement('div');
    v.style.cssText = 'font-size:14px;color:var(--text-primary);';
    v.textContent = String(val);
    d.appendChild(l);
    d.appendChild(v);
    statGrid.appendChild(d);
  }
  statCell('Gittata', s.gittata);
  statCell('Tempo di Lancio', s.tempoDiLancio);
  statCell('Durata', s.durata);
  if (s.componenti && s.componenti.length) statCell('Componenti', s.componenti.join(', '));
  if (s.valMateria) {
    var matD = document.createElement('div');
    matD.style.cssText = 'grid-column:1/-1;';
    var ml = document.createElement('div');
    ml.style.cssText =
      'font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.15rem;';
    ml.textContent = 'Materiali';
    var mv = document.createElement('div');
    mv.style.cssText = 'font-size:14px;color:var(--text-primary);font-style:italic;';
    mv.textContent = s.valMateria + (s.consumaMateria ? ' (consumato)' : '');
    matD.appendChild(ml);
    matD.appendChild(mv);
    statGrid.appendChild(matD);
  }
  if (statGrid.children.length) body2.appendChild(statGrid);
  if (s.descrizione) {
    var sep1 = document.createElement('div');
    sep1.style.cssText = 'border-top:1px solid var(--border-subtle);margin:0 0 1rem;';
    body2.appendChild(sep1);
    var effLbl = document.createElement('div');
    effLbl.style.cssText =
      'font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:0.5rem;';
    effLbl.textContent = 'Effetto';
    body2.appendChild(effLbl);
    var effTxt = document.createElement('div');
    effTxt.style.cssText =
      'font-size:15px;color:var(--text-secondary);line-height:1.8;white-space:pre-wrap;';
    effTxt.textContent = s.descrizione;
    body2.appendChild(effTxt);
  }
  if (s.altiLivelli) {
    var sep2 = document.createElement('div');
    sep2.style.cssText = 'border-top:1px solid var(--border-subtle);margin:1rem 0;';
    body2.appendChild(sep2);
    var alLbl2 = document.createElement('div');
    alLbl2.style.cssText =
      'font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:0.5rem;';
    alLbl2.textContent = 'Ai Livelli Superiori';
    body2.appendChild(alLbl2);
    var alTxt2 = document.createElement('div');
    alTxt2.style.cssText =
      'font-size:15px;color:var(--text-secondary);line-height:1.8;white-space:pre-wrap;';
    alTxt2.textContent = s.altiLivelli;
    body2.appendChild(alTxt2);
  }
  body2.style.position = 'relative';
  body2.style.zIndex = '2';
  panel.appendChild(body2);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  if (window.SiumAnimations && window.SiumAnimations.enhanceSpellModal) {
    window.SiumAnimations.enhanceSpellModal(overlay, panel, s);
  }
}

function renderIncantatesimoCard(s) {
  var spTheme =
    window.SiumAnimations && window.SiumAnimations.getSpellSchoolTheme
      ? window.SiumAnimations.getSpellSchoolTheme(s.scuola)
      : { color: '#d8b25c', glow: 'rgba(216,178,92,0.28)', icon: '✨' };
  var card = document.createElement('div');
  card.className = 'panel-glass sium-spell-card sium-grid-card-enter';
  card.style.cssText = 'padding:0;overflow:hidden;';
  card.style.setProperty('--spell-color', spTheme.color);
  card.style.setProperty('--spell-glow', spTheme.glow);
  function _handleSpellCardClick() {
    if (window.SiumAnimations && window.SiumAnimations.triggerCardClickPulse) {
      window.SiumAnimations.triggerCardClickPulse(card, spTheme.color);
    }
    _openIncantesimoDetail(s);
  }

  // Head
  var head = document.createElement('div');
  head.style.cssText =
    'padding:1rem 1.2rem 0.7rem;border-bottom:1px solid var(--border-subtle);cursor:pointer;';
  head.title = 'Clicca per consultare il Grimorio';
  head.onclick = _handleSpellCardClick;
  // Level badge + name
  var topRow = document.createElement('div');
  topRow.style.cssText =
    'display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;';
  var nameCol = document.createElement('div');
  var lvlBadge = document.createElement('span');
  lvlBadge.style.cssText =
    'font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);border:1px solid var(--border-gold);padding:0.15rem 0.5rem;display:inline-block;margin-bottom:0.4rem;';
  lvlBadge.textContent = s.livello == 0 ? 'Trucchetto' : 'Livello ' + s.livello;
  nameCol.appendChild(lvlBadge);
  var nameDiv = document.createElement('div');
  nameDiv.style.cssText =
    "font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:var(--text-primary);line-height:1.2;";
  nameDiv.textContent = s.nome || 'Senza nome';
  nameCol.appendChild(nameDiv);
  topRow.appendChild(nameCol);
  // Tags right
  var tagsCol = document.createElement('div');
  tagsCol.style.cssText =
    'display:flex;flex-direction:column;align-items:flex-end;gap:0.3rem;flex-shrink:0;';
  if (s.concentrazione) {
    var tc = document.createElement('span');
    tc.style.cssText =
      'font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8bc4ff;border:1px solid rgba(139,196,255,0.4);padding:0.15rem 0.45rem;white-space:nowrap;';
    tc.textContent = 'CONC.';
    tagsCol.appendChild(tc);
  }
  if (s.rituale) {
    var tr = document.createElement('span');
    tr.style.cssText =
      'font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#c8a8ff;border:1px solid rgba(200,168,255,0.4);padding:0.15rem 0.45rem;white-space:nowrap;';
    tr.textContent = 'RITUALE';
    tagsCol.appendChild(tr);
  }
  topRow.appendChild(tagsCol);
  head.appendChild(topRow);
  // Scuola + componenti
  var subRow = document.createElement('div');
  subRow.style.cssText =
    'display:flex;align-items:center;gap:0.75rem;margin-top:0.4rem;flex-wrap:wrap;';
  if (s.scuola) {
    var sc = document.createElement('span');
    sc.style.cssText = 'font-size:12px;color:var(--text-muted);font-style:italic;';
    sc.textContent = s.scuola;
    subRow.appendChild(sc);
  }
  if (s.componenti && s.componenti.length) {
    var cp = document.createElement('span');
    cp.style.cssText = 'font-size:12px;font-weight:700;color:var(--gold-dim);letter-spacing:0.1em;';
    cp.textContent = s.componenti.join(', ');
    subRow.appendChild(cp);
  }
  if (subRow.children.length) head.appendChild(subRow);
  if (s.classi && s.classi.length) {
    var clRow = document.createElement('div');
    clRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.45rem;';
    s.classi.forEach(function (c) {
      var badge = document.createElement('span');
      badge.style.cssText =
        'font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);border:1px solid var(--border-subtle);padding:0.1rem 0.4rem;';
      badge.textContent = c;
      clRow.appendChild(badge);
    });
    head.appendChild(clRow);
  }
  card.appendChild(head);

  // Body
  var body = document.createElement('div');
  body.style.cssText = 'padding:0.8rem 1.2rem;cursor:pointer;';
  body.onclick = _handleSpellCardClick;
  function statLine(lbl, val) {
    if (!val) return;
    var d = document.createElement('div');
    d.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.3rem;align-items:baseline;';
    d.innerHTML =
      '<span style="font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);white-space:nowrap;min-width:110px;">' +
      lbl +
      '</span><span style="font-size:14px;color:var(--text-primary);">' +
      escapeHtml(String(val)) +
      '</span>';
    body.appendChild(d);
  }
  statLine('Gittata', s.gittata);
  statLine('Tempo di lancio', s.tempoDiLancio);
  statLine('Durata', s.durata);
  if (s.valMateria) statLine('Materiali', s.valMateria + (s.consumaMateria ? ' (consumato)' : ''));
  card.appendChild(body);

  // Footer Admin actions
  if (isAdmin()) {
    var foot = document.createElement('div');
    foot.style.cssText =
      'padding:0.5rem 1.2rem;border-top:1px solid var(--border-subtle);background:var(--bg-base);display:flex;justify-content:flex-end;gap:0.4rem;';
    var editB = document.createElement('button');
    editB.className = 'btn-dark';
    editB.style.cssText = 'padding:0.3rem 0.7rem;font-size:12px;';
    editB.innerHTML = ICON.edit || '✎';
    editB.textContent = '✎ Modifica';
    editB.onclick = function () {
      state.incEditingId = s.id;
      state.incShowForm = true;
      renderMain();
    };
    var delB = document.createElement('button');
    delB.className = 'btn-blood';
    delB.style.cssText = 'padding:0.3rem 0.7rem;font-size:12px;';
    delB.innerHTML = ICON.trash || '✕';
    delB.textContent = '✕';
    delB.onclick = function () {
      if (confirm('Eliminare "' + (s.nome || 'questo incantesimo') + '"?')) {
        state.incantesimiAggiuntivi = state.incantesimiAggiuntivi.filter(function (x) {
          return x.id !== s.id;
        });
        fbSaveIncantesimiAggiuntivi();
        renderMain();
      }
    };
    foot.appendChild(editB);
    foot.appendChild(delB);
    card.appendChild(foot);
  }
  return card;
}

function renderIncantesimoForm() {
  var editing = null;
  if (state.incEditingId)
    (state.incantesimiAggiuntivi || []).forEach(function (x) {
      if (x.id === state.incEditingId) editing = x;
    });
  var CLASSI_INC_FORM = [
    'Artificere',
    'Bardo',
    'Chierico',
    'Druido',
    'Mago',
    'Paladino',
    'Ranger',
    'Stregone',
    'Warlock',
  ];
  var form = {
    nome: editing ? editing.nome : '',
    livello: editing != null ? editing.livello : 0,
    scuola: editing ? editing.scuola : '',
    gittata: editing ? editing.gittata : '',
    tempoDiLancio: editing ? editing.tempoDiLancio : '',
    durata: editing ? editing.durata : '',
    valMateria: editing ? editing.valMateria : '',
    rituale: editing ? !!editing.rituale : false,
    concentrazione: editing ? !!editing.concentrazione : false,
    componenti: editing ? editing.componenti || [] : [],
    consumaMateria: editing ? !!editing.consumaMateria : false,
    classi: editing ? editing.classi || [] : [],
    descrizione: editing ? editing.descrizione : '',
    altiLivelli: editing ? editing.altiLivelli : '',
  };

  var backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick = function (e) {
    if (e.target === backdrop) {
      state.incShowForm = false;
      state.incEditingId = null;
      renderMain();
    }
  };

  var panel = document.createElement('div');
  panel.style.cssText =
    'background:var(--bg-card);border:1px solid var(--border-gold);max-width:560px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick = function (e) {
    e.stopPropagation();
  };

  var mhead = document.createElement('div');
  mhead.style.cssText =
    'padding:1rem 1.5rem;border-bottom:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;';
  var htitle = document.createElement('div');
  htitle.style.cssText =
    "font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--gold);";
  htitle.textContent = editing ? '✎ Modifica Incantesimo' : '+ Nuovo Incantesimo';
  var closeB = document.createElement('button');
  closeB.className = 'btn-dark';
  closeB.style.cssText = 'padding:0.25rem 0.6rem;';
  closeB.textContent = '✕';
  closeB.onclick = function () {
    state.incShowForm = false;
    state.incEditingId = null;
    renderMain();
  };
  mhead.appendChild(htitle);
  mhead.appendChild(closeB);
  panel.appendChild(mhead);

  var mbody = document.createElement('div');
  mbody.style.cssText = 'padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';

  function iField(lbl, key, type, opts) {
    var g = document.createElement('div');
    var l = document.createElement('label');
    l.className = 'field-label';
    l.textContent = lbl;
    g.appendChild(l);
    var el;
    if (type === 'select') {
      el = document.createElement('select');
      el.className = 'field';
      (opts || []).forEach(function (o) {
        var op = document.createElement('option');
        op.value = o;
        op.textContent = o;
        if (String(form[key]) === String(o)) op.selected = true;
        el.appendChild(op);
      });
    } else if (type === 'textarea') {
      el = document.createElement('textarea');
      el.className = 'field';
      el.rows = 3;
      el.value = form[key];
      el.style.resize = 'vertical';
    } else {
      el = document.createElement('input');
      el.type = type || 'text';
      el.className = 'field';
      el.value = form[key];
    }
    if (type !== 'checkbox')
      el.onchange = el.oninput = function () {
        form[key] = type === 'number' ? Number(this.value) || 0 : this.value;
      };
    g.appendChild(el);
    return g;
  }

  mbody.appendChild(iField('Nome', 'nome', 'text'));

  var r1 = document.createElement('div');
  r1.style.cssText = 'display:grid;grid-template-columns:1fr 2fr;gap:0.75rem;';
  // Livello select
  var lvlG = document.createElement('div');
  var lvlL = document.createElement('label');
  lvlL.className = 'field-label';
  lvlL.textContent = 'Livello';
  lvlG.appendChild(lvlL);
  var lvlS = document.createElement('select');
  lvlS.className = 'field';
  for (var i = 0; i <= 9; i++) {
    var op = document.createElement('option');
    op.value = i;
    op.textContent = i === 0 ? '0 — Trucchetto' : String(i);
    if (form.livello === i) op.selected = true;
    lvlS.appendChild(op);
  }
  lvlS.onchange = function () {
    form.livello = Number(this.value);
  };
  lvlG.appendChild(lvlS);
  r1.appendChild(lvlG);
  r1.appendChild(iField('Scuola di Magia', 'scuola', 'text'));
  mbody.appendChild(r1);

  var r2 = document.createElement('div');
  r2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;';
  r2.appendChild(iField('Gittata', 'gittata', 'text'));
  r2.appendChild(iField('Tempo di Lancio', 'tempoDiLancio', 'text'));
  r2.appendChild(iField('Durata', 'durata', 'text'));
  mbody.appendChild(r2);

  // Componenti checkboxes
  var compG = document.createElement('div');
  var compL = document.createElement('label');
  compL.className = 'field-label';
  compL.textContent = 'Componenti';
  compG.appendChild(compL);
  var compRow = document.createElement('div');
  compRow.style.cssText = 'display:flex;gap:1.25rem;align-items:center;';
  ['V', 'S', 'M'].forEach(function (c) {
    var cWrap = document.createElement('label');
    cWrap.style.cssText =
      'display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:14px;color:var(--text-primary);font-weight:700;';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = c;
    cb.checked = (form.componenti || []).indexOf(c) >= 0;
    cb.onchange = function () {
      if (this.checked) {
        if (form.componenti.indexOf(c) < 0) form.componenti.push(c);
      } else {
        form.componenti = form.componenti.filter(function (x) {
          return x !== c;
        });
      }
    };
    cWrap.appendChild(cb);
    cWrap.appendChild(document.createTextNode(c));
    compRow.appendChild(cWrap);
  });
  compG.appendChild(compRow);
  mbody.appendChild(compG);

  mbody.appendChild(iField('Valore Materiali (es. 100 mo di diamante)', 'valMateria', 'text'));

  // Bool flags
  var boolRow = document.createElement('div');
  boolRow.style.cssText = 'display:flex;gap:1.5rem;flex-wrap:wrap;';
  [
    { key: 'rituale', lbl: 'Rituale' },
    { key: 'concentrazione', lbl: 'Concentrazione' },
    { key: 'consumaMateria', lbl: 'Consuma Materiali' },
  ].forEach(function (b) {
    var bWrap = document.createElement('label');
    bWrap.style.cssText =
      'display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:14px;color:var(--text-primary);';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!form[b.key];
    cb.onchange = function () {
      form[b.key] = this.checked;
    };
    bWrap.appendChild(cb);
    bWrap.appendChild(document.createTextNode(b.lbl));
    boolRow.appendChild(bWrap);
  });
  mbody.appendChild(boolRow);

  // Classi che possono usare l'incantesimo
  var classiG = document.createElement('div');
  var classiL = document.createElement('label');
  classiL.className = 'field-label';
  classiL.textContent = 'Classi che possono usarlo';
  classiG.appendChild(classiL);
  var classiGrid = document.createElement('div');
  classiGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem 1rem;';
  CLASSI_INC_FORM.forEach(function (c) {
    var cWrap = document.createElement('label');
    cWrap.style.cssText =
      'display:flex;align-items:center;gap:0.35rem;cursor:pointer;font-size:13px;color:var(--text-primary);';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = (form.classi || []).indexOf(c) >= 0;
    cb.onchange = function () {
      if (this.checked) {
        if (form.classi.indexOf(c) < 0) form.classi.push(c);
      } else {
        form.classi = form.classi.filter(function (x) {
          return x !== c;
        });
      }
    };
    cWrap.appendChild(cb);
    cWrap.appendChild(document.createTextNode(c));
    classiGrid.appendChild(cWrap);
  });
  classiG.appendChild(classiGrid);
  mbody.appendChild(classiG);

  mbody.appendChild(iField('Descrizione', 'descrizione', 'textarea'));
  mbody.appendChild(iField('A livelli superiori', 'altiLivelli', 'textarea'));

  var saveBtn = document.createElement('button');
  saveBtn.className = 'btn-gold';
  saveBtn.style.cssText = 'width:100%;margin-top:0.5rem;';
  saveBtn.textContent = editing ? 'Salva Modifiche' : 'Aggiungi Incantesimo';
  saveBtn.onclick = function () {
    if (!form.nome.trim()) {
      notify("Inserisci il nome dell'incantesimo.", 'err');
      return;
    }
    if (editing) {
      state.incantesimiAggiuntivi = state.incantesimiAggiuntivi.map(function (x) {
        return x.id === editing.id ? Object.assign({}, form, { id: editing.id }) : x;
      });
    } else {
      if (!state.incantesimiAggiuntivi) state.incantesimiAggiuntivi = [];
      state.incantesimiAggiuntivi.push(Object.assign({}, form, { id: 'inc_' + Date.now() }));
    }
    fbSaveIncantesimiAggiuntivi();
    notify(editing ? 'Incantesimo aggiornato.' : 'Incantesimo aggiunto.');
    state.incShowForm = false;
    state.incEditingId = null;
    renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}
