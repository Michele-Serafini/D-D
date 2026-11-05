var TIPI_CYBER = ['Cervello', 'Testa', 'Organi Interni', 'Braccia', 'Gambe', 'Pelle', 'Altro'];
var RARITA_CYBER = ['Comune', 'Non comune', 'Raro', 'Molto raro', 'Leggendario'];
var INSTALLAZIONE_CYBER = ['Semplice', 'Chirurgica', 'Specializzata', 'Pericolosa'];

function _cyberRarityClass(r) {
  var map = {
    Comune: 'comune',
    'Non comune': 'non-comune',
    Raro: 'raro',
    'Molto raro': 'molto-raro',
    Leggendario: 'leggendario',
  };
  return 'cyber-rarity-' + (map[r] || 'comune');
}

// ============================================================
// SEZIONE DROGHE
// ============================================================
var TIPI_DROGA = ['Stimolante', 'Sedativo', 'Allucinogeno', 'Potenziante', 'Veleno', 'Altro'];
var TIPI_ARMA_FUOCO = [
  "Fucile d'assalto",
  'Pistola',
  'Fucile a pompa',
  'Mitragliatrice leggera',
  'Lanciarazzi',
  'Fucile da cecchino',
  'Arpione',
  'Lanciagranate',
  'Lanciafiamme',
  'Mitragliatrice pesante',
  'Mitraglietta',
  'Fucile da caccia',
];
var MUNIZIONI_ARMA = [
  'Proiettili',
  'Cartucce',
  'Dardi',
  "Munizioni d'assalto",
  'Carburante',
  'Granate',
  'Razzi',
  'Arpioni',
];

function renderEmporioDroghe() {
  var ACCENT = '#7fff7f';
  var ACCENT_DIM = 'rgba(127,255,127,0.15)';
  var wrap = document.createElement('div');
  wrap.style.cssText =
    "background:#030d03;min-height:100vh;font-family:'Courier New',monospace;color:" + ACCENT + ';';

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText =
    'background:linear-gradient(180deg,rgba(0,20,0,0.98),rgba(3,13,3,0.95));border-bottom:2px solid rgba(127,255,127,0.3);padding:1.5rem 2rem;';
  var hdrRow = document.createElement('div');
  hdrRow.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;';
  var hdrLeft = document.createElement('div');
  hdrLeft.innerHTML =
    '<div style="font-size:15px;font-weight:700;letter-spacing:0.15em;color:' +
    ACCENT +
    ';margin-bottom:0.4rem;">// EMPORIO — SOSTANZE &amp; COMPOSTI //</div>' +
    "<div style=\"font-family:'Cinzel',serif;font-size:2rem;font-weight:900;letter-spacing:0.3em;color:" +
    ACCENT +
    ';">▶ DROGHE</div>';
  var hdrRight = document.createElement('div');
  hdrRight.style.cssText = 'display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;';
  if (isDM()) {
    var addBtn = document.createElement('button');
    addBtn.style.cssText =
      'background:rgba(127,255,127,0.12);border:2px solid ' +
      ACCENT +
      ';color:' +
      ACCENT +
      ";font-family:'Courier New',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.55rem 1.2rem;cursor:pointer;text-transform:uppercase;";
    addBtn.textContent = '+ NUOVA DROGA';
    addBtn.onclick = function () {
      state.drogheShowForm = true;
      state.drogheEditingId = null;
      renderMain();
    };
    hdrRight.appendChild(addBtn);
  }
  var backBtn = document.createElement('button');
  backBtn.style.cssText =
    'background:rgba(127,255,127,0.08);border:2px solid rgba(127,255,127,0.5);color:' +
    ACCENT +
    ";font-family:'Courier New',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.5rem 1.2rem;cursor:pointer;text-transform:uppercase;";
  backBtn.innerHTML = '← TORNA EMPORIO';
  backBtn.onclick = function () {
    state.emporioTab = 'normale';
    renderMain();
  };
  hdrRight.appendChild(backBtn);
  hdrRow.appendChild(hdrLeft);
  hdrRow.appendChild(hdrRight);
  hdr.appendChild(hdrRow);

  // Search
  var srchWrap = document.createElement('div');
  srchWrap.style.cssText =
    'padding:1rem 2rem 0.5rem;display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;';
  var srch = document.createElement('input');
  srch.type = 'text';
  srch.placeholder = '> RICERCA SOSTANZE...';
  srch.id = 'srch-droghe';
  srch.value = state.drogheSearch || '';
  srch.style.cssText =
    'flex:1;min-width:200px;background:rgba(127,255,127,0.04);border:1px solid rgba(127,255,127,0.3);color:' +
    ACCENT +
    ";font-family:'Courier New',monospace;font-size:14px;padding:0.6rem 1rem;outline:none;";
  bindCatalogSearch(srch, 'drogheSearch');
  srchWrap.appendChild(srch);
  hdr.appendChild(srchWrap);

  // Regole dipendenza
  var dipBox = document.createElement('div');
  dipBox.style.cssText =
    'margin:0 2rem 1.2rem;padding:1rem 1.25rem;background:rgba(255,204,0,0.06);border:2px solid rgba(255,204,0,0.45);';
  dipBox.innerHTML =
    '<div style="font-size:14px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#ffcc00;margin-bottom:0.7rem;">⚠ REGOLE DI DIPENDENZA</div>' +
    '<div style="font-size:14px;font-weight:700;color:#ffcc00;margin-bottom:0.4rem;">Livelli di dipendenza:</div>' +
    '<ul style="margin:0 0 0.8rem;padding-left:1.4rem;list-style:disc;">' +
    '<li style="font-size:15px;color:#ffe08a;line-height:1.6;margin-bottom:0.3rem;"><strong>Livello 1</strong> — 1 dose a settimana</li>' +
    '<li style="font-size:15px;color:#ffe08a;line-height:1.6;margin-bottom:0.3rem;"><strong>Livello 2</strong> — 1 dose al giorno</li>' +
    '<li style="font-size:15px;color:#ffe08a;line-height:1.6;"><strong>Livello 3</strong> — 3 dosi al giorno <span style="color:#ff8888;font-size:13px;">(assumere la droga non ha alcun effetto)</span></li>' +
    '</ul>' +
    '<div style="font-size:14px;font-weight:700;color:#ffcc00;margin-top:0.4rem;margin-bottom:0.5rem;">Progressione della dipendenza:</div>' +
    '<p style="font-size:15px;color:#ffe08a;line-height:1.65;margin:0 0 0.6rem;">Consumare dosi entro i limiti del proprio <strong>Tasso di Fabbisogno</strong> non richiede alcun Tiro Salvezza e non fa salire il livello di dipendenza.</p>' +
    '<p style="font-size:15px;color:#ffe08a;line-height:1.65;margin:0 0 0.6rem;">Se si consumano dosi <strong>oltre il proprio Tasso di Fabbisogno</strong>, bisogna effettuare un Tiro Salvezza (su <strong>Costituzione</strong> per le droghe fisiche, su <strong>Saggezza</strong> per quelle psicologiche). Se si fallisce, la dipendenza sale di 1 livello. Un <strong>1 naturale</strong> sul dado fallisce sempre, indipendentemente dai modificatori.</p>' +
    '<p style="font-size:15px;color:#ffe08a;line-height:1.65;margin:0;">Raggiunto il <strong>Livello 3</strong> (il massimo), assumere la droga <strong style="color:#ff8888;">non ha alcun effetto sul personaggio</strong>: non conferisce benefici né malus aggiuntivi, e serve unicamente a soddisfare il fabbisogno ed evitare l\'astinenza.</p>' +
    '<div style="font-size:14px;font-weight:700;color:#ffcc00;margin-top:1rem;margin-bottom:0.5rem;">🧪 Disintossicazione:</div>' +
    '<p style="font-size:15px;color:#ffe08a;line-height:1.65;margin:0 0 0.6rem;">Gli incantesimi e gli effetti base che neutralizzano i veleni riescono ad <strong>annullare gli effetti attivi</strong> di una droga, ma <strong>non possono liberare il personaggio dalla sua dipendenza</strong>.</p>' +
    '<p style="font-size:15px;color:#ffe08a;line-height:1.65;margin:0;">Per disintossicarsi magicamente serve una magia più potente: lanciare <strong>Ristorare Superiore</strong> (o un incantesimo di potenza simile) riduce il livello di dipendenza della creatura esattamente di <strong>1</strong>.</p>';
  hdr.appendChild(dipBox);

  wrap.appendChild(hdr);

  // Filter & list
  var all = (state.droghe || []).slice().sort(function (a, b) {
    return (a.nome || '').localeCompare(b.nome || '', 'it');
  });
  var q = (state.drogheSearch || '').toLowerCase();
  var filtered = q
    ? all.filter(function (d) {
        return (
          (d.nome || '').toLowerCase().includes(q) ||
          (d.tipo || '').toLowerCase().includes(q) ||
          (d.effetto || '').toLowerCase().includes(q)
        );
      })
    : all;

  var counter = document.createElement('div');
  counter.style.cssText =
    'padding:0.5rem 2rem;font-size:12px;color:rgba(127,255,127,0.45);letter-spacing:0.15em;';
  counter.textContent = '// ' + filtered.length + ' SOSTANZE NEL DATABASE';
  wrap.appendChild(counter);

  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText =
      'text-align:center;padding:4rem 2rem;color:rgba(127,255,127,0.3);font-size:16px;letter-spacing:0.1em;';
    empty.innerHTML =
      '💊<br><br>NESSUNA SOSTANZA NEL DATABASE' +
      (isDM()
        ? '<div style="margin-top:1rem;font-size:14px;">> aggiungi la prima sostanza per iniziare</div>'
        : '');
    wrap.appendChild(empty);
  } else {
    var grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem;padding:1.5rem 2rem;';
    filtered.forEach(function (d) {
      grid.appendChild(renderDrogaCard(d, ACCENT));
    });
    wrap.appendChild(grid);
  }

  if (state.drogheShowForm) wrap.appendChild(renderDrogaForm(ACCENT));
  return wrap;
}

function renderDrogaCard(d, ACCENT) {
  var card = document.createElement('div');
  card.style.cssText =
    'background:linear-gradient(135deg,rgba(0,30,0,0.95),rgba(5,15,5,0.95));border:2px solid rgba(127,255,127,0.3);padding:0;overflow:hidden;transition:border-color 0.2s,transform 0.2s;';
  card.onmouseenter = function () {
    this.style.borderColor = 'rgba(127,255,127,0.7)';
    this.style.transform = 'translateY(-3px)';
  };
  card.onmouseleave = function () {
    this.style.borderColor = 'rgba(127,255,127,0.3)';
    this.style.transform = '';
  };

  if (d.immagine) {
    var img = createContentImage();
    img.src = d.immagine;
    img.alt = d.nome || '';
    img.style.cssText =
      'width:100%;height:160px;object-fit:cover;display:block;border-bottom:1px solid rgba(127,255,127,0.2);';
    img.onerror = function () {
      this.style.display = 'none';
    };
    card.appendChild(img);
  }

  var head = document.createElement('div');
  head.style.cssText = 'padding:1rem 1.2rem 0.7rem;border-bottom:1px solid rgba(127,255,127,0.15);';
  var nameDiv = document.createElement('div');
  nameDiv.style.cssText =
    "font-family:'Cinzel',serif;font-size:20px;font-weight:700;color:#7fff7f;line-height:1.2;";
  nameDiv.textContent = d.nome || 'Senza nome';
  head.appendChild(nameDiv);
  if (d.tsDipendenza) {
    var tsTag = document.createElement('div');
    tsTag.style.cssText =
      'margin-top:0.4rem;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ffcc00;display:inline-block;border:1px solid rgba(255,204,0,0.5);padding:0.2rem 0.6rem;';
    tsTag.textContent = 'TS DIPENDENZA: ' + d.tsDipendenza;
    head.appendChild(tsTag);
  }
  card.appendChild(head);

  var body = document.createElement('div');
  body.style.cssText = 'padding:0.8rem 1.2rem;';
  if (d.descrizione) {
    body.innerHTML +=
      '<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#50c850;margin-bottom:0.25rem;">// DESCRIZIONE</div><div style="font-size:16px;color:#b8ffb8;line-height:1.5;">' +
      nl2br(escapeHtml(d.descrizione)) +
      '</div>';
  }
  var _ds = _textScore(d.descrizione);
  if (_ds > 500) card.classList.add('card--wide');
  if (_ds > 1100) {
    body.style.maxHeight = '480px';
    body.style.overflowY = 'auto';
  }
  card.appendChild(body);

  var foot = document.createElement('div');
  foot.style.cssText =
    'padding:0.6rem 1.2rem;border-top:1px solid rgba(127,255,127,0.12);background:rgba(0,10,0,0.4);display:flex;justify-content:space-between;align-items:center;';
  var price = document.createElement('div');
  price.style.cssText = 'font-size:17px;font-weight:700;color:#7fff7f;';
  price.textContent = d.costo ? d.costo + ' ' + (d.valuta || 'mo') : '— PREZZO N/D';
  foot.appendChild(price);
  if (isDM()) {
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:0.4rem;';
    var editBtn = document.createElement('button');
    editBtn.style.cssText =
      'background:rgba(127,255,127,0.1);border:1px solid rgba(127,255,127,0.4);color:#7fff7f;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
    editBtn.textContent = '✎';
    editBtn.onclick = function () {
      state.drogheEditingId = d.id;
      state.drogheShowForm = true;
      renderMain();
    };
    var delBtn = document.createElement('button');
    delBtn.style.cssText =
      'background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.4);color:#ff8080;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
    delBtn.textContent = '✕';
    delBtn.onclick = function () {
      if (confirm('Eliminare ' + (d.nome || 'questa sostanza') + '?')) {
        state.droghe = (state.droghe || []).filter(function (x) {
          return x.id !== d.id;
        });
        fbSaveDroghe();
        renderMain();
      }
    };
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    foot.appendChild(actions);
  }
  foot.appendChild(buildCommerceItemAction(d, 'sostanze'));
  card.appendChild(foot);
  card.classList.add('sium-grid-card-enter');
  card.style.cursor = 'pointer';
  card.onclick = function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('button')) return;
    if (window.SiumAnimations) {
      if (window.SiumAnimations.triggerCardClickPulse)
        window.SiumAnimations.triggerCardClickPulse(card, '#7fff7f');
      if (window.SiumAnimations.openEmporioSubItemModal)
        window.SiumAnimations.openEmporioSubItemModal('Sostanza Alchemica / Droga', d, '#7fff7f');
    }
  };
  return card;
}

function renderDrogaForm(ACCENT) {
  var editing = null;
  if (state.drogheEditingId)
    (state.droghe || []).forEach(function (x) {
      if (x.id === state.drogheEditingId) editing = x;
    });
  var form = {
    nome: editing ? editing.nome : '',
    descrizione: editing ? editing.descrizione : '',
    tsDipendenza: editing ? editing.tsDipendenza : '',
    costo: editing ? editing.costo : 0,
    valuta: editing ? editing.valuta : 'mo',
    immagine: editing ? editing.immagine : '',
  };

  var backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick = function (e) {
    if (e.target === backdrop) {
      state.drogheShowForm = false;
      state.drogheEditingId = null;
      renderMain();
    }
  };

  var panel = document.createElement('div');
  panel.style.cssText =
    'background:#030d03;border:2px solid rgba(127,255,127,0.4);padding:0;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick = function (e) {
    e.stopPropagation();
  };

  var mhead = document.createElement('div');
  mhead.style.cssText =
    'padding:1rem 1.5rem;border-bottom:1px solid rgba(127,255,127,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML =
    '<div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:#7fff7f;letter-spacing:0.1em;">' +
    (editing ? '✎ MODIFICA SOSTANZA' : '+ NUOVA SOSTANZA') +
    '</div>';
  var closeB = document.createElement('button');
  closeB.style.cssText = 'background:none;border:none;color:#7fff7f;font-size:20px;cursor:pointer;';
  closeB.textContent = '✕';
  closeB.onclick = function () {
    state.drogheShowForm = false;
    state.drogheEditingId = null;
    renderMain();
  };
  mhead.appendChild(closeB);
  panel.appendChild(mhead);

  var mbody = document.createElement('div');
  mbody.style.cssText = 'padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';

  function dField(lbl, key, type, opts) {
    var g = document.createElement('div');
    var l = document.createElement('label');
    l.style.cssText =
      'display:block;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#50c850;margin-bottom:0.3rem;';
    l.textContent = '// ' + lbl;
    g.appendChild(l);
    var el;
    var fStyle =
      "width:100%;background:rgba(127,255,127,0.05);border:1px solid rgba(127,255,127,0.3);color:#b8ffb8;font-family:'Courier New',monospace;font-size:15px;padding:0.55rem 0.75rem;outline:none;box-sizing:border-box;";
    if (type === 'select') {
      el = document.createElement('select');
      el.style.cssText = fStyle;
      (opts || []).forEach(function (o) {
        var opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        if (form[key] === o) opt.selected = true;
        el.appendChild(opt);
      });
    } else if (type === 'textarea') {
      el = document.createElement('textarea');
      el.style.cssText = fStyle + 'resize:vertical;';
      el.rows = 3;
      el.value = form[key];
    } else {
      el = document.createElement('input');
      el.type = type || 'text';
      el.style.cssText = fStyle;
      el.value = form[key];
    }
    el.onchange = el.oninput = function () {
      form[key] = type === 'number' ? Number(this.value) || 0 : this.value;
    };
    g.appendChild(el);
    return g;
  }

  mbody.appendChild(dField('NOME SOSTANZA', 'nome', 'text'));
  mbody.appendChild(dField('DESCRIZIONE', 'descrizione', 'textarea'));
  mbody.appendChild(
    dField('TS CONTRO DIPENDENZA (es. CD 12 Costituzione)', 'tsDipendenza', 'text')
  );
  var r3 = document.createElement('div');
  r3.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  r3.appendChild(dField('PREZZO', 'costo', 'number'));
  r3.appendChild(
    dField(
      'VALUTA',
      'valuta',
      'select',
      VALUTE.map(function (v) {
        return v.code;
      })
    )
  );
  mbody.appendChild(r3);
  mbody.appendChild(dField('URL IMMAGINE', 'immagine', 'text'));

  var saveBtn = document.createElement('button');
  saveBtn.style.cssText =
    "width:100%;background:rgba(127,255,127,0.12);border:2px solid #7fff7f;color:#7fff7f;font-family:'Courier New',monospace;font-size:15px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;";
  saveBtn.textContent = editing ? '> SALVA MODIFICHE' : '> AGGIUNGI AL DATABASE';
  saveBtn.onclick = function () {
    if (!form.nome.trim()) {
      notify('Inserisci il nome della sostanza.', 'err');
      return;
    }
    if (editing) {
      state.droghe = (state.droghe || []).map(function (x) {
        return x.id === editing.id ? Object.assign({}, form, { id: editing.id }) : x;
      });
    } else {
      if (!state.droghe) state.droghe = [];
      state.droghe.push(Object.assign({}, form, { id: 'dr_' + Date.now() }));
    }
    fbSaveDroghe();
    notify(editing ? 'Sostanza aggiornata.' : 'Sostanza aggiunta al database.');
    state.drogheShowForm = false;
    state.drogheEditingId = null;
    renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}

// ============================================================
// SEZIONE VEICOLI
// ============================================================
