/* Character companions: uses the shared sheet state and account manager. */
function _companionDefault() {
  return {
    nome: 'Compagno',
    tipo: '',
    ca: '',
    hpMax: '',
    hpAttuali: '',
    velocita: '',
    bonusComp: 2,
    for: 10,
    des: 10,
    cos: 10,
    int: 10,
    sag: 10,
    car: 10,
    tsFor: false,
    tsDes: false,
    tsCos: false,
    tsInt: false,
    tsSag: false,
    tsCar: false,
    skText: '',
    skAcro: false,
    skAnim: false,
    skArca: false,
    skAtle: false,
    skFurt: false,
    skInda: false,
    skInga: false,
    skInti: false,
    skIntr: false,
    skIntu: false,
    skMedi: false,
    skNatu: false,
    skPerc: false,
    skPers: false,
    skRapi: false,
    skReli: false,
    skSopr: false,
    skStor: false,
    skTecn: false,
    immunita: '',
    resistenze: '',
    condImm: '',
    sensi: '',
    lingue: '',
    tratti: '',
    azioni: [{ nome: '', desc: '' }],
  };
}

function _renderCompanionMiniSheet(charId, comp) {
  var m2 = function (v) {
    return Math.floor(((parseInt(v) || 10) - 10) / 2);
  };
  var fmt2 = function (n) {
    return (n >= 0 ? '+' : '') + n;
  };
  var wrap = document.createElement('div');
  wrap.style.cssText =
    'width:760px;background:#f8f4e8;color:#111;box-shadow:0 3px 20px rgba(0,0,0,0.6);padding:14px 16px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:10px;border:2px solid #6a8abf;border-radius:4px;margin-top:20px;';
  /* header */
  var hdr = document.createElement('div');
  hdr.style.cssText =
    'border-bottom:2px solid #6a8abf;margin-bottom:8px;padding-bottom:5px;display:flex;justify-content:space-between;align-items:flex-end;';
  var nBlk = document.createElement('div');
  var nLbl = document.createElement('div');
  nLbl.style.cssText =
    'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#4a6a9a;margin-bottom:2px;';
  nLbl.textContent = 'Nome Compagno';
  var nInp = document.createElement('input');
  nInp.type = 'text';
  nInp.value = comp.nome || '';
  nInp.style.cssText =
    'background:transparent;border:none;border-bottom:1px solid #6a8abf;color:#111;font-size:15px;font-weight:bold;outline:none;width:260px;font-family:Arial,Helvetica,sans-serif;';
  (function (cid, co) {
    nInp.oninput = function () {
      co.nome = this.value;
      fbSaveCompanion(cid, co);
    };
  })(charId, comp);
  nBlk.appendChild(nLbl);
  nBlk.appendChild(nInp);
  var tBlk = document.createElement('div');
  tBlk.style.cssText = 'text-align:right;';
  var tLbl = document.createElement('div');
  tLbl.style.cssText =
    'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#4a6a9a;margin-bottom:2px;';
  tLbl.textContent = 'Tipo';
  var tInp = document.createElement('input');
  tInp.type = 'text';
  tInp.value = comp.tipo || '';
  tInp.style.cssText =
    'background:transparent;border:none;border-bottom:1px solid #6a8abf;color:#555;font-size:11px;outline:none;width:140px;text-align:right;font-family:Arial,Helvetica,sans-serif;';
  (function (cid, co) {
    tInp.oninput = function () {
      co.tipo = this.value;
      fbSaveCompanion(cid, co);
    };
  })(charId, comp);
  tBlk.appendChild(tLbl);
  tBlk.appendChild(tInp);
  hdr.appendChild(nBlk);
  hdr.appendChild(tBlk);
  wrap.appendChild(hdr);
  /* CA / HP / VEL */
  var r1 = document.createElement('div');
  r1.style.cssText = 'display:flex;gap:5px;margin-bottom:7px;';
  function cmpStat(lbl, key) {
    var bx = document.createElement('div');
    bx.style.cssText =
      'border:1px solid #9ab;border-radius:2px;padding:3px 4px;text-align:center;flex:1;background:#f0f5fa;';
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = comp[key] || '';
    inp.style.cssText =
      'width:100%;text-align:center;background:transparent;border:none;color:#111;font-size:14px;font-weight:bold;outline:none;';
    (function (cid, co, k) {
      inp.oninput = function () {
        co[k] = this.value;
        fbSaveCompanion(cid, co);
      };
    })(charId, comp, key);
    var lb = document.createElement('div');
    lb.style.cssText =
      'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.07em;color:#4a6a9a;border-top:1px solid #9ab;margin-top:2px;padding-top:1px;';
    lb.textContent = lbl;
    bx.appendChild(inp);
    bx.appendChild(lb);
    return bx;
  }
  var hpBx = document.createElement('div');
  hpBx.style.cssText =
    'flex:2;border:1px solid #9ab;border-radius:2px;padding:3px 4px;text-align:center;background:#f0f5fa;';
  var hpRw = document.createElement('div');
  hpRw.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:2px;';
  var hpC = document.createElement('input');
  hpC.type = 'text';
  hpC.value = comp.hpAttuali || '';
  hpC.style.cssText =
    'width:40px;text-align:right;background:transparent;border:none;border-bottom:1px solid #c84040;color:#c84040;font-size:14px;font-weight:bold;outline:none;';
  (function (cid, co) {
    hpC.oninput = function () {
      co.hpAttuali = this.value;
      fbSaveCompanion(cid, co);
    };
  })(charId, comp);
  var hpSp = document.createElement('span');
  hpSp.style.cssText = 'font-size:14px;color:#888;';
  hpSp.textContent = '/';
  var hpM = document.createElement('input');
  hpM.type = 'text';
  hpM.value = comp.hpMax || '';
  hpM.style.cssText =
    'width:40px;text-align:left;background:transparent;border:none;border-bottom:1px solid #9ab;color:#111;font-size:14px;font-weight:bold;outline:none;';
  (function (cid, co) {
    hpM.oninput = function () {
      co.hpMax = this.value;
      fbSaveCompanion(cid, co);
    };
  })(charId, comp);
  hpRw.appendChild(hpC);
  hpRw.appendChild(hpSp);
  hpRw.appendChild(hpM);
  var hpLb = document.createElement('div');
  hpLb.style.cssText =
    'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.07em;color:#4a6a9a;border-top:1px solid #9ab;margin-top:2px;padding-top:1px;';
  hpLb.textContent = 'Punti Ferita (att/max)';
  hpBx.appendChild(hpRw);
  hpBx.appendChild(hpLb);
  r1.appendChild(cmpStat('Classe Armatura', 'ca'));
  r1.appendChild(hpBx);
  r1.appendChild(cmpStat('Velocità', 'velocita'));
  wrap.appendChild(r1);
  /* Stats 6 */
  var sN = ['FOR', 'DES', 'COS', 'INT', 'SAG', 'CAR'],
    sK = ['for', 'des', 'cos', 'int', 'sag', 'car'],
    tsK = ['tsFor', 'tsDes', 'tsCos', 'tsInt', 'tsSag', 'tsCar'];
  var sg = document.createElement('div');
  sg.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:7px;';
  sN.forEach(function (sn, i) {
    var cell = document.createElement('div');
    cell.style.cssText =
      'border:1px solid #9ab;border-radius:2px;background:#f0f5fa;padding:4px 2px;text-align:center;';
    var sLb = document.createElement('div');
    sLb.style.cssText =
      'font-size:6.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#4a6a9a;margin-bottom:2px;';
    sLb.textContent = sn;
    var sv = parseInt(comp[sK[i]]) || 10;
    var vI = document.createElement('input');
    vI.type = 'number';
    vI.value = sv;
    vI.min = 1;
    vI.max = 30;
    vI.style.cssText =
      'width:100%;text-align:center;background:transparent;border:none;border-bottom:1px solid #9ab;color:#111;font-size:14px;font-weight:bold;outline:none;box-sizing:border-box;padding:0;';
    var mDiv = document.createElement('div');
    mDiv.style.cssText = 'font-size:9px;color:#555;margin-top:1px;';
    mDiv.textContent = fmt2(m2(sv));
    (function (cid, co, k, md) {
      vI.oninput = function () {
        co[k] = parseInt(this.value) || 10;
        md.textContent = fmt2(m2(co[k]));
        fbSaveCompanion(cid, co);
      };
    })(charId, comp, sK[i], mDiv);
    var tsRw = document.createElement('div');
    tsRw.style.cssText =
      'display:flex;align-items:center;justify-content:center;gap:2px;margin-top:2px;';
    var tsCb = document.createElement('input');
    tsCb.type = 'checkbox';
    tsCb.checked = !!comp[tsK[i]];
    tsCb.style.cssText = 'width:9px;height:9px;cursor:pointer;accent-color:#4a6a9a;';
    (function (cid, co, tk) {
      tsCb.onchange = function () {
        co[tk] = this.checked;
        fbSaveCompanion(cid, co);
      };
    })(charId, comp, tsK[i]);
    var tsLb = document.createElement('span');
    tsLb.style.cssText = 'font-size:5.5px;color:#4a6a9a;';
    tsLb.textContent = 'TS';
    tsRw.appendChild(tsCb);
    tsRw.appendChild(tsLb);
    cell.appendChild(sLb);
    cell.appendChild(vI);
    cell.appendChild(mDiv);
    cell.appendChild(tsRw);
    sg.appendChild(cell);
  });
  wrap.appendChild(sg);
  /* Textarea helper */
  function cmpTA(lbl, key, minH) {
    var bx = document.createElement('div');
    bx.style.cssText = 'border:1px solid #9ab;border-radius:2px;';
    var ta = document.createElement('textarea');
    ta.style.cssText =
      'width:100%;background:#f5f8fc;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;min-height:' +
      minH +
      'px;box-sizing:border-box;';
    ta.value = comp[key] || '';
    (function (cid, co, k) {
      ta.oninput = function () {
        co[k] = this.value;
        fbSaveCompanion(cid, co);
      };
    })(charId, comp, key);
    var lb = document.createElement('div');
    lb.style.cssText =
      'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#4a6a9a;border-top:1px solid #9ab;padding:2px;text-align:center;background:#e8f0fa;';
    lb.textContent = lbl;
    bx.appendChild(ta);
    bx.appendChild(lb);
    return bx;
  }
  /* Bonus Competenza */
  var bcRw = document.createElement('div');
  bcRw.style.cssText =
    'display:flex;align-items:center;gap:6px;margin-bottom:6px;padding:3px 6px;border:1px solid #9ab;border-radius:2px;background:#f0f5fa;';
  var bcLb = document.createElement('span');
  bcLb.style.cssText =
    'font-size:6.5px;font-weight:bold;text-transform:uppercase;color:#4a6a9a;white-space:nowrap;';
  bcLb.textContent = 'Bonus Competenza:';
  var bcIn = document.createElement('input');
  bcIn.type = 'number';
  bcIn.value = comp.bonusComp || 2;
  bcIn.min = 1;
  bcIn.max = 9;
  bcIn.style.cssText =
    'width:36px;text-align:center;background:transparent;border:none;border-bottom:1px solid #9ab;color:#111;font-size:13px;font-weight:bold;outline:none;';
  bcRw.appendChild(bcLb);
  bcRw.appendChild(bcIn);
  wrap.appendChild(bcRw);

  /* Skills con checkbox e bonus calcolato */
  var SKILLS = [
    { k: 'skAtle', lbl: 'Atletica', ab: 'for' },
    { k: 'skAcro', lbl: 'Acrobazia', ab: 'des' },
    { k: 'skFurt', lbl: 'Furtività', ab: 'des' },
    { k: 'skRapi', lbl: 'Rapidità di mano', ab: 'des' },
    { k: 'skArca', lbl: 'Arcano', ab: 'int' },
    { k: 'skInda', lbl: 'Indagare', ab: 'int' },
    { k: 'skNatu', lbl: 'Natura', ab: 'int' },
    { k: 'skReli', lbl: 'Religione', ab: 'int' },
    { k: 'skStor', lbl: 'Storia', ab: 'int' },
    { k: 'skTecn', lbl: 'Tecnologia', ab: 'int' },
    { k: 'skAnim', lbl: 'Addestrare animali', ab: 'sag' },
    { k: 'skIntu', lbl: 'Intuizione', ab: 'sag' },
    { k: 'skMedi', lbl: 'Medicina', ab: 'sag' },
    { k: 'skPerc', lbl: 'Percezione', ab: 'sag' },
    { k: 'skSopr', lbl: 'Sopravvivenza', ab: 'sag' },
    { k: 'skInga', lbl: 'Inganno', ab: 'car' },
    { k: 'skInti', lbl: 'Intimidazione', ab: 'car' },
    { k: 'skIntr', lbl: 'Intrattenimento', ab: 'car' },
    { k: 'skPers', lbl: 'Persuasione', ab: 'car' },
  ];
  var _skBEl = {};
  function _calcSkB(sk) {
    var ab = parseInt(comp[sk.ab]) || 10;
    var mod = Math.floor((ab - 10) / 2);
    var bc = parseInt(comp.bonusComp) || 2;
    return mod + (comp[sk.k] ? bc : 0);
  }
  function _refreshSk() {
    SKILLS.forEach(function (sk) {
      if (_skBEl[sk.k]) {
        var b = _calcSkB(sk);
        _skBEl[sk.k].textContent = (b >= 0 ? '+' : '') + b;
      }
    });
  }
  (function (cid, co) {
    bcIn.oninput = function () {
      co.bonusComp = parseInt(this.value) || 2;
      fbSaveCompanion(cid, co);
      _refreshSk();
    };
  })(charId, comp);
  var skBox = document.createElement('div');
  skBox.style.cssText = 'border:1px solid #9ab;border-radius:2px;margin-bottom:5px;';
  var skHd = document.createElement('div');
  skHd.style.cssText =
    'font-size:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#4a6a9a;padding:2px 5px;border-bottom:1px solid #9ab;background:#e8f0fa;';
  skHd.textContent = 'Abilità';
  skBox.appendChild(skHd);
  var skGrid = document.createElement('div');
  skGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:0;padding:2px;';
  SKILLS.forEach(function (sk) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:2px;padding:1px 3px;';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!comp[sk.k];
    cb.style.cssText = 'width:8px;height:8px;cursor:pointer;accent-color:#4a6a9a;flex-shrink:0;';
    var b = _calcSkB(sk);
    var bonSp = document.createElement('span');
    bonSp.style.cssText =
      'font-size:7.5px;font-weight:bold;color:#4a6a9a;width:22px;text-align:right;flex-shrink:0;';
    bonSp.textContent = (b >= 0 ? '+' : '') + b;
    _skBEl[sk.k] = bonSp;
    var lbl = document.createElement('span');
    lbl.style.cssText =
      'font-size:7.5px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:1px;';
    lbl.textContent = sk.lbl;
    (function (cid, co, k) {
      cb.onchange = function () {
        co[k] = this.checked;
        fbSaveCompanion(cid, co);
        _refreshSk();
      };
    })(charId, comp, sk.k);
    row.appendChild(cb);
    row.appendChild(bonSp);
    row.appendChild(lbl);
    skGrid.appendChild(row);
  });
  skBox.appendChild(skGrid);
  wrap.appendChild(skBox);

  var r3b = document.createElement('div');
  r3b.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px;';
  r3b.appendChild(cmpTA('Sensi', 'sensi', 30));
  r3b.appendChild(cmpTA('Lingue', 'lingue', 30));
  wrap.appendChild(r3b);
  var r4 = document.createElement('div');
  r4.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:5px;';
  r4.appendChild(cmpTA('Immunità ai Danni', 'immunita', 28));
  r4.appendChild(cmpTA('Resistenze', 'resistenze', 28));
  r4.appendChild(cmpTA('Imm. Condizioni', 'condImm', 28));
  wrap.appendChild(r4);
  /* Tratti Speciali — area grande e ridimensionabile */
  var trBox = document.createElement('div');
  trBox.style.cssText = 'border:1px solid #9ab;border-radius:2px;margin-bottom:5px;';
  var trTa = document.createElement('textarea');
  trTa.style.cssText =
    'width:100%;background:#f5f8fc;border:none;resize:vertical;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:4px;min-height:80px;box-sizing:border-box;';
  trTa.value = comp.tratti || '';
  (function (cid, co) {
    trTa.oninput = function () {
      co.tratti = this.value;
      fbSaveCompanion(cid, co);
    };
  })(charId, comp);
  var trLb = document.createElement('div');
  trLb.style.cssText =
    'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#4a6a9a;border-top:1px solid #9ab;padding:2px;text-align:center;background:#e8f0fa;';
  trLb.textContent = 'Tratti Speciali';
  trBox.appendChild(trTa);
  trBox.appendChild(trLb);
  wrap.appendChild(trBox);
  /* Azioni */
  var azBx = document.createElement('div');
  azBx.style.cssText = 'border:1px solid #9ab;border-radius:2px;margin-bottom:6px;';
  var azHd = document.createElement('div');
  azHd.style.cssText =
    'font-size:6.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#4a6a9a;padding:3px 5px;border-bottom:1px solid #9ab;background:#e8f0fa;display:flex;align-items:center;justify-content:space-between;';
  var azSp = document.createElement('span');
  azSp.textContent = 'Azioni / Attacchi';
  azHd.appendChild(azSp);
  var azAdd = document.createElement('button');
  azAdd.textContent = '+';
  azAdd.style.cssText =
    'background:#4a6a9a;border:none;color:#fff;border-radius:2px;padding:1px 6px;cursor:pointer;font-size:10px;';
  (function (cid, co) {
    azAdd.onclick = function () {
      if (!co.azioni) co.azioni = [];
      co.azioni.push({ nome: '', desc: '' });
      fbSaveCompanion(cid, co);
      renderMain();
    };
  })(charId, comp);
  azHd.appendChild(azAdd);
  azBx.appendChild(azHd);
  if (!comp.azioni || !comp.azioni.length) comp.azioni = [{ nome: '', desc: '' }];
  comp.azioni.forEach(function (az, idx) {
    var azRw = document.createElement('div');
    azRw.style.cssText =
      'display:flex;align-items:flex-start;gap:4px;padding:3px 5px;border-bottom:1px solid #d0dde8;';
    var nI = document.createElement('input');
    nI.type = 'text';
    nI.value = az.nome || '';
    nI.placeholder = 'Nome azione...';
    nI.style.cssText =
      'width:110px;flex-shrink:0;background:transparent;border:none;border-bottom:1px solid #9ab;color:#111;font-size:10px;font-weight:bold;outline:none;font-family:Arial,Helvetica,sans-serif;';
    (function (cid, co, i) {
      nI.oninput = function () {
        co.azioni[i].nome = this.value;
        fbSaveCompanion(cid, co);
      };
    })(charId, comp, idx);
    var dT = document.createElement('textarea');
    dT.style.cssText =
      'flex:1;background:transparent;border:none;color:#111;font-size:9px;outline:none;resize:none;min-height:26px;font-family:Arial,Helvetica,sans-serif;padding:0;';
    dT.value = az.desc || '';
    dT.placeholder = 'Descrizione, danni, effetti...';
    (function (cid, co, i) {
      dT.oninput = function () {
        co.azioni[i].desc = this.value;
        fbSaveCompanion(cid, co);
      };
    })(charId, comp, idx);
    var dB = document.createElement('button');
    dB.textContent = '✕';
    dB.style.cssText =
      'background:none;border:none;color:#c04040;cursor:pointer;font-size:11px;padding:0;flex-shrink:0;margin-top:1px;';
    (function (cid, co, i) {
      dB.onclick = function () {
        co.azioni.splice(i, 1);
        fbSaveCompanion(cid, co);
        renderMain();
      };
    })(charId, comp, idx);
    azRw.appendChild(nI);
    azRw.appendChild(dT);
    azRw.appendChild(dB);
    azBx.appendChild(azRw);
  });
  wrap.appendChild(azBx);
  /* Delete */
  var foot = document.createElement('div');
  foot.style.cssText = 'display:flex;justify-content:flex-end;';
  var delB = document.createElement('button');
  delB.textContent = 'Elimina scheda compagno';
  delB.style.cssText =
    "background:#4a1010;border:1px solid #c04040;color:#f08080;border-radius:3px;padding:0.3rem 0.75rem;font-size:10px;cursor:pointer;font-family:'Cinzel',serif;";
  (function (cid, co) {
    delB.onclick = function () {
      if (!confirm('Eliminare la scheda di "' + (co.nome || 'questo compagno') + '"?')) return;
      if (state.companions && state.companions[cid]) delete state.companions[cid][co.id];
      fbDeleteCompanion(cid, co.id);
      renderMain();
    };
  })(charId, comp);
  foot.appendChild(delB);
  wrap.appendChild(foot);
  return wrap;
}

function _renderCompanionForm(charId) {
  var cid2 = 'cp' + Date.now();
  var form = { id: cid2, nome: '', tipo: '' };
  var bd = document.createElement('div');
  bd.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
  bd.onclick = function (e) {
    if (e.target === bd) {
      state.companionShowForm = false;
      state.companionEditingId = null;
      renderMain();
    }
  };
  var modal = document.createElement('div');
  modal.style.cssText =
    "background:#1a1f2a;border:1px solid #3a4a6a;border-radius:6px;width:380px;padding:1.5rem;font-family:'Cinzel',serif;";
  modal.onclick = function (e) {
    e.stopPropagation();
  };
  var mT = document.createElement('div');
  mT.style.cssText =
    'font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#aacef0;margin-bottom:1.25rem;';
  mT.textContent = 'Nuova Scheda Compagno';
  modal.appendChild(mT);
  function cFld(label, key) {
    var w = document.createElement('div');
    w.style.marginBottom = '0.75rem';
    var l = document.createElement('label');
    l.style.cssText =
      'display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6a9abf;margin-bottom:0.3rem;';
    l.textContent = label;
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = form[key] || '';
    inp.style.cssText =
      "width:100%;background:rgba(255,255,255,0.06);border:1px solid #3a4a6a;border-radius:3px;color:#d0e0f0;font-family:'EB Garamond',serif;font-size:14px;padding:0.4rem 0.6rem;outline:none;box-sizing:border-box;";
    inp.oninput = function () {
      form[key] = this.value;
    };
    w.appendChild(l);
    w.appendChild(inp);
    return w;
  }
  modal.appendChild(cFld('Nome Compagno / Pet', 'nome'));
  modal.appendChild(cFld('Tipo (es. Bestia, Costrutto, Drone)', 'tipo'));
  var btnR = document.createElement('div');
  btnR.style.cssText = 'display:flex;gap:0.5rem;margin-top:1rem;';
  var can = document.createElement('button');
  can.textContent = 'Annulla';
  can.style.cssText =
    "flex:1;background:#2a2a2a;border:1px solid #555;color:#aaa;border-radius:3px;padding:0.55rem;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;";
  can.onclick = function () {
    state.companionShowForm = false;
    state.companionEditingId = null;
    renderMain();
  };
  var ok = document.createElement('button');
  ok.textContent = 'Crea Scheda';
  ok.style.cssText =
    "flex:2;background:#4a6a9a;border:none;color:#fff;border-radius:3px;padding:0.55rem;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;letter-spacing:0.06em;";
  ok.onclick = function () {
    if (!form.nome.trim()) {
      alert('Inserisci un nome per il compagno.');
      return;
    }
    var comp = Object.assign(_companionDefault(), form);
    if (!state.companions) state.companions = {};
    if (!state.companions[charId]) state.companions[charId] = {};
    state.companions[charId][comp.id] = comp;
    fbSaveCompanion(charId, comp);
    state.companionShowForm = false;
    state.companionEditingId = null;
    renderMain();
  };
  btnR.appendChild(can);
  btnR.appendChild(ok);
  modal.appendChild(btnR);
  bd.appendChild(modal);
  return bd;
}
