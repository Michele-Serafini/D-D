/* ============================================================
   ARMI DA FUOCO
   ============================================================ */
function renderEmporioArmiFuoco() {
  var ACCENT = '#e53030';
  /* SVG pistola realistica come placeholder */
  var GUN_SVG =
    '<svg viewBox="0 0 280 460" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">' +
    '<defs>' +
    '<radialGradient id="eg" cx="50%" cy="45%"><stop offset="0%" stop-color="#6d28d9" stop-opacity="0.55"/><stop offset="100%" stop-color="#6d28d9" stop-opacity="0"/></radialGradient>' +
    '</defs>' +
    /* bg */
    '<rect width="280" height="460" fill="#060b12"/>' +
    /* particles */
    '<circle cx="45" cy="80" r="1.1" fill="#00d4e8" opacity="0.5"/>' +
    '<circle cx="230" cy="60" r="1.3" fill="#00d4e8" opacity="0.55"/>' +
    '<circle cx="55" cy="210" r="0.9" fill="#00d4e8" opacity="0.35"/>' +
    '<circle cx="242" cy="185" r="1.1" fill="#00d4e8" opacity="0.4"/>' +
    '<circle cx="48" cy="330" r="1.2" fill="#00d4e8" opacity="0.3"/>' +
    '<circle cx="235" cy="310" r="0.9" fill="#00d4e8" opacity="0.4"/>' +
    '<circle cx="78" cy="390" r="1.1" fill="#8b5cf6" opacity="0.45"/>' +
    '<circle cx="205" cy="375" r="1.3" fill="#8b5cf6" opacity="0.4"/>' +
    '<circle cx="100" cy="140" r="0.8" fill="#00d4e8" opacity="0.3"/>' +
    '<circle cx="190" cy="250" r="0.8" fill="#8b5cf6" opacity="0.35"/>' +
    /* constellation lines */
    '<line x1="45" y1="80" x2="55" y2="210" stroke="#00d4e8" stroke-width="0.3" opacity="0.22"/>' +
    '<line x1="55" y1="210" x2="78" y2="390" stroke="#00d4e8" stroke-width="0.3" opacity="0.18"/>' +
    '<line x1="230" y1="60" x2="242" y2="185" stroke="#00d4e8" stroke-width="0.3" opacity="0.22"/>' +
    '<line x1="242" y1="185" x2="205" y2="375" stroke="#00d4e8" stroke-width="0.3" opacity="0.18"/>' +
    '<line x1="100" y1="140" x2="55" y2="210" stroke="#00d4e8" stroke-width="0.25" opacity="0.15"/>' +
    '<line x1="190" y1="250" x2="235" y2="310" stroke="#8b5cf6" stroke-width="0.25" opacity="0.18"/>' +
    /* outer frame subtle */
    '<rect x="20" y="20" width="240" height="400" fill="none" stroke="#00d4e8" stroke-width="0.7" opacity="0.35"/>' +
    /* corner bracket TL */
    '<path d="M20 68 L20 20 L68 20" fill="none" stroke="#00d4e8" stroke-width="2.2" opacity="0.95"/>' +
    '<rect x="20" y="20" width="7" height="7" fill="#00d4e8" opacity="0.7"/>' +
    /* corner bracket TR */
    '<path d="M260 68 L260 20 L212 20" fill="none" stroke="#00d4e8" stroke-width="2.2" opacity="0.95"/>' +
    '<rect x="253" y="20" width="7" height="7" fill="#00d4e8" opacity="0.7"/>' +
    /* corner bracket BL */
    '<path d="M20 372 L20 420 L68 420" fill="none" stroke="#00d4e8" stroke-width="2.2" opacity="0.95"/>' +
    '<rect x="20" y="413" width="7" height="7" fill="#00d4e8" opacity="0.7"/>' +
    /* corner bracket BR */
    '<path d="M260 372 L260 420 L212 420" fill="none" stroke="#00d4e8" stroke-width="2.2" opacity="0.95"/>' +
    '<rect x="253" y="413" width="7" height="7" fill="#00d4e8" opacity="0.7"/>' +
    /* top labels */
    '<text x="28" y="16" font-family="monospace" font-size="8.5" fill="#00d4e8" opacity="0.9" letter-spacing="1.5">MODEL AK.5G</text>' +
    '<text x="186" y="16" font-family="monospace" font-size="7" fill="#00d4e8" opacity="0.45">CONF:Z8LM5</text>' +
    /* energy aura (glow behind rifle) */
    '<ellipse cx="140" cy="220" rx="70" ry="105" fill="url(#eg)"/>' +
    '<ellipse cx="140" cy="220" rx="45" ry="68" fill="url(#eg)" opacity="0.7"/>' +
    '<ellipse cx="140" cy="220" rx="75" ry="115" fill="none" stroke="#8b5cf6" stroke-width="0.6" opacity="0.28"/>' +
    '<ellipse cx="140" cy="220" rx="52" ry="82" fill="none" stroke="#7c3aed" stroke-width="0.5" opacity="0.22"/>' +
    /* ===== FUCILE D ASSALTO (verticale, canna in alto) ===== */
    /* soppressore / flash hider */
    '<rect x="133" y="30" width="14" height="24" rx="3" fill="#131620" stroke="#1e2338" stroke-width="0.9"/>' +
    '<rect x="136" y="30" width="8" height="4" rx="1" fill="#090c16"/>' +
    '<rect x="136" y="38" width="8" height="4" rx="1" fill="#090c16"/>' +
    '<rect x="136" y="46" width="8" height="4" rx="1" fill="#090c16"/>' +
    /* canna */
    '<rect x="137" y="54" width="6" height="60" rx="1.5" fill="#1c2038"/>' +
    /* gas tube (sottile, lungo la canna) */
    '<rect x="139" y="56" width="2" height="48" rx="1" fill="#0d1028"/>' +
    /* alzo anteriore */
    '<rect x="130" y="110" width="20" height="7" rx="2" fill="#1e2235" stroke="#252848" stroke-width="0.6"/>' +
    '<rect x="139" y="103" width="2" height="10" rx="0.5" fill="#1e2235"/>' +
    /* handguard */
    '<rect x="128" y="117" width="24" height="76" rx="2.5" fill="#191d30" stroke="#222540" stroke-width="0.8"/>' +
    '<line x1="128" y1="127" x2="152" y2="127" stroke="#0d1025" stroke-width="1.3"/>' +
    '<line x1="128" y1="138" x2="152" y2="138" stroke="#0d1025" stroke-width="1.3"/>' +
    '<line x1="128" y1="149" x2="152" y2="149" stroke="#0d1025" stroke-width="1.3"/>' +
    '<line x1="128" y1="160" x2="152" y2="160" stroke="#0d1025" stroke-width="1.3"/>' +
    '<line x1="128" y1="171" x2="152" y2="171" stroke="#0d1025" stroke-width="1.3"/>' +
    '<line x1="128" y1="182" x2="152" y2="182" stroke="#0d1025" stroke-width="1.3"/>' +
    /* attacco cannocchiale (picatinny rail top) */
    '<rect x="128" y="117" width="24" height="4" rx="1" fill="#14182a"/>' +
    /* upper receiver */
    '<rect x="123" y="191" width="34" height="44" rx="3" fill="#1c2038" stroke="#242848" stroke-width="0.8"/>' +
    /* alzo posteriore */
    '<rect x="125" y="192" width="14" height="6" rx="1.5" fill="#252848"/>' +
    /* sportellino espulsione */
    '<rect x="151" y="198" width="5" height="20" rx="1" fill="#0d1020" stroke="#1e2235" stroke-width="0.5"/>' +
    /* leva di armamento */
    '<rect x="155" y="192" width="8" height="14" rx="2" fill="#141828" stroke="#1e2235" stroke-width="0.5"/>' +
    /* lower receiver */
    '<rect x="124" y="232" width="32" height="32" rx="2.5" fill="#161929" stroke="#20243a" stroke-width="0.8"/>' +
    /* guardia grilletto */
    '<path d="M139 248 Q144 268 158 268 L162 268 L162 238" fill="none" stroke="#252848" stroke-width="2.2"/>' +
    /* grilletto */
    '<rect x="142" y="235" width="3.5" height="16" rx="1.2" fill="#2a2e50"/>' +
    /* caricatore */
    '<path d="M130 258 L152 258 L154 318 Q152 330 140 330 Q128 330 126 318 Z" fill="#12162a" stroke="#1e2235" stroke-width="0.9"/>' +
    '<line x1="130" y1="274" x2="152" y2="274" stroke="#1c2038" stroke-width="0.6"/>' +
    '<line x1="129" y1="292" x2="151" y2="292" stroke="#1c2038" stroke-width="0.6"/>' +
    /* impugnatura pistola */
    '<path d="M154 238 L168 238 L170 294 Q168 306 161 308 Q154 308 152 298 L152 258 Z" fill="#111525" stroke="#1e2235" stroke-width="0.8"/>' +
    /* calcio (buffer tube + stock) */
    '<rect x="105" y="228" width="20" height="9" rx="4" fill="#181c2e" stroke="#20243a" stroke-width="0.7"/>' +
    '<rect x="82" y="224" width="26" height="16" rx="3.5" fill="#141828" stroke="#1e2235" stroke-width="0.8"/>' +
    '<rect x="77" y="226" width="9" height="22" rx="2.5" fill="#111522" stroke="#1e2235" stroke-width="0.7"/>' +
    '<rect x="86" y="234" width="13" height="18" rx="2" fill="#0f1320"/>' +
    /* luce rossa LED stock */
    '<circle cx="80" cy="246" r="1.2" fill="#e53030" opacity="0.7"/>' +
    /* highlight cyan sottile sulla canna */
    '<line x1="140" y1="54" x2="140" y2="114" stroke="#00d4e8" stroke-width="0.5" opacity="0.18"/>' +
    /* pannello stats destra */
    '<rect x="196" y="108" width="60" height="96" fill="#00d4e8" fill-opacity="0.025" stroke="#00d4e8" stroke-width="0.5" opacity="0.55"/>' +
    '<line x1="196" y1="119" x2="256" y2="119" stroke="#00d4e8" stroke-width="0.5" opacity="0.55"/>' +
    '<text x="200" y="117" font-family="monospace" font-size="5.5" fill="#00d4e8" opacity="0.85" letter-spacing="0.5">CUSTOMIZATION</text>' +
    '<text x="200" y="128" font-family="monospace" font-size="5" fill="#00d4e8" opacity="0.6">Accessori  Cal.00</text>' +
    '<text x="200" y="137" font-family="monospace" font-size="5" fill="#00d4e8" opacity="0.6">Potenza    B6I</text>' +
    '<text x="200" y="146" font-family="monospace" font-size="5" fill="#00d4e8" opacity="0.6">Stabilita  0.0I</text>' +
    '<text x="200" y="155" font-family="monospace" font-size="5" fill="#00d4e8" opacity="0.6">Cadenza   16/0</text>' +
    '<text x="200" y="164" font-family="monospace" font-size="4.5" fill="#00d4e8" opacity="0.35">-----------</text>' +
    '<text x="200" y="174" font-family="monospace" font-size="4.5" fill="#00d4e8" opacity="0.4">TACTICAL MODE</text>' +
    '<text x="200" y="182" font-family="monospace" font-size="4.5" fill="#00d4e8" opacity="0.4">ACTIVE</text>' +
    '<text x="200" y="196" font-family="monospace" font-size="4.5" fill="#00d4e8" opacity="0.28">||||||||||| 98%</text>' +
    /* scan line sottile che attraversa il frame */
    '<line x1="20" y1="220" x2="260" y2="220" stroke="#00d4e8" stroke-width="0.4" opacity="0.06"/>' +
    /* testo info in basso */
    '<line x1="20" y1="422" x2="260" y2="422" stroke="#00d4e8" stroke-width="0.5" opacity="0.25"/>' +
    '<text x="26" y="432" font-family="monospace" font-size="4.5" fill="#00d4e8" opacity="0.38">F10.J6S  00BCHARGERPRIME  5LMS OOQ  SCHAND...</text>' +
    /* pulsante READY esagonale */
    '<path d="M90 446 L112 436 L168 436 L190 446 L168 456 L112 456 Z" fill="#00d4e8" fill-opacity="0.08" stroke="#00d4e8" stroke-width="1.4" opacity="0.9"/>' +
    '<text x="140" y="450.5" font-family="monospace" font-size="9.5" font-weight="bold" fill="#00d4e8" text-anchor="middle" letter-spacing="3.5">READY</text>' +
    '</svg>';

  var wrap = document.createElement('div');
  wrap.style.cssText =
    "background:#0d0000;min-height:100vh;font-family:'Courier New',monospace;color:" +
    ACCENT +
    ';display:flex;flex-direction:column;';

  /* --- HEADER --- */
  var hdr = document.createElement('div');
  hdr.style.cssText =
    'background:linear-gradient(180deg,rgba(25,2,2,0.98),rgba(13,0,0,0.95));border-bottom:2px solid rgba(229,48,48,0.3);padding:1.25rem 2rem;flex-shrink:0;';
  var hdrRow = document.createElement('div');
  hdrRow.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:0.75rem;';
  var hdrLeft = document.createElement('div');
  hdrLeft.innerHTML =
    '<div style="font-size:14px;font-weight:700;letter-spacing:0.15em;color:' +
    ACCENT +
    ';margin-bottom:0.3rem;">// EMPORIO — ARSENALE //</div>' +
    "<div style=\"font-family:'Cinzel',serif;font-size:1.8rem;font-weight:900;letter-spacing:0.25em;color:" +
    ACCENT +
    ';">ARMI DA FUOCO</div>';
  var hdrRight = document.createElement('div');
  hdrRight.style.cssText = 'display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center;';
  if (isAdmin()) {
    var _subT = state.armiSubTab || 'armi';
    var addBtn = document.createElement('button');
    addBtn.style.cssText =
      'background:rgba(229,48,48,0.12);border:2px solid ' +
      ACCENT +
      ';color:' +
      ACCENT +
      ";font-family:'Courier New',monospace;font-size:13px;font-weight:700;letter-spacing:0.1em;padding:0.5rem 1.1rem;cursor:pointer;text-transform:uppercase;";
    addBtn.textContent =
      _subT === 'potenziamenti'
        ? '+ POTENZIAMENTO'
        : _subT === 'munizioni'
          ? '+ MUNIZIONI'
          : '+ NUOVA ARMA';
    addBtn.onclick = function () {
      if (_subT === 'potenziamenti') {
        state.potenziamentiShowForm = true;
        state.potenziamentiEditingId = null;
      } else if (_subT === 'munizioni') {
        state.munizioniArmiShowForm = true;
        state.munizioniArmiEditingId = null;
      } else {
        state.armiDaFuocoShowForm = true;
        state.armiDaFuocoEditingId = null;
      }
      renderMain();
    };
    hdrRight.appendChild(addBtn);
  }
  var backBtn = document.createElement('button');
  backBtn.style.cssText =
    'background:rgba(229,48,48,0.08);border:2px solid rgba(229,48,48,0.5);color:' +
    ACCENT +
    ";font-family:'Courier New',monospace;font-size:13px;font-weight:700;letter-spacing:0.1em;padding:0.5rem 1.1rem;cursor:pointer;text-transform:uppercase;";
  backBtn.innerHTML = '← TORNA EMPORIO';
  backBtn.onclick = function () {
    state.emporioTab = 'normale';
    renderMain();
  };
  hdrRight.appendChild(backBtn);
  hdrRow.appendChild(hdrLeft);
  hdrRow.appendChild(hdrRight);
  hdr.appendChild(hdrRow);
  var srch = document.createElement('input');
  srch.type = 'text';
  srch.placeholder = '> RICERCA ARMI...';
  srch.id = 'srch-armifuoco';
  srch.value = state.armiDaFuocoSearch || '';
  srch.style.cssText =
    'width:100%;box-sizing:border-box;background:rgba(229,48,48,0.04);border:1px solid rgba(229,48,48,0.3);color:' +
    ACCENT +
    ";font-family:'Courier New',monospace;font-size:13px;padding:0.5rem 1rem;outline:none;";
  srch.oninput = function () {
    state.armiDaFuocoSearch = this.value;
    renderMain();
    var f = document.getElementById('srch-armifuoco');
    if (f) {
      f.focus();
      var l = f.value.length;
      f.setSelectionRange(l, l);
    }
  };
  if ((state.armiSubTab || 'armi') !== 'armi') srch.style.display = 'none';
  hdr.appendChild(srch);
  wrap.appendChild(hdr);

  /* --- SUB-TAB BAR --- */
  var subTabBar = document.createElement('div');
  subTabBar.style.cssText =
    'display:flex;border-bottom:2px solid rgba(229,48,48,0.2);background:#090000;flex-shrink:0;';
  [
    ['armi', '⊛ ARMI'],
    ['potenziamenti', '⬡ POTENZIAMENTI'],
    ['munizioni', '◉ MUNIZIONI'],
  ].forEach(function (t) {
    var isAct = (state.armiSubTab || 'armi') === t[0];
    var tb = document.createElement('button');
    tb.style.cssText =
      'background:' +
      (isAct ? 'rgba(229,48,48,0.1)' : 'transparent') +
      ';border:none;border-bottom:2px solid ' +
      (isAct ? ACCENT : 'transparent') +
      ';color:' +
      (isAct ? ACCENT : 'rgba(229,48,48,0.4)') +
      ";font-family:'Courier New',monospace;font-size:12px;font-weight:700;letter-spacing:0.1em;padding:0.6rem 1.4rem;cursor:pointer;text-transform:uppercase;transition:all 0.15s;margin-bottom:-2px;";
    tb.textContent = t[1];
    tb.onclick = function () {
      state.armiSubTab = t[0];
      renderMain();
    };
    subTabBar.appendChild(tb);
  });
  wrap.appendChild(subTabBar);

  if ((state.armiSubTab || 'armi') === 'potenziamenti') {
    wrap.appendChild(_renderArmiPotenziamenti());
    if (state.potenziamentiShowForm) wrap.appendChild(_renderPotenziamentiForm());
    return wrap;
  }
  if ((state.armiSubTab || 'armi') === 'munizioni') {
    wrap.appendChild(_renderArmiMunizioni());
    if (state.munizioniArmiShowForm) wrap.appendChild(_renderMunizioniArmiForm());
    return wrap;
  }

  var all = (state.armiDaFuoco || []).slice().sort(function (a, b) {
    return (a.nome || '').localeCompare(b.nome || '', 'it');
  });
  var q = (state.armiDaFuocoSearch || '').toLowerCase();
  var filtered = q
    ? all.filter(function (a) {
        return (
          (a.nome || '').toLowerCase().includes(q) ||
          (a.tipo || '').toLowerCase().includes(q) ||
          (a.descrizione || '').toLowerCase().includes(q)
        );
      })
    : all;

  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText =
      'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(229,48,48,0.3);font-size:18px;letter-spacing:0.1em;padding:4rem;text-align:center;';
    empty.innerHTML =
      '<div style="width:180px;height:120px;margin:0 auto 1.5rem;">' +
      GUN_SVG +
      '</div>NESSUNA ARMA NEL DATABASE' +
      (isDM()
        ? '<div style="margin-top:1rem;font-size:13px;">> aggiungi la prima arma per iniziare</div>'
        : '');
    wrap.appendChild(empty);
    if (state.armiDaFuocoShowForm) wrap.appendChild(renderArmaFuocoForm());
    return wrap;
  }

  if (
    !state.armiDaFuocoSelectedId ||
    !filtered.find(function (a) {
      return a.id === state.armiDaFuocoSelectedId;
    })
  )
    state.armiDaFuocoSelectedId = filtered[0].id;
  var selected =
    filtered.find(function (a) {
      return a.id === state.armiDaFuocoSelectedId;
    }) || filtered[0];

  /* --- MAIN AREA (sezione 1 + sezione 2) --- */
  var mainArea = document.createElement('div');
  mainArea.style.cssText = 'flex:1;display:flex;overflow:hidden;min-height:300px;';

  /* Sezione 1 — immagine */
  var sec1 = document.createElement('div');
  sec1.style.cssText =
    'flex:0 0 55%;min-width:0;position:relative;background:#080000;overflow:hidden;display:flex;align-items:center;justify-content:center;';

  function renderSec1(arma) {
    sec1.innerHTML = '';
    var imgs = _vehicleImages(arma);
    if (imgs.length > 0) {
      var car = _buildVehicleCarousel(imgs);
      if (car) {
        car.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
        var ci = car.querySelector('img');
        if (ci)
          ci.style.cssText =
            'width:100%;height:100%;object-fit:cover;display:block;transition:opacity 0.15s;';
        sec1.appendChild(car);
      }
    } else {
      var ph = document.createElement('div');
      ph.style.cssText = 'width:320px;max-width:70%;';
      ph.innerHTML = GUN_SVG;
      sec1.appendChild(ph);
    }
    var overlay = document.createElement('div');
    overlay.style.cssText =
      'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.88));padding:1.5rem 1.5rem 0.9rem;pointer-events:none;';
    overlay.innerHTML =
      '<div style="font-family:\'Cinzel\',serif;font-size:1.4rem;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.9);">' +
      escapeHtml(arma.nome || 'Senza nome') +
      '</div>' +
      (arma.tipo
        ? '<div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.9);margin-top:0.2rem;">' +
          escapeHtml(arma.tipo) +
          '</div>'
        : '');
    sec1.appendChild(overlay);
  }
  renderSec1(selected);
  mainArea.appendChild(sec1);

  var divLine = document.createElement('div');
  divLine.style.cssText = 'width:2px;background:rgba(229,48,48,0.2);flex-shrink:0;';
  mainArea.appendChild(divLine);

  /* Sezione 2 — dettagli */
  var sec2 = document.createElement('div');
  sec2.style.cssText =
    'flex:1;min-width:0;background:#0d0000;overflow-y:auto;padding:1.25rem 1.5rem;';

  function renderSec2(arma) {
    sec2.innerHTML = '';
    function row(lbl, val) {
      if (!val) return;
      var d = document.createElement('div');
      d.style.cssText = 'margin-bottom:0.85rem;';
      var l = document.createElement('div');
      l.style.cssText =
        'font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(229,48,48,0.5);margin-bottom:0.18rem;';
      l.textContent = lbl;
      var v = document.createElement('div');
      v.style.cssText = 'font-size:16px;color:#ffb3b3;line-height:1.5;';
      v.textContent = val;
      d.appendChild(l);
      d.appendChild(v);
      sec2.appendChild(d);
    }
    row('// TIPO', arma.tipo);
    row('// MUNIZIONI', arma.munizioni);
    if (arma.descrizione) {
      var dl = document.createElement('div');
      dl.style.cssText =
        'font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(229,48,48,0.5);margin-bottom:0.18rem;';
      dl.textContent = '// DESCRIZIONE';
      sec2.appendChild(dl);
      var dv = document.createElement('div');
      dv.style.cssText =
        'font-size:15px;color:#ffcccc;line-height:1.65;margin-bottom:0.85rem;white-space:pre-wrap;';
      dv.textContent = arma.descrizione;
      sec2.appendChild(dv);
    }
    if (arma.costo) row('// PREZZO', arma.costo + ' ' + (arma.valuta || 'mo'));
    if (isAdmin()) {
      var br = document.createElement('div');
      br.style.cssText =
        'display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid rgba(229,48,48,0.15);padding-top:1rem;';
      var eb = document.createElement('button');
      eb.style.cssText =
        'flex:1;background:rgba(229,48,48,0.1);border:1px solid rgba(229,48,48,0.4);color:' +
        ACCENT +
        ";font-family:'Courier New',monospace;font-size:12px;font-weight:700;padding:0.4rem;cursor:pointer;";
      eb.textContent = '✎ MODIFICA';
      eb.onclick = function () {
        state.armiDaFuocoEditingId = arma.id;
        state.armiDaFuocoShowForm = true;
        renderMain();
      };
      var db2 = document.createElement('button');
      db2.style.cssText =
        "background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.4);color:#ff8080;font-family:'Courier New',monospace;font-size:12px;font-weight:700;padding:0.4rem 0.65rem;cursor:pointer;";
      db2.textContent = '✕';
      db2.onclick = function () {
        if (confirm('Eliminare ' + escapeHtml(arma.nome || 'questa arma') + '?')) {
          state.armiDaFuoco = state.armiDaFuoco.filter(function (x) {
            return x.id !== arma.id;
          });
          fbSaveArmiFuoco();
          renderMain();
        }
      };
      br.appendChild(eb);
      br.appendChild(db2);
      sec2.appendChild(br);
    }
  }
  renderSec2(selected);
  mainArea.appendChild(sec2);
  wrap.appendChild(mainArea);

  /* --- SEZIONE 3 — carousel schede con auto-scroll --- */
  var CARD_W = 160;
  var carWrap = document.createElement('div');
  carWrap.style.cssText =
    'flex-shrink:0;height:200px;border-top:2px solid rgba(229,48,48,0.25);background:#080000;display:flex;align-items:stretch;';

  var prevBtn = document.createElement('button');
  prevBtn.style.cssText =
    'flex-shrink:0;width:44px;background:rgba(229,48,48,0.08);border:none;border-right:1px solid rgba(229,48,48,0.18);color:' +
    ACCENT +
    ';font-size:26px;font-weight:900;cursor:pointer;';
  prevBtn.textContent = '‹';
  carWrap.appendChild(prevBtn);

  var strip = document.createElement('div');
  strip.style.cssText =
    'flex:1;display:flex;align-items:stretch;gap:0;overflow-x:auto;padding:10px 12px;scrollbar-width:thin;scrollbar-color:rgba(229,48,48,0.3) transparent;';

  var cardEls = [];
  filtered.forEach(function (arma) {
    var isSel = arma.id === selected.id;
    var card = document.createElement('div');
    card.style.cssText =
      'flex-shrink:0;width:' +
      CARD_W +
      'px;margin-right:10px;border:2px solid ' +
      (isSel ? ACCENT : 'rgba(229,48,48,0.18)') +
      ';cursor:pointer;background:' +
      (isSel ? 'rgba(229,48,48,0.07)' : '#0a0000') +
      ';display:flex;flex-direction:column;overflow:hidden;transition:border-color 0.15s,background 0.15s;';

    /* immagine card */
    var imgBox = document.createElement('div');
    imgBox.style.cssText =
      'height:105px;flex-shrink:0;position:relative;background:#040000;overflow:hidden;display:flex;align-items:center;justify-content:center;';
    var imgs = _vehicleImages(arma);
    if (imgs.length > 0) {
      var ci = createContentImage();
      ci.src = imgs[0];
      ci.alt = '';
      ci.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      ci.onerror = function () {
        ci.style.display = 'none';
        imgBox.innerHTML = GUN_SVG;
      };
      imgBox.appendChild(ci);
    } else {
      imgBox.innerHTML = GUN_SVG;
    }
    /* bordo inferiore immagine */
    var imgBorder = document.createElement('div');
    imgBorder.style.cssText =
      'position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,' +
      ACCENT +
      ',transparent);opacity:' +
      (isSel ? '1' : '0.3') +
      ';';
    imgBox.appendChild(imgBorder);
    card.appendChild(imgBox);

    /* info card */
    var info = document.createElement('div');
    info.style.cssText =
      'flex:1;padding:6px 8px;display:flex;flex-direction:column;justify-content:space-between;';
    var nomDiv = document.createElement('div');
    nomDiv.style.cssText =
      "font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:#ffcccc;letter-spacing:0.05em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    nomDiv.textContent = arma.nome || '?';
    info.appendChild(nomDiv);
    var tipDiv = document.createElement('div');
    tipDiv.style.cssText =
      'font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:' +
      ACCENT +
      ';margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    tipDiv.textContent = arma.tipo || '';
    info.appendChild(tipDiv);
    if (arma.munizioni) {
      var munDiv = document.createElement('div');
      munDiv.style.cssText =
        'font-size:11px;color:rgba(229,48,48,0.5);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      munDiv.textContent = arma.munizioni;
      info.appendChild(munDiv);
    }
    card.appendChild(info);

    (function (a, el) {
      el.onclick = function () {
        state.armiDaFuocoSelectedId = a.id;
        cardEls.forEach(function (ce) {
          ce.style.borderColor = 'rgba(229,48,48,0.18)';
          ce.style.background = '#0a0000';
          var ib = ce.querySelector('div[data-imgborder]');
          if (ib) ib.style.opacity = '0.3';
        });
        el.style.borderColor = ACCENT;
        el.style.background = 'rgba(229,48,48,0.07)';
        renderSec1(a);
        renderSec2(a);
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      };
    })(arma, card);
    imgBorder.setAttribute('data-imgborder', '1');
    strip.appendChild(card);
    cardEls.push(card);
  });

  /* Clone cards for infinite circular scroll */
  cardEls.forEach(function (origCard, idx) {
    var a = filtered[idx];
    var clone = origCard.cloneNode(true);
    clone.onclick = function () {
      state.armiDaFuocoSelectedId = a.id;
      cardEls.forEach(function (ce) {
        ce.style.borderColor = 'rgba(229,48,48,0.18)';
        ce.style.background = '#0a0000';
      });
      origCard.style.borderColor = ACCENT;
      origCard.style.background = 'rgba(229,48,48,0.07)';
      renderSec1(a);
      renderSec2(a);
      origCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    };
    strip.appendChild(clone);
  });

  var halfWidth = 0;
  setTimeout(function () {
    halfWidth = strip.scrollWidth / 2;
  }, 150);

  /* Mouse wheel → scroll orizzontale circolare */
  strip.addEventListener(
    'wheel',
    function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        strip.scrollLeft += e.deltaY;
        if (halfWidth > 0) {
          if (strip.scrollLeft >= halfWidth) strip.scrollLeft -= halfWidth;
          else if (strip.scrollLeft < 0) strip.scrollLeft += halfWidth;
        }
      }
    },
    { passive: false }
  );

  /* Auto-scroll lento circolare */
  var autoScrollId = null;
  var autoScrollPaused = false;
  function startAutoScroll() {
    if (autoScrollId) return;
    autoScrollId = setInterval(function () {
      if (autoScrollPaused) return;
      strip.scrollLeft += 0.6;
      if (halfWidth > 0 && strip.scrollLeft >= halfWidth) strip.scrollLeft -= halfWidth;
    }, 30);
  }
  strip.addEventListener('mouseenter', function () {
    autoScrollPaused = true;
  });
  strip.addEventListener('mouseleave', function () {
    autoScrollPaused = false;
  });
  strip.addEventListener(
    'touchstart',
    function () {
      autoScrollPaused = true;
    },
    { passive: true }
  );
  wrap.addEventListener('remove-autoscroll', function () {
    clearInterval(autoScrollId);
  });
  setTimeout(startAutoScroll, 600);

  prevBtn.onclick = function () {
    var idx = filtered.findIndex(function (a) {
      return a.id === state.armiDaFuocoSelectedId;
    });
    var ni = (idx - 1 + filtered.length) % filtered.length;
    cardEls[ni].onclick();
  };
  carWrap.appendChild(strip);

  var nextBtn = document.createElement('button');
  nextBtn.style.cssText =
    'flex-shrink:0;width:44px;background:rgba(229,48,48,0.08);border:none;border-left:1px solid rgba(229,48,48,0.18);color:' +
    ACCENT +
    ';font-size:26px;font-weight:900;cursor:pointer;';
  nextBtn.textContent = '›';
  nextBtn.onclick = function () {
    var idx = filtered.findIndex(function (a) {
      return a.id === state.armiDaFuocoSelectedId;
    });
    var ni = (idx + 1) % filtered.length;
    cardEls[ni].onclick();
  };
  carWrap.appendChild(nextBtn);
  wrap.appendChild(carWrap);

  if (state.armiDaFuocoShowForm) wrap.appendChild(renderArmaFuocoForm());
  return wrap;
}

function renderArmaFuocoForm() {
  var ACCENT = '#e53030';
  var editing = null;
  if (state.armiDaFuocoEditingId)
    (state.armiDaFuoco || []).forEach(function (x) {
      if (x.id === state.armiDaFuocoEditingId) editing = x;
    });
  var _ei = editing
    ? editing.immagini && editing.immagini.length
      ? editing.immagini.slice()
      : editing.immagine
        ? [editing.immagine]
        : []
    : [];
  var form = {
    nome: editing ? editing.nome : '',
    tipo: editing ? editing.tipo : TIPI_ARMA_FUOCO[0],
    munizioni: editing ? editing.munizioni : MUNIZIONI_ARMA[0],
    costo: editing ? editing.costo : 0,
    valuta: editing ? editing.valuta : 'mo',
    descrizione: editing ? editing.descrizione : '',
    immagini: _ei,
  };

  var backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick = function (e) {
    if (e.target === backdrop) {
      state.armiDaFuocoShowForm = false;
      state.armiDaFuocoEditingId = null;
      renderMain();
    }
  };

  var panel = document.createElement('div');
  panel.style.cssText =
    'background:#0d0000;border:2px solid rgba(229,48,48,0.5);padding:0;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick = function (e) {
    e.stopPropagation();
  };

  var mhead = document.createElement('div');
  mhead.style.cssText =
    'padding:1rem 1.5rem;border-bottom:1px solid rgba(229,48,48,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML =
    "<div style=\"font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:" +
    ACCENT +
    ';letter-spacing:0.1em;">' +
    (editing ? '✎ MODIFICA ARMA' : '🔫 NUOVA ARMA') +
    '</div>';
  var closeB = document.createElement('button');
  closeB.style.cssText =
    'background:none;border:none;color:' + ACCENT + ';font-size:20px;cursor:pointer;';
  closeB.textContent = '✕';
  closeB.onclick = function () {
    state.armiDaFuocoShowForm = false;
    state.armiDaFuocoEditingId = null;
    renderMain();
  };
  mhead.appendChild(closeB);
  panel.appendChild(mhead);

  var mbody = document.createElement('div');
  mbody.style.cssText = 'padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';

  var fStyle =
    "width:100%;background:#0d0000;border:1px solid rgba(229,48,48,0.35);color:#ffb3b3;font-family:'Courier New',monospace;font-size:14px;padding:0.5rem 0.75rem;outline:none;box-sizing:border-box;";
  function aField(lbl, key, type, opts) {
    var g = document.createElement('div');
    var l = document.createElement('label');
    l.style.cssText =
      'display:block;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.65);margin-bottom:0.3rem;';
    l.textContent = '// ' + lbl;
    g.appendChild(l);
    var el;
    if (type === 'select') {
      el = document.createElement('select');
      el.style.cssText = fStyle + 'appearance:none;-webkit-appearance:none;cursor:pointer;';
      (opts || []).forEach(function (o) {
        var opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        opt.style.cssText = 'background:#0d0000;color:#ffb3b3;';
        if (form[key] === o) opt.selected = true;
        el.appendChild(opt);
      });
    } else if (type === 'textarea') {
      el = document.createElement('textarea');
      el.style.cssText = fStyle + 'resize:vertical;';
      el.rows = 4;
      el.value = form[key];
    } else {
      el = document.createElement('input');
      el.type = type || 'text';
      el.style.cssText = fStyle;
      el.value = form[key];
    }
    el.onchange = el.oninput = function () {
      form[key] = type === 'number' ? Number(this.value) || 0 : this.value;
    };
    g.appendChild(el);
    return g;
  }

  mbody.appendChild(aField('NOME ARMA', 'nome', 'text'));
  var rTM = document.createElement('div');
  rTM.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;';
  rTM.appendChild(aField('TIPO', 'tipo', 'select', TIPI_ARMA_FUOCO));
  rTM.appendChild(aField('MUNIZIONI', 'munizioni', 'select', MUNIZIONI_ARMA));
  mbody.appendChild(rTM);
  var rCP = document.createElement('div');
  rCP.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  rCP.appendChild(aField('COSTO', 'costo', 'number'));
  rCP.appendChild(
    aField(
      'VALUTA',
      'valuta',
      'select',
      VALUTE.map(function (v) {
        return v.code;
      })
    )
  );
  mbody.appendChild(rCP);
  mbody.appendChild(aField('DESCRIZIONE', 'descrizione', 'textarea'));

  /* Image editor riutilizza helper veicoli ma con colore rosso */
  var imgEditor = _buildVehicleImageEditor(form, ACCENT);
  /* Override colors to red theme */
  imgEditor.querySelectorAll &&
    imgEditor.querySelectorAll('button').forEach &&
    imgEditor.querySelectorAll('button').forEach(function (b) {
      b.style.borderColor = 'rgba(229,48,48,0.45)';
      b.style.color = ACCENT;
      b.style.background = 'rgba(229,48,48,0.08)';
    });
  mbody.appendChild(imgEditor);

  var saveBtn = document.createElement('button');
  saveBtn.style.cssText =
    'width:100%;background:rgba(229,48,48,0.12);border:2px solid ' +
    ACCENT +
    ';color:' +
    ACCENT +
    ";font-family:'Courier New',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;";
  saveBtn.textContent = editing ? '> SALVA MODIFICHE' : "> AGGIUNGI ALL'ARSENALE";
  saveBtn.onclick = function () {
    if (!form.nome.trim()) {
      notify("Inserisci il nome dell'arma.", 'err');
      return;
    }
    var saved = Object.assign({}, form, { immagini: form.immagini || [] });
    delete saved.immagine;
    if (!state.armiDaFuoco) state.armiDaFuoco = [];
    if (editing) {
      state.armiDaFuoco = state.armiDaFuoco.map(function (x) {
        return x.id === editing.id ? Object.assign({}, saved, { id: editing.id }) : x;
      });
    } else {
      state.armiDaFuoco.push(Object.assign({}, saved, { id: 'af_' + Date.now() }));
      state.armiDaFuocoSelectedId = state.armiDaFuoco[state.armiDaFuoco.length - 1].id;
    }
    fbSaveArmiFuoco();
    notify(editing ? 'Arma aggiornata.' : "Arma aggiunta all'arsenale.");
    state.armiDaFuocoShowForm = false;
    state.armiDaFuocoEditingId = null;
    renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}

function _renderArmiPotenziamenti() {
  var ACCENT = '#e53030';
  var outer = document.createElement('div');
  outer.style.cssText = 'flex:1;overflow-y:auto;padding:1.5rem 2rem;';
  var items = (state.potenziamenti || []).slice().sort(function (a, b) {
    return (a.nome || '').localeCompare(b.nome || '', 'it');
  });
  if (items.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem;color:rgba(229,48,48,0.3);font-size:18px;letter-spacing:0.1em;text-align:center;';
    empty.innerHTML =
      'NESSUN POTENZIAMENTO' +
      (isDM()
        ? '<div style="font-size:13px;margin-top:1rem;">> aggiungi il primo potenziamento</div>'
        : '');
    outer.appendChild(empty);
    return outer;
  }
  var grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;';
  items.forEach(function (p) {
    var card = document.createElement('div');
    card.style.cssText =
      'border:1px solid rgba(229,48,48,0.22);background:#0a0000;display:flex;flex-direction:column;overflow:hidden;transition:border-color 0.15s;';
    card.onmouseenter = function () {
      card.style.borderColor = ACCENT;
    };
    card.onmouseleave = function () {
      card.style.borderColor = 'rgba(229,48,48,0.22)';
    };
    var imgs = p.immagini && p.immagini.length ? p.immagini : p.immagine ? [p.immagine] : [];
    if (imgs.length > 0) {
      var imgBox = document.createElement('div');
      imgBox.style.cssText = 'height:130px;overflow:hidden;background:#040000;';
      var img = createContentImage();
      img.src = imgs[0];
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      imgBox.appendChild(img);
      card.appendChild(imgBox);
    }
    var body = document.createElement('div');
    body.style.cssText = 'padding:0.8rem;flex:1;display:flex;flex-direction:column;gap:0.35rem;';
    var nome = document.createElement('div');
    nome.style.cssText =
      "font-family:'Cinzel',serif;font-size:15px;font-weight:700;color:#ffcccc;letter-spacing:0.05em;";
    nome.textContent = p.nome || '?';
    body.appendChild(nome);
    if (p.costo) {
      var pr = document.createElement('div');
      pr.style.cssText = 'font-size:13px;color:' + ACCENT + ';font-weight:700;';
      pr.textContent = p.costo + ' ' + (p.valuta || 'mo');
      body.appendChild(pr);
    }
    if (p.prerequisiti) {
      var rq = document.createElement('div');
      rq.style.cssText = 'font-size:12px;color:rgba(229,48,48,0.5);font-style:italic;';
      rq.textContent = 'Req: ' + p.prerequisiti;
      body.appendChild(rq);
    }
    if (p.effetto) {
      var ef = document.createElement('div');
      ef.style.cssText =
        'font-size:13px;color:#ffb3b3;line-height:1.5;margin-top:0.2rem;flex:1;white-space:pre-wrap;';
      ef.textContent = p.effetto;
      body.appendChild(ef);
    }
    if (isAdmin()) {
      var br2 = document.createElement('div');
      br2.style.cssText =
        'display:flex;gap:0.4rem;margin-top:0.5rem;border-top:1px solid rgba(229,48,48,0.1);padding-top:0.5rem;';
      var eb2 = document.createElement('button');
      eb2.style.cssText =
        'flex:1;background:rgba(229,48,48,0.08);border:1px solid rgba(229,48,48,0.3);color:' +
        ACCENT +
        ";font-family:'Courier New',monospace;font-size:11px;padding:0.3rem;cursor:pointer;";
      eb2.textContent = '✎ MODIFICA';
      eb2.onclick = function () {
        state.potenziamentiEditingId = p.id;
        state.potenziamentiShowForm = true;
        renderMain();
      };
      var db3 = document.createElement('button');
      db3.style.cssText =
        "background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.3);color:#ff8080;font-family:'Courier New',monospace;font-size:11px;padding:0.3rem 0.5rem;cursor:pointer;";
      db3.textContent = '✕';
      db3.onclick = function () {
        if (confirm('Eliminare ' + escapeHtml(p.nome || 'questo potenziamento') + '?')) {
          state.potenziamenti = state.potenziamenti.filter(function (x) {
            return x.id !== p.id;
          });
          fbSavePotenziamentiArmi();
          renderMain();
        }
      };
      br2.appendChild(eb2);
      br2.appendChild(db3);
      body.appendChild(br2);
    }
    card.appendChild(body);
    grid.appendChild(card);
  });
  outer.appendChild(grid);
  return outer;
}

function _renderPotenziamentiForm() {
  var ACCENT = '#e53030';
  var editing = null;
  if (state.potenziamentiEditingId)
    (state.potenziamenti || []).forEach(function (x) {
      if (x.id === state.potenziamentiEditingId) editing = x;
    });
  var _ei = editing
    ? editing.immagini && editing.immagini.length
      ? editing.immagini.slice()
      : editing.immagine
        ? [editing.immagine]
        : []
    : [];
  var form = {
    nome: editing ? editing.nome : '',
    costo: editing ? editing.costo : 0,
    valuta: editing ? editing.valuta : 'mo',
    prerequisiti: editing ? editing.prerequisiti : '',
    effetto: editing ? editing.effetto : '',
    immagini: _ei,
  };
  var backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick = function (e) {
    if (e.target === backdrop) {
      state.potenziamentiShowForm = false;
      state.potenziamentiEditingId = null;
      renderMain();
    }
  };
  var panel = document.createElement('div');
  panel.style.cssText =
    'background:#0d0000;border:2px solid rgba(229,48,48,0.5);max-width:500px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick = function (e) {
    e.stopPropagation();
  };
  var mhead = document.createElement('div');
  mhead.style.cssText =
    'padding:1rem 1.5rem;border-bottom:1px solid rgba(229,48,48,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML =
    "<div style=\"font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:" +
    ACCENT +
    ';letter-spacing:0.1em;">' +
    (editing ? '✎ MODIFICA POTENZIAMENTO' : '⬡ NUOVO POTENZIAMENTO') +
    '</div>';
  var closeB = document.createElement('button');
  closeB.style.cssText =
    'background:none;border:none;color:' + ACCENT + ';font-size:20px;cursor:pointer;';
  closeB.textContent = '✕';
  closeB.onclick = function () {
    state.potenziamentiShowForm = false;
    state.potenziamentiEditingId = null;
    renderMain();
  };
  mhead.appendChild(closeB);
  panel.appendChild(mhead);
  var mbody = document.createElement('div');
  mbody.style.cssText = 'padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';
  var fStyle =
    "width:100%;background:#0d0000;border:1px solid rgba(229,48,48,0.35);color:#ffb3b3;font-family:'Courier New',monospace;font-size:14px;padding:0.5rem 0.75rem;outline:none;box-sizing:border-box;";
  function pField(lbl, key, type) {
    var g = document.createElement('div');
    var l = document.createElement('label');
    l.style.cssText =
      'display:block;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.65);margin-bottom:0.3rem;';
    l.textContent = '// ' + lbl;
    g.appendChild(l);
    var el;
    if (type === 'textarea') {
      el = document.createElement('textarea');
      el.style.cssText = fStyle + 'resize:vertical;';
      el.rows = 3;
      el.value = form[key];
    } else {
      el = document.createElement('input');
      el.type = type || 'text';
      el.style.cssText = fStyle;
      el.value = form[key];
    }
    el.onchange = el.oninput = function () {
      form[key] = type === 'number' ? Number(this.value) || 0 : this.value;
    };
    g.appendChild(el);
    return g;
  }
  mbody.appendChild(pField('NOME POTENZIAMENTO', 'nome', 'text'));
  var rCP = document.createElement('div');
  rCP.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  rCP.appendChild(pField('PREZZO', 'costo', 'number'));
  var gV = document.createElement('div');
  var lV = document.createElement('label');
  lV.style.cssText =
    'display:block;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.65);margin-bottom:0.3rem;';
  lV.textContent = '// VALUTA';
  gV.appendChild(lV);
  var selV = document.createElement('select');
  selV.style.cssText = fStyle + 'appearance:none;-webkit-appearance:none;cursor:pointer;';
  VALUTE.forEach(function (v) {
    var o = document.createElement('option');
    o.value = v.code;
    o.textContent = v.code;
    o.style.cssText = 'background:#0d0000;color:#ffb3b3;';
    if (form.valuta === v.code) o.selected = true;
    selV.appendChild(o);
  });
  selV.onchange = function () {
    form.valuta = this.value;
  };
  gV.appendChild(selV);
  rCP.appendChild(gV);
  mbody.appendChild(rCP);
  mbody.appendChild(pField('PREREQUISITI', 'prerequisiti', 'text'));
  mbody.appendChild(pField('EFFETTO', 'effetto', 'textarea'));
  var imgEditor = _buildVehicleImageEditor(form, ACCENT);
  mbody.appendChild(imgEditor);
  var saveBtn = document.createElement('button');
  saveBtn.style.cssText =
    'width:100%;background:rgba(229,48,48,0.12);border:2px solid ' +
    ACCENT +
    ';color:' +
    ACCENT +
    ";font-family:'Courier New',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;";
  saveBtn.textContent = editing ? '> SALVA MODIFICHE' : '> AGGIUNGI POTENZIAMENTO';
  saveBtn.onclick = function () {
    if (!form.nome.trim()) {
      notify('Inserisci il nome del potenziamento.', 'err');
      return;
    }
    var saved = Object.assign({}, form, { immagini: form.immagini || [] });
    delete saved.immagine;
    if (!state.potenziamenti) state.potenziamenti = [];
    if (editing) {
      state.potenziamenti = state.potenziamenti.map(function (x) {
        return x.id === editing.id ? Object.assign({}, saved, { id: editing.id }) : x;
      });
    } else {
      state.potenziamenti.push(Object.assign({}, saved, { id: 'pot_' + Date.now() }));
    }
    fbSavePotenziamentiArmi();
    notify(editing ? 'Potenziamento aggiornato.' : 'Potenziamento aggiunto.');
    state.potenziamentiShowForm = false;
    state.potenziamentiEditingId = null;
    renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}

function _renderArmiMunizioni() {
  var ACCENT = '#e53030';
  var outer = document.createElement('div');
  outer.style.cssText = 'flex:1;overflow-y:auto;padding:1.5rem 2rem;';
  var items = (state.munizioniArmi || []).slice().sort(function (a, b) {
    return (a.nome || '').localeCompare(b.nome || '', 'it');
  });
  if (items.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem;color:rgba(229,48,48,0.3);font-size:18px;letter-spacing:0.1em;text-align:center;';
    empty.innerHTML =
      'NESSUNA MUNIZIONE' +
      (isDM()
        ? '<div style="font-size:13px;margin-top:1rem;">> aggiungi le prime munizioni</div>'
        : '');
    outer.appendChild(empty);
    return outer;
  }
  var grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;';
  items.forEach(function (m) {
    var card = document.createElement('div');
    card.style.cssText =
      'border:1px solid rgba(229,48,48,0.22);background:#0a0000;padding:0.9rem;display:flex;flex-direction:column;gap:0.35rem;transition:border-color 0.15s;';
    card.onmouseenter = function () {
      card.style.borderColor = ACCENT;
    };
    card.onmouseleave = function () {
      card.style.borderColor = 'rgba(229,48,48,0.22)';
    };
    var nome = document.createElement('div');
    nome.style.cssText =
      "font-family:'Cinzel',serif;font-size:15px;font-weight:700;color:#ffcccc;letter-spacing:0.05em;";
    nome.textContent = m.nome || '?';
    card.appendChild(nome);
    if (m.costo) {
      var pr = document.createElement('div');
      pr.style.cssText = 'font-size:13px;color:' + ACCENT + ';font-weight:700;';
      pr.textContent = m.costo + ' ' + (m.valuta || 'mo');
      card.appendChild(pr);
    }
    if (m.effetto) {
      var ef = document.createElement('div');
      ef.style.cssText =
        'font-size:13px;color:#ffb3b3;line-height:1.5;margin-top:0.2rem;flex:1;white-space:pre-wrap;';
      ef.textContent = m.effetto;
      card.appendChild(ef);
    }
    if (isAdmin()) {
      var br3 = document.createElement('div');
      br3.style.cssText =
        'display:flex;gap:0.4rem;margin-top:0.5rem;border-top:1px solid rgba(229,48,48,0.1);padding-top:0.5rem;';
      var eb3 = document.createElement('button');
      eb3.style.cssText =
        'flex:1;background:rgba(229,48,48,0.08);border:1px solid rgba(229,48,48,0.3);color:' +
        ACCENT +
        ";font-family:'Courier New',monospace;font-size:11px;padding:0.3rem;cursor:pointer;";
      eb3.textContent = '✎ MODIFICA';
      eb3.onclick = function () {
        state.munizioniArmiEditingId = m.id;
        state.munizioniArmiShowForm = true;
        renderMain();
      };
      var db4 = document.createElement('button');
      db4.style.cssText =
        "background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.3);color:#ff8080;font-family:'Courier New',monospace;font-size:11px;padding:0.3rem 0.5rem;cursor:pointer;";
      db4.textContent = '✕';
      db4.onclick = function () {
        if (confirm('Eliminare ' + escapeHtml(m.nome || 'queste munizioni') + '?')) {
          state.munizioniArmi = state.munizioniArmi.filter(function (x) {
            return x.id !== m.id;
          });
          fbSaveMunizioniArmi();
          renderMain();
        }
      };
      br3.appendChild(eb3);
      br3.appendChild(db4);
      card.appendChild(br3);
    }
    grid.appendChild(card);
  });
  outer.appendChild(grid);
  return outer;
}

function _renderMunizioniArmiForm() {
  var ACCENT = '#e53030';
  var editing = null;
  if (state.munizioniArmiEditingId)
    (state.munizioniArmi || []).forEach(function (x) {
      if (x.id === state.munizioniArmiEditingId) editing = x;
    });
  var form = {
    nome: editing ? editing.nome : '',
    costo: editing ? editing.costo : 0,
    valuta: editing ? editing.valuta : 'mo',
    effetto: editing ? editing.effetto : '',
  };
  var backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick = function (e) {
    if (e.target === backdrop) {
      state.munizioniArmiShowForm = false;
      state.munizioniArmiEditingId = null;
      renderMain();
    }
  };
  var panel = document.createElement('div');
  panel.style.cssText =
    'background:#0d0000;border:2px solid rgba(229,48,48,0.5);max-width:460px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick = function (e) {
    e.stopPropagation();
  };
  var mhead = document.createElement('div');
  mhead.style.cssText =
    'padding:1rem 1.5rem;border-bottom:1px solid rgba(229,48,48,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML =
    "<div style=\"font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:" +
    ACCENT +
    ';letter-spacing:0.1em;">' +
    (editing ? '✎ MODIFICA MUNIZIONI' : '◉ NUOVE MUNIZIONI') +
    '</div>';
  var closeB = document.createElement('button');
  closeB.style.cssText =
    'background:none;border:none;color:' + ACCENT + ';font-size:20px;cursor:pointer;';
  closeB.textContent = '✕';
  closeB.onclick = function () {
    state.munizioniArmiShowForm = false;
    state.munizioniArmiEditingId = null;
    renderMain();
  };
  mhead.appendChild(closeB);
  panel.appendChild(mhead);
  var mbody = document.createElement('div');
  mbody.style.cssText = 'padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';
  var fStyle =
    "width:100%;background:#0d0000;border:1px solid rgba(229,48,48,0.35);color:#ffb3b3;font-family:'Courier New',monospace;font-size:14px;padding:0.5rem 0.75rem;outline:none;box-sizing:border-box;";
  function mField(lbl, key, type) {
    var g = document.createElement('div');
    var l = document.createElement('label');
    l.style.cssText =
      'display:block;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.65);margin-bottom:0.3rem;';
    l.textContent = '// ' + lbl;
    g.appendChild(l);
    var el;
    if (type === 'textarea') {
      el = document.createElement('textarea');
      el.style.cssText = fStyle + 'resize:vertical;';
      el.rows = 3;
      el.value = form[key];
    } else {
      el = document.createElement('input');
      el.type = type || 'text';
      el.style.cssText = fStyle;
      el.value = form[key];
    }
    el.onchange = el.oninput = function () {
      form[key] = type === 'number' ? Number(this.value) || 0 : this.value;
    };
    g.appendChild(el);
    return g;
  }
  mbody.appendChild(mField('NOME MUNIZIONI', 'nome', 'text'));
  var rCP2 = document.createElement('div');
  rCP2.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  rCP2.appendChild(mField('PREZZO', 'costo', 'number'));
  var gV2 = document.createElement('div');
  var lV2 = document.createElement('label');
  lV2.style.cssText =
    'display:block;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.65);margin-bottom:0.3rem;';
  lV2.textContent = '// VALUTA';
  gV2.appendChild(lV2);
  var selV2 = document.createElement('select');
  selV2.style.cssText = fStyle + 'appearance:none;-webkit-appearance:none;cursor:pointer;';
  VALUTE.forEach(function (v) {
    var o = document.createElement('option');
    o.value = v.code;
    o.textContent = v.code;
    o.style.cssText = 'background:#0d0000;color:#ffb3b3;';
    if (form.valuta === v.code) o.selected = true;
    selV2.appendChild(o);
  });
  selV2.onchange = function () {
    form.valuta = this.value;
  };
  gV2.appendChild(selV2);
  rCP2.appendChild(gV2);
  mbody.appendChild(rCP2);
  mbody.appendChild(mField('EFFETTO', 'effetto', 'textarea'));
  var saveBtn = document.createElement('button');
  saveBtn.style.cssText =
    'width:100%;background:rgba(229,48,48,0.12);border:2px solid ' +
    ACCENT +
    ';color:' +
    ACCENT +
    ";font-family:'Courier New',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;";
  saveBtn.textContent = editing ? '> SALVA MODIFICHE' : '> AGGIUNGI MUNIZIONI';
  saveBtn.onclick = function () {
    if (!form.nome.trim()) {
      notify('Inserisci il nome delle munizioni.', 'err');
      return;
    }
    var saved = Object.assign({}, form);
    if (!state.munizioniArmi) state.munizioniArmi = [];
    if (editing) {
      state.munizioniArmi = state.munizioniArmi.map(function (x) {
        return x.id === editing.id ? Object.assign({}, saved, { id: editing.id }) : x;
      });
    } else {
      state.munizioniArmi.push(Object.assign({}, saved, { id: 'mun_' + Date.now() }));
    }
    fbSaveMunizioniArmi();
    notify(editing ? 'Munizioni aggiornate.' : 'Munizioni aggiunte.');
    state.munizioniArmiShowForm = false;
    state.munizioniArmiEditingId = null;
    renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}
