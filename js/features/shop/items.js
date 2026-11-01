function renderWeaponCard(w) {
  var card = document.createElement('article');
  card.className = 'weapon-card';
  card.style.cursor = 'pointer';
  card.onclick = function () {
    if (window.SiumAnimations && window.SiumAnimations.triggerCardClickPulse) {
      window.SiumAnimations.triggerCardClickPulse(card);
    }
    openDetailModal('arma', w);
  };

  var img = document.createElement('div');
  img.className = 'card-image-wrap';
  if (w.immagine) {
    var im = createContentImage();
    im.alt = w.nome;
    im.src = w.immagine;
    im.onerror = function () {
      this.onerror = null;
      this.src = 'path/to/default-pirate-item.png';
    };
    img.appendChild(im);
  } else {
    var im = createContentImage();
    im.alt = w.nome;
    im.src = 'path/to/default-pirate-item.png';
    img.appendChild(im);
  }
  var rt = document.createElement('div');
  rt.style.cssText = 'position:absolute;top:12px;right:12px;z-index:2;';
  var rarityTag = document.createElement('span');
  rarityTag.className = 'rarity-tag ' + rarityClass(w.rarita);
  rarityTag.textContent = w.rarita || '';
  rt.appendChild(rarityTag);
  img.appendChild(rt);
  card.appendChild(img);

  var body = document.createElement('div');
  body.className = 'card-body';
  var sintoniaTag = w.sintonia
    ? ' <span style="font-size:11px;color:#c97f7f;font-weight:bold;margin-left:8px;">(Richiede sintonia)</span>'
    : '';
  body.innerHTML =
    '<div class="type-chip mb-2">' +
    escapeHtml(w.tipo) +
    sintoniaTag +
    '</div>' +
    '<h3 class="font-display font-bold text-lg mb-2" style="color:var(--gold-bright);line-height:1.25;margin:0 0 0.5rem;">' +
    escapeHtml(w.nome) +
    '</h3>' +
    '<p style="font-size:14px;line-height:1.55;color:var(--text-main);flex:1;margin:0 0 1rem;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;">' +
    (w.descrizione
      ? nl2br(escapeHtml(w.descrizione))
      : '<em style="color:var(--text-muted)">Nessuna descrizione.</em>') +
    '</p>';

  var foot = document.createElement('div');
  foot.className = 'flex items-center justify-between pt-3 border-t';
  var priceDiv = '<div></div>';
  if (isAdmin()) {
    foot.innerHTML =
      priceDiv +
      '<div class="flex gap-1"><button class="btn-dark edit-btn" title="Modifica" style="padding:0.4rem 0.65rem;">' +
      ICON.edit +
      '</button>' +
      '<button class="btn-blood del-btn" title="Elimina" style="padding:0.4rem 0.65rem;">' +
      ICON.trash +
      '</button></div>';
    foot.querySelector('.edit-btn').onclick = function (e) {
      e.stopPropagation();
      state.editingId = w.id;
      state.showForm = true;
      document.body.appendChild(renderWeaponForm());
    };
    foot.querySelector('.del-btn').onclick = function (e) {
      e.stopPropagation();
      if (confirm('Eliminare questa arma dal database?')) {
        state.armi = state.armi.filter(function (x) {
          return x.id !== w.id;
        });
        fbSaveArmi();
        notify('Arma eliminata.');
        updateResults();
      }
    };
  } else {
    foot.innerHTML = priceDiv;
  }
  foot.appendChild(buildCommerceItemAction(w, 'emporio'));
  body.appendChild(foot);
  card.appendChild(body);
  return card;
}

function saveArmi() {
  try {
    var json = JSON.stringify(state.armi, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    triggerDownload(blob, 'database_armi.json');
    notify('Database scaricato. Salvalo nella tua chiavetta.');
  } catch (e) {
    notify('Errore: ' + e.message, 'err');
  }
}

function loadArmi() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function (ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('File non contiene un array.');
        state.armi = data.map(function (w, i) {
          return {
            id: w.id || 'w_' + Date.now() + '_' + i,
            nome: w.nome || 'Senza nome',
            descrizione: w.descrizione || '',
            tipo: w.tipo || TIPI[0],
            rarita: w.rarita || RARITA[0],
            valuta: w.valuta || 'mo',
            prezzo: Number(w.prezzo) || 0,
            immagine: w.immagine || '',
          };
        });
        fbSaveArmi();
        notify('Caricate ' + state.armi.length + ' armi.');
        renderMain();
      } catch (err) {
        notify('Errore: ' + err.message, 'err');
      }
    };
    r.readAsText(f);
  };
  input.click();
}

function triggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 100);
}

function renderWeaponForm() {
  var editing = null;
  if (state.editingId) {
    state.armi.forEach(function (w) {
      if (w.id === state.editingId) editing = w;
    });
  }
  var form = {
    nome: editing ? editing.nome : '',
    descrizione: editing ? editing.descrizione : '',
    tipo: editing ? editing.tipo : TIPI[0],
    rarita: editing ? editing.rarita : RARITA[0],
    immagine: editing ? editing.immagine : '',
    sintonia: editing ? !!editing.sintonia : false,
  };

  var back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.id = 'modal-root';
  back.onclick = function (e) {
    if (e.target === back) closeForm();
  };

  var panel = document.createElement('div');
  panel.className = 'modal-panel';

  var head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML =
    '<div><div class="font-display font-semibold tracking-widest" style="font-size:11px;color:var(--gold-dim);margin-bottom:0.25rem;">' +
    (editing ? 'MODIFICA' : 'AGGIUNGI') +
    '</div>' +
    '<h2 class="font-display font-bold" style="font-size:20px;color:var(--gold-bright);margin:0;">' +
    (editing ? 'Modifica Oggetto' : 'Nuovo Oggetto') +
    '</h2></div>' +
    '<button class="theme-toggle" style="width:38px;height:38px;">' +
    ICON.x +
    '</button>';
  head.querySelector('button').onclick = closeForm;
  panel.appendChild(head);

  var body = document.createElement('form');
  body.className = 'modal-body';
  body.onsubmit = function (e) {
    e.preventDefault();
    submitForm();
  };

  function addField(labelText, type, key, opts) {
    opts = opts || {};
    var d = document.createElement('div');
    d.innerHTML = '<label class="field-label">' + labelText + '</label>';
    var inp;
    if (type === 'textarea') {
      inp = document.createElement('textarea');
      inp.rows = 4;
    } else if (type === 'select') {
      inp = document.createElement('select');
      opts.options.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o.value;
        op.textContent = o.label;
        if (form[key] === o.value) op.selected = true;
        inp.appendChild(op);
      });
    } else {
      inp = document.createElement('input');
      inp.type = type;
      if (type === 'number') {
        inp.min = '0';
        inp.step = '1';
      }
    }
    inp.className = 'field';
    if (type === 'checkbox') {
      inp.checked = !!form[key];
      inp.onchange = function () {
        form[key] = this.checked;
      };
      inp.style.width = 'auto';
    } else {
      inp.value = form[key];
      inp.oninput = function () {
        form[key] = this.value;
      };
      inp.onchange = function () {
        form[key] = this.value;
      };
    }
    if (opts.placeholder) inp.placeholder = opts.placeholder;
    d.appendChild(inp);
    if (opts.hint) {
      var h = document.createElement('p');
      h.style.cssText =
        'font-size:12px;font-style:italic;color:var(--text-muted);margin:0.5rem 0 0;';
      h.innerHTML = opts.hint;
      d.appendChild(h);
    }
    return d;
  }

  body.appendChild(addField('Nome *', 'text', 'nome', { placeholder: "es. Lama dell'Alba" }));
  body.appendChild(
    addField('Descrizione', 'textarea', 'descrizione', {
      placeholder: 'Storia, propriet\u00E0 magiche, particolarit\u00E0...',
    })
  );

  var row1 = document.createElement('div');
  row1.className = 'form-row';
  row1.appendChild(
    addField('Tipo', 'select', 'tipo', {
      options: TIPI.map(function (t) {
        return { value: t, label: t };
      }),
    })
  );
  row1.appendChild(
    addField('Rarit\u00E0', 'select', 'rarita', {
      options: RARITA.map(function (r) {
        return { value: r, label: r };
      }),
    })
  );
  body.appendChild(row1);

  body.appendChild(
    addField('URL Immagine', 'text', 'immagine', {
      placeholder: 'img/spada-alba.png',
      hint: 'Usa un percorso relativo come <code>img/nomearma.png</code>.',
    })
  );
  body.appendChild(addField('Richiede Sintonia', 'checkbox', 'sintonia'));
  var actions = document.createElement('div');
  actions.className = 'flex gap-3 pt-3';
  actions.style.cssText = 'flex-wrap:wrap-reverse;';
  var cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn-dark';
  cancel.style.cssText = 'flex:1;padding:0.65rem 1.25rem;';
  cancel.textContent = 'Annulla';
  cancel.onclick = closeForm;
  actions.appendChild(cancel);
  var submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn-gold';
  submit.style.cssText = 'flex:1;padding:0.65rem 1.25rem;';
  submit.innerHTML = ICON.sparkle + ' ' + (editing ? 'Salva Modifiche' : 'Aggiungi al Compendio');
  actions.appendChild(submit);
  body.appendChild(actions);

  panel.appendChild(body);
  back.appendChild(panel);

  function submitForm() {
    if (!form.nome.trim()) {
      alert('Il nome è obbligatorio.');
      return;
    }
    if (editing) {
      state.armi = state.armi.map(function (w) {
        if (w.id !== state.editingId) return w;
        var copy = {};
        for (var k in w) copy[k] = w[k];
        for (var k2 in form) copy[k2] = form[k2];
        return copy;
      });
      notify('Arma aggiornata.');
    } else {
      var newW = { id: 'w_' + Date.now() };
      for (var k in form) newW[k] = form[k];
      state.armi = [newW].concat(state.armi);
      notify('Arma aggiunta al database.');
    }
    fbSaveArmi();
    closeForm();
  }
  return back;
}

function closeForm() {
  state.showForm = false;
  state.editingId = null;
  var m = document.getElementById('modal-root');
  if (m) m.remove();
  if (state.section === 'emporio') updateResults();
  else renderMain();
}
