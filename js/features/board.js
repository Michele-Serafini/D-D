/* ============================================================
   BACHECA DEI RICERCATI v2 — drag-and-drop, file locali, commenti DM
   ============================================================ */

var _bacheDrag = null;

function bachePlayFlip() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch (e) {}
}

function bacheFileToBase64(file, cb) {
  var reader = new FileReader();
  reader.onload = function (e) {
    cb(e.target.result);
  };
  reader.readAsDataURL(file);
}

/* ============================================================================
   SEZIONE 13: BACHECA DI GILDA & MISSIONI (renderBacheca)
   ============================================================================ */
function renderBacheca() {
  var page = document.createElement('div');
  page.className = 'bacheca-page';

  // Toolbar
  var toolbar = document.createElement('div');
  toolbar.className = 'bacheca-toolbar';
  var toolTitle = document.createElement('span');
  toolTitle.className = 'bacheca-toolbar-title';
  toolTitle.innerHTML = '\u2694 Bacheca dei Ricercati';
  toolbar.appendChild(toolTitle);

  if (isDM()) {
    var addBtn = document.createElement('button');
    addBtn.className = 'bacheca-btn';
    addBtn.innerHTML = '\uD83D\uDCCC Appendi Manifesto (File)';
    addBtn.onclick = function () {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = function (e) {
        var file = e.target.files[0];
        if (!file) return;
        bacheFileToBase64(file, function (dataUrl) {
          var itemData = {
            dataUrl: dataUrl,
            commento: '',
            x: Math.round(60 + Math.random() * 380),
            y: Math.round(50 + Math.random() * 180),
            w: 160,
            zIndex: Date.now(),
            pinned: false,
            ts: Date.now(),
          };
          var _gbf = _campaignDb.ref('state/bacheca/items');
          if (_gbf) _gbf.push(itemData);
        });
      };
      inp.click();
    };
    toolbar.appendChild(addBtn);

    var addUrlBtn = document.createElement('button');
    addUrlBtn.className = 'bacheca-btn';
    addUrlBtn.innerHTML = '\uD83D\uDD17 Aggiungi GIF da URL';
    addUrlBtn.onclick = function () {
      var url = prompt('Incolla URL immagine o GIF:');
      if (!url) return;
      var itemData = {
        dataUrl: url,
        commento: '',
        x: Math.round(60 + Math.random() * 380),
        y: Math.round(50 + Math.random() * 180),
        w: 160,
        zIndex: Date.now(),
        pinned: false,
        ts: Date.now(),
      };
      var _gbu = _campaignDb.ref('state/bacheca/items');
      if (_gbu) _gbu.push(itemData);
    };
    toolbar.appendChild(addUrlBtn);

    var hint = document.createElement('span');
    hint.className = 'bacheca-hint';
    hint.textContent =
      'Trascina \u2022 Doppio click per girare \u2022 \uD83D\uDD0D per ingrandire \u2022 Pin per fissare';
    toolbar.appendChild(hint);
  } else {
    var hint2 = document.createElement('span');
    hint2.className = 'bacheca-hint';
    hint2.textContent =
      'Doppio click su un manifesto per girarlo \u2022 lente \uD83D\uDD0D per ingrandirlo';
    toolbar.appendChild(hint2);
  }
  page.appendChild(toolbar);

  // Lavagna
  var board = document.createElement('div');
  board.className = 'bacheca-board';
  board.id = 'bacheca-board';

  if (!state.bacheItems || state.bacheItems.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'bacheca-empty';
    empty.innerHTML = isDM()
      ? '\uD83D\uDCCB La lavagna \u00e8 vuota<br><small style="font-size:12px;opacity:0.7;">Usa \u201cAppendi Manifesto\u201d per iniziare</small>'
      : '\uD83D\uDCCB La lavagna \u00e8 vuota...<br><small style="font-size:12px;opacity:0.7;">Il DM non ha ancora appeso nulla.</small>';
    board.appendChild(empty);
  }

  var egg = document.createElement('div');
  egg.style.cssText =
    'position:absolute;bottom:8px;right:12px;font-family:Cinzel,serif;font-size:7px;color:rgba(200,160,80,0.13);letter-spacing:0.08em;pointer-events:none;z-index:0;';
  egg.textContent = '\u2605 TAGLIA PAGATA IN RAME \u2014 RECLAMABILE IN ANTICIPO \u2605';
  board.appendChild(egg);

  (state.bacheItems || []).forEach(function (item) {
    board.appendChild(createBacheEl(item));
  });

  // Drag events on board
  board.addEventListener('mousemove', function (e) {
    if (!_bacheDrag) return;
    var rect = board.getBoundingClientRect();
    var nx = e.clientX - rect.left - _bacheDrag.offX;
    var ny = e.clientY - rect.top - _bacheDrag.offY;
    nx = Math.max(0, Math.min(rect.width - (_bacheDrag.elW || 160), nx));
    ny = Math.max(0, Math.min(rect.height - 100, ny));
    _bacheDrag.el.style.left = nx + 'px';
    _bacheDrag.el.style.top = ny + 'px';
  });
  board.addEventListener('mouseup', function (e) {
    if (!_bacheDrag) return;
    var rect = board.getBoundingClientRect();
    var nx = Math.round(e.clientX - rect.left - _bacheDrag.offX);
    var ny = Math.round(e.clientY - rect.top - _bacheDrag.offY);
    nx = Math.max(0, Math.min(rect.width - (_bacheDrag.elW || 160), nx));
    ny = Math.max(0, Math.min(rect.height - 100, ny));
    _bacheDrag.el.classList.remove('dragging');
    var _grd = _campaignDb ? _campaignDb.ref('state/bacheca/items/' + _bacheDrag.id) : null;
    if (_grd) _grd.update({ x: nx, y: ny });
    _bacheDrag = null;
  });
  board.addEventListener('mouseleave', function () {
    if (_bacheDrag) {
      _bacheDrag.el.classList.remove('dragging');
      _bacheDrag = null;
    }
  });

  page.appendChild(board);
  return page;
}

function createBacheEl(item) {
  var el = document.createElement('div');
  el.className = 'bache-item' + (item.pinned ? ' pinned' : '');
  el.dataset.id = item.id;
  var _elW = item.w || 160;
  el.style.cssText =
    'left:' +
    (item.x || 40) +
    'px;top:' +
    (item.y || 40) +
    'px;z-index:' +
    (item.zIndex || 1) +
    ';width:' +
    _elW +
    'px;';

  var pin = document.createElement('div');
  pin.className = 'bache-pin';
  el.appendChild(pin);

  var inner = document.createElement('div');
  inner.className = 'bache-inner';

  // Fronte
  var face = document.createElement('div');
  face.className = 'bache-face';
  var img = document.createElement('img');
  img.src = safeImageUrl(item.dataUrl || item.url || '');
  img.alt = 'Manifesto';
  img.draggable = false;
  img.onerror = function () {
    this.style.display = 'none';
    var ph = document.createElement('div');
    ph.style.cssText =
      'width:100%;min-height:120px;background:linear-gradient(160deg,#3a2010,#1e100a);display:flex;align-items:center;justify-content:center;color:rgba(200,160,80,0.3);font-size:38px;';
    ph.textContent = '\uD83C\uDFF4';
    face.appendChild(ph);
  };
  face.appendChild(img);

  // Bottone lente d'ingrandimento (zoom) — disponibile a tutti
  var zoomBtn = document.createElement('button');
  zoomBtn.className = 'bache-zoom-btn';
  zoomBtn.title = 'Ingrandisci la taglia';
  zoomBtn.innerHTML = '\uD83D\uDD0D';
  zoomBtn.setAttribute('aria-label', 'Ingrandisci');
  zoomBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    e.preventDefault();
    _apriLightbox();
  });
  zoomBtn.addEventListener('mousedown', function (e) {
    e.stopPropagation();
  });
  zoomBtn.addEventListener('dblclick', function (e) {
    e.stopPropagation();
    e.preventDefault();
  });
  face.appendChild(zoomBtn);

  if (isDM()) {
    var ctrls = document.createElement('div');
    ctrls.className = 'bache-controls';

    var pinBtn = document.createElement('button');
    pinBtn.className = 'bache-ctrl-btn bache-ctrl-pin' + (item.pinned ? ' active' : '');
    pinBtn.textContent = item.pinned ? '\uD83D\uDCCC Fissato' : '\uD83D\uDCCC Fissa';
    pinBtn.onclick = function (e) {
      e.stopPropagation();
      item.pinned = !item.pinned;
      el.classList.toggle('pinned', item.pinned);
      pinBtn.textContent = item.pinned ? '\uD83D\uDCCC Fissato' : '\uD83D\uDCCC Fissa';
      pinBtn.classList.toggle('active', item.pinned);
      var _grp = _campaignDb ? _campaignDb.ref('state/bacheca/items/' + item.id) : null;
      if (_grp) _grp.update({ pinned: item.pinned });
    };
    ctrls.appendChild(pinBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'bache-ctrl-btn bache-ctrl-del';
    delBtn.textContent = '\u2715 Rimuovi';
    delBtn.onclick = function (e) {
      e.stopPropagation();
      if (confirm('Rimuovere questo manifesto dalla lavagna?')) {
        var _grr = _campaignDb ? _campaignDb.ref('state/bacheca/items/' + item.id) : null;
        if (_grr) _grr.remove();
        el.remove();
      }
    };
    ctrls.appendChild(delBtn);

    face.appendChild(ctrls);

    // Drag-resize handles (angoli + bordi)
    var resizeDirs = [
      { cls: 'bache-rh-se', cur: 'se-resize', dx: 1, dy: 1 },
      { cls: 'bache-rh-sw', cur: 'sw-resize', dx: -1, dy: 1 },
      { cls: 'bache-rh-e', cur: 'e-resize', dx: 1, dy: 0 },
      { cls: 'bache-rh-w', cur: 'w-resize', dx: -1, dy: 0 },
    ];
    resizeDirs.forEach(function (dir) {
      var h = document.createElement('div');
      h.className = 'bache-resize-handle ' + dir.cls;
      h.style.cursor = dir.cur;
      h.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var startX = e.clientX;
        var startW = _elW;
        var startLeft = item.x || 40;
        function onMove(ev) {
          var delta = (ev.clientX - startX) * dir.dx;
          var nw = Math.round(Math.max(80, Math.min(600, startW + delta)));
          _elW = nw;
          item.w = nw;
          el.style.width = nw + 'px';
          if (dir.dx < 0) {
            var nl = Math.round(startLeft - (nw - startW));
            item.x = nl;
            el.style.left = nl + 'px';
          }
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          var _grw = _campaignDb ? _campaignDb.ref('state/bacheca/items/' + item.id) : null;
          if (_grw) _grw.update({ w: _elW, x: item.x });
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      face.appendChild(h);
    });
  }

  // Retro
  var back = document.createElement('div');
  back.className = 'bache-back';
  var backStamp = document.createElement('div');
  backStamp.className = 'bache-back-stamp';
  backStamp.textContent = 'SMASHATO';
  back.appendChild(backStamp);

  if (isDM()) {
    var ta = document.createElement('textarea');
    ta.className = 'bache-comment-ta';
    ta.placeholder = 'Scrivi il commento della guardia...';
    ta.value = item.commento || '';
    var _saveTimer = null;
    ta.addEventListener('input', function () {
      item.commento = ta.value;
      if (_saveTimer) clearTimeout(_saveTimer);
      _saveTimer = setTimeout(function () {
        var _grc = _campaignDb ? _campaignDb.ref('state/bacheca/items/' + item.id) : null;
        if (_grc) _grc.update({ commento: ta.value });
      }, 800);
    });
    ta.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    ta.addEventListener('mousedown', function (e) {
      e.stopPropagation();
    });
    back.appendChild(ta);
  } else {
    var commentRo = document.createElement('div');
    commentRo.className = 'bache-comment-ro';
    commentRo.textContent = item.commento
      ? '\u201c' + item.commento + '\u201d'
      : '(Nessuna nota della guardia)';
    back.appendChild(commentRo);
  }

  var backSig = document.createElement('div');
  backSig.className = 'bache-back-sig';
  backSig.textContent = '\u2014 Guardia Cittadina';
  back.appendChild(backSig);

  inner.appendChild(face);
  inner.appendChild(back);
  el.appendChild(inner);

  // ---- Lightbox (aperto dal bottone lente, vedi più sotto) ----
  function _apriLightbox() {
    var src = img.src;
    if (!src || src === window.location.href) return;
    var overlay = document.createElement('div');
    overlay.className = 'bache-lightbox-overlay';
    var lbImg = document.createElement('img');
    lbImg.className = 'bache-lightbox-img';
    lbImg.src = safeImageUrl(src);
    overlay.appendChild(lbImg);
    overlay.addEventListener('click', function () {
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  // ---- Doppio clic → flip ----
  el.addEventListener('dblclick', function (e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
    e.stopPropagation();
    el.classList.toggle('flipped');
    bachePlayFlip();
  });

  if (isDM()) {
    el.addEventListener('mousedown', function (e) {
      if (item.pinned) return;
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      var maxZ = Date.now();
      item.zIndex = maxZ;
      el.style.zIndex = maxZ;
      var _grz = _campaignDb ? _campaignDb.ref('state/bacheca/items/' + item.id) : null;
      if (_grz) _grz.update({ zIndex: maxZ });
      var rect = el.getBoundingClientRect();
      _bacheDrag = {
        el: el,
        id: item.id,
        offX: e.clientX - rect.left,
        offY: e.clientY - rect.top,
        elW: _elW,
      };
      el.classList.add('dragging');
    });
  }

  return el;
}

function renderBacheGrid(grid) {
  // Shim per il listener Firebase realtime
  var board = document.getElementById('bacheca-board');
  if (!board) return;
  board.querySelectorAll('.bache-item').forEach(function (i) {
    i.remove();
  });
  var oldEmpty = board.querySelector('.bacheca-empty');
  if (oldEmpty) oldEmpty.remove();
  if (!state.bacheItems || state.bacheItems.length === 0) {
    var emptyEl = document.createElement('div');
    emptyEl.className = 'bacheca-empty';
    emptyEl.innerHTML = isDM()
      ? '\uD83D\uDCCB La lavagna \u00e8 vuota<br><small style="font-size:12px;opacity:0.7;">Usa \u201cAppendi Manifesto\u201d per iniziare</small>'
      : '\uD83D\uDCCB La lavagna \u00e8 vuota...<br><small style="font-size:12px;opacity:0.7;">Il DM non ha ancora appeso nulla.</small>';
    board.appendChild(emptyEl);
    return;
  }
  state.bacheItems.forEach(function (item) {
    if (board.querySelector('[data-id="' + item.id + '"]')) return;
    board.appendChild(createBacheEl(item));
  });
}
