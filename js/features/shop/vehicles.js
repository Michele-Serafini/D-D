var TIPI_VEICOLO = ['Terrestre', 'Acquatico', 'Aereo', 'Spaziale', 'Altro'];

/* ---- helpers immagini veicoli ---- */
function _vehicleImages(v) {
  if (v.immagini && v.immagini.length > 0) return v.immagini;
  if (v.immagine) return [v.immagine];
  return [];
}

function _buildVehicleCarousel(immagini) {
  if (!immagini || immagini.length === 0) return null;
  var idx = 0;
  var outerWrap = document.createElement('div');
  outerWrap.style.cssText =
    'position:relative;width:100%;background:#0d0800;border-bottom:1px solid rgba(245,166,35,0.2);';
  var imgEl = createContentImage();
  imgEl.alt = '';
  imgEl.style.cssText =
    'width:100%;height:200px;object-fit:cover;display:block;transition:opacity 0.15s;';
  imgEl.src = immagini[0];
  imgEl.onerror = function () {
    this.style.display = 'none';
  };
  outerWrap.appendChild(imgEl);
  if (immagini.length > 1) {
    var counter = document.createElement('div');
    counter.style.cssText =
      "position:absolute;top:7px;right:8px;background:rgba(0,0,0,0.72);color:#f5a623;font-family:'Courier New',monospace;font-size:11px;font-weight:700;padding:0.15rem 0.45rem;border:1px solid rgba(245,166,35,0.5);pointer-events:none;";
    counter.textContent = '1 / ' + immagini.length;
    function goTo(i) {
      idx = ((i % immagini.length) + immagini.length) % immagini.length;
      imgEl.style.opacity = '0';
      setTimeout(function () {
        imgEl.src = immagini[idx];
        imgEl.style.opacity = '1';
      }, 130);
      counter.textContent = idx + 1 + ' / ' + immagini.length;
    }
    var prev = document.createElement('button');
    prev.style.cssText =
      'position:absolute;left:0;top:0;height:100%;width:36px;background:rgba(0,0,0,0.45);border:none;color:#f5a623;font-size:22px;font-weight:900;cursor:pointer;line-height:1;';
    prev.textContent = '‹';
    prev.onclick = function (e) {
      e.stopPropagation();
      goTo(idx - 1);
    };
    var next = document.createElement('button');
    next.style.cssText =
      'position:absolute;right:0;top:0;height:100%;width:36px;background:rgba(0,0,0,0.45);border:none;color:#f5a623;font-size:22px;font-weight:900;cursor:pointer;line-height:1;';
    next.textContent = '›';
    next.onclick = function (e) {
      e.stopPropagation();
      goTo(idx + 1);
    };
    outerWrap.appendChild(prev);
    outerWrap.appendChild(next);
    outerWrap.appendChild(counter);
  }
  return outerWrap;
}

function _buildVehicleImageEditor(form, ACCENT) {
  var wrap = document.createElement('div');
  var lbl = document.createElement('div');
  lbl.style.cssText =
    'font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-bottom:0.5rem;';
  lbl.textContent = '// IMMAGINI';
  wrap.appendChild(lbl);
  var thumbsWrap = document.createElement('div');
  thumbsWrap.style.cssText =
    'display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.65rem;min-height:36px;';
  function refreshThumbs() {
    thumbsWrap.innerHTML = '';
    var imgs = form.immagini || [];
    if (imgs.length === 0) {
      var none = document.createElement('div');
      none.style.cssText =
        "color:rgba(245,166,35,0.32);font-size:12px;padding:0.25rem 0;font-family:'Courier New',monospace;";
      none.textContent = '// nessuna immagine';
      thumbsWrap.appendChild(none);
    } else {
      imgs.forEach(function (src, i) {
        var t = document.createElement('div');
        t.style.cssText =
          'position:relative;width:72px;height:72px;border:1px solid rgba(245,166,35,0.4);overflow:hidden;flex-shrink:0;background:#111;';
        var im = createContentImage();
        if (/^(?:https?:\/\/|data:image\/(?:gif|jpe?g|png|webp);base64,)/i.test(src))
          im.src = encodeURI(src);
        im.alt = '';
        im.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        im.onerror = function () {
          im.style.display = 'none';
          t.style.background = 'rgba(245,166,35,0.08)';
        };
        var del = document.createElement('button');
        del.style.cssText =
          'position:absolute;top:1px;right:1px;background:rgba(180,20,20,0.88);border:none;color:#fff;font-size:10px;width:17px;height:17px;cursor:pointer;padding:0;line-height:1;font-weight:700;';
        del.textContent = '✕';
        (function (ii) {
          del.onclick = function () {
            form.immagini.splice(ii, 1);
            refreshThumbs();
          };
        })(i);
        t.appendChild(im);
        t.appendChild(del);
        thumbsWrap.appendChild(t);
      });
    }
  }
  refreshThumbs();
  wrap.appendChild(thumbsWrap);
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;';
  var fileBtn = document.createElement('button');
  fileBtn.type = 'button';
  fileBtn.style.cssText =
    "background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.45);color:#f5a623;font-family:'Courier New',monospace;font-size:12px;font-weight:700;padding:0.35rem 0.75rem;cursor:pointer;";
  fileBtn.textContent = '📁 Carica dal computer';
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.multiple = true;
  fileInput.style.display = 'none';
  fileInput.onchange = function () {
    var files = Array.prototype.slice.call(this.files);
    var remaining = files.length;
    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var MAX = 900,
            ratio = Math.min(MAX / img.width, MAX / img.height, 1);
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          if (!form.immagini) form.immagini = [];
          form.immagini.push(canvas.toDataURL('image/jpeg', 0.78));
          remaining--;
          if (remaining <= 0) refreshThumbs();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    fileInput.value = '';
  };
  fileBtn.onclick = function () {
    fileInput.click();
  };
  btnRow.appendChild(fileBtn);
  btnRow.appendChild(fileInput);
  wrap.appendChild(btnRow);
  var urlRow = document.createElement('div');
  urlRow.style.cssText = 'display:flex;gap:0.4rem;';
  var urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.placeholder = '> URL immagine diretta...';
  urlInput.style.cssText =
    "flex:1;background:rgba(245,166,35,0.04);border:1px solid rgba(245,166,35,0.25);color:#ffd080;font-family:'Courier New',monospace;font-size:13px;padding:0.4rem 0.6rem;outline:none;";
  var urlBtn = document.createElement('button');
  urlBtn.type = 'button';
  urlBtn.style.cssText =
    "background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.35);color:#f5a623;font-family:'Courier New',monospace;font-size:12px;font-weight:700;padding:0.4rem 0.7rem;cursor:pointer;white-space:nowrap;";
  urlBtn.textContent = '+ Aggiungi URL';
  urlBtn.onclick = function () {
    var url = urlInput.value.trim();
    if (!url) return;
    if (!form.immagini) form.immagini = [];
    form.immagini.push(url);
    urlInput.value = '';
    refreshThumbs();
  };
  urlRow.appendChild(urlInput);
  urlRow.appendChild(urlBtn);
  wrap.appendChild(urlRow);
  return wrap;
}
/* ---------------------------------- */

function renderEmporioVeicoli() {
  var ACCENT = '#f5a623';
  var wrap = document.createElement('div');
  wrap.style.cssText =
    "background:#0d0800;min-height:100vh;font-family:'Courier New',monospace;color:" + ACCENT + ';';

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText =
    'background:linear-gradient(180deg,rgba(25,12,0,0.98),rgba(13,8,0,0.95));border-bottom:2px solid rgba(245,166,35,0.3);padding:1.5rem 2rem 0;';
  var hdrRow = document.createElement('div');
  hdrRow.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;padding-bottom:1rem;';
  var hdrLeft = document.createElement('div');
  hdrLeft.innerHTML =
    '<div style="font-size:15px;font-weight:700;letter-spacing:0.15em;color:' +
    ACCENT +
    ';margin-bottom:0.4rem;">// EMPORIO — GARAGE &amp; HANGAR //</div>' +
    "<div style=\"font-family:'Cinzel',serif;font-size:2rem;font-weight:900;letter-spacing:0.3em;color:" +
    ACCENT +
    ';">▶ VEICOLI</div>';
  var hdrRight = document.createElement('div');
  hdrRight.style.cssText = 'display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;';
  if (isAdmin() && state.veicoliTab === 'catalogo') {
    var addBtn = document.createElement('button');
    addBtn.style.cssText =
      'background:rgba(245,166,35,0.12);border:2px solid ' +
      ACCENT +
      ';color:' +
      ACCENT +
      ";font-family:'Courier New',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.55rem 1.2rem;cursor:pointer;text-transform:uppercase;";
    addBtn.textContent = '+ NUOVO VEICOLO';
    addBtn.onclick = function () {
      state.veicoliShowForm = true;
      state.veicoliEditingId = null;
      renderMain();
    };
    hdrRight.appendChild(addBtn);
  }
  if (isAdmin() && state.veicoliTab === 'party') {
    var addPartyBtn = document.createElement('button');
    addPartyBtn.style.cssText =
      'background:rgba(245,166,35,0.12);border:2px solid ' +
      ACCENT +
      ';color:' +
      ACCENT +
      ";font-family:'Courier New',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.55rem 1.2rem;cursor:pointer;text-transform:uppercase;";
    addPartyBtn.textContent = '+ AGGIUNGI VEICOLO PARTY';
    addPartyBtn.onclick = function () {
      state.veicoliPartyShowForm = true;
      state.veicoliPartyEditingId = null;
      renderMain();
    };
    hdrRight.appendChild(addPartyBtn);
  }
  var backBtn = document.createElement('button');
  backBtn.style.cssText =
    'background:rgba(245,166,35,0.08);border:2px solid rgba(245,166,35,0.5);color:' +
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

  // Tab bar
  var tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;border-top:1px solid rgba(245,166,35,0.2);';
  [
    { id: 'catalogo', label: '🚗 Catalogo' },
    { id: 'party', label: '⚙ Veicoli del Party' },
  ].forEach(function (t) {
    var tb = document.createElement('button');
    var active = state.veicoliTab === t.id;
    tb.style.cssText =
      'padding:0.65rem 1.5rem;background:transparent;border:none;border-bottom:2px solid ' +
      (active ? ACCENT : 'transparent') +
      ';color:' +
      (active ? ACCENT : 'rgba(245,166,35,0.45)') +
      ";font-family:'Courier New',monospace;font-size:13px;font-weight:700;letter-spacing:0.1em;cursor:pointer;text-transform:uppercase;";
    tb.textContent = t.label;
    if (!active)
      tb.onclick = function () {
        state.veicoliTab = t.id;
        renderMain();
      };
    tabBar.appendChild(tb);
  });
  hdr.appendChild(tabBar);
  wrap.appendChild(hdr);

  // Tipo filter
  var filterBar = document.createElement('div');
  filterBar.style.cssText =
    'padding:0.75rem 2rem;display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;border-bottom:1px solid rgba(245,166,35,0.1);';
  var filterLbl = document.createElement('span');
  filterLbl.style.cssText =
    'font-size:11px;font-weight:700;letter-spacing:0.15em;color:rgba(245,166,35,0.45);margin-right:0.25rem;';
  filterLbl.textContent = 'TIPO:';
  filterBar.appendChild(filterLbl);
  var tipoOptions = [''].concat(TIPI_VEICOLO);
  tipoOptions.forEach(function (tipo) {
    var btn = document.createElement('button');
    var active = state.veicoliFilterTipo === tipo;
    btn.style.cssText =
      'background:' +
      (active ? 'rgba(245,166,35,0.2)' : 'rgba(245,166,35,0.04)') +
      ';border:1px solid ' +
      (active ? ACCENT : 'rgba(245,166,35,0.25)') +
      ';color:' +
      (active ? ACCENT : 'rgba(245,166,35,0.6)') +
      ";font-family:'Courier New',monospace;font-size:12px;padding:0.25rem 0.75rem;cursor:pointer;letter-spacing:0.08em;";
    btn.textContent = tipo || 'Tutti';
    btn.onclick = function () {
      state.veicoliFilterTipo = tipo;
      renderMain();
    };
    filterBar.appendChild(btn);
  });
  wrap.appendChild(filterBar);

  if (state.veicoliTab === 'catalogo') {
    // Search
    var srchWrap = document.createElement('div');
    srchWrap.style.cssText = 'padding:1rem 2rem 0.5rem;';
    var srch = document.createElement('input');
    srch.type = 'text';
    srch.placeholder = '> RICERCA CATALOGO VEICOLI...';
    srch.id = 'srch-veicoli';
    srch.value = state.veicoliSearch || '';
    srch.style.cssText =
      'width:100%;box-sizing:border-box;background:rgba(245,166,35,0.04);border:1px solid rgba(245,166,35,0.3);color:' +
      ACCENT +
      ";font-family:'Courier New',monospace;font-size:14px;padding:0.6rem 1rem;outline:none;";
    srch.oninput = function () {
      state.veicoliSearch = this.value;
      renderMain();
      var f = document.getElementById('srch-veicoli');
      if (f) {
        f.focus();
        var l = f.value.length;
        f.setSelectionRange(l, l);
      }
    };
    srchWrap.appendChild(srch);
    wrap.appendChild(srchWrap);

    var all = (state.veicoli || []).slice().sort(function (a, b) {
      return (a.nome || '').localeCompare(b.nome || '', 'it');
    });
    var q = (state.veicoliSearch || '').toLowerCase();
    var ft = state.veicoliFilterTipo;
    var filtered = all.filter(function (v) {
      if (ft && (v.tipo || '') !== ft) return false;
      if (
        q &&
        !(v.nome || '').toLowerCase().includes(q) &&
        !(v.tipo || '').toLowerCase().includes(q) &&
        !(v.descrizione || '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });

    var counter = document.createElement('div');
    counter.style.cssText =
      'padding:0.4rem 2rem 0;font-size:12px;color:rgba(245,166,35,0.45);letter-spacing:0.15em;';
    counter.textContent = '// ' + filtered.length + ' VEICOLI NEL CATALOGO';
    wrap.appendChild(counter);

    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText =
        'text-align:center;padding:4rem 2rem;color:rgba(245,166,35,0.3);font-size:16px;letter-spacing:0.1em;';
      empty.innerHTML =
        '🚗<br><br>NESSUN VEICOLO' +
        (isDM()
          ? '<div style="margin-top:1rem;font-size:14px;">> aggiungi il primo veicolo per iniziare</div>'
          : '');
      wrap.appendChild(empty);
    } else {
      var grid = document.createElement('div');
      grid.style.cssText =
        'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem;padding:1.5rem 2rem;';
      filtered.forEach(function (v) {
        grid.appendChild(renderVeicoloCard(v, false));
      });
      wrap.appendChild(grid);
    }
    if (state.veicoliShowForm) wrap.appendChild(renderVeicoloForm());
  } else {
    // Party tab
    var srchWrap2 = document.createElement('div');
    srchWrap2.style.cssText = 'padding:1rem 2rem 0.5rem;';
    var srch2 = document.createElement('input');
    srch2.type = 'text';
    srch2.placeholder = '> RICERCA VEICOLI DEL PARTY...';
    srch2.value = state.veicoliPartySearch || '';
    srch2.style.cssText =
      'width:100%;box-sizing:border-box;background:rgba(245,166,35,0.04);border:1px solid rgba(245,166,35,0.3);color:' +
      ACCENT +
      ";font-family:'Courier New',monospace;font-size:14px;padding:0.6rem 1rem;outline:none;";
    srch2.oninput = function () {
      state.veicoliPartySearch = this.value;
      renderMain();
    };
    srchWrap2.appendChild(srch2);
    wrap.appendChild(srchWrap2);

    var allP = (state.veicoliParty || []).slice().sort(function (a, b) {
      return (a.nome || '').localeCompare(b.nome || '', 'it');
    });
    var qP = (state.veicoliPartySearch || '').toLowerCase();
    var ftP = state.veicoliFilterTipo;
    var filteredP = allP.filter(function (v) {
      if (ftP && (v.tipo || '') !== ftP) return false;
      if (
        qP &&
        !(v.nome || '').toLowerCase().includes(qP) &&
        !(v.tipo || '').toLowerCase().includes(qP) &&
        !(v.descrizione || '').toLowerCase().includes(qP)
      )
        return false;
      return true;
    });

    var counter2 = document.createElement('div');
    counter2.style.cssText =
      'padding:0.4rem 2rem 0;font-size:12px;color:rgba(245,166,35,0.45);letter-spacing:0.15em;';
    counter2.textContent = '// ' + filteredP.length + ' VEICOLI DEL PARTY';
    wrap.appendChild(counter2);

    if (filteredP.length === 0) {
      var empty2 = document.createElement('div');
      empty2.style.cssText =
        'text-align:center;padding:4rem 2rem;color:rgba(245,166,35,0.3);font-size:16px;letter-spacing:0.1em;';
      empty2.innerHTML =
        '⚙<br><br>NESSUN VEICOLO NEL PARTY' +
        (isDM()
          ? '<div style="margin-top:1rem;font-size:14px;">> aggiungi dal catalogo o usa "+ AGGIUNGI VEICOLO PARTY"</div>'
          : '');
      wrap.appendChild(empty2);
    } else {
      var grid2 = document.createElement('div');
      grid2.style.cssText =
        'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem;padding:1.5rem 2rem;';
      filteredP.forEach(function (v) {
        grid2.appendChild(renderVeicoloCard(v, true));
      });
      wrap.appendChild(grid2);
    }
    if (state.veicoliPartyShowForm) wrap.appendChild(renderVeicoloPartyForm());
  }

  return wrap;
}

function renderVeicoloCard(v, isParty) {
  var ACCENT = '#f5a623';
  var card = document.createElement('div');
  card.style.cssText =
    'background:linear-gradient(135deg,rgba(30,15,0,0.95),rgba(15,8,0,0.95));border:2px solid ' +
    (isParty ? 'rgba(245,166,35,0.5)' : 'rgba(245,166,35,0.3)') +
    ';overflow:hidden;transition:border-color 0.2s,transform 0.2s;';
  card.onmouseenter = function () {
    this.style.borderColor = 'rgba(245,166,35,0.7)';
    this.style.transform = 'translateY(-3px)';
  };
  card.onmouseleave = function () {
    this.style.borderColor = isParty ? 'rgba(245,166,35,0.5)' : 'rgba(245,166,35,0.3)';
    this.style.transform = '';
  };

  var _vImgs = _vehicleImages(v);
  if (_vImgs.length > 0) {
    var _carousel = _buildVehicleCarousel(_vImgs);
    if (_carousel) card.appendChild(_carousel);
  }

  var head = document.createElement('div');
  head.style.cssText =
    'padding:1rem 1.2rem 0.6rem;border-bottom:1px solid rgba(245,166,35,0.15);display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;';
  var nameCol = document.createElement('div');
  if (v.tipo) {
    var tipoTag = document.createElement('div');
    tipoTag.style.cssText =
      'font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#f5a623;border:1px solid rgba(245,166,35,0.4);padding:0.2rem 0.5rem;display:inline-block;margin-bottom:0.4rem;';
    tipoTag.textContent = v.tipo;
    nameCol.appendChild(tipoTag);
  }
  var nameDiv = document.createElement('div');
  nameDiv.style.cssText =
    "font-family:'Cinzel',serif;font-size:20px;font-weight:700;color:#f5a623;line-height:1.2;";
  nameDiv.textContent = v.nome || 'Senza nome';
  nameCol.appendChild(nameDiv);
  head.appendChild(nameCol);
  card.appendChild(head);

  var body = document.createElement('div');
  body.style.cssText = 'padding:0.8rem 1.2rem;';
  if (v.velocita)
    body.innerHTML +=
      '<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-top:0.5rem;margin-bottom:0.25rem;">// VELOCITÀ</div><div style="font-size:16px;color:#ffd080;line-height:1.5;">' +
      nl2br(escapeHtml(v.velocita)) +
      '</div>';
  if (v.capacita)
    body.innerHTML +=
      '<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-top:0.7rem;margin-bottom:0.25rem;">// CAPACITÀ</div><div style="font-size:16px;color:#ffd080;">' +
      nl2br(escapeHtml(v.capacita)) +
      '</div>';
  if (v.pf)
    body.innerHTML +=
      '<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-top:0.7rem;margin-bottom:0.25rem;">// PF</div><div style="font-size:16px;color:#ffd080;">' +
      escapeHtml(v.pf) +
      '</div>';
  var _hasStats = v.stFor || v.stDes || v.stCos || v.stInt || v.stSag || v.stCar;
  if (_hasStats) {
    function _statMod(val) {
      var n = parseInt(val) || 10;
      return (n >= 10 ? '+' : '') + Math.floor((n - 10) / 2);
    }
    body.innerHTML +=
      '<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-top:0.7rem;margin-bottom:0.4rem;">// STATISTICHE</div>';
    var statsRow = document.createElement('div');
    statsRow.style.cssText =
      'display:grid;grid-template-columns:repeat(6,1fr);gap:4px;text-align:center;';
    [
      ['FOR', v.stFor],
      ['DES', v.stDes],
      ['COS', v.stCos],
      ['INT', v.stInt],
      ['SAG', v.stSag],
      ['CAR', v.stCar],
    ].forEach(function (st) {
      var cell = document.createElement('div');
      cell.style.cssText = 'border:1px solid rgba(245,166,35,0.25);padding:4px 2px;';
      var statName = document.createElement('div');
      statName.style.cssText = 'font-size:9px;font-weight:700;color:#c87d10;letter-spacing:0.08em;';
      statName.textContent = st[0];
      var statValue = document.createElement('div');
      statValue.style.cssText = 'font-size:15px;font-weight:700;color:#ffd080;';
      statValue.textContent = st[1] || '—';
      cell.appendChild(statName);
      cell.appendChild(statValue);
      if (st[1]) {
        var statMod = document.createElement('div');
        statMod.style.cssText = 'font-size:10px;color:rgba(255,208,128,0.6);';
        statMod.textContent = _statMod(st[1]);
        cell.appendChild(statMod);
      }
      statsRow.appendChild(cell);
    });
    body.appendChild(statsRow);
  }
  if (v.descrizione)
    body.innerHTML +=
      '<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-top:0.7rem;margin-bottom:0.25rem;">// DESCRIZIONE</div><div style="font-size:14px;color:#e8c070;line-height:1.5;">' +
      nl2br(escapeHtml(v.descrizione)) +
      '</div>';
  var _vs = _textScore(v.velocita, v.capacita, v.descrizione);
  if (_vs > 500) card.classList.add('card--wide');
  if (_vs > 1100) {
    body.style.maxHeight = '480px';
    body.style.overflowY = 'auto';
  }
  card.appendChild(body);

  var foot = document.createElement('div');
  foot.style.cssText =
    'padding:0.6rem 1.2rem;border-top:1px solid rgba(245,166,35,0.12);background:rgba(10,5,0,0.4);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;';
  var price = document.createElement('div');
  price.style.cssText = 'font-size:17px;font-weight:700;color:#f5a623;';
  price.textContent = v.costo ? v.costo + ' ' + (v.valuta || 'mo') : '— PREZZO N/D';
  foot.appendChild(price);
  if (isParty) {
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:0.4rem;';
    if (isAdmin()) {
      var editBtn = document.createElement('button');
      editBtn.style.cssText =
        'background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.4);color:#f5a623;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
      editBtn.textContent = '✎';
      editBtn.onclick = function () {
        state.veicoliPartyEditingId = v.id;
        state.veicoliPartyShowForm = true;
        renderMain();
      };
      var delBtn = document.createElement('button');
      delBtn.style.cssText =
        'background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.4);color:#ff8080;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
      delBtn.textContent = '✕';
      delBtn.onclick = function () {
        if (confirm('Rimuovere ' + (v.nome || 'questo veicolo') + ' dal party?')) {
          state.veicoliParty = (state.veicoliParty || []).filter(function (x) {
            return x.id !== v.id;
          });
          fbSaveVeicoliParty();
          renderMain();
        }
      };
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
    }
    foot.appendChild(actions);
  } else {
    var actions2 = document.createElement('div');
    actions2.style.cssText = 'display:flex;gap:0.4rem;flex-wrap:wrap;';
    if (isAdmin()) {
      var addParty = document.createElement('button');
      addParty.style.cssText =
        'background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.35);color:#f5a623;font-size:11px;font-weight:700;letter-spacing:0.06em;padding:0.3rem 0.6rem;cursor:pointer;text-transform:uppercase;';
      addParty.textContent = '+ Party';
      addParty.title = 'Aggiungi al Party';
      addParty.onclick = function () {
        var copy = Object.assign({}, v, {
          id: 'vp_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
        });
        if (!state.veicoliParty) state.veicoliParty = [];
        state.veicoliParty.push(copy);
        fbSaveVeicoliParty();
        notify('Veicolo aggiunto al Party!');
      };
      var editBtn2 = document.createElement('button');
      editBtn2.style.cssText =
        'background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.4);color:#f5a623;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
      editBtn2.textContent = '✎';
      editBtn2.onclick = function () {
        state.veicoliEditingId = v.id;
        state.veicoliShowForm = true;
        renderMain();
      };
      var delBtn2 = document.createElement('button');
      delBtn2.style.cssText =
        'background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.4);color:#ff8080;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
      delBtn2.textContent = '✕';
      delBtn2.onclick = function () {
        if (confirm('Eliminare ' + (v.nome || 'questo veicolo') + ' dal catalogo?')) {
          state.veicoli = (state.veicoli || []).filter(function (x) {
            return x.id !== v.id;
          });
          fbSaveVeicoli();
          renderMain();
        }
      };
      actions2.appendChild(addParty);
      actions2.appendChild(editBtn2);
      actions2.appendChild(delBtn2);
    }
    foot.appendChild(actions2);
  }
  if (!isParty) foot.appendChild(buildCommerceItemAction(v, 'veicoli'));
  card.appendChild(foot);
  card.classList.add('sium-grid-card-enter');
  card.style.cursor = 'pointer';
  card.onclick = function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('button')) return;
    if (window.SiumAnimations) {
      if (window.SiumAnimations.triggerCardClickPulse)
        window.SiumAnimations.triggerCardClickPulse(card, '#f5a623');
      if (window.SiumAnimations.openEmporioSubItemModal)
        window.SiumAnimations.openEmporioSubItemModal(
          isParty ? 'Veicolo del Party' : 'Catalogo Veicoli',
          v,
          '#f5a623'
        );
    }
  };
  return card;
}

function renderVeicoloForm() {
  var editing = null;
  if (state.veicoliEditingId)
    (state.veicoli || []).forEach(function (x) {
      if (x.id === state.veicoliEditingId) editing = x;
    });
  var _eImgs = editing
    ? editing.immagini && editing.immagini.length
      ? editing.immagini.slice()
      : editing.immagine
        ? [editing.immagine]
        : []
    : [];
  var form = {
    nome: editing ? editing.nome : '',
    tipo: editing ? editing.tipo : TIPI_VEICOLO[0],
    pf: editing ? editing.pf : '',
    costo: editing ? editing.costo : 0,
    valuta: editing ? editing.valuta : 'mo',
    velocita: editing ? editing.velocita : '',
    capacita: editing ? editing.capacita : '',
    descrizione: editing ? editing.descrizione : '',
    immagini: _eImgs,
    stFor: editing ? editing.stFor : '',
    stDes: editing ? editing.stDes : '',
    stCos: editing ? editing.stCos : '',
    stInt: editing ? editing.stInt : '',
    stSag: editing ? editing.stSag : '',
    stCar: editing ? editing.stCar : '',
  };

  var backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick = function (e) {
    if (e.target === backdrop) {
      state.veicoliShowForm = false;
      state.veicoliEditingId = null;
      renderMain();
    }
  };

  var panel = document.createElement('div');
  panel.style.cssText =
    'background:#0d0800;border:2px solid rgba(245,166,35,0.4);padding:0;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick = function (e) {
    e.stopPropagation();
  };

  var mhead = document.createElement('div');
  mhead.style.cssText =
    'padding:1rem 1.5rem;border-bottom:1px solid rgba(245,166,35,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML =
    '<div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:#f5a623;letter-spacing:0.1em;">' +
    (editing ? '✎ MODIFICA VEICOLO' : '+ NUOVO VEICOLO') +
    '</div>';
  var closeB = document.createElement('button');
  closeB.style.cssText = 'background:none;border:none;color:#f5a623;font-size:20px;cursor:pointer;';
  closeB.textContent = '✕';
  closeB.onclick = function () {
    state.veicoliShowForm = false;
    state.veicoliEditingId = null;
    renderMain();
  };
  mhead.appendChild(closeB);
  panel.appendChild(mhead);

  var mbody = document.createElement('div');
  mbody.style.cssText = 'padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';

  function vField(lbl, key, type, opts) {
    var g = document.createElement('div');
    var l = document.createElement('label');
    l.style.cssText =
      'display:block;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-bottom:0.3rem;';
    l.textContent = '// ' + lbl;
    g.appendChild(l);
    var el;
    var fStyle =
      "width:100%;background:rgba(245,166,35,0.05);border:1px solid rgba(245,166,35,0.3);color:#ffd080;font-family:'Courier New',monospace;font-size:15px;padding:0.55rem 0.75rem;outline:none;box-sizing:border-box;";
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

  mbody.appendChild(vField('NOME VEICOLO', 'nome', 'text'));
  mbody.appendChild(vField('TIPO', 'tipo', 'select', TIPI_VEICOLO));
  var r2 = document.createElement('div');
  r2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;';
  r2.appendChild(vField('VELOCITÀ', 'velocita', 'text'));
  r2.appendChild(vField('CAPACITÀ', 'capacita', 'text'));
  r2.appendChild(vField('PF (Punti Ferita)', 'pf', 'text'));
  mbody.appendChild(r2);
  var rStats = document.createElement('div');
  var statsLbl = document.createElement('div');
  statsLbl.style.cssText =
    'font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-bottom:0.4rem;';
  statsLbl.textContent = '// STATISTICHE (opzionale)';
  rStats.appendChild(statsLbl);
  var statsGrid = document.createElement('div');
  statsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;';
  [
    ['FOR', 'stFor'],
    ['DES', 'stDes'],
    ['COS', 'stCos'],
    ['INT', 'stInt'],
    ['SAG', 'stSag'],
    ['CAR', 'stCar'],
  ].forEach(function (st) {
    var g = document.createElement('div');
    g.style.cssText = 'text-align:center;';
    var l = document.createElement('div');
    l.style.cssText = 'font-size:10px;font-weight:700;color:#c87d10;margin-bottom:0.2rem;';
    l.textContent = st[0];
    g.appendChild(l);
    var inp = document.createElement('input');
    inp.type = 'number';
    inp.min = 1;
    inp.max = 30;
    inp.value = form[st[1]] || '';
    inp.placeholder = '—';
    inp.style.cssText =
      "width:100%;text-align:center;background:rgba(245,166,35,0.05);border:1px solid rgba(245,166,35,0.3);color:#ffd080;font-family:'Courier New',monospace;font-size:15px;padding:0.4rem 0.2rem;outline:none;box-sizing:border-box;";
    (function (k) {
      inp.oninput = function () {
        form[k] = this.value ? Number(this.value) : '';
      };
    })(st[1]);
    g.appendChild(inp);
    statsGrid.appendChild(g);
  });
  rStats.appendChild(statsGrid);
  mbody.appendChild(rStats);
  var r3 = document.createElement('div');
  r3.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  r3.appendChild(vField('COSTO', 'costo', 'number'));
  r3.appendChild(
    vField(
      'VALUTA',
      'valuta',
      'select',
      VALUTE.map(function (v) {
        return v.code;
      })
    )
  );
  mbody.appendChild(r3);
  mbody.appendChild(vField('DESCRIZIONE', 'descrizione', 'textarea'));
  mbody.appendChild(_buildVehicleImageEditor(form, '#f5a623'));

  var saveBtn = document.createElement('button');
  saveBtn.style.cssText =
    "width:100%;background:rgba(245,166,35,0.12);border:2px solid #f5a623;color:#f5a623;font-family:'Courier New',monospace;font-size:15px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;";
  saveBtn.textContent = editing ? '> SALVA MODIFICHE' : '> AGGIUNGI AL DATABASE';
  saveBtn.onclick = function () {
    if (!form.nome.trim()) {
      notify('Inserisci il nome del veicolo.', 'err');
      return;
    }
    var saved = Object.assign({}, form, { immagini: form.immagini || [] });
    delete saved.immagine;
    if (editing) {
      state.veicoli = (state.veicoli || []).map(function (x) {
        return x.id === editing.id ? Object.assign({}, saved, { id: editing.id }) : x;
      });
    } else {
      if (!state.veicoli) state.veicoli = [];
      state.veicoli.push(Object.assign({}, saved, { id: 've_' + Date.now() }));
    }
    fbSaveVeicoli();
    notify(editing ? 'Veicolo aggiornato.' : 'Veicolo aggiunto al database.');
    state.veicoliShowForm = false;
    state.veicoliEditingId = null;
    renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}

function renderVeicoloPartyForm() {
  var editing = null;
  if (state.veicoliPartyEditingId)
    (state.veicoliParty || []).forEach(function (x) {
      if (x.id === state.veicoliPartyEditingId) editing = x;
    });
  var _epImgs = editing
    ? editing.immagini && editing.immagini.length
      ? editing.immagini.slice()
      : editing.immagine
        ? [editing.immagine]
        : []
    : [];
  var form = {
    nome: editing ? editing.nome : '',
    tipo: editing ? editing.tipo : TIPI_VEICOLO[0],
    pf: editing ? editing.pf : '',
    costo: editing ? editing.costo : 0,
    valuta: editing ? editing.valuta : 'mo',
    velocita: editing ? editing.velocita : '',
    capacita: editing ? editing.capacita : '',
    descrizione: editing ? editing.descrizione : '',
    immagini: _epImgs,
    stFor: editing ? editing.stFor : '',
    stDes: editing ? editing.stDes : '',
    stCos: editing ? editing.stCos : '',
    stInt: editing ? editing.stInt : '',
    stSag: editing ? editing.stSag : '',
    stCar: editing ? editing.stCar : '',
  };

  var backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick = function (e) {
    if (e.target === backdrop) {
      state.veicoliPartyShowForm = false;
      state.veicoliPartyEditingId = null;
      renderMain();
    }
  };

  var panel = document.createElement('div');
  panel.style.cssText =
    'background:#0d0800;border:2px solid rgba(245,166,35,0.6);padding:0;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick = function (e) {
    e.stopPropagation();
  };

  var mhead = document.createElement('div');
  mhead.style.cssText =
    'padding:1rem 1.5rem;border-bottom:1px solid rgba(245,166,35,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML =
    '<div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:#f5a623;letter-spacing:0.1em;">' +
    (editing ? '✎ MODIFICA VEICOLO PARTY' : '+ NUOVO VEICOLO PARTY') +
    '</div>';
  var closeB = document.createElement('button');
  closeB.style.cssText = 'background:none;border:none;color:#f5a623;font-size:20px;cursor:pointer;';
  closeB.textContent = '✕';
  closeB.onclick = function () {
    state.veicoliPartyShowForm = false;
    state.veicoliPartyEditingId = null;
    renderMain();
  };
  mhead.appendChild(closeB);
  panel.appendChild(mhead);

  var mbody = document.createElement('div');
  mbody.style.cssText = 'padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';

  function vpField(lbl, key, type, opts) {
    var g = document.createElement('div');
    var l = document.createElement('label');
    l.style.cssText =
      'display:block;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-bottom:0.3rem;';
    l.textContent = '// ' + lbl;
    g.appendChild(l);
    var el;
    var fStyle =
      "width:100%;background:rgba(245,166,35,0.05);border:1px solid rgba(245,166,35,0.3);color:#ffd080;font-family:'Courier New',monospace;font-size:15px;padding:0.55rem 0.75rem;outline:none;box-sizing:border-box;";
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

  mbody.appendChild(vpField('NOME VEICOLO', 'nome', 'text'));
  mbody.appendChild(vpField('TIPO', 'tipo', 'select', TIPI_VEICOLO));
  var r2 = document.createElement('div');
  r2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;';
  r2.appendChild(vpField('VELOCITÀ', 'velocita', 'text'));
  r2.appendChild(vpField('CAPACITÀ', 'capacita', 'text'));
  r2.appendChild(vpField('PF (Punti Ferita)', 'pf', 'text'));
  mbody.appendChild(r2);
  var rStatsP = document.createElement('div');
  var statsLblP = document.createElement('div');
  statsLblP.style.cssText =
    'font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-bottom:0.4rem;';
  statsLblP.textContent = '// STATISTICHE (opzionale)';
  rStatsP.appendChild(statsLblP);
  var statsGridP = document.createElement('div');
  statsGridP.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;';
  [
    ['FOR', 'stFor'],
    ['DES', 'stDes'],
    ['COS', 'stCos'],
    ['INT', 'stInt'],
    ['SAG', 'stSag'],
    ['CAR', 'stCar'],
  ].forEach(function (st) {
    var g = document.createElement('div');
    g.style.cssText = 'text-align:center;';
    var l = document.createElement('div');
    l.style.cssText = 'font-size:10px;font-weight:700;color:#c87d10;margin-bottom:0.2rem;';
    l.textContent = st[0];
    g.appendChild(l);
    var inp = document.createElement('input');
    inp.type = 'number';
    inp.min = 1;
    inp.max = 30;
    inp.value = form[st[1]] || '';
    inp.placeholder = '—';
    inp.style.cssText =
      "width:100%;text-align:center;background:rgba(245,166,35,0.05);border:1px solid rgba(245,166,35,0.3);color:#ffd080;font-family:'Courier New',monospace;font-size:15px;padding:0.4rem 0.2rem;outline:none;box-sizing:border-box;";
    (function (k) {
      inp.oninput = function () {
        form[k] = this.value ? Number(this.value) : '';
      };
    })(st[1]);
    g.appendChild(inp);
    statsGridP.appendChild(g);
  });
  rStatsP.appendChild(statsGridP);
  mbody.appendChild(rStatsP);
  var r3 = document.createElement('div');
  r3.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  r3.appendChild(vpField('COSTO', 'costo', 'number'));
  r3.appendChild(
    vpField(
      'VALUTA',
      'valuta',
      'select',
      VALUTE.map(function (v) {
        return v.code;
      })
    )
  );
  mbody.appendChild(r3);
  mbody.appendChild(vpField('DESCRIZIONE', 'descrizione', 'textarea'));
  mbody.appendChild(_buildVehicleImageEditor(form, '#f5a623'));

  var saveBtn = document.createElement('button');
  saveBtn.style.cssText =
    "width:100%;background:rgba(245,166,35,0.12);border:2px solid #f5a623;color:#f5a623;font-family:'Courier New',monospace;font-size:15px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;";
  saveBtn.textContent = editing ? '> SALVA MODIFICHE' : '> AGGIUNGI AL PARTY';
  saveBtn.onclick = function () {
    if (!form.nome.trim()) {
      notify('Inserisci il nome del veicolo.', 'err');
      return;
    }
    var saved = Object.assign({}, form, { immagini: form.immagini || [] });
    delete saved.immagine;
    if (!state.veicoliParty) state.veicoliParty = [];
    if (editing) {
      state.veicoliParty = state.veicoliParty.map(function (x) {
        return x.id === editing.id ? Object.assign({}, saved, { id: editing.id }) : x;
      });
    } else {
      state.veicoliParty.push(Object.assign({}, saved, { id: 'vp_' + Date.now() }));
    }
    fbSaveVeicoliParty();
    notify(editing ? 'Veicolo party aggiornato.' : 'Veicolo aggiunto al Party.');
    state.veicoliPartyShowForm = false;
    state.veicoliPartyEditingId = null;
    renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}
