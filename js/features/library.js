/* ============================================================
   LIBRERIA
   ============================================================ */

function _getAllBooks() {
  var map = {};
  LIBRI_DEFAULT.forEach(function (l) {
    map[l.id] = Object.assign({}, l);
  });
  var custom = state.libriCustom || {};
  Object.keys(custom).forEach(function (id) {
    if (map[id]) {
      Object.assign(map[id], custom[id]);
    } else {
      map[id] = Object.assign({ id: id }, custom[id]);
    }
  });
  return Object.values(map);
}

function _libroCard(libro) {
  var a = document.createElement('a');
  a.className = 'libro-card';
  a.href = libro.url || '#';
  if (a.href !== '#') {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }

  // DRAG & DROP per l'admin in vista predefinita
  if (
    isAdmin() &&
    state.libriSort === 'default' &&
    state.libriFilter === 'Tutte' &&
    state.libriSearch === ''
  ) {
    a.draggable = true;
    a.ondragstart = function (e) {
      e.dataTransfer.setData('text/plain', libro.id);
      a.style.opacity = '0.5';
    };
    a.ondragend = function (e) {
      a.style.opacity = '1';
    };
    a.ondragover = function (e) {
      e.preventDefault();
      a.style.transform = 'scale(1.02)';
      a.style.boxShadow = '0 0 15px rgba(245,166,35,0.5)';
    };
    a.ondragleave = function (e) {
      a.style.transform = '';
      a.style.boxShadow = '';
    };
    a.ondrop = function (e) {
      e.preventDefault();
      a.style.transform = '';
      a.style.boxShadow = '';
      var dragId = e.dataTransfer.getData('text/plain');
      if (dragId && dragId !== libro.id) {
        var all = _getAllBooks();
        all = all.filter(function (b) {
          return !b.deleted;
        });
        all.sort(function (a, b) {
          return (a.orderIndex || 0) - (b.orderIndex || 0);
        });
        var fromIdx = all.findIndex(function (b) {
          return b.id === dragId;
        });
        var toIdx = all.findIndex(function (b) {
          return b.id === libro.id;
        });
        if (fromIdx > -1 && toIdx > -1) {
          var item = all.splice(fromIdx, 1)[0];
          all.splice(toIdx, 0, item);
          if (!state.libriCustom) state.libriCustom = {};
          all.forEach(function (b, idx) {
            b.orderIndex = idx;
            if (!state.libriCustom[b.id]) state.libriCustom[b.id] = Object.assign({}, b);
            else state.libriCustom[b.id].orderIndex = idx;
            if (_db) _db.ref('libri/books/' + b.id + '/orderIndex').set(idx);
          });
          renderMain();
        }
      }
    };
  }

  var imgWrap = document.createElement('div');
  imgWrap.className = 'libro-card-img';
  imgWrap.style.position = 'relative';
  if (libro.copertina) {
    var im = createContentImage();
    im.src = libro.copertina;
    im.alt = libro.titolo;
    im.onerror = function () {
      this.style.display = 'none';
      imgWrap.innerHTML += '<span class="libro-card-img-ph">📖</span>';
    };
    imgWrap.appendChild(im);
  } else {
    imgWrap.innerHTML = '<span class="libro-card-img-ph">📖</span>';
  }

  // PREFERITI
  var u = state.currentUser ? state.currentUser.username : null;
  var isFav = false;
  if (u && state.libriPreferiti && state.libriPreferiti[libro.id]) isFav = true;
  var starBtn = document.createElement('button');
  starBtn.innerHTML = isFav ? '⭐' : '☆';
  starBtn.title = isFav ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti';
  starBtn.style.cssText =
    'position:absolute;top:8px;right:8px;background:rgba(10,22,40,0.8);border:1px solid rgba(245,166,35,0.5);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#f5a623;font-size:16px;box-shadow:0 2px 5px rgba(0,0,0,0.6);z-index:10;';
  starBtn.onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!u) {
      alert("Devi aver effettuato l'accesso.");
      return;
    }
    if (isFav) {
      if (_db) _db.ref('libri/preferiti/' + u + '/' + libro.id).remove();
      if (state.libriPreferiti) delete state.libriPreferiti[libro.id];
    } else {
      var favCount = state.libriPreferiti ? Object.keys(state.libriPreferiti).length : 0;
      if (favCount >= 4) {
        alert('Limite raggiunto: puoi selezionare massimo 4 preferiti.');
        return;
      }
      if (_db) _db.ref('libri/preferiti/' + u + '/' + libro.id).set(true);
      if (!state.libriPreferiti) state.libriPreferiti = {};
      state.libriPreferiti[libro.id] = true;
    }
    renderMain();
  };
  imgWrap.appendChild(starBtn);
  a.appendChild(imgWrap);

  var body = document.createElement('div');
  body.className = 'libro-card-body';
  body.style.position = 'relative';
  var title = document.createElement('p');
  title.className = 'libro-card-title';
  title.textContent = libro.titolo || 'Senza titolo';
  body.appendChild(title);

  var edTagWrap = document.createElement('div');
  edTagWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.4rem;';
  var edition = libro.edition || 'D&D 5e';
  var edPill = document.createElement('span');
  edPill.textContent = edition;
  edPill.style.cssText =
    'background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.3);color:#f5c842;padding:0.15rem 0.4rem;border-radius:4px;font-size:9px;font-weight:bold;letter-spacing:0.05em;';
  edTagWrap.appendChild(edPill);
  if (libro.tags) {
    libro.tags.split(',').forEach(function (tg) {
      var t = tg.trim();
      if (t) {
        var tpill = document.createElement('span');
        tpill.textContent = t;
        tpill.style.cssText =
          'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#ccc;padding:0.15rem 0.4rem;border-radius:4px;font-size:9px;white-space:nowrap;';
        edTagWrap.appendChild(tpill);
      }
    });
  }
  body.appendChild(edTagWrap);

  if (isAdmin()) {
    var adminRow = document.createElement('div');
    adminRow.style.cssText =
      'display:flex;gap:0.5rem;margin-top:0.6rem;padding-top:0.6rem;border-top:1px dashed rgba(245,166,35,0.2);';

    var editBtn = document.createElement('button');
    editBtn.textContent = '✏️ Modifica';
    editBtn.title = 'Modifica libro';
    editBtn.style.cssText =
      'flex:1;background:none;border:1px solid rgba(245,166,35,0.4);border-radius:4px;color:rgba(245,166,35,0.9);font-size:11px;cursor:pointer;padding:0.25rem 0;transition:all 0.15s;';
    editBtn.onmouseenter = function () {
      this.style.background = 'rgba(245,166,35,0.1)';
    };
    editBtn.onmouseleave = function () {
      this.style.background = 'none';
    };
    editBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      state.libriShowForm = true;
      state.libriEditId = libro.id;
      renderMain();
      setTimeout(function () {
        var f = document.querySelector('.libro-add-form');
        if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    };
    adminRow.appendChild(editBtn);

    var delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.title = 'Rimuovi libro';
    delBtn.style.cssText =
      'background:none;border:1px solid rgba(200,70,70,0.4);border-radius:4px;color:rgba(200,70,70,0.9);font-size:11px;cursor:pointer;padding:0.25rem 0.5rem;transition:all 0.15s;';
    delBtn.onmouseenter = function () {
      this.style.background = 'rgba(200,70,70,0.1)';
    };
    delBtn.onmouseleave = function () {
      this.style.background = 'none';
    };
    delBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('Rimuovere "' + (libro.titolo || '') + '" dalla libreria?')) return;
      if (!state.libriCustom) state.libriCustom = {};
      if (libro.id.startsWith('d_')) {
        var b = Object.assign({}, libro, { deleted: true });
        state.libriCustom[libro.id] = b;
        if (_db) _db.ref('libri/books/' + libro.id).set(b);
      } else {
        delete state.libriCustom[libro.id];
        if (_db) _db.ref('libri/books/' + libro.id).remove();
      }
      renderMain();
    };
    adminRow.appendChild(delBtn);
    body.appendChild(adminRow);
  }

  a.appendChild(body);
  return a;
}

function renderLibri() {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;';

  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText =
    'padding-top:1.5rem;padding-bottom:1rem;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;';
  hc.innerHTML =
    '<div><div class="header-eyebrow mb-2"><span>Risorse</span></div><h1 class="header-title">Libreria D&D</h1></div>';

  if (isAdmin()) {
    var addBtn = document.createElement('button');
    addBtn.className = 'btn-gold';
    addBtn.innerHTML = (ICON.plus || '+') + ' Aggiungi Libro';
    addBtn.style.cssText = 'align-self:flex-end;margin-bottom:0.5rem;';
    addBtn.onclick = function () {
      state.libriShowForm = true;
      state.libriEditId = null;
      renderMain();
    };
    hc.appendChild(addBtn);
  }
  header.appendChild(hc);
  wrap.appendChild(header);

  var main = document.createElement('section');
  main.className = 'container-main';
  main.style.cssText =
    'padding-top:1.5rem;padding-bottom:3rem;display:flex;flex-direction:column;gap:1.5rem;';

  if (isAdmin() && state.libriShowForm) {
    var isEdit = !!state.libriEditId;
    var editBook = null;
    if (isEdit) {
      var all = _getAllBooks();
      editBook = all.find(function (b) {
        return b.id === state.libriEditId;
      });
    }

    var form = document.createElement('div');
    form.className = 'libro-add-form';
    form.style.cssText =
      'background:var(--bg-card);border:1px solid var(--border-gold);padding:1.5rem;border-radius:8px;display:flex;flex-direction:column;gap:1rem;';

    var fTitle = document.createElement('div');
    fTitle.style.cssText =
      "font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--gold-dim);letter-spacing:0.1em;border-bottom:1px solid rgba(245,166,35,0.2);padding-bottom:0.5rem;";
    fTitle.textContent = isEdit ? 'MODIFICA LIBRO' : '+ NUOVO LIBRO';
    form.appendChild(fTitle);

    var inpTitolo = document.createElement('input');
    inpTitolo.placeholder = 'Titolo del libro *';
    inpTitolo.style.width = '100%';
    if (editBook && editBook.titolo) inpTitolo.value = editBook.titolo;

    var inpUrl = document.createElement('input');
    inpUrl.placeholder = 'Link al libro (URL) *';
    inpUrl.style.width = '100%';
    if (editBook && editBook.url) inpUrl.value = editBook.url;

    var inpImg = document.createElement('input');
    inpImg.placeholder = 'URL immagine copertina';
    inpImg.style.width = '100%';
    if (editBook && editBook.copertina) inpImg.value = editBook.copertina;

    var extRow = document.createElement('div');
    extRow.style.cssText = 'display:flex;gap:1rem;align-items:center;flex-wrap:wrap;';

    var edLbl = document.createElement('span');
    edLbl.textContent = 'Edizione:';
    edLbl.style.cssText = 'color:var(--text-secondary);font-size:13px;';
    var selEd = document.createElement('select');
    selEd.style.cssText =
      'background:rgba(10,22,40,0.8);color:var(--text-primary);border:1px solid rgba(245,166,35,0.3);padding:0.4rem;border-radius:4px;';
    ['D&D 5e', 'D&D 3.5', 'Altro/OSR'].forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      if (editBook && editBook.edition === o) opt.selected = true;
      selEd.appendChild(opt);
    });

    var tagLbl = document.createElement('span');
    tagLbl.textContent = 'Tags:';
    tagLbl.style.cssText = 'color:var(--text-secondary);font-size:13px;';
    var inpTags = document.createElement('input');
    inpTags.placeholder = 'es. Base, Mostri...';
    inpTags.style.cssText = 'flex:1;min-width:200px;';
    if (editBook && editBook.tags) inpTags.value = editBook.tags;

    extRow.appendChild(edLbl);
    extRow.appendChild(selEd);
    extRow.appendChild(tagLbl);
    extRow.appendChild(inpTags);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.5rem;';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn-gold';
    saveBtn.textContent = 'Salva';
    saveBtn.onclick = function () {
      var t = inpTitolo.value.trim();
      var u = inpUrl.value.trim();
      var c = inpImg.value.trim();
      if (!t || !u) {
        inpTitolo.style.borderColor = '#c84040';
        inpUrl.style.borderColor = '#c84040';
        return;
      }

      var id = isEdit ? editBook.id : 'b_' + Date.now();
      var libro = {
        id: id,
        titolo: t,
        url: u,
        copertina: c,
        edition: selEd.value,
        tags: inpTags.value.trim(),
      };
      if (editBook) {
        if (editBook.orderIndex !== undefined) libro.orderIndex = editBook.orderIndex;
        if (editBook.timestamp) libro.timestamp = editBook.timestamp;
      }
      if (!libro.timestamp) libro.timestamp = Date.now();

      if (!state.libriCustom) state.libriCustom = {};
      state.libriCustom[id] = libro;
      if (_db) _db.ref('libri/books/' + id).set(libro);
      state.libriShowForm = false;
      state.libriEditId = null;
      renderMain();
    };

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'mappa-btn';
    cancelBtn.textContent = 'Annulla';
    cancelBtn.onclick = function () {
      state.libriShowForm = false;
      state.libriEditId = null;
      renderMain();
    };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);

    form.appendChild(inpTitolo);
    form.appendChild(inpUrl);
    form.appendChild(inpImg);
    form.appendChild(extRow);
    form.appendChild(btnRow);
    main.appendChild(form);
  }

  var toolBar = document.createElement('div');
  toolBar.style.cssText =
    'display:flex;gap:1rem;flex-wrap:wrap;align-items:center;background:rgba(10,22,40,0.5);padding:0.8rem 1rem;border-radius:8px;border:1px solid rgba(245,166,35,0.2);';

  var filterWrap = document.createElement('div');
  filterWrap.style.cssText = 'display:flex;gap:0.4rem;';
  ['Tutte', 'D&D 5e', 'D&D 3.5', 'Altro'].forEach(function (f) {
    var btn = document.createElement('button');
    btn.textContent = f;
    var isActive = state.libriFilter === f;
    btn.style.cssText =
      'padding:0.3rem 0.8rem;border-radius:4px;font-size:12px;font-weight:bold;cursor:pointer;transition:all 0.15s;' +
      (isActive
        ? 'background:rgba(245,166,35,0.2);color:#f5c842;border:1px solid rgba(245,166,35,0.5);'
        : 'background:transparent;color:var(--text-secondary);border:1px solid transparent;');
    btn.onmouseenter = function () {
      if (!isActive) this.style.color = '#f5c842';
    };
    btn.onmouseleave = function () {
      if (!isActive) this.style.color = 'var(--text-secondary)';
    };
    btn.onclick = function () {
      state.libriFilter = f;
      renderMain();
    };
    filterWrap.appendChild(btn);
  });
  toolBar.appendChild(filterWrap);

  var space = document.createElement('div');
  space.style.flex = '1';
  toolBar.appendChild(space);

  var searchInp = document.createElement('input');
  searchInp.id = 'libri-search-input';
  searchInp.type = 'text';
  searchInp.placeholder = '🔍 Cerca titolo o tag...';
  searchInp.value = state.libriSearch || '';
  searchInp.style.cssText =
    'background:rgba(0,0,0,0.3);border:1px solid rgba(245,166,35,0.3);color:var(--text-primary);padding:0.4rem 0.8rem;border-radius:15px;font-size:13px;width:200px;';
  searchInp.oninput = function () {
    state.libriSearch = this.value;
    renderMain();
    setTimeout(function () {
      var el = document.getElementById('libri-search-input');
      if (el) {
        el.focus();
        var v = el.value;
        el.value = '';
        el.value = v;
      }
    }, 0);
  };
  toolBar.appendChild(searchInp);

  var sortWrap = document.createElement('div');
  sortWrap.style.cssText = 'display:flex;align-items:center;gap:0.5rem;';
  var sortLbl = document.createElement('span');
  sortLbl.textContent = 'Ordina:';
  sortLbl.style.cssText = 'color:var(--text-secondary);font-size:12px;';
  var sortSel = document.createElement('select');
  sortSel.style.cssText =
    'background:rgba(10,22,40,0.8);color:var(--text-primary);border:1px solid rgba(245,166,35,0.3);padding:0.3rem;border-radius:4px;font-size:12px;cursor:pointer;';
  var opts = [
    { v: 'default', l: 'Predefinito' },
    { v: 'alpha', l: 'Alfabetico (A-Z)' },
    { v: 'recent', l: 'Aggiunti di Recente' },
  ];
  opts.forEach(function (o) {
    var opt = document.createElement('option');
    opt.value = o.v;
    opt.textContent = o.l;
    if (state.libriSort === o.v) opt.selected = true;
    sortSel.appendChild(opt);
  });
  sortSel.onchange = function () {
    state.libriSort = this.value;
    renderMain();
  };
  sortWrap.appendChild(sortLbl);
  sortWrap.appendChild(sortSel);
  toolBar.appendChild(sortWrap);

  main.appendChild(toolBar);

  var allBooks = _getAllBooks().filter(function (b) {
    return !b.deleted;
  });

  var u = state.currentUser ? state.currentUser.username : null;
  if (u && state.libriPreferiti && Object.keys(state.libriPreferiti).length > 0) {
    var favSec = document.createElement('div');
    favSec.style.cssText =
      'margin-bottom:1rem;background:rgba(245,166,35,0.03);border-radius:8px;padding:1.5rem;border:1px dashed rgba(245,166,35,0.25);';
    var favTitle = document.createElement('h2');
    favTitle.textContent = 'I Tuoi Preferiti';
    favTitle.style.cssText =
      "font-family:'Cinzel',serif;font-size:16px;font-weight:700;letter-spacing:0.1em;color:#f5c842;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;";
    favTitle.textContent = '⭐ I Tuoi Preferiti';
    favSec.appendChild(favTitle);

    var favGrid = document.createElement('div');
    favGrid.className = 'libro-grid';
    var myFavs = allBooks.filter(function (b) {
      return state.libriPreferiti[b.id];
    });
    myFavs.forEach(function (b) {
      favGrid.appendChild(_libroCard(b));
    });
    favSec.appendChild(favGrid);
    main.appendChild(favSec);
  }

  var filtered = allBooks.filter(function (b) {
    var bEd = b.edition || 'D&D 5e';
    if (state.libriFilter !== 'Tutte' && state.libriFilter !== 'Altro' && bEd !== state.libriFilter)
      return false;
    if (state.libriFilter === 'Altro' && bEd === 'D&D 5e') return false;
    if (
      state.libriFilter === 'Altro' &&
      bEd !== 'Altro/OSR' &&
      bEd !== 'Altro' &&
      bEd !== 'D&D 3.5'
    )
      return true;
    if (state.libriFilter === 'Altro' && (bEd === 'D&D 5e' || bEd === 'D&D 3.5')) return false;

    if (state.libriSearch) {
      var s = state.libriSearch.toLowerCase();
      var t = (b.titolo || '').toLowerCase();
      var tags = (b.tags || '').toLowerCase();
      if (t.indexOf(s) === -1 && tags.indexOf(s) === -1) return false;
    }
    return true;
  });

  if (state.libriSort === 'alpha') {
    filtered.sort(function (a, b) {
      return (a.titolo || '').localeCompare(b.titolo || '');
    });
  } else if (state.libriSort === 'recent') {
    filtered.sort(function (a, b) {
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  } else {
    filtered.sort(function (a, b) {
      return (a.orderIndex || 0) - (b.orderIndex || 0);
    });
  }

  var gridTitle = document.createElement('h2');
  gridTitle.textContent = 'Tutti i Manuali';
  gridTitle.style.cssText =
    "font-family:'Cinzel',serif;font-size:15px;color:var(--text-secondary);letter-spacing:0.1em;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:0.5rem;margin-bottom:1rem;";
  main.appendChild(gridTitle);

  var grid = document.createElement('div');
  grid.className = 'libro-grid';
  if (filtered.length === 0) {
    var none = document.createElement('div');
    none.textContent = 'Nessun manuale trovato.';
    none.style.cssText =
      'color:var(--text-muted);font-style:italic;grid-column:1/-1;text-align:center;padding:2rem;';
    grid.appendChild(none);
  } else {
    filtered.forEach(function (b) {
      grid.appendChild(_libroCard(b));
    });
  }

  main.appendChild(grid);
  wrap.appendChild(main);
  return wrap;
}
