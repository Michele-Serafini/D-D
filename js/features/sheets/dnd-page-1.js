/* D&D character sheet, page 1. Fields share the active character context. */
function renderDndPage1(context) {
  var {
    m,
    makePage,
    isOP,
    makeHdrCell,
    s,
    ss,
    cellLbl,
    makeStatBox,
    makeTsRow,
    secTitle,
    makeSkillRow,
    makeTraitBox,
  } = context;
  /* ==================== PAGINA 1 ==================== */
  var pg1 = makePage();
  /* Header */
  var hdr1 = document.createElement('div');
  hdr1.style.cssText =
    'border:1.5px solid #555;border-radius:3px;margin-bottom:8px;overflow:hidden;';
  if (isOP) {
    var hR1 = document.createElement('div');
    hR1.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-bottom:1px solid #aaa;';
    hR1.appendChild(makeHdrCell('Classe & Livello', 'classelivello', true));
    hR1.appendChild(makeHdrCell('Razza', 'razza', false));
    hR1.appendChild(makeHdrCell('Epiteto / Soprannome', 'epiteto', false));
    hR1.appendChild(makeHdrCell('Ruolo Ciurma', 'ruoloCiurma', false));
    var hR2 = document.createElement('div');
    hR2.style.cssText =
      'display:grid;grid-template-columns:2fr 1fr 1fr 1fr;border-bottom:1px solid #aaa;';
    var nomeCell = document.createElement('div');
    nomeCell.style.cssText = 'padding:3px 4px;';
    var nomeInp1 = document.createElement('input');
    nomeInp1.type = 'text';
    nomeInp1.setAttribute('aria-label', 'Nome Personaggio');
    nomeInp1.value = s.nomePersonaggio || '';
    nomeInp1.style.cssText =
      'width:100%;border:none;background:transparent;color:#111;font-size:14px;font-weight:bold;outline:none;';
    nomeInp1.oninput = function () {
      s.nomePersonaggio = this.value;
      ss();
    };
    nomeCell.appendChild(nomeInp1);
    nomeCell.appendChild(cellLbl('Nome Personaggio'));
    hR2.appendChild(nomeCell);
    hR2.appendChild(makeHdrCell('Nome Ciurma', 'nomeCiurma', false));
    hR2.appendChild(makeHdrCell('Nome Nave', 'nomeNave', false));
    hR2.appendChild(makeHdrCell('Fazione / Affiliazione', 'allineamento', false));
    var hR3 = document.createElement('div');
    hR3.style.cssText =
      'display:flex;background:#faf3e3;border-bottom:1px solid #aaa;padding:4px;gap:10px;align-items:center;';
    var wantedLbl = document.createElement('div');
    wantedLbl.style.cssText =
      "font-family:'Cinzel',serif;font-weight:bold;font-size:18px;letter-spacing:2px;color:#4a1010;";
    wantedLbl.textContent = 'WANTED';
    var bountyState = document.createElement('select');
    bountyState.style.cssText =
      'background:transparent;border:1px solid #aaa;font-size:10px;font-weight:bold;padding:2px;';
    ['DEAD OR ALIVE', 'ONLY ALIVE'].forEach(function (o) {
      var op = document.createElement('option');
      op.value = o;
      op.textContent = o;
      bountyState.appendChild(op);
    });
    bountyState.value = s.bountyState || 'DEAD OR ALIVE';
    bountyState.onchange = function () {
      s.bountyState = this.value;
      ss();
    };
    var bountyCur = document.createElement('input');
    bountyCur.type = 'number';
    bountyCur.placeholder = 'Taglia Attuale (\u0E3F)';
    bountyCur.value = s.bountyCur || '';
    bountyCur.style.cssText =
      'flex:1;background:transparent;border:1px dashed #aaa;text-align:right;font-weight:bold;font-size:14px;padding:2px;';
    bountyCur.oninput = function () {
      s.bountyCur = this.value;
      ss();
    };
    var bountyPrev = document.createElement('input');
    bountyPrev.type = 'number';
    bountyPrev.placeholder = 'Taglia Prec. (\u0E3F)';
    bountyPrev.value = s.bountyPrev || '';
    bountyPrev.style.cssText =
      'flex:0.8;background:transparent;border:1px dashed #aaa;text-align:right;font-size:10px;color:#555;padding:2px;';
    bountyPrev.oninput = function () {
      s.bountyPrev = this.value;
      ss();
    };
    hR3.appendChild(wantedLbl);
    hR3.appendChild(bountyState);
    hR3.appendChild(bountyCur);
    hR3.appendChild(bountyPrev);
    hdr1.appendChild(hR1);
    hdr1.appendChild(hR2);
    hdr1.appendChild(hR3);
  } else {
    var hR1 = document.createElement('div');
    hR1.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #aaa;';
    hR1.appendChild(makeHdrCell('Classe & Livello', 'classelivello', true));
    hR1.appendChild(makeHdrCell('Background', 'background', false));
    hR1.appendChild(makeHdrCell('Nome Giocatore', 'nomeGiocatore', false));
    var hR2 = document.createElement('div');
    hR2.style.cssText = 'display:grid;grid-template-columns:2.5fr 1fr 1fr 1fr;';
    var nomeCell = document.createElement('div');
    nomeCell.style.cssText = 'padding:3px 4px;';
    var nomeInp1 = document.createElement('input');
    nomeInp1.type = 'text';
    nomeInp1.setAttribute('aria-label', 'Nome Personaggio');
    nomeInp1.value = s.nomePersonaggio || '';
    nomeInp1.style.cssText =
      'width:100%;border:none;background:transparent;color:#111;font-size:14px;font-weight:bold;outline:none;';
    nomeInp1.oninput = function () {
      s.nomePersonaggio = this.value;
      ss();
    };
    nomeCell.appendChild(nomeInp1);
    nomeCell.appendChild(cellLbl('Nome Personaggio'));
    hR2.appendChild(nomeCell);
    hR2.appendChild(makeHdrCell('Razza', 'razza', false));
    hR2.appendChild(makeHdrCell('Allineamento', 'allineamento', false));
    hR2.appendChild(makeHdrCell('Punti Esperienza', 'pe', false));
    hdr1.appendChild(hR1);
    hdr1.appendChild(hR2);
  }
  pg1.appendChild(hdr1);
  /* Main grid */
  var mg = document.createElement('div');
  mg.style.cssText =
    'display:grid;grid-template-columns:88px 186px 1fr 1fr;gap:5px;flex:1;align-items:stretch;';
  /* COL A - Stats */
  var cA = document.createElement('div');
  [
    ['Forza', 'for'],
    ['Destrezza', 'des'],
    ['Costituzione', 'cos'],
    ['Intelligenza', 'int'],
    ['Saggezza', 'sag'],
    ['Carisma', 'car'],
  ].forEach(function (st) {
    cA.appendChild(makeStatBox(st[0], st[1]));
  });
  mg.appendChild(cA);
  /* COL B - Saves/Skills */
  var cB = document.createElement('div');
  cB.style.cssText = 'display:flex;flex-direction:column;';
  var ispRow1 = document.createElement('div');
  ispRow1.style.cssText = 'display:flex;gap:4px;margin-bottom:5px;';
  var ispBox1 = document.createElement('div');
  ispBox1.style.cssText =
    'flex:1;border:1.5px solid #666;border-radius:3px;text-align:center;padding:3px;cursor:pointer;';
  var ispIco = document.createElement('div');
  ispIco.style.cssText = 'font-size:14px;';
  ispIco.textContent = s.ispirazione ? '★' : '☆';
  ispBox1.onclick = function () {
    s.ispirazione = !s.ispirazione;
    ispIco.textContent = s.ispirazione ? '★' : '☆';
    ss();
  };
  ispBox1.appendChild(ispIco);
  ispBox1.appendChild(cellLbl('Ispirazione'));
  var bcBox1 = document.createElement('div');
  bcBox1.style.cssText =
    'flex:1;border:1.5px solid #666;border-radius:3px;text-align:center;padding:3px;';
  var bcInp1 = document.createElement('input');
  bcInp1.type = 'number';
  bcInp1.min = 2;
  bcInp1.max = 6;
  bcInp1.value = parseInt(s.bonusCompetenza) || 2;
  bcInp1.style.cssText =
    'width:100%;text-align:center;font-size:18px;font-weight:bold;color:#111;background:transparent;border:none;outline:none;';
  bcInp1.oninput = function () {
    s.bonusCompetenza = parseInt(this.value) || 2;
    updateSchedaDerived();
    ss();
  };
  bcBox1.appendChild(bcInp1);
  bcBox1.appendChild(cellLbl('Bonus di Competenza'));
  ispRow1.appendChild(ispBox1);
  ispRow1.appendChild(bcBox1);
  cB.appendChild(ispRow1);
  var tsBox1 = document.createElement('div');
  tsBox1.style.cssText = 'border:1px solid #aaa;border-radius:3px;padding:4px;margin-bottom:4px;';
  [
    ['Forza', 'for', 'tsFor'],
    ['Destrezza', 'des', 'tsDes'],
    ['Costituzione', 'cos', 'tsCos'],
    ['Intelligenza', 'int', 'tsInt'],
    ['Saggezza', 'sag', 'tsSag'],
    ['Carisma', 'car', 'tsCar'],
  ].forEach(function (ts) {
    tsBox1.appendChild(makeTsRow(ts[0], ts[1], ts[2]));
  });
  tsBox1.appendChild(secTitle('Tiri Salvezza'));
  cB.appendChild(tsBox1);
  var skBox1 = document.createElement('div');
  skBox1.style.cssText = 'border:1px solid #aaa;border-radius:3px;padding:4px;margin-bottom:4px;';
  [
    ['Acrobazia', 'des', 'skAcrobazia', 'acrobazia', 'Des'],
    ['Addestrare Animali', 'sag', 'skAnimali', 'animali', 'Sag'],
    ['Arcano', 'int', 'skArcano', 'arcano', 'Int'],
    ['Atletica', 'for', 'skAtletica', 'atletica', 'For'],
    ['Furtività', 'des', 'skFurtivita', 'furtivita', 'Des'],
    ['Indagare', 'int', 'skIndagare', 'indagare', 'Int'],
    ['Inganno', 'car', 'skInganno', 'inganno', 'Car'],
    ['Intimidire', 'car', 'skIntimidire', 'intimidire', 'Car'],
    ['Intrattenere', 'car', 'skIntrattenere', 'intrattenere', 'Car'],
    ['Intuizione', 'sag', 'skIntuizione', 'intuizione', 'Sag'],
    ['Medicina', 'sag', 'skMedicina', 'medicina', 'Sag'],
    ['Natura', 'int', 'skNatura', 'natura', 'Int'],
    ['Percezione', 'sag', 'skPercezione', 'percezione', 'Sag'],
    ['Persuasione', 'car', 'skPersuasione', 'persuasione', 'Car'],
    ['Rapidità di Mano', 'des', 'skRapidita', 'rapidita', 'Des'],
    ['Religione', 'int', 'skReligione', 'religione', 'Int'],
    ['Sopravvivenza', 'sag', 'skSopravvivenza', 'sopravvivenza', 'Sag'],
    ['Storia', 'int', 'skStoria', 'storia', 'Int'],
    ['Tecnologia', 'int', 'skTecnologia', 'tecnologia', 'Int'],
  ].forEach(function (sk) {
    skBox1.appendChild(makeSkillRow(sk[0], sk[1], sk[2], sk[3], sk[4]));
  });
  skBox1.appendChild(secTitle('Abilità'));
  cB.appendChild(skBox1);
  var ppRow1 = document.createElement('div');
  ppRow1.style.cssText =
    'display:flex;align-items:center;gap:4px;border:1px solid #aaa;border-radius:2px;padding:3px;margin-bottom:4px;';
  var ppVal1 = document.createElement('div');
  ppVal1.id = 'pd-pass-perc';
  ppVal1.style.cssText =
    'font-size:16px;font-weight:bold;min-width:24px;text-align:center;border:1.5px solid #555;border-radius:3px;padding:0 3px;';
  ppVal1.textContent = 10 + m(s.sag) + (s.skPercezione ? parseInt(s.bonusCompetenza) || 2 : 0);
  var ppLbl1 = document.createElement('div');
  ppLbl1.style.cssText = 'font-size:7px;color:#444;line-height:1.3;';
  ppLbl1.textContent = 'Saggezza (Percezione) Passiva';
  ppRow1.appendChild(ppVal1);
  ppRow1.appendChild(ppLbl1);
  cB.appendChild(ppRow1);
  var altBox1 = document.createElement('div');
  altBox1.style.cssText =
    'border:1px solid #aaa;border-radius:2px;flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:80px;';
  var altTa1 = document.createElement('textarea');
  altTa1.style.cssText =
    'width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;flex:1;height:0;box-sizing:border-box;';
  altTa1.value = s.altreCompetenze || '';
  altTa1.oninput = function () {
    s.altreCompetenze = this.value;
    ss();
  };
  altBox1.appendChild(altTa1);
  altBox1.appendChild(secTitle('Altre Competenze & Linguaggi'));
  cB.appendChild(altBox1);
  mg.appendChild(cB);
  /* COL C - Combat */
  var cC = document.createElement('div');
  cC.style.cssText = 'display:flex;flex-direction:column;';
  var cavRow1 = document.createElement('div');
  cavRow1.style.cssText = 'display:flex;gap:4px;margin-bottom:5px;';
  [
    ['CA', 'ca'],
    ['Iniziativa', 'iniziativa'],
    ['Velocità', 'velocita'],
  ].forEach(function (cf) {
    var b = document.createElement('div');
    b.style.cssText =
      'flex:1;border:2px solid #666;border-radius:3px;text-align:center;padding:3px;';
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = s[cf[1]] || '';
    inp.style.cssText =
      'width:100%;text-align:center;font-size:18px;font-weight:bold;color:#111;background:transparent;border:none;outline:none;';
    (function (k) {
      inp.oninput = function () {
        s[k] = this.value;
        ss();
      };
    })(cf[1]);
    b.appendChild(inp);
    b.appendChild(cellLbl(cf[0]));
    cavRow1.appendChild(b);
  });
  cC.appendChild(cavRow1);
  var hpMaxB1 = document.createElement('div');
  hpMaxB1.style.cssText = 'border:1px solid #aaa;border-radius:2px;padding:3px;margin-bottom:4px;';
  var hpMaxI1 = document.createElement('input');
  hpMaxI1.type = 'text';
  hpMaxI1.value = s.hpMax || '';
  hpMaxI1.style.cssText =
    'width:100%;background:transparent;border:none;border-bottom:1px solid #ccc;color:#111;font-size:12px;outline:none;padding:1px;';
  hpMaxI1.oninput = function () {
    s.hpMax = this.value;
    ss();
  };
  hpMaxB1.appendChild(hpMaxI1);
  hpMaxB1.appendChild(cellLbl('Massimo dei Punti Ferita'));
  cC.appendChild(hpMaxB1);
  var hpCurB1 = document.createElement('div');
  hpCurB1.style.cssText =
    'border:2px solid #555;border-radius:3px;padding:4px;margin-bottom:4px;text-align:center;';
  var hpCurI1 = document.createElement('input');
  hpCurI1.type = 'text';
  hpCurI1.value = s.hpAttuali || '';
  hpCurI1.style.cssText =
    'width:100%;text-align:center;background:transparent;border:none;color:#111;font-size:26px;font-weight:bold;outline:none;';
  hpCurI1.oninput = function () {
    s.hpAttuali = this.value;
    ss();
  };
  hpCurB1.appendChild(hpCurI1);
  hpCurB1.appendChild(cellLbl('Punti Ferita Attuali'));
  cC.appendChild(hpCurB1);
  var hpTmpB1 = document.createElement('div');
  hpTmpB1.style.cssText =
    'border:1px solid #aaa;border-radius:2px;padding:4px;margin-bottom:4px;text-align:center;';
  var hpTmpI1 = document.createElement('input');
  hpTmpI1.type = 'text';
  hpTmpI1.value = s.hpTemp || '';
  hpTmpI1.style.cssText =
    'width:100%;text-align:center;background:transparent;border:none;color:#111;font-size:20px;font-weight:bold;outline:none;';
  hpTmpI1.oninput = function () {
    s.hpTemp = this.value;
    ss();
  };
  hpTmpB1.appendChild(hpTmpI1);
  hpTmpB1.appendChild(cellLbl('Punti Ferita Temporanei'));
  cC.appendChild(hpTmpB1);
  var dvTsR1 = document.createElement('div');
  dvTsR1.style.cssText = 'display:flex;gap:4px;margin-bottom:5px;';
  var dvBox1 = document.createElement('div');
  dvBox1.style.cssText =
    'flex:1;border:1px solid #aaa;border-radius:2px;padding:3px;text-align:center;';
  var dvI1 = document.createElement('input');
  dvI1.type = 'text';
  dvI1.placeholder = '3d8';
  dvI1.value = s.dadiVita || '';
  dvI1.style.cssText =
    'width:100%;text-align:center;background:transparent;border:none;border-bottom:1px solid #bbb;color:#111;font-size:13px;font-weight:bold;outline:none;padding:1px;';
  dvI1.oninput = function () {
    s.dadiVita = this.value;
    ss();
  };
  dvBox1.appendChild(dvI1);
  dvBox1.appendChild(cellLbl('Dadi Vita'));
  dvTsR1.appendChild(dvBox1);
  var tsmB1 = document.createElement('div');
  tsmB1.style.cssText = 'flex:1.3;border:1px solid #aaa;border-radius:2px;padding:3px;';
  tsmB1.innerHTML =
    '<div style="font-size:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#555;text-align:center;margin-bottom:3px;">TS Contro Morte</div>';
  function makeDeathRow(label, arrKey, color) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:3px;margin-bottom:2px;';
    var lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:8px;min-width:44px;';
    lbl.textContent = label;
    var bubs = document.createElement('div');
    bubs.style.cssText = 'display:flex;gap:3px;';
    s[arrKey].forEach(function (v, i) {
      var bub = document.createElement('div');
      bub.style.cssText =
        'width:14px;height:14px;border-radius:50%;border:1.5px solid #555;cursor:pointer;background:' +
        (v ? color : 'transparent') +
        ';';
      (function (arr, idx, c) {
        bub.onclick = function () {
          s[arr][idx] = !s[arr][idx];
          this.style.background = s[arr][idx] ? c : 'transparent';
          ss();
        };
      })(arrKey, i, color);
      bubs.appendChild(bub);
    });
    row.appendChild(lbl);
    row.appendChild(bubs);
    return row;
  }
  tsmB1.appendChild(makeDeathRow('Successi', 'successi', '#555'));
  tsmB1.appendChild(makeDeathRow('Fallimenti', 'fallimenti', '#c00'));
  dvTsR1.appendChild(tsmB1);
  cC.appendChild(dvTsR1);

  var atkB1 = document.createElement('div');
  atkB1.style.cssText = 'border:1px solid #aaa;border-radius:2px;padding:4px;margin-bottom:4px;';
  var atkT1 = document.createElement('table');
  atkT1.style.cssText = 'width:100%;border-collapse:collapse;';
  atkT1.innerHTML =
    '<thead><tr><th style="font-size:6px;font-weight:bold;text-transform:uppercase;color:#555;padding:1px 3px;border-bottom:1px solid #bbb;text-align:left;">Nome</th><th style="font-size:6px;font-weight:bold;text-transform:uppercase;color:#555;padding:1px 3px;border-bottom:1px solid #bbb;text-align:left;">Bonus Att.</th><th style="font-size:6px;font-weight:bold;text-transform:uppercase;color:#555;padding:1px 3px;border-bottom:1px solid #bbb;text-align:left;">Danni/Tipo</th></tr></thead>';
  var atkBd1 = document.createElement('tbody');
  s.attacchi.forEach(function (atk, i) {
    var tr = document.createElement('tr');
    ['nome', 'bonus', 'danni'].forEach(function (fk) {
      var td = document.createElement('td');
      td.style.padding = '1px 2px';
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.value = atk[fk] || '';
      inp.style.cssText =
        'width:100%;background:transparent;border:none;border-bottom:1px solid #e0e0e0;color:#111;font-size:10px;outline:none;padding:1px 0;';
      inp.onfocus = function () {
        this.style.borderBottomColor = '#555';
      };
      inp.onblur = function () {
        this.style.borderBottomColor = '#e0e0e0';
      };
      (function (ai, fk2) {
        inp.oninput = function () {
          s.attacchi[ai][fk2] = this.value;
          ss();
        };
      })(i, fk);
      td.appendChild(inp);
      tr.appendChild(td);
    });
    atkBd1.appendChild(tr);
  });
  atkT1.appendChild(atkBd1);
  atkB1.appendChild(atkT1);
  atkB1.appendChild(secTitle('Attacchi & Incantesimi'));
  cC.appendChild(atkB1);
  /* --- LIVELLO DI FOLLIA --- */
  var folliaB1 = document.createElement('div');
  folliaB1.style.cssText = 'border:1px solid #aaa;border-radius:2px;padding:4px;margin-bottom:4px;';
  var folliaTit = document.createElement('div');
  folliaTit.style.cssText =
    'font-size:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#555;text-align:center;margin-bottom:4px;';
  folliaTit.textContent = 'Livello di Follia';
  folliaB1.appendChild(folliaTit);
  var folliaRow = document.createElement('div');
  folliaRow.style.cssText = 'display:flex;justify-content:center;gap:5px;margin-bottom:2px;';
  for (var fi = 1; fi <= 5; fi++) {
    (function (lvl) {
      var bub = document.createElement('div');
      var isAct = (s.livelloFollia || 0) >= lvl;
      bub.style.cssText =
        'width:22px;height:22px;border-radius:50%;border:1.5px solid #7a3a7a;cursor:pointer;background:' +
        (isAct ? '#7a3a7a' : 'transparent') +
        ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;color:' +
        (isAct ? '#fff' : '#7a3a7a') +
        ';box-sizing:border-box;';
      bub.textContent = String(lvl);
      bub.onclick = function () {
        s.livelloFollia = (s.livelloFollia || 0) === lvl ? 0 : lvl;
        renderMain();
      };
      folliaRow.appendChild(bub);
    })(fi);
  }
  folliaB1.appendChild(folliaRow);
  cC.appendChild(folliaB1);
  var eqB1 = document.createElement('div');
  eqB1.style.cssText =
    'border:1px solid #aaa;border-radius:2px;flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:120px;';
  /* --- MONETE --- */
  if (isOP) {
    var monWrap = document.createElement('div');
    monWrap.style.cssText = 'flex-shrink:0;padding:3px 3px 2px;border-bottom:1px solid #ccc;';
    var monTitle = document.createElement('div');
    monTitle.style.cssText =
      'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.07em;color:#555;text-align:center;margin-bottom:3px;';
    monTitle.textContent = 'Finanze';
    monWrap.appendChild(monTitle);
    var credCell = document.createElement('div');
    credCell.style.cssText =
      'border:1px solid #c9a55c;border-radius:2px;padding:2px 4px;text-align:center;background:#faf3e3;display:flex;align-items:center;gap:4px;';
    var credLbl = document.createElement('div');
    credLbl.style.cssText =
      'font-size:8px;font-weight:bold;text-transform:uppercase;color:#4a1010;letter-spacing:0.06em;white-space:nowrap;flex-shrink:0;';
    credLbl.textContent = 'Berry (\u0E3F)';
    var credInp = document.createElement('input');
    credInp.type = 'number';
    credInp.value = s.berry || '';
    credInp.dataset.sheetField = 'berry';
    credInp.style.cssText =
      'flex:1;text-align:center;font-size:12px;font-weight:bold;background:transparent;border:none;border-bottom:1px dashed #c9a55c;color:#111;outline:none;padding:1px 0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;';
    credInp.oninput = function () {
      s.berry = this.value;
      ss();
    };
    credCell.appendChild(credLbl);
    credCell.appendChild(credInp);
    monWrap.appendChild(credCell);
    eqB1.appendChild(monWrap);
  } else {
    var monWrap = document.createElement('div');
    monWrap.style.cssText = 'flex-shrink:0;padding:3px 3px 2px;border-bottom:1px solid #ccc;';
    var monTitle = document.createElement('div');
    monTitle.style.cssText =
      'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.07em;color:#555;text-align:center;margin-bottom:3px;';
    monTitle.textContent = 'Monete';
    monWrap.appendChild(monTitle);
    var monGrid = document.createElement('div');
    monGrid.style.cssText =
      'display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-bottom:2px;';
    [
      ['Rame', 'rame', '#b87333'],
      ['Argento', 'argento', '#888'],
      ['Oro', 'oro', '#b8860b'],
      ['Platino', 'platino', '#7090a0'],
    ].forEach(function (m) {
      var cell = document.createElement('div');
      cell.style.cssText =
        'border:1px solid #ccc;border-radius:2px;padding:2px 1px;text-align:center;background:#fafafa;';
      var lbl = document.createElement('div');
      lbl.style.cssText =
        'font-size:5.5px;font-weight:bold;text-transform:uppercase;color:' +
        m[2] +
        ';letter-spacing:0.05em;margin-bottom:1px;';
      lbl.textContent = m[0];
      cell.appendChild(lbl);
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.value = s[m[1]] || '';
      inp.dataset.sheetField = m[1];
      inp.maxLength = 15;
      inp.style.cssText =
        'width:100%;text-align:center;font-size:7.5px;font-weight:bold;background:transparent;border:none;border-bottom:1px solid #ddd;color:#111;outline:none;padding:1px 0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;';
      (function (k) {
        inp.oninput = function () {
          s[k] = this.value;
          ss();
        };
      })(m[1]);
      cell.appendChild(inp);
      monGrid.appendChild(cell);
    });
    monWrap.appendChild(monGrid);
    /* Crediti \u2014 riga intera */
    var credCell = document.createElement('div');
    credCell.style.cssText =
      'border:1px solid #ccc;border-radius:2px;padding:2px 4px;text-align:center;background:#f0f8ff;display:flex;align-items:center;gap:4px;';
    var credLbl = document.createElement('div');
    credLbl.style.cssText =
      'font-size:5.5px;font-weight:bold;text-transform:uppercase;color:#1a6a9a;letter-spacing:0.06em;white-space:nowrap;flex-shrink:0;';
    credLbl.textContent = 'Crediti';
    var credInp = document.createElement('input');
    credInp.type = 'text';
    credInp.value = s.crediti || '';
    credInp.dataset.sheetField = 'crediti';
    credInp.maxLength = 18;
    credInp.style.cssText =
      'flex:1;text-align:center;font-size:8px;font-weight:bold;background:transparent;border:none;border-bottom:1px solid #9bc;color:#111;outline:none;padding:1px 0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;';
    credInp.oninput = function () {
      s.crediti = this.value;
      ss();
    };
    credCell.appendChild(credLbl);
    credCell.appendChild(credInp);
    monWrap.appendChild(credCell);
    eqB1.appendChild(monWrap);
  }
  /* --- EQUIPAGGIAMENTO --- */
  var eqTa1 = document.createElement('textarea');
  eqTa1.style.cssText =
    'width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;flex:1;height:0;box-sizing:border-box;';
  eqTa1.value = s.equipaggiamento || '';
  eqTa1.oninput = function () {
    s.equipaggiamento = this.value;
    ss();
  };
  eqB1.appendChild(eqTa1);
  eqB1.appendChild(secTitle('Equipaggiamento'));
  cC.appendChild(eqB1);
  mg.appendChild(cC);
  /* COL D - Traits */
  var cD = document.createElement('div');
  cD.style.cssText = 'display:flex;flex-direction:column;';
  [
    ['Tratti Caratteriali', 'trattiCar', 42],
    ['Ideali', 'ideali', 36],
    ['Legami', 'legami', 36],
    ['Difetti', 'difetti', 36],
  ].forEach(function (tf) {
    cD.appendChild(makeTraitBox(tf[0], tf[1], tf[2]));
  });
  cD.appendChild(makeTraitBox('Privilegi & Tratti', 'privilegi', 120, true));
  mg.appendChild(cD);
  pg1.appendChild(mg);
  return pg1;
}
