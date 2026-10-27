function renderBestiarForm() {
  var editing = null;
  if (state.bestEditingId) {
    state.bestiario.forEach(function (m) {
      if (m.id === state.bestEditingId) editing = m;
    });
  }
  var form = {
    nome: editing ? editing.nome : '',
    taglia: editing ? editing.taglia || '' : '',
    tipo: editing ? editing.tipo || '' : '',
    allineamento: editing ? editing.allineamento || '' : '',
    grsfida: editing ? editing.grsfida || '' : '',
    hp: editing ? editing.hp || '' : '',
    ca: editing ? editing.ca || '' : '',
    velocita: editing ? editing.velocita || '' : '',
    for: editing ? editing.for || '' : '',
    des: editing ? editing.des || '' : '',
    cos: editing ? editing.cos || '' : '',
    int: editing ? editing.int || '' : '',
    sag: editing ? editing.sag || '' : '',
    car: editing ? editing.car || '' : '',
    ts: editing ? editing.ts || '' : '',
    sensi: editing ? editing.sensi || '' : '',
    abilita: editing ? editing.abilita || '' : '',
    lingue: editing ? editing.lingue || '' : '',
    tratti: editing ? editing.tratti || '' : '',
    incantesimi: editing ? editing.incantesimi || '' : '',
    url: editing ? editing.url || '' : '',
    immagine: editing ? editing.immagine || '' : '',
    azioni: editing ? editing.azioni || '' : '',
    azioniLeggendarie: editing ? editing.azioniLeggendarie || '' : '',
  };
  var back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.id = 'modal-root';
  back.onclick = function (e) {
    if (e.target === back) closeBestForm();
  };
  var panel = document.createElement('div');
  panel.className = 'modal-panel';
  var head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML =
    '<div><div class="font-display font-semibold tracking-widest" style="font-size:11px;color:var(--gold-dim);margin-bottom:0.25rem;">' +
    (editing ? 'MODIFICA' : 'AGGIUNGI') +
    '</div><h2 class="font-display font-bold" style="font-size:20px;color:var(--gold-bright);margin:0;">' +
    (editing ? 'Modifica Mostro' : 'Nuovo Mostro') +
    '</h2></div><button class="theme-toggle" style="width:38px;height:38px;">' +
    ICON.x +
    '</button>';
  head.querySelector('button').onclick = closeBestForm;
  panel.appendChild(head);
  var mbody = document.createElement('form');
  mbody.className = 'modal-body';
  mbody.onsubmit = function (e) {
    e.preventDefault();
    submitBestForm();
  };
  function addBF(lbl, type, key, opts) {
    opts = opts || {};
    var d = document.createElement('div');
    d.innerHTML = '<label class="field-label">' + lbl + '</label>';
    var inp;
    if (type === 'textarea') {
      inp = document.createElement('textarea');
      inp.rows = 5;
    } else {
      inp = document.createElement('input');
      inp.type = type;
    }
    inp.className = 'field';
    inp.value = form[key] || '';
    if (opts.placeholder) inp.placeholder = opts.placeholder;
    (function (k) {
      inp.oninput = function () {
        form[k] = this.value;
      };
    })(key);
    d.appendChild(inp);
    return d;
  }
  mbody.appendChild(
    addBF('Nome Mostro *', 'text', 'nome', { placeholder: 'Es. Goblin, Drago Rosso…' })
  );
  /* Taglia + Tipo */
  var rowTT = document.createElement('div');
  rowTT.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;';
  /* Taglia select */
  (function () {
    var d = document.createElement('div');
    d.innerHTML = '<label class="field-label">Taglia</label>';
    var sel = document.createElement('select');
    sel.className = 'field';
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— Seleziona taglia —';
    sel.appendChild(opt0);
    TAGLIE_MOSTRO.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t;
      o.textContent = t;
      if (form.taglia === t) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = function () {
      form.taglia = this.value;
    };
    d.appendChild(sel);
    rowTT.appendChild(d);
  })();
  /* Tipo select */
  (function () {
    var d = document.createElement('div');
    d.innerHTML = '<label class="field-label">Tipo Creatura</label>';
    var sel = document.createElement('select');
    sel.className = 'field';
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— Seleziona tipo —';
    sel.appendChild(opt0);
    TIPI_MOSTRO.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t;
      o.textContent = t;
      if (form.tipo === t) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = function () {
      form.tipo = this.value;
    };
    d.appendChild(sel);
    rowTT.appendChild(d);
  })();
  mbody.appendChild(rowTT);
  /* Allineamento + GS */
  var rowAG = document.createElement('div');
  rowAG.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  (function () {
    var d = document.createElement('div');
    d.innerHTML = '<label class="field-label">Allineamento</label>';
    var sel = document.createElement('select');
    sel.className = 'field';
    var alignments = [
      '',
      'Legale Buono',
      'Neutrale Buono',
      'Caotico Buono',
      'Legale Neutrale',
      'Neutrale',
      'Caotico Neutrale',
      'Legale Malvagio',
      'Neutrale Malvagio',
      'Caotico Malvagio',
      'Senza Allineamento',
    ];
    alignments.forEach(function (a) {
      var o = document.createElement('option');
      o.value = a;
      o.textContent = a || '— Seleziona —';
      if (form.allineamento === a) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = function () {
      form.allineamento = this.value;
    };
    d.appendChild(sel);
    rowAG.appendChild(d);
  })();
  rowAG.appendChild(addBF('Grado Sfida', 'text', 'grsfida', { placeholder: '1/4, 1, 5, 17…' }));
  mbody.appendChild(rowAG);
  /* HP / CA / Velocità */
  var row2 = document.createElement('div');
  row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;';
  row2.appendChild(addBF('HP', 'text', 'hp', { placeholder: '45' }));
  row2.appendChild(addBF('CA', 'text', 'ca', { placeholder: '13' }));
  row2.appendChild(addBF('Velocità', 'text', 'velocita', { placeholder: '9 m (volo 18 m)' }));
  mbody.appendChild(row2);
  /* Caratteristiche FOR DES COS INT SAG CAR */
  var statsLbl = document.createElement('div');
  statsLbl.innerHTML = '<label class="field-label">Caratteristiche</label>';
  mbody.appendChild(statsLbl);
  var rowStats = document.createElement('div');
  rowStats.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;';
  ['for', 'des', 'cos', 'int', 'sag', 'car'].forEach(function (k) {
    var d = document.createElement('div');
    var lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.style.textAlign = 'center';
    lbl.textContent = k.toUpperCase();
    var inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'field';
    inp.min = '1';
    inp.max = '30';
    inp.style.cssText = 'text-align:center;padding:0.4rem 0.25rem;';
    inp.value = form[k] || '';
    inp.placeholder = '—';
    (function (key) {
      inp.oninput = function () {
        form[key] = this.value;
      };
    })(k);
    d.appendChild(lbl);
    d.appendChild(inp);
    rowStats.appendChild(d);
  });
  mbody.appendChild(rowStats);
  mbody.appendChild(
    addBF('Tiri Salvezza', 'text', 'ts', { placeholder: 'FOR +5, DES +3, COS +7…' })
  );
  mbody.appendChild(
    addBF('Sensi', 'text', 'sensi', {
      placeholder: 'Scurovisione 36 m, vista cieca 18 m, perc. passiva 16',
    })
  );
  mbody.appendChild(
    addBF('Abilità', 'text', 'abilita', { placeholder: 'Percezione +6, Furtività +4, Inganno +8…' })
  );
  mbody.appendChild(
    addBF('Lingue parlate', 'text', 'lingue', { placeholder: 'Comune, Draconico, Infernale…' })
  );
  mbody.appendChild(
    addBF('Tratti Speciali', 'textarea', 'tratti', {
      placeholder: 'Es. Sensi acuiti. Vantaggio ai tiri percezione. Resistenza al veleno…',
    })
  );
  mbody.appendChild(
    addBF('Incantesimi', 'textarea', 'incantesimi', {
      placeholder:
        "Es. L'incantatore è un mago di 9° livello. Slot: 1°×4, 2°×3… Trucchetti: dardo incantato, danza delle luci…",
    })
  );
  mbody.appendChild(addBF('URL Riferimento', 'text', 'url', { placeholder: 'https://…' }));
  var imgD = document.createElement('div');
  imgD.innerHTML = '<label class="field-label">Immagine</label>';
  var imgRow = document.createElement('div');
  imgRow.style.cssText = 'display:flex;gap:0.5rem;align-items:center;';
  var imgInp = document.createElement('input');
  imgInp.type = 'text';
  imgInp.className = 'field';
  imgInp.placeholder = 'URL immagine o carica file';
  imgInp.value = form.immagine || '';
  var prevImg = document.createElement('img');
  prevImg.style.cssText =
    'max-width:70px;max-height:55px;border-radius:3px;border:1px solid var(--border-soft);' +
    (form.immagine ? '' : 'display:none;');
  if (form.immagine) prevImg.src = safeImageUrl(form.immagine);
  imgInp.oninput = function () {
    form.immagine = this.value;
    var imageUrl = safeImageUrl(this.value);
    if (imageUrl) {
      prevImg.src = imageUrl;
      prevImg.style.display = 'block';
    } else {
      prevImg.removeAttribute('src');
      prevImg.style.display = 'none';
    }
  };
  var fI = document.createElement('input');
  fI.type = 'file';
  fI.accept = 'image/*';
  fI.style.display = 'none';
  var fBtn = document.createElement('button');
  fBtn.type = 'button';
  fBtn.className = 'btn-dark';
  fBtn.style.cssText = 'white-space:nowrap;font-size:11px;flex-shrink:0;';
  fBtn.textContent = '📁 File';
  fBtn.onclick = function () {
    fI.click();
  };
  fI.onchange = function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var MAX = 600;
        var ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        var compressed = canvas.toDataURL('image/jpeg', 0.72);
        imgInp.value = '';
        form.immagine = compressed;
        prevImg.src = compressed;
        prevImg.style.display = 'block';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  imgRow.appendChild(imgInp);
  imgRow.appendChild(fBtn);
  imgRow.appendChild(fI);
  imgRow.appendChild(prevImg);
  imgD.appendChild(imgRow);
  mbody.appendChild(imgD);
  mbody.appendChild(
    addBF('Azioni, Tattiche, Lore', 'textarea', 'azioni', {
      placeholder: 'Descrivi le azioni speciali, le tattiche di combattimento, la lore del mostro…',
    })
  );
  mbody.appendChild(
    addBF('Azioni Leggendarie', 'textarea', 'azioniLeggendarie', {
      placeholder:
        'Es. Il mostro può compiere 3 azioni leggendarie a fine turno altrui. Coda: +9, 2d8+5. Ala (2 azioni): CD DES 17, 2d6+5 + prono…',
    })
  );
  var submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn-gold';
  submitBtn.style.cssText = 'width:100%;justify-content:center;';
  submitBtn.innerHTML = ICON.save + ' ' + (editing ? 'Salva Modifiche' : 'Aggiungi al Bestiario');
  mbody.appendChild(submitBtn);
  panel.appendChild(mbody);
  back.appendChild(panel);
  function submitBestForm() {
    if (!form.nome.trim()) {
      notify('Inserisci il nome del mostro.', 'err');
      return;
    }
    if (editing) {
      state.bestiario.forEach(function (m) {
        if (m.id === editing.id) {
          m.nome = form.nome.trim();
          m.taglia = form.taglia;
          m.tipo = form.tipo;
          m.allineamento = form.allineamento;
          m.grsfida = form.grsfida;
          m.hp = form.hp;
          m.ca = form.ca;
          m.velocita = form.velocita;
          m.for = form.for;
          m.des = form.des;
          m.cos = form.cos;
          m.int = form.int;
          m.sag = form.sag;
          m.car = form.car;
          m.ts = form.ts;
          m.sensi = form.sensi;
          m.abilita = form.abilita;
          m.lingue = form.lingue;
          m.tratti = form.tratti;
          m.incantesimi = form.incantesimi;
          m.url = form.url;
          m.immagine = form.immagine;
          m.azioni = form.azioni;
          m.azioniLeggendarie = form.azioniLeggendarie;
          m._v = 9999;
        }
      });
      notify('Mostro aggiornato.');
    } else {
      state.bestiario.push({
        id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        nome: form.nome.trim(),
        taglia: form.taglia,
        tipo: form.tipo,
        allineamento: form.allineamento,
        grsfida: form.grsfida,
        hp: form.hp,
        ca: form.ca,
        velocita: form.velocita,
        for: form.for,
        des: form.des,
        cos: form.cos,
        int: form.int,
        sag: form.sag,
        car: form.car,
        ts: form.ts,
        sensi: form.sensi,
        abilita: form.abilita,
        lingue: form.lingue,
        tratti: form.tratti,
        incantesimi: form.incantesimi,
        url: form.url,
        immagine: form.immagine,
        azioni: form.azioni,
        azioniLeggendarie: form.azioniLeggendarie,
      });
      notify('Mostro aggiunto al bestiario.');
    }
    fbSaveBestiario();
    saveToStorage();
    var _sy = window.scrollY;
    closeBestForm();
    renderMain();
    requestAnimationFrame(function () {
      window.scrollTo(0, _sy);
    });
  }
  return back;
}

function closeBestForm() {
  state.bestShowForm = false;
  state.bestEditingId = null;
  var m = document.getElementById('modal-root');
  if (m) m.remove();
}

function saveBestiario() {
  try {
    var json = JSON.stringify(state.bestiario, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    triggerDownload(blob, 'database_bestiario.json');
    notify('Bestiario scaricato. Salvalo nella tua chiavetta.');
  } catch (e) {
    notify('Errore: ' + e.message, 'err');
  }
}

function loadBestiarioFile() {
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
        state.bestiario = data.map(function (m, i) {
          return {
            id: m.id || 'm_' + Date.now() + '_' + i,
            nome: m.nome || 'Senza nome',
            taglia: m.taglia || '',
            tipo: m.tipo || '',
            allineamento: m.allineamento || '',
            grsfida: m.grsfida || '',
            hp: m.hp || '',
            ca: m.ca || '',
            velocita: m.velocita || '',
            for: m.for || '',
            des: m.des || '',
            cos: m.cos || '',
            int: m.int || '',
            sag: m.sag || '',
            car: m.car || '',
            ts: m.ts || '',
            sensi: m.sensi || '',
            abilita: m.abilita || '',
            lingue: m.lingue || '',
            tratti: m.tratti || '',
            url: m.url || '',
            immagine: m.immagine || '',
            azioni: m.azioni || '',
            azioniLeggendarie: m.azioniLeggendarie || '',
          };
        });
        fbSaveBestiario();
        saveToStorage();
        notify('Caricati ' + state.bestiario.length + ' mostri.');
        renderMain();
      } catch (err) {
        notify('Errore: ' + err.message, 'err');
      }
    };
    r.readAsText(f);
  };
  input.click();
}
