/* ============================================================
   STORIA DELLA CAMPAGNA
   ============================================================ */
var _storiaLeafletMap = null;
var _storiaFlagLayer = null;
var _storiaFlagMarkers = {};
var _storiaAnchorMode = false;
var _storiaSelectedRange = null;
function _storiePrivatePath() {
  var user =
    state.currentUser && state.currentUser.username ? state.currentUser.username : '_guest';
  return 'storie_private/' + user;
}

function fbSaveStoriaMarkers(mapId) {
  if (!_campaignDb || !state.currentUser) return;
  var mid = mapId || state.mappaActiveId || 'default';
  var u = state.currentUser.username;
  var markers =
    state.storia.markers && Object.keys(state.storia.markers).length > 0
      ? state.storia.markers
      : null;
  _campaignDb.ref('state/storia_markers/' + u + '/' + mid).set(markers);
}

function fbLoadStoriaMarkers(mapId) {
  var mid = mapId || state.mappaActiveId || 'default';
  state.storia.markers =
    window._storiaMarkersCache &&
    window._storiaMarkersCache[mid] &&
    typeof window._storiaMarkersCache[mid] === 'object'
      ? window._storiaMarkersCache[mid]
      : {};
}

function _salvaStoriaConNome(nome, callback) {
  if (!_campaignDb || !state.currentUser) {
    if (callback) callback(new Error('Firebase non connesso'));
    return;
  }
  var ed = document.getElementById('storia-editor');
  if (ed) state.storia.content = ed.innerHTML;
  var id = state.storia.currentStoryId || _campaignDb.ref().push().key;
  _campaignDb.ref(_storiePrivatePath() + '/' + id).set(
    {
      nome: nome,
      content: state.storia.content || '',
      savedAt: Date.now(),
    },
    function (err) {
      if (!err) {
        state.storia.currentStoryId = id;
        state.storia.currentStoryName = nome;
        saveToStorage();
      }
      if (callback) callback(err);
    }
  );
}

function _caricaLibreria(callback) {
  if (!_campaignDb || !state.currentUser) {
    if (callback) callback({});
    return;
  }
  _campaignDb.ref(_storieActivePath()).once('value', function (snap) {
    if (callback) callback(snap.val() || {});
  });
}

function _caricaLibreriaTutti(callback) {
  if (!_campaignDb) {
    callback([]);
    return;
  }
  var usernames = CampaignManager.profiles() ? Object.keys(CampaignManager.profiles()) : [];
  var myUser = state.currentUser && state.currentUser.username;
  if (myUser && usernames.indexOf(myUser) < 0) usernames.push(myUser);
  if (usernames.length === 0) {
    callback([]);
    return;
  }
  var allStories = [];
  var done = 0;
  usernames.forEach(function (uid) {
    _campaignDb.ref('storie_private/' + uid).once('value', function (snap) {
      var v = snap.val();
      if (v && typeof v === 'object') {
        Object.keys(v).forEach(function (id) {
          if (v[id]) allStories.push(Object.assign({}, v[id], { _owner: uid, _realId: id }));
        });
      }
      done++;
      if (done === usernames.length) {
        allStories.sort(function (a, b) {
          return (b.savedAt || 0) - (a.savedAt || 0);
        });
        callback(allStories);
      }
    });
  });
}

function storiaFlushSave() {
  var ed = document.getElementById('storia-editor');
  if (ed) state.storia.content = ed.innerHTML;
}

function storiaScheduleSave() {
  if (window._storiaSaveTimer) clearTimeout(window._storiaSaveTimer);
  window._storiaSaveTimer = setTimeout(storiaFlushSave, 800);
}

function storiaHighlightNpcs(editor) {
  var nomes = (state.personaggi || [])
    .map(function (p) {
      return p.nome;
    })
    .filter(Boolean);
  nomes.sort(function (a, b) {
    return b.length - a.length;
  }); // più lunghi prima
  if (!nomes.length) return;

  // 1. Rimuovi span NPC già presenti
  Array.from(editor.querySelectorAll('[data-storia-npc]')).forEach(function (s) {
    var p = s.parentNode;
    while (s.firstChild) p.insertBefore(s.firstChild, s);
    p.removeChild(s);
  });
  editor.normalize();

  // 2. Processa text-node con TreeWalker
  var walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (n) {
        var anc = n.parentNode;
        while (anc && anc !== editor) {
          if (anc.classList && anc.classList.contains('storia-map-link'))
            return NodeFilter.FILTER_REJECT;
          anc = anc.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
    false
  );

  var textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach(function (tn) {
    var text = tn.nodeValue;
    var matches = [];
    nomes.forEach(function (nome) {
      var idx = 0;
      while (true) {
        var pos = text.indexOf(nome, idx);
        if (pos < 0) break;
        matches.push({ start: pos, end: pos + nome.length, nome: nome });
        idx = pos + 1;
      }
    });
    if (!matches.length) return;
    matches.sort(function (a, b) {
      return a.start - b.start;
    });
    var filtered = [],
      lastEnd = 0;
    matches.forEach(function (m) {
      if (m.start >= lastEnd) {
        filtered.push(m);
        lastEnd = m.end;
      }
    });
    if (!filtered.length) return;

    var frag = document.createDocumentFragment(),
      lastPos = 0;
    filtered.forEach(function (m) {
      if (m.start > lastPos)
        frag.appendChild(document.createTextNode(text.slice(lastPos, m.start)));
      var sp = document.createElement('span');
      sp.dataset.storiaNpc = m.nome;
      sp.textContent = text.slice(m.start, m.end);
      frag.appendChild(sp);
      lastPos = m.end;
    });
    if (lastPos < text.length) frag.appendChild(document.createTextNode(text.slice(lastPos)));
    tn.parentNode.replaceChild(frag, tn);
  });

  state.storia.content = editor.innerHTML;
}

function showStoriaTooltip(e, npc) {
  var tt = document.getElementById('storia-npc-tooltip');
  if (!tt) return;
  tt.innerHTML = '';
  if (npc.immagine) {
    var img = document.createElement('img');
    img.src = safeImageUrl(npc.immagine);
    img.className = 'sntt-img';
    img.onerror = function () {
      this.className = 'sntt-img-ph';
      this.alt = npc.nome || '';
    };
    tt.appendChild(img);
  } else {
    var ph = document.createElement('div');
    ph.className = 'sntt-img-ph';
    ph.textContent = npc.nome || '?';
    tt.appendChild(ph);
  }
  var body = document.createElement('div');
  body.className = 'sntt-body';
  var nomEl = document.createElement('div');
  nomEl.className = 'sntt-nome';
  nomEl.textContent = npc.nome + (npc.ruolo ? ' — ' + npc.ruolo : '');
  body.appendChild(nomEl);
  if (npc.background) {
    var bg = document.createElement('div');
    bg.className = 'sntt-bg';
    bg.textContent = npc.background;
    body.appendChild(bg);
  }
  tt.appendChild(body);
  tt.style.display = 'block';
  var x = e.clientX + 14,
    y = e.clientY - 16;
  tt.style.left = Math.min(x, window.innerWidth - 260) + 'px';
  tt.style.top = Math.min(y, window.innerHeight - 280) + 'px';
}
function hideStoriaTooltip() {
  var tt = document.getElementById('storia-npc-tooltip');
  if (tt) tt.style.display = 'none';
}

function getStoriaMarkerIcon(selected, type) {
  var t = type || 'pin';
  var selColor = selected ? '#ffd060' : null;
  var selStroke = selected ? '#a07800' : null;
  var shadow = 'filter:drop-shadow(0 2px 5px rgba(0,0,0,0.7));';

  if (t === 'clock') {
    var fc = selColor || '#7ec8e3';
    var sc = selStroke || '#2a7a9a';
    var html =
      '<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;' +
      shadow +
      '">' +
      '<svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="12" cy="12" r="10" fill="' +
      fc +
      '" stroke="' +
      sc +
      '" stroke-width="1.5"/>' +
      '<circle cx="12" cy="12" r="9" fill="none" stroke="white" stroke-width="0.5" opacity="0.4"/>' +
      '<line x1="12" y1="12" x2="12" y2="6.5" stroke="' +
      sc +
      '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="12" y1="12" x2="15.5" y2="12" stroke="' +
      sc +
      '" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="12" cy="12" r="1.2" fill="' +
      sc +
      '"/>' +
      '</svg></div>';
    return L.divIcon({ className: '', html: html, iconSize: [28, 28], iconAnchor: [14, 14] });
  }

  if (t === 'swords') {
    var fc2 = selColor || '#e09060';
    var sc2 = selStroke || '#8a4020';
    var html2 =
      '<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;' +
      shadow +
      '">' +
      '<svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="12" cy="12" r="11" fill="' +
      fc2 +
      '" stroke="' +
      sc2 +
      '" stroke-width="1.2"/>' +
      '<g stroke="white" stroke-linecap="round">' +
      '<line x1="6" y1="18" x2="18" y2="6" stroke-width="2"/>' +
      '<line x1="18" y1="18" x2="6" y2="6" stroke-width="2"/>' +
      '<line x1="6" y1="8" x2="8" y2="6" stroke-width="1.5"/>' +
      '<line x1="4" y1="10" x2="6" y2="8" stroke-width="1.5"/>' +
      '<line x1="18" y1="16" x2="16" y2="18" stroke-width="1.5"/>' +
      '<line x1="20" y1="14" x2="18" y2="16" stroke-width="1.5"/>' +
      '<line x1="18" y1="8" x2="16" y2="6" stroke-width="1.5"/>' +
      '<line x1="20" y1="10" x2="18" y2="8" stroke-width="1.5"/>' +
      '<line x1="6" y1="16" x2="8" y2="18" stroke-width="1.5"/>' +
      '<line x1="4" y1="14" x2="6" y2="16" stroke-width="1.5"/>' +
      '</g>' +
      '</svg></div>';
    return L.divIcon({ className: '', html: html2, iconSize: [28, 28], iconAnchor: [14, 14] });
  }

  // default: pin rosso
  var color = selColor || '#e06060';
  var stroke = selStroke || '#a03030';
  return L.divIcon({
    className: '',
    html:
      '<div style="width:22px;height:30px;display:flex;align-items:flex-end;justify-content:center;' +
      shadow +
      '">' +
      '<svg viewBox="0 0 22 30" width="22" height="30" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M11 1C7.13 1 4 4.13 4 8c0 5.25 7 16 7 16s7-10.75 7-16c0-3.87-3.13-7-7-7z" fill="' +
      color +
      '" stroke="' +
      stroke +
      '" stroke-width="1"/>' +
      '<circle cx="11" cy="8" r="3" fill="white" opacity="0.85"/></svg></div>',
    iconSize: [22, 30],
    iconAnchor: [11, 28],
  });
}

function refreshStoriaMarkers() {
  if (!_storiaLeafletMap || !_storiaFlagLayer) return;
  _storiaFlagLayer.clearLayers();
  _storiaFlagMarkers = {};
  Object.keys(state.storia.markers || {}).forEach(function (mid) {
    var m = state.storia.markers[mid];
    if (typeof m.lat !== 'number' || typeof m.lng !== 'number') return;
    var icon = getStoriaMarkerIcon(state.storia.selectedMarker === mid, m.type);
    var mk = L.marker([m.lat, m.lng], { icon: icon });
    mk.on('click', function () {
      state.storia.selectedMarker = mid;
      refreshStoriaMarkers();
      var panel = document.getElementById('storia-marker-panel');
      if (panel) {
        panel.classList.add('open');
        renderStoriaMarkerPanel(panel, mid);
      }
    });
    mk.addTo(_storiaFlagLayer);
    _storiaFlagMarkers[mid] = mk;
  });
}

function initStoriaMap() {
  if (typeof L === 'undefined') {
    ensureLeaflet()
      .then(initStoriaMap)
      .catch(function (error) {
        notify(error.message);
      });
    return;
  }
  var mapDiv = document.getElementById('storia-leaflet-map');
  if (!mapDiv) return;
  if (_storiaLeafletMap) {
    try {
      _storiaLeafletMap.remove();
    } catch (e) {}
    _storiaLeafletMap = null;
  }
  mapDiv.innerHTML = '';

  if (!state.mappaUrl) {
    mapDiv.innerHTML =
      '<div style="padding:1.5rem;color:var(--text-muted);font-family:\'EB Garamond\',serif;">Nessuna mappa attiva. Carica prima una mappa nella sezione <em>Mappa del Mondo</em>.</div>';
    return;
  }
  var img = new Image();
  img.onload = function () {
    var w = img.naturalWidth || 1000,
      h = img.naturalHeight || 700;
    var bounds = [
      [0, 0],
      [h, w],
    ];
    _storiaLeafletMap = L.map(mapDiv, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      zoomControl: false,
      attributionControl: false,
    });
    L.imageOverlay(state.mappaUrl, bounds).addTo(_storiaLeafletMap);
    _storiaLeafletMap.fitBounds(bounds);
    _storiaFlagLayer = L.layerGroup().addTo(_storiaLeafletMap);
    refreshStoriaMarkers();

    _storiaLeafletMap.on('click', function (e) {
      if (state.storia.mapMode !== 'place') return;
      var mid = 'sm_' + Date.now();
      if (!state.storia.markers) state.storia.markers = {};
      state.storia.markers[mid] = {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        image: '',
        text: '',
        type: state.storia.markerType || 'pin',
      };

      // Se in anchor mode, collega il testo selezionato al marker
      if (_storiaAnchorMode && _storiaSelectedRange) {
        var ed = document.getElementById('storia-editor');
        if (ed && _storiaSelectedRange.toString().trim()) {
          try {
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(_storiaSelectedRange);
            var sp = document.createElement('span');
            sp.className = 'storia-map-link';
            sp.dataset.markerId = mid;
            _storiaSelectedRange.surroundContents(sp);
            state.storia.content = ed.innerHTML;
          } catch (err) {
            console.warn('Anchor error', err);
          }
        }
        _storiaAnchorMode = false;
        _storiaSelectedRange = null;
        var ab = document.getElementById('storia-anchor-btn');
        if (ab) ab.className = 'storia-anchor-btn';
        state.storia.mapMode = 'move';
        updateStoriaMapToolbar();
      }

      refreshStoriaMarkers();
      saveToStorage();
      fbSaveStoriaMarkers();
      state.storia.selectedMarker = mid;
      var panel = document.getElementById('storia-marker-panel');
      if (panel) {
        panel.classList.add('open');
        renderStoriaMarkerPanel(panel, mid);
      }
    });
  };
  img.onerror = function () {
    if (mapDiv)
      mapDiv.innerHTML =
        '<div style="padding:1.5rem;color:var(--text-muted);">Impossibile caricare la mappa.</div>';
  };
  img.src = state.mappaUrl;
}

function updateStoriaMapToolbar() {
  var mv = document.getElementById('storia-move-mode-btn');
  if (mv)
    mv.className = 'storia-map-mode-btn' + (state.storia.mapMode !== 'place' ? ' active' : '');
  var mt = state.storia.markerType || 'pin';
  var pinB = document.getElementById('storia-marker-type-pin');
  var clkB = document.getElementById('storia-marker-type-clock');
  var swdB = document.getElementById('storia-marker-type-swords');
  if (pinB)
    pinB.className =
      'storia-map-mode-btn' + (state.storia.mapMode === 'place' && mt === 'pin' ? ' active' : '');
  if (clkB)
    clkB.className =
      'storia-map-mode-btn' + (state.storia.mapMode === 'place' && mt === 'clock' ? ' active' : '');
  if (swdB)
    swdB.className =
      'storia-map-mode-btn' +
      (state.storia.mapMode === 'place' && mt === 'swords' ? ' active' : '');
}

function renderStoriaMarkerPanel(panel, mid) {
  var m = state.storia.markers[mid] || {};
  panel.innerHTML = '';

  function _closePanel() {
    panel.classList.remove('open');
    state.storia.selectedMarker = null;
    refreshStoriaMarkers();
  }

  // Click sul backdrop (fuori dalla card) chiude il pannello
  panel.onclick = function (e) {
    if (e.target === panel) _closePanel();
  };

  var inner = document.createElement('div');
  inner.className = 'storia-marker-inner';
  inner.onclick = function (e) {
    e.stopPropagation();
  };
  panel.appendChild(inner);

  var closeBtn = document.createElement('button');
  closeBtn.className = 'storia-marker-close-btn';
  closeBtn.innerHTML = '✕';
  closeBtn.onclick = _closePanel;
  inner.appendChild(closeBtn);

  // Immagine
  var imgLbl = document.createElement('span');
  imgLbl.className = 'storia-marker-field-lbl';
  imgLbl.textContent = 'IMMAGINE';
  inner.appendChild(imgLbl);
  if (m.image) {
    var preview = document.createElement('img');
    preview.src = m.image;
    preview.className = 'storia-marker-img-preview';
    preview.onerror = function () {
      this.style.display = 'none';
    };
    inner.appendChild(preview);
  }
  var imgRow = document.createElement('div');
  imgRow.style.cssText = 'display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.4rem;';
  var imgFileBtn = document.createElement('button');
  imgFileBtn.className = 'storia-fmt-btn';
  imgFileBtn.style.cssText = 'font-size:11px;padding:0.15rem 0.4rem;';
  imgFileBtn.textContent = '📂 File';
  imgFileBtn.onclick = function () {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files[0];
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) {
        alert('Immagine troppo grande (max 3 MB)');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        state.storia.markers[mid].image = ev.target.result;
        saveToStorage();
        fbSaveStoriaMarkers();
        renderStoriaMarkerPanel(panel, mid);
      };
      reader.readAsDataURL(f);
    };
    inp.click();
  };
  imgRow.appendChild(imgFileBtn);
  var imgUrlBtn = document.createElement('button');
  imgUrlBtn.className = 'storia-fmt-btn';
  imgUrlBtn.style.cssText = 'font-size:11px;padding:0.15rem 0.4rem;';
  imgUrlBtn.textContent = '🔗 URL';
  imgUrlBtn.onclick = function () {
    var url = prompt('URL immagine:', m.image || '');
    if (url !== null) {
      state.storia.markers[mid].image = url;
      saveToStorage();
      fbSaveStoriaMarkers();
      renderStoriaMarkerPanel(panel, mid);
    }
  };
  imgRow.appendChild(imgUrlBtn);
  if (m.image) {
    var delImgBtn = document.createElement('button');
    delImgBtn.className = 'storia-fmt-btn';
    delImgBtn.style.cssText = 'font-size:11px;padding:0.15rem 0.4rem;color:#ffa0a0;';
    delImgBtn.textContent = '✕';
    delImgBtn.onclick = function () {
      state.storia.markers[mid].image = '';
      saveToStorage();
      fbSaveStoriaMarkers();
      renderStoriaMarkerPanel(panel, mid);
    };
    imgRow.appendChild(delImgBtn);
  }
  inner.appendChild(imgRow);

  // Testo
  var txtLbl = document.createElement('span');
  txtLbl.className = 'storia-marker-field-lbl';
  txtLbl.textContent = 'NOTE';
  inner.appendChild(txtLbl);
  var ta = document.createElement('textarea');
  ta.className = 'storia-marker-textarea';
  ta.value = m.text || '';
  ta.placeholder = 'Descrizione del luogo...';
  ta.oninput = function () {
    state.storia.markers[mid].text = this.value;
    saveToStorage();
    if (window._smSaveTimer) clearTimeout(window._smSaveTimer);
    window._smSaveTimer = setTimeout(fbSaveStoriaMarkers, 1000);
  };
  inner.appendChild(ta);

  // Elimina
  var delBtn = document.createElement('button');
  delBtn.className = 'storia-marker-del-btn';
  delBtn.textContent = '🗑 Elimina segnalino';
  delBtn.onclick = function () {
    if (!confirm('Eliminare questo segnalino?')) return;
    delete state.storia.markers[mid];
    saveToStorage();
    fbSaveStoriaMarkers();
    _closePanel();
    var ed = document.getElementById('storia-editor');
    if (ed) {
      ed.querySelectorAll('.storia-map-link[data-marker-id="' + mid + '"]').forEach(function (el) {
        var p = el.parentNode;
        while (el.firstChild) p.insertBefore(el.firstChild, el);
        p.removeChild(el);
      });
      state.storia.content = ed.innerHTML;
      saveToStorage();
    }
  };
  inner.appendChild(delBtn);
}

/* ============================================================================
   SEZIONE 14: CRONACHE DELLA CAMPAGNA & STORIA (renderStoria)
   ============================================================================ */
function renderStoria() {
  if (!isDM()) return document.createElement('div');
  var wrap = document.createElement('div');
  wrap.className = 'storia-wrap';

  /* ---- Toolbar ---- */
  var toolbar = document.createElement('div');
  toolbar.className = 'storia-toolbar';

  var fmts = [
    { cmd: 'bold', html: '<b>B</b>', title: 'Grassetto (Ctrl+B)' },
    { cmd: 'italic', html: '<i>I</i>', title: 'Corsivo (Ctrl+I)' },
    { cmd: 'underline', html: '<u>U</u>', title: 'Sottolineato (Ctrl+U)' },
    { cmd: 'strikeThrough', html: '<s>S</s>', title: 'Barrato' },
    { cmd: 'insertOrderedList', html: '1.', title: 'Lista numerata' },
    { cmd: 'insertUnorderedList', html: '•', title: 'Lista puntata' },
    { cmd: 'justifyLeft', html: '⬤⬤⬤', title: 'Allinea sinistra' },
    { cmd: 'justifyCenter', html: '⊞', title: 'Centra' },
  ];
  fmts.forEach(function (f) {
    var btn = document.createElement('button');
    btn.className = 'storia-fmt-btn';
    btn.innerHTML = f.html;
    btn.title = f.title;
    btn.onmousedown = function (e) {
      e.preventDefault();
      document.execCommand(f.cmd, false, null);
      storiaScheduleSave();
    };
    toolbar.appendChild(btn);
  });

  var sep1 = document.createElement('div');
  sep1.className = 'storia-sep';
  toolbar.appendChild(sep1);

  // Highlight (giallo di default, click ripetuto cambia colore)
  var _hlIdx = 0;
  var hlColors = ['#ffd700', '#90ee90', '#87ceeb', '#ffb6c1', 'transparent'];
  var hlBtn = document.createElement('button');
  hlBtn.className = 'storia-fmt-btn';
  hlBtn.title = 'Evidenzia';
  hlBtn.innerHTML =
    '<span style="background:#ffd700;color:#222;padding:1px 3px;border-radius:2px;font-size:10px;">HL</span>';
  hlBtn.onmousedown = function (e) {
    e.preventDefault();
    document.execCommand('hiliteColor', false, hlColors[_hlIdx % hlColors.length]);
    _hlIdx++;
    storiaScheduleSave();
  };
  toolbar.appendChild(hlBtn);

  // Colore testo
  var colorWrap = document.createElement('label');
  colorWrap.title = 'Colore testo';
  colorWrap.style.cssText = 'display:flex;align-items:center;cursor:pointer;';
  var colorInp = document.createElement('input');
  colorInp.type = 'color';
  colorInp.value = '#e8d5a0';
  colorInp.style.cssText =
    'width:22px;height:22px;padding:0;border:2px solid var(--border-default);border-radius:3px;cursor:pointer;background:none;';
  colorInp.title = 'Colore testo';
  colorInp.oninput = function () {
    document.execCommand('foreColor', false, this.value);
    storiaScheduleSave();
  };
  colorWrap.appendChild(colorInp);
  toolbar.appendChild(colorWrap);

  // Dimensione font
  var fsWrap = document.createElement('select');
  fsWrap.className = 'storia-fmt-btn';
  fsWrap.style.cssText = 'width:56px;padding:0 0.2rem;font-size:11px;';
  fsWrap.title = 'Dimensione carattere';
  [
    ['1', 'Tiny'],
    ['2', 'Piccolo'],
    ['3', 'Normale'],
    ['4', 'Medio'],
    ['5', 'Grande'],
    ['6', 'Molto grande'],
    ['7', 'Enorme'],
  ].forEach(function (p) {
    var op = document.createElement('option');
    op.value = p[0];
    op.textContent = p[1];
    if (p[0] === '3') op.selected = true;
    fsWrap.appendChild(op);
  });
  fsWrap.onchange = function () {
    document.execCommand('fontSize', false, this.value);
    storiaScheduleSave();
  };
  toolbar.appendChild(fsWrap);

  var sep2 = document.createElement('div');
  sep2.className = 'storia-sep';
  toolbar.appendChild(sep2);

  // Pulsante âncora su mappa
  var anchorBtn = document.createElement('button');
  anchorBtn.className = 'storia-anchor-btn';
  anchorBtn.id = 'storia-anchor-btn';
  anchorBtn.innerHTML = '📍 Collega a Mappa';
  anchorBtn.title =
    'Seleziona del testo, poi premi questo pulsante e clicca sulla mappa per creare un segnalino collegato';
  anchorBtn.onclick = function () {
    _storiaAnchorMode = !_storiaAnchorMode;
    anchorBtn.className = 'storia-anchor-btn' + (_storiaAnchorMode ? ' active' : '');
    if (_storiaAnchorMode) {
      var sel = window.getSelection();
      _storiaSelectedRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
      if (!state.storia.showMap) {
        state.storia.showMap = true;
        var mp = wrap.querySelector('.storia-map-panel');
        if (mp) {
          mp.classList.add('open');
          mapToggle.className = 'storia-map-toggle active';
          setTimeout(initStoriaMap, 100);
        }
      }
      state.storia.mapMode = 'place';
      updateStoriaMapToolbar();
    } else {
      _storiaSelectedRange = null;
      state.storia.mapMode = 'move';
      updateStoriaMapToolbar();
    }
  };
  toolbar.appendChild(anchorBtn);

  // Toggle mappa
  var mapToggle = document.createElement('button');
  mapToggle.className = 'storia-map-toggle' + (state.storia.showMap ? ' active' : '');
  mapToggle.innerHTML = '🗺️ Mappa';
  mapToggle.onclick = function () {
    state.storia.showMap = !state.storia.showMap;
    mapToggle.className = 'storia-map-toggle' + (state.storia.showMap ? ' active' : '');
    var mp = wrap.querySelector('.storia-map-panel');
    if (mp) {
      if (state.storia.showMap) {
        mp.classList.add('open');
        setTimeout(initStoriaMap, 100);
      } else {
        mp.classList.remove('open');
        if (_storiaLeafletMap) {
          try {
            _storiaLeafletMap.remove();
          } catch (e) {}
          _storiaLeafletMap = null;
        }
      }
    }
  };
  toolbar.appendChild(mapToggle);
  wrap.appendChild(toolbar);

  /* ---- Barra filtro persona (solo admin) ---- */
  if (isAdmin()) {
    var storiaFilterBar = document.createElement('div');
    storiaFilterBar.style.cssText =
      'display:flex;align-items:center;flex-wrap:wrap;gap:0.4rem;padding:0.45rem 0.9rem;background:rgba(60,120,200,0.05);border-bottom:1px solid var(--border-subtle);flex-shrink:0;';
    var sfLabel = document.createElement('span');
    sfLabel.style.cssText =
      'font-size:10px;font-weight:700;letter-spacing:0.12em;color:rgba(100,160,240,0.55);white-space:nowrap;margin-right:0.15rem;';
    sfLabel.textContent = 'STORIE:';
    storiaFilterBar.appendChild(sfLabel);
    var _mkStoriaPill = function (label, val) {
      var isActive =
        (val === '' && !_storiaViewAsUser) || (val !== '' && val === _storiaViewAsUser);
      var btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText =
        "font-family:'Cinzel',serif;font-size:11px;letter-spacing:0.06em;padding:0.28rem 0.75rem;border-radius:20px;cursor:pointer;white-space:nowrap;transition:all 0.15s;" +
        'border:1.5px solid ' +
        (isActive ? 'rgba(100,160,240,0.85)' : 'rgba(100,160,240,0.3)') +
        ';' +
        'background:' +
        (isActive ? 'rgba(100,160,240,0.2)' : 'rgba(100,160,240,0.04)') +
        ';' +
        'color:' +
        (isActive ? '#a0c8f8' : 'rgba(100,160,240,0.6)') +
        ';' +
        'font-weight:' +
        (isActive ? '700' : '400') +
        ';';
      btn.onclick = function () {
        _storiaViewAsUser = val === '' ? null : val;
        renderMain();
      };
      return btn;
    };
    storiaFilterBar.appendChild(_mkStoriaPill('📚 Tutte', '__tutte__'));
    storiaFilterBar.appendChild(
      _mkStoriaPill('⭐ ' + (state.currentUser ? state.currentUser.username : 'Mie'), '')
    );
    if (CampaignManager.profiles() && typeof CampaignManager.profiles() === 'object') {
      Object.keys(CampaignManager.profiles())
        .sort()
        .forEach(function (uid) {
          if (uid === (state.currentUser && state.currentUser.username)) return;
          storiaFilterBar.appendChild(_mkStoriaPill('👤 ' + uid, uid));
        });
    }
    wrap.appendChild(storiaFilterBar);
  }

  /* ---- Barra salvataggio ---- */
  var savebar = document.createElement('div');
  savebar.style.cssText =
    'display:flex;align-items:center;gap:0.75rem;padding:0.35rem 0.9rem;background:rgba(201,165,92,0.06);border-bottom:1px solid var(--border-subtle);flex-shrink:0;flex-wrap:wrap;';

  var saveBtn = document.createElement('button');
  saveBtn.id = 'storia-save-btn';
  saveBtn.style.cssText =
    "display:inline-flex;align-items:center;gap:0.4rem;background:rgba(201,165,92,0.2);border:1.5px solid var(--gold);color:var(--gold-bright);border-radius:6px;padding:0.3rem 1rem;cursor:pointer;font-size:12px;font-family:'Cinzel',serif;letter-spacing:0.08em;transition:all 0.15s;";
  saveBtn.innerHTML = '💾 Salva';

  var libraryBtn = document.createElement('button');
  libraryBtn.style.cssText =
    "display:inline-flex;align-items:center;gap:0.4rem;background:rgba(100,160,240,0.15);border:1.5px solid rgba(100,160,240,0.5);color:#88b8f0;border-radius:6px;padding:0.3rem 1rem;cursor:pointer;font-size:12px;font-family:'Cinzel',serif;letter-spacing:0.08em;transition:all 0.15s;";
  libraryBtn.innerHTML = '📚 Seleziona Storia';

  var nuovaBtn = document.createElement('button');
  nuovaBtn.style.cssText =
    "display:inline-flex;align-items:center;gap:0.4rem;background:rgba(130,200,130,0.12);border:1.5px solid rgba(130,200,130,0.4);color:#90e090;border-radius:6px;padding:0.3rem 1rem;cursor:pointer;font-size:12px;font-family:'Cinzel',serif;letter-spacing:0.08em;transition:all 0.15s;";
  nuovaBtn.innerHTML = '✏️ Nuova';

  var storyNameLabel = document.createElement('span');
  storyNameLabel.style.cssText =
    "font-size:12px;font-family:'Cinzel',serif;color:var(--text-faint);letter-spacing:0.06em;flex:1;";
  storyNameLabel.textContent = state.storia.currentStoryName
    ? '📖 ' + state.storia.currentStoryName
    : 'Nessuna storia aperta';

  var saveStatus = document.createElement('span');
  saveStatus.style.cssText =
    "font-size:11px;font-family:'Cinzel',serif;color:var(--text-faint);letter-spacing:0.06em;";

  /* Mostra finestra nome */
  function _mostraInputNome(defaultNome, callback) {
    var overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText =
      'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:10px;padding:1.5rem 2rem;width:360px;max-width:95%;box-shadow:0 12px 48px rgba(0,0,0,0.8);display:flex;flex-direction:column;gap:1rem;';
    var title = document.createElement('div');
    title.style.cssText =
      "font-family:'Cinzel',serif;font-size:14px;color:var(--gold-bright);letter-spacing:0.08em;";
    title.textContent = 'Nome della storia';
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = defaultNome || '';
    inp.placeholder = 'Es. La caduta di Chronis...';
    inp.style.cssText =
      'background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid var(--border-default);border-radius:6px;padding:0.5rem 0.75rem;color:var(--text-main);font-size:14px;outline:none;';
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;';
    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Annulla';
    cancelBtn.style.cssText =
      'padding:0.4rem 1rem;border-radius:6px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-faint);cursor:pointer;font-size:13px;';
    var confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Salva';
    confirmBtn.style.cssText =
      "padding:0.4rem 1rem;border-radius:6px;border:1.5px solid var(--gold);background:rgba(201,165,92,0.2);color:var(--gold-bright);cursor:pointer;font-size:13px;font-family:'Cinzel',serif;";
    cancelBtn.onclick = function () {
      document.body.removeChild(overlay);
    };
    confirmBtn.onclick = function () {
      var nome = inp.value.trim();
      if (!nome) {
        inp.style.border = '1px solid #ff9c9c';
        return;
      }
      document.body.removeChild(overlay);
      callback(nome);
    };
    inp.onkeydown = function (e) {
      if (e.key === 'Enter') confirmBtn.onclick();
      if (e.key === 'Escape') cancelBtn.onclick();
    };
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    box.appendChild(title);
    box.appendChild(inp);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    setTimeout(function () {
      inp.focus();
      inp.select();
    }, 50);
  }

  saveBtn.onclick = function () {
    var ed = document.getElementById('storia-editor');
    if (ed) state.storia.content = ed.innerHTML;
    if (!_campaignDb) {
      saveStatus.style.color = '#ff9c9c';
      saveStatus.textContent = '❌ Firebase non connesso';
      return;
    }
    function doSave(nome) {
      saveBtn.disabled = true;
      saveStatus.style.color = 'var(--text-faint)';
      saveStatus.textContent = '⏳ Salvataggio...';
      _salvaStoriaConNome(nome, function (err) {
        saveBtn.disabled = false;
        if (err) {
          saveStatus.style.color = '#ff9c9c';
          saveStatus.textContent =
            '❌ ' + (err.code === 'PERMISSION_DENIED' ? 'Regole Firebase scadute' : err.message);
        } else {
          saveStatus.style.color = '#7dce82';
          saveStatus.textContent = '✅ Salvata — ' + new Date().toLocaleTimeString('it-IT');
          storyNameLabel.textContent = '📖 ' + nome;
        }
      });
    }
    if (state.storia.currentStoryId) {
      doSave(state.storia.currentStoryName);
    } else {
      _mostraInputNome('', doSave);
    }
  };

  nuovaBtn.onclick = function () {
    state.storia.content = '';
    state.storia.currentStoryId = null;
    state.storia.currentStoryName = '';
    state.storia.showLibrary = false;
    storyNameLabel.textContent = 'Nessuna storia aperta';
    saveStatus.textContent = '';
    var ed = document.getElementById('storia-editor');
    if (ed) ed.innerHTML = '<p><br></p>';
  };

  libraryBtn.onclick = function () {
    state.storia.showLibrary = !state.storia.showLibrary;
    var edWrap = document.getElementById('storia-editor-wrap');
    var libWrap = document.getElementById('storia-library-wrap');
    if (edWrap) edWrap.style.display = state.storia.showLibrary ? 'none' : '';
    if (libWrap) {
      libWrap.style.display = state.storia.showLibrary ? 'flex' : 'none';
      if (state.storia.showLibrary) _renderLibreria(libWrap);
    }
    libraryBtn.innerHTML = state.storia.showLibrary ? "✏️ Torna all'editor" : '📚 Seleziona Storia';
  };

  savebar.appendChild(saveBtn);
  savebar.appendChild(nuovaBtn);
  savebar.appendChild(libraryBtn);
  savebar.appendChild(storyNameLabel);
  savebar.appendChild(saveStatus);
  wrap.appendChild(savebar);

  /* ---- Area principale ---- */
  var mainArea = document.createElement('div');
  mainArea.className = 'storia-main';

  /* Libreria storie */
  var libWrap = document.createElement('div');
  libWrap.id = 'storia-library-wrap';
  libWrap.style.cssText =
    'display:' +
    (state.storia.showLibrary ? 'flex' : 'none') +
    ';flex-direction:column;flex:1;overflow-y:auto;padding:1rem 1.2rem;gap:0.6rem;';

  function _renderLibreria(container) {
    container.innerHTML = '';
    var hdr = document.createElement('div');
    hdr.style.cssText =
      "font-family:'Cinzel',serif;font-size:13px;color:var(--gold-bright);letter-spacing:0.1em;margin-bottom:0.4rem;";
    hdr.textContent =
      _storiaViewAsUser === '__tutte__'
        ? 'TUTTE LE STORIE'
        : _storiaViewAsUser
          ? 'STORIE DI ' + _storiaViewAsUser.toUpperCase()
          : 'LE TUE STORIE';
    container.appendChild(hdr);
    var loading = document.createElement('div');
    loading.style.cssText = 'color:var(--text-faint);font-size:13px;';
    loading.textContent = 'Caricamento...';
    container.appendChild(loading);

    // ---- Modalità TUTTE ----
    if (_storiaViewAsUser === '__tutte__') {
      _caricaLibreriaTutti(function (allStories) {
        container.removeChild(loading);
        if (allStories.length === 0) {
          var empty = document.createElement('div');
          empty.style.cssText = 'color:var(--text-faint);font-size:13px;font-style:italic;';
          empty.textContent = 'Nessuna storia trovata.';
          container.appendChild(empty);
          return;
        }
        allStories.forEach(function (s) {
          var card = document.createElement('div');
          card.style.cssText =
            'display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.9rem;background:rgba(201,165,92,0.07);border:1px solid var(--border-subtle);border-radius:8px;cursor:pointer;transition:background 0.15s;';
          card.onmouseenter = function () {
            card.style.background = 'rgba(201,165,92,0.14)';
          };
          card.onmouseleave = function () {
            card.style.background = 'rgba(201,165,92,0.07)';
          };
          var info = document.createElement('div');
          info.style.cssText = 'flex:1;min-width:0;';
          var nome = document.createElement('div');
          nome.style.cssText =
            "font-family:'Cinzel',serif;font-size:13px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
          nome.textContent = s.nome || 'Senza nome';
          var meta = document.createElement('div');
          meta.style.cssText =
            'font-size:10px;color:var(--text-faint);margin-top:2px;display:flex;gap:0.5rem;';
          var ownerTag = document.createElement('span');
          ownerTag.style.cssText =
            'background:rgba(100,160,240,0.15);border:1px solid rgba(100,160,240,0.3);color:#88b8f0;border-radius:4px;padding:0 0.35rem;font-size:9px;';
          ownerTag.textContent = s._owner;
          var dataSpan = document.createElement('span');
          dataSpan.textContent = s.savedAt ? new Date(s.savedAt).toLocaleString('it-IT') : '';
          meta.appendChild(ownerTag);
          meta.appendChild(dataSpan);
          info.appendChild(nome);
          info.appendChild(meta);
          card.onclick = function () {
            state.storia.content = typeof s.content === 'string' ? s.content : '';
            state.storia.currentStoryId = s._realId;
            state.storia.currentStoryName = s.nome || '';
            state.storia.showLibrary = false;
            storyNameLabel.textContent = '📖 ' + (s.nome || '') + ' (' + s._owner + ')';
            saveStatus.textContent = '';
            libraryBtn.innerHTML = '📚 Seleziona Storia';
            var edWrap2 = document.getElementById('storia-editor-wrap');
            var libWrap2 = document.getElementById('storia-library-wrap');
            if (libWrap2) libWrap2.style.display = 'none';
            if (edWrap2) {
              edWrap2.style.display = '';
              var ed2 = document.getElementById('storia-editor');
              if (ed2) {
                ed2.replaceChildren(sanitizeRichText(state.storia.content || '<p><br></p>'));
              }
            }
            refreshStoriaMarkers();
          };
          card.appendChild(info);
          container.appendChild(card);
        });
      });
      return;
    }

    // ---- Modalità normale (singolo utente) ----
    _caricaLibreria(function (storie) {
      container.removeChild(loading);
      var ids = Object.keys(storie);
      if (ids.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'color:var(--text-faint);font-size:13px;font-style:italic;';
        empty.textContent = 'Nessuna storia salvata. Scrivi qualcosa e clicca Salva.';
        container.appendChild(empty);
        return;
      }
      ids.sort(function (a, b) {
        return (storie[b].savedAt || 0) - (storie[a].savedAt || 0);
      });
      ids.forEach(function (id) {
        var s = storie[id];
        var card = document.createElement('div');
        card.style.cssText =
          'display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.9rem;background:rgba(201,165,92,0.07);border:1px solid var(--border-subtle);border-radius:8px;cursor:pointer;transition:background 0.15s;';
        if (id === state.storia.currentStoryId) card.style.borderColor = 'var(--gold)';
        card.onmouseenter = function () {
          card.style.background = 'rgba(201,165,92,0.14)';
        };
        card.onmouseleave = function () {
          card.style.background = 'rgba(201,165,92,0.07)';
        };
        var info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        var nome = document.createElement('div');
        nome.style.cssText =
          "font-family:'Cinzel',serif;font-size:13px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
        nome.textContent = s.nome || 'Senza nome';
        var data = document.createElement('div');
        data.style.cssText = 'font-size:10px;color:var(--text-faint);margin-top:2px;';
        data.textContent = s.savedAt ? new Date(s.savedAt).toLocaleString('it-IT') : '';
        info.appendChild(nome);
        info.appendChild(data);
        if (!_storiaViewAsUser) {
          var delBtn = document.createElement('button');
          delBtn.innerHTML = '🗑️';
          delBtn.title = 'Elimina';
          delBtn.style.cssText =
            'background:none;border:none;cursor:pointer;font-size:14px;opacity:0.5;padding:0.2rem;border-radius:4px;';
          delBtn.onmouseenter = function () {
            delBtn.style.opacity = '1';
          };
          delBtn.onmouseleave = function () {
            delBtn.style.opacity = '0.5';
          };
          delBtn.onclick = function (e) {
            e.stopPropagation();
            if (!confirm('Eliminare "' + (s.nome || 'questa storia') + '"?')) return;
            _campaignDb.ref(_storiePrivatePath() + '/' + id).remove(function () {
              if (state.storia.currentStoryId === id) {
                state.storia.currentStoryId = null;
                state.storia.currentStoryName = '';
                state.storia.content = '';
                state.storia.markers = {};
                storyNameLabel.textContent = 'Nessuna storia aperta';
              }
              _renderLibreria(container);
            });
          };
          card.appendChild(delBtn);
        }
        card.onclick = function () {
          state.storia.content = typeof s.content === 'string' ? s.content : '';
          state.storia.currentStoryId = id;
          state.storia.currentStoryName = s.nome || '';
          state.storia.showLibrary = false;
          storyNameLabel.textContent = '📖 ' + (s.nome || '');
          saveStatus.textContent = '';
          libraryBtn.innerHTML = '📚 Seleziona Storia';
          var edWrap2 = document.getElementById('storia-editor-wrap');
          var libWrap2 = document.getElementById('storia-library-wrap');
          if (libWrap2) libWrap2.style.display = 'none';
          if (edWrap2) {
            edWrap2.style.display = '';
            var ed2 = document.getElementById('storia-editor');
            if (ed2) {
              ed2.replaceChildren(sanitizeRichText(state.storia.content || '<p><br></p>'));
            }
          }
          refreshStoriaMarkers();
        };
        card.appendChild(info);
        container.appendChild(card);
      });
    });
  }
  mainArea.appendChild(libWrap);

  /* Editor */
  var editorWrap = document.createElement('div');
  editorWrap.className = 'storia-editor-wrap';
  editorWrap.id = 'storia-editor-wrap';
  editorWrap.style.display = state.storia.showLibrary ? 'none' : '';
  var editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.className = 'storia-editor';
  editor.id = 'storia-editor';
  editor.setAttribute('spellcheck', 'false');
  if (state.storia.content) editor.replaceChildren(sanitizeRichText(state.storia.content));
  else editor.innerHTML = '<p><br></p>';

  editor.oninput = storiaScheduleSave;
  editor.onblur = function () {
    storiaHighlightNpcs(editor);
    storiaFlushSave();
  };

  editor.addEventListener('mouseover', function (e) {
    var t = e.target.closest('[data-storia-npc]');
    if (!t) {
      hideStoriaTooltip();
      return;
    }
    var _npcNome = t.dataset.storiaNpc;
    var npc = null;
    (state.worldbuilding || []).forEach(function (z) {
      (z.citta || []).forEach(function (c) {
        (c.npcChiave || []).forEach(function (p) {
          if (p && p.nome === _npcNome) npc = p;
        });
      });
    });
    if (npc) showStoriaTooltip(e, npc);
    else hideStoriaTooltip();
  });
  editor.addEventListener('mouseleave', hideStoriaTooltip);

  editor.addEventListener('click', function (e) {
    var link = e.target.closest('.storia-map-link');
    if (!link) return;
    var mid = link.dataset.markerId;
    if (!mid || !state.storia.markers[mid]) return;
    state.storia.showMap = true;
    var mp = wrap.querySelector('.storia-map-panel');
    if (mp) {
      mp.classList.add('open');
      mapToggle.className = 'storia-map-toggle active';
      setTimeout(function () {
        if (!_storiaLeafletMap) initStoriaMap();
        setTimeout(function () {
          var m = state.storia.markers[mid];
          if (_storiaLeafletMap && m) _storiaLeafletMap.flyTo([m.lat, m.lng], 0);
          state.storia.selectedMarker = mid;
          refreshStoriaMarkers();
          var panel = document.getElementById('storia-marker-panel');
          if (panel) {
            panel.classList.add('open');
            renderStoriaMarkerPanel(panel, mid);
          }
        }, 350);
      }, 100);
    }
  });

  editorWrap.appendChild(editor);
  mainArea.appendChild(editorWrap);

  /* Pannello NPC — archivio generale + NPC archiviati nelle città della mappa attiva, ordine alfabetico. */
  var _allNpcs = [];
  (state.personaggi || []).forEach(function (p) {
    if (p && p.nome) _allNpcs.push(p);
  });
  (state.worldbuilding || []).forEach(function (zone) {
    (zone.citta || []).forEach(function (city) {
      (city.npcChiave || []).forEach(function (p) {
        if (p && p.nome) _allNpcs.push(p);
      });
    });
  });
  _allNpcs.sort(function (a, b) {
    return a.nome.localeCompare(b.nome, 'it');
  });

  var npcPanel = document.createElement('div');
  npcPanel.className = 'storia-npc-panel';
  var npcHdr = document.createElement('div');
  npcHdr.className = 'storia-npc-header';
  npcHdr.textContent = 'PERSONAGGI';
  npcPanel.appendChild(npcHdr);
  _allNpcs.forEach(function (npc) {
    var item = document.createElement('div');
    item.className = 'storia-npc-item';
    if (npc.immagine) {
      var av = document.createElement('img');
      av.src = safeImageUrl(npc.immagine);
      av.className = 'storia-npc-avatar';
      av.onerror = function () {
        this.style.display = 'none';
      };
      item.appendChild(av);
    } else {
      var ph = document.createElement('div');
      ph.className = 'storia-npc-avatar-ph';
      ph.textContent = npc.nome.charAt(0).toUpperCase();
      item.appendChild(ph);
    }
    var nm = document.createElement('span');
    nm.className = 'storia-npc-nome';
    nm.textContent = npc.nome;
    item.appendChild(nm);
    item.onmouseenter = function (e) {
      showStoriaTooltip(e, npc);
    };
    item.onmouseleave = hideStoriaTooltip;
    item.onclick = function () {
      var ed = document.getElementById('storia-editor');
      if (!ed) return;
      ed.focus();
      document.execCommand('insertText', false, npc.nome);
      storiaScheduleSave();
    };
    npcPanel.appendChild(item);
  });
  mainArea.appendChild(npcPanel);

  /* Pannello mappa */
  var mapPanel = document.createElement('div');
  mapPanel.className = 'storia-map-panel' + (state.storia.showMap ? ' open' : '');
  mapPanel.id = 'storia-map-panel';

  var mapTb = document.createElement('div');
  mapTb.className = 'storia-map-toolbar';
  var mapTbLabel = document.createElement('span');
  mapTbLabel.textContent = 'MODALITÀ:';
  mapTb.appendChild(mapTbLabel);
  var moveModeBtn = document.createElement('button');
  moveModeBtn.id = 'storia-move-mode-btn';
  moveModeBtn.className =
    'storia-map-mode-btn' + (state.storia.mapMode !== 'place' ? ' active' : '');
  moveModeBtn.textContent = 'Naviga';
  moveModeBtn.onclick = function () {
    state.storia.mapMode = 'move';
    updateStoriaMapToolbar();
    _storiaAnchorMode = false;
    _storiaSelectedRange = null;
    var ab = document.getElementById('storia-anchor-btn');
    if (ab) ab.className = 'storia-anchor-btn';
  };
  mapTb.appendChild(moveModeBtn);

  var mapTbSep = document.createElement('span');
  mapTbSep.textContent = 'SEGNALINO:';
  mapTbSep.style.cssText = 'margin-left:0.6rem;font-size:10px;opacity:0.6;letter-spacing:0.05em;';
  mapTb.appendChild(mapTbSep);

  var pinBtn = document.createElement('button');
  pinBtn.id = 'storia-marker-type-pin';
  pinBtn.title = 'Segnalino luogo';
  pinBtn.innerHTML =
    '<svg viewBox="0 0 22 28" width="14" height="17" xmlns="http://www.w3.org/2000/svg"><path d="M11 1C7.13 1 4 4.13 4 8c0 5.25 7 14 7 14s7-8.75 7-14c0-3.87-3.13-7-7-7z" fill="currentColor"/><circle cx="11" cy="8" r="2.8" fill="white" opacity="0.7"/></svg>';
  pinBtn.className =
    'storia-map-mode-btn' +
    (state.storia.mapMode === 'place' && (state.storia.markerType || 'pin') === 'pin'
      ? ' active'
      : '');
  pinBtn.onclick = function () {
    state.storia.markerType = 'pin';
    state.storia.mapMode = 'place';
    updateStoriaMapToolbar();
  };
  mapTb.appendChild(pinBtn);

  var clockBtn = document.createElement('button');
  clockBtn.id = 'storia-marker-type-clock';
  clockBtn.title = 'Segnalino orologio';
  clockBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="12" x2="12" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  clockBtn.className =
    'storia-map-mode-btn' +
    (state.storia.mapMode === 'place' && state.storia.markerType === 'clock' ? ' active' : '');
  clockBtn.onclick = function () {
    state.storia.markerType = 'clock';
    state.storia.mapMode = 'place';
    updateStoriaMapToolbar();
  };
  mapTb.appendChild(clockBtn);

  var swordsBtn = document.createElement('button');
  swordsBtn.id = 'storia-marker-type-swords';
  swordsBtn.title = 'Segnalino battaglia';
  swordsBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><line x1="5" y1="19" x2="19" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="7" x2="7" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="9" x2="5" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="19" y1="17" x2="17" y2="19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="21" y1="15" x2="19" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="19" y1="5" x2="17" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="19" x2="7" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="19" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  swordsBtn.className =
    'storia-map-mode-btn' +
    (state.storia.mapMode === 'place' && state.storia.markerType === 'swords' ? ' active' : '');
  swordsBtn.onclick = function () {
    state.storia.markerType = 'swords';
    state.storia.mapMode = 'place';
    updateStoriaMapToolbar();
  };
  mapTb.appendChild(swordsBtn);

  var savePinSep = document.createElement('span');
  savePinSep.style.cssText = 'flex:1;';
  mapTb.appendChild(savePinSep);
  var savePinBtn = document.createElement('button');
  savePinBtn.id = 'storia-save-pin-btn';
  savePinBtn.title = 'Salva tutti i pin sulla mappa';
  savePinBtn.style.cssText =
    "display:inline-flex;align-items:center;gap:0.3rem;background:rgba(201,165,92,0.2);border:1.5px solid var(--gold);color:var(--gold-bright);border-radius:6px;padding:0.25rem 0.75rem;cursor:pointer;font-size:11px;font-family:'Cinzel',serif;letter-spacing:0.06em;white-space:nowrap;";
  savePinBtn.innerHTML = '💾 Salva Pin';
  savePinBtn.onclick = function () {
    fbSaveStoriaMarkers();
    savePinBtn.innerHTML = '✅ Salvati';
    savePinBtn.style.color = '#7dce82';
    savePinBtn.style.borderColor = '#7dce82';
    setTimeout(function () {
      savePinBtn.innerHTML = '💾 Salva Pin';
      savePinBtn.style.color = '';
      savePinBtn.style.borderColor = '';
    }, 2000);
  };
  mapTb.appendChild(savePinBtn);

  mapPanel.appendChild(mapTb);

  var mapContainer = document.createElement('div');
  mapContainer.id = 'storia-map-container';
  var mapDiv = document.createElement('div');
  mapDiv.id = 'storia-leaflet-map';
  mapContainer.appendChild(mapDiv);
  var markerPanel = document.createElement('div');
  markerPanel.className = 'storia-marker-panel';
  markerPanel.id = 'storia-marker-panel';
  mapContainer.appendChild(markerPanel);
  mapPanel.appendChild(mapContainer);
  mainArea.appendChild(mapPanel);
  wrap.appendChild(mainArea);

  // Tooltip NPC (globale nella sezione)
  var tt = document.createElement('div');
  tt.id = 'storia-npc-tooltip';
  wrap.appendChild(tt);

  if (state.storia.showMap) setTimeout(initStoriaMap, 100);
  return wrap;
}
