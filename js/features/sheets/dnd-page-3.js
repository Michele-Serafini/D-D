/* D&D character sheet, page 3. Fields share the active character context. */
function renderDndPage3(context) {
  var { makePage, isOP, s, ss, cellLbl, makeHdrCell, makeSpellBlock } = context;
  /* ==================== PAGINA 3 ==================== */
  var pg3 = makePage();
  pg3.style.minHeight = '1100px';
  if (isOP) {
    /* HEADER PAGE 3 - ONE PIECE */
    var hdr3 = document.createElement('div');
    hdr3.style.cssText =
      'border:1.5px solid #555;border-radius:3px;margin-bottom:8px;overflow:hidden;background:#faf3e3;text-align:center;padding:5px;';
    var hdrTitle = document.createElement('h2');
    hdrTitle.style.cssText =
      "margin:0;font-family:'Cinzel',serif;font-size:16px;color:#4a1010;letter-spacing:1px;";
    hdrTitle.textContent = 'ABILITÀ SPECIALI & POTERI';
    hdr3.appendChild(hdrTitle);
    pg3.appendChild(hdr3);

    var opFull = document.createElement('div');
    opFull.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    /* SEZIONE 1: DEVIL FRUIT */
    var dfBox = document.createElement('div');
    dfBox.style.cssText = 'border:1.5px solid #aaa;border-radius:3px;padding:8px;background:#fff;';
    var dfTop = document.createElement('div');
    dfTop.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #555;padding-bottom:4px;margin-bottom:8px;';
    var dfTitle = document.createElement('div');
    dfTitle.style.cssText = 'font-size:12px;font-weight:bold;color:#111;text-transform:uppercase;';
    dfTitle.textContent = 'Frutto del Diavolo';
    var dfToggleLbl = document.createElement('label');
    dfToggleLbl.style.cssText =
      'font-size:10px;font-weight:bold;display:flex;align-items:center;gap:4px;cursor:pointer;';
    var dfToggle = document.createElement('input');
    dfToggle.type = 'checkbox';
    dfToggle.checked = !!s.hasDF;
    dfToggle.onchange = function () {
      s.hasDF = this.checked;
      ss();
      renderMain();
    };
    dfToggleLbl.appendChild(dfToggle);
    dfToggleLbl.appendChild(document.createTextNode('Possiede un Frutto?'));
    dfTop.appendChild(dfTitle);
    dfTop.appendChild(dfToggleLbl);
    dfBox.appendChild(dfTop);

    if (s.hasDF) {
      // Row 1: Name, Type, Mastery
      var dfRow1 = document.createElement('div');
      dfRow1.style.cssText =
        'display:grid;grid-template-columns:2fr 2fr 1fr;gap:6px;margin-bottom:6px;';
      var dfNameB = document.createElement('div');
      dfNameB.style.cssText = 'border:1px solid #ccc;padding:2px 4px;';
      var dfNameI = document.createElement('input');
      dfNameI.type = 'text';
      dfNameI.value = s.dfName || '';
      dfNameI.style.cssText =
        'width:100%;border:none;outline:none;font-size:11px;background:transparent;font-weight:bold;';
      dfNameI.oninput = function () {
        s.dfName = this.value;
        ss();
      };
      dfNameB.appendChild(dfNameI);
      dfNameB.appendChild(cellLbl('Nome del Frutto'));
      dfRow1.appendChild(dfNameB);

      var dfTypeB = document.createElement('div');
      dfTypeB.style.cssText = 'border:1px solid #ccc;padding:2px 4px;';
      var dfTypeS = document.createElement('select');
      dfTypeS.style.cssText =
        'width:100%;border:none;outline:none;font-size:11px;background:transparent;font-weight:bold;';
      ['', 'Paramisha', 'Rogia', 'Zoan Comune', 'Zoan Mitologico', 'Zoan Antico'].forEach(
        function (o) {
          var op = document.createElement('option');
          op.value = o;
          op.textContent = o;
          dfTypeS.appendChild(op);
        }
      );
      dfTypeS.value = s.dfType || '';
      dfTypeS.onchange = function () {
        s.dfType = this.value;
        ss();
        renderMain();
      };
      dfTypeB.appendChild(dfTypeS);
      dfTypeB.appendChild(cellLbl('Tipo di Frutto'));
      dfRow1.appendChild(dfTypeB);

      var dfMastB = document.createElement('div');
      dfMastB.style.cssText = 'border:1px solid #ccc;padding:2px 4px;';
      var dfMastI = document.createElement('input');
      dfMastI.type = 'text';
      dfMastI.value = s.dfMastery || '';
      dfMastI.style.cssText =
        'width:100%;border:none;outline:none;font-size:11px;text-align:center;font-weight:bold;background:transparent;';
      dfMastI.oninput = function () {
        s.dfMastery = this.value;
        ss();
      };
      dfMastB.appendChild(dfMastI);
      dfMastB.appendChild(cellLbl('Livello Maestria'));
      dfRow1.appendChild(dfMastB);
      dfBox.appendChild(dfRow1);

      // Row 2: CD & Attack Bonus
      var dfRow2 = document.createElement('div');
      dfRow2.style.cssText =
        'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;';
      var dfCdB = document.createElement('div');
      dfCdB.style.cssText = 'border:1px solid #ccc;padding:4px;background:#f9f9f9;';
      var dfCdI = document.createElement('input');
      dfCdI.type = 'text';
      dfCdI.value = s.dfDC || '';
      dfCdI.style.cssText =
        'width:100%;border:none;outline:none;font-size:14px;text-align:center;font-weight:bold;background:transparent;';
      dfCdI.oninput = function () {
        s.dfDC = this.value;
        ss();
      };
      dfCdB.appendChild(dfCdI);
      dfCdB.appendChild(cellLbl('CD Salvezza Frutto'));
      dfRow2.appendChild(dfCdB);

      var dfAtkB = document.createElement('div');
      dfAtkB.style.cssText = 'border:1px solid #ccc;padding:4px;background:#f9f9f9;';
      var dfAtkI = document.createElement('input');
      dfAtkI.type = 'text';
      dfAtkI.value = s.dfAtkBonus || '';
      dfAtkI.style.cssText =
        'width:100%;border:none;outline:none;font-size:14px;text-align:center;font-weight:bold;background:transparent;';
      dfAtkI.oninput = function () {
        s.dfAtkBonus = this.value;
        ss();
      };
      dfAtkB.appendChild(dfAtkI);
      dfAtkB.appendChild(cellLbl('Bonus Attacco Frutto'));
      dfRow2.appendChild(dfAtkB);
      dfBox.appendChild(dfRow2);

      if (s.dfType && s.dfType.includes('Zoan')) {
        var dfZoanB = document.createElement('div');
        dfZoanB.style.cssText = 'border:1px solid #ccc;padding:4px;margin-bottom:6px;';
        var dfZoanI = document.createElement('textarea');
        dfZoanI.style.cssText =
          'width:100%;min-height:50px;border:none;outline:none;font-size:10px;background:transparent;resize:vertical;';
        dfZoanI.value = s.dfZoan || '';
        dfZoanI.oninput = function () {
          s.dfZoan = this.value;
          ss();
        };
        dfZoanB.appendChild(dfZoanI);
        dfZoanB.appendChild(cellLbl('Forma Animale & Forma Ibrida (Tratti, CA extra, Taglia)'));
        dfBox.appendChild(dfZoanB);
      }

      var dfAwB = document.createElement('div');
      dfAwB.style.cssText =
        'border:1px solid #ccc;padding:6px;margin-bottom:6px;background:#fdf9f9;';
      var dfAwT = document.createElement('label');
      dfAwT.style.cssText =
        'display:flex;align-items:center;gap:4px;cursor:pointer;margin-bottom:4px;';
      var dfAwChk = document.createElement('input');
      dfAwChk.type = 'checkbox';
      dfAwChk.checked = !!s.dfAwakened;
      dfAwChk.onchange = function () {
        s.dfAwakened = this.checked;
        ss();
        renderMain();
      };
      var dfAwL = document.createElement('span');
      dfAwL.style.cssText = 'font-size:11px;font-weight:bold;color:#833;text-transform:uppercase;';
      dfAwL.textContent = 'Risveglio (Awakening)';
      dfAwT.appendChild(dfAwChk);
      dfAwT.appendChild(dfAwL);
      dfAwB.appendChild(dfAwT);
      if (s.dfAwakened) {
        var dfAwI = document.createElement('textarea');
        dfAwI.style.cssText =
          'width:100%;min-height:60px;border:1px solid #eee;outline:none;font-size:10px;background:#fff;resize:vertical;padding:4px;box-sizing:border-box;';
        dfAwI.placeholder = 'Descrizione & Meccaniche del Risveglio...';
        dfAwI.value = s.dfAwDesc || '';
        dfAwI.oninput = function () {
          s.dfAwDesc = this.value;
          ss();
        };
        dfAwB.appendChild(dfAwI);
      }
      dfBox.appendChild(dfAwB);

      var dfWk = document.createElement('div');
      dfWk.style.cssText =
        'font-size:9px;color:#a33;font-weight:bold;margin-bottom:10px;text-align:center;background:#fff0f0;padding:4px;border:1px dashed #a33;';
      dfWk.textContent = 'DEBOLEZZE: Acqua Marina, Agalmatolite (Indebolimento e blocco poteri)';
      dfBox.appendChild(dfWk);

      // Dynamic Techniques Repeater
      var dfTech = document.createElement('div');
      dfTech.style.cssText = 'border-top:2px solid #aaa;padding-top:8px;';
      var dfTechH = document.createElement('div');
      dfTechH.style.cssText =
        'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
      var dfTechTitle = document.createElement('div');
      dfTechTitle.style.cssText =
        'font-size:11px;font-weight:bold;text-transform:uppercase;color:#111;';
      dfTechTitle.textContent = 'Tecniche del Frutto';
      var dfTechBtn = document.createElement('button');
      dfTechBtn.textContent = '+ Nuova Tecnica';
      dfTechBtn.style.cssText =
        'font-size:9px;padding:2px 6px;cursor:pointer;background:#444;color:#fff;border:none;border-radius:2px;';
      dfTechBtn.onclick = function () {
        if (!s.opTechs) s.opTechs = [];
        s.opTechs.push({ name: '', cost: '', action: '', dmg: '', desc: '' });
        ss();
        renderMain();
      };
      dfTechH.appendChild(dfTechTitle);
      dfTechH.appendChild(dfTechBtn);
      dfTech.appendChild(dfTechH);

      var techsList = document.createElement('div');
      techsList.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
      if (s.opTechs && s.opTechs.length > 0) {
        s.opTechs.forEach(function (t, i) {
          var tCard = document.createElement('div');
          tCard.style.cssText =
            'border:1px solid #ccc;border-left:3px solid #666;background:#fdfdfd;padding:6px;position:relative;';
          var tDel = document.createElement('div');
          tDel.textContent = '✕';
          tDel.style.cssText =
            'position:absolute;top:4px;right:4px;color:#999;cursor:pointer;font-size:10px;font-weight:bold;';
          tDel.onclick = function () {
            s.opTechs.splice(i, 1);
            ss();
            renderMain();
          };
          tCard.appendChild(tDel);

          var tr1 = document.createElement('div');
          tr1.style.cssText =
            'display:grid;grid-template-columns:3fr 1fr 2fr;gap:4px;margin-bottom:4px;padding-right:16px;';
          var ciN = document.createElement('input');
          ciN.type = 'text';
          ciN.placeholder = 'Nome Tecnica';
          ciN.value = t.name || '';
          ciN.style.cssText =
            'border:none;border-bottom:1px solid #bbb;outline:none;font-size:11px;font-weight:bold;background:transparent;width:100%;';
          ciN.oninput = function () {
            s.opTechs[i].name = this.value;
            ss();
          };
          tr1.appendChild(ciN);
          var ciC = document.createElement('input');
          ciC.type = 'text';
          ciC.placeholder = 'Costo Stamina';
          ciC.value = t.cost || '';
          ciC.style.cssText =
            'border:none;border-bottom:1px solid #bbb;outline:none;font-size:10px;background:transparent;width:100%;text-align:center;';
          ciC.oninput = function () {
            s.opTechs[i].cost = this.value;
            ss();
          };
          tr1.appendChild(ciC);
          var ciA = document.createElement('input');
          ciA.type = 'text';
          ciA.placeholder = 'Azione / Bonus / Reazione';
          ciA.value = t.action || '';
          ciA.style.cssText =
            'border:none;border-bottom:1px solid #bbb;outline:none;font-size:10px;background:transparent;width:100%;';
          ciA.oninput = function () {
            s.opTechs[i].action = this.value;
            ss();
          };
          tr1.appendChild(ciA);
          tCard.appendChild(tr1);

          var ciD = document.createElement('input');
          ciD.type = 'text';
          ciD.placeholder = 'Danno / Effetto e Gittata';
          ciD.value = t.dmg || '';
          ciD.style.cssText =
            'border:none;border-bottom:1px solid #bbb;outline:none;font-size:10px;background:transparent;width:100%;margin-bottom:4px;box-sizing:border-box;';
          ciD.oninput = function () {
            s.opTechs[i].dmg = this.value;
            ss();
          };
          tCard.appendChild(ciD);

          var ciDesc = document.createElement('textarea');
          ciDesc.placeholder = 'Descrizione / Tiro Salvezza...';
          ciDesc.style.cssText =
            'border:1px solid #eee;outline:none;font-size:9px;background:#fff;width:100%;min-height:35px;resize:vertical;box-sizing:border-box;padding:3px;';
          ciDesc.value = t.desc || '';
          ciDesc.oninput = function () {
            s.opTechs[i].desc = this.value;
            ss();
          };
          tCard.appendChild(ciDesc);

          techsList.appendChild(tCard);
        });
      } else {
        var noT = document.createElement('div');
        noT.style.cssText =
          'font-size:9px;color:#888;font-style:italic;text-align:center;padding:10px;';
        noT.textContent = 'Nessuna tecnica aggiunta.';
        techsList.appendChild(noT);
      }
      dfTech.appendChild(techsList);
      dfBox.appendChild(dfTech);
    }
    opFull.appendChild(dfBox);

    /* SEZIONE 2: HAKI */
    if (!s.haki) {
      s.haki = {
        pool: s.hakiPool || 0,
        kenbunshoku: {
          unlocked: !!s.hakiKen,
          stage: s.hakiKenLvl || 'Base',
          dc: 13,
          damageBonus: '+0',
          techniques: [],
        },
        busoshoku: {
          unlocked: !!s.hakiBus,
          stage: s.hakiBusLvl || 'Base',
          bypassesLogia: !!s.hakiBusRog,
          dc: 13,
          damageBonus: '+0',
          techniques: [],
        },
        haoshoku: {
          unlocked: !!s.hakiHao,
          stage: 'Base',
          dc: s.hakiHaoCD || 13,
          damageBonus: '+0',
          techniques: [],
        },
      };
      if (s.hakiKenDesc)
        s.haki.kenbunshoku.techniques.push({
          id: 1,
          name: 'Uso Generico',
          cost: '',
          dc: '',
          damage: '',
          desc: s.hakiKenDesc,
        });
      if (s.hakiBusDesc)
        s.haki.busoshoku.techniques.push({
          id: 1,
          name: 'Uso Generico',
          cost: '',
          dc: '',
          damage: '',
          desc: s.hakiBusDesc,
        });
      if (s.hakiHaoDesc)
        s.haki.haoshoku.techniques.push({
          id: 1,
          name: 'Uso Generico',
          cost: '',
          dc: s.hakiHaoCD || '',
          damage: '',
          desc: s.hakiHaoDesc,
        });
    } else {
      // Migration of older active properties to unlocked, and missing properties
      if (s.haki.kenbunshoku.active !== undefined) {
        s.haki.kenbunshoku.unlocked = s.haki.kenbunshoku.active;
        delete s.haki.kenbunshoku.active;
      }
      if (s.haki.busoshoku.active !== undefined) {
        s.haki.busoshoku.unlocked = s.haki.busoshoku.active;
        delete s.haki.busoshoku.active;
      }
      if (s.haki.haoshoku.active !== undefined) {
        s.haki.haoshoku.unlocked = s.haki.haoshoku.active;
        delete s.haki.haoshoku.active;
      }

      if (typeof s.haki.kenbunshoku.damageBonus === 'undefined')
        s.haki.kenbunshoku.damageBonus = '+0';
      if (typeof s.haki.busoshoku.damageBonus === 'undefined') s.haki.busoshoku.damageBonus = '+0';
      if (typeof s.haki.haoshoku.damageBonus === 'undefined') s.haki.haoshoku.damageBonus = '+0';
      if (typeof s.haki.haoshoku.stage === 'undefined') s.haki.haoshoku.stage = 'Base';
    }

    var hkBox = document.createElement('div');
    hkBox.style.cssText = 'border:1.5px solid #aaa;border-radius:3px;padding:8px;background:#fff;';
    var hkTop = document.createElement('div');
    hkTop.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:8px;';
    var hkTitle = document.createElement('div');
    hkTitle.style.cssText = 'font-size:12px;font-weight:bold;color:#111;text-transform:uppercase;';
    hkTitle.textContent = 'Ambizione (Haki)';
    var hkPoolB = document.createElement('div');
    hkPoolB.style.cssText =
      'display:flex;align-items:center;gap:6px;background:#f0f0f0;padding:2px 6px;border:1px solid #ccc;border-radius:2px;';
    var hkPoolL = document.createElement('div');
    hkPoolL.style.cssText = 'font-size:10px;font-weight:bold;';
    hkPoolL.textContent = 'Pool Dadi/Punti Haki:';
    var hkPoolI = document.createElement('input');
    hkPoolI.type = 'text';
    hkPoolI.value = s.haki.pool || '';
    hkPoolI.style.cssText =
      'width:50px;border:none;border-bottom:1px solid #aaa;background:transparent;text-align:center;font-size:12px;font-weight:bold;';
    hkPoolI.oninput = function () {
      s.haki.pool = this.value;
      ss();
    };
    hkPoolB.appendChild(hkPoolL);
    hkPoolB.appendChild(hkPoolI);
    hkTop.appendChild(hkTitle);
    hkTop.appendChild(hkPoolB);
    hkBox.appendChild(hkTop);

    var hkGrid = document.createElement('div');
    hkGrid.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    function renderHakiTechs(branchObj, parentEl) {
      var tl = document.createElement('div');
      tl.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:6px;';
      if (branchObj.techniques && branchObj.techniques.length) {
        branchObj.techniques.forEach(function (t, idx) {
          var tc = document.createElement('div');
          tc.style.cssText = 'border:1px solid #ddd;padding:4px;background:#fff;position:relative;';
          var r1 = document.createElement('div');
          r1.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;flex-wrap:wrap;';

          var inName = document.createElement('input');
          inName.type = 'text';
          inName.placeholder = 'Nome Tecnica';
          inName.value = t.name || '';
          inName.style.cssText =
            'min-width:100px;flex:1;font-size:10px;font-weight:bold;border:none;border-bottom:1px solid #bbb;outline:none;background:transparent;';
          inName.oninput = function () {
            t.name = this.value;
            ss();
          };
          r1.appendChild(inName);
          var inCost = document.createElement('input');
          inCost.type = 'text';
          inCost.placeholder = 'Costo';
          inCost.value = t.cost || '';
          inCost.style.cssText =
            'width:40px;font-size:10px;text-align:center;border:none;border-bottom:1px solid #bbb;outline:none;background:transparent;';
          inCost.oninput = function () {
            t.cost = this.value;
            ss();
          };
          r1.appendChild(inCost);
          var inDc = document.createElement('input');
          inDc.type = 'text';
          inDc.placeholder = 'CD';
          inDc.value = t.dc || '';
          inDc.style.cssText =
            'width:30px;font-size:10px;text-align:center;border:none;border-bottom:1px solid #bbb;outline:none;background:transparent;';
          inDc.oninput = function () {
            t.dc = this.value;
            ss();
          };
          r1.appendChild(inDc);
          var inDmg = document.createElement('input');
          inDmg.type = 'text';
          inDmg.placeholder = 'Danno';
          inDmg.value = t.damage || '';
          inDmg.style.cssText =
            'width:60px;font-size:10px;text-align:center;border:none;border-bottom:1px solid #bbb;outline:none;background:transparent;';
          inDmg.oninput = function () {
            t.damage = this.value;
            ss();
          };
          r1.appendChild(inDmg);

          var del = document.createElement('button');
          del.type = 'button';
          del.textContent = '✖';
          del.style.cssText =
            'background:transparent;border:none;color:#933;cursor:pointer;font-size:10px;padding:0 4px;';
          del.onclick = function (e) {
            e.preventDefault();
            branchObj.techniques.splice(idx, 1);
            ss();
            renderMain();
          };
          r1.appendChild(del);
          tc.appendChild(r1);

          var ta = document.createElement('textarea');
          ta.placeholder = 'Descrizione Effetto...';
          ta.value = t.desc || '';
          ta.style.cssText =
            'width:100%;font-size:9px;min-height:30px;border:1px solid #eee;resize:vertical;padding:3px;box-sizing:border-box;outline:none;';
          ta.oninput = function () {
            t.desc = this.value;
            ss();
          };
          tc.appendChild(ta);
          tl.appendChild(tc);
        });
      }
      var addB = document.createElement('button');
      addB.type = 'button';
      addB.textContent = '+ Aggiungi Tecnica';
      addB.style.cssText =
        'align-self:flex-start;font-size:9px;padding:2px 6px;cursor:pointer;background:#f0f0f0;border:1px solid #ccc;color:#333;border-radius:2px;';
      addB.onclick = function (e) {
        e.preventDefault();
        if (!branchObj.techniques) branchObj.techniques = [];
        branchObj.techniques.push({
          id: Date.now(),
          name: '',
          cost: '',
          dc: '',
          damage: '',
          desc: '',
        });
        ss();
        renderMain();
      };
      tl.appendChild(addB);
      parentEl.appendChild(tl);
    }

    function createBranchBaseInputs(branchObj, parentEl, hasLogia) {
      var r2 = document.createElement('div');
      r2.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:2px;flex-wrap:wrap;';
      var sel = document.createElement('select');
      sel.style.cssText = 'font-size:9px;padding:2px;border:1px solid #bbb;flex:1;background:#fff;';
      ['Base', 'Avanzato', 'Risvegliato / Maestro'].forEach(function (o) {
        var op = document.createElement('option');
        op.value = o;
        op.textContent = o;
        sel.appendChild(op);
      });
      sel.value = branchObj.stage;
      sel.onchange = function () {
        branchObj.stage = this.value;
        ss();
      };
      r2.appendChild(sel);

      var dcL = document.createElement('span');
      dcL.textContent = 'CD:';
      dcL.style.cssText = 'font-size:9px;font-weight:bold;';
      r2.appendChild(dcL);
      var dcI = document.createElement('input');
      dcI.type = 'text';
      dcI.value = branchObj.dc || '';
      dcI.style.cssText =
        'width:30px;font-size:9px;text-align:center;border:1px solid #bbb;background:#fff;';
      dcI.oninput = function () {
        branchObj.dc = this.value;
        ss();
      };
      r2.appendChild(dcI);

      var dmgL = document.createElement('span');
      dmgL.textContent = 'Danni:';
      dmgL.style.cssText = 'font-size:9px;font-weight:bold;';
      r2.appendChild(dmgL);
      var dmgI = document.createElement('input');
      dmgI.type = 'text';
      dmgI.value = branchObj.damageBonus || '';
      dmgI.style.cssText =
        'width:40px;font-size:9px;text-align:center;border:1px solid #bbb;background:#fff;';
      dmgI.oninput = function () {
        branchObj.damageBonus = this.value;
        ss();
      };
      r2.appendChild(dmgI);
      parentEl.appendChild(r2);

      if (hasLogia) {
        var busRog = document.createElement('label');
        busRog.style.cssText =
          'display:flex;align-items:center;gap:4px;font-size:9px;cursor:pointer;color:#833;margin-top:2px;';
        var busRogC = document.createElement('input');
        busRogC.type = 'checkbox';
        busRogC.checked = !!branchObj.bypassesLogia;
        busRogC.onchange = function () {
          branchObj.bypassesLogia = this.checked;
          ss();
        };
        busRog.appendChild(busRogC);
        busRog.appendChild(document.createTextNode('Colpisce la sostanza dei Rogia'));
        parentEl.appendChild(busRog);
      }
    }

    // Kenbunshoku
    var hkKen = document.createElement('div');
    hkKen.style.cssText =
      'border:1px solid #ccc;padding:6px;display:flex;flex-direction:column;gap:4px;background:#fafafa;';
    var hkKenT = document.createElement('label');
    hkKenT.style.cssText =
      'display:flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;cursor:pointer;border-bottom:1px solid #ddd;padding-bottom:2px;';
    var hkKenC = document.createElement('input');
    hkKenC.type = 'checkbox';
    hkKenC.checked = !!s.haki.kenbunshoku.unlocked;
    hkKenC.onchange = function () {
      s.haki.kenbunshoku.unlocked = this.checked;
      ss();
      renderMain();
    };
    hkKenT.appendChild(hkKenC);
    hkKenT.appendChild(document.createTextNode('Kenbunshoku (Osservazione)'));
    hkKen.appendChild(hkKenT);
    if (s.haki.kenbunshoku.unlocked) {
      createBranchBaseInputs(s.haki.kenbunshoku, hkKen, false);
      renderHakiTechs(s.haki.kenbunshoku, hkKen);
    }
    hkGrid.appendChild(hkKen);

    // Busoshoku
    var hkBus = document.createElement('div');
    hkBus.style.cssText =
      'border:1px solid #ccc;padding:6px;display:flex;flex-direction:column;gap:4px;background:#fafafa;';
    var hkBusT = document.createElement('label');
    hkBusT.style.cssText =
      'display:flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;cursor:pointer;border-bottom:1px solid #ddd;padding-bottom:2px;';
    var hkBusC = document.createElement('input');
    hkBusC.type = 'checkbox';
    hkBusC.checked = !!s.haki.busoshoku.unlocked;
    hkBusC.onchange = function () {
      s.haki.busoshoku.unlocked = this.checked;
      ss();
      renderMain();
    };
    hkBusT.appendChild(hkBusC);
    hkBusT.appendChild(document.createTextNode('Busoshoku (Armamento)'));
    hkBus.appendChild(hkBusT);
    if (s.haki.busoshoku.unlocked) {
      createBranchBaseInputs(s.haki.busoshoku, hkBus, true);
      renderHakiTechs(s.haki.busoshoku, hkBus);
    }
    hkGrid.appendChild(hkBus);

    // Haoshoku
    var hkHao = document.createElement('div');
    hkHao.style.cssText =
      'border:1px solid #ccc;padding:6px;display:flex;flex-direction:column;gap:4px;background:#fafafa;';
    var hkHaoT = document.createElement('label');
    hkHaoT.style.cssText =
      'display:flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;cursor:pointer;border-bottom:1px solid #ddd;padding-bottom:2px;';
    var hkHaoC = document.createElement('input');
    hkHaoC.type = 'checkbox';
    hkHaoC.checked = !!s.haki.haoshoku.unlocked;
    hkHaoC.onchange = function () {
      s.haki.haoshoku.unlocked = this.checked;
      ss();
      renderMain();
    };
    hkHaoT.appendChild(hkHaoC);
    hkHaoT.appendChild(document.createTextNode('Haoshoku (Re Conquistatore)'));
    hkHao.appendChild(hkHaoT);
    if (s.haki.haoshoku.unlocked) {
      createBranchBaseInputs(s.haki.haoshoku, hkHao, false);
      renderHakiTechs(s.haki.haoshoku, hkHao);
    }
    hkGrid.appendChild(hkHao);

    hkBox.appendChild(hkGrid);
    opFull.appendChild(hkBox);

    /* SEZIONE 3: TRATTI RAZZIALI E LOG POSE */
    var trBox = document.createElement('div');
    trBox.style.cssText = 'border:1.5px solid #aaa;border-radius:3px;padding:8px;background:#fff;';
    var trTop = document.createElement('div');
    trTop.style.cssText = 'border-bottom:2px solid #111;margin-bottom:6px;padding-bottom:2px;';
    var trTitle = document.createElement('div');
    trTitle.style.cssText = 'font-size:12px;font-weight:bold;color:#111;text-transform:uppercase;';
    trTitle.textContent = 'Tratti Fisiologici & Log Pose';
    trTop.appendChild(trTitle);
    trBox.appendChild(trTop);

    var rTog = document.createElement('div');
    rTog.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;';
    var rzList = [
      { id: 'Fish', n: 'Uomo-Pesce / Sirenetta' },
      { id: 'Mink', n: 'Vismone (Mink)' },
      { id: 'Cyb', n: 'Cyborg' },
      { id: 'Sky', n: 'Skypieano' },
    ];
    rzList.forEach(function (rz) {
      var rL = document.createElement('label');
      rL.style.cssText =
        'display:flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;cursor:pointer;background:#eee;padding:4px 8px;border-radius:3px;border:1px solid #ddd;';
      var rC = document.createElement('input');
      rC.type = 'checkbox';
      rC.checked = !!s['tr' + rz.id];
      rC.onchange = function () {
        s['tr' + rz.id] = this.checked;
        ss();
        renderMain();
      };
      rL.appendChild(rC);
      rL.appendChild(document.createTextNode(rz.n));
      rTog.appendChild(rL);
    });
    trBox.appendChild(rTog);

    var trDyn = document.createElement('div');
    trDyn.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;';
    if (s.trFish) {
      var bF = document.createElement('div');
      bF.style.cssText = 'border:1px solid #8ab;padding:4px;background:#eef5f9;';
      bF.innerHTML =
        '<div style="font-size:9px;font-weight:bold;color:#257;margin-bottom:2px;">Velocità Nuoto / Karate Uomini-Pesce</div>';
      var tF = document.createElement('textarea');
      tF.style.cssText =
        'width:100%;min-height:40px;border:1px solid #bcd;outline:none;font-size:9px;background:#fff;resize:vertical;box-sizing:border-box;padding:2px;';
      tF.value = s.trFishD || '';
      tF.oninput = function () {
        s.trFishD = this.value;
        ss();
      };
      bF.appendChild(tF);
      trDyn.appendChild(bF);
    }
    if (s.trMink) {
      var bM = document.createElement('div');
      bM.style.cssText = 'border:1px solid #a83;padding:4px;background:#fdf9ee;';
      bM.innerHTML =
        '<div style="font-size:9px;font-weight:bold;color:#752;margin-bottom:2px;">Electro / Sulong</div>';
      var tM = document.createElement('textarea');
      tM.style.cssText =
        'width:100%;min-height:40px;border:1px solid #dc9;outline:none;font-size:9px;background:#fff;resize:vertical;box-sizing:border-box;padding:2px;';
      tM.value = s.trMinkD || '';
      tM.oninput = function () {
        s.trMinkD = this.value;
        ss();
      };
      bM.appendChild(tM);
      trDyn.appendChild(bM);
    }
    if (s.trCyb) {
      var bC = document.createElement('div');
      bC.style.cssText = 'border:1px solid #888;padding:4px;background:#f0f0f0;';
      bC.innerHTML =
        '<div style="font-size:9px;font-weight:bold;color:#333;margin-bottom:2px;">Modifiche Corporee / Riserva Cola</div>';
      var tC = document.createElement('textarea');
      tC.style.cssText =
        'width:100%;min-height:40px;border:1px solid #ccc;outline:none;font-size:9px;background:#fff;resize:vertical;box-sizing:border-box;padding:2px;';
      tC.value = s.trCybD || '';
      tC.oninput = function () {
        s.trCybD = this.value;
        ss();
      };
      bC.appendChild(tC);
      trDyn.appendChild(bC);
    }
    if (s.trSky) {
      var bS = document.createElement('div');
      bS.style.cssText = 'border:1px solid #9aa;padding:4px;background:#f5f8f8;';
      bS.innerHTML =
        '<div style="font-size:9px;font-weight:bold;color:#355;margin-bottom:2px;">Dial Equipaggiati</div>';
      var tS = document.createElement('textarea');
      tS.style.cssText =
        'width:100%;min-height:40px;border:1px solid #cdd;outline:none;font-size:9px;background:#fff;resize:vertical;box-sizing:border-box;padding:2px;';
      tS.value = s.trSkyD || '';
      tS.oninput = function () {
        s.trSkyD = this.value;
        ss();
      };
      bS.appendChild(tS);
      trDyn.appendChild(bS);
    }
    trBox.appendChild(trDyn);

    var lpBox = document.createElement('div');
    lpBox.style.cssText = 'border-top:1px solid #aaa;padding-top:6px;';
    var lpT = document.createElement('div');
    lpT.style.cssText =
      'display:flex;align-items:center;background:#fff4e6;border:1px solid #dca;padding:4px 8px;border-radius:3px;';
    var lpL = document.createElement('div');
    lpL.style.cssText = 'font-size:11px;font-weight:bold;color:#852;';
    lpL.textContent = 'Log Pose Tracker:';
    var lpI = document.createElement('input');
    lpI.type = 'text';
    lpI.placeholder = 'Isola Registrata e tempo rimasto...';
    lpI.value = s.logPose || '';
    lpI.style.cssText =
      'flex:1;margin-left:8px;font-size:10px;border:none;border-bottom:1px solid #ccc;outline:none;background:transparent;';
    lpI.oninput = function () {
      s.logPose = this.value;
      ss();
    };
    lpT.appendChild(lpL);
    lpT.appendChild(lpI);
    lpBox.appendChild(lpT);
    trBox.appendChild(lpBox);

    opFull.appendChild(trBox);
    pg3.appendChild(opFull);

    /* INCANTESIMI TOGGLE - ONE PIECE */
    var spellToggleBox = document.createElement('div');
    spellToggleBox.style.cssText =
      'margin-top:16px; border:1.5px dashed #aaa; border-radius:4px; padding:12px; text-align:center; background:#faf3e3; margin-bottom:16px;';

    var spellToggleDesc = document.createElement('div');
    spellToggleDesc.style.cssText =
      'font-size:10px; color:#555; margin-bottom:8px; font-style:italic;';
    spellToggleDesc.textContent =
      'Attiva questa sezione per classi come Chemist, Priest, Skald, Tinkerer o Hybrid che usano slot incantesimo e formule preparate.';
    spellToggleBox.appendChild(spellToggleDesc);

    var spellToggleBtn = document.createElement('button');
    spellToggleBtn.style.cssText =
      'padding:6px 16px; font-size:12px; font-weight:bold; cursor:pointer; background:#fff; border:1px solid #aaa; border-radius:3px; color:#111; text-transform:uppercase;';
    spellToggleBtn.textContent = s.hasSpellcasting
      ? '- Nascondi Scheda Incantesimi / Formule'
      : '+ Abilita / Mostra Scheda Incantesimi';
    spellToggleBtn.onclick = function () {
      s.hasSpellcasting = !s.hasSpellcasting;
      ss();
      renderMain();
    };
    spellToggleBox.appendChild(spellToggleBtn);
    pg3.appendChild(spellToggleBox);
  }

  // BUILD SPELL SECTION
  if (!isOP || s.hasSpellcasting) {
    var spellContainer = document.createElement('div');
    if (isOP)
      spellContainer.style.cssText =
        'margin-top:16px; border-top:2px solid #555; padding-top:16px;';

    var hdr3 = document.createElement('div');
    hdr3.style.cssText =
      'border:1.5px solid #555;border-radius:3px;margin-bottom:8px;overflow:hidden;';
    var h3G = document.createElement('div');
    h3G.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr;';
    var h3N = document.createElement('div');
    h3N.style.cssText = 'padding:3px 4px;';
    var h3NI = document.createElement('input');
    h3NI.type = 'text';
    h3NI.value = s.classInc || '';
    h3NI.style.cssText =
      'width:100%;border:none;background:transparent;color:#111;font-size:12px;font-weight:bold;outline:none;';
    h3NI.oninput = function () {
      s.classInc = this.value;
      ss();
    };
    h3N.appendChild(h3NI);
    h3N.appendChild(cellLbl('Classe da Incantatore'));
    h3G.appendChild(h3N);
    h3G.appendChild(makeHdrCell('Caratteristica da Incantatore', 'carInc', false));
    h3G.appendChild(makeHdrCell('CD Tiro Salvezza Incantesimi', 'cdTs', false));
    h3G.appendChild(makeHdrCell('Bonus di Attacco Incantesimi', 'bonusAtkInc', false));
    hdr3.appendChild(h3G);
    spellContainer.appendChild(hdr3);
    var incG3 = document.createElement('div');
    incG3.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;';
    var iC1 = document.createElement('div');
    iC1.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    iC1.appendChild(
      makeSpellBlock(
        '0',
        s.trucchetti.map(function (n) {
          return { nome: n, prep: false };
        }),
        '',
        true
      )
    );
    iC1.appendChild(makeSpellBlock('1', s.sp1.lista, 'sp1', false));
    iC1.appendChild(makeSpellBlock('2', s.sp2.lista, 'sp2', false));
    incG3.appendChild(iC1);
    var iC2 = document.createElement('div');
    iC2.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    iC2.appendChild(makeSpellBlock('3', s.sp3.lista, 'sp3', false));
    iC2.appendChild(makeSpellBlock('4', s.sp4.lista, 'sp4', false));
    iC2.appendChild(makeSpellBlock('5', s.sp5.lista, 'sp5', false));
    incG3.appendChild(iC2);
    var iC3 = document.createElement('div');
    iC3.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    iC3.appendChild(makeSpellBlock('6', s.sp6.lista, 'sp6', false));
    iC3.appendChild(makeSpellBlock('7', s.sp7.lista, 'sp7', false));
    iC3.appendChild(makeSpellBlock('8', s.sp8.lista, 'sp8', false));
    iC3.appendChild(makeSpellBlock('9', s.sp9.lista, 'sp9', false));
    incG3.appendChild(iC3);
    spellContainer.appendChild(incG3);
    pg3.appendChild(spellContainer);
  }
  return pg3;
}
