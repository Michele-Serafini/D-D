/* ============================================================
   ARCHIVIO IDEE — sezione privata per ogni DM
   Firebase: archivioIdee/{uid}/{bookId}
   ============================================================ */

/* ============================================================================
   SEZIONE 15: ARCHIVIO IDEE & TOMI DEL MASTER (renderArchivio)
   ============================================================================ */
function renderArchivio() {
  var uid = (_authUser && _authUser.uid) || (state.currentUser && state.currentUser.username);
  if (!uid || !_db) {
    var noDb = document.createElement('div');
    noDb.style.cssText = 'padding:2rem;color:var(--text-muted);text-align:center;';
    noDb.textContent = 'Connessione al database non disponibile.';
    return noDb;
  }

  var _archRef = _db.ref('archivioIdee/' + uid);
  var _archBooks = {};
  var _archSelId = null;
  var _archSaveTimer = null;

  var wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;min-height:100vh;background:var(--bg-main);';

  /* Header */
  var hdr = document.createElement('header');
  hdr.className = 'border-b';
  hdr.innerHTML =
    '<div class="container-main" style="padding-top:1.5rem;padding-bottom:1rem;">' +
    '<div class="header-eyebrow mb-2"><span>DM Privato</span></div>' +
    '<h1 class="header-title">Archivio Idee</h1></div>';
  wrap.appendChild(hdr);

  /* Body = shelf (left) + editor (right) */
  var body = document.createElement('div');
  body.style.cssText = 'display:flex;flex:1;height:calc(100vh - 132px);overflow:hidden;';
  body.className = 'archivio-body-mobile';
  wrap.appendChild(body);

  /* ---- SHELF ---- */
  var shelf = document.createElement('div');
  shelf.style.cssText =
    'width:250px;min-width:200px;max-width:270px;display:flex;flex-direction:column;' +
    'background:linear-gradient(180deg,#2a1a08 0%,#1a0d03 100%);' +
    'border-right:2px solid #5a3a1a;position:relative;';
  body.appendChild(shelf);

  var shelfHead = document.createElement('div');
  shelfHead.style.cssText =
    'padding:0.9rem 1rem;font-family:"Cinzel",serif;font-size:11px;letter-spacing:0.18em;' +
    'color:rgba(245,166,35,0.65);text-align:center;border-bottom:1px solid rgba(245,166,35,0.18);flex-shrink:0;';
  shelfHead.textContent = '📚 I MIEI LIBRI';
  shelf.appendChild(shelfHead);

  var booksWrap = document.createElement('div');
  booksWrap.style.cssText =
    'flex:1;overflow-y:auto;padding:0.75rem;display:flex;flex-direction:column;gap:0.35rem;';
  shelf.appendChild(booksWrap);

  var addBookBtn = document.createElement('button');
  addBookBtn.style.cssText =
    'flex-shrink:0;margin:0.6rem;padding:0.55rem;border-radius:8px;cursor:pointer;' +
    'background:rgba(245,166,35,0.1);border:1.5px dashed rgba(245,166,35,0.35);' +
    'color:rgba(245,166,35,0.75);font-family:"Cinzel",serif;font-size:11px;letter-spacing:0.1em;transition:all 0.15s;';
  addBookBtn.textContent = '+ Nuovo Libro';
  addBookBtn.onmouseenter = function () {
    addBookBtn.style.background = 'rgba(245,166,35,0.2)';
    addBookBtn.style.borderColor = 'rgba(245,166,35,0.6)';
  };
  addBookBtn.onmouseleave = function () {
    addBookBtn.style.background = 'rgba(245,166,35,0.1)';
    addBookBtn.style.borderColor = 'rgba(245,166,35,0.35)';
  };
  shelf.appendChild(addBookBtn);

  /* ---- EDITOR PANEL ---- */
  var editorPanel = document.createElement('div');
  editorPanel.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
  body.appendChild(editorPanel);

  var emptyState = document.createElement('div');
  emptyState.style.cssText =
    'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'color:var(--text-muted);gap:1.2rem;';
  emptyState.innerHTML =
    '<div style="font-size:72px;line-height:1;">📖</div>' +
    '<div style="font-family:\'Cinzel\',serif;font-size:16px;letter-spacing:0.1em;color:var(--text-secondary);">Seleziona un libro per aprirlo</div>' +
    '<div style="font-size:12px;opacity:0.55;">o crea un nuovo libro con il pulsante a sinistra</div>';

  /* ---- COLORS ---- */
  var SPINE_COLORS = [
    '#8B2E2E',
    '#2E5B8B',
    '#2E7A3F',
    '#7A4A2E',
    '#5B2E7A',
    '#2E6E7A',
    '#8B7B2E',
    '#7A2E5B',
    '#3D7A4A',
    '#6B3D3D',
    '#3D3D8B',
    '#6B583D',
    '#8B4E2E',
    '#2E4E7A',
    '#5A7A2E',
    '#7A2E72',
  ];

  function _bookColor(id) {
    var keys = Object.keys(_archBooks);
    var i = keys.indexOf(id);
    return SPINE_COLORS[(i < 0 ? 0 : i) % SPINE_COLORS.length];
  }

  function _schedSave(id) {
    if (_archSaveTimer) clearTimeout(_archSaveTimer);
    _archSaveTimer = setTimeout(function () {
      if (_archBooks[id]) _archRef.child(id).set(_archBooks[id]);
    }, 700);
  }

  /* Render a book entry in the shelf */
  function _mkSpine(id) {
    var b = _archBooks[id];
    var col = _bookColor(id);
    var el = document.createElement('div');
    el.style.cssText =
      'display:flex;align-items:center;gap:0.55rem;padding:0.45rem 0.55rem;border-radius:6px;cursor:pointer;' +
      'transition:all 0.15s;background:' +
      (_archSelId === id ? 'rgba(245,166,35,0.13)' : 'transparent') +
      ';' +
      'border:1px solid ' +
      (_archSelId === id ? 'rgba(245,166,35,0.35)' : 'transparent') +
      ';';
    var spine = document.createElement('div');
    spine.style.cssText =
      'width:7px;min-width:7px;height:38px;border-radius:3px;flex-shrink:0;background:' +
      col +
      ';' +
      'box-shadow:1px 1px 6px rgba(0,0,0,0.6);';
    el.appendChild(spine);
    var lbl = document.createElement('div');
    lbl.style.cssText =
      'font-family:"Cinzel",serif;font-size:11px;color:rgba(245,210,120,0.88);line-height:1.3;' +
      'word-break:break-word;flex:1;';
    lbl.textContent = b.titolo || 'Senza titolo';
    el.appendChild(lbl);
    el.onmouseenter = function () {
      if (_archSelId !== id) {
        el.style.background = 'rgba(245,166,35,0.07)';
        el.style.borderColor = 'rgba(245,166,35,0.18)';
      }
    };
    el.onmouseleave = function () {
      if (_archSelId !== id) {
        el.style.background = 'transparent';
        el.style.borderColor = 'transparent';
      }
    };
    el.onclick = function () {
      _archSelId = id;
      _rebuildShelf();
      _openEditor(id);
    };
    return el;
  }

  function _rebuildShelf() {
    booksWrap.innerHTML = '';
    var ids = Object.keys(_archBooks);
    if (!ids.length) {
      var hint = document.createElement('div');
      hint.style.cssText =
        'text-align:center;color:rgba(245,166,35,0.35);font-size:11px;padding:1.5rem 0.5rem;font-style:italic;line-height:1.6;';
      hint.textContent = 'Nessun libro ancora.\nCreane uno!';
      booksWrap.appendChild(hint);
    } else {
      ids.forEach(function (id) {
        booksWrap.appendChild(_mkSpine(id));
      });
    }
  }

  /* Open a book in the editor */
  function _openEditor(id) {
    var b = _archBooks[id];
    if (!b) return;
    editorPanel.innerHTML = '';
    var col = _bookColor(id);

    /* — Editor header bar — */
    var eHdr = document.createElement('div');
    eHdr.style.cssText =
      'display:flex;align-items:center;gap:0.85rem;padding:1rem 1.4rem;' +
      'border-bottom:1px solid var(--border-gold);background:var(--bg-card);flex-shrink:0;';

    var badge = document.createElement('div');
    badge.style.cssText =
      'width:14px;height:14px;min-width:14px;border-radius:3px;background:' +
      col +
      ';box-shadow:0 1px 5px rgba(0,0,0,0.5);';
    eHdr.appendChild(badge);

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = b.titolo || '';
    titleInput.placeholder = 'Titolo del libro...';
    titleInput.style.cssText =
      'flex:1;background:transparent;border:none;outline:none;' +
      'font-family:"Cinzel",serif;font-size:20px;font-weight:700;color:var(--text-primary);letter-spacing:0.04em;';
    titleInput.oninput = function () {
      _archBooks[id].titolo = titleInput.value;
      _rebuildShelf();
      _schedSave(id);
    };
    eHdr.appendChild(titleInput);

    /* Auto-save indicator */
    var saveInd = document.createElement('span');
    saveInd.style.cssText =
      'font-size:10px;color:rgba(245,166,35,0.5);letter-spacing:0.08em;white-space:nowrap;';
    saveInd.textContent = 'Salvataggio automatico';
    eHdr.appendChild(saveInd);

    var delBtn = document.createElement('button');
    delBtn.title = 'Elimina libro';
    delBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
    delBtn.style.cssText =
      'background:transparent;border:1px solid rgba(200,70,70,0.35);border-radius:6px;' +
      'color:rgba(200,70,70,0.65);cursor:pointer;padding:0.35rem 0.55rem;transition:all 0.15s;display:flex;align-items:center;flex-shrink:0;';
    delBtn.onmouseenter = function () {
      delBtn.style.background = 'rgba(200,70,70,0.14)';
      delBtn.style.color = '#e05555';
    };
    delBtn.onmouseleave = function () {
      delBtn.style.background = 'transparent';
      delBtn.style.color = 'rgba(200,70,70,0.65)';
    };
    delBtn.onclick = function () {
      if (
        !confirm(
          'Eliminare "' + ((_archBooks[id] && _archBooks[id].titolo) || 'Senza titolo') + '"?'
        )
      )
        return;
      _archRef.child(id).remove();
      delete _archBooks[id];
      _archSelId = null;
      _rebuildShelf();
      editorPanel.innerHTML = '';
      editorPanel.appendChild(emptyState);
    };
    eHdr.appendChild(delBtn);
    editorPanel.appendChild(eHdr);

    /* — Editor body — */
    var eBody = document.createElement('div');
    eBody.style.cssText =
      'flex:1;display:flex;flex-direction:column;overflow:hidden;padding:1.25rem 1.5rem 1rem;gap:0.85rem;';
    editorPanel.appendChild(eBody);

    /* Main textarea */
    var ta = document.createElement('textarea');
    ta.value = b.contenuto || '';
    ta.placeholder =
      'Scrivi qui le tue idee, trame, piani, note segrete...\n\nNessuno potrà leggere questo archivio a parte te.';
    ta.style.cssText =
      'flex:1;width:100%;box-sizing:border-box;resize:none;padding:1.1rem 1.3rem;' +
      'background:var(--bg-card);border:1px solid var(--border-gold);border-radius:8px;' +
      'color:var(--text-primary);font-size:15px;line-height:1.75;font-family:inherit;outline:none;' +
      'transition:border-color 0.15s;min-height:0;';
    ta.onfocus = function () {
      ta.style.borderColor = 'var(--accent-gold)';
    };
    ta.onblur = function () {
      ta.style.borderColor = 'var(--border-gold)';
    };
    ta.oninput = function () {
      _archBooks[id].contenuto = ta.value;
      _schedSave(id);
    };
    eBody.appendChild(ta);

    /* Image strip */
    var imgStrip = document.createElement('div');
    imgStrip.style.cssText = 'flex-shrink:0;';

    var imgBar = document.createElement('div');
    imgBar.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;';
    var imgLbl = document.createElement('span');
    imgLbl.style.cssText =
      'font-family:"Cinzel",serif;font-size:10px;letter-spacing:0.14em;color:var(--text-muted);';
    imgLbl.textContent = 'IMMAGINI';
    imgBar.appendChild(imgLbl);

    var imgFileInput = document.createElement('input');
    imgFileInput.type = 'file';
    imgFileInput.accept = 'image/*';
    imgFileInput.style.display = 'none';

    var imgUpBtn = document.createElement('button');
    imgUpBtn.textContent = '+ Aggiungi Immagine';
    imgUpBtn.style.cssText =
      'font-size:10px;padding:0.25rem 0.6rem;border-radius:5px;cursor:pointer;' +
      'background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.3);' +
      'color:rgba(245,166,35,0.8);font-family:"Cinzel",serif;letter-spacing:0.06em;transition:all 0.15s;';
    imgUpBtn.onmouseenter = function () {
      imgUpBtn.style.background = 'rgba(245,166,35,0.18)';
    };
    imgUpBtn.onmouseleave = function () {
      imgUpBtn.style.background = 'rgba(245,166,35,0.08)';
    };
    imgUpBtn.onclick = function () {
      imgFileInput.click();
    };

    imgFileInput.onchange = function () {
      var f = imgFileInput.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function (ev) {
        if (!_archBooks[id].immagini) _archBooks[id].immagini = [];
        _archBooks[id].immagini.push(ev.target.result);
        _schedSave(id);
        _renderImgGrid();
      };
      rd.readAsDataURL(f);
      imgFileInput.value = '';
    };

    imgBar.appendChild(imgUpBtn);
    imgBar.appendChild(imgFileInput);
    imgStrip.appendChild(imgBar);

    var imgGrid = document.createElement('div');
    imgGrid.style.cssText =
      'display:flex;flex-wrap:wrap;gap:0.5rem;max-height:130px;overflow-y:auto;';
    imgStrip.appendChild(imgGrid);
    eBody.appendChild(imgStrip);

    function _renderImgGrid() {
      imgGrid.innerHTML = '';
      var imgs = (_archBooks[id] && _archBooks[id].immagini) || [];
      if (!imgs.length) {
        imgGrid.style.display = 'none';
        return;
      }
      imgGrid.style.display = 'flex';
      imgs.forEach(function (src, idx) {
        var cell = document.createElement('div');
        cell.style.cssText = 'position:relative;';
        var img = document.createElement('img');
        img.src = safeImageUrl(src);
        img.style.cssText =
          'width:110px;height:110px;object-fit:cover;border-radius:6px;' +
          'border:1px solid var(--border-gold);cursor:zoom-in;display:block;';
        img.onclick = function () {
          var imageUrl = safeImageUrl(src);
          if (imageUrl) window.open(imageUrl, '_blank', 'noopener,noreferrer');
        };
        var xBtn = document.createElement('button');
        xBtn.textContent = '✕';
        xBtn.style.cssText =
          'position:absolute;top:3px;right:3px;width:19px;height:19px;' +
          'border-radius:50%;background:rgba(0,0,0,0.75);border:none;color:#fff;font-size:9px;' +
          'cursor:pointer;line-height:19px;text-align:center;padding:0;';
        xBtn.onclick = function (e) {
          e.stopPropagation();
          _archBooks[id].immagini.splice(idx, 1);
          _schedSave(id);
          _renderImgGrid();
        };
        cell.appendChild(img);
        cell.appendChild(xBtn);
        imgGrid.appendChild(cell);
      });
    }
    _renderImgGrid();

    setTimeout(function () {
      ta.focus();
    }, 60);
  }

  /* Add book */
  addBookBtn.onclick = function () {
    var id = 'libro_' + Date.now();
    var nb = { id: id, titolo: 'Nuovo Libro', contenuto: '', immagini: [] };
    _archBooks[id] = nb;
    _archRef.child(id).set(nb);
    _archSelId = id;
    _rebuildShelf();
    _openEditor(id);
  };

  /* Load books from Firebase */
  var _archLive = null;
  _archRef.once('value', function (snap) {
    var v = snap.val();
    _archBooks = v && typeof v === 'object' ? v : {};
    // Ensure immagini is always array
    Object.keys(_archBooks).forEach(function (k) {
      if (!_archBooks[k].immagini) _archBooks[k].immagini = [];
    });
    _rebuildShelf();
    editorPanel.appendChild(emptyState);

    /* Live listener for changes from other sessions */
    _archLive = _archRef.on('value', function (snap2) {
      var v2 = snap2.val();
      var remote = v2 && typeof v2 === 'object' ? v2 : {};
      /* Add new books from remote, don't override current in-editor book */
      Object.keys(remote).forEach(function (k) {
        if (k !== _archSelId && !_archBooks[k]) {
          _archBooks[k] = remote[k];
          if (!_archBooks[k].immagini) _archBooks[k].immagini = [];
        }
      });
      /* Remove deleted books */
      Object.keys(_archBooks).forEach(function (k) {
        if (!remote[k] && k !== _archSelId) delete _archBooks[k];
      });
      _rebuildShelf();
    });
  });

  /* Cleanup when leaving section */
  _sectionCleanup = function () {
    if (_archLive) {
      _archRef.off('value', _archLive);
      _archLive = null;
    }
    if (_archSaveTimer) {
      clearTimeout(_archSaveTimer);
      if (_archSelId && _archBooks[_archSelId])
        _archRef.child(_archSelId).set(_archBooks[_archSelId]);
    }
  };

  return wrap;
}
