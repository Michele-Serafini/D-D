// pokemon.js - D&D Pokemon Tabletop System

window._pokemonDefault = function(id) {
  return { id: id || '', schedaTipo: 'pokemon', nome: '', eta: '', giocatore: '', concept: '', rank: '', natura: '', confidence: '', soldi: '', hp: '', will: '', avatar: '', attrs: { str: 0, dex: 0, vit: 0, ins: 0 }, skills: { brawl: 0, throw: 0, evasion: 0, weapons: 0, alert: 0, athletic: 0, nature: 0, stealth: 0, allure: 0, etiquette: 0, intimidate: 0, perform: 0, crafts: 0, lore: 0, medicine: 0, science: 0 }, social: { tough: 0, cool: 0, beauty: 0, clever: 0, cute: 0 }, achievements: '', storiaPersonaggio: '', pokedex: { caught: '', seen: '' }, inventory: { potion: '', superPotion: '', hyperPotion: '', smallPocket: '', mainPocket: '' }, badges: ['', '', '', '', '', '', '', ''], party: [] };
};
window._pokemonMonDefault = function() {
  return { id: 'p' + Date.now() + Math.floor(Math.random()*1000), avatar: '', numero: '', nome: '', abilita: '', hp: '', will: '', held: '', status: '', init: '', acc: '', dmg: '', eva: '', clash: '', def: '', sdef: '', rank: '', mosse: [ { nome: '', tipo: '', freq: '', note: '' }, { nome: '', tipo: '', freq: '', note: '' }, { nome: '', tipo: '', freq: '', note: '' }, { nome: '', tipo: '', freq: '', note: '' }, { nome: '', tipo: '', freq: '', note: '' }, { nome: '', tipo: '', freq: '', note: '' } ], attrs: { str: 0, dex: 0, vit: 0, spc: 0, ins: 0 }, size: '', weight: '', social: { tough: 0, cool: 0, beauty: 0, cute: 0, clever: 0 }, natura: '', conf: '', hap: 0, loy: 0, battles: '', victories: '', accessories: '', tipo: '', weakness: '' };
};
window.renderPokemonSheet = function(scheda) {
  console.log('[POKEMON LOAD] Dati recuperati:', JSON.parse(JSON.stringify(scheda)));
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

  scheda.party = scheda.party || []; scheda.attrs = scheda.attrs || {}; scheda.skills = scheda.skills || {}; scheda.social = scheda.social || {}; scheda.inventory = scheda.inventory || {}; scheda.badges = scheda.badges || ['', '', '', '', '', '', '', '']; scheda.pokedex = scheda.pokedex || {};
  var wrap = document.createElement('div'); wrap.style.cssText = 'display:flex; flex-direction:column; width:100%; height:100%; overflow:hidden; background:#F1EAD3; font-family:"Arial Rounded MT Bold", "Nunito", sans-serif; position:relative;';
  var nav = document.createElement('div'); nav.style.cssText = 'background:#1a1a1a; border-bottom:1px solid #333; padding:0.45rem 1rem; display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; position:sticky; top:0; z-index:200;';
      var bk = document.createElement('button'); bk.innerHTML = '&#8592; Torna ai personaggi'; bk.style.cssText = 'background:#444; border:1px solid #666; color:#ccc; border-radius:3px; padding:0.3rem 0.75rem; font-size:11px; cursor:pointer; font-family:"Cinzel", serif;';
  bk.onclick = function() { if(window.state && window.state.schedePGViewMode) { window.state.schedePGViewMode=false; window.state.schedePGOpenChar=null; window.state.schedaAttivaId=null; window.state.scheda={}; window.state.companions={}; } else { window.state.schedaAttivaId=null; window.state.scheda={}; } if (window.renderMain) window.renderMain(); };
  nav.appendChild(bk); var sp = document.createElement('span'); sp.style.flex = '1'; nav.appendChild(sp);
  var lavToggle = document.createElement('button'); lavToggle.innerHTML = '📋 Lavagna Abilità'; lavToggle.style.cssText = 'background:#1a1a2e; border:1px solid #c9a55c; color:#c9a55c; border-radius:3px; padding:0.3rem 0.75rem; font-size:11px; cursor:pointer; font-family:\"Cinzel\", serif; margin-right:10px; font-weight:bold;';
  lavToggle.onclick = function() {
        if (window._toggleGlobalLavagna) window._toggleGlobalLavagna();
        else { window.state.lavagnaOpen = !window.state.lavagnaOpen; if (window.renderMain) window.renderMain(); }
    };
    nav.appendChild(lavToggle);

  var btnDel = document.createElement('button'); btnDel.textContent = 'Elimina Scheda'; btnDel.style.cssText = 'background:#4a1010; border:1px solid #c04040; color:#f08080; border-radius:3px; padding:0.3rem 0.75rem; font-size:11px; cursor:pointer; font-family:"Cinzel", serif;';
  btnDel.onclick = function() { if (!confirm('Sei sicuro di voler ELIMINARE DEFINITIVAMENTE questa scheda?')) return; if (window.state && window.state.schedaAttivaId) { if(window.fbDeleteSchedaItem) { window.fbDeleteSchedaItem(window.state.schedaAttivaId); } else if(window._db) { window._db.ref('schedePG/' + window.state.currentUser.username + '/chars/' + window.state.schedaAttivaId).remove(); } let idx = window.state.schedeList.findIndex(s => s.id === window.state.schedaAttivaId); if(idx>=0) window.state.schedeList.splice(idx,1); window.state.schedaAttivaId = null; window.state.scheda = {}; if (window.renderMain) window.renderMain(); } };
  var btnSave = document.createElement('button'); btnSave.textContent = 'SALVA SCHEDA'; btnSave.style.cssText = 'background:#2d4a22; border:1px solid #4caf50; color:#fff; border-radius:3px; padding:0.3rem 0.75rem; font-size:11px; cursor:pointer; font-family:Cinzel, serif; margin-right:10px; font-weight:bold;';
  btnSave.onclick = function() { save(); if(window.fbSaveScheda) window.fbSaveScheda(true); alert('Salvataggio forzato completato con successo!'); };
  if (!window.state || !window.state.schedePGViewMode) nav.appendChild(btnSave);
  if (!window.state || !window.state.schedePGViewMode) nav.appendChild(btnDel);
  wrap.appendChild(nav);
  var contentArea = document.createElement('div'); contentArea.style.cssText = 'flex:1; overflow-y:auto; position:relative; padding:20px; color:#3B2C21;';
  window.state.schedaZoom = window.state.schedaZoom || 1;
  contentArea.style.zoom = window.state.schedaZoom;
  contentArea.addEventListener('wheel', function(e){
    if(e.ctrlKey || e.metaKey) {
      e.preventDefault();
      window.state.schedaZoom = Math.max(0.4, Math.min(2.5, window.state.schedaZoom - (e.deltaY > 0 ? 0.1 : -0.1)));
      contentArea.style.zoom = window.state.schedaZoom;
      if (typeof monOverlay !== 'undefined' && monOverlay) monOverlay.style.zoom = window.state.schedaZoom;
    }
  }, {passive:false});

  var monOverlay = document.createElement('div'); monOverlay.style.cssText = 'position:absolute; inset:0; background:rgba(241,234,211,0.95); z-index:100; display:none; flex-direction:column; padding:20px; overflow-y:auto; backdrop-filter:blur(4px);';
  function save() { if (window.state && window.state.schedePGViewMode) return; scheda.nomePersonaggio = scheda.nome; scheda.classelivello = scheda.classeLivello; scheda.aspettoImg = scheda.avatar; if (window.fbSaveScheda) window.fbSaveScheda(); }
  function createBoxTitle(text) { var t = document.createElement('div'); t.style.cssText = 'font-weight:900; font-size:18px; color:#E75239; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.05em;'; t.textContent = text; return t; }
  function createInput(label, obj, key, type, width, height) {
    var d = document.createElement('div'); d.style.cssText = 'display:flex; align-items:center; gap:5px; margin-bottom:5px;';
    if(label) { var l = document.createElement('label'); l.textContent = label; l.style.cssText = 'font-size:12px; font-weight:800; color:#3B2C21; text-transform:uppercase;'; d.appendChild(l); }
    var i = document.createElement(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') i.type = type || 'text';
    i.value = obj[key] || ''; i.style.cssText = 'background:#FFF; border:2px solid #3B2C21; border-radius:10px; color:#3B2C21; font-weight:bold; padding:4px 8px; outline:none; font-family:inherit; flex:1; width:100%; box-sizing:border-box;';
    if (width) { d.style.width = width; i.style.flex = 'none'; i.style.width = '100%'; }
    if (height) { i.style.height = height; i.style.resize = 'none'; }
    i.oninput = function() { obj[key] = i.value; save(); }; i.onchange = function() { obj[key] = i.value; save(); if(window._schedaSaveTimer) { clearTimeout(window._schedaSaveTimer); window.fbSaveScheda(true); } }; d.appendChild(i); return d;
  }
  function createDots(label, obj, key, max, bgColor, textColor) {
    var w = document.createElement('div'); w.style.cssText = 'display:flex; flex-direction:column; align-items:center; background:' + (bgColor||'#009E96') + '; border-radius:15px; border:2px solid #3B2C21; padding:4px 10px; margin-bottom:6px;';
    var l = document.createElement('span'); l.textContent = label; l.style.cssText = 'font-size:11px; font-weight:900; color:' + (textColor||'#FFF') + '; text-transform:uppercase; margin-bottom:2px; text-align:center;';
    var d = document.createElement('div'); d.style.cssText = 'display:flex; gap:3px; justify-content:center; flex-wrap:wrap;';
    var dots = [];
    for(let i=1; i<=max; i++) {
      let dot = document.createElement('div'); dot.style.cssText = 'width:10px; height:10px; border-radius:50%; background:#FFF; border:1px solid rgba(0,0,0,0.2); cursor:pointer; box-shadow:inset 0 1px 3px rgba(0,0,0,0.3);'; dot.style.opacity = obj[key]>=i ? '1' : '0.3';
      dot.onclick = function() { if (obj[key] === i) obj[key] = i-1; else obj[key] = i; dots.forEach((dd, idx) => { dd.style.opacity = (obj[key]>idx ? '1' : '0.3'); }); save(); };
      dots.push(dot); d.appendChild(dot);
    }
    w.appendChild(l); w.appendChild(d); return w;
  }
  var tCard = document.createElement('div'); tCard.style.cssText = 'max-width:900px; margin:0 auto; padding-bottom:40px;';
  tCard.appendChild(createBoxTitle("Trainer's Card Window"));
  var sec1 = document.createElement('div'); sec1.style.cssText = 'background:#E4E4D9; border-radius:15px; border:3px solid #C4C4B9; overflow:hidden; display:flex; margin-bottom:30px; box-shadow:0 4px 10px rgba(0,0,0,0.1); flex-wrap:wrap;';
  var s1Left = document.createElement('div'); s1Left.style.cssText = 'padding:20px; display:flex; flex-direction:column; gap:10px; border-right:2px solid #C4C4B9; width:200px;';
  var avBox = document.createElement('div'); avBox.style.cssText = 'width:100%; height:180px; border:4px solid #3B2C21; border-radius:10px; background:#FFF; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden;';
  var avImg = document.createElement('img'); avImg.style.cssText = 'width:100%; height:100%; object-fit:cover; display:' + (scheda.avatar ? 'block' : 'none') + ';'; avImg.src = scheda.avatar || '';
  var avTxt = document.createElement('span'); avTxt.textContent = 'PICTURE'; avTxt.style.cssText = 'font-weight:900; color:#CCC;'; avTxt.style.display = scheda.avatar ? 'none' : 'block';
  avBox.appendChild(avImg); avBox.appendChild(avTxt);
  avBox.onclick = function() { handleAvatarClick(scheda.avatar, function(url) { scheda.avatar = url; avImg.src = url; if(url){avImg.style.display='block'; avTxt.style.display='none';} else {avImg.style.display='none'; avTxt.style.display='block';} save(); if(window._schedaSaveTimer) { clearTimeout(window._schedaSaveTimer); window.fbSaveScheda(true); } }); };
  s1Left.appendChild(avBox);
  var hpWill = document.createElement('div'); hpWill.style.cssText = 'display:flex; flex-direction:column; gap:5px; margin-top:10px;'; hpWill.appendChild(createInput('HP', scheda, 'hp', 'text')); hpWill.appendChild(createInput('WILL', scheda, 'will', 'text')); s1Left.appendChild(hpWill); sec1.appendChild(s1Left);
  var s1Right = document.createElement('div'); s1Right.style.cssText = 'flex:1; display:flex; flex-direction:column; min-width:300px;';
  var s1Header = document.createElement('div'); s1Header.style.cssText = 'background:#E75239; color:#FFF; padding:10px 20px; font-weight:900; font-size:22px; letter-spacing:2px; display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #3B2C21;'; s1Header.innerHTML = '<div>POKÉMON LEAGUE</div>';
  var rRank = document.createElement('div'); rRank.style.cssText = 'display:flex; align-items:center; gap:5px; font-size:12px; letter-spacing:0;'; rRank.innerHTML = "Trainer's Card Rank:";
  var rInp = document.createElement('input'); rInp.value = scheda.rank || ''; rInp.style.cssText = 'width:120px; height:24px; border-radius:4px; border:2px solid #3B2C21; text-align:center; font-weight:bold; outline:none; color:#3B2C21; background:#FFF;'; rInp.oninput = function() { scheda.rank = this.value; save(); }; rInp.onchange = function() { scheda.rank = this.value; save(); if(window._schedaSaveTimer) { clearTimeout(window._schedaSaveTimer); window.fbSaveScheda(true); } }; rRank.appendChild(rInp); s1Header.appendChild(rRank); s1Right.appendChild(s1Header);
  var s1Form = document.createElement('div'); s1Form.style.cssText = 'padding:15px 20px; display:grid; grid-template-columns:1fr 1fr; gap:10px;';
  s1Form.appendChild(createInput('NAME:', scheda, 'nome')); s1Form.appendChild(createInput('AGE:', scheda, 'eta')); s1Form.appendChild(createInput('PLAYER:', scheda, 'giocatore')); s1Form.appendChild(createInput('CONCEPT:', scheda, 'concept'));
  var botForm = document.createElement('div'); botForm.style.cssText = 'grid-column:1/-1; display:flex; gap:10px; flex-wrap:wrap;';
  var natConf = document.createElement('div'); natConf.style.cssText = 'flex:2; display:flex; gap:10px;'; natConf.appendChild(createInput('NATURE:', scheda, 'natura')); natConf.appendChild(createInput('CONFIDENCE:', scheda, 'confidence')); botForm.appendChild(natConf);
  var mny = createInput('MONEY:', scheda, 'soldi'); mny.style.flex='1'; botForm.appendChild(mny); s1Form.appendChild(botForm);
  var partySec = document.createElement('div'); partySec.style.cssText = 'grid-column:1/-1; display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-top:10px;';
  function renderPartySlots() {
    partySec.innerHTML = '';
    for(let i=0; i<6; i++) {
      let slot = document.createElement('div'); slot.style.cssText = 'background:#FFF; border:2px solid #3B2C21; border-radius:20px; height:36px; display:flex; align-items:center; padding:0 5px; cursor:pointer; position:relative; overflow:hidden;';
      let ball = document.createElement('div'); ball.style.cssText = 'width:24px; height:24px; border-radius:50%; background:#E75239; border:2px solid #3B2C21; display:flex; align-items:center; justify-content:center; flex-shrink:0;'; ball.innerHTML = '<div style="width:8px;height:8px;background:#FFF;border-radius:50%;border:1px solid #3B2C21;"></div>'; slot.appendChild(ball);
      let pName = document.createElement('div'); pName.style.cssText = 'margin-left:8px; font-weight:bold; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
      if (scheda.party[i]) { pName.textContent = scheda.party[i].nome || ('Pokemon ' + (i+1)); slot.style.background = '#F9F9F9'; } else { pName.textContent = 'Empty Slot'; pName.style.color = '#CCC'; slot.style.borderStyle = 'dashed'; }
      slot.appendChild(pName);
      slot.onclick = function() { if (!scheda.party[i]) { scheda.party[i] = window._pokemonMonDefault(); save(); renderPartySlots(); openMon(scheda.party[i], i); } else { openMon(scheda.party[i], i); } }; partySec.appendChild(slot);
    }
  }
  renderPartySlots(); s1Form.appendChild(partySec); s1Right.appendChild(s1Form); sec1.appendChild(s1Right); tCard.appendChild(sec1);
  tCard.appendChild(createBoxTitle("Attributes and Skills Window"));
  var sec2 = document.createElement('div'); sec2.style.cssText = 'background:#E4E4D9; border-radius:15px; border:3px solid #C4C4B9; padding:20px; display:grid; grid-template-columns:auto auto 1fr auto; gap:20px; align-items:start; margin-bottom:30px; box-shadow:0 4px 10px rgba(0,0,0,0.1); justify-content:space-between;';
  var s2L = document.createElement('div'); s2L.style.cssText = 'display:flex; flex-direction:column; gap:10px; width:150px;';
  s2L.appendChild(createDots('STRENGTH', scheda.attrs, 'str', 5, '#009E96', '#FFF')); s2L.appendChild(createDots('DEXTERITY', scheda.attrs, 'dex', 5, '#009E96', '#FFF')); s2L.appendChild(createDots('VITALITY', scheda.attrs, 'vit', 5, '#009E96', '#FFF')); s2L.appendChild(createDots('INSIGHT', scheda.attrs, 'ins', 5, '#009E96', '#FFF'));
  var achBox = document.createElement('div'); achBox.style.cssText = 'background:#FFF; border:2px solid #3B2C21; border-radius:8px; padding:10px; margin-top:10px;'; achBox.innerHTML = '<div style="font-size:10px; font-weight:bold; margin-bottom:5px;">ACHIEVEMENTS</div>';
  var achInp = document.createElement('textarea'); achInp.value = scheda.achievements || ''; achInp.style.cssText = 'width:100%; height:80px; border:none; outline:none; resize:none; font-family:inherit; font-size:12px;'; achInp.oninput = function() { scheda.achievements = this.value; save(); }; achBox.appendChild(achInp); s2L.appendChild(achBox); sec2.appendChild(s2L);
  var s2M = document.createElement('div'); s2M.style.cssText = 'background:#CE4636; border-radius:15px; border:3px solid #3B2C21; padding:15px; display:flex; gap:15px; position:relative; color:#FFF;';
  function createSkCol(keys) {
    var c = document.createElement('div'); c.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
    keys.forEach(k => {
      var w = document.createElement('div'); w.style.cssText = 'display:flex; flex-direction:column; align-items:center;'; var l = document.createElement('span'); l.textContent = k[0]; l.style.cssText = 'font-size:10px; font-weight:bold;'; var d = document.createElement('div'); d.style.cssText = 'display:flex; gap:2px;';
      var dots = []; for(let i=1; i<=5; i++) { let dot = document.createElement('div'); dot.style.cssText = 'width:8px; height:8px; border-radius:50%; background:#FFF; cursor:pointer; border:1px solid #3B2C21;'; dot.style.opacity = scheda.skills[k[1]]>=i ? '1' : '0.3'; dot.onclick = function() { if (scheda.skills[k[1]] === i) scheda.skills[k[1]] = i-1; else scheda.skills[k[1]] = i; dots.forEach((dd, idx) => { dd.style.opacity = (scheda.skills[k[1]]>idx ? '1' : '0.3'); }); save(); }; dots.push(dot); d.appendChild(dot); }
      w.appendChild(l); w.appendChild(d); c.appendChild(w);
    }); return c;
  }
  s2M.appendChild(createSkCol([['BRAWL','brawl'],['THROW','throw'],['EVASION','evasion'],['WEAPONS','weapons'],['ALERT','alert'],['ATHLETIC','athletic'],['NATURE','nature'],['STEALTH','stealth']]));
  s2M.appendChild(createSkCol([['ALLURE','allure'],['ETIQUETTE','etiquette'],['INTIMIDATE','intimidate'],['PERFORM','perform'],['CRAFTS','crafts'],['LORE','lore'],['MEDICINE','medicine'],['SCIENCE','science']]));
  sec2.appendChild(s2M);
  var storyBox = document.createElement('div'); storyBox.style.cssText = 'background:#FFF; border:2px solid #3B2C21; border-radius:8px; padding:10px; display:flex; flex-direction:column; min-width: 150px; align-self: stretch;'; storyBox.innerHTML = '<div style="font-size:10px; font-weight:bold; margin-bottom:5px; color:#3B2C21; text-transform:uppercase;">Storia del Personaggio</div>'; var storyInp = document.createElement('textarea'); storyInp.value = scheda.storiaPersonaggio || ''; storyInp.style.cssText = 'flex:1; width:100%; border:none; outline:none; resize:none; font-family:inherit; font-size:12px; background:transparent; line-height:1.4; color:#333;'; storyInp.oninput = function() { scheda.storiaPersonaggio = this.value; save(); }; storyBox.appendChild(storyInp); sec2.appendChild(storyBox);
  var s2R = document.createElement('div'); s2R.style.cssText = 'display:flex; flex-direction:column; gap:10px; width:150px;';
  s2R.appendChild(createDots('TOUGH', scheda.social, 'tough', 5, '#F3DB70', '#3B2C21')); s2R.appendChild(createDots('COOL', scheda.social, 'cool', 5, '#F1AD87', '#3B2C21')); s2R.appendChild(createDots('BEAUTY', scheda.social, 'beauty', 5, '#A8C5CC', '#3B2C21')); s2R.appendChild(createDots('CLEVER', scheda.social, 'clever', 5, '#B6D787', '#3B2C21')); s2R.appendChild(createDots('CUTE', scheda.social, 'cute', 5, '#F0B2C7', '#3B2C21'));
  var pdBox = document.createElement('div'); pdBox.style.cssText = 'background:#E75239; border:2px solid #3B2C21; border-radius:8px; padding:10px; margin-top:10px; color:#FFF;'; pdBox.innerHTML = '<div style="font-size:10px; font-weight:bold; margin-bottom:5px; text-align:center;">POKÉMON CAUGHT/SEEN</div>';
  var pdi = document.createElement('div'); pdi.style.cssText = 'display:flex; gap:5px; align-items:center; justify-content:center;';
  var pC = document.createElement('input'); pC.style.cssText = 'width:40px; border:none; border-radius:4px; text-align:center; padding:2px; font-weight:bold; color:#3B2C21;'; pC.value = scheda.pokedex.caught||''; pC.oninput=function(){scheda.pokedex.caught=this.value;save();};
  var pS = document.createElement('input'); pS.style.cssText = 'width:40px; border:none; border-radius:4px; text-align:center; padding:2px; font-weight:bold; color:#3B2C21;'; pS.value = scheda.pokedex.seen||''; pS.oninput=function(){scheda.pokedex.seen=this.value;save();};
  pdi.appendChild(pC); pdi.appendChild(document.createTextNode('/')); pdi.appendChild(pS); pdBox.appendChild(pdi); s2R.appendChild(pdBox); sec2.appendChild(s2R); tCard.appendChild(sec2);
  tCard.appendChild(createBoxTitle("Backpack Window"));
  var sec3 = document.createElement('div'); sec3.style.cssText = 'background:#99958E; border:4px dotted #C4C4B9; border-radius:20px; padding:20px; display:flex; flex-direction:column; gap:20px; box-shadow:0 4px 10px rgba(0,0,0,0.1);';
  var invGrid = document.createElement('div'); invGrid.style.cssText = 'display:grid; grid-template-columns:1fr 2fr; gap:20px;';
  var pots = document.createElement('div'); pots.appendChild(createInput('Potion x', scheda.inventory, 'potion', 'text')); pots.appendChild(createInput('Super Potion x', scheda.inventory, 'superPotion', 'text')); pots.appendChild(createInput('Hyper Potion x', scheda.inventory, 'hyperPotion', 'text')); invGrid.appendChild(pots);
  var pock = document.createElement('div'); pock.style.cssText = 'display:flex; gap:10px;'; pock.appendChild(createInput('Small Pocket', scheda.inventory, 'smallPocket', 'textarea', null, '120px')); pock.appendChild(createInput('Main Pocket', scheda.inventory, 'mainPocket', 'textarea', null, '120px')); invGrid.appendChild(pock); sec3.appendChild(invGrid);
  var badges = document.createElement('div'); badges.style.cssText = 'display:flex; gap:10px; align-items:center; flex-wrap:wrap;'; var bLbl = document.createElement('div'); bLbl.textContent='Badges'; bLbl.style.cssText='font-weight:bold; color:#E4E4D9; margin-right:10px; font-size:20px;'; badges.appendChild(bLbl);
  for(let i=0; i<8; i++) {
    let b = document.createElement('div'); b.style.cssText = 'width:50px; height:50px; background:#F1EAD3; border:2px solid #3B2C21; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden;';
    let bIm = document.createElement('img'); bIm.style.cssText = 'width:100%; height:100%; object-fit:contain; display:' + (scheda.badges[i] ? 'block' : 'none') + ';'; bIm.src = scheda.badges[i] || ''; b.appendChild(bIm);
    b.onclick = function() { handleAvatarClick(scheda.badges[i], function(url) { scheda.badges[i] = url; bIm.src = url; bIm.style.display = url ? 'block' : 'none'; save(); if(window._schedaSaveTimer) { clearTimeout(window._schedaSaveTimer); window.fbSaveScheda(true); } }); }; badges.appendChild(b);
  }
  sec3.appendChild(badges); tCard.appendChild(sec3); contentArea.appendChild(tCard); wrap.appendChild(contentArea);
  
  function openMon(mon, idx) {
    mon.mosse = mon.mosse || []; mon.attrs = mon.attrs || {}; mon.social = mon.social || {}; mon.skills = mon.skills || {};
    monOverlay.innerHTML = '';
    var topBar = document.createElement('div'); topBar.style.cssText = 'display:flex; justify-content:space-between; align-items:center; max-width:900px; margin:0 auto 15px auto; width:100%;';
    var delBtn = document.createElement('button'); delBtn.textContent = 'Elimina Pokemon'; delBtn.style.cssText = 'background:#E75239; color:#FFF; border:2px solid #3B2C21; padding:8px 16px; border-radius:20px; cursor:pointer; font-weight:bold; font-family:inherit;';
    delBtn.onclick = function() { if (confirm('Eliminare ' + (mon.nome||'questo Pokemon') + '?')) { scheda.party.splice(idx, 1); save(); monOverlay.style.display = 'none'; renderPartySlots(); } };
    var clsBtn = document.createElement('button'); clsBtn.textContent = 'X Chiudi Scheda Pokemon'; clsBtn.style.cssText = 'background:#FFF; color:#3B2C21; border:2px solid #3B2C21; padding:8px 16px; border-radius:20px; cursor:pointer; font-weight:bold; font-family:inherit;';
    clsBtn.onclick = function() { monOverlay.style.display = 'none'; renderPartySlots(); };
    topBar.appendChild(delBtn); topBar.appendChild(clsBtn); monOverlay.appendChild(topBar);
    var sheet = document.createElement('div'); sheet.style.cssText = 'max-width:900px; margin:0 auto; padding-bottom:40px;';
    sheet.appendChild(createBoxTitle("Pokédex Window"));
    var s1 = document.createElement('div'); s1.style.cssText = 'background:#E75239; border-radius:15px; border:3px solid #3B2C21; padding:20px; display:flex; align-items:center; gap:30px; margin-bottom:20px; position:relative; box-shadow:inset 0 10px 0 rgba(0,0,0,0.1); border-bottom-width:10px; border-bottom-color:#C13E28; flex-wrap:wrap;';
    var lens = document.createElement('div'); lens.style.cssText = 'position:absolute; top:15px; left:20px; width:40px; height:40px; border-radius:50%; background:#009E96; border:3px solid #3B2C21; box-shadow:inset -2px -2px 5px rgba(0,0,0,0.5);'; s1.appendChild(lens);
    var avWrap = document.createElement('div'); avWrap.style.cssText = 'width:200px; height:200px; border-radius:50%; background:#FFF; border:8px solid #3B2C21; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:pointer; margin-top:20px;';
    var avImg = document.createElement('img'); avImg.style.cssText = 'width:100%; height:100%; object-fit:cover; display:' + (mon.avatar ? 'block' : 'none') + ';'; avImg.src = mon.avatar || '';
    var avTxt = document.createElement('span'); avTxt.textContent = 'PICTURE'; avTxt.style.cssText = 'font-weight:900; color:#CCC;'; avTxt.style.display = mon.avatar ? 'none' : 'block';
    avWrap.appendChild(avImg); avWrap.appendChild(avTxt);
    avWrap.onclick = function() { handleAvatarClick(mon.avatar, function(url) { mon.avatar = url; avImg.src = url; if(url){avImg.style.display='block'; avTxt.style.display='none';} else {avImg.style.display='none'; avTxt.style.display='block';} save(); if(window._schedaSaveTimer) { clearTimeout(window._schedaSaveTimer); window.fbSaveScheda(true); } }); };
    s1.appendChild(avWrap);
    var s1R = document.createElement('div'); s1R.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:10px; margin-top:20px; min-width:250px;';
    s1R.appendChild(createInput('#', mon, 'numero')); s1R.appendChild(createInput('Name', mon, 'nome')); s1R.appendChild(createInput('Ability', mon, 'abilita')); s1.appendChild(s1R); sheet.appendChild(s1);
    sheet.appendChild(createBoxTitle("Quick References Windows"));
    var s2 = document.createElement('div'); s2.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;';
    var s2L = document.createElement('div'); s2L.style.cssText = 'background:#E75239; border-radius:15px; border:3px solid #3B2C21; padding:20px; display:flex; flex-direction:column; gap:8px;';
    s2L.appendChild(createInput('HP', mon, 'hp')); s2L.appendChild(createInput('WILL', mon, 'will')); s2L.appendChild(createInput('ITEM:', mon, 'held')); s2L.appendChild(createInput('STATUS:', mon, 'status'));
    ['INITIATIVE:','ACCURACY:','DAMAGE:','EVASION:','CLASH:','DEF/S.DEF:','RANK'].forEach(lbl => { var k = lbl.toLowerCase().replace(/[^a-z]/g,''); if(k==='initiative') k='init'; if(k==='accuracy') k='acc'; if(k==='damage') k='dmg'; if(k==='evasion') k='eva'; if(k==='defsdef') k='def'; s2L.appendChild(createInput(lbl, mon, k)); }); s2.appendChild(s2L);
    var s2R = document.createElement('div'); s2R.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
    for(let i=0; i<6; i++) { if(!mon.mosse[i]) mon.mosse[i] = {nome:'', tipo:'', freq:'', note:''}; let m = mon.mosse[i]; let r = document.createElement('div'); r.style.cssText = 'background:#FFF; border:3px solid #3B2C21; border-radius:15px; padding:10px; display:flex; flex-direction:column; gap:5px;'; r.appendChild(createInput('MOVE', m, 'nome')); let row = document.createElement('div'); row.style.cssText = 'display:flex; gap:10px;'; row.appendChild(createInput('POWER', m, 'freq')); row.appendChild(createInput('DICE POOL', m, 'tipo')); r.appendChild(row); r.appendChild(createInput('EFFECT', m, 'note', 'text')); s2R.appendChild(r); }
    s2.appendChild(s2R); sheet.appendChild(s2);
    sheet.appendChild(createBoxTitle("Attributes & Skills Window"));
    var s3 = document.createElement('div'); s3.style.cssText = 'background:#E75239; border-radius:15px; border:3px solid #3B2C21; padding:20px; display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;';
    var s3L = document.createElement('div'); s3L.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
    s3L.appendChild(createDots('STRENGTH', mon.attrs, 'str', 6, '#009E96', '#FFF')); s3L.appendChild(createDots('DEXTERITY', mon.attrs, 'dex', 6, '#009E96', '#FFF')); s3L.appendChild(createDots('VITALITY', mon.attrs, 'vit', 6, '#009E96', '#FFF')); s3L.appendChild(createDots('SPECIAL', mon.attrs, 'spc', 6, '#009E96', '#FFF')); s3L.appendChild(createDots('INSIGHT', mon.attrs, 'ins', 6, '#009E96', '#FFF'));
    var szWt = document.createElement('div'); szWt.style.cssText = 'display:flex; gap:10px; margin-top:10px;'; szWt.appendChild(createInput('SIZE:', mon, 'size')); szWt.appendChild(createInput('WEIGHT:', mon, 'weight')); s3L.appendChild(szWt); s3.appendChild(s3L);
    var s3R = document.createElement('div'); s3R.style.cssText = 'display:flex; gap:15px; color:#FFF; align-items:start;';
    function createPkmSkCol(keys) { var c = document.createElement('div'); c.style.cssText = 'display:flex; flex-direction:column; gap:8px; flex:1;'; keys.forEach(k => { var w = document.createElement('div'); w.style.cssText = 'display:flex; flex-direction:column; align-items:center;'; var l = document.createElement('span'); l.textContent = k[0]; l.style.cssText = 'font-size:10px; font-weight:bold; text-transform:uppercase;'; var d = document.createElement('div'); d.style.cssText = 'display:flex; gap:2px;'; var dots = []; for(let i=1; i<=5; i++) { let dot = document.createElement('div'); dot.style.cssText = 'width:8px; height:8px; border-radius:50%; background:#FFF; cursor:pointer;'; dot.style.opacity = mon.skills[k[1]]>=i ? '1' : '0.4'; dot.onclick = function() { if (mon.skills[k[1]] === i) mon.skills[k[1]] = i-1; else mon.skills[k[1]] = i; dots.forEach((dd, idx) => { dd.style.opacity = (mon.skills[k[1]]>idx ? '1' : '0.4'); }); save(); }; dots.push(dot); d.appendChild(dot); } w.appendChild(l); w.appendChild(d); c.appendChild(w); }); return c; }
    s3R.appendChild(createPkmSkCol([['Brawl','brawl'],['Channel','channel'],['Clash','clash'],['Evasion','evasion']])); s3R.appendChild(createPkmSkCol([['Alert','alert'],['Athletic','athletic'],['Nature','nature'],['Stealth','stealth']])); s3R.appendChild(createPkmSkCol([['Allure','allure'],['Etiquette','etiquette'],['Intimidate','intimidate'],['Perform','perform']])); s3.appendChild(s3R); sheet.appendChild(s3);
    sheet.appendChild(createBoxTitle("Socials & Info Window"));
    var s4 = document.createElement('div'); s4.style.cssText = 'background:#E75239; border-radius:15px; border:3px solid #3B2C21; padding:20px; display:grid; grid-template-columns:1fr 1fr; gap:20px;';
    var s4L = document.createElement('div'); s4L.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
    s4L.appendChild(createDots('TOUGH', mon.social, 'tough', 5, '#F3DB70', '#3B2C21')); s4L.appendChild(createDots('COOL', mon.social, 'cool', 5, '#F1AD87', '#3B2C21')); s4L.appendChild(createDots('BEAUTY', mon.social, 'beauty', 5, '#A8C5CC', '#3B2C21')); s4L.appendChild(createDots('CUTE', mon.social, 'cute', 5, '#F0B2C7', '#3B2C21')); s4L.appendChild(createDots('CLEVER', mon.social, 'clever', 5, '#B6D787', '#3B2C21'));
    var tw = document.createElement('div'); tw.style.cssText = 'display:flex; flex-direction:column; gap:10px; margin-top:10px;';
    tw.appendChild(createInput('TYPE:', mon, 'tipo', 'text'));
    tw.appendChild(createInput('WEAKNESS:', mon, 'weakness', 'textarea', '100%', '60px'));
    tw.appendChild(createInput('RESISTENCES:', mon, 'resistences', 'textarea', '100%', '60px'));
    tw.appendChild(createInput('IMMUNITY:', mon, 'immunity', 'textarea', '100%', '60px'));
    s4L.appendChild(tw); s4.appendChild(s4L);
    var s4R = document.createElement('div'); s4R.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
    s4R.appendChild(createInput('NATURE:', mon, 'natura')); s4R.appendChild(createInput('CONFIDENCE:', mon, 'conf'));
    var hl = document.createElement('div'); hl.style.cssText = 'display:flex; gap:10px;'; hl.appendChild(createDots('HAPPINESS', mon, 'hap', 5, '#009E96', '#FFF')); hl.appendChild(createDots('LOYALTY', mon, 'loy', 5, '#009E96', '#FFF')); s4R.appendChild(hl);
    var bv = document.createElement('div'); bv.style.cssText = 'display:flex; gap:10px;'; bv.appendChild(createInput('BATTLES', mon, 'battles')); bv.appendChild(createInput('VICTORIES', mon, 'victories')); s4R.appendChild(bv);
    s4R.appendChild(createInput('ACCESORY:', mon, 'accessories', 'textarea', null, '50px')); s4.appendChild(s4R); sheet.appendChild(s4);
    monOverlay.appendChild(sheet); monOverlay.style.display = 'flex';
  }
  wrap.appendChild(monOverlay);

  return wrap;
};