/* Character navigation: uses the shared sheet state and account manager. */
function _newScheda() {
  _renderTipoSelectorModal(function (tipo) {
    var nid = 'c' + Date.now();
    var ns;
    if (tipo === 'normale' || tipo === 'onepiece') {
      ns = Object.assign(_schedaDefault(), { id: nid, schedaTipo: tipo });
    } else if (tipo === 'pokemon') {
      ns = window._pokemonDefault
        ? window._pokemonDefault(nid)
        : { id: nid, schedaTipo: 'pokemon' };
    } else if (tipo === 'naruto') {
      ns = window._narutoDefault ? window._narutoDefault(nid) : { id: nid, schedaTipo: 'naruto' };
    } else if (tipo === 'brancalonia') {
      ns = window._brancaloniaDefault
        ? window._brancaloniaDefault(nid)
        : { id: nid, schedaTipo: 'brancalonia' };
    } else if (tipo === 'sw5e') {
      ns = window._sw5eDefault ? window._sw5eDefault(nid) : { id: nid, schedaTipo: 'sw5e' };
    } else {
      ns = { id: nid, nome: '', schedaTipo: tipo, annotations: {}, annotPage: 0 };
    }
    state.schedeList.push(ns);
    state.scheda = ns;
    state.schedaAttivaId = nid;
    fbSaveScheda();
    renderMain();
  });
}

function _renderSchedaList() {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'min-height:100vh;background:#5a5a5a;display:flex;flex-direction:column;';
  var tbar = document.createElement('div');
  tbar.style.cssText =
    'background:#222;border-bottom:1px solid #111;padding:0.5rem 1rem;display:flex;align-items:center;justify-content:flex-end;flex-shrink:0;';
  var btnN = document.createElement('button');
  btnN.textContent = '+ Nuova Scheda';
  btnN.style.cssText =
    "background:#8b6f3f;border:1px solid #c9a55c;color:#f0e4cc;border-radius:3px;padding:0.4rem 1rem;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;letter-spacing:0.08em;";
  btnN.onclick = function () {
    _newScheda();
  };
  tbar.appendChild(btnN);
  wrap.appendChild(tbar);
  var content = document.createElement('div');
  if (state.schedeList.length === 0) {
    content.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;';
    var empty = document.createElement('div');
    empty.style.cssText =
      'text-align:center;background:#fff;border-radius:8px;padding:3rem 4rem;box-shadow:0 4px 24px rgba(0,0,0,0.5);max-width:380px;';
    empty.innerHTML =
      '<div style="font-size:56px;margin-bottom:1rem;">📜</div><h2 style="font-family:\'Cinzel\',serif;font-size:18px;color:#333;margin:0 0 0.5rem;">Nessun personaggio</h2><p style="color:#888;font-size:14px;font-family:Arial,sans-serif;margin:0 0 1.5rem;">Crea la tua prima scheda personaggio.</p>';
    var btnC = document.createElement('button');
    btnC.textContent = 'Crea Scheda';
    btnC.style.cssText =
      "background:#8b6f3f;border:none;color:#f0e4cc;border-radius:4px;padding:0.65rem 2.5rem;cursor:pointer;font-family:'Cinzel',serif;font-size:14px;letter-spacing:0.1em;";
    btnC.onclick = function () {
      _newScheda();
    };
    empty.appendChild(btnC);
    content.appendChild(empty);
  } else {
    content.style.cssText =
      'flex:1;padding:2rem;align-self:flex-start;width:100%;box-sizing:border-box;';

    /* ── Barra filtri per stato ── */
    var filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1.2rem;';
    var STATI = [
      ['', 'Tutti'],
      ['', 'Da usare'],
      ['in_uso', 'In uso'],
      ['usato', 'Usate'],
      ['magazzino', 'Magazzino'],
    ];
    // Nota: 'Da usare' ha stato='' quindi usiamo un sentinel speciale
    var FILTRI = [
      { val: 'tutti', label: 'Tutti' },
      { val: '', label: 'Da usare' },
      { val: 'in_uso', label: 'In uso' },
      { val: 'usato', label: 'Usate' },
      { val: 'magazzino', label: 'Magazzino' },
    ];
    FILTRI.forEach(function (f) {
      var btn = document.createElement('button');
      var active = state.schedaListFilter === f.val;
      btn.style.cssText =
        "font-family:'Cinzel',serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:3px;cursor:pointer;border:1px solid " +
        (active ? '#8b6f3f' : '#ccc') +
        ';background:' +
        (active ? 'rgba(139,111,63,0.15)' : '#fff') +
        ';color:' +
        (active ? '#8b6f3f' : '#888') +
        ';';
      btn.textContent = f.label;
      btn.onclick = function () {
        state.schedaListFilter = f.val;
        renderMain();
      };
      filterBar.appendChild(btn);
    });
    content.appendChild(filterBar);

    /* ── Filtra schedeList ── */
    var schedeFiltered = state.schedeList.filter(function (sch) {
      if (state.schedaListFilter === 'tutti') return true;
      return (sch.stato || '') === state.schedaListFilter;
    });

    var grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:1.5rem;';
    schedeFiltered.forEach(function (sch) {
      var card = document.createElement('div');
      card.className = 'sium-pg-card';
      card.style.cssText =
        'width:160px;background:#fff;border-radius:6px;box-shadow:0 3px 16px rgba(0,0,0,0.5);overflow:hidden;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;';
      card.onmouseenter = function () {
        this.style.transform = 'translateY(-3px)';
        this.style.boxShadow = '0 6px 24px rgba(0,0,0,0.65)';
      };
      card.onmouseleave = function () {
        this.style.transform = '';
        this.style.boxShadow = '0 3px 16px rgba(0,0,0,0.5)';
      };
      (function (s) {
        card.onclick = function () {
          state.scheda = s;
          state.schedaAttivaId = s.id;
          renderMain();
        };
      })(sch);
      var imgD = document.createElement('div');
      imgD.style.cssText =
        'width:100%;height:160px;background:#e0d5c0;display:flex;align-items:center;justify-content:center;overflow:hidden;';
      if (sch.aspettoImg || sch.avatar || sch.portrait) {
        var im = document.createElement('img');
        im.src = sch.aspettoImg || sch.avatar || sch.portrait;
        im.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        imgD.appendChild(im);
      } else {
        imgD.innerHTML = '<div style="font-size:48px;">🧙</div>';
      }
      card.appendChild(imgD);
      var info = document.createElement('div');
      info.style.cssText = 'padding:0.6rem 0.75rem;text-align:center;';
      var nm = document.createElement('div');
      nm.style.cssText =
        "font-family:'Cinzel',serif;font-size:12px;font-weight:bold;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      nm.textContent = sch.nomePersonaggio || sch.eroe || sch.nome || 'Senza nome';
      var cl = document.createElement('div');
      cl.style.cssText =
        'font-size:10px;color:#888;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      cl.textContent = sch.classelivello || '';
      info.appendChild(nm);
      if (sch.classelivello) info.appendChild(cl);
      card.appendChild(info);
      /* Selettore stato personaggio */
      var stWrap = document.createElement('div');
      stWrap.style.cssText = 'border-top:1px solid #eee;padding:5px 6px;background:#fafafa;';
      stWrap.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      var stSel = document.createElement('select');
      stSel.style.cssText =
        'width:100%;font-size:10px;border:1px solid #ddd;border-radius:3px;padding:3px 4px;cursor:pointer;background:#fff;color:#333;outline:none;font-family:Arial,sans-serif;';
      [
        ['', 'Da usare'],
        ['in_uso', 'In uso'],
        ['usato', 'Usato'],
        ['magazzino', 'Magazzino'],
      ].forEach(function (op) {
        var opt = document.createElement('option');
        opt.value = op[0];
        opt.textContent = op[1];
        if ((sch.stato || '') === op[0]) opt.selected = true;
        stSel.appendChild(opt);
      });
      (function (ch) {
        stSel.onchange = function () {
          ch.stato = this.value;
          if (_db && state.currentUser)
            _db
              .ref('schedePG/' + state.currentUser.username + '/chars/' + ch.id + '/stato')
              .set(this.value);
        };
      })(sch);
      stWrap.appendChild(stSel);
      card.appendChild(stWrap);
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }
  wrap.appendChild(content);
  return wrap;
}
