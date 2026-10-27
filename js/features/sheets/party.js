/* ============================================================
   SEZIONE LANCIATORE DI DADI
   ============================================================ */
function renderSchedePG() {
  var wrap = document.createElement('div');

  /* Header */
  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText =
    'padding-top:2rem;padding-bottom:1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;';

  var hLeft = document.createElement('div');
  hLeft.innerHTML =
    '<div class="header-eyebrow mb-3"><span>Pannello Master</span></div>' +
    '<h1 class="header-title">Schede PG</h1>' +
    '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Tutti i personaggi della campagna.</p>';
  hc.appendChild(hLeft);

  var hRight = document.createElement('div');
  hRight.style.cssText = 'display:flex;gap:8px;align-items:center;';
  var refreshBtn = document.createElement('button');
  refreshBtn.style.cssText =
    "background:transparent;border:1px solid var(--border-subtle);color:var(--text-muted);font-size:11px;font-family:'Cinzel',serif;letter-spacing:0.08em;padding:5px 12px;border-radius:3px;cursor:pointer;";
  refreshBtn.textContent = '↻ Aggiorna';
  refreshBtn.onclick = function () {
    state.schedePGAll = null;
    state.schedePGOpenChar = null;
    if (_db) {
      _db.ref('schedePG').once('value', function (snap) {
        state.schedePGAll = snap.val() || {};

        renderMain();
      });
    }
  };
  hRight.appendChild(refreshBtn);

  /* Toggle mostra schede usate/magazzino */
  var toggleWrap = document.createElement('label');
  toggleWrap.style.cssText =
    "display:flex;align-items:center;gap:6px;cursor:pointer;font-family:'Cinzel',serif;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);user-select:none;";
  var toggleChk = document.createElement('input');
  toggleChk.type = 'checkbox';
  toggleChk.checked = !!state.schedePGShowHidden;
  toggleChk.style.cssText = 'width:15px;height:15px;cursor:pointer;accent-color:var(--gold);';
  toggleChk.onchange = function () {
    state.schedePGShowHidden = this.checked;
    renderMain();
  };
  toggleWrap.appendChild(toggleChk);
  toggleWrap.appendChild(document.createTextNode('Mostra usate / magazzino'));
  hRight.appendChild(toggleWrap);

  hc.appendChild(hRight);

  header.appendChild(hc);
  wrap.appendChild(header);

  /* ── LISTA ── */
  var body = document.createElement('div');
  body.className = 'container-main';
  body.style.cssText = 'padding-top:1.5rem;padding-bottom:2rem;';

  var allData = state.schedePGAll;

  if (allData === null || allData === undefined) {
    var loading = document.createElement('div');
    loading.style.cssText =
      "text-align:center;padding:3rem;color:var(--text-muted);font-family:'Cinzel',serif;font-size:14px;letter-spacing:0.1em;";
    loading.textContent = 'Caricamento schede…';
    body.appendChild(loading);
    wrap.appendChild(body);
    return wrap;
  }

  /* Raccolta di tutti i personaggi */
  var allChars = [];
  Object.keys(allData).forEach(function (username) {
    var userData = allData[username];
    if (userData && userData.chars) {
      Object.keys(userData.chars).forEach(function (charId) {
        var ch = userData.chars[charId];
        if (ch) allChars.push({ username: username, charId: charId, char: ch });
      });
    }
  });

  /* Utenti con almeno una scheda */
  var usernames = [];
  Object.keys(allData).forEach(function (u) {
    if (allData[u] && allData[u].chars && Object.keys(allData[u].chars).length > 0)
      usernames.push(u);
  });
  usernames.sort();

  /* Filtri per account */
  var filterBar = document.createElement('div');
  filterBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:1.5rem;';

  var mkFilterBtn = function (label, val) {
    var btn = document.createElement('button');
    var isActive = state.schedePGFilter === val;
    btn.style.cssText =
      "font-family:'Cinzel',serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:5px 14px;border-radius:3px;cursor:pointer;border:1px solid " +
      (isActive ? 'var(--gold)' : 'var(--border-subtle)') +
      ';background:' +
      (isActive ? 'rgba(201,165,92,0.15)' : 'transparent') +
      ';color:' +
      (isActive ? 'var(--gold)' : 'var(--text-muted)') +
      ';transition:all 0.15s;';
    btn.textContent = label;
    btn.onclick = function () {
      state.schedePGFilter = val;
      renderMain();
    };
    return btn;
  };

  filterBar.appendChild(mkFilterBtn('Tutti', 'tutti'));
  usernames.forEach(function (u) {
    filterBar.appendChild(mkFilterBtn(u, u));
  });
  body.appendChild(filterBar);

  /* Applica filtro account */
  var filtered =
    state.schedePGFilter === 'tutti'
      ? allChars
      : allChars.filter(function (item) {
          return item.username === state.schedePGFilter;
        });

  /* Nascondi usate/magazzino se il checkbox è spento */
  if (!state.schedePGShowHidden) {
    filtered = filtered.filter(function (item) {
      var st = item.char.stato || '';
      return st !== 'usato' && st !== 'magazzino';
    });
  }

  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText =
      "text-align:center;padding:3rem;color:var(--text-muted);font-family:'Cinzel',serif;font-size:13px;letter-spacing:0.1em;";
    empty.textContent = 'Nessuna scheda trovata.';
    body.appendChild(empty);
    wrap.appendChild(body);
    return wrap;
  }

  /* Griglia schede */
  var grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;';

  filtered.forEach(function (item) {
    var ch = item.char;
    var card = document.createElement('div');
    card.className = 'sium-pg-card';
    card.style.cssText =
      'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:6px;overflow:hidden;cursor:pointer;transition:border-color 0.15s,box-shadow 0.15s;';
    card.onmouseenter = function () {
      card.style.borderColor = 'var(--gold-dim)';
      card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.35)';
    };
    card.onmouseleave = function () {
      card.style.borderColor = 'var(--border-subtle)';
      card.style.boxShadow = 'none';
    };
    card.onclick = (function (it) {
      return function () {
        state.schedePGOpenChar = it;
        state.schedePGViewMode = true;
        state.scheda = Object.assign(_schedaFix(it.char), { id: it.charId });
        state.schedaAttivaId = it.charId;
        state.schedaLoaded = true;
        /* carica compagni dal dato già scaricato */
        state.companions = {};
        var _ud = state.schedePGAll[it.username];
        if (_ud && _ud.companions && _ud.companions[it.charId]) {
          state.companions[it.charId] = _ud.companions[it.charId];
        }
        renderMain();
      };
    })(item);

    var imgBox = document.createElement('div');
    imgBox.style.cssText =
      'width:100%;height:140px;background:var(--bg-card-elevated);display:flex;align-items:center;justify-content:center;overflow:hidden;';
    if (ch.aspettoImg || ch.avatar || ch.portrait) {
      var img = document.createElement('img');
      img.src = ch.aspettoImg || ch.avatar || ch.portrait;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      imgBox.appendChild(img);
    } else {
      var ph = document.createElement('div');
      ph.style.cssText = 'font-size:48px;line-height:1;';
      ph.textContent = '🧙';
      imgBox.appendChild(ph);
    }
    card.appendChild(imgBox);

    var info = document.createElement('div');
    info.style.cssText = 'padding:10px 12px 12px;';

    var nome = document.createElement('div');
    nome.style.cssText =
      "font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;";
    nome.textContent = ch.nomePersonaggio || ch.eroe || ch.nome || 'Senza nome';
    info.appendChild(nome);

    if (ch.classelivello) {
      var cl = document.createElement('div');
      cl.style.cssText =
        'font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px;';
      cl.textContent = ch.classelivello;
      info.appendChild(cl);
    }

    var badge = document.createElement('div');
    badge.style.cssText =
      "display:inline-block;font-size:9px;font-family:'Cinzel',serif;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:2px 7px;border-radius:2px;background:rgba(201,165,92,0.12);color:var(--gold-dim);border:1px solid rgba(201,165,92,0.25);";
    badge.textContent = item.username;
    info.appendChild(badge);

    card.appendChild(info);
    grid.appendChild(card);
  });

  body.appendChild(grid);
  wrap.appendChild(body);
  return wrap;
}
