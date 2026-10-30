/* ============================================================
   OVERLAY MAPPE POLITICHE
   ============================================================ */

function _ovGetLayer(layerKey) {
  var mid = state.mappaActiveId;
  if (!mid || !state.mappaList[mid]) return null;
  var ov = state.mappaList[mid].overlays;
  return ov && ov[layerKey] ? ov[layerKey] : null;
}

function _ovEnsure(layerKey) {
  var mid = state.mappaActiveId;
  if (!mid) return null;
  if (!state.mappaList[mid]) state.mappaList[mid] = {};
  var m = state.mappaList[mid];
  if (!m.overlays) m.overlays = {};
  if (!m.overlays[layerKey]) m.overlays[layerKey] = { factions: {}, polygons: {} };
  if (!m.overlays[layerKey].factions) m.overlays[layerKey].factions = {};
  if (!m.overlays[layerKey].polygons) m.overlays[layerKey].polygons = {};
  return m.overlays[layerKey];
}

function _ovFbSavePoly(lk, pid, data) {
  var mid = state.mappaActiveId;
  if (!_campaignDb || !mid) return;
  _campaignDb
    .ref(_mappaBasePath() + '/maps/' + mid + '/overlays/' + lk + '/polygons/' + pid)
    .set(data);
}

function _ovFbDelPoly(lk, pid) {
  var mid = state.mappaActiveId;
  if (!_campaignDb || !mid) return;
  _campaignDb
    .ref(_mappaBasePath() + '/maps/' + mid + '/overlays/' + lk + '/polygons/' + pid)
    .remove();
}

function _ovFbSaveFaction(lk, fid, data) {
  var mid = state.mappaActiveId;
  if (!_campaignDb || !mid) return;
  _campaignDb
    .ref(_mappaBasePath() + '/maps/' + mid + '/overlays/' + lk + '/factions/' + fid)
    .set(data);
}

function _ovFbDelFaction(lk, fid) {
  var mid = state.mappaActiveId;
  if (!_campaignDb || !mid) return;
  _campaignDb
    .ref(_mappaBasePath() + '/maps/' + mid + '/overlays/' + lk + '/factions/' + fid)
    .remove();
  var ld = _ovGetLayer(lk);
  if (ld && ld.polygons) {
    Object.keys(ld.polygons).forEach(function (pid) {
      if (ld.polygons[pid].factionId === fid) {
        _campaignDb
          .ref(_mappaBasePath() + '/maps/' + mid + '/overlays/' + lk + '/polygons/' + pid)
          .remove();
        delete ld.polygons[pid];
      }
    });
  }
}

function refreshMappaOverlays() {
  if (!_leafletMap || !_overlayPolyLayer) return;
  _overlayPolyLayer.clearLayers();
  var vis = state.mappaLayerVisible;
  var leg = document.querySelector('.mappa-overlay-legend');
  if (vis === 'none') {
    if (leg) leg.style.display = 'none';
    return;
  }
  var ld = _ovGetLayer(vis);
  if (!ld || !ld.polygons) {
    if (leg) leg.style.display = 'none';
    return;
  }
  var factions = ld.factions || {};
  Object.keys(ld.polygons).forEach(function (pid) {
    var poly = ld.polygons[pid];
    if (!poly || !poly.points || poly.points.length < 3) return;
    var fac = factions[poly.factionId] || {};
    var col = fac.colore || '#888';
    var latlngs = poly.points.map(function (p) {
      return [p.lat, p.lng];
    });
    var lp = L.polygon(latlngs, {
      color: col,
      fillColor: col,
      fillOpacity: 0.32,
      weight: 2,
      opacity: 0.85,
    });
    if (fac.nome)
      lp.bindTooltip(fac.nome, {
        permanent: false,
        direction: 'center',
        className: 'overlay-tooltip',
      });
    if (isDM()) {
      lp.on(
        'contextmenu',
        (function (_pid, _lk) {
          return function (e) {
            L.DomEvent.preventDefault(e);
            if (!confirm('Eliminare questo poligono?')) return;
            var _ld = _ovGetLayer(_lk);
            if (_ld && _ld.polygons) delete _ld.polygons[_pid];
            _ovFbDelPoly(_lk, _pid);
            refreshMappaOverlays();
            /* aggiorna panel se aperto */
            var op = document.querySelector('.mappa-overlay-panel.open');
            if (op) _renderOverlayPanel(op, _lk);
          };
        })(pid, vis)
      );
    }
    _overlayPolyLayer.addLayer(lp);
  });
  /* Legenda */
  if (leg) _buildOverlayLegend(leg, vis, factions, ld.polygons);
}

function _buildOverlayLegend(leg, visKey, factions, polygons) {
  var used = {};
  Object.keys(polygons).forEach(function (pid) {
    var fid = polygons[pid].factionId;
    if (factions[fid]) used[fid] = factions[fid];
  });
  var keys = Object.keys(used);
  if (!keys.length) {
    leg.style.display = 'none';
    return;
  }
  var def =
    OVERLAY_DEFS.filter(function (d) {
      return d.key === visKey;
    })[0] || {};
  leg.style.display = 'block';
  leg.innerHTML = '';
  var title = document.createElement('div');
  title.style.cssText =
    'font-family:Cinzel,serif;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#b89a58;margin-bottom:7px;border-bottom:1px solid rgba(201,165,92,0.3);padding-bottom:4px;';
  title.textContent = (def.icon || '') + ' ' + (def.label || visKey);
  leg.appendChild(title);
  keys.forEach(function (fid) {
    var fac = used[fid];
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;margin-bottom:4px;';
    var sw = document.createElement('div');
    sw.style.cssText =
      'width:13px;height:13px;border-radius:2px;border:1px solid rgba(255,255,255,0.2);background:' +
      fac.colore +
      ';flex-shrink:0;';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:12px;color:#e8d9bc;font-family:EB Garamond,Georgia,serif;';
    lbl.textContent = fac.nome || 'Zona';
    row.appendChild(sw);
    row.appendChild(lbl);
    leg.appendChild(row);
  });
}

/* ---- DISEGNO POLIGONI ---- */

function _ovStartDraw(layerKey, factionId) {
  if (!_leafletMap) return;
  _ovDrawActive = true;
  _ovDrawLayerKey = layerKey;
  _ovDrawFactionId = factionId;
  _ovDrawPoints = [];
  _clearOvDrawPreview();
  _leafletMap.dragging.disable();
  _leafletMap.getContainer().style.cursor = 'crosshair';
  var hint = document.querySelector('.mappa-draw-hint');
  if (hint) {
    hint.style.display = 'block';
    hint.innerHTML =
      '<span class="ov-hint-text" style="color:#f0d070;">🖊 0 vertici — clicca sulla mappa per aggiungere punti · <b>Shift+S</b> per salvare · ESC per annullare</span>';
  }
}

function _ovCancelDraw() {
  if (!_ovDrawActive) return;
  _ovDrawActive = false;
  _clearOvDrawPreview();
  if (_leafletMap) {
    _leafletMap.dragging.enable();
    _leafletMap.getContainer().style.cursor = '';
  }
  _ovDrawPoints = [];
  _ovDrawLayerKey = null;
  _ovDrawFactionId = null;
  var hint = document.querySelector('.mappa-draw-hint');
  if (hint) hint.style.display = 'none';
  /* ripristina bottone */
  var btn = document.getElementById('ov-draw-btn');
  if (btn) {
    btn.textContent = '✏ Disegna Zona';
    btn.classList.remove('active');
  }
}

function _clearOvDrawPreview() {
  if (!_leafletMap) return;
  if (_ovDrawPoly) {
    try {
      _leafletMap.removeLayer(_ovDrawPoly);
    } catch (e) {}
    _ovDrawPoly = null;
  }
  if (_ovDrawCursor) {
    try {
      _leafletMap.removeLayer(_ovDrawCursor);
    } catch (e) {}
    _ovDrawCursor = null;
  }
  _ovDrawMarkers.forEach(function (m) {
    try {
      _leafletMap.removeLayer(m);
    } catch (e) {}
  });
  _ovDrawMarkers = [];
}

function _ovFinishDraw() {
  if (!_ovDrawActive) return;
  if (_ovDrawPoints.length < 3) {
    var hint = document.querySelector('.mappa-draw-hint');
    if (hint) {
      var ht = hint.querySelector('.ov-hint-text');
      if (ht) {
        ht.style.color = '#ff9090';
        ht.textContent = '⚠ Servono almeno 3 vertici! Continua a cliccare sulla mappa.';
      }
    }
    return;
  }
  var lk = _ovDrawLayerKey;
  var fid = _ovDrawFactionId;
  var pts = _ovDrawPoints.slice();
  _ovCancelDraw();
  var ld = _ovEnsure(lk);
  if (!ld) return;
  var pid = 'poly_' + Date.now();
  var data = { factionId: fid, points: pts };
  ld.polygons[pid] = data;
  _ovFbSavePoly(lk, pid, data);
  /* attiva il layer se non è già visibile, così l'utente vede subito la zona */
  if (state.mappaLayerVisible !== lk) {
    state.mappaLayerVisible = lk;
    document.querySelectorAll('.mappa-layer-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    var lb = document.querySelector('.mappa-layer-btn[data-lk="' + lk + '"]');
    if (lb) lb.classList.add('active');
  }
  refreshMappaOverlays();
  /* aggiorna contatore poligoni nel pannello */
  var op = document.querySelector('.mappa-overlay-panel.open');
  if (op) _renderOverlayPanel(op, lk);
  /* messaggio di successo con pulsante per zona staccata */
  var hint2 = document.querySelector('.mappa-draw-hint');
  if (hint2) {
    var facNome =
      ld.factions && ld.factions[fid] && ld.factions[fid].nome ? ld.factions[fid].nome : '';
    hint2.style.display = 'block';
    var savedNotice = document.createElement('span');
    savedNotice.style.cssText = 'color:#90ee90;';
    savedNotice.textContent = '✅ Zona salvata' + (facNome ? ' per “' + facNome + '”' : '') + '!';
    var detachedNotice = document.createElement('span');
    detachedNotice.style.cssText = 'color:var(--text-muted);font-size:11px;margin-left:8px;';
    detachedNotice.textContent = 'Per una zona staccata della stessa fazione →';
    var anotherZone = document.createElement('button');
    anotherZone.style.cssText =
      'margin-left:8px;background:rgba(201,165,92,0.15);border:1px solid var(--gold-dim);color:var(--gold);border-radius:4px;padding:4px 12px;cursor:pointer;font-size:11px;font-family:inherit;vertical-align:middle;';
    anotherZone.textContent = '✏ Altra Zona';
    anotherZone.onclick = function () {
      _ovStartDraw(lk, fid);
    };
    hint2.replaceChildren(savedNotice, detachedNotice, anotherZone);
    setTimeout(function () {
      var h2 = document.querySelector('.mappa-draw-hint');
      if (h2 && !_ovDrawActive) h2.style.display = 'none';
    }, 7000);
  }
}

/* ---- PANNELLO DM GESTIONE FAZIONI ---- */

function _renderOverlayPanel(panel, layerKey) {
  var def = OVERLAY_DEFS.filter(function (d) {
    return d.key === layerKey;
  })[0] || { label: layerKey, icon: '◉' };
  panel.innerHTML = '';

  /* Header */
  var head = document.createElement('div');
  head.className = 'mappa-overlay-panel-head';
  var htitle = document.createElement('span');
  htitle.style.cssText =
    'font-family:Cinzel,serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:var(--gold-bright);';
  htitle.textContent = def.icon + ' ' + def.label;
  var hclose = document.createElement('button');
  hclose.style.cssText =
    'background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;line-height:1;padding:0;';
  hclose.textContent = '✕';
  hclose.onclick = function () {
    panel.classList.remove('open');
  };
  head.appendChild(htitle);
  head.appendChild(hclose);
  panel.appendChild(head);

  var body = document.createElement('div');
  body.style.cssText =
    'flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;';
  panel.appendChild(body);

  var ld = _ovEnsure(layerKey);
  var factions = ld.factions;
  var polygons = ld.polygons;

  /* Layer toggle link */
  var toggleNote = document.createElement('div');
  toggleNote.style.cssText =
    'font-size:11px;color:var(--text-muted);font-style:italic;margin-bottom:4px;';
  var vis = state.mappaLayerVisible === layerKey;
  toggleNote.textContent = vis
    ? '✅ Layer attivo sulla mappa'
    : '⭕ Layer non visibile — attivalo dalla barra in basso';
  body.appendChild(toggleNote);

  /* SEZIONE FAZIONI */
  var facTitle = document.createElement('div');
  facTitle.style.cssText =
    'font-family:Cinzel,serif;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold-dim);margin-top:6px;border-bottom:1px solid var(--border-subtle);padding-bottom:4px;margin-bottom:6px;';
  facTitle.textContent = 'Fazioni / Entità';
  body.appendChild(facTitle);

  /* Lista fazioni */
  var facList = document.createElement('div');
  Object.keys(factions).forEach(function (fid) {
    var fac = factions[fid];
    var row = document.createElement('div');
    row.className = 'ovfac-row';

    /* Swatch colore (cliccabile) */
    var sw = document.createElement('div');
    sw.className = 'ovfac-swatch';
    sw.style.background = fac.colore || '#888';
    var colorInp = document.createElement('input');
    colorInp.type = 'color';
    colorInp.value = fac.colore || '#888888';
    colorInp.oninput = (function (_fid, _sw) {
      return function () {
        factions[_fid].colore = this.value;
        _sw.style.background = this.value;
        _ovFbSaveFaction(layerKey, _fid, factions[_fid]);
        refreshMappaOverlays();
      };
    })(fid, sw);
    sw.appendChild(colorInp);

    /* Nome fazione */
    var nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.className = 'ovfac-name';
    nameInp.value = fac.nome || '';
    nameInp.placeholder = 'Nome fazione…';
    nameInp.oninput = (function (_fid) {
      return function () {
        factions[_fid].nome = this.value;
        _ovFbSaveFaction(layerKey, _fid, factions[_fid]);
        refreshMappaOverlays();
      };
    })(fid);

    /* Contatore poligoni */
    var polyCount = Object.keys(polygons).filter(function (pid) {
      return polygons[pid].factionId === fid;
    }).length;
    var cnt = document.createElement('span');
    cnt.style.cssText = 'font-size:10px;color:var(--text-muted);flex-shrink:0;';
    cnt.title = polyCount + ' zone disegnate';
    cnt.textContent = '(' + polyCount + ')';

    /* Pulsante disegna */
    var drawBtn = document.createElement('button');
    drawBtn.id = 'ov-draw-btn';
    drawBtn.style.cssText =
      'background:transparent;border:1px solid rgba(201,165,92,0.4);color:var(--gold-dim);border-radius:3px;padding:2px 7px;font-size:10px;cursor:pointer;white-space:nowrap;flex-shrink:0;';
    drawBtn.textContent = '✏';
    drawBtn.title = 'Disegna zona per questa fazione';
    drawBtn.onclick = (function (_fid, _btn) {
      return function () {
        if (_ovDrawActive) {
          _ovCancelDraw();
          _btn.textContent = '✏';
          return;
        }
        /* disattiva altri draw btn */
        facList.querySelectorAll('.ov-draw-fac-btn').forEach(function (b) {
          b.textContent = '✏';
          b.style.color = 'var(--gold-dim)';
        });
        _btn.textContent = '⏹';
        _btn.style.color = '#f0d070';
        _ovStartDraw(layerKey, _fid);
      };
    })(fid, drawBtn);
    drawBtn.className = 'ov-draw-fac-btn';

    /* Elimina fazione */
    var delBtn = document.createElement('button');
    delBtn.style.cssText =
      'background:transparent;border:none;color:#e88;cursor:pointer;font-size:13px;flex-shrink:0;padding:0;line-height:1;';
    delBtn.textContent = '✕';
    delBtn.title = 'Elimina fazione e tutte le sue zone';
    delBtn.onclick = (function (_fid) {
      return function () {
        var facNome = factions[_fid] ? factions[_fid].nome || 'questa fazione' : 'questa fazione';
        if (!confirm('Eliminare "' + facNome + '" e tutte le sue zone? Non recuperabile.')) return;
        _ovFbDelFaction(layerKey, _fid);
        delete factions[_fid];
        refreshMappaOverlays();
        _renderOverlayPanel(panel, layerKey);
      };
    })(fid);

    row.appendChild(sw);
    row.appendChild(nameInp);
    row.appendChild(cnt);
    row.appendChild(drawBtn);
    row.appendChild(delBtn);
    facList.appendChild(row);
  });
  body.appendChild(facList);

  /* Aggiungi fazione */
  var addFacBtn = document.createElement('button');
  addFacBtn.className = 'mappa-btn mappa-btn-add-map';
  addFacBtn.style.cssText +=
    'font-size:10px;padding:5px 10px;width:100%;justify-content:center;margin-top:4px;';
  addFacBtn.textContent = '+ Nuova Fazione';
  addFacBtn.onclick = function () {
    var fid = 'fac_' + Date.now();
    var colors = [
      '#4a7fc1',
      '#c14a4a',
      '#4ac14a',
      '#c19a4a',
      '#9a4ac1',
      '#4ac1b8',
      '#c14a9a',
      '#c1874a',
    ];
    var usedCount = Object.keys(factions).length;
    var defColor = colors[usedCount % colors.length];
    factions[fid] = { nome: '', colore: defColor };
    _ovFbSaveFaction(layerKey, fid, factions[fid]);
    _renderOverlayPanel(panel, layerKey);
    /* focus sul nuovo campo nome */
    setTimeout(function () {
      var rows = facList.querySelectorAll('.ovfac-row');
      if (rows.length) {
        var inp = rows[rows.length - 1].querySelector('.ovfac-name');
        if (inp) inp.focus();
      }
    }, 50);
  };
  body.appendChild(addFacBtn);

  /* Hint ESC */
  var hintDiv = document.createElement('div');
  hintDiv.style.cssText =
    'font-size:10px;color:var(--text-faint);font-style:italic;margin-top:8px;line-height:1.5;border-top:1px solid var(--border-subtle);padding-top:8px;';
  hintDiv.innerHTML =
    "<b>Come disegnare:</b><br>1. Clicca ✏ accanto alla fazione<br>2. Click sulla mappa per aggiungere vertici (illimitati)<br>3. Clicca <b>💾 Salva Zona</b> per chiudere<br>4. ESC per annullare<br><br><b>Zone staccate:</b> salva la prima zona, poi clicca di nuovo ✏ per disegnarne un'altra separata della stessa fazione.<br><br><b>Tasto destro</b> su un poligono per eliminarlo";
  body.appendChild(hintDiv);
}
