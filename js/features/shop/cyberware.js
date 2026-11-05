function renderEmporioCyber() {
  var wrap = document.createElement('div');
  wrap.className = 'cyber-wrap';

  // Header
  var hdr = document.createElement('div');
  hdr.className = 'cyber-header';
  var hdrRow = document.createElement('div');
  hdrRow.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;';

  var hdrLeft = document.createElement('div');
  hdrLeft.innerHTML =
    '<div class="cyber-subtitle">// EMPORIO — LABORATORIO CIBERNETICO //</div>' +
    '<div class="cyber-title">&#9658; IMPIANTI_CIB</div>';

  var hdrRight = document.createElement('div');
  hdrRight.style.cssText = 'display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;';

  var addBtn = document.createElement('button');
  addBtn.className = 'cyber-add-btn';
  addBtn.textContent = '+ NUOVO IMPIANTO';
  addBtn.onclick = function () {
    state.cyberShowForm = true;
    state.cyberEditingId = null;
    renderMain();
  };
  if (isDM()) hdrRight.appendChild(addBtn);

  var backBtn = document.createElement('button');
  backBtn.className = 'cyber-back-btn';
  backBtn.innerHTML = '← TORNA EMPORIO';
  backBtn.onclick = function () {
    state.emporioTab = 'normale';
    renderMain();
  };
  hdrRight.appendChild(backBtn);

  hdrRow.appendChild(hdrLeft);
  hdrRow.appendChild(hdrRight);
  hdr.appendChild(hdrRow);

  // Search + filtri
  var searchWrap = document.createElement('div');
  searchWrap.style.cssText =
    'padding:0 2rem 1rem;position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;';

  var srch = document.createElement('input');
  srch.type = 'text';
  srch.id = 'srch-cyber';
  srch.className = 'cyber-search-bar';
  srch.style.cssText = 'flex:1;min-width:200px;';
  srch.placeholder = '> RICERCA_IMPIANTI :: digita per filtrare...';
  srch.value = state.cyberSearch || '';
  bindCatalogSearch(srch, 'cyberSearch');
  searchWrap.appendChild(srch);

  var selStyle =
    "background:#050518;border:1px solid rgba(0,245,255,0.35);color:#00f5ff;font-family:'Cinzel',serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:0.55rem 0.75rem;cursor:pointer;outline:none;min-width:150px;";

  var selTipo = document.createElement('select');
  selTipo.style.cssText = selStyle;
  [{ v: '', l: '— TUTTI I TIPI —' }]
    .concat(
      TIPI_CYBER.map(function (t) {
        return { v: t, l: t.toUpperCase() };
      })
    )
    .forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.v;
      opt.textContent = o.l;
      if ((state.cyberFilterTipo || '') === o.v) opt.selected = true;
      selTipo.appendChild(opt);
    });
  selTipo.onchange = function () {
    state.cyberFilterTipo = this.value;
    renderMain();
  };
  searchWrap.appendChild(selTipo);

  var selRar = document.createElement('select');
  selRar.style.cssText = selStyle;
  [{ v: '', l: '— TUTTE LE RARITÀ —' }]
    .concat(
      RARITA_CYBER.map(function (r) {
        return { v: r, l: r.toUpperCase() };
      })
    )
    .forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.v;
      opt.textContent = o.l;
      if ((state.cyberFilterRarita || '') === o.v) opt.selected = true;
      selRar.appendChild(opt);
    });
  selRar.onchange = function () {
    state.cyberFilterRarita = this.value;
    renderMain();
  };
  searchWrap.appendChild(selRar);

  hdr.appendChild(searchWrap);

  // Regole di installazione
  var rulesBox = document.createElement('div');
  rulesBox.style.cssText =
    'margin:0 2rem 1.2rem;padding:1rem 1.25rem;background:rgba(255,180,0,0.07);border:2px solid rgba(255,180,0,0.5);position:relative;z-index:1;';
  rulesBox.innerHTML =
    '<div style="font-size:14px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#ffb800;margin-bottom:0.6rem;">⚠ PROTOCOLLO DI INSTALLAZIONE</div>' +
    '<ul style="margin:0;padding-left:1.4rem;list-style:disc;">' +
    '<li style="font-size:15px;color:#ffe08a;line-height:1.6;margin-bottom:0.5rem;">Per accedere ad un potenziamento di <strong>tipo 2</strong> bisogna prima avere quello di <strong>tipo 1</strong>.</li>' +
    '<li style="font-size:15px;color:#ffe08a;line-height:1.6;margin-bottom:0.5rem;">Quando si fa un potenziamento di tipo 2, tutti i vantaggi del tipo 1 <strong>vanno persi</strong>. Lo stesso vale per i potenziamenti di tipo 3 e tipo 4.</li>' +
    '<li style="font-size:15px;color:#ffe08a;line-height:1.6;margin-bottom:0.5rem;">Il pagamento si divide in <strong>due metà</strong>: la prima metà prima dell\'installazione, la seconda al termine. In caso di installazione fallita la seconda metà <strong>non viene addebitata</strong>, ma la prima è trattenuta.</li>' +
    '<li style="font-size:15px;color:#ffe08a;line-height:1.6;">Chi installa effettua un <strong>tiro su Medicina</strong>: CD 5 (Semplice) · CD 10 (Chirurgica) · CD 15 (Specializzata) · CD 20 (Pericolosa).</li>' +
    '</ul>';
  hdr.appendChild(rulesBox);

  wrap.appendChild(hdr);

  // Counter + filtro
  var all = (state.impiantiCibernetici || []).slice().sort(function (a, b) {
    return (a.nome || '').localeCompare(b.nome || '', 'it');
  });
  var q = (state.cyberSearch || '').toLowerCase();
  var ft = state.cyberFilterTipo || '';
  var fr = state.cyberFilterRarita || '';
  var filtered = all.filter(function (im) {
    if (
      q &&
      !(im.nome || '').toLowerCase().includes(q) &&
      !(im.tipoImpianto || '').toLowerCase().includes(q) &&
      !(im.effetto || '').toLowerCase().includes(q)
    )
      return false;
    if (ft && (im.tipoImpianto || '') !== ft) return false;
    if (fr && (im.rarita || '') !== fr) return false;
    return true;
  });

  var counterDiv = document.createElement('div');
  counterDiv.style.cssText =
    'padding:0.5rem 2rem;font-size:11px;color:rgba(0,245,255,0.4);letter-spacing:0.15em;position:relative;z-index:1;';
  counterDiv.textContent =
    '// ' + filtered.length + ' IMPIANTI TROVATI — DATABASE_SIZE:' + all.length;
  wrap.appendChild(counterDiv);

  // Grid
  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'cyber-empty';
    empty.innerHTML =
      '<div class="cyber-rune">&#9881;</div><div>NESSUN IMPIANTO NEL DATABASE</div>' +
      (isDM()
        ? '<div style="margin-top:1rem;color:rgba(191,95,255,0.5);">> aggiungi il primo impianto per iniziare</div>'
        : '');
    wrap.appendChild(empty);
  } else {
    var grid = document.createElement('div');
    grid.className = 'cyber-grid';
    filtered.forEach(function (im) {
      grid.appendChild(renderCyberCard(im));
    });
    wrap.appendChild(grid);
  }

  // Form modal
  if (state.cyberShowForm) {
    wrap.appendChild(renderCyberForm());
  }

  return wrap;
}

function renderCyberCard(im) {
  var card = document.createElement('div');
  card.className = 'cyber-card';

  // Image
  if (im.immagine) {
    var imgW = document.createElement('div');
    imgW.className = 'cyber-img-wrap';
    var img = createContentImage();
    img.src = im.immagine;
    img.alt = im.nome || '';
    img.onerror = function () {
      imgW.innerHTML = '<div class="cyber-img-placeholder">&#9881;</div>';
    };
    imgW.appendChild(img);
    card.appendChild(imgW);
  }

  // Head
  var head = document.createElement('div');
  head.className = 'cyber-card-head';
  var nameDiv = document.createElement('div');
  nameDiv.innerHTML =
    '<div class="cyber-tipo-tag">' +
    escapeHtml(im.tipoImpianto || '?') +
    '</div>' +
    '<div class="cyber-card-name">' +
    escapeHtml(im.nome || 'Senza nome') +
    '</div>';
  var rarTag = document.createElement('span');
  rarTag.className = 'cyber-rarity-tag ' + _cyberRarityClass(im.rarita);
  rarTag.textContent = im.rarita || '?';
  head.appendChild(nameDiv);
  head.appendChild(rarTag);
  card.appendChild(head);

  // Body
  var body = document.createElement('div');
  body.className = 'cyber-card-body';

  if (im.effetto) {
    body.innerHTML +=
      '<div class="cyber-label">// EFFETTO</div><div class="cyber-value">' +
      nl2br(escapeHtml(im.effetto)) +
      '</div>';
  }
  if (im.descrizione) {
    body.innerHTML +=
      '<div class="cyber-label">// DESCRIZIONE</div><div class="cyber-value" style="color:rgba(0,245,255,0.6);font-size:12px;">' +
      nl2br(escapeHtml(im.descrizione)) +
      '</div>';
  }
  if (im.installazione) {
    body.innerHTML +=
      '<div class="cyber-label">// INSTALLAZIONE</div><div class="cyber-value" style="color:rgba(191,95,255,0.85);font-size:12px;">' +
      escapeHtml(im.installazione) +
      '</div>';
  }
  var _cs = _textScore(im.effetto, im.descrizione);
  if (_cs > 500) card.classList.add('card--wide');
  if (_cs > 1100) {
    body.style.maxHeight = '480px';
    body.style.overflowY = 'auto';
  }
  card.appendChild(body);

  // Footer
  var foot = document.createElement('div');
  foot.className = 'cyber-card-foot';
  var priceDiv = document.createElement('div');
  priceDiv.className = 'cyber-price';
  priceDiv.textContent = im.costo ? im.costo + ' ' + (im.valuta || 'mo') : '— PREZZO N/D';
  foot.appendChild(priceDiv);

  if (isDM()) {
    var btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:0.3rem;';
    var editBtn = document.createElement('button');
    editBtn.className = 'cyber-edit-btn';
    editBtn.innerHTML = ICON.edit;
    editBtn.title = 'Modifica';
    editBtn.onclick = function () {
      state.cyberEditingId = im.id;
      state.cyberShowForm = true;
      renderMain();
    };
    var delBtn = document.createElement('button');
    delBtn.className = 'cyber-del-btn';
    delBtn.innerHTML = ICON.trash;
    delBtn.title = 'Elimina';
    delBtn.onclick = function () {
      if (confirm('Eliminare questo impianto?')) {
        state.impiantiCibernetici = (state.impiantiCibernetici || []).filter(function (x) {
          return x.id !== im.id;
        });
        fbSaveImpianti();
        notify('Impianto eliminato.');
        renderMain();
      }
    };
    btnWrap.appendChild(editBtn);
    btnWrap.appendChild(delBtn);
    foot.appendChild(btnWrap);
  }
  foot.appendChild(buildCommerceItemAction(im, 'cyberware'));
  card.appendChild(foot);
  card.classList.add('sium-grid-card-enter');
  card.style.cursor = 'pointer';
  card.onclick = function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('button')) return;
    if (window.SiumAnimations) {
      if (window.SiumAnimations.triggerCardClickPulse)
        window.SiumAnimations.triggerCardClickPulse(card, '#00d4ff');
      if (window.SiumAnimations.openEmporioSubItemModal)
        window.SiumAnimations.openEmporioSubItemModal('Impianto Cibernetico', im, '#00d4ff');
    }
  };
  return card;
}

function renderCyberForm() {
  var editing = null;
  if (state.cyberEditingId) {
    (state.impiantiCibernetici || []).forEach(function (x) {
      if (x.id === state.cyberEditingId) editing = x;
    });
  }
  var form = {
    nome: editing ? editing.nome : '',
    tipoImpianto: editing ? editing.tipoImpianto : TIPI_CYBER[0],
    rarita: editing ? editing.rarita : RARITA_CYBER[0],
    costo: editing ? editing.costo : 0,
    valuta: editing ? editing.valuta : 'mo',
    effetto: editing ? editing.effetto : '',
    descrizione: editing ? editing.descrizione : '',
    immagine: editing ? editing.immagine : '',
    installazione: editing ? editing.installazione : INSTALLAZIONE_CYBER[0],
  };

  var backdrop = document.createElement('div');
  backdrop.className = 'cyber-modal-backdrop';
  backdrop.onclick = function (e) {
    if (e.target === backdrop) {
      state.cyberShowForm = false;
      state.cyberEditingId = null;
      renderMain();
    }
  };

  var panel = document.createElement('div');
  panel.className = 'cyber-modal-panel';
  panel.onclick = function (e) {
    e.stopPropagation();
  };

  var mhead = document.createElement('div');
  mhead.className = 'cyber-modal-head';
  mhead.innerHTML =
    '<div class="cyber-modal-title">' +
    (editing ? '&#9998; MODIFICA IMPIANTO' : '&#43; NUOVO IMPIANTO') +
    '</div>';
  var closeBtn = document.createElement('button');
  closeBtn.className = 'cyber-modal-close';
  closeBtn.innerHTML = ICON.x;
  closeBtn.onclick = function () {
    state.cyberShowForm = false;
    state.cyberEditingId = null;
    renderMain();
  };
  mhead.appendChild(closeBtn);
  panel.appendChild(mhead);

  var mbody = document.createElement('div');
  mbody.className = 'cyber-modal-body';

  function cyberField(labelTxt, key, type, opts) {
    var g = document.createElement('div');
    g.className = 'cyber-field-group';
    var lbl = document.createElement('label');
    lbl.className = 'cyber-field-label';
    lbl.textContent = '// ' + labelTxt;
    g.appendChild(lbl);
    var el;
    if (type === 'select') {
      el = document.createElement('select');
      el.className = 'cyber-field';
      (opts || []).forEach(function (o) {
        var opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        if (form[key] === o) opt.selected = true;
        el.appendChild(opt);
      });
    } else if (type === 'textarea') {
      el = document.createElement('textarea');
      el.className = 'cyber-field';
      el.rows = 3;
      el.value = form[key];
      el.style.resize = 'vertical';
    } else {
      el = document.createElement('input');
      el.type = type || 'text';
      el.className = 'cyber-field';
      el.value = form[key];
    }
    el.onchange = function () {
      form[key] = type === 'number' ? Number(this.value) || 0 : this.value;
    };
    el.oninput = function () {
      form[key] = type === 'number' ? Number(this.value) || 0 : this.value;
    };
    g.appendChild(el);
    return g;
  }

  mbody.appendChild(cyberField('NOME IMPIANTO', 'nome', 'text'));
  mbody.appendChild(cyberField('TIPO', 'tipoImpianto', 'select', TIPI_CYBER));

  var row2 = document.createElement('div');
  row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;';
  row2.appendChild(cyberField('RARITÀ', 'rarita', 'select', RARITA_CYBER));
  row2.appendChild(cyberField('INSTALLAZIONE', 'installazione', 'select', INSTALLAZIONE_CYBER));
  mbody.appendChild(row2);

  var row3 = document.createElement('div');
  row3.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  row3.appendChild(cyberField('COSTO', 'costo', 'number'));
  row3.appendChild(
    cyberField(
      'VALUTA',
      'valuta',
      'select',
      VALUTE.map(function (v) {
        return v.code;
      })
    )
  );
  mbody.appendChild(row3);

  mbody.appendChild(cyberField('EFFETTO', 'effetto', 'textarea'));
  mbody.appendChild(cyberField('DESCRIZIONE', 'descrizione', 'textarea'));
  mbody.appendChild(cyberField('URL IMMAGINE', 'immagine', 'text'));

  var saveBtn = document.createElement('button');
  saveBtn.className = 'cyber-save-btn';
  saveBtn.textContent = editing ? '> SALVA MODIFICHE' : '> INSTALLA NEL DATABASE';
  saveBtn.onclick = function () {
    if (!form.nome.trim()) {
      notify("Inserisci il nome dell'impianto.", 'err');
      return;
    }
    if (editing) {
      state.impiantiCibernetici = (state.impiantiCibernetici || []).map(function (x) {
        return x.id === editing.id ? Object.assign({}, form, { id: editing.id }) : x;
      });
    } else {
      var newId = 'cy_' + Date.now();
      if (!state.impiantiCibernetici) state.impiantiCibernetici = [];
      state.impiantiCibernetici.push(Object.assign({}, form, { id: newId }));
    }
    fbSaveImpianti();
    notify(editing ? 'Impianto aggiornato.' : 'Impianto aggiunto al database.');
    state.cyberShowForm = false;
    state.cyberEditingId = null;
    renderMain();
  };
  mbody.appendChild(saveBtn);

  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}
