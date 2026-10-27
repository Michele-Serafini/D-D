/* ========================= SCHEDA + LAVAGNA WRAPPER ========================= */
function _buildSchedaWithLavagna() {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;height:100%;overflow:hidden;position:relative;';

  var schedaPane = document.createElement('div');
  schedaPane.style.cssText = 'flex:1;overflow-y:auto;min-width:0;position:relative;';
  schedaPane.appendChild(renderScheda());

  // Toggle button (floating top-right of scheda pane)
  var toggleBtn = document.createElement('button');
  toggleBtn.title = 'Lavagna Abilità';
  toggleBtn.innerHTML = '📷';
  toggleBtn.style.cssText =
    'position:absolute;top:10px;right:14px;z-index:30;' +
    'background:' +
    (state.lavagnaOpen ? 'rgba(201,165,92,0.25)' : 'rgba(10,22,40,0.85)') +
    ';border:1px solid rgba(201,165,92,' +
    (state.lavagnaOpen ? '0.8' : '0.4') +
    ');' +
    'color:#c9a55c;border-radius:5px;padding:5px 9px;cursor:pointer;font-size:16px;' +
    'box-shadow:0 2px 8px rgba(0,0,0,0.5);';
  window._toggleGlobalLavagna = function () {
    toggleBtn.click();
  };
  toggleBtn.addEventListener('click', function () {
    state.lavagnaOpen = !state.lavagnaOpen;
    if (state.lavagnaOpen) {
      lavPane.style.width = '300px';
      toggleBtn.style.background = 'rgba(201,165,92,0.25)';
      toggleBtn.style.borderColor = 'rgba(201,165,92,0.8)';
    } else {
      lavPane.style.width = '0';
      toggleBtn.style.background = 'rgba(10,22,40,0.85)';
      toggleBtn.style.borderColor = 'rgba(201,165,92,0.4)';
    }
  });
  schedaPane.appendChild(toggleBtn);
  wrap.appendChild(schedaPane);

  var lavPane = document.createElement('div');
  lavPane.style.cssText =
    'width:' +
    (state.lavagnaOpen ? '300px' : '0') +
    ';flex-shrink:0;overflow:hidden;' +
    'border-left:1px solid rgba(201,165,92,0.25);transition:width 0.2s ease;';
  var lavInner = document.createElement('div');
  lavInner.style.cssText = 'width:300px;height:100%;overflow:hidden;';
  lavInner.appendChild(renderLavagna());
  lavPane.appendChild(lavInner);
  wrap.appendChild(lavPane);

  return wrap;
}

/* ========================= TAVOLO DA GIOCO (VTT) ========================= */
var _tavoloRef = null;
var _sectionCleanup = null;
function renderTavolo() {
  if (_tavoloRef) {
    _tavoloRef.off('value');
    _tavoloRef = null;
  }
  var wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;height:100%;overflow:hidden;background:#111;';
  var _ref = _db.ref('state/tavolo');
  _tavoloRef = _ref;
  var _data = { map: { url: '', w: 2000, h: 1500 }, grid: { s: 60, on: true }, tokens: {} };
  var _vp = { x: 0, y: 0, z: 1 };
  var tb = document.createElement('div');
  tb.style.cssText =
    'display:flex;align-items:center;gap:6px;padding:6px 10px;background:#060e1c;border-bottom:1px solid rgba(201,165,92,0.3);flex-shrink:0;flex-wrap:wrap;';
  function mkB(txt, fn, sty) {
    var b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText =
      'background:#0d2440;border:1px solid rgba(201,165,92,0.45);color:#f0e4cc;border-radius:3px;padding:0.22rem 0.65rem;cursor:pointer;font-size:12px;white-space:nowrap;' +
      (sty || '');
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.style.display = 'none';
  inp.addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var mxW = 1800,
          sc = Math.min(1, mxW / img.width);
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc);
        cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        _ref.child('map').set({ url: cv.toDataURL('image/jpeg', 0.85), w: cv.width, h: cv.height });
      };
      img.src = ev.target.result;
    };
    rd.readAsDataURL(f);
  });
  wrap.appendChild(inp);
  tb.appendChild(
    mkB('🖼 Carica Mappa', function () {
      inp.click();
    })
  );
  var gridBtn = mkB('⊞ Griglia ON', function () {
    _ref.child('grid').update({ on: !_data.grid.on });
  });
  tb.appendChild(gridBtn);
  var gsLbl = document.createElement('span');
  gsLbl.style.cssText = 'color:#c9a55c;font-size:12px;';
  gsLbl.textContent = ' Cella:';
  tb.appendChild(gsLbl);
  var gsInp = document.createElement('input');
  gsInp.type = 'number';
  gsInp.min = 20;
  gsInp.max = 200;
  gsInp.value = 60;
  gsInp.style.cssText =
    'width:48px;background:#0d2440;border:1px solid rgba(201,165,92,0.4);color:#f0e4cc;border-radius:3px;padding:0.2rem 0.3rem;font-size:12px;';
  gsInp.addEventListener('change', function () {
    _ref.child('grid').update({ s: +gsInp.value });
  });
  tb.appendChild(gsInp);
  tb.appendChild(
    mkB('➕ Segnalino', function () {
      var n = prompt(
        'Nome segnalino:',
        isDM() ? 'NPC' : (state.currentUser && state.currentUser.username) || 'PG'
      );
      if (!n) return;
      var id = 'tok_' + Date.now();
      _ref.child('tokens/' + id).set({
        x: 50,
        y: 50,
        label: n,
        color: isDM() ? '#e74c3c' : '#3498db',
        size: 1,
        hidden: false,
        owner: (state.currentUser && state.currentUser.username) || '',
      });
    })
  );
  var zLbl = mkB('100%', function () {
    _vp = { x: 0, y: 0, z: 1 };
    applyVP();
  });
  zLbl.style.marginLeft = 'auto';
  tb.appendChild(zLbl);
  tb.appendChild(
    mkB('−', function () {
      _vp.z = Math.max(0.1, _vp.z / 1.15);
      applyVP();
    })
  );
  tb.appendChild(
    mkB('+', function () {
      _vp.z = Math.min(5, _vp.z * 1.15);
      applyVP();
    })
  );
  if (isDM()) {
    tb.appendChild(
      mkB('🗑 Mappa', function () {
        if (confirm('Cancellare la mappa?')) _ref.child('map').set({ url: '', w: 2000, h: 1500 });
      })
    );
    tb.appendChild(
      mkB('🗑 Segnalini', function () {
        if (confirm('Cancellare tutti i segnalini?')) _ref.child('tokens').remove();
      })
    );
  }
  wrap.appendChild(tb);
  var area = document.createElement('div');
  area.style.cssText = 'flex:1;overflow:hidden;position:relative;background:#1a1a2e;cursor:grab;';
  var mapD = document.createElement('div');
  mapD.style.cssText = 'position:absolute;transform-origin:0 0;';
  area.appendChild(mapD);
  function applyVP() {
    mapD.style.transform = 'translate(' + _vp.x + 'px,' + _vp.y + 'px) scale(' + _vp.z + ')';
    zLbl.textContent = Math.round(_vp.z * 100) + '%';
  }
  function buildMap() {
    mapD.innerHTML = '';
    var m = _data.map,
      g = _data.grid;
    mapD.style.width = m.w + 'px';
    mapD.style.height = m.h + 'px';
    if (m.url) {
      mapD.style.backgroundImage = 'url(' + m.url + ')';
      mapD.style.backgroundSize = '100% 100%';
      mapD.style.backgroundRepeat = 'no-repeat';
    } else {
      mapD.style.backgroundImage = 'none';
      mapD.style.background = '#2a2a3a';
    }
    if (g.on) {
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', m.w);
      svg.setAttribute('height', m.h);
      svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
      var defs = document.createElementNS(ns, 'defs');
      var pat = document.createElementNS(ns, 'pattern');
      pat.setAttribute('id', 'gp');
      pat.setAttribute('width', g.s);
      pat.setAttribute('height', g.s);
      pat.setAttribute('patternUnits', 'userSpaceOnUse');
      var pth = document.createElementNS(ns, 'path');
      pth.setAttribute('d', 'M ' + g.s + ' 0 L 0 0 0 ' + g.s);
      pth.setAttribute('fill', 'none');
      pth.setAttribute('stroke', 'rgba(255,255,255,0.22)');
      pth.setAttribute('stroke-width', '0.8');
      pat.appendChild(pth);
      defs.appendChild(pat);
      svg.appendChild(defs);
      var rc = document.createElementNS(ns, 'rect');
      rc.setAttribute('width', '100%');
      rc.setAttribute('height', '100%');
      rc.setAttribute('fill', 'url(#gp)');
      svg.appendChild(rc);
      mapD.appendChild(svg);
    }
    var toks = _data.tokens || {};
    Object.keys(toks).forEach(function (id) {
      var t = toks[id];
      if (t.hidden && !isDM()) return;
      var sz = g.s * (t.size || 1) * 0.85;
      var te = document.createElement('div');
      te.style.cssText =
        'position:absolute;left:' +
        t.x +
        '%;top:' +
        t.y +
        '%;transform:translate(-50%,-50%);width:' +
        sz +
        'px;height:' +
        sz +
        'px;border-radius:50%;background:' +
        t.color +
        ';border:2.5px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;cursor:move;user-select:none;z-index:10;flex-direction:column;' +
        (t.hidden ? 'opacity:0.55;border-style:dashed;' : '');
      if (t.img) {
        te.style.backgroundImage = 'url(' + t.img + ')';
        te.style.backgroundSize = 'cover';
        te.style.backgroundPosition = 'center';
      }
      var ab = document.createElement('span');
      ab.style.cssText =
        'font-size:' +
        Math.max(9, sz * 0.28) +
        'px;font-weight:700;color:#fff;text-shadow:1px 1px 2px #000,-1px -1px 2px #000;pointer-events:none;' +
        (t.img ? 'display:none;' : '');
      ab.textContent = t.label.slice(0, 3).toUpperCase();
      te.appendChild(ab);
      var lb = document.createElement('div');
      lb.style.cssText =
        'position:absolute;top:calc(100% + 3px);left:50%;transform:translateX(-50%);font-size:' +
        Math.max(9, sz * 0.2) +
        'px;color:#fff;text-shadow:1px 1px 2px #000,-1px -1px 2px #000;white-space:nowrap;font-weight:700;pointer-events:none;background:rgba(0,0,0,0.5);padding:1px 5px;border-radius:3px;';
      lb.textContent = t.label;
      te.appendChild(lb);
      te.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showTokMenu(id, t, e.clientX, e.clientY);
      });
      var canMv = isDM() || t.owner === (state.currentUser && state.currentUser.username);
      if (canMv) {
        var drag = false,
          sx,
          sy,
          stx,
          sty;
        te.addEventListener('mousedown', function (e) {
          if (e.button !== 0) return;
          e.stopPropagation();
          drag = true;
          sx = e.clientX;
          sy = e.clientY;
          stx = t.x;
          sty = t.y;
          function mv(e) {
            if (!drag) return;
            var dx = (e.clientX - sx) / ((_vp.z * m.w) / 100);
            var dy = (e.clientY - sy) / ((_vp.z * m.h) / 100);
            t.x = Math.max(0, Math.min(100, stx + dx));
            t.y = Math.max(0, Math.min(100, sty + dy));
            te.style.left = t.x + '%';
            te.style.top = t.y + '%';
          }
          function up() {
            if (!drag) return;
            drag = false;
            document.removeEventListener('mousemove', mv);
            document.removeEventListener('mouseup', up);
            _ref.child('tokens/' + id).update({ x: +t.x.toFixed(2), y: +t.y.toFixed(2) });
          }
          document.addEventListener('mousemove', mv);
          document.addEventListener('mouseup', up);
        });
      }
      mapD.appendChild(te);
    });
    applyVP();
  }
  function showTokMenu(id, t, cx, cy) {
    var old = document.getElementById('_tmenu');
    if (old) old.remove();
    var men = document.createElement('div');
    men.id = '_tmenu';
    men.style.cssText =
      'position:fixed;left:' +
      cx +
      'px;top:' +
      cy +
      'px;z-index:9999;background:#0d2440;border:1px solid rgba(201,165,92,0.55);border-radius:5px;padding:4px;min-width:155px;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
    function mi(txt, fn) {
      var it = document.createElement('div');
      it.textContent = txt;
      it.style.cssText =
        'padding:6px 12px;cursor:pointer;color:#f0e4cc;font-size:12px;border-radius:3px;';
      it.onmouseenter = function () {
        it.style.background = 'rgba(201,165,92,0.15)';
      };
      it.onmouseleave = function () {
        it.style.background = '';
      };
      it.onclick = function () {
        men.remove();
        fn();
      };
      men.appendChild(it);
    }
    mi('✏️ Rinomina', function () {
      var n = prompt('Nome:', t.label);
      if (n) _ref.child('tokens/' + id).update({ label: n });
    });
    mi('🎨 Colore sfondo', function () {
      var cp = document.createElement('input');
      cp.type = 'color';
      cp.value = t.color;
      cp.style.display = 'none';
      document.body.appendChild(cp);
      cp.oninput = function () {
        _ref.child('tokens/' + id).update({ color: cp.value });
      };
      cp.onchange = function () {
        document.body.removeChild(cp);
      };
      cp.click();
    });
    mi('🖼 ' + (t.img ? 'Cambia immagine' : 'Imposta immagine'), function () {
      var fi = document.createElement('input');
      fi.type = 'file';
      fi.accept = 'image/*';
      fi.style.display = 'none';
      document.body.appendChild(fi);
      fi.onchange = function () {
        var f = fi.files[0];
        if (!f) return;
        document.body.removeChild(fi);
        var r = new FileReader();
        r.onload = function (ev) {
          var i = new Image();
          i.onload = function () {
            var sz = 120;
            var cv = document.createElement('canvas');
            cv.width = sz;
            cv.height = sz;
            var ctx = cv.getContext('2d');
            ctx.beginPath();
            ctx.arc(sz / 2, sz / 2, sz / 2, 0, Math.PI * 2);
            ctx.clip();
            var sc = Math.max(sz / i.width, sz / i.height),
              ox = (sz - i.width * sc) / 2,
              oy = (sz - i.height * sc) / 2;
            ctx.drawImage(i, ox, oy, i.width * sc, i.height * sc);
            _ref.child('tokens/' + id).update({ img: cv.toDataURL('image/jpeg', 0.82) });
          };
          i.src = ev.target.result;
        };
        r.readAsDataURL(f);
      };
      fi.click();
    });
    if (t.img)
      mi('❌ Rimuovi immagine', function () {
        _ref.child('tokens/' + id).update({ img: null });
      });
    mi('📏 Taglia (' + (t.size || 1) + ')', function () {
      var s = prompt('Taglia (1=1x1, 2=2x2):', t.size || 1);
      if (s) _ref.child('tokens/' + id).update({ size: +s });
    });
    if (isDM())
      mi(t.hidden ? '👁 Mostra ai giocatori' : '🙈 Nascondi ai giocatori', function () {
        _ref.child('tokens/' + id).update({ hidden: !t.hidden });
      });
    mi('🗑 Elimina', function () {
      _ref.child('tokens/' + id).remove();
    });
    document.body.appendChild(men);
    setTimeout(function () {
      document.addEventListener('click', function cl() {
        men.remove();
        document.removeEventListener('click', cl);
      });
    }, 20);
  }
  var pan = false,
    px0,
    py0,
    vpx0,
    vpy0;
  area.addEventListener('mousedown', function (e) {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      pan = true;
      px0 = e.clientX;
      py0 = e.clientY;
      vpx0 = _vp.x;
      vpy0 = _vp.y;
      area.style.cursor = 'grabbing';
    }
  });
  window.addEventListener('mousemove', function (e) {
    if (!pan) return;
    _vp.x = vpx0 + (e.clientX - px0);
    _vp.y = vpy0 + (e.clientY - py0);
    applyVP();
  });
  window.addEventListener('mouseup', function () {
    if (pan) {
      pan = false;
      area.style.cursor = 'grab';
    }
  });
  area.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });
  area.addEventListener(
    'wheel',
    function (e) {
      e.preventDefault();
      var r = area.getBoundingClientRect();
      var mx = e.clientX - r.left,
        my = e.clientY - r.top;
      var oz = _vp.z;
      _vp.z = Math.max(0.1, Math.min(5, _vp.z * (e.deltaY < 0 ? 1.12 : 0.89)));
      _vp.x = mx - (_vp.z / oz) * (mx - _vp.x);
      _vp.y = my - (_vp.z / oz) * (my - _vp.y);
      applyVP();
    },
    { passive: false }
  );
  wrap.appendChild(area);
  _ref.on('value', function (snap) {
    var d = snap.val() || {};
    _data.map = d.map || { url: '', w: 2000, h: 1500 };
    _data.grid = Object.assign({ s: 60, on: true }, d.grid || {});
    _data.tokens = d.tokens || {};
    gridBtn.textContent = '⊞ Griglia ' + (_data.grid.on === false ? 'OFF' : 'ON');
    gsInp.value = _data.grid.s || 60;
    buildMap();
  });
  return wrap;
}

/* ========================= LAVAGNA ABILITÀ ========================= */
function renderLavagna() {
  var charId = state.schedaAttivaId || 'default';
  var wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;height:100%;overflow:hidden;background:#1a1a2e;';

  if (window._lavagnaPasteListener) {
    document.removeEventListener('paste', window._lavagnaPasteListener);
    window._lavagnaPasteListener = null;
  }

  var tb = document.createElement('div');
  tb.style.cssText =
    'display:flex;align-items:center;gap:8px;padding:8px 14px;background:#060e1c;border-bottom:1px solid rgba(201,165,92,0.3);flex-shrink:0;flex-wrap:wrap;';
  var ttl = document.createElement('span');
  ttl.style.cssText = 'color:#c9a55c;font-family:Cinzel,serif;font-size:14px;font-weight:700;';
  ttl.textContent = '📷 Lavagna Abilità';
  tb.appendChild(ttl);
  var hint = document.createElement('span');
  hint.style.cssText = 'color:rgba(240,228,204,0.5);font-size:11px;';
  hint.textContent = '— Ctrl+V per incollare screenshot, o carica file';
  tb.appendChild(hint);
  var ulBtn = document.createElement('button');
  ulBtn.textContent = '⬆ Carica';
  ulBtn.style.cssText =
    'margin-left:auto;background:#0d2440;border:1px solid rgba(201,165,92,0.45);color:#f0e4cc;border-radius:3px;padding:0.22rem 0.7rem;cursor:pointer;font-size:12px;';
  tb.appendChild(ulBtn);
  var ulInp = document.createElement('input');
  ulInp.type = 'file';
  ulInp.accept = 'image/*';
  ulInp.multiple = true;
  ulInp.style.display = 'none';
  tb.appendChild(ulInp);
  ulBtn.onclick = function () {
    ulInp.click();
  };
  wrap.appendChild(tb);

  var grid = document.createElement('div');
  grid.style.cssText =
    'flex:1;overflow-y:auto;padding:14px;display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start;position:relative;';
  wrap.appendChild(grid);

  if (!state.scheda) state.scheda = {};
  // Gestione backward-compatibility (migrazione a boardImages)
  if (state.scheda.abilityBoard && !state.scheda.boardImages) {
    state.scheda.boardImages = state.scheda.abilityBoard;
    delete state.scheda.abilityBoard;
  }
  if (!state.scheda.boardImages) state.scheda.boardImages = [];
  var _imgs = state.scheda.boardImages;

  var ph = document.createElement('div');
  ph.style.cssText =
    'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(201,165,92,0.3);text-align:center;pointer-events:none;';
  ph.innerHTML =
    '<div style="font-size:56px;">📷</div><div style="font-size:15px;font-family:\'Cinzel\',serif;margin-top:8px;">Incolla uno screenshot (Ctrl+V)<br>o usa il pulsante Carica</div>';
  grid.appendChild(ph);

  if (_imgs.length > 0) ph.style.display = 'none';

  function triggerSave() {
    if (typeof ss === 'function') ss();
    if (typeof saveToStorage === 'function') saveToStorage();
  }

  function addImg(url) {
    var id = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    var entry = { id: id, x: 0, y: 0, width: 220, height: 300 };
    // Salva l'immagine su DB
    if (window.ImageDB) {
      window.ImageDB.save(id, url).catch(function (e) {
        console.error('Lavagna DB err', e);
      });
    }
    _imgs.push(entry);
    ph.style.display = 'none';
    renderCard(entry, url);
    triggerSave();
  }

  function renderCard(entry, preloadedUrl) {
    var card = document.createElement('div');
    card.id = 'lc_' + entry.id;
    card.style.cssText =
      'position:relative;width:220px;flex-shrink:0;border:1px solid rgba(201,165,92,0.3);border-radius:6px;overflow:hidden;background:#0a1628;box-shadow:0 3px 10px rgba(0,0,0,0.5);';
    var img = document.createElement('img');
    img.style.cssText =
      'width:100%;display:block;max-height:300px;object-fit:contain;background:#111;cursor:zoom-in;';

    // Recupera da IndexedDB se non pre-caricata
    if (preloadedUrl) {
      img.src = preloadedUrl;
    } else if (entry.dataUrl) {
      img.src = entry.dataUrl; // Backward compat momentanea
    } else if (window.ImageDB) {
      window.ImageDB.get(entry.id).then(function (du) {
        if (du) img.src = du;
        else img.alt = 'Immagine persa';
      });
    }

    img.onclick = function () {
      var ov = document.createElement('div');
      ov.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:9998;display:flex;align-items:center;justify-content:center;overflow:hidden;';
      var big = document.createElement('img');
      big.src = img.src;
      big.style.cssText =
        'max-width:95vw;max-height:93vh;object-fit:contain;border-radius:4px;transition:transform 0.1s ease-out;cursor:grab;user-select:none;';
      var sc = 1,
        tx = 0,
        ty = 0,
        drg = false,
        sx,
        sy;
      var up = function () {
        big.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
      };
      ov.addEventListener(
        'wheel',
        function (e) {
          e.preventDefault();
          sc += e.deltaY * -0.002;
          sc = Math.max(1, Math.min(sc, 6));
          if (sc === 1) {
            tx = 0;
            ty = 0;
          }
          up();
        },
        { passive: false }
      );
      big.onmousedown = function (e) {
        e.preventDefault();
        e.stopPropagation();
        drg = true;
        big.style.cursor = 'grabbing';
        sx = e.clientX - tx;
        sy = e.clientY - ty;
      };
      window.addEventListener('mousemove', function (e) {
        if (!drg) return;
        tx = e.clientX - sx;
        ty = e.clientY - sy;
        up();
      });
      window.addEventListener('mouseup', function () {
        drg = false;
        big.style.cursor = 'grab';
      });
      var cb = document.createElement('div');
      cb.innerHTML = '✖';
      cb.style.cssText =
        'position:absolute;top:20px;right:30px;color:#fff;font-size:36px;cursor:pointer;z-index:9999;font-family:sans-serif;';
      cb.onclick = function () {
        ov.remove();
      };
      ov.onclick = function (e) {
        if (e.target === ov) ov.remove();
      };
      ov.appendChild(big);
      ov.appendChild(cb);
      document.body.appendChild(ov);
    };

    var del = document.createElement('button');
    del.textContent = '✕';
    del.style.cssText =
      'position:absolute;top:5px;right:5px;background:rgba(160,25,25,0.88);border:none;color:#fff;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;line-height:1;';
    del.onclick = function (e) {
      e.stopPropagation();
      if (confirm('Eliminare?')) {
        card.remove();
        if (window.ImageDB) window.ImageDB.remove(entry.id);
        var idx = _imgs.findIndex(function (i) {
          return i.id === entry.id;
        });
        if (idx > -1) _imgs.splice(idx, 1);
        if (!_imgs.length) ph.style.display = '';
        triggerSave();
      }
    };
    card.appendChild(img);
    card.appendChild(del);
    grid.appendChild(card);
  }

  _imgs.forEach(function (i) {
    renderCard(i);
  });

  function processFile(file) {
    var r = new FileReader();
    r.onload = function (ev) {
      var i = new Image();
      i.onload = function () {
        var mxW = 2500,
          sc = Math.min(1, mxW / i.width);
        var cv = document.createElement('canvas');
        cv.width = Math.round(i.width * sc);
        cv.height = Math.round(i.height * sc);
        cv.getContext('2d').drawImage(i, 0, 0, cv.width, cv.height);
        addImg(cv.toDataURL('image/jpeg', 0.95));
      };
      i.src = ev.target.result;
    };
    r.readAsDataURL(file);
  }
  ulInp.addEventListener('change', function (e) {
    Array.from(e.target.files).forEach(processFile);
    e.target.value = '';
  });

  function onPaste(e) {
    if (!state.lavagnaOpen || (state.section !== 'scheda' && state.section !== 'schedepg')) return;
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        processFile(items[i].getAsFile());
        break;
      }
    }
  }

  window._lavagnaPasteListener = onPaste;
  document.addEventListener('paste', onPaste);

  var oldCleanup = _sectionCleanup;
  _sectionCleanup = function () {
    if (window._lavagnaPasteListener) {
      document.removeEventListener('paste', window._lavagnaPasteListener);
      window._lavagnaPasteListener = null;
    }
    if (oldCleanup) oldCleanup();
  };

  return wrap;
}
