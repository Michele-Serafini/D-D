// naruto.js - D&D Naruto 5e System

window._narutoDefault = function(id) {
  return {
    id: id || '', schedaTipo: 'naruto', nomePersonaggio: '', clan: '', giocatore: '', classeLivello: '', villaggio: '', exp: '', avatar: '',
    profBonus: '+2', passives: { perception: 10, insight: 10 },
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saves: { str: false, dex: false, con: false, int: false, wis: false, cha: false },
    skills: {
      athletics: false, taijutsu: false, acrobatics: false, sleight: false, stealth: false, chakraControl: false,
      crafting: false, history: false, investigation: false, nature: false, ninjutsu: false,
      animal: false, insight: false, medicine: false, perception: false, survival: false, genjutsu: false,
      deception: false, intimidation: false, performance: false, persuasion: false
    },
    combat: { ac: 10, init: '+0', speed: 30, hpMax: 10, hpCurrent: 10, hpTemp: 0, hitDice: '', cpMax: 10, cpCurrent: 10, cpTemp: 0, chakraDice: '' },
    traits: { personality: '', ideals: '', bonds: '', flaws: '' },
    attacks: [{name:'', atk:'', dmg:''},{name:'', atk:'', dmg:''},{name:'', atk:'', dmg:''},{name:'', atk:'', dmg:''},{name:'', atk:'', dmg:''}],
    equipment: '', features: '',
    appearance: { age: '', height: '', weight: '', eyes: '', skin: '', hair: '', desc: '', backstory: '' },
    allies: '', natureAffinity: { fire: false, water: false, earth: false, lightning: false, wind: false },
    jutsuBonuses: { ninAtk: '', ninDc: '', taiAtk: '', taiDc: '', genAtk: '', genDc: '' },
    jutsu: { e: [], d: [], c: [], b: [], a: [], s: [] }
  };
};

window.renderNarutoSheet = function(scheda) {
  console.log('[NARUTO LOAD] Dati recuperati:', JSON.parse(JSON.stringify(scheda)));
  function handleAvatarClick(currentAvatar, callback) {
    var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.style.display = 'none';
    document.body.appendChild(fi);
    fi.onchange = function(e) {
      document.body.removeChild(fi);
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
          var max = 600; var ratio = Math.min(1, max/img.width, max/img.height);
          var cv = document.createElement('canvas'); cv.width = img.width * ratio; cv.height = img.height * ratio;
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          callback(cv.toDataURL('image/jpeg', 0.85));
        };
        img.src = ev.target.result;
      };
      rd.readAsDataURL(f);
    };
    // Handle cancellation to remove from DOM if user cancels file dialog
    window.addEventListener('focus', function handler() { setTimeout(function(){ if(fi.parentNode) document.body.removeChild(fi); }, 1000); window.removeEventListener('focus', handler); }, {once:true});
    fi.click();
  }

  // Aliases for global compatibility
  scheda.nomePersonaggio = scheda.nomePersonaggio || scheda.nome || '';
  scheda.classeLivello = scheda.classeLivello || scheda.classelivello || '';
  
  scheda.passives = scheda.passives || {};
  scheda.stats = scheda.stats || {}; scheda.saves = scheda.saves || {}; scheda.skills = scheda.skills || {};
  scheda.combat = scheda.combat || {}; scheda.traits = scheda.traits || {}; scheda.attacks = scheda.attacks || [];
  scheda.appearance = scheda.appearance || {}; scheda.natureAffinity = scheda.natureAffinity || {};
  scheda.jutsuBonuses = scheda.jutsuBonuses || {}; scheda.jutsu = scheda.jutsu || {};
  ['e','d','c','b','a','s'].forEach(function(k) { scheda.jutsu[k] = scheda.jutsu[k] || []; });

  let saveTimer = null;
  function save() { if (window.state && window.state.schedePGViewMode) return;
    scheda.nome = scheda.nomePersonaggio; // Sync back
    scheda.classelivello = scheda.classeLivello;
    if (!window._db || !window.state || !window.state.currentUser) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() { if (window.fbSaveScheda) window.fbSaveScheda(); }, 600);
  }

  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex; flex-direction:column; width:100%; height:100vh; overflow:hidden; background:#222; font-family: "Georgia", serif; position:relative;';

  var nav = document.createElement('div');
  nav.style.cssText = 'background:#1a1a1a; border-bottom:1px solid #333; padding:0.45rem 1rem; display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; position:sticky; top:0; z-index:200;';
  var bk = document.createElement('button');
  bk.innerHTML = '&#8592; Torna ai personaggi';
  bk.style.cssText = 'background:#444; border:1px solid #666; color:#ccc; border-radius:3px; padding:0.3rem 0.75rem; font-size:11px; cursor:pointer; font-family:"Cinzel", serif;';
  bk.onclick = function() {
    if(window.state && window.state.schedePGViewMode) { window.state.schedePGViewMode=false; window.state.schedePGOpenChar=null; window.state.schedaAttivaId=null; window.state.scheda={}; window.state.companions={}; }
    else { window.state.schedaAttivaId=null; window.state.scheda={}; }
    if (window.renderMain) window.renderMain();
  };
  nav.appendChild(bk);
  var sp = document.createElement('span'); sp.style.flex = '1'; nav.appendChild(sp);
  var lavToggle = document.createElement('button'); lavToggle.innerHTML = '📋 Lavagna Abilità'; lavToggle.style.cssText = 'background:#1a1a2e; border:1px solid #c9a55c; color:#c9a55c; border-radius:3px; padding:0.3rem 0.75rem; font-size:11px; cursor:pointer; font-family:\"Cinzel\", serif; margin-right:10px; font-weight:bold;';
  lavToggle.onclick = function() {
        if (window._toggleGlobalLavagna) window._toggleGlobalLavagna();
        else { window.state.lavagnaOpen = !window.state.lavagnaOpen; if (window.renderMain) window.renderMain(); }
    };
    nav.appendChild(lavToggle);

  var btnDel = document.createElement('button');
  btnDel.textContent = 'Elimina Scheda';
  btnDel.style.cssText = 'background:#4a1010; border:1px solid #c04040; color:#f08080; border-radius:3px; padding:0.3rem 0.75rem; font-size:11px; cursor:pointer; font-family:"Cinzel", serif;';
  btnDel.onclick = function() {
    if (!confirm('Sei sicuro di voler ELIMINARE DEFINITIVAMENTE questa scheda?')) return;
    if (window.state && window.state.schedaAttivaId) {
      if(window.fbDeleteSchedaItem) { window.fbDeleteSchedaItem(window.state.schedaAttivaId); }
      else if(window._db) { window._db.ref('schedePG/' + window.state.currentUser.username + '/chars/' + window.state.schedaAttivaId).remove(); }
      let idx = window.state.schedeList.findIndex(s => s.id === window.state.schedaAttivaId);
      if(idx>=0) window.state.schedeList.splice(idx,1);
      window.state.schedaAttivaId = null; window.state.scheda = {};
      if (window.renderMain) window.renderMain();
    }
  };
  var btnSave = document.createElement('button'); btnSave.textContent = 'SALVA SCHEDA'; btnSave.style.cssText = 'background:#2d4a22; border:1px solid #4caf50; color:#fff; border-radius:3px; padding:0.3rem 0.75rem; font-size:11px; cursor:pointer; font-family:Cinzel, serif; margin-right:10px; font-weight:bold;';
  btnSave.onclick = function() { save(); if(window.fbSaveScheda) window.fbSaveScheda(true); alert('Salvataggio forzato completato con successo!'); };
  if (!window.state || !window.state.schedePGViewMode) nav.appendChild(btnSave);
  if (!window.state || !window.state.schedePGViewMode) nav.appendChild(btnDel);
  wrap.appendChild(nav);

  var content = document.createElement('div');
  content.style.cssText = 'flex:1; overflow-y:auto; padding:20px;';
  window.state.schedaZoom = window.state.schedaZoom || 1;
  content.style.zoom = window.state.schedaZoom;
  content.addEventListener('wheel', function(e){
    if(e.ctrlKey || e.metaKey) {
      e.preventDefault();
      window.state.schedaZoom = Math.max(0.4, Math.min(2.5, window.state.schedaZoom - (e.deltaY > 0 ? 0.1 : -0.1)));
      content.style.zoom = window.state.schedaZoom;
    }
  }, {passive:false});

  var sheet = document.createElement('div');
  sheet.style.cssText = 'max-width:900px; margin:0 auto; background:#FFF; border:2px solid #000; padding:20px; box-shadow:0 0 20px rgba(0,0,0,0.5); color:#000;';

  function makeInput(obj, key, placeholder, width, styleExtra, isTextArea) {
    let el = document.createElement(isTextArea ? 'textarea' : 'input');
    if (!isTextArea) el.type = 'text';
    el.value = obj[key] || '';
    if (placeholder) el.placeholder = placeholder;
    el.style.cssText = 'border:none; border-bottom:1px solid #000; background:transparent; outline:none; font-family:inherit; padding:2px 4px; color:#000; ' + (styleExtra||'');
    if (width) el.style.width = width;
    el.oninput = function() { obj[key] = el.value; save(); }; el.onchange = function() { obj[key] = el.value; save(); if(window._schedaSaveTimer) { clearTimeout(window._schedaSaveTimer); window.fbSaveScheda(true); } };
    return el;
  }
  function makeCheckbox(obj, key) {
    let chk = document.createElement('input'); chk.type = 'checkbox';
    chk.checked = !!obj[key];
    chk.style.cssText = 'cursor:pointer; width:12px; height:12px; margin:0; appearance:auto;';
    chk.onchange = function() { obj[key] = chk.checked; save(); };
    return chk;
  }

  // ==== PAGE 1 ====
  var p1 = document.createElement('div'); p1.style.cssText = 'display:flex; flex-direction:column; gap:10px; margin-bottom:40px;';
  
  // Header Row
  var hRow = document.createElement('div'); hRow.style.cssText = 'display:flex; gap:20px; align-items:stretch;';
  
  var hLeft = document.createElement('div'); hLeft.style.cssText = 'display:flex; flex-direction:column; gap:5px; width:220px;';
  function leftBadge(lbl, k, obj) { var b=document.createElement('div'); b.style.cssText='border:2px solid #000; border-radius:20px; display:flex; align-items:center; padding:5px 10px; font-weight:bold; font-size:12px;'; b.appendChild(makeInput(obj, k, '', '30px', 'text-align:center; border:none; border-right:2px solid #000; font-size:16px; margin-right:10px;')); b.appendChild(document.createTextNode(lbl)); return b; }
  hLeft.appendChild(leftBadge('Proficiency Bonus', 'profBonus', scheda));
  var passRow = document.createElement('div'); passRow.style.cssText = 'display:flex; gap:5px;';
  function passBadge(lbl, k) { var b=document.createElement('div'); b.style.cssText='border:2px solid #000; border-radius:10px; display:flex; flex-direction:column; align-items:center; padding:2px; flex:1;'; var i=makeInput(scheda.passives, k, '', '100%', 'text-align:center; border:none; border-bottom:1px solid #000; font-size:14px; font-weight:bold;'); var l=document.createElement('div'); l.textContent=lbl; l.style.cssText='font-size:9px; text-align:center;'; b.appendChild(i); b.appendChild(l); return b; }
  passRow.appendChild(passBadge('Passive Perception', 'perception')); passRow.appendChild(passBadge('Passive Insight', 'insight'));
  hLeft.appendChild(passRow);
  var wof = document.createElement('div'); wof.style.cssText = 'border:2px solid #000; border-radius:20px; text-align:center; padding:5px; font-weight:bold; font-size:14px; letter-spacing:1px; margin-top:5px; cursor:pointer; transition:color 0.2s;'; wof.textContent = 'Will of Fire'; wof.style.color = scheda.willOfFire ? '#d32f2f' : '#000'; wof.onclick = function() { scheda.willOfFire = !scheda.willOfFire; wof.style.color = scheda.willOfFire ? '#d32f2f' : '#000'; save(); if(window._schedaSaveTimer) { clearTimeout(window._schedaSaveTimer); window.fbSaveScheda(true); } }; hLeft.appendChild(wof);
  hRow.appendChild(hLeft);
  
  var hRight = document.createElement('div'); hRight.style.cssText = 'flex:1; border:2px solid #000; border-radius:10px; padding:10px; display:flex; flex-direction:column; justify-content:space-between; box-shadow: 1px 1px 0 rgba(0,0,0,0.1);';
  var topF = document.createElement('div'); topF.style.cssText = 'display:flex; gap:10px; border-bottom:1px solid #000; padding-bottom:10px;';
  function labeledField(lbl, obj, k, flex) { var d=document.createElement('div'); d.style.flex = flex; var i=makeInput(obj, k, '', '100%', 'font-weight:bold; border:none;'); var l=document.createElement('div'); l.textContent=lbl; l.style.cssText='font-size:9px; text-transform:uppercase; color:#333; margin-top:2px;'; d.appendChild(i); d.appendChild(l); return d; }
  topF.appendChild(labeledField('CHARACTER NAME', scheda, 'nomePersonaggio', '2'));
  topF.appendChild(labeledField('CLAN', scheda, 'clan', '1'));
  topF.appendChild(labeledField('PLAYER NAME', scheda, 'giocatore', '1'));
  hRight.appendChild(topF);
  var botF = document.createElement('div'); botF.style.cssText = 'display:flex; gap:10px; padding-top:10px;';
  botF.appendChild(labeledField('CLASS & LEVEL', scheda, 'classeLivello', '1'));
  botF.appendChild(labeledField('EXPERIENCE POINTS', scheda, 'exp', '1'));
  hRight.appendChild(botF);
  hRow.appendChild(hRight);
  p1.appendChild(hRow);

  // Main columns
  var grid = document.createElement('div'); grid.style.cssText = 'display:grid; grid-template-columns:220px 1fr 250px; gap:20px;';
  
  // STATS (Left Col)
  var leftCol = document.createElement('div'); leftCol.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
  function makeStat(title, obj, modKey, skillsArr) {
    let b = document.createElement('div'); b.style.cssText = 'border:2px solid #000; border-radius:10px; display:flex; position:relative; padding-top:10px;';
    let bL = document.createElement('div'); bL.style.cssText = 'width:80px; display:flex; flex-direction:column; align-items:center; padding:5px; flex-shrink:0;';
    let t = document.createElement('div'); t.textContent = title; t.style.cssText = 'font-size:9px; font-weight:bold; margin-bottom:2px;'; bL.appendChild(t);
    let vI = makeInput(obj, modKey, '10', '100%', 'text-align:center; font-size:18px; font-weight:bold; border:none; margin-bottom:5px;'); bL.appendChild(vI);
    let mS = document.createElement('div'); mS.style.cssText = 'border:2px solid #000; border-radius:50%; width:30px; height:30px; line-height:26px; text-align:center; font-weight:bold; font-size:12px;';
    function updateMod() { let v=parseInt(vI.value)||0; let m=Math.floor((v-10)/2); mS.textContent=(m>=0?'+':'')+m; }
    updateMod(); vI.addEventListener('input', updateMod); bL.appendChild(mS);
    b.appendChild(bL);
    
    let bR = document.createElement('div'); bR.style.cssText = 'flex:1; border-left:1px solid #000; padding:5px 10px; display:flex; flex-direction:column; gap:3px;';
    let svD = document.createElement('div'); svD.style.cssText = 'display:flex; align-items:center; gap:5px; font-size:10px; font-weight:bold; margin-bottom:3px;';
    svD.appendChild(makeCheckbox(scheda.saves, modKey)); svD.appendChild(document.createTextNode('SAVING THROWS')); bR.appendChild(svD);
    skillsArr.forEach(sk => {
      let r = document.createElement('div'); r.style.cssText = 'display:flex; align-items:center; gap:5px; font-size:10px;';
      r.appendChild(makeCheckbox(scheda.skills, sk[0])); r.appendChild(document.createTextNode(sk[1])); bR.appendChild(r);
    });
    b.appendChild(bR);
    return b;
  }
  leftCol.appendChild(makeStat('STRENGTH', scheda.stats, 'str', [['athletics','Athletics'],['taijutsu','Taijutsu']]));
  leftCol.appendChild(makeStat('DEXTERITY', scheda.stats, 'dex', [['acrobatics','Acrobatics'],['sleight','Sleight of Hand'],['stealth','Stealth']]));
  leftCol.appendChild(makeStat('CONSTITUTION', scheda.stats, 'con', [['chakraControl','Chakra Control']]));
  leftCol.appendChild(makeStat('INTELLIGENCE', scheda.stats, 'int', [['crafting','Crafting'],['history','History'],['investigation','Investigation'],['nature','Nature'],['ninjutsu','Ninjutsu']]));
  leftCol.appendChild(makeStat('WISDOM', scheda.stats, 'wis', [['animal','Animal Handling'],['insight','Insight'],['medicine','Medicine'],['perception','Perception'],['survival','Survival'],['genjutsu','Genjutsu']]));
  leftCol.appendChild(makeStat('CHARISMA', scheda.stats, 'cha', [['deception','Deception'],['intimidation','Intimidation'],['performance','Performance'],['persuasion','Persuasion']]));
  grid.appendChild(leftCol);

  // COMBAT (Mid Col)
  var midCol = document.createElement('div'); midCol.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
  var cmbTop = document.createElement('div'); cmbTop.style.cssText = 'display:flex; justify-content:center; gap:10px;';
  function shieldBox(lbl, obj, k, bR) { var b=document.createElement('div'); b.style.cssText='border:2px solid #000; width:70px; height:80px; display:flex; flex-direction:column; align-items:center; justify-content:center; '+bR+'; box-shadow:1px 1px 0 rgba(0,0,0,0.1); background:#F9F9F9;'; var i=makeInput(obj,k,'','50px','text-align:center; font-size:22px; font-weight:bold; border:none; background:transparent;'); var l=document.createElement('div'); l.textContent=lbl; l.style.cssText='font-size:9px; font-weight:bold; text-align:center;'; b.appendChild(i); b.appendChild(l); return b; }
  cmbTop.appendChild(shieldBox('ARMOR CLASS', scheda.combat, 'ac', 'border-radius:10px 10px 50% 50%'));
  cmbTop.appendChild(shieldBox('INITIATIVE', scheda.combat, 'init', 'border-radius:10px'));
  cmbTop.appendChild(shieldBox('SPEED', scheda.combat, 'speed', 'border-radius:10px'));
  midCol.appendChild(cmbTop);

  var pools = document.createElement('div'); pools.style.cssText = 'border:2px solid #000; border-radius:10px; padding:10px; display:grid; grid-template-columns:1fr 1fr; gap:10px; box-shadow:1px 1px 0 rgba(0,0,0,0.1); background:#F9F9F9;';
  function pCol(lblMax, kMax, lblCur, kCur) { var c=document.createElement('div'); c.style.cssText='display:flex; flex-direction:column; align-items:center;'; var m=document.createElement('div'); m.style.cssText='font-size:10px; border-bottom:1px solid #000; width:100%; text-align:center; padding-bottom:2px;'; m.appendChild(document.createTextNode(lblMax)); m.appendChild(makeInput(scheda.combat, kMax, '', '40px', 'border:none; text-align:center; background:transparent;')); c.appendChild(m); var cur=makeInput(scheda.combat, kCur, '0', '100%', 'text-align:center; font-size:28px; font-weight:bold; border:none; margin-top:5px; background:transparent;'); c.appendChild(cur); var lC=document.createElement('div'); lC.textContent=lblCur; lC.style.cssText='font-size:10px; text-transform:uppercase;'; c.appendChild(lC); return c; }
  pools.appendChild(pCol('Hit Point Maximum ', 'hpMax', 'Current Hit Points', 'hpCurrent'));
  pools.appendChild(pCol('Chakra Point Maximum ', 'cpMax', 'Current Chakra', 'cpCurrent'));
  midCol.appendChild(pools);

  var dice = document.createElement('div'); dice.style.cssText = 'display:flex; gap:10px;';
  function dBox(lbl, k) { var b=document.createElement('div'); b.style.cssText='border:2px solid #000; border-radius:10px; padding:10px; flex:1; text-align:center; box-shadow:1px 1px 0 rgba(0,0,0,0.1); background:#F9F9F9;'; var tt=document.createElement('div'); tt.style.cssText='font-size:9px; text-align:left; border-bottom:1px solid #000; padding-bottom:2px;'; tt.innerHTML='Total <input style="width:40px; border:none; background:transparent;">'; b.appendChild(tt); var i=makeInput(scheda.combat, k, '', '100%', 'text-align:center; font-size:18px; border:none; margin-top:5px; background:transparent;'); b.appendChild(i); var l=document.createElement('div'); l.textContent=lbl; l.style.cssText='font-size:11px; font-weight:bold; margin-top:5px; text-transform:uppercase;'; b.appendChild(l); return b; }
  dice.appendChild(dBox('Hit Die', 'hitDice')); dice.appendChild(dBox('Chakra Die', 'chakraDice'));
  midCol.appendChild(dice);

  var atkBox = document.createElement('div'); atkBox.style.cssText = 'border:2px solid #000; border-radius:10px; padding:10px; flex:1; display:flex; flex-direction:column; box-shadow:1px 1px 0 rgba(0,0,0,0.1);';
  var atkH = document.createElement('div'); atkH.style.cssText = 'display:grid; grid-template-columns:2fr 1fr 2fr; font-size:9px; font-weight:bold; color:#666; margin-bottom:5px;'; atkH.innerHTML = '<span>NAME</span><span style="text-align:center">ATK BONUS</span><span>DAMAGE/TYPE</span>'; atkBox.appendChild(atkH);
  scheda.attacks.forEach(a => {
    var r = document.createElement('div'); r.style.cssText = 'display:grid; grid-template-columns:2fr 1fr 2fr; gap:5px; margin-bottom:5px; background:#EEE; border-radius:4px; padding:2px;';
    r.appendChild(makeInput(a, 'name', '', '100%', 'background:transparent; border:none; font-size:12px;'));
    r.appendChild(makeInput(a, 'atk', '', '100%', 'background:transparent; border:none; text-align:center; font-size:12px;'));
    r.appendChild(makeInput(a, 'dmg', '', '100%', 'background:transparent; border:none; font-size:12px;'));
    atkBox.appendChild(r);
  });
  var atkF = document.createElement('div'); atkF.textContent = 'ATTACKS & JUTSU'; atkF.style.cssText = 'font-weight:bold; text-align:center; margin-top:auto; font-size:12px; padding-top:10px;'; atkBox.appendChild(atkF);
  midCol.appendChild(atkBox);
  grid.appendChild(midCol);

  // TRAITS (Right Col)
  var rightCol = document.createElement('div'); rightCol.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
  function tBox(lbl, k, obj, h) { var b=document.createElement('div'); b.style.cssText='border:2px solid #000; border-radius:10px; padding:8px; display:flex; flex-direction:column; min-height:'+h+'px; box-shadow:1px 1px 0 rgba(0,0,0,0.1);'; var i=makeInput(obj, k, '', '100%', 'flex:1; resize:none; border:none; padding:0; font-size:11px; background:transparent;', true); var l=document.createElement('div'); l.textContent=lbl; l.style.cssText='font-size:9px; text-transform:uppercase; text-align:center; margin-top:4px;'; b.appendChild(i); b.appendChild(l); return b; }
  rightCol.appendChild(tBox('PERSONALITY TRAITS', 'personality', scheda.traits, 70));
  rightCol.appendChild(tBox('IDEALS', 'ideals', scheda.traits, 60));
  rightCol.appendChild(tBox('BONDS', 'bonds', scheda.traits, 60));
  rightCol.appendChild(tBox('FLAWS', 'flaws', scheda.traits, 60));
  var featBox = document.createElement('div'); featBox.style.cssText = 'border:2px solid #000; border-radius:10px; padding:10px; display:flex; flex-direction:column; flex:1; min-height:150px; box-shadow:1px 1px 0 rgba(0,0,0,0.1);';
  featBox.appendChild(makeInput(scheda, 'features', '', '100%', 'flex:1; resize:none; border:none; padding:0; font-size:11px; background:transparent;', true));
  var featLbl = document.createElement('div'); featLbl.textContent='FEATURES & TRAITS & PROFICIENCIES'; featLbl.style.cssText='font-size:10px; font-weight:bold; text-align:center; margin-top:5px;'; featBox.appendChild(featLbl);
  rightCol.appendChild(featBox);
  grid.appendChild(rightCol);
  p1.appendChild(grid);
  
  var eqBox = document.createElement('div'); eqBox.style.cssText = 'border:2px solid #000; border-radius:10px; padding:10px; display:flex; flex-direction:column; min-height:150px; box-shadow:1px 1px 0 rgba(0,0,0,0.1); margin-top:10px;';
  eqBox.appendChild(makeInput(scheda, 'equipment', '', '100%', 'flex:1; resize:none; border:none; font-size:11px; background:transparent;', true));
  var eqL = document.createElement('div'); eqL.textContent = 'EQUIPMENT'; eqL.style.cssText = 'font-weight:bold; text-align:center; font-size:12px; margin-top:5px;'; eqBox.appendChild(eqL);
  p1.appendChild(eqBox);
  sheet.appendChild(p1);

  // ==== PAGE 2 ====
  var p2 = document.createElement('div'); p2.style.cssText = 'display:flex; flex-direction:column; gap:20px; border-top:4px double #000; padding-top:40px; margin-bottom:40px;';
  
  var p2h = document.createElement('div'); p2h.style.cssText = 'display:flex; border:2px solid #000; border-radius:10px; box-shadow:1px 1px 0 rgba(0,0,0,0.1); align-items:stretch;';
  var p2hL = document.createElement('div'); p2hL.style.cssText = 'width:80px; display:flex; align-items:center; justify-content:center; border-right:2px solid #000; padding:10px; font-size:24px; font-weight:bold;'; p2hL.innerHTML = '&#9733;';
  p2h.appendChild(p2hL);
  var p2hR = document.createElement('div'); p2hR.style.cssText = 'flex:1; display:flex; flex-direction:column; padding:10px;';
  var p2hR1 = document.createElement('div'); p2hR1.style.cssText = 'display:flex; gap:10px; border-bottom:1px solid #000; padding-bottom:5px; margin-bottom:5px;';
  p2hR1.appendChild(labeledField('AGE', scheda.appearance, 'age', '1'));
  p2hR1.appendChild(labeledField('HEIGHT', scheda.appearance, 'height', '1'));
  p2hR1.appendChild(labeledField('WEIGHT', scheda.appearance, 'weight', '1'));
  p2hR.appendChild(p2hR1);
  var p2hR2 = document.createElement('div'); p2hR2.style.cssText = 'display:flex; gap:10px; border-bottom:1px solid #000; padding-bottom:5px; margin-bottom:5px;';
  p2hR2.appendChild(labeledField('EYES', scheda.appearance, 'eyes', '1'));
  p2hR2.appendChild(labeledField('SKIN', scheda.appearance, 'skin', '1'));
  p2hR2.appendChild(labeledField('HAIR', scheda.appearance, 'hair', '1'));
  p2hR.appendChild(p2hR2);
  var chN = document.createElement('div'); chN.textContent = 'CHARACTER NAME'; chN.style.cssText = 'font-size:10px; font-weight:bold; text-align:center;'; p2hR.appendChild(chN);
  p2h.appendChild(p2hR);
  p2.appendChild(p2h);

  var p2grid = document.createElement('div'); p2grid.style.cssText = 'display:grid; grid-template-columns:1fr 2fr; gap:20px;';
  
  var p2L = document.createElement('div'); p2L.style.cssText = 'display:flex; flex-direction:column; gap:20px;';
  var appBox = document.createElement('div'); appBox.style.cssText = 'border:2px solid #000; border-radius:10px; padding:10px; display:flex; flex-direction:column; min-height:250px; box-shadow:1px 1px 0 rgba(0,0,0,0.1);';
  var avWrap = document.createElement('div'); avWrap.style.cssText = 'width:100%; height:180px; border:2px dashed #CCC; margin-bottom:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden;';
  var avIm = document.createElement('img'); avIm.style.cssText = 'width:100%; height:100%; object-fit:contain; display:'+(scheda.avatar?'block':'none')+';'; avIm.src=scheda.avatar||'';
  var avT = document.createElement('span'); avT.textContent='Click to Add Picture'; avT.style.display=scheda.avatar?'none':'block'; avT.style.color='#999';
  avWrap.appendChild(avIm); avWrap.appendChild(avT);
  avWrap.onclick = function() {
    handleAvatarClick(scheda.avatar, function(url) {
      scheda.avatar = url; avIm.src = url;
      if(url){ avIm.style.display='block'; avT.style.display='none'; } else { avIm.style.display='none'; avT.style.display='block'; }
      save();
    });
  };
  appBox.appendChild(avWrap);
  var appL = document.createElement('div'); appL.textContent = 'CHARACTER APPEARANCE'; appL.style.cssText = 'font-weight:bold; text-align:center; font-size:12px; margin-top:auto;'; appBox.appendChild(appL);
  p2L.appendChild(appBox);
  
  var backBox = document.createElement('div'); backBox.style.cssText = 'border:2px solid #000; border-radius:10px; padding:10px; display:flex; flex-direction:column; min-height:400px; box-shadow:1px 1px 0 rgba(0,0,0,0.1);';
  backBox.appendChild(makeInput(scheda.appearance, 'backstory', '', '100%', 'flex:1; resize:none; border:none; font-size:11px; background:transparent;', true));
  var backL = document.createElement('div'); backL.textContent = 'CHARACTER BACKSTORY'; backL.style.cssText = 'font-weight:bold; text-align:center; font-size:12px; margin-top:5px;'; backBox.appendChild(backL);
  p2L.appendChild(backBox);
  p2grid.appendChild(p2L);

  var p2R = document.createElement('div'); p2R.style.cssText = 'display:flex; flex-direction:column; gap:20px;';
  var topRBox = document.createElement('div'); topRBox.style.cssText = 'border:2px solid #000; border-radius:10px; padding:10px; display:flex; min-height:300px; box-shadow:1px 1px 0 rgba(0,0,0,0.1); position:relative;';
  var vrBox = document.createElement('div'); vrBox.style.cssText = 'flex:1; border-right:1px solid #000; padding-right:10px; display:flex; flex-direction:column;';
  vrBox.appendChild(makeInput(scheda, 'villaggio', 'Village Rank...', '100%', 'border:none; font-weight:bold; margin-bottom:5px;'));
  vrBox.appendChild(makeInput(scheda, 'allies', '', '100%', 'flex:1; resize:none; border:none; background:transparent; font-size:11px;', true));
  var allL = document.createElement('div'); allL.textContent = 'ALLIES & ORGANIZATIONS'; allL.style.cssText = 'font-weight:bold; text-align:center; font-size:11px; margin-top:5px;'; vrBox.appendChild(allL);
  topRBox.appendChild(vrBox);
  var natBox = document.createElement('div');
  natBox.style.cssText = 'width:250px; padding-top:20px; display:flex; flex-direction:column; align-items:center; justify-content:center;';
  var circleCont = document.createElement('div');
  circleCont.style.cssText = 'width:200px; height:200px; border:2px solid #000; border-radius:50%; position:relative; background:#FFF; box-shadow:inset 0 0 10px rgba(0,0,0,0.1); margin:0 auto;';
  var title = document.createElement('div');
  title.textContent = 'Nature Affinity';
  title.style.cssText = 'position:absolute; top:-25px; left:50%; transform:translateX(-50%); font-weight:bold; font-size:16px; border-bottom:1px solid #000; padding-bottom:2px; white-space:nowrap; z-index:2;';
  circleCont.appendChild(title);
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '200'); svg.setAttribute('height', '200');
  svg.style.cssText = 'position:absolute; top:0; left:0; z-index:0;';
  var arrows = [
    '<defs><marker id="arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5 z" fill="#888"/></marker></defs>',
    '<path d="M 116,45 L 140,62" stroke="#888" stroke-width="3" marker-end="url(#arr)" />',
    '<path d="M 155,102 L 145,127" stroke="#888" stroke-width="3" marker-end="url(#arr)" />',
    '<path d="M 115,153 L 85,153" stroke="#888" stroke-width="3" marker-end="url(#arr)" />',
    '<path d="M 55,130 L 45,105" stroke="#888" stroke-width="3" marker-end="url(#arr)" />',
    '<path d="M 54,65 L 80,48" stroke="#888" stroke-width="3" marker-end="url(#arr)" />'
  ];
  svg.innerHTML = arrows.join('');
  circleCont.appendChild(svg);
  var elements = [
    { key: 'fire', label: 'Fire', kanji: '火', color: '#ef5350', cx: 100, cy: 35, lblCss: 'top:-18px; left:50%; transform:translateX(-50%);' },
    { key: 'wind', label: 'Wind', kanji: '風', color: '#80deea', cx: 162, cy: 80, lblCss: 'top:50%; right:-35px; transform:translateY(-50%);' },
    { key: 'lightning', label: 'Lightning', kanji: '雷', color: '#ffee58', cx: 138, cy: 153, lblCss: 'bottom:-18px; left:50%; transform:translateX(-50%);' },
    { key: 'earth', label: 'Earth', kanji: '土', color: '#ffb74d', cx: 62, cy: 153, lblCss: 'bottom:-18px; left:50%; transform:translateX(-50%);' },
    { key: 'water', label: 'Water', kanji: '水', color: '#5c6bc0', cx: 38, cy: 80, lblCss: 'top:50%; left:-40px; transform:translateY(-50%);' }
  ];
  elements.forEach(function(el) {
    var eNode = document.createElement('div');
    eNode.style.cssText = 'position:absolute; width:44px; height:44px; border:2px solid #000; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:bold; cursor:pointer; transition:background 0.2s; z-index:2; transform:translate(-50%, -50%);';
    eNode.style.top = el.cy + 'px';
    eNode.style.left = el.cx + 'px';
    eNode.textContent = el.kanji;
    var lbl = document.createElement('div');
    lbl.textContent = el.label;
    lbl.style.cssText = 'position:absolute; font-size:11px; font-family:sans-serif; font-weight:normal; background:#FFF; border:1px solid #CCC; padding:1px 4px; ' + el.lblCss;
    eNode.appendChild(lbl);
    function updateColor() {
      if(scheda.natureAffinity[el.key]) { eNode.style.background = el.color; eNode.style.color = (el.key==='water')?'#FFF':'#000'; }
      else { eNode.style.background = '#FFF'; eNode.style.color = '#000'; }
    }
    updateColor();
    eNode.onclick = function() { scheda.natureAffinity[el.key] = !scheda.natureAffinity[el.key]; updateColor(); save(); };
    circleCont.appendChild(eNode);
  });
  natBox.appendChild(circleCont);
  topRBox.appendChild(natBox);
  p2R.appendChild(topRBox);
  
  var addFeat = document.createElement('div'); addFeat.style.cssText = 'border:2px solid #000; border-radius:10px; padding:10px; display:flex; flex-direction:column; min-height:350px; box-shadow:1px 1px 0 rgba(0,0,0,0.1);';
  addFeat.appendChild(makeInput(scheda, 'features2', '', '100%', 'flex:1; resize:none; border:none; background:transparent; font-size:11px;', true));
  var addL = document.createElement('div'); addL.textContent = 'ADDITIONAL FEATURES & TRAITS'; addL.style.cssText = 'font-weight:bold; text-align:center; font-size:12px; margin-top:5px;'; addFeat.appendChild(addL);
  p2R.appendChild(addFeat);
  p2grid.appendChild(p2R);
  p2.appendChild(p2grid);
  sheet.appendChild(p2);

  // ==== PAGE 3 ====
  var p3 = document.createElement('div'); p3.style.cssText = 'border-top:4px double #000; padding-top:40px; display:flex; flex-direction:column; gap:20px;';
  var jutHeader = document.createElement('div'); jutHeader.style.cssText = 'display:flex; border:2px solid #000; border-radius:10px; overflow:hidden; box-shadow:1px 1px 0 rgba(0,0,0,0.1);';
  var jTitle = document.createElement('div'); jTitle.textContent = 'Jutsu List'; jTitle.style.cssText = 'padding:15px; font-size:18px; font-weight:bold; display:flex; align-items:center; border-right:2px solid #000;'; jutHeader.appendChild(jTitle);
  var jStats = document.createElement('div'); jStats.style.cssText = 'flex:1; display:flex; justify-content:space-around; align-items:center; padding:10px; background:#F9F9F9;';
  function jB(lbl1, k1, lbl2, k2) { var d=document.createElement('div'); d.style.cssText='display:flex; flex-direction:column; gap:5px;'; var r1=document.createElement('div'); r1.style.cssText='display:flex; align-items:center; gap:5px; font-size:10px;'; r1.appendChild(document.createTextNode(lbl1)); r1.appendChild(makeInput(scheda.jutsuBonuses, k1, '', '40px', 'border:1px solid #000; border-radius:5px; text-align:center;')); var r2=document.createElement('div'); r2.style.cssText='display:flex; align-items:center; gap:5px; font-size:10px;'; r2.appendChild(document.createTextNode(lbl2)); r2.appendChild(makeInput(scheda.jutsuBonuses, k2, '', '40px', 'border:1px solid #000; border-radius:5px; text-align:center;')); d.appendChild(r1); d.appendChild(r2); return d; }
  jStats.appendChild(jB('Ninjutsu Attack Bonus', 'ninAtk', 'Ninjutsu Save DC', 'ninDc'));
  jStats.appendChild(jB('Taijutsu Attack Bonus', 'taiAtk', 'Taijutsu Save DC', 'taiDc'));
  jStats.appendChild(jB('Genjutsu Attack Bonus', 'genAtk', 'Genjutsu Save DC', 'genDc'));
  jutHeader.appendChild(jStats);
  p3.appendChild(jutHeader);

  var jutRanks = document.createElement('div'); jutRanks.style.cssText = 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px;';
  function renderJutsuRank(rankKey, rankLabel) {
    let b = document.createElement('div'); b.style.cssText = 'border:2px solid #000; border-radius:10px; padding:10px; min-height:500px; display:flex; flex-direction:column; box-shadow:1px 1px 0 rgba(0,0,0,0.1); background:#FAFAFA;';
    let hl = document.createElement('div'); hl.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;';
    let span = document.createElement('div'); span.textContent = rankLabel; span.style.cssText='border:2px solid #000; padding:5px 20px; border-radius:20px; font-weight:bold; font-size:16px; background:#FFF;'; hl.appendChild(span);
    let addBtn = document.createElement('button'); addBtn.textContent = '+'; addBtn.style.cssText = 'cursor:pointer; background:#EEE; border:1px solid #000; border-radius:3px; width:24px; height:24px; font-weight:bold; padding:0;'; hl.appendChild(addBtn);
    b.appendChild(hl);
    let listCont = document.createElement('div'); listCont.style.cssText = 'display:flex; flex-direction:column; gap:4px; flex:1;';
    function drawList() {
      listCont.innerHTML = '';
      scheda.jutsu[rankKey].forEach((j, i) => {
        let r = document.createElement('div'); r.style.cssText = 'display:flex; gap:5px; align-items:center; border-bottom:1px solid #CCC; padding-bottom:2px;';
        let jI = makeInput(scheda.jutsu[rankKey], i, '', '100%', 'border:none; background:transparent; font-size:12px;'); jI.style.flex='1'; r.appendChild(jI);
        let rem = document.createElement('button'); rem.innerHTML = '&times;'; rem.style.cssText='cursor:pointer; background:none; border:none; color:#C00; font-size:14px; font-weight:bold; padding:0 2px;'; rem.onclick = function(){ scheda.jutsu[rankKey].splice(i,1); save(); drawList(); };
        r.appendChild(rem); listCont.appendChild(r);
      });
    }
    drawList();
    addBtn.onclick = function() { scheda.jutsu[rankKey].push(''); save(); drawList(); };
    b.appendChild(listCont); return b;
  }
  jutRanks.appendChild(renderJutsuRank('e', 'E-Rank'));
  jutRanks.appendChild(renderJutsuRank('c', 'C-Rank'));
  jutRanks.appendChild(renderJutsuRank('a', 'A-Rank'));
  jutRanks.appendChild(renderJutsuRank('d', 'D-Rank'));
  jutRanks.appendChild(renderJutsuRank('b', 'B-Rank'));
  jutRanks.appendChild(renderJutsuRank('s', 'S-Rank'));
  p3.appendChild(jutRanks);
  sheet.appendChild(p3);

  content.appendChild(sheet);
  wrap.appendChild(content);

  return wrap;
};