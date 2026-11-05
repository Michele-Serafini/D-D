/* ============================================================================
   SEZIONE 12: ATLANTE CARTOGRAFICO INTERATTIVO (renderMappa - Leaflet)
   ============================================================================ */
function renderMappa() {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;';

  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:1.5rem;padding-bottom:1rem;';
  hc.innerHTML =
    '<div class="header-eyebrow mb-2"><span>Cartografia</span></div>' +
    '<h1 class="header-title">Mappa del Mondo</h1>';
  header.appendChild(hc);
  wrap.appendChild(header);

  var mappaWrap = document.createElement('div');
  mappaWrap.className = 'mappa-wrap';
  mappaWrap.style.cssText = 'flex:1;position:relative;';

  var mapContainer = document.createElement('div');
  mapContainer.className = 'mappa-container';
  mapContainer.style.cssText = 'flex:1;position:relative;height:calc(100vh - 130px);';

  var mapDiv = document.createElement('div');
  mapDiv.id = 'leaflet-map';
  mapDiv.style.cssText = 'width:100%;height:100%;';
  mapContainer.appendChild(mapDiv);

  // DM Controls
  if (isDM()) {
    var dmControls = document.createElement('div');
    dmControls.className = 'mappa-dm-controls';

    // ---- FILTRO PERSONA (solo admin) ----
    if (isDM()) {
      var personaWrap = document.createElement('div');
      personaWrap.style.cssText =
        'display:inline-flex;align-items:center;flex-wrap:wrap;gap:0.35rem;';
      var personaLabel = document.createElement('span');
      personaLabel.style.cssText =
        'font-size:10px;font-weight:700;letter-spacing:0.12em;color:rgba(245,166,35,0.85);white-space:nowrap;margin-right:0.15rem;text-shadow:0 1px 4px rgba(0,0,0,0.9);';
      personaLabel.textContent = 'MAPPE:';
      personaWrap.appendChild(personaLabel);
      var _mkPersonaPill = function (label, val) {
        var isActive =
          (val === '' && !_mappaViewAsUser) || (val !== '' && val === _mappaViewAsUser);
        var btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText =
          "font-family:'Cinzel',serif;font-size:11px;font-weight:700;letter-spacing:0.06em;padding:0.35rem 0.85rem;border-radius:20px;cursor:pointer;white-space:nowrap;transition:all 0.15s;" +
          'background:' +
          (isActive ? 'rgba(50,33,8,0.97)' : 'rgba(18,12,3,0.88)') +
          ';' +
          'border:1.5px solid ' +
          (isActive ? '#f5a623' : 'rgba(245,166,35,0.45)') +
          ';' +
          'color:' +
          (isActive ? '#f5c842' : 'rgba(245,166,35,0.75)') +
          ';' +
          'box-shadow:' +
          (isActive
            ? '0 0 10px rgba(245,166,35,0.35),0 2px 8px rgba(0,0,0,0.7)'
            : '0 2px 8px rgba(0,0,0,0.65)') +
          ';';
        btn.onmouseenter = function () {
          btn.style.color = '#f5c842';
          btn.style.borderColor = '#f5a623';
        };
        btn.onmouseleave = function () {
          btn.style.color = isActive ? '#f5c842' : 'rgba(245,166,35,0.75)';
          btn.style.borderColor = isActive ? '#f5a623' : 'rgba(245,166,35,0.45)';
        };
        btn.onclick = function () {
          _mappaViewAsUser = val === '' ? null : val;
          _attachMappaListener();
          if (state.section === 'mappa') renderMain();
        };
        return btn;
      };
      personaWrap.appendChild(_mkPersonaPill('🌐 Tutte', '__tutte__'));
      personaWrap.appendChild(_mkPersonaPill('🌌 Multiverso', '__multiverso__'));
      personaWrap.appendChild(
        _mkPersonaPill('⭐ ' + (state.currentUser ? state.currentUser.username : 'Mie'), '')
      );
      if (CampaignManager.profiles() && typeof CampaignManager.profiles() === 'object') {
        Object.keys(CampaignManager.profiles())
          .sort()
          .forEach(function (uid) {
            if (uid === (state.currentUser && state.currentUser.username)) return;
            if (CampaignManager.isMaster(uid)) {
              personaWrap.appendChild(_mkPersonaPill('\uD83E\uDDD1\u200D\uD83C\uDFEB ' + uid, uid));
            }
          });
      }
      dmControls.appendChild(personaWrap);
    }

    // ---- SELETTORE MAPPA ----
    var selectorWrap = document.createElement('div');
    selectorWrap.style.cssText = 'display:inline-flex;align-items:center;gap:0.4rem;';

    var selectorLabel = document.createElement('span');
    selectorLabel.textContent = '🗺';
    selectorLabel.style.cssText = 'font-size:14px;';
    selectorWrap.appendChild(selectorLabel);

    var mapSelector = document.createElement('select');
    mapSelector.id = 'mappa-selector';
    mapSelector.className = 'regia-scene-select';
    mapSelector.style.cssText = 'max-width:160px;font-size:12px;padding:0.3rem 0.5rem;';
    _refreshMappaSelectorOptions(mapSelector);

    mapSelector.onchange = function () {
      var mid = mapSelector.value;
      if (!mid || !state.mappaList[mid]) return;
      var prevMapId = state.mappaActiveId;
      fbSaveStoriaMarkers(prevMapId);
      state.mappaActiveId = mid;
      state.mappaUrl = state.mappaList[mid].url || '';
      state.mappaFlags = state.mappaList[mid].flags || {};
      state.worldbuilding = []; // svuota mentre carica il worldbuilding della nuova mappa
      // Salva mappa attiva su Firebase
      if (!_mappaViewAsUser)
        _campaignDb && _campaignDb.ref(_mappaBasePath() + '/activeMapId').set(mid);
      // Aggiorna il worldbuilding alla mappa selezionata
      _attachWorldbuildingListener(mid);
      // Carica i marker della nuova mappa dalla cache Firebase
      state.storia.markers =
        window._storiaMarkersCache &&
        window._storiaMarkersCache[mid] &&
        typeof window._storiaMarkersCache[mid] === 'object'
          ? window._storiaMarkersCache[mid]
          : {};
      refreshStoriaMarkers();
      // Ricrea la mappa Leaflet
      if (_leafletMap) {
        try {
          _leafletMap.remove();
        } catch (e) {}
        _leafletMap = null;
      }
      if (state.mappaUrl) {
        initLeafletMap(mapDiv, infoPanel);
      } else {
        mapDiv.innerHTML =
          '<div class="mappa-no-img"><div class="mappa-no-img-title">Nessuna immagine per questa mappa</div><div class="mappa-no-img-sub">Usa "Carica Immagine" per aggiungerne una.</div></div>';
      }
      // Aggiorna testo pulsante carica
      addMapBtn.innerHTML = state.mappaUrl ? '✎ Cambia Immagine' : '🗺 Carica Immagine';
      // Aggiorna pulsanti move/flag
      _updateMappaMoveFlag(dmControls, mapDiv);
    };
    selectorWrap.appendChild(mapSelector);
    dmControls.appendChild(selectorWrap);

    // ---- AGGIUNGI NUOVA MAPPA ----
    var newMapBtn = document.createElement('button');
    if (!isDM()) newMapBtn.style.display = 'none';
    newMapBtn.className = 'mappa-btn mappa-btn-add-map';
    newMapBtn.innerHTML = '➕ Nuova Mappa';
    newMapBtn.onclick = function () {
      var nomeMappa = prompt(
        'Nome della nuova campagna/mappa:',
        'Campagna ' + (Object.keys(state.mappaList || {}).length + 1)
      );
      if (!nomeMappa) return;
      var mid = 'm_' + Date.now();
      if (!state.mappaList) state.mappaList = {};
      state.mappaList[mid] = { nome: nomeMappa, url: '', flags: {} };
      state.mappaActiveId = mid;
      state.mappaUrl = '';
      state.mappaFlags = {};
      _campaignDb &&
        _campaignDb
          .ref(_mappaBasePath() + '/maps/' + mid)
          .set({ nome: nomeMappa, url: '', flags: {} });
      _campaignDb && _campaignDb.ref(_mappaBasePath() + '/activeMapId').set(mid);
      _refreshMappaSelectorOptions(mapSelector);
      mapSelector.value = mid;
      mapDiv.innerHTML =
        '<div class="mappa-no-img"><div class="mappa-no-img-title">' +
        nomeMappa +
        '</div><div class="mappa-no-img-sub">Usa "Carica Immagine" per aggiungere la mappa.</div></div>';
      addMapBtn.innerHTML = '🗺 Carica Immagine';
      _updateMappaMoveFlag(dmControls, mapDiv);
    };
    dmControls.appendChild(newMapBtn);

    // ---- RINOMINA MAPPA ----
    var renameMapBtn = document.createElement('button');
    if (!isDM()) renameMapBtn.style.display = 'none';
    renameMapBtn.className = 'mappa-btn';
    renameMapBtn.innerHTML = '✏️ Rinomina';
    renameMapBtn.title = 'Rinomina mappa selezionata';
    renameMapBtn.onclick = function () {
      if (!state.mappaActiveId || !state.mappaList[state.mappaActiveId]) return;
      if (state.mappaActiveId === 'world-map-ohara') {
        alert('Non puoi rinominare questa mappa speciale.');
        return;
      }
      if (state.mappaActiveId === 'naruto-world-map') {
        alert('Non puoi rinominare questa mappa speciale.');
        return;
      }
      var current = state.mappaList[state.mappaActiveId].nome || '';
      var newName = prompt('Nuovo nome:', current);
      if (!newName || newName === current) return;
      state.mappaList[state.mappaActiveId].nome = newName;
      _campaignDb &&
        _campaignDb.ref(_mappaBasePath() + '/maps/' + state.mappaActiveId + '/nome').set(newName);
      _refreshMappaSelectorOptions(mapSelector);
    };
    dmControls.appendChild(renameMapBtn);

    // ---- CARICA / CAMBIA IMMAGINE ----
    var addMapBtn = document.createElement('button');
    if (!isDM()) addMapBtn.style.display = 'none';
    addMapBtn.className = 'mappa-btn mappa-btn-add-map';
    addMapBtn.innerHTML = state.mappaUrl ? '✎ Cambia Immagine' : '🗺 Carica Immagine';
    addMapBtn.onclick = function () {
      if (state.mappaActiveId === 'world-map-ohara') {
        alert("Non puoi cambiare l'immagine di questa mappa speciale.");
        return;
      }
      if (state.mappaActiveId === 'naruto-world-map') {
        alert("Non puoi cambiare l'immagine di questa mappa speciale.");
        return;
      }
      if (!state.mappaActiveId && Object.keys(state.mappaList || {}).length === 0) {
        alert('Prima crea una mappa con "Nuova Mappa".');
        return;
      }
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          var img = new Image();
          img.onload = function () {
            var canvas = document.createElement('canvas');
            var maxDim = 2500;
            var ratio = Math.min(maxDim / Math.max(img.width, img.height), 1);
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            state.mappaUrl = dataUrl;
            // Salva nella mappa attiva
            var mid = state.mappaActiveId;
            if (!mid) {
              mid = 'm_' + Date.now();
              state.mappaList[mid] = { nome: 'Mappa 1', url: dataUrl, flags: {} };
              state.mappaActiveId = mid;
              _campaignDb &&
                _campaignDb
                  .ref(_mappaBasePath() + '/maps/' + mid)
                  .set({ nome: 'Mappa 1', url: dataUrl, flags: {} });
              _campaignDb && _campaignDb.ref(_mappaBasePath() + '/activeMapId').set(mid);
              _refreshMappaSelectorOptions(mapSelector);
              mapSelector.value = mid;
            } else {
              if (!state.mappaList[mid]) state.mappaList[mid] = { nome: 'Mappa', flags: {} };
              state.mappaList[mid].url = dataUrl;
              _campaignDb &&
                _campaignDb.ref(_mappaBasePath() + '/maps/' + mid + '/url').set(dataUrl);
            }
            if (_leafletMap) {
              _leafletMap.remove();
              _leafletMap = null;
            }
            initLeafletMap(mapDiv, infoPanel);
            addMapBtn.innerHTML = '✎ Cambia Immagine';
            _updateMappaMoveFlag(dmControls, mapDiv);
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      };
      inp.click();
    };
    dmControls.appendChild(addMapBtn);

    // ---- ELIMINA MAPPA ----
    var delMapBtn = document.createElement('button');
    if (!isDM()) delMapBtn.style.display = 'none';
    delMapBtn.className = 'mappa-btn btn-blood';
    delMapBtn.style.cssText = 'font-size:11px;padding:0.3rem 0.6rem;';
    delMapBtn.innerHTML = '🗑 Elimina';
    delMapBtn.title = 'Elimina mappa selezionata';
    delMapBtn.onclick = function () {
      if (!state.mappaActiveId || !state.mappaList[state.mappaActiveId]) return;
      if (state.mappaActiveId === 'world-map-ohara') {
        alert('Non puoi eliminare questa mappa speciale.');
        return;
      }
      if (state.mappaActiveId === 'naruto-world-map') {
        alert('Non puoi eliminare questa mappa speciale.');
        return;
      }
      var nomeMappa = state.mappaList[state.mappaActiveId].nome || state.mappaActiveId;
      if (!confirm('Eliminare "' + nomeMappa + '"? Tutti i flag verranno persi.')) return;
      _campaignDb && _campaignDb.ref(_mappaBasePath() + '/maps/' + state.mappaActiveId).remove();
      delete state.mappaList[state.mappaActiveId];
      // Seleziona un'altra mappa
      var ids = Object.keys(state.mappaList);
      if (ids.length > 0) {
        state.mappaActiveId = ids[0];
        state.mappaUrl = state.mappaList[ids[0]].url || '';
        state.mappaFlags = state.mappaList[ids[0]].flags || {};
        _campaignDb && _campaignDb.ref(_mappaBasePath() + '/activeMapId').set(ids[0]);
      } else {
        state.mappaActiveId = '';
        state.mappaUrl = '';
        state.mappaFlags = {};
        _campaignDb && _campaignDb.ref(_mappaBasePath() + '/activeMapId').set('');
      }
      _refreshMappaSelectorOptions(mapSelector);
      if (_leafletMap) {
        try {
          _leafletMap.remove();
        } catch (e) {}
        _leafletMap = null;
      }
      if (state.mappaUrl) {
        initLeafletMap(mapDiv, infoPanel);
      } else {
        mapDiv.innerHTML =
          '<div class="mappa-no-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg><div class="mappa-no-img-title">Nessuna mappa selezionata</div><div class="mappa-no-img-sub">Crea una nuova mappa o carica un\'immagine.</div></div>';
      }
      addMapBtn.innerHTML = state.mappaUrl ? '✎ Cambia Immagine' : '🗺 Carica Immagine';
      _updateMappaMoveFlag(dmControls, mapDiv);
    };
    dmControls.appendChild(delMapBtn);

    // ---- RIASSEGNA MAPPA (solo admin) ----
    if (isDM()) {
      var reassignBtn = document.createElement('button');
      reassignBtn.className = 'mappa-btn';
      reassignBtn.style.cssText = 'font-size:11px;padding:0.3rem 0.6rem;';
      reassignBtn.innerHTML = '🔁 Sposta/Riassegna';
      reassignBtn.title = 'Sposta mappa ad altro master o multiverso';
      reassignBtn.onclick = function () {
        if (!state.mappaActiveId || !state.mappaList[state.mappaActiveId]) return;
        if (state.mappaActiveId === 'world-map-ohara') {
          alert('Non puoi spostare questa mappa speciale.');
          return;
        }
        if (state.mappaActiveId === 'naruto-world-map') {
          alert('Non puoi spostare questa mappa speciale.');
          return;
        }

        var optionsText = 'Seleziona destinazione:\n1. Multiverso\n';
        var dests = [{ id: 'multiverso', path: 'state/multiverso/mappa' }];
        var _idx = 2;
        if (CampaignManager.profiles() && typeof CampaignManager.profiles() === 'object') {
          Object.keys(CampaignManager.profiles())
            .sort()
            .forEach(function (uid) {
              if (CampaignManager.isMaster(uid)) {
                optionsText += _idx + '. ' + uid + '\n';
                dests.push({ id: uid, path: 'users/' + uid + '/mappa' });
                _idx++;
              }
            });
        }

        var choice = prompt(optionsText);
        if (!choice) return;
        var idx = parseInt(choice, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= dests.length) {
          alert('Scelta non valida.');
          return;
        }

        var dest = dests[idx];
        var destPath = dest.path;
        var oldPath = _mappaBasePath();

        if (oldPath === destPath) {
          alert('La mappa è già in questa destinazione.');
          return;
        }
        if (
          !confirm(
            'Sei sicuro di voler spostare la mappa "' +
              state.mappaList[state.mappaActiveId].nome +
              '" verso ' +
              dest.id +
              '?'
          )
        )
          return;

        var mapData = state.mappaList[state.mappaActiveId];
        _campaignDb.ref(destPath + '/maps/' + state.mappaActiveId).set(mapData, function (err) {
          if (err) {
            alert('Errore nello spostamento.');
            return;
          }
          _campaignDb.ref(oldPath + '/maps/' + state.mappaActiveId).remove();
          alert('Mappa spostata con successo in ' + dest.id);
          _attachMappaListener();
        });
      };
      dmControls.appendChild(reassignBtn);
    }

    // ---- MOVE / FLAG ----
    _updateMappaMoveFlag(dmControls, mapDiv);

    mapContainer.appendChild(dmControls);
  }

  /* ---- OVERLAY PANEL (DM, slide da destra, dentro mapContainer) ---- */
  if (isDM()) {
    var overlayPanel = document.createElement('div');
    overlayPanel.className = 'mappa-overlay-panel';
    mapContainer.appendChild(overlayPanel);
  }

  /* ---- LAYER BAR (visibile a tutti, bottom-center della mappa) ---- */
  var layerBar = document.createElement('div');
  layerBar.className = 'mappa-layer-bar';
  OVERLAY_DEFS.forEach(function (def) {
    var btn = document.createElement('button');
    btn.className = 'mappa-layer-btn' + (state.mappaLayerVisible === def.key ? ' active' : '');
    btn.dataset.lk = def.key;
    btn.textContent = def.icon + ' ' + def.label;
    btn.onclick = function () {
      if (state.mappaLayerVisible === def.key) {
        state.mappaLayerVisible = 'none';
        layerBar.querySelectorAll('.mappa-layer-btn').forEach(function (b) {
          b.classList.remove('active');
        });
      } else {
        state.mappaLayerVisible = def.key;
        layerBar.querySelectorAll('.mappa-layer-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        /* se il panel overlay è aperto aggiornalo per il nuovo layer */
        var op = document.querySelector('.mappa-overlay-panel.open');
        if (op) {
          op.dataset.lk = def.key;
          _renderOverlayPanel(op, def.key);
        }
      }
      refreshMappaOverlays();
    };
    layerBar.appendChild(btn);
  });
  mapContainer.appendChild(layerBar);

  /* ---- LEGENDA OVERLAY (top-right, visibile a tutti) ---- */
  var ovLegend = document.createElement('div');
  ovLegend.className = 'mappa-overlay-legend';
  ovLegend.style.display = 'none';
  mapContainer.appendChild(ovLegend);

  /* ---- DRAW HINT (top-center, visibile solo durante disegno) ---- */
  var drawHint = document.createElement('div');
  drawHint.className = 'mappa-draw-hint';
  drawHint.style.display = 'none';
  mapContainer.appendChild(drawHint);

  // Pannello info flag (destra)
  var infoPanel = document.createElement('div');
  infoPanel.className = 'mappa-info-panel';
  infoPanel.innerHTML =
    '<div class="mappa-info-header">' +
    '<span class="mappa-info-title">📜 Scheda Luogo</span>' +
    '<button class="regia-close" id="mappa-panel-close" style="cursor:pointer;">' +
    ICON.x +
    '</button>' +
    '</div>' +
    '<div class="mappa-info-body"></div>';
  infoPanel.querySelector('#mappa-panel-close').onclick = function () {
    infoPanel.classList.remove('open');
  };

  mappaWrap.appendChild(mapContainer);
  mappaWrap.appendChild(infoPanel);

  /* ---- BARRA SELEZIONE DM (solo PG) ---- */
  if (isPG()) {
    var pgSelectorBar = document.createElement('div');
    pgSelectorBar.className = 'pg-mappa-selector';
    pgSelectorBar.innerHTML = '<span class="pg-mappa-selector-label">Mappa di:</span>';
    wrap.appendChild(pgSelectorBar);

    var _buildPgPills = function (users) {
      var existing = pgSelectorBar.querySelectorAll('.pg-mappa-pill');
      existing.forEach(function (p) {
        p.remove();
      });
      var hasDms = false;
      Object.keys(users).forEach(function (k) {
        var u = users[k];
        if (!u || !CampaignManager.isMaster(k)) return;
        hasDms = true;
        var pill = document.createElement('button');
        pill.className = 'pg-mappa-pill' + (_mappaViewAsUser === k ? ' active' : '');
        pill.textContent = k;
        pill.onclick = function () {
          if (_mappaViewAsUser === k) return;
          _mappaViewAsUser = k;
          state.mappaUrl = '';
          state.mappaList = {};
          state.mappaActiveId = null;
          pgSelectorBar.querySelectorAll('.pg-mappa-pill').forEach(function (p) {
            p.classList.remove('active');
          });
          pill.classList.add('active');
          if (_leafletMap) {
            try {
              _leafletMap.remove();
            } catch (e) {}
            _leafletMap = null;
          }
          mapDiv.innerHTML =
            '<div class="mappa-no-img" style="opacity:0.6;"><div class="mappa-no-img-title" style="font-size:13px;">Caricamento mappa di ' +
            k +
            '...</div></div>';
          _attachMappaListener();
        };
        pgSelectorBar.appendChild(pill);
      });
      if (!hasDms) pgSelectorBar.style.display = 'none';
    };
    if (CampaignManager.profiles() && Object.keys(CampaignManager.profiles()).length > 0) {
      _buildPgPills(CampaignManager.profiles());
    } else {
      _campaignDb.ref('users').once('value', function (snap) {
        _buildPgPills(snap.val() || {});
      });
    }
  }

  wrap.appendChild(mappaWrap);

  // Inizializza Leaflet dopo che il DOM è stato aggiunto
  if (isPG()) {
    setTimeout(function () {
      if (state.mappaUrl) {
        initLeafletMap(mapDiv, infoPanel);
      } else {
        mapDiv.innerHTML =
          '<div class="mappa-no-img" style="opacity:0.6;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg><div class="mappa-no-img-title" style="font-size:13px;">Caricamento mappa...</div></div>';
        setTimeout(function () {
          if (!state.mappaUrl && document.getElementById('leaflet-map') === mapDiv) {
            mapDiv.innerHTML =
              '<div class="mappa-no-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg><div class="mappa-no-img-title">Mappa non ancora disponibile</div><div class="mappa-no-img-sub">Il Dungeon Master non ha ancora caricato la mappa del mondo.</div></div>';
          }
        }, 4000);
      }
    }, 80);
  } else {
    setTimeout(function () {
      if (state.mappaUrl) {
        initLeafletMap(mapDiv, infoPanel);
      } else {
        mapDiv.innerHTML =
          '<div class="mappa-no-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg><div class="mappa-no-img-title">Nessuna mappa caricata</div><div class="mappa-no-img-sub">Usa "Nuova Mappa" per creare la prima mappa, poi "Carica Immagine".</div></div>';
      }
    }, 80);
  }

  return wrap;
}

// Helper: aggiorna/crea i pulsanti Muovi/Flag nella toolbar DM
function _updateMappaMoveFlag(dmControls, mapDiv) {
  var oldMove = dmControls.querySelector('.mappa-btn-move');
  var oldFlag = dmControls.querySelector('.mappa-btn-flag');
  var oldOvBtn = dmControls.querySelector('.mappa-btn-overlay');
  if (oldMove) oldMove.remove();
  if (oldFlag) oldFlag.remove();
  if (oldOvBtn) oldOvBtn.remove();
  if (
    !state.mappaUrl ||
    state.mappaActiveId === 'world-map-ohara' ||
    state.mappaActiveId === 'naruto-world-map'
  )
    return;

  var moveBtn = document.createElement('button');
  moveBtn.className = 'mappa-btn mappa-btn-move' + (state.mappaMode === 'move' ? ' active' : '');
  moveBtn.innerHTML = '✋ Muovi Mappa';
  moveBtn.onclick = function () {
    state.mappaMode = 'move';
    moveBtn.classList.add('active');
    flagBtn.classList.remove('active');
    if (_leafletMap) _leafletMap.dragging.enable();
  };
  dmControls.appendChild(moveBtn);

  var flagBtn = document.createElement('button');
  flagBtn.className = 'mappa-btn mappa-btn-flag' + (state.mappaMode === 'flag' ? ' active' : '');
  flagBtn.innerHTML = '📍 Aggiungi Flag';
  flagBtn.onclick = function () {
    state.mappaMode = 'flag';
    flagBtn.classList.add('active');
    moveBtn.classList.remove('active');
    if (_ovDrawActive) _ovCancelDraw();
  };
  dmControls.appendChild(flagBtn);

  var ovBtn = document.createElement('button');
  ovBtn.className = 'mappa-btn mappa-btn-overlay';
  ovBtn.innerHTML = '⚑ Layer Overlay';
  ovBtn.title = 'Gestisci fazioni e zone di influenza';
  ovBtn.onclick = function () {
    var lk = state.mappaLayerVisible !== 'none' ? state.mappaLayerVisible : OVERLAY_DEFS[0].key;
    var panel = document.querySelector('.mappa-overlay-panel');
    if (!panel) return;
    if (panel.classList.contains('open') && panel.dataset.lk === lk) {
      panel.classList.remove('open');
    } else {
      panel.dataset.lk = lk;
      panel.classList.add('open');
      _renderOverlayPanel(panel, lk);
    }
  };
  dmControls.appendChild(ovBtn);
}

function initLeafletMap(mapDiv, infoPanel) {
  if (_leafletMap) {
    try {
      _leafletMap.remove();
    } catch (e) {}
    _leafletMap = null;
  }
  mapDiv.innerHTML = '';

  if (state.mappaActiveId === 'world-map-ohara') {
    mapDiv.innerHTML =
      '<iframe src="https://thelibraryofohara.com/onepieceworldmap/" style="width: 100%; height: 100%; border: none; border-radius: 6px;" allowfullscreen></iframe>';
    return;
  }

  if (state.mappaActiveId === 'naruto-world-map') {
    mapDiv.innerHTML =
      '<div style="width: 100%; height: 100%; position: relative; display: flex; flex-direction: column;"><div style="background: #1a1a2e; padding: 10px; text-align: center; border-bottom: 1px solid #c9a55c; flex-shrink: 0;"><a href="https://www.worldanvil.com/w/naruto-5e-world-scarletbunnydungeon/map/0019a94e-5b71-40ad-91a5-c579d57a803e" target="_blank" style="color: #c9a55c; text-decoration: none; font-weight: bold; font-family: \'Cinzel\', serif; border: 1px solid #c9a55c; padding: 5px 15px; border-radius: 4px; display: inline-block; cursor:pointer;">🔗 Apri mappa a schermo intero / nuova scheda</a><div style="font-size: 11px; color: #aaa; margin-top: 5px;">Se la mappa qui sotto non viene caricata o risulta bloccata, usa questo pulsante.</div></div><iframe src="https://www.worldanvil.com/w/naruto-5e-world-scarletbunnydungeon/map/0019a94e-5b71-40ad-91a5-c579d57a803e" style="flex: 1; width: 100%; border: none; border-radius: 0 0 6px 6px;" allowfullscreen></iframe></div>';
    return;
  }

  if (typeof L === 'undefined') {
    ensureLeaflet()
      .then(function () {
        if (mapDiv.isConnected) initLeafletMap(mapDiv, infoPanel);
      })
      .catch(function (error) {
        notify(error.message);
      });
    return;
  }

  var img = new Image();
  img.onload = function () {
    var w = img.naturalWidth || 1000;
    var h = img.naturalHeight || 700;
    var bounds = [
      [0, 0],
      [h, w],
    ];
    _leafletMap = L.map(mapDiv, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      zoomControl: false,
      attributionControl: false,
    });
    L.imageOverlay(state.mappaUrl, bounds).addTo(_leafletMap);
    _leafletMap.fitBounds(bounds);

    _flagLayer = L.layerGroup().addTo(_leafletMap);
    refreshMappaFlags();

    _overlayPolyLayer = L.layerGroup().addTo(_leafletMap);
    refreshMappaOverlays();

    /* ESC handler per annullare disegno */
    if (window._ovEscHandler) document.removeEventListener('keydown', window._ovEscHandler);
    window._ovEscHandler = function (ev) {
      if (!_ovDrawActive) return;
      if (ev.key === 'Escape') {
        _ovCancelDraw();
        document.querySelectorAll('.ov-draw-fac-btn').forEach(function (b) {
          b.textContent = '✏';
          b.style.color = '';
        });
      } else if (ev.key === 'S' && ev.shiftKey) {
        ev.preventDefault();
        _ovFinishDraw();
      }
    };
    document.addEventListener('keydown', window._ovEscHandler);

    _leafletMap.on('click', function (e) {
      /* Modalità disegno overlay */
      if (_ovDrawActive) {
        _ovDrawPoints.push({ lat: e.latlng.lat, lng: e.latlng.lng });
        var vm = L.circleMarker(e.latlng, {
          radius: 4,
          color: '#f0d070',
          fillColor: '#f0d070',
          fillOpacity: 0.9,
          weight: 1,
        }).addTo(_leafletMap);
        _ovDrawMarkers.push(vm);
        if (_ovDrawPoly) {
          try {
            _leafletMap.removeLayer(_ovDrawPoly);
          } catch (_e) {}
          _ovDrawPoly = null;
        }
        if (_ovDrawPoints.length >= 2) {
          var _ld = _ovGetLayer(_ovDrawLayerKey);
          var _fac =
            _ld && _ld.factions && _ld.factions[_ovDrawFactionId]
              ? _ld.factions[_ovDrawFactionId]
              : {};
          var _col = _fac.colore || '#f0d070';
          _ovDrawPoly = L.polygon(
            _ovDrawPoints.map(function (p) {
              return [p.lat, p.lng];
            }),
            { color: _col, fillColor: _col, fillOpacity: 0.15, weight: 2, dashArray: '6,4' }
          ).addTo(_leafletMap);
        }
        var hint = document.querySelector('.mappa-draw-hint');
        if (hint) {
          var ht = hint.querySelector('.ov-hint-text');
          if (ht)
            ht.textContent =
              '🖊 ' +
              _ovDrawPoints.length +
              ' vertici — clicca per aggiungere · Salva Zona o doppio-click per chiudere · ESC annulla';
        }
        return;
      }
      /* Modalità flag */
      if (!isDM() || state.mappaMode !== 'flag') return;
      var fid = 'f_' + Date.now();
      var flagData = {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        nome: '',
        gradimento: '',
        riassunto: '',
        immagine: '',
      };
      if (!state.mappaFlags) state.mappaFlags = {};
      state.mappaFlags[fid] = flagData;
      _campaignDb && _campaignDb.ref(_mappaFlagPath(fid)).set(flagData);
      refreshMappaFlags();
      state.mappaSelectedFlag = fid;
      var panel = document.querySelector('.mappa-info-panel');
      if (panel) {
        panel.classList.add('open');
        renderMappaFlagPanel(panel, fid);
      }
    });

    _leafletMap.on('dblclick', function (e) {
      if (!_ovDrawActive) return;
      L.DomEvent.stopPropagation(e);
      /* Leaflet genera click+dblclick, rimuovi l'ultimo punto aggiunto dal click */
      if (_ovDrawPoints.length > 0) _ovDrawPoints.pop();
      if (_ovDrawMarkers.length > 0) {
        var _last = _ovDrawMarkers.pop();
        try {
          _leafletMap.removeLayer(_last);
        } catch (_e2) {}
      }
      _ovFinishDraw();
    });

    _leafletMap.on('mousemove', function (e) {
      if (!_ovDrawActive || _ovDrawPoints.length === 0) return;
      if (_ovDrawCursor) {
        try {
          _leafletMap.removeLayer(_ovDrawCursor);
        } catch (_e3) {}
        _ovDrawCursor = null;
      }
      var _last2 = _ovDrawPoints[_ovDrawPoints.length - 1];
      var _ld2 = _ovGetLayer(_ovDrawLayerKey);
      var _fac2 =
        _ld2 && _ld2.factions && _ld2.factions[_ovDrawFactionId]
          ? _ld2.factions[_ovDrawFactionId]
          : {};
      var _col2 = _fac2.colore || '#f0d070';
      _ovDrawCursor = L.polyline(
        [
          [_last2.lat, _last2.lng],
          [e.latlng.lat, e.latlng.lng],
        ],
        { color: _col2, weight: 1.5, dashArray: '4,4', opacity: 0.7 }
      ).addTo(_leafletMap);
    });
  };
  img.onerror = function () {
    mapDiv.innerHTML =
      '<div style="padding:2rem;color:var(--text-muted);font-style:italic;">Impossibile caricare l\'immagine della mappa. Controlla l\'URL.</div>';
  };
  img.src = state.mappaUrl;
}
