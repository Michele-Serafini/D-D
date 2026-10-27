/* ============================================================
   MAPPA DEL MONDO INTERATTIVA
   ============================================================ */
var _leafletMap = null;
var _flagLayer = null;
var _overlayPolyLayer = null;
var _ovDrawActive = false;
var _ovDrawLayerKey = null;
var _ovDrawFactionId = null;
var _ovDrawPoints = [];
var _ovDrawPoly = null;
var _ovDrawMarkers = [];
var _ovDrawCursor = null;
var OVERLAY_DEFS = [
  { key: 'political', label: 'Politica', icon: '⚑' },
  { key: 'associations', label: 'Associazioni', icon: '◈' },
];
var _flagMarkers = {};
var _secMapFid = null;

/* ─────────────────────────────────────────────────────────────
   VISTA MAPPA SECONDARIA  (pin invisibili stile AC Syndicate)
───────────────────────────────────────────────────────────── */
var _secMapCleanupFns = null;

function _openSecondaryMapView(fid) {
  _secMapFid = fid;
  var f = state.mappaFlags[fid] || {};
  var mapContainer = document.querySelector('.mappa-container');
  if (!mapContainer) return;

  if (_secMapCleanupFns) {
    _secMapCleanupFns();
    _secMapCleanupFns = null;
  }
  var old = document.getElementById('mappa-sec-overlay');
  if (old) old.remove();

  var dmCtrls = mapContainer.querySelector('.mappa-dm-controls');
  if (dmCtrls) dmCtrls.style.display = 'none';
  var lmap = document.getElementById('leaflet-map');
  if (lmap) lmap.style.display = 'none';
  var layerBar = mapContainer.querySelector('.mappa-layer-bar');
  if (layerBar) layerBar.style.display = 'none';
  var infoP = document.querySelector('.mappa-info-panel');
  if (infoP) infoP.classList.remove('open');

  var overlay = document.createElement('div');
  overlay.id = 'mappa-sec-overlay';
  overlay.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;z-index:500;background:#0c0702;display:flex;flex-direction:column;overflow:hidden;';

  /* ── barra superiore ── */
  var topBar = document.createElement('div');
  topBar.style.cssText =
    'display:flex;align-items:center;padding:0.45rem 0.8rem;background:rgba(0,0,0,0.7);border-bottom:1px solid rgba(201,165,92,0.3);flex-shrink:0;';
  var backBtn = document.createElement('button');
  backBtn.className = 'mappa-btn mappa-btn-add-map';
  backBtn.innerHTML = '← Torna alla Mappa';
  backBtn.onclick = function () {
    _closeSecondaryMapView();
  };
  topBar.appendChild(backBtn);
  overlay.appendChild(topBar);

  var bodyRow = document.createElement('div');
  bodyRow.style.cssText = 'flex:1;display:flex;overflow:hidden;min-height:0;';

  /* ── CENTRO: mappa secondaria con zoom+pan ── */
  var centerCol = document.createElement('div');
  centerCol.style.cssText = 'flex:1;position:relative;overflow:hidden;background:#0a0602;';

  if (safeImageUrl(f.mappaSec)) {
    var zScale = 1,
      zPanX = 0,
      zPanY = 0;
    var zDrag = false,
      zSX,
      zSY,
      zSPX,
      zSPY;

    var imgWrap = document.createElement('div');
    imgWrap.style.cssText =
      'width:100%;height:100%;overflow:hidden;cursor:grab;display:flex;align-items:center;justify-content:center;';

    var secImg = document.createElement('img');
    secImg.src = safeImageUrl(f.mappaSec);
    secImg.draggable = false;
    secImg.style.cssText =
      'max-width:100%;max-height:100%;user-select:none;pointer-events:none;transform-origin:center center;transform:translate(0px,0px) scale(1);';

    function _zApply() {
      secImg.style.transform = 'translate(' + zPanX + 'px,' + zPanY + 'px) scale(' + zScale + ')';
    }
    var _zWheel = function (e) {
      e.preventDefault();
      zScale = Math.max(0.3, Math.min(10, zScale * (e.deltaY < 0 ? 1.12 : 0.89)));
      _zApply();
    };
    var _zDown = function (e) {
      if (e.button !== 0) return;
      zDrag = true;
      zSX = e.clientX;
      zSY = e.clientY;
      zSPX = zPanX;
      zSPY = zPanY;
      imgWrap.style.cursor = 'grabbing';
    };
    var _zMove = function (e) {
      if (!zDrag) return;
      zPanX = zSPX + (e.clientX - zSX);
      zPanY = zSPY + (e.clientY - zSY);
      _zApply();
    };
    var _zUp = function () {
      zDrag = false;
      imgWrap.style.cursor = 'grab';
    };

    imgWrap.addEventListener('wheel', _zWheel, { passive: false });
    imgWrap.addEventListener('mousedown', _zDown);
    document.addEventListener('mousemove', _zMove);
    document.addEventListener('mouseup', _zUp);
    _secMapCleanupFns = function () {
      document.removeEventListener('mousemove', _zMove);
      document.removeEventListener('mouseup', _zUp);
    };

    imgWrap.appendChild(secImg);
    centerCol.appendChild(imgWrap);

    /* pulsanti zoom */
    var zCtrl = document.createElement('div');
    zCtrl.style.cssText =
      'position:absolute;bottom:60px;right:12px;display:flex;flex-direction:column;gap:5px;z-index:10;';
    var _zBS =
      'width:36px;height:36px;background:rgba(0,0,0,0.78);border:1px solid rgba(201,165,92,0.5);color:#f5c842;font-size:20px;font-weight:bold;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    var zIn = document.createElement('button');
    zIn.innerHTML = '<b>+</b>';
    zIn.style.cssText = _zBS;
    zIn.onclick = function () {
      zScale = Math.min(10, zScale * 1.2);
      _zApply();
    };
    var zOut = document.createElement('button');
    zOut.innerHTML = '<b>−</b>';
    zOut.style.cssText = _zBS;
    zOut.onclick = function () {
      zScale = Math.max(0.3, zScale / 1.2);
      _zApply();
    };
    var zRst = document.createElement('button');
    zRst.textContent = '↺';
    zRst.style.cssText = _zBS;
    zRst.title = 'Reset zoom';
    zRst.onclick = function () {
      zScale = 1;
      zPanX = 0;
      zPanY = 0;
      _zApply();
    };
    zCtrl.appendChild(zIn);
    zCtrl.appendChild(zOut);
    zCtrl.appendChild(zRst);
    centerCol.appendChild(zCtrl);
  } else {
    var noSecHint = document.createElement('div');
    noSecHint.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:rgba(201,165,92,0.28);';
    noSecHint.innerHTML =
      '<div style="font-size:48px;margin-bottom:0.6rem;">🗺</div>' +
      '<div style="font-family:\'Cinzel\',serif;font-size:14px;letter-spacing:0.1em;">Nessuna mappa caricata</div>' +
      (isDM()
        ? '<div style="font-size:11px;margin-top:0.4rem;opacity:0.7;">Modifica il pin nella mappa del mondo per caricarla</div>'
        : '');
    centerCol.appendChild(noSecHint);
  }

  if (f.nome) {
    var nameOv = document.createElement('div');
    nameOv.style.cssText =
      'position:absolute;bottom:0;left:0;right:0;padding:1.2rem 2rem 0.9rem;background:linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 100%);pointer-events:none;text-align:center;';
    var nameEl = document.createElement('div');
    nameEl.style.cssText =
      "font-family:'Cinzel',serif;font-size:clamp(18px,3vw,30px);font-weight:900;letter-spacing:0.2em;color:#f5d070;text-shadow:0 2px 14px rgba(0,0,0,0.95),0 0 24px rgba(245,166,35,0.5);text-transform:uppercase;";
    nameEl.textContent = f.nome;
    nameOv.appendChild(nameEl);
    centerCol.appendChild(nameOv);
  }
  bodyRow.appendChild(centerCol);

  /* ── DESTRA: scheda luogo (senza sezione mappa secondaria) ── */
  var rightCol = document.createElement('div');
  rightCol.style.cssText =
    'width:340px;flex-shrink:0;background:rgba(12,7,2,0.96);border-left:1px solid rgba(201,165,92,0.18);overflow-y:auto;';
  var fakePanel = document.createElement('div');
  fakePanel.innerHTML =
    '<div class="mappa-info-header"><span class="mappa-info-title">📜 Scheda Luogo</span></div><div class="mappa-info-body"></div>';
  rightCol.appendChild(fakePanel);
  renderMappaFlagPanel(fakePanel, fid, false);
  bodyRow.appendChild(rightCol);

  overlay.appendChild(bodyRow);
  mapContainer.appendChild(overlay);

  // Leggi sempre mappaSec fresco da Firebase — se diverso da stato, aggiorna e riapri
  if (_db) {
    _db.ref(_mappaFlagPath(fid) + '/mappaSec').once('value', function (snap) {
      var ms = snap.val();
      var prev = state.mappaFlags[fid] && state.mappaFlags[fid].mappaSec;
      if (ms && ms !== prev && document.getElementById('mappa-sec-overlay')) {
        if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
        state.mappaFlags[fid].mappaSec = ms;
        _closeSecondaryMapView();
        _openSecondaryMapView(fid);
      }
    });
  }
}

function _closeSecondaryMapView() {
  if (_secMapCleanupFns) {
    _secMapCleanupFns();
    _secMapCleanupFns = null;
  }
  _secMapFid = null;
  var overlay = document.getElementById('mappa-sec-overlay');
  if (overlay) overlay.remove();
  var mapContainer = document.querySelector('.mappa-container');
  if (!mapContainer) return;
  var dmCtrls = mapContainer.querySelector('.mappa-dm-controls');
  if (dmCtrls) dmCtrls.style.display = '';
  var lmap = document.getElementById('leaflet-map');
  if (lmap) lmap.style.display = '';
  var layerBar = mapContainer.querySelector('.mappa-layer-bar');
  if (layerBar) layerBar.style.display = '';
}

function refreshMappaFlags() {
  if (!_leafletMap || !_flagLayer) return;
  _flagLayer.clearLayers();
  _flagMarkers = {};
  Object.keys(state.mappaFlags || {}).forEach(function (fid) {
    var f = state.mappaFlags[fid];
    if (f && typeof f.lat === 'number' && typeof f.lng === 'number') {
      /* ── PIN INVISIBILE ── */
      if (f.visibile === false) {
        if (!isDM()) return; /* i giocatori non vedono nulla */
        /* Ghost marker: visibile solo al DM, semitrasparente */
        var ghostIcon = L.divIcon({
          className: '',
          html:
            '<div title="Pin invisibile" style="width:36px;height:40px;display:flex;align-items:flex-end;justify-content:center;opacity:0.40;filter:grayscale(0.6) drop-shadow(0 2px 5px rgba(0,0,0,0.7));">' +
            '<svg viewBox="0 0 36 40" width="36" height="40" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="17" y="16" width="2.5" height="22" rx="1.2" fill="#555"/>' +
            '<circle cx="18" cy="13" r="12" fill="#333" stroke="#777" stroke-width="1.5" stroke-dasharray="3,2"/>' +
            '<text x="18" y="18" text-anchor="middle" font-size="13" fill="#aaa">👁</text>' +
            '</svg></div>',
          iconSize: [36, 40],
          iconAnchor: [18, 38],
        });
        var ghostMarker = L.marker([f.lat, f.lng], {
          icon: ghostIcon,
          interactive: true,
          bubblingMouseEvents: false,
        });
        (function (fid_) {
          ghostMarker.on('click touchend', function (e) {
            if (e.type === 'touchend' && e.originalEvent) e.originalEvent.preventDefault();
            _openSecondaryMapView(fid_);
          });
        })(fid);
        ghostMarker.addTo(_flagLayer);
        _flagMarkers[fid] = ghostMarker;
        return;
      }

      /* ── PIN NORMALE ── */
      var flagIcon = L.divIcon({
        className: '',
        html:
          '<div style="width:36px;height:40px;display:flex;align-items:flex-end;justify-content:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.8));">' +
          '<svg viewBox="0 0 36 40" width="36" height="40" xmlns="http://www.w3.org/2000/svg">' +
          '<rect x="17" y="16" width="2.5" height="22" rx="1.2" fill="#5a3010" stroke="#3a1e08" stroke-width="0.5"/>' +
          '<circle cx="18" cy="13" r="12" fill="url(#cg)" stroke="#7a4e08" stroke-width="1.2"/>' +
          '<circle cx="18" cy="13" r="10" fill="none" stroke="#c8860a" stroke-width="0.7" stroke-dasharray="2,1.2"/>' +
          '<ellipse cx="14" cy="9" rx="4" ry="2.5" fill="rgba(255,240,160,0.35)" transform="rotate(-20,14,9)"/>' +
          '<text x="18" y="17.5" text-anchor="middle" font-size="10" font-family="serif" fill="#7a4500" font-weight="bold">★</text>' +
          '<defs><radialGradient id="cg" cx="38%" cy="32%" r="62%"><stop offset="0%" stop-color="#ffe87a"/><stop offset="45%" stop-color="#d4a820"/><stop offset="100%" stop-color="#8b5e08"/></radialGradient></defs>' +
          '</svg></div>',
        iconSize: [36, 40],
        iconAnchor: [18, 38],
      });
      var marker = L.marker([f.lat, f.lng], { icon: flagIcon });
      (function (fid_) {
        marker.on('click', function () {
          state.mappaSelectedFlag = fid_;
          var panel = document.querySelector('.mappa-info-panel');
          if (panel) {
            panel.classList.add('open');
            renderMappaFlagPanel(panel, fid_);
          }
        });
      })(fid);
      marker.addTo(_flagLayer);
      _flagMarkers[fid] = marker;
    }
  });
}

function renderMappaFlagPanel(panel, fid, inSecView) {
  var f = state.mappaFlags[fid] || {};
  var header = panel.querySelector('.mappa-info-header');
  var body = panel.querySelector('.mappa-info-body');
  if (!header || !body) return;
  body.innerHTML = '';

  if (isDM()) {
    // Nome (editabile)
    var nomeWrap = document.createElement('div');
    var nomeLbl = document.createElement('span');
    nomeLbl.className = 'mappa-field-lbl';
    nomeLbl.textContent = 'Nome del Luogo';
    var nomeInp = document.createElement('input');
    nomeInp.type = 'text';
    nomeInp.className = 'mappa-field-input';
    nomeInp.value = f.nome || '';
    nomeInp.placeholder = 'es. Villaggio di Pietrabruna';
    nomeInp.oninput = function () {
      if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
      state.mappaFlags[fid].nome = this.value;
      _db && _db.ref(_mappaFlagPath(fid) + '/nome').set(this.value);
    };
    nomeWrap.appendChild(nomeLbl);
    nomeWrap.appendChild(nomeInp);
    body.appendChild(nomeWrap);

    /* ── Toggle PIN INVISIBILE ── */
    var visRow = document.createElement('div');
    visRow.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0 0.45rem;border-bottom:1px solid rgba(201,165,92,0.12);margin-bottom:0.1rem;';
    var visLbl = document.createElement('span');
    visLbl.className = 'mappa-field-lbl';
    visLbl.style.marginBottom = '0';
    visLbl.textContent = '🕵️ Pin Invisibile (apre mappa zona)';
    var visChk = document.createElement('input');
    visChk.type = 'checkbox';
    visChk.style.cssText =
      'width:18px;height:18px;cursor:pointer;accent-color:#f5a623;flex-shrink:0;';
    visChk.checked = f.visibile === false;
    visChk.onchange = function () {
      if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
      state.mappaFlags[fid].visibile = this.checked ? false : true;
      _db && _db.ref(_mappaFlagPath(fid) + '/visibile').set(this.checked ? false : true);
      refreshMappaFlags();
      renderMappaFlagPanel(panel, fid);
    };
    visRow.appendChild(visLbl);
    visRow.appendChild(visChk);
    body.appendChild(visRow);

    // Gradimento → slider reputazione
    var gradWrap = document.createElement('div');
    var gradLbl = document.createElement('span');
    gradLbl.className = 'mappa-field-lbl';
    gradLbl.textContent = 'Reputazione';
    gradWrap.appendChild(gradLbl);

    var REP_LEVELS = [
      {
        label: 'Criminali Ricercati',
        color: '#c84040',
        bg: 'rgba(138,36,36,0.25)',
        bd: 'rgba(138,36,36,0.6)',
      },
      {
        label: 'Fuorilegge Noti',
        color: '#c86040',
        bg: 'rgba(138,76,36,0.25)',
        bd: 'rgba(138,76,36,0.6)',
      },
      {
        label: 'Sconosciuti',
        color: '#8b8b40',
        bg: 'rgba(80,80,20,0.25)',
        bd: 'rgba(100,100,30,0.5)',
      },
      { label: 'Neutrale', color: '#d4b070', bg: 'rgba(80,70,20,0.2)', bd: 'rgba(120,100,40,0.5)' },
      {
        label: 'Rispettati',
        color: '#60a870',
        bg: 'rgba(30,80,30,0.2)',
        bd: 'rgba(50,120,50,0.5)',
      },
      {
        label: 'Eroi Locali',
        color: '#40c860',
        bg: 'rgba(20,100,40,0.25)',
        bd: 'rgba(40,140,60,0.6)',
      },
      {
        label: 'Eroi Leggendari',
        color: '#20e870',
        bg: 'rgba(10,120,50,0.3)',
        bd: 'rgba(20,160,70,0.7)',
      },
    ];

    // Converti valore salvato in indice slider (default 3 = Neutrale)
    var repIdx = 3;
    if (f.gradimento) {
      var savedIdx = REP_LEVELS.findIndex(function (r) {
        return r.label === f.gradimento;
      });
      if (savedIdx >= 0) repIdx = savedIdx;
    }

    var sliderWrap = document.createElement('div');
    sliderWrap.className = 'rep-slider-wrap';

    var sliderLabels = document.createElement('div');
    sliderLabels.className = 'rep-slider-labels';
    sliderLabels.innerHTML =
      '<span class="rep-lbl-bad">Ricercati</span><span class="rep-lbl-neu">Neutrale</span><span class="rep-lbl-good">Eroi</span>';
    sliderWrap.appendChild(sliderLabels);

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '6';
    slider.step = '1';
    slider.value = repIdx;
    slider.className = 'rep-slider';
    sliderWrap.appendChild(slider);

    var repDisplay = document.createElement('div');
    repDisplay.className = 'rep-value-display';
    function updateRepDisplay(idx) {
      var r = REP_LEVELS[idx];
      repDisplay.textContent = r.label;
      repDisplay.style.color = r.color;
      repDisplay.style.background = r.bg;
      repDisplay.style.borderColor = r.bd;
    }
    updateRepDisplay(repIdx);
    sliderWrap.appendChild(repDisplay);

    slider.oninput = function () {
      var idx = parseInt(this.value);
      updateRepDisplay(idx);
      var val = REP_LEVELS[idx].label;
      if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
      state.mappaFlags[fid].gradimento = val;
      _db && _db.ref(_mappaFlagPath(fid) + '/gradimento').set(val);
    };

    gradWrap.appendChild(sliderWrap);
    body.appendChild(gradWrap);

    // Immagine impresa
    var imgWrap = document.createElement('div');
    var imgLbl = document.createElement('span');
    imgLbl.className = 'mappa-field-lbl';
    imgLbl.textContent = 'Immagine Impresa';
    imgWrap.appendChild(imgLbl);
    if (f.immagine) {
      var img = document.createElement('img');
      img.src = f.immagine;
      img.className = 'mappa-impresa-img';
      imgWrap.appendChild(img);
    } else {
      var ph = document.createElement('div');
      ph.className = 'mappa-impresa-placeholder';
      ph.textContent = 'Nessuna immagine';
      imgWrap.appendChild(ph);
    }
    // Pulsante carica immagine (file locale o URL)
    var imgBtnsRow = document.createElement('div');
    imgBtnsRow.style.cssText = 'display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap;';

    var imgBtnFile = document.createElement('button');
    imgBtnFile.className = 'mappa-btn';
    imgBtnFile.textContent =
      '\uD83D\uDDBC\uFE0F ' + (f.immagine ? 'Cambia (File)' : 'Carica (File)');
    imgBtnFile.onclick = function () {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
          state.mappaFlags[fid].immagine = ev.target.result;
          _db && _db.ref(_mappaFlagPath(fid) + '/immagine').set(ev.target.result);
          renderMappaFlagPanel(panel, fid);
        };
        reader.readAsDataURL(file);
      };
      inp.click();
    };
    imgBtnsRow.appendChild(imgBtnFile);

    var imgBtnUrl = document.createElement('button');
    imgBtnUrl.className = 'mappa-btn';
    imgBtnUrl.textContent = '\uD83D\uDD17 ' + (f.immagine ? 'Cambia (URL)' : 'Aggiungi (URL)');
    imgBtnUrl.onclick = function () {
      var url = prompt('Incolla URL immagine:');
      if (url) {
        if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
        state.mappaFlags[fid].immagine = url;
        _db && _db.ref(_mappaFlagPath(fid) + '/immagine').set(url);
        renderMappaFlagPanel(panel, fid);
      }
    };
    imgBtnsRow.appendChild(imgBtnUrl);

    imgWrap.appendChild(imgBtnsRow);
    body.appendChild(imgWrap);

    // Riassunto
    var riaWrap = document.createElement('div');
    var riaLbl = document.createElement('span');
    riaLbl.className = 'mappa-field-lbl';
    riaLbl.textContent = 'Riassunto Geste';
    var riaTA = document.createElement('textarea');
    riaTA.className = 'mappa-field-input mappa-field-textarea';
    riaTA.value = f.riassunto || '';
    riaTA.placeholder = 'Diario delle imprese in questo luogo...';
    riaTA.oninput = function () {
      if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
      state.mappaFlags[fid].riassunto = this.value;
      _db && _db.ref(_mappaFlagPath(fid) + '/riassunto').set(this.value);
    };
    riaWrap.appendChild(riaLbl);
    riaWrap.appendChild(riaTA);
    body.appendChild(riaWrap);

    /* ===== SEZIONI CITTÀ ===== */
    function makeCitySection(label, emoji, stateKey) {
      if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
      if (!Array.isArray(state.mappaFlags[fid][stateKey])) state.mappaFlags[fid][stateKey] = [];
      var items = state.mappaFlags[fid][stateKey];

      var sec = document.createElement('div');
      sec.className = 'city-section';
      var hdr = document.createElement('div');
      hdr.className = 'city-section-header';
      hdr.innerHTML =
        emoji + ' ' + label + ' <span style="color:var(--gold-dim);font-weight:400;">▾</span>';
      var bdy = document.createElement('div');
      bdy.className = 'city-section-body';

      hdr.onclick = function () {
        bdy.classList.toggle('collapsed');
        var arrow = hdr.querySelector('span');
        if (arrow) arrow.textContent = bdy.classList.contains('collapsed') ? '▸' : '▾';
      };

      function rebuildItems() {
        bdy.innerHTML = '';
        items.forEach(function (item, idx) {
          var row = document.createElement('div');
          row.className = 'city-poi-item';
          var txt = document.createElement('span');
          txt.textContent = item;
          txt.style.flex = '1';
          row.appendChild(txt);
          if (isDM()) {
            var del = document.createElement('button');
            del.className = 'city-poi-del';
            del.textContent = '✕';
            (function (i) {
              del.onclick = function () {
                items.splice(i, 1);
                var upd = {};
                upd[stateKey] = items.slice();
                _db && _db.ref(_mappaFlagPath(fid)).update(upd);
                rebuildItems();
              };
            })(idx);
            row.appendChild(del);
          }
          bdy.appendChild(row);
        });
        if (isDM()) {
          var addRow = document.createElement('div');
          addRow.className = 'city-add-row';
          var inp = document.createElement('input');
          inp.className = 'city-add-inp';
          inp.type = 'text';
          inp.placeholder = 'Aggiungi voce…';
          var btn = document.createElement('button');
          btn.className = 'city-add-btn';
          btn.textContent = '+ Aggiungi';
          btn.onclick = function () {
            var val = inp.value.trim();
            if (!val) return;
            items.push(val);
            var upd = {};
            upd[stateKey] = items.slice();
            _db && _db.ref(_mappaFlagPath(fid)).update(upd);
            inp.value = '';
            rebuildItems();
          };
          inp.onkeydown = function (e) {
            if (e.key === 'Enter') btn.click();
          };
          addRow.appendChild(inp);
          addRow.appendChild(btn);
          bdy.appendChild(addRow);
        }
      }
      rebuildItems();
      sec.appendChild(hdr);
      sec.appendChild(bdy);
      return sec;
    }

    body.appendChild(makeCitySection('Luoghi di Interesse', '🏛', 'luoghi'));
    body.appendChild(makeCitySection('NPC Chiave', '👤', 'npcChiave'));
    body.appendChild(makeCitySection('Loot & Segreti', '💎', 'lootSegreti'));

    /* ── SEZIONE MAPPA SECONDARIA (solo se pin invisibile e non già nella vista sec.) ── */
    if (!inSecView && f.visibile === false) {
      var secSec = document.createElement('div');
      secSec.style.cssText =
        'border:1px solid rgba(201,165,92,0.22);border-radius:6px;padding:0.7rem 0.65rem;margin:0.6rem 0;background:rgba(16,8,2,0.55);';

      var secTitle = document.createElement('div');
      secTitle.style.cssText =
        "font-family:'Cinzel',serif;font-size:10px;font-weight:700;color:var(--gold-bright);letter-spacing:0.14em;margin-bottom:0.65rem;";
      secTitle.textContent = '🗺 MAPPA SECONDARIA';
      secSec.appendChild(secTitle);

      /* immagine mappa zona */
      var secImgLbl = document.createElement('span');
      secImgLbl.className = 'mappa-field-lbl';
      secImgLbl.textContent = 'Immagine mappa zona';
      secSec.appendChild(secImgLbl);
      if (safeImageUrl(f.mappaSec)) {
        var secPrev = document.createElement('img');
        secPrev.src = safeImageUrl(f.mappaSec);
        secPrev.style.cssText =
          'width:100%;max-height:70px;object-fit:cover;border-radius:4px;margin-bottom:0.4rem;border:1px solid rgba(201,165,92,0.25);';
        secSec.appendChild(secPrev);
      }
      var secBtns = document.createElement('div');
      secBtns.style.cssText = 'display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.65rem;';
      var secFileBt = document.createElement('button');
      secFileBt.className = 'mappa-btn';
      secFileBt.textContent = f.mappaSec ? '📁 Cambia' : '📁 Carica File';
      secFileBt.onclick = function () {
        var inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.onchange = function (e) {
          var file = e.target.files[0];
          if (!file) return;
          var rd = new FileReader();
          rd.onload = function (ev) {
            var img = new Image();
            img.onload = function () {
              var MAX = 1400,
                w = img.width,
                h = img.height;
              var scale = Math.min(1, MAX / w, MAX / h);
              var cv = document.createElement('canvas');
              cv.width = Math.round(w * scale);
              cv.height = Math.round(h * scale);
              cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
              var compressed = cv.toDataURL('image/jpeg', 0.82);
              if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
              state.mappaFlags[fid].mappaSec = compressed;
              if (_db) {
                _db
                  .ref(_mappaFlagPath(fid) + '/mappaSec')
                  .set(compressed)
                  .then(function () {
                    notify('Mappa zona salvata ✓', 'ok');
                  })
                  .catch(function (err) {
                    notify('Errore salvataggio mappa: ' + err.message, 'err');
                  });
              }
              if (_secMapFid === fid && document.getElementById('mappa-sec-overlay')) {
                _closeSecondaryMapView();
                _openSecondaryMapView(fid);
              } else {
                renderMappaFlagPanel(panel, fid);
              }
            };
            img.src = ev.target.result;
          };
          rd.readAsDataURL(file);
        };
        inp.click();
      };
      secBtns.appendChild(secFileBt);
      var secUrlBt = document.createElement('button');
      secUrlBt.className = 'mappa-btn';
      secUrlBt.textContent = '🔗 URL';
      secUrlBt.onclick = function () {
        var url = prompt('URL immagine mappa zona:');
        if (url) {
          if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
          state.mappaFlags[fid].mappaSec = url;
          if (_db) {
            _db
              .ref(_mappaFlagPath(fid) + '/mappaSec')
              .set(url)
              .then(function () {
                notify('Mappa zona salvata ✓', 'ok');
              })
              .catch(function (err) {
                notify('Errore salvataggio mappa: ' + err.message, 'err');
              });
          }
          if (_secMapFid === fid && document.getElementById('mappa-sec-overlay')) {
            _closeSecondaryMapView();
            _openSecondaryMapView(fid);
          } else {
            renderMappaFlagPanel(panel, fid);
          }
        }
      };
      secBtns.appendChild(secUrlBt);
      secSec.appendChild(secBtns);

      body.appendChild(secSec);
    }

    // Elimina flag
    var delBtn = document.createElement('button');
    delBtn.style.cssText =
      "margin-top:0.5rem;width:100%;padding:0.45rem;background:rgba(138,46,46,0.2);border:1px solid rgba(138,46,46,0.5);color:#ffa0a0;font-family:'Cinzel',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;border-radius:3px;cursor:pointer;";
    delBtn.textContent = '✕ Elimina Flag';
    delBtn.onclick = function () {
      if (!confirm('Eliminare questo flag?')) return;
      delete state.mappaFlags[fid];
      _db && _db.ref(_mappaFlagPath(fid)).remove();
      panel.classList.remove('open');
      refreshMappaFlags();
    };
    body.appendChild(delBtn);
  } else {
    // Sola lettura — stile pergamena fantasy
    var nomePg = document.createElement('div');
    nomePg.className = 'mappa-field-readonly mappa-field-readonly-name';
    nomePg.textContent = f.nome || '(Luogo senza nome)';
    body.appendChild(nomePg);

    if (f.gradimento) {
      var REP_LEVELS_PG = [
        {
          label: 'Criminali Ricercati',
          color: '#c84040',
          bg: 'rgba(138,36,36,0.25)',
          bd: 'rgba(138,36,36,0.6)',
        },
        {
          label: 'Fuorilegge Noti',
          color: '#c86040',
          bg: 'rgba(138,76,36,0.25)',
          bd: 'rgba(138,76,36,0.6)',
        },
        {
          label: 'Sconosciuti',
          color: '#8b8b40',
          bg: 'rgba(80,80,20,0.25)',
          bd: 'rgba(100,100,30,0.5)',
        },
        {
          label: 'Neutrale',
          color: '#d4b070',
          bg: 'rgba(80,70,20,0.2)',
          bd: 'rgba(120,100,40,0.5)',
        },
        {
          label: 'Rispettati',
          color: '#60a870',
          bg: 'rgba(30,80,30,0.2)',
          bd: 'rgba(50,120,50,0.5)',
        },
        {
          label: 'Eroi Locali',
          color: '#40c860',
          bg: 'rgba(20,100,40,0.25)',
          bd: 'rgba(40,140,60,0.6)',
        },
        {
          label: 'Eroi Leggendari',
          color: '#20e870',
          bg: 'rgba(10,120,50,0.3)',
          bd: 'rgba(20,160,70,0.7)',
        },
      ];
      var repMatch = REP_LEVELS_PG.find(function (r) {
        return r.label === f.gradimento;
      });
      var gradPg = document.createElement('div');
      gradPg.className = 'rep-value-display';
      gradPg.textContent = f.gradimento;
      if (repMatch) {
        gradPg.style.color = repMatch.color;
        gradPg.style.background = repMatch.bg;
        gradPg.style.borderColor = repMatch.bd;
      } else {
        gradPg.style.cssText += ';color:var(--gold-dim);border-color:var(--border-soft);';
      }
      body.appendChild(gradPg);
    }

    if (safeImageUrl(f.immagine)) {
      var img2 = document.createElement('img');
      img2.src = safeImageUrl(f.immagine);
      img2.className = 'mappa-impresa-img';
      body.appendChild(img2);
    }

    if (f.riassunto) {
      var riaDiv = document.createElement('div');
      riaDiv.style.cssText =
        "font-family:'EB Garamond',serif;font-size:15px;line-height:1.6;color:var(--text-main);font-style:italic;white-space:pre-wrap;border:1px solid var(--border-subtle);border-radius:3px;padding:0.75rem;background:rgba(0,0,0,0.15);";
      riaDiv.textContent = f.riassunto;
      body.appendChild(riaDiv);
    }

    if (!f.nome && !f.riassunto) {
      var emptyDiv = document.createElement('div');
      emptyDiv.style.cssText =
        'color:var(--text-faint);font-style:italic;font-size:14px;text-align:center;padding:1rem;';
      emptyDiv.textContent = 'Il Dungeon Master non ha ancora scritto nulla su questo luogo.';
      body.appendChild(emptyDiv);
    }
  }
}

function _refreshMappaSelectorOptions(sel) {
  // Aggiorna le opzioni del selettore mappe senza perdere il valore corrente
  var current = sel.value;
  while (sel.firstChild) sel.removeChild(sel.firstChild);

  if (!state.mappaList) state.mappaList = {};
  if (_mappaViewAsUser === '__tutte__' || _mappaViewAsUser === '__multiverso__') {
    state.mappaList['world-map-ohara'] = {
      nome: 'Mappa Mondiale Completa (Library of Ohara)',
      url: 'iframe',
      isInteractive: true,
      flags: {},
    };
    state.mappaList['naruto-world-map'] = {
      nome: 'Naruto',
      url: 'iframe',
      isInteractive: true,
      flags: {},
    };
  } else {
    delete state.mappaList['world-map-ohara'];
    delete state.mappaList['naruto-world-map'];
  }

  var ids = Object.keys(state.mappaList || {});
  ids.forEach(function (mid) {
    var opt = document.createElement('option');
    opt.value = mid;
    opt.textContent = state.mappaList[mid].nome || 'Mappa ' + mid.slice(-4);
    sel.appendChild(opt);
  });
  if (state.mappaActiveId && sel.querySelector('[value="' + state.mappaActiveId + '"]')) {
    sel.value = state.mappaActiveId;
  } else if (current && sel.querySelector('[value="' + current + '"]')) {
    sel.value = current;
  }
}
