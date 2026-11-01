var _shopOpen = false;
var _coinsOpen = false;

function _renderShopPanel(container) {
  container.innerHTML = '';
  var RC = {
    Comune: '#9a9a9a',
    'Non comune': '#40c060',
    Raro: '#4488ff',
    'Molto raro': '#aa44ff',
    Leggendario: '#ffa020',
    Artefatto: '#ff4444',
    Divino: '#ffe060',
    Unico: '#ff80c0',
  };

  /* ── Illustrazione SVG baracchino ── */
  var svgWrap = document.createElement('div');
  svgWrap.style.cssText =
    'width:100%;overflow:hidden;border-radius:10px 10px 0 0;background:#1a0e04;';
  svgWrap.innerHTML =
    '<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">' +
    /* cielo e pavimento */
    '<rect width="600" height="220" fill="#12080200"/>' +
    /* pali laterali */
    '<rect x="22" y="38" width="20" height="178" rx="5" fill="#3d2208"/><rect x="558" y="38" width="20" height="178" rx="5" fill="#3d2208"/>' +
    /* dorso banco */
    '<rect x="42" y="90" width="516" height="92" rx="4" fill="#2a1506"/>' +
    /* tendone principale – strisce alternanti */
    '<clipPath id="awClip"><path d="M20 34 H580 V90 Q560 102 540 90 Q520 78 500 90 Q480 102 460 90 Q440 78 420 90 Q400 102 380 90 Q360 78 340 90 Q320 102 300 90 Q280 78 260 90 Q240 102 220 90 Q200 78 180 90 Q160 102 140 90 Q120 78 100 90 Q80 102 60 90 Q40 78 20 90 Z"/></clipPath>' +
    '<rect x="20" y="34" width="560" height="56" fill="#7a3a0a" clip-path="url(#awClip)"/>' +
    '<rect x="20" y="34" width="560" height="56" fill="url(#awStripes)" clip-path="url(#awClip)"/>' +
    '<defs><pattern id="awStripes" x="0" y="0" width="60" height="56" patternUnits="userSpaceOnUse"><rect width="30" height="56" fill="#c9853a"/><rect x="30" width="30" height="56" fill="#7a3a0a"/></pattern></defs>' +
    /* bordo inferiore tendone ondulato */
    '<path d="M20 90 Q40 102 60 90 Q80 78 100 90 Q120 102 140 90 Q160 78 180 90 Q200 102 220 90 Q240 78 260 90 Q280 102 300 90 Q320 78 340 90 Q360 102 380 90 Q400 78 420 90 Q440 102 460 90 Q480 78 500 90 Q520 102 540 90 Q560 78 580 90 L580 96 Q560 108 540 96 Q520 84 500 96 Q480 108 460 96 Q440 84 420 96 Q400 108 380 96 Q360 84 340 96 Q320 108 300 96 Q280 84 260 96 Q240 108 220 96 Q200 84 180 96 Q160 108 140 96 Q120 84 100 96 Q80 108 60 96 Q40 84 20 96 Z" fill="#5a2808"/>' +
    /* corda in alto */
    '<line x1="20" y1="34" x2="580" y2="34" stroke="#5c3a1a" stroke-width="4"/>' +
    /* insegna appesa */
    '<line x1="258" y1="34" x2="252" y2="62" stroke="#5c3a1a" stroke-width="2"/><line x1="342" y1="34" x2="348" y2="62" stroke="#5c3a1a" stroke-width="2"/>' +
    '<rect x="242" y="58" width="116" height="32" rx="5" fill="#4a2a08" stroke="#c9a55c" stroke-width="1.5"/>' +
    '<text x="300" y="78" text-anchor="middle" font-family="serif" font-size="13" font-weight="bold" fill="#f0d070" letter-spacing="2">IL MERCANTE</text>' +
    /* bancone */
    '<rect x="42" y="158" width="516" height="14" rx="3" fill="#6b3d12"/><rect x="42" y="170" width="516" height="42" rx="3" fill="#4a2808"/><rect x="62" y="160" width="476" height="8" rx="2" fill="#8b5518"/>' +
    /* pozione viola */
    '<ellipse cx="120" cy="160" rx="14" ry="5" fill="#1a0a28"/><rect x="107" y="122" width="26" height="38" rx="10" fill="#7030c0"/><ellipse cx="120" cy="122" rx="13" ry="5" fill="#9050e0"/><rect x="116" y="114" width="8" height="10" rx="3" fill="#4a2808"/><ellipse cx="120" cy="160" rx="14" ry="3" fill="#50204080"/>' +
    /* pozione rossa */
    '<ellipse cx="165" cy="160" rx="14" ry="5" fill="#200808"/><rect x="152" y="124" width="26" height="36" rx="10" fill="#c02828"/><ellipse cx="165" cy="124" rx="13" ry="5" fill="#e04040"/><rect x="161" y="116" width="8" height="10" rx="3" fill="#4a2808"/>' +
    /* pozione verde */
    '<ellipse cx="210" cy="160" rx="12" ry="4" fill="#082008"/><rect x="199" y="128" width="22" height="32" rx="9" fill="#208020"/><ellipse cx="210" cy="128" rx="11" ry="4" fill="#30a030"/><rect x="207" y="121" width="6" height="9" rx="2" fill="#4a2808"/>' +
    /* rotolo */
    '<rect x="258" y="132" width="58" height="28" rx="3" fill="#e8d5a0"/><ellipse cx="258" cy="146" rx="8" ry="14" fill="#c8a860"/><ellipse cx="316" cy="146" rx="8" ry="14" fill="#c8a860"/><line x1="268" y1="138" x2="306" y2="138" stroke="#7a5030" stroke-width="1.2"/><line x1="268" y1="143" x2="306" y2="143" stroke="#7a5030" stroke-width="1.2"/><line x1="268" y1="148" x2="306" y2="148" stroke="#7a5030" stroke-width="1.2"/><line x1="268" y1="153" x2="306" y2="153" stroke="#7a5030" stroke-width="1.2"/>' +
    /* scrigno */
    '<rect x="360" y="126" width="60" height="34" rx="5" fill="#5c3a1a"/><rect x="360" y="126" width="60" height="13" rx="5" fill="#7a5030"/><rect x="382" y="121" width="16" height="9" rx="3" fill="#c9a55c"/><circle cx="390" cy="125" r="3" fill="#f0d070"/>' +
    /* spada */
    '<rect x="466" y="100" width="7" height="60" rx="2" fill="#c0c8d4"/><rect x="450" y="126" width="40" height="6" rx="2" fill="#c9a55c"/><ellipse cx="469" cy="100" rx="6" ry="8" fill="#e0d090"/><rect x="466" y="156" width="7" height="12" rx="3" fill="#9a7040"/>' +
    /* gemma */
    '<polygon points="528,120 545,130 538,148 518,148 511,130" fill="#30a0e8" stroke="#60c8ff" stroke-width="1.5"/><polygon points="528,120 545,130 536,128 522,128" fill="#60c8ff" opacity="0.6"/>' +
    /* lanterna sx */
    '<line x1="110" y1="34" x2="110" y2="66" stroke="#5c3a1a" stroke-width="2"/><rect x="100" y="66" width="20" height="28" rx="4" fill="#2a1506" stroke="#6b4c23" stroke-width="1"/><rect x="103" y="69" width="14" height="22" rx="2" fill="rgba(255,180,40,0.18)"/><circle cx="110" cy="80" r="6" fill="rgba(255,180,40,0.55)"/><ellipse cx="110" cy="94" rx="10" ry="3" fill="#2a1506"/>' +
    /* lanterna dx */
    '<line x1="490" y1="34" x2="490" y2="66" stroke="#5c3a1a" stroke-width="2"/><rect x="480" y="66" width="20" height="28" rx="4" fill="#2a1506" stroke="#6b4c23" stroke-width="1"/><rect x="483" y="69" width="14" height="22" rx="2" fill="rgba(255,180,40,0.18)"/><circle cx="490" cy="80" r="6" fill="rgba(255,180,40,0.55)"/><ellipse cx="490" cy="94" rx="10" ry="3" fill="#2a1506"/>' +
    /* sfondo ombre */
    '<rect x="42" y="90" width="516" height="68" fill="rgba(0,0,0,0.18)"/>' +
    '</svg>';
  container.appendChild(svgWrap);

  /* ── Controlli sotto il baracchino ── */
  var ctrl = document.createElement('div');
  ctrl.style.cssText =
    'padding:1.1rem 1.4rem;background:rgba(30,15,4,0.92);border:1px solid rgba(201,165,92,0.3);border-top:none;border-radius:0 0 10px 10px;display:flex;flex-wrap:wrap;align-items:center;gap:1rem;';

  /* Livello party — pills */
  var lvlLabel = document.createElement('span');
  lvlLabel.style.cssText =
    "font-family:'Cinzel',serif;font-size:11px;font-weight:700;letter-spacing:0.1em;color:rgba(201,165,92,0.65);white-space:nowrap;";
  lvlLabel.textContent = 'LIVELLO PARTY:';
  ctrl.appendChild(lvlLabel);

  var lvlBands = [
    { label: '1–5', min: 1, max: 5 },
    { label: '6–10', min: 6, max: 10 },
    { label: '11–15', min: 11, max: 15 },
    { label: '16–20', min: 16, max: 20 },
  ];
  var curLvl = state.shopFilter.livello || 5;
  lvlBands.forEach(function (b) {
    var isA = curLvl >= b.min && curLvl <= b.max;
    var btn = document.createElement('button');
    btn.textContent = b.label;
    btn.style.cssText =
      "font-family:'Cinzel',serif;font-size:11px;font-weight:700;padding:0.3rem 0.85rem;border-radius:20px;cursor:pointer;transition:all 0.15s;" +
      'border:1.5px solid ' +
      (isA ? '#f5a623' : 'rgba(201,165,92,0.3)') +
      ';' +
      'background:' +
      (isA ? 'rgba(245,166,35,0.2)' : 'rgba(18,10,2,0.7)') +
      ';' +
      'color:' +
      (isA ? '#f5c842' : 'rgba(201,165,92,0.55)') +
      ';' +
      'box-shadow:' +
      (isA ? '0 0 8px rgba(245,166,35,0.3)' : 'none') +
      ';';
    btn.onclick = function () {
      state.shopFilter.livello = Math.round((b.min + b.max) / 2);
      _renderShopPanel(container);
    };
    ctrl.appendChild(btn);
  });

  /* Pulsante genera */
  var genBtn = document.createElement('button');
  genBtn.style.cssText =
    "margin-left:auto;font-family:'Cinzel',serif;font-size:12px;font-weight:700;letter-spacing:0.1em;padding:0.5rem 1.6rem;border-radius:6px;cursor:pointer;background:rgba(201,165,92,0.18);border:1.5px solid #f5a623;color:#f5c842;box-shadow:0 0 12px rgba(245,166,35,0.2);transition:all 0.15s;";
  genBtn.textContent = '✨ Apri il Negozio';
  genBtn.onmouseenter = function () {
    genBtn.style.background = 'rgba(201,165,92,0.3)';
  };
  genBtn.onmouseleave = function () {
    genBtn.style.background = 'rgba(201,165,92,0.18)';
  };
  ctrl.appendChild(genBtn);
  container.appendChild(ctrl);

  /* ── Lista oggetti generati ── */
  var listEl = document.createElement('div');
  listEl.style.cssText =
    'margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.55rem;';
  container.appendChild(listEl);

  genBtn.onclick = function () {
    _generateShop(listEl, RC);
  };
}

function _generateShop(listEl, RC) {
  listEl.innerHTML = '';
  var lvl = state.shopFilter.livello || 5;

  /* Pesi rarità scalati per banda di livello */
  var W;
  if (lvl <= 5)
    W = {
      Comune: 42,
      'Non comune': 30,
      Raro: 15,
      'Molto raro': 7,
      Leggendario: 4,
      Artefatto: 1,
      Divino: 1,
      Unico: 0,
    };
  else if (lvl <= 10)
    W = {
      Comune: 20,
      'Non comune': 25,
      Raro: 30,
      'Molto raro': 15,
      Leggendario: 6,
      Artefatto: 1,
      Divino: 2,
      Unico: 1,
    };
  else if (lvl <= 15)
    W = {
      Comune: 10,
      'Non comune': 14,
      Raro: 20,
      'Molto raro': 32,
      Leggendario: 14,
      Artefatto: 3,
      Divino: 4,
      Unico: 3,
    };
  else
    W = {
      Comune: 5,
      'Non comune': 8,
      Raro: 12,
      'Molto raro': 20,
      Leggendario: 28,
      Artefatto: 7,
      Divino: 12,
      Unico: 8,
    };

  /* Solo oggetti dell'emporio */
  var pool =
    typeof SRD_OGGETTI !== 'undefined'
      ? SRD_OGGETTI.filter(function (o) {
          return o && o.nome;
        })
      : [];

  /* Pesca pesata — esattamente 10 oggetti unici */
  var totalW = 0;
  for (var k in W) totalW += W[k];
  var picked = [],
    attempts = 0;
  while (picked.length < 10 && attempts < 400) {
    attempts++;
    var r = Math.random() * totalW,
      cum = 0,
      tRar = 'Comune';
    for (var rk in W) {
      cum += W[rk];
      if (r < cum) {
        tRar = rk;
        break;
      }
    }
    var sub = pool.filter(function (o) {
      return (o.rarita || 'Comune') === tRar;
    });
    if (!sub.length) sub = pool;
    var pick = sub[Math.floor(Math.random() * sub.length)];
    if (
      !picked.some(function (p) {
        return p.nome === pick.nome;
      })
    )
      picked.push(pick);
  }

  if (!picked.length) {
    listEl.innerHTML =
      '<div style="color:var(--text-faint);font-size:12px;padding:1rem;">Nessun oggetto trovato.</div>';
    return;
  }

  /* Ordina: dalla rarità più alta alla più bassa */
  var rarOrder = {
    Divino: 0,
    Unico: 1,
    Artefatto: 2,
    Leggendario: 3,
    'Molto raro': 4,
    Raro: 5,
    'Non comune': 6,
    Comune: 7,
  };
  picked.sort(function (a, b) {
    return (rarOrder[a.rarita] || 7) - (rarOrder[b.rarita] || 7);
  });

  picked.forEach(function (item) {
    var rc = RC[item.rarita] || '#9a9a9a';
    var isDivine =
      item.rarita === 'Divino' || item.rarita === 'Unico' || item.rarita === 'Artefatto';
    var card = document.createElement('div');
    card.style.cssText =
      'padding:0.65rem 0.8rem;border-radius:6px;cursor:default;transition:all 0.15s;' +
      'background:rgba(20,12,3,0.85);' +
      'border:1px solid ' +
      (isDivine ? rc : 'rgba(201,165,92,0.18)') +
      ';' +
      (isDivine ? 'box-shadow:0 0 10px ' + rc + '40;' : '');

    /* Nome + rarità */
    var topRow = document.createElement('div');
    topRow.style.cssText =
      'display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;margin-bottom:0.3rem;';
    var nameEl = document.createElement('div');
    nameEl.style.cssText =
      "font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:" +
      (isDivine ? rc : 'var(--text-main)') +
      ';flex:1;' +
      (isDivine ? 'text-shadow:0 0 8px ' + rc + '80;' : '');
    nameEl.textContent = item.nome;
    var rarEl = document.createElement('span');
    rarEl.style.cssText =
      "font-size:9px;font-family:'Cinzel',serif;font-weight:700;letter-spacing:0.07em;color:" +
      rc +
      ';border:1px solid ' +
      rc +
      '60;padding:0.1rem 0.4rem;border-radius:10px;white-space:nowrap;background:' +
      rc +
      '12;';
    rarEl.textContent = item.rarita || 'Comune';
    topRow.appendChild(nameEl);
    topRow.appendChild(rarEl);
    card.appendChild(topRow);

    /* Tipo + prezzo */
    var metaRow = document.createElement('div');
    metaRow.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;gap:0.5rem;';
    var tipoEl = document.createElement('span');
    tipoEl.style.cssText = 'font-size:9px;color:var(--text-faint);font-style:italic;';
    tipoEl.textContent = item.tipo || '';
    var priceEl = document.createElement('span');
    priceEl.style.cssText =
      "font-size:10px;color:var(--gold-dim);font-family:'Cinzel',serif;white-space:nowrap;";
    priceEl.textContent = item.prezzo
      ? item.prezzo.toLocaleString('it-IT') + ' ' + (item.valuta || 'mo').toUpperCase()
      : isDivine
        ? '∞ — Impagabile'
        : '';
    metaRow.appendChild(tipoEl);
    metaRow.appendChild(priceEl);
    card.appendChild(metaRow);

    /* Descrizione */
    if (item.descrizione) {
      var desc = document.createElement('div');
      desc.style.cssText =
        'font-size:10px;color:var(--text-faint);margin-top:0.35rem;line-height:1.4;border-top:1px solid rgba(201,165,92,0.1);padding-top:0.3rem;';
      desc.textContent =
        item.descrizione.length > 120 ? item.descrizione.slice(0, 120) + '…' : item.descrizione;
      card.appendChild(desc);
    }

    card.appendChild(buildCommerceItemAction(item, 'emporio'));
    listEl.appendChild(card);
  });
}

function _renderCoinsPanel(container) {
  container.innerHTML = '';
  var COINS = [
    { key: 'mp', label: 'Platino (MP)', short: 'MP', color: '#d0e8ff', rate: 1000 },
    { key: 'mo', label: 'Oro (MO)', short: 'MO', color: '#f5c842', rate: 100 },
    { key: 'ma', label: 'Argento (MA)', short: 'MA', color: '#c0c8d0', rate: 10 },
    { key: 'mr', label: 'Rame (MR)', short: 'MR', color: '#e0926a', rate: 1 },
  ];

  var hdr = document.createElement('div');
  hdr.style.cssText =
    "font-family:'Cinzel',serif;font-size:14px;font-weight:700;color:var(--gold-bright);letter-spacing:0.12em;margin-bottom:1rem;";
  hdr.textContent = '💰 Convertitore Monete';
  container.appendChild(hdr);

  /* ── riga FROM ── */
  var rowFrom = document.createElement('div');
  rowFrom.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;';

  var amtInp = document.createElement('input');
  amtInp.type = 'number';
  amtInp.min = '0';
  amtInp.value = '1';
  amtInp.style.cssText =
    "flex:1;background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-main);font-size:16px;font-family:'Cinzel',serif;padding:0.45rem 0.6rem;border-radius:6px;outline:none;text-align:right;min-width:0;";

  var selFrom = document.createElement('select');
  selFrom.style.cssText =
    "background:var(--bg-card);border:1px solid var(--border-gold);color:var(--gold);font-family:'Cinzel',serif;font-size:12px;padding:0.45rem 0.4rem;border-radius:6px;cursor:pointer;outline:none;";
  COINS.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.key;
    o.textContent = c.label;
    selFrom.appendChild(o);
  });
  selFrom.value = 'mo';

  rowFrom.appendChild(amtInp);
  rowFrom.appendChild(selFrom);
  container.appendChild(rowFrom);

  /* ── pulsante swap ── */
  var swapRow = document.createElement('div');
  swapRow.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;';

  var swapBtn = document.createElement('button');
  swapBtn.textContent = '⇅ Scambia';
  swapBtn.style.cssText =
    "font-family:'Cinzel',serif;font-size:11px;padding:0.3rem 0.9rem;border-radius:20px;border:1px solid var(--border-gold);background:rgba(201,165,92,0.1);color:var(--gold);cursor:pointer;";
  swapBtn.onclick = function () {
    var tmp = selFrom.value;
    selFrom.value = selTo.value;
    selTo.value = tmp;
    calcConvert();
  };

  var arrowEl = document.createElement('div');
  arrowEl.style.cssText = 'flex:1;text-align:center;font-size:18px;color:rgba(201,165,92,0.5);';
  arrowEl.textContent = '↓';

  swapRow.appendChild(swapBtn);
  swapRow.appendChild(arrowEl);
  container.appendChild(swapRow);

  /* ── riga TO ── */
  var rowTo = document.createElement('div');
  rowTo.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-bottom:1rem;';

  var resultEl = document.createElement('div');
  resultEl.style.cssText =
    "flex:1;background:rgba(201,165,92,0.07);border:1px solid var(--border-gold);color:var(--gold-bright);font-family:'Cinzel',serif;font-size:16px;padding:0.45rem 0.6rem;border-radius:6px;text-align:right;min-width:0;letter-spacing:0.03em;";
  resultEl.textContent = '—';

  var selTo = document.createElement('select');
  selTo.style.cssText = selFrom.style.cssText;
  COINS.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.key;
    o.textContent = c.label;
    selTo.appendChild(o);
  });
  selTo.value = 'mr';

  rowTo.appendChild(resultEl);
  rowTo.appendChild(selTo);
  container.appendChild(rowTo);

  /* ── calcolo ── */
  function calcConvert() {
    var amt = parseFloat(amtInp.value) || 0;
    var fromC = COINS.find(function (c) {
      return c.key === selFrom.value;
    });
    var toC = COINS.find(function (c) {
      return c.key === selTo.value;
    });
    if (!fromC || !toC) return;
    var inMR = amt * fromC.rate;
    var res = inMR / toC.rate;
    var txt =
      res % 1 === 0
        ? res.toLocaleString('it-IT')
        : res.toLocaleString('it-IT', { maximumFractionDigits: 4 });
    resultEl.textContent = txt + ' ' + toC.short;
    resultEl.style.color = toC.color;
  }

  amtInp.oninput = calcConvert;
  selFrom.onchange = calcConvert;
  selTo.onchange = calcConvert;
  calcConvert();

  /* ── separatore ── */
  var sep = document.createElement('div');
  sep.style.cssText =
    "border-top:1px solid rgba(201,165,92,0.2);margin-bottom:0.8rem;padding-top:0.8rem;font-family:'Cinzel',serif;font-size:10px;color:rgba(201,165,92,0.45);letter-spacing:0.12em;";
  sep.textContent = 'TASSI DI CAMBIO: 1 MP = 10 MO = 100 MA = 1000 MR';
  container.appendChild(sep);
}
