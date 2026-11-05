/* Coalesce typing without rebuilding the grid for every keystroke or moving the caret. */
function bindCatalogSearch(input, field, update) {
  var timer = null;
  var section = state.section;
  input.dataset.searchField = field;
  input.oninput = function () {
    state[field] = input.value;
    clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      if (state.section !== section || !input.isConnected) return;
      var focused = document.activeElement === input;
      var start = input.selectionStart,
        end = input.selectionEnd,
        direction = input.selectionDirection;
      (update || renderMain)();
      if (focused && !input.isConnected) {
        var replacement = document.querySelector('[data-search-field="' + field + '"]');
        if (replacement) {
          replacement.focus({ preventScroll: true });
          try {
            replacement.setSelectionRange(start, end, direction);
          } catch (_error) {}
        }
      }
    }, 120);
  };
  onSectionCleanup(function () {
    clearTimeout(timer);
  });
  return input;
}

function makeSelectFilter(labelText, value, options, onChange, defaultLabel, displayFn) {
  var w = document.createElement('div');
  w.style.cssText = 'min-width:140px;flex:0 1 180px;';
  w.innerHTML = '<label class="field-label">' + labelText + '</label>';
  var sel = document.createElement('select');
  sel.className = 'field';
  options.forEach(function (opt) {
    var o = document.createElement('option');
    o.value = opt;
    o.textContent = opt === '' ? defaultLabel : displayFn ? displayFn(opt) : opt;
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = function () {
    onChange(this.value);
  };
  w.appendChild(sel);
  return w;
}

function renderActiveFilters(container) {
  container.innerHTML = '';
  var active = [];
  if (state.filtroTipo)
    active.push({
      label: state.filtroTipo,
      clear: function () {
        state.filtroTipo = '';
      },
    });
  if (state.filtroValuta) {
    var v = null;
    VALUTE.forEach(function (x) {
      if (x.code === state.filtroValuta) v = x;
    });
    active.push({
      label: v ? v.label : state.filtroValuta,
      clear: function () {
        state.filtroValuta = '';
      },
    });
  }
  if (state.filtroRarita)
    active.push({
      label: state.filtroRarita,
      clear: function () {
        state.filtroRarita = '';
      },
    });
  if (state.search)
    active.push({
      label: '"' + state.search + '"',
      clear: function () {
        state.search = '';
      },
    });
  if (state.emporioShowHomebrew)
    active.push({
      label: 'Homebrew incluso',
      clear: function () {
        state.emporioShowHomebrew = false;
        var c = document.getElementById('emporio-homebrew-chk');
        if (c) c.checked = false;
      },
    });

  if (active.length === 0) return;

  container.className = 'flex flex-wrap items-center gap-2 mt-5 pt-4 border-t';
  var lbl = document.createElement('span');
  lbl.className = 'font-display tracking-widest font-semibold';
  lbl.style.cssText = 'font-size:11px;color:var(--text-muted);';
  lbl.textContent = 'FILTRI ATTIVI:';
  container.appendChild(lbl);

  active.forEach(function (a) {
    var chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.innerHTML = escapeHtml(a.label) + ' <button>' + ICON.x + '</button>';
    chip.querySelector('button').onclick = function () {
      a.clear();
      renderMain();
    };
    container.appendChild(chip);
  });

  var clearAll = document.createElement('button');
  clearAll.style.cssText =
    'background:transparent;border:none;color:var(--gold);text-decoration:underline;cursor:pointer;font-family:Cinzel,serif;font-size:11px;letter-spacing:0.2em;margin-left:0.5rem;';
  clearAll.textContent = 'Ripulisci tutto';
  clearAll.onclick = function () {
    state.filtroTipo = '';
    state.filtroValuta = '';
    state.filtroRarita = '';
    state.search = '';
    renderMain();
  };
  container.appendChild(clearAll);
}

function updateResults() {
  var filtered = getFilteredArmi();
  var counter = document.getElementById('results-counter');
  if (counter) {
    counter.className = 'results-counter';
    if (filtered.length === state.armi.length) {
      counter.innerHTML =
        '<strong>' +
        state.armi.length +
        '</strong> <span class="dot"></span> <span>OGGETTI NEL COMPENDIO</span>';
    } else {
      counter.innerHTML =
        '<strong>' +
        filtered.length +
        '</strong> <span class="dot"></span> <span>DI ' +
        state.armi.length +
        ' OGGETTI</span>';
    }
  }

  var grid = document.getElementById('weapons-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.className = '';
    if (state.armi.length === 0) {
      grid.innerHTML =
        '<div class="empty-state panel-glass"><div class="rune">\u2694</div><h2>Il compendio &egrave; vuoto</h2><p>Aggiungi la prima arma al tuo database.</p><button class="btn-gold" id="empty-add">' +
        ICON.plus +
        ' Aggiungi oggetto</button></div>';
      var ea = document.getElementById('empty-add');
      if (ea && !isDM()) {
        ea.remove();
        ea = null;
      }
      if (ea)
        ea.onclick = function () {
          state.editingId = null;
          state.showForm = true;
          document.body.appendChild(renderWeaponForm());
        };
    } else {
      grid.innerHTML =
        '<div class="empty-state panel-glass"><div class="rune">\u2694</div><h2>Nessun oggetto trovato</h2><p>I filtri attivi non corrispondono ad alcun elemento.</p><button class="btn-gold" id="empty-clear">Ripulisci i filtri</button></div>';
      var ec = document.getElementById('empty-clear');
      if (ec)
        ec.onclick = function () {
          state.filtroTipo = '';
          state.filtroValuta = '';
          state.filtroRarita = '';
          state.search = '';
          renderMain();
        };
    }
    return;
  }

  grid.className = 'weapon-grid';
  appendRenderedItems(grid, filtered, function (w, idx) {
    var c = renderWeaponCard(w);
    c.style.setProperty('--card-idx', String(idx % 16));
    c.classList.add('sium-grid-card-enter');
    return c;
  });
}
