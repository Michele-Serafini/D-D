/* ============================================================
   SCHEDE ALTERNATIVE (7th Sea)
   ============================================================ */

var SHEET_DEFS = {
  '7thsea': {
    label: '7th Sea',
    thumbnail: 'schede/7th_sea.webp',
    pages: ['schede/7th_sea.webp'],
    pageLabels: ['Scheda'],
  },
};

/* ============================================================
   SCHEDE ALTERNATIVE — campi fissi sovrapposti all'immagine
   ============================================================ */

function _sf(key, tp, l, t, w, h) {
  return { key: key, tp: tp, l: l, t: t, w: w, h: h || null };
}

var SHEET_FIELDS = (function () {
  var f = {};

  /* ---- 7th Sea (1 pagina) ---- */
  f['7thsea'] = {
    0: [
      _sf('eroe', 'i', '38%', '5.1%', '57%'),
      _sf('nazione', 'i', '38%', '8.4%', '57%'),
      _sf('concetto', 'i', '38%', '11.7%', '57%'),
      _sf('vig_att', 'i', '3.5%', '18.8%', '8%'),
      _sf('vig_max', 'i', '13%', '18.8%', '7%'),
      _sf('gra_att', 'i', '3.5%', '26.3%', '8%'),
      _sf('gra_max', 'i', '13%', '26.3%', '7%'),
      _sf('ris_att', 'i', '3.5%', '33.8%', '8%'),
      _sf('ris_max', 'i', '13%', '33.8%', '7%'),
      _sf('acu_att', 'i', '3.5%', '41.3%', '8%'),
      _sf('acu_max', 'i', '13%', '41.3%', '7%'),
      _sf('pan_att', 'i', '3.5%', '48.8%', '8%'),
      _sf('pan_max', 'i', '13%', '48.8%', '7%'),
      _sf('ricchezza', 'i', '53%', '16%', '8%'),
      _sf('fama', 'a', '27%', '19%', '29%', '10.5%'),
      _sf('background', 'a', '62%', '14.5%', '35%', '20%'),
      _sf('vantaggi', 'a', '27%', '30.5%', '29%', '23%'),
      _sf('s_titolo', 'i', '63%', '30.5%', '34%'),
      _sf('s_scopo', 'i', '63%', '33.5%', '34%'),
      _sf('s_ricompensa', 'i', '63%', '38.5%', '34%'),
      _sf('s_atto', 'i', '63%', '41.5%', '34%'),
      _sf('virtu', 'i', '63%', '47.5%', '34%'),
      _sf('hubris', 'i', '63%', '51.5%', '34%'),
      _sf('sk_allettare', 'i', '15%', '57.3%', '6%'),
      _sf('sk_adguerra', 'i', '15%', '59.1%', '6%'),
      _sf('sk_atletica', 'i', '15%', '60.9%', '6%'),
      _sf('sk_cavalcare', 'i', '15%', '62.7%', '6%'),
      _sf('sk_convincere', 'i', '15%', '64.5%', '6%'),
      _sf('sk_empatia', 'i', '15%', '66.3%', '6%'),
      _sf('sk_esibirsi', 'i', '15%', '68.1%', '6%'),
      _sf('sk_furto', 'i', '15%', '69.9%', '6%'),
      _sf('sk_intimidire', 'i', '15%', '71.7%', '6%'),
      _sf('sk_istruzione', 'i', '15%', '73.5%', '6%'),
      _sf('sk_mira', 'i', '15%', '75.3%', '6%'),
      _sf('sk_mischia', 'i', '15%', '77.1%', '6%'),
      _sf('sk_nascond', 'i', '15%', '78.9%', '6%'),
      _sf('sk_navigaz', 'i', '15%', '80.7%', '6%'),
      _sf('sk_notare', 'i', '15%', '82.5%', '6%'),
      _sf('sk_rissa', 'i', '15%', '84.3%', '6%'),
      _sf('punti_eroe', 'i', '12.5%', '96%', '8%'),
    ],
  };

  return f;
})();

/* Renderizza una scheda alternativa con campi fissi sovrapposti all'immagine */
/* ============================================================
   7TH SEA — scheda HTML custom
   ============================================================ */
function _render7thSeaSheet() {
  var _dm = state.schedePGViewMode;
  var s = state.scheda;

  function gv(k, d) {
    return s[k] !== undefined ? s[k] : d !== undefined ? d : '';
  }
  function sv(k, v) {
    if (!_dm) {
      s[k] = v;
      fbSaveScheda();
    }
  }

  /* input testo */
  function _inp(key, ph, light) {
    var el = document.createElement('input');
    el.type = 'text';
    el.value = gv(key);
    el.placeholder = ph || '';
    el.readOnly = _dm;
    var col = light ? '#f0e8c8' : '#1a1a0a';
    var bc = light ? 'rgba(201,165,92,0.7)' : 'rgba(28,58,92,0.45)';
    el.style.cssText =
      'width:100%;border:none;border-bottom:1px solid ' +
      bc +
      ';background:transparent;font-size:14px;font-family:Arial,sans-serif;padding:3px 4px;outline:none;color:' +
      col +
      ';box-sizing:border-box;';
    el.oninput = function () {
      sv(key, this.value);
    };
    return el;
  }
  /* textarea */
  function _ta(key, rows) {
    var el = document.createElement('textarea');
    el.value = gv(key);
    el.rows = rows || 3;
    el.readOnly = _dm;
    el.style.cssText =
      'width:100%;border:1px solid rgba(28,58,92,0.25);background:rgba(255,255,255,0.18);font-size:13px;font-family:Arial,sans-serif;padding:4px;outline:none;color:#1a1a0a;resize:vertical;box-sizing:border-box;line-height:1.5;';
    el.oninput = function () {
      sv(key, this.value);
    };
    return el;
  }
  /* numero */
  function _num(key, mn, mx, d) {
    var el = document.createElement('input');
    el.type = 'number';
    el.min = mn || 0;
    el.max = mx || 5;
    el.value = gv(key, d || 0);
    el.readOnly = _dm;
    el.style.cssText =
      "width:64px;border:2px solid #c9a55c;border-radius:4px;background:rgba(255,255,255,0.35);font-size:26px;font-weight:900;font-family:'Cinzel',serif;padding:2px 0;outline:none;color:#0d2440;text-align:center;box-sizing:border-box;-moz-appearance:textfield;";
    el.oninput = function () {
      sv(key, parseInt(this.value) || 0);
    };
    return el;
  }
  /* header sezione */
  function _hdr(txt) {
    var d = document.createElement('div');
    d.style.cssText =
      "background:linear-gradient(90deg,#081828,#0d2440,#081828);color:#c9a55c;font-family:'Cinzel',serif;font-size:12px;font-weight:700;letter-spacing:0.12em;text-align:center;padding:5px 6px;text-transform:uppercase;";
    d.textContent = txt;
    return d;
  }
  /* block container */
  function _blk(hdrTxt) {
    var b = document.createElement('div');
    b.style.cssText =
      'border:1px solid rgba(201,165,92,0.3);border-radius:3px;overflow:hidden;background:rgba(240,232,200,0.45);backdrop-filter:blur(2px);';
    b.appendChild(_hdr(hdrTxt));
    var inn = document.createElement('div');
    inn.style.cssText = 'padding:5px;';
    b.appendChild(inn);
    b._i = inn;
    return b;
  }
  /* pallini */
  function _dots(key, max, sz) {
    sz = sz || 14;
    var c = document.createElement('span');
    c.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';
    function rf() {
      c.innerHTML = '';
      var v = parseInt(s[key]) || 0;
      for (var i = 1; i <= max; i++) {
        (function (n) {
          var d = document.createElement('span');
          d.style.cssText =
            'display:inline-block;width:' +
            sz +
            'px;height:' +
            sz +
            'px;border-radius:50%;border:2px solid #0d2440;cursor:' +
            (_dm ? 'default' : 'pointer') +
            ';background:' +
            (n <= v ? '#0d2440' : 'transparent') +
            ';box-sizing:border-box;flex-shrink:0;transition:background .15s;';
          if (!_dm)
            d.onclick = function () {
              s[key] = n === (parseInt(s[key]) || 0) ? n - 1 : n;
              fbSaveScheda();
              rf();
            };
          c.appendChild(d);
        })(i);
      }
    }
    rf();
    return c;
  }

  /* ===================== SPIRALE DELLA MORTE — immagine + click-to-place X ===================== */
  function _buildSpiral(container) {
    container.innerHTML = '';

    var marks = [];
    try {
      marks = JSON.parse(s.xMarks || '[]');
    } catch (e) {
      marks = [];
    }

    var outerWrap = document.createElement('div');
    outerWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    var wr = document.createElement('div');
    wr.style.cssText = 'position:relative;width:100%;padding-top:63.93%;user-select:none;';
    var img = document.createElement('img');
    img.src = 'schede/spirale_morte.png';
    img.draggable = false;
    img.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;';
    wr.appendChild(img);

    function addXEl(i, m) {
      var x = document.createElement('div');
      x.style.cssText =
        'position:absolute;left:' +
        m[0] +
        '%;top:' +
        m[1] +
        '%;' +
        'transform:translate(-50%,-50%);pointer-events:auto;' +
        'color:#c0392b;font-size:1.7em;font-weight:900;line-height:1;' +
        'text-shadow:1px 1px 2px #000,-1px -1px 2px #000;' +
        'cursor:' +
        (_dm ? 'default' : 'pointer') +
        ';';
      x.textContent = '✕';
      if (!_dm) {
        x.title = 'Clicca per rimuovere';
        x.addEventListener('click', function (e) {
          e.stopPropagation();
          marks.splice(i, 1);
          s.xMarks = JSON.stringify(marks);
          fbSaveScheda();
          _buildSpiral(container);
        });
      }
      wr.appendChild(x);
    }
    marks.forEach(function (m, i) {
      addXEl(i, m);
    });

    outerWrap.appendChild(wr);

    if (!_dm) {
      var placing = false;
      var panel = document.createElement('div');
      panel.style.cssText =
        'display:flex;align-items:center;gap:8px;padding:4px 2px;flex-wrap:wrap;';

      var btn = document.createElement('button');
      btn.textContent = '✕ Posiziona X';
      btn.style.cssText =
        'background:#2a1010;border:1px solid #c04040;color:#f08080;' +
        "border-radius:3px;padding:0.3rem 0.8rem;cursor:pointer;font-size:12px;font-family:'Cinzel',serif;";
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        placing = !placing;
        btn.style.background = placing ? '#6a1010' : '#2a1010';
        btn.textContent = placing ? '✕ Clicca sulla spirale...' : '✕ Posiziona X';
        wr.style.cursor = placing ? 'crosshair' : '';
      });
      panel.appendChild(btn);

      var clrBtn = document.createElement('button');
      clrBtn.textContent = 'Cancella tutte';
      clrBtn.style.cssText =
        'background:transparent;border:1px solid rgba(180,120,60,0.4);' +
        'color:#c9a55c;border-radius:3px;padding:0.3rem 0.6rem;cursor:pointer;font-size:11px;' +
        "font-family:'Cinzel',serif;display:" +
        (marks.length ? '' : 'none') +
        ';';
      clrBtn.addEventListener('click', function () {
        s.xMarks = '[]';
        fbSaveScheda();
        _buildSpiral(container);
      });
      panel.appendChild(clrBtn);

      wr.addEventListener('click', function (e) {
        if (!placing) return;
        var rect = wr.getBoundingClientRect();
        var m = [
          +(((e.clientX - rect.left) / rect.width) * 100).toFixed(1),
          +(((e.clientY - rect.top) / rect.height) * 100).toFixed(1),
        ];
        marks.push(m);
        s.xMarks = JSON.stringify(marks);
        fbSaveScheda();
        addXEl(marks.length - 1, m);
        clrBtn.style.display = '';
      });

      outerWrap.appendChild(panel);
    }

    container.appendChild(outerWrap);
  }

  /* ========================= RENDER ========================= */
  var wrap = document.createElement('div');
  wrap.style.cssText = 'min-height:100vh;display:flex;flex-direction:column;background:#2a2a3a;';

  /* NAV */
  var nav = document.createElement('div');
  nav.style.cssText =
    'background:#060e1c;border-bottom:2px solid #c9a55c;padding:0.45rem 1rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;position:sticky;top:0;z-index:50;';
  var bk = document.createElement('button');
  bk.textContent = '← Indietro';
  bk.style.cssText =
    "background:#0d2440;border:1px solid #c9a55c;color:#c9a55c;border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-size:12px;font-family:'Cinzel',serif;";
  bk.onclick = function () {
    if (_dm) {
      state.schedePGViewMode = false;
      state.schedePGOpenChar = null;
      state.schedaAttivaId = null;
      state.scheda = {};
      state.companions = {};
    } else {
      state.schedaAttivaId = null;
    }
    renderMain();
  };
  nav.appendChild(bk);
  var nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.value = s.nome || '';
  nameInp.placeholder = 'Nome personaggio';
  nameInp.readOnly = _dm;
  nameInp.style.cssText =
    "flex:1;min-width:0;background:transparent;border:none;border-bottom:1px solid #c9a55c;color:#f0e4cc;font-family:'Cinzel',serif;font-size:16px;font-weight:700;outline:none;padding:0.2rem 0.4rem;";
  nameInp.oninput = function () {
    sv('nome', this.value);
  };
  nav.appendChild(nameInp);
  if (!_dm) {
    var delB = document.createElement('button');
    delB.textContent = '🗑 Elimina';
    delB.style.cssText =
      "background:#4a1010;border:1px solid #c04040;color:#f08080;border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-size:12px;font-family:'Cinzel',serif;";
    delB.onclick = function () {
      if (
        !confirm('Eliminare "' + (s.nome || s.eroe || s.nomePersonaggio || 'questa scheda') + '"?')
      )
        return;
      var did = state.schedaAttivaId;
      state.schedeList = state.schedeList.filter(function (x) {
        return x.id !== did;
      });
      fbDeleteSchedaItem(did);
      state.schedaAttivaId = null;
      state.scheda = {};
      renderMain();
    };
    nav.appendChild(delB);
  }
  if (_dm) {
    var badge = document.createElement('span');
    badge.textContent = '⚔ Vista Master — sola lettura';
    badge.style.cssText =
      'font-size:11px;color:#c9a55c;background:rgba(201,165,92,0.1);border:1px solid rgba(201,165,92,0.3);border-radius:3px;padding:0.2rem 0.6rem;';
    nav.appendChild(badge);
  }
  wrap.appendChild(nav);

  /* SHEET OUTER */
  var outer = document.createElement('div');
  outer.style.cssText = 'flex:1;overflow-y:auto;padding:1rem;display:flex;justify-content:center;';
  var sheet = document.createElement('div');
  sheet.style.cssText =
    "width:100%;max-width:980px;position:relative;overflow:hidden;font-family:'Cinzel',serif;" +
    'background:radial-gradient(ellipse at 20% 30%,#f5ead5 0%,#ecdcc0 40%,#e5d0aa 70%,#dcc8a0 100%);' +
    'border:3px solid #0d2440;box-shadow:0 8px 40px rgba(0,0,0,0.8),inset 0 0 60px rgba(0,0,0,0.05);';

  /* watermark ancora */
  var wm = document.createElement('div');
  wm.style.cssText =
    'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:300px;opacity:0.025;pointer-events:none;z-index:0;user-select:none;line-height:1;';
  wm.textContent = '⚓';
  sheet.appendChild(wm);
  /* bordo dorato interno */
  var ib = document.createElement('div');
  ib.style.cssText =
    'position:absolute;inset:5px;border:1px solid rgba(201,165,92,0.25);pointer-events:none;z-index:0;';
  sheet.appendChild(ib);

  /* ===== HEADER (logo + campi, NO ritratto) ===== */
  var topHdr = document.createElement('div');
  topHdr.style.cssText =
    'background:linear-gradient(180deg,#020a14 0%,#060e1c 50%,#0a1828 100%);padding:10px 14px;display:flex;align-items:center;gap:14px;border-bottom:3px solid #c9a55c;position:relative;z-index:1;';

  /* logo */
  var logoD = document.createElement('div');
  logoD.style.cssText =
    'display:flex;flex-direction:column;align-items:center;min-width:100px;gap:1px;';
  var l1 = document.createElement('div');
  l1.style.cssText =
    "font-family:'Cinzel',serif;font-size:30px;font-weight:900;color:#c9a55c;letter-spacing:0.03em;line-height:1;text-shadow:0 0 15px rgba(201,165,92,0.6),2px 2px 5px rgba(0,0,0,0.9);";
  l1.innerHTML = '7<sup style="font-size:15px;vertical-align:super;letter-spacing:0">TH</sup>';
  var l2 = document.createElement('div');
  l2.style.cssText =
    "font-family:'Cinzel',serif;font-size:24px;font-weight:900;color:#c9a55c;letter-spacing:0.2em;text-shadow:0 0 15px rgba(201,165,92,0.6);";
  l2.textContent = 'SEA';
  var l3 = document.createElement('div');
  l3.style.cssText = 'font-size:18px;color:rgba(201,165,92,0.6);margin-top:2px;';
  l3.textContent = '⚓';
  logoD.appendChild(l1);
  logoD.appendChild(l2);
  logoD.appendChild(l3);
  topHdr.appendChild(logoD);

  /* campi header */
  var hFlds = document.createElement('div');
  hFlds.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:9px;';
  [
    ['eroe', 'EROE'],
    ['nazione', 'NAZIONE'],
    ['concetto', 'CONCETTO'],
  ].forEach(function (p) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    var lbl = document.createElement('span');
    lbl.style.cssText =
      'color:#c9a55c;font-size:11px;font-weight:700;letter-spacing:0.12em;min-width:80px;text-align:right;';
    lbl.textContent = p[1];
    row.appendChild(lbl);
    var inp = _inp(p[0], '', true);
    row.appendChild(inp);
    hFlds.appendChild(row);
  });
  topHdr.appendChild(hFlds);
  sheet.appendChild(topHdr);

  /* ===== CORPO: [ritratto+attributi] [col2] [col3] ===== */
  var body = document.createElement('div');
  body.style.cssText =
    'display:grid;grid-template-columns:210px 1fr 1fr;gap:8px;padding:8px;position:relative;z-index:1;';

  /* COL 1 — Ritratto + Attributi */
  var col1 = document.createElement('div');
  col1.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  /* ---- Ritratto ---- */
  var portraitBlk = _blk('Ritratto');
  var portrait = document.createElement('div');
  portrait.style.cssText =
    'width:100%;height:220px;background:#020a14;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;cursor:' +
    (_dm ? 'default' : 'pointer') +
    ';box-shadow:inset 0 0 12px rgba(0,0,0,0.7);';
  if (s.portrait) {
    var pImg = document.createElement('img');
    pImg.src = s.portrait;
    pImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    portrait.appendChild(pImg);
  } else {
    portrait.innerHTML =
      '<div style="text-align:center;color:rgba(201,165,92,0.5);font-size:13px;font-family:Cinzel,serif;line-height:2;"><div style="font-size:44px;">🖼</div>Immagine<br>Personaggio</div>';
  }
  if (!_dm) {
    var fi = document.createElement('input');
    fi.type = 'file';
    fi.accept = 'image/*';
    fi.style.display = 'none';
    fi.onchange = function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function (ev) {
        var im = new Image();
        im.onload = function () {
          var cv = document.createElement('canvas');
          cv.width = 200;
          cv.height = 260;
          cv.getContext('2d').drawImage(im, 0, 0, 200, 260);
          sv('portrait', cv.toDataURL('image/jpeg', 0.8));
          renderMain();
        };
        im.src = ev.target.result;
      };
      rd.readAsDataURL(f);
    };
    portrait.onclick = function () {
      fi.click();
    };
    portrait.title = "Clicca per caricare un'immagine";
    portrait.appendChild(fi);
    var ho = document.createElement('div');
    ho.style.cssText =
      'position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;font-size:28px;';
    ho.textContent = '📷';
    portrait.appendChild(ho);
    portrait.onmouseenter = function () {
      ho.style.opacity = '1';
    };
    portrait.onmouseleave = function () {
      ho.style.opacity = '0';
    };
  }
  portraitBlk._i.style.padding = '0';
  portraitBlk._i.appendChild(portrait);
  col1.appendChild(portraitBlk);

  /* ---- Attributi ---- */
  [
    { key: 'vigore', lbl: 'Vigore', desc: 'Forza e potenza fisica' },
    { key: 'grazia', lbl: 'Grazia', desc: 'Coordinazione e agilità' },
    { key: 'risolutezza', lbl: 'Risolutezza', desc: 'Forza di volontà' },
    { key: 'acume', lbl: 'Acume', desc: 'Rapidità di pensiero' },
    { key: 'panache', lbl: 'Panache', desc: 'Fascino e personalità' },
  ].forEach(function (a) {
    var blk = _blk(a.lbl);
    var inn = document.createElement('div');
    inn.style.cssText = 'padding:5px;display:flex;align-items:center;gap:10px;';
    inn.appendChild(_num(a.key, 0, 5, 2));
    var desc = document.createElement('div');
    desc.style.cssText =
      'font-size:10px;color:#3a5070;font-family:Arial,sans-serif;font-style:italic;line-height:1.3;';
    desc.textContent = a.desc;
    inn.appendChild(desc);
    blk._i.appendChild(inn);
    col1.appendChild(blk);
  });
  body.appendChild(col1);

  /* COL 2 — Ricchezza / Fama / Vantaggi */
  var col2 = document.createElement('div');
  col2.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
  var ricBlk = _blk('Ricchezza');
  var ricInn = document.createElement('div');
  ricInn.style.cssText = 'padding:6px;display:flex;justify-content:center;';
  ricInn.appendChild(_num('ricchezza', 0, 99, 0));
  ricBlk._i.appendChild(ricInn);
  col2.appendChild(ricBlk);

  function _secTA(h, key, rows) {
    var b = _blk(h);
    b.style.flex = '1';
    var inn = document.createElement('div');
    inn.style.cssText = 'padding:4px;';
    inn.appendChild(_ta(key, rows));
    b._i.appendChild(inn);
    return b;
  }
  col2.appendChild(_secTA('Fama', 'fama', 3));
  col2.appendChild(_secTA('Vantaggi', 'vantaggi', 6));
  body.appendChild(col2);

  /* COL 3 — Background / Storie / Arcani */
  var col3 = document.createElement('div');
  col3.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
  col3.appendChild(_secTA('Background', 'background', 4));

  var storieBlk = _blk('Storie');
  var storieInn = document.createElement('div');
  storieInn.style.cssText = 'padding:5px;display:flex;flex-direction:column;gap:5px;';
  [
    ['s_titolo', 'Titolo'],
    ['s_scopo', 'Scopo'],
    ['s_ricompensa', 'Ricompensa'],
    ['s_atto', 'Atto'],
  ].forEach(function (p) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;';
    var lbl = document.createElement('span');
    lbl.style.cssText =
      'font-size:10px;font-weight:700;color:#0d2440;letter-spacing:0.06em;min-width:72px;';
    lbl.textContent = p[1].toUpperCase();
    row.appendChild(lbl);
    row.appendChild(_inp(p[0], ''));
    storieInn.appendChild(row);
  });
  storieBlk._i.appendChild(storieInn);
  col3.appendChild(storieBlk);

  var arcaniBlk = _blk('Arcani');
  var arcaniInn = document.createElement('div');
  arcaniInn.style.cssText = 'padding:5px;display:flex;flex-direction:column;gap:5px;';
  [
    ['virtu', 'Virtù'],
    ['hubris', 'Hubris'],
  ].forEach(function (p) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;';
    var lbl = document.createElement('span');
    lbl.style.cssText =
      'font-size:10px;font-weight:700;color:#0d2440;letter-spacing:0.06em;min-width:55px;';
    lbl.textContent = p[1].toUpperCase();
    row.appendChild(lbl);
    row.appendChild(_inp(p[0], ''));
    arcaniInn.appendChild(row);
  });
  arcaniBlk._i.appendChild(arcaniInn);
  col3.appendChild(arcaniBlk);
  body.appendChild(col3);
  sheet.appendChild(body);

  /* ===== FOOTER ===== */
  var footer = document.createElement('div');
  footer.style.cssText =
    'display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 8px 8px;position:relative;z-index:1;';

  /* LEFT — Abilità */
  var abBlk = _blk('Abilità');
  var abInn = document.createElement('div');
  abInn.style.cssText = 'padding:4px;';
  [
    { key: 'sk_allettare', lbl: 'Allettare', attr: 'Pan' },
    { key: 'sk_adguerra', lbl: 'A.d.Guerra', attr: 'Ris' },
    { key: 'sk_atletica', lbl: 'Atletica', attr: 'Vig' },
    { key: 'sk_cavalcare', lbl: 'Cavalcare', attr: 'Gra' },
    { key: 'sk_convincere', lbl: 'Convincere', attr: 'Pan' },
    { key: 'sk_empatia', lbl: 'Empatia', attr: 'Pan' },
    { key: 'sk_esibirsi', lbl: 'Esibirsi', attr: 'Pan' },
    { key: 'sk_furto', lbl: 'Furto', attr: 'Gra' },
    { key: 'sk_intimidire', lbl: 'Intimidire', attr: 'Pan' },
    { key: 'sk_istruzione', lbl: 'Istruzione', attr: 'Acu' },
    { key: 'sk_mira', lbl: 'Mira', attr: 'Acu' },
    { key: 'sk_mischia', lbl: 'Mischia', attr: 'Vig' },
    { key: 'sk_nascond', lbl: 'Nascondersi', attr: 'Gra' },
    { key: 'sk_navigaz', lbl: 'Navigazione', attr: 'Acu' },
    { key: 'sk_notare', lbl: 'Notare', attr: 'Acu' },
    { key: 'sk_rissa', lbl: 'Rissa', attr: 'Vig' },
  ].forEach(function (sk) {
    var row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:5px;padding:3px 2px;border-bottom:1px solid rgba(13,36,64,0.1);';
    var lbl = document.createElement('span');
    lbl.style.cssText = 'font-family:Arial,sans-serif;font-size:12px;color:#1a1a0a;min-width:96px;';
    lbl.textContent = sk.lbl;
    row.appendChild(lbl);
    row.appendChild(_dots(sk.key, 5, 13));
    var al = document.createElement('span');
    al.style.cssText =
      'font-family:Arial,sans-serif;font-size:10px;color:#3a5070;margin-left:auto;font-style:italic;';
    al.textContent = sk.attr;
    row.appendChild(al);
    abInn.appendChild(row);
  });
  /* regole gradi */
  var gradiBox = document.createElement('div');
  gradiBox.style.cssText =
    'margin-top:7px;padding:5px 7px;background:rgba(13,36,64,0.06);border:1px solid rgba(13,36,64,0.15);border-radius:3px;font-family:Arial,sans-serif;font-size:11px;color:#0d2440;line-height:1.8;';
  gradiBox.innerHTML =
    '<b>Grado 3:</b> Tirare di nuovo un singolo dado<br><b>Grado 4:</b> Somma di 15 = 2 Incrementi<br><b>Grado 5:</b> I 10 esplodono';
  abInn.appendChild(gradiBox);
  abBlk._i.appendChild(abInn);
  footer.appendChild(abBlk);

  /* RIGHT — Spirale + Punti Eroe */
  var rFoot = document.createElement('div');
  rFoot.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  var spirBlk = _blk('Spirale della Morte');
  spirBlk.style.flex = '1';
  var spirBody = document.createElement('div');
  spirBody.style.cssText =
    'padding:8px;display:flex;flex-direction:column;align-items:center;gap:6px;';
  var spirCtn = document.createElement('div');
  spirCtn.style.cssText = 'width:100%;';
  _buildSpiral(spirCtn);
  spirBody.appendChild(spirCtn);

  spirBlk._i.appendChild(spirBody);
  rFoot.appendChild(spirBlk);

  /* Punti Eroe */
  var peBlk = _blk('Punti Eroe');
  var peInn = document.createElement('div');
  peInn.style.cssText = 'padding:8px;display:flex;align-items:center;justify-content:center;';
  peInn.appendChild(_num('punti_eroe', 0, 10, 0));
  peBlk._i.appendChild(peInn);
  rFoot.appendChild(peBlk);

  footer.appendChild(rFoot);
  sheet.appendChild(footer);
  outer.appendChild(sheet);
  wrap.appendChild(outer);
  return wrap;
}

function _renderAltSheet(tipo) {
  if (tipo === '7thsea') return _render7thSeaSheet();
  var def = SHEET_DEFS[tipo];
  var fieldsMap = SHEET_FIELDS[tipo];
  if (!def || !fieldsMap) return document.createElement('div');

  var _dmView = state.schedePGViewMode;
  if (typeof state.scheda.annotPage !== 'number') state.scheda.annotPage = 0;
  var curPage = Math.min(state.scheda.annotPage || 0, def.pages.length - 1);
  var pageFields = fieldsMap[curPage] || [];

  var wrap = document.createElement('div');
  wrap.style.cssText = 'min-height:100vh;display:flex;flex-direction:column;background:#5a5a5a;';

  /* ---- NAV BAR ---- */
  var nav = document.createElement('div');
  nav.style.cssText =
    'background:#1a1a1a;border-bottom:1px solid #333;padding:0.45rem 1rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;position:sticky;top:0;z-index:50;';

  var bk = document.createElement('button');
  bk.textContent = '← Indietro';
  bk.style.cssText =
    "background:#333;border:1px solid #555;color:#ccc;border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-size:11px;font-family:'Cinzel',serif;";
  bk.onclick = function () {
    if (_dmView) {
      state.schedePGViewMode = false;
      state.schedePGOpenChar = null;
      state.schedaAttivaId = null;
      state.scheda = {};
      state.companions = {};
    } else {
      state.schedaAttivaId = null;
    }
    renderMain();
  };
  nav.appendChild(bk);

  var nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.value = state.scheda.nome || '';
  nameInp.placeholder = 'Nome personaggio';
  nameInp.readOnly = _dmView;
  nameInp.style.cssText =
    "flex:1;min-width:0;background:transparent;border:none;border-bottom:1px solid #c9a55c;color:#f0e4cc;font-family:'Cinzel',serif;font-size:15px;font-weight:700;outline:none;padding:0.2rem 0.4rem;";
  nameInp.oninput = function () {
    state.scheda.nome = this.value;
    if (!_dmView) fbSaveScheda();
  };
  nav.appendChild(nameInp);

  if (!_dmView) {
    var delB = document.createElement('button');
    delB.textContent = '🗑 Elimina';
    delB.style.cssText =
      "background:#4a1010;border:1px solid #c04040;color:#f08080;border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-size:11px;font-family:'Cinzel',serif;";
    delB.onclick = function () {
      if (!confirm('Eliminare "' + (state.scheda.nome || 'questa scheda') + '"? Non recuperabile.'))
        return;
      var _did = state.schedaAttivaId;
      state.schedeList = state.schedeList.filter(function (x) {
        return x.id !== _did;
      });
      fbDeleteSchedaItem(_did);
      state.schedaAttivaId = null;
      state.scheda = {};
      renderMain();
    };
    nav.appendChild(delB);
  }

  if (_dmView) {
    var badge = document.createElement('span');
    badge.textContent = '⚔ Vista Master — sola lettura';
    badge.style.cssText =
      'font-size:10px;color:#c9a55c;background:rgba(201,165,92,0.1);border:1px solid rgba(201,165,92,0.3);border-radius:3px;padding:0.2rem 0.6rem;';
    nav.appendChild(badge);
  }

  if (def.pages.length > 1) {
    var tabsWrap = document.createElement('div');
    tabsWrap.style.cssText = 'display:flex;gap:0.3rem;margin-left:auto;';
    def.pageLabels.forEach(function (lbl, i) {
      var tab = document.createElement('button');
      tab.textContent = lbl;
      tab.style.cssText =
        'background:' +
        (i === curPage ? '#8b6f3f' : '#2a2a2a') +
        ";border:1px solid #c9a55c;color:#f0e4cc;border-radius:3px;padding:0.25rem 0.7rem;cursor:pointer;font-size:11px;font-family:'Cinzel',serif;";
      tab.onclick = function () {
        state.scheda.annotPage = i;
        if (!_dmView) fbSaveScheda();
        renderMain();
      };
      tabsWrap.appendChild(tab);
    });
    nav.appendChild(tabsWrap);
  }
  wrap.appendChild(nav);

  /* ---- IMMAGINE + CAMPI ---- */
  var sheetOuter = document.createElement('div');
  sheetOuter.style.cssText =
    'flex:1;overflow-y:auto;padding:1rem;display:flex;justify-content:center;';

  var sheetWrap = document.createElement('div');
  sheetWrap.style.cssText = 'position:relative;width:100%;max-width:850px;';

  var img = document.createElement('img');
  img.src = def.pages[curPage];
  img.style.cssText =
    'width:100%;display:block;pointer-events:none;border:2px solid #333;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
  sheetWrap.appendChild(img);

  var fieldsLayer = document.createElement('div');
  fieldsLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';

  var _baseStyle =
    'position:absolute;pointer-events:auto;background:transparent;border:none;outline:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:clamp(8px,1.05vw,13px);padding:0 2px;line-height:1.25;box-sizing:border-box;';

  pageFields.forEach(function (fd) {
    var el,
      isArea = fd.tp === 'a';
    if (isArea) {
      el = document.createElement('textarea');
      el.rows = 1;
      el.style.cssText =
        _baseStyle +
        'left:' +
        fd.l +
        ';top:' +
        fd.t +
        ';width:' +
        fd.w +
        ';height:' +
        (fd.h || '5%') +
        ';resize:none;overflow:hidden;vertical-align:top;';
    } else {
      el = document.createElement('input');
      el.type = 'text';
      el.style.cssText =
        _baseStyle + 'left:' + fd.l + ';top:' + fd.t + ';width:' + fd.w + ';height:2%;';
    }
    el.value = state.scheda[fd.key] !== undefined ? state.scheda[fd.key] : '';
    if (_dmView) {
      el.readOnly = true;
    } else {
      if (isArea) {
        el.style.border = '1px solid rgba(0,0,0,0.1)';
        el.onfocus = function () {
          el.style.border = '1px solid rgba(30,80,180,0.4)';
          el.style.background = 'var(--text-secondary)';
        };
        el.onblur = function () {
          el.style.border = '1px solid rgba(0,0,0,0.1)';
          el.style.background = 'transparent';
        };
      } else {
        el.style.borderBottom = '1px solid rgba(0,0,0,0.15)';
        el.onfocus = function () {
          el.style.borderBottom = '2px solid rgba(30,80,180,0.5)';
          el.style.background = 'var(--text-secondary)';
        };
        el.onblur = function () {
          el.style.borderBottom = '1px solid rgba(0,0,0,0.15)';
          el.style.background = 'transparent';
        };
      }
      (function (key, element) {
        element.oninput = function () {
          state.scheda[key] = element.value;
          fbSaveScheda();
        };
      })(fd.key, el);
    }
    fieldsLayer.appendChild(el);
  });

  sheetWrap.appendChild(fieldsLayer);
  sheetOuter.appendChild(sheetWrap);
  wrap.appendChild(sheetOuter);
  return wrap;
}

/* Modal selezione tipo scheda */
function _renderTipoSelectorModal(onSelect) {
  var back = document.createElement('div');
  back.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;';

  var box = document.createElement('div');
  box.style.cssText =
    'background:#1a1a2a;border:1px solid #c9a55c;border-radius:8px;padding:1.5rem;max-width:800px;width:100%;';
  box.onclick = function (e) {
    e.stopPropagation();
  };

  var title = document.createElement('div');
  title.style.cssText =
    "font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:#f0d070;letter-spacing:0.1em;margin-bottom:1.25rem;text-align:center;";
  title.textContent = 'Scegli il tipo di scheda';
  box.appendChild(title);

  var grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1rem;';

  var types = [
    {
      key: 'normale',
      label: 'D&D 5e',
      thumb:
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01ek0yIDE3bDEwIDUgMTAtNU0yIDEybDEwIDUgMTAtNSIvPjwvc3ZnPg==',
      desc: 'Scheda digitale interattiva',
    },
    {
      key: 'onepiece',
      label: 'One Piece D&D',
      thumb:
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iNSIvPjxwYXRoIGQ9Ik03IDE0czIgMyA1IDMgNS0zIDUtM00xMiAydjNNMTIgMTV2M000IDEwaDNNMTcgMTBoMyIvPjwvc3ZnPg==',
      desc: 'Dungeons & Devil Fruits',
    },
    {
      key: 'pokemon',
      label: 'Pokémon Tabletop',
      thumb:
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIzIi8+PHBhdGggZD0iTTIgMTJoN00xNSAxMmg3Ii8+PC9zdmc+',
      desc: 'Trainer & Party System',
    },
    {
      key: 'naruto',
      label: 'NARUTO 5e',
      thumb:
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMTQuNWMtMi40OSAwLTQuNS0yLjAxLTQuNS00LjVTOS41MSA3LjUgMTIgNy41czQuNSAyLjAxIDQuNSA0LjUtMi4wMSA0LjUtNC41IDQuNXptMC03LjVjLTEuNjYgMC0zIDEuMzQtMyAzczEuMzQgMyAzIDMgMy0xLjM0IDMtMy0xLjM0LTMtMy0zeiIvPjwvc3ZnPg==',
      desc: 'Shinobi & Chakra System',
    },
    {
      key: 'brancalonia',
      label: 'Brancalonia',
      thumb:
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01ek0yIDE3bDEwIDUgMTAtNU0yIDEybDEwIDUgMTAtNSIvPjwvc3ZnPg==',
      desc: 'Spaghetti Fantasy',
    },
    {
      key: 'sw5e',
      label: 'Star Wars 5e',
      thumb:
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01ek0yIDE3bDEwIDUgMTAtNU0yIDEybDEwIDUgMTAtNSIvPjwvc3ZnPg==',
      desc: 'Sci-Fi 5e Engine',
    },
  ];
  Object.keys(SHEET_DEFS).forEach(function (k) {
    var thumb = SHEET_DEFS[k].thumbnail;
    if (k === '7thsea')
      thumb =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48cGF0aCBkPSJNMTIgMnYyME0yIDEyaDIwTTQuOTMgNC45M2wxNC4xNCAxNC4xNE00LjkzIDE5LjA3TDE5LjA3IDQuOTMiLz48L3N2Zz4=';
    types.push({ key: k, label: SHEET_DEFS[k].label, thumb: thumb, desc: 'Sistema Custom / Pdf' });
  });

  types.forEach(function (t) {
    var card = document.createElement('div');
    card.style.cssText =
      'border:2px solid #3a3a4a;border-radius:6px;overflow:hidden;cursor:pointer;transition:border-color 0.2s,transform 0.2s;background:#12121e;';
    card.onmouseenter = function () {
      card.style.borderColor = '#c9a55c';
      card.style.transform = 'translateY(-3px)';
    };
    card.onmouseleave = function () {
      card.style.borderColor = '#3a3a4a';
      card.style.transform = '';
    };

    var imgWrap = document.createElement('div');
    imgWrap.style.cssText =
      'height:180px;overflow:hidden;background:#0a0a14;display:flex;align-items:flex-start;justify-content:center;';
    if (t.thumb) {
      var im = document.createElement('img');
      im.src = t.thumb;
      im.style.cssText =
        'width:100%;height:100%;object-fit:contain;object-position:center;padding:10px;box-sizing:border-box;';
      imgWrap.appendChild(im);
    } else {
      imgWrap.style.alignItems = 'center';
      imgWrap.innerHTML = '<span style="font-size:3rem;">⚔</span>';
    }
    card.appendChild(imgWrap);

    var body = document.createElement('div');
    body.style.cssText = 'padding:0.75rem;';
    var lbl = document.createElement('div');
    lbl.style.cssText = "font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:#f0d070;";
    lbl.textContent = t.label;
    body.appendChild(lbl);
    if (t.desc) {
      var dsc = document.createElement('div');
      dsc.style.cssText = 'font-size:11px;color:#888;margin-top:0.25rem;';
      dsc.textContent = t.desc;
      body.appendChild(dsc);
    }
    card.appendChild(body);

    card.onclick = function () {
      back.remove();
      onSelect(t.key);
    };
    grid.appendChild(card);
  });

  box.appendChild(grid);

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Annulla';
  cancelBtn.style.cssText =
    'margin-top:1rem;background:transparent;border:1px solid #555;color:#888;border-radius:3px;padding:0.4rem 1rem;cursor:pointer;font-size:12px;width:100%;';
  cancelBtn.onclick = function () {
    back.remove();
  };
  box.appendChild(cancelBtn);

  back.appendChild(box);
  back.onclick = function () {
    back.remove();
  };
  document.body.appendChild(back);
}
