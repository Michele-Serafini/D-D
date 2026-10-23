/**
 * ============================================================================
 * LOGICA APPLICATIVA PRINCIPALE DEL COMPENDIUM (js/app.js)
 * ============================================================================
 * Indice delle Sezioni:
 * 1. Sincronizzazione Realtime Firebase (setupRealtimeListeners & fbSave*)
 * 2. Stato Globale dell'Applicazione (state) & Persistenza Locale
 * 3. Motore di Rendering Principale (render, renderMain, renderSidebar)
 * 4. Emporio del Mercante (Classico, Cyberware, Sostanze, Veicoli, Armi da Fuoco)
 * 5. Iniziativa, Combattimento & Encounter Builder
 * 6. Bestiario & Pet del Party
 * 7. Schede Personaggio Multi-Sistema (D&D 5e, 7th Sea, One Piece, Brancalonia, SW5e, Pokémon, Naruto)
 * 8. Grimorio degli Incantesimi
 * 9. Worldbuilding, Generatore NPC, Statistiche & Ruota del Caos
 * 10. Regia Sonora & Effetti Audio Sintetizzati
 * 11. Lanciatore di Dadi 3D Poliedrico (renderDadi)
 * 12. Mappa del Mondo Interattiva (Leaflet), Cronache Campagna, Bacheca, Libreria e VTT
 *
 * NOTA: Tutta la gestione Utenti, Account, Ruoli, Login e Impostazioni è
 * unificata nel modulo dedicato `js/users.js` (window.UserManager).
 * ============================================================================
 */
"use strict";


/* ---- Listener realtime per sincronizzare lo state ---- */

// _localWrite: true mentre stiamo noi scrivendo su Firebase.
// Il listener lo legge e salta il re-render per non disturbare chi scrive.
var _localWrite = { iniziativa: false, caos: false, armi: false, bestiario: false, incantesimiAggiuntivi: false };


/* ============================================================================
   SEZIONE 1: SINCRONIZZAZIONE FIREBASE REALTIME & SALVATAGGIO CLOUD
   ============================================================================ */
function setupRealtimeListeners() {
  if (!_db) return;

  // ---- INIZIATIVA ----
  _db.ref('state/iniziativa').on('value', function(snap) {
    if (_localWrite.iniziativa) return;
    var v = snap.val();
    if (v && v.combatants && Array.isArray(v.combatants) && v.combatants.length > 0) {
      state.combatants = v.combatants.map(function(c){ if(!Array.isArray(c.condizioni)) c.condizioni=[]; return c; });
      if (typeof v.round === 'number') state.round = v.round;
      if (typeof v.activeIndex === 'number') state.activeIndex = v.activeIndex;
    } else {
      if (state.combatants.length === 0) state.combatants = [makeEmptyCombatant()];
    }
    if (state.section === 'iniziativa') { ensureTrailingEmpty(); renderIniziativaBody(); } else ensureTrailingEmpty();
  });

  // ---- CAOS ----
  _db.ref('state/caos/players').on('value', function(snap) {
    if (_localWrite.caos) return;
    var v = snap.val();
    if (v && Array.isArray(v)) { state.caosPlayers = v; if (state.section === 'caos') renderCaosBody(); }
  });
  _db.ref('state/caos/doom').on('value', function(snap) {
    if (_localWrite.caos) return;
    var v = snap.val();
    if (v) { if(typeof v.doomStage==='number') state.doomStage=v.doomStage; if(typeof v.doomFilled==='number') state.doomFilled=v.doomFilled; if(state.section==='caos') renderDoomWheel(); }
  });

  // ---- BACHECA ----
  _db.ref('state/bacheca/items').on('value', function(snap) {
    var v = snap.val();
    if (v && typeof v === 'object') state.bacheItems = Object.keys(v).map(function(k){ return Object.assign({id:k}, v[k]); });
    else state.bacheItems = [];
    if (state.section === 'bacheca') { var grid = document.querySelector('.bacheca-grid'); if (grid) renderBacheGrid(grid); }
  });

  // ---- PERSONAGGI NPC ----
  _db.ref('state/personaggi').on('value', function(snap) {
    var v = snap.val();
    if (v && Array.isArray(v)) {
      state.personaggi = v;
      if (state.section === 'generatore' || state.section === 'storia') renderMain();
    }
  });

  // ---- SCHEDE PG ----
  _db.ref('schedePG').on('value', function(snap) {
    state.schedePGAll = snap.val() || {};
      
    if (state.section === 'schedepg') renderMain();
  });

  // ---- DELETED LISTS (admin) ----
  // NOTA: il listener bestiario è annidato qui dentro per garantire che bestiarioDeleted
  // sia caricato PRIMA della merge SRD (evita race condition che riaggiungeva mostri eliminati)
  _db.ref('state/bestiarioDeleted').once('value', function(snap) {
    var v = snap.val();
    if (v && Array.isArray(v)) state.bestiarioDeleted = v;

  // ---- BESTIARIO CUSTOM ----
  _db.ref('state/bestiario').on('value', function(snap) {
    if (_localWrite.bestiario) return;
    var v = snap.val();
    var existing = (v && Array.isArray(v)) ? v : [];
    // Deduplica existing per nome (tiene il primo, rimuove i doppi da Firebase)
    var seenDup = {};
    existing = existing.filter(function(x){ var k=(x.nome||'').toLowerCase(); if(seenDup[k]) return false; seenDup[k]=1; return true; });
    var nomi = {};
    existing.forEach(function(x){ nomi[(x.nome||'').toLowerCase()] = 1; });
    // Aggiorna immagini SRD esistenti che hanno immagine vuota
    var srdBById = {};
    (typeof SRD_BESTIARIO !== 'undefined' ? SRD_BESTIARIO : []).forEach(function(x){ if(x.id) srdBById[x.id]=x; });
    var bImgChanged = false;
    existing = existing.map(function(x){
      var srd = (x.id && srdBById[x.id]) ? srdBById[x.id] : null;
      if (!srd) return x;
      // Se SRD ha versione _v più alta, sostituisce i dati Firebase (aggiornamento mostri)
      if (srd._v && (!x._v || srd._v > x._v)) {
        bImgChanged = true;
        return Object.assign({}, srd, {id: x.id});
      }
      // Aggiorna immagine vuota
      if (!x.immagine && srd.immagine) {
        bImgChanged = true;
        return Object.assign({}, x, {immagine: srd.immagine});
      }
      return x;
    });
    var _deleted = state.bestiarioDeleted || [];
    // Migrazione: rimuovi entry duplicate SRD aggiunte con nomi diversi dagli originali
    var _dupIds = ['srd_b_258','srd_b_267','srd_b_323','srd_b_324','srd_b_325','srd_b_326','srd_b_333','srd_b_346','srd_b_348','srd_b_356','srd_b_358','srd_b_360','srd_b_361','srd_b_362'];
    var _lenBefore = existing.length;
    existing = existing.filter(function(x){ return _dupIds.indexOf(x.id) < 0; });
    var migChanged = existing.length < _lenBefore;
    if (migChanged) {
      nomi = {};
      existing.forEach(function(x){ nomi[(x.nome||'').toLowerCase()] = 1; });
      var _newDel = _dupIds.filter(function(id){ return _deleted.indexOf(id) < 0; });
      if (_newDel.length) {
        _deleted = _deleted.concat(_newDel);
        state.bestiarioDeleted = _deleted;
        _db.ref('state/bestiarioDeleted').set(_deleted);
      }
    }
    // Costruisce set di nomi eliminati (da voci "nome:xxx" in bestiarioDeleted)
    var _deletedNomi = {};
    _deleted.forEach(function(x){ if(x && x.indexOf('nome:')===0) _deletedNomi[x.slice(5)]=1; });
    var toAdd = (typeof SRD_BESTIARIO !== 'undefined' ? SRD_BESTIARIO : []).filter(function(x){ var nl=(x.nome||'').toLowerCase(); return !nomi[nl] && _deleted.indexOf(x.id) < 0 && !_deletedNomi[nl]; });
    if (toAdd.length || bImgChanged || migChanged) {
      var merged = existing.concat(toAdd).sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||'','it'); });
      _localWrite.bestiario = true;
      _db.ref('state/bestiario').set(merged, function(){ _localWrite.bestiario = false; });
      state.bestiario = merged;
    } else {
      state.bestiario = existing;
    }
    if (state.section === 'bestiario') renderMain();
  });
  }); // fine bestiarioDeleted.once

  _db.ref('state/armiDeleted').once('value', function(snap) {
    var v = snap.val();
    if (v && Array.isArray(v)) state.armiDeleted = v;
  });

  // ---- ARMI ----
  _db.ref('state/armi').on('value', function(snap) {
    if (_localWrite.armi) return;
    var v = snap.val();
    var existing = (v && Array.isArray(v)) ? v : (typeof SRD_OGGETTI !== 'undefined' ? SRD_OGGETTI.slice() : []);
    
    // Aggiorna immagini SRD esistenti che hanno immagine vuota
    var srdById = {};
    var srdByName = {};
    (typeof SRD_OGGETTI !== 'undefined' ? SRD_OGGETTI : []).forEach(function(x){
      if(x.id) srdById[x.id]=x;
      if(x.nome) srdByName[x.nome.trim().toLowerCase()]=x;
    });
    var imgChanged = false;
    existing = existing.map(function(x){
      var srd = (x.id && srdById[x.id]) || (x.nome && srdByName[x.nome.trim().toLowerCase()]);
      if (srd && srd.immagine) {
        if (!x.immagine || (srd.immagine.indexOf("img/") === 0 && x.immagine !== srd.immagine)) {
          imgChanged = true;
          return Object.assign({}, x, {immagine: srd.immagine});
        }
      }
      return x;
    });

    var seen = {};
    var deduped = [];
    var dedupChanged = false;
    existing.forEach(function(w) {
      var key = (w.nome || '').trim().toLowerCase();
      if (!key) return;
      if (!seen[key]) {
        seen[key] = w;
        deduped.push(w);
      } else {
        dedupChanged = true;
        // Dai priorità all'elemento con metadati/percorsi immagine corretti
        if (!seen[key].immagine && w.immagine) {
           deduped[deduped.indexOf(seen[key])] = w;
           seen[key] = w;
        }
      }
    });
    if (dedupChanged) {
      existing = deduped;
      imgChanged = true;
    }

    if (imgChanged) {
      _localWrite.armi = true;
      _db.ref('state/armi').set(existing, function(){ _localWrite.armi = false; });
    }
    state.armi = existing;
    if (state.section === 'emporio') updateResults();
  });

  // ---- IMPIANTI CIBERNETICI ----
  _db.ref('state/impianti').on('value', function(snap) {
    var v = snap.val();
    if (v && Array.isArray(v)) {
      state.impiantiCibernetici = v;
      if (state.section === 'emporio' && state.emporioTab === 'cyber') renderMain();
    }
  });

  // ---- DROGHE ----
  _db.ref('state/droghe').on('value', function(snap) {
    var v = snap.val();
    state.droghe = (v && Array.isArray(v)) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'droghe') renderMain();
  });

  // ---- VEICOLI ----
  _db.ref('state/veicoli').on('value', function(snap) {
    var v = snap.val();
    state.veicoli = (v && Array.isArray(v)) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'veicoli') renderMain();
  });

  // ---- VEICOLI PARTY ----
  _db.ref('state/veicoliParty').on('value', function(snap) {
    var v = snap.val();
    state.veicoliParty = (v && Array.isArray(v)) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'veicoli') renderMain();
  });

  // ---- ARMI DA FUOCO ----
  _db.ref('state/armiFuoco').on('value', function(snap) {
    var v = snap.val();
    state.armiDaFuoco = (v && Array.isArray(v)) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'armifuoco') renderMain();
  });
  _db.ref('state/armiFuocoPotenziamenti').on('value', function(snap) {
    var v = snap.val();
    state.potenziamenti = (v && Array.isArray(v)) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'armifuoco') renderMain();
  });
  _db.ref('state/armiFuocoMunizioni').on('value', function(snap) {
    var v = snap.val();
    state.munizioniArmi = (v && Array.isArray(v)) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'armifuoco') renderMain();
  });

  // ---- NOTE ----
  _db.ref('state/notes').on('value', function(snap) {
    var v = snap.val();
    if (typeof v === 'string' && v !== state.notes) {
      state.notes = v;
      var ta = document.getElementById('notes-area');
      if (ta && document.activeElement !== ta) ta.value = v;
    }
  });

  // ---- USERS ----
  _db.ref('users').on('value', function(snap) {
    var v = snap.val() || {};
    if (typeof DEFAULT_USERS !== 'undefined') {
      DEFAULT_USERS.forEach(function(du) {
        if (!v[du.username]) v[du.username] = { password: du.password, role: du.role, dmPriv: !!du.dmPriv };
      });
    }
    _remoteUsers = v;
  });

  // ---- PRESENCE ----
  _db.ref('presence').on('value', function(snap) {
    _presenceMap = snap.val() || {};
    var settEl = document.getElementById('settings-overlay');
    if (settEl) { settEl.remove(); renderSettingsPanel(); }
  });


  _db.ref('state/pet').on('value', function(snap) {
    var v = snap.val();
    if (v && Array.isArray(v)) {
      state.pet = v;
      if (state.section === 'bestiario') renderMain();
    }
  });

  _db.ref('state/incantesimiAggiuntivi').on('value', function(snap) {
    if (_localWrite.incantesimiAggiuntivi) return;
    var v = snap.val();
    var existing = (v && Array.isArray(v)) ? v : [];
    // Dedup existing per nome; rimuovi 'Mending' se 'Riparare' esiste in SRD
    var srdSpNames = {};
    (typeof SRD_INCANTESIMI !== 'undefined' ? SRD_INCANTESIMI : []).forEach(function(x){ if(x.nome) srdSpNames[(x.nome||'').toLowerCase()]=1; });
    var seenSpDup = {};
    existing = existing.filter(function(x){
      var k = (x.nome||'').toLowerCase();
      // Rimuovi 'mending' e altri alias inglesi già presenti in SRD italiano
      var ALIAS = {'mending':'riparare','repair':'riparare','mage hand':'mano magica','prestidigitation':'prestidigitazione','minor illusion':'illusione minore'};
      if (ALIAS[k] && srdSpNames[ALIAS[k]]) return false;
      if (seenSpDup[k]) return false;
      seenSpDup[k]=1;
      return true;
    });
    var srdArr = (typeof SRD_INCANTESIMI !== 'undefined' ? SRD_INCANTESIMI : []);
    var srdByName = {};
    srdArr.forEach(function(x){ if(x.nome) srdByName[(x.nome||'').toLowerCase()] = x; });
    var nomi = {};
    existing.forEach(function(x){ nomi[(x.nome||'').toLowerCase()] = 1; });
    var toAdd = srdArr.filter(function(x){ return !nomi[(x.nome||'').toLowerCase()]; });
    // Aggiorna descrizione/altiLivelli degli incantesimi SRD già presenti in Firebase
    var needsUpdate = false;
    existing = existing.map(function(x) {
      var srd = srdByName[(x.nome||'').toLowerCase()];
      if (!srd || !srd.id || (srd.id+'').indexOf('srd_sp_') !== 0) return x;
      var changed = false;
      var upd = {};
      if (srd.descrizione && x.descrizione !== srd.descrizione) { upd.descrizione = srd.descrizione; changed = true; }
      if (srd.altiLivelli !== undefined && x.altiLivelli !== srd.altiLivelli) { upd.altiLivelli = srd.altiLivelli; changed = true; }
      if (srd.componenti && JSON.stringify(x.componenti) !== JSON.stringify(srd.componenti)) { upd.componenti = srd.componenti; changed = true; }
      if (srd.valMateria !== undefined && x.valMateria !== srd.valMateria) { upd.valMateria = srd.valMateria; changed = true; }
      if (srd.consumaMateria !== undefined && x.consumaMateria !== srd.consumaMateria) { upd.consumaMateria = srd.consumaMateria; changed = true; }
      if (srd.classi && srd.classi.length && JSON.stringify(x.classi) !== JSON.stringify(srd.classi)) { upd.classi = srd.classi; changed = true; }
      if (srd.rituale !== undefined && x.rituale !== srd.rituale) { upd.rituale = srd.rituale; changed = true; }
      if (srd.concentrazione !== undefined && x.concentrazione !== srd.concentrazione) { upd.concentrazione = srd.concentrazione; changed = true; }
      if (changed) { needsUpdate = true; return Object.assign({}, x, upd); }
      return x;
    });
    if (toAdd.length || needsUpdate) {
      var merged = existing.concat(toAdd).sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||'','it'); });
      _localWrite.incantesimiAggiuntivi = true;
      _db.ref('state/incantesimiAggiuntivi').set(merged, function(){ _localWrite.incantesimiAggiuntivi = false; });
      state.incantesimiAggiuntivi = merged;
    } else {
      state.incantesimiAggiuntivi = existing;
    }
    if (state.section === 'incantesimi') renderMain();
  });

  // ---- WORLDBUILDING: agganciato dentro il listener mappa (vedi sotto) ----

  // ---- DICE ROLLS ----
  _db.ref('diceRolls').limitToLast(15).on('value', function(snap) {
    var rolls = [];
    snap.forEach(function(child) { rolls.unshift(child.val()); });
    state.diceHistory = rolls;
    var histList = document.querySelector('.dice-history-list');
    if (histList) updateDiceHistory(histList);
  });

  // ---- MAPPA DEL MONDO ----
  _attachMappaListener();

  // ---- STORIA MARKERS (privati per DM, per mappa) ----
  var _smListenerUser = state.currentUser && state.currentUser.username;
  if (_smListenerUser) {
    _db.ref('state/storia_markers/' + _smListenerUser).on('value', function(snap) {
      window._storiaMarkersCache = snap.val() || {};
      var mid = state.mappaActiveId || 'default';
      state.storia.markers = (window._storiaMarkersCache[mid] && typeof window._storiaMarkersCache[mid] === 'object')
        ? window._storiaMarkersCache[mid] : {};
      refreshStoriaMarkers();
    });
  }

}

function fbSave(path, value) {
  if (!_db) return;
  _db.ref(path).set(value).catch(function(e){ console.warn('[Firebase] write error:', e.message); });
}

// Helper: restituisce il path Firebase della mappa attiva
function _mappaActivePath() {
  if (state.mappaActiveId) return _mappaBasePath() + '/maps/' + state.mappaActiveId;
  return _mappaBasePath();
}
function _mappaFlagPath(fid) {
  return _mappaActivePath() + '/flags/' + fid;
}

/* ---- Salvataggio Firebase per i dati shared ---- */
var _fbSaveIniziativaTimer = null;
var _fbSaveCaosNomeTimer = null;

function fbSavePersonaggi() {
  if (!_db) return;
  _db.ref('state/personaggi').set(state.personaggi.length > 0 ? state.personaggi : null);
}

/* Salva chiavi API su Firebase — persistenti su qualsiasi dominio/dispositivo */
function fbSaveApiKeys() {
  if (!_db || !isDM()) return;
  _db.ref('dmConfig/apiKeys').set({
    geminiKey: state.geminiKey || '',
    groqKey: state.groqKey || ''
  });
}

/* Carica chiavi API da Firebase (priorità su localStorage) */
function fbLoadApiKeys() {
  if (!_db || !isDM()) return;
  _db.ref('dmConfig/apiKeys').once('value', function(snap) {
    var v = snap.val();
    if (!v) return;
    if (v.geminiKey) state.geminiKey = v.geminiKey;
    if (v.groqKey)   state.groqKey   = v.groqKey;
    saveToStorage();
  });
}

function fbSaveBestiario() {
  if (!_db) return;
  _localWrite.bestiario = true;
  _db.ref('state/bestiario').set(state.bestiario.length > 0 ? state.bestiario : null, function(){
    setTimeout(function(){ _localWrite.bestiario = false; }, 300);
  });
}
function fbSaveBestiarioDeleted() {
  if (!_db) return;
  _db.ref('state/bestiarioDeleted').set(state.bestiarioDeleted.length > 0 ? state.bestiarioDeleted : null);
}
function fbSaveArmiDeleted() {
  if (!_db) return;
  _db.ref('state/armiDeleted').set(state.armiDeleted.length > 0 ? state.armiDeleted : null);
}
function fbSavePet() {
  if (!_db) return;
  _db.ref('state/pet').set(state.pet.length > 0 ? state.pet : null);
}
function fbSaveIncantesimiAggiuntivi() {
  if (!_db) return;
  _db.ref('state/incantesimiAggiuntivi').set(state.incantesimiAggiuntivi.length > 0 ? state.incantesimiAggiuntivi : null);
}

/* ===== SCHEDA PERSONAGGIO — Firebase ===== */
function _spellList(n) { var a=[]; for(var i=0;i<n;i++) a.push({nome:'',prep:false}); return a; }
function _schedaDefault() {
  return {
    nomePersonaggio:'',classelivello:'',background:'',nomeGiocatore:'',razza:'',allineamento:'',pe:'',
    for:10,des:10,cos:10,int:10,sag:10,car:10,
    tsFor:false,tsDes:false,tsCos:false,tsInt:false,tsSag:false,tsCar:false,
    skAcrobazia:false,skAnimali:false,skArcano:false,skAtletica:false,skFurtivita:false,
    skIndagare:false,skInganno:false,skIntimidire:false,skIntrattenere:false,skIntuizione:false,
    skMedicina:false,skNatura:false,skPercezione:false,skPersuasione:false,skRapidita:false,
    skReligione:false,skSopravvivenza:false,skStoria:false,skTecnologia:false,
    ispirazione:false,bonusCompetenza:2,
    ca:'',iniziativa:'',velocita:'',
    hpMax:'',hpAttuali:'',hpTemp:'',dadiVita:'',
    successi:[false,false,false],fallimenti:[false,false,false],
    attacchi:[{nome:'',bonus:'',danni:''},{nome:'',bonus:'',danni:''},{nome:'',bonus:'',danni:''}],
    trattiCar:'',ideali:'',legami:'',difetti:'',
    altreCompetenze:'',equipaggiamento:'',privilegi:'',rame:'',argento:'',oro:'',platino:'',crediti:'',livelloFollia:0,
    eta:'',altezza:'',peso:'',occhi:'',carnagione:'',capelli:'',
    aspettoDesc:'',aspettoImg:'',alleatiOrg:'',nomeOrg:'',
    storia:'',trattiAgg:'',tesoro:'',
    classInc:'',carInc:'',cdTs:'',bonusAtkInc:'',
    trucchetti:['','','','','','','',''],
    sp1:{slots:'',spesi:'',lista:_spellList(13)},sp2:{slots:'',spesi:'',lista:_spellList(13)},
    sp3:{slots:'',spesi:'',lista:_spellList(13)},sp4:{slots:'',spesi:'',lista:_spellList(13)},
    sp5:{slots:'',spesi:'',lista:_spellList(13)},sp6:{slots:'',spesi:'',lista:_spellList(9)},
    sp7:{slots:'',spesi:'',lista:_spellList(9)},sp8:{slots:'',spesi:'',lista:_spellList(7)},
    sp9:{slots:'',spesi:'',lista:_spellList(7)}
  };
}
function _schedaFix(raw) {
  if(!raw||typeof raw!=='object') return _schedaDefault();
  var out=Object.assign(_schedaDefault(),raw);
  if(!Array.isArray(out.successi)||out.successi.length!==3) out.successi=[false,false,false];
  if(!Array.isArray(out.fallimenti)||out.fallimenti.length!==3) out.fallimenti=[false,false,false];
  if(!Array.isArray(out.trucchetti)||out.trucchetti.length<8) out.trucchetti=['','','','','','','',''];
  if(!Array.isArray(out.attacchi)||out.attacchi.length<3) out.attacchi=[{nome:'',bonus:'',danni:''},{nome:'',bonus:'',danni:''},{nome:'',bonus:'',danni:''}];
  [1,2,3,4,5,6,7,8,9].forEach(function(l){
    var k='sp'+l, n=l<=5?13:l<=7?9:7;
    var src=raw[k]; var def={slots:'',spesi:'',lista:_spellList(n)};
    if(!src||typeof src!=='object') { out[k]=def; return; }
    out[k]={slots:src.slots||'',spesi:src.spesi||'',lista:_spellList(n)};
    if(Array.isArray(src.lista)) src.lista.forEach(function(sp,i){ if(i<n) out[k].lista[i]=Object.assign({nome:'',prep:false},sp); });
  });
  return out;
}
var _schedaSaveTimer=null;
function fbSaveScheda(immediate) {
      if(!_db||!state.currentUser||!state.schedaAttivaId || !state.scheda || Object.keys(state.scheda).length===0) return;
      clearTimeout(_schedaSaveTimer);
      var _sid=state.schedaAttivaId;
      var snapshot = JSON.parse(JSON.stringify(state.scheda));
        delete snapshot.id;
        if (snapshot.schedaTipo === 'pokemon') console.log('[POKEMON SAVE] Payload inviato:', snapshot);
        if (snapshot.schedaTipo === 'naruto') console.log('[NARUTO SAVE] Payload inviato:', snapshot);
      var doSave = function() {
        _db.ref('schedePG/'+state.currentUser.username+'/chars/'+_sid).set(snapshot);
        var _idx = state.schedeList.findIndex(function(s){return s.id===_sid;});
        if(_idx>=0) { state.schedeList[_idx] = JSON.parse(JSON.stringify(snapshot)); state.schedeList[_idx].id = _sid; }
      };
      if (immediate===true) doSave();
      else _schedaSaveTimer=setTimeout(doSave,600);
    }
function fbLoadSchede(cb) {
  if(!_db||!state.currentUser){state.schedeList=[];state.companions={};state.schedaLoaded=true;if(cb)cb();return;}
  _db.ref('schedePG/'+state.currentUser.username).once('value',function(snap){
    var raw=snap.val();
    if(!raw){state.schedeList=[];state.companions={};state.schedaLoaded=true;if(cb)cb();return;}
    if(raw._v2){
      var chars=raw.chars||{};
      
      
        state.schedeList=Object.keys(chars).map(function(k){return Object.assign(_schedaFix(chars[k]),{id:k});});
        
        // --- CLEANUP TROLL CHARACTERS ---
        state.schedeList.forEach(function(c) {
          if (c.nome && c.nome.includes('iiiiiiiii')) {
             _db.ref('schedePG/'+state.currentUser.username+'/chars/'+c.id).remove();
          }
        });
        
        // --- CLEANUP TROLL E BRANCALONIA VECCHIE ---
        state.schedeList.forEach(function(c) {
          if (c.schedaTipo === 'brancalonia' && (!c.branca_data || Object.keys(c.branca_data).length === 0)) {
             _db.ref('schedePG/'+state.currentUser.username+'/chars/'+c.id).remove();
          }
        });
        state.schedeList = state.schedeList.filter(function(c) { 
          return !(c.schedaTipo === 'brancalonia' && (!c.branca_data || Object.keys(c.branca_data).length === 0)); 
        });
        // --------------------------------

        // --------------------------------

      state.companions=raw.companions||{};
      state.schedaLoaded=true;if(cb)cb();
    } else {
      var newId='c'+Date.now();
      var oldFix=_schedaFix(raw);
      var upd={_v2:true};upd['chars/'+newId]=oldFix;
      _db.ref('schedePG/'+state.currentUser.username).update(upd,function(){
        state.schedeList=[Object.assign({},oldFix,{id:newId})];
        state.companions={};state.schedaLoaded=true;if(cb)cb();
      });
    }
  });
}
function fbSaveCompanion(charId,comp) {
  if(!_db||!state.currentUser||!charId||!comp.id) return;
  var data=Object.assign({},comp);delete data.id;
  _db.ref('schedePG/'+state.currentUser.username+'/companions/'+charId+'/'+comp.id).set(data);
}
function fbDeleteCompanion(charId,compId) {
  if(!_db||!state.currentUser) return;
  _db.ref('schedePG/'+state.currentUser.username+'/companions/'+charId+'/'+compId).remove();
}
function fbDeleteSchedaItem(id) {
  if(!_db||!state.currentUser) return;
  _db.ref('schedePG/'+state.currentUser.username+'/chars/'+id).remove();
}
function updateSchedaDerived() {
  var s=state.scheda, bc=parseInt(s.bonusCompetenza)||2;
  function m(v){return Math.floor(((parseInt(v)||10)-10)/2);}
  function fmt(n){return(n>=0?'+':'')+n;}
  var st={for:m(s.for),des:m(s.des),cos:m(s.cos),int:m(s.int),sag:m(s.sag),car:m(s.car)};
  ['for','des','cos','int','sag','car'].forEach(function(k){var el=document.getElementById('pd-mod-'+k);if(el)el.textContent=fmt(st[k]);});
  [['for','tsFor'],['des','tsDes'],['cos','tsCos'],['int','tsInt'],['sag','tsSag'],['car','tsCar']].forEach(function(p){
    var el=document.getElementById('pd-ts-'+p[0]);if(el)el.textContent=fmt(st[p[0]]+(s[p[1]]?bc:0));
  });
  var skMap=[['des','skAcrobazia','acrobazia'],['sag','skAnimali','animali'],['int','skArcano','arcano'],['for','skAtletica','atletica'],['des','skFurtivita','furtivita'],['int','skIndagare','indagare'],['car','skInganno','inganno'],['car','skIntimidire','intimidire'],['car','skIntrattenere','intrattenere'],['sag','skIntuizione','intuizione'],['sag','skMedicina','medicina'],['int','skNatura','natura'],['sag','skPercezione','percezione'],['car','skPersuasione','persuasione'],['des','skRapidita','rapidita'],['int','skReligione','religione'],['sag','skSopravvivenza','sopravvivenza'],['int','skStoria','storia'],['int','skTecnologia','tecnologia']];
  skMap.forEach(function(sk){var el=document.getElementById('pd-sk-'+sk[2]);if(el)el.textContent=fmt(st[sk[0]]+(s[sk[1]]?bc*(s[sk[1]+'_m']?2:1):0));});
  var pp=document.getElementById('pd-pass-perc');if(pp)pp.textContent=10+st.sag+(s.skPercezione?bc*(s['skPercezione_m']?2:1):0);
}

var _wbLocalWrite = false;
var _wbListenerRef = null; // riferimento al listener Firebase corrente del worldbuilding

/* ── Mappe / Storia per-utente ─────────────────────────────────────────────
   _mappaViewAsUser : username di cui l'admin sta visualizzando le mappe (null = proprie)
   _storiaViewAsUser: username di cui l'admin sta visualizzando la libreria storie (null = proprie)
   _mappaListenerRef: riferimento al listener Firebase mappa corrente (per poterlo staccare) */
var _mappaViewAsUser  = null;
var _storiaViewAsUser = null;
var _mappaListenerRef = null;
var _mappaOwnerMap    = {}; // mapId → username proprietario (usato in modalità 'Tutte')

/* Restituisce il path Firebase base per le mappe dell'utente corrente (o di quello visualizzato). */
function _mappaBasePath() {
  if (_mappaViewAsUser === "__multiverso__") return "state/multiverso/mappa";
  if (_mappaViewAsUser === '__tutte__') {
    var mid = state.mappaActiveId;
    if (mid && _mappaOwnerMap[mid]) return 'users/' + _mappaOwnerMap[mid] + '/mappa';
    return 'state/mappa';
  }
  /* PG: legge la mappa del DM principale (role==='DM'), non la propria */
  if (isPG()) {
    if (_remoteUsers && typeof _remoteUsers === 'object') {
      var ukeys = Object.keys(_remoteUsers);
      for (var _ui = 0; _ui < ukeys.length; _ui++) {
        if (_remoteUsers[ukeys[_ui]] && _remoteUsers[ukeys[_ui]].role === 'DM') {
          return 'users/' + ukeys[_ui] + '/mappa';
        }
      }
    }
    return 'state/mappa';
  }
  /* Ogni utente (admin incluso) salva sotto il proprio username */
  var uid = _mappaViewAsUser || (_authUser && _authUser.uid) || (state.currentUser && state.currentUser.username);
  return uid ? 'users/' + uid + '/mappa' : 'state/mappa';
}

/* Restituisce il path Firebase per il worldbuilding di una mappa (segue _mappaViewAsUser). */
function _wbPath(mapId) {
  if (_mappaViewAsUser === '__tutte__') {
    if (mapId && _mappaOwnerMap[mapId]) return 'users/' + _mappaOwnerMap[mapId] + '/worldbuilding/' + mapId;
    return 'state/worldbuilding/' + mapId;
  }
  var uid = _mappaViewAsUser || (_authUser && _authUser.uid) || (state.currentUser && state.currentUser.username);
  return uid ? 'users/' + uid + '/worldbuilding/' + mapId : 'state/worldbuilding/' + mapId;
}

/* Restituisce il path Firebase per la libreria storie da visualizzare. */
function _storieActivePath() {
  if (isAdmin() && _storiaViewAsUser && _storiaViewAsUser !== '__tutte__') return 'storie_private/' + _storiaViewAsUser;
  return _storiePrivatePath();
}

/* Attacca (o ri-attacca) il listener realtime al worldbuilding della mappa attiva.
   Gestisce anche la migrazione dal vecchio percorso globale al nuovo per-mappa. */
var _lastWbMapId = null;
var _wbRecovered = false; // true dopo il primo recovery da localStorage

/* Legge il worldbuilding salvato in localStorage.
   Se c'è un worldbuildingMapId salvato, lo restituisce solo se corrisponde alla mappa richiesta.
   Se non c'è worldbuildingMapId (formato vecchio), lo restituisce comunque (recovery una-tantum). */
function _getLocalStorageWorldbuilding(forMapId) {
  try {
    var s = localStorage.getItem('mercante_errante_v1');
    if (!s) return null;
    var d = JSON.parse(s);
    if (!d.worldbuilding || !Array.isArray(d.worldbuilding) || !d.worldbuilding.length) return null;
    if (d.worldbuildingMapId && d.worldbuildingMapId !== forMapId) return null;
    return d.worldbuilding;
  } catch(e) { return null; }
}

function _attachWorldbuildingListener(mapId) {
  if (!_db) return;
  var mid = mapId || 'default';
  var fbPath = _wbPath(mid);
  // Forza re-attach se il path è cambiato (es. admin cambia utente visualizzato)
  var cacheKey = fbPath;
  if (cacheKey === _lastWbMapId) return;
  _lastWbMapId = cacheKey;
  _wbLocalWrite = false;
  if (_wbListenerRef) { _wbListenerRef.off(); _wbListenerRef = null; }

  _wbListenerRef = _db.ref(fbPath);
  _wbListenerRef.on('value', function(snap) {
    if (_wbLocalWrite) { _wbLocalWrite = false; return; }
    var v = snap.val();
    if (v && Array.isArray(v) && v.length > 0) {
      state.worldbuilding = v;
      _wbRecovered = true;
    } else if (!_wbRecovered && isDM() && !_mappaViewAsUser) {
      // Firebase vuoto: prova localStorage come recovery una-tantum (solo per propri dati)
      _wbRecovered = true;
      var lsWb = _getLocalStorageWorldbuilding(mid);
      if (lsWb && lsWb.length > 0) {
        state.worldbuilding = lsWb;
        _wbLocalWrite = true;
        _db.ref(fbPath).set(lsWb);
        notify('Worldbuilding ripristinato correttamente.');
      } else {
        state.worldbuilding = [];
      }
    } else {
      state.worldbuilding = [];
    }
    if (state.section === 'worldbuilding' || state.section === 'storia') renderMain();
  });
}

function fbSaveWorldbuilding() {
  if (!_db) return;
  if (_mappaViewAsUser) return; // non salvare dati altrui
  _wbLocalWrite = true;
  var mid = state.mappaActiveId || 'default';
  _db.ref(_wbPath(mid)).set(state.worldbuilding.length > 0 ? state.worldbuilding : null);
}

/* Attacca (o ri-attacca) il listener Firebase per le mappe dell'utente corrente/visualizzato.
   Chiamata all'init e quando l'admin cambia utente da visualizzare. */
function _attachMappaListener() {
  if (!_db) return;
  if (_mappaListenerRef) { _mappaListenerRef.off(); _mappaListenerRef = null; }
  // Reset stato mappa prima di caricare nuovi dati
  state.mappaList = {}; state.mappaActiveId = ''; state.mappaUrl = ''; state.mappaFlags = {};
  _lastWbMapId = null;
  _mappaOwnerMap = {};

  if (_mappaViewAsUser === '__tutte__') {
    // Modalità "Tutte le mappe": aggrega da tutti gli utenti con letture singole
    var _tPaths = [{ path: 'state/mappa', owner: null }, { path: 'state/multiverso/mappa', owner: '__multiverso__' }]; // legacy e multiverso
    var _tSeen = {};
    // Path personale dell'admin corrente
    var _myUid = _authUser && _authUser.uid;
    if (_myUid) { _tPaths.push({ path: 'users/' + _myUid + '/mappa', owner: _myUid }); _tSeen[_myUid] = true; }
    if (_remoteUsers && typeof _remoteUsers === 'object') {
      Object.keys(_remoteUsers).forEach(function(uid) {
        if (!_tSeen[uid]) { _tPaths.push({ path: 'users/' + uid + '/mappa', owner: uid }); _tSeen[uid] = true; }
      });
    }
    var _tDone = 0;
    _tPaths.forEach(function(p) {
      _db.ref(p.path).once('value', function(snap) {
        var v = snap.val();
        if (v && v.maps && typeof v.maps === 'object') {
          Object.keys(v.maps).forEach(function(mid) {
            state.mappaList[mid] = v.maps[mid];
            if (p.owner) _mappaOwnerMap[mid] = p.owner;
          });
        }
        _tDone++;
        if (_tDone === _tPaths.length) {
          state.mappaList['world-map-ohara'] = { nome: 'Mappa Mondiale Completa (Library of Ohara)', url: 'iframe', flags: {}, isInteractive: true }; state.mappaList['naruto-world-map'] = { nome: 'Naruto', url: 'iframe', flags: {}, isInteractive: true };
          var keys = Object.keys(state.mappaList);
          if (keys.length > 0) {
            state.mappaActiveId = keys[0];
            var am = state.mappaList[state.mappaActiveId];
            if (am) { state.mappaUrl = am.url || ''; state.mappaFlags = am.flags || {}; }
            _attachWorldbuildingListener(state.mappaActiveId);
          }
          if (state.section === 'mappa') renderMain();
        }
      });
    });
    return;
  }

  /* PG: usa _mappaViewAsUser se già scelto, altrimenti trova il DM principale */
  if (isPG()) {
    var _pgDoAttach = function(dmKey) {
      var pgMapPath = dmKey ? 'users/' + dmKey + '/mappa' : 'state/mappa';
      if (_mappaViewAsUser === '__multiverso__') pgMapPath = 'state/multiverso/mappa';
      if (_mappaListenerRef) { _mappaListenerRef.off(); _mappaListenerRef = null; }
      _mappaListenerRef = _db.ref(pgMapPath);
      _mappaListenerRef.on('value', function(snap) {
        var v = snap.val();
        if (v) {
          if (v.maps && typeof v.maps === 'object') state.mappaList = v.maps;
          else if (!v.maps) state.mappaList = state.mappaList || {};
          if (_mappaViewAsUser === '__tutte__' || _mappaViewAsUser === '__multiverso__') { state.mappaList['world-map-ohara'] = { nome: 'Mappa Mondiale Completa (Library of Ohara)', url: 'iframe', flags: {}, isInteractive: true }; state.mappaList['naruto-world-map'] = { nome: 'Naruto', url: 'iframe', flags: {}, isInteractive: true }; } else { delete state.mappaList['world-map-ohara']; delete state.mappaList['naruto-world-map']; }
          if (typeof v.activeMapId === 'string') {
            state.mappaActiveId = v.activeMapId;
            var activeMap = state.mappaList[state.mappaActiveId];
            if (activeMap) {
              var newUrl = activeMap.url || '';
              var urlChanged = newUrl !== state.mappaUrl;
              state.mappaUrl = newUrl;
              state.mappaFlags = activeMap.flags || {};
              if (state.section === 'mappa') {
                var md = document.getElementById('leaflet-map');
                var ip = document.querySelector('.mappa-info-panel');
                if (md && urlChanged) {
                  if (_leafletMap) { try { _leafletMap.remove(); } catch(e){} _leafletMap = null; }
                  if (state.mappaUrl) initLeafletMap(md, ip);
                  else md.innerHTML = '<div class="mappa-no-img"><div class="mappa-no-img-title">Nessuna mappa caricata da questo DM</div></div>';
                } else if (!urlChanged) {
                  refreshMappaFlags();
                }
              }
            }
          } else if (typeof v.url === 'string') {
            state.mappaUrl = v.url;
            if (v.flags && typeof v.flags === 'object') state.mappaFlags = v.flags;
            if (state.section === 'mappa') refreshMappaFlags();
          }
        }
        if (state.mappaActiveId) _attachWorldbuildingListener(state.mappaActiveId);
      });
    };
    if (_mappaViewAsUser) {
      _pgDoAttach(_mappaViewAsUser);
    } else {
      _db.ref('users').once('value', function(usersSnap) {
        var users = usersSnap.val() || {};
        var adminKey = null;
        Object.keys(users).some(function(k) {
          if (users[k] && users[k].role === 'DM') { adminKey = k; return true; }
        });
        if (adminKey) _mappaViewAsUser = adminKey;
        _pgDoAttach(adminKey);
      });
    }
    return;
  }

  _mappaListenerRef = _db.ref(_mappaBasePath());
  _mappaListenerRef.on('value', function(snap) {
    var v = snap.val();
    if (v) {
      if (v.maps && typeof v.maps === 'object') state.mappaList = v.maps;
      else if (!v.maps) state.mappaList = state.mappaList || {};
      if (_mappaViewAsUser === '__tutte__' || _mappaViewAsUser === '__multiverso__') { state.mappaList['world-map-ohara'] = { nome: 'Mappa Mondiale Completa (Library of Ohara)', url: 'iframe', flags: {}, isInteractive: true }; state.mappaList['naruto-world-map'] = { nome: 'Naruto', url: 'iframe', flags: {}, isInteractive: true }; } else { delete state.mappaList['world-map-ohara']; delete state.mappaList['naruto-world-map']; }
      
      if (typeof v.activeMapId === 'string') {
        var prevMapId = state.mappaActiveId;
        state.mappaActiveId = v.activeMapId;
        var activeMap = state.mappaList[state.mappaActiveId];
        if (activeMap) {
          var newUrl = activeMap.url || '';
          var urlChanged = newUrl !== state.mappaUrl;
          state.mappaUrl = newUrl;
          state.mappaFlags = activeMap.flags || {};
          if (state.section === 'mappa') {
            if (urlChanged) {
              var md = document.getElementById('leaflet-map');
              var ip = document.querySelector('.mappa-info-panel');
              if (md) {
                if (_leafletMap) { try { _leafletMap.remove(); } catch(e){} _leafletMap = null; }
                if (state.mappaUrl) initLeafletMap(md, ip);
              }
              var sel = document.getElementById('mappa-selector');
              if (sel) { sel.value = state.mappaActiveId; _refreshMappaSelectorOptions(sel); }
            } else {
              refreshMappaFlags();
            }
          }
        }
        if (state.mappaActiveId !== prevMapId && prevMapId !== '') {
          if (state.section === 'storia') renderMain();
        }
      } else if (typeof v.url === 'string') {
        state.mappaUrl = v.url;
        if (v.flags && typeof v.flags === 'object') state.mappaFlags = v.flags;
        else if (!v.flags) state.mappaFlags = {};
        if (state.section === 'mappa') refreshMappaFlags();
      }
    }
    if (state.section === 'mappa') {
      var selEl = document.getElementById('mappa-selector');
      if (selEl) _refreshMappaSelectorOptions(selEl);
    }
    if (state.mappaActiveId) {
      _attachWorldbuildingListener(state.mappaActiveId);
    }
  });
}

function saveNpc() {
  try {
    var json = JSON.stringify(state.personaggi, null, 2);
    var blob = new Blob([json], {type: 'application/json'});
    triggerDownload(blob, 'database_npc.json');
  } catch (e) { notify('Errore esportazione NPC: ' + e.message, 'err'); }
}

function loadNpc() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Il file non contiene un array di NPC.');
        state.personaggi = data.map(function(p, i) {
          return Object.assign({ _id: 'npc_imp_' + Date.now() + '_' + i }, p);
        });
        saveToStorage();
        fbSavePersonaggi();
        notify('Importati ' + state.personaggi.length + ' NPC.');
        renderMain();
      } catch (err) { notify('Errore: ' + err.message, 'err'); }
    };
    r.readAsText(f);
  };
  input.click();
}

function fbSaveIniziativa(immediate) {
  // Salva immediatamente (azioni esplicite) o con debounce (input testo)
  if (immediate) {
    _doFbSaveIniziativa();
  } else {
    if (_fbSaveIniziativaTimer) clearTimeout(_fbSaveIniziativaTimer);
    _fbSaveIniziativaTimer = setTimeout(_doFbSaveIniziativa, 600);
  }
}

function _doFbSaveIniziativa() {
  if (!_db) return;
  _localWrite.iniziativa = true;
  var toSave = state.combatants.length > 0 ? state.combatants : null;
  _db.ref('state/iniziativa').set({
    combatants: toSave,
    round: state.round,
    activeIndex: state.activeIndex
  }, function() {
    setTimeout(function() { _localWrite.iniziativa = false; }, 200);
  });
}
function fbSaveCaos() {
  if (!_db) return;
  _localWrite.caos = true;
  _db.ref('state/caos/players').set(state.caosPlayers, function() {
    setTimeout(function() { _localWrite.caos = false; }, 200);
  });
  _db.ref('state/caos/doom').set({ doomStage: state.doomStage, doomFilled: state.doomFilled });
}
function fbSaveArmi() {
  if (!_db) return;
  _localWrite.armi = true;
  _db.ref('state/armi').set(state.armi, function() {
    setTimeout(function() { _localWrite.armi = false; }, 200);
  });
}
function fbSaveImpianti() {
  if (!_db) return;
  _db.ref('state/impianti').set(state.impiantiCibernetici.length > 0 ? state.impiantiCibernetici : null);
}
function fbSaveDroghe() {
  if (!_db) return;
  _db.ref('state/droghe').set(state.droghe.length > 0 ? state.droghe : null);
}
function fbSaveVeicoli() {
  if (!_db) return;
  _db.ref('state/veicoli').set(state.veicoli.length > 0 ? state.veicoli : null);
}
function fbSaveVeicoliParty() {
  if (!_db) return;
  _db.ref('state/veicoliParty').set(state.veicoliParty.length > 0 ? state.veicoliParty : null);
}
function fbSaveArmiFuoco() {
  if (!_db) return;
  _db.ref('state/armiFuoco').set(state.armiDaFuoco.length > 0 ? state.armiDaFuoco : null);
}
function fbSavePotenziamentiArmi() {
  if (!_db) return;
  _db.ref('state/armiFuocoPotenziamenti').set(state.potenziamenti.length > 0 ? state.potenziamenti : null);
}
function fbSaveMunizioniArmi() {
  if (!_db) return;
  _db.ref('state/armiFuocoMunizioni').set(state.munizioniArmi.length > 0 ? state.munizioniArmi : null);
}
function fbSaveNotes() { fbSave('state/notes', state.notes); }

/* ---- STATO CENTRALE DELL'APPLICAZIONE ---- */
var state = {
  theme: 'dark',
  section: 'emporio',
  sidebarOpen: false,
  lavagnaOpen: false,
  armi: (typeof SRD_OGGETTI !== "undefined" && SRD_OGGETTI.length ? SRD_OGGETTI.slice() : SAMPLE_DATA.slice()),
  filtroTipo: '',
  filtroValuta: '',
  filtroRarita: '',
  search: '',
  emporioShowHomebrew: false,
  showForm: false,
  editingId: null,
  emporioTab: 'normale',
  impiantiCibernetici: [],
  cyberSearch: '',
  cyberFilterTipo: '',
  cyberFilterRarita: '',
  cyberEditingId: null,
  cyberShowForm: false,
  droghe: [],
  drogheSearch: '',
  drogheShowForm: false,
  drogheEditingId: null,
  veicoli: [],
  veicoliSearch: '',
  veicoliShowForm: false,
  veicoliEditingId: null,
  veicoliTab: 'catalogo',
  veicoliFilterTipo: '',
  veicoliParty: [],
  veicoliPartySearch: '',
  veicoliPartyShowForm: false,
  veicoliPartyEditingId: null,
  armiDaFuoco: [],
  armiDaFuocoSelectedId: null,
  armiDaFuocoSearch: '',
  armiDaFuocoShowForm: false,
  armiDaFuocoEditingId: null,
  armiSubTab: 'armi',
  potenziamenti: [],
  potenziamentiSelectedId: null,
  potenziamentiSearch: '',
  potenziamentiShowForm: false,
  potenziamentiEditingId: null,
  munizioniArmi: [],
  munizioniArmiSelectedId: null,
  munizioniArmiSearch: '',
  munizioniArmiShowForm: false,
  munizioniArmiEditingId: null,
  combatants: [makeEmptyCombatant()],
  round: 1,
  activeIndex: 0,
  expandedCondition: null,
  assigningCondId: null,
  notes: '',

  /* ===== AUTH ===== */
  currentUser: null,   // {username, role, dmPriv}

  /* ===== SEZIONE STATISTICHE & CAOS ===== */
  caosPlayers: [],            // [{id, nome, fail, succ}]
  doomStage: 1,               // 1 = D6, 2 = D8, 3 = D20 finale
  doomFilled: 0,              // spicchi/facce attualmente colorate
  doomTransforming: false,    // flag animazione di trasformazione in corso
  doomEventOpen: false,
  doomEventText: '',
  doomEventLevel: 1,          // 1 = soft, 2 = medium, 3 = catastrofico

  /* ===== SEZIONE GENERATORE NPC ===== */
  geminiKey: '',              // chiave API Google Gemini
  groqKey: '',                // chiave API Groq (velocissima, gratuita) (salvata in localStorage)
  geminiKeyVisible: false,    // mostra/nascondi il box per inserire la chiave
  npcLoading: false,          // true durante la chiamata all'AI
  npcIdea: '',                // ultimo prompt inserito dal DM
  _avatarLoading: false,      // true durante la ricerca immagine
  _showUrlInput: false,       // mostra/nascondi input URL manuale
  regiaActive: false,         // pannello Regia Sonora aperto/chiuso
  regiaScena: '',             // id scena attiva nel pannello regia
  regiaImmagini: {},          // {scenaId: urlImmagine} — personalizzabili come l'Emporio
  regiaUrls: {},              // {scenaId: ytUrl} — URL audio personalizzati per scena
  regiaUrlsSfx: {},           // {sfxId: ytUrl} — URL audio SFX personalizzati
  regiaUrlsBardo: [],         // [] — URL tracce bardo personalizzate
  archivioVisible: false,     // true = mostra l'archivio in colonna destra
  personaggi: (typeof DATABASE_NPC_DEFAULT !== "undefined" ? DATABASE_NPC_DEFAULT.slice() : []),
  npc: {                      // scheda NPC corrente (tab attivo)
    _id: null,
    nome: '', ruolo: '', background: '',
    hp: '', ca: '', eta: '',
    for: '', des: '', cos: '', int: '', sag: '', car: '',
    tratiCaratteriali: '', trattiFisici: '', oggettiIncantesimi: '',
    immagine: '',
    attacchi: [{nome:'',bonus:'',danno:''}],
    azioniTesto: '',
    citta: '',
    stato: 'vivo'
  },
  npcActiveTab: 0,            // tab attivo (0-2)
  npcTabs: [null, null, null],// snapshot delle 3 schede; null = tab vuoto

  /* ===== LANCIATORE DADI ===== */
  diceType: 20,               // d20 selezionato default
  diceHistory: [],            // [{value, diceType, username, trucco}]

  /* ===== MAPPA DEL MONDO ===== */
  mappaUrl: '',               // URL immagine mappa attiva
  mappaFlags: {},             // {flagId: {lat, lng, nome, gradimento, riassunto, immagine}}
  mappaMode: 'move',          // 'move' | 'flag'
  mappaSelectedFlag: null,    // id flag selezionato
  mappaList: {},              // {mapId: {nome, url, flags}} — lista di tutte le mappe
  mappaActiveId: '',           // id mappa attiva
  mappaLayerVisible: 'none',   // 'none' | 'political' | 'associations'

  /* ===== BACHECA DEI RICERCATI ===== */
  bacheItems: [],             // [{id, url, commento}]

  /* ===== BESTIARIO CUSTOM ===== */
  bestiario: (typeof SRD_BESTIARIO !== "undefined" ? SRD_BESTIARIO.slice() : []),
  bestSearch: '',
  bestFiltroTaglia: '',
  bestFiltroTipo: '',
  bestFiltroGS: '',
  bestEditingId: null,
  bestShowForm: false,
  bestTab: 'bestiario',
  incantesimiAggiuntivi: (typeof SRD_INCANTESIMI !== "undefined" ? SRD_INCANTESIMI.slice() : []),
  incSearch: '',
  incFilterLivello: '',
  incFilterClasse: '',
  incShowForm: false,
  incEditingId: null,
  pet: [],
  petSearch: '',

  /* ===== SCHEDA PERSONAGGIO ===== */
  scheda: {},          // scheda attiva (oggetto con .id)
  schedaTab: 'principale',
  schedaLoaded: false,
  schedeList: [],      // [{id,...}] tutte le schede del giocatore
  schedaAttivaId: null, // id scheda aperta, null = lista
  companions: {},      // {charId:{compId:{...}}}
  companionShowForm: false,
  companionEditingId: null,
  companionEditingCharId: null,

  /* ===== WORLDBUILDING ===== */
  worldbuilding: [],           // [{id, nome, desc, citta:[]}]

  /* ===== STORIA DELLA CAMPAGNA ===== */
  storia: {
    content: '',       // HTML del testo
    markers: {},       // {id: {lat, lng, image, text, type}}
    showMap: false,
    mapMode: 'move',   // 'move' | 'place'
    markerType: 'pin', // 'pin' | 'clock' | 'swords'
    selectedMarker: null,
    showLibrary: false,
    currentStoryId: null,
    currentStoryName: ''
  },

  /* ===== SCHEDE PG (DM view) ===== */
  schedePGAll: null,     // null = non ancora caricato, {} = caricato (vuoto o con dati)
  schedePGFilter: 'tutti',
  schedePGOpenChar: null, // {username, charId, char} — scheda aperta, null = lista
  schedePGViewMode: false, // true = DM sta guardando scheda completa
  schedePGShowHidden: false, // DM: mostra schede usate/magazzino
  schedaListFilter: '',   // PG: filtro per stato scheda

  /* ===== LIBRERIA ===== */
  libriCustom: null,    // null = non caricato, {} = caricato
  libriPreferiti: undefined,
  libriShowForm: false, // true = form aggiungi libro visibile
  libriEditId: null,
  libriFilter: 'Tutte',
  libriSearch: '',
  libriSort: 'default',

  /* ===== ELIMINAZIONI ADMIN ===== */
  bestiarioDeleted: [],  // IDs mostri SRD eliminati dall'admin
  armiDeleted: [],       // IDs armi SRD eliminate dall'admin

  /* ===== NEGOZIO & MONETE ===== */
  shopFilter: { livello: 5, tipo: 'generale' },
  monete: { mr: 0, ma: 0, mo: 0, mp: 0 },

  /* ===== GENERATORE NOMI NPC ===== */
  _ngGender: 'qualsiasi'
};

/* Numero di settori per ciascuno stadio */
function doomSegmentsForStage(stage) {
  if (stage === 1) return 6;
  if (stage === 2) return 8;
  return 20; /* stadio 3: D20 finale con 20 facce */
}

/* ===========================================================
   LOCALSTORAGE — Persistenza per Caos & Note
   =========================================================== */
var LS_KEY = 'mercante_errante_v1';

function _applySnapshot(raw) {
  if (!raw) return;
  try {
    var data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      if (Array.isArray(data.caosPlayers)) state.caosPlayers = data.caosPlayers;
      if (typeof data.doomStage === 'number' && data.doomStage >= 1 && data.doomStage <= 3) state.doomStage = data.doomStage;
      if (typeof data.doomFilled === 'number') state.doomFilled = Math.max(0, Math.min(doomSegmentsForStage(state.doomStage), data.doomFilled));
      if (typeof data.notes === 'string') state.notes = data.notes;
      if (data.theme === 'dark' || data.theme === 'light' || data.theme === 'halloween' || data.theme === 'christmas' || data.theme === 'valentine' || data.theme === 'easter') state.theme = data.theme;
      if (typeof data.geminiKey === 'string') state.geminiKey = data.geminiKey;
      if (typeof data.groqKey === 'string') state.groqKey = data.groqKey;
      if (Array.isArray(data.personaggi)) state.personaggi = data.personaggi;
      if (Array.isArray(data.bestiario)) state.bestiario = data.bestiario;
      if (Array.isArray(data.pet)) state.pet = data.pet;
      if (Array.isArray(data.worldbuilding)) state.worldbuilding = data.worldbuilding;
      if (data.bestSearch !== undefined) state.bestSearch = data.bestSearch;
      if (data.regiaImmagini && typeof data.regiaImmagini === 'object') state.regiaImmagini = data.regiaImmagini;
      if (data.regiaUrls && typeof data.regiaUrls === 'object') state.regiaUrls = data.regiaUrls;
      if (data.regiaUrlsSfx && typeof data.regiaUrlsSfx === 'object') state.regiaUrlsSfx = data.regiaUrlsSfx;
      if (Array.isArray(data.regiaUrlsBardo)) state.regiaUrlsBardo = data.regiaUrlsBardo;
      if (data.npc && typeof data.npc === 'object') {
        var npcFields = ['_id','nome','ruolo','background','hp','ca','eta','for','des','cos','int','sag','car',
          'tratiCaratteriali','trattiFisici','oggettiIncantesimi','immagine',
          'azioniTesto','bgShort','razza','competenza','velocita','hpMax','dadiVita',
          'alleati','privilegiTratti','ideali','legami','difetti','altreComp',
          'classeIncantatore','charIncantatore','cdIncantesimi','bonusAttaccoInc',
          'citta','stato'];
        npcFields.forEach(function(f){ if (data.npc[f] !== undefined) state.npc[f] = data.npc[f]; });
        if (Array.isArray(data.npc.attacchi)) state.npc.attacchi = data.npc.attacchi;
        /* Ripristina tutti i campi boolean (circoletti proficiency, spell prepared, ecc.) */
        Object.keys(data.npc).forEach(function(k){
          if (k.endsWith('_p') || k.startsWith('spPrep_') || k.startsWith('ts_') || k.startsWith('spell_') || k.startsWith('trucco_') || k.startsWith('slotTot') || k.startsWith('slotSp') || k.startsWith('sk') || k.startsWith('ts')) {
            state.npc[k] = data.npc[k];
          }
        });
      }
      if (typeof data.npcActiveTab === 'number') state.npcActiveTab = data.npcActiveTab;
      if (Array.isArray(data.npcTabs)) state.npcTabs = data.npcTabs;
      if (data.storia && typeof data.storia === 'object') {
        if (typeof data.storia.content === 'string') state.storia.content = data.storia.content;
      }
      if (typeof data.worldbuildingMapId === 'string' && data.worldbuildingMapId) state.mappaActiveId = data.worldbuildingMapId;
    }
  } catch (e) {
    console.warn('[Mercante] Lettura snapshot fallita:', e.message);
  }
}

function loadFromStorageAsync(cb) {
    if (window.ImageDB) {
        window.ImageDB.getState().then(function(snapStr) {
            if (snapStr) {
                _applySnapshot(snapStr);
            } else {
                _applySnapshot(localStorage.getItem(LS_KEY));
            }
            cb();
        }).catch(function() {
            _applySnapshot(localStorage.getItem(LS_KEY));
            cb();
        });
    } else {
        _applySnapshot(localStorage.getItem(LS_KEY));
        cb();
    }
}

function saveToStorage() {
  try {
    var snapshot = {
      caosPlayers: state.caosPlayers,
      doomStage: state.doomStage,
      doomFilled: state.doomFilled,
      notes: state.notes,
      theme: state.theme,
      geminiKey: state.geminiKey,
      groqKey: state.groqKey,
      personaggi: state.personaggi,
      bestiario: state.bestiario,
      pet: state.pet,
      worldbuilding: state.worldbuilding,
      worldbuildingMapId: state.mappaActiveId || '',
      npc: state.npc,
      npcActiveTab: state.npcActiveTab,
      npcTabs: state.npcTabs,
      regiaImmagini: state.regiaImmagini,
      regiaUrls: state.regiaUrls,
      regiaUrlsSfx: state.regiaUrlsSfx,
      regiaUrlsBardo: state.regiaUrlsBardo,
      storia: { content: state.storia.content, markers: state.storia.markers }
    };
    var snapStr = JSON.stringify(snapshot);
    // Salva sempre su IndexedDB per scavalcare i 5MB di quota!
    if(window.ImageDB) window.ImageDB.saveState(snapStr).catch(function(){});
    // E prova a salvare anche su localStorage come fallback
    localStorage.setItem(LS_KEY, snapStr);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      // Ignorato intenzionalmente.
    }
  }
}

/* Variabili per il drag-and-drop dell'iniziativa */
var _dragSrcId = null;

function makeCaosPlayer(nome) {
  return {
    id: 'cp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    nome: nome || '',
    fail: 0,
    succ: 0
  };
}

function makeEmptyCombatant() {
  return {
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    nome: '', iniziativa: '', hp: '', tipo: 'pg', condizioni: []
  };
}

function rarityClass(r) { return 'rarity-' + r.replace(/\s+/g, ''); }
function glyphFor(name) {
  if (!name) return '\u2694';
  var c = name.trim().charAt(0);
  return c ? c.toUpperCase() : '\u2694';
}
function getCategoria(id) {
  for (var i = 0; i < CATEGORIE.length; i++) if (CATEGORIE[i].id === id) return CATEGORIE[i];
  return CATEGORIE[0];
}
function getCondizione(id) {
  for (var i = 0; i < CONDIZIONI.length; i++) if (CONDIZIONI[i].id === id) return CONDIZIONI[i];
  return null;
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function nl2br(s) { return s ? s.replace(/\n/g,'<br>') : ''; }
function _textScore() {
  var score = 0;
  for (var i = 0; i < arguments.length; i++) {
    var t = arguments[i] || '';
    score += t.length + (t.match(/\n/g) || []).length * 28;
  }
  return score;
}

var toastTimer = null;
function notify(msg, kind) {
  var ex = document.querySelector('.toast');
  if (ex) ex.remove();
  if (toastTimer) clearTimeout(toastTimer);
  var t = document.createElement('div');
  t.className = 'toast' + (kind === 'err' ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  toastTimer = setTimeout(function() { t.remove(); }, 3000);
}

var ICON = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  save: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.25 15.75H3.75a1.5 1.5 0 0 1-1.5-1.5v-10.5a1.5 1.5 0 0 1 1.5-1.5h7.5l4.5 4.5v7.5a1.5 1.5 0 0 1-1.5 1.5z"/><path d="M12 15.75v-6H6v6M6 2.25v3.75h5.25"/></svg>',
  folder: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15.75 13.5a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5h3.75l1.5 2.25h5.25a1.5 1.5 0 0 1 1.5 1.5z"/></svg>',
  plus: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 3.75v10.5M3.75 9h10.5"/></svg>',
  edit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.333 2L14 4.667 5.333 13.333 2 14l.667-3.333L11.333 2z"/></svg>',
  trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5.333 4V2.667A1.333 1.333 0 0 1 6.667 1.333h2.666A1.333 1.333 0 0 1 10.667 2.667V4M12.667 4v9.333A1.333 1.333 0 0 1 11.333 14.667H4.667a1.333 1.333 0 0 1-1.334-1.334V4"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>',
  sparkle: '<svg viewBox="0 0 18 18" fill="currentColor"><path d="M9 0 L10.5 6 L17 7.5 L10.5 9 L9 15 L7.5 9 L1 7.5 L7.5 6 Z" opacity="0.9"/></svg>',
  sword: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/></svg>',
  swords: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 17.5 3 3-3 3-3-3"/><path d="M21 21L7.5 7.5 6 6H3v3l1.5 1.5L18 24"/><path d="m9.5 6.5 3-3 3 3-3 3"/><path d="M15 3h6v6"/><path d="m15 9 6-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  arrowRight: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  refresh: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.25 3v4.5h4.5M15.75 15v-4.5h-4.5"/><path d="M3.945 8.25a6 6 0 0 1 10.16-2.475L15.75 7.5M2.25 10.5l1.645 1.725a6 6 0 0 0 10.16-2.475"/></svg>',
  scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/><path d="M5 18a3 3 0 0 1-3-3V9a2 2 0 0 1 4 0"/><path d="M9 8h8M9 12h8M9 16h5"/></svg>',
  download: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12v3a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 15 15v-3"/><path d="M5.25 7.5 9 11.25 12.75 7.5"/><path d="M9 11.25V2.25"/></svg>',
  skullDice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L21 8 L18 20 H6 L3 8 Z"/><path d="M12 2 L12 22"/><path d="M3 8 L21 8"/><circle cx="9.5" cy="12.5" r="1.2" fill="currentColor"/><circle cx="14.5" cy="12.5" r="1.2" fill="currentColor"/><path d="M10 17 L14 17"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  npc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/><path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/><path d="M4 4l.5 1.5L6 6l-1.5.5L4 8l-.5-1.5L2 6l1.5-.5z"/></svg>',
  dragHandle: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
};

function getFilteredArmi() {
  var filtered = state.armi.filter(function(w) {
    if (state.filtroTipo && w.tipo !== state.filtroTipo) return false;
    if (state.filtroValuta && w.valuta !== state.filtroValuta) return false;
    if (state.filtroRarita && w.rarita !== state.filtroRarita) return false;
    if (!state.emporioShowHomebrew && (w.id||'').startsWith('w_')) return false;

    if (state.search) {
      var s = state.search.toLowerCase();
      var n = (w.nome||'').toLowerCase();
      var d = (w.descrizione||'').toLowerCase();
      if (n.indexOf(s) < 0 && d.indexOf(s) < 0) return false;
    }
    return true;
  });

  filtered.sort(function(a, b) {
    var nA = (a.nome||'').toLowerCase();
    var nB = (b.nome||'').toLowerCase();

    if (state.search) {
      var s = state.search.toLowerCase();
      var exactA = (nA === s);
      var exactB = (nB === s);
      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;

      var startA = nA.indexOf(s) === 0;
      var startB = nB.indexOf(s) === 0;
      if (startA && !startB) return -1;
      if (!startA && startB) return 1;

      var nameMatchA = nA.indexOf(s) >= 0;
      var nameMatchB = nB.indexOf(s) >= 0;
      if (nameMatchA && !nameMatchB) return -1;
      if (!nameMatchA && nameMatchB) return 1;
    }

    if (nA < nB) return -1;
    if (nA > nB) return 1;
    return 0;
  });

  return filtered;
}



/* ============================================================================
   SEZIONE 2: MOTORE DI RENDERING PRINCIPALE (render & renderMain)
   ============================================================================ */
function render() {
  document.documentElement.setAttribute('data-theme', state.theme);
  var app = document.getElementById('app');
  app.innerHTML = '';
  try {
  var shell = document.createElement('div');
  shell.className = 'app-shell';

  var mt = document.createElement('button');
  mt.className = 'sidebar-toggle';
  mt.innerHTML = ICON.menu;
  mt.onclick = function() { state.sidebarOpen = !state.sidebarOpen; render(); };
  shell.appendChild(mt);

  shell.appendChild(renderSidebar());

  /* Backdrop per chiudere la sidebar cliccando fuori (solo mobile) */
  if (state.sidebarOpen) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.onclick = function() { state.sidebarOpen = false; render(); };
    shell.appendChild(backdrop);
  }

  /* Wrapper contenuto — split quando regia attiva */
  var contentWrap = document.createElement('div');
  contentWrap.className = 'content-wrap' + (state.regiaActive ? ' regia-split' : '');

  var main = document.createElement('main');
  main.className = 'main-content';
  if (state.section === 'emporio') main.appendChild(renderEmporio());
  else if (state.section === 'iniziativa') main.appendChild(renderIniziativa());
  else if (state.section === 'note') main.appendChild(renderNote());
  else if (state.section === 'caos') main.appendChild(renderCaos());
  else if (state.section === 'generatore') main.appendChild(renderGeneratore());
  else if (state.section === 'dadi') main.appendChild(renderDadi());
  else if (state.section === 'mappa') main.appendChild(renderMappa());
  
  else if (state.section === 'scheda') { main.appendChild(_buildSchedaWithLavagna()); }
  else if (state.section === 'bestiario') main.appendChild(renderBestiario());
  else if (state.section === 'incantesimi') main.appendChild(renderIncantesimiAggiuntivi());
  else if (state.section === 'worldbuilding') { if (isDM()) main.appendChild(renderWorldbuilding()); else main.appendChild(renderDadi()); }
  else if (state.section === 'bacheca') main.appendChild(renderBacheca());
  else if (state.section === 'storia') { if (isDM()) { try { main.appendChild(renderStoria()); } catch(e) { var _se=document.createElement('div');_se.style.cssText='padding:2rem;color:#ff9c9c;font-family:monospace;font-size:13px;';_se.innerHTML='<b>Errore Storia:</b><br><pre>'+String(e)+'</pre>';main.appendChild(_se); } } else main.appendChild(renderDadi()); }
  else if (state.section === 'archivio') { if (isDM()) main.appendChild(renderArchivio()); else main.appendChild(renderDadi()); }
  else if (state.section === 'schedepg') { if (isDM()) { if(state.schedePGViewMode) main.appendChild(_buildSchedaWithLavagna()); else main.appendChild(renderSchedePG()); } else main.appendChild(renderDadi()); }
  else if (state.section === 'libri') main.appendChild(renderLibri());
  else if (state.section === 'tavolo') { var _twrap=renderTavolo();_twrap.style.height='calc(100vh - 120px)';main.appendChild(_twrap); }
  contentWrap.appendChild(main);

  if (state.regiaActive) {
    contentWrap.appendChild(renderRegiaSonora());
  }

  shell.appendChild(contentWrap);
  app.appendChild(shell);

  if (state.showForm) document.body.appendChild(renderWeaponForm());
  if (state.doomEventOpen) document.body.appendChild(renderDoomEventModal());

  // Re-render badge after full render
  renderUserBadge();
  if (window.SiumAnimations && window.SiumAnimations.onRender) window.SiumAnimations.onRender(false);
  } catch(_renderErr) {
    app.innerHTML = '<div style="padding:2rem;color:#ff9c9c;font-family:monospace;font-size:13px;background:#1a0a0a;min-height:100vh;"><b>ERRORE RENDER:</b><br><pre>' + String(_renderErr) + '\n' + (_renderErr.stack||'') + '</pre></div>';
  }
}

function renderMain() {
  var _scrollX = window.scrollX || document.documentElement.scrollLeft;
  var _scrollY = window.scrollY || document.documentElement.scrollTop;
  var _mcNode = document.querySelector('.main-content');
  var _mcScrollY = _mcNode ? _mcNode.scrollTop : 0;
  if (typeof window._lastRenderedSection === 'undefined') window._lastRenderedSection = state.section;
  var _sectionChanged = (window._lastRenderedSection !== state.section);
  window._lastRenderedSection = state.section;

  var main = document.querySelector('.main-content');
  if (!main) { render(); return; }
  if (state.section === 'storia') {
    var _ed = document.getElementById('storia-editor');
    if (_ed) { state.storia.content = _ed.innerHTML; }
  }
  if(_sectionCleanup){_sectionCleanup();_sectionCleanup=null;}
  if(_tavoloRef){_tavoloRef.off('value');_tavoloRef=null;}
  main.innerHTML = '';
  if (state.section === 'emporio') main.appendChild(renderEmporio());
  else if (state.section === 'iniziativa') main.appendChild(renderIniziativa());
  else if (state.section === 'note') main.appendChild(renderNote());
  else if (state.section === 'caos') main.appendChild(renderCaos());
  else if (state.section === 'generatore') main.appendChild(renderGeneratore());
  else if (state.section === 'dadi') main.appendChild(renderDadi());
  else if (state.section === 'mappa') main.appendChild(renderMappa());
  
  else if (state.section === 'scheda') { main.appendChild(_buildSchedaWithLavagna()); }
  else if (state.section === 'bestiario') main.appendChild(renderBestiario());
  else if (state.section === 'incantesimi') main.appendChild(renderIncantesimiAggiuntivi());
  else if (state.section === 'worldbuilding') { if (isDM()) main.appendChild(renderWorldbuilding()); else main.appendChild(renderDadi()); }
  else if (state.section === 'bacheca') main.appendChild(renderBacheca());
  else if (state.section === 'storia') { if (isDM()) { try { main.appendChild(renderStoria()); } catch(e) { var _se2=document.createElement('div');_se2.style.cssText='padding:2rem;color:#ff9c9c;font-family:monospace;font-size:13px;';_se2.innerHTML='<b>Errore Storia:</b><br><pre>'+String(e)+'</pre>';main.appendChild(_se2); } } else main.appendChild(renderDadi()); }
  else if (state.section === 'archivio') { if (isDM()) main.appendChild(renderArchivio()); else main.appendChild(renderDadi()); }
  else if (state.section === 'schedepg') { if (isDM()) { if(state.schedePGViewMode) main.appendChild(_buildSchedaWithLavagna()); else main.appendChild(renderSchedePG()); } else main.appendChild(renderDadi()); }
  else if (state.section === 'libri') main.appendChild(renderLibri());
  else if (state.section === 'tavolo') { var _twrap=renderTavolo();_twrap.style.height='calc(100vh - 120px)';main.appendChild(_twrap); }

  var sb = document.querySelector('.sidebar');
  if (sb) sb.replaceWith(renderSidebar());

  /* Aggiorna classe split se regia è attiva */
  var cw = document.querySelector('.content-wrap');
  if (cw) {
    cw.className = 'content-wrap' + (state.regiaActive ? ' regia-split' : '');
    var existingRegia = cw.querySelector('.regia-panel');
    if (state.regiaActive && !existingRegia) cw.appendChild(renderRegiaSonora());
    if (!state.regiaActive && existingRegia) existingRegia.remove();
  }

  if (window.SiumAnimations && window.SiumAnimations.onRender) window.SiumAnimations.onRender(_sectionChanged);
  if (!_sectionChanged) {
    var _mc = document.querySelector('.main-content');
    if (_mc && typeof _mcScrollY !== 'undefined') {
      _mc.scrollTop = _mcScrollY;
    }
    window.scrollTo({ left: _scrollX, top: _scrollY, behavior: 'instant' });
  }
}

/* ============================================================
   SCHEDE ALTERNATIVE (7th Sea)
   ============================================================ */

var SHEET_DEFS = {
  '7thsea': {
    label: '7th Sea',
    thumbnail: 'schede/7th_sea.webp',
    pages: ['schede/7th_sea.webp'],
    pageLabels: ['Scheda']
  },
};

/* ============================================================
   SCHEDE ALTERNATIVE — campi fissi sovrapposti all'immagine
   ============================================================ */

function _sf(key, tp, l, t, w, h) {
  return { key:key, tp:tp, l:l, t:t, w:w, h:h||null };
}

var SHEET_FIELDS = (function() {
  var f = {};

  /* ---- 7th Sea (1 pagina) ---- */
  f['7thsea'] = { 0: [
    _sf('eroe',     'i','38%','5.1%', '57%'),
    _sf('nazione',  'i','38%','8.4%', '57%'),
    _sf('concetto', 'i','38%','11.7%','57%'),
    _sf('vig_att','i','3.5%','18.8%','8%'), _sf('vig_max','i','13%','18.8%','7%'),
    _sf('gra_att','i','3.5%','26.3%','8%'), _sf('gra_max','i','13%','26.3%','7%'),
    _sf('ris_att','i','3.5%','33.8%','8%'), _sf('ris_max','i','13%','33.8%','7%'),
    _sf('acu_att','i','3.5%','41.3%','8%'), _sf('acu_max','i','13%','41.3%','7%'),
    _sf('pan_att','i','3.5%','48.8%','8%'), _sf('pan_max','i','13%','48.8%','7%'),
    _sf('ricchezza','i','53%','16%','8%'),
    _sf('fama',      'a','27%','19%',  '29%','10.5%'),
    _sf('background','a','62%','14.5%','35%','20%'),
    _sf('vantaggi',  'a','27%','30.5%','29%','23%'),
    _sf('s_titolo',    'i','63%','30.5%','34%'),
    _sf('s_scopo',     'i','63%','33.5%','34%'),
    _sf('s_ricompensa','i','63%','38.5%','34%'),
    _sf('s_atto',      'i','63%','41.5%','34%'),
    _sf('virtu', 'i','63%','47.5%','34%'),
    _sf('hubris','i','63%','51.5%','34%'),
    _sf('sk_allettare','i','15%','57.3%','6%'), _sf('sk_adguerra',  'i','15%','59.1%','6%'),
    _sf('sk_atletica', 'i','15%','60.9%','6%'), _sf('sk_cavalcare', 'i','15%','62.7%','6%'),
    _sf('sk_convincere','i','15%','64.5%','6%'),_sf('sk_empatia',   'i','15%','66.3%','6%'),
    _sf('sk_esibirsi', 'i','15%','68.1%','6%'), _sf('sk_furto',     'i','15%','69.9%','6%'),
    _sf('sk_intimidire','i','15%','71.7%','6%'),_sf('sk_istruzione','i','15%','73.5%','6%'),
    _sf('sk_mira',     'i','15%','75.3%','6%'), _sf('sk_mischia',   'i','15%','77.1%','6%'),
    _sf('sk_nascond',  'i','15%','78.9%','6%'), _sf('sk_navigaz',   'i','15%','80.7%','6%'),
    _sf('sk_notare',   'i','15%','82.5%','6%'), _sf('sk_rissa',     'i','15%','84.3%','6%'),
    _sf('punti_eroe','i','12.5%','96%','8%'),
  ]};

  return f;
}());

/* Renderizza una scheda alternativa con campi fissi sovrapposti all'immagine */
/* ============================================================
   7TH SEA — scheda HTML custom
   ============================================================ */
function _render7thSeaSheet() {
  var _dm = state.schedePGViewMode;
  var s   = state.scheda;

  function gv(k,d){ return s[k]!==undefined?s[k]:(d!==undefined?d:''); }
  function sv(k,v){ if(!_dm){s[k]=v;fbSaveScheda();} }

  /* input testo */
  function _inp(key,ph,light){
    var el=document.createElement('input');el.type='text';
    el.value=gv(key);el.placeholder=ph||'';el.readOnly=_dm;
    var col=light?'#f0e8c8':'#1a1a0a';
    var bc=light?'rgba(201,165,92,0.7)':'rgba(28,58,92,0.45)';
    el.style.cssText='width:100%;border:none;border-bottom:1px solid '+bc+';background:transparent;font-size:14px;font-family:Arial,sans-serif;padding:3px 4px;outline:none;color:'+col+';box-sizing:border-box;';
    el.oninput=function(){sv(key,this.value);};
    return el;
  }
  /* textarea */
  function _ta(key,rows){
    var el=document.createElement('textarea');
    el.value=gv(key);el.rows=rows||3;el.readOnly=_dm;
    el.style.cssText='width:100%;border:1px solid rgba(28,58,92,0.25);background:rgba(255,255,255,0.18);font-size:13px;font-family:Arial,sans-serif;padding:4px;outline:none;color:#1a1a0a;resize:vertical;box-sizing:border-box;line-height:1.5;';
    el.oninput=function(){sv(key,this.value);};
    return el;
  }
  /* numero */
  function _num(key,mn,mx,d){
    var el=document.createElement('input');el.type='number';el.min=mn||0;el.max=mx||5;
    el.value=gv(key,d||0);el.readOnly=_dm;
    el.style.cssText='width:64px;border:2px solid #c9a55c;border-radius:4px;background:rgba(255,255,255,0.35);font-size:26px;font-weight:900;font-family:\'Cinzel\',serif;padding:2px 0;outline:none;color:#0d2440;text-align:center;box-sizing:border-box;-moz-appearance:textfield;';
    el.oninput=function(){sv(key,parseInt(this.value)||0);};
    return el;
  }
  /* header sezione */
  function _hdr(txt){
    var d=document.createElement('div');
    d.style.cssText='background:linear-gradient(90deg,#081828,#0d2440,#081828);color:#c9a55c;font-family:\'Cinzel\',serif;font-size:12px;font-weight:700;letter-spacing:0.12em;text-align:center;padding:5px 6px;text-transform:uppercase;';
    d.textContent=txt;return d;
  }
  /* block container */
  function _blk(hdrTxt){
    var b=document.createElement('div');
    b.style.cssText='border:1px solid rgba(201,165,92,0.3);border-radius:3px;overflow:hidden;background:rgba(240,232,200,0.45);backdrop-filter:blur(2px);';
    b.appendChild(_hdr(hdrTxt));
    var inn=document.createElement('div');inn.style.cssText='padding:5px;';
    b.appendChild(inn);b._i=inn;return b;
  }
  /* pallini */
  function _dots(key,max,sz){
    sz=sz||14;
    var c=document.createElement('span');c.style.cssText='display:inline-flex;align-items:center;gap:4px;';
    function rf(){
      c.innerHTML='';var v=parseInt(s[key])||0;
      for(var i=1;i<=max;i++){(function(n){
        var d=document.createElement('span');
        d.style.cssText='display:inline-block;width:'+sz+'px;height:'+sz+'px;border-radius:50%;border:2px solid #0d2440;cursor:'+(_dm?'default':'pointer')+';background:'+(n<=v?'#0d2440':'transparent')+';box-sizing:border-box;flex-shrink:0;transition:background .15s;';
        if(!_dm)d.onclick=function(){s[key]=(n===(parseInt(s[key])||0))?n-1:n;fbSaveScheda();rf();};
        c.appendChild(d);
      }(i));}
    }
    rf();return c;
  }

  /* ===================== SPIRALE DELLA MORTE — immagine + click-to-place X ===================== */
  function _buildSpiral(container){
    container.innerHTML='';

    var marks=[];
    try{marks=JSON.parse(s.xMarks||'[]');}catch(e){marks=[];}

    var outerWrap=document.createElement('div');
    outerWrap.style.cssText='display:flex;flex-direction:column;gap:4px;';

    var wr=document.createElement('div');
    wr.style.cssText='position:relative;width:100%;padding-top:63.93%;user-select:none;';
    var img=document.createElement('img');
    img.src='schede/spirale_morte.png';
    img.draggable=false;
    img.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;';
    wr.appendChild(img);

    function addXEl(i,m){
      var x=document.createElement('div');
      x.style.cssText='position:absolute;left:'+m[0]+'%;top:'+m[1]+'%;'
        +'transform:translate(-50%,-50%);pointer-events:auto;'
        +'color:#c0392b;font-size:1.7em;font-weight:900;line-height:1;'
        +'text-shadow:1px 1px 2px #000,-1px -1px 2px #000;'
        +'cursor:'+(_dm?'default':'pointer')+';';
      x.textContent='✕';
      if(!_dm){
        x.title='Clicca per rimuovere';
        x.addEventListener('click',function(e){
          e.stopPropagation();
          marks.splice(i,1);
          s.xMarks=JSON.stringify(marks);
          fbSaveScheda();_buildSpiral(container);
        });
      }
      wr.appendChild(x);
    }
    marks.forEach(function(m,i){addXEl(i,m);});

    outerWrap.appendChild(wr);

    if(!_dm){
      var placing=false;
      var panel=document.createElement('div');
      panel.style.cssText='display:flex;align-items:center;gap:8px;padding:4px 2px;flex-wrap:wrap;';

      var btn=document.createElement('button');
      btn.textContent='✕ Posiziona X';
      btn.style.cssText='background:#2a1010;border:1px solid #c04040;color:#f08080;'
        +'border-radius:3px;padding:0.3rem 0.8rem;cursor:pointer;font-size:12px;font-family:\'Cinzel\',serif;';
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        placing=!placing;
        btn.style.background=placing?'#6a1010':'#2a1010';
        btn.textContent=placing?'✕ Clicca sulla spirale...':'✕ Posiziona X';
        wr.style.cursor=placing?'crosshair':'';
      });
      panel.appendChild(btn);

      var clrBtn=document.createElement('button');
      clrBtn.textContent='Cancella tutte';
      clrBtn.style.cssText='background:transparent;border:1px solid rgba(180,120,60,0.4);'
        +'color:#c9a55c;border-radius:3px;padding:0.3rem 0.6rem;cursor:pointer;font-size:11px;'
        +'font-family:\'Cinzel\',serif;display:'+(marks.length?'':'none')+';';
      clrBtn.addEventListener('click',function(){
        s.xMarks='[]';fbSaveScheda();_buildSpiral(container);
      });
      panel.appendChild(clrBtn);

      wr.addEventListener('click',function(e){
        if(!placing)return;
        var rect=wr.getBoundingClientRect();
        var m=[
          +((e.clientX-rect.left)/rect.width*100).toFixed(1),
          +((e.clientY-rect.top)/rect.height*100).toFixed(1)
        ];
        marks.push(m);
        s.xMarks=JSON.stringify(marks);
        fbSaveScheda();
        addXEl(marks.length-1,m);
        clrBtn.style.display='';
      });

      outerWrap.appendChild(panel);
    }

    container.appendChild(outerWrap);
  }

  /* ========================= RENDER ========================= */
  var wrap=document.createElement('div');
  wrap.style.cssText='min-height:100vh;display:flex;flex-direction:column;background:#2a2a3a;';

  /* NAV */
  var nav=document.createElement('div');
  nav.style.cssText='background:#060e1c;border-bottom:2px solid #c9a55c;padding:0.45rem 1rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;position:sticky;top:0;z-index:50;';
  var bk=document.createElement('button');bk.textContent='← Indietro';
  bk.style.cssText='background:#0d2440;border:1px solid #c9a55c;color:#c9a55c;border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-size:12px;font-family:\'Cinzel\',serif;';
  bk.onclick=function(){if(_dm){state.schedePGViewMode=false;state.schedePGOpenChar=null;state.schedaAttivaId=null;state.scheda={};state.companions={};}else{state.schedaAttivaId=null;}renderMain();};
  nav.appendChild(bk);
  var nameInp=document.createElement('input');nameInp.type='text';
  nameInp.value=s.nome||'';nameInp.placeholder='Nome personaggio';nameInp.readOnly=_dm;
  nameInp.style.cssText='flex:1;min-width:0;background:transparent;border:none;border-bottom:1px solid #c9a55c;color:#f0e4cc;font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;outline:none;padding:0.2rem 0.4rem;';
  nameInp.oninput=function(){sv('nome',this.value);};nav.appendChild(nameInp);
  if(!_dm){
    var delB=document.createElement('button');delB.textContent='🗑 Elimina';
    delB.style.cssText='background:#4a1010;border:1px solid #c04040;color:#f08080;border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-size:12px;font-family:\'Cinzel\',serif;';
    delB.onclick=function(){
      if(!confirm('Eliminare "'+(s.nome||s.eroe||s.nomePersonaggio||'questa scheda')+'"?'))return;
      var did=state.schedaAttivaId;
      state.schedeList=state.schedeList.filter(function(x){return x.id!==did;});
      fbDeleteSchedaItem(did);state.schedaAttivaId=null;state.scheda={};renderMain();
    };nav.appendChild(delB);
  }
  if(_dm){var badge=document.createElement('span');badge.textContent='⚔ Vista Master — sola lettura';badge.style.cssText='font-size:11px;color:#c9a55c;background:rgba(201,165,92,0.1);border:1px solid rgba(201,165,92,0.3);border-radius:3px;padding:0.2rem 0.6rem;';nav.appendChild(badge);}
  wrap.appendChild(nav);

  /* SHEET OUTER */
  var outer=document.createElement('div');
  outer.style.cssText='flex:1;overflow-y:auto;padding:1rem;display:flex;justify-content:center;';
  var sheet=document.createElement('div');
  sheet.style.cssText='width:100%;max-width:980px;position:relative;overflow:hidden;font-family:\'Cinzel\',serif;'
    +'background:radial-gradient(ellipse at 20% 30%,#f5ead5 0%,#ecdcc0 40%,#e5d0aa 70%,#dcc8a0 100%);'
    +'border:3px solid #0d2440;box-shadow:0 8px 40px rgba(0,0,0,0.8),inset 0 0 60px rgba(0,0,0,0.05);';

  /* watermark ancora */
  var wm=document.createElement('div');
  wm.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:300px;opacity:0.025;pointer-events:none;z-index:0;user-select:none;line-height:1;';
  wm.textContent='⚓';sheet.appendChild(wm);
  /* bordo dorato interno */
  var ib=document.createElement('div');
  ib.style.cssText='position:absolute;inset:5px;border:1px solid rgba(201,165,92,0.25);pointer-events:none;z-index:0;';
  sheet.appendChild(ib);

  /* ===== HEADER (logo + campi, NO ritratto) ===== */
  var topHdr=document.createElement('div');
  topHdr.style.cssText='background:linear-gradient(180deg,#020a14 0%,#060e1c 50%,#0a1828 100%);padding:10px 14px;display:flex;align-items:center;gap:14px;border-bottom:3px solid #c9a55c;position:relative;z-index:1;';

  /* logo */
  var logoD=document.createElement('div');logoD.style.cssText='display:flex;flex-direction:column;align-items:center;min-width:100px;gap:1px;';
  var l1=document.createElement('div');l1.style.cssText='font-family:\'Cinzel\',serif;font-size:30px;font-weight:900;color:#c9a55c;letter-spacing:0.03em;line-height:1;text-shadow:0 0 15px rgba(201,165,92,0.6),2px 2px 5px rgba(0,0,0,0.9);';
  l1.innerHTML='7<sup style="font-size:15px;vertical-align:super;letter-spacing:0">TH</sup>';
  var l2=document.createElement('div');l2.style.cssText='font-family:\'Cinzel\',serif;font-size:24px;font-weight:900;color:#c9a55c;letter-spacing:0.2em;text-shadow:0 0 15px rgba(201,165,92,0.6);';l2.textContent='SEA';
  var l3=document.createElement('div');l3.style.cssText='font-size:18px;color:rgba(201,165,92,0.6);margin-top:2px;';l3.textContent='⚓';
  logoD.appendChild(l1);logoD.appendChild(l2);logoD.appendChild(l3);
  topHdr.appendChild(logoD);

  /* campi header */
  var hFlds=document.createElement('div');hFlds.style.cssText='flex:1;display:flex;flex-direction:column;gap:9px;';
  [['eroe','EROE'],['nazione','NAZIONE'],['concetto','CONCETTO']].forEach(function(p){
    var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;';
    var lbl=document.createElement('span');lbl.style.cssText='color:#c9a55c;font-size:11px;font-weight:700;letter-spacing:0.12em;min-width:80px;text-align:right;';lbl.textContent=p[1];row.appendChild(lbl);
    var inp=_inp(p[0],'',true);row.appendChild(inp);hFlds.appendChild(row);
  });
  topHdr.appendChild(hFlds);
  sheet.appendChild(topHdr);

  /* ===== CORPO: [ritratto+attributi] [col2] [col3] ===== */
  var body=document.createElement('div');
  body.style.cssText='display:grid;grid-template-columns:210px 1fr 1fr;gap:8px;padding:8px;position:relative;z-index:1;';

  /* COL 1 — Ritratto + Attributi */
  var col1=document.createElement('div');col1.style.cssText='display:flex;flex-direction:column;gap:6px;';

  /* ---- Ritratto ---- */
  var portraitBlk=_blk('Ritratto');
  var portrait=document.createElement('div');
  portrait.style.cssText='width:100%;height:220px;background:#020a14;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;cursor:'+(_dm?'default':'pointer')+';box-shadow:inset 0 0 12px rgba(0,0,0,0.7);';
  if(s.portrait){
    var pImg=document.createElement('img');pImg.src=s.portrait;pImg.style.cssText='width:100%;height:100%;object-fit:cover;';portrait.appendChild(pImg);
  } else {
    portrait.innerHTML='<div style="text-align:center;color:rgba(201,165,92,0.5);font-size:13px;font-family:Cinzel,serif;line-height:2;"><div style="font-size:44px;">🖼</div>Immagine<br>Personaggio</div>';
  }
  if(!_dm){
    var fi=document.createElement('input');fi.type='file';fi.accept='image/*';fi.style.display='none';
    fi.onchange=function(e){
      var f=e.target.files[0];if(!f)return;
      var rd=new FileReader();
      rd.onload=function(ev){
        var im=new Image();
        im.onload=function(){
          var cv=document.createElement('canvas');cv.width=200;cv.height=260;
          cv.getContext('2d').drawImage(im,0,0,200,260);
          sv('portrait',cv.toDataURL('image/jpeg',0.8));renderMain();
        };im.src=ev.target.result;
      };rd.readAsDataURL(f);
    };
    portrait.onclick=function(){fi.click();};portrait.title='Clicca per caricare un\'immagine';
    portrait.appendChild(fi);
    var ho=document.createElement('div');ho.style.cssText='position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;font-size:28px;';
    ho.textContent='📷';portrait.appendChild(ho);
    portrait.onmouseenter=function(){ho.style.opacity='1';};portrait.onmouseleave=function(){ho.style.opacity='0';};
  }
  portraitBlk._i.style.padding='0';
  portraitBlk._i.appendChild(portrait);col1.appendChild(portraitBlk);

  /* ---- Attributi ---- */
  [
    {key:'vigore',      lbl:'Vigore',       desc:'Forza e potenza fisica'},
    {key:'grazia',      lbl:'Grazia',        desc:'Coordinazione e agilità'},
    {key:'risolutezza', lbl:'Risolutezza',   desc:'Forza di volontà'},
    {key:'acume',       lbl:'Acume',         desc:'Rapidità di pensiero'},
    {key:'panache',     lbl:'Panache',       desc:'Fascino e personalità'},
  ].forEach(function(a){
    var blk=_blk(a.lbl);
    var inn=document.createElement('div');inn.style.cssText='padding:5px;display:flex;align-items:center;gap:10px;';
    inn.appendChild(_num(a.key,0,5,2));
    var desc=document.createElement('div');desc.style.cssText='font-size:10px;color:#3a5070;font-family:Arial,sans-serif;font-style:italic;line-height:1.3;';desc.textContent=a.desc;
    inn.appendChild(desc);blk._i.appendChild(inn);col1.appendChild(blk);
  });
  body.appendChild(col1);

  /* COL 2 — Ricchezza / Fama / Vantaggi */
  var col2=document.createElement('div');col2.style.cssText='display:flex;flex-direction:column;gap:5px;';
  var ricBlk=_blk('Ricchezza');
  var ricInn=document.createElement('div');ricInn.style.cssText='padding:6px;display:flex;justify-content:center;';
  ricInn.appendChild(_num('ricchezza',0,99,0));ricBlk._i.appendChild(ricInn);col2.appendChild(ricBlk);

  function _secTA(h,key,rows){
    var b=_blk(h);b.style.flex='1';
    var inn=document.createElement('div');inn.style.cssText='padding:4px;';
    inn.appendChild(_ta(key,rows));b._i.appendChild(inn);return b;
  }
  col2.appendChild(_secTA('Fama','fama',3));
  col2.appendChild(_secTA('Vantaggi','vantaggi',6));
  body.appendChild(col2);

  /* COL 3 — Background / Storie / Arcani */
  var col3=document.createElement('div');col3.style.cssText='display:flex;flex-direction:column;gap:5px;';
  col3.appendChild(_secTA('Background','background',4));

  var storieBlk=_blk('Storie');
  var storieInn=document.createElement('div');storieInn.style.cssText='padding:5px;display:flex;flex-direction:column;gap:5px;';
  [['s_titolo','Titolo'],['s_scopo','Scopo'],['s_ricompensa','Ricompensa'],['s_atto','Atto']].forEach(function(p){
    var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:4px;';
    var lbl=document.createElement('span');lbl.style.cssText='font-size:10px;font-weight:700;color:#0d2440;letter-spacing:0.06em;min-width:72px;';lbl.textContent=p[1].toUpperCase();row.appendChild(lbl);
    row.appendChild(_inp(p[0],''));storieInn.appendChild(row);
  });
  storieBlk._i.appendChild(storieInn);col3.appendChild(storieBlk);

  var arcaniBlk=_blk('Arcani');
  var arcaniInn=document.createElement('div');arcaniInn.style.cssText='padding:5px;display:flex;flex-direction:column;gap:5px;';
  [['virtu','Virtù'],['hubris','Hubris']].forEach(function(p){
    var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:4px;';
    var lbl=document.createElement('span');lbl.style.cssText='font-size:10px;font-weight:700;color:#0d2440;letter-spacing:0.06em;min-width:55px;';lbl.textContent=p[1].toUpperCase();row.appendChild(lbl);
    row.appendChild(_inp(p[0],''));arcaniInn.appendChild(row);
  });
  arcaniBlk._i.appendChild(arcaniInn);col3.appendChild(arcaniBlk);
  body.appendChild(col3);
  sheet.appendChild(body);

  /* ===== FOOTER ===== */
  var footer=document.createElement('div');
  footer.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 8px 8px;position:relative;z-index:1;';

  /* LEFT — Abilità */
  var abBlk=_blk('Abilità');
  var abInn=document.createElement('div');abInn.style.cssText='padding:4px;';
  [
    {key:'sk_allettare', lbl:'Allettare',   attr:'Pan'},
    {key:'sk_adguerra',  lbl:'A.d.Guerra',  attr:'Ris'},
    {key:'sk_atletica',  lbl:'Atletica',    attr:'Vig'},
    {key:'sk_cavalcare', lbl:'Cavalcare',   attr:'Gra'},
    {key:'sk_convincere',lbl:'Convincere',  attr:'Pan'},
    {key:'sk_empatia',   lbl:'Empatia',     attr:'Pan'},
    {key:'sk_esibirsi',  lbl:'Esibirsi',    attr:'Pan'},
    {key:'sk_furto',     lbl:'Furto',       attr:'Gra'},
    {key:'sk_intimidire',lbl:'Intimidire',  attr:'Pan'},
    {key:'sk_istruzione',lbl:'Istruzione',  attr:'Acu'},
    {key:'sk_mira',      lbl:'Mira',        attr:'Acu'},
    {key:'sk_mischia',   lbl:'Mischia',     attr:'Vig'},
    {key:'sk_nascond',   lbl:'Nascondersi', attr:'Gra'},
    {key:'sk_navigaz',   lbl:'Navigazione', attr:'Acu'},
    {key:'sk_notare',    lbl:'Notare',      attr:'Acu'},
    {key:'sk_rissa',     lbl:'Rissa',       attr:'Vig'},
  ].forEach(function(sk){
    var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:5px;padding:3px 2px;border-bottom:1px solid rgba(13,36,64,0.1);';
    var lbl=document.createElement('span');lbl.style.cssText='font-family:Arial,sans-serif;font-size:12px;color:#1a1a0a;min-width:96px;';lbl.textContent=sk.lbl;row.appendChild(lbl);
    row.appendChild(_dots(sk.key,5,13));
    var al=document.createElement('span');al.style.cssText='font-family:Arial,sans-serif;font-size:10px;color:#3a5070;margin-left:auto;font-style:italic;';al.textContent=sk.attr;row.appendChild(al);
    abInn.appendChild(row);
  });
  /* regole gradi */
  var gradiBox=document.createElement('div');
  gradiBox.style.cssText='margin-top:7px;padding:5px 7px;background:rgba(13,36,64,0.06);border:1px solid rgba(13,36,64,0.15);border-radius:3px;font-family:Arial,sans-serif;font-size:11px;color:#0d2440;line-height:1.8;';
  gradiBox.innerHTML='<b>Grado 3:</b> Tirare di nuovo un singolo dado<br><b>Grado 4:</b> Somma di 15 = 2 Incrementi<br><b>Grado 5:</b> I 10 esplodono';
  abInn.appendChild(gradiBox);
  abBlk._i.appendChild(abInn);footer.appendChild(abBlk);

  /* RIGHT — Spirale + Punti Eroe */
  var rFoot=document.createElement('div');rFoot.style.cssText='display:flex;flex-direction:column;gap:6px;';

  var spirBlk=_blk('Spirale della Morte');spirBlk.style.flex='1';
  var spirBody=document.createElement('div');spirBody.style.cssText='padding:8px;display:flex;flex-direction:column;align-items:center;gap:6px;';
  var spirCtn=document.createElement('div');spirCtn.style.cssText='width:100%;';
  _buildSpiral(spirCtn);spirBody.appendChild(spirCtn);

  spirBlk._i.appendChild(spirBody);rFoot.appendChild(spirBlk);

  /* Punti Eroe */
  var peBlk=_blk('Punti Eroe');
  var peInn=document.createElement('div');peInn.style.cssText='padding:8px;display:flex;align-items:center;justify-content:center;';
  peInn.appendChild(_num('punti_eroe',0,10,0));peBlk._i.appendChild(peInn);rFoot.appendChild(peBlk);

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
  nav.style.cssText = 'background:#1a1a1a;border-bottom:1px solid #333;padding:0.45rem 1rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;position:sticky;top:0;z-index:50;';

  var bk = document.createElement('button');
  bk.textContent = '← Indietro';
  bk.style.cssText = 'background:#333;border:1px solid #555;color:#ccc;border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-size:11px;font-family:\'Cinzel\',serif;';
  bk.onclick = function() {
    if (_dmView) {
      state.schedePGViewMode = false; state.schedePGOpenChar = null;
      state.schedaAttivaId = null; state.scheda = {}; state.companions = {};
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
  nameInp.style.cssText = 'flex:1;min-width:0;background:transparent;border:none;border-bottom:1px solid #c9a55c;color:#f0e4cc;font-family:\'Cinzel\',serif;font-size:15px;font-weight:700;outline:none;padding:0.2rem 0.4rem;';
  nameInp.oninput = function() { state.scheda.nome = this.value; if (!_dmView) fbSaveScheda(); };
  nav.appendChild(nameInp);

  if (!_dmView) {
    var delB = document.createElement('button');
    delB.textContent = '🗑 Elimina';
    delB.style.cssText = 'background:#4a1010;border:1px solid #c04040;color:#f08080;border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-size:11px;font-family:\'Cinzel\',serif;';
    delB.onclick = function() {
      if (!confirm('Eliminare "' + (state.scheda.nome || 'questa scheda') + '"? Non recuperabile.')) return;
      var _did = state.schedaAttivaId;
      state.schedeList = state.schedeList.filter(function(x) { return x.id !== _did; });
      fbDeleteSchedaItem(_did);
      state.schedaAttivaId = null; state.scheda = {};
      renderMain();
    };
    nav.appendChild(delB);
  }

  if (_dmView) {
    var badge = document.createElement('span');
    badge.textContent = '⚔ Vista Master — sola lettura';
    badge.style.cssText = 'font-size:10px;color:#c9a55c;background:rgba(201,165,92,0.1);border:1px solid rgba(201,165,92,0.3);border-radius:3px;padding:0.2rem 0.6rem;';
    nav.appendChild(badge);
  }

  if (def.pages.length > 1) {
    var tabsWrap = document.createElement('div');
    tabsWrap.style.cssText = 'display:flex;gap:0.3rem;margin-left:auto;';
    def.pageLabels.forEach(function(lbl, i) {
      var tab = document.createElement('button');
      tab.textContent = lbl;
      tab.style.cssText = 'background:' + (i === curPage ? '#8b6f3f' : '#2a2a2a') + ';border:1px solid #c9a55c;color:#f0e4cc;border-radius:3px;padding:0.25rem 0.7rem;cursor:pointer;font-size:11px;font-family:\'Cinzel\',serif;';
      tab.onclick = function() {
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
  sheetOuter.style.cssText = 'flex:1;overflow-y:auto;padding:1rem;display:flex;justify-content:center;';

  var sheetWrap = document.createElement('div');
  sheetWrap.style.cssText = 'position:relative;width:100%;max-width:850px;';

  var img = document.createElement('img');
  img.src = def.pages[curPage];
  img.style.cssText = 'width:100%;display:block;pointer-events:none;border:2px solid #333;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
  sheetWrap.appendChild(img);

  var fieldsLayer = document.createElement('div');
  fieldsLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';

  var _baseStyle = 'position:absolute;pointer-events:auto;background:transparent;border:none;outline:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:clamp(8px,1.05vw,13px);padding:0 2px;line-height:1.25;box-sizing:border-box;';

  pageFields.forEach(function(fd) {
    var el, isArea = (fd.tp === 'a');
    if (isArea) {
      el = document.createElement('textarea');
      el.rows = 1;
      el.style.cssText = _baseStyle + 'left:'+fd.l+';top:'+fd.t+';width:'+fd.w+';height:'+(fd.h||'5%')+';resize:none;overflow:hidden;vertical-align:top;';
    } else {
      el = document.createElement('input');
      el.type = 'text';
      el.style.cssText = _baseStyle + 'left:'+fd.l+';top:'+fd.t+';width:'+fd.w+';height:2%;';
    }
    el.value = (state.scheda[fd.key] !== undefined) ? state.scheda[fd.key] : '';
    if (_dmView) {
      el.readOnly = true;
    } else {
      if (isArea) {
        el.style.border = '1px solid rgba(0,0,0,0.1)';
        el.onfocus = function() { el.style.border='1px solid rgba(30,80,180,0.4)'; el.style.background='var(--text-secondary)'; };
        el.onblur  = function() { el.style.border='1px solid rgba(0,0,0,0.1)';   el.style.background='transparent'; };
      } else {
        el.style.borderBottom = '1px solid rgba(0,0,0,0.15)';
        el.onfocus = function() { el.style.borderBottom='2px solid rgba(30,80,180,0.5)'; el.style.background='var(--text-secondary)'; };
        el.onblur  = function() { el.style.borderBottom='1px solid rgba(0,0,0,0.15)';    el.style.background='transparent'; };
      }
      (function(key, element) {
        element.oninput = function() { state.scheda[key] = element.value; fbSaveScheda(); };
      }(fd.key, el));
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
  back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;';

  var box = document.createElement('div');
  box.style.cssText = 'background:#1a1a2a;border:1px solid #c9a55c;border-radius:8px;padding:1.5rem;max-width:800px;width:100%;';
  box.onclick = function(e) { e.stopPropagation(); };

  var title = document.createElement('div');
  title.style.cssText = 'font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:#f0d070;letter-spacing:0.1em;margin-bottom:1.25rem;text-align:center;';
  title.textContent = 'Scegli il tipo di scheda';
  box.appendChild(title);

  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1rem;';

    var types = [
      { key: 'normale', label: 'D&D 5e', thumb: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01ek0yIDE3bDEwIDUgMTAtNU0yIDEybDEwIDUgMTAtNSIvPjwvc3ZnPg==', desc: 'Scheda digitale interattiva' },
      { key: 'onepiece', label: 'One Piece D&D', thumb: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iNSIvPjxwYXRoIGQ9Ik03IDE0czIgMyA1IDMgNS0zIDUtM00xMiAydjNNMTIgMTV2M000IDEwaDNNMTcgMTBoMyIvPjwvc3ZnPg==', desc: 'Dungeons & Devil Fruits' },
      { key: 'pokemon', label: 'Pokémon Tabletop', thumb: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIzIi8+PHBhdGggZD0iTTIgMTJoN00xNSAxMmg3Ii8+PC9zdmc+', desc: 'Trainer & Party System' },
      { key: 'naruto', label: 'NARUTO 5e', thumb: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMTQuNWMtMi40OSAwLTQuNS0yLjAxLTQuNS00LjVTOS41MSA3LjUgMTIgNy41czQuNSAyLjAxIDQuNSA0LjUtMi4wMSA0LjUtNC41IDQuNXptMC03LjVjLTEuNjYgMC0zIDEuMzQtMyAzczEuMzQgMyAzIDMgMy0xLjM0IDMtMy0xLjM0LTMtMy0zeiIvPjwvc3ZnPg==', desc: 'Shinobi & Chakra System' },
        { key: 'brancalonia', label: 'Brancalonia', thumb: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01ek0yIDE3bDEwIDUgMTAtNU0yIDEybDEwIDUgMTAtNSIvPjwvc3ZnPg==', desc: 'Spaghetti Fantasy' }
    ,
        { key: 'sw5e', label: 'Star Wars 5e', thumb: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01ek0yIDE3bDEwIDUgMTAtNU0yIDEybDEwIDUgMTAtNSIvPjwvc3ZnPg==', desc: 'Sci-Fi 5e Engine' }
      ];
  Object.keys(SHEET_DEFS).forEach(function(k) {
    var thumb = SHEET_DEFS[k].thumbnail;
      if (k === '7thsea') thumb = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBkMDcwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48cGF0aCBkPSJNMTIgMnYyME0yIDEyaDIwTTQuOTMgNC45M2wxNC4xNCAxNC4xNE00LjkzIDE5LjA3TDE5LjA3IDQuOTMiLz48L3N2Zz4=';
    types.push({ key: k, label: SHEET_DEFS[k].label, thumb: thumb, desc: 'Sistema Custom / Pdf' });
  });

  types.forEach(function(t) {
    var card = document.createElement('div');
    card.style.cssText = 'border:2px solid #3a3a4a;border-radius:6px;overflow:hidden;cursor:pointer;transition:border-color 0.2s,transform 0.2s;background:#12121e;';
    card.onmouseenter = function() { card.style.borderColor='#c9a55c'; card.style.transform='translateY(-3px)'; };
    card.onmouseleave = function() { card.style.borderColor='#3a3a4a'; card.style.transform=''; };

    var imgWrap = document.createElement('div');
    imgWrap.style.cssText = 'height:180px;overflow:hidden;background:#0a0a14;display:flex;align-items:flex-start;justify-content:center;';
    if (t.thumb) {
      var im = document.createElement('img');
      im.src = t.thumb;
      im.style.cssText = 'width:100%;height:100%;object-fit:contain;object-position:center;padding:10px;box-sizing:border-box;';
      imgWrap.appendChild(im);
    } else {
      imgWrap.style.alignItems = 'center';
      imgWrap.innerHTML = '<span style="font-size:3rem;">⚔</span>';
    }
    card.appendChild(imgWrap);

    var body = document.createElement('div');
    body.style.cssText = 'padding:0.75rem;';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-family:\'Cinzel\',serif;font-size:13px;font-weight:700;color:#f0d070;';
    lbl.textContent = t.label;
    body.appendChild(lbl);
    if (t.desc) {
      var dsc = document.createElement('div');
      dsc.style.cssText = 'font-size:11px;color:#888;margin-top:0.25rem;';
      dsc.textContent = t.desc;
      body.appendChild(dsc);
    }
    card.appendChild(body);

    card.onclick = function() { back.remove(); onSelect(t.key); };
    grid.appendChild(card);
  });

  box.appendChild(grid);

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Annulla';
  cancelBtn.style.cssText = 'margin-top:1rem;background:transparent;border:1px solid #555;color:#888;border-radius:3px;padding:0.4rem 1rem;cursor:pointer;font-size:12px;width:100%;';
  cancelBtn.onclick = function() { back.remove(); };
  box.appendChild(cancelBtn);

  back.appendChild(box);
  back.onclick = function() { back.remove(); };
  document.body.appendChild(back);
}

/* ============================================================
   LIBRERIA
   ============================================================ */

function _getAllBooks() {
  var map = {};
  LIBRI_DEFAULT.forEach(function(l) { map[l.id] = Object.assign({}, l); });
  var custom = state.libriCustom || {};
  Object.keys(custom).forEach(function(id) {
    if (map[id]) {
      Object.assign(map[id], custom[id]);
    } else {
      map[id] = Object.assign({ id: id }, custom[id]);
    }
  });
  return Object.values(map);
}

function _libroCard(libro) {
  var a = document.createElement('a');
  a.className = 'libro-card';
  a.href = libro.url || '#';
  if (a.href !== '#') {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  
  // DRAG & DROP per l'admin in vista predefinita
  if (isAdmin() && state.libriSort === 'default' && state.libriFilter === 'Tutte' && state.libriSearch === '') {
    a.draggable = true;
    a.ondragstart = function(e) { e.dataTransfer.setData('text/plain', libro.id); a.style.opacity = '0.5'; };
    a.ondragend = function(e) { a.style.opacity = '1'; };
    a.ondragover = function(e) { e.preventDefault(); a.style.transform = 'scale(1.02)'; a.style.boxShadow = '0 0 15px rgba(245,166,35,0.5)'; };
    a.ondragleave = function(e) { a.style.transform = ''; a.style.boxShadow = ''; };
    a.ondrop = function(e) {
      e.preventDefault();
      a.style.transform = '';
      a.style.boxShadow = '';
      var dragId = e.dataTransfer.getData('text/plain');
      if (dragId && dragId !== libro.id) {
        var all = _getAllBooks();
        all = all.filter(function(b){ return !b.deleted; });
        all.sort(function(a, b) { return (a.orderIndex || 0) - (b.orderIndex || 0); });
        var fromIdx = all.findIndex(function(b){ return b.id === dragId; });
        var toIdx = all.findIndex(function(b){ return b.id === libro.id; });
        if (fromIdx > -1 && toIdx > -1) {
          var item = all.splice(fromIdx, 1)[0];
          all.splice(toIdx, 0, item);
          if (!state.libriCustom) state.libriCustom = {};
          all.forEach(function(b, idx) {
            b.orderIndex = idx;
            if (!state.libriCustom[b.id]) state.libriCustom[b.id] = Object.assign({}, b);
            else state.libriCustom[b.id].orderIndex = idx;
            if (_db) _db.ref('libri/books/' + b.id + '/orderIndex').set(idx);
          });
          renderMain();
        }
      }
    };
  }

  var imgWrap = document.createElement('div');
  imgWrap.className = 'libro-card-img';
  imgWrap.style.position = 'relative';
  if (libro.copertina) {
    var im = document.createElement('img');
    im.src = libro.copertina;
    im.alt = libro.titolo;
    im.onerror = function() { this.style.display='none'; imgWrap.innerHTML += '<span class="libro-card-img-ph">📖</span>'; };
    imgWrap.appendChild(im);
  } else {
    imgWrap.innerHTML = '<span class="libro-card-img-ph">📖</span>';
  }
  
  // PREFERITI
  var u = state.currentUser ? state.currentUser.username : null;
  var isFav = false;
  if (u && state.libriPreferiti && state.libriPreferiti[libro.id]) isFav = true;
  var starBtn = document.createElement('button');
  starBtn.innerHTML = isFav ? '⭐' : '☆';
  starBtn.title = isFav ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti';
  starBtn.style.cssText = 'position:absolute;top:8px;right:8px;background:rgba(10,22,40,0.8);border:1px solid rgba(245,166,35,0.5);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#f5a623;font-size:16px;box-shadow:0 2px 5px rgba(0,0,0,0.6);z-index:10;';
  starBtn.onclick = function(e) {
    e.preventDefault(); e.stopPropagation();
    if (!u) { alert('Devi aver effettuato l\'accesso.'); return; }
    if (isFav) {
      if (_db) _db.ref('libri/preferiti/' + u + '/' + libro.id).remove();
      if (state.libriPreferiti) delete state.libriPreferiti[libro.id];
    } else {
      var favCount = state.libriPreferiti ? Object.keys(state.libriPreferiti).length : 0;
      if (favCount >= 4) {
        alert('Limite raggiunto: puoi selezionare massimo 4 preferiti.');
        return;
      }
      if (_db) _db.ref('libri/preferiti/' + u + '/' + libro.id).set(true);
      if (!state.libriPreferiti) state.libriPreferiti = {};
      state.libriPreferiti[libro.id] = true;
    }
    renderMain();
  };
  imgWrap.appendChild(starBtn);
  a.appendChild(imgWrap);

  var body = document.createElement('div');
  body.className = 'libro-card-body';
  body.style.position = 'relative';
  var title = document.createElement('p');
  title.className = 'libro-card-title';
  title.textContent = libro.titolo || 'Senza titolo';
  body.appendChild(title);
  
  var edTagWrap = document.createElement('div');
  edTagWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.4rem;';
  var edition = libro.edition || 'D&D 5e';
  var edPill = document.createElement('span');
  edPill.textContent = edition;
  edPill.style.cssText = 'background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.3);color:#f5c842;padding:0.15rem 0.4rem;border-radius:4px;font-size:9px;font-weight:bold;letter-spacing:0.05em;';
  edTagWrap.appendChild(edPill);
  if (libro.tags) {
    libro.tags.split(',').forEach(function(tg) {
      var t = tg.trim();
      if (t) {
        var tpill = document.createElement('span');
        tpill.textContent = t;
        tpill.style.cssText = 'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#ccc;padding:0.15rem 0.4rem;border-radius:4px;font-size:9px;white-space:nowrap;';
        edTagWrap.appendChild(tpill);
      }
    });
  }
  body.appendChild(edTagWrap);

  if (isAdmin()) {
    var adminRow = document.createElement('div');
    adminRow.style.cssText = 'display:flex;gap:0.5rem;margin-top:0.6rem;padding-top:0.6rem;border-top:1px dashed rgba(245,166,35,0.2);';
    
    var editBtn = document.createElement('button');
    editBtn.textContent = '✏️ Modifica';
    editBtn.title = 'Modifica libro';
    editBtn.style.cssText = 'flex:1;background:none;border:1px solid rgba(245,166,35,0.4);border-radius:4px;color:rgba(245,166,35,0.9);font-size:11px;cursor:pointer;padding:0.25rem 0;transition:all 0.15s;';
    editBtn.onmouseenter = function() { this.style.background='rgba(245,166,35,0.1)'; };
    editBtn.onmouseleave = function() { this.style.background='none'; };
    editBtn.onclick = function(e) {
      e.preventDefault(); e.stopPropagation();
      state.libriShowForm = true;
      state.libriEditId = libro.id;
      renderMain();
      setTimeout(function(){ var f=document.querySelector('.libro-add-form'); if(f) f.scrollIntoView({behavior:'smooth', block: 'start'}); }, 100);
    };
    adminRow.appendChild(editBtn);

    var delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.title = 'Rimuovi libro';
    delBtn.style.cssText = 'background:none;border:1px solid rgba(200,70,70,0.4);border-radius:4px;color:rgba(200,70,70,0.9);font-size:11px;cursor:pointer;padding:0.25rem 0.5rem;transition:all 0.15s;';
    delBtn.onmouseenter = function() { this.style.background='rgba(200,70,70,0.1)'; };
    delBtn.onmouseleave = function() { this.style.background='none'; };
    delBtn.onclick = function(e) {
      e.preventDefault(); e.stopPropagation();
      if (!confirm('Rimuovere "' + (libro.titolo||'') + '" dalla libreria?')) return;
      if (!state.libriCustom) state.libriCustom = {};
      if (libro.id.startsWith('d_')) {
        var b = Object.assign({}, libro, { deleted: true });
        state.libriCustom[libro.id] = b;
        if (_db) _db.ref('libri/books/' + libro.id).set(b);
      } else {
        delete state.libriCustom[libro.id];
        if (_db) _db.ref('libri/books/' + libro.id).remove();
      }
      renderMain();
    };
    adminRow.appendChild(delBtn);
    body.appendChild(adminRow);
  }

  a.appendChild(body);
  return a;
}

function renderLibri() {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;';

  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:1.5rem;padding-bottom:1rem;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;';
  hc.innerHTML = '<div><div class="header-eyebrow mb-2"><span>Risorse</span></div><h1 class="header-title">Libreria D&D</h1></div>';

  if (isAdmin()) {
    var addBtn = document.createElement('button');
    addBtn.className = 'btn-gold';
    addBtn.innerHTML = (ICON.plus || '+') + ' Aggiungi Libro';
    addBtn.style.cssText = 'align-self:flex-end;margin-bottom:0.5rem;';
    addBtn.onclick = function() { state.libriShowForm = true; state.libriEditId = null; renderMain(); };
    hc.appendChild(addBtn);
  }
  header.appendChild(hc);
  wrap.appendChild(header);

  var main = document.createElement('section');
  main.className = 'container-main';
  main.style.cssText = 'padding-top:1.5rem;padding-bottom:3rem;display:flex;flex-direction:column;gap:1.5rem;';

  if (isAdmin() && state.libriShowForm) {
    var isEdit = !!state.libriEditId;
    var editBook = null;
    if (isEdit) {
      var all = _getAllBooks();
      editBook = all.find(function(b){ return b.id === state.libriEditId; });
    }
    
    var form = document.createElement('div');
    form.className = 'libro-add-form';
    form.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-gold);padding:1.5rem;border-radius:8px;display:flex;flex-direction:column;gap:1rem;';

    var fTitle = document.createElement('div');
    fTitle.style.cssText = 'font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:var(--gold-dim);letter-spacing:0.1em;border-bottom:1px solid rgba(245,166,35,0.2);padding-bottom:0.5rem;';
    fTitle.textContent = isEdit ? 'MODIFICA LIBRO' : '+ NUOVO LIBRO';
    form.appendChild(fTitle);

    var inpTitolo = document.createElement('input');
    inpTitolo.placeholder = 'Titolo del libro *';
    inpTitolo.style.width = '100%';
    if (editBook && editBook.titolo) inpTitolo.value = editBook.titolo;

    var inpUrl = document.createElement('input');
    inpUrl.placeholder = 'Link al libro (URL) *';
    inpUrl.style.width = '100%';
    if (editBook && editBook.url) inpUrl.value = editBook.url;

    var inpImg = document.createElement('input');
    inpImg.placeholder = 'URL immagine copertina';
    inpImg.style.width = '100%';
    if (editBook && editBook.copertina) inpImg.value = editBook.copertina;

    var extRow = document.createElement('div');
    extRow.style.cssText = 'display:flex;gap:1rem;align-items:center;flex-wrap:wrap;';
    
    var edLbl = document.createElement('span');
    edLbl.textContent = 'Edizione:';
    edLbl.style.cssText = 'color:var(--text-secondary);font-size:13px;';
    var selEd = document.createElement('select');
    selEd.style.cssText = 'background:rgba(10,22,40,0.8);color:var(--text-primary);border:1px solid rgba(245,166,35,0.3);padding:0.4rem;border-radius:4px;';
    ['D&D 5e', 'D&D 3.5', 'Altro/OSR'].forEach(function(o) {
      var opt = document.createElement('option'); opt.value = o; opt.textContent = o;
      if (editBook && editBook.edition === o) opt.selected = true;
      selEd.appendChild(opt);
    });
    
    var tagLbl = document.createElement('span');
    tagLbl.textContent = 'Tags:';
    tagLbl.style.cssText = 'color:var(--text-secondary);font-size:13px;';
    var inpTags = document.createElement('input');
    inpTags.placeholder = 'es. Base, Mostri...';
    inpTags.style.cssText = 'flex:1;min-width:200px;';
    if (editBook && editBook.tags) inpTags.value = editBook.tags;
    
    extRow.appendChild(edLbl); extRow.appendChild(selEd);
    extRow.appendChild(tagLbl); extRow.appendChild(inpTags);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.5rem;';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn-gold';
    saveBtn.textContent = 'Salva';
    saveBtn.onclick = function() {
      var t = inpTitolo.value.trim();
      var u = inpUrl.value.trim();
      var c = inpImg.value.trim();
      if (!t || !u) { inpTitolo.style.borderColor='#c84040'; inpUrl.style.borderColor='#c84040'; return; }
      
      var id = isEdit ? editBook.id : ('b_' + Date.now());
      var libro = {
        id: id,
        titolo: t,
        url: u,
        copertina: c,
        edition: selEd.value,
        tags: inpTags.value.trim()
      };
      if (editBook) {
        if (editBook.orderIndex !== undefined) libro.orderIndex = editBook.orderIndex;
        if (editBook.timestamp) libro.timestamp = editBook.timestamp;
      }
      if (!libro.timestamp) libro.timestamp = Date.now();
      
      if (!state.libriCustom) state.libriCustom = {};
      state.libriCustom[id] = libro;
      if (_db) _db.ref('libri/books/' + id).set(libro);
      state.libriShowForm = false;
      state.libriEditId = null;
      renderMain();
    };

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'mappa-btn';
    cancelBtn.textContent = 'Annulla';
    cancelBtn.onclick = function() { state.libriShowForm = false; state.libriEditId = null; renderMain(); };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    
    form.appendChild(inpTitolo);
    form.appendChild(inpUrl);
    form.appendChild(inpImg);
    form.appendChild(extRow);
    form.appendChild(btnRow);
    main.appendChild(form);
  }

  var toolBar = document.createElement('div');
  toolBar.style.cssText = 'display:flex;gap:1rem;flex-wrap:wrap;align-items:center;background:rgba(10,22,40,0.5);padding:0.8rem 1rem;border-radius:8px;border:1px solid rgba(245,166,35,0.2);';
  
  var filterWrap = document.createElement('div');
  filterWrap.style.cssText = 'display:flex;gap:0.4rem;';
  ['Tutte', 'D&D 5e', 'D&D 3.5', 'Altro'].forEach(function(f) {
    var btn = document.createElement('button');
    btn.textContent = f;
    var isActive = state.libriFilter === f;
    btn.style.cssText = 'padding:0.3rem 0.8rem;border-radius:4px;font-size:12px;font-weight:bold;cursor:pointer;transition:all 0.15s;' +
      (isActive ? 'background:rgba(245,166,35,0.2);color:#f5c842;border:1px solid rgba(245,166,35,0.5);' : 'background:transparent;color:var(--text-secondary);border:1px solid transparent;');
    btn.onmouseenter = function() { if(!isActive) this.style.color = '#f5c842'; };
    btn.onmouseleave = function() { if(!isActive) this.style.color = 'var(--text-secondary)'; };
    btn.onclick = function() { state.libriFilter = f; renderMain(); };
    filterWrap.appendChild(btn);
  });
  toolBar.appendChild(filterWrap);
  
  var space = document.createElement('div'); space.style.flex = '1'; toolBar.appendChild(space);
  
  var searchInp = document.createElement('input');
  searchInp.id = 'libri-search-input';
  searchInp.type = 'text';
  searchInp.placeholder = '🔍 Cerca titolo o tag...';
  searchInp.value = state.libriSearch || '';
  searchInp.style.cssText = 'background:rgba(0,0,0,0.3);border:1px solid rgba(245,166,35,0.3);color:var(--text-primary);padding:0.4rem 0.8rem;border-radius:15px;font-size:13px;width:200px;';
  searchInp.oninput = function() {
    state.libriSearch = this.value;
    renderMain();
    setTimeout(function(){
      var el = document.getElementById('libri-search-input');
      if (el) { el.focus(); var v = el.value; el.value = ''; el.value = v; }
    }, 0);
  };
  toolBar.appendChild(searchInp);
  
  var sortWrap = document.createElement('div');
  sortWrap.style.cssText = 'display:flex;align-items:center;gap:0.5rem;';
  var sortLbl = document.createElement('span'); sortLbl.textContent = 'Ordina:'; sortLbl.style.cssText = 'color:var(--text-secondary);font-size:12px;';
  var sortSel = document.createElement('select');
  sortSel.style.cssText = 'background:rgba(10,22,40,0.8);color:var(--text-primary);border:1px solid rgba(245,166,35,0.3);padding:0.3rem;border-radius:4px;font-size:12px;cursor:pointer;';
  var opts = [{v:'default', l:'Predefinito'}, {v:'alpha', l:'Alfabetico (A-Z)'}, {v:'recent', l:'Aggiunti di Recente'}];
  opts.forEach(function(o) {
    var opt = document.createElement('option'); opt.value = o.v; opt.textContent = o.l;
    if (state.libriSort === o.v) opt.selected = true;
    sortSel.appendChild(opt);
  });
  sortSel.onchange = function() { state.libriSort = this.value; renderMain(); };
  sortWrap.appendChild(sortLbl); sortWrap.appendChild(sortSel);
  toolBar.appendChild(sortWrap);
  
  main.appendChild(toolBar);

  var allBooks = _getAllBooks().filter(function(b){ return !b.deleted; });

  var u = state.currentUser ? state.currentUser.username : null;
  if (u && state.libriPreferiti && Object.keys(state.libriPreferiti).length > 0) {
    var favSec = document.createElement('div');
    favSec.style.cssText = 'margin-bottom:1rem;background:rgba(245,166,35,0.03);border-radius:8px;padding:1.5rem;border:1px dashed rgba(245,166,35,0.25);';
    var favTitle = document.createElement('h2');
    favTitle.textContent = 'I Tuoi Preferiti';
    favTitle.style.cssText = 'font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;letter-spacing:0.1em;color:#f5c842;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;';
    favTitle.innerHTML = '⭐ ' + favTitle.textContent;
    favSec.appendChild(favTitle);
    
    var favGrid = document.createElement('div');
    favGrid.className = 'libro-grid';
    var myFavs = allBooks.filter(function(b){ return state.libriPreferiti[b.id]; });
    myFavs.forEach(function(b) { favGrid.appendChild(_libroCard(b)); });
    favSec.appendChild(favGrid);
    main.appendChild(favSec);
  }

  var filtered = allBooks.filter(function(b) {
    var bEd = b.edition || 'D&D 5e';
    if (state.libriFilter !== 'Tutte' && state.libriFilter !== 'Altro' && bEd !== state.libriFilter) return false;
    if (state.libriFilter === 'Altro' && bEd === 'D&D 5e') return false; 
    if (state.libriFilter === 'Altro' && bEd !== 'Altro/OSR' && bEd !== 'Altro' && bEd !== 'D&D 3.5') return true; 
    if (state.libriFilter === 'Altro' && (bEd === 'D&D 5e' || bEd === 'D&D 3.5')) return false;

    if (state.libriSearch) {
      var s = state.libriSearch.toLowerCase();
      var t = (b.titolo || '').toLowerCase();
      var tags = (b.tags || '').toLowerCase();
      if (t.indexOf(s) === -1 && tags.indexOf(s) === -1) return false;
    }
    return true;
  });

  if (state.libriSort === 'alpha') {
    filtered.sort(function(a, b) { return (a.titolo||'').localeCompare(b.titolo||''); });
  } else if (state.libriSort === 'recent') {
    filtered.sort(function(a, b) { return (b.timestamp||0) - (a.timestamp||0); });
  } else {
    filtered.sort(function(a, b) { return (a.orderIndex||0) - (b.orderIndex||0); });
  }

  var gridTitle = document.createElement('h2');
  gridTitle.textContent = 'Tutti i Manuali';
  gridTitle.style.cssText = 'font-family:\'Cinzel\',serif;font-size:15px;color:var(--text-secondary);letter-spacing:0.1em;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:0.5rem;margin-bottom:1rem;';
  main.appendChild(gridTitle);

  var grid = document.createElement('div');
  grid.className = 'libro-grid';
  if (filtered.length === 0) {
    var none = document.createElement('div');
    none.textContent = 'Nessun manuale trovato.';
    none.style.cssText = 'color:var(--text-muted);font-style:italic;grid-column:1/-1;text-align:center;padding:2rem;';
    grid.appendChild(none);
  } else {
    filtered.forEach(function(b) { grid.appendChild(_libroCard(b)); });
  }

  main.appendChild(grid);
  wrap.appendChild(main);
  return wrap;
}

/* ========================= SCHEDA + LAVAGNA WRAPPER ========================= */
function _buildSchedaWithLavagna(){
  var wrap=document.createElement('div');
  wrap.style.cssText='display:flex;height:100%;overflow:hidden;position:relative;';

  var schedaPane=document.createElement('div');
  schedaPane.style.cssText='flex:1;overflow-y:auto;min-width:0;position:relative;';
  schedaPane.appendChild(renderScheda());

  // Toggle button (floating top-right of scheda pane)
  var toggleBtn=document.createElement('button');
  toggleBtn.title='Lavagna Abilità';
  toggleBtn.innerHTML='📷';
  toggleBtn.style.cssText='position:absolute;top:10px;right:14px;z-index:30;'
    +'background:'+(state.lavagnaOpen?'rgba(201,165,92,0.25)':'rgba(10,22,40,0.85)')
    +';border:1px solid rgba(201,165,92,'+(state.lavagnaOpen?'0.8':'0.4')+');'
    +'color:#c9a55c;border-radius:5px;padding:5px 9px;cursor:pointer;font-size:16px;'
    +'box-shadow:0 2px 8px rgba(0,0,0,0.5);';
  window._toggleGlobalLavagna = function() { toggleBtn.click(); };
    toggleBtn.addEventListener('click',function(){
    state.lavagnaOpen=!state.lavagnaOpen;
    if(state.lavagnaOpen){
      lavPane.style.width='300px';
      toggleBtn.style.background='rgba(201,165,92,0.25)';
      toggleBtn.style.borderColor='rgba(201,165,92,0.8)';
    } else {
      lavPane.style.width='0';
      toggleBtn.style.background='rgba(10,22,40,0.85)';
      toggleBtn.style.borderColor='rgba(201,165,92,0.4)';
    }
  });
  schedaPane.appendChild(toggleBtn);
  wrap.appendChild(schedaPane);

  var lavPane=document.createElement('div');
  lavPane.style.cssText='width:'+(state.lavagnaOpen?'300px':'0')+';flex-shrink:0;overflow:hidden;'
    +'border-left:1px solid rgba(201,165,92,0.25);transition:width 0.2s ease;';
  var lavInner=document.createElement('div');
  lavInner.style.cssText='width:300px;height:100%;overflow:hidden;';
  lavInner.appendChild(renderLavagna());
  lavPane.appendChild(lavInner);
  wrap.appendChild(lavPane);

  return wrap;
}

/* ========================= TAVOLO DA GIOCO (VTT) ========================= */
var _tavoloRef=null;
var _sectionCleanup=null;
function renderTavolo(){
  if(_tavoloRef){_tavoloRef.off('value');_tavoloRef=null;}
  var wrap=document.createElement('div');
  wrap.style.cssText='display:flex;flex-direction:column;height:100%;overflow:hidden;background:#111;';
  var _ref=_db.ref('state/tavolo');_tavoloRef=_ref;
  var _data={map:{url:'',w:2000,h:1500},grid:{s:60,on:true},tokens:{}};
  var _vp={x:0,y:0,z:1};
  var tb=document.createElement('div');
  tb.style.cssText='display:flex;align-items:center;gap:6px;padding:6px 10px;background:#060e1c;border-bottom:1px solid rgba(201,165,92,0.3);flex-shrink:0;flex-wrap:wrap;';
  function mkB(txt,fn,sty){var b=document.createElement('button');b.textContent=txt;b.style.cssText='background:#0d2440;border:1px solid rgba(201,165,92,0.45);color:#f0e4cc;border-radius:3px;padding:0.22rem 0.65rem;cursor:pointer;font-size:12px;white-space:nowrap;'+(sty||'');if(fn)b.addEventListener('click',fn);return b;}
  var inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.style.display='none';
  inp.addEventListener('change',function(e){var f=e.target.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(ev){var img=new Image();img.onload=function(){var mxW=1800,sc=Math.min(1,mxW/img.width);var cv=document.createElement('canvas');cv.width=Math.round(img.width*sc);cv.height=Math.round(img.height*sc);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);_ref.child('map').set({url:cv.toDataURL('image/jpeg',0.85),w:cv.width,h:cv.height});};img.src=ev.target.result;};rd.readAsDataURL(f);});
  wrap.appendChild(inp);
  tb.appendChild(mkB('🖼 Carica Mappa',function(){inp.click();}));
  var gridBtn=mkB('⊞ Griglia ON',function(){_ref.child('grid').update({on:!_data.grid.on});});
  tb.appendChild(gridBtn);
  var gsLbl=document.createElement('span');gsLbl.style.cssText='color:#c9a55c;font-size:12px;';gsLbl.textContent=' Cella:';tb.appendChild(gsLbl);
  var gsInp=document.createElement('input');gsInp.type='number';gsInp.min=20;gsInp.max=200;gsInp.value=60;gsInp.style.cssText='width:48px;background:#0d2440;border:1px solid rgba(201,165,92,0.4);color:#f0e4cc;border-radius:3px;padding:0.2rem 0.3rem;font-size:12px;';gsInp.addEventListener('change',function(){_ref.child('grid').update({s:+gsInp.value});});tb.appendChild(gsInp);
  tb.appendChild(mkB('➕ Segnalino',function(){var n=prompt('Nome segnalino:',isDM()?'NPC':(state.currentUser&&state.currentUser.username||'PG'));if(!n)return;var id='tok_'+Date.now();_ref.child('tokens/'+id).set({x:50,y:50,label:n,color:isDM()?'#e74c3c':'#3498db',size:1,hidden:false,owner:state.currentUser&&state.currentUser.username||''});}));
  var zLbl=mkB('100%',function(){_vp={x:0,y:0,z:1};applyVP();});zLbl.style.marginLeft='auto';tb.appendChild(zLbl);
  tb.appendChild(mkB('−',function(){_vp.z=Math.max(0.1,_vp.z/1.15);applyVP();}));
  tb.appendChild(mkB('+',function(){_vp.z=Math.min(5,_vp.z*1.15);applyVP();}));
  if(isDM()){tb.appendChild(mkB('🗑 Mappa',function(){if(confirm('Cancellare la mappa?'))_ref.child('map').set({url:'',w:2000,h:1500});}));tb.appendChild(mkB('🗑 Segnalini',function(){if(confirm('Cancellare tutti i segnalini?'))_ref.child('tokens').remove();}));}
  wrap.appendChild(tb);
  var area=document.createElement('div');area.style.cssText='flex:1;overflow:hidden;position:relative;background:#1a1a2e;cursor:grab;';
  var mapD=document.createElement('div');mapD.style.cssText='position:absolute;transform-origin:0 0;';area.appendChild(mapD);
  function applyVP(){mapD.style.transform='translate('+_vp.x+'px,'+_vp.y+'px) scale('+_vp.z+')';zLbl.textContent=Math.round(_vp.z*100)+'%';}
  function buildMap(){
    mapD.innerHTML='';
    var m=_data.map,g=_data.grid;
    mapD.style.width=m.w+'px';mapD.style.height=m.h+'px';
    if(m.url){mapD.style.backgroundImage='url('+m.url+')';mapD.style.backgroundSize='100% 100%';mapD.style.backgroundRepeat='no-repeat';}
    else{mapD.style.backgroundImage='none';mapD.style.background='#2a2a3a';}
    if(g.on){var ns='http://www.w3.org/2000/svg';var svg=document.createElementNS(ns,'svg');svg.setAttribute('width',m.w);svg.setAttribute('height',m.h);svg.style.cssText='position:absolute;top:0;left:0;pointer-events:none;';var defs=document.createElementNS(ns,'defs');var pat=document.createElementNS(ns,'pattern');pat.setAttribute('id','gp');pat.setAttribute('width',g.s);pat.setAttribute('height',g.s);pat.setAttribute('patternUnits','userSpaceOnUse');var pth=document.createElementNS(ns,'path');pth.setAttribute('d','M '+g.s+' 0 L 0 0 0 '+g.s);pth.setAttribute('fill','none');pth.setAttribute('stroke','rgba(255,255,255,0.22)');pth.setAttribute('stroke-width','0.8');pat.appendChild(pth);defs.appendChild(pat);svg.appendChild(defs);var rc=document.createElementNS(ns,'rect');rc.setAttribute('width','100%');rc.setAttribute('height','100%');rc.setAttribute('fill','url(#gp)');svg.appendChild(rc);mapD.appendChild(svg);}
    var toks=_data.tokens||{};
    Object.keys(toks).forEach(function(id){
      var t=toks[id];if(t.hidden&&!isDM())return;
      var sz=g.s*(t.size||1)*0.85;
      var te=document.createElement('div');
      te.style.cssText='position:absolute;left:'+t.x+'%;top:'+t.y+'%;transform:translate(-50%,-50%);width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+t.color+';border:2.5px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;cursor:move;user-select:none;z-index:10;flex-direction:column;'+(t.hidden?'opacity:0.55;border-style:dashed;':'');
      if(t.img){te.style.backgroundImage='url('+t.img+')';te.style.backgroundSize='cover';te.style.backgroundPosition='center';}
      var ab=document.createElement('span');ab.style.cssText='font-size:'+Math.max(9,sz*0.28)+'px;font-weight:700;color:#fff;text-shadow:1px 1px 2px #000,-1px -1px 2px #000;pointer-events:none;'+(t.img?'display:none;':'');ab.textContent=t.label.slice(0,3).toUpperCase();te.appendChild(ab);
      var lb=document.createElement('div');lb.style.cssText='position:absolute;top:calc(100% + 3px);left:50%;transform:translateX(-50%);font-size:'+Math.max(9,sz*0.2)+'px;color:#fff;text-shadow:1px 1px 2px #000,-1px -1px 2px #000;white-space:nowrap;font-weight:700;pointer-events:none;background:rgba(0,0,0,0.5);padding:1px 5px;border-radius:3px;';lb.textContent=t.label;te.appendChild(lb);
      te.addEventListener('contextmenu',function(e){e.preventDefault();e.stopPropagation();showTokMenu(id,t,e.clientX,e.clientY);});
      var canMv=isDM()||t.owner===(state.currentUser&&state.currentUser.username);
      if(canMv){
        var drag=false,sx,sy,stx,sty;
        te.addEventListener('mousedown',function(e){if(e.button!==0)return;e.stopPropagation();drag=true;sx=e.clientX;sy=e.clientY;stx=t.x;sty=t.y;
          function mv(e){if(!drag)return;var dx=(e.clientX-sx)/(_vp.z*m.w/100);var dy=(e.clientY-sy)/(_vp.z*m.h/100);t.x=Math.max(0,Math.min(100,stx+dx));t.y=Math.max(0,Math.min(100,sty+dy));te.style.left=t.x+'%';te.style.top=t.y+'%';}
          function up(){if(!drag)return;drag=false;document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);_ref.child('tokens/'+id).update({x:+t.x.toFixed(2),y:+t.y.toFixed(2)});}
          document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
        });
      }
      mapD.appendChild(te);
    });
    applyVP();
  }
  function showTokMenu(id,t,cx,cy){
    var old=document.getElementById('_tmenu');if(old)old.remove();
    var men=document.createElement('div');men.id='_tmenu';men.style.cssText='position:fixed;left:'+cx+'px;top:'+cy+'px;z-index:9999;background:#0d2440;border:1px solid rgba(201,165,92,0.55);border-radius:5px;padding:4px;min-width:155px;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
    function mi(txt,fn){var it=document.createElement('div');it.textContent=txt;it.style.cssText='padding:6px 12px;cursor:pointer;color:#f0e4cc;font-size:12px;border-radius:3px;';it.onmouseenter=function(){it.style.background='rgba(201,165,92,0.15)';};it.onmouseleave=function(){it.style.background='';};it.onclick=function(){men.remove();fn();};men.appendChild(it);}
    mi('✏️ Rinomina',function(){var n=prompt('Nome:',t.label);if(n)_ref.child('tokens/'+id).update({label:n});});
    mi('🎨 Colore sfondo',function(){var cp=document.createElement('input');cp.type='color';cp.value=t.color;cp.style.display='none';document.body.appendChild(cp);cp.oninput=function(){_ref.child('tokens/'+id).update({color:cp.value});};cp.onchange=function(){document.body.removeChild(cp);};cp.click();});
    mi('🖼 '+(t.img?'Cambia immagine':'Imposta immagine'),function(){
      var fi=document.createElement('input');fi.type='file';fi.accept='image/*';fi.style.display='none';document.body.appendChild(fi);
      fi.onchange=function(){var f=fi.files[0];if(!f)return;document.body.removeChild(fi);var r=new FileReader();r.onload=function(ev){var i=new Image();i.onload=function(){var sz=120;var cv=document.createElement('canvas');cv.width=sz;cv.height=sz;var ctx=cv.getContext('2d');ctx.beginPath();ctx.arc(sz/2,sz/2,sz/2,0,Math.PI*2);ctx.clip();var sc=Math.max(sz/i.width,sz/i.height),ox=(sz-i.width*sc)/2,oy=(sz-i.height*sc)/2;ctx.drawImage(i,ox,oy,i.width*sc,i.height*sc);_ref.child('tokens/'+id).update({img:cv.toDataURL('image/jpeg',0.82)});};i.src=ev.target.result;};r.readAsDataURL(f);};
      fi.click();
    });
    if(t.img)mi('❌ Rimuovi immagine',function(){_ref.child('tokens/'+id).update({img:null});});
    mi('📏 Taglia ('+( t.size||1)+')',function(){var s=prompt('Taglia (1=1x1, 2=2x2):',t.size||1);if(s)_ref.child('tokens/'+id).update({size:+s});});
    if(isDM())mi(t.hidden?'👁 Mostra ai giocatori':'🙈 Nascondi ai giocatori',function(){_ref.child('tokens/'+id).update({hidden:!t.hidden});});
    mi('🗑 Elimina',function(){_ref.child('tokens/'+id).remove();});
    document.body.appendChild(men);setTimeout(function(){document.addEventListener('click',function cl(){men.remove();document.removeEventListener('click',cl);});},20);
  }
  var pan=false,px0,py0,vpx0,vpy0;
  area.addEventListener('mousedown',function(e){if(e.button===1||e.button===2){e.preventDefault();pan=true;px0=e.clientX;py0=e.clientY;vpx0=_vp.x;vpy0=_vp.y;area.style.cursor='grabbing';}});
  window.addEventListener('mousemove',function(e){if(!pan)return;_vp.x=vpx0+(e.clientX-px0);_vp.y=vpy0+(e.clientY-py0);applyVP();});
  window.addEventListener('mouseup',function(){if(pan){pan=false;area.style.cursor='grab';}});
  area.addEventListener('contextmenu',function(e){e.preventDefault();});
  area.addEventListener('wheel',function(e){e.preventDefault();var r=area.getBoundingClientRect();var mx=e.clientX-r.left,my=e.clientY-r.top;var oz=_vp.z;_vp.z=Math.max(0.1,Math.min(5,_vp.z*(e.deltaY<0?1.12:0.89)));_vp.x=mx-(_vp.z/oz)*(mx-_vp.x);_vp.y=my-(_vp.z/oz)*(my-_vp.y);applyVP();},{passive:false});
  wrap.appendChild(area);
  _ref.on('value',function(snap){var d=snap.val()||{};_data.map=d.map||{url:'',w:2000,h:1500};_data.grid=Object.assign({s:60,on:true},d.grid||{});_data.tokens=d.tokens||{};gridBtn.textContent='⊞ Griglia '+((_data.grid.on===false)?'OFF':'ON');gsInp.value=_data.grid.s||60;buildMap();});
  return wrap;
}

/* ========================= LAVAGNA ABILITÀ ========================= */
function renderLavagna(){
  var charId=state.schedaAttivaId||'default';
  var wrap=document.createElement('div');
  wrap.style.cssText='display:flex;flex-direction:column;height:100%;overflow:hidden;background:#1a1a2e;';
  
  if (window._lavagnaPasteListener) {
    document.removeEventListener('paste', window._lavagnaPasteListener);
    window._lavagnaPasteListener = null;
  }

  var tb=document.createElement('div');
  tb.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 14px;background:#060e1c;border-bottom:1px solid rgba(201,165,92,0.3);flex-shrink:0;flex-wrap:wrap;';
  var ttl=document.createElement('span');ttl.style.cssText='color:#c9a55c;font-family:Cinzel,serif;font-size:14px;font-weight:700;';ttl.textContent='📷 Lavagna Abilità';tb.appendChild(ttl);
  var hint=document.createElement('span');hint.style.cssText='color:rgba(240,228,204,0.5);font-size:11px;';hint.textContent='— Ctrl+V per incollare screenshot, o carica file';tb.appendChild(hint);
  var ulBtn=document.createElement('button');ulBtn.textContent='⬆ Carica';ulBtn.style.cssText='margin-left:auto;background:#0d2440;border:1px solid rgba(201,165,92,0.45);color:#f0e4cc;border-radius:3px;padding:0.22rem 0.7rem;cursor:pointer;font-size:12px;';tb.appendChild(ulBtn);
  var ulInp=document.createElement('input');ulInp.type='file';ulInp.accept='image/*';ulInp.multiple=true;ulInp.style.display='none';tb.appendChild(ulInp);
  ulBtn.onclick=function(){ulInp.click();};
  wrap.appendChild(tb);
  
  var grid=document.createElement('div');
  grid.style.cssText='flex:1;overflow-y:auto;padding:14px;display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start;position:relative;';
  wrap.appendChild(grid);

  if (!state.scheda) state.scheda = {};
  // Gestione backward-compatibility (migrazione a boardImages)
  if (state.scheda.abilityBoard && !state.scheda.boardImages) {
    state.scheda.boardImages = state.scheda.abilityBoard;
    delete state.scheda.abilityBoard;
  }
  if (!state.scheda.boardImages) state.scheda.boardImages = [];
  var _imgs = state.scheda.boardImages;

  var ph=document.createElement('div');
  ph.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(201,165,92,0.3);text-align:center;pointer-events:none;';
  ph.innerHTML='<div style="font-size:56px;">📷</div><div style="font-size:15px;font-family:\'Cinzel\',serif;margin-top:8px;">Incolla uno screenshot (Ctrl+V)<br>o usa il pulsante Carica</div>';
  grid.appendChild(ph);
  
  if (_imgs.length > 0) ph.style.display = 'none';

  function triggerSave() {
    if (typeof ss === 'function') ss();
    if (typeof saveToStorage === 'function') saveToStorage();
  }

  function addImg(url){
    var id='img_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    var entry = {id:id, x: 0, y: 0, width: 220, height: 300};
    // Salva l'immagine su DB
    if(window.ImageDB) {
      window.ImageDB.save(id, url).catch(function(e){console.error("Lavagna DB err",e)});
    }
    _imgs.push(entry);
    ph.style.display='none';
    renderCard(entry, url);
    triggerSave();
  }

  function renderCard(entry, preloadedUrl){
    var card=document.createElement('div');card.id='lc_'+entry.id;
    card.style.cssText='position:relative;width:220px;flex-shrink:0;border:1px solid rgba(201,165,92,0.3);border-radius:6px;overflow:hidden;background:#0a1628;box-shadow:0 3px 10px rgba(0,0,0,0.5);';
    var img=document.createElement('img');
    img.style.cssText='width:100%;display:block;max-height:300px;object-fit:contain;background:#111;cursor:zoom-in;';
    
    // Recupera da IndexedDB se non pre-caricata
    if (preloadedUrl) {
      img.src = preloadedUrl;
    } else if (entry.dataUrl) {
      img.src = entry.dataUrl; // Backward compat momentanea
    } else if (window.ImageDB) {
      window.ImageDB.get(entry.id).then(function(du){
        if(du) img.src = du;
        else img.alt = "Immagine persa";
      });
    }

    img.onclick=function(){
        var ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:9998;display:flex;align-items:center;justify-content:center;overflow:hidden;';
        var big = document.createElement('img'); big.src = img.src;
        big.style.cssText = 'max-width:95vw;max-height:93vh;object-fit:contain;border-radius:4px;transition:transform 0.1s ease-out;cursor:grab;user-select:none;';
        var sc=1, tx=0, ty=0, drg=false, sx, sy;
        var up = function(){ big.style.transform='translate('+tx+'px,'+ty+'px) scale('+sc+')'; };
        ov.addEventListener('wheel', function(e){ e.preventDefault(); sc+=e.deltaY*-0.002; sc=Math.max(1,Math.min(sc,6)); if(sc===1){tx=0;ty=0;} up(); }, {passive:false});
        big.onmousedown=function(e){ e.preventDefault(); e.stopPropagation(); drg=true; big.style.cursor='grabbing'; sx=e.clientX-tx; sy=e.clientY-ty; };
        window.addEventListener('mousemove', function(e){ if(!drg)return; tx=e.clientX-sx; ty=e.clientY-sy; up(); });
        window.addEventListener('mouseup', function(){ drg=false; big.style.cursor='grab'; });
        var cb=document.createElement('div'); cb.innerHTML='✖'; cb.style.cssText='position:absolute;top:20px;right:30px;color:#fff;font-size:36px;cursor:pointer;z-index:9999;font-family:sans-serif;';
        cb.onclick=function(){ov.remove();};
        ov.onclick=function(e){if(e.target===ov)ov.remove();};
        ov.appendChild(big); ov.appendChild(cb); document.body.appendChild(ov);
    };
    
    var del=document.createElement('button');del.textContent='✕';del.style.cssText='position:absolute;top:5px;right:5px;background:rgba(160,25,25,0.88);border:none;color:#fff;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;line-height:1;';
    del.onclick=function(e){
        e.stopPropagation();
        if(confirm('Eliminare?')){
            card.remove();
            if(window.ImageDB) window.ImageDB.remove(entry.id);
            var idx = _imgs.findIndex(function(i){ return i.id === entry.id; });
            if (idx > -1) _imgs.splice(idx, 1);
            if(!_imgs.length) ph.style.display='';
            triggerSave();
        }
    };
    card.appendChild(img);card.appendChild(del);grid.appendChild(card);
  }

  _imgs.forEach(function(i){ renderCard(i); });

  function processFile(file){var r=new FileReader();r.onload=function(ev){var i=new Image();i.onload=function(){var mxW=2500,sc=Math.min(1,mxW/i.width);var cv=document.createElement('canvas');cv.width=Math.round(i.width*sc);cv.height=Math.round(i.height*sc);cv.getContext('2d').drawImage(i,0,0,cv.width,cv.height);addImg(cv.toDataURL('image/jpeg', 0.95));};i.src=ev.target.result;};r.readAsDataURL(file);}
  ulInp.addEventListener('change',function(e){Array.from(e.target.files).forEach(processFile);e.target.value='';});

  function onPaste(e){if(!state.lavagnaOpen || (state.section!=='scheda' && state.section!=='schedepg'))return;var items=e.clipboardData&&e.clipboardData.items;if(!items)return;for(var i=0;i<items.length;i++){if(items[i].type.indexOf('image')!==-1){processFile(items[i].getAsFile());break;}}}
  
  window._lavagnaPasteListener = onPaste;
  document.addEventListener('paste',onPaste);
  
  var oldCleanup = _sectionCleanup;
  _sectionCleanup = function(){
      if(window._lavagnaPasteListener) {
          document.removeEventListener('paste', window._lavagnaPasteListener);
          window._lavagnaPasteListener = null;
      }
      if(oldCleanup) oldCleanup();
  };
  
  return wrap;
}


/* ============================================================================
   SEZIONE 3: NAVIGAZIONE LATERALE & MENU SEZIONI (renderSidebar)
   ============================================================================ */
function renderSidebar() {
  var sb = document.createElement('aside');
  sb.className = 'sidebar' + (state.sidebarOpen ? ' open' : '');
  sb.innerHTML = '<div class="sidebar-brand"><div class="brand-rune">\u269C</div><div class="brand-name">Mercante<br>Errante</div></div>';

  var sections = [
    {id:'emporio',label:'Emporio',icon:ICON.sword},
    {id:'bestiario',label:isDM()?'Bestiario':'Pet del Party',icon:isDM()?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8 2 4 6 4 10c0 3 2 5 3 7l1 3h8l1-3c1-2 3-4 3-7 0-4-4-8-8-8z"/><path d="M9 17v3M15 17v3M9 21h6"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'},
    {id:'incantesimi',label:'Incantesimi Aggiuntivi',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>'},
    {id:'mappa',label:'Mappa del Mondo',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>'},
    {id:'worldbuilding', label:'Worldbuilding', dmOnly: true, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'},
    {id:'storia', label:'Storia', dmOnly: true, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'},
    {id:'archivio', label:'Archivio Idee', dmOnly: true, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="7" x2="16" y2="7"/><line x1="12" y1="11" x2="16" y2="11"/></svg>'},
    {id:'generatore',label:'Generatore NPC',dmOnly:true,icon:ICON.npc},
    {id:'iniziativa',label:'Iniziativa',icon:ICON.swords},
    {id:'caos',label:'Statistiche & Caos',icon:ICON.skullDice},
    {id:'note',label:'Note di Sessione',icon:ICON.scroll,playerOnly:true},
    {id:'scheda',label:'Scheda PG',playerOnly:true,icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'}
  ];
  sections.forEach(function(s) {
    // Nascondi sezioni dmOnly ai giocatori e sezioni playerOnly al DM
    if (s.dmOnly && !isDM()) return;
    if (s.playerOnly && isDM()) return;
    var item = document.createElement('div');
    item.className = 'nav-item' + (state.section === s.id ? ' active' : '');
    item.innerHTML = s.icon + '<span>' + s.label + '</span>';
    item.onclick = function() {
      state.section = s.id;
      state.sidebarOpen = false;
      renderMain();
    };
    sb.appendChild(item);
  });

  /* Separatore */
  var sep = document.createElement('div');
  sep.style.cssText = 'height:1px;background:var(--border-subtle);margin:0.5rem 0.75rem;';
  sb.appendChild(sep);

  /* Pulsante Regia Sonora — solo DM */
  if (isDM()) {
    var regiaItem = document.createElement('div');
    regiaItem.className = 'nav-item' + (state.regiaActive ? ' active' : '');
    regiaItem.style.cssText = state.regiaActive ? 'background:rgba(201,165,92,0.12);' : '';
    regiaItem.innerHTML = ICON.music + '<span>Regia Sonora</span>';
    if (state.regiaActive) {
      regiaItem.innerHTML += '<span style="margin-left:auto;font-size:8px;font-family:\'Cinzel\',serif;color:var(--gold);letter-spacing:0.05em;">ON</span>';
    }
    regiaItem.onclick = function() {
      state.regiaActive = !state.regiaActive;
      state.sidebarOpen = false;
      render();
    };
    sb.appendChild(regiaItem);
  }

  /* Pulsante Lanciatore Dadi — visibile a tutti */
  var dadiIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>';
  var dadiItem = document.createElement('div');
  dadiItem.className = 'nav-item' + (state.section === 'dadi' ? ' active' : '');
  dadiItem.innerHTML = dadiIcon + '<span>Lanciatore Dadi</span>';
  dadiItem.onclick = function() { state.section = 'dadi'; state.sidebarOpen = false; renderMain(); };
  sb.appendChild(dadiItem);

  /* Pulsante Schede PG — solo DM */
  if (isDM()) {
    var schedePGIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    var schedePGItem = document.createElement('div');
    schedePGItem.className = 'nav-item' + (state.section === 'schedepg' ? ' active' : '');
    schedePGItem.innerHTML = schedePGIcon + '<span>Schede PG</span>';
    schedePGItem.onclick = function() {
      state.section = 'schedepg';
      state.sidebarOpen = false;
      renderMain();
    };
    sb.appendChild(schedePGItem);
  }

  /* Pulsante Libreria — visibile a tutti, ultimo prima del footer */
  var libriIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
  var libriItem = document.createElement('div');
  libriItem.className = 'nav-item' + (state.section === 'libri' ? ' active' : '');
  libriItem.innerHTML = libriIcon + '<span>Libreria</span>';
  libriItem.onclick = function() {
    state.section = 'libri';
    state.sidebarOpen = false;
    if (state.libriCustom === null) {
      state.libriCustom = {};
      _db && _db.ref('libri/books').on('value', function(snap) {
        state.libriCustom = snap.val() || {};
        if (state.section === 'libri') renderMain();
      });
    }
    if (state.libriPreferiti === undefined) {
      state.libriPreferiti = {};
      var u = state.currentUser ? state.currentUser.username : '_guest';
      _db && _db.ref('libri/preferiti/' + u).on('value', function(snap) {
        state.libriPreferiti = snap.val() || {};
        if (state.section === 'libri') renderMain();
      });
    }
    renderMain();
  };
  sb.appendChild(libriItem);

  /* Tavolo da Gioco */
  var tavoloIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="7" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg>';
  var tavoloItem=document.createElement('div');
  tavoloItem.className='nav-item'+(state.section==='tavolo'?' active':'');
  tavoloItem.innerHTML=tavoloIcon+'<span>Tavolo da Gioco</span>';
  tavoloItem.onclick=function(){state.section='tavolo';state.sidebarOpen=false;renderMain();};
  sb.appendChild(tavoloItem);

  var footer = document.createElement('div');
  footer.className = 'sidebar-footer';

  window.setAppTheme = function(newTheme, fromAnimEngine) {
    if (newTheme !== 'dark' && newTheme !== 'light' && newTheme !== 'halloween' && newTheme !== 'christmas' && newTheme !== 'valentine' && newTheme !== 'easter') newTheme = 'dark';
    state.theme = newTheme;
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem('sium_theme_mode', newTheme);
      localStorage.setItem('theme', newTheme);
    } catch (e) {}
    saveToStorage();
    render();
    if (!fromAnimEngine && window.SiumAnimations && typeof window.SiumAnimations.onThemeChange === 'function') {
      window.SiumAnimations.onThemeChange(newTheme);
    }
  };

  var footerControlsRow = document.createElement('div');
  footerControlsRow.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:0.45rem;width:100%;';

  var tb = document.createElement('button');
  tb.className = 'theme-toggle';
  tb.title = 'Alterna Modalità Chiara / Scura';
  tb.innerHTML = state.theme === 'light' ? ICON.moon : ICON.sun;
  tb.onclick = function() {
    var nextT = state.theme === 'dark' ? 'light' : 'dark';
    window.setAppTheme(nextT);
  };
  footerControlsRow.appendChild(tb);

  var themePickerSidebarBtn = document.createElement('button');
  themePickerSidebarBtn.type = 'button';
  themePickerSidebarBtn.className = 'sium-ctrl-btn sium-theme-picker-btn' + ((state.theme === 'halloween' || state.theme === 'christmas' || state.theme === 'valentine' || state.theme === 'easter') ? ' active' : '');
  themePickerSidebarBtn.style.cssText = 'flex:1;justify-content:center;padding:0.42rem 0.55rem;';
  var tIcon = state.theme === 'easter' ? '🐰' : (state.theme === 'valentine' ? '💘' : (state.theme === 'christmas' ? '🎄' : (state.theme === 'halloween' ? '🎃' : (state.theme === 'light' ? '☀️' : '🌙'))));
  var tLabel = state.theme === 'easter' ? 'Tema: Pasqua' : (state.theme === 'valentine' ? 'Tema: S. Valentino' : (state.theme === 'christmas' ? 'Tema: Natale' : (state.theme === 'halloween' ? 'Tema: Halloween' : (state.theme === 'light' ? 'Tema: Chiaro' : 'Tema: Scuro'))));
  themePickerSidebarBtn.innerHTML = '<span>' + tIcon + '</span><span class="theme-btn-label">' + tLabel + '</span>';
  themePickerSidebarBtn.onclick = function(e) {
    e.stopPropagation();
    if (window.SiumAnimations && typeof window.SiumAnimations.toggleThemePickerMenu === 'function') {
      window.SiumAnimations.toggleThemePickerMenu(themePickerSidebarBtn);
    }
  };
  footerControlsRow.appendChild(themePickerSidebarBtn);
  footer.appendChild(footerControlsRow);

  var fxSidebarBtn = document.createElement('button');
  var isFxOn = !(window.SiumAnimations && typeof window.SiumAnimations.isFxEnabled === 'function' && !window.SiumAnimations.isFxEnabled());
  fxSidebarBtn.type = 'button';
  fxSidebarBtn.className = 'sium-ctrl-btn sium-fx-toggle-btn' + (isFxOn ? ' active' : '');
  fxSidebarBtn.style.cssText = 'width:100%;margin-top:0.45rem;justify-content:center;padding:0.42rem 0.6rem;';
  fxSidebarBtn.innerHTML = isFxOn
    ? '<span>✨</span><span class="fx-label">Animazioni: ON</span>'
    : '<span>💤</span><span class="fx-label">Animazioni: OFF</span>';
  fxSidebarBtn.onclick = function() {
    if (window.SiumAnimations && typeof window.SiumAnimations.toggleFx === 'function') {
      window.SiumAnimations.toggleFx();
    }
  };
  footer.appendChild(fxSidebarBtn);

  /* Pulsante Logout \u2014 se loggato con Google */
  if (_authUser) {
    var logoutBtn = document.createElement('button');
    logoutBtn.style.cssText = 'width:100%;margin-top:0.5rem;background:transparent;border:1px solid rgba(201,165,92,0.25);color:var(--gold-dim);font-family:\'Cinzel\',serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:0.4rem 0.75rem;cursor:pointer;border-radius:3px;';
    logoutBtn.textContent = '\u293B Disconnetti';
    logoutBtn.onmouseenter = function(){ this.style.borderColor='var(--border-gold)'; this.style.color='var(--gold)'; };
    logoutBtn.onmouseleave = function(){ this.style.borderColor='rgba(201,165,92,0.25)'; this.style.color='var(--gold-dim)'; };
    logoutBtn.onclick = doSignOut;
    footer.appendChild(logoutBtn);
  }

  var lab = document.createElement('div');
  lab.className = 'font-display text-center';
  lab.style.cssText = 'font-size:9px;color:var(--gold-dim);letter-spacing:0.18em;margin-top:0.5rem;';
  lab.textContent = '\u269C OFFLINE READY \u269C';
  footer.appendChild(lab);
  sb.appendChild(footer);
  return sb;
}

var _shopOpen = false;
var _coinsOpen = false;

function _renderShopPanel(container) {
  container.innerHTML = '';
  var RC = { 'Comune':'#9a9a9a','Non comune':'#40c060','Raro':'#4488ff','Molto raro':'#aa44ff','Leggendario':'#ffa020','Artefatto':'#ff4444','Divino':'#ffe060','Unico':'#ff80c0' };

  /* ── Illustrazione SVG baracchino ── */
  var svgWrap = document.createElement('div');
  svgWrap.style.cssText = 'width:100%;overflow:hidden;border-radius:10px 10px 0 0;background:#1a0e04;';
  svgWrap.innerHTML = '<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">' +
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
  ctrl.style.cssText = 'padding:1.1rem 1.4rem;background:rgba(30,15,4,0.92);border:1px solid rgba(201,165,92,0.3);border-top:none;border-radius:0 0 10px 10px;display:flex;flex-wrap:wrap;align-items:center;gap:1rem;';

  /* Livello party — pills */
  var lvlLabel = document.createElement('span');
  lvlLabel.style.cssText = 'font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;letter-spacing:0.1em;color:rgba(201,165,92,0.65);white-space:nowrap;';
  lvlLabel.textContent = 'LIVELLO PARTY:';
  ctrl.appendChild(lvlLabel);

  var lvlBands = [{label:'1–5', min:1, max:5},{label:'6–10', min:6, max:10},{label:'11–15', min:11, max:15},{label:'16–20', min:16, max:20}];
  var curLvl = state.shopFilter.livello || 5;
  lvlBands.forEach(function(b) {
    var isA = curLvl >= b.min && curLvl <= b.max;
    var btn = document.createElement('button');
    btn.textContent = b.label;
    btn.style.cssText = 'font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;padding:0.3rem 0.85rem;border-radius:20px;cursor:pointer;transition:all 0.15s;' +
      'border:1.5px solid '+(isA?'#f5a623':'rgba(201,165,92,0.3)')+';' +
      'background:'+(isA?'rgba(245,166,35,0.2)':'rgba(18,10,2,0.7)')+';' +
      'color:'+(isA?'#f5c842':'rgba(201,165,92,0.55)')+';' +
      'box-shadow:'+(isA?'0 0 8px rgba(245,166,35,0.3)':'none')+';';
    btn.onclick = function() {
      state.shopFilter.livello = Math.round((b.min + b.max) / 2);
      _renderShopPanel(container);
    };
    ctrl.appendChild(btn);
  });

  /* Pulsante genera */
  var genBtn = document.createElement('button');
  genBtn.style.cssText = 'margin-left:auto;font-family:\'Cinzel\',serif;font-size:12px;font-weight:700;letter-spacing:0.1em;padding:0.5rem 1.6rem;border-radius:6px;cursor:pointer;background:rgba(201,165,92,0.18);border:1.5px solid #f5a623;color:#f5c842;box-shadow:0 0 12px rgba(245,166,35,0.2);transition:all 0.15s;';
  genBtn.textContent = '✨ Apri il Negozio';
  genBtn.onmouseenter = function(){ genBtn.style.background='rgba(201,165,92,0.3)'; };
  genBtn.onmouseleave = function(){ genBtn.style.background='rgba(201,165,92,0.18)'; };
  ctrl.appendChild(genBtn);
  container.appendChild(ctrl);

  /* ── Lista oggetti generati ── */
  var listEl = document.createElement('div');
  listEl.style.cssText = 'margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.55rem;';
  container.appendChild(listEl);

  genBtn.onclick = function(){ _generateShop(listEl, RC); };
}

function _generateShop(listEl, RC) {
  listEl.innerHTML = '';
  var lvl = state.shopFilter.livello || 5;

  /* Pesi rarità scalati per banda di livello */
  var W;
  if (lvl <= 5)       W = {'Comune':42,'Non comune':30,'Raro':15,'Molto raro':7,'Leggendario':4,'Artefatto':1,'Divino':1,'Unico':0};
  else if (lvl <= 10) W = {'Comune':20,'Non comune':25,'Raro':30,'Molto raro':15,'Leggendario':6,'Artefatto':1,'Divino':2,'Unico':1};
  else if (lvl <= 15) W = {'Comune':10,'Non comune':14,'Raro':20,'Molto raro':32,'Leggendario':14,'Artefatto':3,'Divino':4,'Unico':3};
  else                W = {'Comune':5,'Non comune':8,'Raro':12,'Molto raro':20,'Leggendario':28,'Artefatto':7,'Divino':12,'Unico':8};

  /* Solo oggetti dell'emporio */
  var pool = typeof SRD_OGGETTI !== 'undefined' ? SRD_OGGETTI.filter(function(o){ return o && o.nome; }) : [];

  /* Pesca pesata — esattamente 10 oggetti unici */
  var totalW = 0; for (var k in W) totalW += W[k];
  var picked = [], attempts = 0;
  while (picked.length < 10 && attempts < 400) {
    attempts++;
    var r = Math.random() * totalW, cum = 0, tRar = 'Comune';
    for (var rk in W) { cum += W[rk]; if (r < cum) { tRar = rk; break; } }
    var sub = pool.filter(function(o){ return (o.rarita || 'Comune') === tRar; });
    if (!sub.length) sub = pool;
    var pick = sub[Math.floor(Math.random() * sub.length)];
    if (!picked.some(function(p){ return p.nome === pick.nome; })) picked.push(pick);
  }

  if (!picked.length) {
    listEl.innerHTML = '<div style="color:var(--text-faint);font-size:12px;padding:1rem;">Nessun oggetto trovato.</div>';
    return;
  }

  /* Ordina: dalla rarità più alta alla più bassa */
  var rarOrder = {'Divino':0,'Unico':1,'Artefatto':2,'Leggendario':3,'Molto raro':4,'Raro':5,'Non comune':6,'Comune':7};
  picked.sort(function(a,b){ return (rarOrder[a.rarita]||7)-(rarOrder[b.rarita]||7); });

  picked.forEach(function(item) {
    var rc = RC[item.rarita] || '#9a9a9a';
    var isDivine = item.rarita === 'Divino' || item.rarita === 'Unico' || item.rarita === 'Artefatto';
    var card = document.createElement('div');
    card.style.cssText = 'padding:0.65rem 0.8rem;border-radius:6px;cursor:default;transition:all 0.15s;' +
      'background:rgba(20,12,3,0.85);' +
      'border:1px solid ' + (isDivine ? rc : 'rgba(201,165,92,0.18)') + ';' +
      (isDivine ? 'box-shadow:0 0 10px ' + rc + '40;' : '');

    /* Nome + rarità */
    var topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;margin-bottom:0.3rem;';
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-family:\'Cinzel\',serif;font-size:12px;font-weight:700;color:' + (isDivine ? rc : 'var(--text-main)') + ';flex:1;' + (isDivine ? 'text-shadow:0 0 8px '+rc+'80;' : '');
    nameEl.textContent = item.nome;
    var rarEl = document.createElement('span');
    rarEl.style.cssText = 'font-size:9px;font-family:\'Cinzel\',serif;font-weight:700;letter-spacing:0.07em;color:'+rc+';border:1px solid '+rc+'60;padding:0.1rem 0.4rem;border-radius:10px;white-space:nowrap;background:'+rc+'12;';
    rarEl.textContent = item.rarita || 'Comune';
    topRow.appendChild(nameEl); topRow.appendChild(rarEl);
    card.appendChild(topRow);

    /* Tipo + prezzo */
    var metaRow = document.createElement('div');
    metaRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:0.5rem;';
    var tipoEl = document.createElement('span');
    tipoEl.style.cssText = 'font-size:9px;color:var(--text-faint);font-style:italic;';
    tipoEl.textContent = item.tipo || '';
    var priceEl = document.createElement('span');
    priceEl.style.cssText = 'font-size:10px;color:var(--gold-dim);font-family:\'Cinzel\',serif;white-space:nowrap;';
    priceEl.textContent = item.prezzo ? item.prezzo.toLocaleString('it-IT') + ' ' + (item.valuta||'mo').toUpperCase() : (isDivine ? '∞ — Impagabile' : '');
    metaRow.appendChild(tipoEl); metaRow.appendChild(priceEl);
    card.appendChild(metaRow);

    /* Descrizione */
    if (item.descrizione) {
      var desc = document.createElement('div');
      desc.style.cssText = 'font-size:10px;color:var(--text-faint);margin-top:0.35rem;line-height:1.4;border-top:1px solid rgba(201,165,92,0.1);padding-top:0.3rem;';
      desc.textContent = item.descrizione.length > 120 ? item.descrizione.slice(0,120) + '…' : item.descrizione;
      card.appendChild(desc);
    }

    listEl.appendChild(card);
  });
}

function _renderCoinsPanel(container) {
  container.innerHTML = '';
  var COINS = [
    {key:'mp', label:'Platino (MP)', short:'MP', color:'#d0e8ff', rate:1000},
    {key:'mo', label:'Oro (MO)',     short:'MO', color:'#f5c842', rate:100},
    {key:'ma', label:'Argento (MA)', short:'MA', color:'#c0c8d0', rate:10},
    {key:'mr', label:'Rame (MR)',    short:'MR', color:'#e0926a', rate:1}
  ];

  var hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:\'Cinzel\',serif;font-size:14px;font-weight:700;color:var(--gold-bright);letter-spacing:0.12em;margin-bottom:1rem;';
  hdr.textContent = '💰 Convertitore Monete';
  container.appendChild(hdr);

  /* ── riga FROM ── */
  var rowFrom = document.createElement('div');
  rowFrom.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;';

  var amtInp = document.createElement('input');
  amtInp.type = 'number'; amtInp.min = '0'; amtInp.value = '1';
  amtInp.style.cssText = 'flex:1;background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-main);font-size:16px;font-family:\'Cinzel\',serif;padding:0.45rem 0.6rem;border-radius:6px;outline:none;text-align:right;min-width:0;';

  var selFrom = document.createElement('select');
  selFrom.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-gold);color:var(--gold);font-family:\'Cinzel\',serif;font-size:12px;padding:0.45rem 0.4rem;border-radius:6px;cursor:pointer;outline:none;';
  COINS.forEach(function(c){
    var o = document.createElement('option'); o.value = c.key; o.textContent = c.label; selFrom.appendChild(o);
  });
  selFrom.value = 'mo';

  rowFrom.appendChild(amtInp); rowFrom.appendChild(selFrom);
  container.appendChild(rowFrom);

  /* ── pulsante swap ── */
  var swapRow = document.createElement('div');
  swapRow.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;';

  var swapBtn = document.createElement('button');
  swapBtn.textContent = '⇅ Scambia';
  swapBtn.style.cssText = 'font-family:\'Cinzel\',serif;font-size:11px;padding:0.3rem 0.9rem;border-radius:20px;border:1px solid var(--border-gold);background:rgba(201,165,92,0.1);color:var(--gold);cursor:pointer;';
  swapBtn.onclick = function() {
    var tmp = selFrom.value; selFrom.value = selTo.value; selTo.value = tmp;
    calcConvert();
  };

  var arrowEl = document.createElement('div');
  arrowEl.style.cssText = 'flex:1;text-align:center;font-size:18px;color:rgba(201,165,92,0.5);';
  arrowEl.textContent = '↓';

  swapRow.appendChild(swapBtn); swapRow.appendChild(arrowEl);
  container.appendChild(swapRow);

  /* ── riga TO ── */
  var rowTo = document.createElement('div');
  rowTo.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-bottom:1rem;';

  var resultEl = document.createElement('div');
  resultEl.style.cssText = 'flex:1;background:rgba(201,165,92,0.07);border:1px solid var(--border-gold);color:var(--gold-bright);font-family:\'Cinzel\',serif;font-size:16px;padding:0.45rem 0.6rem;border-radius:6px;text-align:right;min-width:0;letter-spacing:0.03em;';
  resultEl.textContent = '—';

  var selTo = document.createElement('select');
  selTo.style.cssText = selFrom.style.cssText;
  COINS.forEach(function(c){
    var o = document.createElement('option'); o.value = c.key; o.textContent = c.label; selTo.appendChild(o);
  });
  selTo.value = 'mr';

  rowTo.appendChild(resultEl); rowTo.appendChild(selTo);
  container.appendChild(rowTo);

  /* ── calcolo ── */
  function calcConvert() {
    var amt = parseFloat(amtInp.value) || 0;
    var fromC = COINS.find(function(c){ return c.key === selFrom.value; });
    var toC   = COINS.find(function(c){ return c.key === selTo.value; });
    if (!fromC || !toC) return;
    var inMR = amt * fromC.rate;
    var res  = inMR / toC.rate;
    var txt  = (res % 1 === 0) ? res.toLocaleString('it-IT') : res.toLocaleString('it-IT', {maximumFractionDigits:4});
    resultEl.textContent = txt + ' ' + toC.short;
    resultEl.style.color = toC.color;
  }

  amtInp.oninput = calcConvert;
  selFrom.onchange = calcConvert;
  selTo.onchange = calcConvert;
  calcConvert();

  /* ── separatore ── */
  var sep = document.createElement('div');
  sep.style.cssText = 'border-top:1px solid rgba(201,165,92,0.2);margin-bottom:0.8rem;padding-top:0.8rem;font-family:\'Cinzel\',serif;font-size:10px;color:rgba(201,165,92,0.45);letter-spacing:0.12em;';
  sep.textContent = 'TASSI DI CAMBIO: 1 MP = 10 MO = 100 MA = 1000 MR';
  container.appendChild(sep);
}


/* ============================================================================
   SEZIONE 4: EMPORIO DEL MERCANTE (Classico, Cyberware, Sostanze, Veicoli, Armi)
   ============================================================================ */
function renderEmporio() {
  if (state.emporioTab === 'cyber') return renderEmporioCyber();
  if (state.emporioTab === 'droghe') return renderEmporioDroghe();
  if (state.emporioTab === 'veicoli') return renderEmporioVeicoli();
  if (state.emporioTab === 'armifuoco') return renderEmporioArmiFuoco();
  var wrap = document.createElement('div');

  var header = document.createElement('header');
  header.className = 'border-b';
  header.style.cssText = 'position:relative;overflow:visible;';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';

  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  top.innerHTML =
    '<div>' +
      '<div class="header-eyebrow mb-3"><span>Compendium Arcanum</span></div>' +
      '<h1 class="header-title">Il Mercante Errante</h1>' +
      '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Database delle armi, pozioni e oggetti magici</p>' +
    '</div>';

  var rightHead = document.createElement('div');
  rightHead.className = 'flex flex-wrap items-center gap-2';
  var btnSave = document.createElement('button');
  btnSave.className = 'btn-dark';
  btnSave.innerHTML = ICON.save + ' Salva su Chiavetta';
  btnSave.onclick = saveArmi;
  rightHead.appendChild(btnSave);
  var btnLoad = document.createElement('button');
  btnLoad.className = 'btn-dark';
  btnLoad.innerHTML = ICON.folder + ' Carica da Chiavetta';
  btnLoad.onclick = loadArmi;
  rightHead.appendChild(btnLoad);

  var btnShop = document.createElement('button');
  btnShop.className = 'btn-dark';
  btnShop.innerHTML = '🏪 Negozio';
  if (_shopOpen) btnShop.style.cssText = 'border-color:var(--gold);color:var(--gold);';
  btnShop.onclick = function() { _shopOpen = !_shopOpen; _coinsOpen = false; renderMain(); };
  rightHead.appendChild(btnShop);

  var btnCoins = document.createElement('button');
  btnCoins.className = 'btn-dark';
  btnCoins.innerHTML = '💰 Monete';
  if (_coinsOpen) btnCoins.style.cssText = 'border-color:var(--gold);color:var(--gold);';
  btnCoins.onclick = function() { _coinsOpen = !_coinsOpen; _shopOpen = false; renderMain(); };
  rightHead.appendChild(btnCoins);

  top.appendChild(rightHead);

  hc.appendChild(top);
  if (!state._emporioNoticeDismissed) {
    var notice = document.createElement('div');
    notice.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-top:0.75rem;background:rgba(201,165,92,0.08);border:1px solid rgba(201,165,92,0.25);border-radius:4px;padding:0.55rem 0.9rem;font-size:13px;font-style:italic;color:var(--text-muted);';
    var noticeSpan = document.createElement('span');
    noticeSpan.innerHTML = '☁ <strong style="color:var(--gold);font-style:normal;">Salvataggio automatico attivo</strong> — i dati vengono sincronizzati su Firebase ad ogni modifica. Usa <em>Salva su Chiavetta</em> per un backup locale.';
    notice.appendChild(noticeSpan);
    var noticeX = document.createElement('button');
    noticeX.style.cssText = 'background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:18px;line-height:1;padding:0 0.2rem;flex-shrink:0;';
    noticeX.textContent = '×';
    noticeX.title = 'Chiudi';
    noticeX.onclick = function() { state._emporioNoticeDismissed = true; notice.remove(); };
    notice.appendChild(noticeX);
    hc.appendChild(notice);
  }
  header.appendChild(hc);
  wrap.appendChild(header);

  if (_shopOpen || _coinsOpen) {
    var sidePanel = document.createElement('div');
    sidePanel.style.cssText = 'max-width:720px;margin:1rem auto;padding:1.25rem 1.5rem;background:var(--bg-panel);border:1px solid var(--border-gold);border-radius:10px;box-sizing:border-box;';
    if (_shopOpen) _renderShopPanel(sidePanel);
    else _renderCoinsPanel(sidePanel);
    wrap.appendChild(sidePanel);
  }

  // --- TOGGLE BAR ---
  var cyberBar = document.createElement('div');
  cyberBar.style.cssText = 'background:var(--bg-card);border-bottom:1px solid var(--border-subtle);';
  var cyberBarInner = document.createElement('div');
  cyberBarInner.className = 'container-main';
  cyberBarInner.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:0.5rem;padding-top:0.4rem;padding-bottom:0.4rem;';

  var tabNorm = document.createElement('button');
  tabNorm.type = 'button';
  tabNorm.style.cssText = 'padding:0.5rem 1.1rem;font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;border:none;border-bottom:2px solid var(--border-gold);background:transparent;color:var(--gold);cursor:default;white-space:nowrap;';
  tabNorm.textContent = '⚔ Emporio';
  cyberBarInner.appendChild(tabNorm);

  var emporioTabs = [
    {id:'veicoli', icon:'🚗', label:'Veicoli', color:'#f5a623'},
    {id:'droghe', icon:'💊', label:'Droghe', color:'#7fff7f'},
    {id:'cyber', icon:'🕷', label:'Laboratorio Cibernetico', color:'#1af'},
    {id:'armifuoco', icon:'🔫', label:'Armi da Fuoco', color:'#e53030'},
  ];
  emporioTabs.forEach(function(t) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'display:flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;background:transparent;border:1px solid rgba(200,200,200,0.2);color:rgba(200,200,200,0.7);font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;white-space:nowrap;';
    btn.innerHTML = t.icon + ' ' + t.label;
    btn.onmouseenter = function(){ this.style.color=t.color; this.style.borderColor=t.color; };
    btn.onmouseleave = function(){ this.style.color='rgba(200,200,200,0.7)'; this.style.borderColor='rgba(200,200,200,0.2)'; };
    btn.onclick = function(){ state.emporioTab = t.id; renderMain(); };
    cyberBarInner.appendChild(btn);
  });

  cyberBar.appendChild(cyberBarInner);
  wrap.appendChild(cyberBar);

  var section = document.createElement('section');
  section.className = 'container-main';
  section.style.cssText = 'padding-top:2rem;padding-bottom:1rem;';

  var pg = document.createElement('div');
  pg.className = 'panel-glass';
  var row = document.createElement('div');
  row.className = 'flex flex-wrap items-end gap-4';

  var sw = document.createElement('div');
  sw.style.cssText = 'flex:1 1 200px;min-width:180px;';
  sw.innerHTML = '<label class="field-label">Cerca per nome o descrizione</label>';
  var swInputWrap = document.createElement('div');
  swInputWrap.className = 'search-wrap';
  swInputWrap.innerHTML = ICON.search;
  var swInput = document.createElement('input');
  swInput.type = 'text';
  swInput.className = 'field';
  swInput.placeholder = 'es. spada, pozione, runico...';
  swInput.value = state.search;
  swInput.oninput = function() { state.search = this.value; updateResults(); };
  swInputWrap.appendChild(swInput);
  sw.appendChild(swInputWrap);
  row.appendChild(sw);

  row.appendChild(makeSelectFilter('Tipo', state.filtroTipo, [''].concat(TIPI), function(v){ state.filtroTipo=v; updateResults(); }, '— Tutti i tipi —'));
  row.appendChild(makeSelectFilter('Valuta', state.filtroValuta, [''].concat(VALUTE.map(function(v){return v.code;})), function(v){ state.filtroValuta=v; updateResults(); }, '— Tutte —', function(v){
    var f = null;
    VALUTE.forEach(function(x){ if (x.code === v) f = x.label + ' (' + x.code + ')'; });
    return f || v;
  }));
  row.appendChild(makeSelectFilter('Rarit\u00E0', state.filtroRarita, [''].concat(RARITA), function(v){ state.filtroRarita=v; updateResults(); }, '— Tutte le rarit\u00E0 —'));

  /* Checkbox homebrew */
  var hbWrap = document.createElement('div');
  hbWrap.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding-bottom:0.2rem;';
  var hbChk = document.createElement('input');
  hbChk.type = 'checkbox';
  hbChk.id = 'emporio-homebrew-chk';
  hbChk.checked = !!state.emporioShowHomebrew;
  hbChk.style.cssText = 'width:15px;height:15px;cursor:pointer;accent-color:var(--gold);';
  hbChk.onchange = function() { state.emporioShowHomebrew = this.checked; updateResults(); };
  var hbLbl = document.createElement('label');
  hbLbl.htmlFor = 'emporio-homebrew-chk';
  hbLbl.style.cssText = 'font-family:Cinzel,serif;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--gold-dim);cursor:pointer;white-space:nowrap;user-select:none;';
  hbLbl.textContent = 'Mostra Homebrew';
  hbWrap.appendChild(hbChk);
  hbWrap.appendChild(hbLbl);
  row.appendChild(hbWrap);

  var addBtnW = document.createElement('div');
  var addBtn = document.createElement('button');
  addBtn.className = 'btn-gold';
  addBtn.innerHTML = ICON.plus + ' Nuova Arma';
  addBtn.onclick = function() { state.editingId = null; state.showForm = true; document.body.appendChild(renderWeaponForm()); };
  addBtnW.appendChild(addBtn);
  if (isAdmin()) row.appendChild(addBtnW);

  pg.appendChild(row);

  var activeFilters = document.createElement('div');
  activeFilters.id = 'active-filters';
  pg.appendChild(activeFilters);
  renderActiveFilters(activeFilters);

  section.appendChild(pg);
  wrap.appendChild(section);

  var counterWrap = document.createElement('div');
  counterWrap.className = 'container-main pb-4';
  var counterEl = document.createElement('div');
  counterEl.id = 'results-counter';
  counterWrap.appendChild(counterEl);
  wrap.appendChild(counterWrap);

  var main = document.createElement('section');
  main.className = 'container-main pb-20';
  var grid = document.createElement('div');
  grid.id = 'weapons-grid';
  main.appendChild(grid);
  wrap.appendChild(main);

  var footer = document.createElement('footer');
  footer.className = 'border-t mt-8';
  footer.style.cssText = 'padding:1.75rem 0;';
  var fc = document.createElement('div');
  fc.className = 'container-main';
  fc.innerHTML = '<div class="filigree-divider mb-5"></div><div class="flex flex-wrap items-center justify-between gap-3"><div class="font-display tracking-widest font-semibold" style="font-size:11px;color:var(--gold-dim);">\u269C APP PORTABILE \u2014 FUNZIONA OFFLINE DA USB \u269C</div></div>';
  footer.appendChild(fc);
  wrap.appendChild(footer);

  setTimeout(function() { updateResults(); }, 0);
  return wrap;
}

// ---- CYBERPUNK EMPORIO ----
var TIPI_CYBER = ['Cervello','Testa','Organi Interni','Braccia','Gambe','Pelle','Altro'];
var RARITA_CYBER = ['Comune','Non comune','Raro','Molto raro','Leggendario'];
var INSTALLAZIONE_CYBER = ['Semplice','Chirurgica','Specializzata','Pericolosa'];

function _cyberRarityClass(r) {
  var map = {'Comune':'comune','Non comune':'non-comune','Raro':'raro','Molto raro':'molto-raro','Leggendario':'leggendario'};
  return 'cyber-rarity-' + (map[r] || 'comune');
}

// ============================================================
// SEZIONE DROGHE
// ============================================================
var TIPI_DROGA = ['Stimolante','Sedativo','Allucinogeno','Potenziante','Veleno','Altro'];
var TIPI_ARMA_FUOCO = ['Fucile d\'assalto','Pistola','Fucile a pompa','Mitragliatrice leggera','Lanciarazzi','Fucile da cecchino','Arpione','Lanciagranate','Lanciafiamme','Mitragliatrice pesante','Mitraglietta','Fucile da caccia'];
var MUNIZIONI_ARMA = ['Proiettili','Cartucce','Dardi','Munizioni d\'assalto','Carburante','Granate','Razzi','Arpioni'];

function renderEmporioDroghe() {
  var ACCENT = '#7fff7f';
  var ACCENT_DIM = 'rgba(127,255,127,0.15)';
  var wrap = document.createElement('div');
  wrap.style.cssText = 'background:#030d03;min-height:100vh;font-family:\'Courier New\',monospace;color:'+ACCENT+';';

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'background:linear-gradient(180deg,rgba(0,20,0,0.98),rgba(3,13,3,0.95));border-bottom:2px solid rgba(127,255,127,0.3);padding:1.5rem 2rem;';
  var hdrRow = document.createElement('div');
  hdrRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;';
  var hdrLeft = document.createElement('div');
  hdrLeft.innerHTML = '<div style="font-size:15px;font-weight:700;letter-spacing:0.15em;color:'+ACCENT+';margin-bottom:0.4rem;">// EMPORIO — SOSTANZE &amp; COMPOSTI //</div>' +
    '<div style="font-family:\'Cinzel\',serif;font-size:2rem;font-weight:900;letter-spacing:0.3em;color:'+ACCENT+';">▶ DROGHE</div>';
  var hdrRight = document.createElement('div');
  hdrRight.style.cssText = 'display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;';
  if (isAdmin()) {
    var addBtn = document.createElement('button');
    addBtn.style.cssText = 'background:rgba(127,255,127,0.12);border:2px solid '+ACCENT+';color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.55rem 1.2rem;cursor:pointer;text-transform:uppercase;';
    addBtn.textContent = '+ NUOVA DROGA';
    addBtn.onclick = function(){ state.drogheShowForm=true; state.drogheEditingId=null; renderMain(); };
    hdrRight.appendChild(addBtn);
  }
  var backBtn = document.createElement('button');
  backBtn.style.cssText = 'background:rgba(127,255,127,0.08);border:2px solid rgba(127,255,127,0.5);color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.5rem 1.2rem;cursor:pointer;text-transform:uppercase;';
  backBtn.innerHTML = '← TORNA EMPORIO';
  backBtn.onclick = function(){ state.emporioTab='normale'; renderMain(); };
  hdrRight.appendChild(backBtn);
  hdrRow.appendChild(hdrLeft); hdrRow.appendChild(hdrRight);
  hdr.appendChild(hdrRow);

  // Search
  var srchWrap = document.createElement('div');
  srchWrap.style.cssText = 'padding:1rem 2rem 0.5rem;display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;';
  var srch = document.createElement('input');
  srch.type='text'; srch.placeholder='> RICERCA SOSTANZE...';
  srch.id='srch-droghe';
  srch.value=state.drogheSearch||'';
  srch.style.cssText='flex:1;min-width:200px;background:rgba(127,255,127,0.04);border:1px solid rgba(127,255,127,0.3);color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;padding:0.6rem 1rem;outline:none;';
  srch.oninput=function(){ state.drogheSearch=this.value; renderMain(); var f=document.getElementById('srch-droghe'); if(f){f.focus();var l=f.value.length;f.setSelectionRange(l,l);} };
  srchWrap.appendChild(srch);
  hdr.appendChild(srchWrap);

  // Regole dipendenza
  var dipBox = document.createElement('div');
  dipBox.style.cssText = 'margin:0 2rem 1.2rem;padding:1rem 1.25rem;background:rgba(255,204,0,0.06);border:2px solid rgba(255,204,0,0.45);';
  dipBox.innerHTML =
    '<div style="font-size:14px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#ffcc00;margin-bottom:0.7rem;">⚠ REGOLE DI DIPENDENZA</div>' +
    '<div style="font-size:14px;font-weight:700;color:#ffcc00;margin-bottom:0.4rem;">Livelli di dipendenza:</div>' +
    '<ul style="margin:0 0 0.8rem;padding-left:1.4rem;list-style:disc;">' +
      '<li style="font-size:15px;color:#ffe08a;line-height:1.6;margin-bottom:0.3rem;"><strong>Livello 1</strong> — 1 dose a settimana</li>' +
      '<li style="font-size:15px;color:#ffe08a;line-height:1.6;margin-bottom:0.3rem;"><strong>Livello 2</strong> — 1 dose al giorno</li>' +
      '<li style="font-size:15px;color:#ffe08a;line-height:1.6;"><strong>Livello 3</strong> — 3 dosi al giorno <span style="color:#ff8888;font-size:13px;">(assumere la droga non ha alcun effetto)</span></li>' +
    '</ul>' +
    '<div style="font-size:14px;font-weight:700;color:#ffcc00;margin-top:0.4rem;margin-bottom:0.5rem;">Progressione della dipendenza:</div>' +
    '<p style="font-size:15px;color:#ffe08a;line-height:1.65;margin:0 0 0.6rem;">Consumare dosi entro i limiti del proprio <strong>Tasso di Fabbisogno</strong> non richiede alcun Tiro Salvezza e non fa salire il livello di dipendenza.</p>' +
    '<p style="font-size:15px;color:#ffe08a;line-height:1.65;margin:0 0 0.6rem;">Se si consumano dosi <strong>oltre il proprio Tasso di Fabbisogno</strong>, bisogna effettuare un Tiro Salvezza (su <strong>Costituzione</strong> per le droghe fisiche, su <strong>Saggezza</strong> per quelle psicologiche). Se si fallisce, la dipendenza sale di 1 livello. Un <strong>1 naturale</strong> sul dado fallisce sempre, indipendentemente dai modificatori.</p>' +
    '<p style="font-size:15px;color:#ffe08a;line-height:1.65;margin:0;">Raggiunto il <strong>Livello 3</strong> (il massimo), assumere la droga <strong style="color:#ff8888;">non ha alcun effetto sul personaggio</strong>: non conferisce benefici né malus aggiuntivi, e serve unicamente a soddisfare il fabbisogno ed evitare l\'astinenza.</p>' +
    '<div style="font-size:14px;font-weight:700;color:#ffcc00;margin-top:1rem;margin-bottom:0.5rem;">🧪 Disintossicazione:</div>' +
    '<p style="font-size:15px;color:#ffe08a;line-height:1.65;margin:0 0 0.6rem;">Gli incantesimi e gli effetti base che neutralizzano i veleni riescono ad <strong>annullare gli effetti attivi</strong> di una droga, ma <strong>non possono liberare il personaggio dalla sua dipendenza</strong>.</p>' +
    '<p style="font-size:15px;color:#ffe08a;line-height:1.65;margin:0;">Per disintossicarsi magicamente serve una magia più potente: lanciare <strong>Ristorare Superiore</strong> (o un incantesimo di potenza simile) riduce il livello di dipendenza della creatura esattamente di <strong>1</strong>.</p>';
  hdr.appendChild(dipBox);

  wrap.appendChild(hdr);

  // Filter & list
  var all = (state.droghe||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'','it');});
  var q=(state.drogheSearch||'').toLowerCase();
  var filtered = q ? all.filter(function(d){ return (d.nome||'').toLowerCase().includes(q)||(d.tipo||'').toLowerCase().includes(q)||(d.effetto||'').toLowerCase().includes(q); }) : all;

  var counter = document.createElement('div');
  counter.style.cssText='padding:0.5rem 2rem;font-size:12px;color:rgba(127,255,127,0.45);letter-spacing:0.15em;';
  counter.textContent='// '+filtered.length+' SOSTANZE NEL DATABASE';
  wrap.appendChild(counter);

  if (filtered.length===0) {
    var empty=document.createElement('div');
    empty.style.cssText='text-align:center;padding:4rem 2rem;color:rgba(127,255,127,0.3);font-size:16px;letter-spacing:0.1em;';
    empty.innerHTML='💊<br><br>NESSUNA SOSTANZA NEL DATABASE'+(isDM()?'<div style="margin-top:1rem;font-size:14px;">> aggiungi la prima sostanza per iniziare</div>':'');
    wrap.appendChild(empty);
  } else {
    var grid=document.createElement('div');
    grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem;padding:1.5rem 2rem;';
    filtered.forEach(function(d){ grid.appendChild(renderDrogaCard(d, ACCENT)); });
    wrap.appendChild(grid);
  }

  if (state.drogheShowForm) wrap.appendChild(renderDrogaForm(ACCENT));
  return wrap;
}

function renderDrogaCard(d, ACCENT) {
  var card=document.createElement('div');
  card.style.cssText='background:linear-gradient(135deg,rgba(0,30,0,0.95),rgba(5,15,5,0.95));border:2px solid rgba(127,255,127,0.3);padding:0;overflow:hidden;transition:border-color 0.2s,transform 0.2s;';
  card.onmouseenter=function(){ this.style.borderColor='rgba(127,255,127,0.7)'; this.style.transform='translateY(-3px)'; };
  card.onmouseleave=function(){ this.style.borderColor='rgba(127,255,127,0.3)'; this.style.transform=''; };

  if (d.immagine) {
    var img=document.createElement('img');
    img.src=d.immagine; img.alt=d.nome||'';
    img.style.cssText='width:100%;height:160px;object-fit:cover;display:block;border-bottom:1px solid rgba(127,255,127,0.2);';
    img.onerror=function(){ this.style.display='none'; };
    card.appendChild(img);
  }

  var head=document.createElement('div');
  head.style.cssText='padding:1rem 1.2rem 0.7rem;border-bottom:1px solid rgba(127,255,127,0.15);';
  var nameDiv=document.createElement('div');
  nameDiv.style.cssText='font-family:\'Cinzel\',serif;font-size:20px;font-weight:700;color:#7fff7f;line-height:1.2;';
  nameDiv.textContent=d.nome||'Senza nome';
  head.appendChild(nameDiv);
  if (d.tsDipendenza) {
    var tsTag=document.createElement('div');
    tsTag.style.cssText='margin-top:0.4rem;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ffcc00;display:inline-block;border:1px solid rgba(255,204,0,0.5);padding:0.2rem 0.6rem;';
    tsTag.textContent='TS DIPENDENZA: '+d.tsDipendenza;
    head.appendChild(tsTag);
  }
  card.appendChild(head);

  var body=document.createElement('div');
  body.style.cssText='padding:0.8rem 1.2rem;';
  if (d.descrizione) {
    body.innerHTML+='<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#50c850;margin-bottom:0.25rem;">// DESCRIZIONE</div><div style="font-size:16px;color:#b8ffb8;line-height:1.5;">'+nl2br(escapeHtml(d.descrizione))+'</div>';
  }
  var _ds = _textScore(d.descrizione);
  if (_ds > 500) card.classList.add('card--wide');
  if (_ds > 1100) { body.style.maxHeight='480px'; body.style.overflowY='auto'; }
  card.appendChild(body);

  var foot=document.createElement('div');
  foot.style.cssText='padding:0.6rem 1.2rem;border-top:1px solid rgba(127,255,127,0.12);background:rgba(0,10,0,0.4);display:flex;justify-content:space-between;align-items:center;';
  var price=document.createElement('div');
  price.style.cssText='font-size:17px;font-weight:700;color:#7fff7f;';
  price.textContent=d.costo ? d.costo+' '+(d.valuta||'mo') : '— PREZZO N/D';
  foot.appendChild(price);
  if (isAdmin()) {
    var actions=document.createElement('div');
    actions.style.cssText='display:flex;gap:0.4rem;';
    var editBtn=document.createElement('button');
    editBtn.style.cssText='background:rgba(127,255,127,0.1);border:1px solid rgba(127,255,127,0.4);color:#7fff7f;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
    editBtn.textContent='✎';
    editBtn.onclick=function(){ state.drogheEditingId=d.id; state.drogheShowForm=true; renderMain(); };
    var delBtn=document.createElement('button');
    delBtn.style.cssText='background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.4);color:#ff8080;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
    delBtn.textContent='✕';
    delBtn.onclick=function(){ if(confirm('Eliminare '+( d.nome||'questa sostanza')+'?')){ state.droghe=(state.droghe||[]).filter(function(x){return x.id!==d.id;}); fbSaveDroghe(); renderMain(); } };
    actions.appendChild(editBtn); actions.appendChild(delBtn);
    foot.appendChild(actions);
  }
  card.appendChild(foot);
  card.classList.add('sium-grid-card-enter');
  card.style.cursor = 'pointer';
  card.onclick = function(ev) {
    if (ev.target && ev.target.closest && ev.target.closest('button')) return;
    if (window.SiumAnimations) {
      if (window.SiumAnimations.triggerCardClickPulse) window.SiumAnimations.triggerCardClickPulse(card, '#7fff7f');
      if (window.SiumAnimations.openEmporioSubItemModal) window.SiumAnimations.openEmporioSubItemModal('Sostanza Alchemica / Droga', d, '#7fff7f');
    }
  };
  return card;
}

function renderDrogaForm(ACCENT) {
  var editing=null;
  if (state.drogheEditingId) (state.droghe||[]).forEach(function(x){ if(x.id===state.drogheEditingId) editing=x; });
  var form={nome:editing?editing.nome:'',descrizione:editing?editing.descrizione:'',tsDipendenza:editing?editing.tsDipendenza:'',costo:editing?editing.costo:0,valuta:editing?editing.valuta:'mo',immagine:editing?editing.immagine:''};

  var backdrop=document.createElement('div');
  backdrop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick=function(e){ if(e.target===backdrop){ state.drogheShowForm=false; state.drogheEditingId=null; renderMain(); } };

  var panel=document.createElement('div');
  panel.style.cssText='background:#030d03;border:2px solid rgba(127,255,127,0.4);padding:0;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick=function(e){ e.stopPropagation(); };

  var mhead=document.createElement('div');
  mhead.style.cssText='padding:1rem 1.5rem;border-bottom:1px solid rgba(127,255,127,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML='<div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:#7fff7f;letter-spacing:0.1em;">'+(editing?'✎ MODIFICA SOSTANZA':'+ NUOVA SOSTANZA')+'</div>';
  var closeB=document.createElement('button');
  closeB.style.cssText='background:none;border:none;color:#7fff7f;font-size:20px;cursor:pointer;';
  closeB.textContent='✕';
  closeB.onclick=function(){ state.drogheShowForm=false; state.drogheEditingId=null; renderMain(); };
  mhead.appendChild(closeB); panel.appendChild(mhead);

  var mbody=document.createElement('div');
  mbody.style.cssText='padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';

  function dField(lbl,key,type,opts){
    var g=document.createElement('div');
    var l=document.createElement('label');
    l.style.cssText='display:block;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#50c850;margin-bottom:0.3rem;';
    l.textContent='// '+lbl;
    g.appendChild(l);
    var el;
    var fStyle='width:100%;background:rgba(127,255,127,0.05);border:1px solid rgba(127,255,127,0.3);color:#b8ffb8;font-family:\'Courier New\',monospace;font-size:15px;padding:0.55rem 0.75rem;outline:none;box-sizing:border-box;';
    if (type==='select') {
      el=document.createElement('select'); el.style.cssText=fStyle;
      (opts||[]).forEach(function(o){ var opt=document.createElement('option'); opt.value=o; opt.textContent=o; if(form[key]===o) opt.selected=true; el.appendChild(opt); });
    } else if (type==='textarea') {
      el=document.createElement('textarea'); el.style.cssText=fStyle+'resize:vertical;'; el.rows=3; el.value=form[key];
    } else {
      el=document.createElement('input'); el.type=type||'text'; el.style.cssText=fStyle; el.value=form[key];
    }
    el.onchange=el.oninput=function(){ form[key]=type==='number'?(Number(this.value)||0):this.value; };
    g.appendChild(el); return g;
  }

  mbody.appendChild(dField('NOME SOSTANZA','nome','text'));
  mbody.appendChild(dField('DESCRIZIONE','descrizione','textarea'));
  mbody.appendChild(dField('TS CONTRO DIPENDENZA (es. CD 12 Costituzione)','tsDipendenza','text'));
  var r3=document.createElement('div'); r3.style.cssText='display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  r3.appendChild(dField('PREZZO','costo','number'));
  r3.appendChild(dField('VALUTA','valuta','select',VALUTE.map(function(v){return v.code;})));
  mbody.appendChild(r3);
  mbody.appendChild(dField('URL IMMAGINE','immagine','text'));

  var saveBtn=document.createElement('button');
  saveBtn.style.cssText='width:100%;background:rgba(127,255,127,0.12);border:2px solid #7fff7f;color:#7fff7f;font-family:\'Courier New\',monospace;font-size:15px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;';
  saveBtn.textContent=editing?'> SALVA MODIFICHE':'> AGGIUNGI AL DATABASE';
  saveBtn.onclick=function(){
    if(!form.nome.trim()){ notify('Inserisci il nome della sostanza.','err'); return; }
    if(editing){
      state.droghe=(state.droghe||[]).map(function(x){ return x.id===editing.id?Object.assign({},form,{id:editing.id}):x; });
    } else {
      if(!state.droghe) state.droghe=[];
      state.droghe.push(Object.assign({},form,{id:'dr_'+Date.now()}));
    }
    fbSaveDroghe();
    notify(editing?'Sostanza aggiornata.':'Sostanza aggiunta al database.');
    state.drogheShowForm=false; state.drogheEditingId=null; renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}

// ============================================================
// SEZIONE VEICOLI
// ============================================================
var TIPI_VEICOLO = ['Terrestre','Acquatico','Aereo','Spaziale','Altro'];

/* ---- helpers immagini veicoli ---- */
function _vehicleImages(v) {
  if (v.immagini && v.immagini.length > 0) return v.immagini;
  if (v.immagine) return [v.immagine];
  return [];
}

function _buildVehicleCarousel(immagini) {
  if (!immagini || immagini.length === 0) return null;
  var idx = 0;
  var outerWrap = document.createElement('div');
  outerWrap.style.cssText = 'position:relative;width:100%;background:#0d0800;border-bottom:1px solid rgba(245,166,35,0.2);';
  var imgEl = document.createElement('img');
  imgEl.alt = ''; imgEl.style.cssText = 'width:100%;height:200px;object-fit:cover;display:block;transition:opacity 0.15s;';
  imgEl.src = immagini[0];
  imgEl.onerror = function(){ this.style.display='none'; };
  outerWrap.appendChild(imgEl);
  if (immagini.length > 1) {
    var counter = document.createElement('div');
    counter.style.cssText = 'position:absolute;top:7px;right:8px;background:rgba(0,0,0,0.72);color:#f5a623;font-family:\'Courier New\',monospace;font-size:11px;font-weight:700;padding:0.15rem 0.45rem;border:1px solid rgba(245,166,35,0.5);pointer-events:none;';
    counter.textContent = '1 / '+immagini.length;
    function goTo(i) {
      idx = ((i % immagini.length) + immagini.length) % immagini.length;
      imgEl.style.opacity = '0';
      setTimeout(function(){ imgEl.src = immagini[idx]; imgEl.style.opacity = '1'; }, 130);
      counter.textContent = (idx+1)+' / '+immagini.length;
    }
    var prev = document.createElement('button');
    prev.style.cssText = 'position:absolute;left:0;top:0;height:100%;width:36px;background:rgba(0,0,0,0.45);border:none;color:#f5a623;font-size:22px;font-weight:900;cursor:pointer;line-height:1;';
    prev.textContent = '‹'; prev.onclick = function(e){ e.stopPropagation(); goTo(idx-1); };
    var next = document.createElement('button');
    next.style.cssText = 'position:absolute;right:0;top:0;height:100%;width:36px;background:rgba(0,0,0,0.45);border:none;color:#f5a623;font-size:22px;font-weight:900;cursor:pointer;line-height:1;';
    next.textContent = '›'; next.onclick = function(e){ e.stopPropagation(); goTo(idx+1); };
    outerWrap.appendChild(prev); outerWrap.appendChild(next); outerWrap.appendChild(counter);
  }
  return outerWrap;
}

function _buildVehicleImageEditor(form, ACCENT) {
  var wrap = document.createElement('div');
  var lbl = document.createElement('div');
  lbl.style.cssText = 'font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-bottom:0.5rem;';
  lbl.textContent = '// IMMAGINI';
  wrap.appendChild(lbl);
  var thumbsWrap = document.createElement('div');
  thumbsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.65rem;min-height:36px;';
  function refreshThumbs() {
    thumbsWrap.innerHTML = '';
    var imgs = form.immagini || [];
    if (imgs.length === 0) {
      var none = document.createElement('div');
      none.style.cssText = 'color:rgba(245,166,35,0.32);font-size:12px;padding:0.25rem 0;font-family:\'Courier New\',monospace;';
      none.textContent = '// nessuna immagine';
      thumbsWrap.appendChild(none);
    } else {
      imgs.forEach(function(src, i) {
        var t = document.createElement('div');
        t.style.cssText = 'position:relative;width:72px;height:72px;border:1px solid rgba(245,166,35,0.4);overflow:hidden;flex-shrink:0;background:#111;';
        var im = document.createElement('img'); im.src = src; im.alt = '';
        im.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        im.onerror = function(){ im.style.display='none'; t.style.background='rgba(245,166,35,0.08)'; };
        var del = document.createElement('button');
        del.style.cssText = 'position:absolute;top:1px;right:1px;background:rgba(180,20,20,0.88);border:none;color:#fff;font-size:10px;width:17px;height:17px;cursor:pointer;padding:0;line-height:1;font-weight:700;';
        del.textContent = '✕';
        (function(ii){ del.onclick = function(){ form.immagini.splice(ii,1); refreshThumbs(); }; })(i);
        t.appendChild(im); t.appendChild(del); thumbsWrap.appendChild(t);
      });
    }
  }
  refreshThumbs();
  wrap.appendChild(thumbsWrap);
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;';
  var fileBtn = document.createElement('button'); fileBtn.type='button';
  fileBtn.style.cssText = 'background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.45);color:#f5a623;font-family:\'Courier New\',monospace;font-size:12px;font-weight:700;padding:0.35rem 0.75rem;cursor:pointer;';
  fileBtn.textContent = '📁 Carica dal computer';
  var fileInput = document.createElement('input'); fileInput.type='file'; fileInput.accept='image/*'; fileInput.multiple=true; fileInput.style.display='none';
  fileInput.onchange = function(){
    var files = Array.prototype.slice.call(this.files);
    var remaining = files.length;
    files.forEach(function(file){
      var reader = new FileReader();
      reader.onload = function(ev){
        var img = new Image();
        img.onload = function(){
          var MAX=900, ratio=Math.min(MAX/img.width,MAX/img.height,1);
          var canvas=document.createElement('canvas');
          canvas.width=Math.round(img.width*ratio); canvas.height=Math.round(img.height*ratio);
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
          if(!form.immagini) form.immagini=[];
          form.immagini.push(canvas.toDataURL('image/jpeg',0.78));
          remaining--;
          if(remaining<=0) refreshThumbs();
        };
        img.src=ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    fileInput.value='';
  };
  fileBtn.onclick=function(){ fileInput.click(); };
  btnRow.appendChild(fileBtn); btnRow.appendChild(fileInput);
  wrap.appendChild(btnRow);
  var urlRow = document.createElement('div');
  urlRow.style.cssText = 'display:flex;gap:0.4rem;';
  var urlInput = document.createElement('input'); urlInput.type='text'; urlInput.placeholder='> URL immagine diretta...';
  urlInput.style.cssText = 'flex:1;background:rgba(245,166,35,0.04);border:1px solid rgba(245,166,35,0.25);color:#ffd080;font-family:\'Courier New\',monospace;font-size:13px;padding:0.4rem 0.6rem;outline:none;';
  var urlBtn = document.createElement('button'); urlBtn.type='button';
  urlBtn.style.cssText = 'background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.35);color:#f5a623;font-family:\'Courier New\',monospace;font-size:12px;font-weight:700;padding:0.4rem 0.7rem;cursor:pointer;white-space:nowrap;';
  urlBtn.textContent = '+ Aggiungi URL';
  urlBtn.onclick = function(){
    var url = urlInput.value.trim(); if(!url) return;
    if(!form.immagini) form.immagini=[];
    form.immagini.push(url); urlInput.value=''; refreshThumbs();
  };
  urlRow.appendChild(urlInput); urlRow.appendChild(urlBtn);
  wrap.appendChild(urlRow);
  return wrap;
}
/* ---------------------------------- */

function renderEmporioVeicoli() {
  var ACCENT = '#f5a623';
  var wrap = document.createElement('div');
  wrap.style.cssText = 'background:#0d0800;min-height:100vh;font-family:\'Courier New\',monospace;color:'+ACCENT+';';

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'background:linear-gradient(180deg,rgba(25,12,0,0.98),rgba(13,8,0,0.95));border-bottom:2px solid rgba(245,166,35,0.3);padding:1.5rem 2rem 0;';
  var hdrRow = document.createElement('div');
  hdrRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;padding-bottom:1rem;';
  var hdrLeft = document.createElement('div');
  hdrLeft.innerHTML = '<div style="font-size:15px;font-weight:700;letter-spacing:0.15em;color:'+ACCENT+';margin-bottom:0.4rem;">// EMPORIO — GARAGE &amp; HANGAR //</div>' +
    '<div style="font-family:\'Cinzel\',serif;font-size:2rem;font-weight:900;letter-spacing:0.3em;color:'+ACCENT+';">▶ VEICOLI</div>';
  var hdrRight = document.createElement('div');
  hdrRight.style.cssText = 'display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;';
  if (isAdmin() && state.veicoliTab === 'catalogo') {
    var addBtn = document.createElement('button');
    addBtn.style.cssText = 'background:rgba(245,166,35,0.12);border:2px solid '+ACCENT+';color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.55rem 1.2rem;cursor:pointer;text-transform:uppercase;';
    addBtn.textContent = '+ NUOVO VEICOLO';
    addBtn.onclick = function(){ state.veicoliShowForm=true; state.veicoliEditingId=null; renderMain(); };
    hdrRight.appendChild(addBtn);
  }
  if (isAdmin() && state.veicoliTab === 'party') {
    var addPartyBtn = document.createElement('button');
    addPartyBtn.style.cssText = 'background:rgba(245,166,35,0.12);border:2px solid '+ACCENT+';color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.55rem 1.2rem;cursor:pointer;text-transform:uppercase;';
    addPartyBtn.textContent = '+ AGGIUNGI VEICOLO PARTY';
    addPartyBtn.onclick = function(){ state.veicoliPartyShowForm=true; state.veicoliPartyEditingId=null; renderMain(); };
    hdrRight.appendChild(addPartyBtn);
  }
  var backBtn = document.createElement('button');
  backBtn.style.cssText = 'background:rgba(245,166,35,0.08);border:2px solid rgba(245,166,35,0.5);color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.5rem 1.2rem;cursor:pointer;text-transform:uppercase;';
  backBtn.innerHTML = '← TORNA EMPORIO';
  backBtn.onclick = function(){ state.emporioTab='normale'; renderMain(); };
  hdrRight.appendChild(backBtn);
  hdrRow.appendChild(hdrLeft); hdrRow.appendChild(hdrRight);
  hdr.appendChild(hdrRow);

  // Tab bar
  var tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;border-top:1px solid rgba(245,166,35,0.2);';
  [{id:'catalogo',label:'🚗 Catalogo'},{id:'party',label:'⚙ Veicoli del Party'}].forEach(function(t) {
    var tb = document.createElement('button');
    var active = state.veicoliTab === t.id;
    tb.style.cssText = 'padding:0.65rem 1.5rem;background:transparent;border:none;border-bottom:2px solid '+(active?ACCENT:'transparent')+';color:'+(active?ACCENT:'rgba(245,166,35,0.45)')+';font-family:\'Courier New\',monospace;font-size:13px;font-weight:700;letter-spacing:0.1em;cursor:pointer;text-transform:uppercase;';
    tb.textContent = t.label;
    if (!active) tb.onclick = function(){ state.veicoliTab = t.id; renderMain(); };
    tabBar.appendChild(tb);
  });
  hdr.appendChild(tabBar);
  wrap.appendChild(hdr);

  // Tipo filter
  var filterBar = document.createElement('div');
  filterBar.style.cssText = 'padding:0.75rem 2rem;display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;border-bottom:1px solid rgba(245,166,35,0.1);';
  var filterLbl = document.createElement('span');
  filterLbl.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:0.15em;color:rgba(245,166,35,0.45);margin-right:0.25rem;';
  filterLbl.textContent = 'TIPO:';
  filterBar.appendChild(filterLbl);
  var tipoOptions = [''].concat(TIPI_VEICOLO);
  tipoOptions.forEach(function(tipo) {
    var btn = document.createElement('button');
    var active = state.veicoliFilterTipo === tipo;
    btn.style.cssText = 'background:'+(active?'rgba(245,166,35,0.2)':'rgba(245,166,35,0.04)')+';border:1px solid '+(active?ACCENT:'rgba(245,166,35,0.25)')+';color:'+(active?ACCENT:'rgba(245,166,35,0.6)')+';font-family:\'Courier New\',monospace;font-size:12px;padding:0.25rem 0.75rem;cursor:pointer;letter-spacing:0.08em;';
    btn.textContent = tipo || 'Tutti';
    btn.onclick = function(){ state.veicoliFilterTipo = tipo; renderMain(); };
    filterBar.appendChild(btn);
  });
  wrap.appendChild(filterBar);

  if (state.veicoliTab === 'catalogo') {
    // Search
    var srchWrap = document.createElement('div');
    srchWrap.style.cssText = 'padding:1rem 2rem 0.5rem;';
    var srch = document.createElement('input');
    srch.type='text'; srch.placeholder='> RICERCA CATALOGO VEICOLI...';
    srch.id='srch-veicoli';
    srch.value=state.veicoliSearch||'';
    srch.style.cssText='width:100%;box-sizing:border-box;background:rgba(245,166,35,0.04);border:1px solid rgba(245,166,35,0.3);color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;padding:0.6rem 1rem;outline:none;';
    srch.oninput=function(){ state.veicoliSearch=this.value; renderMain(); var f=document.getElementById('srch-veicoli'); if(f){f.focus();var l=f.value.length;f.setSelectionRange(l,l);} };
    srchWrap.appendChild(srch);
    wrap.appendChild(srchWrap);

    var all = (state.veicoli||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'','it');});
    var q=(state.veicoliSearch||'').toLowerCase();
    var ft=state.veicoliFilterTipo;
    var filtered = all.filter(function(v){
      if (ft && (v.tipo||'') !== ft) return false;
      if (q && !(v.nome||'').toLowerCase().includes(q) && !(v.tipo||'').toLowerCase().includes(q) && !(v.descrizione||'').toLowerCase().includes(q)) return false;
      return true;
    });

    var counter = document.createElement('div');
    counter.style.cssText='padding:0.4rem 2rem 0;font-size:12px;color:rgba(245,166,35,0.45);letter-spacing:0.15em;';
    counter.textContent='// '+filtered.length+' VEICOLI NEL CATALOGO';
    wrap.appendChild(counter);

    if (filtered.length===0) {
      var empty=document.createElement('div');
      empty.style.cssText='text-align:center;padding:4rem 2rem;color:rgba(245,166,35,0.3);font-size:16px;letter-spacing:0.1em;';
      empty.innerHTML='🚗<br><br>NESSUN VEICOLO'+(isDM()?'<div style="margin-top:1rem;font-size:14px;">> aggiungi il primo veicolo per iniziare</div>':'');
      wrap.appendChild(empty);
    } else {
      var grid=document.createElement('div');
      grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem;padding:1.5rem 2rem;';
      filtered.forEach(function(v){ grid.appendChild(renderVeicoloCard(v, false)); });
      wrap.appendChild(grid);
    }
    if (state.veicoliShowForm) wrap.appendChild(renderVeicoloForm());

  } else {
    // Party tab
    var srchWrap2 = document.createElement('div');
    srchWrap2.style.cssText = 'padding:1rem 2rem 0.5rem;';
    var srch2 = document.createElement('input');
    srch2.type='text'; srch2.placeholder='> RICERCA VEICOLI DEL PARTY...';
    srch2.value=state.veicoliPartySearch||'';
    srch2.style.cssText='width:100%;box-sizing:border-box;background:rgba(245,166,35,0.04);border:1px solid rgba(245,166,35,0.3);color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;padding:0.6rem 1rem;outline:none;';
    srch2.oninput=function(){ state.veicoliPartySearch=this.value; renderMain(); };
    srchWrap2.appendChild(srch2);
    wrap.appendChild(srchWrap2);

    var allP = (state.veicoliParty||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'','it');});
    var qP=(state.veicoliPartySearch||'').toLowerCase();
    var ftP=state.veicoliFilterTipo;
    var filteredP = allP.filter(function(v){
      if (ftP && (v.tipo||'') !== ftP) return false;
      if (qP && !(v.nome||'').toLowerCase().includes(qP) && !(v.tipo||'').toLowerCase().includes(qP) && !(v.descrizione||'').toLowerCase().includes(qP)) return false;
      return true;
    });

    var counter2 = document.createElement('div');
    counter2.style.cssText='padding:0.4rem 2rem 0;font-size:12px;color:rgba(245,166,35,0.45);letter-spacing:0.15em;';
    counter2.textContent='// '+filteredP.length+' VEICOLI DEL PARTY';
    wrap.appendChild(counter2);

    if (filteredP.length===0) {
      var empty2=document.createElement('div');
      empty2.style.cssText='text-align:center;padding:4rem 2rem;color:rgba(245,166,35,0.3);font-size:16px;letter-spacing:0.1em;';
      empty2.innerHTML='⚙<br><br>NESSUN VEICOLO NEL PARTY'+(isDM()?'<div style="margin-top:1rem;font-size:14px;">> aggiungi dal catalogo o usa "+ AGGIUNGI VEICOLO PARTY"</div>':'');
      wrap.appendChild(empty2);
    } else {
      var grid2=document.createElement('div');
      grid2.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem;padding:1.5rem 2rem;';
      filteredP.forEach(function(v){ grid2.appendChild(renderVeicoloCard(v, true)); });
      wrap.appendChild(grid2);
    }
    if (state.veicoliPartyShowForm) wrap.appendChild(renderVeicoloPartyForm());
  }

  return wrap;
}

function renderVeicoloCard(v, isParty) {
  var ACCENT='#f5a623';
  var card=document.createElement('div');
  card.style.cssText='background:linear-gradient(135deg,rgba(30,15,0,0.95),rgba(15,8,0,0.95));border:2px solid '+(isParty?'rgba(245,166,35,0.5)':'rgba(245,166,35,0.3)')+';overflow:hidden;transition:border-color 0.2s,transform 0.2s;';
  card.onmouseenter=function(){ this.style.borderColor='rgba(245,166,35,0.7)'; this.style.transform='translateY(-3px)'; };
  card.onmouseleave=function(){ this.style.borderColor=isParty?'rgba(245,166,35,0.5)':'rgba(245,166,35,0.3)'; this.style.transform=''; };

  var _vImgs = _vehicleImages(v);
  if (_vImgs.length > 0) { var _carousel = _buildVehicleCarousel(_vImgs); if (_carousel) card.appendChild(_carousel); }

  var head=document.createElement('div');
  head.style.cssText='padding:1rem 1.2rem 0.6rem;border-bottom:1px solid rgba(245,166,35,0.15);display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;';
  var nameCol=document.createElement('div');
  if (v.tipo) {
    var tipoTag=document.createElement('div');
    tipoTag.style.cssText='font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#f5a623;border:1px solid rgba(245,166,35,0.4);padding:0.2rem 0.5rem;display:inline-block;margin-bottom:0.4rem;';
    tipoTag.textContent=v.tipo;
    nameCol.appendChild(tipoTag);
  }
  var nameDiv=document.createElement('div');
  nameDiv.style.cssText='font-family:\'Cinzel\',serif;font-size:20px;font-weight:700;color:#f5a623;line-height:1.2;';
  nameDiv.textContent=v.nome||'Senza nome';
  nameCol.appendChild(nameDiv);
  head.appendChild(nameCol);
  card.appendChild(head);

  var body=document.createElement('div');
  body.style.cssText='padding:0.8rem 1.2rem;';
  if (v.velocita) body.innerHTML+='<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-top:0.5rem;margin-bottom:0.25rem;">// VELOCITÀ</div><div style="font-size:16px;color:#ffd080;line-height:1.5;">'+nl2br(escapeHtml(v.velocita))+'</div>';
  if (v.capacita) body.innerHTML+='<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-top:0.7rem;margin-bottom:0.25rem;">// CAPACITÀ</div><div style="font-size:16px;color:#ffd080;">'+nl2br(escapeHtml(v.capacita))+'</div>';
  if (v.pf) body.innerHTML+='<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-top:0.7rem;margin-bottom:0.25rem;">// PF</div><div style="font-size:16px;color:#ffd080;">'+escapeHtml(v.pf)+'</div>';
  var _hasStats = v.stFor||v.stDes||v.stCos||v.stInt||v.stSag||v.stCar;
  if (_hasStats) {
    function _statMod(val){var n=parseInt(val)||10;return (n>=10?'+':'')+Math.floor((n-10)/2);}
    body.innerHTML+='<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-top:0.7rem;margin-bottom:0.4rem;">// STATISTICHE</div>';
    var statsRow=document.createElement('div'); statsRow.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:4px;text-align:center;';
    [['FOR',v.stFor],['DES',v.stDes],['COS',v.stCos],['INT',v.stInt],['SAG',v.stSag],['CAR',v.stCar]].forEach(function(st){
      var cell=document.createElement('div'); cell.style.cssText='border:1px solid rgba(245,166,35,0.25);padding:4px 2px;';
      cell.innerHTML='<div style="font-size:9px;font-weight:700;color:#c87d10;letter-spacing:0.08em;">'+st[0]+'</div>'
        +'<div style="font-size:15px;font-weight:700;color:#ffd080;">'+(st[1]||'—')+'</div>'
        +(st[1]?'<div style="font-size:10px;color:rgba(255,208,128,0.6);">'+_statMod(st[1])+'</div>':'');
      statsRow.appendChild(cell);
    });
    body.appendChild(statsRow);
  }
  if (v.descrizione) body.innerHTML+='<div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-top:0.7rem;margin-bottom:0.25rem;">// DESCRIZIONE</div><div style="font-size:14px;color:#e8c070;line-height:1.5;">'+nl2br(escapeHtml(v.descrizione))+'</div>';
  var _vs = _textScore(v.velocita, v.capacita, v.descrizione);
  if (_vs > 500) card.classList.add('card--wide');
  if (_vs > 1100) { body.style.maxHeight='480px'; body.style.overflowY='auto'; }
  card.appendChild(body);

  var foot=document.createElement('div');
  foot.style.cssText='padding:0.6rem 1.2rem;border-top:1px solid rgba(245,166,35,0.12);background:rgba(10,5,0,0.4);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;';
  var price=document.createElement('div');
  price.style.cssText='font-size:17px;font-weight:700;color:#f5a623;';
  price.textContent=v.costo ? v.costo+' '+(v.valuta||'mo') : '— PREZZO N/D';
  foot.appendChild(price);
  if (isParty) {
    var actions=document.createElement('div'); actions.style.cssText='display:flex;gap:0.4rem;';
    if (isAdmin()) {
      var editBtn=document.createElement('button');
      editBtn.style.cssText='background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.4);color:#f5a623;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
      editBtn.textContent='✎';
      editBtn.onclick=function(){ state.veicoliPartyEditingId=v.id; state.veicoliPartyShowForm=true; renderMain(); };
      var delBtn=document.createElement('button');
      delBtn.style.cssText='background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.4);color:#ff8080;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
      delBtn.textContent='✕';
      delBtn.onclick=function(){ if(confirm('Rimuovere '+(v.nome||'questo veicolo')+' dal party?')){ state.veicoliParty=(state.veicoliParty||[]).filter(function(x){return x.id!==v.id;}); fbSaveVeicoliParty(); renderMain(); } };
      actions.appendChild(editBtn); actions.appendChild(delBtn);
    }
    foot.appendChild(actions);
  } else {
    var actions2=document.createElement('div'); actions2.style.cssText='display:flex;gap:0.4rem;flex-wrap:wrap;';
    if (isAdmin()) {
      var addParty=document.createElement('button');
      addParty.style.cssText='background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.35);color:#f5a623;font-size:11px;font-weight:700;letter-spacing:0.06em;padding:0.3rem 0.6rem;cursor:pointer;text-transform:uppercase;';
      addParty.textContent='+ Party';
      addParty.title='Aggiungi al Party';
      addParty.onclick=function(){
        var copy=Object.assign({},v,{id:'vp_'+Date.now()+'_'+Math.floor(Math.random()*9999)});
        if(!state.veicoliParty) state.veicoliParty=[];
        state.veicoliParty.push(copy);
        fbSaveVeicoliParty();
        notify('Veicolo aggiunto al Party!');
      };
      var editBtn2=document.createElement('button');
      editBtn2.style.cssText='background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.4);color:#f5a623;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
      editBtn2.textContent='✎';
      editBtn2.onclick=function(){ state.veicoliEditingId=v.id; state.veicoliShowForm=true; renderMain(); };
      var delBtn2=document.createElement('button');
      delBtn2.style.cssText='background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.4);color:#ff8080;font-size:13px;padding:0.3rem 0.6rem;cursor:pointer;';
      delBtn2.textContent='✕';
      delBtn2.onclick=function(){ if(confirm('Eliminare '+(v.nome||'questo veicolo')+' dal catalogo?')){ state.veicoli=(state.veicoli||[]).filter(function(x){return x.id!==v.id;}); fbSaveVeicoli(); renderMain(); } };
      actions2.appendChild(addParty); actions2.appendChild(editBtn2); actions2.appendChild(delBtn2);
    }
    foot.appendChild(actions2);
  }
  card.appendChild(foot);
  card.classList.add('sium-grid-card-enter');
  card.style.cursor = 'pointer';
  card.onclick = function(ev) {
    if (ev.target && ev.target.closest && ev.target.closest('button')) return;
    if (window.SiumAnimations) {
      if (window.SiumAnimations.triggerCardClickPulse) window.SiumAnimations.triggerCardClickPulse(card, '#f5a623');
      if (window.SiumAnimations.openEmporioSubItemModal) window.SiumAnimations.openEmporioSubItemModal(isParty ? 'Veicolo del Party' : 'Catalogo Veicoli', v, '#f5a623');
    }
  };
  return card;
}

function renderVeicoloForm() {
  var editing=null;
  if (state.veicoliEditingId) (state.veicoli||[]).forEach(function(x){ if(x.id===state.veicoliEditingId) editing=x; });
  var _eImgs = editing ? (editing.immagini && editing.immagini.length ? editing.immagini.slice() : (editing.immagine ? [editing.immagine] : [])) : [];
  var form={nome:editing?editing.nome:'',tipo:editing?editing.tipo:TIPI_VEICOLO[0],pf:editing?editing.pf:'',costo:editing?editing.costo:0,valuta:editing?editing.valuta:'mo',velocita:editing?editing.velocita:'',capacita:editing?editing.capacita:'',descrizione:editing?editing.descrizione:'',immagini:_eImgs,stFor:editing?editing.stFor:'',stDes:editing?editing.stDes:'',stCos:editing?editing.stCos:'',stInt:editing?editing.stInt:'',stSag:editing?editing.stSag:'',stCar:editing?editing.stCar:''};

  var backdrop=document.createElement('div');
  backdrop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick=function(e){ if(e.target===backdrop){ state.veicoliShowForm=false; state.veicoliEditingId=null; renderMain(); } };

  var panel=document.createElement('div');
  panel.style.cssText='background:#0d0800;border:2px solid rgba(245,166,35,0.4);padding:0;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick=function(e){ e.stopPropagation(); };

  var mhead=document.createElement('div');
  mhead.style.cssText='padding:1rem 1.5rem;border-bottom:1px solid rgba(245,166,35,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML='<div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:#f5a623;letter-spacing:0.1em;">'+(editing?'✎ MODIFICA VEICOLO':'+ NUOVO VEICOLO')+'</div>';
  var closeB=document.createElement('button');
  closeB.style.cssText='background:none;border:none;color:#f5a623;font-size:20px;cursor:pointer;';
  closeB.textContent='✕';
  closeB.onclick=function(){ state.veicoliShowForm=false; state.veicoliEditingId=null; renderMain(); };
  mhead.appendChild(closeB); panel.appendChild(mhead);

  var mbody=document.createElement('div');
  mbody.style.cssText='padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';

  function vField(lbl,key,type,opts){
    var g=document.createElement('div');
    var l=document.createElement('label');
    l.style.cssText='display:block;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-bottom:0.3rem;';
    l.textContent='// '+lbl;
    g.appendChild(l);
    var el;
    var fStyle='width:100%;background:rgba(245,166,35,0.05);border:1px solid rgba(245,166,35,0.3);color:#ffd080;font-family:\'Courier New\',monospace;font-size:15px;padding:0.55rem 0.75rem;outline:none;box-sizing:border-box;';
    if (type==='select') {
      el=document.createElement('select'); el.style.cssText=fStyle;
      (opts||[]).forEach(function(o){ var opt=document.createElement('option'); opt.value=o; opt.textContent=o; if(form[key]===o) opt.selected=true; el.appendChild(opt); });
    } else if (type==='textarea') {
      el=document.createElement('textarea'); el.style.cssText=fStyle+'resize:vertical;'; el.rows=3; el.value=form[key];
    } else {
      el=document.createElement('input'); el.type=type||'text'; el.style.cssText=fStyle; el.value=form[key];
    }
    el.onchange=el.oninput=function(){ form[key]=type==='number'?(Number(this.value)||0):this.value; };
    g.appendChild(el); return g;
  }

  mbody.appendChild(vField('NOME VEICOLO','nome','text'));
  mbody.appendChild(vField('TIPO','tipo','select',TIPI_VEICOLO));
  var r2=document.createElement('div'); r2.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;';
  r2.appendChild(vField('VELOCITÀ','velocita','text'));
  r2.appendChild(vField('CAPACITÀ','capacita','text'));
  r2.appendChild(vField('PF (Punti Ferita)','pf','text'));
  mbody.appendChild(r2);
  var rStats=document.createElement('div');
  var statsLbl=document.createElement('div'); statsLbl.style.cssText='font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-bottom:0.4rem;'; statsLbl.textContent='// STATISTICHE (opzionale)';
  rStats.appendChild(statsLbl);
  var statsGrid=document.createElement('div'); statsGrid.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;';
  [['FOR','stFor'],['DES','stDes'],['COS','stCos'],['INT','stInt'],['SAG','stSag'],['CAR','stCar']].forEach(function(st){
    var g=document.createElement('div'); g.style.cssText='text-align:center;';
    var l=document.createElement('div'); l.style.cssText='font-size:10px;font-weight:700;color:#c87d10;margin-bottom:0.2rem;'; l.textContent=st[0]; g.appendChild(l);
    var inp=document.createElement('input'); inp.type='number'; inp.min=1; inp.max=30; inp.value=form[st[1]]||''; inp.placeholder='—';
    inp.style.cssText='width:100%;text-align:center;background:rgba(245,166,35,0.05);border:1px solid rgba(245,166,35,0.3);color:#ffd080;font-family:\'Courier New\',monospace;font-size:15px;padding:0.4rem 0.2rem;outline:none;box-sizing:border-box;';
    (function(k){inp.oninput=function(){form[k]=this.value?Number(this.value):'';};})(st[1]);
    g.appendChild(inp); statsGrid.appendChild(g);
  });
  rStats.appendChild(statsGrid); mbody.appendChild(rStats);
  var r3=document.createElement('div'); r3.style.cssText='display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  r3.appendChild(vField('COSTO','costo','number'));
  r3.appendChild(vField('VALUTA','valuta','select',VALUTE.map(function(v){return v.code;})));
  mbody.appendChild(r3);
  mbody.appendChild(vField('DESCRIZIONE','descrizione','textarea'));
  mbody.appendChild(_buildVehicleImageEditor(form, '#f5a623'));

  var saveBtn=document.createElement('button');
  saveBtn.style.cssText='width:100%;background:rgba(245,166,35,0.12);border:2px solid #f5a623;color:#f5a623;font-family:\'Courier New\',monospace;font-size:15px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;';
  saveBtn.textContent=editing?'> SALVA MODIFICHE':'> AGGIUNGI AL DATABASE';
  saveBtn.onclick=function(){
    if(!form.nome.trim()){ notify('Inserisci il nome del veicolo.','err'); return; }
    var saved=Object.assign({},form,{immagini:form.immagini||[]});
    delete saved.immagine;
    if(editing){
      state.veicoli=(state.veicoli||[]).map(function(x){ return x.id===editing.id?Object.assign({},saved,{id:editing.id}):x; });
    } else {
      if(!state.veicoli) state.veicoli=[];
      state.veicoli.push(Object.assign({},saved,{id:'ve_'+Date.now()}));
    }
    fbSaveVeicoli();
    notify(editing?'Veicolo aggiornato.':'Veicolo aggiunto al database.');
    state.veicoliShowForm=false; state.veicoliEditingId=null; renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}

function renderVeicoloPartyForm() {
  var editing=null;
  if (state.veicoliPartyEditingId) (state.veicoliParty||[]).forEach(function(x){ if(x.id===state.veicoliPartyEditingId) editing=x; });
  var _epImgs = editing ? (editing.immagini && editing.immagini.length ? editing.immagini.slice() : (editing.immagine ? [editing.immagine] : [])) : [];
  var form={nome:editing?editing.nome:'',tipo:editing?editing.tipo:TIPI_VEICOLO[0],pf:editing?editing.pf:'',costo:editing?editing.costo:0,valuta:editing?editing.valuta:'mo',velocita:editing?editing.velocita:'',capacita:editing?editing.capacita:'',descrizione:editing?editing.descrizione:'',immagini:_epImgs,stFor:editing?editing.stFor:'',stDes:editing?editing.stDes:'',stCos:editing?editing.stCos:'',stInt:editing?editing.stInt:'',stSag:editing?editing.stSag:'',stCar:editing?editing.stCar:''};

  var backdrop=document.createElement('div');
  backdrop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick=function(e){ if(e.target===backdrop){ state.veicoliPartyShowForm=false; state.veicoliPartyEditingId=null; renderMain(); } };

  var panel=document.createElement('div');
  panel.style.cssText='background:#0d0800;border:2px solid rgba(245,166,35,0.6);padding:0;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick=function(e){ e.stopPropagation(); };

  var mhead=document.createElement('div');
  mhead.style.cssText='padding:1rem 1.5rem;border-bottom:1px solid rgba(245,166,35,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML='<div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:#f5a623;letter-spacing:0.1em;">'+(editing?'✎ MODIFICA VEICOLO PARTY':'+ NUOVO VEICOLO PARTY')+'</div>';
  var closeB=document.createElement('button');
  closeB.style.cssText='background:none;border:none;color:#f5a623;font-size:20px;cursor:pointer;';
  closeB.textContent='✕';
  closeB.onclick=function(){ state.veicoliPartyShowForm=false; state.veicoliPartyEditingId=null; renderMain(); };
  mhead.appendChild(closeB); panel.appendChild(mhead);

  var mbody=document.createElement('div');
  mbody.style.cssText='padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';

  function vpField(lbl,key,type,opts){
    var g=document.createElement('div');
    var l=document.createElement('label');
    l.style.cssText='display:block;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-bottom:0.3rem;';
    l.textContent='// '+lbl;
    g.appendChild(l);
    var el;
    var fStyle='width:100%;background:rgba(245,166,35,0.05);border:1px solid rgba(245,166,35,0.3);color:#ffd080;font-family:\'Courier New\',monospace;font-size:15px;padding:0.55rem 0.75rem;outline:none;box-sizing:border-box;';
    if (type==='select') {
      el=document.createElement('select'); el.style.cssText=fStyle;
      (opts||[]).forEach(function(o){ var opt=document.createElement('option'); opt.value=o; opt.textContent=o; if(form[key]===o) opt.selected=true; el.appendChild(opt); });
    } else if (type==='textarea') {
      el=document.createElement('textarea'); el.style.cssText=fStyle+'resize:vertical;'; el.rows=3; el.value=form[key];
    } else {
      el=document.createElement('input'); el.type=type||'text'; el.style.cssText=fStyle; el.value=form[key];
    }
    el.onchange=el.oninput=function(){ form[key]=type==='number'?(Number(this.value)||0):this.value; };
    g.appendChild(el); return g;
  }

  mbody.appendChild(vpField('NOME VEICOLO','nome','text'));
  mbody.appendChild(vpField('TIPO','tipo','select',TIPI_VEICOLO));
  var r2=document.createElement('div'); r2.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;';
  r2.appendChild(vpField('VELOCITÀ','velocita','text'));
  r2.appendChild(vpField('CAPACITÀ','capacita','text'));
  r2.appendChild(vpField('PF (Punti Ferita)','pf','text'));
  mbody.appendChild(r2);
  var rStatsP=document.createElement('div');
  var statsLblP=document.createElement('div'); statsLblP.style.cssText='font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c87d10;margin-bottom:0.4rem;'; statsLblP.textContent='// STATISTICHE (opzionale)';
  rStatsP.appendChild(statsLblP);
  var statsGridP=document.createElement('div'); statsGridP.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;';
  [['FOR','stFor'],['DES','stDes'],['COS','stCos'],['INT','stInt'],['SAG','stSag'],['CAR','stCar']].forEach(function(st){
    var g=document.createElement('div'); g.style.cssText='text-align:center;';
    var l=document.createElement('div'); l.style.cssText='font-size:10px;font-weight:700;color:#c87d10;margin-bottom:0.2rem;'; l.textContent=st[0]; g.appendChild(l);
    var inp=document.createElement('input'); inp.type='number'; inp.min=1; inp.max=30; inp.value=form[st[1]]||''; inp.placeholder='—';
    inp.style.cssText='width:100%;text-align:center;background:rgba(245,166,35,0.05);border:1px solid rgba(245,166,35,0.3);color:#ffd080;font-family:\'Courier New\',monospace;font-size:15px;padding:0.4rem 0.2rem;outline:none;box-sizing:border-box;';
    (function(k){inp.oninput=function(){form[k]=this.value?Number(this.value):'';};})(st[1]);
    g.appendChild(inp); statsGridP.appendChild(g);
  });
  rStatsP.appendChild(statsGridP); mbody.appendChild(rStatsP);
  var r3=document.createElement('div'); r3.style.cssText='display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  r3.appendChild(vpField('COSTO','costo','number'));
  r3.appendChild(vpField('VALUTA','valuta','select',VALUTE.map(function(v){return v.code;})));
  mbody.appendChild(r3);
  mbody.appendChild(vpField('DESCRIZIONE','descrizione','textarea'));
  mbody.appendChild(_buildVehicleImageEditor(form, '#f5a623'));

  var saveBtn=document.createElement('button');
  saveBtn.style.cssText='width:100%;background:rgba(245,166,35,0.12);border:2px solid #f5a623;color:#f5a623;font-family:\'Courier New\',monospace;font-size:15px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;';
  saveBtn.textContent=editing?'> SALVA MODIFICHE':'> AGGIUNGI AL PARTY';
  saveBtn.onclick=function(){
    if(!form.nome.trim()){ notify('Inserisci il nome del veicolo.','err'); return; }
    var saved=Object.assign({},form,{immagini:form.immagini||[]});
    delete saved.immagine;
    if(!state.veicoliParty) state.veicoliParty=[];
    if(editing){
      state.veicoliParty=state.veicoliParty.map(function(x){ return x.id===editing.id?Object.assign({},saved,{id:editing.id}):x; });
    } else {
      state.veicoliParty.push(Object.assign({},saved,{id:'vp_'+Date.now()}));
    }
    fbSaveVeicoliParty();
    notify(editing?'Veicolo party aggiornato.':'Veicolo aggiunto al Party.');
    state.veicoliPartyShowForm=false; state.veicoliPartyEditingId=null; renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}

/* ============================================================
   ARMI DA FUOCO
   ============================================================ */
function renderEmporioArmiFuoco() {
  var ACCENT = '#e53030';
  /* SVG pistola realistica come placeholder */
  var GUN_SVG = '<svg viewBox="0 0 280 460" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">'
    +'<defs>'
      +'<radialGradient id="eg" cx="50%" cy="45%"><stop offset="0%" stop-color="#6d28d9" stop-opacity="0.55"/><stop offset="100%" stop-color="#6d28d9" stop-opacity="0"/></radialGradient>'
    +'</defs>'
    /* bg */
    +'<rect width="280" height="460" fill="#060b12"/>'
    /* particles */
    +'<circle cx="45" cy="80" r="1.1" fill="#00d4e8" opacity="0.5"/>'
    +'<circle cx="230" cy="60" r="1.3" fill="#00d4e8" opacity="0.55"/>'
    +'<circle cx="55" cy="210" r="0.9" fill="#00d4e8" opacity="0.35"/>'
    +'<circle cx="242" cy="185" r="1.1" fill="#00d4e8" opacity="0.4"/>'
    +'<circle cx="48" cy="330" r="1.2" fill="#00d4e8" opacity="0.3"/>'
    +'<circle cx="235" cy="310" r="0.9" fill="#00d4e8" opacity="0.4"/>'
    +'<circle cx="78" cy="390" r="1.1" fill="#8b5cf6" opacity="0.45"/>'
    +'<circle cx="205" cy="375" r="1.3" fill="#8b5cf6" opacity="0.4"/>'
    +'<circle cx="100" cy="140" r="0.8" fill="#00d4e8" opacity="0.3"/>'
    +'<circle cx="190" cy="250" r="0.8" fill="#8b5cf6" opacity="0.35"/>'
    /* constellation lines */
    +'<line x1="45" y1="80" x2="55" y2="210" stroke="#00d4e8" stroke-width="0.3" opacity="0.22"/>'
    +'<line x1="55" y1="210" x2="78" y2="390" stroke="#00d4e8" stroke-width="0.3" opacity="0.18"/>'
    +'<line x1="230" y1="60" x2="242" y2="185" stroke="#00d4e8" stroke-width="0.3" opacity="0.22"/>'
    +'<line x1="242" y1="185" x2="205" y2="375" stroke="#00d4e8" stroke-width="0.3" opacity="0.18"/>'
    +'<line x1="100" y1="140" x2="55" y2="210" stroke="#00d4e8" stroke-width="0.25" opacity="0.15"/>'
    +'<line x1="190" y1="250" x2="235" y2="310" stroke="#8b5cf6" stroke-width="0.25" opacity="0.18"/>'
    /* outer frame subtle */
    +'<rect x="20" y="20" width="240" height="400" fill="none" stroke="#00d4e8" stroke-width="0.7" opacity="0.35"/>'
    /* corner bracket TL */
    +'<path d="M20 68 L20 20 L68 20" fill="none" stroke="#00d4e8" stroke-width="2.2" opacity="0.95"/>'
    +'<rect x="20" y="20" width="7" height="7" fill="#00d4e8" opacity="0.7"/>'
    /* corner bracket TR */
    +'<path d="M260 68 L260 20 L212 20" fill="none" stroke="#00d4e8" stroke-width="2.2" opacity="0.95"/>'
    +'<rect x="253" y="20" width="7" height="7" fill="#00d4e8" opacity="0.7"/>'
    /* corner bracket BL */
    +'<path d="M20 372 L20 420 L68 420" fill="none" stroke="#00d4e8" stroke-width="2.2" opacity="0.95"/>'
    +'<rect x="20" y="413" width="7" height="7" fill="#00d4e8" opacity="0.7"/>'
    /* corner bracket BR */
    +'<path d="M260 372 L260 420 L212 420" fill="none" stroke="#00d4e8" stroke-width="2.2" opacity="0.95"/>'
    +'<rect x="253" y="413" width="7" height="7" fill="#00d4e8" opacity="0.7"/>'
    /* top labels */
    +'<text x="28" y="16" font-family="monospace" font-size="8.5" fill="#00d4e8" opacity="0.9" letter-spacing="1.5">MODEL AK.5G</text>'
    +'<text x="186" y="16" font-family="monospace" font-size="7" fill="#00d4e8" opacity="0.45">CONF:Z8LM5</text>'
    /* energy aura (glow behind rifle) */
    +'<ellipse cx="140" cy="220" rx="70" ry="105" fill="url(#eg)"/>'
    +'<ellipse cx="140" cy="220" rx="45" ry="68" fill="url(#eg)" opacity="0.7"/>'
    +'<ellipse cx="140" cy="220" rx="75" ry="115" fill="none" stroke="#8b5cf6" stroke-width="0.6" opacity="0.28"/>'
    +'<ellipse cx="140" cy="220" rx="52" ry="82" fill="none" stroke="#7c3aed" stroke-width="0.5" opacity="0.22"/>'
    /* ===== FUCILE D ASSALTO (verticale, canna in alto) ===== */
    /* soppressore / flash hider */
    +'<rect x="133" y="30" width="14" height="24" rx="3" fill="#131620" stroke="#1e2338" stroke-width="0.9"/>'
    +'<rect x="136" y="30" width="8" height="4" rx="1" fill="#090c16"/>'
    +'<rect x="136" y="38" width="8" height="4" rx="1" fill="#090c16"/>'
    +'<rect x="136" y="46" width="8" height="4" rx="1" fill="#090c16"/>'
    /* canna */
    +'<rect x="137" y="54" width="6" height="60" rx="1.5" fill="#1c2038"/>'
    /* gas tube (sottile, lungo la canna) */
    +'<rect x="139" y="56" width="2" height="48" rx="1" fill="#0d1028"/>'
    /* alzo anteriore */
    +'<rect x="130" y="110" width="20" height="7" rx="2" fill="#1e2235" stroke="#252848" stroke-width="0.6"/>'
    +'<rect x="139" y="103" width="2" height="10" rx="0.5" fill="#1e2235"/>'
    /* handguard */
    +'<rect x="128" y="117" width="24" height="76" rx="2.5" fill="#191d30" stroke="#222540" stroke-width="0.8"/>'
    +'<line x1="128" y1="127" x2="152" y2="127" stroke="#0d1025" stroke-width="1.3"/>'
    +'<line x1="128" y1="138" x2="152" y2="138" stroke="#0d1025" stroke-width="1.3"/>'
    +'<line x1="128" y1="149" x2="152" y2="149" stroke="#0d1025" stroke-width="1.3"/>'
    +'<line x1="128" y1="160" x2="152" y2="160" stroke="#0d1025" stroke-width="1.3"/>'
    +'<line x1="128" y1="171" x2="152" y2="171" stroke="#0d1025" stroke-width="1.3"/>'
    +'<line x1="128" y1="182" x2="152" y2="182" stroke="#0d1025" stroke-width="1.3"/>'
    /* attacco cannocchiale (picatinny rail top) */
    +'<rect x="128" y="117" width="24" height="4" rx="1" fill="#14182a"/>'
    /* upper receiver */
    +'<rect x="123" y="191" width="34" height="44" rx="3" fill="#1c2038" stroke="#242848" stroke-width="0.8"/>'
    /* alzo posteriore */
    +'<rect x="125" y="192" width="14" height="6" rx="1.5" fill="#252848"/>'
    /* sportellino espulsione */
    +'<rect x="151" y="198" width="5" height="20" rx="1" fill="#0d1020" stroke="#1e2235" stroke-width="0.5"/>'
    /* leva di armamento */
    +'<rect x="155" y="192" width="8" height="14" rx="2" fill="#141828" stroke="#1e2235" stroke-width="0.5"/>'
    /* lower receiver */
    +'<rect x="124" y="232" width="32" height="32" rx="2.5" fill="#161929" stroke="#20243a" stroke-width="0.8"/>'
    /* guardia grilletto */
    +'<path d="M139 248 Q144 268 158 268 L162 268 L162 238" fill="none" stroke="#252848" stroke-width="2.2"/>'
    /* grilletto */
    +'<rect x="142" y="235" width="3.5" height="16" rx="1.2" fill="#2a2e50"/>'
    /* caricatore */
    +'<path d="M130 258 L152 258 L154 318 Q152 330 140 330 Q128 330 126 318 Z" fill="#12162a" stroke="#1e2235" stroke-width="0.9"/>'
    +'<line x1="130" y1="274" x2="152" y2="274" stroke="#1c2038" stroke-width="0.6"/>'
    +'<line x1="129" y1="292" x2="151" y2="292" stroke="#1c2038" stroke-width="0.6"/>'
    /* impugnatura pistola */
    +'<path d="M154 238 L168 238 L170 294 Q168 306 161 308 Q154 308 152 298 L152 258 Z" fill="#111525" stroke="#1e2235" stroke-width="0.8"/>'
    /* calcio (buffer tube + stock) */
    +'<rect x="105" y="228" width="20" height="9" rx="4" fill="#181c2e" stroke="#20243a" stroke-width="0.7"/>'
    +'<rect x="82" y="224" width="26" height="16" rx="3.5" fill="#141828" stroke="#1e2235" stroke-width="0.8"/>'
    +'<rect x="77" y="226" width="9" height="22" rx="2.5" fill="#111522" stroke="#1e2235" stroke-width="0.7"/>'
    +'<rect x="86" y="234" width="13" height="18" rx="2" fill="#0f1320"/>'
    /* luce rossa LED stock */
    +'<circle cx="80" cy="246" r="1.2" fill="#e53030" opacity="0.7"/>'
    /* highlight cyan sottile sulla canna */
    +'<line x1="140" y1="54" x2="140" y2="114" stroke="#00d4e8" stroke-width="0.5" opacity="0.18"/>'
    /* pannello stats destra */
    +'<rect x="196" y="108" width="60" height="96" fill="#00d4e8" fill-opacity="0.025" stroke="#00d4e8" stroke-width="0.5" opacity="0.55"/>'
    +'<line x1="196" y1="119" x2="256" y2="119" stroke="#00d4e8" stroke-width="0.5" opacity="0.55"/>'
    +'<text x="200" y="117" font-family="monospace" font-size="5.5" fill="#00d4e8" opacity="0.85" letter-spacing="0.5">CUSTOMIZATION</text>'
    +'<text x="200" y="128" font-family="monospace" font-size="5" fill="#00d4e8" opacity="0.6">Accessori  Cal.00</text>'
    +'<text x="200" y="137" font-family="monospace" font-size="5" fill="#00d4e8" opacity="0.6">Potenza    B6I</text>'
    +'<text x="200" y="146" font-family="monospace" font-size="5" fill="#00d4e8" opacity="0.6">Stabilita  0.0I</text>'
    +'<text x="200" y="155" font-family="monospace" font-size="5" fill="#00d4e8" opacity="0.6">Cadenza   16/0</text>'
    +'<text x="200" y="164" font-family="monospace" font-size="4.5" fill="#00d4e8" opacity="0.35">-----------</text>'
    +'<text x="200" y="174" font-family="monospace" font-size="4.5" fill="#00d4e8" opacity="0.4">TACTICAL MODE</text>'
    +'<text x="200" y="182" font-family="monospace" font-size="4.5" fill="#00d4e8" opacity="0.4">ACTIVE</text>'
    +'<text x="200" y="196" font-family="monospace" font-size="4.5" fill="#00d4e8" opacity="0.28">||||||||||| 98%</text>'
    /* scan line sottile che attraversa il frame */
    +'<line x1="20" y1="220" x2="260" y2="220" stroke="#00d4e8" stroke-width="0.4" opacity="0.06"/>'
    /* testo info in basso */
    +'<line x1="20" y1="422" x2="260" y2="422" stroke="#00d4e8" stroke-width="0.5" opacity="0.25"/>'
    +'<text x="26" y="432" font-family="monospace" font-size="4.5" fill="#00d4e8" opacity="0.38">F10.J6S  00BCHARGERPRIME  5LMS OOQ  SCHAND...</text>'
    /* pulsante READY esagonale */
    +'<path d="M90 446 L112 436 L168 436 L190 446 L168 456 L112 456 Z" fill="#00d4e8" fill-opacity="0.08" stroke="#00d4e8" stroke-width="1.4" opacity="0.9"/>'
    +'<text x="140" y="450.5" font-family="monospace" font-size="9.5" font-weight="bold" fill="#00d4e8" text-anchor="middle" letter-spacing="3.5">READY</text>'
    +'</svg>';

  var wrap = document.createElement('div');
  wrap.style.cssText = 'background:#0d0000;min-height:100vh;font-family:\'Courier New\',monospace;color:'+ACCENT+';display:flex;flex-direction:column;';

  /* --- HEADER --- */
  var hdr = document.createElement('div');
  hdr.style.cssText = 'background:linear-gradient(180deg,rgba(25,2,2,0.98),rgba(13,0,0,0.95));border-bottom:2px solid rgba(229,48,48,0.3);padding:1.25rem 2rem;flex-shrink:0;';
  var hdrRow = document.createElement('div');
  hdrRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:0.75rem;';
  var hdrLeft = document.createElement('div');
  hdrLeft.innerHTML = '<div style="font-size:14px;font-weight:700;letter-spacing:0.15em;color:'+ACCENT+';margin-bottom:0.3rem;">// EMPORIO — ARSENALE //</div>'
    +'<div style="font-family:\'Cinzel\',serif;font-size:1.8rem;font-weight:900;letter-spacing:0.25em;color:'+ACCENT+';">ARMI DA FUOCO</div>';
  var hdrRight = document.createElement('div');
  hdrRight.style.cssText = 'display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center;';
  if (isAdmin()) {
    var _subT = state.armiSubTab||'armi';
    var addBtn = document.createElement('button');
    addBtn.style.cssText = 'background:rgba(229,48,48,0.12);border:2px solid '+ACCENT+';color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:13px;font-weight:700;letter-spacing:0.1em;padding:0.5rem 1.1rem;cursor:pointer;text-transform:uppercase;';
    addBtn.textContent = _subT==='potenziamenti'?'+ POTENZIAMENTO':_subT==='munizioni'?'+ MUNIZIONI':'+ NUOVA ARMA';
    addBtn.onclick = function(){
      if(_subT==='potenziamenti'){state.potenziamentiShowForm=true;state.potenziamentiEditingId=null;}
      else if(_subT==='munizioni'){state.munizioniArmiShowForm=true;state.munizioniArmiEditingId=null;}
      else{state.armiDaFuocoShowForm=true;state.armiDaFuocoEditingId=null;}
      renderMain();
    };
    hdrRight.appendChild(addBtn);
  }
  var backBtn = document.createElement('button');
  backBtn.style.cssText = 'background:rgba(229,48,48,0.08);border:2px solid rgba(229,48,48,0.5);color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:13px;font-weight:700;letter-spacing:0.1em;padding:0.5rem 1.1rem;cursor:pointer;text-transform:uppercase;';
  backBtn.innerHTML = '← TORNA EMPORIO';
  backBtn.onclick = function(){ state.emporioTab='normale'; renderMain(); };
  hdrRight.appendChild(backBtn);
  hdrRow.appendChild(hdrLeft); hdrRow.appendChild(hdrRight);
  hdr.appendChild(hdrRow);
  var srch = document.createElement('input');
  srch.type='text'; srch.placeholder='> RICERCA ARMI...'; srch.id='srch-armifuoco'; srch.value=state.armiDaFuocoSearch||'';
  srch.style.cssText='width:100%;box-sizing:border-box;background:rgba(229,48,48,0.04);border:1px solid rgba(229,48,48,0.3);color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:13px;padding:0.5rem 1rem;outline:none;';
  srch.oninput=function(){ state.armiDaFuocoSearch=this.value; renderMain(); var f=document.getElementById('srch-armifuoco'); if(f){f.focus();var l=f.value.length;f.setSelectionRange(l,l);} };
  if ((state.armiSubTab||'armi') !== 'armi') srch.style.display = 'none';
  hdr.appendChild(srch);
  wrap.appendChild(hdr);

  /* --- SUB-TAB BAR --- */
  var subTabBar = document.createElement('div');
  subTabBar.style.cssText = 'display:flex;border-bottom:2px solid rgba(229,48,48,0.2);background:#090000;flex-shrink:0;';
  [['armi','⊛ ARMI'],['potenziamenti','⬡ POTENZIAMENTI'],['munizioni','◉ MUNIZIONI']].forEach(function(t){
    var isAct = (state.armiSubTab||'armi') === t[0];
    var tb = document.createElement('button');
    tb.style.cssText = 'background:'+(isAct?'rgba(229,48,48,0.1)':'transparent')+';border:none;border-bottom:2px solid '+(isAct?ACCENT:'transparent')+';color:'+(isAct?ACCENT:'rgba(229,48,48,0.4)')+';font-family:\'Courier New\',monospace;font-size:12px;font-weight:700;letter-spacing:0.1em;padding:0.6rem 1.4rem;cursor:pointer;text-transform:uppercase;transition:all 0.15s;margin-bottom:-2px;';
    tb.textContent = t[1];
    tb.onclick = function(){ state.armiSubTab=t[0]; renderMain(); };
    subTabBar.appendChild(tb);
  });
  wrap.appendChild(subTabBar);

  if ((state.armiSubTab||'armi') === 'potenziamenti') { wrap.appendChild(_renderArmiPotenziamenti()); if(state.potenziamentiShowForm) wrap.appendChild(_renderPotenziamentiForm()); return wrap; }
  if ((state.armiSubTab||'armi') === 'munizioni') { wrap.appendChild(_renderArmiMunizioni()); if(state.munizioniArmiShowForm) wrap.appendChild(_renderMunizioniArmiForm()); return wrap; }

  var all = (state.armiDaFuoco||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'','it');});
  var q = (state.armiDaFuocoSearch||'').toLowerCase();
  var filtered = q ? all.filter(function(a){ return (a.nome||'').toLowerCase().includes(q)||(a.tipo||'').toLowerCase().includes(q)||(a.descrizione||'').toLowerCase().includes(q); }) : all;

  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(229,48,48,0.3);font-size:18px;letter-spacing:0.1em;padding:4rem;text-align:center;';
    empty.innerHTML = '<div style="width:180px;height:120px;margin:0 auto 1.5rem;">'+GUN_SVG+'</div>NESSUNA ARMA NEL DATABASE'+(isDM()?'<div style="margin-top:1rem;font-size:13px;">> aggiungi la prima arma per iniziare</div>':'');
    wrap.appendChild(empty);
    if (state.armiDaFuocoShowForm) wrap.appendChild(renderArmaFuocoForm());
    return wrap;
  }

  if (!state.armiDaFuocoSelectedId || !filtered.find(function(a){ return a.id===state.armiDaFuocoSelectedId; }))
    state.armiDaFuocoSelectedId = filtered[0].id;
  var selected = filtered.find(function(a){ return a.id===state.armiDaFuocoSelectedId; }) || filtered[0];

  /* --- MAIN AREA (sezione 1 + sezione 2) --- */
  var mainArea = document.createElement('div');
  mainArea.style.cssText = 'flex:1;display:flex;overflow:hidden;min-height:300px;';

  /* Sezione 1 — immagine */
  var sec1 = document.createElement('div');
  sec1.style.cssText = 'flex:0 0 55%;min-width:0;position:relative;background:#080000;overflow:hidden;display:flex;align-items:center;justify-content:center;';

  function renderSec1(arma) {
    sec1.innerHTML = '';
    var imgs = _vehicleImages(arma);
    if (imgs.length > 0) {
      var car = _buildVehicleCarousel(imgs);
      if (car) {
        car.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
        var ci = car.querySelector('img');
        if (ci) ci.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;transition:opacity 0.15s;';
        sec1.appendChild(car);
      }
    } else {
      var ph = document.createElement('div');
      ph.style.cssText = 'width:320px;max-width:70%;';
      ph.innerHTML = GUN_SVG;
      sec1.appendChild(ph);
    }
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.88));padding:1.5rem 1.5rem 0.9rem;pointer-events:none;';
    overlay.innerHTML = '<div style="font-family:\'Cinzel\',serif;font-size:1.4rem;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.9);">'+escapeHtml(arma.nome||'Senza nome')+'</div>'+(arma.tipo?'<div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.9);margin-top:0.2rem;">'+escapeHtml(arma.tipo)+'</div>':'');
    sec1.appendChild(overlay);
  }
  renderSec1(selected);
  mainArea.appendChild(sec1);

  var divLine = document.createElement('div');
  divLine.style.cssText = 'width:2px;background:rgba(229,48,48,0.2);flex-shrink:0;';
  mainArea.appendChild(divLine);

  /* Sezione 2 — dettagli */
  var sec2 = document.createElement('div');
  sec2.style.cssText = 'flex:1;min-width:0;background:#0d0000;overflow-y:auto;padding:1.25rem 1.5rem;';

  function renderSec2(arma) {
    sec2.innerHTML = '';
    function row(lbl, val) {
      if (!val) return;
      var d = document.createElement('div'); d.style.cssText = 'margin-bottom:0.85rem;';
      var l = document.createElement('div'); l.style.cssText = 'font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(229,48,48,0.5);margin-bottom:0.18rem;'; l.textContent = lbl;
      var v = document.createElement('div'); v.style.cssText = 'font-size:16px;color:#ffb3b3;line-height:1.5;'; v.textContent = val;
      d.appendChild(l); d.appendChild(v); sec2.appendChild(d);
    }
    row('// TIPO', arma.tipo);
    row('// MUNIZIONI', arma.munizioni);
    if (arma.descrizione) {
      var dl = document.createElement('div'); dl.style.cssText = 'font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(229,48,48,0.5);margin-bottom:0.18rem;'; dl.textContent = '// DESCRIZIONE'; sec2.appendChild(dl);
      var dv = document.createElement('div'); dv.style.cssText = 'font-size:15px;color:#ffcccc;line-height:1.65;margin-bottom:0.85rem;white-space:pre-wrap;'; dv.textContent = arma.descrizione; sec2.appendChild(dv);
    }
    if (arma.costo) row('// PREZZO', arma.costo+' '+(arma.valuta||'mo'));
    if (isAdmin()) {
      var br = document.createElement('div'); br.style.cssText = 'display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid rgba(229,48,48,0.15);padding-top:1rem;';
      var eb = document.createElement('button'); eb.style.cssText = 'flex:1;background:rgba(229,48,48,0.1);border:1px solid rgba(229,48,48,0.4);color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:12px;font-weight:700;padding:0.4rem;cursor:pointer;'; eb.textContent='✎ MODIFICA';
      eb.onclick=function(){ state.armiDaFuocoEditingId=arma.id; state.armiDaFuocoShowForm=true; renderMain(); };
      var db2 = document.createElement('button'); db2.style.cssText = 'background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.4);color:#ff8080;font-family:\'Courier New\',monospace;font-size:12px;font-weight:700;padding:0.4rem 0.65rem;cursor:pointer;'; db2.textContent='✕';
      db2.onclick=function(){ if(confirm('Eliminare '+escapeHtml(arma.nome||'questa arma')+'?')){ state.armiDaFuoco=state.armiDaFuoco.filter(function(x){return x.id!==arma.id;}); fbSaveArmiFuoco(); renderMain(); } };
      br.appendChild(eb); br.appendChild(db2); sec2.appendChild(br);
    }
  }
  renderSec2(selected);
  mainArea.appendChild(sec2);
  wrap.appendChild(mainArea);

  /* --- SEZIONE 3 — carousel schede con auto-scroll --- */
  var CARD_W = 160;
  var carWrap = document.createElement('div');
  carWrap.style.cssText = 'flex-shrink:0;height:200px;border-top:2px solid rgba(229,48,48,0.25);background:#080000;display:flex;align-items:stretch;';

  var prevBtn = document.createElement('button');
  prevBtn.style.cssText = 'flex-shrink:0;width:44px;background:rgba(229,48,48,0.08);border:none;border-right:1px solid rgba(229,48,48,0.18);color:'+ACCENT+';font-size:26px;font-weight:900;cursor:pointer;';
  prevBtn.textContent = '‹';
  carWrap.appendChild(prevBtn);

  var strip = document.createElement('div');
  strip.style.cssText = 'flex:1;display:flex;align-items:stretch;gap:0;overflow-x:auto;padding:10px 12px;scrollbar-width:thin;scrollbar-color:rgba(229,48,48,0.3) transparent;';

  var cardEls = [];
  filtered.forEach(function(arma) {
    var isSel = arma.id === selected.id;
    var card = document.createElement('div');
    card.style.cssText = 'flex-shrink:0;width:'+CARD_W+'px;margin-right:10px;border:2px solid '+(isSel?ACCENT:'rgba(229,48,48,0.18)')+';cursor:pointer;background:'+(isSel?'rgba(229,48,48,0.07)':'#0a0000')+';display:flex;flex-direction:column;overflow:hidden;transition:border-color 0.15s,background 0.15s;';

    /* immagine card */
    var imgBox = document.createElement('div');
    imgBox.style.cssText = 'height:105px;flex-shrink:0;position:relative;background:#040000;overflow:hidden;display:flex;align-items:center;justify-content:center;';
    var imgs = _vehicleImages(arma);
    if (imgs.length > 0) {
      var ci = document.createElement('img'); ci.src=imgs[0]; ci.alt=''; ci.style.cssText='width:100%;height:100%;object-fit:cover;display:block;'; ci.onerror=function(){ci.style.display='none'; imgBox.innerHTML=GUN_SVG;}; imgBox.appendChild(ci);
    } else {
      imgBox.innerHTML = GUN_SVG;
    }
    /* bordo inferiore immagine */
    var imgBorder = document.createElement('div'); imgBorder.style.cssText='position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,'+ACCENT+',transparent);opacity:'+(isSel?'1':'0.3')+';'; imgBox.appendChild(imgBorder);
    card.appendChild(imgBox);

    /* info card */
    var info = document.createElement('div');
    info.style.cssText = 'flex:1;padding:6px 8px;display:flex;flex-direction:column;justify-content:space-between;';
    var nomDiv = document.createElement('div'); nomDiv.style.cssText='font-family:\'Cinzel\',serif;font-size:13px;font-weight:700;color:#ffcccc;letter-spacing:0.05em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; nomDiv.textContent=arma.nome||'?'; info.appendChild(nomDiv);
    var tipDiv = document.createElement('div'); tipDiv.style.cssText='font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:'+ACCENT+';margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; tipDiv.textContent=arma.tipo||''; info.appendChild(tipDiv);
    if (arma.munizioni) { var munDiv=document.createElement('div'); munDiv.style.cssText='font-size:11px;color:rgba(229,48,48,0.5);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; munDiv.textContent=arma.munizioni; info.appendChild(munDiv); }
    card.appendChild(info);

    (function(a, el) {
      el.onclick = function() {
        state.armiDaFuocoSelectedId = a.id;
        cardEls.forEach(function(ce){
          ce.style.borderColor='rgba(229,48,48,0.18)';
          ce.style.background='#0a0000';
          var ib=ce.querySelector('div[data-imgborder]'); if(ib) ib.style.opacity='0.3';
        });
        el.style.borderColor = ACCENT;
        el.style.background = 'rgba(229,48,48,0.07)';
        renderSec1(a); renderSec2(a);
        el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
      };
    })(arma, card);
    imgBorder.setAttribute('data-imgborder','1');
    strip.appendChild(card); cardEls.push(card);
  });

  /* Clone cards for infinite circular scroll */
  cardEls.forEach(function(origCard, idx) {
    var a = filtered[idx];
    var clone = origCard.cloneNode(true);
    clone.onclick = function() {
      state.armiDaFuocoSelectedId = a.id;
      cardEls.forEach(function(ce){ ce.style.borderColor='rgba(229,48,48,0.18)'; ce.style.background='#0a0000'; });
      origCard.style.borderColor = ACCENT;
      origCard.style.background = 'rgba(229,48,48,0.07)';
      renderSec1(a); renderSec2(a);
      origCard.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
    };
    strip.appendChild(clone);
  });

  var halfWidth = 0;
  setTimeout(function(){ halfWidth = strip.scrollWidth / 2; }, 150);

  /* Mouse wheel → scroll orizzontale circolare */
  strip.addEventListener('wheel', function(e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      strip.scrollLeft += e.deltaY;
      if (halfWidth > 0) {
        if (strip.scrollLeft >= halfWidth) strip.scrollLeft -= halfWidth;
        else if (strip.scrollLeft < 0) strip.scrollLeft += halfWidth;
      }
    }
  }, {passive: false});

  /* Auto-scroll lento circolare */
  var autoScrollId = null;
  var autoScrollPaused = false;
  function startAutoScroll() {
    if (autoScrollId) return;
    autoScrollId = setInterval(function() {
      if (autoScrollPaused) return;
      strip.scrollLeft += 0.6;
      if (halfWidth > 0 && strip.scrollLeft >= halfWidth) strip.scrollLeft -= halfWidth;
    }, 30);
  }
  strip.addEventListener('mouseenter', function(){ autoScrollPaused=true; });
  strip.addEventListener('mouseleave', function(){ autoScrollPaused=false; });
  strip.addEventListener('touchstart', function(){ autoScrollPaused=true; }, {passive:true});
  wrap.addEventListener('remove-autoscroll', function(){ clearInterval(autoScrollId); });
  setTimeout(startAutoScroll, 600);

  prevBtn.onclick = function(){
    var idx=filtered.findIndex(function(a){return a.id===state.armiDaFuocoSelectedId;});
    var ni=((idx-1)+filtered.length)%filtered.length;
    cardEls[ni].onclick();
  };
  carWrap.appendChild(strip);

  var nextBtn = document.createElement('button');
  nextBtn.style.cssText = 'flex-shrink:0;width:44px;background:rgba(229,48,48,0.08);border:none;border-left:1px solid rgba(229,48,48,0.18);color:'+ACCENT+';font-size:26px;font-weight:900;cursor:pointer;';
  nextBtn.textContent = '›';
  nextBtn.onclick = function(){
    var idx=filtered.findIndex(function(a){return a.id===state.armiDaFuocoSelectedId;});
    var ni=(idx+1)%filtered.length;
    cardEls[ni].onclick();
  };
  carWrap.appendChild(nextBtn);
  wrap.appendChild(carWrap);

  if (state.armiDaFuocoShowForm) wrap.appendChild(renderArmaFuocoForm());
  return wrap;
}

function renderArmaFuocoForm() {
  var ACCENT='#e53030';
  var editing=null;
  if (state.armiDaFuocoEditingId) (state.armiDaFuoco||[]).forEach(function(x){ if(x.id===state.armiDaFuocoEditingId) editing=x; });
  var _ei = editing ? (editing.immagini&&editing.immagini.length?editing.immagini.slice():(editing.immagine?[editing.immagine]:[])) : [];
  var form={nome:editing?editing.nome:'',tipo:editing?editing.tipo:TIPI_ARMA_FUOCO[0],munizioni:editing?editing.munizioni:MUNIZIONI_ARMA[0],costo:editing?editing.costo:0,valuta:editing?editing.valuta:'mo',descrizione:editing?editing.descrizione:'',immagini:_ei};

  var backdrop=document.createElement('div');
  backdrop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick=function(e){ if(e.target===backdrop){state.armiDaFuocoShowForm=false;state.armiDaFuocoEditingId=null;renderMain();} };

  var panel=document.createElement('div');
  panel.style.cssText='background:#0d0000;border:2px solid rgba(229,48,48,0.5);padding:0;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick=function(e){e.stopPropagation();};

  var mhead=document.createElement('div');
  mhead.style.cssText='padding:1rem 1.5rem;border-bottom:1px solid rgba(229,48,48,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML='<div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:'+ACCENT+';letter-spacing:0.1em;">'+(editing?'✎ MODIFICA ARMA':'🔫 NUOVA ARMA')+'</div>';
  var closeB=document.createElement('button'); closeB.style.cssText='background:none;border:none;color:'+ACCENT+';font-size:20px;cursor:pointer;'; closeB.textContent='✕';
  closeB.onclick=function(){state.armiDaFuocoShowForm=false;state.armiDaFuocoEditingId=null;renderMain();};
  mhead.appendChild(closeB); panel.appendChild(mhead);

  var mbody=document.createElement('div');
  mbody.style.cssText='padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';

  var fStyle='width:100%;background:#0d0000;border:1px solid rgba(229,48,48,0.35);color:#ffb3b3;font-family:\'Courier New\',monospace;font-size:14px;padding:0.5rem 0.75rem;outline:none;box-sizing:border-box;';
  function aField(lbl,key,type,opts){
    var g=document.createElement('div');
    var l=document.createElement('label'); l.style.cssText='display:block;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.65);margin-bottom:0.3rem;'; l.textContent='// '+lbl; g.appendChild(l);
    var el;
    if(type==='select'){
      el=document.createElement('select'); el.style.cssText=fStyle+'appearance:none;-webkit-appearance:none;cursor:pointer;';
      (opts||[]).forEach(function(o){ var opt=document.createElement('option'); opt.value=o; opt.textContent=o; opt.style.cssText='background:#0d0000;color:#ffb3b3;'; if(form[key]===o)opt.selected=true; el.appendChild(opt); });
    } else if(type==='textarea'){
      el=document.createElement('textarea'); el.style.cssText=fStyle+'resize:vertical;'; el.rows=4; el.value=form[key];
    } else {
      el=document.createElement('input'); el.type=type||'text'; el.style.cssText=fStyle; el.value=form[key];
    }
    el.onchange=el.oninput=function(){ form[key]=type==='number'?(Number(this.value)||0):this.value; };
    g.appendChild(el); return g;
  }

  mbody.appendChild(aField('NOME ARMA','nome','text'));
  var rTM=document.createElement('div'); rTM.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;';
  rTM.appendChild(aField('TIPO','tipo','select',TIPI_ARMA_FUOCO));
  rTM.appendChild(aField('MUNIZIONI','munizioni','select',MUNIZIONI_ARMA));
  mbody.appendChild(rTM);
  var rCP=document.createElement('div'); rCP.style.cssText='display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  rCP.appendChild(aField('COSTO','costo','number'));
  rCP.appendChild(aField('VALUTA','valuta','select',VALUTE.map(function(v){return v.code;})));
  mbody.appendChild(rCP);
  mbody.appendChild(aField('DESCRIZIONE','descrizione','textarea'));

  /* Image editor riutilizza helper veicoli ma con colore rosso */
  var imgEditor = _buildVehicleImageEditor(form, ACCENT);
  /* Override colors to red theme */
  imgEditor.querySelectorAll&&imgEditor.querySelectorAll('button').forEach&&imgEditor.querySelectorAll('button').forEach(function(b){
    b.style.borderColor='rgba(229,48,48,0.45)'; b.style.color=ACCENT; b.style.background='rgba(229,48,48,0.08)';
  });
  mbody.appendChild(imgEditor);

  var saveBtn=document.createElement('button');
  saveBtn.style.cssText='width:100%;background:rgba(229,48,48,0.12);border:2px solid '+ACCENT+';color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;';
  saveBtn.textContent=editing?'> SALVA MODIFICHE':'> AGGIUNGI ALL\'ARSENALE';
  saveBtn.onclick=function(){
    if(!form.nome.trim()){notify('Inserisci il nome dell\'arma.','err');return;}
    var saved=Object.assign({},form,{immagini:form.immagini||[]}); delete saved.immagine;
    if(!state.armiDaFuoco) state.armiDaFuoco=[];
    if(editing){
      state.armiDaFuoco=state.armiDaFuoco.map(function(x){return x.id===editing.id?Object.assign({},saved,{id:editing.id}):x;});
    } else {
      state.armiDaFuoco.push(Object.assign({},saved,{id:'af_'+Date.now()}));
      state.armiDaFuocoSelectedId=state.armiDaFuoco[state.armiDaFuoco.length-1].id;
    }
    fbSaveArmiFuoco();
    notify(editing?'Arma aggiornata.':'Arma aggiunta all\'arsenale.');
    state.armiDaFuocoShowForm=false; state.armiDaFuocoEditingId=null; renderMain();
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
  var items = (state.potenziamenti||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'','it');});
  if (items.length === 0) {
    var empty = document.createElement('div'); empty.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem;color:rgba(229,48,48,0.3);font-size:18px;letter-spacing:0.1em;text-align:center;';
    empty.innerHTML = 'NESSUN POTENZIAMENTO'+(isDM()?'<div style="font-size:13px;margin-top:1rem;">> aggiungi il primo potenziamento</div>':'');
    outer.appendChild(empty); return outer;
  }
  var grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;';
  items.forEach(function(p) {
    var card = document.createElement('div'); card.style.cssText = 'border:1px solid rgba(229,48,48,0.22);background:#0a0000;display:flex;flex-direction:column;overflow:hidden;transition:border-color 0.15s;';
    card.onmouseenter=function(){card.style.borderColor=ACCENT;}; card.onmouseleave=function(){card.style.borderColor='rgba(229,48,48,0.22)';};
    var imgs = p.immagini&&p.immagini.length?p.immagini:(p.immagine?[p.immagine]:[]);
    if (imgs.length > 0) {
      var imgBox=document.createElement('div'); imgBox.style.cssText='height:130px;overflow:hidden;background:#040000;';
      var img=document.createElement('img'); img.src=imgs[0]; img.alt=''; img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;'; imgBox.appendChild(img); card.appendChild(imgBox);
    }
    var body=document.createElement('div'); body.style.cssText='padding:0.8rem;flex:1;display:flex;flex-direction:column;gap:0.35rem;';
    var nome=document.createElement('div'); nome.style.cssText='font-family:\'Cinzel\',serif;font-size:15px;font-weight:700;color:#ffcccc;letter-spacing:0.05em;'; nome.textContent=p.nome||'?'; body.appendChild(nome);
    if(p.costo){var pr=document.createElement('div');pr.style.cssText='font-size:13px;color:'+ACCENT+';font-weight:700;';pr.textContent=p.costo+' '+(p.valuta||'mo');body.appendChild(pr);}
    if(p.prerequisiti){var rq=document.createElement('div');rq.style.cssText='font-size:12px;color:rgba(229,48,48,0.5);font-style:italic;';rq.textContent='Req: '+p.prerequisiti;body.appendChild(rq);}
    if(p.effetto){var ef=document.createElement('div');ef.style.cssText='font-size:13px;color:#ffb3b3;line-height:1.5;margin-top:0.2rem;flex:1;white-space:pre-wrap;';ef.textContent=p.effetto;body.appendChild(ef);}
    if(isAdmin()){
      var br2=document.createElement('div');br2.style.cssText='display:flex;gap:0.4rem;margin-top:0.5rem;border-top:1px solid rgba(229,48,48,0.1);padding-top:0.5rem;';
      var eb2=document.createElement('button');eb2.style.cssText='flex:1;background:rgba(229,48,48,0.08);border:1px solid rgba(229,48,48,0.3);color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:11px;padding:0.3rem;cursor:pointer;';eb2.textContent='✎ MODIFICA';
      eb2.onclick=function(){state.potenziamentiEditingId=p.id;state.potenziamentiShowForm=true;renderMain();};
      var db3=document.createElement('button');db3.style.cssText='background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.3);color:#ff8080;font-family:\'Courier New\',monospace;font-size:11px;padding:0.3rem 0.5rem;cursor:pointer;';db3.textContent='✕';
      db3.onclick=function(){if(confirm('Eliminare '+escapeHtml(p.nome||'questo potenziamento')+'?')){state.potenziamenti=state.potenziamenti.filter(function(x){return x.id!==p.id;});fbSavePotenziamentiArmi();renderMain();}};
      br2.appendChild(eb2);br2.appendChild(db3);body.appendChild(br2);
    }
    card.appendChild(body); grid.appendChild(card);
  });
  outer.appendChild(grid); return outer;
}

function _renderPotenziamentiForm() {
  var ACCENT='#e53030';
  var editing=null;
  if(state.potenziamentiEditingId)(state.potenziamenti||[]).forEach(function(x){if(x.id===state.potenziamentiEditingId)editing=x;});
  var _ei=editing?(editing.immagini&&editing.immagini.length?editing.immagini.slice():(editing.immagine?[editing.immagine]:[])):[];
  var form={nome:editing?editing.nome:'',costo:editing?editing.costo:0,valuta:editing?editing.valuta:'mo',prerequisiti:editing?editing.prerequisiti:'',effetto:editing?editing.effetto:'',immagini:_ei};
  var backdrop=document.createElement('div');
  backdrop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick=function(e){if(e.target===backdrop){state.potenziamentiShowForm=false;state.potenziamentiEditingId=null;renderMain();}};
  var panel=document.createElement('div');
  panel.style.cssText='background:#0d0000;border:2px solid rgba(229,48,48,0.5);max-width:500px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick=function(e){e.stopPropagation();};
  var mhead=document.createElement('div');
  mhead.style.cssText='padding:1rem 1.5rem;border-bottom:1px solid rgba(229,48,48,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML='<div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:'+ACCENT+';letter-spacing:0.1em;">'+(editing?'✎ MODIFICA POTENZIAMENTO':'⬡ NUOVO POTENZIAMENTO')+'</div>';
  var closeB=document.createElement('button');closeB.style.cssText='background:none;border:none;color:'+ACCENT+';font-size:20px;cursor:pointer;';closeB.textContent='✕';
  closeB.onclick=function(){state.potenziamentiShowForm=false;state.potenziamentiEditingId=null;renderMain();};
  mhead.appendChild(closeB);panel.appendChild(mhead);
  var mbody=document.createElement('div');mbody.style.cssText='padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';
  var fStyle='width:100%;background:#0d0000;border:1px solid rgba(229,48,48,0.35);color:#ffb3b3;font-family:\'Courier New\',monospace;font-size:14px;padding:0.5rem 0.75rem;outline:none;box-sizing:border-box;';
  function pField(lbl,key,type){
    var g=document.createElement('div');
    var l=document.createElement('label');l.style.cssText='display:block;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.65);margin-bottom:0.3rem;';l.textContent='// '+lbl;g.appendChild(l);
    var el;
    if(type==='textarea'){el=document.createElement('textarea');el.style.cssText=fStyle+'resize:vertical;';el.rows=3;el.value=form[key];}
    else{el=document.createElement('input');el.type=type||'text';el.style.cssText=fStyle;el.value=form[key];}
    el.onchange=el.oninput=function(){form[key]=type==='number'?(Number(this.value)||0):this.value;};
    g.appendChild(el);return g;
  }
  mbody.appendChild(pField('NOME POTENZIAMENTO','nome','text'));
  var rCP=document.createElement('div');rCP.style.cssText='display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  rCP.appendChild(pField('PREZZO','costo','number'));
  var gV=document.createElement('div');
  var lV=document.createElement('label');lV.style.cssText='display:block;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.65);margin-bottom:0.3rem;';lV.textContent='// VALUTA';gV.appendChild(lV);
  var selV=document.createElement('select');selV.style.cssText=fStyle+'appearance:none;-webkit-appearance:none;cursor:pointer;';
  VALUTE.forEach(function(v){var o=document.createElement('option');o.value=v.code;o.textContent=v.code;o.style.cssText='background:#0d0000;color:#ffb3b3;';if(form.valuta===v.code)o.selected=true;selV.appendChild(o);});
  selV.onchange=function(){form.valuta=this.value;};gV.appendChild(selV);rCP.appendChild(gV);
  mbody.appendChild(rCP);
  mbody.appendChild(pField('PREREQUISITI','prerequisiti','text'));
  mbody.appendChild(pField('EFFETTO','effetto','textarea'));
  var imgEditor=_buildVehicleImageEditor(form,ACCENT);mbody.appendChild(imgEditor);
  var saveBtn=document.createElement('button');
  saveBtn.style.cssText='width:100%;background:rgba(229,48,48,0.12);border:2px solid '+ACCENT+';color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;';
  saveBtn.textContent=editing?'> SALVA MODIFICHE':'> AGGIUNGI POTENZIAMENTO';
  saveBtn.onclick=function(){
    if(!form.nome.trim()){notify('Inserisci il nome del potenziamento.','err');return;}
    var saved=Object.assign({},form,{immagini:form.immagini||[]});delete saved.immagine;
    if(!state.potenziamenti)state.potenziamenti=[];
    if(editing){state.potenziamenti=state.potenziamenti.map(function(x){return x.id===editing.id?Object.assign({},saved,{id:editing.id}):x;});}
    else{state.potenziamenti.push(Object.assign({},saved,{id:'pot_'+Date.now()}));}
    fbSavePotenziamentiArmi();
    notify(editing?'Potenziamento aggiornato.':'Potenziamento aggiunto.');
    state.potenziamentiShowForm=false;state.potenziamentiEditingId=null;renderMain();
  };
  mbody.appendChild(saveBtn);panel.appendChild(mbody);backdrop.appendChild(panel);return backdrop;
}

function _renderArmiMunizioni() {
  var ACCENT = '#e53030';
  var outer = document.createElement('div');
  outer.style.cssText = 'flex:1;overflow-y:auto;padding:1.5rem 2rem;';
  var items = (state.munizioniArmi||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'','it');});
  if (items.length === 0) {
    var empty = document.createElement('div'); empty.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem;color:rgba(229,48,48,0.3);font-size:18px;letter-spacing:0.1em;text-align:center;';
    empty.innerHTML = 'NESSUNA MUNIZIONE'+(isDM()?'<div style="font-size:13px;margin-top:1rem;">> aggiungi le prime munizioni</div>':'');
    outer.appendChild(empty); return outer;
  }
  var grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;';
  items.forEach(function(m) {
    var card = document.createElement('div'); card.style.cssText = 'border:1px solid rgba(229,48,48,0.22);background:#0a0000;padding:0.9rem;display:flex;flex-direction:column;gap:0.35rem;transition:border-color 0.15s;';
    card.onmouseenter=function(){card.style.borderColor=ACCENT;}; card.onmouseleave=function(){card.style.borderColor='rgba(229,48,48,0.22)';};
    var nome=document.createElement('div');nome.style.cssText='font-family:\'Cinzel\',serif;font-size:15px;font-weight:700;color:#ffcccc;letter-spacing:0.05em;';nome.textContent=m.nome||'?';card.appendChild(nome);
    if(m.costo){var pr=document.createElement('div');pr.style.cssText='font-size:13px;color:'+ACCENT+';font-weight:700;';pr.textContent=m.costo+' '+(m.valuta||'mo');card.appendChild(pr);}
    if(m.effetto){var ef=document.createElement('div');ef.style.cssText='font-size:13px;color:#ffb3b3;line-height:1.5;margin-top:0.2rem;flex:1;white-space:pre-wrap;';ef.textContent=m.effetto;card.appendChild(ef);}
    if(isAdmin()){
      var br3=document.createElement('div');br3.style.cssText='display:flex;gap:0.4rem;margin-top:0.5rem;border-top:1px solid rgba(229,48,48,0.1);padding-top:0.5rem;';
      var eb3=document.createElement('button');eb3.style.cssText='flex:1;background:rgba(229,48,48,0.08);border:1px solid rgba(229,48,48,0.3);color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:11px;padding:0.3rem;cursor:pointer;';eb3.textContent='✎ MODIFICA';
      eb3.onclick=function(){state.munizioniArmiEditingId=m.id;state.munizioniArmiShowForm=true;renderMain();};
      var db4=document.createElement('button');db4.style.cssText='background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.3);color:#ff8080;font-family:\'Courier New\',monospace;font-size:11px;padding:0.3rem 0.5rem;cursor:pointer;';db4.textContent='✕';
      db4.onclick=function(){if(confirm('Eliminare '+escapeHtml(m.nome||'queste munizioni')+'?')){state.munizioniArmi=state.munizioniArmi.filter(function(x){return x.id!==m.id;});fbSaveMunizioniArmi();renderMain();}};
      br3.appendChild(eb3);br3.appendChild(db4);card.appendChild(br3);
    }
    grid.appendChild(card);
  });
  outer.appendChild(grid); return outer;
}

function _renderMunizioniArmiForm() {
  var ACCENT='#e53030';
  var editing=null;
  if(state.munizioniArmiEditingId)(state.munizioniArmi||[]).forEach(function(x){if(x.id===state.munizioniArmiEditingId)editing=x;});
  var form={nome:editing?editing.nome:'',costo:editing?editing.costo:0,valuta:editing?editing.valuta:'mo',effetto:editing?editing.effetto:''};
  var backdrop=document.createElement('div');
  backdrop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick=function(e){if(e.target===backdrop){state.munizioniArmiShowForm=false;state.munizioniArmiEditingId=null;renderMain();}};
  var panel=document.createElement('div');
  panel.style.cssText='background:#0d0000;border:2px solid rgba(229,48,48,0.5);max-width:460px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick=function(e){e.stopPropagation();};
  var mhead=document.createElement('div');
  mhead.style.cssText='padding:1rem 1.5rem;border-bottom:1px solid rgba(229,48,48,0.2);display:flex;justify-content:space-between;align-items:center;';
  mhead.innerHTML='<div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:'+ACCENT+';letter-spacing:0.1em;">'+(editing?'✎ MODIFICA MUNIZIONI':'◉ NUOVE MUNIZIONI')+'</div>';
  var closeB=document.createElement('button');closeB.style.cssText='background:none;border:none;color:'+ACCENT+';font-size:20px;cursor:pointer;';closeB.textContent='✕';
  closeB.onclick=function(){state.munizioniArmiShowForm=false;state.munizioniArmiEditingId=null;renderMain();};
  mhead.appendChild(closeB);panel.appendChild(mhead);
  var mbody=document.createElement('div');mbody.style.cssText='padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';
  var fStyle='width:100%;background:#0d0000;border:1px solid rgba(229,48,48,0.35);color:#ffb3b3;font-family:\'Courier New\',monospace;font-size:14px;padding:0.5rem 0.75rem;outline:none;box-sizing:border-box;';
  function mField(lbl,key,type){
    var g=document.createElement('div');
    var l=document.createElement('label');l.style.cssText='display:block;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.65);margin-bottom:0.3rem;';l.textContent='// '+lbl;g.appendChild(l);
    var el;
    if(type==='textarea'){el=document.createElement('textarea');el.style.cssText=fStyle+'resize:vertical;';el.rows=3;el.value=form[key];}
    else{el=document.createElement('input');el.type=type||'text';el.style.cssText=fStyle;el.value=form[key];}
    el.onchange=el.oninput=function(){form[key]=type==='number'?(Number(this.value)||0):this.value;};
    g.appendChild(el);return g;
  }
  mbody.appendChild(mField('NOME MUNIZIONI','nome','text'));
  var rCP2=document.createElement('div');rCP2.style.cssText='display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  rCP2.appendChild(mField('PREZZO','costo','number'));
  var gV2=document.createElement('div');
  var lV2=document.createElement('label');lV2.style.cssText='display:block;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(229,48,48,0.65);margin-bottom:0.3rem;';lV2.textContent='// VALUTA';gV2.appendChild(lV2);
  var selV2=document.createElement('select');selV2.style.cssText=fStyle+'appearance:none;-webkit-appearance:none;cursor:pointer;';
  VALUTE.forEach(function(v){var o=document.createElement('option');o.value=v.code;o.textContent=v.code;o.style.cssText='background:#0d0000;color:#ffb3b3;';if(form.valuta===v.code)o.selected=true;selV2.appendChild(o);});
  selV2.onchange=function(){form.valuta=this.value;};gV2.appendChild(selV2);rCP2.appendChild(gV2);
  mbody.appendChild(rCP2);
  mbody.appendChild(mField('EFFETTO','effetto','textarea'));
  var saveBtn=document.createElement('button');
  saveBtn.style.cssText='width:100%;background:rgba(229,48,48,0.12);border:2px solid '+ACCENT+';color:'+ACCENT+';font-family:\'Courier New\',monospace;font-size:14px;font-weight:700;letter-spacing:0.1em;padding:0.75rem;cursor:pointer;text-transform:uppercase;margin-top:0.5rem;';
  saveBtn.textContent=editing?'> SALVA MODIFICHE':'> AGGIUNGI MUNIZIONI';
  saveBtn.onclick=function(){
    if(!form.nome.trim()){notify('Inserisci il nome delle munizioni.','err');return;}
    var saved=Object.assign({},form);
    if(!state.munizioniArmi)state.munizioniArmi=[];
    if(editing){state.munizioniArmi=state.munizioniArmi.map(function(x){return x.id===editing.id?Object.assign({},saved,{id:editing.id}):x;});}
    else{state.munizioniArmi.push(Object.assign({},saved,{id:'mun_'+Date.now()}));}
    fbSaveMunizioniArmi();
    notify(editing?'Munizioni aggiornate.':'Munizioni aggiunte.');
    state.munizioniArmiShowForm=false;state.munizioniArmiEditingId=null;renderMain();
  };
  mbody.appendChild(saveBtn);panel.appendChild(mbody);backdrop.appendChild(panel);return backdrop;
}

function renderEmporioCyber() {
  var wrap = document.createElement('div');
  wrap.className = 'cyber-wrap';

  // Header
  var hdr = document.createElement('div');
  hdr.className = 'cyber-header';
  var hdrRow = document.createElement('div');
  hdrRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;';

  var hdrLeft = document.createElement('div');
  hdrLeft.innerHTML = '<div class="cyber-subtitle">// EMPORIO — LABORATORIO CIBERNETICO //</div>' +
    '<div class="cyber-title">&#9658; IMPIANTI_CIB</div>';

  var hdrRight = document.createElement('div');
  hdrRight.style.cssText = 'display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;';

  var addBtn = document.createElement('button');
  addBtn.className = 'cyber-add-btn';
  addBtn.textContent = '+ NUOVO IMPIANTO';
  addBtn.onclick = function() { state.cyberShowForm = true; state.cyberEditingId = null; renderMain(); };
  if (isAdmin()) hdrRight.appendChild(addBtn);

  var backBtn = document.createElement('button');
  backBtn.className = 'cyber-back-btn';
  backBtn.innerHTML = '← TORNA EMPORIO';
  backBtn.onclick = function() { state.emporioTab = 'normale'; renderMain(); };
  hdrRight.appendChild(backBtn);

  hdrRow.appendChild(hdrLeft);
  hdrRow.appendChild(hdrRight);
  hdr.appendChild(hdrRow);

  // Search + filtri
  var searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:0 2rem 1rem;position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;';

  var srch = document.createElement('input');
  srch.type = 'text';
  srch.id = 'srch-cyber';
  srch.className = 'cyber-search-bar';
  srch.style.cssText = 'flex:1;min-width:200px;';
  srch.placeholder = '> RICERCA_IMPIANTI :: digita per filtrare...';
  srch.value = state.cyberSearch || '';
  srch.oninput = function(){ state.cyberSearch = this.value; renderMain(); var f=document.getElementById('srch-cyber'); if(f){f.focus();var l=f.value.length;f.setSelectionRange(l,l);} };
  searchWrap.appendChild(srch);

  var selStyle = 'background:#050518;border:1px solid rgba(0,245,255,0.35);color:#00f5ff;font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:0.55rem 0.75rem;cursor:pointer;outline:none;min-width:150px;';

  var selTipo = document.createElement('select');
  selTipo.style.cssText = selStyle;
  [{v:'',l:'— TUTTI I TIPI —'}].concat(TIPI_CYBER.map(function(t){return{v:t,l:t.toUpperCase()};})).forEach(function(o){
    var opt = document.createElement('option');
    opt.value = o.v; opt.textContent = o.l;
    if ((state.cyberFilterTipo||'') === o.v) opt.selected = true;
    selTipo.appendChild(opt);
  });
  selTipo.onchange = function(){ state.cyberFilterTipo = this.value; renderMain(); };
  searchWrap.appendChild(selTipo);

  var selRar = document.createElement('select');
  selRar.style.cssText = selStyle;
  [{v:'',l:'— TUTTE LE RARITÀ —'}].concat(RARITA_CYBER.map(function(r){return{v:r,l:r.toUpperCase()};})).forEach(function(o){
    var opt = document.createElement('option');
    opt.value = o.v; opt.textContent = o.l;
    if ((state.cyberFilterRarita||'') === o.v) opt.selected = true;
    selRar.appendChild(opt);
  });
  selRar.onchange = function(){ state.cyberFilterRarita = this.value; renderMain(); };
  searchWrap.appendChild(selRar);

  hdr.appendChild(searchWrap);

  // Regole di installazione
  var rulesBox = document.createElement('div');
  rulesBox.style.cssText = 'margin:0 2rem 1.2rem;padding:1rem 1.25rem;background:rgba(255,180,0,0.07);border:2px solid rgba(255,180,0,0.5);position:relative;z-index:1;';
  rulesBox.innerHTML =
    '<div style="font-size:14px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#ffb800;margin-bottom:0.6rem;">⚠ PROTOCOLLO DI INSTALLAZIONE</div>' +
    '<ul style="margin:0;padding-left:1.4rem;list-style:disc;">' +
      '<li style="font-size:15px;color:#ffe08a;line-height:1.6;margin-bottom:0.5rem;">Per accedere ad un potenziamento di <strong>tipo 2</strong> bisogna prima avere quello di <strong>tipo 1</strong>.</li>' +
      '<li style="font-size:15px;color:#ffe08a;line-height:1.6;margin-bottom:0.5rem;">Quando si fa un potenziamento di tipo 2, tutti i vantaggi del tipo 1 <strong>vanno persi</strong>. Lo stesso vale per i potenziamenti di tipo 3 e tipo 4.</li>' +
      '<li style="font-size:15px;color:#ffe08a;line-height:1.6;margin-bottom:0.5rem;">Il pagamento si divide in <strong>due metà</strong>: la prima metà prima dell\'installazione, la seconda al termine. In caso di installazione fallita la seconda metà <strong>non viene addebitata</strong>, ma la prima è trattenuta.</li>' +
      '<li style="font-size:15px;color:#ffe08a;line-height:1.6;">Chi installa effettua un <strong>tiro su Medicina</strong>: CD 5 (Semplice) · CD 10 (Chirurgica) · CD 15 (Specializzata) · CD 20 (Pericolosa).</li>' +
    '</ul>';
  hdr.appendChild(rulesBox);

  wrap.appendChild(hdr);

  // Counter + filtro
  var all = (state.impiantiCibernetici||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'','it');});
  var q = (state.cyberSearch || '').toLowerCase();
  var ft = state.cyberFilterTipo || '';
  var fr = state.cyberFilterRarita || '';
  var filtered = all.filter(function(im){
    if (q && !(im.nome||'').toLowerCase().includes(q) && !(im.tipoImpianto||'').toLowerCase().includes(q) && !(im.effetto||'').toLowerCase().includes(q)) return false;
    if (ft && (im.tipoImpianto||'') !== ft) return false;
    if (fr && (im.rarita||'') !== fr) return false;
    return true;
  });

  var counterDiv = document.createElement('div');
  counterDiv.style.cssText = 'padding:0.5rem 2rem;font-size:11px;color:rgba(0,245,255,0.4);letter-spacing:0.15em;position:relative;z-index:1;';
  counterDiv.textContent = '// ' + filtered.length + ' IMPIANTI TROVATI — DATABASE_SIZE:' + all.length;
  wrap.appendChild(counterDiv);

  // Grid
  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'cyber-empty';
    empty.innerHTML = '<div class="cyber-rune">&#9881;</div><div>NESSUN IMPIANTO NEL DATABASE</div>' +
      (isDM() ? '<div style="margin-top:1rem;color:rgba(191,95,255,0.5);">> aggiungi il primo impianto per iniziare</div>' : '');
    wrap.appendChild(empty);
  } else {
    var grid = document.createElement('div');
    grid.className = 'cyber-grid';
    filtered.forEach(function(im){ grid.appendChild(renderCyberCard(im)); });
    wrap.appendChild(grid);
  }

  // Form modal
  if (state.cyberShowForm) {
    wrap.appendChild(renderCyberForm());
  }

  return wrap;
}

function renderCyberCard(im) {
  var card = document.createElement('div');
  card.className = 'cyber-card';

  // Image
  if (im.immagine) {
    var imgW = document.createElement('div');
    imgW.className = 'cyber-img-wrap';
    var img = document.createElement('img');
    img.src = im.immagine; img.alt = im.nome || '';
    img.onerror = function(){ imgW.innerHTML = '<div class="cyber-img-placeholder">&#9881;</div>'; };
    imgW.appendChild(img);
    card.appendChild(imgW);
  }

  // Head
  var head = document.createElement('div');
  head.className = 'cyber-card-head';
  var nameDiv = document.createElement('div');
  nameDiv.innerHTML = '<div class="cyber-tipo-tag">' + escapeHtml(im.tipoImpianto||'?') + '</div>' +
    '<div class="cyber-card-name">' + escapeHtml(im.nome||'Senza nome') + '</div>';
  var rarTag = document.createElement('span');
  rarTag.className = 'cyber-rarity-tag ' + _cyberRarityClass(im.rarita);
  rarTag.textContent = im.rarita || '?';
  head.appendChild(nameDiv);
  head.appendChild(rarTag);
  card.appendChild(head);

  // Body
  var body = document.createElement('div');
  body.className = 'cyber-card-body';

  if (im.effetto) {
    body.innerHTML += '<div class="cyber-label">// EFFETTO</div><div class="cyber-value">' + nl2br(escapeHtml(im.effetto)) + '</div>';
  }
  if (im.descrizione) {
    body.innerHTML += '<div class="cyber-label">// DESCRIZIONE</div><div class="cyber-value" style="color:rgba(0,245,255,0.6);font-size:12px;">' + nl2br(escapeHtml(im.descrizione)) + '</div>';
  }
  if (im.installazione) {
    body.innerHTML += '<div class="cyber-label">// INSTALLAZIONE</div><div class="cyber-value" style="color:rgba(191,95,255,0.85);font-size:12px;">' + escapeHtml(im.installazione) + '</div>';
  }
  var _cs = _textScore(im.effetto, im.descrizione);
  if (_cs > 500) card.classList.add('card--wide');
  if (_cs > 1100) { body.style.maxHeight='480px'; body.style.overflowY='auto'; }
  card.appendChild(body);

  // Footer
  var foot = document.createElement('div');
  foot.className = 'cyber-card-foot';
  var priceDiv = document.createElement('div');
  priceDiv.className = 'cyber-price';
  priceDiv.textContent = (im.costo ? im.costo + ' ' + (im.valuta||'mo') : '— PREZZO N/D');
  foot.appendChild(priceDiv);

  if (isAdmin()) {
    var btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:0.3rem;';
    var editBtn = document.createElement('button');
    editBtn.className = 'cyber-edit-btn';
    editBtn.innerHTML = ICON.edit;
    editBtn.title = 'Modifica';
    editBtn.onclick = function(){ state.cyberEditingId = im.id; state.cyberShowForm = true; renderMain(); };
    var delBtn = document.createElement('button');
    delBtn.className = 'cyber-del-btn';
    delBtn.innerHTML = ICON.trash;
    delBtn.title = 'Elimina';
    delBtn.onclick = function(){
      if (confirm('Eliminare questo impianto?')) {
        state.impiantiCibernetici = (state.impiantiCibernetici||[]).filter(function(x){ return x.id !== im.id; });
        fbSaveImpianti();
        notify('Impianto eliminato.');
        renderMain();
      }
    };
    btnWrap.appendChild(editBtn);
    btnWrap.appendChild(delBtn);
    foot.appendChild(btnWrap);
  }
  card.appendChild(foot);
  card.classList.add('sium-grid-card-enter');
  card.style.cursor = 'pointer';
  card.onclick = function(ev) {
    if (ev.target && ev.target.closest && ev.target.closest('button')) return;
    if (window.SiumAnimations) {
      if (window.SiumAnimations.triggerCardClickPulse) window.SiumAnimations.triggerCardClickPulse(card, '#00d4ff');
      if (window.SiumAnimations.openEmporioSubItemModal) window.SiumAnimations.openEmporioSubItemModal('Impianto Cibernetico', im, '#00d4ff');
    }
  };
  return card;
}

function renderCyberForm() {
  var editing = null;
  if (state.cyberEditingId) {
    (state.impiantiCibernetici||[]).forEach(function(x){ if(x.id===state.cyberEditingId) editing=x; });
  }
  var form = {
    nome: editing ? editing.nome : '',
    tipoImpianto: editing ? editing.tipoImpianto : TIPI_CYBER[0],
    rarita: editing ? editing.rarita : RARITA_CYBER[0],
    costo: editing ? editing.costo : 0,
    valuta: editing ? editing.valuta : 'mo',
    effetto: editing ? editing.effetto : '',
    descrizione: editing ? editing.descrizione : '',
    immagine: editing ? editing.immagine : '',
    installazione: editing ? editing.installazione : INSTALLAZIONE_CYBER[0]
  };

  var backdrop = document.createElement('div');
  backdrop.className = 'cyber-modal-backdrop';
  backdrop.onclick = function(e){ if(e.target===backdrop){ state.cyberShowForm=false; state.cyberEditingId=null; renderMain(); } };

  var panel = document.createElement('div');
  panel.className = 'cyber-modal-panel';
  panel.onclick = function(e){ e.stopPropagation(); };

  var mhead = document.createElement('div');
  mhead.className = 'cyber-modal-head';
  mhead.innerHTML = '<div class="cyber-modal-title">' + (editing ? '&#9998; MODIFICA IMPIANTO' : '&#43; NUOVO IMPIANTO') + '</div>';
  var closeBtn = document.createElement('button');
  closeBtn.className = 'cyber-modal-close';
  closeBtn.innerHTML = ICON.x;
  closeBtn.onclick = function(){ state.cyberShowForm=false; state.cyberEditingId=null; renderMain(); };
  mhead.appendChild(closeBtn);
  panel.appendChild(mhead);

  var mbody = document.createElement('div');
  mbody.className = 'cyber-modal-body';

  function cyberField(labelTxt, key, type, opts) {
    var g = document.createElement('div');
    g.className = 'cyber-field-group';
    var lbl = document.createElement('label');
    lbl.className = 'cyber-field-label';
    lbl.textContent = '// ' + labelTxt;
    g.appendChild(lbl);
    var el;
    if (type === 'select') {
      el = document.createElement('select');
      el.className = 'cyber-field';
      (opts||[]).forEach(function(o){
        var opt = document.createElement('option');
        opt.value = o; opt.textContent = o;
        if (form[key] === o) opt.selected = true;
        el.appendChild(opt);
      });
    } else if (type === 'textarea') {
      el = document.createElement('textarea');
      el.className = 'cyber-field';
      el.rows = 3;
      el.value = form[key];
      el.style.resize = 'vertical';
    } else {
      el = document.createElement('input');
      el.type = type || 'text';
      el.className = 'cyber-field';
      el.value = form[key];
    }
    el.onchange = function(){ form[key] = type==='number' ? (Number(this.value)||0) : this.value; };
    el.oninput = function(){ form[key] = type==='number' ? (Number(this.value)||0) : this.value; };
    g.appendChild(el);
    return g;
  }

  mbody.appendChild(cyberField('NOME IMPIANTO', 'nome', 'text'));
  mbody.appendChild(cyberField('TIPO', 'tipoImpianto', 'select', TIPI_CYBER));

  var row2 = document.createElement('div');
  row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;';
  row2.appendChild(cyberField('RARITÀ', 'rarita', 'select', RARITA_CYBER));
  row2.appendChild(cyberField('INSTALLAZIONE', 'installazione', 'select', INSTALLAZIONE_CYBER));
  mbody.appendChild(row2);

  var row3 = document.createElement('div');
  row3.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  row3.appendChild(cyberField('COSTO', 'costo', 'number'));
  row3.appendChild(cyberField('VALUTA', 'valuta', 'select', VALUTE.map(function(v){return v.code;})));
  mbody.appendChild(row3);

  mbody.appendChild(cyberField('EFFETTO', 'effetto', 'textarea'));
  mbody.appendChild(cyberField('DESCRIZIONE', 'descrizione', 'textarea'));
  mbody.appendChild(cyberField('URL IMMAGINE', 'immagine', 'text'));

  var saveBtn = document.createElement('button');
  saveBtn.className = 'cyber-save-btn';
  saveBtn.textContent = editing ? '> SALVA MODIFICHE' : '> INSTALLA NEL DATABASE';
  saveBtn.onclick = function() {
    if (!form.nome.trim()) { notify('Inserisci il nome dell\'impianto.', 'err'); return; }
    if (editing) {
      state.impiantiCibernetici = (state.impiantiCibernetici||[]).map(function(x){
        return x.id === editing.id ? Object.assign({}, form, {id: editing.id}) : x;
      });
    } else {
      var newId = 'cy_' + Date.now();
      if (!state.impiantiCibernetici) state.impiantiCibernetici = [];
      state.impiantiCibernetici.push(Object.assign({}, form, {id: newId}));
    }
    fbSaveImpianti();
    notify(editing ? 'Impianto aggiornato.' : 'Impianto aggiunto al database.');
    state.cyberShowForm = false;
    state.cyberEditingId = null;
    renderMain();
  };
  mbody.appendChild(saveBtn);

  panel.appendChild(mbody);
  backdrop.appendChild(panel);
  return backdrop;
}

function makeSelectFilter(labelText, value, options, onChange, defaultLabel, displayFn) {
  var w = document.createElement('div');
  w.style.cssText = 'min-width:140px;flex:0 1 180px;';
  w.innerHTML = '<label class="field-label">' + labelText + '</label>';
  var sel = document.createElement('select');
  sel.className = 'field';
  options.forEach(function(opt) {
    var o = document.createElement('option');
    o.value = opt;
    o.textContent = opt === '' ? defaultLabel : (displayFn ? displayFn(opt) : opt);
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = function() { onChange(this.value); };
  w.appendChild(sel);
  return w;
}

function renderActiveFilters(container) {
  container.innerHTML = '';
  var active = [];
  if (state.filtroTipo) active.push({label: state.filtroTipo, clear: function(){ state.filtroTipo=''; }});
  if (state.filtroValuta) {
    var v = null;
    VALUTE.forEach(function(x){ if (x.code === state.filtroValuta) v = x; });
    active.push({label: v ? v.label : state.filtroValuta, clear: function(){ state.filtroValuta=''; }});
  }
  if (state.filtroRarita) active.push({label: state.filtroRarita, clear: function(){ state.filtroRarita=''; }});
  if (state.search) active.push({label: '"' + state.search + '"', clear: function(){ state.search=''; }});
  if (state.emporioShowHomebrew) active.push({label: 'Homebrew incluso', clear: function(){ state.emporioShowHomebrew=false; var c=document.getElementById('emporio-homebrew-chk'); if(c) c.checked=false; }});

  if (active.length === 0) return;

  container.className = 'flex flex-wrap items-center gap-2 mt-5 pt-4 border-t';
  var lbl = document.createElement('span');
  lbl.className = 'font-display tracking-widest font-semibold';
  lbl.style.cssText = 'font-size:11px;color:var(--text-muted);';
  lbl.textContent = 'FILTRI ATTIVI:';
  container.appendChild(lbl);

  active.forEach(function(a) {
    var chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.innerHTML = escapeHtml(a.label) + ' <button>' + ICON.x + '</button>';
    chip.querySelector('button').onclick = function() {
      a.clear();
      renderMain();
    };
    container.appendChild(chip);
  });

  var clearAll = document.createElement('button');
  clearAll.style.cssText = 'background:transparent;border:none;color:var(--gold);text-decoration:underline;cursor:pointer;font-family:Cinzel,serif;font-size:11px;letter-spacing:0.2em;margin-left:0.5rem;';
  clearAll.textContent = 'Ripulisci tutto';
  clearAll.onclick = function() {
    state.filtroTipo=''; state.filtroValuta=''; state.filtroRarita=''; state.search='';
    renderMain();
  };
  container.appendChild(clearAll);
}

function updateResults() {
  var filtered = getFilteredArmi();
  var counter = document.getElementById('results-counter');
  if (counter) {
    counter.className = 'results-counter';
    if (filtered.length === state.armi.length) {
      counter.innerHTML = '<strong>' + state.armi.length + '</strong> <span class="dot"></span> <span>OGGETTI NEL COMPENDIO</span>';
    } else {
      counter.innerHTML = '<strong>' + filtered.length + '</strong> <span class="dot"></span> <span>DI ' + state.armi.length + ' OGGETTI</span>';
    }
  }

  var grid = document.getElementById('weapons-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.className = '';
    if (state.armi.length === 0) {
      grid.innerHTML = '<div class="empty-state panel-glass"><div class="rune">\u2694</div><h2>Il compendio &egrave; vuoto</h2><p>Aggiungi la prima arma al tuo database.</p><button class="btn-gold" id="empty-add">' + ICON.plus + ' Aggiungi prima arma</button></div>';
      var ea = document.getElementById('empty-add');
      if (ea) ea.onclick = function() { state.editingId = null; state.showForm = true; document.body.appendChild(renderWeaponForm()); };
    } else {
      grid.innerHTML = '<div class="empty-state panel-glass"><div class="rune">\u2694</div><h2>Nessun oggetto trovato</h2><p>I filtri attivi non corrispondono ad alcun elemento.</p><button class="btn-gold" id="empty-clear">Ripulisci i filtri</button></div>';
      var ec = document.getElementById('empty-clear');
      if (ec) ec.onclick = function() {
        state.filtroTipo=''; state.filtroValuta=''; state.filtroRarita=''; state.search='';
        renderMain();
      };
    }
    return;
  }

  grid.className = 'weapon-grid';
  filtered.forEach(function(w, idx) {
    var c = renderWeaponCard(w);
    c.style.setProperty('--card-idx', String(idx % 16));
    c.classList.add('sium-grid-card-enter');
    grid.appendChild(c);
  });
}

function renderWeaponCard(w) {
  var card = document.createElement('article');
  card.className = 'weapon-card';
  card.style.cursor = 'pointer';
  card.onclick = function() {
    if (window.SiumAnimations && window.SiumAnimations.triggerCardClickPulse) {
      window.SiumAnimations.triggerCardClickPulse(card);
    }
    openDetailModal('arma', w);
  };

  var img = document.createElement('div');
  img.className = 'card-image-wrap';
  if (w.immagine) {
    var im = document.createElement('img');
    im.alt = w.nome;
    im.src = w.immagine;
    im.onerror = function() {
      this.onerror = null;
      this.src = 'path/to/default-pirate-item.png';
    };
    img.appendChild(im);
  } else {
    var im = document.createElement('img');
    im.alt = w.nome;
    im.src = 'path/to/default-pirate-item.png';
    img.appendChild(im);
  }
  var rt = document.createElement('div');
  rt.style.cssText = 'position:absolute;top:12px;right:12px;z-index:2;';
  rt.innerHTML = '<span class="rarity-tag ' + rarityClass(w.rarita) + '">' + escapeHtml(w.rarita) + '</span>';
  img.appendChild(rt);
  card.appendChild(img);

  var body = document.createElement('div');
  body.className = 'card-body';
  var sintoniaTag = w.sintonia ? ' <span style="font-size:11px;color:#c97f7f;font-weight:bold;margin-left:8px;">(Richiede sintonia)</span>' : '';
  body.innerHTML =
    '<div class="type-chip mb-2">' + escapeHtml(w.tipo) + sintoniaTag + '</div>' +
    '<h3 class="font-display font-bold text-lg mb-2" style="color:var(--gold-bright);line-height:1.25;margin:0 0 0.5rem;">' + escapeHtml(w.nome) + '</h3>' +
    '<p style="font-size:14px;line-height:1.55;color:var(--text-main);flex:1;margin:0 0 1rem;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;">' + (w.descrizione ? nl2br(escapeHtml(w.descrizione)) : '<em style="color:var(--text-muted)">Nessuna descrizione.</em>') + '</p>';

  var foot = document.createElement('div');
  foot.className = 'flex items-center justify-between pt-3 border-t';
  var priceDiv = '<div></div>';
  if (isAdmin()) {
    foot.innerHTML = priceDiv +
      '<div class="flex gap-1"><button class="btn-dark edit-btn" title="Modifica" style="padding:0.4rem 0.65rem;">' + ICON.edit + '</button>' +
      '<button class="btn-blood del-btn" title="Elimina" style="padding:0.4rem 0.65rem;">' + ICON.trash + '</button></div>';
    foot.querySelector('.edit-btn').onclick = function(e) { e.stopPropagation(); state.editingId = w.id; state.showForm = true; document.body.appendChild(renderWeaponForm()); };
    foot.querySelector('.del-btn').onclick = function(e) {
      e.stopPropagation();
      if (confirm('Eliminare questa arma dal database?')) {
        state.armi = state.armi.filter(function(x){ return x.id !== w.id; });
        fbSaveArmi();
        notify('Arma eliminata.');
        updateResults();
      }
    };
  } else {
    foot.innerHTML = priceDiv;
  }
  body.appendChild(foot);
  card.appendChild(body);
  return card;
}

function saveArmi() {
  try {
    var json = JSON.stringify(state.armi, null, 2);
    var blob = new Blob([json], {type:'application/json'});
    triggerDownload(blob, 'database_armi.json');
    notify('Database scaricato. Salvalo nella tua chiavetta.');
  } catch (e) { notify('Errore: ' + e.message, 'err'); }
}

function loadArmi() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = function(e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('File non contiene un array.');
        state.armi = data.map(function(w, i) {
          return {
            id: w.id || ('w_' + Date.now() + '_' + i),
            nome: w.nome || 'Senza nome',
            descrizione: w.descrizione || '',
            tipo: w.tipo || TIPI[0],
            rarita: w.rarita || RARITA[0],
            valuta: w.valuta || 'mo',
            prezzo: Number(w.prezzo) || 0,
            immagine: w.immagine || ''
          };
        });
        fbSaveArmi();
        notify('Caricate ' + state.armi.length + ' armi.');
        renderMain();
      } catch (err) { notify('Errore: ' + err.message, 'err'); }
    };
    r.readAsText(f);
  };
  input.click();
}

function triggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 100);
}

function renderWeaponForm() {
  var editing = null;
  if (state.editingId) {
    state.armi.forEach(function(w){ if (w.id === state.editingId) editing = w; });
  }
  var form = {
    nome: editing ? editing.nome : '',
    descrizione: editing ? editing.descrizione : '',
    tipo: editing ? editing.tipo : TIPI[0],
    rarita: editing ? editing.rarita : RARITA[0],
    immagine: editing ? editing.immagine : '',
    sintonia: editing ? !!editing.sintonia : false
  };

  var back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.id = 'modal-root';
  back.onclick = function(e) { if (e.target === back) closeForm(); };

  var panel = document.createElement('div');
  panel.className = 'modal-panel';

  var head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML =
    '<div><div class="font-display font-semibold tracking-widest" style="font-size:11px;color:var(--gold-dim);margin-bottom:0.25rem;">' + (editing ? 'MODIFICA' : 'AGGIUNGI') + '</div>' +
    '<h2 class="font-display font-bold" style="font-size:20px;color:var(--gold-bright);margin:0;">' + (editing ? 'Modifica Oggetto' : 'Nuovo Oggetto') + '</h2></div>' +
    '<button class="theme-toggle" style="width:38px;height:38px;">' + ICON.x + '</button>';
  head.querySelector('button').onclick = closeForm;
  panel.appendChild(head);

  var body = document.createElement('form');
  body.className = 'modal-body';
  body.onsubmit = function(e) { e.preventDefault(); submitForm(); };

  function addField(labelText, type, key, opts) {
    opts = opts || {};
    var d = document.createElement('div');
    d.innerHTML = '<label class="field-label">' + labelText + '</label>';
    var inp;
    if (type === 'textarea') {
      inp = document.createElement('textarea');
      inp.rows = 4;
    } else if (type === 'select') {
      inp = document.createElement('select');
      opts.options.forEach(function(o) {
        var op = document.createElement('option');
        op.value = o.value; op.textContent = o.label;
        if (form[key] === o.value) op.selected = true;
        inp.appendChild(op);
      });
    } else {
      inp = document.createElement('input');
      inp.type = type;
      if (type === 'number') { inp.min = '0'; inp.step = '1'; }
    }
    inp.className = 'field';
    if (type === 'checkbox') {
      inp.checked = !!form[key];
      inp.onchange = function() { form[key] = this.checked; };
      inp.style.width = 'auto';
    } else {
      inp.value = form[key];
      inp.oninput = function() { form[key] = this.value; };
      inp.onchange = function() { form[key] = this.value; };
    }
    if (opts.placeholder) inp.placeholder = opts.placeholder;
    d.appendChild(inp);
    if (opts.hint) {
      var h = document.createElement('p');
      h.style.cssText = 'font-size:12px;font-style:italic;color:var(--text-muted);margin:0.5rem 0 0;';
      h.innerHTML = opts.hint;
      d.appendChild(h);
    }
    return d;
  }

  body.appendChild(addField('Nome *', 'text', 'nome', {placeholder:"es. Lama dell'Alba"}));
  body.appendChild(addField('Descrizione', 'textarea', 'descrizione', {placeholder:'Storia, propriet\u00E0 magiche, particolarit\u00E0...'}));

  var row1 = document.createElement('div');
  row1.className = 'form-row';
  row1.appendChild(addField('Tipo', 'select', 'tipo', {options: TIPI.map(function(t){return {value:t,label:t};})}));
  row1.appendChild(addField('Rarit\u00E0', 'select', 'rarita', {options: RARITA.map(function(r){return {value:r,label:r};})}));
  body.appendChild(row1);

  body.appendChild(addField('URL Immagine', 'text', 'immagine', {placeholder:'img/spada-alba.png', hint:'Usa un percorso relativo come <code>img/nomearma.png</code>.'}));
  body.appendChild(addField('Richiede Sintonia', 'checkbox', 'sintonia'));
  var actions = document.createElement('div');
  actions.className = 'flex gap-3 pt-3';
  actions.style.cssText = 'flex-wrap:wrap-reverse;';
  var cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn-dark';
  cancel.style.cssText = 'flex:1;padding:0.65rem 1.25rem;';
  cancel.textContent = 'Annulla';
  cancel.onclick = closeForm;
  actions.appendChild(cancel);
  var submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn-gold';
  submit.style.cssText = 'flex:1;padding:0.65rem 1.25rem;';
  submit.innerHTML = ICON.sparkle + ' ' + (editing ? 'Salva Modifiche' : 'Aggiungi al Compendio');
  actions.appendChild(submit);
  body.appendChild(actions);

  panel.appendChild(body);
  back.appendChild(panel);

  function submitForm() {
    if (!form.nome.trim()) { alert('Il nome è obbligatorio.'); return; }
    if (editing) {
      state.armi = state.armi.map(function(w) {
        if (w.id !== state.editingId) return w;
        var copy = {};
        for (var k in w) copy[k] = w[k];
        for (var k2 in form) copy[k2] = form[k2];
        return copy;
      });
      notify('Arma aggiornata.');
    } else {
      var newW = {id: 'w_' + Date.now()};
      for (var k in form) newW[k] = form[k];
      state.armi = [newW].concat(state.armi);
      notify('Arma aggiunta al database.');
    }
    fbSaveArmi();
    closeForm();
  }
  return back;
}

function closeForm() {
  state.showForm = false;
  state.editingId = null;
  var m = document.getElementById('modal-root');
  if (m) m.remove();
  if (state.section === 'emporio') updateResults(); else renderMain();
}

/* INIZIATIVA */
function ensureTrailingEmpty() {
  if (state.combatants.length === 0) {
    state.combatants.push(makeEmptyCombatant());
    return;
  }
  var last = state.combatants[state.combatants.length - 1];
  var hasContent = (last.nome && last.nome.trim() !== '') ||
                   (last.iniziativa !== '' && last.iniziativa !== null && last.iniziativa !== undefined);
  if (hasContent) state.combatants.push(makeEmptyCombatant());
}

/* ============================================================
   INIZIATIVA — riscritta da zero
   Principio: lo state è la fonte di verità.
   La UI legge lo state e basta. Firebase aggiorna lo state
   degli altri utenti; la UI locale non viene mai distrutta
   mentre si digita.
   ============================================================ */


/* ============================================================================
   SEZIONE 5: TRACKER INIZIATIVA, COMBATTIMENTO & ENCOUNTER BUILDER
   ============================================================================ */
function renderIniziativa() {
  var wrap = document.createElement('div');

  // HEADER
  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';

  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  top.innerHTML = '<div><div class="header-eyebrow mb-3"><span>Tomo del Conflitto</span></div>' +
    '<h1 class="header-title">Ordine di Iniziativa</h1>' +
    '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Gestore dinamico per personaggi, boss e condizioni di gioco</p></div>';

  var actions = document.createElement('div');
  actions.className = 'flex flex-wrap items-center gap-2';

  var rc = document.createElement('div');
  rc.className = 'round-counter';
  rc.innerHTML = '<span>ROUND</span><span class="round-num">' + state.round + '</span>';
  actions.appendChild(rc);

  if (isDM()) {
    var nb = document.createElement('button');
    nb.className = 'btn-gold';
    nb.innerHTML = ICON.arrowRight + ' Prossimo Turno';
    nb.onclick = nextTurn;
    actions.appendChild(nb);

    var rb = document.createElement('button');
    rb.className = 'btn-blood';
    rb.innerHTML = ICON.refresh + ' Reset';
    rb.onclick = function() {
      if (!confirm('Azzerare il combattimento?')) return;
      state.combatants = [makeEmptyCombatant()];
      state.round = 1;
      state.activeIndex = 0;
      state.expandedCondition = null;
      state.assigningCondId = null;
      fbSaveIniziativa(true);
      renderMain();
    };
    actions.appendChild(rb);
  }

  top.appendChild(actions);
  hc.appendChild(top);

  var fd = document.createElement('div');
  fd.className = 'filigree-divider mt-7';
  hc.appendChild(fd);

  var notice = document.createElement('div');
  notice.className = 'notice mt-5';
  notice.innerHTML = '<strong style="color:var(--gold);font-style:normal;">&#x1F4DC; Istruzioni: </strong>' +
    'scrivi il nome e il valore di <em>iniziativa</em>. Premi <em>Invio</em> per aggiungere un altro combattente.';
  hc.appendChild(notice);
  header.appendChild(hc);
  wrap.appendChild(header);

  // BODY
  var section = document.createElement('section');
  section.className = 'container-main pb-20';
  section.style.cssText = 'padding-top:2rem;';

  var layout = document.createElement('div');
  layout.className = 'initiative-layout';

  var left = document.createElement('div');

  // Toolbar
  var toolbar = document.createElement('div');
  toolbar.className = 'combatants-toolbar';
  var namedCount = state.combatants.filter(function(c){ return c.nome && c.nome.trim(); }).length;
  var addBtnStr = isDM() ? '<button class="add-icon-btn" title="Aggiungi combattente">' + ICON.plus + '</button>' : '';
  toolbar.innerHTML = '<div class="toolbar-title">Combattenti <span class="toolbar-count">(' + namedCount + ')</span></div><div>' + addBtnStr + '</div>';

  var addIconBtn = toolbar.querySelector('.add-icon-btn');
  if (addIconBtn) {
    addIconBtn.onclick = function() {
      addCombatant();
    };
  }
  left.appendChild(toolbar);

  // Lista combattenti
  var listEl = document.createElement('div');
  listEl.id = 'combatants-list';
  left.appendChild(listEl);

  // Pulsante thin in fondo
  if (isDM()) {
    var thin = document.createElement('div');
    thin.className = 'add-combatant-thin mt-3';
    thin.innerHTML = ICON.plus + '<span>Nuovo combattente</span>';
    thin.onclick = function() { addCombatant(); };
    left.appendChild(thin);
  }

  layout.appendChild(left);

  var right = document.createElement('aside');
  right.className = 'conditions-panel';
  right.id = 'conditions-panel';
  layout.appendChild(right);

  section.appendChild(layout);
  wrap.appendChild(section);

  // Render lista e condizioni dopo che il DOM è pronto
  setTimeout(function() {
    renderCombatantsList();
    renderConditionsPanel();
  }, 0);

  return wrap;
}

// Aggiunge un combattente e fa focus sul nuovo input
function addCombatant() {
  var newC = makeEmptyCombatant();
  state.combatants.push(newC);
  // NON salvare su Firebase la riga vuota — lo faremo quando l'utente la riempie
  renderCombatantsList();
  updateToolbarCount();
  setTimeout(function() {
    var inputs = document.querySelectorAll('.combatant-name-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 30);
}

function updateToolbarCount() {
  var tc = document.querySelector('.toolbar-count');
  if (tc) {
    var n = state.combatants.filter(function(c){ return c.nome && c.nome.trim(); }).length;
    tc.textContent = '(' + n + ')';
  }
}

function renderIniziativaBody() {
  renderCombatantsList();
  renderConditionsPanel();
  updateToolbarCount();
  var rn = document.querySelector('.round-num');
  if (rn) rn.textContent = state.round;
}

function getOrderedActive() {
  return state.combatants
    .filter(function(c){ return c.nome && c.nome.trim() !== ''; })
    .sort(function(a, b){ return (Number(b.iniziativa) || 0) - (Number(a.iniziativa) || 0); });
}

function renderCombatantsList() {
  var list = document.getElementById('combatants-list');
  if (!list) return;

  var ordered = getOrderedActive();
  var activeId = ordered[state.activeIndex] ? ordered[state.activeIndex].id : null;

  // Aggiornamento chirurgico: aggiorna le card esistenti se possibile,
  // aggiunge/rimuove solo le differenze. Non distrugge mai i campi attivi.
  var existingCards = Array.from(list.children);
  var existingIds = existingCards.map(function(el){ return el.dataset.combatantId; });
  var newIds = state.combatants.map(function(c){ return c.id; });

  // Rimuovi card non più presenti
  existingCards.forEach(function(el) {
    if (newIds.indexOf(el.dataset.combatantId) === -1) {
      list.removeChild(el);
    }
  });

  // Aggiorna o inserisci in ordine
  state.combatants.forEach(function(c, idx) {
    var isActive = (c.id === activeId);
    var existing = list.querySelector('[data-combatant-id="' + c.id + '"]');

    if (existing) {
      // Card già esistente: aggiorna solo badge, classe attiva, e metti nella posizione giusta
      updateCombatantCard(existing, c, isActive);
      // Riposiziona se necessario (senza distruggere)
      var currentIdx = Array.from(list.children).indexOf(existing);
      if (currentIdx !== idx) {
        list.insertBefore(existing, list.children[idx] || null);
      }
    } else {
      // Card nuova: creala e inseriscila nella posizione giusta
      var newCard = buildCombatantCard(c, isActive);
      var refNode = list.children[idx] || null;
      list.insertBefore(newCard, refNode);
    }
  });
}

// Aggiorna solo gli aspetti non-input di una card esistente
// (badge, classe attiva, ecc.) senza toccare gli input
function updateCombatantCard(cardEl, c, isActive) {
  if (!Array.isArray(c.condizioni)) c.condizioni = [];
  var cat = getCategoria(c.tipo);
  var condClasses = c.condizioni.map(function(cid){
    var co = getCondizione(cid); return co ? co.cssClass : '';
  }).filter(Boolean).join(' ');
  var hasAnyCond = c.condizioni.length > 0;
  cardEl.className = 'combatant-card ' + cat.cssClass + ' ' + condClasses +
    (isActive ? ' is-active' : '') + (hasAnyCond ? ' has-conditions' : '');

  // Aggiorna badge categoria
  var badge = cardEl.querySelector('.category-badge');
  if (badge) {
    badge.className = 'category-badge ' + cat.badgeClass;
    badge.textContent = cat.label;
  }

  // Aggiorna select categoria (se presente e non ha focus)
  var sel = cardEl.querySelector('.category-select');
  if (sel && document.activeElement !== sel) {
    sel.value = c.tipo;
  }

  // Aggiorna HP input (se non ha focus)
  var hpInput = cardEl.querySelector('.hp-control input');
  if (hpInput && document.activeElement !== hpInput) {
    hpInput.value = c.hp;
  }

  // Aggiorna initInput (se non ha focus)
  var initInput = cardEl.querySelector('.combatant-init input');
  if (initInput && document.activeElement !== initInput) {
    initInput.value = c.iniziativa;
  }

  // Aggiorna nameInput (se non ha focus)
  var nameInput = cardEl.querySelector('.combatant-name-input');
  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = c.nome;
  }

  // Aggiorna condizioni attive
  var ac = cardEl.querySelector('.active-conditions');
  if (c.condizioni.length > 0) {
    if (!ac) {
      ac = document.createElement('div');
      ac.className = 'active-conditions';
      cardEl.appendChild(ac);
    }
    ac.innerHTML = '';
    c.condizioni.forEach(function(cid) {
      var co = getCondizione(cid);
      if (!co) return;
      var b = document.createElement('span');
      b.className = 'condition-badge';
      var style = conditionBadgeStyle(cid);
      b.style.cssText = 'background:' + style.bg + ';color:' + style.color + ';border-color:' + style.border + ';';
      b.title = co.descrizione[0];
      b.innerHTML = '<span>' + co.icon + '</span><span>' + co.nome + '</span><button title="Rimuovi">' + ICON.x + '</button>';
      b.querySelector('button').onclick = function() {
        c.condizioni = c.condizioni.filter(function(x){ return x !== cid; });
        fbSaveIniziativa(true);
        renderCombatantsList();
      };
      ac.appendChild(b);
    });
  } else if (ac) {
    cardEl.removeChild(ac);
  }
}

// Costruisce una card da zero (solo per nuovi combattenti)
function buildCombatantCard(c, isActive) {
  if (!Array.isArray(c.condizioni)) c.condizioni = [];
  var cat = getCategoria(c.tipo);
  var condClasses = c.condizioni.map(function(cid){
    var co = getCondizione(cid); return co ? co.cssClass : '';
  }).filter(Boolean).join(' ');
  var hasAnyCond = c.condizioni.length > 0;
  var isNamed = c.nome && c.nome.trim() !== '';

  var card = document.createElement('div');
  card.className = 'combatant-card ' + cat.cssClass + ' ' + condClasses +
    (isActive ? ' is-active' : '') + (hasAnyCond ? ' has-conditions' : '');
  card.dataset.combatantId = c.id;

  // La card è sempre drop target (il drag parte solo dall'handle)
  card.ondragover = function(e) {
    e.preventDefault();
    if (c.id !== _dragSrcId) card.classList.add('drag-over');
  };
  card.ondragleave = function(e) {
    if (!card.contains(e.relatedTarget)) card.classList.remove('drag-over');
  };
  card.ondrop = function(e) {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (!_dragSrcId || _dragSrcId === c.id) return;
    var srcIdx = -1, dstIdx = -1;
    state.combatants.forEach(function(x, i) {
      if (x.id === _dragSrcId) srcIdx = i;
      if (x.id === c.id) dstIdx = i;
    });
    if (srcIdx < 0 || dstIdx < 0) return;
    var moved = state.combatants.splice(srcIdx, 1)[0];
    state.combatants.splice(dstIdx, 0, moved);
    _dragSrcId = null;
    fbSaveIniziativa(true);
    renderCombatantsList();
  };

  // Layer condizioni atmosferiche
  function addCondLayer(condId, className, childrenHtml) {
    if (c.condizioni.indexOf(condId) < 0) return;
    var el = document.createElement('div');
    el.className = 'fx-layer ' + className;
    if (childrenHtml) el.innerHTML = childrenHtml;
    card.appendChild(el);
  }
  addCondLayer('accecato','fx-blind','');
  addCondLayer('affascinato','fx-charm','<span class="heart"></span><span class="heart"></span><span class="heart"></span><span class="heart"></span><span class="heart"></span><span class="heart"></span>');
  addCondLayer('afferrato','fx-grappled','<div class="chain tl"></div><div class="chain tr"></div><div class="chain bl"></div><div class="chain br"></div>');
  addCondLayer('assordato','fx-deaf','');
  addCondLayer('avvelenato','fx-poison','<span class="bubble"></span><span class="bubble"></span><span class="bubble"></span><span class="bubble"></span><span class="bubble"></span><span class="bubble"></span>');
  addCondLayer('incapacitato','fx-incap','<span class="ash"></span><span class="ash"></span><span class="ash"></span><span class="ash"></span><span class="ash"></span><span class="ash"></span><span class="ash"></span><span class="ash"></span>');
  addCondLayer('invisibile','fx-invisible','');
  addCondLayer('paralizzato','fx-paralyzed','<div class="bolt top"></div><div class="bolt bottom"></div><div class="bolt left"></div><div class="bolt right"></div>');
  addCondLayer('pietrificato','fx-stone','');
  if (c.condizioni.indexOf('pietrificato') >= 0) {
    var cracks = document.createElement('div');
    cracks.className = 'fx-layer fx-stone-cracks';
    card.appendChild(cracks);
  }
  addCondLayer('priv-di-sensi','fx-unconscious','');
  addCondLayer('spaventato','fx-fear','<div class="ghost"></div><div class="ghost"></div><div class="ghost"></div>');
  addCondLayer('stordito','fx-stunned','<div class="spark-orbit"><div class="extra-spark"></div></div>');
  addCondLayer('trattenuto','fx-restrained','<div class="web tl"></div><div class="web tr"></div><div class="web bl"></div><div class="web br"></div>');
  addCondLayer('indebolito','fx-weakened','<div class="drain"></div><div class="drain"></div><div class="drain"></div><div class="drain"></div><div class="drain"></div><div class="drain"></div>');
  if (c.condizioni.indexOf('prono') >= 0) {
    var proneH = document.createElement('div');
    proneH.className = 'fx-layer fx-prone-hearts';
    proneH.innerHTML = svgHardcoreHeart() + svgHardcoreHeart() + svgHardcoreHeart();
    card.appendChild(proneH);
  }

  // Header della card
  var header = document.createElement('div');
  header.className = 'combatant-header';

  // Drag handle — il drag parte da qui, non dalla card intera
  if (isNamed) {
    var dh = document.createElement('div');
    dh.className = 'drag-handle';
    dh.title = 'Trascina per riordinare';
    dh.innerHTML = ICON.dragHandle;
    dh.draggable = true;
    dh.ondragstart = function(e) {
      _dragSrcId = c.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', c.id);
    };
    dh.ondragend = function() {
      card.classList.remove('dragging');
      document.querySelectorAll('.combatant-card.drag-over').forEach(function(el){
        el.classList.remove('drag-over');
      });
    };
    header.appendChild(dh);
  }

  // Input iniziativa
  var initEl = document.createElement('div');
  initEl.className = 'combatant-init';
  initEl.title = 'Iniziativa';
  var initInput = document.createElement('input');
  initInput.type = 'number';
  initInput.value = c.iniziativa;
  initInput.placeholder = '\u2014';
  initInput.oninput = function() {
    c.iniziativa = this.value;
    ensureTrailingEmpty();
    fbSaveIniziativa(); // debounce
  };
  initEl.appendChild(initInput);
  header.appendChild(initEl);

  // Input nome
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'combatant-name-input';
  nameInput.value = c.nome;
  nameInput.placeholder = 'Nome del combattente...';
  nameInput.dataset.cid = c.id;
  nameInput.oninput = function() {
    var wasEmpty = !c.nome || !c.nome.trim();
    c.nome = this.value;
    var nowHas = !!(c.nome && c.nome.trim());

    if (wasEmpty && nowHas) {
      // Ha iniziato a scrivere: assicura riga vuota in fondo
      ensureTrailingEmpty();
      // Aggiunge la nuova card vuota SENZA distruggere quella corrente
      var list = document.getElementById('combatants-list');
      if (list) {
        var lastC = state.combatants[state.combatants.length - 1];
        var alreadyThere = list.querySelector('[data-combatant-id="' + lastC.id + '"]');
        if (!alreadyThere) {
          var newCard = buildCombatantCard(lastC, false);
          list.appendChild(newCard);
        }
      }
      updateToolbarCount();
      // Aggiunta drag handle con eventi quando il nome appare per la prima volta
      if (!card.querySelector('.drag-handle')) {
        var dh2 = document.createElement('div');
        dh2.className = 'drag-handle';
        dh2.title = 'Trascina per riordinare';
        dh2.innerHTML = ICON.dragHandle;
        dh2.draggable = true;
        dh2.ondragstart = function(e) {
          _dragSrcId = c.id;
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', c.id);
        };
        dh2.ondragend = function() {
          card.classList.remove('dragging');
          document.querySelectorAll('.combatant-card.drag-over').forEach(function(el){
            el.classList.remove('drag-over');
          });
        };
        header.insertBefore(dh2, header.firstChild);
      }
    } else if (!nowHas && !wasEmpty) {
      updateToolbarCount();
    }

    fbSaveIniziativa(); // debounce
  };
  nameInput.onkeydown = function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Aggiungi un nuovo combattente e vai al suo input
      var newC = makeEmptyCombatant();
      state.combatants.push(newC);
      var list = document.getElementById('combatants-list');
      if (list) {
        var newCard = buildCombatantCard(newC, false);
        list.appendChild(newCard);
        setTimeout(function() {
          var ni = newCard.querySelector('.combatant-name-input');
          if (ni) ni.focus();
        }, 0);
      }
      fbSaveIniziativa(); // debounce — non necessario salvare subito una riga vuota
    }
  };
  header.appendChild(nameInput);

  // Badge categoria
  var badge = document.createElement('span');
  badge.className = 'category-badge ' + cat.badgeClass;
  badge.textContent = cat.label;
  header.appendChild(badge);

  // Select categoria (solo DM)
  if (isDM()) {
    var sel = document.createElement('select');
    sel.className = 'category-select';
    CATEGORIE.forEach(function(ct) {
      var op = document.createElement('option');
      op.value = ct.id;
      op.textContent = ct.label;
      if (ct.id === c.tipo) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function() {
      c.tipo = this.value;
      fbSaveIniziativa(true);
      // Aggiorna solo badge e classe della card corrente
      var updCat = getCategoria(c.tipo);
      badge.className = 'category-badge ' + updCat.badgeClass;
      badge.textContent = updCat.label;
      renderConditionsPanel();
    };
    header.appendChild(sel);
  }

  // HP
  var hpW = document.createElement('div');
  hpW.className = 'hp-control';
  hpW.title = 'Punti Ferita';
  hpW.innerHTML = '<span>HP</span>';
  var isMonster = (c.tipo === 'boss' || c.tipo === 'sgherri');
  var hpInput = document.createElement('input');
  hpInput.type = 'number';
  hpInput.value = c.hp;
  hpInput.placeholder = '\u2014';
  if (isDM() || !isMonster) {
    hpInput.oninput = function() {
      c.hp = this.value;
      fbSaveIniziativa();
    };
  } else {
    hpInput.readOnly = true;
    hpInput.style.cssText = 'pointer-events:none;opacity:0.75;';
  }
  hpW.appendChild(hpInput);
  header.appendChild(hpW);

  // Pulsante elimina (solo DM)
  if (isDM()) {
    var del = document.createElement('button');
    del.className = 'row-delete';
    del.title = 'Rimuovi';
    del.innerHTML = ICON.x;
    del.onclick = function() {
      state.combatants = state.combatants.filter(function(x){ return x.id !== c.id; });
      if (state.combatants.length === 0) state.combatants = [makeEmptyCombatant()];
      ensureTrailingEmpty();
      fbSaveIniziativa(true);
      // Rimuove solo questa card dal DOM, senza ricostruire tutto
      if (card.parentNode) card.parentNode.removeChild(card);
      updateToolbarCount();
      renderConditionsPanel();
    };
    header.appendChild(del);
  }

  card.appendChild(header);

  // Condizioni attive in fondo alla card
  if (c.condizioni.length > 0) {
    var ac = document.createElement('div');
    ac.className = 'active-conditions';
    c.condizioni.forEach(function(cid) {
      var co = getCondizione(cid);
      if (!co) return;
      var b = document.createElement('span');
      b.className = 'condition-badge';
      var style = conditionBadgeStyle(cid);
      b.style.cssText = 'background:' + style.bg + ';color:' + style.color + ';border-color:' + style.border + ';';
      b.title = co.descrizione[0];
      b.innerHTML = '<span>' + co.icon + '</span><span>' + co.nome + '</span><button title="Rimuovi">' + ICON.x + '</button>';
      b.querySelector('button').onclick = function() {
        c.condizioni = c.condizioni.filter(function(x){ return x !== cid; });
        fbSaveIniziativa(true);
        renderCombatantsList();
      };
      ac.appendChild(b);
    });
    card.appendChild(ac);
  }

  return card;
}

function conditionBadgeStyle(condId) {
  var palette = {
    accecato:{bg:'rgba(40,40,40,0.4)',color:'#cccccc',border:'rgba(120,120,120,0.6)'},
    affascinato:{bg:'rgba(200,100,160,0.2)',color:'#ffb0d4',border:'rgba(233,139,184,0.6)'},
    afferrato:{bg:'rgba(139,98,56,0.25)',color:'#d4a070',border:'rgba(139,98,56,0.6)'},
    assordato:{bg:'rgba(104,120,160,0.2)',color:'#a8b8d8',border:'rgba(104,120,160,0.6)'},
    avvelenato:{bg:'rgba(60,140,60,0.25)',color:'#9eda9e',border:'rgba(93,179,93,0.6)'},
    incapacitato:{bg:'rgba(100,100,100,0.25)',color:'#cccccc',border:'rgba(140,140,140,0.6)'},
    invisibile:{bg:'rgba(180,220,255,0.15)',color:'#c8e0f8',border:'rgba(180,220,255,0.7)'},
    paralizzato:{bg:'rgba(79,168,232,0.22)',color:'#a8d0f0',border:'rgba(79,168,232,0.65)'},
    pietrificato:{bg:'rgba(140,140,140,0.3)',color:'#d0d0d0',border:'rgba(160,160,160,0.6)'},
    'priv-di-sensi':{bg:'rgba(74,56,112,0.3)',color:'#c0a8e0',border:'rgba(120,90,170,0.6)'},
    prono:{bg:'rgba(160,120,72,0.22)',color:'#e0b888',border:'rgba(160,120,72,0.6)'},
    spaventato:{bg:'rgba(157,95,200,0.25)',color:'#d8b0f0',border:'rgba(157,95,200,0.65)'},
    stordito:{bg:'rgba(232,200,79,0.22)',color:'#ffe480',border:'rgba(232,200,79,0.65)'},
    trattenuto:{bg:'rgba(184,148,106,0.25)',color:'#e0c098',border:'rgba(184,148,106,0.6)'},
    indebolito:{bg:'rgba(176,104,104,0.25)',color:'#e0a0a0',border:'rgba(176,104,104,0.6)'}
  };
  return palette[condId] || {bg:'rgba(201,165,92,0.2)',color:'var(--gold-bright)',border:'var(--gold)'};
}

function nextTurn() {
  var ordered = getOrderedActive();
  if (ordered.length === 0) return;
  state.activeIndex++;
  if (state.activeIndex >= ordered.length) {
    state.activeIndex = 0;
    state.round++;
  }
  fbSaveIniziativa(true);
  renderIniziativaBody();
}

function renderConditionsPanel() {
  var panel = document.getElementById('conditions-panel');
  if (!panel) return;
  panel.innerHTML = '';

  var hd = document.createElement('div');
  hd.innerHTML = '<div class="header-eyebrow" style="font-size:10px;margin-bottom:0.5rem;"><span>Grimorio</span></div>' +
    '<h2 class="font-display font-bold mb-2" style="font-size:18px;color:var(--gold-bright);margin:0 0 0.5rem;">Condizioni</h2>' +
    '<p class="font-script italic" style="font-size:14px;color:var(--text-muted);margin:0 0 0.75rem;">Clicca un nome per espandere la descrizione. Usa <em>Assegna</em> per applicarla.</p>';
  panel.appendChild(hd);

  var listEl = document.createElement('div');
  CONDIZIONI.forEach(function(cond) {
    var item = document.createElement('div');
    item.className = 'condition-item' + (state.expandedCondition === cond.id ? ' expanded' : '');

    var head = document.createElement('div');
    head.className = 'condition-head';
    head.innerHTML =
      '<div class="condition-name"><span style="font-size:14px;">' + cond.icon + '</span><span>' + cond.nome + '</span></div>' +
      '<div class="condition-actions"><button class="condition-assign-btn">' +
      (state.assigningCondId === cond.id ? 'Chiudi' : 'Assegna') + '</button>' +
      '<span style="color:var(--gold-dim);font-size:10px;' +
      (state.expandedCondition === cond.id ? 'transform:rotate(90deg);display:inline-block;' : '') +
      '">\u25B6</span></div>';

    head.onclick = function(e) {
      if (e.target.tagName === 'BUTTON') return;
      state.expandedCondition = (state.expandedCondition === cond.id) ? null : cond.id;
      renderConditionsPanel();
    };
    head.querySelector('.condition-assign-btn').onclick = function(e) {
      e.stopPropagation();
      state.assigningCondId = (state.assigningCondId === cond.id) ? null : cond.id;
      if (state.assigningCondId && state.expandedCondition !== cond.id) state.expandedCondition = cond.id;
      renderConditionsPanel();
    };
    item.appendChild(head);

    if (state.expandedCondition === cond.id) {
      var body = document.createElement('div');
      body.className = 'condition-body';
      cond.descrizione.forEach(function(p) {
        var pe = document.createElement('p');
        pe.textContent = p;
        body.appendChild(pe);
      });

      if (state.assigningCondId === cond.id) {
        var pop = document.createElement('div');
        pop.className = 'assign-popover';
        pop.innerHTML = '<div class="popover-title">Applica a:</div>';
        var tl = document.createElement('div');
        tl.className = 'target-list';
        var targets = getOrderedActive();
        if (targets.length === 0) {
          tl.innerHTML = '<div style="font-style:italic;font-size:12px;color:var(--text-faint);padding:0.4rem 0;text-align:center;">Nessun combattente con nome.</div>';
        } else {
          targets.forEach(function(t) {
            var has = t.condizioni.indexOf(cond.id) >= 0;
            var b = document.createElement('button');
            b.className = 'target-btn' + (has ? ' has-condition' : '');
            var suffix = '';
            if (t.tipo && t.tipo !== 'pg') {
              var tcat = getCategoria(t.tipo);
              var palette = {boss:'#ff9c9c', npc:'#d8d8e8', sgherri:'#d8e090'};
              suffix = ' <span style="color:' + (palette[tcat.id] || 'var(--gold)') + ';margin-left:4px;font-size:11px;">(' + tcat.label + ')</span>';
            }
            b.innerHTML = (has ? '\u2713 ' : '') + escapeHtml(t.nome) + suffix;
            b.onclick = function() {
              if (has) {
                t.condizioni = t.condizioni.filter(function(x){ return x !== cond.id; });
              } else {
                t.condizioni.push(cond.id);
              }
              fbSaveIniziativa(true);
              renderCombatantsList();
              renderConditionsPanel();
            };
            tl.appendChild(b);
          });
        }
        pop.appendChild(tl);
        body.appendChild(pop);
      }
      item.appendChild(body);
    }
    listEl.appendChild(item);
  });
  panel.appendChild(listEl);
}

/* NOTE */
function renderNote() {
  var wrap = document.createElement('div');

  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';
  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  top.innerHTML = '<div><div class="header-eyebrow mb-3"><span>Tomo del Cronista</span></div><h1 class="header-title">Note di Sessione</h1><p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Il diario del Dungeon Master \u2014 annotazioni, eventi, intrighi</p></div>';

  var actions = document.createElement('div');
  actions.className = 'flex flex-wrap items-center gap-2';
  var exp = document.createElement('button');
  exp.className = 'btn-gold';
  exp.innerHTML = ICON.download + ' Esporta Note (.txt)';
  exp.onclick = exportNotes;
  actions.appendChild(exp);
  var clr = document.createElement('button');
  clr.className = 'btn-blood';
  clr.innerHTML = ICON.trash + ' Cancella';
  clr.onclick = clearNotes;
  actions.appendChild(clr);
  top.appendChild(actions);
  hc.appendChild(top);

  var fd = document.createElement('div');
  fd.className = 'filigree-divider mt-7';
  hc.appendChild(fd);

  var notice = document.createElement('div');
  notice.className = 'notice mt-5';
  notice.innerHTML = '<strong style="color:var(--gold);font-style:normal;">\u{1F4DC} Promemoria del Cronista: </strong>le note vivono nella memoria del browser solo finch&eacute; la pagina &egrave; aperta. Premi <em>"Esporta Note (.txt)"</em> per scaricare il file. I dati permangono cambiando sezione, ma non sopravvivono alla chiusura del browser.';
  hc.appendChild(notice);
  header.appendChild(hc);
  wrap.appendChild(header);

  var section = document.createElement('section');
  section.style.cssText = 'max-width:1100px;margin:0 auto;padding:2rem 1rem 4rem;';
  var toolbar = document.createElement('div');
  toolbar.className = 'notes-toolbar';
  toolbar.id = 'notes-toolbar';
  section.appendChild(toolbar);

  var ta = document.createElement('textarea');
  ta.className = 'notes-area';
  ta.value = state.notes;
  ta.placeholder = "Inizia a scrivere il resoconto della sessione...\n\nEsempi di cosa annotare:\n- Eventi chiave e svolte narrative\n- Decisioni dei personaggi e loro conseguenze\n- Indizi e segreti rivelati o ancora celati\n- Tesoro e XP assegnati\n- NPC incontrati e loro reazioni\n- Idee per la prossima sessione\n\nQuando hai finito, premi 'Esporta Note (.txt)' per scaricare il file sulla chiavetta.";
  ta.spellcheck = true;
  ta.oninput = function() {
    state.notes = this.value;
    updateNotesStats();
    // Debounce Firebase save per evitare troppi write durante la scrittura
    if (ta._fbTimer) clearTimeout(ta._fbTimer);
    ta._fbTimer = setTimeout(function() { fbSaveNotes(); }, 1500);
  };
  section.appendChild(ta);

  var stats = document.createElement('div');
  stats.className = 'notes-stats';
  stats.id = 'notes-stats';
  section.appendChild(stats);

  wrap.appendChild(section);

  setTimeout(updateNotesStats, 0);
  return wrap;
}

function computeNoteStats() {
  var text = state.notes || '';
  var chars = text.length;
  var words = text.trim() ? text.trim().split(/\s+/).length : 0;
  var lines = text ? text.split('\n').length : 0;
  return {chars:chars, words:words, lines:lines};
}

function updateNotesStats() {
  var s = computeNoteStats();
  var tb = document.getElementById('notes-toolbar');
  if (tb) {
    tb.innerHTML =
      '<div class="notes-meta">' +
        '<span>\u{1F4D6} IL TUO DIARIO</span>' +
        '<span class="dot"></span>' +
        '<span><strong>' + s.words + '</strong> parole</span>' +
        '<span class="dot"></span>' +
        '<span><strong>' + s.chars + '</strong> caratteri</span>' +
        '<span class="dot"></span>' +
        '<span><strong>' + s.lines + '</strong> righe</span>' +
      '</div>' +
      '<div class="font-script italic" style="font-size:14px;color:var(--text-muted);">' +
        (state.notes && state.notes.trim() ? 'Scribendo...' : 'Foglio bianco in attesa') +
      '</div>';
  }
  var st = document.getElementById('notes-stats');
  if (st) {
    st.innerHTML = '<span>\u269C STATO: <strong>' + (state.notes && state.notes.trim() ? 'BOZZA IN CORSO' : 'VUOTO') + '</strong></span><span>\u269C FILE: <strong>note_sessione_[data].txt</strong></span>';
  }
}

function pad2(n) { return n < 10 ? '0' + n : String(n); }
function formatDateForFile() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate()) + '_' + pad2(d.getHours()) + '-' + pad2(d.getMinutes());
}
function formatDateForHeader() {
  var d = new Date();
  var giorni = ['Domenica','Luned\u00EC','Marted\u00EC','Mercoled\u00EC','Gioved\u00EC','Venerd\u00EC','Sabato'];
  var mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  return giorni[d.getDay()] + ' ' + d.getDate() + ' ' + mesi[d.getMonth()] + ' ' + d.getFullYear() + ' \u2014 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function exportNotes() {
  if (!state.notes || !state.notes.trim()) { notify('Le note sono vuote, nulla da esportare.', 'err'); return; }
  var s = computeNoteStats();
  var line = '===========================================================';
  var header = line + '\n  NOTE DI SESSIONE - IL MERCANTE ERRANTE\n  ' + formatDateForHeader() + '\n' + line + '\n\n';
  var footer = '\n\n' + line + '\n  Fine note - ' + s.words + ' parole - ' + s.chars + ' caratteri\n' + line + '\n';
  var content = header + state.notes + footer;
  var blob = new Blob([content], {type:'text/plain;charset=utf-8'});
  triggerDownload(blob, 'note_sessione_' + formatDateForFile() + '.txt');
  notify('File scaricato. Salvalo nella tua chiavetta.');
}

function clearNotes() {
  if (!state.notes || !state.notes.trim()) return;
  if (!confirm("Cancellare tutto il testo delle note? L'azione non e' reversibile.")) return;
  state.notes = '';
  var ta = document.querySelector('.notes-area');
  if (ta) ta.value = '';
  updateNotesStats();
  notify('Note azzerate.');
}

/* ===========================================================
   === SEZIONE GENERATORE NPC ===
   =========================================================== */

function npcModifier(score) {
  var s = parseInt(score, 10);
  if (isNaN(s)) return '—';
  var mod = Math.floor((s - 10) / 2);
  return (mod >= 0 ? '+' : '') + mod;
}

/* Crea un blocco label + input/textarea collegato a state.npc */
function makeNpcField(labelText, fieldKey, placeholder, type) {
  var block = document.createElement('div');
  block.className = 'npc-field-block' + (type === 'full' ? ' full' : '');
  if (labelText) {
    var lbl = document.createElement('span');
    lbl.className = 'npc-field-lbl';
    lbl.textContent = labelText;
    block.appendChild(lbl);
  }
  if (type === 'textarea') {
    var ta = document.createElement('textarea');
    ta.className = 'npc-field-textarea';
    ta.value = state.npc[fieldKey] || '';
    ta.placeholder = placeholder || '';
    ta.oninput = function() { state.npc[fieldKey] = this.value; };
    block.appendChild(ta);
  } else {
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'npc-field-input';
    inp.value = state.npc[fieldKey] || '';
    inp.placeholder = placeholder || '';
    inp.oninput = function() { state.npc[fieldKey] = this.value; };
    block.appendChild(inp);
  }
  return block;
}

/* Griglia 6 stat: abbreviazione sopra, modificatore GRANDE, punteggio piccolo sotto */
function renderNpcStatsGrid() {
  var statDefs = [
    {abbr:'FOR', key:'for'}, {abbr:'DES', key:'des'}, {abbr:'COS', key:'cos'},
    {abbr:'INT', key:'int'}, {abbr:'SAG', key:'sag'}, {abbr:'CAR', key:'car'}
  ];
  var grid = document.createElement('div');
  grid.className = 'npc-stats-grid';
  statDefs.forEach(function(stat) {
    var block = document.createElement('div');
    block.className = 'stat-block';

    var abbr = document.createElement('div');
    abbr.className = 'stat-abbr';
    abbr.textContent = stat.abbr;
    block.appendChild(abbr);

    var modDiv = document.createElement('div');
    modDiv.className = 'stat-modifier';
    modDiv.textContent = state.npc[stat.key] ? npcModifier(state.npc[stat.key]) : '—';
    block.appendChild(modDiv);

    var scoreInp = document.createElement('input');
    scoreInp.type = 'number';
    scoreInp.className = 'stat-score-input';
    scoreInp.min = '1'; scoreInp.max = '30';
    scoreInp.value = state.npc[stat.key] || '';
    scoreInp.placeholder = '—';
    scoreInp.title = stat.abbr;
    /* closure per catturare stat e modDiv correttamente */
    (function(k, md) {
      scoreInp.oninput = function() {
        state.npc[k] = this.value;
        md.textContent = this.value ? npcModifier(this.value) : '—';
      };
    })(stat.key, modDiv);
    block.appendChild(scoreInp);
    grid.appendChild(block);
  });
  return grid;
}

/* ---- ARCHIVIO PERSONAGGI ---- */
function salvaNpcInArchivio() {
  var nome = (state.npc.nome || '').trim();
  if (!nome) { notify('Inserisci almeno il Nome prima di salvare.', 'err'); return; }
  var NPC_FIELDS = ['nome','ruolo','background','hp','ca','eta','for','des','cos','int','sag','car',
    'tratiCaratteriali','trattiFisici','oggettiIncantesimi','immagine',
    'azioniTesto','bgShort','razza','competenza','velocita','hpMax',
    'alleati','classeIncantatore','charIncantatore','cdIncantesimi','bonusAttaccoInc'];
  var snapshot = {}; NPC_FIELDS.forEach(function(f){ snapshot[f] = state.npc[f] || ''; });
  snapshot.attacchi = JSON.parse(JSON.stringify(state.npc.attacchi || []));
  // Salva tutti i campi dinamici (proficiency, spell prepared, tiri salvezza, ecc.)
  Object.keys(state.npc).forEach(function(k){
    if(k.endsWith('_p')||k.startsWith('spPrep_')||k.startsWith('ts_')||
       k.startsWith('spell_')||k.startsWith('trucco_')||k.startsWith('slotTot')||k.startsWith('slotSp')){
      snapshot[k]=state.npc[k];
    }
  });
  var existingIdx = -1;
  if (state.npc._id) {
    state.personaggi.forEach(function(p, i){ if (p._id === state.npc._id) existingIdx = i; });
  }
  if (existingIdx >= 0) {
    snapshot._id = state.npc._id;
    state.personaggi[existingIdx] = snapshot;
    notify('Personaggio aggiornato nell\'archivio.');
  } else {
    snapshot._id = 'npc_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    state.npc._id = snapshot._id;
    state.personaggi.push(snapshot);
    notify('Personaggio salvato nell\'archivio.');
  }
  saveToStorage();
  fbSavePersonaggi();
  renderMain();
}

function caricaNpcDaArchivio(p) {
  // Prima AZZERA completamente state.npc per non sporcare col personaggio precedente
  var keysToReset = Object.keys(state.npc).filter(function(k){
    return k.endsWith('_p')||k.startsWith('spPrep_')||k.startsWith('ts_')||
           k.startsWith('spell_')||k.startsWith('trucco_')||k.startsWith('slotTot')||k.startsWith('slotSp');
  });
  keysToReset.forEach(function(k){ delete state.npc[k]; });
  // Poi carica i campi base
  var NPC_FIELDS = ['_id','nome','ruolo','background','hp','ca','eta','for','des','cos','int','sag','car',
    'tratiCaratteriali','trattiFisici','oggettiIncantesimi','immagine',
    'azioniTesto','bgShort','razza','competenza','velocita','hpMax',
    'alleati','classeIncantatore','charIncantatore','cdIncantesimi','bonusAttaccoInc',
    'citta','stato'];
  NPC_FIELDS.forEach(function(f){ state.npc[f] = p[f] !== undefined ? p[f] : ''; });
  state.npc.attacchi = p.attacchi && p.attacchi.length ? JSON.parse(JSON.stringify(p.attacchi)) : [{nome:'',bonus:'',danno:''}];
  // Ripristina i campi dinamici salvati col personaggio
  Object.keys(p).forEach(function(k){
    if(k.endsWith('_p')||k.startsWith('spPrep_')||k.startsWith('ts_')||
       k.startsWith('spell_')||k.startsWith('trucco_')||k.startsWith('slotTot')||k.startsWith('slotSp')){
      state.npc[k]=p[k];
    }
  });
  state.archivioVisible = false;
  renderMain();
}

function eliminaNpcDaArchivio(id, nome) {
  if (!confirm('Eliminare "' + (nome || 'questo personaggio') + '" dall\'archivio?')) return;
  state.personaggi = state.personaggi.filter(function(p){ return p._id !== id; });
  saveToStorage();
  fbSavePersonaggi();
  saveNpc();
  renderMain();
}

function archivaNpcInCitta(npc) {
  var cities = [];
  (state.worldbuilding || []).forEach(function(zone) {
    (zone.citta || []).forEach(function(city) {
      cities.push({zone: zone, city: city, label: zone.nome + ' → ' + city.nome});
    });
  });
  if (cities.length === 0) {
    notify('Nessuna città nel Worldbuilding. Aggiungine prima dalla sezione Worldbuilding.', 'err');
    return;
  }
  var back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.style.cssText = 'z-index:100001;';
  var panel = document.createElement('div'); panel.className = 'modal-panel'; panel.style.maxWidth = '380px';
  var head = document.createElement('div'); head.className = 'modal-head';
  head.innerHTML = '<div><div class="font-display font-semibold tracking-widest" style="font-size:11px;color:var(--gold-dim);margin-bottom:0.25rem;">WORLDBUILDING</div><h2 class="font-display font-bold" style="font-size:18px;color:var(--gold-bright);margin:0;">Archivia in una Città</h2></div><button class="theme-toggle" style="width:38px;height:38px;">' + ICON.x + '</button>';
  head.querySelector('button').onclick = function() { back.remove(); };
  back.onclick = function(e) { if (e.target === back) back.remove(); };
  panel.appendChild(head);
  var mbody = document.createElement('div'); mbody.className = 'modal-body';
  var desc = document.createElement('p');
  desc.style.cssText = 'font-family:\'EB Garamond\',serif;font-size:15px;color:var(--text-muted);margin-bottom:1rem;';
  desc.innerHTML = 'Archivia <strong style="color:var(--text-strong);">' + escapeHtml(npc.nome || '(senza nome)') + '</strong> nella città:';
  mbody.appendChild(desc);
  var sel = document.createElement('select'); sel.className = 'field'; sel.style.marginBottom = '1rem';
  cities.forEach(function(c, i) {
    var o = document.createElement('option'); o.value = i; o.textContent = c.label; sel.appendChild(o);
  });
  mbody.appendChild(sel);
  var confirmBtn = document.createElement('button'); confirmBtn.className = 'btn-gold';
  confirmBtn.style.cssText = 'width:100%;justify-content:center;';
  confirmBtn.textContent = '📦 Archivia qui';
  confirmBtn.onclick = function() {
    var chosen = cities[parseInt(sel.value)]; if (!chosen) return;
    var snapshot = JSON.parse(JSON.stringify(npc));
    if (!chosen.city.npcChiave) chosen.city.npcChiave = [];
    chosen.city.npcChiave.push(snapshot);
    state.personaggi = state.personaggi.filter(function(p) { return p._id !== npc._id; });
    fbSaveWorldbuilding(); fbSavePersonaggi(); saveToStorage();
    notify('"' + escapeHtml(npc.nome || 'NPC') + '" archiviato in ' + escapeHtml(chosen.city.nome) + '.');
    back.remove(); renderMain();
  };
  mbody.appendChild(confirmBtn);
  panel.appendChild(mbody); back.appendChild(panel); document.body.appendChild(back);
}

function _snapshotNpc() {
  return JSON.parse(JSON.stringify(state.npc));
}

function _restoreNpc(snap) {
  // pulisce i campi dinamici
  Object.keys(state.npc).forEach(function(k) {
    if (k.endsWith('_p') || k.startsWith('spPrep_') || k.startsWith('ts_') ||
        k.startsWith('spell_') || k.startsWith('trucco_') || k.startsWith('slotTot') || k.startsWith('slotSp')) {
      delete state.npc[k];
    }
  });
  // ripristina tutto dallo snapshot
  Object.assign(state.npc, snap);
}

function _emptyNpc() {
  return {
    _id: null, nome: '', ruolo: '', background: '',
    hp: '', ca: '', eta: '',
    for: '', des: '', cos: '', int: '', sag: '', car: '',
    tratiCaratteriali: '', trattiFisici: '', oggettiIncantesimi: '',
    immagine: '', attacchi: [{nome:'',bonus:'',danno:''}], azioniTesto: ''
  };
}

function switchNpcTab(idx) {
  if (idx === state.npcActiveTab) return;
  // salva il tab corrente
  state.npcTabs[state.npcActiveTab] = _snapshotNpc();
  state.npcActiveTab = idx;
  // carica il nuovo tab (o scheda vuota)
  var target = state.npcTabs[idx];
  _restoreNpc(target || _emptyNpc());
  saveToStorage();
  renderMain();
}

/* ---- RIPARAZIONE JSON TRONCATO ---- */
function repairTruncatedJson(text) {
  var s = text;
  /* Chiudi stringa aperta: conta virgolette non-escaped */
  var inStr = false, bs = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (bs) { bs = false; continue; }
    if (ch === '\\') { bs = true; continue; }
    if (ch === '"') inStr = !inStr;
  }
  if (inStr) s += '"';
  /* Rimuovi virgola trailing */
  s = s.replace(/,\s*$/, '');
  /* Chiudi strutture aperte */
  var opens = []; inStr = false; bs = false;
  for (var j = 0; j < s.length; j++) {
    var c = s[j];
    if (bs) { bs = false; continue; }
    if (c === '\\') { bs = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (c === '{') opens.push('}');
      else if (c === '[') opens.push(']');
      else if (c === '}' || c === ']') opens.pop();
    }
  }
  while (opens.length) s += opens.pop();
  return s;
}

/* Estrazione di emergenza con regex quando il JSON non è recuperabile */
function extractFieldsFromRaw(text) {
  function exStr(key) {
    var m = text.match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', 'i'));
    return m ? m[1] : '';
  }
  function exNum(key) {
    var m = text.match(new RegExp('"' + key + '"\\s*:\\s*(\\d+)', 'i'));
    return m ? m[1] : '';
  }
  var obj = {
    nome: exStr('nome'), ruolo: exStr('ruolo'), background: exStr('background'),
    for: exNum('for'), des: exNum('des'), cos: exNum('cos'),
    int: exNum('int'), sag: exNum('sag'), car: exNum('car'),
    tratiCaratteriali: exStr('tratiCaratteriali'),
    trattiFisici: exStr('trattiFisici'),
    oggettiIncantesimi: exStr('oggettiIncantesimi')
  };
  return (obj.nome || obj.ruolo) ? obj : null;
}

/* ================================================================
   DATABASE FALLBACK PROCEDURALE — usato quando tutta l'AI è KO
   AI sempre prima: questo scatta SOLO se Groq + Gemini falliscono
   ================================================================ */
/* ---- similarità di Jaro per il matching testuale ---- */
function jaroSimilarity(s1, s2) {
  s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
  if (s1 === s2) return 1;
  var len1 = s1.length, len2 = s2.length;
  var matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  if (matchDist < 0) matchDist = 0;
  var s1Matches = new Array(len1).fill(false);
  var s2Matches = new Array(len2).fill(false);
  var matches = 0, transpositions = 0;
  for (var i = 0; i < len1; i++) {
    var start = Math.max(0, i - matchDist);
    var end   = Math.min(i + matchDist + 1, len2);
    for (var j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true; s2Matches[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;
  var k = 0;
  for (var i2 = 0; i2 < len1; i2++) {
    if (!s1Matches[i2]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i2] !== s2[k]) transpositions++;
    k++;
  }
  return (matches/len1 + matches/len2 + (matches - transpositions/2)/matches) / 3;
}

/* Punteggio di rilevanza di un testo rispetto all'idea del DM */
function relevanceScore(text, idea) {
  var words = idea.toLowerCase().split(/\s+/);
  var score = 0;
  words.forEach(function(w) {
    if (w.length < 3) return;
    if (text.toLowerCase().indexOf(w) >= 0) { score += 2; return; }
    /* similarità Jaro su ogni parola del testo */
    text.toLowerCase().split(/\s+/).forEach(function(tw) {
      var sim = jaroSimilarity(w, tw);
      if (sim > 0.85) score += sim;
    });
  });
  return score;
}

/* Determina il tag del personaggio dall'idea */
function getTagFromIdea(idea) {
  var l = idea.toLowerCase();
  if (/ninja|assassin|ladro|spia|furtivo|scassinatore|borseggiator|rogue/.test(l)) return 'furtivo';
  if (/mago|stregone|druido|chierico|warlock|bardo|alchimist|incantator|magico|arcano/.test(l)) return 'magico';
  if (/guerriero|paladino|barbaro|ranger|monaco|soldato|cavaliere|guardia|combatt|lottator|pugile|gladiator/.test(l)) return 'combattente';
  return 'civile';
}

/* Genera una scheda NPC completa usando solo le tabelle locali
   con matching Jaro per scegliere gli elementi più coerenti con l'idea */
function generaFallbackProcedurale(idea, livello, isBoss, isCombattente, slots) {
  var tag = getTagFromIdea(idea);

  /* Nome: prendi il più rilevante dall'idea, o casuale */
  var nomeScores = FALLBACK_DB.nomi.map(function(n){ return {n:n, s:relevanceScore(n, idea)}; });
  nomeScores.sort(function(a,b){ return b.s - a.s; });
  /* Se nessun nome è rilevante, prendi uno casuale */
  var nome = nomeScores[0].s > 0
    ? nomeScores[Math.floor(Math.random()*Math.min(3,nomeScores.length))].n
    : FALLBACK_DB.nomi[Math.floor(Math.random()*FALLBACK_DB.nomi.length)];

  /* Classe: cerca la più vicina all'idea per testo e tag */
  var classiCompatibili = FALLBACK_DB.classi.filter(function(c){
    return c.tag === tag || c.tag === 'civile';
  });
  var classeScores = (classiCompatibili.length ? classiCompatibili : FALLBACK_DB.classi).map(function(c){
    return {c:c, s:relevanceScore(c.nome, idea)};
  });
  classeScores.sort(function(a,b){ return b.s - a.s; });
  var classe = classeScores[0].s > 0
    ? classeScores[0].c.nome
    : classiCompatibili[Math.floor(Math.random()*classiCompatibili.length)].nome;
  /* Aggiusta con l'idea diretta se contiene keyword esplicita */
  var ideaL = idea.toLowerCase();
  if (/ninja/.test(ideaL)) classe = 'Ninja';
  else if (/assassin/.test(ideaL)) classe = 'Assassino';
  else if (/guerriero|warrior/.test(ideaL)) classe = 'Guerriero';
  else if (/mago|wizard/.test(ideaL)) classe = 'Mago';
  else if (/ladro|rogue/.test(ideaL)) classe = 'Ladro';
  else if (/paladino/.test(ideaL)) classe = 'Paladino';
  else if (/barbaro/.test(ideaL)) classe = 'Barbaro';
  else if (/ranger/.test(ideaL)) classe = 'Ranger';
  else if (/bardo/.test(ideaL)) classe = 'Bardo';

  /* Background: filtra per compatibilità tag, poi ordina per rilevanza */
  var bgPool = FALLBACK_DB.backgrounds.filter(function(b){
    return b.tag.indexOf(tag) >= 0;
  });
  if (!bgPool.length) bgPool = FALLBACK_DB.backgrounds;
  var bgScores = bgPool.map(function(b){ return {b:b, s:relevanceScore(b.testo, idea)}; });
  bgScores.sort(function(a,b){ return b.s - a.s; });
  /* Prendi uno dei top-5 per varietà */
  var top5bg = bgScores.slice(0, Math.min(5, bgScores.length));
  var bg = top5bg[Math.floor(Math.random()*top5bg.length)].b.testo;

  /* Tratti: prendi quelli più rilevanti all'idea */
  function pickBest(pool, n) {
    var scored = pool.map(function(t){ return {t:t, s:relevanceScore(t, idea)}; });
    scored.sort(function(a,b){ return b.s - a.s; });
    var top = scored.slice(0, Math.min(n*3, scored.length));
    return top[Math.floor(Math.random()*top.length)].t;
  }
  var tratto = pickBest(FALLBACK_DB.trattiCaratteriali, 5);
  var fisico  = pickBest(FALLBACK_DB.trattiFisici, 5);

  /* Statistiche procedurali con dado */
  function roll4d6drop() {
    var rolls = [0,0,0,0].map(function(){ return Math.floor(Math.random()*6)+1; });
    rolls.sort(function(a,b){return a-b;});
    return rolls[1]+rolls[2]+rolls[3];
  }
  var statKeys = ['for','des','cos','int','sag','car'];
  var statVals = statKeys.map(function(){ return roll4d6drop(); });
  /* Scala i valori per il livello */
  if (livello) {
    var maxStat = livello<=5?16:livello<=10?18:livello<=15?20:livello<=16?22:isBoss?26:24;
    statVals = statVals.map(function(v){ return Math.min(maxStat, Math.max(8, v)); });
  }
  /* Assegna la stat più alta alla caratteristica primaria del ruolo */
  var statObj = {};
  statKeys.forEach(function(k,i){ statObj[k] = statVals[i]; });
  var sorted = statVals.slice().sort(function(a,b){return b-a;});
  if (tag==='combattente')  { statObj['for']=sorted[0]; statObj['cos']=sorted[1]; }
  else if (tag==='magico')  { statObj['int']=sorted[0]; statObj['sag']=sorted[1]; }
  else if (tag==='furtivo') { statObj['des']=sorted[0]; statObj['int']=sorted[1]; }

  /* HP e CA procedurali */
  var dv = isCombattente ? 10 : 8;
  var lv = livello || 4;
  var conMod = Math.floor((statObj['cos'] - 10) / 2);
  var hp = Math.max(1, dv*lv + conMod*lv + (isBoss?Math.round(dv*lv*0.6):0));
  hp += Math.floor(Math.random()*10) - 5;
  var ca = isCombattente ? 13 : 11;
  if (livello) ca = livello<=5?12:livello<=10?14:livello<=15?16:17;
  ca += Math.floor(Math.random()*3);

  /* Equipaggiamento dal database armi */
  var equip = slots.map(function(slot){
    var fromDb = pescaDalDatabase(slot.rarita, slot.isArma);
    return fromDb ? fromDb.nome : (slot.isArma?'Arma ('+slot.rarita+')':'Oggetto ('+slot.rarita+')');
  });

  /* Età procedurale: coerente con il livello e il ruolo */
  var etaBase = livello ? Math.max(16, 18 + livello * 3) : 30;
  var etaCalc = etaBase + Math.floor(Math.random() * 15) - 5;
  if (isBoss) etaCalc = Math.max(etaCalc, 35);

  return {
    nome: nome,
    ruolo: classe + (livello ? ' Lv.'+livello : ''),
    background: bg,
    tratiCaratteriali: tratto,
    trattiFisici: fisico,
    oggettiIncantesimi: equip.join(', '),
    for: String(statObj['for']), des: String(statObj['des']),
    cos: String(statObj['cos']), int: String(statObj['int']),
    sag: String(statObj['sag']), car: String(statObj['car']),
    hp: String(hp), ca: String(ca),
    eta: String(etaCalc)
  };
}

/* ================================================================
   ENGINE AI — Groq primario (1-2s), Gemini fallback
   Groq usa LPU hardware dedicato: 10-50x più veloce di Gemini free
   ================================================================ */

var GROQ_MODELS   = ['llama-3.1-8b-instant', 'llama-3.2-3b-preview', 'llama3-8b-8192'];
var GEMINI_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-8b'];

/* Chiamata Groq — API OpenAI-compatible, risposta in 1-2s */
async function callGroq(modelName, key, systemPrompt, userPrompt) {
  var controller = new AbortController();
  var tid = setTimeout(function(){ controller.abort(); }, 7000);
  var resp;
  try {
    resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 700,
        response_format: { type: 'json_object' }
      })
    });
  } catch(e) { clearTimeout(tid); throw new Error('FALLBACK:timeout'); }
  clearTimeout(tid);
  if (resp.status === 429) throw new Error('FALLBACK:429');
  if (!resp.ok) {
    var ed = null; try { ed = await resp.json(); } catch(x){}
    var m = ed && ed.error ? (ed.error.message||'') : ('HTTP '+resp.status);
    if (/rate|limit|quota|overload/i.test(m)) throw new Error('FALLBACK:demand');
    throw new Error(m||'HTTP '+resp.status);
  }
  var d = await resp.json();
  var raw = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!raw) throw new Error('Risposta vuota Groq.');
  return raw;
}

/* Chiamata Gemini */
async function callGemini(modelName, key, systemPrompt, userPrompt) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/'+modelName+':generateContent?key='+encodeURIComponent(key);
  var controller = new AbortController();
  var tid = setTimeout(function(){ controller.abort(); }, 8000);
  var resp;
  try {
    resp = await fetch(url, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 700 }
      })
    });
  } catch(e) { clearTimeout(tid); throw new Error('FALLBACK:timeout'); }
  clearTimeout(tid);
  if (resp.status === 429 || resp.status === 503) throw new Error('FALLBACK:'+resp.status);
  if (!resp.ok) {
    var ed = null; try { ed = await resp.json(); } catch(x){}
    var m = (ed && ed.error && ed.error.message) ? ed.error.message : ('HTTP '+resp.status);
    if (/high demand|overload|quota|unavailable/i.test(m)) throw new Error('FALLBACK:demand');
    throw new Error(m);
  }
  var d = await resp.json();
  var raw = d.candidates && d.candidates[0] && d.candidates[0].content &&
            d.candidates[0].content.parts && d.candidates[0].content.parts[0]
            ? d.candidates[0].content.parts[0].text : null;
  if (!raw) throw new Error('Risposta vuota Gemini.');
  return raw;
}

/* Motore unificato: Groq prima (se chiave presente), poi Gemini */
async function callAI(systemPrompt, userPrompt) {
  var lastGroqErr = null;

  /* --- GROQ (primario, velocissimo) --- */
  if (state.groqKey && state.groqKey.trim()) {
    for (var gi = 0; gi < GROQ_MODELS.length; gi++) {
      try {
        var raw = await callGroq(GROQ_MODELS[gi], state.groqKey, systemPrompt, userPrompt);
        return { raw: raw, engine: 'Groq/'+GROQ_MODELS[gi] };
      } catch(err) {
        lastGroqErr = err;
        /* Continua sempre al prossimo modello Groq, qualunque sia l'errore */
        continue;
      }
    }
    /* Se tutti i modelli Groq falliscono: avvisa e vai a Gemini */
    if (lastGroqErr) {
      var isKeyErr = /invalid|unauthorized|auth|key|forbidden/i.test(lastGroqErr.message);
      if (isKeyErr) {
        /* Chiave Groq sbagliata — non perdere tempo, vai subito a Gemini */
        notify('\u26A0 Chiave Groq non valida, uso Gemini...');
      }
    }
  }

  /* --- GEMINI (fallback) --- */
  if (state.geminiKey && state.geminiKey.trim()) {
    for (var mi = 0; mi < GEMINI_MODELS.length; mi++) {
      try {
        var raw = await callGemini(GEMINI_MODELS[mi], state.geminiKey, systemPrompt, userPrompt);
        return { raw: raw, engine: 'Gemini/'+GEMINI_MODELS[mi] };
      } catch(err) {
        /* Continua sempre al prossimo modello Gemini */
        continue;
      }
    }
  }

  throw new Error('Tutti i modelli AI hanno fallito. Controlla le chiavi API e la connessione.');
}

/* Compatibilità con generaItemInBackground */
async function callGeminiModel(modelName, key, systemPrompt, userPrompt) {
  return callGemini(modelName, key, systemPrompt, userPrompt);
}

/* ===========================================================
   LOGICA EQUIPAGGIAMENTO NPC ↔ DATABASE ARMI
   =========================================================== */

/* Determina se il personaggio è un combattente (ha senso dargli armi da combattimento) */
function npcIsCombattente(idea) {
  return /\b(guerrier|soldato|paladin|barbar|ranger|ladro|assassin|ninja|samurai|cavalier|knight|combatt|spadaccin|arciere|balestriere|cacciator|mercenari|guardia|duellist|berserker|spadach|lottator|pugile|gladiator|ranger|scout|spadacc|sbirro|guardie|truppe|miliz|capitano|ammiraglio|generale|warlord|mercenari|bandito|brigante|pirata|corsaro)\b/i.test(idea);
}

/* Determina se il personaggio ha una professione civile/comune (cuoco, artigiano, ecc.)
   In questo caso le stat vengono calibrate in modo realistico: una sola massimizzata, le altre nella norma */
function npcIsCivile(idea) {
  return /\b(cuoco|chef|cuoca|fornaio|fornaia|fornaggiar|pasticcier|oste|ostessa|tavern|locandier|lacandier|artigian|fabbro|falegnam|tessitor|calzolair|sartore|sarta|gioiellier|mercant|commerciant|bottegai|bottegaia|contadin|fattore|agric|mugnaio|pescator|pescatrice|boscaiolo|boscaiola|minatori|minatore|miniera|medico|guaritore|guaritrice|farmacist|apotecar|spezial|stregona|sacerdot|chieric|monaco|monaca|prete|pastore|maestro|maestra|insegnan|bibliotec|archivista|scrivano|contabile|contabilità|notaio|avvocato|giudice|mercato|venditore|venditrice|arald|banditore|giostellier)\b/i.test(idea);
}

/* Slot di equipaggiamento in base al livello:
   Tabella standard:
   lv 1-5:  1 arma Rara + 1 oggetto Non comune
   lv 6-10: 1 arma Molto rara + 1 oggetto Raro + 1 arma Non comune
   lv 11-15:1 arma Molto rara + 2 oggetti Molto rari + 1 arma Rara
   lv 16-20:1 arma Leggendaria + 2 oggetti Molto rari
   Se non combattente, isArma=false su tutto → si usano solo "Oggetti magici/utensili" */
function getEquipSlots(livello, isCombattente) {
  var slots = [];
  if (!livello) {
    /* Nessun livello specificato: 1 oggetto raro + 1 non comune */
    slots.push({rarita:'Raro',       isArma: isCombattente});
    slots.push({rarita:'Non comune', isArma: false});
    return slots;
  }
  if (livello <= 5) {
    /* lv 1-5: 1 arma Rara + 1 oggetto Non comune */
    slots.push({rarita:'Raro',       isArma: isCombattente});
    slots.push({rarita:'Non comune', isArma: false});
  } else if (livello <= 10) {
    /* lv 6-10: 1 arma Molto rara + 1 oggetto Raro + 1 arma Non comune */
    slots.push({rarita:'Molto raro', isArma: isCombattente});
    slots.push({rarita:'Raro',       isArma: false});
    slots.push({rarita:'Non comune', isArma: isCombattente});
  } else if (livello <= 15) {
    /* lv 11-15: 1 arma Molto rara + 2 oggetti Molto rari + 1 arma Rara */
    slots.push({rarita:'Molto raro', isArma: isCombattente});
    slots.push({rarita:'Molto raro', isArma: false});
    slots.push({rarita:'Molto raro', isArma: false});
    slots.push({rarita:'Raro',       isArma: isCombattente});
  } else {
    /* lv 16-20: 1 arma Leggendaria + 2 oggetti Molto rari */
    slots.push({rarita:'Leggendario', isArma: isCombattente});
    slots.push({rarita:'Molto raro',  isArma: false});
    slots.push({rarita:'Molto raro',  isArma: false});
  }
  return slots;
}

/* Tipi di item considerati "armi da combattimento" */
var TIPI_ARMA = ['Spada lunga','Spada','Tridente','Pugnale','Falce','Ascia','Mazza','Martello da guerra','Arco','Balestra','Lancia','Bacchetta/Bastone magico','Bastone'];
var TIPI_OGGETTO = ['Oggetti magici','Pozioni','Armature','Elmi'];

/* Pesca un item dal database (state.armi) rispettando rarità e tipo */
function pescaDalDatabase(rarita, isArma) {
  var pool = state.armi.filter(function(w) {
    if (w.rarita !== rarita) return false;
    if (isArma) return TIPI_ARMA.indexOf(w.tipo) >= 0;
    return TIPI_OGGETTO.indexOf(w.tipo) >= 0;
  });
  /* Se non trova con tipo esatto, allarga a qualsiasi tipo con quella rarità */
  if (pool.length === 0) {
    pool = state.armi.filter(function(w){ return w.rarita === rarita; });
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* Aggiunge un item generato dall'AI al database armi (state.armi) */
function aggiungiAlDatabase(item) {
  /* Evita duplicati per nome */
  var exists = state.armi.some(function(w){ return w.nome.toLowerCase() === item.nome.toLowerCase(); });
  if (exists) return false;
  var newId = 'w_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
  var pv = prezzoPerRarita(item.rarita || 'Non comune');
  /* La descrizione è l'effetto magico generato dall'AI, oppure la descrizione esplicita */
  var descrizione = item.descrizione || item.effetto || '';
  state.armi.unshift({
    id:          newId,
    nome:        item.nome,
    descrizione: descrizione,
    tipo:        item.tipo || 'Oggetti magici',
    rarita:      item.rarita || 'Non comune',
    valuta:      pv.valuta,
    prezzo:      pv.prezzo,
    immagine:    ''
  });
  return true;
}

/* Costruisce la stringa oggettiIncantesimi mescolando item dal DB e nuovi generati dall'AI,
   poi aggiunge quelli nuovi al database */
function costruisciEquipNpc(slots, aiItems, isCombattente) {
  var risultato = [];
  var nuoviAggiunti = 0;

  slots.forEach(function(slot, idx) {
    /* Prima prova a pescare dal database */
    var fromDb = pescaDalDatabase(slot.rarita, slot.isArma);

    /* Se c'è un item AI disponibile per questo slot, usalo e salvalo nel DB */
    var aiItem = aiItems && aiItems[idx] ? aiItems[idx] : null;

    if (aiItem && aiItem.nome) {
      /* Usa l'item AI, salvalo nel DB */
      var tipoGuess = slot.isArma
        ? (TIPI_ARMA[Math.floor(Math.random() * 6)])
        : 'Oggetti magici';
      aiItem.tipo   = aiItem.tipo  || tipoGuess;
      aiItem.rarita = slot.rarita;
      /* prezzo e valuta calcolati dentro aggiungiAlDatabase */
      var aggiunto = aggiungiAlDatabase(aiItem);
      if (aggiunto) nuoviAggiunti++;
      risultato.push(aiItem.nome + (aiItem.effetto ? ' (' + aiItem.effetto + ')' : ''));
    } else if (fromDb) {
      /* Usa item dal DB esistente */
      risultato.push(fromDb.nome);
    } else {
      /* Fallback generico */
      risultato.push(slot.isArma ? 'Lama senza nome (' + slot.rarita + ')' : 'Amuleto (' + slot.rarita + ')');
    }
  });

  return { testo: risultato.join(', '), nuoviAggiunti: nuoviAggiunti };
}

function prezzoPerRarita(rarita) {
  /* Ritorna {prezzo, valuta} con range casuali come da regolamento ufficiale */
  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  switch (rarita) {
    case 'Comune':     return { prezzo: rnd(1,   10),    valuta: 'mo' };
    case 'Non comune': return { prezzo: rnd(11,  100),   valuta: 'mo' };
    case 'Raro':       return { prezzo: rnd(101, 500),   valuta: 'mo' };
    case 'Molto raro': return { prezzo: rnd(501, 1000),  valuta: 'mo' };
    case 'Leggendario':return { prezzo: rnd(1001,2500),  valuta: 'mo' };
    case 'Arma unica': return { prezzo: rnd(2501,5000),  valuta: 'mo' };
    case 'Arma divina':return { prezzo: rnd(5001,10000), valuta: 'mo' };
    default:           return { prezzo: rnd(11,  100),   valuta: 'mo' };
  }
}

/* ================================================================
   SISTEMA IMMAGINE NPC — Lexica.art (API pubblica, no key) + Picsum fallback
   ================================================================ */
function buildImageQuery(npc) {
  var parts = [];
  if (npc.ruolo) parts.push(npc.ruolo.replace(/lv\.?\s*\d+/gi,'').trim());
  parts.push('DnD fantasy character portrait art');
  if (npc.trattiFisici) parts.push(npc.trattiFisici.split(/\s+/).slice(0,4).join(' '));
  return parts.join(' ').slice(0,100);
}

async function cercaImmagineNpc(npc) {
  state._avatarLoading = true;
  aggiornaPannelloAvatar();
  try {
    var resp = await fetch(
      'https://lexica.art/api/v1/search?q=' + encodeURIComponent(buildImageQuery(npc)),
      { signal: AbortSignal.timeout(6000) }
    );
    if (resp.ok) {
      var data = await resp.json();
      var imgs = (data.images||[]).filter(function(img){
        return img.src && img.width >= 200 && img.height >= 200;
      });
      if (imgs.length > 0) {
        var portraits = imgs.filter(function(img){ return img.height >= img.width; });
        var pool = portraits.length > 0 ? portraits : imgs;
        state.npc.immagine = pool[Math.floor(Math.random()*Math.min(6,pool.length))].src;
        state._avatarLoading = false;
        aggiornaPannelloAvatar();
        saveToStorage();
        return;
      }
    }
  } catch(e) { /* passa al fallback */ }
  /* Fallback: Picsum con seed deterministico sul nome */
  var seed = (npc.nome||'npc').split('').reduce(function(a,c){return a+c.charCodeAt(0);},0);
  state.npc.immagine = 'https://picsum.photos/seed/'+seed+'/400/500';
  state._avatarLoading = false;
  aggiornaPannelloAvatar();
  saveToStorage();
}

function aggiornaPannelloAvatar() {
  var frame = document.getElementById('npc-avatar-frame');
  if (!frame) return;
  frame.innerHTML = '';
  if (state._avatarLoading) {
    var ov = document.createElement('div'); ov.className = 'npc-avatar-ov';
    ov.innerHTML = '<div class="npc-av-spin"></div>';
    frame.appendChild(ov);
    return;
  }
  if (state.npc.immagine) {
    var img = document.createElement('img');
    img.src = state.npc.immagine; img.alt = state.npc.nome||'NPC';
    img.onerror = function(){ state.npc.immagine=''; aggiornaPannelloAvatar(); };
    frame.appendChild(img);
  } else {
    var ph = document.createElement('div'); ph.className = 'npc-avatar-ph';
    ph.innerHTML = ICON.npc + '<span>Cerca immagine</span>';
    frame.appendChild(ph);
  }
}

/* ===========================================================
   generateNpcFromAI — FASE 1: scheda veloce, FASE 2: item in background
   =========================================================== */
async function generateNpcFromAI(idea) {
  if (!idea || !idea.trim()) {
    notify('Scrivi un\'idea per l\'NPC prima di generare.', 'err');
    return;
  }

  state.npcLoading = true;
  renderMain();

  /* --- Analisi --- */
  var lvlMatch = idea.match(/\b(?:livello|lv[l]?\.?|level)\s*(\d{1,2})\b/i);
  var livello      = lvlMatch ? parseInt(lvlMatch[1], 10) : null;
  var isBoss       = /\b(boss|villain|distruttore|signore oscuro|lich|semidio|dio|leggendario|overlord|tiranno|arcimago|imperatore|sterminatore)\b/i.test(idea);
  var isCombattente = npcIsCombattente(idea);
  var isCivile      = !isCombattente && npcIsCivile(idea);
  var slots        = getEquipSlots(livello, isCombattente);

  /* Calibrazione stat */
  var statNote;
  if (isCivile && livello) {
    /* Professione civile: 1 stat primaria alta (coerente col ruolo), le altre 8-12 */
    statNote = 'Lv'+livello+' CIVILE: max 1 stat primaria 14-18 coerente col ruolo (es. Des per cuoco, Int per medico, Sag per sacerdote), le altre 8-12, NO valori alti ovunque';
  } else if (isCivile) {
    statNote = 'CIVILE: max 1 stat primaria 14-16, le altre 8-12';
  } else if (livello) {
    if      (livello <= 5)  statNote = 'Lv'+livello+': 8-16';
    else if (livello <= 10) statNote = 'Lv'+livello+': primarie max 18';
    else if (livello <= 15) statNote = 'Lv'+livello+': primarie 18-20';
    else if (livello <= 16) statNote = 'Lv'+livello+': primarie 20-22';
    else statNote = isBoss ? 'Lv'+livello+' BOSS: primarie 22-26' : 'Lv'+livello+': primarie 20-24';
  } else {
    statNote = isBoss ? 'BOSS: primarie 20-26' : 'coerenti col ruolo';
  }

  /* HP e CA */
  var hpNote, caNote;
  if (livello) {
    var dv = isCombattente ? 10 : 8;
    var hpMin = dv * livello, hpMax = (dv+4)*livello + livello*2;
    if (isBoss) { hpMin = Math.round(hpMin*1.5); hpMax = Math.round(hpMax*1.8); }
    hpNote = hpMin+'-'+hpMax;
    caNote = livello<=5?'11-14':livello<=10?'13-16':livello<=15?'15-18':'17-22';
  } else {
    hpNote = isBoss?'120-250':'30-80';
    caNote = isBoss?'16-20':'11-15';
  }

  /* Nomi degli item esistenti nel DB da evitare */
  var existingNames = state.armi.slice(0,30).map(function(w){return w.nome;}).join(', ');

  /* Archetipo casuale — passato come spunto breve nel prompt */
  var archP = ['ironico e sarcastico','ossessivo e perfezionista','gentile ma con lato oscuro',
    'paranoico e diffidente','impulsivo e istintivo','melanconico e poetico',
    'inquietantemente allegro','pragmatico e freddo','devoto a un\'idea astratta',
    'curioso compulsivo','bugiardo cronico','silenzioso e osservatore'][Math.floor(Math.random()*12)];
  var archF = ['cicatrice al sopracciglio, voce roca','capelli bianchi, mani fredde',
    'tatuaggi tribali sul collo','porta sempre guanti, non li toglie mai',
    'occhi di colore diverso','altissimo e magrissimo, si muove in silenzio',
    'capelli rossi con campanelle','basso e tozzo, forza enorme',
    'bruciature sul lato sinistro','volto giovane su corpo invecchiato',
    'abbigliamento vistoso e rumoroso','portamento militare, cicatrici multiple'][Math.floor(Math.random()*12)];

  /* seed DEVE essere dichiarato prima di essere usato nel prompt */
  var seed = Math.floor(Math.random() * 90000) + 10000;

  /* Prompt Fase 1 — minimo assoluto di token, massima velocità */
  var promptScheda =
    'NPC generator D&D5e. JSON solo, no backtick.\n' +
    '{"nome":"","ruolo":"","background":"","tratiCaratteriali":"","trattiFisici":"","for":0,"des":0,"cos":0,"int":0,"sag":0,"car":0,"hp":0,"ca":0,"eta":0}\n' +
    'stat='+statNote+' hp='+hpNote+' ca='+caNote+'\n' +
    'eta=numero intero (anni del personaggio, coerente col ruolo e livello).\n' +
    'background=2 frasi complete, NON vuoto.\n' +
    'personalita="'+archP+'"+difetto+tic. fisico="'+archF+'"+abbigliamento.\n' +
    'Max 120 car per stringa. S='+seed;

  var hasGroq   = state.groqKey   && state.groqKey.trim();
  var hasGemini = state.geminiKey && state.geminiKey.trim();
  if (!hasGroq && !hasGemini) {
    notify('Configura almeno una chiave API. Clicca \u2699.', 'err');
    state.npcLoading = false;
    renderMain();
    return;
  }

  var rawScheda = null, lastErr = null, modelUsed = null;
  /* AI PRIMA — Groq poi Gemini */
  try {
    var result = await callAI(promptScheda, 'NPC:"'+idea.trim().slice(0,200)+'"');
    rawScheda = result.raw;
    modelUsed = result.engine;
  } catch(err) {
    lastErr = err;
    /* Se tutta l'AI è KO → fallback procedurale istantaneo */
    notify('\u26A0 AI non disponibile, uso tabelle locali...', 'err');
  }

  /* ---- Percorso AI ---- */
  if (rawScheda) {
    var npcData = null;
    var clean = rawScheda.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
    try { npcData = JSON.parse(clean); }
    catch(e1) {
      try { npcData = JSON.parse(repairTruncatedJson(clean)); }
      catch(e2) { npcData = extractFieldsFromRaw(clean); }
    }

    if (npcData) {
      /* Popola state.npc dai dati AI */
      var ALL = ['nome','ruolo','background','hp','ca','eta','for','des','cos','int','sag','car','tratiCaratteriali','trattiFisici','oggettiIncantesimi','immagine'];
      ALL.forEach(function(f){ state.npc[f]=''; });
      state.npc._id = null;

      ['nome','ruolo','background','hp','ca','eta','for','des','cos','int','sag','car','tratiCaratteriali','trattiFisici'].forEach(function(f){
        var v = npcData[f];
        if (v!==undefined && v!==null) {
          var s = String(v).trim();
          if (s && s!=='N/A' && s!=='-') state.npc[f] = s;
        }
      });

      /* Fallback testi per campi vuoti — pool dal DB locale */
      var rndFb = function(arr){ return arr[Math.floor(Math.random()*arr.length)]; };
      if (!state.npc.tratiCaratteriali || state.npc.tratiCaratteriali.trim().length < 20)
        state.npc.tratiCaratteriali = rndFb(FALLBACK_DB.trattiCaratteriali);
      if (!state.npc.trattiFisici || state.npc.trattiFisici.trim().length < 20)
        state.npc.trattiFisici = rndFb(FALLBACK_DB.trattiFisici);
      var bgVuoto = !state.npc.background || state.npc.background.trim().length < 30 ||
                    state.npc.background.trim() === (state.npc.nome||'').trim();
      if (bgVuoto) {
        var bgComp = FALLBACK_DB.backgrounds.filter(function(b){
          return b.tag.indexOf(getTagFromIdea(idea))>=0;
        });
        state.npc.background = rndFb(bgComp.length?bgComp:FALLBACK_DB.backgrounds).testo;
      }

      /* Fallback stat */
      var statKeys = ['for','des','cos','int','sag','car'];
      var statVals = statKeys.map(function(k){ return parseInt(state.npc[k],10); });
      var allBad  = statVals.every(function(v){ return isNaN(v)||v<=0; });
      var allFlat = !allBad && statVals.every(function(v){ return !isNaN(v)&&v>=8&&v<=12; });
      /* Per civili: forza il ricalcolo se i valori sono troppo alti o tutti uguali */
      var civileOverbuffed = isCivile && !allBad && statVals.some(function(v){ return !isNaN(v)&&v>=17; });
      if (allBad||(allFlat&&(livello>=15||isBoss))||civileOverbuffed) {
        var ideaL2=idea.toLowerCase(), statSet;
        if (isCivile) {
          /* Professione civile: 1 stat dominante, le altre basse */
          var base = [10,10,10,10,10,10];
          if (/cuoco|chef|fornaio|pasticcier|oste|tavern/.test(ideaL2))         { base[3]=15; base[4]=14; } /* Int/Sag per cuochi */
          else if (/fabbro|falegnam|artigian|calzolair/.test(ideaL2))            { base[0]=14; base[2]=13; } /* For/Cos */
          else if (/medico|guaritore|farmacist|apotecar/.test(ideaL2))           { base[3]=15; base[4]=14; } /* Int/Sag */
          else if (/sacerdot|chieric|monaco|prete|pastore/.test(ideaL2))         { base[4]=15; base[5]=13; } /* Sag/Car */
          else if (/mercant|venditore|botteg|contadin/.test(ideaL2))             { base[3]=13; base[5]=14; } /* Int/Car */
          else if (/maestro|maestra|insegn|bibliotec|scrivano/.test(ideaL2))     { base[3]=15; base[4]=12; } /* Int */
          else                                                                    { base[3]=14; }             /* default Int */
          var jitterC=function(v){return Math.max(8,Math.min(18,v+Math.floor(Math.random()*3)-1));};
          statKeys.forEach(function(k,i){ state.npc[k]=String(jitterC(base[i])); });
        } else if (livello>=17||isBoss) {
          if (/mago|arci|stregone|necroman|scienziat|professor|crono|intellett/.test(ideaL2)) statSet=[20,16,22,26,18,14];
          else if (/guerriero|paladin|barbar|soldato|knight|berserker/.test(ideaL2))           statSet=[26,18,24,12,16,14];
          else statSet=[22,18,20,20,16,14];
          var jitter=function(v){return Math.max(3,Math.min(30,v+Math.floor(Math.random()*3)-1));};
          statKeys.forEach(function(k,i){ state.npc[k]=String(jitter(statSet[i])); });
        } else if (livello>=12) { statSet=[18,16,18,16,14,12]; var jitter2=function(v){return Math.max(3,Math.min(30,v+Math.floor(Math.random()*3)-1));}; statKeys.forEach(function(k,i){ state.npc[k]=String(jitter2(statSet[i])); }); }
        else if  (livello>=8)  { statSet=[16,14,16,14,12,10]; var jitter3=function(v){return Math.max(3,Math.min(30,v+Math.floor(Math.random()*3)-1));}; statKeys.forEach(function(k,i){ state.npc[k]=String(jitter3(statSet[i])); }); }
        else                   { statSet=[14,12,14,12,10,10]; var jitter4=function(v){return Math.max(3,Math.min(30,v+Math.floor(Math.random()*3)-1));}; statKeys.forEach(function(k,i){ state.npc[k]=String(jitter4(statSet[i])); }); }
      }

      /* Fallback HP / CA */
      if (!state.npc.hp||parseInt(state.npc.hp,10)<=0) {
        var baseHp2=livello?((isCombattente?10:8)*livello+livello*2):(isBoss?150:45);
        if (isBoss) baseHp2=Math.round(baseHp2*1.6);
        state.npc.hp=String(baseHp2+Math.floor(Math.random()*20)-10);
      }
      if (!state.npc.ca||parseInt(state.npc.ca,10)<=0) {
        var baseCA2=livello?(livello<=5?12:livello<=10?14:livello<=15?16:18):(isBoss?17:12);
        state.npc.ca=String(baseCA2+Math.floor(Math.random()*3));
      }

      /* Equipaggiamento dal DB */
      var dbEquip2 = slots.map(function(slot){
        var fromDb = pescaDalDatabase(slot.rarita, slot.isArma);
        return fromDb ? fromDb.nome : (slot.isArma?'Arma ('+slot.rarita+')':'Oggetto ('+slot.rarita+')');
      });
      state.npc.oggettiIncantesimi = dbEquip2.join(', ');

      /* Scheda AI pronta */
      state.npcLoading = false;
      saveToStorage();
      renderMain();
      notify('Scheda pronta ('+modelUsed+')! Genero oggetti in background...');
      /* Ricerca immagine in parallelo — non blocca la UI */
      cercaImmagineNpc(state.npc);
      setTimeout(function() {
        generaItemInBackground(idea, slots, isCombattente, existingNames);
      }, 80);
      return;
    }
  }

  /* ---- Percorso FALLBACK PROCEDURALE ---- */
  /* Scheda generata istantaneamente dalle tabelle locali con matching Jaro */
  var fbNpc = generaFallbackProcedurale(idea, livello, isBoss, isCombattente, slots);
  var ALL2 = ['nome','ruolo','background','hp','ca','eta','for','des','cos','int','sag','car','tratiCaratteriali','trattiFisici','oggettiIncantesimi','immagine'];
  ALL2.forEach(function(f){ state.npc[f]=''; });
  state.npc._id = null;
  ALL2.forEach(function(f){ if (fbNpc[f]) state.npc[f] = fbNpc[f]; });

  state.npcLoading = false;
  saveToStorage();
  renderMain();
  notify('\u{1F4DA} Scheda generata con tabelle locali (AI non disponibile).');
  cercaImmagineNpc(state.npc);
}

/* Genera gli item per l'NPC in background e aggiorna scheda + DB */
async function generaItemInBackground(idea, slots, isCombattente, existingNames) {
  /* Quanti item creativi garantiti: almeno 2, fino al totale degli slot */
  var nNuovi = Math.max(2, Math.ceil(slots.length * 0.6));

  var tipiValidi = isCombattente
    ? 'Spada lunga,Spada,Pugnale,Ascia,Arco,Lancia,Mazza,Bastone,Oggetti magici,Armature,Elmi,Pozioni'
    : 'Oggetti magici,Pozioni,Utensili magici,Strumenti del mestiere,Amuleti,Anelli,Mantelli,Borse';
  var slotStr = slots.slice(0, nNuovi).map(function(s,i){
    return (i+1)+')'+s.rarita+(s.isArma?'[ARMA]':'[OGG]');
  }).join(' ');

  var promptItems =
    'D&D5e item creator. JSON only.\n'+
    'Crea '+nNuovi+' oggetti per: "'+idea.trim().slice(0,100)+'".\n'+
    'Slot: '+slotStr+'\n'+
    'tipo da: '+tipiValidi+'\n'+
    'nome evocativo unico. effetto max 80 car. No nomi: '+existingNames.slice(0,200);

  var itemsData = null;
  try {
    var wrappedSys = promptItems + '\nRispondi con JSON oggetto: {"items":[{"nome":"","tipo":"","rarita":"","effetto":""}]}';
    var result = await callAI(wrappedSys, 'Crea gli oggetti.');
    var clean = result.raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
    var parsed = JSON.parse(clean);
    itemsData = Array.isArray(parsed) ? parsed : (parsed.items || []);
  } catch(e) { return; }

  if (!Array.isArray(itemsData) || itemsData.length === 0) return;

  /* Aggiungi al database e costruisci la stringa aggiornata */
  var nuoviNomi = [];
  var nuoviAggiunti = 0;
  itemsData.forEach(function(item, i) {
    if (!item || !item.nome) return;
    item.rarita = item.rarita || (slots[i] ? slots[i].rarita : 'Non comune');
    var aggiunto = aggiungiAlDatabase(item);
    if (aggiunto) nuoviAggiunti++;
    nuoviNomi.push(item.nome + (item.effetto ? ' (' + item.effetto.slice(0,60) + (item.effetto.length>60?'...':'')+')' : ''));
  });

  if (nuoviNomi.length === 0) return;

  /* Integra con gli item del DB già assegnati:
     sostituisce i primi N slot con quelli nuovi, mantiene il resto */
  var esistentiParts = state.npc.oggettiIncantesimi
    ? state.npc.oggettiIncantesimi.split(', ')
    : [];
  var merged = nuoviNomi.concat(esistentiParts.slice(nuoviNomi.length));
  state.npc.oggettiIncantesimi = merged.join(', ');

  saveToStorage();
  renderMain();

  notify('\u2728 '+nuoviAggiunti+' nuov'+(nuoviAggiunti===1?'o oggetto aggiunto':'i oggetti aggiunti')+' all\'Emporio!');
}

/* ---- RENDER PRINCIPALE ---- */

/* ============================================================================
   SEZIONE 7: FORGIA DEI PERSONAGGI — GENERATORE NPC (renderGeneratore)
   ============================================================================ */
function renderGeneratore() {
  var wrap = document.createElement('div');

  /* HEADER */
  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';
  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  top.innerHTML =
    '<div>' +
      '<div class="header-eyebrow mb-3"><span>Archivio delle Ombre</span></div>' +
      '<h1 class="header-title">Generatore NPC</h1>' +
      '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Crea e archivia i personaggi non giocanti</p>' +
    '</div>';
  hc.appendChild(top);
  var fd = document.createElement('div');
  fd.className = 'filigree-divider mt-7';
  hc.appendChild(fd);
  var notice = document.createElement('div');
  notice.className = 'notice mt-5';
  notice.innerHTML = '<strong style="color:var(--gold);font-style:normal;">\u{1F4DC} Istruzioni: </strong>descrivi il tuo NPC (puoi specificare il livello, es. <em>"Ladro elfo livello 6"</em>), poi premi <em>Genera con AI</em>. Modifica i campi a mano, poi <em>Salva in Archivio</em>. Clicca \u2699 per impostare la chiave Gemini.';
  hc.appendChild(notice);
  header.appendChild(hc);
  wrap.appendChild(header);

  // ---- GENERATORE NOMI ----
  var nameGenWrap = document.createElement('div');
  nameGenWrap.style.cssText = 'background:var(--bg-panel);border:1px solid var(--border-gold);border-radius:8px;padding:1rem 1.25rem;margin:1rem auto;max-width:900px;';

  var ngTitle = document.createElement('div');
  ngTitle.style.cssText = 'font-family:\'Cinzel\',serif;font-size:13px;font-weight:700;color:var(--gold-bright);letter-spacing:0.12em;margin-bottom:0.6rem;';
  ngTitle.textContent = '🎲 Generatore di Nomi';
  nameGenWrap.appendChild(ngTitle);

  var ngRow = document.createElement('div');
  ngRow.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;';

  var ngGender = state._ngGender || 'qualsiasi';
  ['Maschio','Femmina','Qualsiasi'].forEach(function(g) {
    var gl = g.toLowerCase();
    var isA = ngGender === gl;
    var btn = document.createElement('button');
    btn.textContent = g === 'Maschio' ? '♂ Maschio' : g === 'Femmina' ? '♀ Femmina' : '⚥ Qualsiasi';
    btn.style.cssText = 'font-family:\'Cinzel\',serif;font-size:11px;padding:0.3rem 0.8rem;border-radius:20px;cursor:pointer;transition:all 0.15s;border:1.5px solid '+(isA?'var(--gold)':'var(--border-subtle)')+';background:'+(isA?'rgba(201,165,92,0.2)':'var(--bg-card)')+';color:'+(isA?'var(--gold-bright)':'var(--text-faint)')+';font-weight:'+(isA?'700':'400')+';';
    btn.onclick = function(){ state._ngGender = gl; renderMain(); };
    ngRow.appendChild(btn);
  });

  var ngBtn = document.createElement('button');
  ngBtn.style.cssText = 'font-family:\'Cinzel\',serif;font-size:12px;font-weight:700;padding:0.35rem 1.2rem;border-radius:5px;cursor:pointer;background:rgba(201,165,92,0.18);border:1.5px solid var(--gold);color:var(--gold-bright);letter-spacing:0.1em;';
  ngBtn.textContent = '✨ Genera';
  ngRow.appendChild(ngBtn);

  var ngDisplay = document.createElement('div');
  ngDisplay.style.cssText = 'font-family:\'Cinzel\',serif;font-size:18px;font-weight:700;color:var(--gold-bright);padding:0.35rem 0.9rem;background:rgba(201,165,92,0.07);border:1px solid var(--border-gold);border-radius:5px;cursor:pointer;min-width:120px;text-align:center;letter-spacing:0.08em;';
  ngDisplay.title = 'Clicca per copiare nel campo Nome';
  ngDisplay.textContent = '—';
  ngRow.appendChild(ngDisplay);

  ngBtn.onclick = function() {
    var pool = [];
    var g = state._ngGender || 'qualsiasi';
    if (g === 'maschio') pool = NOMI_MASCHILI;
    else if (g === 'femmina') pool = NOMI_FEMMINILI;
    else pool = NOMI_MASCHILI.concat(NOMI_FEMMINILI);
    if (!pool.length) return;
    var name = pool[Math.floor(Math.random() * pool.length)];
    ngDisplay.textContent = name;
  };

  ngDisplay.onclick = function() {
    var name = ngDisplay.textContent;
    if (name && name !== '—') {
      state.npc.nome = name;
      var nomeInput = document.getElementById('npc-nome-input');
      if (nomeInput) { nomeInput.value = name; }
      else renderMain();
    }
  };

  nameGenWrap.appendChild(ngRow);
  wrap.appendChild(nameGenWrap);

  var section = document.createElement('section');
  section.className = 'generatore-wrap pb-20';
  section.style.cssText = 'padding-top:1.5rem;';

  var grid = document.createElement('div');
  grid.className = 'generatore-grid';

  /* ===================== COLONNA SINISTRA ===================== */
  var left = document.createElement('div');
  left.style.cssText = 'display:flex;flex-direction:column;gap:0.55rem;';

  /* ---- BARRA TAB (3 schede) ---- */
  var tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:0.35rem;margin-bottom:0.1rem;';
  ['Scheda 1','Scheda 2','Scheda 3'].forEach(function(label, idx) {
    var snap = (idx === state.npcActiveTab) ? state.npc : state.npcTabs[idx];
    var tabLabel = (snap && snap.nome && snap.nome.trim()) ? snap.nome.trim().slice(0, 16) : label;
    var isActive = idx === state.npcActiveTab;
    var btn = document.createElement('button');
    btn.style.cssText = 'flex:1;padding:0.3rem 0.4rem;font-family:\'Cinzel\',serif;font-size:9px;' +
      'letter-spacing:0.08em;text-transform:uppercase;border-radius:3px 3px 0 0;cursor:pointer;' +
      'border:1px solid ' + (isActive ? 'var(--border-gold)' : 'var(--border-subtle)') + ';' +
      'border-bottom:' + (isActive ? '1px solid var(--bg-panel)' : '1px solid var(--border-subtle)') + ';' +
      'background:' + (isActive ? 'var(--bg-panel)' : 'var(--bg-card)') + ';' +
      'color:' + (isActive ? 'var(--gold)' : 'var(--text-muted)') + ';' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    btn.title = tabLabel;
    btn.textContent = tabLabel;
    if (!isActive) btn.onclick = (function(i){ return function(){ switchNpcTab(i); }; })(idx);
    tabBar.appendChild(btn);
  });
  left.appendChild(tabBar);

  var ctrl = document.createElement('div');
  ctrl.className = 'panel-glass';
  ctrl.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;padding:0.75rem;';

  /* Riga: label + ingranaggio */
  var ctrlHead = document.createElement('div');
  ctrlHead.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
  var ctrlLbl = document.createElement('span');
  ctrlLbl.className = 'npc-field-lbl';
  ctrlLbl.style.cssText = 'font-size:9px;';
  ctrlLbl.textContent = 'Descrivi il tuo NPC (includi livello se vuoi)';
  ctrlHead.appendChild(ctrlLbl);
  var gearBtn = document.createElement('button');
  gearBtn.className = 'btn-gear' + (state.geminiKeyVisible ? ' active' : '');
  gearBtn.title = 'Configura API Key Google Gemini';
  gearBtn.innerHTML = ICON.gear;
  gearBtn.onclick = function() { state.geminiKeyVisible = !state.geminiKeyVisible; renderMain(); };
  ctrlHead.appendChild(gearBtn);
  ctrl.appendChild(ctrlHead);

  /* Box API Key — Groq (primario) + Gemini (fallback) */
  if (state.geminiKeyVisible) {
    var apiBox = document.createElement('div');
    apiBox.className = 'api-key-box';

    /* --- GROQ --- */
    var groqLbl = document.createElement('span');
    groqLbl.className = 'npc-field-lbl';
    groqLbl.innerHTML = '\u26A1 Groq API Key <span style="color:var(--gold);font-size:8px;">(VELOCE — consigliata)</span>';
    apiBox.appendChild(groqLbl);
    var groqRow = document.createElement('div');
    groqRow.className = 'api-key-row';
    var groqInp = document.createElement('input');
    groqInp.type = 'password'; groqInp.placeholder = 'Inserisci chiave Groq...';
    groqInp.value = state.groqKey || ''; groqInp.autocomplete = 'off';
    groqRow.appendChild(groqInp);
    var groqSave = document.createElement('button');
    groqSave.className = 'btn-npc btn-npc-gold';
    groqSave.style.cssText = 'width:auto;padding:0.25rem 0.6rem;font-size:9px;';
    groqSave.textContent = 'Salva';
    groqSave.onclick = function() { state.groqKey = groqInp.value.trim(); saveToStorage(); fbSaveApiKeys(); notify('\u26A1 Chiave Groq salvata — generazione ultra-veloce attiva!'); };
    groqRow.appendChild(groqSave);
    apiBox.appendChild(groqRow);

    var groqHint = document.createElement('div');
    groqHint.className = 'api-key-hint';
    groqHint.innerHTML = '\u26A1 Groq \u00E8 <strong>10-50x pi\u00F9 veloce</strong> di Gemini. Chiave gratuita su <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>';
    apiBox.appendChild(groqHint);

    /* Separatore */
    var sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid var(--border-subtle);margin:0.5rem 0 0.4rem;';
    apiBox.appendChild(sep);

    /* --- GEMINI --- */
    var gemLbl = document.createElement('span');
    gemLbl.className = 'npc-field-lbl';
    gemLbl.innerHTML = 'Gemini API Key <span style="color:var(--text-faint);font-size:8px;">(fallback)</span>';
    apiBox.appendChild(gemLbl);
    var apiRow = document.createElement('div');
    apiRow.className = 'api-key-row';
    var apiInp = document.createElement('input');
    apiInp.type = 'password'; apiInp.placeholder = 'Inserisci chiave Gemini...';
    apiInp.value = state.geminiKey || ''; apiInp.autocomplete = 'off';
    apiRow.appendChild(apiInp);
    var apiSave = document.createElement('button');
    apiSave.className = 'btn-npc btn-npc-gold';
    apiSave.style.cssText = 'width:auto;padding:0.25rem 0.6rem;font-size:9px;';
    apiSave.textContent = 'Salva';
    apiSave.onclick = function() { state.geminiKey = apiInp.value.trim(); saveToStorage(); fbSaveApiKeys(); notify('Chiave Gemini salvata.'); };
    apiRow.appendChild(apiSave);
    apiBox.appendChild(apiRow);
    var apiHint = document.createElement('div');
    apiHint.className = 'api-key-hint';
    apiHint.innerHTML = 'Gemini gratuito su <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>. Usato come fallback se Groq non \u00E8 configurata.';
    apiBox.appendChild(apiHint);

    ctrl.appendChild(apiBox);
  }

  /* Textarea idea (alta: triplo rispetto a prima) */
  var ideaTA = document.createElement('textarea');
  ideaTA.className = 'npc-field-textarea npc-idea-tall';
  ideaTA.id = 'npc-idea-input';
  ideaTA.placeholder = 'es. Un assassino elfo livello 6, silenzioso e spietato, ex guardia del corpo reale in cerca di redenzione...\n\nSpecifica: razza, classe, livello, obiettivi, personalità.';
  /* Ripristina l'ultimo prompt inserito (sopravvive ai re-render) */
  ideaTA.value = state.npcIdea || '';
  /* Salva in state ad ogni modifica — così è sempre disponibile anche dopo renderMain() */
  ideaTA.oninput = function() { state.npcIdea = this.value; };
  ctrl.appendChild(ideaTA);

  /* Bottone GENERA */
  var genBtn = document.createElement('button');
  genBtn.className = 'btn-npc btn-npc-gold';
  genBtn.disabled = state.npcLoading;
  genBtn.innerHTML = state.npcLoading
    ? '<span class="npc-spin"></span> Generazione in corso...'
    : ICON.sparkles + ' Genera con AI';
  /* Indicatore motore attivo */
  var engineLabel = document.createElement('div');
  engineLabel.style.cssText = 'font-family:\'Cinzel\',serif;font-size:8px;text-align:center;color:var(--text-faint);margin-top:0.1rem;letter-spacing:0.08em;';
  var hasG = state.groqKey && state.groqKey.trim();
  var hasGem = state.geminiKey && state.geminiKey.trim();
  if (hasG) engineLabel.textContent = '\u26A1 Groq attiva' + (hasGem ? ' + Gemini fallback' : '');
  else if (hasGem) engineLabel.textContent = 'Gemini attiva (configura Groq per velocit\u00E0 max)';
  else engineLabel.textContent = '\u26A0 Nessuna chiave API — clicca \u2699';
  engineLabel.style.color = hasG ? 'var(--gold-dim)' : (hasGem ? 'var(--text-faint)' : '#ff9c9c');
  ctrl.appendChild(engineLabel);
  genBtn.onclick = function() {
    var idea = state.npcIdea || '';
    generateNpcFromAI(idea);
  };
  ctrl.appendChild(genBtn);

  /* Bottone TABELLE LOCALI — risposta istantanea, legge lo stesso prompt dell'AI */
  var tblBtn = document.createElement('button');
  tblBtn.className = 'btn-npc btn-npc-dark';
  tblBtn.style.cssText = 'font-size:8.5px;opacity:0.8;';
  tblBtn.title = 'Genera istantaneamente dalle tabelle locali usando lo stesso prompt — nessuna AI richiesta';
  tblBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" style="width:10px;height:10px;flex-shrink:0"><rect x="1" y="1" width="14" height="4" rx="1"/><rect x="1" y="6.5" width="14" height="4" rx="1"/><rect x="1" y="12" width="8" height="3" rx="1"/></svg> Tabelle Locali (istant.)';
  tblBtn.onclick = function() {
    /* Legge SEMPRE da state.npcIdea — persiste anche durante il caricamento AI */
    var ideaTbl = state.npcIdea || '';
    if (!ideaTbl.trim()) { notify('Scrivi un\'idea nella textarea prima di generare.', 'err'); return; }
    var lvlMt = ideaTbl.match(/\b(?:livello|lv[l]?\.?|level)\s*(\d{1,2})\b/i);
    var lvTbl  = lvlMt ? parseInt(lvlMt[1],10) : null;
    var isBossTbl = /boss|villain|distruttore|signore oscuro|lich|semidio|dio|leggendario|overlord|tiranno|arcimago|imperatore|sterminatore/i.test(ideaTbl);
    var isCombTbl = npcIsCombattente(ideaTbl);
    var slotsTbl  = getEquipSlots(lvTbl, isCombTbl);
    var fbResult  = generaFallbackProcedurale(ideaTbl, lvTbl, isBossTbl, isCombTbl, slotsTbl);
    /* Resetta e popola scheda — stessi campi di sempre */
    var TBLFIELDS = ['nome','ruolo','background','hp','ca','eta','for','des','cos','int','sag','car','tratiCaratteriali','trattiFisici','oggettiIncantesimi','immagine'];
    TBLFIELDS.forEach(function(f){ state.npc[f]=''; });
    state.npc._id = null;
    state.npc.attacchi = [{nome:'',bonus:'',danno:''}];
    state.npc.azioniTesto = '';
    TBLFIELDS.forEach(function(f){ if (fbResult[f]) state.npc[f]=fbResult[f]; });
    /* Se l'AI stava ancora girando, fermiamola visivamente */
    state.npcLoading = false;
    saveToStorage(); renderMain();
    notify('\u{1F4DA} Scheda da tabelle pronta! (prompt: "' + ideaTbl.slice(0,40) + (ideaTbl.length>40?'...':'')+  '")');
    cercaImmagineNpc(state.npc);
  };
  ctrl.appendChild(tblBtn);

  /* Bottone NUOVA SCHEDA */
  var resetBtn = document.createElement('button');
  resetBtn.className = 'btn-npc btn-npc-dark';
  resetBtn.innerHTML = ICON.refresh + ' Nuova Scheda';
  resetBtn.onclick = function() {
    if (!confirm('Resettare la scheda corrente?')) return;
    var k; for (k in state.npc) state.npc[k] = k === '_id' ? null : '';
    state.npc.attacchi = [{nome:'',bonus:'',danno:''}];
    state.npc.azioniTesto = '';
    saveToStorage(); renderMain();
  };
  ctrl.appendChild(resetBtn);

  /* Bottone ARCHIVIO */
  var archBtn = document.createElement('button');
  archBtn.className = 'btn-npc btn-npc-arch';
  archBtn.innerHTML = ICON.folder + ' Archivio Personaggi (' + state.personaggi.length + ')';
  archBtn.onclick = function() { state.archivioVisible = !state.archivioVisible; renderMain(); };
  ctrl.appendChild(archBtn);

  /* Riga esporta / importa JSON */
  var jsonRow = document.createElement('div');
  jsonRow.style.cssText = 'display:flex;gap:0.35rem;margin-top:0.1rem;';

  var btnExp = document.createElement('button');
  btnExp.className = 'btn-npc btn-npc-dark';
  btnExp.style.cssText = 'flex:1;font-size:9px;padding:0.28rem 0.4rem;';
  btnExp.innerHTML = '&#x2B07; Esporta database_npc.json';
  btnExp.title = 'Scarica tutti gli NPC come file JSON';
  btnExp.onclick = function() { saveNpc(); notify('File database_npc.json scaricato.'); };
  jsonRow.appendChild(btnExp);

  var btnImp = document.createElement('button');
  btnImp.className = 'btn-npc btn-npc-dark';
  btnImp.style.cssText = 'flex:1;font-size:9px;padding:0.28rem 0.4rem;';
  btnImp.innerHTML = '&#x2B06; Importa database_npc.json';
  btnImp.title = 'Carica NPC da un file JSON precedentemente salvato';
  btnImp.onclick = loadNpc;
  jsonRow.appendChild(btnImp);

  ctrl.appendChild(jsonRow);

  left.appendChild(ctrl);
  grid.appendChild(left);

  /* ===================== COLONNA DESTRA ===================== */
  var right = document.createElement('div');

  if (state.archivioVisible) {
    /* ---- VISTA ARCHIVIO ---- */
    var archPanel = document.createElement('div');
    archPanel.className = 'npc-sheet';
    var archHead = document.createElement('div');
    archHead.className = 'npc-sheet-header';
    archHead.innerHTML =
      '<div class="npc-sheet-header-left">' + ICON.folder +
      '<div class="npc-sheet-title">Archivio Personaggi</div></div>' +
      '<span style="font-family:\'Cinzel\',serif;font-size:8.5px;color:var(--gold-dim);letter-spacing:0.15em;">' +
      state.personaggi.length + ' salvati</span>';
    archPanel.appendChild(archHead);
    var archBody = document.createElement('div');
    archBody.className = 'npc-sheet-body';
    if (state.personaggi.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'archivio-empty';
      empty.textContent = 'Nessun personaggio salvato. Compila o genera una scheda, poi premi "Salva in Archivio".';
      archBody.appendChild(empty);
    } else {
      /* Raggruppa per città */
      var byCity = {};
      state.personaggi.forEach(function(p) {
        var city = (p.citta && p.citta.trim()) ? p.citta.trim() : '— Senza città —';
        if (!byCity[city]) byCity[city] = [];
        byCity[city].push(p);
      });

      var cityKeys = Object.keys(byCity).sort(function(a, b) {
        if (a === '— Senza città —') return 1;
        if (b === '— Senza città —') return -1;
        return a.localeCompare(b, 'it');
      });

      var list = document.createElement('div');
      list.className = 'archivio-list';
      list.style.maxHeight = 'none';

      cityKeys.forEach(function(city) {
        var members = byCity[city];

        /* Cartella città */
        var folder = document.createElement('div');
        folder.style.cssText = 'margin-bottom:0.2rem;';

        var folderHdr = document.createElement('div');
        folderHdr.style.cssText = 'display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.5rem;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:3px;cursor:pointer;';
        folderHdr.innerHTML = '<span style="color:var(--gold);font-size:12px;">📁</span>' +
          '<span style="font-family:\'Cinzel\',serif;font-size:10px;font-weight:700;color:var(--text-strong);flex:1;">' + city + '</span>' +
          '<span style="background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:8px;padding:0 0.35rem;font-family:\'Cinzel\',serif;font-size:9px;color:var(--gold-dim);">' + members.length + '</span>' +
          '<span class="folder-arrow" style="color:var(--text-faint);font-size:10px;">▾</span>';

        var folderBody = document.createElement('div');
        folderBody.style.cssText = 'border:1px solid var(--border-subtle);border-top:none;border-radius:0 0 3px 3px;';

        folderHdr.onclick = function() {
          var isCollapsed = folderBody.style.display === 'none';
          folderBody.style.display = isCollapsed ? 'block' : 'none';
          var arrow = folderHdr.querySelector('.folder-arrow');
          if (arrow) arrow.textContent = isCollapsed ? '▾' : '▸';
        };

        /* Items nella cartella */
        members.sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'','it');}).forEach(function(p) {
          var item = document.createElement('div');
          var statusStyle = '';
          if (p.stato === 'ferito') statusStyle = 'border-left:3px solid var(--blood);';
          else if (p.stato === 'morto') statusStyle = 'opacity:0.5;filter:grayscale(1);';
          item.className = 'archivio-item';
          item.style.cssText = statusStyle + 'border-radius:0;';
          (function(npc){ item.onclick = function() { caricaNpcDaArchivio(npc); }; })(p);

          var thumb = document.createElement('div');
          thumb.className = 'archivio-thumb';
          if (p.immagine) {
            var tImg = document.createElement('img');
            tImg.src = p.immagine; tImg.alt = p.nome || '';
            tImg.onerror = function(){ this.parentNode.innerHTML = ICON.npc; };
            thumb.appendChild(tImg);
          } else { thumb.innerHTML = ICON.npc; }
          item.appendChild(thumb);

          var textCol = document.createElement('div');
          textCol.className = 'archivio-text';
          var nameEl = document.createElement('div');
          nameEl.className = 'archivio-item-name';
          if (p.stato === 'morto') {
            nameEl.style.cssText = 'text-decoration:line-through;color:var(--text-faint);';
          }
          nameEl.textContent = p.nome || '(senza nome)';
          textCol.appendChild(nameEl);
          var roleEl = document.createElement('div');
          roleEl.className = 'archivio-item-role';
          var statusLabel = p.stato === 'ferito' ? ' 🩸' : p.stato === 'morto' ? ' ☠' : '';
          roleEl.textContent = (p.ruolo || '') + (p.eta ? ' · '+p.eta+' anni' : '') + statusLabel;
          textCol.appendChild(roleEl);
          item.appendChild(textCol);

          var archBtn = document.createElement('button');
          archBtn.className = 'archivio-del';
          archBtn.title = 'Archivia in una città del Worldbuilding';
          archBtn.style.cssText = 'font-size:14px;width:22px;height:22px;';
          archBtn.textContent = '📦';
          (function(npc){ archBtn.onclick = function(e) { e.stopPropagation(); archivaNpcInCitta(npc); }; })(p);
          item.appendChild(archBtn);
          var delBtn = document.createElement('button');
          delBtn.className = 'archivio-del';
          delBtn.title = 'Elimina';
          delBtn.innerHTML = ICON.trash;
          (function(pid, pnome){ delBtn.onclick = function(e) { e.stopPropagation(); eliminaNpcDaArchivio(pid, pnome); }; })(p._id, p.nome);
          item.appendChild(delBtn);
          folderBody.appendChild(item);
        });

        folder.appendChild(folderHdr);
        folder.appendChild(folderBody);
        list.appendChild(folder);
      });
      archBody.appendChild(list);
    }
    archPanel.appendChild(archBody);
    right.appendChild(archPanel);

  } else {
    /* ---- VISTA SCHEDA NPC — BOOK VIEWER 3 PAGINE ---- */

    function ni(val,ph,cls){var el=document.createElement('input');el.type='number';el.value=val||'';el.placeholder=ph||'—';if(cls)el.className=cls;el.style.MozAppearance='textfield';el.style.webkitAppearance='none';return el;}
    function ti(val,ph,cls){var el=document.createElement('input');el.type='text';el.value=val||'';el.placeholder=ph||'';if(cls)el.className=cls;return el;}
    function mta(val,ph,cls,minH){var el=document.createElement('textarea');el.value=val||'';el.placeholder=ph||'';if(cls)el.className=cls;if(minH)el.style.minHeight=minH;return el;}
    function bind(inp,field){inp.addEventListener('input',function(){state.npc[field]=this.value;});}
    function nv(f){return state.npc[f]||'';}
    function statMod(v){var n=parseInt(v)||10;var m=Math.floor((n-10)/2);return(m>=0?'+':'')+m;}

    var STAT_MAP={'for':['tsFor','skAtle'],'des':['tsDes','skAcro','skFurt','skRapi'],'cos':['tsCos'],'int':['tsInt','skArca','skInda','skNatu','skReli','skStor'],'sag':['tsSag','skAnim','skIntu','skMedi','skPerc','skSopr'],'car':['tsCar','skInga','skInti','skIntr','skPers']};
    function calcBonus(field){var base=0;for(var stat in STAT_MAP){if(STAT_MAP[stat].indexOf(field)>=0){base=Math.floor((parseInt(nv(stat))||10-10)/2);base=Math.floor((parseInt(nv(stat))||10)-10)/2;base=Math.floor(base);break;}}var prof=parseInt(nv('competenza'))||2;return base+(state.npc[field+'_p']?prof:0);}
    var _autoCalcEls={};
    function refreshAutoCalc(){var af=['tsFor','tsDes','tsCos','tsInt','tsSag','tsCar','skAcro','skAnim','skArca','skAtle','skFurt','skInda','skInga','skInti','skIntr','skIntu','skMedi','skNatu','skPerc','skPers','skRapi','skReli','skSopr','skStor'];af.forEach(function(f){if(_autoCalcEls[f]){var v=calcBonus(f);_autoCalcEls[f].textContent=(v>=0?'+':'')+v;}});}

    /* top bar */
    var bookWrap=document.createElement('div');bookWrap.className='dnd-book-container';
    /* Make the whole sheet wider */
    bookWrap.style.cssText='position:relative;width:100%;margin:0 auto;';
    var bookTopBar=document.createElement('div');
    bookTopBar.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0.6rem 0.3rem;background:var(--bg-card);border:2px solid var(--border-gold);border-bottom:none;border-radius:4px 4px 0 0;';
    var bookTitle=document.createElement('div');
    bookTitle.style.cssText='font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:var(--gold-dim);';
    bookTitle.textContent='Scheda Personaggio';
    bookTopBar.appendChild(bookTitle);
    var saveBtn2=document.createElement('button');saveBtn2.className='btn-save-arch';saveBtn2.textContent='+ Salva in Archivio';saveBtn2.onclick=salvaNpcInArchivio;
    bookTopBar.appendChild(saveBtn2);bookWrap.appendChild(bookTopBar);

    var bookPages=document.createElement('div');bookPages.className='dnd-book-pages';
    /* Increase base font for parchment pages */
    bookPages.style.cssText='position:relative;overflow:hidden;border-radius:0 0 4px 4px;border:2px solid var(--border-gold);border-top:none;box-shadow:0 8px 40px rgba(0,0,0,0.55);background:#f5f0e8;font-size:14px;';
    if(!state._npcBookPage)state._npcBookPage=1;

    /* ════════════════════
       PAGINA 1 — Storia & Aspetto (prima cosa: descrivi l'NPC)
       ════════════════════ */
    var page1=document.createElement('div');page1.className='dnd-page dnd-parchment'+(state._npcBookPage===1?' active':'');

    /* banner p1 */
    var banner1=document.createElement('div');banner1.className='dnd-header-banner';
    var nc1=document.createElement('div');nc1.className='dnd-banner-name-col';
    var nl1=document.createElement('div');nl1.className='dnd-banner-name-label';nl1.style.fontSize='7px';nl1.textContent='Nome Personaggio';
    var nameInp1=ti(nv('nome'),'Nome...','dnd-banner-name-input dnd-name-sync');
    nameInp1.id = 'npc-nome-input';
    nameInp1.style.fontSize='16px';
    nameInp1.addEventListener('input',function(){state.npc.nome=this.value;document.querySelectorAll('.dnd-name-sync').forEach(function(e){if(e!==nameInp1)e.value=state.npc.nome;});});
    nc1.appendChild(nl1);nc1.appendChild(nameInp1);banner1.appendChild(nc1);
    var bf1=document.createElement('div');bf1.className='dnd-banner-fields';bf1.style.gridTemplateColumns='repeat(3,1fr)';
    [{lbl:'Classe & Livello',key:'ruolo',ph:'es. Guerriero 5'},{lbl:'Background',key:'bgShort',ph:'es. Soldato'},{lbl:'Razza',key:'razza',ph:'es. Umano'}].forEach(function(bf,i){
      var w=document.createElement('div');w.className='dnd-banner-field';w.style.borderBottom='none';if(i===2)w.style.borderRight='none';
      var l=document.createElement('div');l.className='dnd-banner-field-lbl';l.style.fontSize='6.5px';l.textContent=bf.lbl;
      var inp=ti(nv(bf.key),bf.ph,'dnd-banner-field-inp');inp.style.fontSize='13px';bind(inp,bf.key);
      w.appendChild(l);w.appendChild(inp);bf1.appendChild(w);
    });
    banner1.appendChild(bf1);page1.appendChild(banner1);

    var p1b=document.createElement('div');p1b.className='dnd-page2-body';/* reuse page2 layout: left col + right col */

    /* LEFT col p1: immagine + aspetto */
    var p1l=document.createElement('div');p1l.className='dnd-page2-left';p1l.style.width='290px';

    var appFr=document.createElement('div');appFr.className='dnd-appearance-frame';appFr.id='npc-avatar-frame';
    appFr.title='Clicca per cercare immagine';appFr.onclick=function(){if(!state._avatarLoading)cercaImmagineNpc(state.npc);};
    if(state._avatarLoading){var avOv1=document.createElement('div');avOv1.className='npc-avatar-ov';avOv1.innerHTML='<div class="npc-av-spin"></div>';appFr.appendChild(avOv1);}
    else if(state.npc.immagine){var avI1=document.createElement('img');avI1.src=state.npc.immagine;avI1.alt=state.npc.nome||'NPC';avI1.onerror=function(){state.npc.immagine='';aggiornaPannelloAvatar();};appFr.appendChild(avI1);}
    else{var avPh1=document.createElement('div');avPh1.className='dnd-appearance-ph';avPh1.innerHTML='&#128247;<br>Clicca per immagine';appFr.appendChild(avPh1);}
    p1l.appendChild(appFr);
    var ib1=document.createElement('div');ib1.style.cssText='display:flex;gap:4px;margin:4px 0;';
    var bs1=document.createElement('button');bs1.className='btn-av btn-av-gold';bs1.style.fontSize='12px';bs1.innerHTML=ICON.sparkles+' Cerca';bs1.onclick=function(){cercaImmagineNpc(state.npc);};
    /* Bottone Carica da dispositivo — salva base64 in Firebase, non scade mai */
    var bup1=document.createElement('button');bup1.className='btn-av btn-av-dim';bup1.style.fontSize='12px';bup1.textContent='📁 Carica';
    bup1.onclick=function(){
      var inp=document.createElement('input');inp.type='file';inp.accept='image/*';
      inp.onchange=function(){
        if(!this.files[0])return;
        var reader=new FileReader();
        reader.onload=function(ev){
          state.npc.immagine=ev.target.result;
          saveToStorage();fbSavePersonaggi();
          aggiornaPannelloAvatar();
          notify('Immagine caricata e salvata.');
        };
        reader.readAsDataURL(this.files[0]);
      };inp.click();
    };
    var bu1=document.createElement('button');bu1.className='btn-av btn-av-dim';bu1.style.fontSize='12px';bu1.textContent='URL';
    var ur1=document.createElement('div');ur1.style.cssText='display:none;gap:3px;margin-bottom:4px;';
    var ui1=ti(state.npc.immagine||'','https://...','');ui1.style.cssText='flex:1;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-size:12px;color:#111;';
    var uo1=document.createElement('button');uo1.className='btn-av btn-av-gold';uo1.style.cssText='flex:0;padding:2px 6px;font-size:12px;';uo1.textContent='OK';
    uo1.onclick=function(){state.npc.immagine=ui1.value.trim();ur1.style.display='none';saveToStorage();aggiornaPannelloAvatar();};
    bu1.onclick=function(){ur1.style.display=ur1.style.display==='flex'?'none':'flex';};
    ur1.appendChild(ui1);ur1.appendChild(uo1);
    ib1.appendChild(bs1);ib1.appendChild(bup1);ib1.appendChild(bu1);p1l.appendChild(ib1);p1l.appendChild(ur1);

    /* Aspetto fisico */
    var p1aspBox=document.createElement('div');p1aspBox.className='dnd-big-box';p1aspBox.style.flex='1';
    var p1aspTa=mta(nv('trattiFisici'),'Descrizione fisica, abbigliamento, segni particolari...','dnd-big-box-ta','60px');
    p1aspTa.style.fontSize='13px';bind(p1aspTa,'trattiFisici');
    var p1aspLbl=document.createElement('div');p1aspLbl.className='dnd-big-box-lbl';p1aspLbl.style.fontSize='7.5px';p1aspLbl.textContent='Aspetto del Personaggio';
    p1aspBox.appendChild(p1aspTa);p1aspBox.appendChild(p1aspLbl);p1l.appendChild(p1aspBox);
    p1b.appendChild(p1l);

    /* RIGHT col p1: tratti + storia + alleati + tesoro */
    var p1r=document.createElement('div');p1r.className='dnd-page2-right';

    /* Tratti Caratteriali (spostati dalla p2 alla p1 per questa facciata) */
    var tcBox1=document.createElement('div');tcBox1.className='dnd-big-box';
    var tcLbl1=document.createElement('div');tcLbl1.className='dnd-big-box-lbl';tcLbl1.style.fontSize='7.5px';tcLbl1.textContent='Tratti Caratteriali';
    var tcTa1=mta(nv('tratiCaratteriali'),'Personalità, motivazioni, tic, ossessioni...','dnd-big-box-ta','70px');
    tcTa1.style.fontSize='13px';bind(tcTa1,'tratiCaratteriali');
    tcBox1.appendChild(tcTa1);tcBox1.appendChild(tcLbl1);p1r.appendChild(tcBox1);

    /* Campo Città / Zona */
    var cittaBox1=document.createElement('div');cittaBox1.className='dnd-big-box';cittaBox1.style.cssText='border:1px solid #ccc;border-radius:3px;padding:6px 8px;background:#f9f5ec;';
    var cittaLbl1=document.createElement('div');cittaLbl1.className='dnd-big-box-lbl';cittaLbl1.style.fontSize='7.5px';cittaLbl1.textContent='Città / Zona';
    var cittaInp1=ti(nv('citta'),'Es. Porto del Nord, Foresta Oscura…','dnd-banner-field-inp');cittaInp1.style.fontSize='13px';bind(cittaInp1,'citta');
    cittaBox1.appendChild(cittaInp1);cittaBox1.appendChild(cittaLbl1);p1r.appendChild(cittaBox1);

    var allyBox1=document.createElement('div');allyBox1.className='dnd-big-box';
    var allyTa1=mta(nv('alleati'),'Alleati, organizzazioni, contatti chiave...','dnd-big-box-ta','75px');allyTa1.style.fontSize='13px';bind(allyTa1,'alleati');
    var allyLbl1=document.createElement('div');allyLbl1.className='dnd-big-box-lbl';allyLbl1.style.fontSize='7.5px';allyLbl1.textContent='Alleati & Organizzazioni';
    allyBox1.appendChild(allyTa1);allyBox1.appendChild(allyLbl1);p1r.appendChild(allyBox1);

    var storiaBox1=document.createElement('div');storiaBox1.className='dnd-big-box';storiaBox1.style.flex='1';
    var storiaTa1=mta(nv('background'),'Origini, storia, motivazioni, segreti...','dnd-big-box-ta','100px');storiaTa1.style.fontSize='13px';bind(storiaTa1,'background');
    var storiaLbl1=document.createElement('div');storiaLbl1.className='dnd-big-box-lbl';storiaLbl1.style.fontSize='7.5px';storiaLbl1.textContent='Storia del Personaggio';
    storiaBox1.appendChild(storiaTa1);storiaBox1.appendChild(storiaLbl1);p1r.appendChild(storiaBox1);

    var tesoroBox1=document.createElement('div');tesoroBox1.className='dnd-big-box';
    var tesoroTa1=mta(nv('oggettiIncantesimi'),'Oggetti magici, monete, gemme, armi speciali...','dnd-big-box-ta','60px');tesoroTa1.style.fontSize='13px';bind(tesoroTa1,'oggettiIncantesimi');
    var tesoroLbl1=document.createElement('div');tesoroLbl1.className='dnd-big-box-lbl';tesoroLbl1.style.fontSize='7.5px';tesoroLbl1.textContent='Tesoro & Equipaggiamento';
    tesoroBox1.appendChild(tesoroTa1);tesoroBox1.appendChild(tesoroLbl1);p1r.appendChild(tesoroBox1);

    p1b.appendChild(p1r);page1.appendChild(p1b);bookPages.appendChild(page1);

    /* ════════════════════
       PAGINA 2 — Scheda Combat (stats, saves, skills, CA, HP, attacchi, azioni)
       ════════════════════ */
    var page2=document.createElement('div');page2.className='dnd-page dnd-parchment'+(state._npcBookPage===2?' active':'');

    var banner2=document.createElement('div');banner2.className='dnd-header-banner';
    var nc2=document.createElement('div');nc2.className='dnd-banner-name-col';
    var nl2=document.createElement('div');nl2.className='dnd-banner-name-label';nl2.style.fontSize='7px';nl2.textContent='Nome Personaggio';
    var nameInp2=ti(nv('nome'),'Nome...','dnd-banner-name-input dnd-name-sync');nameInp2.style.fontSize='16px';
    nameInp2.addEventListener('input',function(){state.npc.nome=this.value;document.querySelectorAll('.dnd-name-sync').forEach(function(e){if(e!==nameInp2)e.value=state.npc.nome;});});
    nc2.appendChild(nl2);nc2.appendChild(nameInp2);banner2.appendChild(nc2);
    var bf2=document.createElement('div');bf2.className='dnd-banner-fields';bf2.style.gridTemplateColumns='repeat(3,1fr)';
    [{lbl:'Classe & Livello',key:'ruolo',ph:'es. Guerriero 5'},{lbl:'Razza',key:'razza',ph:'es. Umano'},{lbl:'Età',key:'eta',ph:'—'}].forEach(function(bf,i){
      var w=document.createElement('div');w.className='dnd-banner-field';w.style.borderBottom='none';if(i===2)w.style.borderRight='none';
      var l=document.createElement('div');l.className='dnd-banner-field-lbl';l.style.fontSize='6.5px';l.textContent=bf.lbl;
      var inp=ti(nv(bf.key),bf.ph,'dnd-banner-field-inp');inp.style.fontSize='13px';bind(inp,bf.key);
      w.appendChild(l);w.appendChild(inp);bf2.appendChild(w);
    });
    banner2.appendChild(bf2);page2.appendChild(banner2);

    var p2b=document.createElement('div');p2b.className='dnd-page1-body';/* 3-col layout */

    /* STATS col */
    var statsCol=document.createElement('div');statsCol.className='dnd-stats-col';statsCol.style.width='80px';
    var STAT_DEFS=[{lbl:'Forza',key:'for'},{lbl:'Destrezza',key:'des'},{lbl:'Costituzione',key:'cos'},{lbl:'Intelligenza',key:'int'},{lbl:'Saggezza',key:'sag'},{lbl:'Carisma',key:'car'}];
    STAT_DEFS.forEach(function(s){
      var box=document.createElement('div');box.className='dnd-stat-box';
      var sl=document.createElement('div');sl.className='dnd-stat-lbl';sl.style.fontSize='6px';sl.textContent=s.lbl;
      var sc=ni(nv(s.key),'10','dnd-stat-score');sc.style.cssText='width:100%;font-size:24px;';
      sc.addEventListener('input',function(){state.npc[s.key]=this.value;mod.textContent=statMod(this.value);refreshAutoCalc();});
      var mod=document.createElement('div');mod.className='dnd-stat-mod';mod.style.cssText='font-size:14px;width:26px;height:26px;';mod.textContent=statMod(nv(s.key));
      box.appendChild(sl);box.appendChild(sc);box.appendChild(mod);statsCol.appendChild(box);
    });
    p2b.appendChild(statsCol);

    /* MID col: competenza + tiri salvezza + abilità */
    var midCol=document.createElement('div');midCol.className='dnd-mid-col';

    var compRow=document.createElement('div');compRow.style.cssText='display:flex;gap:4px;align-items:center;margin-bottom:3px;';
    var compCircle=document.createElement('div');compCircle.style.cssText='width:32px;height:32px;border:1.5px solid #444;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;';
    var compInp=ni(nv('competenza'),'2','dnd-comp-num');compInp.style.fontSize='16px';compCircle.appendChild(compInp);
    compInp.addEventListener('input',function(){state.npc.competenza=this.value;refreshAutoCalc();});
    var compLblWrap=document.createElement('div');compLblWrap.className='dnd-border-box';compLblWrap.style.cssText='flex:1;padding:3px 6px;';
    var compLbl2=document.createElement('div');compLbl2.className='dnd-comp-lbl';compLbl2.style.fontSize='7.5px';compLbl2.textContent='Bonus di Competenza';
    compLblWrap.appendChild(compLbl2);compRow.appendChild(compCircle);compRow.appendChild(compLblWrap);
    midCol.appendChild(compRow);

    var savesBox=document.createElement('div');savesBox.className='dnd-border-box';
    [{lbl:'Forza',f:'tsFor'},{lbl:'Destrezza',f:'tsDes'},{lbl:'Costituzione',f:'tsCos'},{lbl:'Intelligenza',f:'tsInt'},{lbl:'Saggezza',f:'tsSag'},{lbl:'Carisma',f:'tsCar'}].forEach(function(sv){
      var row=document.createElement('div');row.className='dnd-skill-row';row.style.lineHeight='1.5';
      var c=document.createElement('div');c.className='dnd-skill-circle'+(state.npc[sv.f+'_p']?' filled':'');c.style.cssText='width:12px;height:12px;border-radius:50%;border:1.5px solid #444;background:transparent;flex-shrink:0;cursor:pointer;';
      if(state.npc[sv.f+'_p'])c.style.background='#333';
      c.onclick=function(){state.npc[sv.f+'_p']=!state.npc[sv.f+'_p'];c.style.background=state.npc[sv.f+'_p']?'#333':'transparent';refreshAutoCalc();};
      var vEl=document.createElement('span');vEl.className='dnd-skill-val';vEl.style.cssText='min-width:24px;font-weight:700;text-align:right;font-size:12px;color:#111;';
      _autoCalcEls[sv.f]=vEl;vEl.textContent=(calcBonus(sv.f)>=0?'+':'')+calcBonus(sv.f);
      var nm=document.createElement('span');nm.className='dnd-skill-name';nm.style.fontSize='12px';nm.textContent=sv.lbl;
      row.appendChild(c);row.appendChild(vEl);row.appendChild(nm);savesBox.appendChild(row);
    });
    var savT=document.createElement('div');savT.className='dnd-box-title';savT.style.fontSize='8px';savT.textContent='Tiri Salvezza';savesBox.appendChild(savT);
    midCol.appendChild(savesBox);

    var skBox=document.createElement('div');skBox.className='dnd-border-box';
    [{lbl:'Acrobazia',a:'(Des)',k:'skAcro'},{lbl:'Addestrare Animali',a:'(Sag)',k:'skAnim'},{lbl:'Arcano',a:'(Int)',k:'skArca'},{lbl:'Atletica',a:'(For)',k:'skAtle'},{lbl:'Furtività',a:'(Des)',k:'skFurt'},{lbl:'Indagare',a:'(Int)',k:'skInda'},{lbl:'Inganno',a:'(Car)',k:'skInga'},{lbl:'Intimidire',a:'(Car)',k:'skInti'},{lbl:'Intrattenere',a:'(Car)',k:'skIntr'},{lbl:'Intuizione',a:'(Sag)',k:'skIntu'},{lbl:'Medicina',a:'(Sag)',k:'skMedi'},{lbl:'Natura',a:'(Int)',k:'skNatu'},{lbl:'Percezione',a:'(Sag)',k:'skPerc'},{lbl:'Persuasione',a:'(Car)',k:'skPers'},{lbl:'Rapidità di Mano',a:'(Des)',k:'skRapi'},{lbl:'Religione',a:'(Int)',k:'skReli'},{lbl:'Sopravvivenza',a:'(Sag)',k:'skSopr'},{lbl:'Storia',a:'(Int)',k:'skStor'}].forEach(function(sk){
      var row=document.createElement('div');row.className='dnd-skill-row';row.style.lineHeight='1.45';
      var c=document.createElement('div');c.className='dnd-skill-circle'+(state.npc[sk.k+'_p']?' filled':'');c.style.cssText='width:12px;height:12px;border-radius:50%;border:1.5px solid #444;background:transparent;flex-shrink:0;cursor:pointer;';
      if(state.npc[sk.k+'_p'])c.style.background='#333';
      c.onclick=function(){state.npc[sk.k+'_p']=!state.npc[sk.k+'_p'];c.style.background=state.npc[sk.k+'_p']?'#333':'transparent';refreshAutoCalc();};
      var vEl=document.createElement('span');vEl.className='dnd-skill-val';vEl.style.cssText='min-width:24px;font-weight:700;text-align:right;font-size:11px;color:#111;';
      _autoCalcEls[sk.k]=vEl;vEl.textContent=(calcBonus(sk.k)>=0?'+':'')+calcBonus(sk.k);
      var nm=document.createElement('span');nm.className='dnd-skill-name';nm.style.fontSize='11px';nm.innerHTML=sk.lbl+' <span style="color:#777;font-size:9.5px;">'+sk.a+'</span>';
      row.appendChild(c);row.appendChild(vEl);row.appendChild(nm);skBox.appendChild(row);
    });
    var skT=document.createElement('div');skT.className='dnd-box-title';skT.style.fontSize='8px';skT.textContent='Abilità';skBox.appendChild(skT);
    midCol.appendChild(skBox);
    p2b.appendChild(midCol);

    /* RIGHT col: CA + HP + ATTACCHI (grande) + AZIONI (grande) */
    var rc2=document.createElement('div');rc2.style.cssText='display:flex;flex-direction:column;gap:7px;flex:1;min-width:0;';

    /* CA + Velocità */
    var combRow2=document.createElement('div');combRow2.className='dnd-combat-row';combRow2.style.marginBottom='4px';
    var shieldWrap=document.createElement('div');shieldWrap.className='dnd-shield-ca';shieldWrap.style.cssText='position:relative;width:58px;height:64px;flex-shrink:0;';
    shieldWrap.innerHTML='<svg style="width:58px;height:64px;display:block;" viewBox="0 0 52 58"><path style="fill:#fff;stroke:#333;stroke-width:2;" d="M26 2 L50 10 L50 30 Q50 50 26 56 Q2 50 2 30 L2 10 Z"/></svg>';
    var shInp=ni(nv('ca'),'—','dnd-shield-inp');shInp.style.cssText='position:absolute;top:44%;left:50%;transform:translate(-50%,-50%);font-size:22px;font-weight:700;border:none;outline:none;background:transparent;text-align:center;width:40px;color:#111;-moz-appearance:textfield;';
    bind(shInp,'ca');
    var shLbl=document.createElement('div');shLbl.className='dnd-shield-lbl';shLbl.style.cssText='position:absolute;bottom:5px;left:0;right:0;font-family:\'Cinzel\',serif;font-size:6px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#444;text-align:center;';shLbl.textContent='CA';
    shieldWrap.appendChild(shInp);shieldWrap.appendChild(shLbl);combRow2.appendChild(shieldWrap);
    var velB2=document.createElement('div');velB2.className='dnd-combat-blob';
    var velI2=ti(nv('velocita'),'30m','dnd-combat-blob-inp');velI2.style.fontSize='20px';bind(velI2,'velocita');
    var velL2=document.createElement('div');velL2.className='dnd-combat-lbl';velL2.style.fontSize='6.5px';velL2.textContent='Velocità';
    velB2.appendChild(velI2);velB2.appendChild(velL2);combRow2.appendChild(velB2);
    rc2.appendChild(combRow2);

    /* HP */
    var hpSect=document.createElement('div');hpSect.className='dnd-hp-section';
    var hpMr=document.createElement('div');hpMr.className='dnd-hp-max-row';hpMr.style.fontSize='11px';hpMr.innerHTML='Max HP: ';
    var hpMi=ni(nv('hpMax'),'—','dnd-hp-max-inp');hpMi.style.fontSize='11px';bind(hpMi,'hpMax');hpMr.appendChild(hpMi);
    var hpCi=ni(nv('hp'),'—','dnd-hp-cur-inp');hpCi.style.fontSize='26px';bind(hpCi,'hp');
    var hpLb=document.createElement('div');hpLb.className='dnd-hp-lbl';hpLb.style.fontSize='7.5px';hpLb.textContent='Punti Ferita Attuali';
    hpSect.appendChild(hpMr);hpSect.appendChild(hpCi);hpSect.appendChild(hpLb);rc2.appendChild(hpSect);

    /* Status vitale */
    var statusRow = document.createElement('div');
    statusRow.className = 'npc-status-row';
    ['vivo','ferito','morto'].forEach(function(s) {
      var btn = document.createElement('button');
      btn.className = 'npc-status-btn';
      var labels = {vivo:'⚔ Vivo', ferito:'🩸 Ferito', morto:'☠ Morto'};
      btn.textContent = labels[s];
      var currentStato = state.npc.stato || 'vivo';
      if (currentStato === s) btn.classList.add('active-' + s);
      (function(stato, btnEl) {
        btnEl.onclick = function() {
          state.npc.stato = stato;
          saveToStorage();
          statusRow.querySelectorAll('.npc-status-btn').forEach(function(b) {
            b.className = 'npc-status-btn';
          });
          btnEl.classList.add('active-' + stato);
        };
      })(s, btn);
      statusRow.appendChild(btn);
    });
    rc2.appendChild(statusRow);

    /* ═══ ATTACCHI & INCANTESIMI — grande e centrale ═══ */
    (function(){
      if(!Array.isArray(state.npc.attacchi)||state.npc.attacchi.length===0)state.npc.attacchi=[{nome:'',bonus:'',danno:''},{nome:'',bonus:'',danno:''},{nome:'',bonus:'',danno:''},{nome:'',bonus:'',danno:''},{nome:'',bonus:'',danno:''}];
      var atkWrap=document.createElement('div');
      atkWrap.style.cssText='border:2px solid #666;border-radius:4px;overflow:hidden;background:#fff;flex-shrink:0;min-height:220px;';

      var thead=document.createElement('div');
      thead.style.cssText='display:grid;grid-template-columns:1fr 100px 170px;background:#e4ddc8;border-bottom:2px solid #888;';
      ['Nome','Bonus Att.','Danni / Tipo'].forEach(function(h){
        var th=document.createElement('div');
        th.style.cssText='font-family:\'Cinzel\',serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#333;padding:7px 8px;border-right:1px solid #bbb;';
        th.textContent=h;thead.appendChild(th);
      });
      atkWrap.appendChild(thead);

      var tbody=document.createElement('div');tbody.id='dnd-atk-tbody2';
      function renderAtkRows(){
        tbody.innerHTML='';
        state.npc.attacchi.forEach(function(atk,idx){
          var tr=document.createElement('div');
          tr.style.cssText='display:grid;grid-template-columns:1fr 100px 170px;border-bottom:1px solid #ddd;';
          [{k:'nome',ph:'es. Spada lunga'},{k:'bonus',ph:'+5'},{k:'danno',ph:'1d8+3 tagl.'}].forEach(function(f){
            var td=document.createElement('div');td.style.cssText='border-right:1px solid #e0dbd0;padding:2px 4px;';
            var inp=ti(atk[f.k],f.ph,'');
            inp.style.cssText='border:none;outline:none;background:transparent;font-family:\'EB Garamond\',serif;font-size:16px;color:#111;width:100%;padding:4px 5px;';
            (function(i2,fk){inp.addEventListener('input',function(){
              state.npc.attacchi[i2][fk]=this.value;
              var last=state.npc.attacchi[state.npc.attacchi.length-1];
              if(i2===state.npc.attacchi.length-1&&(last.nome||last.bonus||last.danno)){state.npc.attacchi.push({nome:'',bonus:'',danno:''});renderAtkRows();}
            });})(idx,f.k);
            td.appendChild(inp);tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      }
      renderAtkRows();
      atkWrap.appendChild(tbody);

      var tfoot=document.createElement('div');
      tfoot.style.cssText='font-family:\'Cinzel\',serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:#555;text-align:center;padding:6px;border-top:2px solid #888;background:#e4ddc8;';
      tfoot.textContent='Attacchi & Incantesimi';
      atkWrap.appendChild(tfoot);

      var addBtn=document.createElement('button');
      addBtn.style.cssText='display:block;width:100%;background:transparent;border:1px dashed #bbb;color:#999;font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;padding:6px;cursor:pointer;border-radius:0 0 4px 4px;transition:all 0.15s;margin-top:2px;';
      addBtn.textContent='+ Aggiungi Riga';
      addBtn.onclick=function(){state.npc.attacchi.push({nome:'',bonus:'',danno:''});renderAtkRows();};
      addBtn.onmouseenter=function(){this.style.background='#f0ece0';this.style.color='#444';this.style.borderColor='#888';};
      addBtn.onmouseleave=function(){this.style.background='transparent';this.style.color='#999';this.style.borderColor='#bbb';};

      rc2.appendChild(atkWrap);
      rc2.appendChild(addBtn);
    })();

    /* ═══ AZIONI & AZIONI LEGGENDARIE — grande ═══ */
    var azWrap=document.createElement('div');
    azWrap.style.cssText='border:2px solid #666;border-radius:4px;overflow:hidden;background:#fff;flex:1;display:flex;flex-direction:column;min-height:320px;';
    var azHead=document.createElement('div');
    azHead.style.cssText='font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#333;background:#e4ddc8;border-bottom:2px solid #888;padding:8px 10px;flex-shrink:0;';
    azHead.textContent='Azioni & Azioni Leggendarie';
    var azTa=mta(nv('azioniTesto'),
      'Es:\nMultiattacco: effettua 2 attacchi con la spada\n\nAzione leggendaria – Passo Spettrale (1 pt): si sposta di 9m senza provocare attacchi di opportunità\nAzione leggendaria – Attacco Rapido (2 pt): effettua un attacco immediato',
      '');
    azTa.style.cssText='flex:1;border:none;outline:none;background:transparent;font-family:\'EB Garamond\',serif;font-size:16px;color:#111;padding:10px 12px;resize:none;min-height:320px;line-height:1.6;display:block;box-sizing:border-box;width:100%;';
    azTa.addEventListener('input',function(){state.npc.azioniTesto=this.value;});
    azWrap.appendChild(azHead);azWrap.appendChild(azTa);
    rc2.appendChild(azWrap);

    p2b.appendChild(rc2);page2.appendChild(p2b);bookPages.appendChild(page2);

    /* ════════════════════
       PAGINA 3 — Incantesimi
       ════════════════════ */
    var page3=document.createElement('div');page3.className='dnd-page dnd-parchment'+(state._npcBookPage===3?' active':'');
    var banner3=document.createElement('div');banner3.className='dnd-header-banner';
    var nc3=document.createElement('div');nc3.className='dnd-banner-name-col';
    var nl3=document.createElement('div');nl3.className='dnd-banner-name-label';nl3.style.fontSize='7px';nl3.textContent='Classe da Incantatore';
    var ni3=ti(nv('classeIncantatore'),'es. Mago','dnd-banner-name-input');ni3.style.fontSize='16px';bind(ni3,'classeIncantatore');
    nc3.appendChild(nl3);nc3.appendChild(ni3);banner3.appendChild(nc3);
    var bf3=document.createElement('div');bf3.className='dnd-banner-fields';bf3.style.gridTemplateColumns='repeat(3,1fr)';
    [{lbl:'Caratteristica da Incantatore',key:'charIncantatore'},{lbl:'CD Tiro Salvezza Incantesimi',key:'cdIncantesimi'},{lbl:'Bonus di Attacco Incantesimi',key:'bonusAttaccoInc'}].forEach(function(bf,i){
      var w=document.createElement('div');w.className='dnd-banner-field';w.style.borderBottom='none';if(i===2)w.style.borderRight='none';
      var l=document.createElement('div');l.className='dnd-banner-field-lbl';l.style.fontSize='6.5px';l.textContent=bf.lbl;
      var inp=ti(nv(bf.key),'','dnd-banner-field-inp');inp.style.fontSize='13px';bind(inp,bf.key);
      w.appendChild(l);w.appendChild(inp);bf3.appendChild(w);
    });
    banner3.appendChild(bf3);page3.appendChild(banner3);

    var p3b=document.createElement('div');p3b.className='dnd-page3-body';
    function makeSpellCol(levels){
      var col=document.createElement('div');col.className='dnd-spell-col';
      levels.forEach(function(lvD){
        if(lvD.level===0){
          var sect=document.createElement('div');sect.className='dnd-trucchi-section';
          var lbl0=document.createElement('div');lbl0.className='dnd-trucchi-lbl';lbl0.style.fontSize='8px';lbl0.textContent='Trucchetti (Livello 0)';sect.appendChild(lbl0);
          var sl=document.createElement('div');sl.className='dnd-spell-list';
          for(var i=0;i<8;i++){
            var row=document.createElement('div');row.className='dnd-spell-row';
            var inp=ti(nv('trucco_'+i),'','dnd-spell-inp');inp.style.fontSize='13px';bind(inp,'trucco_'+i);
            row.appendChild(inp);sl.appendChild(row);
          }
          sect.appendChild(sl);col.appendChild(sect);
        }else{
          var sh=document.createElement('div');sh.className='dnd-spell-slot-header';
          var badge=document.createElement('div');badge.className='dnd-spell-level-badge';badge.style.cssText='width:30px;height:30px;font-size:17px;';badge.textContent=String(lvD.level);
          var si=document.createElement('div');si.className='dnd-spell-slots-info';
          var sll=document.createElement('div');sll.className='dnd-spell-slots-lbl';sll.style.fontSize='6.5px';sll.innerHTML='Slot Totali&nbsp;&nbsp;Slot Spesi';
          var sr=document.createElement('div');sr.className='dnd-spell-slots-row';
          var st2=ni(nv('slotTot'+lvD.level),'','dnd-spell-slots-inp');st2.style.fontSize='13px';bind(st2,'slotTot'+lvD.level);
          var ss2=ni(nv('slotSp'+lvD.level),'','dnd-spell-slots-inp');ss2.style.fontSize='13px';bind(ss2,'slotSp'+lvD.level);
          sr.appendChild(st2);sr.appendChild(ss2);si.appendChild(sll);si.appendChild(sr);
          sh.appendChild(badge);sh.appendChild(si);col.appendChild(sh);
          var sl2=document.createElement('div');sl2.className='dnd-spell-list';
          for(var j=0;j<lvD.slots;j++){
            var row2=document.createElement('div');row2.className='dnd-spell-row';
            var circ2=document.createElement('div');circ2.className='dnd-spell-circle'+(state.npc['spPrep_'+lvD.level+'_'+j]?' filled':'');
            circ2.onclick=(function(lv,si2){return function(){var k='spPrep_'+lv+'_'+si2;state.npc[k]=!state.npc[k];this.classList.toggle('filled');};})(lvD.level,j);
            var sinp=ti(nv('spell_'+lvD.level+'_'+j),'','dnd-spell-inp');sinp.style.fontSize='13px';bind(sinp,'spell_'+lvD.level+'_'+j);
            row2.appendChild(circ2);row2.appendChild(sinp);sl2.appendChild(row2);
          }
          col.appendChild(sl2);
        }
      });
      return col;
    }
    p3b.appendChild(makeSpellCol([{level:0},{level:1,slots:12},{level:2,slots:13}]));
    p3b.appendChild(makeSpellCol([{level:3,slots:13},{level:4,slots:13},{level:5,slots:9}]));
    p3b.appendChild(makeSpellCol([{level:6,slots:9},{level:7,slots:9},{level:8,slots:7},{level:9,slots:7}]));
    page3.appendChild(p3b);bookPages.appendChild(page3);
    bookWrap.appendChild(bookPages);

    /* ════════ NAVIGAZIONE ════════ */
    var PNAMES=['Storia & Aspetto','Scheda Combat','Incantesimi'];
    var bookNav=document.createElement('div');bookNav.className='dnd-book-nav';
    var btnPrev=document.createElement('button');btnPrev.className='dnd-nav-btn';btnPrev.innerHTML='&#8592; Precedente';
    var dotWrap=document.createElement('div');dotWrap.className='dnd-page-dots';
    var pgLbl=document.createElement('div');pgLbl.className='dnd-page-label';
    var btnNext=document.createElement('button');btnNext.className='dnd-nav-btn';btnNext.innerHTML='Successiva &#8594;';

    var allPages=[page1,page2,page3];
    var allDots=[];
    for(var ppi=0;ppi<3;ppi++){
      var dot=document.createElement('div');dot.className='dnd-page-dot';
      if(state._npcBookPage===ppi+1)dot.classList.add('active');
      (function(pn){dot.addEventListener('click',function(){_goPage(pn);});})(ppi+1);
      dotWrap.appendChild(dot);allDots.push(dot);
    }
    dotWrap.appendChild(pgLbl);

    function _goPage(n){
      var prev=state._npcBookPage;
      state._npcBookPage=n;
      allPages.forEach(function(p){p.classList.remove('active','flip-left');});
      var target=allPages[n-1];
      target.classList.add('active');
      if(n<prev)target.classList.add('flip-left');
      pgLbl.textContent=PNAMES[n-1];
      btnPrev.disabled=(n<=1);
      btnNext.disabled=(n>=3);
      allDots.forEach(function(d,di){d.classList.toggle('active',di+1===n);});
    }
    _goPage(state._npcBookPage||1);
    btnPrev.addEventListener('click',function(){if(state._npcBookPage>1)_goPage(state._npcBookPage-1);});
    btnNext.addEventListener('click',function(){if(state._npcBookPage<3)_goPage(state._npcBookPage+1);});

    bookNav.appendChild(btnPrev);bookNav.appendChild(dotWrap);bookNav.appendChild(btnNext);
    bookWrap.appendChild(bookNav);
    right.appendChild(bookWrap);
  }


  grid.appendChild(right);
  section.appendChild(grid);
  wrap.appendChild(section);
  return wrap;
}


/* ===========================================================
   === SEZIONE STATISTICHE & CAOS ===
   =========================================================== */

/* Calcola il "livello" estetico in base a fail o succ */
function getCounterLevel(count) {
  if (count >= 5) return 3;
  if (count >= 4) return 2;
  if (count >= 3) return 1;
  return 0;
}

/* Aggrega le classi CSS della player-row in base a fail/succ */
function getPlayerRowClasses(player) {
  var failLvl = getCounterLevel(player.fail);
  var succLvl = getCounterLevel(player.succ);
  /* Prendiamo il livello dominante (massimo dei due). A parità, il fail "vince"
     perché in un'avventura un disastro si nota di più di un trionfo. */
  if (failLvl >= succLvl && failLvl > 0) return 'lvl' + failLvl + '-fail';
  if (succLvl > 0) return 'lvl' + succLvl + '-succ';
  return '';
}

/* ===== BESTIARIO CUSTOM ===== */
function updateBestiarioGrid() {
  var q = (state.bestSearch || '').toLowerCase().trim();
  var fTaglia = state.bestFiltroTaglia || '';
  var fTipo = state.bestFiltroTipo || '';
  var fGS = state.bestFiltroGS || '';
  var filtered = state.bestiario.filter(function(m) {
    if (fTaglia && (m.taglia||'') !== fTaglia) return false;
    if (fTipo && (m.tipo||'') !== fTipo) return false;
    if (fGS && (m.grsfida||'') !== fGS) return false;
    if (!q) return true;
    return (m.nome||'').toLowerCase().indexOf(q) >= 0;
  }).sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'','it');});
  var counter = document.getElementById('best-counter');
  if (counter) {
    counter.className = 'results-counter';
    if (filtered.length === state.bestiario.length) {
      counter.innerHTML = '<strong>' + state.bestiario.length + '</strong> <span class="dot"></span> <span>MOSTRI NEL BESTIARIO</span>';
    } else {
      counter.innerHTML = '<strong>' + filtered.length + '</strong> <span class="dot"></span> <span>DI ' + state.bestiario.length + ' MOSTRI</span>';
    }
  }
  var grid = document.getElementById('bestiario-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (filtered.length === 0) {
    grid.className = '';
    if (state.bestiario.length === 0) {
      grid.innerHTML = '<div class="empty-state panel-glass"><div class="rune">🐉</div><h2>Il bestiario è vuoto</h2><p>Aggiungi il primo mostro con il pulsante "Nuovo Mostro".</p>' + (isAdmin() ? '<button class="btn-gold" id="best-add-empty">' + ICON.plus + ' Aggiungi primo mostro</button>' : '') + '</div>';
      var ea = document.getElementById('best-add-empty');
      if (ea) ea.onclick = function() { state.bestEditingId = null; state.bestShowForm = true; render(); };
    } else {
      grid.innerHTML = '<div class="empty-state panel-glass"><div class="rune">🐉</div><h2>Nessun mostro trovato</h2><p>La ricerca non corrisponde ad alcun mostro nel bestiario.</p><button class="btn-gold" id="best-clear">Ripulisci ricerca</button></div>';
      var ec = document.getElementById('best-clear');
      if (ec) ec.onclick = function() { state.bestSearch = ''; renderMain(); };
    }
    return;
  }
  grid.className = 'weapon-grid';
  filtered.forEach(function(m) { grid.appendChild(renderBestiarCard(m)); });
}

function fmtStatBlock(text) {
  if (!text) return '';
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var paras = text.split(/\n\n+/);
  var html = paras.map(function(para) {
    para = para.trim();
    if (!para) return '';
    var name = '', desc = '';
    // Formato 1: "Nome: descrizione" (colon entro 80 chars, inizia con maiuscola)
    var m1 = para.match(/^([A-ZÀÈÉÌÒÙÄ][^:\n]{0,79}):\s*([\s\S]*)$/);
    // Formato 2: "Nome\ndescrizione" (prima riga breve con maiuscola)
    var m2 = !m1 && para.match(/^([A-ZÀÈÉÌÒÙÄ][^\n]{0,79})\n([\s\S]+)$/);
    if (m1) { name = m1[1].trim(); desc = m1[2].trim(); }
    else if (m2) { name = m2[1].trim(); desc = m2[2].trim(); }
    else { desc = para; }
    var descHtml = escapeHtml(desc).replace(/\n/g, '<br>');
    if (name) {
      return '<div style="margin-bottom:1.4rem;">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:17px;font-weight:700;color:var(--gold-bright);margin-bottom:0.45rem;padding-bottom:0.3rem;border-bottom:1px solid rgba(201,165,92,0.3);">'
        + escapeHtml(name) + '</div>'
        + '<div style="font-family:\'EB Garamond\',serif;font-size:16px;line-height:1.8;color:var(--text-main);">' + descHtml + '</div>'
        + '</div>';
    } else {
      return '<div style="font-family:\'EB Garamond\',serif;font-size:16px;line-height:1.8;color:var(--text-main);margin-bottom:1.4rem;">'
        + escapeHtml(desc).replace(/\n/g, '<br>') + '</div>';
    }
  }).join('');
  return html;
}

function openDetailModal(type, data) {
  var existing = document.getElementById('detail-modal-root');
  if (existing) existing.remove();

  var back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.id = 'detail-modal-root';
  function _closeDetail() {
    document.removeEventListener('keydown', kh);
    if (window.SiumAnimations && window.SiumAnimations.closeModalAnimated) {
      window.SiumAnimations.closeModalAnimated(back);
    } else {
      back.remove();
    }
  }
  back.onclick = function(e) { if (e.target === back) _closeDetail(); };

  var kh = function(e) { if (e.key === 'Escape') _closeDetail(); };
  document.addEventListener('keydown', kh);

  var panel = document.createElement('div');
  panel.className = 'detail-modal-panel';
  panel.onclick = function(e) { e.stopPropagation(); };

  /* HEAD */
  var head = document.createElement('div');
  head.className = 'modal-head';
  var headLeft = document.createElement('div');
  var titleEl = document.createElement('h2');
  titleEl.style.cssText = 'font-family:\'Cinzel\',serif;font-size:22px;font-weight:700;color:var(--gold-bright);margin:0;';
  titleEl.textContent = data.nome;
  headLeft.appendChild(titleEl);
  var chipRow = document.createElement('div');
  chipRow.style.cssText = 'display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap;';
  if (type === 'mostro') {
    if (data.tipo) { var c1=document.createElement('span'); c1.className='type-chip'; c1.textContent=data.tipo; chipRow.appendChild(c1); }
    if (data.taglia) { var c2=document.createElement('span'); c2.className='type-chip'; c2.style.cssText='background:rgba(120,80,10,0.7);border:1px solid #c9a55c;color:#f0cc80;'; c2.textContent=data.taglia; chipRow.appendChild(c2); }
    if (data.allineamento) { var c3=document.createElement('span'); c3.className='type-chip'; c3.style.cssText='background:rgba(40,80,140,0.7);border:1px solid #5c9ec9;color:#90c8ef;'; c3.textContent=data.allineamento; chipRow.appendChild(c3); }
    if (data.grsfida) { var c4=document.createElement('span'); c4.className='type-chip'; c4.style.cssText='background:rgba(140,30,30,0.7);border:1px solid #e05050;color:#ff9090;'; c4.textContent='GS '+data.grsfida+(data.pe?' ('+data.pe+' PE)':''); chipRow.appendChild(c4); }
  } else {
    if (data.tipo) { var c1=document.createElement('span'); c1.className='type-chip'; c1.textContent=data.tipo; chipRow.appendChild(c1); }
    if (data.rarita) { var c2=document.createElement('span'); c2.className='rarity-tag '+rarityClass(data.rarita); c2.textContent=data.rarita; chipRow.appendChild(c2); }
  }
  if (chipRow.children.length) headLeft.appendChild(chipRow);
  var closeBtn = document.createElement('button');
  closeBtn.className = 'theme-toggle';
  closeBtn.style.cssText = 'width:38px;height:38px;flex-shrink:0;';
  closeBtn.innerHTML = ICON.x;
  closeBtn.onclick = function() { _closeDetail(); };
  head.appendChild(headLeft);
  head.appendChild(closeBtn);
  panel.appendChild(head);

  /* BODY */
  var body = document.createElement('div');
  body.style.cssText = 'padding:1.5rem;';

  var grid = document.createElement('div');
  grid.className = 'detail-modal-grid';

  /* Left: immagine */
  var leftCol = document.createElement('div');
  var imgWrap = document.createElement('div');
  imgWrap.className = 'detail-modal-img-wrap';
  if (data.immagine) {
    var im = document.createElement('img');
    im.src = data.immagine; im.alt = data.nome;
    im.onerror = function() {
      if (type === 'mostro') {
        imgWrap.innerHTML = '<div style="font-size:4rem;">🐉</div>';
      } else {
        this.onerror = null;
        this.src = 'path/to/default-pirate-item.png';
      }
    };
    imgWrap.appendChild(im);
  } else {
    if (type === 'mostro') {
      imgWrap.innerHTML = '<div style="font-size:4rem;">🐉</div>';
    } else {
      var im = document.createElement('img');
      im.src = 'path/to/default-pirate-item.png';
      im.alt = data.nome;
      imgWrap.appendChild(im);
    }
  }
  leftCol.appendChild(imgWrap);
  if (type === 'mostro' && data.url) {
    var urlLnk = document.createElement('a');
    urlLnk.href = data.url; urlLnk.target = '_blank';
    urlLnk.style.cssText = 'display:block;text-align:center;margin-top:0.65rem;font-family:\'EB Garamond\',serif;font-size:13px;color:var(--gold-dim);text-decoration:none;';
    urlLnk.textContent = '🔗 Scheda su dungeonedraghi.it';
    leftCol.appendChild(urlLnk);
  }
  grid.appendChild(leftCol);

  /* Right: stats */
  var rightCol = document.createElement('div');

  if (type === 'mostro') {
    /* HP / CA / VEL pills */
    var pillRow = document.createElement('div');
    pillRow.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;';
    [['HP',data.hp,'#c84040'],['CA',data.ca,'#c9a55c'],['VEL',data.velocita,'#5c9ec9']].forEach(function(s){
      if (!s[1]) return;
      var pill=document.createElement('div');
      pill.style.cssText='background:'+s[2]+'22;border:1px solid '+s[2]+'88;border-radius:4px;padding:0.4rem 1rem;font-family:\'Cinzel\',serif;font-size:15px;font-weight:700;color:'+s[2]+';';
      pill.textContent=s[0]+': '+s[1];
      pillRow.appendChild(pill);
    });
    rightCol.appendChild(pillRow);

    /* Stat grid */
    var sg = document.createElement('div');
    sg.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:0.25rem;margin-bottom:1rem;border:1px solid var(--border-subtle);border-radius:4px;overflow:hidden;';
    [['FOR',data.for],['DES',data.des],['COS',data.cos],['INT',data.int],['SAG',data.sag],['CAR',data.car]].forEach(function(s){
      var cell=document.createElement('div');
      cell.style.cssText='text-align:center;padding:0.4rem 0.1rem;background:var(--bg-base);';
      var lbl=document.createElement('div'); lbl.style.cssText='font-family:\'Cinzel\',serif;font-size:12px;font-weight:700;color:var(--gold-bright);letter-spacing:0.1em;';
      lbl.textContent=s[0];
      var val=document.createElement('div'); val.style.cssText='font-family:\'EB Garamond\',serif;font-size:22px;font-weight:700;color:var(--text-strong);line-height:1.2;';
      val.textContent=s[1]||'—';
      var mod=document.createElement('div'); mod.style.cssText='font-family:\'EB Garamond\',serif;font-size:15px;color:var(--text-main);';
      var mv=s[1]?Math.floor((s[1]-10)/2):null;
      mod.textContent=mv!==null?(mv>=0?'+'+mv:''+mv):'';
      cell.appendChild(lbl); cell.appendChild(val); cell.appendChild(mod);
      sg.appendChild(cell);
    });
    rightCol.appendChild(sg);

    if (data.lingue) {
      var lingP=document.createElement('p');
      lingP.style.cssText='font-size:17px;color:var(--text-main);margin:0 0 0.6rem;font-family:\'EB Garamond\',serif;';
      lingP.innerHTML='<span style="color:var(--gold-bright);font-weight:700;font-family:\'Cinzel\',serif;font-size:13px;letter-spacing:0.08em;">🗣 LINGUE&nbsp;</span>'+escapeHtml(data.lingue);
      rightCol.appendChild(lingP);
    }
    if (data.ts) {
      var tsP=document.createElement('p');
      tsP.style.cssText='font-size:17px;color:var(--text-main);margin:0 0 0.6rem;font-family:\'EB Garamond\',serif;';
      tsP.innerHTML='<span style="color:var(--gold-bright);font-weight:700;font-family:\'Cinzel\',serif;font-size:13px;letter-spacing:0.08em;">TIRI SALVEZZA&nbsp;</span>'+escapeHtml(data.ts);
      rightCol.appendChild(tsP);
    }
    if (data.sensi) {
      var sensiP=document.createElement('p');
      sensiP.style.cssText='font-size:17px;color:var(--text-main);margin:0 0 0.6rem;font-family:\'EB Garamond\',serif;';
      sensiP.innerHTML='<span style="color:var(--gold-bright);font-weight:700;font-family:\'Cinzel\',serif;font-size:13px;letter-spacing:0.08em;">👁 SENSI&nbsp;</span>'+escapeHtml(data.sensi);
      rightCol.appendChild(sensiP);
    }
    if (data.abilita) {
      var abP=document.createElement('p');
      abP.style.cssText='font-size:17px;color:var(--text-main);margin:0 0 0.6rem;font-family:\'EB Garamond\',serif;';
      abP.innerHTML='<span style="color:var(--gold-bright);font-weight:700;font-family:\'Cinzel\',serif;font-size:13px;letter-spacing:0.08em;">★ ABILITÀ&nbsp;</span>'+escapeHtml(data.abilita);
      rightCol.appendChild(abP);
    }
  }

  if (type === 'arma') {
    // Price removed as requested
    if (data.descrizione) {
      var descDiv=document.createElement('div');
      descDiv.style.cssText='font-family:\'EB Garamond\',serif;font-size:16px;line-height:1.7;color:var(--text-main);';
      descDiv.innerHTML=nl2br(escapeHtml(data.descrizione));
      rightCol.appendChild(descDiv);
    }
  }

  grid.appendChild(rightCol);
  body.appendChild(grid);

  /* Sotto la griglia: tratti, azioni, incantesimi (solo mostro) */
  if (type === 'mostro') {
    if (data.tratti) {
      var ts=document.createElement('div');
      ts.style.cssText='margin-top:1.25rem;border-top:1px solid var(--border-subtle);padding-top:1rem;';
      var th=document.createElement('div'); th.style.cssText='font-family:\'Cinzel\',serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--gold-bright);margin-bottom:0.75rem;';
      th.textContent='★ Tratti Speciali';
      var tt=document.createElement('div'); tt.style.cssText='font-family:\'EB Garamond\',serif;font-size:17px;line-height:1.8;color:var(--text-main);';
      tt.innerHTML=fmtStatBlock(data.tratti);
      ts.appendChild(th); ts.appendChild(tt); body.appendChild(ts);
    }
    if (data.azioni) {
      var as=document.createElement('div');
      as.style.cssText='margin-top:1.25rem;border-top:1px solid var(--border-subtle);padding-top:1rem;';
      var ah=document.createElement('div'); ah.style.cssText='font-family:\'Cinzel\',serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--gold-bright);margin-bottom:0.75rem;';
      ah.textContent='⚔ Azioni';
      var at=document.createElement('div'); at.style.cssText='font-family:\'EB Garamond\',serif;font-size:17px;line-height:1.8;color:var(--text-main);';
      at.innerHTML=fmtStatBlock(data.azioni);
      as.appendChild(ah); as.appendChild(at); body.appendChild(as);
    }
    if (data.incantesimi) {
      var isc=document.createElement('div');
      isc.style.cssText='margin-top:1.25rem;border-top:1px solid var(--border-subtle);padding-top:1rem;';
      var ish=document.createElement('div'); ish.style.cssText='font-family:\'Cinzel\',serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--gold-bright);margin-bottom:0.75rem;';
      ish.textContent='★ Incantesimi';
      var ist=document.createElement('div'); ist.style.cssText='font-family:\'EB Garamond\',serif;font-size:17px;line-height:1.8;color:var(--text-main);';
      ist.innerHTML=fmtStatBlock(data.incantesimi);
      isc.appendChild(ish); isc.appendChild(ist); body.appendChild(isc);
    }
    if (data.azioniLeggendarie) {
      var alg=document.createElement('div');
      alg.style.cssText='margin-top:1.25rem;border-top:1px solid var(--border-subtle);padding-top:1rem;';
      var alh=document.createElement('div'); alh.style.cssText='font-family:\'Cinzel\',serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--gold-bright);margin-bottom:0.75rem;';
      alh.textContent='★ Azioni Leggendarie';
      var alt=document.createElement('div'); alt.style.cssText='font-family:\'EB Garamond\',serif;font-size:17px;line-height:1.8;color:var(--text-main);';
      alt.innerHTML=fmtStatBlock(data.azioniLeggendarie);
      alg.appendChild(alh); alg.appendChild(alt); body.appendChild(alg);
    }
  }

  panel.appendChild(body);
  back.appendChild(panel);
  document.body.appendChild(back);
  if (window.SiumAnimations && window.SiumAnimations.enhanceRelicModal) {
    window.SiumAnimations.enhanceRelicModal(back, type, data);
  }
}

function renderBestiarCard(m) {
  var card = document.createElement('article');
  card.className = 'weapon-card sium-grid-card-enter';
  card.style.cssText = 'cursor:pointer;';
  card.onclick = function() {
    if (window.SiumAnimations && window.SiumAnimations.triggerCardClickPulse) {
      window.SiumAnimations.triggerCardClickPulse(card, '#e05050');
    }
    openDetailModal('mostro', m);
  };

  /* Immagine */
  var imgWrap = document.createElement('div');
  imgWrap.className = 'card-image-wrap';
  imgWrap.style.cssText = 'aspect-ratio:3/4;background:var(--bg-base);';
  if (m.immagine) {
    var im = document.createElement('img');
    im.alt = m.nome; im.src = m.immagine;
    im.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    im.onerror = function() { imgWrap.innerHTML = '<div class="img-placeholder">🐉</div>'; };
    imgWrap.appendChild(im);
  } else {
    var ph = document.createElement('div');
    ph.className = 'img-placeholder'; ph.textContent = '🐉';
    imgWrap.appendChild(ph);
  }
  card.appendChild(imgWrap);

  /* Solo nome */
  var body = document.createElement('div');
  body.className = 'card-body';
  body.style.cssText = 'padding:0.75rem 1rem;';
  var nameEl = document.createElement('h3');
  nameEl.className = 'font-display font-bold text-lg';
  nameEl.style.cssText = 'color:var(--gold-bright);line-height:1.25;margin:0;text-align:center;';
  nameEl.textContent = m.nome;
  body.appendChild(nameEl);

  /* Bottoni admin (nascosti nel footer) */
  if (isAdmin()) {
    var foot = document.createElement('div');
    foot.className = 'flex items-center justify-end pt-2 border-t';
    foot.style.cssText = 'margin-top:0.5rem;';
    var btnRow = document.createElement('div'); btnRow.className = 'flex gap-1';
    var editBtn = document.createElement('button');
    editBtn.className = 'btn-dark'; editBtn.title = 'Modifica';
    editBtn.style.cssText = 'padding:0.4rem 0.65rem;';
    editBtn.innerHTML = ICON.edit;
    var delBtn = document.createElement('button');
    delBtn.className = 'btn-blood'; delBtn.title = 'Elimina';
    delBtn.style.cssText = 'padding:0.4rem 0.65rem;';
    delBtn.innerHTML = ICON.trash;
    (function(monster) {
      editBtn.onclick = function(e) { e.stopPropagation(); state.bestEditingId = monster.id; state.bestShowForm = true; var ef=document.getElementById('modal-root'); if(ef) ef.remove(); document.body.appendChild(renderBestiarForm()); };
      delBtn.onclick = function(e) {
        e.stopPropagation();
        if (confirm('Eliminare "' + monster.nome + '" dal bestiario?')) {
          // Aggiungi a bestiarioDeleted (ID + nome) così non ricompare al refresh neanche con ID diverso
          if (!state.bestiarioDeleted) state.bestiarioDeleted = [];
          if (state.bestiarioDeleted.indexOf(monster.id) < 0) state.bestiarioDeleted.push(monster.id);
          var _nk = 'nome:' + (monster.nome||'').toLowerCase();
          if (state.bestiarioDeleted.indexOf(_nk) < 0) state.bestiarioDeleted.push(_nk);
          fbSaveBestiarioDeleted();
          state.bestiario = state.bestiario.filter(function(x){ return x.id !== monster.id; });
          fbSaveBestiario(); saveToStorage();
          notify('Mostro eliminato.');
          card.remove(); // rimuove solo questa card, scroll invariato
        }
      };
    })(m);
    btnRow.appendChild(editBtn); btnRow.appendChild(delBtn);
    foot.appendChild(btnRow);
    body.appendChild(foot);
  }

  card.appendChild(body);
  return card;

  /* legacy placeholder to satisfy old code path */ if (false) {
    var aziP = document.createElement('p');
    aziP.textContent = m.azioni;
    body.appendChild(aziP);
  }
  var foot = document.createElement('div');
  foot.className = 'flex items-center justify-between pt-3 border-t';
  if (m.url) {
    var lnk = document.createElement('a');
    lnk.href = m.url; lnk.target = '_blank';
    lnk.style.cssText = 'font-family:\'EB Garamond\',serif;font-size:13px;color:var(--gold-dim);text-decoration:none;';
    lnk.textContent = '🔗 Riferimento';
    lnk.onclick = function(e) { e.stopPropagation(); };
    foot.appendChild(lnk);
  } else { foot.appendChild(document.createElement('span')); }
  if (isAdmin()) {
    var btnRow = document.createElement('div'); btnRow.className = 'flex gap-1';
    var editBtn = document.createElement('button');
    editBtn.className = 'btn-dark'; editBtn.title = 'Modifica';
    editBtn.style.cssText = 'padding:0.4rem 0.65rem;';
    editBtn.innerHTML = ICON.edit;
    var delBtn = document.createElement('button');
    delBtn.className = 'btn-blood'; delBtn.title = 'Elimina';
    delBtn.style.cssText = 'padding:0.4rem 0.65rem;';
    delBtn.innerHTML = ICON.trash;
    (function(monster) {
      editBtn.onclick = function(e) { e.stopPropagation(); state.bestEditingId = monster.id; state.bestShowForm = true; var ef=document.getElementById('modal-root'); if(ef) ef.remove(); document.body.appendChild(renderBestiarForm()); };
      delBtn.onclick = function(e) {
        e.stopPropagation();
        if (confirm('Eliminare "' + monster.nome + '" dal bestiario?')) {
          if (!state.bestiarioDeleted) state.bestiarioDeleted = [];
          if (state.bestiarioDeleted.indexOf(monster.id) < 0) state.bestiarioDeleted.push(monster.id);
          var _nk2 = 'nome:' + (monster.nome||'').toLowerCase();
          if (state.bestiarioDeleted.indexOf(_nk2) < 0) state.bestiarioDeleted.push(_nk2);
          fbSaveBestiarioDeleted();
          state.bestiario = state.bestiario.filter(function(x){ return x.id !== monster.id; });
          fbSaveBestiario(); saveToStorage();
          notify('Mostro eliminato.');
          card.remove();
        }
      };
    })(m);
    btnRow.appendChild(editBtn); btnRow.appendChild(delBtn);
    foot.appendChild(btnRow);
  }
  body.appendChild(foot);
  card.appendChild(body);
  return card;
}

// ═══════════════════════════════════════════════════════════════════
//  REGOLAMENTO
// ═══════════════════════════════════════════════════════════════════
function renderRegolamento() {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'max-width:800px;margin:0 auto;padding:2rem 1rem 4rem;';

  function sec(title, icon) {
    var s = document.createElement('div');
    s.style.cssText = 'margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--border-subtle);';
    var h2 = document.createElement('div');
    h2.style.cssText = "font-family:Cinzel,serif;font-size:18px;font-weight:700;color:var(--gold);margin-bottom:1rem;display:flex;align-items:center;gap:0.6rem;";
    h2.innerHTML = '<span>' + icon + '</span><span>' + title + '</span>';
    s.appendChild(h2);
    return s;
  }
  function p(text) {
    var el = document.createElement('p');
    el.style.cssText = "font-family:EB Garamond,serif;font-size:16px;line-height:1.75;color:var(--text-main);margin:0.6rem 0;";
    el.innerHTML = text;
    return el;
  }
  function sub(text) {
    var el = document.createElement('div');
    el.style.cssText = "font-family:Cinzel,serif;font-size:12px;font-weight:700;color:var(--text-strong);margin:1.2rem 0 0.4rem;text-transform:uppercase;letter-spacing:0.08em;";
    el.textContent = text;
    return el;
  }
  function ul(items) {
    var l = document.createElement('ul');
    l.style.cssText = "font-family:EB Garamond,serif;font-size:16px;line-height:1.75;color:var(--text-main);padding-left:1.4rem;margin:0.4rem 0;";
    items.forEach(function(it) { var li = document.createElement('li'); li.innerHTML = it; l.appendChild(li); });
    return l;
  }

  // Titolo
  var hero = document.createElement('div');
  hero.style.cssText = 'text-align:center;padding:2rem 0 1rem;';
  hero.innerHTML = '<div style="font-size:48px;margin-bottom:0.5rem;">📜</div>' +
    '<h1 style="font-family:Cinzel,serif;font-size:26px;font-weight:800;color:var(--gold);margin:0 0 0.5rem;">Regolamento</h1>' +
    '<div style="font-family:EB Garamond,serif;font-size:17px;color:var(--text-muted);">Guida completa al Mercante Errante</div>';
  wrap.appendChild(hero);

  // Cos’è
  var s0 = sec("Cos’è il Mercante Errante?", '🏰');
  s0.style.borderTop = 'none'; s0.style.marginTop = '0'; s0.style.paddingTop = '0';
  s0.appendChild(p('Il <strong>Mercante Errante</strong> è un’app da tavolo per campagne di D&D 5e. Il DM gestisce la sessione, i giocatori (PG) si connettono tramite link. Tutto è sincronizzato in tempo reale via Firebase.'));
  s0.appendChild(p('<strong>Ruoli:</strong> <strong>Admin</strong> (modifica il catalogo globale), <strong>DM</strong> (gestisce sessioni e gruppi), <strong>PG</strong> (accede tramite link invito).'));
  wrap.appendChild(s0);

  // Gruppi
  var sg = sec('Come creare e gestire un Gruppo', '⚔️');
  sg.appendChild(p('Un <strong>Gruppo</strong> rappresenta una campagna. Bacheca, Iniziativa, Caos e Schede PG sono <strong>private per gruppo</strong>.'));
  sg.appendChild(sub('Creare un gruppo (DM)'));
  sg.appendChild(ul([
    'Clicca <strong>"⚔️ Crea / Seleziona Gruppo"</strong> nella barra laterale o nelle Impostazioni.',
    'Inserisci il <strong>nome del gruppo</strong> (es. "Gli Eroi di Waterdeep") e premi <strong>"Crea Gruppo"</strong>.',
    'Il gruppo è salvato permanentemente: dura per tutta la campagna.',
    'Puoi avere più campagne e passare dall’una all’altra da "Gestisci Gruppo".',
  ]));
  sg.appendChild(sub('Invitare i giocatori (DM)'));
  sg.appendChild(ul([
    'Con un gruppo attivo, clicca <strong>"🔗 Copia Link Invito PG"</strong>.',
    'Il link viene copiato: mandalo ai giocatori (WhatsApp, Discord, ecc.).',
    'I PG aprono il link e inseriscono il nome del personaggio.',
  ]));
  sg.appendChild(sub('Riprendere una campagna (DM)'));
  sg.appendChild(ul([
    'Il gruppo si ricarica <strong>automaticamente</strong> al prossimo accesso con lo stesso account Google.',
    'Su un nuovo dispositivo: accedi con lo stesso account Google.',
    'Per cambiare campagna: apri "Gestisci Gruppo" e seleziona un’altra campagna.',
  ]));
  wrap.appendChild(sg);

  // Emporio
  var se = sec('Emporio', '🛒');
  se.appendChild(p('Il negozio virtuale del DM con tutto l’equipaggiamento: armi medievali, oggetti magici, pozioni.'));
  se.appendChild(ul([
    '<strong>Armi medievali e oggetti:</strong> spade, armature, scudi con prezzo in monete.',
    '<strong>Armi da fuoco:</strong> per ambientazioni moderne.',
    '<strong>Impianti Cibernetici:</strong> per campagne cyberpunk.',
    '<strong>Sostanze:</strong> droghe, veleni e pozioni con effetti e dipendenza.',
    '<strong>Veicoli:</strong> cavalli, carri, navi e inventario del party.',
  ]));
  se.appendChild(p("L'<strong>Admin</strong> può aggiungere, modificare ed <strong>eliminare</strong> oggetti. Le eliminazioni sono permanenti."));
  wrap.appendChild(se);

  // Bestiario
  var sb = sec('Bestiario', '🐉');
  sb.appendChild(p('Contiene tutti i mostri del SRD 5.1. Ogni scheda mostra: PF, CA, velocità, caratteristiche, tratti speciali e azioni.'));
  sb.appendChild(ul([
    'Usa la <strong>barra di ricerca</strong> e i <strong>filtri</strong> per trovare mostri per tipo o taglia.',
    'Clicca su un mostro per la scheda dettagliata.',
    'Il <strong>DM</strong> può aggiungere mostri personalizzati.',
    "L'<strong>Admin</strong> può eliminare mostri: non si ripristinano al ricaricamento.",
  ]));
  wrap.appendChild(sb);

  // Incantesimi
  var si = sec('Incantesimi', '✨');
  si.appendChild(p('Lista completa degli incantesimi SRD divisi per livello, scuola di magia e classe. Il DM può aggiungere incantesimi homebrew.'));
  wrap.appendChild(si);

  // Iniziativa
  var sini = sec('Iniziativa (privata per gruppo)', '⚡');
  sini.appendChild(p('Tracker di iniziativa per il combattimento. Sincronizzato in tempo reale con tutto il gruppo.'));
  sini.appendChild(ul([
    'Il DM aggiunge combattenti (PG e mostri) con nome, HP e iniziativa.',
    '<strong>"Avanza Turno"</strong> scorre i combattenti in ordine.',
    '<strong>Richiede un gruppo attivo.</strong>',
  ]));
  wrap.appendChild(sini);

  // Caos
  var sc = sec('Statistiche & Caos (privata per gruppo)', '🎲');
  sc.appendChild(p('Tiene traccia dei successi (20 nat) e fallimenti (1 nat) critici di ogni giocatore e mostra la ruota del destino del party.'));
  sc.appendChild(p('La <strong>ruota del Doom</strong> accumula punti ad ogni fallimento: quando è piena accade qualcosa di brutto! Dati privati per gruppo.'));
  wrap.appendChild(sc);

  // Bacheca
  var sbac = sec('Bacheca Ricercati (privata per gruppo)', '📋');
  sbac.appendChild(p('Lavagna virtuale per immagini: PNG di mostri, mappe, NPC ricercati. Tutto sincronizzato in tempo reale con il gruppo.'));
  sbac.appendChild(ul([
    'Carica immagini dal dispositivo o incolla un URL.',
    'Trascina per spostare, doppio click per girare, 🔍 per ingrandire.',
    'Il Pin fissa un’immagine così non si sposta per sbaglio.',
    '<strong>Richiede un gruppo attivo.</strong>',
  ]));
  wrap.appendChild(sbac);

  // Schede PG
  var ssch = sec('Schede PG (privata per gruppo)', '📄');
  ssch.appendChild(p('I giocatori compilano la propria scheda personaggio tramite il link invito. Il DM vede le schede di tutti i PG del gruppo.'));
  ssch.appendChild(ul([
    'La scheda include statistiche, inventario, incantesimi, tratti e biografie.',
    'Ogni PG vede e modifica solo la propria scheda.',
    'Privata per gruppo: gruppi diversi non si vedono.',
  ]));
  wrap.appendChild(ssch);

  // Altri strumenti
  var salt = sec('Altri strumenti', '📚');
  salt.appendChild(sub('Mappa del Mondo'));
  salt.appendChild(p('Carica una mappa e posiziona segnalini per PG, NPC e luoghi. Condivisa tra tutti i gruppi del DM (fa parte del mondo, non della singola campagna).'));
  salt.appendChild(sub('Generatore NPC'));
  salt.appendChild(p('Genera e gestisci personaggi non giocanti con caratteristiche, background e connessioni.'));
  salt.appendChild(sub('Worldbuilding & Storia'));
  salt.appendChild(p('<strong>Worldbuilding:</strong> organizza il mondo in fazioni, zone e città. <strong>Storia:</strong> registro narrativo della campagna con sessioni ed eventi chiave.'));
  salt.appendChild(sub('Lanciatore Dadi'));
  salt.appendChild(p('Lancia d4, d6, d8, d10, d12, d20, d100 con animazione. I risultati sono visibili a tutti nel gruppo.'));
  salt.appendChild(sub('Libreria'));
  salt.appendChild(p('Salva documenti di testo: regole homebrew, descrizioni di luoghi, note di sessione.'));
  wrap.appendChild(salt);

  // FAQ
  var sfaq = sec('Domande Frequenti', '❓');
  var faqs = [
    ['Il gruppo si perde se chiudo il browser?', 'No. Il gruppo è salvato nel tuo account Firebase. Al prossimo accesso con lo stesso account Google viene ripristinato automaticamente.'],
    ['Posso avere più campagne?', 'Sì. Crea un gruppo per campagna. Passa da una all’altra con "Gestisci Gruppo".'],
    ['I giocatori devono creare un account?', 'No. I PG accedono solo col link invito e il nome del personaggio. Nessun account richiesto.'],
    ['L’Admin può eliminare mostri e armi?', 'Sì. I pulsanti di eliminazione sono visibili solo all’Admin. Le eliminazioni sono permanenti e non si ripristinano al ricaricamento.'],
  ];
  faqs.forEach(function(f) { sfaq.appendChild(sub(f[0])); sfaq.appendChild(p(f[1])); });
  wrap.appendChild(sfaq);

  return wrap;
}

function renderBestiarForm() {
  var editing = null;
  if (state.bestEditingId) {
    state.bestiario.forEach(function(m){ if (m.id === state.bestEditingId) editing = m; });
  }
  var form = {
    nome: editing ? editing.nome : '',
    taglia: editing ? (editing.taglia||'') : '',
    tipo: editing ? (editing.tipo||'') : '',
    allineamento: editing ? (editing.allineamento||'') : '',
    grsfida: editing ? (editing.grsfida||'') : '',
    hp: editing ? (editing.hp||'') : '',
    ca: editing ? (editing.ca||'') : '',
    velocita: editing ? (editing.velocita||'') : '',
    for: editing ? (editing.for||'') : '',
    des: editing ? (editing.des||'') : '',
    cos: editing ? (editing.cos||'') : '',
    int: editing ? (editing.int||'') : '',
    sag: editing ? (editing.sag||'') : '',
    car: editing ? (editing.car||'') : '',
    ts: editing ? (editing.ts||'') : '',
    sensi: editing ? (editing.sensi||'') : '',
    abilita: editing ? (editing.abilita||'') : '',
    lingue: editing ? (editing.lingue||'') : '',
    tratti: editing ? (editing.tratti||'') : '',
    incantesimi: editing ? (editing.incantesimi||'') : '',
    url: editing ? (editing.url||'') : '',
    immagine: editing ? (editing.immagine||'') : '',
    azioni: editing ? (editing.azioni||'') : '',
    azioniLeggendarie: editing ? (editing.azioniLeggendarie||'') : ''
  };
  var back = document.createElement('div');
  back.className = 'modal-backdrop'; back.id = 'modal-root';
  back.onclick = function(e) { if (e.target === back) closeBestForm(); };
  var panel = document.createElement('div'); panel.className = 'modal-panel';
  var head = document.createElement('div'); head.className = 'modal-head';
  head.innerHTML = '<div><div class="font-display font-semibold tracking-widest" style="font-size:11px;color:var(--gold-dim);margin-bottom:0.25rem;">'+(editing?'MODIFICA':'AGGIUNGI')+'</div><h2 class="font-display font-bold" style="font-size:20px;color:var(--gold-bright);margin:0;">'+(editing?'Modifica Mostro':'Nuovo Mostro')+'</h2></div><button class="theme-toggle" style="width:38px;height:38px;">'+ICON.x+'</button>';
  head.querySelector('button').onclick = closeBestForm;
  panel.appendChild(head);
  var mbody = document.createElement('form'); mbody.className = 'modal-body';
  mbody.onsubmit = function(e) { e.preventDefault(); submitBestForm(); };
  function addBF(lbl, type, key, opts) {
    opts = opts||{};
    var d = document.createElement('div');
    d.innerHTML = '<label class="field-label">'+lbl+'</label>';
    var inp;
    if (type === 'textarea') { inp = document.createElement('textarea'); inp.rows = 5; }
    else { inp = document.createElement('input'); inp.type = type; }
    inp.className = 'field'; inp.value = form[key]||'';
    if (opts.placeholder) inp.placeholder = opts.placeholder;
    (function(k){ inp.oninput = function(){ form[k]=this.value; }; })(key);
    d.appendChild(inp); return d;
  }
  mbody.appendChild(addBF('Nome Mostro *','text','nome',{placeholder:'Es. Goblin, Drago Rosso…'}));
  /* Taglia + Tipo */
  var rowTT = document.createElement('div');
  rowTT.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;';
  /* Taglia select */
  (function(){
    var d=document.createElement('div'); d.innerHTML='<label class="field-label">Taglia</label>';
    var sel=document.createElement('select'); sel.className='field';
    var opt0=document.createElement('option'); opt0.value=''; opt0.textContent='— Seleziona taglia —'; sel.appendChild(opt0);
    TAGLIE_MOSTRO.forEach(function(t){ var o=document.createElement('option'); o.value=t; o.textContent=t; if(form.taglia===t) o.selected=true; sel.appendChild(o); });
    sel.onchange=function(){ form.taglia=this.value; };
    d.appendChild(sel); rowTT.appendChild(d);
  })();
  /* Tipo select */
  (function(){
    var d=document.createElement('div'); d.innerHTML='<label class="field-label">Tipo Creatura</label>';
    var sel=document.createElement('select'); sel.className='field';
    var opt0=document.createElement('option'); opt0.value=''; opt0.textContent='— Seleziona tipo —'; sel.appendChild(opt0);
    TIPI_MOSTRO.forEach(function(t){ var o=document.createElement('option'); o.value=t; o.textContent=t; if(form.tipo===t) o.selected=true; sel.appendChild(o); });
    sel.onchange=function(){ form.tipo=this.value; };
    d.appendChild(sel); rowTT.appendChild(d);
  })();
  mbody.appendChild(rowTT);
  /* Allineamento + GS */
  var rowAG = document.createElement('div');
  rowAG.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;';
  (function(){
    var d=document.createElement('div'); d.innerHTML='<label class="field-label">Allineamento</label>';
    var sel=document.createElement('select'); sel.className='field';
    var alignments=['','Legale Buono','Neutrale Buono','Caotico Buono','Legale Neutrale','Neutrale','Caotico Neutrale','Legale Malvagio','Neutrale Malvagio','Caotico Malvagio','Senza Allineamento'];
    alignments.forEach(function(a){ var o=document.createElement('option'); o.value=a; o.textContent=a||'— Seleziona —'; if(form.allineamento===a) o.selected=true; sel.appendChild(o); });
    sel.onchange=function(){ form.allineamento=this.value; };
    d.appendChild(sel); rowAG.appendChild(d);
  })();
  rowAG.appendChild(addBF('Grado Sfida','text','grsfida',{placeholder:'1/4, 1, 5, 17…'}));
  mbody.appendChild(rowAG);
  /* HP / CA / Velocità */
  var row2 = document.createElement('div');
  row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;';
  row2.appendChild(addBF('HP','text','hp',{placeholder:'45'}));
  row2.appendChild(addBF('CA','text','ca',{placeholder:'13'}));
  row2.appendChild(addBF('Velocità','text','velocita',{placeholder:'9 m (volo 18 m)'}));
  mbody.appendChild(row2);
  /* Caratteristiche FOR DES COS INT SAG CAR */
  var statsLbl=document.createElement('div'); statsLbl.innerHTML='<label class="field-label">Caratteristiche</label>';
  mbody.appendChild(statsLbl);
  var rowStats=document.createElement('div');
  rowStats.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;';
  ['for','des','cos','int','sag','car'].forEach(function(k){
    var d=document.createElement('div');
    var lbl=document.createElement('label'); lbl.className='field-label'; lbl.style.textAlign='center'; lbl.textContent=k.toUpperCase();
    var inp=document.createElement('input'); inp.type='number'; inp.className='field'; inp.min='1'; inp.max='30';
    inp.style.cssText='text-align:center;padding:0.4rem 0.25rem;';
    inp.value=form[k]||''; inp.placeholder='—';
    (function(key){ inp.oninput=function(){ form[key]=this.value; }; })(k);
    d.appendChild(lbl); d.appendChild(inp); rowStats.appendChild(d);
  });
  mbody.appendChild(rowStats);
  mbody.appendChild(addBF('Tiri Salvezza','text','ts',{placeholder:'FOR +5, DES +3, COS +7…'}));
  mbody.appendChild(addBF('Sensi','text','sensi',{placeholder:'Scurovisione 36 m, vista cieca 18 m, perc. passiva 16'}));
  mbody.appendChild(addBF('Abilità','text','abilita',{placeholder:'Percezione +6, Furtività +4, Inganno +8…'}));
  mbody.appendChild(addBF('Lingue parlate','text','lingue',{placeholder:'Comune, Draconico, Infernale…'}));
  mbody.appendChild(addBF('Tratti Speciali','textarea','tratti',{placeholder:'Es. Sensi acuiti. Vantaggio ai tiri percezione. Resistenza al veleno…'}));
  mbody.appendChild(addBF('Incantesimi','textarea','incantesimi',{placeholder:'Es. L\'incantatore è un mago di 9° livello. Slot: 1°×4, 2°×3… Trucchetti: dardo incantato, danza delle luci…'}));
  mbody.appendChild(addBF('URL Riferimento','text','url',{placeholder:'https://…'}));
  var imgD = document.createElement('div');
  imgD.innerHTML = '<label class="field-label">Immagine</label>';
  var imgRow = document.createElement('div'); imgRow.style.cssText='display:flex;gap:0.5rem;align-items:center;';
  var imgInp = document.createElement('input'); imgInp.type='text'; imgInp.className='field';
  imgInp.placeholder='URL immagine o carica file'; imgInp.value=form.immagine||'';
  var prevImg = document.createElement('img');
  prevImg.style.cssText='max-width:70px;max-height:55px;border-radius:3px;border:1px solid var(--border-soft);'+(form.immagine?'':'display:none;');
  if (form.immagine) prevImg.src=form.immagine;
  imgInp.oninput=function(){ form.immagine=this.value; if(this.value){prevImg.src=this.value;prevImg.style.display='block';}else{prevImg.style.display='none';} };
  var fI=document.createElement('input'); fI.type='file'; fI.accept='image/*'; fI.style.display='none';
  var fBtn=document.createElement('button'); fBtn.type='button'; fBtn.className='btn-dark';
  fBtn.style.cssText='white-space:nowrap;font-size:11px;flex-shrink:0;'; fBtn.textContent='📁 File';
  fBtn.onclick=function(){fI.click();};
  fI.onchange=function(){
    var file=this.files[0]; if(!file) return;
    var reader=new FileReader();
    reader.onload=function(ev){
      var img=new Image();
      img.onload=function(){
        var MAX=600; var ratio=Math.min(MAX/img.width,MAX/img.height,1);
        var canvas=document.createElement('canvas');
        canvas.width=Math.round(img.width*ratio); canvas.height=Math.round(img.height*ratio);
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        var compressed=canvas.toDataURL('image/jpeg',0.72);
        imgInp.value=''; form.immagine=compressed;
        prevImg.src=compressed; prevImg.style.display='block';
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  imgRow.appendChild(imgInp); imgRow.appendChild(fBtn); imgRow.appendChild(fI); imgRow.appendChild(prevImg);
  imgD.appendChild(imgRow); mbody.appendChild(imgD);
  mbody.appendChild(addBF('Azioni, Tattiche, Lore','textarea','azioni',{placeholder:'Descrivi le azioni speciali, le tattiche di combattimento, la lore del mostro…'}));
  mbody.appendChild(addBF('Azioni Leggendarie','textarea','azioniLeggendarie',{placeholder:'Es. Il mostro può compiere 3 azioni leggendarie a fine turno altrui. Coda: +9, 2d8+5. Ala (2 azioni): CD DES 17, 2d6+5 + prono…'}));
  var submitBtn = document.createElement('button'); submitBtn.type='submit'; submitBtn.className='btn-gold';
  submitBtn.style.cssText='width:100%;justify-content:center;';
  submitBtn.innerHTML=ICON.save+' '+(editing?'Salva Modifiche':'Aggiungi al Bestiario');
  mbody.appendChild(submitBtn);
  panel.appendChild(mbody); back.appendChild(panel);
  function submitBestForm() {
    if (!form.nome.trim()) { notify('Inserisci il nome del mostro.','err'); return; }
    if (editing) {
      state.bestiario.forEach(function(m) {
        if (m.id === editing.id) {
          m.nome=form.nome.trim(); m.taglia=form.taglia; m.tipo=form.tipo;
          m.allineamento=form.allineamento; m.grsfida=form.grsfida;
          m.hp=form.hp; m.ca=form.ca; m.velocita=form.velocita;
          m.for=form.for; m.des=form.des; m.cos=form.cos;
          m.int=form.int; m.sag=form.sag; m.car=form.car;
          m.ts=form.ts; m.sensi=form.sensi; m.abilita=form.abilita;
          m.lingue=form.lingue; m.tratti=form.tratti; m.incantesimi=form.incantesimi;
          m.url=form.url; m.immagine=form.immagine;
          m.azioni=form.azioni; m.azioniLeggendarie=form.azioniLeggendarie;
          m._v=9999;
        }
      });
      notify('Mostro aggiornato.');
    } else {
      state.bestiario.push({id:'m_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
        nome:form.nome.trim(), taglia:form.taglia, tipo:form.tipo,
        allineamento:form.allineamento, grsfida:form.grsfida,
        hp:form.hp, ca:form.ca, velocita:form.velocita,
        for:form.for, des:form.des, cos:form.cos,
        int:form.int, sag:form.sag, car:form.car,
        ts:form.ts, sensi:form.sensi, abilita:form.abilita,
        lingue:form.lingue, tratti:form.tratti, incantesimi:form.incantesimi,
        url:form.url, immagine:form.immagine,
        azioni:form.azioni, azioniLeggendarie:form.azioniLeggendarie});
      notify('Mostro aggiunto al bestiario.');
    }
    fbSaveBestiario(); saveToStorage(); var _sy=window.scrollY; closeBestForm(); renderMain(); requestAnimationFrame(function(){ window.scrollTo(0,_sy); });
  }
  return back;
}

function closeBestForm() {
  state.bestShowForm=false; state.bestEditingId=null;
  var m=document.getElementById('modal-root'); if(m) m.remove();
}

function saveBestiario() {
  try {
    var json=JSON.stringify(state.bestiario,null,2);
    var blob=new Blob([json],{type:'application/json'});
    triggerDownload(blob,'database_bestiario.json');
    notify('Bestiario scaricato. Salvalo nella tua chiavetta.');
  } catch(e){ notify('Errore: '+e.message,'err'); }
}

function loadBestiarioFile() {
  var input=document.createElement('input'); input.type='file'; input.accept='.json,application/json';
  input.onchange=function(e){
    var f=e.target.files[0]; if(!f) return;
    var r=new FileReader();
    r.onload=function(ev){
      try {
        var data=JSON.parse(ev.target.result);
        if(!Array.isArray(data)) throw new Error('File non contiene un array.');
        state.bestiario=data.map(function(m,i){
          return {id:m.id||('m_'+Date.now()+'_'+i),nome:m.nome||'Senza nome',
            taglia:m.taglia||'',tipo:m.tipo||'',
            allineamento:m.allineamento||'',grsfida:m.grsfida||'',
            hp:m.hp||'',ca:m.ca||'',velocita:m.velocita||'',
            for:m.for||'',des:m.des||'',cos:m.cos||'',
            int:m.int||'',sag:m.sag||'',car:m.car||'',
            ts:m.ts||'',sensi:m.sensi||'',abilita:m.abilita||'',
            lingue:m.lingue||'',tratti:m.tratti||'',
            url:m.url||'',immagine:m.immagine||'',
            azioni:m.azioni||'',azioniLeggendarie:m.azioniLeggendarie||''};
        });
        fbSaveBestiario(); saveToStorage();
        notify('Caricati '+state.bestiario.length+' mostri.'); renderMain();
      } catch(err){ notify('Errore: '+err.message,'err'); }
    };
    r.readAsText(f);
  };
  input.click();
}

function updatePetGrid() {
  /* Giocatori vedono solo i propri pet */
  var me = (!isDM() && state.currentUser) ? state.currentUser.username.toLowerCase() : null;
  var petList = me !== null
    ? state.pet.filter(function(p){ return (p.proprietario||'').toLowerCase() === me; })
    : state.pet;
  var q = (state.petSearch||'').toLowerCase().trim();
  var filtered = petList.filter(function(p) {
    if (!q) return true;
    return (p.nome||'').toLowerCase().indexOf(q)>=0 ||
           (p.proprietario||'').toLowerCase().indexOf(q)>=0 ||
           (p.tipo||'').toLowerCase().indexOf(q)>=0;
  });
  var counter = document.getElementById('pet-counter');
  if (counter) {
    counter.className = 'results-counter';
    counter.innerHTML = '<strong>'+filtered.length+'</strong> <span class="dot"></span> <span>'+(isDM()?'PET DEL PARTY':'I MIEI PET')+'</span>';
  }
  var grid = document.getElementById('pet-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (filtered.length === 0) {
    grid.className = '';
    var emptyTitle = isDM() ? (state.pet.length===0?'Nessun pet registrato':'Nessun pet trovato') : 'Nessun pet trovato';
    var emptyDesc = isDM() ? (state.pet.length===0?'Adotta un mostro dal bestiario.':'La ricerca non corrisponde ad alcun pet.') : (petList.length===0?'Non hai ancora un pet nel party. Chiedi al DM di assegnartene uno.':'La ricerca non corrisponde ad alcun tuo pet.');
    grid.innerHTML = '<div class="empty-state panel-glass"><div class="rune">🐾</div><h2>'+emptyTitle+'</h2><p>'+emptyDesc+'</p></div>';
    return;
  }
  grid.className = 'weapon-grid';
  filtered.forEach(function(p) { grid.appendChild(renderPetCard(p)); });
}

function renderPetCard(p) {
  var card = document.createElement('article');
  card.className = 'weapon-card';
  /* Immagine: petImmagine è la foto personale del pet (modificabile dal proprietario),
     p.immagine è quella del bestiario usata come fallback */
  var imgWrap = document.createElement('div'); imgWrap.className = 'card-image-wrap';
  var displayImg = p.petImmagine || p.immagine;
  if (displayImg) { var im=document.createElement('img'); im.alt=p.nome; im.src=displayImg; imgWrap.appendChild(im); }
  else { var ph=document.createElement('div'); ph.className='img-placeholder'; ph.textContent='🐾'; imgWrap.appendChild(ph); }
  /* Badge tipo */
  if (p.tipo||p.taglia) {
    var tagW=document.createElement('div'); tagW.style.cssText='position:absolute;top:12px;right:12px;z-index:2;display:flex;flex-direction:column;gap:0.25rem;align-items:flex-end;';
    if (p.tipo) tagW.innerHTML+='<span class="type-chip">'+escapeHtml(p.tipo)+'</span>';
    if (p.taglia) tagW.innerHTML+='<span class="type-chip" style="background:rgba(120,80,20,0.75);border-color:#c9a55c88;">'+escapeHtml(p.taglia)+'</span>';
    imgWrap.appendChild(tagW);
  }
  /* Badge 🐾 pet */
  var petBadge=document.createElement('div'); petBadge.style.cssText='position:absolute;top:12px;left:12px;z-index:2;background:rgba(80,140,80,0.85);border:1px solid #6dbc6d;border-radius:3px;padding:0.15rem 0.4rem;font-family:\'Cinzel\',serif;font-size:9px;font-weight:700;color:#b8ffb8;letter-spacing:0.08em;';
  petBadge.textContent='🐾 PET';
  imgWrap.appendChild(petBadge);
  card.appendChild(imgWrap);
  /* Body */
  var body=document.createElement('div'); body.className='card-body';
  var nameEl=document.createElement('h3'); nameEl.className='font-display font-bold text-lg mb-2';
  nameEl.style.cssText='color:var(--gold-bright);line-height:1.25;margin:0 0 0.25rem;';
  nameEl.textContent=p.petNome||p.nome; body.appendChild(nameEl);
  /* Proprietario */
  if (p.proprietario) {
    var propEl=document.createElement('div'); propEl.style.cssText='font-family:\'EB Garamond\',serif;font-size:13px;color:#6dbc6d;margin-bottom:0.35rem;';
    propEl.innerHTML='🧙 '+escapeHtml(p.proprietario); body.appendChild(propEl);
  }
  /* HP / CA */
  var statRow=document.createElement('div'); statRow.style.cssText='display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.4rem;';
  [['HP',p.hp,'#c84040'],['CA',p.ca,'#c9a55c'],['VEL',p.velocita,'#5c9ec9']].forEach(function(s){
    if(!s[1]) return;
    var pill=document.createElement('div'); pill.style.cssText='background:'+s[2]+'22;border:1px solid '+s[2]+'55;border-radius:3px;padding:0.15rem 0.5rem;font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;color:'+s[2]+';';
    pill.textContent=s[0]+': '+s[1]; statRow.appendChild(pill);
  });
  body.appendChild(statRow);
  /* Stats */
  var hasStats=p.for||p.des||p.cos||p.int||p.sag||p.car;
  if (hasStats) {
    var sg=document.createElement('div'); sg.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:0.25rem;margin-bottom:0.5rem;border:1px solid var(--border-subtle);border-radius:4px;overflow:hidden;';
    [['FOR',p.for],['DES',p.des],['COS',p.cos],['INT',p.int],['SAG',p.sag],['CAR',p.car]].forEach(function(s){
      var c2=document.createElement('div'); c2.style.cssText='text-align:center;padding:0.25rem 0.1rem;background:var(--bg-base);';
      c2.innerHTML='<div style="font-family:\'Cinzel\',serif;font-size:8px;font-weight:700;color:var(--gold-dim);letter-spacing:0.1em;">'+s[0]+'</div><div style="font-family:\'EB Garamond\',serif;font-size:15px;font-weight:700;color:var(--text-strong);line-height:1.2;">'+(s[1]||'—')+'</div>';
      sg.appendChild(c2);
    });
    body.appendChild(sg);
  }
  if (p.tratti) {
    var trD=document.createElement('div'); trD.style.cssText='font-family:\'EB Garamond\',serif;font-size:13px;color:var(--text-muted);white-space:pre-wrap;border:1px solid var(--border-subtle);border-radius:3px;padding:0.4rem 0.5rem;margin-bottom:0.4rem;background:var(--bg-base);max-height:80px;overflow-y:auto;';
    trD.innerHTML='<div style="font-family:\'Cinzel\',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold-dim);margin-bottom:0.2rem;">★ Tratti</div>'+nl2br(escapeHtml(p.tratti));
    body.appendChild(trD);
  }
  if (p.azioni) {
    var aziD=document.createElement('div'); aziD.style.cssText='font-family:\'EB Garamond\',serif;font-size:13px;color:var(--text-muted);white-space:pre-wrap;border:1px solid var(--border-subtle);border-radius:3px;padding:0.4rem 0.5rem;margin-bottom:0.4rem;background:var(--bg-base);max-height:100px;overflow-y:auto;';
    aziD.innerHTML='<div style="font-family:\'Cinzel\',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold-dim);margin-bottom:0.2rem;">⚔ Azioni</div>'+nl2br(escapeHtml(p.azioni));
    body.appendChild(aziD);
  }
  /* Footer */
  var foot=document.createElement('div'); foot.className='flex items-center justify-between pt-3 border-t';
  foot.appendChild(document.createElement('span'));
  var isOwner = !isDM() && state.currentUser && (p.proprietario||'').toLowerCase()===state.currentUser.username.toLowerCase();
  if (isDM()) {
    var btnRow=document.createElement('div'); btnRow.className='flex gap-1';
    var delBtn=document.createElement('button'); delBtn.className='btn-blood'; delBtn.title='Rimuovi pet'; delBtn.style.cssText='padding:0.4rem 0.65rem;'; delBtn.innerHTML=ICON.trash;
    (function(pet){ delBtn.onclick=function(){
      if(confirm('Rimuovere "'+pet.nome+'" dai pet del party?')){
        state.pet=state.pet.filter(function(x){return x.id!==pet.id;});
        fbSavePet(); saveToStorage(); notify('Pet rimosso.'); renderMain();
      }
    }; })(p);
    /* Pulsante modifica proprietario */
    var editPropBtn=document.createElement('button'); editPropBtn.className='btn-dark'; editPropBtn.title='Modifica proprietario'; editPropBtn.style.cssText='padding:0.4rem 0.65rem;font-size:11px;';
    editPropBtn.textContent='🧙';
    (function(pet){ editPropBtn.onclick=function(){
      var np=prompt('Proprietario del pet (nome personaggio):', pet.proprietario||'');
      if(np===null) return;
      pet.proprietario=np.trim();
      fbSavePet(); saveToStorage(); renderMain();
    }; })(p);
    btnRow.appendChild(editPropBtn); btnRow.appendChild(delBtn);
    foot.appendChild(btnRow);
  } else if (isOwner) {
    var ownerRow=document.createElement('div'); ownerRow.className='flex gap-1';
    /* Rinomina pet */
    var renBtn=document.createElement('button'); renBtn.className='btn-dark';
    renBtn.title='Rinomina il tuo pet'; renBtn.style.cssText='font-size:11px;padding:0.3rem 0.65rem;';
    renBtn.textContent='✏ Rinomina';
    (function(pet){ renBtn.onclick=function(){
      var nn=prompt('Nome personalizzato per il tuo pet (lascia vuoto per usare il nome originale):', pet.petNome||'');
      if(nn===null) return;
      pet.petNome=nn.trim()||'';
      fbSavePet(); saveToStorage(); renderMain();
    }; })(p);
    ownerRow.appendChild(renBtn);
    /* Cambia foto */
    var imgUpBtn=document.createElement('button'); imgUpBtn.className='btn-dark';
    imgUpBtn.title='Cambia foto del pet'; imgUpBtn.style.cssText='font-size:11px;padding:0.3rem 0.65rem;';
    imgUpBtn.textContent='📁 Foto';
    (function(pet){ imgUpBtn.onclick=function(){
      var inp=document.createElement('input'); inp.type='file'; inp.accept='image/jpeg,image/png';
      inp.onchange=function(){
        if(!this.files[0]) return;
        var reader=new FileReader();
        reader.onload=function(ev){
          pet.petImmagine=ev.target.result;
          fbSavePet(); saveToStorage(); renderMain();
        };
        reader.readAsDataURL(this.files[0]);
      };
      inp.click();
    }; })(p);
    ownerRow.appendChild(imgUpBtn);
    foot.appendChild(ownerRow);
  }
  body.appendChild(foot); card.appendChild(body);
  return card;
}

function adottaDalBestiario() {
  if (state.bestiario.length===0) { notify('Il bestiario è vuoto. Aggiungi prima dei mostri.','err'); return; }
  var back=document.createElement('div'); back.className='modal-backdrop'; back.style.zIndex='100001';
  back.onclick=function(e){if(e.target===back)back.remove();};
  var panel=document.createElement('div'); panel.className='modal-panel'; panel.style.maxWidth='460px';
  var head=document.createElement('div'); head.className='modal-head';
  head.innerHTML='<div><div class="font-display font-semibold tracking-widest" style="font-size:11px;color:var(--gold-dim);margin-bottom:0.25rem;">PET DEL PARTY</div><h2 class="font-display font-bold" style="font-size:20px;color:var(--gold-bright);margin:0;">Adotta un Mostro</h2></div><button class="theme-toggle" style="width:38px;height:38px;">✕</button>';
  head.querySelector('button').onclick=function(){back.remove();};
  panel.appendChild(head);
  var mbody=document.createElement('div'); mbody.className='modal-body';
  /* Ricerca */
  var srchInp=document.createElement('input'); srchInp.type='text'; srchInp.className='field'; srchInp.placeholder='Cerca mostro…'; srchInp.style.marginBottom='0.75rem';
  mbody.appendChild(srchInp);
  /* Lista mostri */
  var listEl=document.createElement('div'); listEl.style.cssText='max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:0.3rem;';
  function buildList(q) {
    listEl.innerHTML='';
    var items=state.bestiario.filter(function(m){ return !q||(m.nome||'').toLowerCase().indexOf(q)>=0; });
    if (items.length===0) { listEl.innerHTML='<div style="color:var(--text-faint);font-family:\'EB Garamond\',serif;font-size:14px;text-align:center;padding:1rem;">Nessun mostro trovato</div>'; return; }
    items.forEach(function(m){
      var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0.5rem;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:4px;cursor:pointer;';
      row.onmouseover=function(){this.style.borderColor='var(--border-gold)';};
      row.onmouseout=function(){this.style.borderColor='var(--border-subtle)';};
      if (m.immagine) { var th=document.createElement('img'); th.src=m.immagine; th.style.cssText='width:36px;height:36px;object-fit:cover;border-radius:3px;flex-shrink:0;'; row.appendChild(th); }
      var info=document.createElement('div'); info.style.flex='1';
      info.innerHTML='<div style="font-family:\'Cinzel\',serif;font-size:12px;font-weight:700;color:var(--text-strong);">'+escapeHtml(m.nome)+'</div><div style="font-family:\'EB Garamond\',serif;font-size:13px;color:var(--text-muted);">'+(m.taglia?m.taglia+' · ':'')+(m.tipo||'')+'</div>';
      row.appendChild(info);
      var selBtn=document.createElement('button'); selBtn.className='btn-gold'; selBtn.style.cssText='font-size:11px;padding:0.25rem 0.6rem;white-space:nowrap;'; selBtn.textContent='Adotta';
      (function(monster){ selBtn.onclick=function(){
        var prop=prompt('Chi nel party lo adotta? (nome personaggio, opzionale)','');
        if(prop===null) return;
        var clone=JSON.parse(JSON.stringify(monster));
        clone.id='pet_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
        clone.proprietario=prop.trim();
        clone.petImmagine=''; // foto personale del pet, separata dall'immagine del bestiario
        state.pet.push(clone);
        fbSavePet(); saveToStorage();
        notify('"'+monster.nome+'" è ora un pet del party! 🐾');
        back.remove(); renderMain();
      }; })(m);
      row.appendChild(selBtn); listEl.appendChild(row);
    });
  }
  buildList('');
  srchInp.oninput=function(){ buildList(this.value.toLowerCase().trim()); };
  mbody.appendChild(listEl);
  panel.appendChild(mbody); back.appendChild(panel); document.body.appendChild(back);
}

/* =====================================================================
   SCHEDA PERSONAGGIO — multi-scheda v2
   ===================================================================== */

function _companionDefault() {
  return {nome:'Compagno',tipo:'',ca:'',hpMax:'',hpAttuali:'',velocita:'',bonusComp:2,for:10,des:10,cos:10,int:10,sag:10,car:10,tsFor:false,tsDes:false,tsCos:false,tsInt:false,tsSag:false,tsCar:false,skText:'',skAcro:false,skAnim:false,skArca:false,skAtle:false,skFurt:false,skInda:false,skInga:false,skInti:false,skIntr:false,skIntu:false,skMedi:false,skNatu:false,skPerc:false,skPers:false,skRapi:false,skReli:false,skSopr:false,skStor:false,skTecn:false,immunita:'',resistenze:'',condImm:'',sensi:'',lingue:'',tratti:'',azioni:[{nome:'',desc:''}]};
}

function _newScheda() {
    _renderTipoSelectorModal(function(tipo) {
      var nid = 'c' + Date.now();
      var ns;
      if (tipo === 'normale' || tipo === 'onepiece') {
        ns = Object.assign(_schedaDefault(), { id: nid, schedaTipo: tipo });
      } else if (tipo === 'pokemon') {
        ns = window._pokemonDefault ? window._pokemonDefault(nid) : { id: nid, schedaTipo: 'pokemon' };
      } else if (tipo === 'naruto') {
        ns = window._narutoDefault ? window._narutoDefault(nid) : { id: nid, schedaTipo: 'naruto' };
      } else if (tipo === 'brancalonia') {
          ns = window._brancaloniaDefault ? window._brancaloniaDefault(nid) : { id: nid, schedaTipo: 'brancalonia' };
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
  var wrap=document.createElement('div'); wrap.style.cssText='min-height:100vh;background:#5a5a5a;display:flex;flex-direction:column;';
  var tbar=document.createElement('div'); tbar.style.cssText='background:#222;border-bottom:1px solid #111;padding:0.5rem 1rem;display:flex;align-items:center;justify-content:flex-end;flex-shrink:0;';
  var btnN=document.createElement('button'); btnN.textContent='+ Nuova Scheda';
  btnN.style.cssText='background:#8b6f3f;border:1px solid #c9a55c;color:#f0e4cc;border-radius:3px;padding:0.4rem 1rem;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:0.08em;';
  btnN.onclick=function(){_newScheda();}; tbar.appendChild(btnN); wrap.appendChild(tbar);
  var content=document.createElement('div');
  if(state.schedeList.length===0) {
    content.style.cssText='flex:1;display:flex;align-items:center;justify-content:center;';
    var empty=document.createElement('div');
    empty.style.cssText='text-align:center;background:#fff;border-radius:8px;padding:3rem 4rem;box-shadow:0 4px 24px rgba(0,0,0,0.5);max-width:380px;';
    empty.innerHTML='<div style="font-size:56px;margin-bottom:1rem;">📜</div><h2 style="font-family:\'Cinzel\',serif;font-size:18px;color:#333;margin:0 0 0.5rem;">Nessun personaggio</h2><p style="color:#888;font-size:14px;font-family:Arial,sans-serif;margin:0 0 1.5rem;">Crea la tua prima scheda personaggio.</p>';
    var btnC=document.createElement('button'); btnC.textContent='Crea Scheda';
    btnC.style.cssText='background:#8b6f3f;border:none;color:#f0e4cc;border-radius:4px;padding:0.65rem 2.5rem;cursor:pointer;font-family:\'Cinzel\',serif;font-size:14px;letter-spacing:0.1em;';
    btnC.onclick=function(){_newScheda();}; empty.appendChild(btnC); content.appendChild(empty);
  } else {
    content.style.cssText='flex:1;padding:2rem;align-self:flex-start;width:100%;box-sizing:border-box;';

    /* ── Barra filtri per stato ── */
    var filterBar=document.createElement('div');
    filterBar.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1.2rem;';
    var STATI=[['','Tutti'],['','Da usare'],['in_uso','In uso'],['usato','Usate'],['magazzino','Magazzino']];
    // Nota: 'Da usare' ha stato='' quindi usiamo un sentinel speciale
    var FILTRI=[
      {val:'tutti',label:'Tutti'},
      {val:'',label:'Da usare'},
      {val:'in_uso',label:'In uso'},
      {val:'usato',label:'Usate'},
      {val:'magazzino',label:'Magazzino'}
    ];
    FILTRI.forEach(function(f){
      var btn=document.createElement('button');
      var active=state.schedaListFilter===f.val;
      btn.style.cssText='font-family:\'Cinzel\',serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:3px;cursor:pointer;border:1px solid '+(active?'#8b6f3f':'#ccc')+';background:'+(active?'rgba(139,111,63,0.15)':'#fff')+';color:'+(active?'#8b6f3f':'#888')+';';
      btn.textContent=f.label;
      btn.onclick=function(){ state.schedaListFilter=f.val; renderMain(); };
      filterBar.appendChild(btn);
    });
    content.appendChild(filterBar);

    /* ── Filtra schedeList ── */
    var schedeFiltered = state.schedeList.filter(function(sch){
      if(state.schedaListFilter==='tutti') return true;
      return (sch.stato||'')===(state.schedaListFilter);
    });

    var grid=document.createElement('div'); grid.style.cssText='display:flex;flex-wrap:wrap;gap:1.5rem;';
    schedeFiltered.forEach(function(sch){
      var card=document.createElement('div');
      card.className='sium-pg-card';
      card.style.cssText='width:160px;background:#fff;border-radius:6px;box-shadow:0 3px 16px rgba(0,0,0,0.5);overflow:hidden;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;';
      card.onmouseenter=function(){this.style.transform='translateY(-3px)';this.style.boxShadow='0 6px 24px rgba(0,0,0,0.65)';};
      card.onmouseleave=function(){this.style.transform='';this.style.boxShadow='0 3px 16px rgba(0,0,0,0.5)';};
      (function(s){card.onclick=function(){state.scheda=s;state.schedaAttivaId=s.id;renderMain();};})(sch);
      var imgD=document.createElement('div'); imgD.style.cssText='width:100%;height:160px;background:#e0d5c0;display:flex;align-items:center;justify-content:center;overflow:hidden;';
      if(sch.aspettoImg || sch.avatar || sch.portrait){var im=document.createElement('img');im.src=sch.aspettoImg || sch.avatar || sch.portrait;im.style.cssText='width:100%;height:100%;object-fit:cover;';imgD.appendChild(im);}
      else{imgD.innerHTML='<div style="font-size:48px;">🧙</div>';}
      card.appendChild(imgD);
      var info=document.createElement('div'); info.style.cssText='padding:0.6rem 0.75rem;text-align:center;';
      var nm=document.createElement('div'); nm.style.cssText='font-family:\'Cinzel\',serif;font-size:12px;font-weight:bold;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'; nm.textContent=sch.nomePersonaggio||sch.eroe||sch.nome||'Senza nome';
      var cl=document.createElement('div'); cl.style.cssText='font-size:10px;color:#888;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'; cl.textContent=sch.classelivello||'';
      info.appendChild(nm); if(sch.classelivello)info.appendChild(cl); card.appendChild(info);
      /* Selettore stato personaggio */
      var stWrap=document.createElement('div');
      stWrap.style.cssText='border-top:1px solid #eee;padding:5px 6px;background:#fafafa;';
      stWrap.addEventListener('click',function(e){e.stopPropagation();});
      var stSel=document.createElement('select');
      stSel.style.cssText='width:100%;font-size:10px;border:1px solid #ddd;border-radius:3px;padding:3px 4px;cursor:pointer;background:#fff;color:#333;outline:none;font-family:Arial,sans-serif;';
      [['','Da usare'],['in_uso','In uso'],['usato','Usato'],['magazzino','Magazzino']].forEach(function(op){
        var opt=document.createElement('option'); opt.value=op[0]; opt.textContent=op[1];
        if((sch.stato||'')===op[0])opt.selected=true;
        stSel.appendChild(opt);
      });
      (function(ch){stSel.onchange=function(){
        ch.stato=this.value;
        if(_db&&state.currentUser) _db.ref('schedePG/'+state.currentUser.username+'/chars/'+ch.id+'/stato').set(this.value);
      };})(sch);
      stWrap.appendChild(stSel); card.appendChild(stWrap);
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }
  wrap.appendChild(content); return wrap;
}

function _renderCompanionMiniSheet(charId,comp) {
  var m2=function(v){return Math.floor(((parseInt(v)||10)-10)/2);};
  var fmt2=function(n){return(n>=0?'+':'')+n;};
  var wrap=document.createElement('div');
  wrap.style.cssText='width:760px;background:#f8f4e8;color:#111;box-shadow:0 3px 20px rgba(0,0,0,0.6);padding:14px 16px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:10px;border:2px solid #6a8abf;border-radius:4px;margin-top:20px;';
  /* header */
  var hdr=document.createElement('div'); hdr.style.cssText='border-bottom:2px solid #6a8abf;margin-bottom:8px;padding-bottom:5px;display:flex;justify-content:space-between;align-items:flex-end;';
  var nBlk=document.createElement('div');
  var nLbl=document.createElement('div'); nLbl.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#4a6a9a;margin-bottom:2px;'; nLbl.textContent='Nome Compagno';
  var nInp=document.createElement('input'); nInp.type='text'; nInp.value=comp.nome||'';
  nInp.style.cssText='background:transparent;border:none;border-bottom:1px solid #6a8abf;color:#111;font-size:15px;font-weight:bold;outline:none;width:260px;font-family:Arial,Helvetica,sans-serif;';
  (function(cid,co){nInp.oninput=function(){co.nome=this.value;fbSaveCompanion(cid,co);};})(charId,comp);
  nBlk.appendChild(nLbl); nBlk.appendChild(nInp);
  var tBlk=document.createElement('div'); tBlk.style.cssText='text-align:right;';
  var tLbl=document.createElement('div'); tLbl.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#4a6a9a;margin-bottom:2px;'; tLbl.textContent='Tipo';
  var tInp=document.createElement('input'); tInp.type='text'; tInp.value=comp.tipo||'';
  tInp.style.cssText='background:transparent;border:none;border-bottom:1px solid #6a8abf;color:#555;font-size:11px;outline:none;width:140px;text-align:right;font-family:Arial,Helvetica,sans-serif;';
  (function(cid,co){tInp.oninput=function(){co.tipo=this.value;fbSaveCompanion(cid,co);};})(charId,comp);
  tBlk.appendChild(tLbl); tBlk.appendChild(tInp);
  hdr.appendChild(nBlk); hdr.appendChild(tBlk); wrap.appendChild(hdr);
  /* CA / HP / VEL */
  var r1=document.createElement('div'); r1.style.cssText='display:flex;gap:5px;margin-bottom:7px;';
  function cmpStat(lbl,key){
    var bx=document.createElement('div'); bx.style.cssText='border:1px solid #9ab;border-radius:2px;padding:3px 4px;text-align:center;flex:1;background:#f0f5fa;';
    var inp=document.createElement('input'); inp.type='text'; inp.value=comp[key]||'';
    inp.style.cssText='width:100%;text-align:center;background:transparent;border:none;color:#111;font-size:14px;font-weight:bold;outline:none;';
    (function(cid,co,k){inp.oninput=function(){co[k]=this.value;fbSaveCompanion(cid,co);};})(charId,comp,key);
    var lb=document.createElement('div'); lb.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.07em;color:#4a6a9a;border-top:1px solid #9ab;margin-top:2px;padding-top:1px;'; lb.textContent=lbl;
    bx.appendChild(inp); bx.appendChild(lb); return bx;
  }
  var hpBx=document.createElement('div'); hpBx.style.cssText='flex:2;border:1px solid #9ab;border-radius:2px;padding:3px 4px;text-align:center;background:#f0f5fa;';
  var hpRw=document.createElement('div'); hpRw.style.cssText='display:flex;align-items:center;justify-content:center;gap:2px;';
  var hpC=document.createElement('input'); hpC.type='text'; hpC.value=comp.hpAttuali||'';
  hpC.style.cssText='width:40px;text-align:right;background:transparent;border:none;border-bottom:1px solid #c84040;color:#c84040;font-size:14px;font-weight:bold;outline:none;';
  (function(cid,co){hpC.oninput=function(){co.hpAttuali=this.value;fbSaveCompanion(cid,co);};})(charId,comp);
  var hpSp=document.createElement('span'); hpSp.style.cssText='font-size:14px;color:#888;'; hpSp.textContent='/';
  var hpM=document.createElement('input'); hpM.type='text'; hpM.value=comp.hpMax||'';
  hpM.style.cssText='width:40px;text-align:left;background:transparent;border:none;border-bottom:1px solid #9ab;color:#111;font-size:14px;font-weight:bold;outline:none;';
  (function(cid,co){hpM.oninput=function(){co.hpMax=this.value;fbSaveCompanion(cid,co);};})(charId,comp);
  hpRw.appendChild(hpC); hpRw.appendChild(hpSp); hpRw.appendChild(hpM);
  var hpLb=document.createElement('div'); hpLb.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.07em;color:#4a6a9a;border-top:1px solid #9ab;margin-top:2px;padding-top:1px;'; hpLb.textContent='Punti Ferita (att/max)';
  hpBx.appendChild(hpRw); hpBx.appendChild(hpLb);
  r1.appendChild(cmpStat('Classe Armatura','ca')); r1.appendChild(hpBx); r1.appendChild(cmpStat('Velocità','velocita')); wrap.appendChild(r1);
  /* Stats 6 */
  var sN=['FOR','DES','COS','INT','SAG','CAR'],sK=['for','des','cos','int','sag','car'],tsK=['tsFor','tsDes','tsCos','tsInt','tsSag','tsCar'];
  var sg=document.createElement('div'); sg.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:7px;';
  sN.forEach(function(sn,i){
    var cell=document.createElement('div'); cell.style.cssText='border:1px solid #9ab;border-radius:2px;background:#f0f5fa;padding:4px 2px;text-align:center;';
    var sLb=document.createElement('div'); sLb.style.cssText='font-size:6.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#4a6a9a;margin-bottom:2px;'; sLb.textContent=sn;
    var sv=parseInt(comp[sK[i]])||10;
    var vI=document.createElement('input'); vI.type='number'; vI.value=sv; vI.min=1; vI.max=30;
    vI.style.cssText='width:100%;text-align:center;background:transparent;border:none;border-bottom:1px solid #9ab;color:#111;font-size:14px;font-weight:bold;outline:none;box-sizing:border-box;padding:0;';
    var mDiv=document.createElement('div'); mDiv.style.cssText='font-size:9px;color:#555;margin-top:1px;'; mDiv.textContent=fmt2(m2(sv));
    (function(cid,co,k,md){vI.oninput=function(){co[k]=parseInt(this.value)||10;md.textContent=fmt2(m2(co[k]));fbSaveCompanion(cid,co);};})(charId,comp,sK[i],mDiv);
    var tsRw=document.createElement('div'); tsRw.style.cssText='display:flex;align-items:center;justify-content:center;gap:2px;margin-top:2px;';
    var tsCb=document.createElement('input'); tsCb.type='checkbox'; tsCb.checked=!!comp[tsK[i]]; tsCb.style.cssText='width:9px;height:9px;cursor:pointer;accent-color:#4a6a9a;';
    (function(cid,co,tk){tsCb.onchange=function(){co[tk]=this.checked;fbSaveCompanion(cid,co);};})(charId,comp,tsK[i]);
    var tsLb=document.createElement('span'); tsLb.style.cssText='font-size:5.5px;color:#4a6a9a;'; tsLb.textContent='TS';
    tsRw.appendChild(tsCb); tsRw.appendChild(tsLb);
    cell.appendChild(sLb); cell.appendChild(vI); cell.appendChild(mDiv); cell.appendChild(tsRw); sg.appendChild(cell);
  });
  wrap.appendChild(sg);
  /* Textarea helper */
  function cmpTA(lbl,key,minH){
    var bx=document.createElement('div'); bx.style.cssText='border:1px solid #9ab;border-radius:2px;';
    var ta=document.createElement('textarea'); ta.style.cssText='width:100%;background:#f5f8fc;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;min-height:'+minH+'px;box-sizing:border-box;';
    ta.value=comp[key]||'';
    (function(cid,co,k){ta.oninput=function(){co[k]=this.value;fbSaveCompanion(cid,co);};})(charId,comp,key);
    var lb=document.createElement('div'); lb.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#4a6a9a;border-top:1px solid #9ab;padding:2px;text-align:center;background:#e8f0fa;'; lb.textContent=lbl;
    bx.appendChild(ta); bx.appendChild(lb); return bx;
  }
  /* Bonus Competenza */
  var bcRw=document.createElement('div'); bcRw.style.cssText='display:flex;align-items:center;gap:6px;margin-bottom:6px;padding:3px 6px;border:1px solid #9ab;border-radius:2px;background:#f0f5fa;';
  var bcLb=document.createElement('span'); bcLb.style.cssText='font-size:6.5px;font-weight:bold;text-transform:uppercase;color:#4a6a9a;white-space:nowrap;'; bcLb.textContent='Bonus Competenza:';
  var bcIn=document.createElement('input'); bcIn.type='number'; bcIn.value=comp.bonusComp||2; bcIn.min=1; bcIn.max=9;
  bcIn.style.cssText='width:36px;text-align:center;background:transparent;border:none;border-bottom:1px solid #9ab;color:#111;font-size:13px;font-weight:bold;outline:none;';
  bcRw.appendChild(bcLb); bcRw.appendChild(bcIn); wrap.appendChild(bcRw);

  /* Skills con checkbox e bonus calcolato */
  var SKILLS=[
    {k:'skAtle',lbl:'Atletica',ab:'for'},
    {k:'skAcro',lbl:'Acrobazia',ab:'des'},{k:'skFurt',lbl:'Furtività',ab:'des'},{k:'skRapi',lbl:'Rapidità di mano',ab:'des'},
    {k:'skArca',lbl:'Arcano',ab:'int'},{k:'skInda',lbl:'Indagare',ab:'int'},{k:'skNatu',lbl:'Natura',ab:'int'},
    {k:'skReli',lbl:'Religione',ab:'int'},{k:'skStor',lbl:'Storia',ab:'int'},{k:'skTecn',lbl:'Tecnologia',ab:'int'},
    {k:'skAnim',lbl:'Addestrare animali',ab:'sag'},{k:'skIntu',lbl:'Intuizione',ab:'sag'},{k:'skMedi',lbl:'Medicina',ab:'sag'},
    {k:'skPerc',lbl:'Percezione',ab:'sag'},{k:'skSopr',lbl:'Sopravvivenza',ab:'sag'},
    {k:'skInga',lbl:'Inganno',ab:'car'},{k:'skInti',lbl:'Intimidazione',ab:'car'},{k:'skIntr',lbl:'Intrattenimento',ab:'car'},{k:'skPers',lbl:'Persuasione',ab:'car'}
  ];
  var _skBEl={};
  function _calcSkB(sk){ var ab=parseInt(comp[sk.ab])||10; var mod=Math.floor((ab-10)/2); var bc=parseInt(comp.bonusComp)||2; return mod+(comp[sk.k]?bc:0); }
  function _refreshSk(){ SKILLS.forEach(function(sk){ if(_skBEl[sk.k]){var b=_calcSkB(sk);_skBEl[sk.k].textContent=(b>=0?'+':'')+b;} }); }
  (function(cid,co){bcIn.oninput=function(){co.bonusComp=parseInt(this.value)||2;fbSaveCompanion(cid,co);_refreshSk();};})(charId,comp);
  var skBox=document.createElement('div'); skBox.style.cssText='border:1px solid #9ab;border-radius:2px;margin-bottom:5px;';
  var skHd=document.createElement('div'); skHd.style.cssText='font-size:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#4a6a9a;padding:2px 5px;border-bottom:1px solid #9ab;background:#e8f0fa;'; skHd.textContent='Abilità';
  skBox.appendChild(skHd);
  var skGrid=document.createElement('div'); skGrid.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:0;padding:2px;';
  SKILLS.forEach(function(sk){
    var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:2px;padding:1px 3px;';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!comp[sk.k]; cb.style.cssText='width:8px;height:8px;cursor:pointer;accent-color:#4a6a9a;flex-shrink:0;';
    var b=_calcSkB(sk);
    var bonSp=document.createElement('span'); bonSp.style.cssText='font-size:7.5px;font-weight:bold;color:#4a6a9a;width:22px;text-align:right;flex-shrink:0;'; bonSp.textContent=(b>=0?'+':'')+b; _skBEl[sk.k]=bonSp;
    var lbl=document.createElement('span'); lbl.style.cssText='font-size:7.5px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:1px;'; lbl.textContent=sk.lbl;
    (function(cid,co,k){cb.onchange=function(){co[k]=this.checked;fbSaveCompanion(cid,co);_refreshSk();};})(charId,comp,sk.k);
    row.appendChild(cb); row.appendChild(bonSp); row.appendChild(lbl); skGrid.appendChild(row);
  });
  skBox.appendChild(skGrid); wrap.appendChild(skBox);

  var r3b=document.createElement('div'); r3b.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px;';
  r3b.appendChild(cmpTA('Sensi','sensi',30)); r3b.appendChild(cmpTA('Lingue','lingue',30)); wrap.appendChild(r3b);
  var r4=document.createElement('div'); r4.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:5px;';
  r4.appendChild(cmpTA('Immunità ai Danni','immunita',28)); r4.appendChild(cmpTA('Resistenze','resistenze',28)); r4.appendChild(cmpTA('Imm. Condizioni','condImm',28)); wrap.appendChild(r4);
  /* Tratti Speciali — area grande e ridimensionabile */
  var trBox=document.createElement('div'); trBox.style.cssText='border:1px solid #9ab;border-radius:2px;margin-bottom:5px;';
  var trTa=document.createElement('textarea'); trTa.style.cssText='width:100%;background:#f5f8fc;border:none;resize:vertical;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:4px;min-height:80px;box-sizing:border-box;'; trTa.value=comp.tratti||'';
  (function(cid,co){trTa.oninput=function(){co.tratti=this.value;fbSaveCompanion(cid,co);};})(charId,comp);
  var trLb=document.createElement('div'); trLb.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#4a6a9a;border-top:1px solid #9ab;padding:2px;text-align:center;background:#e8f0fa;'; trLb.textContent='Tratti Speciali';
  trBox.appendChild(trTa); trBox.appendChild(trLb); wrap.appendChild(trBox);
  /* Azioni */
  var azBx=document.createElement('div'); azBx.style.cssText='border:1px solid #9ab;border-radius:2px;margin-bottom:6px;';
  var azHd=document.createElement('div'); azHd.style.cssText='font-size:6.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#4a6a9a;padding:3px 5px;border-bottom:1px solid #9ab;background:#e8f0fa;display:flex;align-items:center;justify-content:space-between;';
  var azSp=document.createElement('span'); azSp.textContent='Azioni / Attacchi'; azHd.appendChild(azSp);
  var azAdd=document.createElement('button'); azAdd.textContent='+'; azAdd.style.cssText='background:#4a6a9a;border:none;color:#fff;border-radius:2px;padding:1px 6px;cursor:pointer;font-size:10px;';
  (function(cid,co){azAdd.onclick=function(){if(!co.azioni)co.azioni=[];co.azioni.push({nome:'',desc:''});fbSaveCompanion(cid,co);renderMain();};})(charId,comp);
  azHd.appendChild(azAdd); azBx.appendChild(azHd);
  if(!comp.azioni||!comp.azioni.length) comp.azioni=[{nome:'',desc:''}];
  comp.azioni.forEach(function(az,idx){
    var azRw=document.createElement('div'); azRw.style.cssText='display:flex;align-items:flex-start;gap:4px;padding:3px 5px;border-bottom:1px solid #d0dde8;';
    var nI=document.createElement('input'); nI.type='text'; nI.value=az.nome||''; nI.placeholder='Nome azione...';
    nI.style.cssText='width:110px;flex-shrink:0;background:transparent;border:none;border-bottom:1px solid #9ab;color:#111;font-size:10px;font-weight:bold;outline:none;font-family:Arial,Helvetica,sans-serif;';
    (function(cid,co,i){nI.oninput=function(){co.azioni[i].nome=this.value;fbSaveCompanion(cid,co);};})(charId,comp,idx);
    var dT=document.createElement('textarea'); dT.style.cssText='flex:1;background:transparent;border:none;color:#111;font-size:9px;outline:none;resize:none;min-height:26px;font-family:Arial,Helvetica,sans-serif;padding:0;'; dT.value=az.desc||''; dT.placeholder='Descrizione, danni, effetti...';
    (function(cid,co,i){dT.oninput=function(){co.azioni[i].desc=this.value;fbSaveCompanion(cid,co);};})(charId,comp,idx);
    var dB=document.createElement('button'); dB.textContent='✕'; dB.style.cssText='background:none;border:none;color:#c04040;cursor:pointer;font-size:11px;padding:0;flex-shrink:0;margin-top:1px;';
    (function(cid,co,i){dB.onclick=function(){co.azioni.splice(i,1);fbSaveCompanion(cid,co);renderMain();};})(charId,comp,idx);
    azRw.appendChild(nI); azRw.appendChild(dT); azRw.appendChild(dB); azBx.appendChild(azRw);
  });
  wrap.appendChild(azBx);
  /* Delete */
  var foot=document.createElement('div'); foot.style.cssText='display:flex;justify-content:flex-end;';
  var delB=document.createElement('button'); delB.textContent='Elimina scheda compagno';
  delB.style.cssText='background:#4a1010;border:1px solid #c04040;color:#f08080;border-radius:3px;padding:0.3rem 0.75rem;font-size:10px;cursor:pointer;font-family:\'Cinzel\',serif;';
  (function(cid,co){delB.onclick=function(){
    if(!confirm('Eliminare la scheda di "'+(co.nome||'questo compagno')+'"?')) return;
    if(state.companions&&state.companions[cid]) delete state.companions[cid][co.id];
    fbDeleteCompanion(cid,co.id); renderMain();
  };})(charId,comp);
  foot.appendChild(delB); wrap.appendChild(foot);
  return wrap;
}

function _renderCompanionForm(charId) {
  var cid2='cp'+Date.now();
  var form={id:cid2,nome:'',tipo:''};
  var bd=document.createElement('div');
  bd.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
  bd.onclick=function(e){if(e.target===bd){state.companionShowForm=false;state.companionEditingId=null;renderMain();}};
  var modal=document.createElement('div');
  modal.style.cssText='background:#1a1f2a;border:1px solid #3a4a6a;border-radius:6px;width:380px;padding:1.5rem;font-family:\'Cinzel\',serif;';
  modal.onclick=function(e){e.stopPropagation();};
  var mT=document.createElement('div'); mT.style.cssText='font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#aacef0;margin-bottom:1.25rem;'; mT.textContent='Nuova Scheda Compagno';
  modal.appendChild(mT);
  function cFld(label,key){
    var w=document.createElement('div'); w.style.marginBottom='0.75rem';
    var l=document.createElement('label'); l.style.cssText='display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6a9abf;margin-bottom:0.3rem;'; l.textContent=label;
    var inp=document.createElement('input'); inp.type='text'; inp.value=form[key]||'';
    inp.style.cssText='width:100%;background:rgba(255,255,255,0.06);border:1px solid #3a4a6a;border-radius:3px;color:#d0e0f0;font-family:\'EB Garamond\',serif;font-size:14px;padding:0.4rem 0.6rem;outline:none;box-sizing:border-box;';
    inp.oninput=function(){form[key]=this.value;};
    w.appendChild(l); w.appendChild(inp); return w;
  }
  modal.appendChild(cFld('Nome Compagno / Pet','nome'));
  modal.appendChild(cFld('Tipo (es. Bestia, Costrutto, Drone)','tipo'));
  var btnR=document.createElement('div'); btnR.style.cssText='display:flex;gap:0.5rem;margin-top:1rem;';
  var can=document.createElement('button'); can.textContent='Annulla';
  can.style.cssText='flex:1;background:#2a2a2a;border:1px solid #555;color:#aaa;border-radius:3px;padding:0.55rem;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;';
  can.onclick=function(){state.companionShowForm=false;state.companionEditingId=null;renderMain();};
  var ok=document.createElement('button'); ok.textContent='Crea Scheda';
  ok.style.cssText='flex:2;background:#4a6a9a;border:none;color:#fff;border-radius:3px;padding:0.55rem;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:0.06em;';
  ok.onclick=function(){
    if(!form.nome.trim()){alert('Inserisci un nome per il compagno.');return;}
    var comp=Object.assign(_companionDefault(),form);
    if(!state.companions) state.companions={};
    if(!state.companions[charId]) state.companions[charId]={};
    state.companions[charId][comp.id]=comp;
    fbSaveCompanion(charId,comp);
    state.companionShowForm=false; state.companionEditingId=null; renderMain();
  };
  btnR.appendChild(can); btnR.appendChild(ok); modal.appendChild(btnR);
  bd.appendChild(modal); return bd;
}


/* ============================================================================
   SEZIONE 9: SCHEDE PERSONAGGIO MULTI-SISTEMA (D&D 5e, 7th Sea, One Piece, ecc.)
   ============================================================================ */
function renderScheda() {
  if(isDM() && !state.schedePGViewMode) return document.createElement('div');

  if(!state.schedaLoaded) {
    var ld=document.createElement('div'); ld.style.cssText='display:flex;align-items:center;justify-content:center;min-height:60vh;background:#5a5a5a;';
    ld.innerHTML='<div style="background:#fff;padding:2rem 3rem;border-radius:4px;text-align:center;font-family:Arial,sans-serif;color:#333;"><div style="font-size:36px;margin-bottom:0.75rem;">📜</div><h2 style="margin:0;">Caricamento schede…</h2></div>';
    fbLoadSchede(function(){renderMain();}); return ld;
  }

  if(!state.schedePGViewMode && state.companionShowForm&&state.companionEditingCharId===state.schedaAttivaId) return _renderCompanionForm(state.schedaAttivaId);
  if(state.schedaAttivaId===null) return _renderSchedaList();

  /* Routing per schede alternative */
  var _sTipo = state.scheda.schedaTipo || 'normale';
  if (_sTipo === 'pokemon' && window.renderPokemonSheet) return window.renderPokemonSheet(state.scheda);
    if (_sTipo === 'naruto' && window.renderNarutoSheet) return window.renderNarutoSheet(state.scheda);
    if (_sTipo === 'brancalonia' && window.renderBrancaloniaSheet) return window.renderBrancaloniaSheet(state.scheda);
    if (_sTipo === 'sw5e' && window.renderSW5eSheet) return window.renderSW5eSheet(state.scheda);
  if (_sTipo !== 'normale' && SHEET_DEFS[_sTipo]) return _renderAltSheet(_sTipo);

  var wrap=document.createElement('div');
  wrap.style.cssText='display:flex;flex-direction:column;background:#5a5a5a;';
  /* nav bar */
  var _nb=document.createElement('div'); _nb.style.cssText='background:#1a1a1a;border-bottom:1px solid #333;padding:0.45rem 1rem;display:flex;align-items:center;gap:0.5rem;flex-shrink:0;';
  var _bk=document.createElement('button');
  if(state.schedePGViewMode) {
    _bk.innerHTML='&#8592; Schede PG';
    _bk.onclick=function(){state.schedePGViewMode=false;state.schedePGOpenChar=null;state.schedaAttivaId=null;state.scheda={};state.companions={};renderMain();};
  } else {
    _bk.innerHTML='&#8592; Personaggi';
    _bk.onclick=function(){state.schedaAttivaId=null;state.scheda={};renderMain();};
  }
  _bk.style.cssText='background:#444;border:1px solid #666;color:#ccc;border-radius:3px;padding:0.3rem 0.75rem;font-size:11px;cursor:pointer;font-family:\'Cinzel\',serif;';
  _nb.appendChild(_bk);
  var _sp=document.createElement('span'); _sp.style.flex='1'; _nb.appendChild(_sp);
  if(state.schedePGViewMode) {
    var _dmBadge=document.createElement('span');
    _dmBadge.style.cssText='font-family:\'Cinzel\',serif;font-size:10px;color:#c9a55c;letter-spacing:0.15em;text-transform:uppercase;border:1px solid #6b5a2a;background:rgba(201,165,92,0.1);padding:2px 10px;border-radius:3px;';
    _dmBadge.textContent='⚔ Vista Master — sola lettura';
    _nb.appendChild(_dmBadge);
  } else {
    var _bN=document.createElement('button'); _bN.textContent='+ Nuova Scheda';
    _bN.style.cssText='background:#8b6f3f;border:1px solid #c9a55c;color:#f0e4cc;border-radius:3px;padding:0.3rem 0.75rem;font-size:11px;cursor:pointer;font-family:\'Cinzel\',serif;letter-spacing:0.07em;';
    _bN.onclick=function(){_newScheda();}; _nb.appendChild(_bN);
    
    var _bExport=document.createElement('button'); _bExport.textContent='⬇ Scarica Scheda (Backup JSON)';
    _bExport.style.cssText='background:#2d4a22;border:1px solid #4caf50;color:#e8f5e9;border-radius:3px;padding:0.3rem 0.75rem;font-size:11px;cursor:pointer;font-family:\'Cinzel\',serif;margin-left:4px;';
    _bExport.onclick=function(){
      var bExportOrigText = _bExport.textContent;
      _bExport.textContent = '⏳ Preparazione...';
      var schedaExport = JSON.parse(JSON.stringify(state.scheda));
      var promises = [];
      if (schedaExport.boardImages) {
        schedaExport.boardImages.forEach(function(img) {
          if (window.ImageDB) {
            promises.push(
              window.ImageDB.get(img.id).then(function(du) {
                if(du) img.dataUrl = du;
              })
            );
          }
        });
      }
      Promise.all(promises).then(function() {
        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(schedaExport));
        var dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", (schedaExport.nomePersonaggio||'Personaggio') + "_Backup.json");
        dlAnchorElem.click();
        _bExport.textContent = bExportOrigText;
      }).catch(function(err){
        alert("Errore durante l'esportazione delle immagini.");
        _bExport.textContent = bExportOrigText;
      });
    }; _nb.appendChild(_bExport);

    var _bImport=document.createElement('button'); _bImport.textContent='⬆ Carica Scheda (Ripristina JSON)';
    _bImport.style.cssText='background:#4a3b10;border:1px solid #ff9800;color:#fff3e0;border-radius:3px;padding:0.3rem 0.75rem;font-size:11px;cursor:pointer;font-family:\'Cinzel\',serif;margin-left:4px;';
    _bImport.onclick=function(){
      var fi=document.createElement('input');fi.type='file';fi.accept='.json';
      fi.onchange=function(e){
        var f=e.target.files[0];if(!f)return;
        var r=new FileReader();
        r.onload=function(ev){
          try{
            var parsed=JSON.parse(ev.target.result);
            if(confirm("Sovrascrivere il personaggio attuale con il backup caricato? ATTENZIONE: Questa azione distruggerà i dati correnti di questa scheda.")){
              var oldId = state.scheda.id || state.schedaAttivaId;
              parsed.id = oldId;
              state.scheda = parsed;
              if (window.migrateImagesToDB) window.migrateImagesToDB();
              ss(); renderMain();
            }
          }catch(err){alert("File JSON non valido.");}
        };r.readAsText(f);
      };
      fi.click();
    }; _nb.appendChild(_bImport);

    var _bA=document.createElement('button'); _bA.textContent='+ Associa Scheda';
    _bA.style.cssText='background:#2a4060;border:1px solid #4a70a0;color:#aacef0;border-radius:3px;padding:0.3rem 0.75rem;font-size:11px;cursor:pointer;font-family:\'Cinzel\',serif;margin-left:4px;letter-spacing:0.07em;';
    _bA.onclick=function(){state.companionShowForm=true;state.companionEditingId=null;state.companionEditingCharId=state.schedaAttivaId;renderMain();}; _nb.appendChild(_bA);
    var _bD=document.createElement('button'); _bD.textContent='Elimina personaggio';
    _bD.style.cssText='background:#4a1010;border:1px solid #c04040;color:#f08080;border-radius:3px;padding:0.3rem 0.75rem;font-size:10px;cursor:pointer;font-family:\'Cinzel\',serif;margin-left:0.5rem;';
    _bD.onclick=function(){
      var _sch=state.scheda;
      if(!confirm('Eliminare "'+(_sch.nomePersonaggio||_sch.eroe||_sch.nome||'questo personaggio')+'"? Non recuperabile.')) return;
      var _did=state.schedaAttivaId;
      state.schedeList=state.schedeList.filter(function(x){return x.id!==_did;});
      if(state.companions) delete state.companions[_did];
      fbDeleteSchedaItem(_did); state.schedaAttivaId=null; state.scheda={}; renderMain();
    }; _nb.appendChild(_bD);
  }
  wrap.appendChild(_nb);

  var s=state.scheda;
  var _dmView=state.schedePGViewMode;
  function ss(){if(!_dmView) fbSaveScheda();}
  function m(v){return Math.floor(((parseInt(v)||10)-10)/2);}
  function fmt(n){return(n>=0?'+':'')+n;}
  function fsv(stat,profi){var bc=parseInt(s.bonusCompetenza)||2;return fmt(m(stat)+(profi?bc:0));}
  function fsvM(statVal,profKey,maestKey){var bc=parseInt(s.bonusCompetenza)||2;return fmt(m(statVal)+(s[profKey]?bc*(s[maestKey]?2:1):0));}

  /* ---- ZOOM BAR ---- */
  var zBar=document.createElement('div');
  zBar.style.cssText='background:#333;border-bottom:1px solid #222;padding:0.35rem 1rem;display:flex;align-items:center;gap:0.5rem;flex-shrink:0;position:sticky;top:0;z-index:200;';
  var zOut=document.createElement('button'); zOut.textContent='−'; zOut.style.cssText='background:#555;border:1px solid #777;color:#eee;border-radius:3px;padding:0.15rem 0.65rem;font-size:15px;font-weight:bold;cursor:pointer;line-height:1;';
  var zLbl=document.createElement('span'); zLbl.style.cssText='color:#ccc;font-family:\'Cinzel\',serif;font-size:11px;min-width:44px;text-align:center;';
  zLbl.textContent=Math.round((state.schedaZoom||1)*100)+'%';
  var zIn=document.createElement('button'); zIn.textContent='+'; zIn.style.cssText='background:#555;border:1px solid #777;color:#eee;border-radius:3px;padding:0.15rem 0.65rem;font-size:15px;font-weight:bold;cursor:pointer;line-height:1;';
  var zReset=document.createElement('button'); zReset.textContent='100%'; zReset.style.cssText='background:#444;border:1px solid #666;color:#bbb;border-radius:3px;padding:0.15rem 0.5rem;font-size:10px;cursor:pointer;font-family:\'Cinzel\',serif;';
  var zHint=document.createElement('span'); zHint.style.cssText='color:#777;font-family:\'EB Garamond\',serif;font-size:12px;margin-left:0.5rem;'; zHint.textContent='Ctrl+Rotella per zoomare';
  zBar.appendChild(zOut); zBar.appendChild(zLbl); zBar.appendChild(zIn); zBar.appendChild(zReset); zBar.appendChild(zHint);
  wrap.appendChild(zBar);

  var pgWrap;
  function applyZoom(){
    var z=Math.max(0.4,Math.min(2.5,state.schedaZoom||1));
    state.schedaZoom=z; zLbl.textContent=Math.round(z*100)+'%';
    if(pgWrap){pgWrap.style.transform='scale('+z+')';pgWrap.style.transformOrigin='top center'; scrollArea.style.height=(pgWrap.scrollHeight*z+80)+'px';}
  }
  zOut.onclick=function(){state.schedaZoom=Math.max(0.4,(state.schedaZoom||1)-0.1);applyZoom();};
  zIn.onclick=function(){state.schedaZoom=Math.min(2.5,(state.schedaZoom||1)+0.1);applyZoom();};
  zReset.onclick=function(){state.schedaZoom=1;applyZoom();};

  /* ---- SCROLL AREA ---- */
  var scrollArea=document.createElement('div');
  scrollArea.style.cssText='overflow:auto;padding:1.5rem;display:flex;justify-content:center;';
  scrollArea.addEventListener('wheel',function(e){
    if(e.ctrlKey||e.metaKey){e.preventDefault();state.schedaZoom=Math.max(0.4,Math.min(2.5,(state.schedaZoom||1)-(e.deltaY>0?0.1:-0.1)));applyZoom();}
  },{passive:false});

  pgWrap=document.createElement('div');
  pgWrap.className='sium-pg-sheet-wrap';
  pgWrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:20px;transform-origin:top center;';

  /* ---- HELPERS ---- */
  function makePage(){
    var pg=document.createElement('div');
    pg.className='sium-pg-page';
    pg.style.cssText='width:760px;min-height:1040px;background:#fff;color:#111;box-shadow:0 3px 20px rgba(0,0,0,0.6);padding:14px 16px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:10px;display:flex;flex-direction:column;';
    return pg;
  }
  function makeTraitBox(label,key,minH,grow){
    var box=document.createElement('div');
    box.className='sium-pg-trait-box';
    box.style.cssText='border:1px solid #aaa;border-radius:2px;margin-bottom:4px;overflow:hidden;'+(grow?'flex:1;display:flex;flex-direction:column;':'');
    var ta=document.createElement('textarea');
    ta.style.cssText='width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;min-height:'+minH+'px;line-height:1.4;'+(grow?'flex:1;':'');
    ta.value=s[key]||'';
    (function(k){ta.oninput=function(){s[k]=this.value;ss();};})(key);
    var lbl=document.createElement('div'); lbl.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#555;text-align:center;background:#f0f0f0;border-top:1px solid #bbb;padding:2px;flex-shrink:0;'; lbl.textContent=label;
    box.appendChild(ta); box.appendChild(lbl); return box;
  }
  function secTitle(text){
    var d=document.createElement('div');
    d.style.cssText='font-size:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#333;text-align:center;border-top:1.5px solid #777;margin-top:2px;padding-top:2px;';
    d.textContent=text; return d;
  }
  function cellLbl(text){
    var d=document.createElement('div');
    d.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#555;border-top:1px solid #ccc;padding-top:1px;margin-top:1px;';
    d.textContent=text; return d;
  }
  function makeBubble(checked,onChange){
    var bub=document.createElement('div');
    bub.className='sium-pg-bubble';
    bub.style.cssText='width:9px;height:9px;border-radius:50%;border:1.5px solid #555;cursor:pointer;flex-shrink:0;background:'+(checked?'#111':'transparent')+';';
    bub.onclick=function(){var v=this.style.background==='transparent';this.style.background=v?'#111':'transparent';onChange(v);};
    return bub;
  }
  function makeStatBox(name,statKey){
    var box=document.createElement('div');
    box.className='sium-pg-stat-box';
    box.style.cssText='border:2px solid #555;border-radius:5px;text-align:center;padding:3px 2px;margin-bottom:4px;cursor:pointer;';
    var nameLbl=document.createElement('div'); nameLbl.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#333;'; nameLbl.textContent=name;
    var valInp=document.createElement('input'); valInp.type='number'; valInp.min=1; valInp.max=30; valInp.value=parseInt(s[statKey])||10;
    valInp.style.cssText='width:100%;text-align:center;font-size:20px;font-weight:bold;color:#111;background:transparent;border:none;border-bottom:1px solid #bbb;outline:none;padding:1px;';
    var modSpan=document.createElement('div'); modSpan.id='pd-mod-'+statKey; modSpan.style.cssText='font-size:13px;font-weight:bold;color:#111;border:1.5px solid #555;border-radius:50%;width:26px;height:26px;line-height:24px;text-align:center;margin:2px auto 0;';
    modSpan.textContent=fmt(m(s[statKey]));
    (function(k){valInp.oninput=function(){s[k]=parseInt(this.value)||10;updateSchedaDerived();ss();};})(statKey);
    box.appendChild(nameLbl); box.appendChild(valInp); box.appendChild(modSpan);
    return box;
  }
  function makeTsRow(name,statKey,profKey){
    var row=document.createElement('div');
    row.className='sium-pg-ts-row';
    row.style.cssText='display:flex;align-items:center;gap:2px;padding:1.5px 0;border-bottom:1px solid rgba(0,0,0,0.07);cursor:pointer;';
    var bub=makeBubble(!!s[profKey],function(v){s[profKey]=v;updateSchedaDerived();ss();});
    var val=document.createElement('span'); val.id='pd-ts-'+statKey; val.style.cssText='font-size:9px;font-weight:bold;min-width:18px;text-align:right;'; val.textContent=fsv(s[statKey],s[profKey]);
    var nm=document.createElement('span'); nm.style.cssText='font-size:8px;margin-left:1px;'; nm.textContent=name;
    row.appendChild(bub); row.appendChild(val); row.appendChild(nm); return row;
  }
  function makeSkillRow(name,statKey,profKey,idSuffix,abbr){
    var maestKey=profKey+'_m';
    var row=document.createElement('div');
    row.className='sium-pg-skill-row';
    row.style.cssText='display:flex;align-items:center;gap:2px;padding:1px 0;border-bottom:1px solid rgba(0,0,0,0.06);cursor:pointer;';
    var star=document.createElement('span');
    star.textContent=s[maestKey]?'★':'☆';
    star.title='Maestria (★): raddoppia il bonus di competenza — attiva prima la competenza (●)';
    star.style.cssText='font-size:12px;cursor:pointer;flex-shrink:0;line-height:1;user-select:none;color:'+(s[maestKey]?'#c8a000':'#aaa')+';transition:color 0.15s;';
    var bub=makeBubble(!!s[profKey],function(v){
      s[profKey]=v;
      if(!v){s[maestKey]=false;star.textContent='☆';star.style.color='#aaa';}
      updateSchedaDerived();ss();
    });
    star.onmouseenter=function(){if(!s[maestKey])star.style.color=s[profKey]?'#c8a000':'#888';};
    star.onmouseleave=function(){star.style.color=s[maestKey]?'#c8a000':'#aaa';};
    star.onclick=function(){
      if(!s[profKey])return;
      s[maestKey]=!s[maestKey];
      star.textContent=s[maestKey]?'★':'☆';
      star.style.color=s[maestKey]?'#c8a000':'#aaa';
      updateSchedaDerived();ss();
    };
    var val=document.createElement('span'); val.id='pd-sk-'+idSuffix; val.style.cssText='font-size:9px;font-weight:bold;min-width:18px;text-align:right;'; val.textContent=fsvM(s[statKey],profKey,maestKey);
    var nm=document.createElement('span'); nm.style.cssText='font-size:8px;margin-left:1px;'; nm.innerHTML=name+' <em style="color:#888;font-size:7px;">('+abbr+')</em>';
    row.appendChild(star); row.appendChild(bub); row.appendChild(val); row.appendChild(nm); return row;
  }
  function makeHdrCell(label,key,isFirst){
    var cell=document.createElement('div');
    cell.className='sium-pg-hdr-cell';
    cell.style.cssText=(isFirst?'':'border-left:1px solid #aaa;')+'padding:2px 4px;';
    var inp=document.createElement('input'); inp.type='text'; inp.value=s[key]||''; inp.style.cssText='width:100%;border:none;background:transparent;color:#111;font-size:11px;outline:none;';
    (function(k){inp.oninput=function(){s[k]=this.value;ss();};})(key);
    cell.appendChild(inp); cell.appendChild(cellLbl(label)); return cell;
  }
  function makeSpellBlock(lvlLabel,spells,slotKey,isCantrip){
    var box=document.createElement('div'); box.style.cssText='border:1px solid #aaa;border-radius:2px;padding:4px;break-inside:avoid;';
    var head=document.createElement('div'); head.style.cssText='display:flex;align-items:center;gap:3px;margin-bottom:3px;border-bottom:1px solid #ddd;padding-bottom:2px;';
    var badge=document.createElement('div'); badge.style.cssText='font-size:11px;font-weight:bold;border:1.5px solid #555;border-radius:50%;width:20px;height:20px;line-height:18px;text-align:center;flex-shrink:0;'; badge.textContent=lvlLabel; head.appendChild(badge);
    if(isCantrip){
      var cl=document.createElement('span'); cl.style.cssText='font-size:7px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#444;'; cl.textContent='Trucchetti'; head.appendChild(cl);
    } else {
      var spd=state.scheda[slotKey];
      var slotLbl2=document.createElement('span'); slotLbl2.style.cssText='font-size:7px;color:#666;'; slotLbl2.textContent='Slot:'; head.appendChild(slotLbl2);
      var slotI=document.createElement('input'); slotI.type='text'; slotI.value=spd.slots||''; slotI.style.cssText='width:22px;text-align:center;font-size:9px;font-weight:bold;background:#f5f5f5;border:1px solid #bbb;border-radius:2px;color:#111;padding:1px;outline:none;';
      (function(sk){slotI.oninput=function(){state.scheda[sk].slots=this.value;ss();};})(slotKey); head.appendChild(slotI);
      var spesiLbl2=document.createElement('span'); spesiLbl2.style.cssText='font-size:7px;color:#666;'; spesiLbl2.textContent=' Spesi:'; head.appendChild(spesiLbl2);
      var spesiI=document.createElement('input'); spesiI.type='text'; spesiI.value=spd.spesi||''; spesiI.style.cssText='width:22px;text-align:center;font-size:9px;font-weight:bold;background:#f5f5f5;border:1px solid #bbb;border-radius:2px;color:#c00;padding:1px;outline:none;';
      (function(sk){spesiI.oninput=function(){state.scheda[sk].spesi=this.value;ss();};})(slotKey); head.appendChild(spesiI);
    }
    box.appendChild(head);
    spells.forEach(function(sp,i){
      var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:2px;padding:1px 0;border-bottom:1px solid rgba(0,0,0,0.05);';
      if(!isCantrip){
        var cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!sp.prep; cb.style.cssText='width:10px;height:10px;cursor:pointer;flex-shrink:0;';
        (function(idx,sk){cb.onchange=function(){state.scheda[sk].lista[idx].prep=this.checked;ss();};})(i,slotKey); row.appendChild(cb);
      }
      var ni=document.createElement('input'); ni.type='text'; ni.value=sp.nome||''; ni.style.cssText='flex:1;background:transparent;border:none;border-bottom:1px solid rgba(0,0,0,0.1);color:#111;font-size:9px;outline:none;padding:1px 0;';
      ni.onfocus=function(){this.style.borderBottomColor='#555';};
      ni.onblur=function(){this.style.borderBottomColor='rgba(0,0,0,0.1)';};
      if(isCantrip){(function(idx){ni.oninput=function(){state.scheda.trucchetti[idx]=this.value;ss();};})(i);}
      else{(function(idx,sk){ni.oninput=function(){state.scheda[sk].lista[idx].nome=this.value;ss();};})(i,slotKey);}
      row.appendChild(ni); box.appendChild(row);
    });
    return box;
  }

  /* ==================== PAGINA 1 ==================== */
  var pg1=makePage();
  /* Header */
  var isOP = (_sTipo === 'onepiece');
  var hdr1=document.createElement('div'); hdr1.style.cssText='border:1.5px solid #555;border-radius:3px;margin-bottom:8px;overflow:hidden;';
  if (isOP) {
    var hR1=document.createElement('div'); hR1.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-bottom:1px solid #aaa;';
    hR1.appendChild(makeHdrCell('Classe & Livello','classelivello',true));
    hR1.appendChild(makeHdrCell('Razza','razza',false));
    hR1.appendChild(makeHdrCell('Epiteto / Soprannome','epiteto',false));
    hR1.appendChild(makeHdrCell('Ruolo Ciurma','ruoloCiurma',false));
    var hR2=document.createElement('div'); hR2.style.cssText='display:grid;grid-template-columns:2fr 1fr 1fr 1fr;border-bottom:1px solid #aaa;';
    var nomeCell=document.createElement('div'); nomeCell.style.cssText='padding:3px 4px;';
    var nomeInp1=document.createElement('input'); nomeInp1.type='text'; nomeInp1.value=s.nomePersonaggio||''; nomeInp1.style.cssText='width:100%;border:none;background:transparent;color:#111;font-size:14px;font-weight:bold;outline:none;';
    nomeInp1.oninput=function(){s.nomePersonaggio=this.value;ss();};
    nomeCell.appendChild(nomeInp1); nomeCell.appendChild(cellLbl('Nome Personaggio')); hR2.appendChild(nomeCell);
    hR2.appendChild(makeHdrCell('Nome Ciurma','nomeCiurma',false));
    hR2.appendChild(makeHdrCell('Nome Nave','nomeNave',false));
    hR2.appendChild(makeHdrCell('Fazione / Affiliazione','allineamento',false));
    var hR3=document.createElement('div'); hR3.style.cssText='display:flex;background:#faf3e3;border-bottom:1px solid #aaa;padding:4px;gap:10px;align-items:center;';
    var wantedLbl=document.createElement('div'); wantedLbl.style.cssText='font-family:\'Cinzel\',serif;font-weight:bold;font-size:18px;letter-spacing:2px;color:#4a1010;'; wantedLbl.textContent='WANTED';
    var bountyState=document.createElement('select'); bountyState.style.cssText='background:transparent;border:1px solid #aaa;font-size:10px;font-weight:bold;padding:2px;'; 
    ['DEAD OR ALIVE', 'ONLY ALIVE'].forEach(function(o){var op=document.createElement('option');op.value=o;op.textContent=o;bountyState.appendChild(op);});
    bountyState.value=s.bountyState||'DEAD OR ALIVE'; bountyState.onchange=function(){s.bountyState=this.value;ss();};
    var bountyCur=document.createElement('input'); bountyCur.type='number'; bountyCur.placeholder='Taglia Attuale (\u0E3F)'; bountyCur.value=s.bountyCur||''; bountyCur.style.cssText='flex:1;background:transparent;border:1px dashed #aaa;text-align:right;font-weight:bold;font-size:14px;padding:2px;'; bountyCur.oninput=function(){s.bountyCur=this.value;ss();};
    var bountyPrev=document.createElement('input'); bountyPrev.type='number'; bountyPrev.placeholder='Taglia Prec. (\u0E3F)'; bountyPrev.value=s.bountyPrev||''; bountyPrev.style.cssText='flex:0.8;background:transparent;border:1px dashed #aaa;text-align:right;font-size:10px;color:#555;padding:2px;'; bountyPrev.oninput=function(){s.bountyPrev=this.value;ss();};
    hR3.appendChild(wantedLbl); hR3.appendChild(bountyState); hR3.appendChild(bountyCur); hR3.appendChild(bountyPrev);
    hdr1.appendChild(hR1); hdr1.appendChild(hR2); hdr1.appendChild(hR3);
  } else {
    var hR1=document.createElement('div'); hR1.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #aaa;';
    hR1.appendChild(makeHdrCell('Classe & Livello','classelivello',true));
    hR1.appendChild(makeHdrCell('Background','background',false));
    hR1.appendChild(makeHdrCell('Nome Giocatore','nomeGiocatore',false));
    var hR2=document.createElement('div'); hR2.style.cssText='display:grid;grid-template-columns:2.5fr 1fr 1fr 1fr;';
    var nomeCell=document.createElement('div'); nomeCell.style.cssText='padding:3px 4px;';
    var nomeInp1=document.createElement('input'); nomeInp1.type='text'; nomeInp1.value=s.nomePersonaggio||''; nomeInp1.style.cssText='width:100%;border:none;background:transparent;color:#111;font-size:14px;font-weight:bold;outline:none;';
    nomeInp1.oninput=function(){s.nomePersonaggio=this.value;ss();};
    nomeCell.appendChild(nomeInp1); nomeCell.appendChild(cellLbl('Nome Personaggio')); hR2.appendChild(nomeCell);
    hR2.appendChild(makeHdrCell('Razza','razza',false));
    hR2.appendChild(makeHdrCell('Allineamento','allineamento',false));
    hR2.appendChild(makeHdrCell('Punti Esperienza','pe',false));
    hdr1.appendChild(hR1); hdr1.appendChild(hR2);
  }
  pg1.appendChild(hdr1);
  /* Main grid */
  var mg=document.createElement('div'); mg.style.cssText='display:grid;grid-template-columns:88px 186px 1fr 1fr;gap:5px;flex:1;align-items:stretch;';
  /* COL A - Stats */
  var cA=document.createElement('div');
  [['Forza','for'],['Destrezza','des'],['Costituzione','cos'],['Intelligenza','int'],['Saggezza','sag'],['Carisma','car']].forEach(function(st){cA.appendChild(makeStatBox(st[0],st[1]));});
  mg.appendChild(cA);
  /* COL B - Saves/Skills */
  var cB=document.createElement('div'); cB.style.cssText='display:flex;flex-direction:column;';
  var ispRow1=document.createElement('div'); ispRow1.style.cssText='display:flex;gap:4px;margin-bottom:5px;';
  var ispBox1=document.createElement('div'); ispBox1.style.cssText='flex:1;border:1.5px solid #666;border-radius:3px;text-align:center;padding:3px;cursor:pointer;';
  var ispIco=document.createElement('div'); ispIco.style.cssText='font-size:14px;'; ispIco.textContent=s.ispirazione?'★':'☆';
  ispBox1.onclick=function(){s.ispirazione=!s.ispirazione;ispIco.textContent=s.ispirazione?'★':'☆';ss();};
  ispBox1.appendChild(ispIco); ispBox1.appendChild(cellLbl('Ispirazione'));
  var bcBox1=document.createElement('div'); bcBox1.style.cssText='flex:1;border:1.5px solid #666;border-radius:3px;text-align:center;padding:3px;';
  var bcInp1=document.createElement('input'); bcInp1.type='number'; bcInp1.min=2; bcInp1.max=6; bcInp1.value=parseInt(s.bonusCompetenza)||2;
  bcInp1.style.cssText='width:100%;text-align:center;font-size:18px;font-weight:bold;color:#111;background:transparent;border:none;outline:none;';
  bcInp1.oninput=function(){s.bonusCompetenza=parseInt(this.value)||2;updateSchedaDerived();ss();};
  bcBox1.appendChild(bcInp1); bcBox1.appendChild(cellLbl('Bonus di Competenza'));
  ispRow1.appendChild(ispBox1); ispRow1.appendChild(bcBox1); cB.appendChild(ispRow1);
  var tsBox1=document.createElement('div'); tsBox1.style.cssText='border:1px solid #aaa;border-radius:3px;padding:4px;margin-bottom:4px;';
  [['Forza','for','tsFor'],['Destrezza','des','tsDes'],['Costituzione','cos','tsCos'],['Intelligenza','int','tsInt'],['Saggezza','sag','tsSag'],['Carisma','car','tsCar']].forEach(function(ts){tsBox1.appendChild(makeTsRow(ts[0],ts[1],ts[2]));});
  tsBox1.appendChild(secTitle('Tiri Salvezza')); cB.appendChild(tsBox1);
  var skBox1=document.createElement('div'); skBox1.style.cssText='border:1px solid #aaa;border-radius:3px;padding:4px;margin-bottom:4px;';
  [['Acrobazia','des','skAcrobazia','acrobazia','Des'],['Addestrare Animali','sag','skAnimali','animali','Sag'],['Arcano','int','skArcano','arcano','Int'],['Atletica','for','skAtletica','atletica','For'],['Furtività','des','skFurtivita','furtivita','Des'],['Indagare','int','skIndagare','indagare','Int'],['Inganno','car','skInganno','inganno','Car'],['Intimidire','car','skIntimidire','intimidire','Car'],['Intrattenere','car','skIntrattenere','intrattenere','Car'],['Intuizione','sag','skIntuizione','intuizione','Sag'],['Medicina','sag','skMedicina','medicina','Sag'],['Natura','int','skNatura','natura','Int'],['Percezione','sag','skPercezione','percezione','Sag'],['Persuasione','car','skPersuasione','persuasione','Car'],['Rapidità di Mano','des','skRapidita','rapidita','Des'],['Religione','int','skReligione','religione','Int'],['Sopravvivenza','sag','skSopravvivenza','sopravvivenza','Sag'],['Storia','int','skStoria','storia','Int'],['Tecnologia','int','skTecnologia','tecnologia','Int']].forEach(function(sk){skBox1.appendChild(makeSkillRow(sk[0],sk[1],sk[2],sk[3],sk[4]));});
  skBox1.appendChild(secTitle('Abilità')); cB.appendChild(skBox1);
  var ppRow1=document.createElement('div'); ppRow1.style.cssText='display:flex;align-items:center;gap:4px;border:1px solid #aaa;border-radius:2px;padding:3px;margin-bottom:4px;';
  var ppVal1=document.createElement('div'); ppVal1.id='pd-pass-perc'; ppVal1.style.cssText='font-size:16px;font-weight:bold;min-width:24px;text-align:center;border:1.5px solid #555;border-radius:3px;padding:0 3px;';
  ppVal1.textContent=10+m(s.sag)+(s.skPercezione?(parseInt(s.bonusCompetenza)||2):0);
  var ppLbl1=document.createElement('div'); ppLbl1.style.cssText='font-size:7px;color:#444;line-height:1.3;'; ppLbl1.textContent='Saggezza (Percezione) Passiva';
  ppRow1.appendChild(ppVal1); ppRow1.appendChild(ppLbl1); cB.appendChild(ppRow1);
  var altBox1=document.createElement('div'); altBox1.style.cssText='border:1px solid #aaa;border-radius:2px;flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:80px;';
  var altTa1=document.createElement('textarea'); altTa1.style.cssText='width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;flex:1;height:0;box-sizing:border-box;'; altTa1.value=s.altreCompetenze||'';
  altTa1.oninput=function(){s.altreCompetenze=this.value;ss();};
  altBox1.appendChild(altTa1); altBox1.appendChild(secTitle('Altre Competenze & Linguaggi')); cB.appendChild(altBox1);
  mg.appendChild(cB);
  /* COL C - Combat */
  var cC=document.createElement('div'); cC.style.cssText='display:flex;flex-direction:column;';
  var cavRow1=document.createElement('div'); cavRow1.style.cssText='display:flex;gap:4px;margin-bottom:5px;';
  [['CA','ca'],['Iniziativa','iniziativa'],['Velocità','velocita']].forEach(function(cf){
    var b=document.createElement('div'); b.style.cssText='flex:1;border:2px solid #666;border-radius:3px;text-align:center;padding:3px;';
    var inp=document.createElement('input'); inp.type='text'; inp.value=s[cf[1]]||''; inp.style.cssText='width:100%;text-align:center;font-size:18px;font-weight:bold;color:#111;background:transparent;border:none;outline:none;';
    (function(k){inp.oninput=function(){s[k]=this.value;ss();};})(cf[1]);
    b.appendChild(inp); b.appendChild(cellLbl(cf[0])); cavRow1.appendChild(b);
  }); cC.appendChild(cavRow1);
  var hpMaxB1=document.createElement('div'); hpMaxB1.style.cssText='border:1px solid #aaa;border-radius:2px;padding:3px;margin-bottom:4px;';
  var hpMaxI1=document.createElement('input'); hpMaxI1.type='text'; hpMaxI1.value=s.hpMax||''; hpMaxI1.style.cssText='width:100%;background:transparent;border:none;border-bottom:1px solid #ccc;color:#111;font-size:12px;outline:none;padding:1px;';
  hpMaxI1.oninput=function(){s.hpMax=this.value;ss();}; hpMaxB1.appendChild(hpMaxI1); hpMaxB1.appendChild(cellLbl('Massimo dei Punti Ferita')); cC.appendChild(hpMaxB1);
  var hpCurB1=document.createElement('div'); hpCurB1.style.cssText='border:2px solid #555;border-radius:3px;padding:4px;margin-bottom:4px;text-align:center;';
  var hpCurI1=document.createElement('input'); hpCurI1.type='text'; hpCurI1.value=s.hpAttuali||''; hpCurI1.style.cssText='width:100%;text-align:center;background:transparent;border:none;color:#111;font-size:26px;font-weight:bold;outline:none;';
  hpCurI1.oninput=function(){s.hpAttuali=this.value;ss();}; hpCurB1.appendChild(hpCurI1); hpCurB1.appendChild(cellLbl('Punti Ferita Attuali')); cC.appendChild(hpCurB1);
  var hpTmpB1=document.createElement('div'); hpTmpB1.style.cssText='border:1px solid #aaa;border-radius:2px;padding:4px;margin-bottom:4px;text-align:center;';
  var hpTmpI1=document.createElement('input'); hpTmpI1.type='text'; hpTmpI1.value=s.hpTemp||''; hpTmpI1.style.cssText='width:100%;text-align:center;background:transparent;border:none;color:#111;font-size:20px;font-weight:bold;outline:none;';
  hpTmpI1.oninput=function(){s.hpTemp=this.value;ss();}; hpTmpB1.appendChild(hpTmpI1); hpTmpB1.appendChild(cellLbl('Punti Ferita Temporanei')); cC.appendChild(hpTmpB1);
  var dvTsR1=document.createElement('div'); dvTsR1.style.cssText='display:flex;gap:4px;margin-bottom:5px;';
  var dvBox1=document.createElement('div'); dvBox1.style.cssText='flex:1;border:1px solid #aaa;border-radius:2px;padding:3px;text-align:center;';
  var dvI1=document.createElement('input'); dvI1.type='text'; dvI1.placeholder='3d8'; dvI1.value=s.dadiVita||''; dvI1.style.cssText='width:100%;text-align:center;background:transparent;border:none;border-bottom:1px solid #bbb;color:#111;font-size:13px;font-weight:bold;outline:none;padding:1px;';
  dvI1.oninput=function(){s.dadiVita=this.value;ss();}; dvBox1.appendChild(dvI1); dvBox1.appendChild(cellLbl('Dadi Vita')); dvTsR1.appendChild(dvBox1);
  var tsmB1=document.createElement('div'); tsmB1.style.cssText='flex:1.3;border:1px solid #aaa;border-radius:2px;padding:3px;';
  tsmB1.innerHTML='<div style="font-size:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#555;text-align:center;margin-bottom:3px;">TS Contro Morte</div>';
  function makeDeathRow(label,arrKey,color){
    var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:3px;margin-bottom:2px;';
    var lbl=document.createElement('span'); lbl.style.cssText='font-size:8px;min-width:44px;'; lbl.textContent=label;
    var bubs=document.createElement('div'); bubs.style.cssText='display:flex;gap:3px;';
    s[arrKey].forEach(function(v,i){
      var bub=document.createElement('div'); bub.style.cssText='width:14px;height:14px;border-radius:50%;border:1.5px solid #555;cursor:pointer;background:'+(v?color:'transparent')+';';
      (function(arr,idx,c){bub.onclick=function(){s[arr][idx]=!s[arr][idx];this.style.background=s[arr][idx]?c:'transparent';ss();};})(arrKey,i,color); bubs.appendChild(bub);
    }); row.appendChild(lbl); row.appendChild(bubs); return row;
  }
  tsmB1.appendChild(makeDeathRow('Successi','successi','#555')); tsmB1.appendChild(makeDeathRow('Fallimenti','fallimenti','#c00'));
  dvTsR1.appendChild(tsmB1); cC.appendChild(dvTsR1);

  var atkB1=document.createElement('div'); atkB1.style.cssText='border:1px solid #aaa;border-radius:2px;padding:4px;margin-bottom:4px;';
  var atkT1=document.createElement('table'); atkT1.style.cssText='width:100%;border-collapse:collapse;';
  atkT1.innerHTML='<thead><tr><th style="font-size:6px;font-weight:bold;text-transform:uppercase;color:#555;padding:1px 3px;border-bottom:1px solid #bbb;text-align:left;">Nome</th><th style="font-size:6px;font-weight:bold;text-transform:uppercase;color:#555;padding:1px 3px;border-bottom:1px solid #bbb;text-align:left;">Bonus Att.</th><th style="font-size:6px;font-weight:bold;text-transform:uppercase;color:#555;padding:1px 3px;border-bottom:1px solid #bbb;text-align:left;">Danni/Tipo</th></tr></thead>';
  var atkBd1=document.createElement('tbody');
  s.attacchi.forEach(function(atk,i){
    var tr=document.createElement('tr');
    ['nome','bonus','danni'].forEach(function(fk){
      var td=document.createElement('td'); td.style.padding='1px 2px';
      var inp=document.createElement('input'); inp.type='text'; inp.value=atk[fk]||''; inp.style.cssText='width:100%;background:transparent;border:none;border-bottom:1px solid #e0e0e0;color:#111;font-size:10px;outline:none;padding:1px 0;';
      inp.onfocus=function(){this.style.borderBottomColor='#555';}; inp.onblur=function(){this.style.borderBottomColor='#e0e0e0';};
      (function(ai,fk2){inp.oninput=function(){s.attacchi[ai][fk2]=this.value;ss();};})(i,fk);
      td.appendChild(inp); tr.appendChild(td);
    }); atkBd1.appendChild(tr);
  });
  atkT1.appendChild(atkBd1); atkB1.appendChild(atkT1); atkB1.appendChild(secTitle('Attacchi & Incantesimi')); cC.appendChild(atkB1);
  /* --- LIVELLO DI FOLLIA --- */
  var folliaB1=document.createElement('div'); folliaB1.style.cssText='border:1px solid #aaa;border-radius:2px;padding:4px;margin-bottom:4px;';
  var folliaTit=document.createElement('div'); folliaTit.style.cssText='font-size:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#555;text-align:center;margin-bottom:4px;'; folliaTit.textContent='Livello di Follia';
  folliaB1.appendChild(folliaTit);
  var folliaRow=document.createElement('div'); folliaRow.style.cssText='display:flex;justify-content:center;gap:5px;margin-bottom:2px;';
  for(var fi=1;fi<=5;fi++){(function(lvl){
    var bub=document.createElement('div');
    var isAct=(s.livelloFollia||0)>=lvl;
    bub.style.cssText='width:22px;height:22px;border-radius:50%;border:1.5px solid #7a3a7a;cursor:pointer;background:'+(isAct?'#7a3a7a':'transparent')+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;color:'+(isAct?'#fff':'#7a3a7a')+';box-sizing:border-box;';
    bub.textContent=String(lvl);
    bub.onclick=function(){ s.livelloFollia=((s.livelloFollia||0)===lvl?0:lvl); renderMain(); };
    folliaRow.appendChild(bub);
  })(fi);}
  folliaB1.appendChild(folliaRow); cC.appendChild(folliaB1);
  var eqB1=document.createElement('div'); eqB1.style.cssText='border:1px solid #aaa;border-radius:2px;flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:120px;';
  /* --- MONETE --- */
  if (isOP) {
    var monWrap=document.createElement('div'); monWrap.style.cssText='flex-shrink:0;padding:3px 3px 2px;border-bottom:1px solid #ccc;';
    var monTitle=document.createElement('div'); monTitle.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.07em;color:#555;text-align:center;margin-bottom:3px;'; monTitle.textContent='Finanze';
    monWrap.appendChild(monTitle);
    var credCell=document.createElement('div'); credCell.style.cssText='border:1px solid #c9a55c;border-radius:2px;padding:2px 4px;text-align:center;background:#faf3e3;display:flex;align-items:center;gap:4px;';
    var credLbl=document.createElement('div'); credLbl.style.cssText='font-size:8px;font-weight:bold;text-transform:uppercase;color:#4a1010;letter-spacing:0.06em;white-space:nowrap;flex-shrink:0;'; credLbl.textContent='Berry (\u0E3F)';
    var credInp=document.createElement('input'); credInp.type='number'; credInp.value=s.berry||'';
    credInp.style.cssText='flex:1;text-align:center;font-size:12px;font-weight:bold;background:transparent;border:none;border-bottom:1px dashed #c9a55c;color:#111;outline:none;padding:1px 0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;';
    credInp.oninput=function(){s.berry=this.value;ss();};
    credCell.appendChild(credLbl); credCell.appendChild(credInp); monWrap.appendChild(credCell);
    eqB1.appendChild(monWrap);
  } else {
    var monWrap=document.createElement('div'); monWrap.style.cssText='flex-shrink:0;padding:3px 3px 2px;border-bottom:1px solid #ccc;';
    var monTitle=document.createElement('div'); monTitle.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.07em;color:#555;text-align:center;margin-bottom:3px;'; monTitle.textContent='Monete';
    monWrap.appendChild(monTitle);
    var monGrid=document.createElement('div'); monGrid.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-bottom:2px;';
    [['Rame','rame','#b87333'],['Argento','argento','#888'],['Oro','oro','#b8860b'],['Platino','platino','#7090a0']].forEach(function(m){
      var cell=document.createElement('div'); cell.style.cssText='border:1px solid #ccc;border-radius:2px;padding:2px 1px;text-align:center;background:#fafafa;';
      var lbl=document.createElement('div'); lbl.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;color:'+m[2]+';letter-spacing:0.05em;margin-bottom:1px;'; lbl.textContent=m[0]; cell.appendChild(lbl);
      var inp=document.createElement('input'); inp.type='text'; inp.value=s[m[1]]||''; inp.maxLength=15;
      inp.style.cssText='width:100%;text-align:center;font-size:7.5px;font-weight:bold;background:transparent;border:none;border-bottom:1px solid #ddd;color:#111;outline:none;padding:1px 0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;';
      (function(k){inp.oninput=function(){s[k]=this.value;ss();};})(m[1]);
      cell.appendChild(inp); monGrid.appendChild(cell);
    });
    monWrap.appendChild(monGrid);
    /* Crediti \u2014 riga intera */
    var credCell=document.createElement('div'); credCell.style.cssText='border:1px solid #ccc;border-radius:2px;padding:2px 4px;text-align:center;background:#f0f8ff;display:flex;align-items:center;gap:4px;';
    var credLbl=document.createElement('div'); credLbl.style.cssText='font-size:5.5px;font-weight:bold;text-transform:uppercase;color:#1a6a9a;letter-spacing:0.06em;white-space:nowrap;flex-shrink:0;'; credLbl.textContent='Crediti';
    var credInp=document.createElement('input'); credInp.type='text'; credInp.value=s.crediti||''; credInp.maxLength=18;
    credInp.style.cssText='flex:1;text-align:center;font-size:8px;font-weight:bold;background:transparent;border:none;border-bottom:1px solid #9bc;color:#111;outline:none;padding:1px 0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;';
    credInp.oninput=function(){s.crediti=this.value;ss();};
    credCell.appendChild(credLbl); credCell.appendChild(credInp); monWrap.appendChild(credCell);
    eqB1.appendChild(monWrap);
  }
  /* --- EQUIPAGGIAMENTO --- */
  var eqTa1=document.createElement('textarea'); eqTa1.style.cssText='width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;flex:1;height:0;box-sizing:border-box;'; eqTa1.value=s.equipaggiamento||'';
  eqTa1.oninput=function(){s.equipaggiamento=this.value;ss();}; eqB1.appendChild(eqTa1); eqB1.appendChild(secTitle('Equipaggiamento')); cC.appendChild(eqB1);
  mg.appendChild(cC);
  /* COL D - Traits */
  var cD=document.createElement('div'); cD.style.cssText='display:flex;flex-direction:column;';
  [['Tratti Caratteriali','trattiCar',42],['Ideali','ideali',36],['Legami','legami',36],['Difetti','difetti',36]].forEach(function(tf){cD.appendChild(makeTraitBox(tf[0],tf[1],tf[2]));});
  cD.appendChild(makeTraitBox('Privilegi & Tratti','privilegi',120,true));
  mg.appendChild(cD);
  pg1.appendChild(mg); pgWrap.appendChild(pg1);

  /* ==================== PAGINA 2 ==================== */
  var pg2=makePage();
  var hdr2=document.createElement('div'); hdr2.style.cssText='border:1.5px solid #555;border-radius:3px;margin-bottom:8px;overflow:hidden;';
  var h2R1=document.createElement('div'); h2R1.style.cssText='display:grid;grid-template-columns:2.5fr 1fr 1fr 1fr;border-bottom:1px solid #aaa;';
  var h2N=document.createElement('div'); h2N.style.cssText='padding:3px 4px;';
  var h2NI=document.createElement('input'); h2NI.type='text'; h2NI.value=s.nomePersonaggio||''; h2NI.style.cssText='width:100%;border:none;background:transparent;color:#111;font-size:14px;font-weight:bold;outline:none;';
  h2NI.oninput=function(){s.nomePersonaggio=this.value;ss();}; h2N.appendChild(h2NI); h2N.appendChild(cellLbl('Nome Personaggio')); h2R1.appendChild(h2N);
  h2R1.appendChild(makeHdrCell('Età','eta',false)); h2R1.appendChild(makeHdrCell('Altezza','altezza',false)); h2R1.appendChild(makeHdrCell('Peso','peso',false));
  var h2R2=document.createElement('div'); h2R2.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;';
  h2R2.appendChild(makeHdrCell('Occhi','occhi',true)); h2R2.appendChild(makeHdrCell('Carnagione','carnagione',false)); h2R2.appendChild(makeHdrCell('Capelli','capelli',false));
  hdr2.appendChild(h2R1); hdr2.appendChild(h2R2); pg2.appendChild(hdr2);
  var bg2G=document.createElement('div'); bg2G.style.cssText='display:grid;grid-template-columns:220px 1fr;gap:8px;flex:1;align-items:stretch;';
  var bg2L=document.createElement('div'); bg2L.style.cssText='display:flex;flex-direction:column;gap:6px;height:100%;overflow:hidden;';
  /* immagine personaggio — altezza fissa in alto */
  var aspImgB=document.createElement('div'); aspImgB.style.cssText='border:1px solid #aaa;border-radius:3px;overflow:hidden;cursor:pointer;position:relative;background:#f5f5f5;display:flex;align-items:center;justify-content:center;height:280px;flex-shrink:0;';
  if(s.aspettoImg){
    var aspI2=document.createElement('img'); aspI2.src=s.aspettoImg; aspI2.style.cssText='width:100%;height:100%;object-fit:cover;'; aspImgB.appendChild(aspI2);
    var aspDel=document.createElement('div'); aspDel.style.cssText='position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.65);color:#fff;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:11px;'; aspDel.textContent='✕';
    aspDel.onclick=function(e){e.stopPropagation();s.aspettoImg='';ss();renderMain();}; aspImgB.appendChild(aspDel);
  } else {
    aspImgB.innerHTML='<div style="text-align:center;color:#aaa;font-family:Arial,sans-serif;"><div style="font-size:36px;">🧙</div><div style="font-size:10px;margin-top:6px;">Clicca per caricare<br>immagine personaggio</div></div>';
  }
  aspImgB.onclick=function(e){
    if(e.target.textContent==='✕') return;
    var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
    inp.onchange=function(){
      if(!this.files[0]) return;
      var r=new FileReader();
      r.onload=function(ev){
        var im=new Image(); im.onload=function(){
          var MAX=700; var ratio=Math.min(1,MAX/Math.max(im.width,im.height));
          var cv=document.createElement('canvas'); cv.width=Math.round(im.width*ratio); cv.height=Math.round(im.height*ratio);
          cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
          s.aspettoImg=cv.toDataURL('image/jpeg',0.72); ss(); renderMain();
        }; im.src=ev.target.result;
      }; r.readAsDataURL(this.files[0]);
    };
    inp.click();
  }; bg2L.appendChild(aspImgB);
  /* descrizione aspetto — riempie lo spazio rimanente */
  var aspDB=document.createElement('div'); aspDB.style.cssText='border:1px solid #aaa;border-radius:2px;flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:120px;';
  var aspTa=document.createElement('textarea'); aspTa.style.cssText='width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;flex:1;box-sizing:border-box;'; aspTa.value=s.aspettoDesc||'';
  aspTa.oninput=function(){s.aspettoDesc=this.value;ss();}; aspDB.appendChild(aspTa); aspDB.appendChild(secTitle('Aspetto del Personaggio')); bg2L.appendChild(aspDB);
  bg2G.appendChild(bg2L);
  var bg2R=document.createElement('div'); bg2R.style.cssText='display:flex;flex-direction:column;gap:6px;';
  var alleB2=document.createElement('div'); alleB2.style.cssText='border:1px solid #aaa;border-radius:2px;flex-shrink:0;';
  var orgR2=document.createElement('div'); orgR2.style.cssText='display:flex;align-items:center;gap:4px;padding:3px;border-bottom:1px solid #ddd;';
  var orgL2=document.createElement('span'); orgL2.style.cssText='font-size:7px;color:#555;white-space:nowrap;'; orgL2.textContent='Nome organizzazione:';
  var orgI2=document.createElement('input'); orgI2.type='text'; orgI2.value=s.nomeOrg||''; orgI2.style.cssText='flex:1;background:transparent;border:none;border-bottom:1px solid #bbb;color:#111;font-size:11px;outline:none;';
  orgI2.oninput=function(){s.nomeOrg=this.value;ss();}; orgR2.appendChild(orgL2); orgR2.appendChild(orgI2); alleB2.appendChild(orgR2);
  var alleTa2=document.createElement('textarea'); alleTa2.style.cssText='width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;min-height:70px;'; alleTa2.value=s.alleatiOrg||'';
  alleTa2.oninput=function(){s.alleatiOrg=this.value;ss();}; alleB2.appendChild(alleTa2); alleB2.appendChild(secTitle('Alleati & Organizzazioni')); bg2R.appendChild(alleB2);
  [['Storia del Personaggio','storia',160,false],['Tratti & Privilegi Aggiuntivi','trattiAgg',120,false],['Tesoro','tesoro',80,true]].forEach(function(tf){
    var grow=tf[3];
    var box=document.createElement('div'); box.style.cssText='border:1px solid #aaa;border-radius:2px;'+(grow?'flex:1;display:flex;flex-direction:column;overflow:hidden;':'');
    var ta=document.createElement('textarea'); ta.style.cssText='width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;'+(grow?'flex:1;min-height:'+tf[2]+'px;':'height:'+tf[2]+'px;'); ta.value=s[tf[1]]||'';
    (function(k){ta.oninput=function(){s[k]=this.value;ss();};})(tf[1]);
    box.appendChild(ta); box.appendChild(secTitle(tf[0])); bg2R.appendChild(box);
  });
  bg2G.appendChild(bg2R); pg2.appendChild(bg2G); pgWrap.appendChild(pg2);

  /* ==================== PAGINA 3 ==================== */
  var pg3=makePage(); pg3.style.minHeight='1100px';
  if (isOP) {
    /* HEADER PAGE 3 - ONE PIECE */
    var hdr3=document.createElement('div'); hdr3.style.cssText='border:1.5px solid #555;border-radius:3px;margin-bottom:8px;overflow:hidden;background:#faf3e3;text-align:center;padding:5px;';
    var hdrTitle=document.createElement('h2'); hdrTitle.style.cssText='margin:0;font-family:\'Cinzel\',serif;font-size:16px;color:#4a1010;letter-spacing:1px;'; hdrTitle.textContent='ABILITÀ SPECIALI & POTERI';
    hdr3.appendChild(hdrTitle); pg3.appendChild(hdr3);
    
    var opFull=document.createElement('div'); opFull.style.cssText='display:flex;flex-direction:column;gap:12px;';
    
    /* SEZIONE 1: DEVIL FRUIT */
    var dfBox=document.createElement('div'); dfBox.style.cssText='border:1.5px solid #aaa;border-radius:3px;padding:8px;background:#fff;';
    var dfTop=document.createElement('div'); dfTop.style.cssText='display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #555;padding-bottom:4px;margin-bottom:8px;';
    var dfTitle=document.createElement('div'); dfTitle.style.cssText='font-size:12px;font-weight:bold;color:#111;text-transform:uppercase;'; dfTitle.textContent='Frutto del Diavolo';
    var dfToggleLbl=document.createElement('label'); dfToggleLbl.style.cssText='font-size:10px;font-weight:bold;display:flex;align-items:center;gap:4px;cursor:pointer;';
    var dfToggle=document.createElement('input'); dfToggle.type='checkbox'; dfToggle.checked=!!s.hasDF; dfToggle.onchange=function(){s.hasDF=this.checked;ss();renderMain();};
    dfToggleLbl.appendChild(dfToggle); dfToggleLbl.appendChild(document.createTextNode('Possiede un Frutto?'));
    dfTop.appendChild(dfTitle); dfTop.appendChild(dfToggleLbl); dfBox.appendChild(dfTop);
    
    if (s.hasDF) {
      // Row 1: Name, Type, Mastery
      var dfRow1=document.createElement('div'); dfRow1.style.cssText='display:grid;grid-template-columns:2fr 2fr 1fr;gap:6px;margin-bottom:6px;';
      var dfNameB=document.createElement('div'); dfNameB.style.cssText='border:1px solid #ccc;padding:2px 4px;';
      var dfNameI=document.createElement('input'); dfNameI.type='text'; dfNameI.value=s.dfName||''; dfNameI.style.cssText='width:100%;border:none;outline:none;font-size:11px;background:transparent;font-weight:bold;'; dfNameI.oninput=function(){s.dfName=this.value;ss();};
      dfNameB.appendChild(dfNameI); dfNameB.appendChild(cellLbl('Nome del Frutto')); dfRow1.appendChild(dfNameB);
      
      var dfTypeB=document.createElement('div'); dfTypeB.style.cssText='border:1px solid #ccc;padding:2px 4px;';
      var dfTypeS=document.createElement('select'); dfTypeS.style.cssText='width:100%;border:none;outline:none;font-size:11px;background:transparent;font-weight:bold;';
      ['','Paramisha','Rogia','Zoan Comune','Zoan Mitologico','Zoan Antico'].forEach(function(o){var op=document.createElement('option');op.value=o;op.textContent=o;dfTypeS.appendChild(op);});
      dfTypeS.value=s.dfType||''; dfTypeS.onchange=function(){s.dfType=this.value;ss();renderMain();};
      dfTypeB.appendChild(dfTypeS); dfTypeB.appendChild(cellLbl('Tipo di Frutto')); dfRow1.appendChild(dfTypeB);
      
      var dfMastB=document.createElement('div'); dfMastB.style.cssText='border:1px solid #ccc;padding:2px 4px;';
      var dfMastI=document.createElement('input'); dfMastI.type='text'; dfMastI.value=s.dfMastery||''; dfMastI.style.cssText='width:100%;border:none;outline:none;font-size:11px;text-align:center;font-weight:bold;background:transparent;'; dfMastI.oninput=function(){s.dfMastery=this.value;ss();};
      dfMastB.appendChild(dfMastI); dfMastB.appendChild(cellLbl('Livello Maestria')); dfRow1.appendChild(dfMastB);
      dfBox.appendChild(dfRow1);

      // Row 2: CD & Attack Bonus
      var dfRow2=document.createElement('div'); dfRow2.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;';
      var dfCdB=document.createElement('div'); dfCdB.style.cssText='border:1px solid #ccc;padding:4px;background:#f9f9f9;';
      var dfCdI=document.createElement('input'); dfCdI.type='text'; dfCdI.value=s.dfDC||''; dfCdI.style.cssText='width:100%;border:none;outline:none;font-size:14px;text-align:center;font-weight:bold;background:transparent;'; dfCdI.oninput=function(){s.dfDC=this.value;ss();};
      dfCdB.appendChild(dfCdI); dfCdB.appendChild(cellLbl('CD Salvezza Frutto')); dfRow2.appendChild(dfCdB);
      
      var dfAtkB=document.createElement('div'); dfAtkB.style.cssText='border:1px solid #ccc;padding:4px;background:#f9f9f9;';
      var dfAtkI=document.createElement('input'); dfAtkI.type='text'; dfAtkI.value=s.dfAtkBonus||''; dfAtkI.style.cssText='width:100%;border:none;outline:none;font-size:14px;text-align:center;font-weight:bold;background:transparent;'; dfAtkI.oninput=function(){s.dfAtkBonus=this.value;ss();};
      dfAtkB.appendChild(dfAtkI); dfAtkB.appendChild(cellLbl('Bonus Attacco Frutto')); dfRow2.appendChild(dfAtkB);
      dfBox.appendChild(dfRow2);
      
      if(s.dfType && s.dfType.includes('Zoan')) {
        var dfZoanB=document.createElement('div'); dfZoanB.style.cssText='border:1px solid #ccc;padding:4px;margin-bottom:6px;';
        var dfZoanI=document.createElement('textarea'); dfZoanI.style.cssText='width:100%;min-height:50px;border:none;outline:none;font-size:10px;background:transparent;resize:vertical;'; dfZoanI.value=s.dfZoan||''; dfZoanI.oninput=function(){s.dfZoan=this.value;ss();};
        dfZoanB.appendChild(dfZoanI); dfZoanB.appendChild(cellLbl('Forma Animale & Forma Ibrida (Tratti, CA extra, Taglia)')); dfBox.appendChild(dfZoanB);
      }
      
      var dfAwB=document.createElement('div'); dfAwB.style.cssText='border:1px solid #ccc;padding:6px;margin-bottom:6px;background:#fdf9f9;';
      var dfAwT=document.createElement('label'); dfAwT.style.cssText='display:flex;align-items:center;gap:4px;cursor:pointer;margin-bottom:4px;';
      var dfAwChk=document.createElement('input'); dfAwChk.type='checkbox'; dfAwChk.checked=!!s.dfAwakened; dfAwChk.onchange=function(){s.dfAwakened=this.checked;ss();renderMain();};
      var dfAwL=document.createElement('span'); dfAwL.style.cssText='font-size:11px;font-weight:bold;color:#833;text-transform:uppercase;'; dfAwL.textContent='Risveglio (Awakening)';
      dfAwT.appendChild(dfAwChk); dfAwT.appendChild(dfAwL); dfAwB.appendChild(dfAwT);
      if(s.dfAwakened) {
        var dfAwI=document.createElement('textarea'); dfAwI.style.cssText='width:100%;min-height:60px;border:1px solid #eee;outline:none;font-size:10px;background:#fff;resize:vertical;padding:4px;box-sizing:border-box;'; dfAwI.placeholder='Descrizione & Meccaniche del Risveglio...'; dfAwI.value=s.dfAwDesc||''; dfAwI.oninput=function(){s.dfAwDesc=this.value;ss();};
        dfAwB.appendChild(dfAwI);
      }
      dfBox.appendChild(dfAwB);
      
      var dfWk=document.createElement('div'); dfWk.style.cssText='font-size:9px;color:#a33;font-weight:bold;margin-bottom:10px;text-align:center;background:#fff0f0;padding:4px;border:1px dashed #a33;'; dfWk.textContent='DEBOLEZZE: Acqua Marina, Agalmatolite (Indebolimento e blocco poteri)';
      dfBox.appendChild(dfWk);
      
      // Dynamic Techniques Repeater
      var dfTech=document.createElement('div'); dfTech.style.cssText='border-top:2px solid #aaa;padding-top:8px;';
      var dfTechH=document.createElement('div'); dfTechH.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
      var dfTechTitle=document.createElement('div'); dfTechTitle.style.cssText='font-size:11px;font-weight:bold;text-transform:uppercase;color:#111;'; dfTechTitle.textContent='Tecniche del Frutto';
      var dfTechBtn=document.createElement('button'); dfTechBtn.textContent='+ Nuova Tecnica'; dfTechBtn.style.cssText='font-size:9px;padding:2px 6px;cursor:pointer;background:#444;color:#fff;border:none;border-radius:2px;';
      dfTechBtn.onclick=function(){
        if(!s.opTechs) s.opTechs=[];
        s.opTechs.push({name:'',cost:'',action:'',dmg:'',desc:''});
        ss(); renderMain();
      };
      dfTechH.appendChild(dfTechTitle); dfTechH.appendChild(dfTechBtn); dfTech.appendChild(dfTechH);
      
      var techsList=document.createElement('div'); techsList.style.cssText='display:flex;flex-direction:column;gap:6px;';
      if(s.opTechs && s.opTechs.length>0){
        s.opTechs.forEach(function(t, i){
          var tCard=document.createElement('div'); tCard.style.cssText='border:1px solid #ccc;border-left:3px solid #666;background:#fdfdfd;padding:6px;position:relative;';
          var tDel=document.createElement('div'); tDel.textContent='✕'; tDel.style.cssText='position:absolute;top:4px;right:4px;color:#999;cursor:pointer;font-size:10px;font-weight:bold;';
          tDel.onclick=function(){ s.opTechs.splice(i,1); ss(); renderMain(); };
          tCard.appendChild(tDel);
          
          var tr1=document.createElement('div'); tr1.style.cssText='display:grid;grid-template-columns:3fr 1fr 2fr;gap:4px;margin-bottom:4px;padding-right:16px;';
          var ciN=document.createElement('input'); ciN.type='text'; ciN.placeholder='Nome Tecnica'; ciN.value=t.name||''; ciN.style.cssText='border:none;border-bottom:1px solid #bbb;outline:none;font-size:11px;font-weight:bold;background:transparent;width:100%;'; ciN.oninput=function(){s.opTechs[i].name=this.value;ss();}; tr1.appendChild(ciN);
          var ciC=document.createElement('input'); ciC.type='text'; ciC.placeholder='Costo Stamina'; ciC.value=t.cost||''; ciC.style.cssText='border:none;border-bottom:1px solid #bbb;outline:none;font-size:10px;background:transparent;width:100%;text-align:center;'; ciC.oninput=function(){s.opTechs[i].cost=this.value;ss();}; tr1.appendChild(ciC);
          var ciA=document.createElement('input'); ciA.type='text'; ciA.placeholder='Azione / Bonus / Reazione'; ciA.value=t.action||''; ciA.style.cssText='border:none;border-bottom:1px solid #bbb;outline:none;font-size:10px;background:transparent;width:100%;'; ciA.oninput=function(){s.opTechs[i].action=this.value;ss();}; tr1.appendChild(ciA);
          tCard.appendChild(tr1);
          
          var ciD=document.createElement('input'); ciD.type='text'; ciD.placeholder='Danno / Effetto e Gittata'; ciD.value=t.dmg||''; ciD.style.cssText='border:none;border-bottom:1px solid #bbb;outline:none;font-size:10px;background:transparent;width:100%;margin-bottom:4px;box-sizing:border-box;'; ciD.oninput=function(){s.opTechs[i].dmg=this.value;ss();}; tCard.appendChild(ciD);
          
          var ciDesc=document.createElement('textarea'); ciDesc.placeholder='Descrizione / Tiro Salvezza...'; ciDesc.style.cssText='border:1px solid #eee;outline:none;font-size:9px;background:#fff;width:100%;min-height:35px;resize:vertical;box-sizing:border-box;padding:3px;'; ciDesc.value=t.desc||''; ciDesc.oninput=function(){s.opTechs[i].desc=this.value;ss();}; tCard.appendChild(ciDesc);
          
          techsList.appendChild(tCard);
        });
      } else {
        var noT=document.createElement('div'); noT.style.cssText='font-size:9px;color:#888;font-style:italic;text-align:center;padding:10px;'; noT.textContent='Nessuna tecnica aggiunta.'; techsList.appendChild(noT);
      }
      dfTech.appendChild(techsList); dfBox.appendChild(dfTech);
    }
    opFull.appendChild(dfBox);
    
    /* SEZIONE 2: HAKI */
    if (!s.haki) {
        s.haki = {
            pool: s.hakiPool || 0,
            kenbunshoku: { unlocked: !!s.hakiKen, stage: s.hakiKenLvl || "Base", dc: 13, damageBonus: "+0", techniques: [] },
            busoshoku: { unlocked: !!s.hakiBus, stage: s.hakiBusLvl || "Base", bypassesLogia: !!s.hakiBusRog, dc: 13, damageBonus: "+0", techniques: [] },
            haoshoku: { unlocked: !!s.hakiHao, stage: "Base", dc: s.hakiHaoCD || 13, damageBonus: "+0", techniques: [] }
        };
        if (s.hakiKenDesc) s.haki.kenbunshoku.techniques.push({ id: 1, name: "Uso Generico", cost: "", dc: "", damage: "", desc: s.hakiKenDesc });
        if (s.hakiBusDesc) s.haki.busoshoku.techniques.push({ id: 1, name: "Uso Generico", cost: "", dc: "", damage: "", desc: s.hakiBusDesc });
        if (s.hakiHaoDesc) s.haki.haoshoku.techniques.push({ id: 1, name: "Uso Generico", cost: "", dc: s.hakiHaoCD||'', damage: "", desc: s.hakiHaoDesc });
    } else {
        // Migration of older active properties to unlocked, and missing properties
        if (s.haki.kenbunshoku.active !== undefined) { s.haki.kenbunshoku.unlocked = s.haki.kenbunshoku.active; delete s.haki.kenbunshoku.active; }
        if (s.haki.busoshoku.active !== undefined) { s.haki.busoshoku.unlocked = s.haki.busoshoku.active; delete s.haki.busoshoku.active; }
        if (s.haki.haoshoku.active !== undefined) { s.haki.haoshoku.unlocked = s.haki.haoshoku.active; delete s.haki.haoshoku.active; }
        
        if (typeof s.haki.kenbunshoku.damageBonus === 'undefined') s.haki.kenbunshoku.damageBonus = "+0";
        if (typeof s.haki.busoshoku.damageBonus === 'undefined') s.haki.busoshoku.damageBonus = "+0";
        if (typeof s.haki.haoshoku.damageBonus === 'undefined') s.haki.haoshoku.damageBonus = "+0";
        if (typeof s.haki.haoshoku.stage === 'undefined') s.haki.haoshoku.stage = "Base";
    }

    var hkBox=document.createElement('div'); hkBox.style.cssText='border:1.5px solid #aaa;border-radius:3px;padding:8px;background:#fff;';
    var hkTop=document.createElement('div'); hkTop.style.cssText='display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:8px;';
    var hkTitle=document.createElement('div'); hkTitle.style.cssText='font-size:12px;font-weight:bold;color:#111;text-transform:uppercase;'; hkTitle.textContent='Ambizione (Haki)';
    var hkPoolB=document.createElement('div'); hkPoolB.style.cssText='display:flex;align-items:center;gap:6px;background:#f0f0f0;padding:2px 6px;border:1px solid #ccc;border-radius:2px;';
    var hkPoolL=document.createElement('div'); hkPoolL.style.cssText='font-size:10px;font-weight:bold;'; hkPoolL.textContent='Pool Dadi/Punti Haki:';
    var hkPoolI=document.createElement('input'); hkPoolI.type='text'; hkPoolI.value=s.haki.pool||''; hkPoolI.style.cssText='width:50px;border:none;border-bottom:1px solid #aaa;background:transparent;text-align:center;font-size:12px;font-weight:bold;'; hkPoolI.oninput=function(){s.haki.pool=this.value;ss();};
    hkPoolB.appendChild(hkPoolL); hkPoolB.appendChild(hkPoolI);
    hkTop.appendChild(hkTitle); hkTop.appendChild(hkPoolB); hkBox.appendChild(hkTop);
    
    var hkGrid=document.createElement('div'); hkGrid.style.cssText='display:flex;flex-direction:column;gap:8px;';

    function renderHakiTechs(branchObj, parentEl) {
        var tl = document.createElement('div'); tl.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:6px;';
        if (branchObj.techniques && branchObj.techniques.length) {
            branchObj.techniques.forEach(function(t, idx) {
                var tc = document.createElement('div'); tc.style.cssText = 'border:1px solid #ddd;padding:4px;background:#fff;position:relative;';
                var r1 = document.createElement('div'); r1.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;flex-wrap:wrap;';
                
                var inName = document.createElement('input'); inName.type='text'; inName.placeholder='Nome Tecnica'; inName.value=t.name||''; inName.style.cssText='min-width:100px;flex:1;font-size:10px;font-weight:bold;border:none;border-bottom:1px solid #bbb;outline:none;background:transparent;'; inName.oninput=function(){t.name=this.value;ss();}; r1.appendChild(inName);
                var inCost = document.createElement('input'); inCost.type='text'; inCost.placeholder='Costo'; inCost.value=t.cost||''; inCost.style.cssText='width:40px;font-size:10px;text-align:center;border:none;border-bottom:1px solid #bbb;outline:none;background:transparent;'; inCost.oninput=function(){t.cost=this.value;ss();}; r1.appendChild(inCost);
                var inDc = document.createElement('input'); inDc.type='text'; inDc.placeholder='CD'; inDc.value=t.dc||''; inDc.style.cssText='width:30px;font-size:10px;text-align:center;border:none;border-bottom:1px solid #bbb;outline:none;background:transparent;'; inDc.oninput=function(){t.dc=this.value;ss();}; r1.appendChild(inDc);
                var inDmg = document.createElement('input'); inDmg.type='text'; inDmg.placeholder='Danno'; inDmg.value=t.damage||''; inDmg.style.cssText='width:60px;font-size:10px;text-align:center;border:none;border-bottom:1px solid #bbb;outline:none;background:transparent;'; inDmg.oninput=function(){t.damage=this.value;ss();}; r1.appendChild(inDmg);
                
                var del = document.createElement('button'); del.type='button'; del.textContent='✖'; del.style.cssText='background:transparent;border:none;color:#933;cursor:pointer;font-size:10px;padding:0 4px;';
                del.onclick = function(e){ e.preventDefault(); branchObj.techniques.splice(idx, 1); ss(); renderMain(); };
                r1.appendChild(del);
                tc.appendChild(r1);
                
                var ta = document.createElement('textarea'); ta.placeholder='Descrizione Effetto...'; ta.value=t.desc||''; ta.style.cssText='width:100%;font-size:9px;min-height:30px;border:1px solid #eee;resize:vertical;padding:3px;box-sizing:border-box;outline:none;'; ta.oninput=function(){t.desc=this.value;ss();}; tc.appendChild(ta);
                tl.appendChild(tc);
            });
        }
        var addB = document.createElement('button'); addB.type='button'; addB.textContent='+ Aggiungi Tecnica'; addB.style.cssText='align-self:flex-start;font-size:9px;padding:2px 6px;cursor:pointer;background:#f0f0f0;border:1px solid #ccc;color:#333;border-radius:2px;';
        addB.onclick = function(e){ 
            e.preventDefault();
            if(!branchObj.techniques) branchObj.techniques=[];
            branchObj.techniques.push({id:Date.now(), name:'', cost:'', dc:'', damage:'', desc:''});
            ss(); renderMain();
        };
        tl.appendChild(addB);
        parentEl.appendChild(tl);
    }

    function createBranchBaseInputs(branchObj, parentEl, hasLogia) {
      var r2 = document.createElement('div'); r2.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:2px;flex-wrap:wrap;';
      var sel = document.createElement('select'); sel.style.cssText='font-size:9px;padding:2px;border:1px solid #bbb;flex:1;background:#fff;';
      ['Base','Avanzato','Risvegliato / Maestro'].forEach(function(o){var op=document.createElement('option');op.value=o;op.textContent=o;sel.appendChild(op);});
      sel.value=branchObj.stage; sel.onchange=function(){branchObj.stage=this.value;ss();}; r2.appendChild(sel);
      
      var dcL = document.createElement('span'); dcL.textContent='CD:'; dcL.style.cssText='font-size:9px;font-weight:bold;'; r2.appendChild(dcL);
      var dcI = document.createElement('input'); dcI.type='text'; dcI.value=branchObj.dc||''; dcI.style.cssText='width:30px;font-size:9px;text-align:center;border:1px solid #bbb;background:#fff;'; dcI.oninput=function(){branchObj.dc=this.value;ss();}; r2.appendChild(dcI);
      
      var dmgL = document.createElement('span'); dmgL.textContent='Danni:'; dmgL.style.cssText='font-size:9px;font-weight:bold;'; r2.appendChild(dmgL);
      var dmgI = document.createElement('input'); dmgI.type='text'; dmgI.value=branchObj.damageBonus||''; dmgI.style.cssText='width:40px;font-size:9px;text-align:center;border:1px solid #bbb;background:#fff;'; dmgI.oninput=function(){branchObj.damageBonus=this.value;ss();}; r2.appendChild(dmgI);
      parentEl.appendChild(r2);
      
      if(hasLogia){
        var busRog=document.createElement('label'); busRog.style.cssText='display:flex;align-items:center;gap:4px;font-size:9px;cursor:pointer;color:#833;margin-top:2px;';
        var busRogC=document.createElement('input'); busRogC.type='checkbox'; busRogC.checked=!!branchObj.bypassesLogia; busRogC.onchange=function(){branchObj.bypassesLogia=this.checked;ss();};
        busRog.appendChild(busRogC); busRog.appendChild(document.createTextNode('Colpisce la sostanza dei Rogia')); parentEl.appendChild(busRog);
      }
    }

    // Kenbunshoku
    var hkKen=document.createElement('div'); hkKen.style.cssText='border:1px solid #ccc;padding:6px;display:flex;flex-direction:column;gap:4px;background:#fafafa;';
    var hkKenT=document.createElement('label'); hkKenT.style.cssText='display:flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;cursor:pointer;border-bottom:1px solid #ddd;padding-bottom:2px;';
    var hkKenC=document.createElement('input'); hkKenC.type='checkbox'; hkKenC.checked=!!s.haki.kenbunshoku.unlocked; hkKenC.onchange=function(){s.haki.kenbunshoku.unlocked=this.checked;ss();renderMain();};
    hkKenT.appendChild(hkKenC); hkKenT.appendChild(document.createTextNode('Kenbunshoku (Osservazione)')); hkKen.appendChild(hkKenT);
    if(s.haki.kenbunshoku.unlocked){
      createBranchBaseInputs(s.haki.kenbunshoku, hkKen, false);
      renderHakiTechs(s.haki.kenbunshoku, hkKen);
    }
    hkGrid.appendChild(hkKen);
    
    // Busoshoku
    var hkBus=document.createElement('div'); hkBus.style.cssText='border:1px solid #ccc;padding:6px;display:flex;flex-direction:column;gap:4px;background:#fafafa;';
    var hkBusT=document.createElement('label'); hkBusT.style.cssText='display:flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;cursor:pointer;border-bottom:1px solid #ddd;padding-bottom:2px;';
    var hkBusC=document.createElement('input'); hkBusC.type='checkbox'; hkBusC.checked=!!s.haki.busoshoku.unlocked; hkBusC.onchange=function(){s.haki.busoshoku.unlocked=this.checked;ss();renderMain();};
    hkBusT.appendChild(hkBusC); hkBusT.appendChild(document.createTextNode('Busoshoku (Armamento)')); hkBus.appendChild(hkBusT);
    if(s.haki.busoshoku.unlocked){
      createBranchBaseInputs(s.haki.busoshoku, hkBus, true);
      renderHakiTechs(s.haki.busoshoku, hkBus);
    }
    hkGrid.appendChild(hkBus);
    
    // Haoshoku
    var hkHao=document.createElement('div'); hkHao.style.cssText='border:1px solid #ccc;padding:6px;display:flex;flex-direction:column;gap:4px;background:#fafafa;';
    var hkHaoT=document.createElement('label'); hkHaoT.style.cssText='display:flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;cursor:pointer;border-bottom:1px solid #ddd;padding-bottom:2px;';
    var hkHaoC=document.createElement('input'); hkHaoC.type='checkbox'; hkHaoC.checked=!!s.haki.haoshoku.unlocked; hkHaoC.onchange=function(){s.haki.haoshoku.unlocked=this.checked;ss();renderMain();};
    hkHaoT.appendChild(hkHaoC); hkHaoT.appendChild(document.createTextNode('Haoshoku (Re Conquistatore)')); hkHao.appendChild(hkHaoT);
    if(s.haki.haoshoku.unlocked){
      createBranchBaseInputs(s.haki.haoshoku, hkHao, false);
      renderHakiTechs(s.haki.haoshoku, hkHao);
    }
    hkGrid.appendChild(hkHao);
    
    hkBox.appendChild(hkGrid);
    opFull.appendChild(hkBox);
    
    /* SEZIONE 3: TRATTI RAZZIALI E LOG POSE */
    var trBox=document.createElement('div'); trBox.style.cssText='border:1.5px solid #aaa;border-radius:3px;padding:8px;background:#fff;';
    var trTop=document.createElement('div'); trTop.style.cssText='border-bottom:2px solid #111;margin-bottom:6px;padding-bottom:2px;';
    var trTitle=document.createElement('div'); trTitle.style.cssText='font-size:12px;font-weight:bold;color:#111;text-transform:uppercase;'; trTitle.textContent='Tratti Fisiologici & Log Pose';
    trTop.appendChild(trTitle); trBox.appendChild(trTop);
    
    var rTog=document.createElement('div'); rTog.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;';
    var rzList=[{id:'Fish',n:'Uomo-Pesce / Sirenetta'},{id:'Mink',n:'Vismone (Mink)'},{id:'Cyb',n:'Cyborg'},{id:'Sky',n:'Skypieano'}];
    rzList.forEach(function(rz){
      var rL=document.createElement('label'); rL.style.cssText='display:flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;cursor:pointer;background:#eee;padding:4px 8px;border-radius:3px;border:1px solid #ddd;';
      var rC=document.createElement('input'); rC.type='checkbox'; rC.checked=!!s['tr'+rz.id]; rC.onchange=function(){s['tr'+rz.id]=this.checked;ss();renderMain();};
      rL.appendChild(rC); rL.appendChild(document.createTextNode(rz.n)); rTog.appendChild(rL);
    });
    trBox.appendChild(rTog);
    
    var trDyn=document.createElement('div'); trDyn.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;';
    if(s.trFish){
      var bF=document.createElement('div'); bF.style.cssText='border:1px solid #8ab;padding:4px;background:#eef5f9;';
      bF.innerHTML='<div style="font-size:9px;font-weight:bold;color:#257;margin-bottom:2px;">Velocità Nuoto / Karate Uomini-Pesce</div>';
      var tF=document.createElement('textarea'); tF.style.cssText='width:100%;min-height:40px;border:1px solid #bcd;outline:none;font-size:9px;background:#fff;resize:vertical;box-sizing:border-box;padding:2px;'; tF.value=s.trFishD||''; tF.oninput=function(){s.trFishD=this.value;ss();}; bF.appendChild(tF); trDyn.appendChild(bF);
    }
    if(s.trMink){
      var bM=document.createElement('div'); bM.style.cssText='border:1px solid #a83;padding:4px;background:#fdf9ee;';
      bM.innerHTML='<div style="font-size:9px;font-weight:bold;color:#752;margin-bottom:2px;">Electro / Sulong</div>';
      var tM=document.createElement('textarea'); tM.style.cssText='width:100%;min-height:40px;border:1px solid #dc9;outline:none;font-size:9px;background:#fff;resize:vertical;box-sizing:border-box;padding:2px;'; tM.value=s.trMinkD||''; tM.oninput=function(){s.trMinkD=this.value;ss();}; bM.appendChild(tM); trDyn.appendChild(bM);
    }
    if(s.trCyb){
      var bC=document.createElement('div'); bC.style.cssText='border:1px solid #888;padding:4px;background:#f0f0f0;';
      bC.innerHTML='<div style="font-size:9px;font-weight:bold;color:#333;margin-bottom:2px;">Modifiche Corporee / Riserva Cola</div>';
      var tC=document.createElement('textarea'); tC.style.cssText='width:100%;min-height:40px;border:1px solid #ccc;outline:none;font-size:9px;background:#fff;resize:vertical;box-sizing:border-box;padding:2px;'; tC.value=s.trCybD||''; tC.oninput=function(){s.trCybD=this.value;ss();}; bC.appendChild(tC); trDyn.appendChild(bC);
    }
    if(s.trSky){
      var bS=document.createElement('div'); bS.style.cssText='border:1px solid #9aa;padding:4px;background:#f5f8f8;';
      bS.innerHTML='<div style="font-size:9px;font-weight:bold;color:#355;margin-bottom:2px;">Dial Equipaggiati</div>';
      var tS=document.createElement('textarea'); tS.style.cssText='width:100%;min-height:40px;border:1px solid #cdd;outline:none;font-size:9px;background:#fff;resize:vertical;box-sizing:border-box;padding:2px;'; tS.value=s.trSkyD||''; tS.oninput=function(){s.trSkyD=this.value;ss();}; bS.appendChild(tS); trDyn.appendChild(bS);
    }
    trBox.appendChild(trDyn);
    
    var lpBox=document.createElement('div'); lpBox.style.cssText='border-top:1px solid #aaa;padding-top:6px;';
    var lpT=document.createElement('div'); lpT.style.cssText='display:flex;align-items:center;background:#fff4e6;border:1px solid #dca;padding:4px 8px;border-radius:3px;';
    var lpL=document.createElement('div'); lpL.style.cssText='font-size:11px;font-weight:bold;color:#852;'; lpL.textContent='Log Pose Tracker:';
    var lpI=document.createElement('input'); lpI.type='text'; lpI.placeholder='Isola Registrata e tempo rimasto...'; lpI.value=s.logPose||''; lpI.style.cssText='flex:1;margin-left:8px;font-size:10px;border:none;border-bottom:1px solid #ccc;outline:none;background:transparent;'; lpI.oninput=function(){s.logPose=this.value;ss();};
    lpT.appendChild(lpL); lpT.appendChild(lpI); lpBox.appendChild(lpT); trBox.appendChild(lpBox);
    
    opFull.appendChild(trBox);
    pg3.appendChild(opFull);

    /* INCANTESIMI TOGGLE - ONE PIECE */
    var spellToggleBox = document.createElement('div');
    spellToggleBox.style.cssText = 'margin-top:16px; border:1.5px dashed #aaa; border-radius:4px; padding:12px; text-align:center; background:#faf3e3; margin-bottom:16px;';
    
    var spellToggleDesc = document.createElement('div');
    spellToggleDesc.style.cssText = 'font-size:10px; color:#555; margin-bottom:8px; font-style:italic;';
    spellToggleDesc.textContent = "Attiva questa sezione per classi come Chemist, Priest, Skald, Tinkerer o Hybrid che usano slot incantesimo e formule preparate.";
    spellToggleBox.appendChild(spellToggleDesc);
    
    var spellToggleBtn = document.createElement('button');
    spellToggleBtn.style.cssText = 'padding:6px 16px; font-size:12px; font-weight:bold; cursor:pointer; background:#fff; border:1px solid #aaa; border-radius:3px; color:#111; text-transform:uppercase;';
    spellToggleBtn.textContent = s.hasSpellcasting ? '- Nascondi Scheda Incantesimi / Formule' : '+ Abilita / Mostra Scheda Incantesimi';
    spellToggleBtn.onclick = function() {
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
    if (isOP) spellContainer.style.cssText = 'margin-top:16px; border-top:2px solid #555; padding-top:16px;';
    
    var hdr3=document.createElement('div'); hdr3.style.cssText='border:1.5px solid #555;border-radius:3px;margin-bottom:8px;overflow:hidden;';
    var h3G=document.createElement('div'); h3G.style.cssText='display:grid;grid-template-columns:2fr 1fr 1fr 1fr;';
    var h3N=document.createElement('div'); h3N.style.cssText='padding:3px 4px;';
    var h3NI=document.createElement('input'); h3NI.type='text'; h3NI.value=s.classInc||''; h3NI.style.cssText='width:100%;border:none;background:transparent;color:#111;font-size:12px;font-weight:bold;outline:none;';
    h3NI.oninput=function(){s.classInc=this.value;ss();}; h3N.appendChild(h3NI); h3N.appendChild(cellLbl('Classe da Incantatore')); h3G.appendChild(h3N);
    h3G.appendChild(makeHdrCell('Caratteristica da Incantatore','carInc',false));
    h3G.appendChild(makeHdrCell('CD Tiro Salvezza Incantesimi','cdTs',false));
    h3G.appendChild(makeHdrCell('Bonus di Attacco Incantesimi','bonusAtkInc',false));
    hdr3.appendChild(h3G); spellContainer.appendChild(hdr3);
    var incG3=document.createElement('div'); incG3.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;';
    var iC1=document.createElement('div'); iC1.style.cssText='display:flex;flex-direction:column;gap:4px;';
    iC1.appendChild(makeSpellBlock('0',s.trucchetti.map(function(n){return{nome:n,prep:false};}),'',true));
    iC1.appendChild(makeSpellBlock('1',s.sp1.lista,'sp1',false));
    iC1.appendChild(makeSpellBlock('2',s.sp2.lista,'sp2',false));
    incG3.appendChild(iC1);
    var iC2=document.createElement('div'); iC2.style.cssText='display:flex;flex-direction:column;gap:4px;';
    iC2.appendChild(makeSpellBlock('3',s.sp3.lista,'sp3',false));
    iC2.appendChild(makeSpellBlock('4',s.sp4.lista,'sp4',false));
    iC2.appendChild(makeSpellBlock('5',s.sp5.lista,'sp5',false));
    incG3.appendChild(iC2);
    var iC3=document.createElement('div'); iC3.style.cssText='display:flex;flex-direction:column;gap:4px;';
    iC3.appendChild(makeSpellBlock('6',s.sp6.lista,'sp6',false));
    iC3.appendChild(makeSpellBlock('7',s.sp7.lista,'sp7',false));
    iC3.appendChild(makeSpellBlock('8',s.sp8.lista,'sp8',false));
    iC3.appendChild(makeSpellBlock('9',s.sp9.lista,'sp9',false));
    incG3.appendChild(iC3);
    spellContainer.appendChild(incG3);
    pg3.appendChild(spellContainer);
  }
  pgWrap.appendChild(pg3);

  /* companion mini-sheets below character pages */
  var _cMapC=(state.companions||{})[state.schedaAttivaId]||{};
  Object.keys(_cMapC).forEach(function(k){_cMapC[k].id=k;pgWrap.appendChild(_renderCompanionMiniSheet(state.schedaAttivaId,_cMapC[k]));});

  if (isOP || _sTipo === 'normale') {
    if (s.staminaMax !== undefined && !s.staminaMigrated) {
      if(!s.customTrackers) s.customTrackers = [];
      s.customTrackers.push({
        id: 'migrated_stamina',
        name: 'Punti Stamina / Vigore',
        cur: s.staminaCur || 0,
        max: s.staminaMax || 0
      });
      s.staminaMigrated = true;
      ss();
    }

    var masterWrap = document.createElement('div');
    masterWrap.style.cssText = 'display:flex; gap:20px; align-items:flex-start; transform-origin:top center;';
    
    pgWrap.style.transform = '';
    pgWrap.style.transformOrigin = '';
    masterWrap.appendChild(pgWrap);
    
    var trackerCol = document.createElement('div');
    trackerCol.style.cssText = 'width:280px; display:flex; flex-direction:column; gap:16px; margin-top:0; padding:12px; background:#e8e1d5; border:2px solid #5a3d2b; border-radius:6px; box-shadow:0 4px 10px rgba(0,0,0,0.5);';
    
    var tHdr = document.createElement('div');
    tHdr.style.cssText = 'text-align:center; border-bottom:2px solid #5a3d2b; padding-bottom:10px; margin-bottom:4px;';
    var tTitle = document.createElement('div');
    tTitle.style.cssText = 'font-family:"Cinzel",serif; font-size:16px; font-weight:bold; color:#3e2723; margin-bottom:10px; letter-spacing:0.05em;';
    tTitle.textContent = isOP ? '\u2693 CONTATORI CIURMA \u2693' : '\u2694\uFE0F CONTATORI EXTRA \u2694\uFE0F';
    var tAdd = document.createElement('button');
    tAdd.type = 'button';
    tAdd.innerHTML = '+ Aggiungi Contatore';
    tAdd.style.cssText = 'background:#5a3d2b; color:#f4ebd8; border:1px solid #3e2723; padding:6px 12px; font-size:11px; font-weight:bold; border-radius:3px; cursor:pointer; width:100%; font-family:"Cinzel",serif; transition:background 0.2s;';
    tAdd.onmouseover = function(){this.style.background='#3e2723';};
    tAdd.onmouseout = function(){this.style.background='#5a3d2b';};
    tAdd.onclick = function(e) {
      e.preventDefault();
      if(!s.customTrackers) s.customTrackers = [];
      s.customTrackers.push({ id: Date.now().toString(), name: 'Nuovo Contatore', cur: 0, max: 0 });
      ss(); renderMain();
    };
    tHdr.appendChild(tTitle); tHdr.appendChild(tAdd);
    trackerCol.appendChild(tHdr);
    
    if (s.customTrackers && s.customTrackers.length > 0) {
      s.customTrackers.forEach(function(tr, i) {
        var trk = document.createElement('div');
        trk.style.cssText = 'background:#fdfbf7; border:2px dashed #8b6b55; border-radius:4px; padding:10px; box-shadow:inset 0 0 10px rgba(0,0,0,0.05); position:relative;';
        
        var trDel = document.createElement('button');
        trDel.type = 'button';
        trDel.title = 'Elimina contatore';
        trDel.setAttribute('aria-label', 'Elimina contatore');
        trDel.innerHTML = '✖';
        trDel.style.cssText = 'position:absolute; top:4px; right:4px; z-index:5; width:24px; height:24px; display:flex; align-items:center; justify-content:center; background:rgba(170,51,51,0.10); border:1px solid rgba(170,51,51,0.35); border-radius:4px; color:#b71c1c; font-size:13px; cursor:pointer; font-weight:bold; transition:all 0.15s ease;';
        trDel.onmouseover = function() { this.style.background = '#b71c1c'; this.style.color = '#fff'; };
        trDel.onmouseout = function() { this.style.background = 'rgba(170,51,51,0.10)'; this.style.color = '#b71c1c'; };
        trDel.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          s.customTrackers.splice(i, 1);
          ss();
          renderMain();
          if (typeof notify === 'function') notify('Contatore extra rimosso.');
        };
        trk.appendChild(trDel);
        
        var nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.value = tr.name;
        nameInp.style.cssText = 'width:85%; border:none; border-bottom:1px solid #c9a55c; background:transparent; font-family:"Cinzel",serif; font-size:12px; font-weight:bold; color:#3e2723; outline:none; margin-bottom:10px;';
        nameInp.oninput = function() { tr.name = this.value; ss(); };
        trk.appendChild(nameInp);
        
        var valRow = document.createElement('div');
        valRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;';
        
        var ctrlL = document.createElement('div'); ctrlL.style.cssText = 'display:flex; gap:4px;';
        var btnM = document.createElement('button'); btnM.type='button'; btnM.textContent='-'; btnM.style.cssText='width:24px;height:24px;border:1px solid #5a3d2b;background:#e8e1d5;color:#3e2723;cursor:pointer;font-weight:bold;border-radius:3px;display:flex;align-items:center;justify-content:center;';
        btnM.onclick = function(e){ e.preventDefault(); tr.cur = Math.max(0, (parseInt(tr.cur)||0)-1); ss(); renderMain(); };
        var btnP = document.createElement('button'); btnP.type='button'; btnP.textContent='+'; btnP.style.cssText='width:24px;height:24px;border:1px solid #5a3d2b;background:#e8e1d5;color:#3e2723;cursor:pointer;font-weight:bold;border-radius:3px;display:flex;align-items:center;justify-content:center;';
        btnP.onclick = function(e){ e.preventDefault(); tr.cur = (parseInt(tr.cur)||0)+1; ss(); renderMain(); };
        ctrlL.appendChild(btnM); ctrlL.appendChild(btnP);
        
        var vals = document.createElement('div'); vals.style.cssText = 'display:flex; align-items:center; gap:2px; font-size:14px; font-weight:bold; color:#3e2723;';
        var iCur = document.createElement('input'); iCur.type='number'; iCur.value = tr.cur; iCur.style.cssText='width:36px;text-align:right;border:1px solid #aaa;outline:none;background:#fff;padding:2px;border-radius:2px;font-weight:bold;font-size:12px;'; iCur.oninput=function(){ tr.cur=this.value; ss(); };
        var iMax = document.createElement('input'); iMax.type='number'; iMax.value = tr.max; iMax.style.cssText='width:36px;text-align:center;border:1px solid #aaa;outline:none;background:#fff;padding:2px;border-radius:2px;font-weight:bold;font-size:12px;'; iMax.oninput=function(){ tr.max=this.value; ss(); };
        vals.appendChild(iCur); vals.appendChild(document.createTextNode('/')); vals.appendChild(iMax);
        
        valRow.appendChild(ctrlL); valRow.appendChild(vals);
        trk.appendChild(valRow);
        
        var rRow = document.createElement('div'); rRow.style.cssText = 'display:flex; gap:4px;';
        var rbB = document.createElement('button'); rbB.type='button'; rbB.textContent='Riposo Breve'; rbB.style.cssText='flex:1; font-size:9px; padding:3px; cursor:pointer; background:#fff; border:1px solid #8b6b55; border-radius:2px; font-weight:bold; color:#5a3d2b; text-transform:uppercase;';
        rbB.onclick = function(e){ e.preventDefault(); tr.cur = Math.min((parseInt(tr.max)||0), (parseInt(tr.cur)||0)); ss(); renderMain(); };
        var rbL = document.createElement('button'); rbL.type='button'; rbL.textContent='Riposo Lungo'; rbL.style.cssText='flex:1; font-size:9px; padding:3px; cursor:pointer; background:#fff; border:1px solid #8b6b55; border-radius:2px; font-weight:bold; color:#5a3d2b; text-transform:uppercase;';
        rbL.onclick = function(e){ e.preventDefault(); tr.cur = parseInt(tr.max)||0; ss(); renderMain(); };
        rRow.appendChild(rbB); rRow.appendChild(rbL);
        trk.appendChild(rRow);
        
        trackerCol.appendChild(trk);
      });
    }
    masterWrap.appendChild(trackerCol);
    pgWrap = masterWrap;
  }

  scrollArea.appendChild(pgWrap); wrap.appendChild(scrollArea);
  setTimeout(function(){applyZoom();},0);
  return wrap;
}


/* ============================================================================
   SEZIONE 8: BESTIARIO INTERATTIVO & PET DEL PARTY (renderBestiario)
   ============================================================================ */
function renderBestiario() {
  var wrap=document.createElement('div');
  if (state.bestShowForm) { wrap.appendChild(renderBestiarForm()); }
  var header=document.createElement('header'); header.className='border-b';
  var hc=document.createElement('div'); hc.className='container-main';
  hc.style.cssText='padding-top:2.25rem;padding-bottom:2.25rem;';
  var top=document.createElement('div'); top.className='flex flex-wrap items-start justify-between gap-5';
  top.innerHTML='<div><div class="header-eyebrow mb-3"><span>Cronache dei Mostri</span></div><h1 class="header-title">Bestiario Custom</h1><p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Database dei mostri del tuo mondo</p></div>';
  var rh=document.createElement('div'); rh.className='flex flex-wrap items-center gap-2';
  var bSave=document.createElement('button'); bSave.className='btn-gold';
  bSave.innerHTML=ICON.save+' Salva su Chiavetta'; bSave.onclick=saveBestiario;
  rh.appendChild(bSave);
  var bLoad=document.createElement('button'); bLoad.className='btn-dark';
  bLoad.innerHTML=ICON.folder+' Carica da Chiavetta'; bLoad.onclick=loadBestiarioFile;
  rh.appendChild(bLoad);
  top.appendChild(rh);
  hc.appendChild(top);
  var fd=document.createElement('div'); fd.className='filigree-divider mt-7'; hc.appendChild(fd);
  var notice=document.createElement('div'); notice.className='notice mt-5';
  notice.innerHTML='<strong style="color:var(--gold);font-style:normal;">🐉 Bestiario Locale: </strong>i dati sono sincronizzati via Firebase. Usa <em>"Salva su Chiavetta"</em> per un backup JSON e <em>"Carica da Chiavetta"</em> per ripristinarlo.';
  hc.appendChild(notice);
  header.appendChild(hc); wrap.appendChild(header);

  /* ===== TAB BAR ===== */
  /* Giocatori vedono solo la tab "pet" */
  if (!isDM()) state.bestTab = 'pet';
  var tabBar=document.createElement('div');
  tabBar.style.cssText='background:var(--bg-card);border-bottom:1px solid var(--border-subtle);';
  var tabInner=document.createElement('div'); tabInner.className='container-main';
  tabInner.style.cssText='display:flex;gap:0;padding-top:0;padding-bottom:0;';
  var myPetCount = isDM() ? state.pet.length : state.pet.filter(function(p){ return state.currentUser && (p.proprietario||'').toLowerCase()===state.currentUser.username.toLowerCase(); }).length;
  var tabDefs = isDM()
    ? [{id:'bestiario',label:'⚔ Bestiario',count:state.bestiario.length},{id:'pet',label:'🐾 Pet del Party',count:state.pet.length}]
    : [{id:'pet',label:'🐾 I miei Pet',count:myPetCount}];
  tabDefs.forEach(function(t){
    var tb=document.createElement('button'); tb.type='button';
    var isActive=state.bestTab===t.id;
    tb.style.cssText='padding:0.7rem 1.25rem;font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;border:none;border-bottom:2px solid '+(isActive?'var(--border-gold)':'transparent')+';background:transparent;color:'+(isActive?'var(--gold)':'var(--text-muted)')+';cursor:pointer;white-space:nowrap;';
    tb.innerHTML=t.label+' <span style="background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:8px;padding:0.05rem 0.4rem;font-size:9px;margin-left:0.3rem;color:var(--text-faint);">'+t.count+'</span>';
    if (!isActive) tb.onclick=function(){ state.bestTab=t.id; renderMain(); };
    tabInner.appendChild(tb);
  });
  tabBar.appendChild(tabInner); wrap.appendChild(tabBar);

  /* ===== TAB BESTIARIO ===== */
  if (state.bestTab==='bestiario') {
    var sec=document.createElement('section'); sec.className='container-main';
    sec.style.cssText='padding-top:2rem;padding-bottom:1rem;';
    var pg=document.createElement('div'); pg.className='panel-glass';
    var row=document.createElement('div'); row.className='flex flex-wrap items-end gap-4';
    var sw=document.createElement('div'); sw.style.cssText='flex:1 1 200px;min-width:180px;';
    sw.innerHTML='<label class="field-label">Cerca nel bestiario</label>';
    var swW=document.createElement('div'); swW.className='search-wrap'; swW.innerHTML=ICON.search;
    var swI=document.createElement('input'); swI.type='text'; swI.className='field';
    swI.placeholder='es. goblin, draconico, non-morto…'; swI.value=state.bestSearch||'';
    swI.oninput=function(){ state.bestSearch=this.value; updateBestiarioGrid(); };
    swW.appendChild(swI); sw.appendChild(swW); row.appendChild(sw);
    row.appendChild(makeSelectFilter('Taglia', state.bestFiltroTaglia, [''].concat(TAGLIE_MOSTRO), function(v){ state.bestFiltroTaglia=v; updateBestiarioGrid(); }, '— Tutte le taglie —'));
    row.appendChild(makeSelectFilter('Tipo Creatura', state.bestFiltroTipo, [''].concat(TIPI_MOSTRO), function(v){ state.bestFiltroTipo=v; updateBestiarioGrid(); }, '— Tutti i tipi —'));
    (function(){
      var gsVals = ['','0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','30'];
      row.appendChild(makeSelectFilter('Grado Sfida', state.bestFiltroGS, gsVals, function(v){ state.bestFiltroGS=v; updateBestiarioGrid(); }, '— Tutti i GS —'));
    })();
    if (isAdmin()) {
      var abW=document.createElement('div');
      var ab=document.createElement('button'); ab.className='btn-gold';
      ab.innerHTML=ICON.plus+' Nuovo Mostro';
      ab.onclick=function(){ state.bestEditingId=null; state.bestShowForm=true; render(); };
      abW.appendChild(ab); row.appendChild(abW);
    }
    pg.appendChild(row); sec.appendChild(pg); wrap.appendChild(sec);
    var cW=document.createElement('div'); cW.className='container-main pb-4';
    var cE=document.createElement('div'); cE.id='best-counter'; cW.appendChild(cE); wrap.appendChild(cW);
    var main=document.createElement('section'); main.className='container-main pb-20';
    var grid=document.createElement('div'); grid.id='bestiario-grid'; main.appendChild(grid); wrap.appendChild(main);
    setTimeout(function(){ updateBestiarioGrid(); },0);

  /* ===== TAB PET ===== */
  } else {
    var secP=document.createElement('section'); secP.className='container-main';
    secP.style.cssText='padding-top:2rem;padding-bottom:1rem;';
    var pgP=document.createElement('div'); pgP.className='panel-glass';
    var rowP=document.createElement('div'); rowP.className='flex flex-wrap items-end gap-4';
    var swP=document.createElement('div'); swP.style.cssText='flex:1 1 200px;min-width:180px;';
    swP.innerHTML='<label class="field-label">Cerca tra i pet</label>';
    var swWP=document.createElement('div'); swWP.className='search-wrap'; swWP.innerHTML=ICON.search;
    var swIP=document.createElement('input'); swIP.type='text'; swIP.className='field';
    swIP.placeholder='nome, tipo, proprietario…'; swIP.value=state.petSearch||'';
    swIP.oninput=function(){ state.petSearch=this.value; updatePetGrid(); };
    swWP.appendChild(swIP); swP.appendChild(swWP); rowP.appendChild(swP);
    if (isDM()) {
      var adoptW=document.createElement('div');
      var adoptBtn=document.createElement('button'); adoptBtn.className='btn-gold';
      adoptBtn.innerHTML='🐾 Adotta dal Bestiario'; adoptBtn.onclick=adottaDalBestiario;
      adoptW.appendChild(adoptBtn); rowP.appendChild(adoptW);
    }
    pgP.appendChild(rowP); secP.appendChild(pgP); wrap.appendChild(secP);
    var cWP=document.createElement('div'); cWP.className='container-main pb-4';
    var cEP=document.createElement('div'); cEP.id='pet-counter'; cWP.appendChild(cEP); wrap.appendChild(cWP);
    var mainP=document.createElement('section'); mainP.className='container-main pb-20';
    var gridP=document.createElement('div'); gridP.id='pet-grid'; mainP.appendChild(gridP); wrap.appendChild(mainP);
    setTimeout(function(){ updatePetGrid(); },0);
  }

  var footer=document.createElement('footer'); footer.className='border-t mt-8';
  footer.style.cssText='padding:1.75rem 0;';
  var fc=document.createElement('div'); fc.className='container-main';
  fc.innerHTML='<div class="filigree-divider mb-5"></div><div class="flex flex-wrap items-center justify-between gap-3"><div class="font-display tracking-widest font-semibold" style="font-size:11px;color:var(--gold-dim);">⚜ BESTIARIO SINCRONIZZATO VIA FIREBASE ⚜</div></div>';
  footer.appendChild(fc); wrap.appendChild(footer);
  return wrap;
}

// ============================================================
// INCANTESIMI AGGIUNTIVI
// ============================================================
var SCUOLE_MAGIA = ['Abiurazione','Ammaliamento','Divinazione','Evocazione','Illusione','Invocazione','Necromanzia','Trasmutazione'];


/* ============================================================================
   SEZIONE 10: GRIMORIO DEGLI INCANTESIMI (renderIncantesimiAggiuntivi)
   ============================================================================ */
function renderIncantesimiAggiuntivi() {
  var frag = document.createElement('div');

  // Search bar + filtri
  var pg = document.createElement('div'); pg.className = 'panel-glass'; pg.style.cssText = 'margin:1.5rem;';
  var row = document.createElement('div'); row.className = 'flex flex-wrap items-end gap-4';
  var sw = document.createElement('div'); sw.style.cssText = 'flex:1 1 200px;min-width:180px;';
  sw.innerHTML = '<label class="field-label">Cerca incantesimo</label>';
  var swW = document.createElement('div'); swW.className = 'search-wrap'; swW.innerHTML = ICON.search;
  var swI = document.createElement('input'); swI.type = 'text'; swI.className = 'field';
  swI.id = 'inc-search-input';
  swI.placeholder = 'nome, scuola, descrizione...'; swI.value = state.incSearch || '';
  swI.oninput = function(){
    var pos = this.selectionStart;
    state.incSearch = this.value;
    renderMain();
    var ni = document.getElementById('inc-search-input');
    if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch(e) {} }
  };
  swW.appendChild(swI); sw.appendChild(swW); row.appendChild(sw);

  // Filtro livello
  var lvlW = document.createElement('div'); lvlW.style.cssText = 'min-width:130px;';
  lvlW.innerHTML = '<label class="field-label">Livello</label>';
  var lvlSel = document.createElement('select'); lvlSel.className = 'field';
  var lvlOpts = [{v:'',l:'Tutti i livelli'}].concat([{v:'0',l:'Trucchetto'}].concat([1,2,3,4,5,6,7,8,9].map(function(n){return {v:String(n),l:'Livello '+n};})));
  lvlOpts.forEach(function(o){ var op=document.createElement('option'); op.value=o.v; op.textContent=o.l; if((state.incFilterLivello||'')===o.v) op.selected=true; lvlSel.appendChild(op); });
  lvlSel.onchange=function(){ state.incFilterLivello=this.value; renderMain(); };
  lvlW.appendChild(lvlSel); row.appendChild(lvlW);

  // Filtro classe
  var clW = document.createElement('div'); clW.style.cssText = 'min-width:150px;';
  clW.innerHTML = '<label class="field-label">Classe</label>';
  var clSel = document.createElement('select'); clSel.className = 'field';
  var CLASSI_INC = ['Artificere','Bardo','Chierico','Druido','Mago','Paladino','Ranger','Stregone','Warlock'];
  [{v:'',l:'Tutte le classi'}].concat(CLASSI_INC.map(function(c){return {v:c,l:c};})).forEach(function(o){ var op=document.createElement('option'); op.value=o.v; op.textContent=o.l; if((state.incFilterClasse||'')===o.v) op.selected=true; clSel.appendChild(op); });
  clSel.onchange=function(){ state.incFilterClasse=this.value; renderMain(); };
  clW.appendChild(clSel); row.appendChild(clW);

  if (isAdmin()) {
    var abW = document.createElement('div');
    var ab = document.createElement('button'); ab.className = 'btn-gold';
    ab.innerHTML = ICON.plus + ' Nuovo Incantesimo';
    ab.onclick = function(){ state.incEditingId = null; state.incShowForm = true; renderMain(); };
    abW.appendChild(ab); row.appendChild(abW);
  }
  pg.appendChild(row); frag.appendChild(pg);

  // Filter & sort
  var all = (state.incantesimiAggiuntivi || []).slice().sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||'','it'); });
  var q = (state.incSearch || '').toLowerCase();
  var fLv = state.incFilterLivello || '';
  var fCl = state.incFilterClasse || '';
  var filtered = all.filter(function(s){
    if (fLv !== '' && String(s.livello||0) !== fLv) return false;
    if (fCl && !(s.classi||[]).includes(fCl)) return false;
    if (q && !((s.nome||'').toLowerCase().includes(q)||(s.scuola||'').toLowerCase().includes(q)||(s.descrizione||'').toLowerCase().includes(q))) return false;
    return true;
  });

  var counter = document.createElement('div'); counter.className = 'container-main';
  counter.style.cssText = 'padding-bottom:0.5rem;font-size:11px;color:var(--text-faint);letter-spacing:0.1em;';
  counter.textContent = filtered.length + ' incantesim' + (filtered.length===1?'o':'i');
  frag.appendChild(counter);

  if (filtered.length === 0) {
    var empty = document.createElement('div'); empty.className = 'empty-state panel-glass'; empty.style.cssText = 'margin:1.5rem;';
    empty.innerHTML = '<div class="rune">✨</div><h2>Nessun incantesimo</h2><p>' + (isAdmin() ? 'Aggiungi il primo incantesimo.' : 'Nessun incantesimo aggiuntivo disponibile.') + '</p>';
    frag.appendChild(empty);
  } else {
    var grid = document.createElement('div'); grid.className = 'container-main pb-20';
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1.25rem;padding-top:0.5rem;padding-bottom:4rem;';
    filtered.forEach(function(s){ grid.appendChild(renderIncantatesimoCard(s)); });
    frag.appendChild(grid);
  }

  if (state.incShowForm) frag.appendChild(renderIncantesimoForm());
  return frag;
}

function _openIncantesimoDetail(s) {
  var old = document.getElementById('inc-detail-overlay');
  if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.id = 'inc-detail-overlay';
  overlay.className = 'sium-spell-modal-backdrop modal-backdrop';
  function _closeIncModal() {
    document.removeEventListener('keydown', _incEsc);
    if (window.SiumAnimations && window.SiumAnimations.closeModalAnimated) {
      window.SiumAnimations.closeModalAnimated(overlay);
    } else {
      overlay.remove();
    }
  }
  var _incEsc = function(e) { if (e.key === 'Escape') _closeIncModal(); };
  document.addEventListener('keydown', _incEsc);
  overlay.onclick = function(e){ if(e.target===overlay) _closeIncModal(); };
  var panel = document.createElement('div');
  panel.className = 'sium-spell-modal-panel';
  panel.onclick = function(e){ e.stopPropagation(); };
  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'position:relative;z-index:2;padding:1.35rem 1.5rem 1rem;border-bottom:1px solid var(--border-gold);background:transparent;';
  var topRow = document.createElement('div'); topRow.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;';
  var nameBlock = document.createElement('div');
  var lvlBadge = document.createElement('div');
  lvlBadge.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--spell-color, var(--gold));border:1px solid var(--spell-color, var(--border-gold));padding:0.15rem 0.55rem;display:inline-block;margin-bottom:0.5rem;';
  lvlBadge.textContent = s.livello == 0 ? '✦ Trucchetto' : '✦ Livello ' + s.livello;
  var orbsWrap = document.createElement('span');
  orbsWrap.className = 'sium-spell-level-orbs';
  var orbCount = Math.max(1, Math.min(9, Number(s.livello) || 1));
  for (var oi = 0; oi < orbCount; oi++) {
    var orb = document.createElement('span');
    orb.className = 'sium-spell-orb';
    orb.style.setProperty('--orb-i', String(oi));
    orbsWrap.appendChild(orb);
  }
  nameBlock.appendChild(lvlBadge);
  nameBlock.appendChild(orbsWrap);
  var nameEl = document.createElement('div');
  nameEl.style.cssText = 'font-family:\'Cinzel\',serif;font-size:26px;font-weight:900;color:var(--text-primary);letter-spacing:0.04em;line-height:1.15;';
  nameEl.textContent = s.nome || '';
  nameBlock.appendChild(nameEl);
  if (s.scuola) { var scuolaEl = document.createElement('div'); scuolaEl.style.cssText = 'font-size:13px;color:var(--spell-color, var(--text-muted));font-style:italic;margin-top:0.25rem;'; scuolaEl.textContent = 'Scuola di ' + s.scuola; nameBlock.appendChild(scuolaEl); }
  topRow.appendChild(nameBlock);
  var closeBtn = document.createElement('button'); closeBtn.className = 'btn-dark'; closeBtn.style.cssText = 'padding:0.35rem 0.75rem;font-size:18px;flex-shrink:0;line-height:1;'; closeBtn.textContent = '✕';
  closeBtn.onclick = function(){ _closeIncModal(); };
  topRow.appendChild(closeBtn);
  hdr.appendChild(topRow);
  var tagRow = document.createElement('div'); tagRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.75rem;';
  if (s.concentrazione) { var tc = document.createElement('span'); tc.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8bc4ff;border:1px solid rgba(139,196,255,0.4);padding:0.15rem 0.5rem;'; tc.textContent = 'CONCENTRAZIONE'; tagRow.appendChild(tc); }
  if (s.rituale) { var tr2 = document.createElement('span'); tr2.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#c8a8ff;border:1px solid rgba(200,168,255,0.4);padding:0.15rem 0.5rem;'; tr2.textContent = 'RITUALE'; tagRow.appendChild(tr2); }
  if (s.classi && s.classi.length) { s.classi.forEach(function(c){ var tb=document.createElement('span'); tb.style.cssText='font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);border:1px solid var(--border-subtle);padding:0.1rem 0.45rem;'; tb.textContent=c; tagRow.appendChild(tb); }); }
  if (tagRow.children.length) hdr.appendChild(tagRow);
  panel.appendChild(hdr);
  // Body
  var body2 = document.createElement('div'); body2.style.cssText = 'padding:1.25rem 1.5rem;';
  var statGrid = document.createElement('div'); statGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.6rem 2rem;margin-bottom:1.25rem;';
  function statCell(lbl, val) {
    if (!val) return;
    var d=document.createElement('div'); var l=document.createElement('div'); l.style.cssText='font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.15rem;'; l.textContent=lbl;
    var v=document.createElement('div'); v.style.cssText='font-size:14px;color:var(--text-primary);'; v.textContent=String(val);
    d.appendChild(l); d.appendChild(v); statGrid.appendChild(d);
  }
  statCell('Gittata', s.gittata); statCell('Tempo di Lancio', s.tempoDiLancio); statCell('Durata', s.durata);
  if (s.componenti && s.componenti.length) statCell('Componenti', s.componenti.join(', '));
  if (s.valMateria) {
    var matD=document.createElement('div'); matD.style.cssText='grid-column:1/-1;';
    var ml=document.createElement('div'); ml.style.cssText='font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.15rem;'; ml.textContent='Materiali';
    var mv=document.createElement('div'); mv.style.cssText='font-size:14px;color:var(--text-primary);font-style:italic;'; mv.textContent=s.valMateria+(s.consumaMateria?' (consumato)':'');
    matD.appendChild(ml); matD.appendChild(mv); statGrid.appendChild(matD);
  }
  if (statGrid.children.length) body2.appendChild(statGrid);
  if (s.descrizione) {
    var sep1=document.createElement('div'); sep1.style.cssText='border-top:1px solid var(--border-subtle);margin:0 0 1rem;'; body2.appendChild(sep1);
    var effLbl=document.createElement('div'); effLbl.style.cssText='font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:0.5rem;'; effLbl.textContent='Effetto'; body2.appendChild(effLbl);
    var effTxt=document.createElement('div'); effTxt.style.cssText='font-size:15px;color:var(--text-secondary);line-height:1.8;white-space:pre-wrap;'; effTxt.textContent=s.descrizione; body2.appendChild(effTxt);
  }
  if (s.altiLivelli) {
    var sep2=document.createElement('div'); sep2.style.cssText='border-top:1px solid var(--border-subtle);margin:1rem 0;'; body2.appendChild(sep2);
    var alLbl2=document.createElement('div'); alLbl2.style.cssText='font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:0.5rem;'; alLbl2.textContent='Ai Livelli Superiori'; body2.appendChild(alLbl2);
    var alTxt2=document.createElement('div'); alTxt2.style.cssText='font-size:15px;color:var(--text-secondary);line-height:1.8;white-space:pre-wrap;'; alTxt2.textContent=s.altiLivelli; body2.appendChild(alTxt2);
  }
  body2.style.position = 'relative';
  body2.style.zIndex = '2';
  panel.appendChild(body2);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  if (window.SiumAnimations && window.SiumAnimations.enhanceSpellModal) {
    window.SiumAnimations.enhanceSpellModal(overlay, panel, s);
  }
}

function renderIncantatesimoCard(s) {
  var spTheme = (window.SiumAnimations && window.SiumAnimations.getSpellSchoolTheme)
    ? window.SiumAnimations.getSpellSchoolTheme(s.scuola)
    : { color: '#d8b25c', glow: 'rgba(216,178,92,0.28)', icon: '✨' };
  var card = document.createElement('div');
  card.className = 'panel-glass sium-spell-card sium-grid-card-enter';
  card.style.cssText = 'padding:0;overflow:hidden;';
  card.style.setProperty('--spell-color', spTheme.color);
  card.style.setProperty('--spell-glow', spTheme.glow);
  function _handleSpellCardClick() {
    if (window.SiumAnimations && window.SiumAnimations.triggerCardClickPulse) {
      window.SiumAnimations.triggerCardClickPulse(card, spTheme.color);
    }
    _openIncantesimoDetail(s);
  }

  // Head
  var head = document.createElement('div');
  head.style.cssText = 'padding:1rem 1.2rem 0.7rem;border-bottom:1px solid var(--border-subtle);cursor:pointer;';
  head.title = 'Clicca per consultare il Grimorio';
  head.onclick = _handleSpellCardClick;
  // Level badge + name
  var topRow = document.createElement('div'); topRow.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;';
  var nameCol = document.createElement('div');
  var lvlBadge = document.createElement('span');
  lvlBadge.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);border:1px solid var(--border-gold);padding:0.15rem 0.5rem;display:inline-block;margin-bottom:0.4rem;';
  lvlBadge.textContent = s.livello == 0 ? 'Trucchetto' : 'Livello ' + s.livello;
  nameCol.appendChild(lvlBadge);
  var nameDiv = document.createElement('div'); nameDiv.style.cssText = 'font-family:\'Cinzel\',serif;font-size:18px;font-weight:700;color:var(--text-primary);line-height:1.2;';
  nameDiv.textContent = s.nome || 'Senza nome';
  nameCol.appendChild(nameDiv);
  topRow.appendChild(nameCol);
  // Tags right
  var tagsCol = document.createElement('div'); tagsCol.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:0.3rem;flex-shrink:0;';
  if (s.concentrazione) { var tc = document.createElement('span'); tc.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8bc4ff;border:1px solid rgba(139,196,255,0.4);padding:0.15rem 0.45rem;white-space:nowrap;'; tc.textContent = 'CONC.'; tagsCol.appendChild(tc); }
  if (s.rituale) { var tr = document.createElement('span'); tr.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#c8a8ff;border:1px solid rgba(200,168,255,0.4);padding:0.15rem 0.45rem;white-space:nowrap;'; tr.textContent = 'RITUALE'; tagsCol.appendChild(tr); }
  topRow.appendChild(tagsCol);
  head.appendChild(topRow);
  // Scuola + componenti
  var subRow = document.createElement('div'); subRow.style.cssText = 'display:flex;align-items:center;gap:0.75rem;margin-top:0.4rem;flex-wrap:wrap;';
  if (s.scuola) { var sc = document.createElement('span'); sc.style.cssText = 'font-size:12px;color:var(--text-muted);font-style:italic;'; sc.textContent = s.scuola; subRow.appendChild(sc); }
  if (s.componenti && s.componenti.length) { var cp = document.createElement('span'); cp.style.cssText = 'font-size:12px;font-weight:700;color:var(--gold-dim);letter-spacing:0.1em;'; cp.textContent = s.componenti.join(', '); subRow.appendChild(cp); }
  if (subRow.children.length) head.appendChild(subRow);
  if (s.classi && s.classi.length) {
    var clRow = document.createElement('div'); clRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.45rem;';
    s.classi.forEach(function(c){ var badge=document.createElement('span'); badge.style.cssText='font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);border:1px solid var(--border-subtle);padding:0.1rem 0.4rem;'; badge.textContent=c; clRow.appendChild(badge); });
    head.appendChild(clRow);
  }
  card.appendChild(head);

  // Body
  var body = document.createElement('div'); body.style.cssText = 'padding:0.8rem 1.2rem;cursor:pointer;';
  body.onclick = _handleSpellCardClick;
  function statLine(lbl, val) {
    if (!val) return;
    var d = document.createElement('div'); d.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.3rem;align-items:baseline;';
    d.innerHTML = '<span style="font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);white-space:nowrap;min-width:110px;">' + lbl + '</span><span style="font-size:14px;color:var(--text-primary);">' + escapeHtml(String(val)) + '</span>';
    body.appendChild(d);
  }
  statLine('Gittata', s.gittata);
  statLine('Tempo di lancio', s.tempoDiLancio);
  statLine('Durata', s.durata);
  if (s.valMateria) statLine('Materiali', s.valMateria + (s.consumaMateria ? ' (consumato)' : ''));
  card.appendChild(body);

  // Footer Admin actions
  if (isAdmin()) {
    var foot = document.createElement('div'); foot.style.cssText = 'padding:0.5rem 1.2rem;border-top:1px solid var(--border-subtle);background:var(--bg-base);display:flex;justify-content:flex-end;gap:0.4rem;';
    var editB = document.createElement('button'); editB.className = 'btn-dark'; editB.style.cssText = 'padding:0.3rem 0.7rem;font-size:12px;'; editB.innerHTML = ICON.edit || '✎'; editB.textContent = '✎ Modifica';
    editB.onclick = function(){ state.incEditingId = s.id; state.incShowForm = true; renderMain(); };
    var delB = document.createElement('button'); delB.className = 'btn-blood'; delB.style.cssText = 'padding:0.3rem 0.7rem;font-size:12px;'; delB.innerHTML = ICON.trash || '✕'; delB.textContent = '✕';
    delB.onclick = function(){ if(confirm('Eliminare "' + (s.nome||'questo incantesimo') + '"?')){ state.incantesimiAggiuntivi = state.incantesimiAggiuntivi.filter(function(x){return x.id!==s.id;}); fbSaveIncantesimiAggiuntivi(); renderMain(); } };
    foot.appendChild(editB); foot.appendChild(delB); card.appendChild(foot);
  }
  return card;
}

function renderIncantesimoForm() {
  var editing = null;
  if (state.incEditingId) (state.incantesimiAggiuntivi||[]).forEach(function(x){ if(x.id===state.incEditingId) editing=x; });
  var CLASSI_INC_FORM = ['Artificere','Bardo','Chierico','Druido','Mago','Paladino','Ranger','Stregone','Warlock'];
  var form = {
    nome: editing?editing.nome:'', livello: editing!=null?editing.livello:0,
    scuola: editing?editing.scuola:'', gittata: editing?editing.gittata:'',
    tempoDiLancio: editing?editing.tempoDiLancio:'', durata: editing?editing.durata:'',
    valMateria: editing?editing.valMateria:'', rituale: editing?!!editing.rituale:false,
    concentrazione: editing?!!editing.concentrazione:false,
    componenti: editing?(editing.componenti||[]):[],
    consumaMateria: editing?!!editing.consumaMateria:false,
    classi: editing?(editing.classi||[]):[],
    descrizione: editing?editing.descrizione:'', altiLivelli: editing?editing.altiLivelli:''
  };

  var backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  backdrop.onclick = function(e){ if(e.target===backdrop){ state.incShowForm=false; state.incEditingId=null; renderMain(); } };

  var panel = document.createElement('div');
  panel.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-gold);max-width:560px;width:100%;max-height:90vh;overflow-y:auto;';
  panel.onclick = function(e){ e.stopPropagation(); };

  var mhead = document.createElement('div');
  mhead.style.cssText = 'padding:1rem 1.5rem;border-bottom:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;';
  var htitle = document.createElement('div'); htitle.style.cssText = 'font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:var(--gold);';
  htitle.textContent = editing ? '✎ Modifica Incantesimo' : '+ Nuovo Incantesimo';
  var closeB = document.createElement('button'); closeB.className='btn-dark'; closeB.style.cssText='padding:0.25rem 0.6rem;'; closeB.textContent='✕';
  closeB.onclick = function(){ state.incShowForm=false; state.incEditingId=null; renderMain(); };
  mhead.appendChild(htitle); mhead.appendChild(closeB); panel.appendChild(mhead);

  var mbody = document.createElement('div'); mbody.style.cssText = 'padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;';

  function iField(lbl, key, type, opts) {
    var g = document.createElement('div');
    var l = document.createElement('label'); l.className='field-label'; l.textContent=lbl; g.appendChild(l);
    var el;
    if (type==='select') {
      el=document.createElement('select'); el.className='field';
      (opts||[]).forEach(function(o){ var op=document.createElement('option'); op.value=o; op.textContent=o; if(String(form[key])===String(o)) op.selected=true; el.appendChild(op); });
    } else if (type==='textarea') {
      el=document.createElement('textarea'); el.className='field'; el.rows=3; el.value=form[key]; el.style.resize='vertical';
    } else {
      el=document.createElement('input'); el.type=type||'text'; el.className='field'; el.value=form[key];
    }
    if (type!=='checkbox') el.onchange=el.oninput=function(){ form[key]=type==='number'?(Number(this.value)||0):this.value; };
    g.appendChild(el); return g;
  }

  mbody.appendChild(iField('Nome','nome','text'));

  var r1=document.createElement('div'); r1.style.cssText='display:grid;grid-template-columns:1fr 2fr;gap:0.75rem;';
  // Livello select
  var lvlG=document.createElement('div'); var lvlL=document.createElement('label'); lvlL.className='field-label'; lvlL.textContent='Livello'; lvlG.appendChild(lvlL);
  var lvlS=document.createElement('select'); lvlS.className='field';
  for(var i=0;i<=9;i++){ var op=document.createElement('option'); op.value=i; op.textContent=i===0?'0 — Trucchetto':String(i); if(form.livello===i) op.selected=true; lvlS.appendChild(op); }
  lvlS.onchange=function(){ form.livello=Number(this.value); };
  lvlG.appendChild(lvlS); r1.appendChild(lvlG);
  r1.appendChild(iField('Scuola di Magia','scuola','text'));
  mbody.appendChild(r1);

  var r2=document.createElement('div'); r2.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;';
  r2.appendChild(iField('Gittata','gittata','text'));
  r2.appendChild(iField('Tempo di Lancio','tempoDiLancio','text'));
  r2.appendChild(iField('Durata','durata','text'));
  mbody.appendChild(r2);

  // Componenti checkboxes
  var compG=document.createElement('div'); var compL=document.createElement('label'); compL.className='field-label'; compL.textContent='Componenti'; compG.appendChild(compL);
  var compRow=document.createElement('div'); compRow.style.cssText='display:flex;gap:1.25rem;align-items:center;';
  ['V','S','M'].forEach(function(c){
    var cWrap=document.createElement('label'); cWrap.style.cssText='display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:14px;color:var(--text-primary);font-weight:700;';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.value=c; cb.checked=(form.componenti||[]).indexOf(c)>=0;
    cb.onchange=function(){ if(this.checked){ if(form.componenti.indexOf(c)<0) form.componenti.push(c); } else { form.componenti=form.componenti.filter(function(x){return x!==c;}); } };
    cWrap.appendChild(cb); cWrap.appendChild(document.createTextNode(c)); compRow.appendChild(cWrap);
  });
  compG.appendChild(compRow); mbody.appendChild(compG);

  mbody.appendChild(iField('Valore Materiali (es. 100 mo di diamante)','valMateria','text'));

  // Bool flags
  var boolRow=document.createElement('div'); boolRow.style.cssText='display:flex;gap:1.5rem;flex-wrap:wrap;';
  [{key:'rituale',lbl:'Rituale'},{key:'concentrazione',lbl:'Concentrazione'},{key:'consumaMateria',lbl:'Consuma Materiali'}].forEach(function(b){
    var bWrap=document.createElement('label'); bWrap.style.cssText='display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:14px;color:var(--text-primary);';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!form[b.key];
    cb.onchange=function(){ form[b.key]=this.checked; };
    bWrap.appendChild(cb); bWrap.appendChild(document.createTextNode(b.lbl)); boolRow.appendChild(bWrap);
  });
  mbody.appendChild(boolRow);

  // Classi che possono usare l'incantesimo
  var classiG=document.createElement('div');
  var classiL=document.createElement('label'); classiL.className='field-label'; classiL.textContent='Classi che possono usarlo'; classiG.appendChild(classiL);
  var classiGrid=document.createElement('div'); classiGrid.style.cssText='display:flex;flex-wrap:wrap;gap:0.5rem 1rem;';
  CLASSI_INC_FORM.forEach(function(c){
    var cWrap=document.createElement('label'); cWrap.style.cssText='display:flex;align-items:center;gap:0.35rem;cursor:pointer;font-size:13px;color:var(--text-primary);';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.checked=(form.classi||[]).indexOf(c)>=0;
    cb.onchange=function(){ if(this.checked){ if(form.classi.indexOf(c)<0) form.classi.push(c); } else { form.classi=form.classi.filter(function(x){return x!==c;}); } };
    cWrap.appendChild(cb); cWrap.appendChild(document.createTextNode(c)); classiGrid.appendChild(cWrap);
  });
  classiG.appendChild(classiGrid); mbody.appendChild(classiG);

  mbody.appendChild(iField('Descrizione','descrizione','textarea'));
  mbody.appendChild(iField('A livelli superiori','altiLivelli','textarea'));

  var saveBtn=document.createElement('button'); saveBtn.className='btn-gold'; saveBtn.style.cssText='width:100%;margin-top:0.5rem;';
  saveBtn.textContent = editing ? 'Salva Modifiche' : 'Aggiungi Incantesimo';
  saveBtn.onclick=function(){
    if(!form.nome.trim()){ notify('Inserisci il nome dell\'incantesimo.','err'); return; }
    if(editing){
      state.incantesimiAggiuntivi=state.incantesimiAggiuntivi.map(function(x){ return x.id===editing.id?Object.assign({},form,{id:editing.id}):x; });
    } else {
      if(!state.incantesimiAggiuntivi) state.incantesimiAggiuntivi=[];
      state.incantesimiAggiuntivi.push(Object.assign({},form,{id:'inc_'+Date.now()}));
    }
    fbSaveIncantesimiAggiuntivi();
    notify(editing?'Incantesimo aggiornato.':'Incantesimo aggiunto.');
    state.incShowForm=false; state.incEditingId=null; renderMain();
  };
  mbody.appendChild(saveBtn);
  panel.appendChild(mbody); backdrop.appendChild(panel);
  return backdrop;
}


/* ============================================================================
   SEZIONE 10B: WORLDBUILDING — REGIONI, CITTÀ E LUOGHI
   ============================================================================ */
function renderWorldbuilding() {
  var wrap=document.createElement('div');

  /* HEADER */
  var header=document.createElement('header'); header.className='border-b';
  var hc=document.createElement('div'); hc.className='container-main';
  hc.style.cssText='padding-top:2.25rem;padding-bottom:2.25rem;';
  var top=document.createElement('div'); top.className='flex flex-wrap items-start justify-between gap-5';
  var _wbMapNome = (state.mappaActiveId && state.mappaList && state.mappaList[state.mappaActiveId])
    ? state.mappaList[state.mappaActiveId].nome : '';
  var _wbMapBadge = _wbMapNome
    ? '<span style="display:inline-block;margin-left:0.75rem;background:rgba(201,165,92,0.15);border:1px solid var(--border-gold);border-radius:3px;padding:0.15rem 0.6rem;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold);letter-spacing:0.1em;vertical-align:middle;">🗺 '+escapeHtml(_wbMapNome)+'</span>'
    : '';
  top.innerHTML='<div><div class="header-eyebrow mb-3"><span>Atlante del Mondo</span>'+_wbMapBadge+'</div><h1 class="header-title">Worldbuilding & Città</h1><p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Macro-zone, città, luoghi di interesse e segreti del tuo mondo</p></div>';
  hc.appendChild(top);
  var fd=document.createElement('div'); fd.className='filigree-divider mt-7'; hc.appendChild(fd);
  header.appendChild(hc); wrap.appendChild(header);

  var body=document.createElement('section');
  body.className='container-main'; body.style.cssText='padding-top:2rem;padding-bottom:5rem;';

  /* Bottone aggiungi zona */
  if (isDM()) {
    var addZoneRow=document.createElement('div');
    addZoneRow.style.cssText='display:flex;gap:0.5rem;align-items:center;margin-bottom:1.5rem;';
    var zoneInp=document.createElement('input'); zoneInp.type='text'; zoneInp.className='field';
    zoneInp.placeholder='Nome nuova macro-zona (es. Foresta Maledetta, Porto del Nord…)';
    zoneInp.style.flex='1';
    var addZoneBtn=document.createElement('button'); addZoneBtn.className='btn-gold';
    addZoneBtn.innerHTML=ICON.plus+' Aggiungi Zona';
    addZoneBtn.onclick=function(){
      var n=zoneInp.value.trim(); if(!n){notify('Inserisci il nome della zona.','err');return;}
      state.worldbuilding.push({id:'z_'+Date.now(),nome:n,desc:'',citta:[]});
      fbSaveWorldbuilding(); saveToStorage(); zoneInp.value=''; renderMain();
    };
    zoneInp.onkeydown=function(e){if(e.key==='Enter')addZoneBtn.click();};
    addZoneRow.appendChild(zoneInp); addZoneRow.appendChild(addZoneBtn);
    body.appendChild(addZoneRow);
  }

  if (state.worldbuilding.length === 0) {
    var empty=document.createElement('div'); empty.className='empty-state panel-glass';
    empty.innerHTML='<div class="rune">🌍</div><h2>Nessuna zona creata</h2><p>Aggiungi la prima macro-zona del tuo mondo con il campo sopra.</p>';
    body.appendChild(empty);
  } else {
    /* Zona accordion */
    state.worldbuilding.forEach(function(zone, zi) {
      var zonaEl=document.createElement('div');
      zonaEl.style.cssText='margin-bottom:1.5rem;border:1px solid var(--border-gold);border-radius:6px;overflow:hidden;';

      /* Header zona */
      var zonaHdr=document.createElement('div');
      zonaHdr.style.cssText='display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:var(--bg-card-elevated);cursor:pointer;';
      var zonaIcon=document.createElement('span'); zonaIcon.textContent='🗺'; zonaIcon.style.fontSize='18px';
      var zonaNome=document.createElement('span');
      zonaNome.style.cssText='font-family:\'Cinzel\',serif;font-size:14px;font-weight:700;color:var(--gold);flex:1;';
      zonaNome.textContent=zone.nome;
      var zonaBadge=document.createElement('span');
      zonaBadge.style.cssText='background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:8px;padding:0.1rem 0.5rem;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold-dim);';
      zonaBadge.textContent=(zone.citta||[]).length+' città';
      var zonaArrow=document.createElement('span'); zonaArrow.textContent='▾'; zonaArrow.style.cssText='color:var(--text-faint);font-size:12px;transition:transform 0.2s;';
      zonaHdr.appendChild(zonaIcon); zonaHdr.appendChild(zonaNome); zonaHdr.appendChild(zonaBadge);

      if (isDM()) {
        var delZoneBtn=document.createElement('button');
        delZoneBtn.style.cssText='background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:14px;padding:0.2rem 0.4rem;';
        delZoneBtn.innerHTML=ICON.trash; delZoneBtn.title='Elimina zona';
        (function(z,i){ delZoneBtn.onclick=function(e){ e.stopPropagation(); if(confirm('Eliminare la zona "'+z.nome+'" e tutte le sue città?')){state.worldbuilding.splice(i,1);fbSaveWorldbuilding();saveToStorage();renderMain();} }; })(zone,zi);
        zonaHdr.appendChild(delZoneBtn);
      }
      zonaHdr.appendChild(zonaArrow);

      var zonaBody=document.createElement('div');
      zonaBody.style.cssText='background:var(--bg-panel);padding:1rem;';

      zonaHdr.onclick=function(){
        var col=zonaBody.style.display==='none';
        zonaBody.style.display=col?'block':'none';
        zonaArrow.style.transform=col?'':'rotate(-90deg)';
      };

      /* Descrizione zona */
      var descG=document.createElement('div'); descG.style.marginBottom='1rem';
      descG.innerHTML='<label class="field-label">Descrizione zona</label>';
      var descTA=document.createElement('textarea'); descTA.className='field'; descTA.rows=2;
      descTA.placeholder='Breve descrizione della macro-zona…'; descTA.value=zone.desc||'';
      (function(z){ descTA.onchange=function(){ z.desc=this.value; fbSaveWorldbuilding(); saveToStorage(); }; })(zone);
      descG.appendChild(descTA); zonaBody.appendChild(descG);

      /* Città nella zona */
      var cittaTitle=document.createElement('div');
      cittaTitle.style.cssText='font-family:\'Cinzel\',serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:var(--gold-dim);margin-bottom:0.5rem;';
      cittaTitle.textContent='Città e Luoghi';
      zonaBody.appendChild(cittaTitle);

      (zone.citta||[]).forEach(function(city, ci) {
        var cityCard=document.createElement('div');
        cityCard.style.cssText='background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:4px;margin-bottom:0.5rem;overflow:hidden;';

        var cityHdr=document.createElement('div');
        cityHdr.style.cssText='display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;cursor:pointer;';
        var cityIcon=document.createElement('span'); cityIcon.textContent=city.tipo==='dungeon'?'⚔':city.tipo==='fortezza'?'🏰':city.tipo==='villaggio'?'🏘':'🏙'; cityIcon.style.fontSize='15px';
        var cityNome=document.createElement('span');
        cityNome.style.cssText='font-family:\'Cinzel\',serif;font-size:12px;font-weight:700;color:var(--text-strong);flex:1;';
        cityNome.textContent=city.nome+(city.tipo?' · '+city.tipo:'');
        var cityArrow=document.createElement('span'); cityArrow.textContent='▾'; cityArrow.style.cssText='color:var(--text-faint);font-size:11px;';

        if (isDM()) {
          var delCityBtn=document.createElement('button');
          delCityBtn.style.cssText='background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:13px;padding:0.1rem 0.3rem;';
          delCityBtn.innerHTML=ICON.trash;
          (function(z,c,i){ delCityBtn.onclick=function(e){ e.stopPropagation(); if(confirm('Eliminare "'+c.nome+'"?')){z.citta.splice(i,1);fbSaveWorldbuilding();saveToStorage();renderMain();} }; })(zone,city,ci);
          cityHdr.appendChild(cityIcon); cityHdr.appendChild(cityNome); cityHdr.appendChild(delCityBtn); cityHdr.appendChild(cityArrow);
        } else { cityHdr.appendChild(cityIcon); cityHdr.appendChild(cityNome); cityHdr.appendChild(cityArrow); }

        var cityBody=document.createElement('div');
        cityBody.style.cssText='padding:0.75rem;border-top:1px solid var(--border-subtle);display:none;';

        cityHdr.onclick=function(){
          var col=cityBody.style.display==='none';
          cityBody.style.display=col?'block':'none';
          cityArrow.textContent=col?'▴':'▾';
        };

        /* Immagini città */
        /* === 2 IMMAGINI AFFIANCATE === */
        var imgPairGrid = document.createElement('div');
        imgPairGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;';

        function makeImagePanel(labelTxt, imgKey) {
          if (!city[imgKey]) city[imgKey] = '';
          var cell = document.createElement('div');

          var lbl = document.createElement('div'); lbl.className = 'field-label';
          lbl.textContent = labelTxt; cell.appendChild(lbl);

          /* Box immagine — dimensione fissa, overflow hidden per pan/zoom */
          var imgBox = document.createElement('div');
          imgBox.style.cssText = 'position:relative;width:100%;padding-top:68%;border-radius:5px;overflow:hidden;border:2px dashed var(--border-subtle);background:var(--bg-base);cursor:pointer;';

          /* Immagine: object-fit cover, transform gestito via JS per pan/zoom */
          var imgEl = document.createElement('img');
          imgEl.draggable = false;
          imgEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:'+(city[imgKey]?'block':'none')+';transform-origin:center center;user-select:none;pointer-events:none;';
          if (city[imgKey]) { imgEl.src = city[imgKey]; imgBox.style.borderStyle='solid'; imgBox.style.borderColor='var(--border-soft)'; }
          imgBox.appendChild(imgEl);

          /* Placeholder */
          var phDiv = document.createElement('div');
          phDiv.style.cssText = 'position:absolute;inset:0;display:'+(city[imgKey]?'none':'flex')+';flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;pointer-events:none;';
          phDiv.innerHTML = '<span style="font-size:36px;opacity:0.28;">🖼</span><span style="font-family:\'Cinzel\',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-faint);">Clicca per aggiungere</span>';
          imgBox.appendChild(phDiv);

          /* Hint zoom (visibile solo quando c'è immagine) */
          var hintEl = document.createElement('div');
          hintEl.style.cssText = 'position:absolute;top:6px;left:8px;font-family:\'Cinzel\',serif;font-size:8px;letter-spacing:0.1em;color:rgba(255,255,255,0.55);background:rgba(0,0,0,0.45);padding:0.15rem 0.4rem;border-radius:3px;pointer-events:none;display:'+(city[imgKey]?'block':'none')+';';
          hintEl.textContent = '🔍 Rotella = zoom · Trascina = pan · 2× click = reset';
          imgBox.appendChild(hintEl);

          /* Overlay pulsanti */
          var overlay = document.createElement('div');
          overlay.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:0.4rem 0.5rem;display:'+(city[imgKey]?'flex':'none')+';gap:0.3rem;justify-content:flex-end;background:linear-gradient(transparent,rgba(0,0,0,0.65));z-index:2;';
          var changeBtn = document.createElement('button'); changeBtn.type='button'; changeBtn.className='btn-dark';
          changeBtn.style.cssText='font-size:10px;padding:0.2rem 0.5rem;'; changeBtn.textContent='✎ Cambia';
          var removeBtn = document.createElement('button'); removeBtn.type='button'; removeBtn.className='btn-blood';
          removeBtn.style.cssText='font-size:10px;padding:0.2rem 0.45rem;'; removeBtn.textContent='✕';
          overlay.appendChild(changeBtn); overlay.appendChild(removeBtn);
          imgBox.appendChild(overlay);

          var fI = document.createElement('input'); fI.type='file'; fI.accept='image/*'; fI.style.display='none';
          cell.appendChild(fI);

          (function(k, box, el, ph, ov, hint) {
            /* --- stato pan/zoom --- */
            var sc = 1, tx = 0, ty = 0;
            var dragging = false, didDrag = false;
            var mx0 = 0, my0 = 0, tx0 = 0, ty0 = 0;

            function applyT() {
              el.style.transform = 'translate('+tx+'px,'+ty+'px) scale('+sc+')';
            }
            function resetView() {
              sc=1; tx=0; ty=0; applyT();
              box.style.cursor = city[k] ? 'zoom-in' : 'pointer';
            }

            /* Zoom con rotella — centrato sul cursore */
            box.addEventListener('wheel', function(e) {
              if (!city[k]) return;
              e.preventDefault();
              var rect = box.getBoundingClientRect();
              var cx = (e.clientX - rect.left) - rect.width/2;
              var cy = (e.clientY - rect.top) - rect.height/2;
              var factor = e.deltaY < 0 ? 1.12 : 0.89;
              var ns = Math.max(1, Math.min(7, sc * factor));
              if (ns > 1) {
                tx = cx - (cx - tx) * (ns / sc);
                ty = cy - (cy - ty) * (ns / sc);
              } else { tx=0; ty=0; }
              sc = ns;
              applyT();
              box.style.cursor = sc > 1 ? 'grab' : 'zoom-in';
            }, {passive: false});

            /* Drag per spostare */
            box.addEventListener('mousedown', function(e) {
              if (!city[k]) return;
              if (e.target === changeBtn || e.target === removeBtn) return;
              e.preventDefault();
              dragging=true; didDrag=false;
              mx0=e.clientX; my0=e.clientY; tx0=tx; ty0=ty;
              box.style.cursor='grabbing';
            });

            function onMove(e) {
              if (!dragging) return;
              var dx=e.clientX-mx0, dy=e.clientY-my0;
              if (Math.abs(dx)>4||Math.abs(dy)>4) didDrag=true;
              tx=tx0+dx; ty=ty0+dy; applyT();
            }
            function onUp(e) {
              if (!dragging) return;
              dragging=false;
              if (!didDrag && !city[k]) openPicker();
              else if (!didDrag && sc<=1) openPicker();
              box.style.cursor = sc>1 ? 'grab' : (city[k]?'zoom-in':'pointer');
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);

            /* Doppio click = reset vista */
            box.addEventListener('dblclick', function(e) {
              if (e.target===changeBtn||e.target===removeBtn) return;
              resetView();
            });

            function openPicker() { fI.value=''; fI.click(); }

            function setImg(src) {
              city[k]=src; el.src=src; el.style.display='block';
              ph.style.display='none'; ov.style.display='flex'; hint.style.display='block';
              box.style.borderStyle='solid'; box.style.borderColor='var(--border-soft)';
              box.style.cursor='zoom-in';
              resetView();
              fbSaveWorldbuilding(); saveToStorage();
            }
            function clearImg() {
              city[k]=''; el.style.display='none'; el.src='';
              ph.style.display='flex'; ov.style.display='none'; hint.style.display='none';
              box.style.borderStyle='dashed'; box.style.borderColor='var(--border-subtle)';
              box.style.cursor='pointer';
              resetView();
              fbSaveWorldbuilding(); saveToStorage();
            }

            fI.onchange=function(){
              var file=this.files[0]; if(!file) return;
              var reader=new FileReader(); reader.onload=function(ev){
                var img=new Image(); img.onload=function(){
                  var MAX=1400; var ratio=Math.min(MAX/img.width,MAX/img.height,1);
                  var canvas=document.createElement('canvas');
                  canvas.width=Math.round(img.width*ratio); canvas.height=Math.round(img.height*ratio);
                  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
                  setImg(canvas.toDataURL('image/jpeg',0.85));
                }; img.src=ev.target.result;
              }; reader.readAsDataURL(file);
            };

            changeBtn.onclick=function(e){ e.stopPropagation(); openPicker(); };
            removeBtn.onclick=function(e){ e.stopPropagation(); if(confirm('Rimuovere questa immagine?')) clearImg(); };

            /* Cursore iniziale */
            box.style.cursor = city[k] ? 'zoom-in' : 'pointer';

          })(imgKey, imgBox, imgEl, phDiv, overlay, hintEl);

          cell.appendChild(imgBox);

          /* Pulsante carica file sotto il box */
          var uploadRow = document.createElement('div');
          uploadRow.style.cssText = 'margin-top:0.35rem;';
          var uploadBtn = document.createElement('button');
          uploadBtn.type = 'button'; uploadBtn.className = 'btn-dark';
          uploadBtn.style.cssText = 'width:100%;font-size:11px;justify-content:center;';
          uploadBtn.innerHTML = '📁 Carica immagine (JPEG / PNG)';
          uploadBtn.onclick = function() { fI.value = ''; fI.click(); };
          uploadRow.appendChild(uploadBtn);
          cell.appendChild(uploadRow);

          return cell;
        }

        imgPairGrid.appendChild(makeImagePanel('🗺 Mappa dall\'alto', 'immagineMappaAlto'));
        imgPairGrid.appendChild(makeImagePanel('🏙 Vista dinamica', 'immagineDinamica'));
        cityBody.appendChild(imgPairGrid);

        /* Note città */
        var noteG=document.createElement('div'); noteG.style.marginBottom='0.75rem';
        var noteLblRow=document.createElement('div'); noteLblRow.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:0.25rem;';
        var noteLbl=document.createElement('label'); noteLbl.className='field-label'; noteLbl.style.margin='0'; noteLbl.textContent='Note generali';
        var noteExpandBtn=document.createElement('button'); noteExpandBtn.type='button'; noteExpandBtn.className='btn-dark';
        noteExpandBtn.style.cssText='font-size:9px;padding:0.15rem 0.5rem;font-family:\'Cinzel\',serif;letter-spacing:0.08em;text-transform:uppercase;';
        noteExpandBtn.textContent='⤢ Ingrandisci';
        noteLblRow.appendChild(noteLbl); noteLblRow.appendChild(noteExpandBtn);
        noteG.appendChild(noteLblRow);
        var noteTA=document.createElement('textarea'); noteTA.className='field'; noteTA.rows=2;
        noteTA.placeholder='Atmosfera, storia, situazione attuale…'; noteTA.value=city.note||'';
        (function(c, smallTA, expandBtn) {
          smallTA.oninput=function(){ c.note=this.value; fbSaveWorldbuilding(); saveToStorage(); };
          expandBtn.onclick=function(){
            /* Crea pannello flottante se non già aperto */
            var existingId='note-float-'+c.id;
            if(document.getElementById(existingId)) { document.getElementById(existingId).focus && document.getElementById(existingId).querySelector('textarea').focus(); return; }
            var floatPanel=document.createElement('div');
            floatPanel.id=existingId;
            floatPanel.style.cssText='position:fixed;z-index:99990;background:var(--bg-panel);border:1px solid var(--border-gold);border-radius:6px;box-shadow:0 8px 40px rgba(0,0,0,0.7);min-width:340px;min-height:260px;width:520px;height:420px;resize:both;overflow:hidden;display:flex;flex-direction:column;top:50%;left:50%;transform:translate(-50%,-50%);';
            /* Header draggabile */
            var floatHead=document.createElement('div');
            floatHead.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:var(--bg-card-elevated);border-bottom:1px solid var(--border-gold);cursor:grab;user-select:none;flex-shrink:0;';
            var floatTitle=document.createElement('div'); floatTitle.style.cssText='font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:var(--gold);';
            floatTitle.textContent='📝 Note — ' + (c.nome||'Città');
            var floatClose=document.createElement('button'); floatClose.type='button'; floatClose.className='theme-toggle'; floatClose.style.cssText='width:28px;height:28px;font-size:14px;';
            floatClose.textContent='✕'; floatClose.onclick=function(){ floatPanel.remove(); };
            floatHead.appendChild(floatTitle); floatHead.appendChild(floatClose);
            floatPanel.appendChild(floatHead);
            /* Textarea grande */
            var bigTA=document.createElement('textarea');
            bigTA.style.cssText='flex:1;width:100%;box-sizing:border-box;background:var(--bg-base);color:var(--text-main);font-family:\'EB Garamond\',serif;font-size:16px;line-height:1.65;border:none;outline:none;resize:none;padding:0.75rem 1rem;';
            bigTA.placeholder='Atmosfera, storia, situazione attuale, trame in corso…';
            bigTA.value=c.note||'';
            bigTA.oninput=function(){
              c.note=this.value;
              smallTA.value=this.value;
              fbSaveWorldbuilding(); saveToStorage();
            };
            floatPanel.appendChild(bigTA);
            document.body.appendChild(floatPanel);
            bigTA.focus();
            /* Drag logica */
            var dragging=false, ox=0, oy=0, px=0, py=0;
            floatHead.addEventListener('mousedown',function(e){
              if(e.target===floatClose) return;
              dragging=true; floatHead.style.cursor='grabbing';
              ox=e.clientX; oy=e.clientY;
              var rect=floatPanel.getBoundingClientRect();
              px=rect.left; py=rect.top;
              floatPanel.style.transform='none';
              floatPanel.style.left=px+'px'; floatPanel.style.top=py+'px';
            });
            document.addEventListener('mousemove',function(e){
              if(!dragging) return;
              floatPanel.style.left=(px+(e.clientX-ox))+'px';
              floatPanel.style.top=(py+(e.clientY-oy))+'px';
            });
            document.addEventListener('mouseup',function(){
              if(dragging){ dragging=false; floatHead.style.cursor='grab'; }
            });
          };
        })(city, noteTA, noteExpandBtn);
        noteG.appendChild(noteTA); cityBody.appendChild(noteG);

        /* Sottosezioni: Luoghi / NPC / Loot */
        function makeCityList(labelText, emoji, listKey) {
          if (!city[listKey]) city[listKey]=[];
          var sec=document.createElement('div'); sec.style.marginBottom='0.75rem';
          sec.innerHTML='<label class="field-label">'+emoji+' '+labelText+'</label>';
          var listEl=document.createElement('div');
          function rebuildList() {
            listEl.innerHTML='';
            (city[listKey]||[]).forEach(function(item,ii) {
              var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:0.4rem;padding:0.2rem 0;font-family:\'EB Garamond\',serif;font-size:15px;color:var(--text-main);';
              var txt=document.createElement('span'); txt.textContent=item; txt.style.flex='1'; row.appendChild(txt);
              if (isDM()) {
                var d=document.createElement('button'); d.style.cssText='background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:13px;';
                d.textContent='✕';
                (function(k,i){ d.onclick=function(){ city[k].splice(i,1); fbSaveWorldbuilding(); saveToStorage(); rebuildList(); }; })(listKey,ii);
                row.appendChild(d);
              }
              listEl.appendChild(row);
            });
            if (isDM()) {
              var addR=document.createElement('div'); addR.style.cssText='display:flex;gap:0.35rem;margin-top:0.25rem;';
              var addI=document.createElement('input'); addI.className='field'; addI.placeholder='Aggiungi voce…'; addI.style.flex='1'; addI.style.fontSize='14px';
              var addB=document.createElement('button'); addB.className='btn-dark'; addB.style.cssText='font-size:11px;padding:0.3rem 0.5rem;white-space:nowrap;'; addB.textContent='+ Aggiungi';
              (function(k){ addB.onclick=function(){ var v=addI.value.trim(); if(!v) return; if(!city[k])city[k]=[]; city[k].push(v); fbSaveWorldbuilding(); saveToStorage(); addI.value=''; rebuildList(); }; addI.onkeydown=function(e){if(e.key==='Enter')addB.click();}; })(listKey);
              addR.appendChild(addI); addR.appendChild(addB); listEl.appendChild(addR);
            }
          }
          rebuildList();
          sec.appendChild(listEl); return sec;
        }

        cityBody.appendChild(makeCityList('Luoghi di Interesse','🏛','luoghi'));
        /* Sezione NPC Chiave — NPC archiviati dall'archivio generatore */
        (function(c){
          if (!c.npcChiave) c.npcChiave=[];
          var npcSec=document.createElement('div'); npcSec.style.marginBottom='0.75rem';
          var npcLbl=document.createElement('label'); npcLbl.className='field-label';
          npcLbl.textContent='👤 NPC Chiave (Archivio Città)'; npcSec.appendChild(npcLbl);
          var npcList=document.createElement('div');
          function rebuildNPCList() {
            npcList.innerHTML='';
            var npcArr=c.npcChiave.filter(function(n){ return n && typeof n==='object'; });
            if(npcArr.length===0){
              var emp=document.createElement('div');
              emp.style.cssText='font-family:\'EB Garamond\',serif;font-size:14px;color:var(--text-faint);font-style:italic;padding:0.3rem 0;';
              emp.textContent='Nessun NPC. Usa 📦 nell\'archivio del Generatore per archiviare un NPC qui.';
              npcList.appendChild(emp); return;
            }
            npcArr.forEach(function(npc,ni){
              var row=document.createElement('div'); row.className='city-npc-item';
              var thumb=document.createElement('div'); thumb.className='city-npc-thumb';
              if(npc.immagine){ var img=document.createElement('img'); img.src=npc.immagine; img.alt=npc.nome||''; thumb.appendChild(img); }
              else { thumb.innerHTML=ICON.npc; }
              row.appendChild(thumb);
              var info=document.createElement('div'); info.className='city-npc-info';
              var nName=document.createElement('div'); nName.className='city-npc-name'; nName.textContent=npc.nome||'(senza nome)';
              var nRole=document.createElement('div'); nRole.className='city-npc-role';
              nRole.textContent=(npc.ruolo||'')+(npc.eta?' · '+npc.eta+' anni':'')+(npc.stato&&npc.stato!=='vivo'?' '+(npc.stato==='ferito'?'🩸':'☠'):'');
              info.appendChild(nName); info.appendChild(nRole); row.appendChild(info);
              var reabBtn=document.createElement('button'); reabBtn.className='btn-reabilita';
              reabBtn.textContent='⬆ Riabilita';
              (function(n,i){ reabBtn.onclick=function(){
                var restored=JSON.parse(JSON.stringify(n));
                restored._id=restored._id||('npc_ria_'+Date.now()+'_'+i);
                state.personaggi.push(restored);
                var fresh=c.npcChiave.filter(function(x){ return x&&typeof x==='object'; });
                fresh.splice(i,1);
                c.npcChiave=fresh;
                fbSavePersonaggi(); fbSaveWorldbuilding(); saveToStorage();
                notify('"'+(n.nome||'NPC')+'" riabilitato nell\'archivio del Generatore NPC.');
                rebuildNPCList();
              }; })(npc,ni);
              row.appendChild(reabBtn); npcList.appendChild(row);
            });
          }
          rebuildNPCList();
          npcSec.appendChild(npcList); cityBody.appendChild(npcSec);
        })(city);

        /* Loot & Segreti - textarea */
        var lootG=document.createElement('div');
        lootG.innerHTML='<label class="field-label">💎 Loot & Segreti</label>';
        var lootTA=document.createElement('textarea'); lootTA.className='field'; lootTA.rows=3;
        lootTA.placeholder='Oggetti nascosti, segreti della città, trame…'; lootTA.value=city.lootSegreti||'';
        (function(c){ lootTA.onchange=function(){ c.lootSegreti=this.value; fbSaveWorldbuilding(); saveToStorage(); }; })(city);
        lootG.appendChild(lootTA); cityBody.appendChild(lootG);

        cityCard.appendChild(cityHdr); cityCard.appendChild(cityBody);
        zonaBody.appendChild(cityCard);
      });

      /* Aggiungi città */
      if (isDM()) {
        var addCittaRow=document.createElement('div');
        addCittaRow.style.cssText='display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem;flex-wrap:wrap;';
        var cittaI=document.createElement('input'); cittaI.type='text'; cittaI.className='field';
        cittaI.placeholder='Nome città…'; cittaI.style.flex='1'; cittaI.style.minWidth='140px';
        var tipoSel=document.createElement('select'); tipoSel.className='field';
        tipoSel.style.cssText='flex:0 1 140px;min-width:100px;';
        ['città','villaggio','dungeon','fortezza','altro'].forEach(function(t){
          var o=document.createElement('option'); o.value=t; o.textContent=t;
          tipoSel.appendChild(o);
        });
        var addCittaBtn=document.createElement('button'); addCittaBtn.className='btn-gold';
        addCittaBtn.style.cssText='white-space:nowrap;font-size:12px;';
        addCittaBtn.textContent='+ Città';
        (function(z){ addCittaBtn.onclick=function(){
          var n=cittaI.value.trim(); if(!n){notify('Inserisci il nome della città.','err');return;}
          if(!z.citta)z.citta=[];
          z.citta.push({id:'c_'+Date.now(),nome:n,tipo:tipoSel.value,note:'',luoghi:[],npcChiave:[],lootSegreti:'',immagineMappaAlto:'',immagineDinamica:''});
          fbSaveWorldbuilding(); saveToStorage(); cittaI.value=''; renderMain();
        }; cittaI.onkeydown=function(e){if(e.key==='Enter')addCittaBtn.click();}; })(zone);
        addCittaRow.appendChild(cittaI); addCittaRow.appendChild(tipoSel); addCittaRow.appendChild(addCittaBtn);
        zonaBody.appendChild(addCittaRow);
      }

      zonaEl.appendChild(zonaHdr); zonaEl.appendChild(zonaBody);
      body.appendChild(zonaEl);
    });
  }

  wrap.appendChild(body);
  return wrap;
}


/* ============================================================================
   SEZIONE 6: STATISTICHE PARTY & RUOTA DEL CAOS (renderCaos)
   ============================================================================ */
function renderCaos() {
  var wrap = document.createElement('div');

  /* HEADER */
  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';
  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  top.innerHTML =
    '<div>' +
      '<div class="header-eyebrow mb-3"><span>Cronaca del Fato</span></div>' +
      '<h1 class="header-title">Statistiche & Caos</h1>' +
      '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Contatori del destino e Orologio della Tensione</p>' +
    '</div>';
  hc.appendChild(top);

  var fd = document.createElement('div');
  fd.className = 'filigree-divider mt-7';
  hc.appendChild(fd);

  var notice = document.createElement('div');
  notice.className = 'notice mt-5';
  notice.innerHTML =
    '<strong style="color:var(--gold);font-style:normal;">\u{1F3B2} Promemoria del Fato: </strong>' +
    'tieni traccia dei <em>1 naturali</em> (fallimenti critici) e dei <em>20 naturali</em> (successi critici) di ogni giocatore. ' +
    'Al raggiungere certe soglie, animazioni speciali appariranno: <em>3 = leggera, 4 = intensa, 5+ = devastante</em>. ' +
    'I contatori sono salvati nel browser e sopravvivono al ricaricamento della pagina.';
  hc.appendChild(notice);
  header.appendChild(hc);
  wrap.appendChild(header);

  /* BODY */
  var section = document.createElement('section');
  section.className = 'caos-wrap pb-20';
  section.style.cssText = 'padding-top:2rem;';

  var grid = document.createElement('div');
  grid.className = 'caos-grid';

  /* === COLONNA SX: COUNTER DEL DESTINO === */
  var left = document.createElement('div');

  var sectionTitle = document.createElement('div');
  sectionTitle.className = 'counter-section-title';
  sectionTitle.innerHTML = '<span>\u269C Counter del Destino \u269C</span>';
  left.appendChild(sectionTitle);

  /* Toolbar azioni */
  var actions = document.createElement('div');
  actions.className = 'caos-actions';

  var addBtn = document.createElement('button');
  addBtn.className = 'btn-gold';
  addBtn.style.cssText = 'padding:0.5rem 0.85rem;';
  addBtn.innerHTML = ICON.plus + ' Aggiungi Giocatore';
  addBtn.onclick = function() {
    state.caosPlayers.push(makeCaosPlayer(''));
    saveToStorage();
    fbSaveCaos();
    renderCaosBody();
    setTimeout(function() {
      var inputs = document.querySelectorAll('.player-row-name-input');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 0);
  };
  if (isDM()) actions.appendChild(addBtn);

  var importBtn = document.createElement('button');
  importBtn.className = 'btn-dark';
  importBtn.style.cssText = 'padding:0.5rem 0.85rem;';
  importBtn.innerHTML = ICON.swords + ' Importa da Iniziativa';
  importBtn.onclick = function() {
    var imported = 0;
    var existingNames = state.caosPlayers.map(function(p) { return (p.nome || '').toLowerCase().trim(); });
    state.combatants.forEach(function(c) {
      if (!c.nome || !c.nome.trim()) return;
      if (c.tipo !== 'pg') return;
      var nm = c.nome.trim();
      if (existingNames.indexOf(nm.toLowerCase()) >= 0) return;
      state.caosPlayers.push(makeCaosPlayer(nm));
      existingNames.push(nm.toLowerCase());
      imported++;
    });
    if (imported > 0) {
      saveToStorage();
      fbSaveCaos();
      renderCaosBody();
      notify('Importati ' + imported + ' PG dall\'iniziativa.');
    } else {
      notify('Nessun nuovo PG da importare.', 'err');
    }
  };
  if (isDM()) actions.appendChild(importBtn);

  var clearBtn = document.createElement('button');
  clearBtn.className = 'btn-blood';
  clearBtn.style.cssText = 'padding:0.5rem 0.85rem;margin-left:auto;';
  clearBtn.innerHTML = ICON.refresh + ' Azzera Contatori';
  clearBtn.onclick = function() {
    if (state.caosPlayers.length === 0) return;
    if (!confirm('Azzerare tutti i contatori (1 e 20 naturali) di tutti i giocatori? I nomi resteranno.')) return;
    state.caosPlayers.forEach(function(p) { p.fail = 0; p.succ = 0; });
    saveToStorage();
    fbSaveCaos();
    renderCaosBody();
    notify('Contatori azzerati.');
  };
  if (isDM()) actions.appendChild(clearBtn);

  left.appendChild(actions);

  var playersWrap = document.createElement('div');
  playersWrap.id = 'caos-players-wrap';
  left.appendChild(playersWrap);

  grid.appendChild(left);

  /* === COLONNA DX: D20 DELLA CONDANNA === */
  var right = document.createElement('div');
  right.id = 'caos-doom-col';
  grid.appendChild(right);

  section.appendChild(grid);
  wrap.appendChild(section);

  /* Render dopo che il DOM è pronto */
  setTimeout(function() {
    renderCaosPlayers();
    renderDoomWheel();
  }, 0);

  return wrap;
}

function renderCaosBody() {
  renderCaosPlayers();
  /* La doom-wheel non dipende dai players, non serve ridipingerla */
}

function renderCaosPlayers() {
  var wrap = document.getElementById('caos-players-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (state.caosPlayers.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'empty-state panel-glass';
    empty.style.cssText = 'padding:3rem 1.5rem;';
    empty.innerHTML =
      '<div class="rune">\u{1F3B2}</div>' +
      '<h2>Nessun giocatore registrato</h2>' +
      '<p>Aggiungi i tuoi PG manualmente o importali dalla sezione Iniziativa.</p>';
    wrap.appendChild(empty);
    return;
  }

  var list = document.createElement('div');
  list.className = 'player-counters';

  state.caosPlayers.forEach(function(player) {
    list.appendChild(renderPlayerRow(player));
  });

  wrap.appendChild(list);
}

/* ===========================================================
   SVG HELPERS — Forme procedurali per le animazioni rituali
   =========================================================== */

/* Pentacolo (soglia 4 fail): stella a 5 punte iscritta in cerchio,
   con stroke-dasharray controllato dal CSS per il drawing. */
function svgPentacle() {
  /* Calcoliamo i 5 vertici della stella su un cerchio di raggio 36, centro (40,40).
     Stella a 5 punte si disegna unendo i vertici a salto di 2 (pentagramma). */
  var cx = 40, cy = 40, r = 32;
  var pts = [];
  for (var i = 0; i < 5; i++) {
    var a = (-90 + i * 72) * Math.PI / 180;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  var order = [0, 2, 4, 1, 3, 0];
  var d = 'M ' + pts[order[0]].x.toFixed(1) + ' ' + pts[order[0]].y.toFixed(1);
  for (var k = 1; k < order.length; k++) {
    d += ' L ' + pts[order[k]].x.toFixed(1) + ' ' + pts[order[k]].y.toFixed(1);
  }
  return '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">' +
    '<circle class="pentacle-circle" cx="40" cy="40" r="35"/>' +
    '<path class="pentacle-star" d="' + d + '"/>' +
    '</svg>';
}

/* Pentacolo fiammeggiante (soglia 5 fail): versione più decorata,
   con cerchio interno riempito e doppio bordo. */
function svgPentacleBurning() {
  var cx = 45, cy = 45, r = 38;
  var pts = [];
  for (var i = 0; i < 5; i++) {
    var a = (-90 + i * 72) * Math.PI / 180;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  var order = [0, 2, 4, 1, 3, 0];
  var d = 'M ' + pts[order[0]].x.toFixed(1) + ' ' + pts[order[0]].y.toFixed(1);
  for (var k = 1; k < order.length; k++) {
    d += ' L ' + pts[order[k]].x.toFixed(1) + ' ' + pts[order[k]].y.toFixed(1);
  }
  return '<svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">' +
    '<circle class="pentacle-inner-circle" cx="45" cy="45" r="20"/>' +
    '<circle class="pentacle-circle" cx="45" cy="45" r="42"/>' +
    '<circle class="pentacle-circle" cx="45" cy="45" r="38"/>' +
    '<path class="pentacle-star" d="' + d + '"/>' +
    /* Rune brevi attorno al cerchio esterno per "carattere occulto" */
    '<g stroke="#ffaa30" stroke-width="1" fill="none" opacity="0.7">' +
      '<path d="M 45 2 L 45 6 M 43 4 L 47 4"/>' +
      '<path d="M 81 27 L 84 31 M 81 31 L 84 27"/>' +
      '<path d="M 81 60 L 84 62 L 81 64 M 84 60 L 84 64"/>' +
      '<path d="M 45 84 L 45 88 M 41 86 L 49 86"/>' +
      '<path d="M 6 60 L 9 64 M 6 64 L 9 60"/>' +
      '<path d="M 6 27 L 9 25 L 9 31 L 6 29"/>' +
    '</g>' +
    '</svg>';
}

/* Mano spettrale stilizzata (semplice silhouette) */
function svgSpectralHand(side) {
  /* Una mano stilizzata: palmo + 5 dita orientate verso il centro.
     L'animazione di traccia è gestita dal CSS via rotazione su
     transform-origin esterno. */
  var flipAttr = side === 'right' ? ' transform="scale(-1,1) translate(-32,0)"' : '';
  return '<div class="hand ' + side + '">' +
    '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" width="32" height="32">' +
    '<g' + flipAttr + ' fill="currentColor">' +
      /* Palmo */
      '<path d="M 14 14 Q 10 13 8 17 Q 7 22 10 26 L 22 26 Q 26 24 24 18 Q 22 13 18 14 Z" opacity="0.85"/>' +
      /* Dita allungate */
      '<path d="M 11 16 Q 9 11 7 8 Q 6 6 8 5 Q 10 5 11 9 Z" opacity="0.85"/>' +
      '<path d="M 14 14 Q 13 8 13 3 Q 13 1 15 1 Q 17 1 17 4 Q 17 10 17 14 Z" opacity="0.85"/>' +
      '<path d="M 18 14 Q 19 9 21 5 Q 22 3 24 4 Q 25 5 24 8 Q 22 12 20 15 Z" opacity="0.85"/>' +
      '<path d="M 21 16 Q 24 13 27 11 Q 29 10 30 12 Q 30 14 27 16 Q 24 18 22 19 Z" opacity="0.8"/>' +
    '</g>' +
    '</svg>' +
    '</div>';
}

/* Figura in preghiera (soglia 4 succ): sagoma stilizzata di
   persona inginocchiata con mani giunte. */
function svgPrayingFigure() {
  return '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">' +
    /* Glow di sfondo (multipli cerchi concentrici sottili) */
    '<circle class="figure-glow" cx="36" cy="40" r="32" opacity="0.4"/>' +
    '<circle class="figure-glow" cx="36" cy="40" r="26" opacity="0.55"/>' +
    /* Sagoma: testa */
    '<circle class="figure-body" cx="36" cy="18" r="6"/>' +
    /* Aureola */
    '<ellipse class="angel-halo" cx="36" cy="15" rx="9" ry="2.5" fill="none" stroke="#fff0b0" stroke-width="1.2"/>' +
    /* Corpo (forma genuflessa, mani giunte) */
    '<path class="figure-body" d="' +
      'M 36 25 ' +
      'Q 28 28 26 38 ' +
      'Q 25 48 28 54 ' +
      'L 44 54 ' +
      'Q 47 48 46 38 ' +
      'Q 44 28 36 25 ' +
      'Z"/>' +
    /* Mani giunte (rombo davanti al petto) */
    '<path class="figure-body" d="M 36 30 L 40 36 L 36 42 L 32 36 Z" opacity="0.95"/>' +
    /* Base/piedi piegati */
    '<path class="figure-body" d="M 24 54 L 48 54 L 50 60 L 22 60 Z"/>' +
    '</svg>';
}

/* Angelo maestoso (soglia 5+ succ): silhouette frontale con ali estese,
   aureola e veste. Le ali sono separate per essere animate via CSS. */
function svgAngel() {
  return '<svg viewBox="0 0 130 100" xmlns="http://www.w3.org/2000/svg">' +
    /* Ala sinistra */
    '<path class="wing-left" d="' +
      'M 65 30 ' +
      'Q 35 15 8 25 ' +
      'Q 6 30 14 32 ' +
      'Q 25 33 32 38 ' +
      'Q 20 40 14 48 ' +
      'Q 18 52 28 50 ' +
      'Q 38 49 50 48 ' +
      'L 65 45 Z"/>' +
    /* Ala destra */
    '<path class="wing-right" d="' +
      'M 65 30 ' +
      'Q 95 15 122 25 ' +
      'Q 124 30 116 32 ' +
      'Q 105 33 98 38 ' +
      'Q 110 40 116 48 ' +
      'Q 112 52 102 50 ' +
      'Q 92 49 80 48 ' +
      'L 65 45 Z"/>' +
    /* Aureola */
    '<ellipse class="angel-halo" cx="65" cy="22" rx="14" ry="3"/>' +
    /* Testa */
    '<circle class="angel-body" cx="65" cy="28" r="6"/>' +
    /* Corpo (lunga veste) */
    '<path class="angel-body" d="' +
      'M 65 35 ' +
      'Q 56 38 54 50 ' +
      'Q 52 65 56 80 ' +
      'Q 60 95 65 95 ' +
      'Q 70 95 74 80 ' +
      'Q 78 65 76 50 ' +
      'Q 74 38 65 35 Z"/>' +
    /* Riflesso/luce sul petto */
    '<path d="M 60 45 Q 65 42 70 45 Q 68 52 65 55 Q 62 52 60 45 Z" fill="rgba(255,250,220,0.5)"/>' +
    '</svg>';
}

/* Cuore Minecraft Hardcore stilizzato — facce cattive (Prono).
   Stile pixel-art: blocchi 22x22, occhi vuoti, ghigno spigoloso. */
function svgHardcoreHeart() {
  return '<div class="mc-heart">' +
    '<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">' +
    /* Corpo del cuore — pixel art rosso scuro hardcore */
    '<g>' +
      /* Riga 1 (top) — due "lobi" */
      '<rect x="3" y="3" width="6" height="2" fill="#a01818"/>' +
      '<rect x="13" y="3" width="6" height="2" fill="#a01818"/>' +
      /* Riga 2 — lobi più larghi */
      '<rect x="2" y="5" width="8" height="2" fill="#c83030"/>' +
      '<rect x="12" y="5" width="8" height="2" fill="#c83030"/>' +
      /* Riga 3 — ponte centrale */
      '<rect x="2" y="7" width="18" height="2" fill="#c83030"/>' +
      /* Riga 4 */
      '<rect x="2" y="9" width="18" height="2" fill="#a82020"/>' +
      /* Riga 5 — restringimento */
      '<rect x="3" y="11" width="16" height="2" fill="#a82020"/>' +
      /* Riga 6 */
      '<rect x="4" y="13" width="14" height="2" fill="#881818"/>' +
      /* Riga 7 */
      '<rect x="6" y="15" width="10" height="2" fill="#881818"/>' +
      /* Riga 8 — punta */
      '<rect x="8" y="17" width="6" height="2" fill="#601010"/>' +
      '<rect x="10" y="19" width="2" height="1" fill="#601010"/>' +
    '</g>' +
    /* Highlight pixel art (in alto a sx) */
    '<g>' +
      '<rect x="4" y="5" width="2" height="2" fill="#ff5050"/>' +
      '<rect x="3" y="7" width="2" height="2" fill="#ff5050"/>' +
    '</g>' +
    /* Faccia cattiva: occhi vuoti + bocca arcigna */
    '<g fill="#1a0606">' +
      /* Occhi inclinati arrabbiati */
      '<rect x="7" y="8" width="2" height="2"/>' +
      '<rect x="6" y="9" width="2" height="1"/>' +
      '<rect x="13" y="8" width="2" height="2"/>' +
      '<rect x="14" y="9" width="2" height="1"/>' +
      /* Bocca a ghigno */
      '<rect x="9" y="12" width="4" height="1"/>' +
      '<rect x="8" y="13" width="1" height="1"/>' +
      '<rect x="13" y="13" width="1" height="1"/>' +
    '</g>' +
    /* Bordo nero esterno per definire il cuore */
    '<g fill="#1a0606">' +
      '<rect x="2" y="3" width="1" height="2"/>' +
      '<rect x="9" y="3" width="4" height="2" fill="#1a0606" opacity="0"/>' +
      '<rect x="9" y="3" width="1" height="1"/>' +
      '<rect x="12" y="3" width="1" height="1"/>' +
      '<rect x="19" y="3" width="1" height="2"/>' +
      '<rect x="1" y="5" width="1" height="2"/>' +
      '<rect x="20" y="5" width="1" height="2"/>' +
      '<rect x="1" y="7" width="1" height="4"/>' +
      '<rect x="20" y="7" width="1" height="4"/>' +
      '<rect x="2" y="11" width="1" height="2"/>' +
      '<rect x="19" y="11" width="1" height="2"/>' +
      '<rect x="3" y="13" width="1" height="2"/>' +
      '<rect x="18" y="13" width="1" height="2"/>' +
      '<rect x="5" y="15" width="1" height="2"/>' +
      '<rect x="16" y="15" width="1" height="2"/>' +
      '<rect x="7" y="17" width="1" height="2"/>' +
      '<rect x="14" y="17" width="1" height="2"/>' +
      '<rect x="9" y="19" width="1" height="1"/>' +
      '<rect x="12" y="19" width="1" height="1"/>' +
      '<rect x="10" y="20" width="2" height="1"/>' +
    '</g>' +
    '</svg>' +
    '</div>';
}

function renderPlayerRow(player) {
  var row = document.createElement('div');
  var lvlClass = getPlayerRowClasses(player);
  row.className = 'player-row' + (lvlClass ? ' ' + lvlClass : '');

  /* ===== Layer di animazione in base ai livelli ===== */
  /* Le animazioni base (aure, glow, pulse) sono nel CSS della classe .lvlN-*.
     Qui aggiungiamo solo gli elementi DOM extra necessari per gli effetti
     più complessi (rito oscuro, apocalisse, devozione, intervento divino). */
  var failLvl = getCounterLevel(player.fail);
  var succLvl = getCounterLevel(player.succ);
  var domFail = failLvl >= succLvl && failLvl > 0;
  var domSucc = succLvl > failLvl && succLvl > 0;

  if (domFail) {
    if (failLvl === 1) {
      /* Soglia 3: solo aura rossa (interamente CSS via ::before).
         Nessun layer DOM aggiuntivo necessario. */
    } else if (failLvl === 2) {
      /* Soglia 4 — RITO OSCURO: mani spettrali che disegnano il pentacolo */
      var hands = document.createElement('div');
      hands.className = 'fx-spectral-hands';
      hands.innerHTML = svgSpectralHand('left') + svgSpectralHand('right');
      row.appendChild(hands);
      var pentacle = document.createElement('div');
      pentacle.className = 'fx-pentacle';
      pentacle.innerHTML = svgPentacle();
      row.appendChild(pentacle);
    } else if (failLvl >= 3) {
      /* Soglia 5+ — APOCALISSE: pentacolo completo fiammeggiante,
         lampi rossi, fumo nero alla base */
      var pentacleBurn = document.createElement('div');
      pentacleBurn.className = 'fx-pentacle-burning';
      pentacleBurn.innerHTML = svgPentacleBurning();
      row.appendChild(pentacleBurn);
      var smoke = document.createElement('div');
      smoke.className = 'fx-black-smoke';
      row.appendChild(smoke);
      var lightning = document.createElement('div');
      lightning.className = 'fx-lightning';
      lightning.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
      row.appendChild(lightning);
    }
  } else if (domSucc) {
    if (succLvl === 1) {
      /* Soglia 3: solo aura dorata (CSS via ::before).
         Nessun layer DOM aggiuntivo. */
    } else if (succLvl === 2) {
      /* Soglia 4 — DEVOZIONE: figura in preghiera + particelle di luce che salgono */
      var prayer = document.createElement('div');
      prayer.className = 'fx-praying-figure';
      prayer.innerHTML = svgPrayingFigure();
      row.appendChild(prayer);
      var lightParts = document.createElement('div');
      lightParts.className = 'fx-light-particles';
      lightParts.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>';
      row.appendChild(lightParts);
    } else if (succLvl >= 3) {
      /* Soglia 5+ — INTERVENTO DIVINO: angelo SVG, raggi di sfondo,
         luce accecante che emana dai bordi */
      var raysBg = document.createElement('div');
      raysBg.className = 'fx-divine-rays-bg';
      row.appendChild(raysBg);
      var angel = document.createElement('div');
      angel.className = 'fx-angel';
      angel.innerHTML = svgAngel();
      row.appendChild(angel);
      var divineLight = document.createElement('div');
      divineLight.className = 'fx-divine-light';
      row.appendChild(divineLight);
    }
  }

  /* ===== Contenuto effettivo della riga ===== */

  /* Nome (input modificabile) */
  var nameWrap = document.createElement('div');
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'player-row-name-input';
  nameInput.value = player.nome;
  nameInput.placeholder = 'Nome del giocatore...';
  nameInput.dataset.pid = player.id;
  nameInput.oninput = function() {
    player.nome = this.value;
    saveToStorage();
    if (_fbSaveCaosNomeTimer) clearTimeout(_fbSaveCaosNomeTimer);
    _fbSaveCaosNomeTimer = setTimeout(fbSaveCaos, 600);
  };
  nameWrap.appendChild(nameInput);
  row.appendChild(nameWrap);

  /* Counter Fail (1 naturale) */
  row.appendChild(renderD20Counter(player, 'fail'));

  /* Counter Success (20 naturale) */
  row.appendChild(renderD20Counter(player, 'succ'));

  /* Azione: rimuovi — solo DM */
  var actions = document.createElement('div');
  actions.className = 'player-row-actions';
  if (isDM()) {
    var del = document.createElement('button');
    del.className = 'row-delete';
    del.title = 'Rimuovi giocatore';
    del.innerHTML = ICON.x;
    del.onclick = function() {
      if (!confirm('Rimuovere ' + (player.nome || 'questo giocatore') + ' dalla cronaca?')) return;
      state.caosPlayers = state.caosPlayers.filter(function(p) { return p.id !== player.id; });
      saveToStorage();
      fbSaveCaos();
      renderCaosBody();
    };
    actions.appendChild(del);
  }
  row.appendChild(actions);

  return row;
}

function renderD20Counter(player, kind) {
  var isFail = (kind === 'fail');
  var count = isFail ? player.fail : player.succ;

  var wrap = document.createElement('div');
  wrap.className = 'd20-counter' + (isFail ? ' crit-fail' : ' crit-success');

  /* Icona D20 */
  var icon = document.createElement('div');
  icon.className = 'd20-icon';
  icon.innerHTML = d20IconSvg(isFail);
  wrap.appendChild(icon);

  /* Numero */
  var num = document.createElement('div');
  num.className = 'd20-count ' + (isFail ? 'fail-color' : 'succ-color');
  num.textContent = count;
  wrap.appendChild(num);

  /* Frecce */
  var arrows = document.createElement('div');
  arrows.className = 'd20-arrows';

  var up = document.createElement('button');
  up.className = 'd20-arrow';
  up.title = 'Incrementa';
  up.innerHTML = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6 L5 3 L8 6"/></svg>';
  up.disabled = !isDM();
  up.style.opacity = isDM() ? '' : '0.35';
  up.onclick = function() {
    if (!isDM()) return;
    if (isFail) player.fail++;
    else player.succ++;
    saveToStorage();
    fbSaveCaos();
    renderCaosPlayers();
  };
  arrows.appendChild(up);

  var down = document.createElement('button');
  down.className = 'd20-arrow';
  down.title = 'Decrementa';
  down.innerHTML = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4 L5 7 L8 4"/></svg>';
  down.disabled = !isDM();
  down.style.opacity = isDM() ? '' : '0.35';
  down.onclick = function() {
    if (!isDM()) return;
    if (isFail) { if (player.fail > 0) player.fail--; }
    else { if (player.succ > 0) player.succ--; }
    saveToStorage();
    fbSaveCaos();
    renderCaosPlayers();
  };
  arrows.appendChild(down);

  wrap.appendChild(arrows);
  return wrap;
}

/* Icona D20 stilizzata: '1' rosso o '20' oro */
function d20IconSvg(isFail) {
  var color = isFail ? '#d83030' : '#ffd870';
  var outlineColor = isFail ? '#5a1010' : '#7a5818';
  var fillColor = isFail ? '#2a0a0a' : '#2a1e08';
  var text = isFail ? '1' : '20';
  var fontSize = isFail ? '13' : '11';
  return '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">' +
    /* esagono d20 a forma di losanga */
    '<polygon points="20,3 36,12 36,28 20,37 4,28 4,12" fill="' + fillColor + '" stroke="' + outlineColor + '" stroke-width="1.5"/>' +
    '<polygon points="20,3 36,12 28,18 12,18 4,12" fill="rgba(255,255,255,0.05)"/>' +
    '<polygon points="20,37 4,28 12,22 28,22 36,28" fill="rgba(0,0,0,0.3)"/>' +
    '<text x="20" y="25" text-anchor="middle" font-family="Cinzel, serif" font-weight="800" font-size="' + fontSize + '" fill="' + color + '" style="text-shadow: 0 0 6px ' + color + '">' + text + '</text>' +
    '</svg>';
}

/* ===========================================================
   D20 DELLA CONDANNA — Orologio della Tensione
   =========================================================== */

function renderDoomWheel() {
  var col = document.getElementById('caos-doom-col');
  if (!col) return;
  col.innerHTML = '';

  var panel = document.createElement('div');
  panel.className = 'condanna-panel doom-stage-' + state.doomStage;
  if (state.doomTransforming) panel.classList.add('doom-shaking');

  var title = document.createElement('div');
  title.className = 'condanna-title';
  if (state.doomStage === 1) title.textContent = 'D6 della Condanna';
  else if (state.doomStage === 2) title.textContent = 'D8 della Condanna';
  else title.textContent = 'D20 INFERNALE';
  panel.appendChild(title);

  var sub = document.createElement('div');
  sub.className = 'condanna-sub';
  if (state.doomStage === 1) sub.textContent = 'Stadio I — l\'orologio della tensione inizia a battere.';
  else if (state.doomStage === 2) sub.textContent = 'Stadio II — la pressione cresce, gli spicchi si stringono.';
  else sub.textContent = 'Stadio III — emerso dagli inferi. Ogni clic illumina una faccia con luce lavica.';
  panel.appendChild(sub);

  /* Wheel — diverso per stadio 1/2 (anello di spicchi) vs stadio 3 (D20 3D) */
  var wheelWrap = document.createElement('div');
  wheelWrap.className = 'doom-wheel-wrap';

  if (state.doomStage < 3) {
    wheelWrap.appendChild(buildSpicchiWheel());
  } else {
    wheelWrap.appendChild(buildD20Stage3());
  }

  /* Teschio centrale cliccabile (sempre presente) */
  var skull = document.createElement('button');
  var totalSeg = doomSegmentsForStage(state.doomStage);
  skull.className = 'doom-skull-btn doom-skull-stage-' + state.doomStage +
    (state.doomFilled >= totalSeg ? ' full' : '') +
    (state.doomTransforming ? ' transforming' : '');
  skull.title = 'Clicca per avanzare la Condanna';
  skull.textContent = '\u{1F480}';
  skull.disabled = state.doomTransforming;
  skull.onclick = onSkullClick;
  wheelWrap.appendChild(skull);

  /* Layer per particelle di cenere durante la trasformazione */
  if (state.doomTransforming) {
    var ash = document.createElement('div');
    ash.className = 'doom-ash-layer';
    var ashHtml = '';
    for (var ai = 0; ai < 24; ai++) ashHtml += '<span class="ash-particle"></span>';
    ash.innerHTML = ashHtml;
    wheelWrap.appendChild(ash);
  }

  panel.appendChild(wheelWrap);

  /* Indicatore di stadio */
  var stageInd = document.createElement('div');
  stageInd.className = 'doom-stage-indicator';
  stageInd.innerHTML =
    '<span class="stage-dot' + (state.doomStage >= 1 ? ' active' : '') + (state.doomStage === 1 ? ' current' : '') + '">D6</span>' +
    '<span class="stage-arrow">\u25B6</span>' +
    '<span class="stage-dot' + (state.doomStage >= 2 ? ' active' : '') + (state.doomStage === 2 ? ' current' : '') + '">D8</span>' +
    '<span class="stage-arrow">\u25B6</span>' +
    '<span class="stage-dot' + (state.doomStage >= 3 ? ' active' : '') + (state.doomStage === 3 ? ' current final' : '') + '">D20</span>';
  panel.appendChild(stageInd);

  /* Progresso testuale */
  var prog = document.createElement('div');
  prog.className = 'doom-progress';
  prog.innerHTML = 'Tensione: <strong>' + state.doomFilled + ' / ' + totalSeg + '</strong>';
  panel.appendChild(prog);

  /* Controlli — solo DM */
  if (isDM()) {
    var ctrl = document.createElement('div');
    ctrl.className = 'doom-controls';

    var resetBtn = document.createElement('button');
    resetBtn.textContent = 'Azzera Tensione';
    resetBtn.disabled = state.doomTransforming;
    resetBtn.onclick = function() {
      if (state.doomFilled === 0) return;
      state.doomFilled = 0;
      saveToStorage();
      fbSaveCaos();
      renderDoomWheel();
    };
    ctrl.appendChild(resetBtn);

    var stageResetBtn = document.createElement('button');
    stageResetBtn.textContent = 'Reset Stadio';
    stageResetBtn.disabled = state.doomTransforming;
    stageResetBtn.title = 'Riporta tutto allo Stadio I (D6)';
    stageResetBtn.onclick = function() {
      if (!confirm('Riportare la Condanna allo Stadio I (D6)? L\'evoluzione narrativa verrà annullata.')) return;
      state.doomStage = 1;
      state.doomFilled = 0;
      state.doomTransforming = false;
      saveToStorage();
      fbSaveCaos();
      renderDoomWheel();
    };
    ctrl.appendChild(stageResetBtn);

    panel.appendChild(ctrl);
  }
  col.appendChild(panel);

  /* Render timer subito sotto il dado — solo DM */
  if (isDM()) renderDmTimer();
}

/* ===========================================================
   TIMER DM
   =========================================================== */
var _timerState = {
  totalSec: 0,       /* secondi impostati */
  remaining: 0,      /* secondi rimanenti */
  running: false,
  interval: null
};

function _timerTick() {
  if (!_timerState.running) return;
  _timerState.remaining = Math.max(0, _timerState.remaining - 1);
  renderDmTimer();
  if (_timerState.remaining === 0) {
    _timerState.running = false;
    clearInterval(_timerState.interval);
    _timerState.interval = null;
    /* Lampeggia urgente già gestito dal CSS con classe urgent */
  }
}

function renderDmTimer() {
  var col = document.getElementById('caos-doom-col');
  if (!col) return;

  var existing = document.getElementById('dm-timer-widget');
  if (existing) existing.remove();

  var wrap = document.createElement('div');
  wrap.className = 'dm-timer-wrap';
  wrap.id = 'dm-timer-widget';

  /* Titolo */
  var ttl = document.createElement('div'); ttl.className = 'dm-timer-title';
  ttl.textContent = '⏱ Timer';
  wrap.appendChild(ttl);

  /* Display */
  var mm = Math.floor(_timerState.remaining / 60);
  var ss = _timerState.remaining % 60;
  var displayStr = String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
  var disp = document.createElement('div');
  var isUrgent = _timerState.remaining > 0 && _timerState.remaining <= 10;
  disp.className = 'dm-timer-display' +
    (_timerState.running ? (isUrgent ? ' urgent' : ' running') : (isUrgent ? ' urgent' : ''));
  disp.textContent = displayStr;
  wrap.appendChild(disp);

  /* Preset rapidi */
  var presetsDiv = document.createElement('div'); presetsDiv.className = 'dm-timer-presets';
  [[30,'30s'],[60,'1m'],[120,'2m'],[300,'5m'],[600,'10m']].forEach(function(p) {
    var btn = document.createElement('button'); btn.className = 'dm-timer-preset';
    btn.textContent = p[1];
    btn.onclick = function() {
      if (_timerState.interval) clearInterval(_timerState.interval);
      _timerState.totalSec   = p[0];
      _timerState.remaining  = p[0];
      _timerState.running    = false;
      _timerState.interval   = null;
      renderDmTimer();
    };
    presetsDiv.appendChild(btn);
  });
  wrap.appendChild(presetsDiv);

  /* Input manuale mm:ss */
  var setRow = document.createElement('div'); setRow.className = 'dm-timer-set-row';
  var inpM = document.createElement('input'); inpM.type='number'; inpM.className='dm-timer-input';
  inpM.min='0'; inpM.max='99'; inpM.value=String(Math.floor(_timerState.totalSec/60)); inpM.placeholder='mm';
  var sep = document.createElement('span'); sep.className='dm-timer-sep'; sep.textContent=':';
  var inpS = document.createElement('input'); inpS.type='number'; inpS.className='dm-timer-input';
  inpS.min='0'; inpS.max='59'; inpS.value=String(_timerState.totalSec%60).padStart(2,'0'); inpS.placeholder='ss';
  var setBtn = document.createElement('button'); setBtn.className='dm-timer-btn dm-timer-btn-pause';
  setBtn.style.flex='0 0 auto'; setBtn.style.padding='0.4rem 0.7rem';
  setBtn.textContent='Imposta';
  setBtn.onclick = function() {
    var m = Math.max(0, parseInt(inpM.value)||0);
    var s = Math.max(0, Math.min(59, parseInt(inpS.value)||0));
    var tot = m*60+s;
    if (!tot) return;
    if (_timerState.interval) clearInterval(_timerState.interval);
    _timerState.totalSec  = tot;
    _timerState.remaining = tot;
    _timerState.running   = false;
    _timerState.interval  = null;
    renderDmTimer();
  };
  setRow.appendChild(inpM); setRow.appendChild(sep); setRow.appendChild(inpS); setRow.appendChild(setBtn);
  wrap.appendChild(setRow);

  /* Bottoni Start/Pausa/Reset */
  var btnRow = document.createElement('div'); btnRow.className = 'dm-timer-btn-row';

  var startBtn = document.createElement('button');
  startBtn.className = 'dm-timer-btn dm-timer-btn-start';
  startBtn.textContent = _timerState.running ? '⏸ Pausa' : '▶ Avvia';
  if (_timerState.running) startBtn.className = 'dm-timer-btn dm-timer-btn-pause';
  startBtn.onclick = function() {
    if (_timerState.remaining === 0) return;
    if (_timerState.running) {
      /* Pausa */
      _timerState.running = false;
      if (_timerState.interval) { clearInterval(_timerState.interval); _timerState.interval = null; }
    } else {
      /* Avvia */
      _timerState.running = true;
      _timerState.interval = setInterval(_timerTick, 1000);
    }
    renderDmTimer();
  };
  btnRow.appendChild(startBtn);

  var resetBtn2 = document.createElement('button');
  resetBtn2.className = 'dm-timer-btn dm-timer-btn-reset';
  resetBtn2.textContent = '↺ Reset';
  resetBtn2.onclick = function() {
    if (_timerState.interval) clearInterval(_timerState.interval);
    _timerState.running   = false;
    _timerState.interval  = null;
    _timerState.remaining = _timerState.totalSec;
    renderDmTimer();
  };
  btnRow.appendChild(resetBtn2);

  wrap.appendChild(btnRow);
  col.appendChild(wrap);
}

/* Costruisce la "ruota" classica con anello di spicchi (D6/D8) */
function buildSpicchiWheel() {
  var svgNs = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 260 260');
  svg.setAttribute('class', 'doom-wheel-svg');

  var cx = 130, cy = 130;
  var outerR = 122;
  var innerR = 74;
  var n = doomSegmentsForStage(state.doomStage);
  var gap = 3;
  var sweep = 360 / n;
  var actualSweep = sweep - gap;

  for (var i = 0; i < n; i++) {
    var startAngle = i * sweep - 90 + gap / 2;
    var endAngle = startAngle + actualSweep;
    var path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', arcSlicePath(cx, cy, innerR, outerR, startAngle, endAngle));
    path.setAttribute('class', 'doom-slice' + (i < state.doomFilled ? ' filled' : ''));
    svg.appendChild(path);
  }

  /* Anelli decorativi */
  var ringOuter = document.createElementNS(svgNs, 'circle');
  ringOuter.setAttribute('cx', cx);
  ringOuter.setAttribute('cy', cy);
  ringOuter.setAttribute('r', outerR + 4);
  ringOuter.setAttribute('fill', 'none');
  ringOuter.setAttribute('stroke', 'rgba(180,60,60,0.5)');
  ringOuter.setAttribute('stroke-width', '1.2');
  svg.appendChild(ringOuter);

  var ringInner = document.createElementNS(svgNs, 'circle');
  ringInner.setAttribute('cx', cx);
  ringInner.setAttribute('cy', cy);
  ringInner.setAttribute('r', innerR - 4);
  ringInner.setAttribute('fill', 'none');
  ringInner.setAttribute('stroke', 'rgba(180,60,60,0.4)');
  ringInner.setAttribute('stroke-width', '1');
  svg.appendChild(ringInner);

  return svg;
}

/* Stadio 3 — D20 stilizzato 3D-ish con 20 facce illuminabili. */
function buildD20Stage3() {
  var svgNs = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 260 260');
  svg.setAttribute('class', 'doom-wheel-svg doom-d20-svg');

  var cx = 130, cy = 130;
  /* Disegno un icosaedro stilizzato (proiezione 2D):
     12 vertici, 20 facce. Uso una proiezione canonica top-down
     che mostra ~10 facce visibili al fronte, e simuliamo le 10 retro
     con un secondo anello esterno di triangoli più scuri. */

  /* Anello frontale: 10 triangoli interni */
  var rInnerHex = 38;   /* esagono centrale */
  var rMid = 78;        /* punte triangoli centrali */
  var rOuter = 115;     /* punte triangoli esterni */
  var rRim = 122;       /* bordo esterno */

  /* Cornice esterna di luce viola scuro */
  var rim = document.createElementNS(svgNs, 'circle');
  rim.setAttribute('cx', cx);
  rim.setAttribute('cy', cy);
  rim.setAttribute('r', rRim);
  rim.setAttribute('fill', 'none');
  rim.setAttribute('stroke', 'rgba(255,80,30,0.4)');
  rim.setAttribute('stroke-width', '2');
  rim.setAttribute('class', 'd20-rim');
  svg.appendChild(rim);

  /* Facce esterne (10 triangoli "back-faces" attorno) — angoli sfalsati */
  for (var i = 0; i < 10; i++) {
    var aMid = (i * 36 - 90) * Math.PI / 180;
    var aLeft = ((i * 36) - 18 - 90) * Math.PI / 180;
    var aRight = ((i * 36) + 18 - 90) * Math.PI / 180;
    var pTip = pointOnCircle(cx, cy, rOuter, aMid);
    var pL = pointOnCircle(cx, cy, rMid, aLeft);
    var pR = pointOnCircle(cx, cy, rMid, aRight);
    var face = document.createElementNS(svgNs, 'polygon');
    face.setAttribute('points',
      pTip.x.toFixed(1) + ',' + pTip.y.toFixed(1) + ' ' +
      pL.x.toFixed(1) + ',' + pL.y.toFixed(1) + ' ' +
      pR.x.toFixed(1) + ',' + pR.y.toFixed(1));
    face.setAttribute('class', 'd20-face d20-face-outer' + (i < Math.min(state.doomFilled, 10) ? ' lit' : ''));
    face.setAttribute('data-face-index', i);
    svg.appendChild(face);
  }

  /* Facce interne (10 triangoli "front-faces") tra l'esagono e i back-faces.
     Disegniamo coppie alternate puntando verso esterno e verso interno. */
  for (var j = 0; j < 10; j++) {
    var bMid = ((j * 36) - 18 - 90) * Math.PI / 180; /* punta del triangolo */
    var bLeft = ((j * 36) - 90) * Math.PI / 180;
    var bRight = (((j - 1) * 36) - 90) * Math.PI / 180;
    var pTip2 = pointOnCircle(cx, cy, rInnerHex, bMid);
    var pL2 = pointOnCircle(cx, cy, rMid, bLeft);
    var pR2 = pointOnCircle(cx, cy, rMid, bRight);
    var face2 = document.createElementNS(svgNs, 'polygon');
    face2.setAttribute('points',
      pTip2.x.toFixed(1) + ',' + pTip2.y.toFixed(1) + ' ' +
      pL2.x.toFixed(1) + ',' + pL2.y.toFixed(1) + ' ' +
      pR2.x.toFixed(1) + ',' + pR2.y.toFixed(1));
    face2.setAttribute('class', 'd20-face d20-face-inner' + ((j + 10) < state.doomFilled ? ' lit' : ''));
    face2.setAttribute('data-face-index', j + 10);
    svg.appendChild(face2);
  }

  return svg;
}

function pointOnCircle(cx, cy, r, angleRad) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

/* Path SVG per uno spicchio anulare (donut slice) */
function arcSlicePath(cx, cy, rInner, rOuter, startAngle, endAngle) {
  var startRad = startAngle * Math.PI / 180;
  var endRad = endAngle * Math.PI / 180;
  var x1 = cx + rOuter * Math.cos(startRad);
  var y1 = cy + rOuter * Math.sin(startRad);
  var x2 = cx + rOuter * Math.cos(endRad);
  var y2 = cy + rOuter * Math.sin(endRad);
  var x3 = cx + rInner * Math.cos(endRad);
  var y3 = cy + rInner * Math.sin(endRad);
  var x4 = cx + rInner * Math.cos(startRad);
  var y4 = cy + rInner * Math.sin(startRad);
  var largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
  return 'M ' + x1.toFixed(2) + ' ' + y1.toFixed(2) +
    ' A ' + rOuter + ' ' + rOuter + ' 0 ' + largeArc + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) +
    ' L ' + x3.toFixed(2) + ' ' + y3.toFixed(2) +
    ' A ' + rInner + ' ' + rInner + ' 0 ' + largeArc + ' 0 ' + x4.toFixed(2) + ' ' + y4.toFixed(2) +
    ' Z';
}

function onSkullClick() {
  if (state.doomTransforming) return;
  if (!isDM()) return; // solo DM può cliccare
  var total = doomSegmentsForStage(state.doomStage);
  if (state.doomFilled >= total) {
    triggerDoomEvent();
    return;
  }
  state.doomFilled++;
  saveToStorage();
  fbSaveCaos();
  if (state.doomFilled >= total) {
    renderDoomWheel();
    setTimeout(triggerDoomEvent, 800);
  } else {
    renderDoomWheel();
  }
}

function triggerDoomEvent() {
  /* Seleziona la lista in base allo stadio attuale */
  var list;
  if (state.doomStage === 1) { list = EVENTI_SOFT; state.doomEventLevel = 1; }
  else if (state.doomStage === 2) { list = EVENTI_MEDIUM; state.doomEventLevel = 2; }
  else { list = EVENTI_CATASTROFICI; state.doomEventLevel = 3; }

  var idx = Math.floor(Math.random() * list.length);
  state.doomEventText = list[idx];
  state.doomEventOpen = true;
  document.body.appendChild(renderDoomEventModal());
}

function renderDoomEventModal() {
  var existing = document.getElementById('doom-modal-root');
  if (existing) existing.remove();

  var back = document.createElement('div');
  back.className = 'doom-modal-backdrop doom-modal-lvl-' + state.doomEventLevel;
  back.id = 'doom-modal-root';
  back.onclick = function(e) { if (e.target === back) closeDoomModal(); };

  var modal = document.createElement('div');
  modal.className = 'doom-modal doom-modal-stage-' + state.doomStage;

  var skull = document.createElement('div');
  skull.className = 'doom-modal-skull';
  skull.textContent = '\u{1F480}';
  modal.appendChild(skull);

  var eyebrow = document.createElement('div');
  eyebrow.className = 'doom-modal-eyebrow';
  if (state.doomEventLevel === 1) eyebrow.textContent = 'Stadio I — Presagio';
  else if (state.doomEventLevel === 2) eyebrow.textContent = 'Stadio II — Tormento';
  else eyebrow.textContent = 'Stadio III — CATASTROFE';
  modal.appendChild(eyebrow);

  var title = document.createElement('div');
  title.className = 'doom-modal-title';
  if (state.doomEventLevel === 1) title.textContent = 'Un sussurro nella notte';
  else if (state.doomEventLevel === 2) title.textContent = 'La Condanna ha parlato';
  else title.textContent = 'L\'INFERNO SI APRE';
  modal.appendChild(title);

  var ev = document.createElement('div');
  ev.className = 'doom-event-text';
  ev.textContent = state.doomEventText;
  modal.appendChild(ev);

  var actions = document.createElement('div');
  actions.className = 'doom-modal-actions';

  var rerollBtn = document.createElement('button');
  rerollBtn.className = 'doom-modal-btn alt';
  rerollBtn.textContent = 'Tira di nuovo';
  rerollBtn.onclick = function() {
    var list;
    if (state.doomEventLevel === 1) list = EVENTI_SOFT;
    else if (state.doomEventLevel === 2) list = EVENTI_MEDIUM;
    else list = EVENTI_CATASTROFICI;
    var idx = Math.floor(Math.random() * list.length);
    state.doomEventText = list[idx];
    ev.textContent = state.doomEventText;
  };
  actions.appendChild(rerollBtn);

  var continueBtn = document.createElement('button');
  continueBtn.className = 'doom-modal-btn';
  if (state.doomStage < 3) continueBtn.textContent = 'Subisci ed evolvi il Dado';
  else continueBtn.textContent = 'Subisci la Catastrofe';
  continueBtn.onclick = function() {
    closeDoomModal();
    if (state.doomStage < 3) {
      /* Transizione al prossimo stadio con animazione */
      runDoomTransformation();
    } else {
      /* Stadio 3 completato: azzera ma resta D20 */
      state.doomFilled = 0;
      saveToStorage();
      renderDoomWheel();
    }
  };
  actions.appendChild(continueBtn);

  var skipBtn = document.createElement('button');
  skipBtn.className = 'doom-modal-btn alt';
  skipBtn.textContent = 'Chiudi senza azzerare';
  skipBtn.onclick = closeDoomModal;
  actions.appendChild(skipBtn);

  modal.appendChild(actions);
  back.appendChild(modal);
  return back;
}

function closeDoomModal() {
  state.doomEventOpen = false;
  state.doomEventText = '';
  var m = document.getElementById('doom-modal-root');
  if (m) m.remove();
}

/* ===========================================================
   TRASFORMAZIONE EPICA DEL DADO — D6 → D8 → D20
   =========================================================== */
function runDoomTransformation() {
  if (state.doomStage >= 3) return;

  state.doomTransforming = true;
  state.doomFilled = 0;
  saveToStorage();

  /* Aggiungiamo uno scuotimento globale temporaneo + flash overlay */
  var flash = document.createElement('div');
  flash.className = 'doom-transform-flash';
  /* Se sta entrando nello stadio 3, è la trasformazione finale = più epica */
  if (state.doomStage === 2) flash.classList.add('final');
  document.body.appendChild(flash);

  /* Re-render con stato transforming = true (mostra cenere e blocca interazioni) */
  renderDoomWheel();

  /* Tempistica:
     - 0ms: inizia shake + flash overlay
     - 200ms: peak flash
     - 900ms: avanza lo stadio
     - 1400ms: termina transforming, render finale */
  setTimeout(function() {
    state.doomStage++;
    state.doomFilled = 0;
    saveToStorage();
    renderDoomWheel();
  }, 900);

  setTimeout(function() {
    state.doomTransforming = false;
    saveToStorage();
    renderDoomWheel();
    if (flash && flash.parentNode) flash.parentNode.removeChild(flash);
  }, 1700);
}

/* ===========================================================
   PERSISTENZA AUTOMATICA — Hook su note e tema
   =========================================================== */
/* Mi aggancio alle funzioni esistenti per salvare automaticamente */

/* Note: il setter setta state.notes; aggiungo un osservatore tramite wrapping */
var _origUpdateNotesStats = updateNotesStats;
updateNotesStats = function() {
  _origUpdateNotesStats();
  saveToStorage();
};

/* ==============================================================
   REGIA SONORA — DATABASE, ENGINE AUDIO, RENDER
   ============================================================== */

/* ==============================================================
   MOTORE AUDIO NATIVO HTML5
   - Nessun restart al cambio grado (solo fade volume)
   - Transizione soft cross-fade tra scene diverse
   - Modalità Explore / Combat
   ============================================================== */

var GRADE_VOLUMES  = [0, 0.28, 0.60, 1.00];
var _audios        = {};
var _audioFades    = {};
var _audioGrades   = {};
var _bardoTimer    = null;
var _regiaGrade    = 0;
var _regiaMode     = 'explore';
var _audioUnlocked = false;

/* Sblocca autoplay policy con un buffer silenzioso — va chiamato dentro un click handler diretto */
function unlockAudio(cb) {
  if (_audioUnlocked) { if (cb) cb(); return; }
  var sil = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
  sil.volume = 0;
  var done = function() { _audioUnlocked = true; sil.pause(); if (cb) cb(); };
  var p = sil.play();
  if (p && p.then) p.then(done).catch(done); else done();
}

/* ── fade lineare ── */
function audioFadeTo(slotId, targetVol, durationMs, onDone) {
  if (_audioFades[slotId]) { cancelAnimationFrame(_audioFades[slotId]); _audioFades[slotId] = null; }
  var entry = _audios[slotId];
  if (!entry) { if (onDone) onDone(); return; }
  var startVol  = entry.el.volume;
  var startTime = performance.now();
  function step(now) {
    var e2 = _audios[slotId];
    if (!e2) { if (onDone) onDone(); return; }
    var t = Math.min(1, (now - startTime) / Math.max(1, durationMs));
    e2.el.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * t));
    if (t < 1) { _audioFades[slotId] = requestAnimationFrame(step); }
    else { e2.el.volume = targetVol; _audioFades[slotId] = null; if (onDone) onDone(); }
  }
  _audioFades[slotId] = requestAnimationFrame(step);
}

/* ── ottieni o crea audio element; NON ricrea se src uguale ── */
function getAudio(slotId, src, loop) {
  var entry = _audios[slotId];
  if (entry && entry.src === src) return entry.el;
  /* src diversa → fade out e sostituisci */
  if (entry) { audioFadeTo(slotId, 0, 400, function() { entry.el.pause(); entry.el.src = ''; }); }
  if (_audioFades[slotId]) { cancelAnimationFrame(_audioFades[slotId]); _audioFades[slotId] = null; }
  var el = new Audio(src);
  el.loop = (loop !== false);
  el.volume = 0;
  el.preload = 'auto';
  _audios[slotId] = { el: el, src: src };
  return el;
}

/* ── risolve src per la scena (rispetta custom URL e combat mode) ── */
function resolveScenaUrl(scenaId, mode) {
  var m = mode || _regiaMode;
  /* URL personalizzati: cerca prima combat poi explore */
  if (state.regiaUrls) {
    var key = m === 'combat' ? scenaId + '__combat' : scenaId;
    if (state.regiaUrls[key]) return state.regiaUrls[key];
    /* fallback sull'explore se combat non impostato */
    if (m === 'combat' && state.regiaUrls[scenaId]) return state.regiaUrls[scenaId];
  }
  var scena = SCENE_AUDIO.filter(function(s){ return s.id === scenaId; })[0];
  if (!scena) return null;
  if (m === 'combat' && scena.combatFile) return _au(scena.combatFile);
  if (scena.audioFile) return _au(scena.audioFile);
  return null;
}

function resolveSfxUrl(sfxId) {
  if (state.regiaUrlsSfx && state.regiaUrlsSfx[state.regiaScena] && state.regiaUrlsSfx[state.regiaScena][sfxId])
    return state.regiaUrlsSfx[state.regiaScena][sfxId];
  return SFX_MAP[sfxId] || null;
}

/* ── avvia o aggiusta volume della scena principale ── */
function playScena(scenaId, grade) {
  _regiaGrade = grade;
  if (grade === 0) { stopScena(); return; }
  var src = resolveScenaUrl(scenaId, _regiaMode);
  if (!src) { console.warn('[Regia] File mancante:', scenaId, _regiaMode); return; }
  var slot  = 'main';
  var entry = _audios[slot];

  /* Stessa src già caricata → solo fade volume, nessun restart */
  if (entry && entry.src === src) {
    if (entry.el.paused) {
      entry.el.volume = 0;
      var pp = entry.el.play();
      if (pp && pp.catch) pp.catch(function(e){ console.warn('[Regia]', e.message); });
    }
    audioFadeTo(slot, GRADE_VOLUMES[grade], 600);
    return;
  }

  /* Src diversa → cross-fade: fade out vecchio, fade in nuovo */
  if (entry && !entry.el.paused) {
    var oldEntry = entry;
    var oldSlot  = 'main_old';
    _audios[oldSlot] = oldEntry;
    audioFadeTo(oldSlot, 0, 700, function() {
      oldEntry.el.pause(); oldEntry.el.src = '';
      delete _audios[oldSlot];
    });
  }
  var el = getAudio(slot, src, true);
  el.volume = 0;
  var p = el.play();
  if (p && p.catch) p.catch(function(e){ console.warn('[Regia]', e.message); });
  audioFadeTo(slot, GRADE_VOLUMES[grade], 900);
}

/* ── cambia modalità explore/combat mantenendo posizione e grado ── */
function setMode(mode) {
  if (mode === _regiaMode) return;
  var prevMode = _regiaMode;
  _regiaMode = mode;
  if (_regiaGrade > 0 && state.regiaScena) {
    var prevSrc = resolveScenaUrl(state.regiaScena, prevMode);
    var newSrc  = resolveScenaUrl(state.regiaScena, mode);
    if (newSrc && newSrc !== prevSrc) {
      // Traccia diversa per i due modi: fade out lento (1.4s) poi fade in
      if (_audios['main'] && !_audios['main'].el.paused) {
        audioFadeTo('main', 0, 1400, function() {
          if (_regiaGrade > 0) playScena(state.regiaScena, _regiaGrade);
        });
      } else {
        playScena(state.regiaScena, _regiaGrade);
      }
    } else {
      // Stessa traccia: "breath" — abbassa poi rialza per segnalare il cambio
      var v = GRADE_VOLUMES[_regiaGrade];
      audioFadeTo('main', v * 0.12, 700, function() {
        audioFadeTo('main', v, 1100);
      });
    }
  }
}

function stopScena() {
  _regiaGrade = 0;
  var entry = _audios['main'];
  if (!entry) return;
  var el = entry.el;
  audioFadeTo('main', 0, 600, function() { el.pause(); });
}

function setSfxGrade(sfxId, grade) {
  _audioGrades[sfxId] = grade;
  var slot = 'sfx_' + sfxId;
  if (grade === 0) {
    var e0 = _audios[slot];
    if (e0) audioFadeTo(slot, 0, 400, function() { e0.el.pause(); });
    return;
  }
  var src = resolveSfxUrl(sfxId);
  if (!src) return;
  var el = getAudio(slot, src, true);
  if (el.paused) {
    el.volume = 0;
    var p = el.play();
    if (p && p.catch) p.catch(function(e){ console.warn('[Regia sfx]', e.message); });
  }
  audioFadeTo(slot, GRADE_VOLUMES[grade], 400);
}

var _waCtx = null;
function _getWACtx() {
  if (!_waCtx) { try { _waCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
  return _waCtx;
}
function _synthBell() {
  var ctx = _getWACtx(); if (!ctx) return;
  var freqs = [523, 784, 1046, 1568];
  freqs.forEach(function(freq, i) {
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = freq;
    var t = ctx.currentTime, vol = 0.6 / (i + 1), dur = 3 - i * 0.5;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
  });
}
function _synthThunder() {
  var ctx = _getWACtx(); if (!ctx) return;
  var sr = ctx.sampleRate, buf = ctx.createBuffer(1, sr * 3, sr), d = buf.getChannelData(0);
  for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 0.4);
  var src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
  flt.type = 'lowpass'; flt.frequency.value = 180;
  src.buffer = buf; src.connect(flt); flt.connect(g); g.connect(ctx.destination);
  var t = ctx.currentTime;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.2, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.001, t + 3);
  src.start(t); src.stop(t + 3);
}
function _synthCoin() {
  var ctx = _getWACtx(); if (!ctx) return;
  [1047, 1319].forEach(function(freq) {
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'triangle'; osc.frequency.value = freq;
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t); osc.stop(t + 0.35);
  });
}
function _synthDiceRoll() {
  /* Suono sintetico del lancio dadi rimosso su richiesta dell utente */
}
function _playSynth(sfxId) {
  if (sfxId === 'campana') _synthBell();
  else if (sfxId === 'tuoni') _synthThunder();
}
function playOneShot(sfxId, durationMs) {
  var src = resolveSfxUrl(sfxId);
  if (!src) { _playSynth(sfxId); return; }
  var slot = 'oneshot_' + sfxId;
  var entry = _audios[slot];
  if (entry) { entry.el.pause(); delete _audios[slot]; }
  var el = getAudio(slot, src, false);
  el.volume = 1; el.currentTime = 0;
  var p = el.play();
  if (p && p.catch) p.catch(function(e) { _playSynth(sfxId); });
  setTimeout(function() { var e2 = _audios[slot]; if (e2) { e2.el.pause(); e2.el.currentTime = 0; } }, durationMs);
}

function playBardoRoulette() {
  if (_bardoTimer) { clearTimeout(_bardoTimer); _bardoTimer = null; }
  var tracks = (state.regiaUrlsBardo && state.regiaUrlsBardo.length > 0) ? state.regiaUrlsBardo : BARDO_TRACKS;
  if (!tracks.length) return;
  var src = tracks[Math.floor(Math.random() * tracks.length)];
  if (!src) return;
  var mainVol = _regiaGrade > 0 ? GRADE_VOLUMES[_regiaGrade] : 0;
  audioFadeTo('main', mainVol * 0.12, 500);
  var slot = 'bardo';
  var prev = _audios[slot]; if (prev) { prev.el.pause(); delete _audios[slot]; }
  var el = getAudio(slot, src, false);
  el.volume = 0;
  function go() {
    var dur = el.duration;
    var maxStart = (dur && !isNaN(dur) && dur > 12) ? dur - 10 : 0;
    el.currentTime = maxStart > 0 ? Math.min(maxStart, 10 + Math.floor(Math.random() * 50)) : 0;
    var p = el.play();
    if (p && p.catch) p.catch(function(e){ console.warn('[Regia bardo]', e.message); });
    audioFadeTo(slot, 0.88, 350);
    _bardoTimer = setTimeout(function() {
      audioFadeTo(slot, 0, 550, function() { el.pause(); });
      audioFadeTo('main', mainVol, 700);
      _bardoTimer = null;
    }, 8000);
  }
  if (el.readyState >= 2) { go(); }
  else { el.addEventListener('canplay', function h(){ el.removeEventListener('canplay',h); go(); }); el.load(); }
}

/* Modale modifica URL audio scena */
function apriModaleUrlAudio(scenaId, scenaNome) {
  var existing = document.getElementById('regia-url-modal');
  if (existing) existing.remove();

  var scena = SCENE_AUDIO.filter(function(s){ return s.id === scenaId; })[0];
  if (!scena) return;

  var modal = document.createElement('div');
  modal.className = 'regia-img-modal'; modal.id = 'regia-url-modal';
  modal.onclick = function(e){ if (e.target === modal) modal.remove(); };

  var box = document.createElement('div'); box.className = 'regia-img-box';

  var ttl = document.createElement('div'); ttl.className = 'regia-img-box-title';
  ttl.textContent = '🎵 Audio: ' + scenaNome;
  box.appendChild(ttl);

  /* URL musica principale */
  var mkLabel = function(txt) {
    var l = document.createElement('div');
    l.style.cssText = 'font-family:\'Cinzel\',serif;font-size:8.5px;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold-dim);margin-top:0.5rem;';
    l.textContent = txt; return l;
  };

  box.appendChild(mkLabel('File Musica Principale (es: audio/taverna.mp3)'));
  var mainInp = document.createElement('input'); mainInp.type = 'text';
  mainInp.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-soft);color:var(--text-main);font-family:\'EB Garamond\',serif;font-size:13px;padding:0.5rem 0.75rem;border-radius:3px;outline:none;width:100%;';
  mainInp.placeholder = 'audio/' + (scena.audioFile || scenaId + '.mp3') + ' (default)';
  mainInp.value = state.regiaUrls[scenaId] || '';
  box.appendChild(mainInp);

  /* SFX URLs */
  var sfxNames = { pioggia:'Pioggia', tuoni:'Tuoni', vento:'Vento', folla:'Folla', campana:'Campana' };
  var sfxInputs = {};
  if (scena.sfx.length > 0) {
    box.appendChild(mkLabel('File Effetti Sonori (es: audio/pioggia.mp3)'));
    scena.sfx.forEach(function(sfxId) {
      var sfxRow = document.createElement('div'); sfxRow.style.cssText = 'display:flex;align-items:center;gap:0.4rem;margin-bottom:0.3rem;';
      var sfxLbl = document.createElement('span'); sfxLbl.style.cssText = 'font-family:\'Cinzel\',serif;font-size:8px;color:var(--text-muted);width:55px;flex-shrink:0;text-transform:uppercase;';
      sfxLbl.textContent = sfxNames[sfxId] || sfxId;
      var inp = document.createElement('input'); inp.type = 'text';
      inp.style.cssText = 'flex:1;background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-main);font-family:\'EB Garamond\',serif;font-size:12px;padding:0.35rem 0.5rem;border-radius:3px;outline:none;';
      inp.placeholder = SFX_MAP[sfxId] || '';
      inp.value = (state.regiaUrlsSfx[scenaId] && state.regiaUrlsSfx[scenaId][sfxId]) || '';
      sfxInputs[sfxId] = inp;
      sfxRow.appendChild(sfxLbl); sfxRow.appendChild(inp);
      box.appendChild(sfxRow);
    });
  }

  /* Bardo tracks — solo per taverna */
  var bardoTextarea = null;
  if (scenaId === 'taverna') {
    box.appendChild(mkLabel('File Tracce Bardo (uno per riga, spezzone 8s casuale)'));
    bardoTextarea = document.createElement('textarea');
    bardoTextarea.style.cssText = 'width:100%;background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-main);font-family:\'EB Garamond\',serif;font-size:12px;padding:0.5rem;border-radius:3px;outline:none;resize:vertical;min-height:80px;';
    bardoTextarea.placeholder = 'audio/bardo1.mp3\naudio/bardo2.mp3\n(uno per riga)';
    bardoTextarea.value = state.regiaUrlsBardo.join('\n');
    box.appendChild(bardoTextarea);
  }

  /* Bottoni */
  var btnRow = document.createElement('div'); btnRow.className = 'regia-img-btn-row';
  var btnSave = document.createElement('button'); btnSave.className = 'btn-regia-save';
  btnSave.textContent = 'Salva';
  btnSave.onclick = function() {
    /* Salva URL principale */
    var mainVal = mainInp.value.trim();
    if (mainVal) state.regiaUrls[scenaId] = mainVal;
    else delete state.regiaUrls[scenaId];
    /* Salva SFX */
    if (!state.regiaUrlsSfx[scenaId]) state.regiaUrlsSfx[scenaId] = {};
    Object.keys(sfxInputs).forEach(function(sfxId) {
      var v = sfxInputs[sfxId].value.trim();
      if (v) state.regiaUrlsSfx[scenaId][sfxId] = v;
      else delete state.regiaUrlsSfx[scenaId][sfxId];
    });
    /* Salva Bardo */
    if (bardoTextarea) {
      var lines = bardoTextarea.value.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
      state.regiaUrlsBardo = lines;
    }
    saveToStorage();
    modal.remove();
  };
  var btnCanc = document.createElement('button'); btnCanc.className = 'btn-regia-cancel';
  btnCanc.textContent = 'Annulla';
  btnCanc.onclick = function() { modal.remove(); };
  btnRow.appendChild(btnSave); btnRow.appendChild(btnCanc);
  box.appendChild(btnRow);
  modal.appendChild(box);
  document.body.appendChild(modal);
}

/* Modale modifica immagine scena — stile Emporio */
function apriModaleImmagineScena(scenaId, scenaNome) {
  var existing = document.getElementById('regia-img-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.className = 'regia-img-modal'; modal.id = 'regia-img-modal';
  modal.onclick = function(e){ if (e.target === modal) modal.remove(); };

  var box = document.createElement('div'); box.className = 'regia-img-box';

  var ttl = document.createElement('div'); ttl.className = 'regia-img-box-title';
  ttl.textContent = '🖼 Immagine: ' + scenaNome;
  box.appendChild(ttl);

  /* Anteprima */
  var preview = null;
  var currentUrl = state.regiaImmagini[scenaId] || '';
  if (currentUrl) {
    preview = document.createElement('img');
    preview.className = 'regia-img-preview'; preview.src = currentUrl;
    box.appendChild(preview);
  }

  /* Input URL */
  var urlLbl = document.createElement('div');
  urlLbl.style.cssText = 'font-family:\'Cinzel\',serif;font-size:8.5px;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold-dim);';
  urlLbl.textContent = 'URL immagine';
  box.appendChild(urlLbl);
  var urlInp = document.createElement('input'); urlInp.type = 'text';
  urlInp.placeholder = 'https://esempio.com/immagine.jpg';
  urlInp.value = currentUrl;
  urlInp.oninput = function() {
    if (preview) { preview.src = this.value; }
    else if (this.value) {
      preview = document.createElement('img');
      preview.className = 'regia-img-preview'; preview.src = this.value;
      box.insertBefore(preview, urlLbl);
    }
  };
  box.appendChild(urlInp);

  /* Upload file */
  var fileLbl = document.createElement('div');
  fileLbl.style.cssText = 'font-family:\'Cinzel\',serif;font-size:8.5px;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold-dim);';
  fileLbl.textContent = 'Oppure carica da file';
  box.appendChild(fileLbl);
  var fileInp = document.createElement('input'); fileInp.type = 'file';
  fileInp.accept = 'image/*';
  fileInp.onchange = function() {
    var file = this.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var img = new Image();
      img.onload = function() {
        var MAX = 600;
        var ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        var canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        var compressed = canvas.toDataURL('image/jpeg', 0.72);
        urlInp.value = compressed;
        if (!preview) {
          preview = document.createElement('img');
          preview.className = 'regia-img-preview';
          box.insertBefore(preview, urlLbl);
        }
        preview.src = compressed;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  box.appendChild(fileInp);

  /* Bottoni */
  var btnRow = document.createElement('div'); btnRow.className = 'regia-img-btn-row';
  var btnSave = document.createElement('button'); btnSave.className = 'btn-regia-save';
  btnSave.textContent = 'Salva';
  btnSave.onclick = function() {
    var val = urlInp.value.trim();
    if (val) { state.regiaImmagini[scenaId] = val; }
    else { delete state.regiaImmagini[scenaId]; }
    saveToStorage();
    modal.remove();
    /* Aggiorna solo il thumbnail nella griglia senza full re-render */
    var p = document.querySelector('.regia-panel');
    if (p) p.replaceWith(renderRegiaSonora());
  };
  var btnCanc = document.createElement('button'); btnCanc.className = 'btn-regia-cancel';
  btnCanc.textContent = 'Annulla';
  btnCanc.onclick = function() { modal.remove(); };
  btnRow.appendChild(btnSave); btnRow.appendChild(btnCanc);

  /* Bottone rimuovi immagine */
  if (currentUrl) {
    var btnDel = document.createElement('button');
    btnDel.style.cssText = 'background:rgba(138,46,46,0.2);color:#ff9c9c;border:1px solid rgba(138,46,46,0.5);border-radius:3px;padding:0.3rem 0.6rem;cursor:pointer;font-family:\'Cinzel\',serif;font-size:8.5px;text-transform:uppercase;letter-spacing:0.07em;width:100%;';
    btnDel.textContent = 'Rimuovi immagine';
    btnDel.onclick = function() {
      delete state.regiaImmagini[scenaId];
      saveToStorage(); modal.remove();
      var p = document.querySelector('.regia-panel');
      if (p) p.replaceWith(renderRegiaSonora());
    };
    btnRow.appendChild(btnDel);
  }

  box.appendChild(btnRow);
  modal.appendChild(box);
  document.body.appendChild(modal);
}

/* ---- RENDER DEL PANNELLO ---- */
var _regiaView = 'list'; /* 'list' | 'detail' */


/* ============================================================================
   SEZIONE 10C: REGIA SONORA & SCENE MUSICALI AMBIENTALI
   ============================================================================ */
function renderRegiaSonora() {

  var panel = document.createElement('aside');
  panel.className = 'regia-panel';

  /* Header */
  var header = document.createElement('div');
  header.className = 'regia-header';
  header.innerHTML = ICON.music;
  var title = document.createElement('div'); title.className = 'regia-header-title';
  title.textContent = 'Regia Sonora';
  header.appendChild(title);
  var closeBtn = document.createElement('button'); closeBtn.className = 'regia-close';
  closeBtn.innerHTML = ICON.x; closeBtn.title = 'Chiudi Regia';
  closeBtn.onclick = function() { state.regiaActive = false; render(); };
  header.appendChild(closeBtn);
  panel.appendChild(header);

  var body = document.createElement('div'); body.className = 'regia-body';

  if (_regiaView === 'list') {
    /* ===== VISTA LISTA SCENE ===== */
    var scenLbl = document.createElement('div'); scenLbl.className = 'regia-section-lbl';
    scenLbl.textContent = 'Ambientazione';
    body.appendChild(scenLbl);

    var SCENE_EMOJI = {
      citta:'🏙️', taverna:'🍺', forest_inc:'🌲', citta_enorme:'🌆',
      rovine:'🏚️', caverna:'⛏️', tempio:'⛩️', strada_oscura:'🌑',
      deserto:'🏜️', avventura_mare:'⚓', citta_nordica:'❄️', spiaggia:'🌊',
      mercato:'🛒', dungeon:'💀', fuga:'⚡', castello:'🏰',
      villaggio:'🌾', arena:'⚔️', pirati:'🏴‍☠️', duello:'🗡️',
      abisso:'🕳️', tempesta:'🌪️', pianura:'🌿'
    };

    var sceneGrid = document.createElement('div'); sceneGrid.className = 'regia-scene-grid';

    SCENE_AUDIO.forEach(function(s) {
      var card = document.createElement('div');
      card.className = 'regia-scene-card' + (state.regiaScena === s.id ? ' active' : '');

      /* Immagine grande */
      var imgWrap = document.createElement('div'); imgWrap.className = 'regia-scene-img-wrap';
      var imgUrl = state.regiaImmagini[s.id];
      if (imgUrl) {
        var img = document.createElement('img'); img.src = imgUrl; img.alt = s.nome;
        img.onerror = function(){ this.parentNode.innerHTML = '<span class="regia-scene-ph">'+(SCENE_EMOJI[s.id]||'🎵')+'</span>'; };
        imgWrap.appendChild(img);
      } else {
        imgWrap.innerHTML = '<span class="regia-scene-ph">'+(SCENE_EMOJI[s.id]||'🎵')+'</span>';
      }
      card.appendChild(imgWrap);

      /* Footer con nome */
      var footer = document.createElement('div'); footer.className = 'regia-scene-footer';
      var nameEl = document.createElement('div'); nameEl.className = 'regia-scene-name';
      if (state.regiaScena === s.id && _regiaGrade > 0) {
        var dot = document.createElement('span'); dot.className = 'regia-scene-playing-dot';
        nameEl.appendChild(dot);
      }
      nameEl.appendChild(document.createTextNode(s.nome));
      footer.appendChild(nameEl);
      card.appendChild(footer);

      /* Bottoni azione (appaiono all'hover) */
      var actions = document.createElement('div'); actions.className = 'regia-card-actions';
      var imgBtn = document.createElement('button'); imgBtn.className = 'btn-scene-img'; imgBtn.title = 'Immagine'; imgBtn.textContent = '🖼';
      imgBtn.onclick = function(e){ e.stopPropagation(); apriModaleImmagineScena(s.id, s.nome); };
      var urlBtn = document.createElement('button'); urlBtn.className = 'btn-scene-url'; urlBtn.title = 'URL audio'; urlBtn.textContent = '🎵';
      urlBtn.onclick = function(e){ e.stopPropagation(); apriModaleUrlAudio(s.id, s.nome); };
      actions.appendChild(imgBtn); actions.appendChild(urlBtn);
      card.appendChild(actions);

      /* Click → apri dettaglio */
      card.onclick = function() {
        if (state.regiaScena !== s.id) {
          stopScena();
          Object.keys(_audioGrades).forEach(function(k){ setSfxGrade(k, 0); });
          _audioGrades = {}; _regiaGrade = 0;
          state.regiaScena = s.id;
        }
        _regiaView = 'detail';
        var p = document.querySelector('.regia-panel');
        if (p) p.replaceWith(renderRegiaSonora());
      };
      sceneGrid.appendChild(card);
    });
    body.appendChild(sceneGrid);

  } else {
    /* ===== VISTA DETTAGLIO SCENA ===== */
    var scenaCorrente = SCENE_AUDIO.filter(function(s){ return s.id === state.regiaScena; })[0];
    if (!scenaCorrente) { _regiaView = 'list'; panel.appendChild(body); return panel; }

    var SCENE_EMOJI2 = {
      citta:'🏙️', taverna:'🍺', forest_inc:'🌲', citta_enorme:'🌆',
      rovine:'🏚️', caverna:'⛏️', tempio:'⛩️', strada_oscura:'🌑',
      deserto:'🏜️', avventura_mare:'⚓', citta_nordica:'❄️', spiaggia:'🌊',
      mercato:'🛒', dungeon:'💀', fuga:'⚡', castello:'🏰',
      villaggio:'🌾', arena:'⚔️', pirati:'🏴‍☠️', duello:'🗡️',
      abisso:'🕳️', tempesta:'🌪️', pianura:'🌿'
    };

    var detailView = document.createElement('div'); detailView.className = 'regia-detail-view';

    /* Sfondo immagine trasparente */
    var imgUrl2 = state.regiaImmagini[scenaCorrente.id];
    if (imgUrl2) {
      var bg = document.createElement('div'); bg.className = 'regia-detail-bg';
      bg.style.backgroundImage = 'url(' + imgUrl2 + ')';
      detailView.appendChild(bg);
    }

    var dc = document.createElement('div'); dc.className = 'regia-detail-content';

    /* Freccia indietro */
    var backBtn = document.createElement('button'); backBtn.className = 'regia-back-btn';
    backBtn.innerHTML = '&#8592; Lista';
    backBtn.onclick = function() {
      _regiaView = 'list';
      var p = document.querySelector('.regia-panel');
      if (p) p.replaceWith(renderRegiaSonora());
    };
    dc.appendChild(backBtn);

    /* Titolo scena */
    var detTitle = document.createElement('div'); detTitle.className = 'regia-detail-title';
    detTitle.textContent = scenaCorrente.nome;
    dc.appendChild(detTitle);

    /* Pulsante modifica URL audio */
    var urlRow = document.createElement('div'); urlRow.style.cssText = 'display:flex;gap:0.3rem;justify-content:center;';
    var urlEditBtn = document.createElement('button');
    urlEditBtn.style.cssText = 'background:rgba(100,160,220,0.1);border:1px solid rgba(100,160,220,0.35);color:#a0c8f0;border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-family:\'Cinzel\',serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;';
    urlEditBtn.innerHTML = '🔗 URL Audio';
    urlEditBtn.onclick = function(){ apriModaleUrlAudio(scenaCorrente.id, scenaCorrente.nome); };
    urlRow.appendChild(urlEditBtn);
    var imgEditBtn2 = document.createElement('button');
    imgEditBtn2.style.cssText = 'background:rgba(201,165,92,0.1);border:1px solid var(--border-gold);color:var(--gold);border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-family:\'Cinzel\',serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;';
    imgEditBtn2.innerHTML = '🖼 Immagine';
    imgEditBtn2.onclick = function(){ apriModaleImmagineScena(scenaCorrente.id, scenaCorrente.nome); };
    urlRow.appendChild(imgEditBtn2);
    dc.appendChild(urlRow);

    /* Separatore grado */
    var gradeLbl = document.createElement('div'); gradeLbl.className = 'regia-section-lbl';
    gradeLbl.textContent = 'Intensità';
    dc.appendChild(gradeLbl);

    /* ---- MODALITÀ EXPLORE / COMBAT ---- */
    var modeRow = document.createElement('div'); modeRow.className = 'regia-mode-row';

    var btnExplore = document.createElement('button');
    btnExplore.className = 'btn-mode btn-mode-explore' + (_regiaMode === 'explore' ? ' active' : '');
    btnExplore.innerHTML = '🌿 Explore';
    btnExplore.onclick = function() {
      unlockAudio(function() {
        setMode('explore');
        btnExplore.className = 'btn-mode btn-mode-explore active';
        btnCombat.className  = 'btn-mode btn-mode-combat';
        updateStatus();
      });
    };

    var btnCombat = document.createElement('button');
    btnCombat.className = 'btn-mode btn-mode-combat' + (_regiaMode === 'combat' ? ' active' : '');
    btnCombat.innerHTML = '⚔️ Combat';
    btnCombat.onclick = function() {
      unlockAudio(function() {
        setMode('combat');
        btnCombat.className  = 'btn-mode btn-mode-combat active';
        btnExplore.className = 'btn-mode btn-mode-explore';
        updateStatus();
      });
    };

    modeRow.appendChild(btnExplore);
    modeRow.appendChild(btnCombat);
    dc.appendChild(modeRow);

    var gradeRow = document.createElement('div'); gradeRow.className = 'regia-grade-btns';
    var gradeLabels = ['OFF','I','II','III'];

    function updateStatus() {
      var st = document.querySelector('.regia-status');
      if (!st) return;
      if (_regiaGrade > 0) {
        var modeLabel = _regiaMode === 'combat' ? '⚔️ Combat' : '🌿 Explore';
        st.className = 'regia-status playing';
        st.textContent = '♫ ' + scenaCorrente.nome + ' — ' + modeLabel + ' — Grado ' + ['I','II','III'][_regiaGrade-1];
      } else {
        st.className = 'regia-status';
        st.textContent = 'Nessuna musica in riproduzione.';
      }
    }

    gradeLabels.forEach(function(lbl, g) {
      var btn = document.createElement('button');
      btn.className = 'btn-grade ' + (_regiaGrade === g ? 'btn-grade-active' : (g === 0 ? 'btn-grade-off' : 'btn-grade-on'));
      btn.textContent = lbl;
      btn.onclick = function() {
        unlockAudio(function() {
          _regiaGrade = g;
          if (g === 0) { stopScena(); }
          else { playScena(state.regiaScena, g); }
          gradeRow.querySelectorAll('.btn-grade').forEach(function(b, idx) {
            b.className = 'btn-grade ' + (_regiaGrade === idx ? 'btn-grade-active' : (idx === 0 ? 'btn-grade-off' : 'btn-grade-on'));
          });
          updateStatus();
        });
      };
      gradeRow.appendChild(btn);
    });
    dc.appendChild(gradeRow);

    /* ---- SFX CONTINUI ---- */
    if (scenaCorrente.sfx.length > 0) {
      var continuousSfx = scenaCorrente.sfx.filter(function(s){ return s !== 'tuoni' && s !== 'campana'; });
      if (continuousSfx.length > 0) {
        var sfxLbl = document.createElement('div'); sfxLbl.className = 'regia-section-lbl';
        sfxLbl.textContent = 'Effetti Sonori';
        dc.appendChild(sfxLbl);

        var sfxNames = { pioggia:'Pioggia', tuoni:'Tuoni', vento:'Vento', folla:'Folla', campana:'Campana' };
        var sfxGrid = document.createElement('div'); sfxGrid.className = 'regia-sfx-grid';
        continuousSfx.forEach(function(sfxId) {
          var row = document.createElement('div'); row.className = 'regia-sfx-row';
          var nameDiv = document.createElement('div'); nameDiv.className = 'regia-sfx-name';
          nameDiv.textContent = sfxNames[sfxId] || sfxId;
          row.appendChild(nameDiv);
          var btns = document.createElement('div'); btns.className = 'regia-sfx-btns';
          ['0','1','2','3'].forEach(function(gl, g) {
            var btn = document.createElement('button');
            var cur = _audioGrades[sfxId] || 0;
            btn.className = 'btn-sfx-grade ' + (cur === g ? 'btn-sfx-active' : (g === 0 ? 'btn-sfx-off' : 'btn-sfx-on'));
            btn.textContent = gl;
            btn.onclick = function() {
              unlockAudio(function() {
                setSfxGrade(sfxId, g);
                var allB = btns.querySelectorAll('.btn-sfx-grade');
                allB.forEach(function(b, idx) {
                  b.className = 'btn-sfx-grade ' + ((_audioGrades[sfxId]||0) === idx ? 'btn-sfx-active' : (idx === 0 ? 'btn-sfx-off' : 'btn-sfx-on'));
                });
              });
            };
            btns.appendChild(btn);
          });
          row.appendChild(btns);
          sfxGrid.appendChild(row);
        });
        dc.appendChild(sfxGrid);
      }

      /* ---- ONE-SHOT ---- */
      var hasOneShot = scenaCorrente.sfx.indexOf('tuoni') >= 0 || scenaCorrente.sfx.indexOf('campana') >= 0;
      var isTaverna = scenaCorrente.id === 'taverna';
      if (hasOneShot || isTaverna) {
        var osl = document.createElement('div'); osl.className = 'regia-section-lbl';
        osl.textContent = 'One-Shot';
        dc.appendChild(osl);
        var osRow = document.createElement('div'); osRow.className = 'regia-oneshot-row';
        if (scenaCorrente.sfx.indexOf('campana') >= 0) {
          var btnB = document.createElement('button');
          btnB.className = 'btn-oneshot btn-oneshot-bell';
          btnB.innerHTML = '&#128276; Campana';
          btnB.onclick = function() { unlockAudio(function(){ playOneShot('campana', 6000); }); };
          osRow.appendChild(btnB);
        }
        if (scenaCorrente.sfx.indexOf('tuoni') >= 0) {
          var btnT = document.createElement('button');
          btnT.className = 'btn-oneshot btn-oneshot-thunder';
          btnT.innerHTML = '&#9928; Tuono';
          btnT.onclick = function() { unlockAudio(function(){ playOneShot('tuoni', 8000); }); };
          osRow.appendChild(btnT);
        }
        if (isTaverna) {
          var btnBrd = document.createElement('button');
          btnBrd.className = 'btn-oneshot btn-oneshot-bard';
          btnBrd.innerHTML = '&#127928; Bardo (8s)';
          btnBrd.onclick = function() { unlockAudio(function(){ playBardoRoulette(); }); };
          osRow.appendChild(btnBrd);
        }
        dc.appendChild(osRow);
      }
    }

    /* Status */
    var status = document.createElement('div');
    var modeLabel0 = _regiaMode === 'combat' ? '⚔️ Combat' : '🌿 Explore';
    status.className = 'regia-status' + (_regiaGrade > 0 ? ' playing' : '');
    status.textContent = _regiaGrade > 0
      ? '♫ ' + scenaCorrente.nome + ' — ' + modeLabel0 + ' — Grado ' + ['I','II','III'][_regiaGrade-1]
      : 'Nessuna musica in riproduzione.';
    dc.appendChild(status);

    detailView.appendChild(dc);
    body.appendChild(detailView);
  }

  panel.appendChild(body);
  return panel;
}

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
  hc.style.cssText = 'padding-top:2rem;padding-bottom:1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;';

  var hLeft = document.createElement('div');
  hLeft.innerHTML =
    '<div class="header-eyebrow mb-3"><span>Pannello Master</span></div>' +
    '<h1 class="header-title">Schede PG</h1>' +
    '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Tutti i personaggi della campagna.</p>';
  hc.appendChild(hLeft);

  var hRight = document.createElement('div');
  hRight.style.cssText = 'display:flex;gap:8px;align-items:center;';
  var refreshBtn = document.createElement('button');
  refreshBtn.style.cssText = 'background:transparent;border:1px solid var(--border-subtle);color:var(--text-muted);font-size:11px;font-family:\'Cinzel\',serif;letter-spacing:0.08em;padding:5px 12px;border-radius:3px;cursor:pointer;';
  refreshBtn.textContent = '↻ Aggiorna';
  refreshBtn.onclick = function() {
    state.schedePGAll = null;
    state.schedePGOpenChar = null;
    if (_db) {
      _db.ref('schedePG').once('value', function(snap) {
        state.schedePGAll = snap.val() || {};
      
        renderMain();
      });
    }
  };
  hRight.appendChild(refreshBtn);

  /* Toggle mostra schede usate/magazzino */
  var toggleWrap = document.createElement('label');
  toggleWrap.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);user-select:none;';
  var toggleChk = document.createElement('input');
  toggleChk.type = 'checkbox';
  toggleChk.checked = !!state.schedePGShowHidden;
  toggleChk.style.cssText = 'width:15px;height:15px;cursor:pointer;accent-color:var(--gold);';
  toggleChk.onchange = function() { state.schedePGShowHidden = this.checked; renderMain(); };
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
    loading.style.cssText = 'text-align:center;padding:3rem;color:var(--text-muted);font-family:\'Cinzel\',serif;font-size:14px;letter-spacing:0.1em;';
    loading.textContent = 'Caricamento schede…';
    body.appendChild(loading);
    wrap.appendChild(body);
    return wrap;
  }

  /* Raccolta di tutti i personaggi */
  var allChars = [];
  Object.keys(allData).forEach(function(username) {
    var userData = allData[username];
    if (userData && userData.chars) {
      Object.keys(userData.chars).forEach(function(charId) {
        var ch = userData.chars[charId];
        if (ch) allChars.push({ username: username, charId: charId, char: ch });
      });
    }
  });

  /* Utenti con almeno una scheda */
  var usernames = [];
  Object.keys(allData).forEach(function(u) {
    if (allData[u] && allData[u].chars && Object.keys(allData[u].chars).length > 0) usernames.push(u);
  });
  usernames.sort();

  /* Filtri per account */
  var filterBar = document.createElement('div');
  filterBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:1.5rem;';

  var mkFilterBtn = function(label, val) {
    var btn = document.createElement('button');
    var isActive = state.schedePGFilter === val;
    btn.style.cssText = 'font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:5px 14px;border-radius:3px;cursor:pointer;border:1px solid ' +
      (isActive ? 'var(--gold)' : 'var(--border-subtle)') + ';background:' +
      (isActive ? 'rgba(201,165,92,0.15)' : 'transparent') + ';color:' +
      (isActive ? 'var(--gold)' : 'var(--text-muted)') + ';transition:all 0.15s;';
    btn.textContent = label;
    btn.onclick = function() { state.schedePGFilter = val; renderMain(); };
    return btn;
  };

  filterBar.appendChild(mkFilterBtn('Tutti', 'tutti'));
  usernames.forEach(function(u) { filterBar.appendChild(mkFilterBtn(u, u)); });
  body.appendChild(filterBar);

  /* Applica filtro account */
  var filtered = state.schedePGFilter === 'tutti' ? allChars : allChars.filter(function(item) { return item.username === state.schedePGFilter; });

  /* Nascondi usate/magazzino se il checkbox è spento */
  if (!state.schedePGShowHidden) {
    filtered = filtered.filter(function(item) {
      var st = item.char.stato || '';
      return st !== 'usato' && st !== 'magazzino';
    });
  }

  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:3rem;color:var(--text-muted);font-family:\'Cinzel\',serif;font-size:13px;letter-spacing:0.1em;';
    empty.textContent = 'Nessuna scheda trovata.';
    body.appendChild(empty);
    wrap.appendChild(body);
    return wrap;
  }

  /* Griglia schede */
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;';

  filtered.forEach(function(item) {
    var ch = item.char;
    var card = document.createElement('div');
    card.className = 'sium-pg-card';
    card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:6px;overflow:hidden;cursor:pointer;transition:border-color 0.15s,box-shadow 0.15s;';
    card.onmouseenter = function() { card.style.borderColor = 'var(--gold-dim)'; card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.35)'; };
    card.onmouseleave = function() { card.style.borderColor = 'var(--border-subtle)'; card.style.boxShadow = 'none'; };
    card.onclick = (function(it) { return function() {
      state.schedePGOpenChar = it;
      state.schedePGViewMode = true;
      state.scheda = Object.assign(_schedaFix(it.char), {id: it.charId});
      state.schedaAttivaId = it.charId;
      state.schedaLoaded = true;
      /* carica compagni dal dato già scaricato */
      state.companions = {};
      var _ud = state.schedePGAll[it.username];
      if (_ud && _ud.companions && _ud.companions[it.charId]) {
        state.companions[it.charId] = _ud.companions[it.charId];
      }
      renderMain();
    }; })(item);

    var imgBox = document.createElement('div');
    imgBox.style.cssText = 'width:100%;height:140px;background:var(--bg-card-elevated);display:flex;align-items:center;justify-content:center;overflow:hidden;';
    if (ch.aspettoImg || ch.avatar || ch.portrait) {
      var img = document.createElement('img'); img.src = ch.aspettoImg || ch.avatar || ch.portrait;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;'; imgBox.appendChild(img);
    } else {
      var ph = document.createElement('div'); ph.style.cssText = 'font-size:48px;line-height:1;'; ph.textContent = '🧙'; imgBox.appendChild(ph);
    }
    card.appendChild(imgBox);

    var info = document.createElement('div');
    info.style.cssText = 'padding:10px 12px 12px;';

    var nome = document.createElement('div');
    nome.style.cssText = 'font-family:\'Cinzel\',serif;font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;';
    nome.textContent = ch.nomePersonaggio || ch.eroe || ch.nome || 'Senza nome'; info.appendChild(nome);

    if (ch.classelivello) {
      var cl = document.createElement('div');
      cl.style.cssText = 'font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px;';
      cl.textContent = ch.classelivello; info.appendChild(cl);
    }

    var badge = document.createElement('div');
    badge.style.cssText = 'display:inline-block;font-size:9px;font-family:\'Cinzel\',serif;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:2px 7px;border-radius:2px;background:rgba(201,165,92,0.12);color:var(--gold-dim);border:1px solid rgba(201,165,92,0.25);';
    badge.textContent = item.username; info.appendChild(badge);

    card.appendChild(info);
    grid.appendChild(card);
  });

  body.appendChild(grid);
  wrap.appendChild(body);
  return wrap;
}

/* ============================================================================
   SEZIONE 11: ARENA 3D DEL DESTINO — LANCIATORE DI DADI POLIEDRICO 3D
   ============================================================================ */
function renderDadi() {
  var wrap = document.createElement("div");

  /* Intestazione della Sezione */
  var header = document.createElement("header");
  header.className = "border-b";
  var hc = document.createElement("div");
  hc.className = "container-main";
  hc.style.cssText = "padding-top:2rem;padding-bottom:1.5rem;";
  hc.innerHTML =
    "<div class=\"header-eyebrow mb-3\"><span>Sala dei Dadi &amp; Destino 3D</span></div>" +
    "<h1 class=\"header-title\">Lanciatore di Dadi 3D</h1>" +
    "<p class=\"font-script italic mt-2 text-lg\" style=\"color:var(--text-muted);\">I poliedri del destino vengono lanciati e rimbalzano in 4 dimensioni con nucleo Tesseract ed echi temporali.</p>";
  header.appendChild(hc);
  wrap.appendChild(header);

  var panel = document.createElement("div");
  panel.className = "dice-wrap";

  var diceBox = document.createElement("div");
  diceBox.className = "dice-panel";
  diceBox.style.maxWidth = "640px";

  /* Stato locale dei controlli 3D */
  var diceCount = state.diceCount || 1;
  var diceMod = state.diceMod || 0;
  var diceRollMode = state.diceRollMode || "normale"; // normale | vantaggio | svantaggio

  /* 1. Titolo Selezione Dado */
  var diceTitle = document.createElement("div");
  diceTitle.style.cssText =
    "font-family:var(--font-display);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.25em;color:var(--gold);margin-bottom:0.85rem;";
  diceTitle.textContent = "Seleziona il Poliedro 4D";
  diceBox.appendChild(diceTitle);

  /* 2. Griglia Tipi Dado (d4, d6, d8, d10, d12, d20, d100) */
  var diceGrid = document.createElement("div");
  diceGrid.className = "dice-type-grid";
  [4, 6, 8, 10, 12, 20, 100].forEach(function (d) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dice-type-btn" + (state.diceType === d ? " active" : "");
    btn.textContent = "d" + d;
    btn.onclick = function () {
      state.diceType = d;
      diceGrid.querySelectorAll(".dice-type-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      rollBtn.innerHTML = "🎲 Lancia " + (diceCount > 1 ? diceCount : "") + "d" + d + " in 4D";
      renderIdle3DDice();
    };
    diceGrid.appendChild(btn);
  });
  diceBox.appendChild(diceGrid);

  /* 3. Barra Quantità Dadi, Modalità (Normale/Vantaggio/Svantaggio) e Modificatore */
  var controlsRow = document.createElement("div");
  controlsRow.style.cssText =
    "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;justify-content:center;margin:0.65rem 0;";

  // Quantità rapida (1d, 2d, 3d, 4d)
  [1, 2, 3, 4].forEach(function (cnt) {
    var qBtn = document.createElement("button");
    qBtn.type = "button";
    qBtn.className = "sium-ctrl-btn" + (diceCount === cnt ? " active" : "");
    qBtn.textContent = cnt + "x";
    qBtn.title = "Lancia " + cnt + " dadi contemporaneamente";
    qBtn.onclick = function () {
      diceCount = cnt;
      state.diceCount = cnt;
      controlsRow.querySelectorAll("[data-qbtn]").forEach(function (b) {
        b.classList.remove("active");
      });
      qBtn.classList.add("active");
      rollBtn.innerHTML = "🎲 Lancia " + (diceCount > 1 ? diceCount : "") + "d" + state.diceType + " in 4D";
      renderIdle3DDice();
    };
    qBtn.setAttribute("data-qbtn", String(cnt));
    controlsRow.appendChild(qBtn);
  });

  // Separatore
  var sepDot = document.createElement("span");
  sepDot.style.cssText = "color:var(--border-gold);margin:0 0.2rem;";
  sepDot.textContent = "•";
  controlsRow.appendChild(sepDot);

  // Modalità Vantaggio / Svantaggio
  [
    { id: "svantaggio", label: "Svantaggio" },
    { id: "normale", label: "Normale" },
    { id: "vantaggio", label: "Vantaggio" }
  ].forEach(function (m) {
    var mBtn = document.createElement("button");
    mBtn.type = "button";
    mBtn.className = "sium-ctrl-btn" + (diceRollMode === m.id ? " active" : "");
    mBtn.setAttribute("data-rmode", m.id);
    mBtn.textContent = m.label;
    mBtn.onclick = function () {
      diceRollMode = m.id;
      state.diceRollMode = m.id;
      controlsRow.querySelectorAll("[data-rmode]").forEach(function (b) {
        b.classList.remove("active");
      });
      mBtn.classList.add("active");
    };
    controlsRow.appendChild(mBtn);
  });

  diceBox.appendChild(controlsRow);

  /* 4. Riga Formula Personalizzata e Modificatore Rapido */
  var formulaWrap = document.createElement("div");
  formulaWrap.style.cssText =
    "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:0.85rem;";

  var formulaInput = document.createElement("input");
  formulaInput.type = "text";
  formulaInput.placeholder = "Formula opzionale (es. 2d6+3, d20+5, 4d8-2)...";
  formulaInput.style.cssText =
    "flex:1;min-width:190px;background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:13px;padding:0.45rem 0.75rem;border-radius:6px;outline:none;";
  formulaInput.title = "Formula dadi personalizzata (es. 2d6+3)";
  formulaWrap.appendChild(formulaInput);

  var modWrap = document.createElement("div");
  modWrap.style.cssText = "display:flex;align-items:center;gap:0.35rem;";
  var modMinus = document.createElement("button");
  modMinus.type = "button";
  modMinus.className = "sium-ctrl-btn";
  modMinus.textContent = "−";
  var modBadge = document.createElement("span");
  modBadge.className = "combat-num";
  modBadge.style.cssText =
    "font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--gold-bright);min-width:2.4rem;text-align:center;";
  modBadge.textContent = (diceMod >= 0 ? "+" : "") + diceMod;
  var modPlus = document.createElement("button");
  modPlus.type = "button";
  modPlus.className = "sium-ctrl-btn";
  modPlus.textContent = "+";

  modMinus.onclick = function () {
    diceMod = Math.max(-20, diceMod - 1);
    state.diceMod = diceMod;
    modBadge.textContent = (diceMod >= 0 ? "+" : "") + diceMod;
  };
  modPlus.onclick = function () {
    diceMod = Math.min(30, diceMod + 1);
    state.diceMod = diceMod;
    modBadge.textContent = (diceMod >= 0 ? "+" : "") + diceMod;
  };

  modWrap.appendChild(modMinus);
  modWrap.appendChild(modBadge);
  modWrap.appendChild(modPlus);
  formulaWrap.appendChild(modWrap);
  diceBox.appendChild(formulaWrap);

  /* 5. ARENA 3D DEL VASSOIO DADI (.sium-3d-dice-arena) */
  var arena = document.createElement("div");
  arena.className = "sium-3d-dice-arena";
  arena.title = "Clicca sul vassoio 3D per lanciare i dadi!";

  // Cerchio runico prospettico inciso sul fondo del vassoio
  var runeFloor = document.createElement("div");
  runeFloor.className = "sium-arena-rune-floor";
  runeFloor.innerHTML =
    "<svg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\">" +
      "<circle cx=\"100\" cy=\"100\" r=\"92\" fill=\"none\" stroke=\"#d8b25c\" stroke-width=\"1.5\" stroke-dasharray=\"6 4\"/>" +
      "<circle cx=\"100\" cy=\"100\" r=\"74\" fill=\"none\" stroke=\"#d8b25c\" stroke-width=\"1\"/>" +
      "<polygon points=\"100,12 188,100 100,188 12,100\" fill=\"none\" stroke=\"#d8b25c\" stroke-width=\"1\"/>" +
      "<polygon points=\"100,26 174,100 100,174 26,100\" fill=\"none\" stroke=\"#f5d98e\" stroke-width=\"0.9\" transform=\"rotate(45 100 100)\"/>" +
    "</svg>";
  arena.appendChild(runeFloor);

  var diceVisual = document.createElement("div");
  diceVisual.className = "sium-dice-3d-stage-wrap";
  arena.appendChild(diceVisual);

  var arenaHint = document.createElement("div");
  arenaHint.style.cssText =
    "position:relative;z-index:3;font-family:var(--font-display);font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-muted);margin-top:0.35rem;";
  arenaHint.textContent = "— Clicca sul vassoio 4D o premi Lancia —";
  arena.appendChild(arenaHint);

  diceBox.appendChild(arena);

  /* Etichetta Risultato Totale */
  var totalLbl = document.createElement("div");
  totalLbl.className = "combat-num";
  totalLbl.style.cssText =
    "text-align:center;font-family:var(--font-display);font-size:21px;font-weight:900;color:var(--gold-bright);min-height:32px;margin-bottom:0.35rem;letter-spacing:0.06em;";
  diceBox.appendChild(totalLbl);

  function createDie3DNode(faces, val, rolling, isCrit, isFail, targetVal) {
    if (window.SiumAnimations && typeof window.SiumAnimations.build3DDieElement === "function") {
      return window.SiumAnimations.build3DDieElement(faces, val, rolling, isCrit, isFail, targetVal);
    }
    var fallback = document.createElement("div");
    fallback.textContent = val !== null ? String(val) : "🎲";
    return fallback;
  }

  function renderIdle3DDice() {
    diceVisual.innerHTML = "";
    var previewCount = Math.min(diceCount, 4);
    for (var i = 0; i < previewCount; i++) {
      diceVisual.appendChild(createDie3DNode(state.diceType, state.diceType, false, false, false, state.diceType));
    }
  }

  renderIdle3DDice();

  function _showRoll3D(rolls, faces, total, mod, detailNote) {
    arena.classList.add("is-rolling");
    diceVisual.innerHTML = "";
    totalLbl.textContent = "✦ Il dado 3D sta rotolando sul panno... ✦";
    totalLbl.style.color = "var(--text-secondary)";

    var thrownNodes = [];
    rolls.forEach(function (v) {
      var startFace = Math.floor(Math.random() * faces) + 1;
      var node = createDie3DNode(faces, startFace, true, false, false, v);
      diceVisual.appendChild(node);
      thrownNodes.push({ node: node, val: v });
    });

    var isFast = !!(navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || ""));
    setTimeout(function () {
      arena.classList.remove("is-rolling");
      thrownNodes.forEach(function (item) {
        var v = item.val;
        var slot = item.node;
        var isCrit = faces === 20 && v === 20;
        var isFail = faces === 20 && v === 1;
        slot.classList.remove("is-rolling");
        slot.classList.add("is-settled");
        if (isCrit) slot.classList.add("is-crit");
        if (isFail) slot.classList.add("is-fail");
        var numEl = slot.querySelector(".face-front .sium-die-svg-num") || slot.querySelector(".sium-die-svg-num") || slot.querySelector(".face-front");
        if (numEl) numEl.textContent = String(v);
      });

      var breakdown = rolls.join(" + ");
      var modStr = mod ? (mod > 0 ? " + " + mod : " − " + Math.abs(mod)) : "";
      var fullText =
        rolls.length > 1 || mod
          ? "Totale: " + total + "  (" + breakdown + modStr + ")"
          : "Risultato: " + total;
      if (detailNote) fullText += " " + detailNote;

      var onlyCrit = faces === 20 && rolls.indexOf(20) >= 0;
      var onlyFail = faces === 20 && rolls.indexOf(1) >= 0 && !onlyCrit;

      if (onlyCrit) {
        totalLbl.style.color = "#fde047";
        totalLbl.textContent = "🌟 CRITICO! " + fullText;
      } else if (onlyFail) {
        totalLbl.style.color = "#f87171";
        totalLbl.textContent = "💀 FALLIMENTO CRITICO! " + fullText;
      } else {
        totalLbl.style.color = "var(--gold-bright)";
        totalLbl.textContent = fullText;
      }
    }, isFast ? 50 : 1000);
  }

  function executeDiceRoll() {
    var formula = formulaInput ? formulaInput.value.trim().toLowerCase() : "";
    if (formula) {
      var fMatch = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/);
      if (fMatch) {
        var nDice = Math.min(parseInt(fMatch[1], 10) || 1, 12);
        var faces = Math.min(parseInt(fMatch[2], 10) || 20, 1000);
        var mod = parseInt(fMatch[3] || "0", 10);
        var total = 0;
        var rolls = [];
        for (var ri = 0; ri < nDice; ri++) {
          var rv = Math.floor(Math.random() * faces) + 1;
          rolls.push(rv);
          total += rv;
        }
        total += mod;
        var validFaces = [4, 6, 8, 10, 12, 20, 100].indexOf(faces) >= 0 ? faces : 20;
        _showRoll3D(rolls, validFaces, total, mod, "[" + formula + "]");
        state.diceHistory.unshift({
          value: total,
          diceType: faces,
          username: state.currentUser ? state.currentUser.username : "?",
          formula: formula
        });
        if (state.diceHistory.length > 20) state.diceHistory.pop();
        if (_db && state.currentUser) {
          _db.ref("diceRolls").push({
            value: total,
            diceType: faces,
            username: state.currentUser.username,
            timestamp: firebase.database.ServerValue.TIMESTAMP
          });
        }
        updateDiceHistory(histList);
        return;
      }
    }

    /* Probabilità 100% equa e uniforme per TUTTI gli account (nessun bonus o vantaggio nascosto per account) */
    var dtype = state.diceType || 20;
    var rollsArr = [];
    var sum = 0;
    var detailNote = "";

    if (diceRollMode !== "normale" && diceCount === 1) {
      var a1 = Math.floor(Math.random() * dtype) + 1;
      var a2 = Math.floor(Math.random() * dtype) + 1;
      var chosen = diceRollMode === "vantaggio" ? Math.max(a1, a2) : Math.min(a1, a2);
      rollsArr = [chosen];
      sum = chosen + diceMod;
      detailNote = "[" + diceRollMode.toUpperCase() + ": " + a1 + ", " + a2 + " → " + chosen + "]";
    } else {
      for (var c = 0; c < diceCount; c++) {
        var val = Math.floor(Math.random() * dtype) + 1;
        rollsArr.push(val);
        sum += val;
      }
      sum += diceMod;
    }

    _showRoll3D(rollsArr, dtype, sum, diceMod, detailNote);

    var isCrit = dtype === 20 && rollsArr.indexOf(20) >= 0;
    var isFail = dtype === 20 && rollsArr.indexOf(1) >= 0 && !isCrit;

    state.diceHistory.unshift({
      value: sum,
      diceType: dtype,
      username: state.currentUser ? state.currentUser.username : "?"
    });
    if (state.diceHistory.length > 20) state.diceHistory.pop();

    if (_db && state.currentUser) {
      _db.ref("diceRolls").push({
        value: sum,
        diceType: dtype,
        username: state.currentUser.username,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
    }

    updateDiceHistory(histList);

    if (isCrit && state.currentUser) {
      notify("🌟 CRITICO! " + state.currentUser.username + " ha ottenuto un 20 naturale!");
    }
    if (isFail && state.currentUser) {
      notify("💀 FALLIMENTO CRITICO! " + state.currentUser.username + " ha ottenuto 1!");
    }
  }

  arena.onclick = executeDiceRoll;

  /* Pulsante Principale Lancia 3D */
  var rollBtn = document.createElement("button");
  rollBtn.type = "button";
  rollBtn.className = "dice-roll-btn";
  rollBtn.innerHTML = "🎲 Lancia " + (diceCount > 1 ? diceCount : "") + "d" + state.diceType + " in 4D";
  rollBtn.onclick = executeDiceRoll;
  diceBox.appendChild(rollBtn);

  /* Storico Ultimi Lanci */
  var histSection = document.createElement("div");
  histSection.className = "dice-history";
  var histTitle = document.createElement("div");
  histTitle.className = "dice-history-title";
  histTitle.textContent = "Ultimi Lanci";
  histSection.appendChild(histTitle);
  var histList = document.createElement("div");
  histList.className = "dice-history-list";
  updateDiceHistory(histList);
  histSection.appendChild(histList);
  diceBox.appendChild(histSection);

  panel.appendChild(diceBox);
  wrap.appendChild(panel);
  return wrap;
}

function updateDiceHistory(listEl) {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!state.diceHistory.length) {
    listEl.innerHTML = '<div style="font-family:\'EB Garamond\',serif;font-style:italic;color:var(--text-faint);font-size:14px;padding:0.5rem;">Nessun lancio ancora.</div>';
    return;
  }
  state.diceHistory.slice(0, 12).forEach(function(h) {
    var isCrit = h.diceType === 20 && h.value === 20;
    var isFail = h.diceType === 20 && h.value === 1;
    var item = document.createElement('div'); item.className = 'dice-history-item';
    var valEl = document.createElement('div');
    valEl.className = 'dice-history-value' + (isCrit ? ' crit' : isFail ? ' fail' : '');
    valEl.textContent = h.value;
    var infoEl = document.createElement('div');
    infoEl.style.cssText = 'flex:1;font-size:11px;';
    infoEl.textContent = (h.username || '?') + ' · d' + (h.diceType || 20);
    if (isCrit) infoEl.textContent += ' 🌟';
    if (isFail) infoEl.textContent += ' 💀';
    item.appendChild(valEl); item.appendChild(infoEl);
    listEl.appendChild(item);
  });
}

/* ============================================================
   MAPPA DEL MONDO INTERATTIVA
   ============================================================ */
var _leafletMap = null;
var _flagLayer = null;
var _overlayPolyLayer = null;
var _ovDrawActive = false;
var _ovDrawLayerKey = null;
var _ovDrawFactionId = null;
var _ovDrawPoints = [];
var _ovDrawPoly = null;
var _ovDrawMarkers = [];
var _ovDrawCursor = null;
var OVERLAY_DEFS = [
  { key:'political',    label:'Politica',      icon:'⚑' },
  { key:'associations', label:'Associazioni',  icon:'◈' }
];
var _flagMarkers = {};
var _secMapFid = null;

/* ─────────────────────────────────────────────────────────────
   VISTA MAPPA SECONDARIA  (pin invisibili stile AC Syndicate)
───────────────────────────────────────────────────────────── */
var _secMapCleanupFns = null;

function _openSecondaryMapView(fid) {
  _secMapFid = fid;
  var f = state.mappaFlags[fid] || {};
  var mapContainer = document.querySelector('.mappa-container');
  if (!mapContainer) return;

  if (_secMapCleanupFns) { _secMapCleanupFns(); _secMapCleanupFns = null; }
  var old = document.getElementById('mappa-sec-overlay');
  if (old) old.remove();

  var dmCtrls = mapContainer.querySelector('.mappa-dm-controls');
  if (dmCtrls) dmCtrls.style.display = 'none';
  var lmap = document.getElementById('leaflet-map');
  if (lmap) lmap.style.display = 'none';
  var layerBar = mapContainer.querySelector('.mappa-layer-bar');
  if (layerBar) layerBar.style.display = 'none';
  var infoP = document.querySelector('.mappa-info-panel');
  if (infoP) infoP.classList.remove('open');

  var overlay = document.createElement('div');
  overlay.id = 'mappa-sec-overlay';
  overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:500;background:#0c0702;display:flex;flex-direction:column;overflow:hidden;';

  /* ── barra superiore ── */
  var topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;align-items:center;padding:0.45rem 0.8rem;background:rgba(0,0,0,0.7);border-bottom:1px solid rgba(201,165,92,0.3);flex-shrink:0;';
  var backBtn = document.createElement('button');
  backBtn.className = 'mappa-btn mappa-btn-add-map';
  backBtn.innerHTML = '← Torna alla Mappa';
  backBtn.onclick = function() { _closeSecondaryMapView(); };
  topBar.appendChild(backBtn);
  overlay.appendChild(topBar);

  var bodyRow = document.createElement('div');
  bodyRow.style.cssText = 'flex:1;display:flex;overflow:hidden;min-height:0;';

  /* ── CENTRO: mappa secondaria con zoom+pan ── */
  var centerCol = document.createElement('div');
  centerCol.style.cssText = 'flex:1;position:relative;overflow:hidden;background:#0a0602;';

  if (f.mappaSec) {
    var zScale = 1, zPanX = 0, zPanY = 0;
    var zDrag = false, zSX, zSY, zSPX, zSPY;

    var imgWrap = document.createElement('div');
    imgWrap.style.cssText = 'width:100%;height:100%;overflow:hidden;cursor:grab;display:flex;align-items:center;justify-content:center;';

    var secImg = document.createElement('img');
    secImg.src = f.mappaSec;
    secImg.draggable = false;
    secImg.style.cssText = 'max-width:100%;max-height:100%;user-select:none;pointer-events:none;transform-origin:center center;transform:translate(0px,0px) scale(1);';

    function _zApply() {
      secImg.style.transform = 'translate('+zPanX+'px,'+zPanY+'px) scale('+zScale+')';
    }
    var _zWheel = function(e) {
      e.preventDefault();
      zScale = Math.max(0.3, Math.min(10, zScale * (e.deltaY < 0 ? 1.12 : 0.89)));
      _zApply();
    };
    var _zDown = function(e) {
      if (e.button!==0) return;
      zDrag=true; zSX=e.clientX; zSY=e.clientY; zSPX=zPanX; zSPY=zPanY;
      imgWrap.style.cursor='grabbing';
    };
    var _zMove = function(e) {
      if (!zDrag) return;
      zPanX=zSPX+(e.clientX-zSX); zPanY=zSPY+(e.clientY-zSY);
      _zApply();
    };
    var _zUp = function() { zDrag=false; imgWrap.style.cursor='grab'; };

    imgWrap.addEventListener('wheel', _zWheel, {passive:false});
    imgWrap.addEventListener('mousedown', _zDown);
    document.addEventListener('mousemove', _zMove);
    document.addEventListener('mouseup', _zUp);
    _secMapCleanupFns = function() {
      document.removeEventListener('mousemove', _zMove);
      document.removeEventListener('mouseup', _zUp);
    };

    imgWrap.appendChild(secImg);
    centerCol.appendChild(imgWrap);

    /* pulsanti zoom */
    var zCtrl = document.createElement('div');
    zCtrl.style.cssText = 'position:absolute;bottom:60px;right:12px;display:flex;flex-direction:column;gap:5px;z-index:10;';
    var _zBS = 'width:36px;height:36px;background:rgba(0,0,0,0.78);border:1px solid rgba(201,165,92,0.5);color:#f5c842;font-size:20px;font-weight:bold;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    var zIn = document.createElement('button'); zIn.innerHTML='<b>+</b>'; zIn.style.cssText=_zBS;
    zIn.onclick = function(){zScale=Math.min(10,zScale*1.2);_zApply();};
    var zOut = document.createElement('button'); zOut.innerHTML='<b>−</b>'; zOut.style.cssText=_zBS;
    zOut.onclick = function(){zScale=Math.max(0.3,zScale/1.2);_zApply();};
    var zRst = document.createElement('button'); zRst.textContent='↺'; zRst.style.cssText=_zBS; zRst.title='Reset zoom';
    zRst.onclick = function(){zScale=1;zPanX=0;zPanY=0;_zApply();};
    zCtrl.appendChild(zIn); zCtrl.appendChild(zOut); zCtrl.appendChild(zRst);
    centerCol.appendChild(zCtrl);

  } else {
    var noSecHint = document.createElement('div');
    noSecHint.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:rgba(201,165,92,0.28);';
    noSecHint.innerHTML = '<div style="font-size:48px;margin-bottom:0.6rem;">🗺</div>' +
      '<div style="font-family:\'Cinzel\',serif;font-size:14px;letter-spacing:0.1em;">Nessuna mappa caricata</div>' +
      (isDM() ? '<div style="font-size:11px;margin-top:0.4rem;opacity:0.7;">Modifica il pin nella mappa del mondo per caricarla</div>' : '');
    centerCol.appendChild(noSecHint);
  }

  if (f.nome) {
    var nameOv = document.createElement('div');
    nameOv.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:1.2rem 2rem 0.9rem;background:linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 100%);pointer-events:none;text-align:center;';
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-family:\'Cinzel\',serif;font-size:clamp(18px,3vw,30px);font-weight:900;letter-spacing:0.2em;color:#f5d070;text-shadow:0 2px 14px rgba(0,0,0,0.95),0 0 24px rgba(245,166,35,0.5);text-transform:uppercase;';
    nameEl.textContent = f.nome;
    nameOv.appendChild(nameEl);
    centerCol.appendChild(nameOv);
  }
  bodyRow.appendChild(centerCol);

  /* ── DESTRA: scheda luogo (senza sezione mappa secondaria) ── */
  var rightCol = document.createElement('div');
  rightCol.style.cssText = 'width:340px;flex-shrink:0;background:rgba(12,7,2,0.96);border-left:1px solid rgba(201,165,92,0.18);overflow-y:auto;';
  var fakePanel = document.createElement('div');
  fakePanel.innerHTML = '<div class="mappa-info-header"><span class="mappa-info-title">📜 Scheda Luogo</span></div><div class="mappa-info-body"></div>';
  rightCol.appendChild(fakePanel);
  renderMappaFlagPanel(fakePanel, fid, false);
  bodyRow.appendChild(rightCol);

  overlay.appendChild(bodyRow);
  mapContainer.appendChild(overlay);

  // Leggi sempre mappaSec fresco da Firebase — se diverso da stato, aggiorna e riapri
  if (_db) {
    _db.ref(_mappaFlagPath(fid)+'/mappaSec').once('value', function(snap) {
      var ms = snap.val();
      var prev = state.mappaFlags[fid] && state.mappaFlags[fid].mappaSec;
      if (ms && ms !== prev && document.getElementById('mappa-sec-overlay')) {
        if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
        state.mappaFlags[fid].mappaSec = ms;
        _closeSecondaryMapView();
        _openSecondaryMapView(fid);
      }
    });
  }
}

function _closeSecondaryMapView() {
  if (_secMapCleanupFns) { _secMapCleanupFns(); _secMapCleanupFns = null; }
  _secMapFid = null;
  var overlay = document.getElementById('mappa-sec-overlay');
  if (overlay) overlay.remove();
  var mapContainer = document.querySelector('.mappa-container');
  if (!mapContainer) return;
  var dmCtrls = mapContainer.querySelector('.mappa-dm-controls');
  if (dmCtrls) dmCtrls.style.display = '';
  var lmap = document.getElementById('leaflet-map');
  if (lmap) lmap.style.display = '';
  var layerBar = mapContainer.querySelector('.mappa-layer-bar');
  if (layerBar) layerBar.style.display = '';
}

function refreshMappaFlags() {
  if (!_leafletMap || !_flagLayer) return;
  _flagLayer.clearLayers();
  _flagMarkers = {};
  Object.keys(state.mappaFlags || {}).forEach(function(fid) {
    var f = state.mappaFlags[fid];
    if (f && typeof f.lat === 'number' && typeof f.lng === 'number') {

      /* ── PIN INVISIBILE ── */
      if (f.visibile === false) {
        if (!isDM()) return; /* i giocatori non vedono nulla */
        /* Ghost marker: visibile solo al DM, semitrasparente */
        var ghostIcon = L.divIcon({
          className: '',
          html: '<div title="Pin invisibile" style="width:36px;height:40px;display:flex;align-items:flex-end;justify-content:center;opacity:0.40;filter:grayscale(0.6) drop-shadow(0 2px 5px rgba(0,0,0,0.7));">' +
                '<svg viewBox="0 0 36 40" width="36" height="40" xmlns="http://www.w3.org/2000/svg">' +
                '<rect x="17" y="16" width="2.5" height="22" rx="1.2" fill="#555"/>' +
                '<circle cx="18" cy="13" r="12" fill="#333" stroke="#777" stroke-width="1.5" stroke-dasharray="3,2"/>' +
                '<text x="18" y="18" text-anchor="middle" font-size="13" fill="#aaa">👁</text>' +
                '</svg></div>',
          iconSize: [36, 40], iconAnchor: [18, 38]
        });
        var ghostMarker = L.marker([f.lat, f.lng], {icon: ghostIcon, interactive: true, bubblingMouseEvents: false});
        (function(fid_) {
          ghostMarker.on('click touchend', function(e) {
            if (e.type === 'touchend' && e.originalEvent) e.originalEvent.preventDefault();
            _openSecondaryMapView(fid_);
          });
        })(fid);
        ghostMarker.addTo(_flagLayer);
        _flagMarkers[fid] = ghostMarker;
        return;
      }

      /* ── PIN NORMALE ── */
      var flagIcon = L.divIcon({
        className: '',
        html: '<div style="width:36px;height:40px;display:flex;align-items:flex-end;justify-content:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.8));">' +
              '<svg viewBox="0 0 36 40" width="36" height="40" xmlns="http://www.w3.org/2000/svg">' +
              '<rect x="17" y="16" width="2.5" height="22" rx="1.2" fill="#5a3010" stroke="#3a1e08" stroke-width="0.5"/>' +
              '<circle cx="18" cy="13" r="12" fill="url(#cg)" stroke="#7a4e08" stroke-width="1.2"/>' +
              '<circle cx="18" cy="13" r="10" fill="none" stroke="#c8860a" stroke-width="0.7" stroke-dasharray="2,1.2"/>' +
              '<ellipse cx="14" cy="9" rx="4" ry="2.5" fill="rgba(255,240,160,0.35)" transform="rotate(-20,14,9)"/>' +
              '<text x="18" y="17.5" text-anchor="middle" font-size="10" font-family="serif" fill="#7a4500" font-weight="bold">★</text>' +
              '<defs><radialGradient id="cg" cx="38%" cy="32%" r="62%"><stop offset="0%" stop-color="#ffe87a"/><stop offset="45%" stop-color="#d4a820"/><stop offset="100%" stop-color="#8b5e08"/></radialGradient></defs>' +
              '</svg></div>',
        iconSize: [36, 40], iconAnchor: [18, 38]
      });
      var marker = L.marker([f.lat, f.lng], {icon: flagIcon});
      (function(fid_) {
        marker.on('click', function() {
          state.mappaSelectedFlag = fid_;
          var panel = document.querySelector('.mappa-info-panel');
          if (panel) { panel.classList.add('open'); renderMappaFlagPanel(panel, fid_); }
        });
      })(fid);
      marker.addTo(_flagLayer);
      _flagMarkers[fid] = marker;
    }
  });
}

function renderMappaFlagPanel(panel, fid, inSecView) {
  var f = state.mappaFlags[fid] || {};
  var header = panel.querySelector('.mappa-info-header');
  var body = panel.querySelector('.mappa-info-body');
  if (!header || !body) return;
  body.innerHTML = '';

  if (isDM()) {
    // Nome (editabile)
    var nomeWrap = document.createElement('div');
    var nomeLbl = document.createElement('span'); nomeLbl.className = 'mappa-field-lbl'; nomeLbl.textContent = 'Nome del Luogo';
    var nomeInp = document.createElement('input'); nomeInp.type = 'text'; nomeInp.className = 'mappa-field-input';
    nomeInp.value = f.nome || ''; nomeInp.placeholder = 'es. Villaggio di Pietrabruna';
    nomeInp.oninput = function() {
      if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
      state.mappaFlags[fid].nome = this.value;
      _db && _db.ref(_mappaFlagPath(fid) + '/nome').set(this.value);
    };
    nomeWrap.appendChild(nomeLbl); nomeWrap.appendChild(nomeInp); body.appendChild(nomeWrap);

    /* ── Toggle PIN INVISIBILE ── */
    var visRow = document.createElement('div');
    visRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0 0.45rem;border-bottom:1px solid rgba(201,165,92,0.12);margin-bottom:0.1rem;';
    var visLbl = document.createElement('span');
    visLbl.className = 'mappa-field-lbl';
    visLbl.style.marginBottom = '0';
    visLbl.textContent = '🕵️ Pin Invisibile (apre mappa zona)';
    var visChk = document.createElement('input');
    visChk.type = 'checkbox';
    visChk.style.cssText = 'width:18px;height:18px;cursor:pointer;accent-color:#f5a623;flex-shrink:0;';
    visChk.checked = f.visibile === false;
    visChk.onchange = function() {
      if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
      state.mappaFlags[fid].visibile = this.checked ? false : true;
      _db && _db.ref(_mappaFlagPath(fid) + '/visibile').set(this.checked ? false : true);
      refreshMappaFlags();
      renderMappaFlagPanel(panel, fid);
    };
    visRow.appendChild(visLbl); visRow.appendChild(visChk);
    body.appendChild(visRow);

  // Gradimento → slider reputazione
  var gradWrap = document.createElement('div');
  var gradLbl = document.createElement('span');
  gradLbl.className = 'mappa-field-lbl';
  gradLbl.textContent = 'Reputazione';
  gradWrap.appendChild(gradLbl);

  var REP_LEVELS = [
    {label:'Criminali Ricercati', color:'#c84040', bg:'rgba(138,36,36,0.25)', bd:'rgba(138,36,36,0.6)'},
    {label:'Fuorilegge Noti',     color:'#c86040', bg:'rgba(138,76,36,0.25)', bd:'rgba(138,76,36,0.6)'},
    {label:'Sconosciuti',         color:'#8b8b40', bg:'rgba(80,80,20,0.25)',  bd:'rgba(100,100,30,0.5)'},
    {label:'Neutrale',            color:'#d4b070', bg:'rgba(80,70,20,0.2)',   bd:'rgba(120,100,40,0.5)'},
    {label:'Rispettati',          color:'#60a870', bg:'rgba(30,80,30,0.2)',   bd:'rgba(50,120,50,0.5)'},
    {label:'Eroi Locali',         color:'#40c860', bg:'rgba(20,100,40,0.25)', bd:'rgba(40,140,60,0.6)'},
    {label:'Eroi Leggendari',     color:'#20e870', bg:'rgba(10,120,50,0.3)',  bd:'rgba(20,160,70,0.7)'}
  ];

  // Converti valore salvato in indice slider (default 3 = Neutrale)
  var repIdx = 3;
  if (f.gradimento) {
    var savedIdx = REP_LEVELS.findIndex(function(r) { return r.label === f.gradimento; });
    if (savedIdx >= 0) repIdx = savedIdx;
  }

  var sliderWrap = document.createElement('div');
  sliderWrap.className = 'rep-slider-wrap';

  var sliderLabels = document.createElement('div');
  sliderLabels.className = 'rep-slider-labels';
  sliderLabels.innerHTML = '<span class="rep-lbl-bad">Ricercati</span><span class="rep-lbl-neu">Neutrale</span><span class="rep-lbl-good">Eroi</span>';
  sliderWrap.appendChild(sliderLabels);

  var slider = document.createElement('input');
  slider.type = 'range'; slider.min = '0'; slider.max = '6'; slider.step = '1';
  slider.value = repIdx;
  slider.className = 'rep-slider';
  sliderWrap.appendChild(slider);

  var repDisplay = document.createElement('div');
  repDisplay.className = 'rep-value-display';
  function updateRepDisplay(idx) {
    var r = REP_LEVELS[idx];
    repDisplay.textContent = r.label;
    repDisplay.style.color = r.color;
    repDisplay.style.background = r.bg;
    repDisplay.style.borderColor = r.bd;
  }
  updateRepDisplay(repIdx);
  sliderWrap.appendChild(repDisplay);

  slider.oninput = function() {
    var idx = parseInt(this.value);
    updateRepDisplay(idx);
    var val = REP_LEVELS[idx].label;
    if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
    state.mappaFlags[fid].gradimento = val;
    _db && _db.ref(_mappaFlagPath(fid) + '/gradimento').set(val);
  };

  gradWrap.appendChild(sliderWrap);
  body.appendChild(gradWrap);

    // Immagine impresa
    var imgWrap = document.createElement('div');
    var imgLbl = document.createElement('span'); imgLbl.className = 'mappa-field-lbl'; imgLbl.textContent = 'Immagine Impresa';
    imgWrap.appendChild(imgLbl);
    if (f.immagine) {
      var img = document.createElement('img'); img.src = f.immagine; img.className = 'mappa-impresa-img';
      imgWrap.appendChild(img);
    } else {
      var ph = document.createElement('div'); ph.className = 'mappa-impresa-placeholder'; ph.textContent = 'Nessuna immagine';
      imgWrap.appendChild(ph);
    }
    // Pulsante carica immagine (file locale o URL)
    var imgBtnsRow = document.createElement('div');
    imgBtnsRow.style.cssText = 'display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap;';

    var imgBtnFile = document.createElement('button');
    imgBtnFile.className = 'mappa-btn';
    imgBtnFile.textContent = '\uD83D\uDDBC\uFE0F ' + (f.immagine ? 'Cambia (File)' : 'Carica (File)');
    imgBtnFile.onclick = function() {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = function(e) {
        var file = e.target.files[0]; if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
          state.mappaFlags[fid].immagine = ev.target.result;
          _db && _db.ref(_mappaFlagPath(fid) + '/immagine').set(ev.target.result);
          renderMappaFlagPanel(panel, fid);
        };
        reader.readAsDataURL(file);
      };
      inp.click();
    };
    imgBtnsRow.appendChild(imgBtnFile);

    var imgBtnUrl = document.createElement('button');
    imgBtnUrl.className = 'mappa-btn';
    imgBtnUrl.textContent = '\uD83D\uDD17 ' + (f.immagine ? 'Cambia (URL)' : 'Aggiungi (URL)');
    imgBtnUrl.onclick = function() {
      var url = prompt('Incolla URL immagine:');
      if (url) {
        if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
        state.mappaFlags[fid].immagine = url;
        _db && _db.ref(_mappaFlagPath(fid) + '/immagine').set(url);
        renderMappaFlagPanel(panel, fid);
      }
    };
    imgBtnsRow.appendChild(imgBtnUrl);

    imgWrap.appendChild(imgBtnsRow); body.appendChild(imgWrap);

    // Riassunto
    var riaWrap = document.createElement('div');
    var riaLbl = document.createElement('span'); riaLbl.className = 'mappa-field-lbl'; riaLbl.textContent = 'Riassunto Geste';
    var riaTA = document.createElement('textarea'); riaTA.className = 'mappa-field-input mappa-field-textarea';
    riaTA.value = f.riassunto || ''; riaTA.placeholder = 'Diario delle imprese in questo luogo...';
    riaTA.oninput = function() {
      if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
      state.mappaFlags[fid].riassunto = this.value;
      _db && _db.ref(_mappaFlagPath(fid) + '/riassunto').set(this.value);
    };
    riaWrap.appendChild(riaLbl); riaWrap.appendChild(riaTA); body.appendChild(riaWrap);

    /* ===== SEZIONI CITTÀ ===== */
    function makeCitySection(label, emoji, stateKey) {
      if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
      if (!Array.isArray(state.mappaFlags[fid][stateKey])) state.mappaFlags[fid][stateKey] = [];
      var items = state.mappaFlags[fid][stateKey];

      var sec = document.createElement('div'); sec.className = 'city-section';
      var hdr = document.createElement('div'); hdr.className = 'city-section-header';
      hdr.innerHTML = emoji + ' ' + label + ' <span style="color:var(--gold-dim);font-weight:400;">▾</span>';
      var bdy = document.createElement('div'); bdy.className = 'city-section-body';

      hdr.onclick = function() {
        bdy.classList.toggle('collapsed');
        var arrow = hdr.querySelector('span');
        if (arrow) arrow.textContent = bdy.classList.contains('collapsed') ? '▸' : '▾';
      };

      function rebuildItems() {
        bdy.innerHTML = '';
        items.forEach(function(item, idx) {
          var row = document.createElement('div'); row.className = 'city-poi-item';
          var txt = document.createElement('span'); txt.textContent = item; txt.style.flex = '1';
          row.appendChild(txt);
          if (isDM()) {
            var del = document.createElement('button'); del.className = 'city-poi-del'; del.textContent = '✕';
            (function(i) {
              del.onclick = function() {
                items.splice(i, 1);
                var upd = {}; upd[stateKey] = items.slice();
                _db && _db.ref(_mappaFlagPath(fid)).update(upd);
                rebuildItems();
              };
            })(idx);
            row.appendChild(del);
          }
          bdy.appendChild(row);
        });
        if (isDM()) {
          var addRow = document.createElement('div'); addRow.className = 'city-add-row';
          var inp = document.createElement('input'); inp.className = 'city-add-inp'; inp.type = 'text';
          inp.placeholder = 'Aggiungi voce…';
          var btn = document.createElement('button'); btn.className = 'city-add-btn'; btn.textContent = '+ Aggiungi';
          btn.onclick = function() {
            var val = inp.value.trim(); if (!val) return;
            items.push(val);
            var upd = {}; upd[stateKey] = items.slice();
            _db && _db.ref(_mappaFlagPath(fid)).update(upd);
            inp.value = '';
            rebuildItems();
          };
          inp.onkeydown = function(e) { if (e.key === 'Enter') btn.click(); };
          addRow.appendChild(inp); addRow.appendChild(btn);
          bdy.appendChild(addRow);
        }
      }
      rebuildItems();
      sec.appendChild(hdr); sec.appendChild(bdy);
      return sec;
    }

    body.appendChild(makeCitySection('Luoghi di Interesse', '🏛', 'luoghi'));
    body.appendChild(makeCitySection('NPC Chiave', '👤', 'npcChiave'));
    body.appendChild(makeCitySection('Loot & Segreti', '💎', 'lootSegreti'));

    /* ── SEZIONE MAPPA SECONDARIA (solo se pin invisibile e non già nella vista sec.) ── */
    if (!inSecView && f.visibile === false) {
      var secSec = document.createElement('div');
      secSec.style.cssText = 'border:1px solid rgba(201,165,92,0.22);border-radius:6px;padding:0.7rem 0.65rem;margin:0.6rem 0;background:rgba(16,8,2,0.55);';

      var secTitle = document.createElement('div');
      secTitle.style.cssText = 'font-family:\'Cinzel\',serif;font-size:10px;font-weight:700;color:var(--gold-bright);letter-spacing:0.14em;margin-bottom:0.65rem;';
      secTitle.textContent = '🗺 MAPPA SECONDARIA';
      secSec.appendChild(secTitle);

      /* immagine mappa zona */
      var secImgLbl = document.createElement('span'); secImgLbl.className = 'mappa-field-lbl'; secImgLbl.textContent = 'Immagine mappa zona';
      secSec.appendChild(secImgLbl);
      if (f.mappaSec) {
        var secPrev = document.createElement('img');
        secPrev.src = f.mappaSec;
        secPrev.style.cssText = 'width:100%;max-height:70px;object-fit:cover;border-radius:4px;margin-bottom:0.4rem;border:1px solid rgba(201,165,92,0.25);';
        secSec.appendChild(secPrev);
      }
      var secBtns = document.createElement('div');
      secBtns.style.cssText = 'display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.65rem;';
      var secFileBt = document.createElement('button'); secFileBt.className = 'mappa-btn';
      secFileBt.textContent = f.mappaSec ? '📁 Cambia' : '📁 Carica File';
      secFileBt.onclick = function() {
        var inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
        inp.onchange = function(e) {
          var file = e.target.files[0]; if (!file) return;
          var rd = new FileReader();
          rd.onload = function(ev) {
            var img = new Image();
            img.onload = function() {
              var MAX = 1400, w = img.width, h = img.height;
              var scale = Math.min(1, MAX/w, MAX/h);
              var cv = document.createElement('canvas');
              cv.width = Math.round(w*scale); cv.height = Math.round(h*scale);
              cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
              var compressed = cv.toDataURL('image/jpeg', 0.82);
              if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
              state.mappaFlags[fid].mappaSec = compressed;
              if (_db) {
                _db.ref(_mappaFlagPath(fid)+'/mappaSec').set(compressed)
                  .then(function(){ notify('Mappa zona salvata ✓', 'ok'); })
                  .catch(function(err){ notify('Errore salvataggio mappa: '+err.message, 'err'); });
              }
              if (_secMapFid === fid && document.getElementById('mappa-sec-overlay')) {
                _closeSecondaryMapView(); _openSecondaryMapView(fid);
              } else { renderMappaFlagPanel(panel, fid); }
            };
            img.src = ev.target.result;
          };
          rd.readAsDataURL(file);
        };
        inp.click();
      };
      secBtns.appendChild(secFileBt);
      var secUrlBt = document.createElement('button'); secUrlBt.className = 'mappa-btn';
      secUrlBt.textContent = '🔗 URL';
      secUrlBt.onclick = function() {
        var url = prompt('URL immagine mappa zona:');
        if (url) {
          if (!state.mappaFlags[fid]) state.mappaFlags[fid] = {};
          state.mappaFlags[fid].mappaSec = url;
          if (_db) {
            _db.ref(_mappaFlagPath(fid)+'/mappaSec').set(url)
              .then(function(){ notify('Mappa zona salvata ✓', 'ok'); })
              .catch(function(err){ notify('Errore salvataggio mappa: '+err.message, 'err'); });
          }
          if (_secMapFid === fid && document.getElementById('mappa-sec-overlay')) {
            _closeSecondaryMapView(); _openSecondaryMapView(fid);
          } else { renderMappaFlagPanel(panel, fid); }
        }
      };
      secBtns.appendChild(secUrlBt);
      secSec.appendChild(secBtns);

      body.appendChild(secSec);
    }

    // Elimina flag
    var delBtn = document.createElement('button');
    delBtn.style.cssText = 'margin-top:0.5rem;width:100%;padding:0.45rem;background:rgba(138,46,46,0.2);border:1px solid rgba(138,46,46,0.5);color:#ffa0a0;font-family:\'Cinzel\',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;border-radius:3px;cursor:pointer;';
    delBtn.textContent = '✕ Elimina Flag';
    delBtn.onclick = function() {
      if (!confirm('Eliminare questo flag?')) return;
      delete state.mappaFlags[fid];
      _db && _db.ref(_mappaFlagPath(fid)).remove();
      panel.classList.remove('open');
      refreshMappaFlags();
    };
    body.appendChild(delBtn);

  } else {
    // Sola lettura — stile pergamena fantasy
    var nomePg = document.createElement('div');
    nomePg.className = 'mappa-field-readonly mappa-field-readonly-name';
    nomePg.textContent = f.nome || '(Luogo senza nome)';
    body.appendChild(nomePg);

    if (f.gradimento) {
      var REP_LEVELS_PG = [
        {label:'Criminali Ricercati', color:'#c84040', bg:'rgba(138,36,36,0.25)', bd:'rgba(138,36,36,0.6)'},
        {label:'Fuorilegge Noti',     color:'#c86040', bg:'rgba(138,76,36,0.25)', bd:'rgba(138,76,36,0.6)'},
        {label:'Sconosciuti',         color:'#8b8b40', bg:'rgba(80,80,20,0.25)',  bd:'rgba(100,100,30,0.5)'},
        {label:'Neutrale',            color:'#d4b070', bg:'rgba(80,70,20,0.2)',   bd:'rgba(120,100,40,0.5)'},
        {label:'Rispettati',          color:'#60a870', bg:'rgba(30,80,30,0.2)',   bd:'rgba(50,120,50,0.5)'},
        {label:'Eroi Locali',         color:'#40c860', bg:'rgba(20,100,40,0.25)', bd:'rgba(40,140,60,0.6)'},
        {label:'Eroi Leggendari',     color:'#20e870', bg:'rgba(10,120,50,0.3)',  bd:'rgba(20,160,70,0.7)'}
      ];
      var repMatch = REP_LEVELS_PG.find(function(r) { return r.label === f.gradimento; });
      var gradPg = document.createElement('div');
      gradPg.className = 'rep-value-display';
      gradPg.textContent = f.gradimento;
      if (repMatch) {
        gradPg.style.color = repMatch.color;
        gradPg.style.background = repMatch.bg;
        gradPg.style.borderColor = repMatch.bd;
      } else {
        gradPg.style.cssText += ';color:var(--gold-dim);border-color:var(--border-soft);';
      }
      body.appendChild(gradPg);
    }

    if (f.immagine) {
      var img2 = document.createElement('img'); img2.src = f.immagine; img2.className = 'mappa-impresa-img';
      body.appendChild(img2);
    }

    if (f.riassunto) {
      var riaDiv = document.createElement('div');
      riaDiv.style.cssText = 'font-family:\'EB Garamond\',serif;font-size:15px;line-height:1.6;color:var(--text-main);font-style:italic;white-space:pre-wrap;border:1px solid var(--border-subtle);border-radius:3px;padding:0.75rem;background:rgba(0,0,0,0.15);';
      riaDiv.textContent = f.riassunto;
      body.appendChild(riaDiv);
    }

    if (!f.nome && !f.riassunto) {
      var emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = 'color:var(--text-faint);font-style:italic;font-size:14px;text-align:center;padding:1rem;';
      emptyDiv.textContent = 'Il Dungeon Master non ha ancora scritto nulla su questo luogo.';
      body.appendChild(emptyDiv);
    }
  }
}

function _refreshMappaSelectorOptions(sel) {
  // Aggiorna le opzioni del selettore mappe senza perdere il valore corrente
  var current = sel.value;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  
  if (!state.mappaList) state.mappaList = {};
  if (_mappaViewAsUser === '__tutte__' || _mappaViewAsUser === '__multiverso__') { state.mappaList['world-map-ohara'] = { nome: 'Mappa Mondiale Completa (Library of Ohara)', url: 'iframe', isInteractive: true, flags: {} }; state.mappaList['naruto-world-map'] = { nome: 'Naruto', url: 'iframe', isInteractive: true, flags: {} }; } else { delete state.mappaList['world-map-ohara']; delete state.mappaList['naruto-world-map']; }

  var ids = Object.keys(state.mappaList || {});
  ids.forEach(function(mid) {
    var opt = document.createElement('option');
    opt.value = mid;
    opt.textContent = state.mappaList[mid].nome || ('Mappa ' + mid.slice(-4));
    sel.appendChild(opt);
  });
  if (state.mappaActiveId && sel.querySelector('[value="' + state.mappaActiveId + '"]')) {
    sel.value = state.mappaActiveId;
  } else if (current && sel.querySelector('[value="' + current + '"]')) {
    sel.value = current;
  }
}

/* ============================================================
   OVERLAY MAPPE POLITICHE
   ============================================================ */

function _ovGetLayer(layerKey) {
  var mid = state.mappaActiveId;
  if (!mid || !state.mappaList[mid]) return null;
  var ov = state.mappaList[mid].overlays;
  return (ov && ov[layerKey]) ? ov[layerKey] : null;
}

function _ovEnsure(layerKey) {
  var mid = state.mappaActiveId;
  if (!mid) return null;
  if (!state.mappaList[mid]) state.mappaList[mid] = {};
  var m = state.mappaList[mid];
  if (!m.overlays) m.overlays = {};
  if (!m.overlays[layerKey]) m.overlays[layerKey] = { factions:{}, polygons:{} };
  if (!m.overlays[layerKey].factions) m.overlays[layerKey].factions = {};
  if (!m.overlays[layerKey].polygons) m.overlays[layerKey].polygons = {};
  return m.overlays[layerKey];
}

function _ovFbSavePoly(lk, pid, data) {
  var mid = state.mappaActiveId;
  if (!_db || !mid) return;
  _db.ref(_mappaBasePath()+'/maps/'+mid+'/overlays/'+lk+'/polygons/'+pid).set(data);
}

function _ovFbDelPoly(lk, pid) {
  var mid = state.mappaActiveId;
  if (!_db || !mid) return;
  _db.ref(_mappaBasePath()+'/maps/'+mid+'/overlays/'+lk+'/polygons/'+pid).remove();
}

function _ovFbSaveFaction(lk, fid, data) {
  var mid = state.mappaActiveId;
  if (!_db || !mid) return;
  _db.ref(_mappaBasePath()+'/maps/'+mid+'/overlays/'+lk+'/factions/'+fid).set(data);
}

function _ovFbDelFaction(lk, fid) {
  var mid = state.mappaActiveId;
  if (!_db || !mid) return;
  _db.ref(_mappaBasePath()+'/maps/'+mid+'/overlays/'+lk+'/factions/'+fid).remove();
  var ld = _ovGetLayer(lk);
  if (ld && ld.polygons) {
    Object.keys(ld.polygons).forEach(function(pid) {
      if (ld.polygons[pid].factionId === fid) {
        _db.ref(_mappaBasePath()+'/maps/'+mid+'/overlays/'+lk+'/polygons/'+pid).remove();
        delete ld.polygons[pid];
      }
    });
  }
}

function refreshMappaOverlays() {
  if (!_leafletMap || !_overlayPolyLayer) return;
  _overlayPolyLayer.clearLayers();
  var vis = state.mappaLayerVisible;
  var leg = document.querySelector('.mappa-overlay-legend');
  if (vis === 'none') { if (leg) leg.style.display = 'none'; return; }
  var ld = _ovGetLayer(vis);
  if (!ld || !ld.polygons) { if (leg) leg.style.display = 'none'; return; }
  var factions = ld.factions || {};
  Object.keys(ld.polygons).forEach(function(pid) {
    var poly = ld.polygons[pid];
    if (!poly || !poly.points || poly.points.length < 3) return;
    var fac = factions[poly.factionId] || {};
    var col = fac.colore || '#888';
    var latlngs = poly.points.map(function(p){ return [p.lat, p.lng]; });
    var lp = L.polygon(latlngs, { color:col, fillColor:col, fillOpacity:0.32, weight:2, opacity:0.85 });
    if (fac.nome) lp.bindTooltip(fac.nome, { permanent:false, direction:'center', className:'overlay-tooltip' });
    if (isDM()) {
      lp.on('contextmenu', (function(_pid, _lk){ return function(e){
        L.DomEvent.preventDefault(e);
        if (!confirm('Eliminare questo poligono?')) return;
        var _ld = _ovGetLayer(_lk);
        if (_ld && _ld.polygons) delete _ld.polygons[_pid];
        _ovFbDelPoly(_lk, _pid);
        refreshMappaOverlays();
        /* aggiorna panel se aperto */
        var op = document.querySelector('.mappa-overlay-panel.open');
        if (op) _renderOverlayPanel(op, _lk);
      }; })(pid, vis));
    }
    _overlayPolyLayer.addLayer(lp);
  });
  /* Legenda */
  if (leg) _buildOverlayLegend(leg, vis, factions, ld.polygons);
}

function _buildOverlayLegend(leg, visKey, factions, polygons) {
  var used = {};
  Object.keys(polygons).forEach(function(pid){ var fid = polygons[pid].factionId; if (factions[fid]) used[fid] = factions[fid]; });
  var keys = Object.keys(used);
  if (!keys.length) { leg.style.display = 'none'; return; }
  var def = OVERLAY_DEFS.filter(function(d){ return d.key === visKey; })[0] || {};
  leg.style.display = 'block';
  leg.innerHTML = '';
  var title = document.createElement('div');
  title.style.cssText = 'font-family:Cinzel,serif;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#b89a58;margin-bottom:7px;border-bottom:1px solid rgba(201,165,92,0.3);padding-bottom:4px;';
  title.textContent = (def.icon||'') + ' ' + (def.label||visKey);
  leg.appendChild(title);
  keys.forEach(function(fid){
    var fac = used[fid];
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;margin-bottom:4px;';
    var sw = document.createElement('div');
    sw.style.cssText = 'width:13px;height:13px;border-radius:2px;border:1px solid rgba(255,255,255,0.2);background:'+fac.colore+';flex-shrink:0;';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:12px;color:#e8d9bc;font-family:EB Garamond,Georgia,serif;';
    lbl.textContent = fac.nome || 'Zona';
    row.appendChild(sw); row.appendChild(lbl);
    leg.appendChild(row);
  });
}

/* ---- DISEGNO POLIGONI ---- */

function _ovStartDraw(layerKey, factionId) {
  if (!_leafletMap) return;
  _ovDrawActive = true; _ovDrawLayerKey = layerKey; _ovDrawFactionId = factionId;
  _ovDrawPoints = [];
  _clearOvDrawPreview();
  _leafletMap.dragging.disable();
  _leafletMap.getContainer().style.cursor = 'crosshair';
  var hint = document.querySelector('.mappa-draw-hint');
  if (hint) {
    hint.style.display = 'block';
    hint.innerHTML =
      '<span class="ov-hint-text" style="color:#f0d070;">🖊 0 vertici — clicca sulla mappa per aggiungere punti · <b>Shift+S</b> per salvare · ESC per annullare</span>';
  }
}

function _ovCancelDraw() {
  if (!_ovDrawActive) return;
  _ovDrawActive = false;
  _clearOvDrawPreview();
  if (_leafletMap) { _leafletMap.dragging.enable(); _leafletMap.getContainer().style.cursor = ''; }
  _ovDrawPoints = []; _ovDrawLayerKey = null; _ovDrawFactionId = null;
  var hint = document.querySelector('.mappa-draw-hint');
  if (hint) hint.style.display = 'none';
  /* ripristina bottone */
  var btn = document.getElementById('ov-draw-btn');
  if (btn) { btn.textContent = '✏ Disegna Zona'; btn.classList.remove('active'); }
}

function _clearOvDrawPreview() {
  if (!_leafletMap) return;
  if (_ovDrawPoly) { try { _leafletMap.removeLayer(_ovDrawPoly); } catch(e){} _ovDrawPoly = null; }
  if (_ovDrawCursor) { try { _leafletMap.removeLayer(_ovDrawCursor); } catch(e){} _ovDrawCursor = null; }
  _ovDrawMarkers.forEach(function(m){ try { _leafletMap.removeLayer(m); } catch(e){} });
  _ovDrawMarkers = [];
}

function _ovFinishDraw() {
  if (!_ovDrawActive) return;
  if (_ovDrawPoints.length < 3) {
    var hint = document.querySelector('.mappa-draw-hint');
    if (hint) {
      var ht = hint.querySelector('.ov-hint-text');
      if (ht) { ht.style.color = '#ff9090'; ht.textContent = '⚠ Servono almeno 3 vertici! Continua a cliccare sulla mappa.'; }
    }
    return;
  }
  var lk = _ovDrawLayerKey; var fid = _ovDrawFactionId;
  var pts = _ovDrawPoints.slice();
  _ovCancelDraw();
  var ld = _ovEnsure(lk);
  if (!ld) return;
  var pid = 'poly_' + Date.now();
  var data = { factionId: fid, points: pts };
  ld.polygons[pid] = data;
  _ovFbSavePoly(lk, pid, data);
  /* attiva il layer se non è già visibile, così l'utente vede subito la zona */
  if (state.mappaLayerVisible !== lk) {
    state.mappaLayerVisible = lk;
    document.querySelectorAll('.mappa-layer-btn').forEach(function(b){ b.classList.remove('active'); });
    var lb = document.querySelector('.mappa-layer-btn[data-lk="' + lk + '"]');
    if (lb) lb.classList.add('active');
  }
  refreshMappaOverlays();
  /* aggiorna contatore poligoni nel pannello */
  var op = document.querySelector('.mappa-overlay-panel.open');
  if (op) _renderOverlayPanel(op, lk);
  /* messaggio di successo con pulsante per zona staccata */
  var hint2 = document.querySelector('.mappa-draw-hint');
  if (hint2) {
    var facNome = (ld.factions && ld.factions[fid] && ld.factions[fid].nome) ? ld.factions[fid].nome : '';
    hint2.style.display = 'block';
    hint2.innerHTML =
      '<span style="color:#90ee90;">✅ Zona salvata' + (facNome ? ' per &ldquo;' + facNome + '&rdquo;' : '') + '!</span>' +
      '<span style="color:var(--text-muted);font-size:11px;margin-left:8px;">Per una zona staccata della stessa fazione →</span>' +
      '<button onclick="_ovStartDraw(\'' + lk + '\',\'' + fid + '\')" style="margin-left:8px;background:rgba(201,165,92,0.15);border:1px solid var(--gold-dim);color:var(--gold);border-radius:4px;padding:4px 12px;cursor:pointer;font-size:11px;font-family:inherit;vertical-align:middle;">✏ Altra Zona</button>';
    setTimeout(function() {
      var h2 = document.querySelector('.mappa-draw-hint');
      if (h2 && !_ovDrawActive) h2.style.display = 'none';
    }, 7000);
  }
}

/* ---- PANNELLO DM GESTIONE FAZIONI ---- */

function _renderOverlayPanel(panel, layerKey) {
  var def = OVERLAY_DEFS.filter(function(d){ return d.key === layerKey; })[0] || { label: layerKey, icon: '◉' };
  panel.innerHTML = '';

  /* Header */
  var head = document.createElement('div');
  head.className = 'mappa-overlay-panel-head';
  var htitle = document.createElement('span');
  htitle.style.cssText = 'font-family:Cinzel,serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:var(--gold-bright);';
  htitle.textContent = def.icon + ' ' + def.label;
  var hclose = document.createElement('button');
  hclose.style.cssText = 'background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;line-height:1;padding:0;';
  hclose.textContent = '✕';
  hclose.onclick = function() { panel.classList.remove('open'); };
  head.appendChild(htitle); head.appendChild(hclose);
  panel.appendChild(head);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;';
  panel.appendChild(body);

  var ld = _ovEnsure(layerKey);
  var factions = ld.factions;
  var polygons = ld.polygons;

  /* Layer toggle link */
  var toggleNote = document.createElement('div');
  toggleNote.style.cssText = 'font-size:11px;color:var(--text-muted);font-style:italic;margin-bottom:4px;';
  var vis = state.mappaLayerVisible === layerKey;
  toggleNote.textContent = vis ? '✅ Layer attivo sulla mappa' : '⭕ Layer non visibile — attivalo dalla barra in basso';
  body.appendChild(toggleNote);

  /* SEZIONE FAZIONI */
  var facTitle = document.createElement('div');
  facTitle.style.cssText = 'font-family:Cinzel,serif;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold-dim);margin-top:6px;border-bottom:1px solid var(--border-subtle);padding-bottom:4px;margin-bottom:6px;';
  facTitle.textContent = 'Fazioni / Entità';
  body.appendChild(facTitle);

  /* Lista fazioni */
  var facList = document.createElement('div');
  Object.keys(factions).forEach(function(fid) {
    var fac = factions[fid];
    var row = document.createElement('div');
    row.className = 'ovfac-row';

    /* Swatch colore (cliccabile) */
    var sw = document.createElement('div');
    sw.className = 'ovfac-swatch';
    sw.style.background = fac.colore || '#888';
    var colorInp = document.createElement('input');
    colorInp.type = 'color'; colorInp.value = fac.colore || '#888888';
    colorInp.oninput = (function(_fid, _sw){ return function(){
      factions[_fid].colore = this.value;
      _sw.style.background = this.value;
      _ovFbSaveFaction(layerKey, _fid, factions[_fid]);
      refreshMappaOverlays();
    }; })(fid, sw);
    sw.appendChild(colorInp);

    /* Nome fazione */
    var nameInp = document.createElement('input');
    nameInp.type = 'text'; nameInp.className = 'ovfac-name';
    nameInp.value = fac.nome || '';
    nameInp.placeholder = 'Nome fazione…';
    nameInp.oninput = (function(_fid){ return function(){
      factions[_fid].nome = this.value;
      _ovFbSaveFaction(layerKey, _fid, factions[_fid]);
      refreshMappaOverlays();
    }; })(fid);

    /* Contatore poligoni */
    var polyCount = Object.keys(polygons).filter(function(pid){ return polygons[pid].factionId === fid; }).length;
    var cnt = document.createElement('span');
    cnt.style.cssText = 'font-size:10px;color:var(--text-muted);flex-shrink:0;';
    cnt.title = polyCount + ' zone disegnate';
    cnt.textContent = '(' + polyCount + ')';

    /* Pulsante disegna */
    var drawBtn = document.createElement('button');
    drawBtn.id = 'ov-draw-btn';
    drawBtn.style.cssText = 'background:transparent;border:1px solid rgba(201,165,92,0.4);color:var(--gold-dim);border-radius:3px;padding:2px 7px;font-size:10px;cursor:pointer;white-space:nowrap;flex-shrink:0;';
    drawBtn.textContent = '✏';
    drawBtn.title = 'Disegna zona per questa fazione';
    drawBtn.onclick = (function(_fid, _btn){ return function(){
      if (_ovDrawActive) { _ovCancelDraw(); _btn.textContent = '✏'; return; }
      /* disattiva altri draw btn */
      facList.querySelectorAll('.ov-draw-fac-btn').forEach(function(b){ b.textContent = '✏'; b.style.color = 'var(--gold-dim)'; });
      _btn.textContent = '⏹'; _btn.style.color = '#f0d070';
      _ovStartDraw(layerKey, _fid);
    }; })(fid, drawBtn);
    drawBtn.className = 'ov-draw-fac-btn';

    /* Elimina fazione */
    var delBtn = document.createElement('button');
    delBtn.style.cssText = 'background:transparent;border:none;color:#e88;cursor:pointer;font-size:13px;flex-shrink:0;padding:0;line-height:1;';
    delBtn.textContent = '✕';
    delBtn.title = 'Elimina fazione e tutte le sue zone';
    delBtn.onclick = (function(_fid){ return function(){
      var facNome = factions[_fid] ? (factions[_fid].nome || 'questa fazione') : 'questa fazione';
      if (!confirm('Eliminare "' + facNome + '" e tutte le sue zone? Non recuperabile.')) return;
      _ovFbDelFaction(layerKey, _fid);
      delete factions[_fid];
      refreshMappaOverlays();
      _renderOverlayPanel(panel, layerKey);
    }; })(fid);

    row.appendChild(sw); row.appendChild(nameInp); row.appendChild(cnt); row.appendChild(drawBtn); row.appendChild(delBtn);
    facList.appendChild(row);
  });
  body.appendChild(facList);

  /* Aggiungi fazione */
  var addFacBtn = document.createElement('button');
  addFacBtn.className = 'mappa-btn mappa-btn-add-map';
  addFacBtn.style.cssText += 'font-size:10px;padding:5px 10px;width:100%;justify-content:center;margin-top:4px;';
  addFacBtn.textContent = '+ Nuova Fazione';
  addFacBtn.onclick = function() {
    var fid = 'fac_' + Date.now();
    var colors = ['#4a7fc1','#c14a4a','#4ac14a','#c19a4a','#9a4ac1','#4ac1b8','#c14a9a','#c1874a'];
    var usedCount = Object.keys(factions).length;
    var defColor = colors[usedCount % colors.length];
    factions[fid] = { nome: '', colore: defColor };
    _ovFbSaveFaction(layerKey, fid, factions[fid]);
    _renderOverlayPanel(panel, layerKey);
    /* focus sul nuovo campo nome */
    setTimeout(function(){ var rows = facList.querySelectorAll('.ovfac-row'); if(rows.length) { var inp = rows[rows.length-1].querySelector('.ovfac-name'); if(inp) inp.focus(); } }, 50);
  };
  body.appendChild(addFacBtn);

  /* Hint ESC */
  var hintDiv = document.createElement('div');
  hintDiv.style.cssText = 'font-size:10px;color:var(--text-faint);font-style:italic;margin-top:8px;line-height:1.5;border-top:1px solid var(--border-subtle);padding-top:8px;';
  hintDiv.innerHTML = '<b>Come disegnare:</b><br>1. Clicca ✏ accanto alla fazione<br>2. Click sulla mappa per aggiungere vertici (illimitati)<br>3. Clicca <b>💾 Salva Zona</b> per chiudere<br>4. ESC per annullare<br><br><b>Zone staccate:</b> salva la prima zona, poi clicca di nuovo ✏ per disegnarne un\'altra separata della stessa fazione.<br><br><b>Tasto destro</b> su un poligono per eliminarlo';
  body.appendChild(hintDiv);
}


/* ============================================================================
   SEZIONE 12: ATLANTE CARTOGRAFICO INTERATTIVO (renderMappa - Leaflet)
   ============================================================================ */
function renderMappa() {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;';

  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:1.5rem;padding-bottom:1rem;';
  hc.innerHTML =
    '<div class="header-eyebrow mb-2"><span>Cartografia</span></div>' +
    '<h1 class="header-title">Mappa del Mondo</h1>';
  header.appendChild(hc);
  wrap.appendChild(header);

  var mappaWrap = document.createElement('div');
  mappaWrap.className = 'mappa-wrap';
  mappaWrap.style.cssText = 'flex:1;position:relative;';

  var mapContainer = document.createElement('div');
  mapContainer.className = 'mappa-container';
  mapContainer.style.cssText = 'flex:1;position:relative;height:calc(100vh - 130px);';

  var mapDiv = document.createElement('div');
  mapDiv.id = 'leaflet-map';
  mapDiv.style.cssText = 'width:100%;height:100%;';
  mapContainer.appendChild(mapDiv);

  // DM Controls
  if (isDM()) {
    var dmControls = document.createElement('div');
    dmControls.className = 'mappa-dm-controls';

    // ---- FILTRO PERSONA (solo admin) ----
    if (isAdmin()) {
      var personaWrap = document.createElement('div');
      personaWrap.style.cssText = 'display:inline-flex;align-items:center;flex-wrap:wrap;gap:0.35rem;';
      var personaLabel = document.createElement('span');
      personaLabel.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:0.12em;color:rgba(245,166,35,0.85);white-space:nowrap;margin-right:0.15rem;text-shadow:0 1px 4px rgba(0,0,0,0.9);';
      personaLabel.textContent = 'MAPPE:';
      personaWrap.appendChild(personaLabel);
      var _mkPersonaPill = function(label, val) {
        var isActive = (val === '' && !_mappaViewAsUser) || (val !== '' && val === _mappaViewAsUser);
        var btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = 'font-family:\'Cinzel\',serif;font-size:11px;font-weight:700;letter-spacing:0.06em;padding:0.35rem 0.85rem;border-radius:20px;cursor:pointer;white-space:nowrap;transition:all 0.15s;' +
          'background:' + (isActive ? 'rgba(50,33,8,0.97)' : 'rgba(18,12,3,0.88)') + ';' +
          'border:1.5px solid ' + (isActive ? '#f5a623' : 'rgba(245,166,35,0.45)') + ';' +
          'color:' + (isActive ? '#f5c842' : 'rgba(245,166,35,0.75)') + ';' +
          'box-shadow:' + (isActive ? '0 0 10px rgba(245,166,35,0.35),0 2px 8px rgba(0,0,0,0.7)' : '0 2px 8px rgba(0,0,0,0.65)') + ';';
        btn.onmouseenter = function(){ btn.style.color='#f5c842'; btn.style.borderColor='#f5a623'; };
        btn.onmouseleave = function(){
          btn.style.color = isActive ? '#f5c842' : 'rgba(245,166,35,0.75)';
          btn.style.borderColor = isActive ? '#f5a623' : 'rgba(245,166,35,0.45)';
        };
        btn.onclick = function() {
          _mappaViewAsUser = val === '' ? null : val;
          _attachMappaListener();
          if (state.section === 'mappa') renderMain();
        };
        return btn;
      };
      personaWrap.appendChild(_mkPersonaPill('🌐 Tutte', '__tutte__'));
      personaWrap.appendChild(_mkPersonaPill('🌌 Multiverso', '__multiverso__'));
      personaWrap.appendChild(_mkPersonaPill('⭐ ' + (state.currentUser ? state.currentUser.username : 'Mie'), ''));
      if (_remoteUsers && typeof _remoteUsers === 'object') {
        Object.keys(_remoteUsers).sort().forEach(function(uid) {
          if (uid === (state.currentUser && state.currentUser.username)) return;
          var ru = _remoteUsers[uid] || {};
          var r = (ru.role || '').toLowerCase();
          if (r === 'dm' || r === 'master' || r === 'admin' || ru.dmPriv) {
            personaWrap.appendChild(_mkPersonaPill('\uD83E\uDDD1\u200D\uD83C\uDFEB ' + uid, uid));
          }
        });
      }
      dmControls.appendChild(personaWrap);
    }

    // ---- SELETTORE MAPPA ----
    var selectorWrap = document.createElement('div');
    selectorWrap.style.cssText = 'display:inline-flex;align-items:center;gap:0.4rem;';

    var selectorLabel = document.createElement('span');
    selectorLabel.textContent = '🗺';
    selectorLabel.style.cssText = 'font-size:14px;';
    selectorWrap.appendChild(selectorLabel);

    var mapSelector = document.createElement('select');
    mapSelector.id = 'mappa-selector';
    mapSelector.className = 'regia-scene-select';
    mapSelector.style.cssText = 'max-width:160px;font-size:12px;padding:0.3rem 0.5rem;';
    _refreshMappaSelectorOptions(mapSelector);

    mapSelector.onchange = function() {
      var mid = mapSelector.value;
      if (!mid || !state.mappaList[mid]) return;
      var prevMapId = state.mappaActiveId;
      fbSaveStoriaMarkers(prevMapId);
      state.mappaActiveId = mid;
      state.mappaUrl = state.mappaList[mid].url || '';
      state.mappaFlags = state.mappaList[mid].flags || {};
      state.worldbuilding = []; // svuota mentre carica il worldbuilding della nuova mappa
      // Salva mappa attiva su Firebase
      if (!_mappaViewAsUser) _db && _db.ref(_mappaBasePath() + '/activeMapId').set(mid);
      // Aggiorna il worldbuilding alla mappa selezionata
      _attachWorldbuildingListener(mid);
      // Carica i marker della nuova mappa dalla cache Firebase
      state.storia.markers = (window._storiaMarkersCache && window._storiaMarkersCache[mid] && typeof window._storiaMarkersCache[mid] === 'object')
        ? window._storiaMarkersCache[mid] : {};
      refreshStoriaMarkers();
      // Ricrea la mappa Leaflet
      if (_leafletMap) { try { _leafletMap.remove(); } catch(e){} _leafletMap = null; }
      if (state.mappaUrl) {
        initLeafletMap(mapDiv, infoPanel);
      } else {
        mapDiv.innerHTML = '<div class="mappa-no-img"><div class="mappa-no-img-title">Nessuna immagine per questa mappa</div><div class="mappa-no-img-sub">Usa "Carica Immagine" per aggiungerne una.</div></div>';
      }
      // Aggiorna testo pulsante carica
      addMapBtn.innerHTML = state.mappaUrl ? '✎ Cambia Immagine' : '🗺 Carica Immagine';
      // Aggiorna pulsanti move/flag
      _updateMappaMoveFlag(dmControls, mapDiv);
    };
    selectorWrap.appendChild(mapSelector);
    dmControls.appendChild(selectorWrap);

    // ---- AGGIUNGI NUOVA MAPPA ----
    var newMapBtn = document.createElement('button');
    if (!isDM()) newMapBtn.style.display = 'none';
    newMapBtn.className = 'mappa-btn mappa-btn-add-map';
    newMapBtn.innerHTML = '➕ Nuova Mappa';
    newMapBtn.onclick = function() {
      var nomeMappa = prompt('Nome della nuova campagna/mappa:', 'Campagna ' + (Object.keys(state.mappaList || {}).length + 1));
      if (!nomeMappa) return;
      var mid = 'm_' + Date.now();
      if (!state.mappaList) state.mappaList = {};
      state.mappaList[mid] = { nome: nomeMappa, url: '', flags: {} };
      state.mappaActiveId = mid;
      state.mappaUrl = '';
      state.mappaFlags = {};
      _db && _db.ref(_mappaBasePath() + '/maps/' + mid).set({ nome: nomeMappa, url: '', flags: {} });
      _db && _db.ref(_mappaBasePath() + '/activeMapId').set(mid);
      _refreshMappaSelectorOptions(mapSelector);
      mapSelector.value = mid;
      mapDiv.innerHTML = '<div class="mappa-no-img"><div class="mappa-no-img-title">' + nomeMappa + '</div><div class="mappa-no-img-sub">Usa "Carica Immagine" per aggiungere la mappa.</div></div>';
      addMapBtn.innerHTML = '🗺 Carica Immagine';
      _updateMappaMoveFlag(dmControls, mapDiv);
    };
    dmControls.appendChild(newMapBtn);

    // ---- RINOMINA MAPPA ----
    var renameMapBtn = document.createElement('button');
    if (!isDM()) renameMapBtn.style.display = 'none';
    renameMapBtn.className = 'mappa-btn';
    renameMapBtn.innerHTML = '✏️ Rinomina';
    renameMapBtn.title = 'Rinomina mappa selezionata';
    renameMapBtn.onclick = function() {
      if (!state.mappaActiveId || !state.mappaList[state.mappaActiveId]) return;
      if (state.mappaActiveId === 'world-map-ohara') { alert('Non puoi rinominare questa mappa speciale.'); return; } if (state.mappaActiveId === 'naruto-world-map') { alert('Non puoi rinominare questa mappa speciale.'); return; }
      var current = state.mappaList[state.mappaActiveId].nome || '';
      var newName = prompt('Nuovo nome:', current);
      if (!newName || newName === current) return;
      state.mappaList[state.mappaActiveId].nome = newName;
      _db && _db.ref(_mappaBasePath() + '/maps/' + state.mappaActiveId + '/nome').set(newName);
      _refreshMappaSelectorOptions(mapSelector);
    };
    dmControls.appendChild(renameMapBtn);

    // ---- CARICA / CAMBIA IMMAGINE ----
    var addMapBtn = document.createElement('button');
    if (!isDM()) addMapBtn.style.display = 'none';
    addMapBtn.className = 'mappa-btn mappa-btn-add-map';
    addMapBtn.innerHTML = state.mappaUrl ? '✎ Cambia Immagine' : '🗺 Carica Immagine';
    addMapBtn.onclick = function() {
      if (state.mappaActiveId === 'world-map-ohara') { alert('Non puoi cambiare l\'immagine di questa mappa speciale.'); return; } if (state.mappaActiveId === 'naruto-world-map') { alert('Non puoi cambiare l\'immagine di questa mappa speciale.'); return; }
      if (!state.mappaActiveId && Object.keys(state.mappaList || {}).length === 0) {
        alert('Prima crea una mappa con "Nuova Mappa".');
        return;
      }
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = function(e) {
        var file = e.target.files[0]; if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          var img = new Image();
          img.onload = function() {
            var canvas = document.createElement('canvas');
            var maxDim = 2500;
            var ratio = Math.min(maxDim / Math.max(img.width, img.height), 1);
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            state.mappaUrl = dataUrl;
            // Salva nella mappa attiva
            var mid = state.mappaActiveId;
            if (!mid) {
              mid = 'm_' + Date.now();
              state.mappaList[mid] = { nome: 'Mappa 1', url: dataUrl, flags: {} };
              state.mappaActiveId = mid;
              _db && _db.ref(_mappaBasePath() + '/maps/' + mid).set({ nome: 'Mappa 1', url: dataUrl, flags: {} });
              _db && _db.ref(_mappaBasePath() + '/activeMapId').set(mid);
              _refreshMappaSelectorOptions(mapSelector);
              mapSelector.value = mid;
            } else {
              if (!state.mappaList[mid]) state.mappaList[mid] = { nome: 'Mappa', flags: {} };
              state.mappaList[mid].url = dataUrl;
              _db && _db.ref(_mappaBasePath() + '/maps/' + mid + '/url').set(dataUrl);
            }
            if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
            initLeafletMap(mapDiv, infoPanel);
            addMapBtn.innerHTML = '✎ Cambia Immagine';
            _updateMappaMoveFlag(dmControls, mapDiv);
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      };
      inp.click();
    };
    dmControls.appendChild(addMapBtn);

    // ---- ELIMINA MAPPA ----
    var delMapBtn = document.createElement('button');
    if (!isDM()) delMapBtn.style.display = 'none';
    delMapBtn.className = 'mappa-btn btn-blood';
    delMapBtn.style.cssText = 'font-size:11px;padding:0.3rem 0.6rem;';
    delMapBtn.innerHTML = '🗑 Elimina';
    delMapBtn.title = 'Elimina mappa selezionata';
    delMapBtn.onclick = function() {
      if (!state.mappaActiveId || !state.mappaList[state.mappaActiveId]) return;
      if (state.mappaActiveId === 'world-map-ohara') { alert('Non puoi eliminare questa mappa speciale.'); return; } if (state.mappaActiveId === 'naruto-world-map') { alert('Non puoi eliminare questa mappa speciale.'); return; }
      var nomeMappa = state.mappaList[state.mappaActiveId].nome || state.mappaActiveId;
      if (!confirm('Eliminare "' + nomeMappa + '"? Tutti i flag verranno persi.')) return;
      _db && _db.ref(_mappaBasePath() + '/maps/' + state.mappaActiveId).remove();
      delete state.mappaList[state.mappaActiveId];
      // Seleziona un'altra mappa
      var ids = Object.keys(state.mappaList);
      if (ids.length > 0) {
        state.mappaActiveId = ids[0];
        state.mappaUrl = state.mappaList[ids[0]].url || '';
        state.mappaFlags = state.mappaList[ids[0]].flags || {};
        _db && _db.ref(_mappaBasePath() + '/activeMapId').set(ids[0]);
      } else {
        state.mappaActiveId = '';
        state.mappaUrl = '';
        state.mappaFlags = {};
        _db && _db.ref(_mappaBasePath() + '/activeMapId').set('');
      }
      _refreshMappaSelectorOptions(mapSelector);
      if (_leafletMap) { try { _leafletMap.remove(); } catch(e){} _leafletMap = null; }
      if (state.mappaUrl) {
        initLeafletMap(mapDiv, infoPanel);
      } else {
        mapDiv.innerHTML = '<div class="mappa-no-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg><div class="mappa-no-img-title">Nessuna mappa selezionata</div><div class="mappa-no-img-sub">Crea una nuova mappa o carica un\'immagine.</div></div>';
      }
      addMapBtn.innerHTML = state.mappaUrl ? '✎ Cambia Immagine' : '🗺 Carica Immagine';
      _updateMappaMoveFlag(dmControls, mapDiv);
    };
    dmControls.appendChild(delMapBtn);

    // ---- RIASSEGNA MAPPA (solo admin) ----
    if (isAdmin()) {
      var reassignBtn = document.createElement('button');
      reassignBtn.className = 'mappa-btn';
      reassignBtn.style.cssText = 'font-size:11px;padding:0.3rem 0.6rem;';
      reassignBtn.innerHTML = '🔁 Sposta/Riassegna';
      reassignBtn.title = 'Sposta mappa ad altro master o multiverso';
      reassignBtn.onclick = function() {
        if (!state.mappaActiveId || !state.mappaList[state.mappaActiveId]) return;
        if (state.mappaActiveId === 'world-map-ohara') { alert('Non puoi spostare questa mappa speciale.'); return; } if (state.mappaActiveId === 'naruto-world-map') { alert('Non puoi spostare questa mappa speciale.'); return; }
        
        var optionsText = 'Seleziona destinazione:\n1. Multiverso\n';
        var dests = [{ id: 'multiverso', path: 'state/multiverso/mappa' }];
        var _idx = 2;
        if (_remoteUsers && typeof _remoteUsers === 'object') {
          Object.keys(_remoteUsers).sort().forEach(function(uid) {
            var r = (_remoteUsers[uid].role || '').toLowerCase();
            if (r === 'dm' || r === 'master' || r === 'admin' || _remoteUsers[uid].dmPriv) {
              optionsText += _idx + '. ' + uid + '\n';
              dests.push({ id: uid, path: 'users/' + uid + '/mappa' });
              _idx++;
            }
          });
        }
        
        var choice = prompt(optionsText);
        if (!choice) return;
        var idx = parseInt(choice, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= dests.length) { alert('Scelta non valida.'); return; }
        
        var dest = dests[idx];
        var destPath = dest.path;
        var oldPath = _mappaBasePath();
        
        if (oldPath === destPath) { alert('La mappa è già in questa destinazione.'); return; }
        if (!confirm('Sei sicuro di voler spostare la mappa "' + state.mappaList[state.mappaActiveId].nome + '" verso ' + dest.id + '?')) return;
        
        var mapData = state.mappaList[state.mappaActiveId];
        _db.ref(destPath + '/maps/' + state.mappaActiveId).set(mapData, function(err) {
          if (err) { alert('Errore nello spostamento.'); return; }
          _db.ref(oldPath + '/maps/' + state.mappaActiveId).remove();
          alert('Mappa spostata con successo in ' + dest.id);
          _attachMappaListener();
        });
      };
      dmControls.appendChild(reassignBtn);
    }

    // ---- MOVE / FLAG ----
    _updateMappaMoveFlag(dmControls, mapDiv);

    mapContainer.appendChild(dmControls);
  }

  /* ---- OVERLAY PANEL (DM, slide da destra, dentro mapContainer) ---- */
  if (isDM()) {
    var overlayPanel = document.createElement('div');
    overlayPanel.className = 'mappa-overlay-panel';
    mapContainer.appendChild(overlayPanel);
  }

  /* ---- LAYER BAR (visibile a tutti, bottom-center della mappa) ---- */
  var layerBar = document.createElement('div');
  layerBar.className = 'mappa-layer-bar';
  OVERLAY_DEFS.forEach(function(def) {
    var btn = document.createElement('button');
    btn.className = 'mappa-layer-btn' + (state.mappaLayerVisible === def.key ? ' active' : '');
    btn.dataset.lk = def.key;
    btn.textContent = def.icon + ' ' + def.label;
    btn.onclick = function() {
      if (state.mappaLayerVisible === def.key) {
        state.mappaLayerVisible = 'none';
        layerBar.querySelectorAll('.mappa-layer-btn').forEach(function(b){ b.classList.remove('active'); });
      } else {
        state.mappaLayerVisible = def.key;
        layerBar.querySelectorAll('.mappa-layer-btn').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        /* se il panel overlay è aperto aggiornalo per il nuovo layer */
        var op = document.querySelector('.mappa-overlay-panel.open');
        if (op) { op.dataset.lk = def.key; _renderOverlayPanel(op, def.key); }
      }
      refreshMappaOverlays();
    };
    layerBar.appendChild(btn);
  });
  mapContainer.appendChild(layerBar);

  /* ---- LEGENDA OVERLAY (top-right, visibile a tutti) ---- */
  var ovLegend = document.createElement('div');
  ovLegend.className = 'mappa-overlay-legend';
  ovLegend.style.display = 'none';
  mapContainer.appendChild(ovLegend);

  /* ---- DRAW HINT (top-center, visibile solo durante disegno) ---- */
  var drawHint = document.createElement('div');
  drawHint.className = 'mappa-draw-hint';
  drawHint.style.display = 'none';
  mapContainer.appendChild(drawHint);

  // Pannello info flag (destra)
  var infoPanel = document.createElement('div');
  infoPanel.className = 'mappa-info-panel';
  infoPanel.innerHTML =
    '<div class="mappa-info-header">' +
      '<span class="mappa-info-title">📜 Scheda Luogo</span>' +
      '<button class="regia-close" id="mappa-panel-close" style="cursor:pointer;">' + ICON.x + '</button>' +
    '</div>' +
    '<div class="mappa-info-body"></div>';
  infoPanel.querySelector('#mappa-panel-close').onclick = function() { infoPanel.classList.remove('open'); };

  mappaWrap.appendChild(mapContainer);
  mappaWrap.appendChild(infoPanel);

  /* ---- BARRA SELEZIONE DM (solo PG) ---- */
  if (isPG()) {
    var pgSelectorBar = document.createElement('div');
    pgSelectorBar.className = 'pg-mappa-selector';
    pgSelectorBar.innerHTML = '<span class="pg-mappa-selector-label">Mappa di:</span>';
    wrap.appendChild(pgSelectorBar);

    var _buildPgPills = function(users) {
      var existing = pgSelectorBar.querySelectorAll('.pg-mappa-pill');
      existing.forEach(function(p){ p.remove(); });
      var hasDms = false;
      Object.keys(users).forEach(function(k) {
        var u = users[k];
        if (!u || (u.role !== 'DM' && !u.dmPriv)) return;
        hasDms = true;
        var pill = document.createElement('button');
        pill.className = 'pg-mappa-pill' + (_mappaViewAsUser === k ? ' active' : '');
        pill.textContent = k;
        pill.onclick = function() {
          if (_mappaViewAsUser === k) return;
          _mappaViewAsUser = k;
          state.mappaUrl = '';
          state.mappaList = {};
          state.mappaActiveId = null;
          pgSelectorBar.querySelectorAll('.pg-mappa-pill').forEach(function(p){ p.classList.remove('active'); });
          pill.classList.add('active');
          if (_leafletMap) { try { _leafletMap.remove(); } catch(e){} _leafletMap = null; }
          mapDiv.innerHTML = '<div class="mappa-no-img" style="opacity:0.6;"><div class="mappa-no-img-title" style="font-size:13px;">Caricamento mappa di ' + k + '...</div></div>';
          _attachMappaListener();
        };
        pgSelectorBar.appendChild(pill);
      });
      if (!hasDms) pgSelectorBar.style.display = 'none';
    };
    if (_remoteUsers && Object.keys(_remoteUsers).length > 0) {
      _buildPgPills(_remoteUsers);
    } else {
      _db.ref('users').once('value', function(snap) { _buildPgPills(snap.val() || {}); });
    }
  }

  wrap.appendChild(mappaWrap);

  // Inizializza Leaflet dopo che il DOM è stato aggiunto
  if (isPG()) {
    setTimeout(function() {
      if (state.mappaUrl) {
        initLeafletMap(mapDiv, infoPanel);
      } else {
        mapDiv.innerHTML = '<div class="mappa-no-img" style="opacity:0.6;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg><div class="mappa-no-img-title" style="font-size:13px;">Caricamento mappa...</div></div>';
        setTimeout(function() {
          if (!state.mappaUrl && document.getElementById('leaflet-map') === mapDiv) {
            mapDiv.innerHTML = '<div class="mappa-no-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg><div class="mappa-no-img-title">Mappa non ancora disponibile</div><div class="mappa-no-img-sub">Il Dungeon Master non ha ancora caricato la mappa del mondo.</div></div>';
          }
        }, 4000);
      }
    }, 80);
  } else {
    setTimeout(function() {
      if (state.mappaUrl) {
        initLeafletMap(mapDiv, infoPanel);
      } else {
        mapDiv.innerHTML = '<div class="mappa-no-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg><div class="mappa-no-img-title">Nessuna mappa caricata</div><div class="mappa-no-img-sub">Usa "Nuova Mappa" per creare la prima mappa, poi "Carica Immagine".</div></div>';
      }
    }, 80);
  }

  return wrap;
}

// Helper: aggiorna/crea i pulsanti Muovi/Flag nella toolbar DM
function _updateMappaMoveFlag(dmControls, mapDiv) {
  var oldMove = dmControls.querySelector('.mappa-btn-move');
  var oldFlag = dmControls.querySelector('.mappa-btn-flag');
  var oldOvBtn = dmControls.querySelector('.mappa-btn-overlay');
  if (oldMove) oldMove.remove();
  if (oldFlag) oldFlag.remove();
  if (oldOvBtn) oldOvBtn.remove();
  if (!state.mappaUrl || state.mappaActiveId === 'world-map-ohara' || state.mappaActiveId === 'naruto-world-map') return;

  var moveBtn = document.createElement('button');
  moveBtn.className = 'mappa-btn mappa-btn-move' + (state.mappaMode === 'move' ? ' active' : '');
  moveBtn.innerHTML = '✋ Muovi Mappa';
  moveBtn.onclick = function() {
    state.mappaMode = 'move';
    moveBtn.classList.add('active');
    flagBtn.classList.remove('active');
    if (_leafletMap) _leafletMap.dragging.enable();
  };
  dmControls.appendChild(moveBtn);

  var flagBtn = document.createElement('button');
  flagBtn.className = 'mappa-btn mappa-btn-flag' + (state.mappaMode === 'flag' ? ' active' : '');
  flagBtn.innerHTML = '📍 Aggiungi Flag';
  flagBtn.onclick = function() {
    state.mappaMode = 'flag';
    flagBtn.classList.add('active');
    moveBtn.classList.remove('active');
    if (_ovDrawActive) _ovCancelDraw();
  };
  dmControls.appendChild(flagBtn);

  var ovBtn = document.createElement('button');
  ovBtn.className = 'mappa-btn mappa-btn-overlay';
  ovBtn.innerHTML = '⚑ Layer Overlay';
  ovBtn.title = 'Gestisci fazioni e zone di influenza';
  ovBtn.onclick = function() {
    var lk = (state.mappaLayerVisible !== 'none') ? state.mappaLayerVisible : OVERLAY_DEFS[0].key;
    var panel = document.querySelector('.mappa-overlay-panel');
    if (!panel) return;
    if (panel.classList.contains('open') && panel.dataset.lk === lk) {
      panel.classList.remove('open');
    } else {
      panel.dataset.lk = lk;
      panel.classList.add('open');
      _renderOverlayPanel(panel, lk);
    }
  };
  dmControls.appendChild(ovBtn);
}

function initLeafletMap(mapDiv, infoPanel) {
  if (_leafletMap) { try { _leafletMap.remove(); } catch(e){} _leafletMap = null; }
  mapDiv.innerHTML = '';

  if (state.mappaActiveId === 'world-map-ohara') {
    mapDiv.innerHTML = '<iframe src="https://thelibraryofohara.com/onepieceworldmap/" style="width: 100%; height: 100%; border: none; border-radius: 6px;" allowfullscreen></iframe>';
    return;
  }

  if (state.mappaActiveId === 'naruto-world-map') {
      mapDiv.innerHTML = '<div style="width: 100%; height: 100%; position: relative; display: flex; flex-direction: column;"><div style="background: #1a1a2e; padding: 10px; text-align: center; border-bottom: 1px solid #c9a55c; flex-shrink: 0;"><a href="https://www.worldanvil.com/w/naruto-5e-world-scarletbunnydungeon/map/0019a94e-5b71-40ad-91a5-c579d57a803e" target="_blank" style="color: #c9a55c; text-decoration: none; font-weight: bold; font-family: \'Cinzel\', serif; border: 1px solid #c9a55c; padding: 5px 15px; border-radius: 4px; display: inline-block; cursor:pointer;">🔗 Apri mappa a schermo intero / nuova scheda</a><div style="font-size: 11px; color: #aaa; margin-top: 5px;">Se la mappa qui sotto non viene caricata o risulta bloccata, usa questo pulsante.</div></div><iframe src="https://www.worldanvil.com/w/naruto-5e-world-scarletbunnydungeon/map/0019a94e-5b71-40ad-91a5-c579d57a803e" style="flex: 1; width: 100%; border: none; border-radius: 0 0 6px 6px;" allowfullscreen></iframe></div>';
      return;
    }

  if (typeof L === 'undefined') {
    mapDiv.innerHTML = '<div style="padding:2rem;color:var(--text-muted);font-style:italic;">Libreria Leaflet non disponibile. Controlla la connessione.</div>';
    return;
  }

  var img = new Image();
  img.onload = function() {
    var w = img.naturalWidth || 1000;
    var h = img.naturalHeight || 700;
    var bounds = [[0, 0], [h, w]];
    _leafletMap = L.map(mapDiv, {
      crs: L.CRS.Simple,
      minZoom: -3, maxZoom: 3,
      zoomControl: false,
      attributionControl: false
    });
    L.imageOverlay(state.mappaUrl, bounds).addTo(_leafletMap);
    _leafletMap.fitBounds(bounds);

    _flagLayer = L.layerGroup().addTo(_leafletMap);
    refreshMappaFlags();

    _overlayPolyLayer = L.layerGroup().addTo(_leafletMap);
    refreshMappaOverlays();

    /* ESC handler per annullare disegno */
    if (window._ovEscHandler) document.removeEventListener('keydown', window._ovEscHandler);
    window._ovEscHandler = function(ev) {
      if (!_ovDrawActive) return;
      if (ev.key === 'Escape') {
        _ovCancelDraw();
        document.querySelectorAll('.ov-draw-fac-btn').forEach(function(b){ b.textContent = '✏'; b.style.color = ''; });
      } else if (ev.key === 'S' && ev.shiftKey) {
        ev.preventDefault();
        _ovFinishDraw();
      }
    };
    document.addEventListener('keydown', window._ovEscHandler);

    _leafletMap.on('click', function(e) {
      /* Modalità disegno overlay */
      if (_ovDrawActive) {
        _ovDrawPoints.push({ lat: e.latlng.lat, lng: e.latlng.lng });
        var vm = L.circleMarker(e.latlng, { radius:4, color:'#f0d070', fillColor:'#f0d070', fillOpacity:0.9, weight:1 }).addTo(_leafletMap);
        _ovDrawMarkers.push(vm);
        if (_ovDrawPoly) { try { _leafletMap.removeLayer(_ovDrawPoly); } catch(_e){} _ovDrawPoly = null; }
        if (_ovDrawPoints.length >= 2) {
          var _ld = _ovGetLayer(_ovDrawLayerKey);
          var _fac = (_ld && _ld.factions && _ld.factions[_ovDrawFactionId]) ? _ld.factions[_ovDrawFactionId] : {};
          var _col = _fac.colore || '#f0d070';
          _ovDrawPoly = L.polygon(_ovDrawPoints.map(function(p){ return [p.lat, p.lng]; }), { color:_col, fillColor:_col, fillOpacity:0.15, weight:2, dashArray:'6,4' }).addTo(_leafletMap);
        }
        var hint = document.querySelector('.mappa-draw-hint');
        if (hint) { var ht = hint.querySelector('.ov-hint-text'); if (ht) ht.textContent = '🖊 ' + _ovDrawPoints.length + ' vertici — clicca per aggiungere · Salva Zona o doppio-click per chiudere · ESC annulla'; }
        return;
      }
      /* Modalità flag */
      if (!isDM() || state.mappaMode !== 'flag') return;
      var fid = 'f_' + Date.now();
      var flagData = { lat: e.latlng.lat, lng: e.latlng.lng, nome: '', gradimento: '', riassunto: '', immagine: '' };
      if (!state.mappaFlags) state.mappaFlags = {};
      state.mappaFlags[fid] = flagData;
      _db && _db.ref(_mappaFlagPath(fid)).set(flagData);
      refreshMappaFlags();
      state.mappaSelectedFlag = fid;
      var panel = document.querySelector('.mappa-info-panel');
      if (panel) { panel.classList.add('open'); renderMappaFlagPanel(panel, fid); }
    });

    _leafletMap.on('dblclick', function(e) {
      if (!_ovDrawActive) return;
      L.DomEvent.stopPropagation(e);
      /* Leaflet genera click+dblclick, rimuovi l'ultimo punto aggiunto dal click */
      if (_ovDrawPoints.length > 0) _ovDrawPoints.pop();
      if (_ovDrawMarkers.length > 0) {
        var _last = _ovDrawMarkers.pop();
        try { _leafletMap.removeLayer(_last); } catch(_e2) {}
      }
      _ovFinishDraw();
    });

    _leafletMap.on('mousemove', function(e) {
      if (!_ovDrawActive || _ovDrawPoints.length === 0) return;
      if (_ovDrawCursor) { try { _leafletMap.removeLayer(_ovDrawCursor); } catch(_e3){} _ovDrawCursor = null; }
      var _last2 = _ovDrawPoints[_ovDrawPoints.length - 1];
      var _ld2 = _ovGetLayer(_ovDrawLayerKey);
      var _fac2 = (_ld2 && _ld2.factions && _ld2.factions[_ovDrawFactionId]) ? _ld2.factions[_ovDrawFactionId] : {};
      var _col2 = _fac2.colore || '#f0d070';
      _ovDrawCursor = L.polyline([[_last2.lat, _last2.lng], [e.latlng.lat, e.latlng.lng]], { color:_col2, weight:1.5, dashArray:'4,4', opacity:0.7 }).addTo(_leafletMap);
    });
  };
  img.onerror = function() {
    mapDiv.innerHTML = '<div style="padding:2rem;color:var(--text-muted);font-style:italic;">Impossibile caricare l\'immagine della mappa. Controlla l\'URL.</div>';
  };
  img.src = state.mappaUrl;
}

/* ============================================================
   BACHECA DEI RICERCATI v2 — drag-and-drop, file locali, commenti DM
   ============================================================ */

var _bacheDrag = null;

function bachePlayFlip() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator(); var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(); osc.stop(ctx.currentTime + 0.18);
  } catch(e) {}
}

function bacheFileToBase64(file, cb) {
  var reader = new FileReader();
  reader.onload = function(e) { cb(e.target.result); };
  reader.readAsDataURL(file);
}


/* ============================================================================
   SEZIONE 13: BACHECA DI GILDA & MISSIONI (renderBacheca)
   ============================================================================ */
function renderBacheca() {
  var page = document.createElement('div');
  page.className = 'bacheca-page';

  // Toolbar
  var toolbar = document.createElement('div');
  toolbar.className = 'bacheca-toolbar';
  var toolTitle = document.createElement('span');
  toolTitle.className = 'bacheca-toolbar-title';
  toolTitle.innerHTML = '\u2694 Bacheca dei Ricercati';
  toolbar.appendChild(toolTitle);

  if (isDM()) {
    var addBtn = document.createElement('button');
    addBtn.className = 'bacheca-btn';
    addBtn.innerHTML = '\uD83D\uDCCC Appendi Manifesto (File)';
    addBtn.onclick = function() {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = function(e) {
        var file = e.target.files[0]; if (!file) return;
        bacheFileToBase64(file, function(dataUrl) {
          var itemData = {
            dataUrl: dataUrl, commento: '',
            x: Math.round(60 + Math.random() * 380),
            y: Math.round(50 + Math.random() * 180),
            w: 160,
            zIndex: Date.now(), pinned: false, ts: Date.now()
          };
          var _gbf = _db.ref('state/bacheca/items'); if (_gbf) _gbf.push(itemData);
        });
      };
      inp.click();
    };
    toolbar.appendChild(addBtn);

    var addUrlBtn = document.createElement('button');
    addUrlBtn.className = 'bacheca-btn';
    addUrlBtn.innerHTML = '\uD83D\uDD17 Aggiungi GIF da URL';
    addUrlBtn.onclick = function() {
      var url = prompt('Incolla URL immagine o GIF:');
      if (!url) return;
      var itemData = {
        dataUrl: url, commento: '',
        x: Math.round(60 + Math.random() * 380),
        y: Math.round(50 + Math.random() * 180),
        w: 160,
        zIndex: Date.now(), pinned: false, ts: Date.now()
      };
      var _gbu = _db.ref('state/bacheca/items'); if (_gbu) _gbu.push(itemData);
    };
    toolbar.appendChild(addUrlBtn);

    var hint = document.createElement('span');
    hint.className = 'bacheca-hint';
    hint.textContent = 'Trascina \u2022 Doppio click per girare \u2022 \uD83D\uDD0D per ingrandire \u2022 Pin per fissare';
    toolbar.appendChild(hint);
  } else {
    var hint2 = document.createElement('span');
    hint2.className = 'bacheca-hint';
    hint2.textContent = 'Doppio click su un manifesto per girarlo \u2022 lente \uD83D\uDD0D per ingrandirlo';
    toolbar.appendChild(hint2);
  }
  page.appendChild(toolbar);

  // Lavagna
  var board = document.createElement('div');
  board.className = 'bacheca-board';
  board.id = 'bacheca-board';

  if (!state.bacheItems || state.bacheItems.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'bacheca-empty';
    empty.innerHTML = isDM()
      ? '\uD83D\uDCCB La lavagna \u00e8 vuota<br><small style="font-size:12px;opacity:0.7;">Usa \u201cAppendi Manifesto\u201d per iniziare</small>'
      : '\uD83D\uDCCB La lavagna \u00e8 vuota...<br><small style="font-size:12px;opacity:0.7;">Il DM non ha ancora appeso nulla.</small>';
    board.appendChild(empty);
  }

  var egg = document.createElement('div');
  egg.style.cssText = "position:absolute;bottom:8px;right:12px;font-family:Cinzel,serif;font-size:7px;color:rgba(200,160,80,0.13);letter-spacing:0.08em;pointer-events:none;z-index:0;";
  egg.textContent = '\u2605 TAGLIA PAGATA IN RAME \u2014 RECLAMABILE IN ANTICIPO \u2605';
  board.appendChild(egg);

  (state.bacheItems || []).forEach(function(item) {
    board.appendChild(createBacheEl(item));
  });

  // Drag events on board
  board.addEventListener('mousemove', function(e) {
    if (!_bacheDrag) return;
    var rect = board.getBoundingClientRect();
    var nx = e.clientX - rect.left - _bacheDrag.offX;
    var ny = e.clientY - rect.top  - _bacheDrag.offY;
    nx = Math.max(0, Math.min(rect.width - (_bacheDrag.elW || 160), nx));
    ny = Math.max(0, Math.min(rect.height - 100, ny));
    _bacheDrag.el.style.left = nx + 'px';
    _bacheDrag.el.style.top  = ny + 'px';
  });
  board.addEventListener('mouseup', function(e) {
    if (!_bacheDrag) return;
    var rect = board.getBoundingClientRect();
    var nx = Math.round(e.clientX - rect.left - _bacheDrag.offX);
    var ny = Math.round(e.clientY - rect.top  - _bacheDrag.offY);
    nx = Math.max(0, Math.min(rect.width - (_bacheDrag.elW || 160), nx));
    ny = Math.max(0, Math.min(rect.height - 100, ny));
    _bacheDrag.el.classList.remove('dragging');
    var _grd = _db ? _db.ref('state/bacheca/items/' + _bacheDrag.id) : null; if (_grd) _grd.update({ x: nx, y: ny });
    _bacheDrag = null;
  });
  board.addEventListener('mouseleave', function() {
    if (_bacheDrag) { _bacheDrag.el.classList.remove('dragging'); _bacheDrag = null; }
  });

  page.appendChild(board);
  return page;
}

function createBacheEl(item) {
  var el = document.createElement('div');
  el.className = 'bache-item' + (item.pinned ? ' pinned' : '');
  el.dataset.id = item.id;
  var _elW = item.w || 160;
  el.style.cssText = 'left:' + (item.x || 40) + 'px;top:' + (item.y || 40) + 'px;z-index:' + (item.zIndex || 1) + ';width:' + _elW + 'px;';

  var pin = document.createElement('div');
  pin.className = 'bache-pin';
  el.appendChild(pin);

  var inner = document.createElement('div');
  inner.className = 'bache-inner';

  // Fronte
  var face = document.createElement('div');
  face.className = 'bache-face';
  var img = document.createElement('img');
  img.src = item.dataUrl || item.url || '';
  img.alt = 'Manifesto'; img.draggable = false;
  img.onerror = function() {
    this.style.display = 'none';
    var ph = document.createElement('div');
    ph.style.cssText = 'width:100%;min-height:120px;background:linear-gradient(160deg,#3a2010,#1e100a);display:flex;align-items:center;justify-content:center;color:rgba(200,160,80,0.3);font-size:38px;';
    ph.textContent = '\uD83C\uDFF4';
    face.appendChild(ph);
  };
  face.appendChild(img);

  // Bottone lente d'ingrandimento (zoom) — disponibile a tutti
  var zoomBtn = document.createElement('button');
  zoomBtn.className = 'bache-zoom-btn';
  zoomBtn.title = 'Ingrandisci la taglia';
  zoomBtn.innerHTML = '\uD83D\uDD0D';
  zoomBtn.setAttribute('aria-label', 'Ingrandisci');
  zoomBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    _apriLightbox();
  });
  zoomBtn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
  zoomBtn.addEventListener('dblclick', function(e) { e.stopPropagation(); e.preventDefault(); });
  face.appendChild(zoomBtn);

  if (isDM()) {
    var ctrls = document.createElement('div');
    ctrls.className = 'bache-controls';

    var pinBtn = document.createElement('button');
    pinBtn.className = 'bache-ctrl-btn bache-ctrl-pin' + (item.pinned ? ' active' : '');
    pinBtn.textContent = item.pinned ? '\uD83D\uDCCC Fissato' : '\uD83D\uDCCC Fissa';
    pinBtn.onclick = function(e) {
      e.stopPropagation();
      item.pinned = !item.pinned;
      el.classList.toggle('pinned', item.pinned);
      pinBtn.textContent = item.pinned ? '\uD83D\uDCCC Fissato' : '\uD83D\uDCCC Fissa';
      pinBtn.classList.toggle('active', item.pinned);
      var _grp = _db ? _db.ref('state/bacheca/items/' + item.id) : null; if (_grp) _grp.update({ pinned: item.pinned });
    };
    ctrls.appendChild(pinBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'bache-ctrl-btn bache-ctrl-del';
    delBtn.textContent = '\u2715 Rimuovi';
    delBtn.onclick = function(e) {
      e.stopPropagation();
      if (confirm('Rimuovere questo manifesto dalla lavagna?')) {
        var _grr = _db ? _db.ref('state/bacheca/items/' + item.id) : null; if (_grr) _grr.remove();
        el.remove();
      }
    };
    ctrls.appendChild(delBtn);

    face.appendChild(ctrls);

    // Drag-resize handles (angoli + bordi)
    var resizeDirs = [
      { cls:'bache-rh-se', cur:'se-resize', dx:1,  dy:1  },
      { cls:'bache-rh-sw', cur:'sw-resize', dx:-1, dy:1  },
      { cls:'bache-rh-e',  cur:'e-resize',  dx:1,  dy:0  },
      { cls:'bache-rh-w',  cur:'w-resize',  dx:-1, dy:0  }
    ];
    resizeDirs.forEach(function(dir) {
      var h = document.createElement('div');
      h.className = 'bache-resize-handle ' + dir.cls;
      h.style.cursor = dir.cur;
      h.addEventListener('mousedown', function(e) {
        e.preventDefault(); e.stopPropagation();
        var startX = e.clientX;
        var startW = _elW;
        var startLeft = item.x || 40;
        function onMove(ev) {
          var delta = (ev.clientX - startX) * dir.dx;
          var nw = Math.round(Math.max(80, Math.min(600, startW + delta)));
          _elW = nw; item.w = nw;
          el.style.width = nw + 'px';
          if (dir.dx < 0) {
            var nl = Math.round(startLeft - (nw - startW));
            item.x = nl; el.style.left = nl + 'px';
          }
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          var _grw = _db ? _db.ref('state/bacheca/items/' + item.id) : null; if (_grw) _grw.update({ w: _elW, x: item.x });
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      face.appendChild(h);
    });
  }

  // Retro
  var back = document.createElement('div');
  back.className = 'bache-back';
  var backStamp = document.createElement('div');
  backStamp.className = 'bache-back-stamp';
  backStamp.textContent = 'SMASHATO';
  back.appendChild(backStamp);

  if (isDM()) {
    var ta = document.createElement('textarea');
    ta.className = 'bache-comment-ta';
    ta.placeholder = 'Scrivi il commento della guardia...';
    ta.value = item.commento || '';
    var _saveTimer = null;
    ta.addEventListener('input', function() {
      item.commento = ta.value;
      if (_saveTimer) clearTimeout(_saveTimer);
      _saveTimer = setTimeout(function() {
        var _grc = _db ? _db.ref('state/bacheca/items/' + item.id) : null; if (_grc) _grc.update({ commento: ta.value });
      }, 800);
    });
    ta.addEventListener('click', function(e) { e.stopPropagation(); });
    ta.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    back.appendChild(ta);
  } else {
    var commentRo = document.createElement('div');
    commentRo.className = 'bache-comment-ro';
    commentRo.textContent = item.commento ? '\u201c' + item.commento + '\u201d' : '(Nessuna nota della guardia)';
    back.appendChild(commentRo);
  }

  var backSig = document.createElement('div');
  backSig.className = 'bache-back-sig';
  backSig.textContent = '\u2014 Guardia Cittadina';
  back.appendChild(backSig);

  inner.appendChild(face);
  inner.appendChild(back);
  el.appendChild(inner);

  // ---- Lightbox (aperto dal bottone lente, vedi più sotto) ----
  function _apriLightbox() {
    var src = img.src;
    if (!src || src === window.location.href) return;
    var overlay = document.createElement('div');
    overlay.className = 'bache-lightbox-overlay';
    var lbImg = document.createElement('img');
    lbImg.className = 'bache-lightbox-img';
    lbImg.src = src;
    overlay.appendChild(lbImg);
    overlay.addEventListener('click', function() { overlay.remove(); });
    document.body.appendChild(overlay);
  }

  // ---- Doppio clic → flip ----
  el.addEventListener('dblclick', function(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
    e.stopPropagation();
    el.classList.toggle('flipped');
    bachePlayFlip();
  });

  if (isDM()) {
    el.addEventListener('mousedown', function(e) {
      if (item.pinned) return;
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      var maxZ = Date.now();
      item.zIndex = maxZ;
      el.style.zIndex = maxZ;
      var _grz = _db ? _db.ref('state/bacheca/items/' + item.id) : null; if (_grz) _grz.update({ zIndex: maxZ });
      var rect = el.getBoundingClientRect();
      _bacheDrag = { el: el, id: item.id, offX: e.clientX - rect.left, offY: e.clientY - rect.top, elW: _elW };
      el.classList.add('dragging');
    });
  }

  return el;
}

function renderBacheGrid(grid) {
  // Shim per il listener Firebase realtime
  var board = document.getElementById('bacheca-board');
  if (!board) return;
  board.querySelectorAll('.bache-item').forEach(function(i) { i.remove(); });
  var oldEmpty = board.querySelector('.bacheca-empty');
  if (oldEmpty) oldEmpty.remove();
  if (!state.bacheItems || state.bacheItems.length === 0) {
    var emptyEl = document.createElement('div');
    emptyEl.className = 'bacheca-empty';
    emptyEl.innerHTML = isDM()
      ? '\uD83D\uDCCB La lavagna \u00e8 vuota<br><small style="font-size:12px;opacity:0.7;">Usa \u201cAppendi Manifesto\u201d per iniziare</small>'
      : '\uD83D\uDCCB La lavagna \u00e8 vuota...<br><small style="font-size:12px;opacity:0.7;">Il DM non ha ancora appeso nulla.</small>';
    board.appendChild(emptyEl);
    return;
  }
  state.bacheItems.forEach(function(item) {
    if (board.querySelector('[data-id="' + item.id + '"]')) return;
    board.appendChild(createBacheEl(item));
  });
}


/* ========================= ImageDB (IndexedDB x Lavagna) ========================= */
const ImageDB = {
    dbName: 'SiumBoardImages',
    storeName: 'images',
    version: 2,
    init: function() {
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open(ImageDB.dbName, ImageDB.version);
            req.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(ImageDB.storeName)) {
                    db.createObjectStore(ImageDB.storeName, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('app_state')) {
                    db.createObjectStore('app_state');
                }
            };
            req.onsuccess = function(e) { resolve(e.target.result); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    },
    saveState: function(snapStr) {
        return ImageDB.init().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(['app_state'], 'readwrite');
                var req = tx.objectStore('app_state').put(snapStr, 'state');
                req.onsuccess = function() { resolve(); };
                req.onerror = function(e) { reject(e.target.error); };
            });
        });
    },
    getState: function() {
        return ImageDB.init().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(['app_state'], 'readonly');
                var req = tx.objectStore('app_state').get('state');
                req.onsuccess = function() { resolve(req.result); };
                req.onerror = function(e) { reject(e.target.error); };
            });
        });
    },
    save: function(id, dataUrl) {
        return ImageDB.init().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction([ImageDB.storeName], 'readwrite');
                var store = tx.objectStore(ImageDB.storeName);
                var req = store.put({ id: id, dataUrl: dataUrl });
                req.onsuccess = function() { resolve(); };
                req.onerror = function(e) { reject(e.target.error); };
            });
        });
    },
    get: function(id) {
        return ImageDB.init().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction([ImageDB.storeName], 'readonly');
                var store = tx.objectStore(ImageDB.storeName);
                var req = store.get(id);
                req.onsuccess = function() { resolve(req.result ? req.result.dataUrl : null); };
                req.onerror = function(e) { reject(e.target.error); };
            });
        });
    },
    remove: function(id) {
        return ImageDB.init().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction([ImageDB.storeName], 'readwrite');
                var store = tx.objectStore(ImageDB.storeName);
                var req = store.delete(id);
                req.onsuccess = function() { resolve(); };
                req.onerror = function(e) { reject(e.target.error); };
            });
        });
    }
};
window.ImageDB = ImageDB;

function migrateImagesToDB() {
    var changed = false;
    function migrateBoard(board) {
        if (!board) return;
        board.forEach(function(img) {
            if (img.dataUrl && img.dataUrl.length > 100) {
                var du = img.dataUrl;
                ImageDB.save(img.id, du).catch(function(e){console.error("Migration err", e)});
                delete img.dataUrl;
                changed = true;
            }
        });
    }
    
    if (state.scheda) {
        if (state.scheda.abilityBoard) { state.scheda.boardImages = state.scheda.abilityBoard; delete state.scheda.abilityBoard; }
        if (state.scheda.boardImages) migrateBoard(state.scheda.boardImages);
    }
    Object.keys(state.personaggi || {}).forEach(function(pid) {
        var p = state.personaggi[pid];
        if (p.abilityBoard) { p.boardImages = p.abilityBoard; delete p.abilityBoard; }
        if (p.boardImages) migrateBoard(p.boardImages);
    });
    if (changed && typeof saveToStorage === 'function') saveToStorage();
}

/* AVVIO */
try {
  loadFromStorageAsync(function() {
    migrateImagesToDB();
    // Mostra overlay login mentre Firebase Auth controlla la sessione
    document.getElementById('login-overlay').style.display = 'flex';
    // Inizializza Firebase + Auth listener (gestirà lui login/logout)
    try {
      if (!_firebaseApp) {
        if (typeof firebase === 'undefined') throw new Error('SDK Firebase non caricato');
        if (!FIREBASE_CONFIG) throw new Error('Configurazione Firebase runtime assente');
        _firebaseApp = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
        _db = firebase.database();
      }
      initAuth();
    } catch(e) {
      console.warn('[Mercante] Firebase non disponibile:', e.message);
      // Fallback: mostra login
      document.getElementById('login-overlay').style.display = 'flex';
    }

    // Salva storia prima di chiudere/cambiare tab
    window.addEventListener('beforeunload', function() { storiaFlushSave(); });
    window.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') storiaFlushSave(); });

    if (typeof renderMenu === "function") renderMenu();
    render();
  });
} catch (err) {
  console.error('[Mercante] Errore:', err);
  document.getElementById('app').innerHTML =
    '<div style="padding:2rem;color:#ffd8c8;font-family:monospace;font-size:13px;">' +
    '<h2 style="color:#ff9c9c;">Errore avvio</h2>' +
    '<pre>' + escapeHtml(err.message || String(err)) + '\n\n' + escapeHtml(err.stack || '') + '</pre>' +
    '</div>';
}
/* ============================================================
   STORIA DELLA CAMPAGNA
   ============================================================ */
var _storiaLeafletMap = null;
var _storiaFlagLayer  = null;
var _storiaFlagMarkers = {};
var _storiaAnchorMode  = false;
var _storiaSelectedRange = null;
function _storiePrivatePath() {
  var user = state.currentUser && state.currentUser.username ? state.currentUser.username : '_guest';
  return 'storie_private/' + user;
}

function fbSaveStoriaMarkers(mapId) {
  if (!_db || !state.currentUser) return;
  var mid = mapId || state.mappaActiveId || 'default';
  var u = state.currentUser.username;
  var markers = (state.storia.markers && Object.keys(state.storia.markers).length > 0) ? state.storia.markers : null;
  _db.ref('state/storia_markers/' + u + '/' + mid).set(markers);
}

function fbLoadStoriaMarkers(mapId) {
  var mid = mapId || state.mappaActiveId || 'default';
  state.storia.markers = (window._storiaMarkersCache && window._storiaMarkersCache[mid] && typeof window._storiaMarkersCache[mid] === 'object')
    ? window._storiaMarkersCache[mid] : {};
}

function _salvaStoriaConNome(nome, callback) {
  if (!_db || !state.currentUser) { if (callback) callback(new Error('Firebase non connesso')); return; }
  var ed = document.getElementById('storia-editor');
  if (ed) state.storia.content = ed.innerHTML;
  var id = state.storia.currentStoryId || _db.ref().push().key;
  _db.ref(_storiePrivatePath() + '/' + id).set({
    nome: nome,
    content: state.storia.content || '',
    savedAt: Date.now()
  }, function(err) {
    if (!err) {
      state.storia.currentStoryId = id;
      state.storia.currentStoryName = nome;
      saveToStorage();
    }
    if (callback) callback(err);
  });
}

function _caricaLibreria(callback) {
  if (!_db || !state.currentUser) { if (callback) callback({}); return; }
  _db.ref(_storieActivePath()).once('value', function(snap) {
    if (callback) callback(snap.val() || {});
  });
}

function _caricaLibreriaTutti(callback) {
  if (!_db) { callback([]); return; }
  var usernames = _remoteUsers ? Object.keys(_remoteUsers) : [];
  var myUser = state.currentUser && state.currentUser.username;
  if (myUser && usernames.indexOf(myUser) < 0) usernames.push(myUser);
  if (usernames.length === 0) { callback([]); return; }
  var allStories = [];
  var done = 0;
  usernames.forEach(function(uid) {
    _db.ref('storie_private/' + uid).once('value', function(snap) {
      var v = snap.val();
      if (v && typeof v === 'object') {
        Object.keys(v).forEach(function(id) {
          if (v[id]) allStories.push(Object.assign({}, v[id], { _owner: uid, _realId: id }));
        });
      }
      done++;
      if (done === usernames.length) {
        allStories.sort(function(a,b){ return (b.savedAt||0)-(a.savedAt||0); });
        callback(allStories);
      }
    });
  });
}

function storiaFlushSave() {
  var ed = document.getElementById('storia-editor');
  if (ed) state.storia.content = ed.innerHTML;
}

function storiaScheduleSave() {
  if (window._storiaSaveTimer) clearTimeout(window._storiaSaveTimer);
  window._storiaSaveTimer = setTimeout(storiaFlushSave, 800);
}

function storiaHighlightNpcs(editor) {
  var nomes = (state.personaggi || []).map(function(p){ return p.nome; }).filter(Boolean);
  nomes.sort(function(a,b){ return b.length - a.length; }); // più lunghi prima
  if (!nomes.length) return;

  // 1. Rimuovi span NPC già presenti
  Array.from(editor.querySelectorAll('[data-storia-npc]')).forEach(function(s) {
    var p = s.parentNode; while (s.firstChild) p.insertBefore(s.firstChild, s); p.removeChild(s);
  });
  editor.normalize();

  // 2. Processa text-node con TreeWalker
  var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
    acceptNode: function(n) {
      var anc = n.parentNode;
      while (anc && anc !== editor) {
        if (anc.classList && anc.classList.contains('storia-map-link')) return NodeFilter.FILTER_REJECT;
        anc = anc.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  }, false);

  var textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach(function(tn) {
    var text = tn.nodeValue;
    var matches = [];
    nomes.forEach(function(nome) {
      var idx = 0;
      while (true) {
        var pos = text.indexOf(nome, idx);
        if (pos < 0) break;
        matches.push({ start: pos, end: pos + nome.length, nome: nome });
        idx = pos + 1;
      }
    });
    if (!matches.length) return;
    matches.sort(function(a,b){ return a.start - b.start; });
    var filtered = [], lastEnd = 0;
    matches.forEach(function(m) {
      if (m.start >= lastEnd) { filtered.push(m); lastEnd = m.end; }
    });
    if (!filtered.length) return;

    var frag = document.createDocumentFragment(), lastPos = 0;
    filtered.forEach(function(m) {
      if (m.start > lastPos) frag.appendChild(document.createTextNode(text.slice(lastPos, m.start)));
      var sp = document.createElement('span');
      sp.dataset.storiaNpc = m.nome;
      sp.textContent = text.slice(m.start, m.end);
      frag.appendChild(sp);
      lastPos = m.end;
    });
    if (lastPos < text.length) frag.appendChild(document.createTextNode(text.slice(lastPos)));
    tn.parentNode.replaceChild(frag, tn);
  });

  state.storia.content = editor.innerHTML;
}

function showStoriaTooltip(e, npc) {
  var tt = document.getElementById('storia-npc-tooltip');
  if (!tt) return;
  tt.innerHTML = '';
  if (npc.immagine) {
    var img = document.createElement('img');
    img.src = npc.immagine; img.className = 'sntt-img';
    img.onerror = function(){ this.className='sntt-img-ph'; this.alt=npc.nome||''; };
    tt.appendChild(img);
  } else {
    var ph = document.createElement('div');
    ph.className = 'sntt-img-ph'; ph.textContent = npc.nome||'?';
    tt.appendChild(ph);
  }
  var body = document.createElement('div'); body.className = 'sntt-body';
  var nomEl = document.createElement('div'); nomEl.className = 'sntt-nome';
  nomEl.textContent = npc.nome + (npc.ruolo ? ' — ' + npc.ruolo : '');
  body.appendChild(nomEl);
  if (npc.background) {
    var bg = document.createElement('div'); bg.className = 'sntt-bg';
    bg.textContent = npc.background; body.appendChild(bg);
  }
  tt.appendChild(body);
  tt.style.display = 'block';
  var x = e.clientX + 14, y = e.clientY - 16;
  tt.style.left = Math.min(x, window.innerWidth  - 260) + 'px';
  tt.style.top  = Math.min(y, window.innerHeight - 280) + 'px';
}
function hideStoriaTooltip() {
  var tt = document.getElementById('storia-npc-tooltip'); if (tt) tt.style.display = 'none';
}

function getStoriaMarkerIcon(selected, type) {
  var t = type || 'pin';
  var selColor = selected ? '#ffd060' : null;
  var selStroke = selected ? '#a07800' : null;
  var shadow = 'filter:drop-shadow(0 2px 5px rgba(0,0,0,0.7));';

  if (t === 'clock') {
    var fc = selColor || '#7ec8e3';
    var sc = selStroke || '#2a7a9a';
    var html = '<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;' + shadow + '">' +
      '<svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="12" cy="12" r="10" fill="' + fc + '" stroke="' + sc + '" stroke-width="1.5"/>' +
      '<circle cx="12" cy="12" r="9" fill="none" stroke="white" stroke-width="0.5" opacity="0.4"/>' +
      '<line x1="12" y1="12" x2="12" y2="6.5" stroke="' + sc + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="12" y1="12" x2="15.5" y2="12" stroke="' + sc + '" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="12" cy="12" r="1.2" fill="' + sc + '"/>' +
      '</svg></div>';
    return L.divIcon({ className: '', html: html, iconSize: [28, 28], iconAnchor: [14, 14] });
  }

  if (t === 'swords') {
    var fc2 = selColor || '#e09060';
    var sc2 = selStroke || '#8a4020';
    var html2 = '<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;' + shadow + '">' +
      '<svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="12" cy="12" r="11" fill="' + fc2 + '" stroke="' + sc2 + '" stroke-width="1.2"/>' +
      '<g stroke="white" stroke-linecap="round">' +
      '<line x1="6" y1="18" x2="18" y2="6" stroke-width="2"/>' +
      '<line x1="18" y1="18" x2="6" y2="6" stroke-width="2"/>' +
      '<line x1="6" y1="8" x2="8" y2="6" stroke-width="1.5"/>' +
      '<line x1="4" y1="10" x2="6" y2="8" stroke-width="1.5"/>' +
      '<line x1="18" y1="16" x2="16" y2="18" stroke-width="1.5"/>' +
      '<line x1="20" y1="14" x2="18" y2="16" stroke-width="1.5"/>' +
      '<line x1="18" y1="8" x2="16" y2="6" stroke-width="1.5"/>' +
      '<line x1="20" y1="10" x2="18" y2="8" stroke-width="1.5"/>' +
      '<line x1="6" y1="16" x2="8" y2="18" stroke-width="1.5"/>' +
      '<line x1="4" y1="14" x2="6" y2="16" stroke-width="1.5"/>' +
      '</g>' +
      '</svg></div>';
    return L.divIcon({ className: '', html: html2, iconSize: [28, 28], iconAnchor: [14, 14] });
  }

  // default: pin rosso
  var color = selColor || '#e06060';
  var stroke = selStroke || '#a03030';
  return L.divIcon({
    className: '',
    html: '<div style="width:22px;height:30px;display:flex;align-items:flex-end;justify-content:center;' + shadow + '">' +
      '<svg viewBox="0 0 22 30" width="22" height="30" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M11 1C7.13 1 4 4.13 4 8c0 5.25 7 16 7 16s7-10.75 7-16c0-3.87-3.13-7-7-7z" fill="' + color + '" stroke="' + stroke + '" stroke-width="1"/>' +
      '<circle cx="11" cy="8" r="3" fill="white" opacity="0.85"/></svg></div>',
    iconSize: [22, 30], iconAnchor: [11, 28]
  });
}

function refreshStoriaMarkers() {
  if (!_storiaLeafletMap || !_storiaFlagLayer) return;
  _storiaFlagLayer.clearLayers(); _storiaFlagMarkers = {};
  Object.keys(state.storia.markers || {}).forEach(function(mid) {
    var m = state.storia.markers[mid];
    if (typeof m.lat !== 'number' || typeof m.lng !== 'number') return;
    var icon = getStoriaMarkerIcon(state.storia.selectedMarker === mid, m.type);
    var mk = L.marker([m.lat, m.lng], { icon: icon });
    mk.on('click', function() {
      state.storia.selectedMarker = mid;
      refreshStoriaMarkers();
      var panel = document.getElementById('storia-marker-panel');
      if (panel) { panel.classList.add('open'); renderStoriaMarkerPanel(panel, mid); }
    });
    mk.addTo(_storiaFlagLayer);
    _storiaFlagMarkers[mid] = mk;
  });
}

function initStoriaMap() {
  if (typeof L === 'undefined') return;
  var mapDiv = document.getElementById('storia-leaflet-map');
  if (!mapDiv) return;
  if (_storiaLeafletMap) { try { _storiaLeafletMap.remove(); } catch(e){} _storiaLeafletMap = null; }
  mapDiv.innerHTML = '';

  if (!state.mappaUrl) {
    mapDiv.innerHTML = '<div style="padding:1.5rem;color:var(--text-muted);font-family:\'EB Garamond\',serif;">Nessuna mappa attiva. Carica prima una mappa nella sezione <em>Mappa del Mondo</em>.</div>';
    return;
  }
  var img = new Image();
  img.onload = function() {
    var w = img.naturalWidth || 1000, h = img.naturalHeight || 700;
    var bounds = [[0,0],[h,w]];
    _storiaLeafletMap = L.map(mapDiv, { crs: L.CRS.Simple, minZoom:-3, maxZoom:3, zoomControl:false, attributionControl:false });
    L.imageOverlay(state.mappaUrl, bounds).addTo(_storiaLeafletMap);
    _storiaLeafletMap.fitBounds(bounds);
    _storiaFlagLayer = L.layerGroup().addTo(_storiaLeafletMap);
    refreshStoriaMarkers();

    _storiaLeafletMap.on('click', function(e) {
      if (state.storia.mapMode !== 'place') return;
      var mid = 'sm_' + Date.now();
      if (!state.storia.markers) state.storia.markers = {};
      state.storia.markers[mid] = { lat: e.latlng.lat, lng: e.latlng.lng, image: '', text: '', type: state.storia.markerType || 'pin' };

      // Se in anchor mode, collega il testo selezionato al marker
      if (_storiaAnchorMode && _storiaSelectedRange) {
        var ed = document.getElementById('storia-editor');
        if (ed && _storiaSelectedRange.toString().trim()) {
          try {
            var sel = window.getSelection();
            sel.removeAllRanges(); sel.addRange(_storiaSelectedRange);
            var sp = document.createElement('span');
            sp.className = 'storia-map-link'; sp.dataset.markerId = mid;
            _storiaSelectedRange.surroundContents(sp);
            state.storia.content = ed.innerHTML;
          } catch(err) { console.warn('Anchor error', err); }
        }
        _storiaAnchorMode = false; _storiaSelectedRange = null;
        var ab = document.getElementById('storia-anchor-btn');
        if (ab) ab.className = 'storia-anchor-btn';
        state.storia.mapMode = 'move';
        updateStoriaMapToolbar();
      }

      refreshStoriaMarkers(); saveToStorage(); fbSaveStoriaMarkers();
      state.storia.selectedMarker = mid;
      var panel = document.getElementById('storia-marker-panel');
      if (panel) { panel.classList.add('open'); renderStoriaMarkerPanel(panel, mid); }
    });
  };
  img.onerror = function() {
    if (mapDiv) mapDiv.innerHTML = '<div style="padding:1.5rem;color:var(--text-muted);">Impossibile caricare la mappa.</div>';
  };
  img.src = state.mappaUrl;
}

function updateStoriaMapToolbar() {
  var mv = document.getElementById('storia-move-mode-btn');
  if (mv) mv.className = 'storia-map-mode-btn' + (state.storia.mapMode !== 'place' ? ' active' : '');
  var mt = state.storia.markerType || 'pin';
  var pinB  = document.getElementById('storia-marker-type-pin');
  var clkB  = document.getElementById('storia-marker-type-clock');
  var swdB  = document.getElementById('storia-marker-type-swords');
  if (pinB)  pinB.className  = 'storia-map-mode-btn' + (state.storia.mapMode === 'place' && mt === 'pin'    ? ' active' : '');
  if (clkB)  clkB.className  = 'storia-map-mode-btn' + (state.storia.mapMode === 'place' && mt === 'clock'  ? ' active' : '');
  if (swdB)  swdB.className  = 'storia-map-mode-btn' + (state.storia.mapMode === 'place' && mt === 'swords' ? ' active' : '');
}

function renderStoriaMarkerPanel(panel, mid) {
  var m = state.storia.markers[mid] || {};
  panel.innerHTML = '';

  function _closePanel() { panel.classList.remove('open'); state.storia.selectedMarker = null; refreshStoriaMarkers(); }

  // Click sul backdrop (fuori dalla card) chiude il pannello
  panel.onclick = function(e) { if (e.target === panel) _closePanel(); };

  var inner = document.createElement('div'); inner.className = 'storia-marker-inner';
  inner.onclick = function(e) { e.stopPropagation(); };
  panel.appendChild(inner);

  var closeBtn = document.createElement('button');
  closeBtn.className = 'storia-marker-close-btn'; closeBtn.innerHTML = '✕';
  closeBtn.onclick = _closePanel;
  inner.appendChild(closeBtn);

  // Immagine
  var imgLbl = document.createElement('span'); imgLbl.className = 'storia-marker-field-lbl'; imgLbl.textContent = 'IMMAGINE';
  inner.appendChild(imgLbl);
  if (m.image) {
    var preview = document.createElement('img'); preview.src = m.image; preview.className = 'storia-marker-img-preview';
    preview.onerror = function(){ this.style.display='none'; }; inner.appendChild(preview);
  }
  var imgRow = document.createElement('div');
  imgRow.style.cssText = 'display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.4rem;';
  var imgFileBtn = document.createElement('button');
  imgFileBtn.className = 'storia-fmt-btn'; imgFileBtn.style.cssText = 'font-size:11px;padding:0.15rem 0.4rem;';
  imgFileBtn.textContent = '📂 File';
  imgFileBtn.onclick = function() {
    var inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
    inp.onchange = function() {
      var f = inp.files[0]; if (!f) return;
      if (f.size > 3*1024*1024) { alert('Immagine troppo grande (max 3 MB)'); return; }
      var reader = new FileReader();
      reader.onload = function(ev) { state.storia.markers[mid].image = ev.target.result; saveToStorage(); fbSaveStoriaMarkers(); renderStoriaMarkerPanel(panel, mid); };
      reader.readAsDataURL(f);
    }; inp.click();
  };
  imgRow.appendChild(imgFileBtn);
  var imgUrlBtn = document.createElement('button');
  imgUrlBtn.className = 'storia-fmt-btn'; imgUrlBtn.style.cssText = 'font-size:11px;padding:0.15rem 0.4rem;';
  imgUrlBtn.textContent = '🔗 URL';
  imgUrlBtn.onclick = function() {
    var url = prompt('URL immagine:', m.image || '');
    if (url !== null) { state.storia.markers[mid].image = url; saveToStorage(); fbSaveStoriaMarkers(); renderStoriaMarkerPanel(panel, mid); }
  };
  imgRow.appendChild(imgUrlBtn);
  if (m.image) {
    var delImgBtn = document.createElement('button');
    delImgBtn.className = 'storia-fmt-btn'; delImgBtn.style.cssText = 'font-size:11px;padding:0.15rem 0.4rem;color:#ffa0a0;';
    delImgBtn.textContent = '✕';
    delImgBtn.onclick = function() { state.storia.markers[mid].image=''; saveToStorage(); fbSaveStoriaMarkers(); renderStoriaMarkerPanel(panel, mid); };
    imgRow.appendChild(delImgBtn);
  }
  inner.appendChild(imgRow);

  // Testo
  var txtLbl = document.createElement('span'); txtLbl.className = 'storia-marker-field-lbl'; txtLbl.textContent = 'NOTE';
  inner.appendChild(txtLbl);
  var ta = document.createElement('textarea'); ta.className = 'storia-marker-textarea';
  ta.value = m.text || ''; ta.placeholder = 'Descrizione del luogo...';
  ta.oninput = function() { state.storia.markers[mid].text = this.value; saveToStorage(); if(window._smSaveTimer) clearTimeout(window._smSaveTimer); window._smSaveTimer=setTimeout(fbSaveStoriaMarkers,1000); };
  inner.appendChild(ta);

  // Elimina
  var delBtn = document.createElement('button'); delBtn.className = 'storia-marker-del-btn';
  delBtn.textContent = '🗑 Elimina segnalino';
  delBtn.onclick = function() {
    if (!confirm('Eliminare questo segnalino?')) return;
    delete state.storia.markers[mid]; saveToStorage(); fbSaveStoriaMarkers();
    _closePanel();
    var ed = document.getElementById('storia-editor');
    if (ed) {
      ed.querySelectorAll('.storia-map-link[data-marker-id="' + mid + '"]').forEach(function(el) {
        var p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el);
      });
      state.storia.content = ed.innerHTML; saveToStorage();
    }
  };
  inner.appendChild(delBtn);
}


/* ============================================================================
   SEZIONE 14: CRONACHE DELLA CAMPAGNA & STORIA (renderStoria)
   ============================================================================ */
function renderStoria() {
  if (!isDM()) return document.createElement('div');
  var wrap = document.createElement('div'); wrap.className = 'storia-wrap';

  /* ---- Toolbar ---- */
  var toolbar = document.createElement('div'); toolbar.className = 'storia-toolbar';

  var fmts = [
    { cmd:'bold',             html:'<b>B</b>',  title:'Grassetto (Ctrl+B)' },
    { cmd:'italic',           html:'<i>I</i>',  title:'Corsivo (Ctrl+I)' },
    { cmd:'underline',        html:'<u>U</u>',  title:'Sottolineato (Ctrl+U)' },
    { cmd:'strikeThrough',    html:'<s>S</s>',  title:'Barrato' },
    { cmd:'insertOrderedList',html:'1.',         title:'Lista numerata' },
    { cmd:'insertUnorderedList',html:'•',        title:'Lista puntata' },
    { cmd:'justifyLeft',      html:'⬤⬤⬤',      title:'Allinea sinistra' },
    { cmd:'justifyCenter',    html:'⊞',          title:'Centra' },
  ];
  fmts.forEach(function(f) {
    var btn = document.createElement('button'); btn.className = 'storia-fmt-btn';
    btn.innerHTML = f.html; btn.title = f.title;
    btn.onmousedown = function(e) { e.preventDefault(); document.execCommand(f.cmd, false, null); storiaScheduleSave(); };
    toolbar.appendChild(btn);
  });

  var sep1 = document.createElement('div'); sep1.className = 'storia-sep'; toolbar.appendChild(sep1);

  // Highlight (giallo di default, click ripetuto cambia colore)
  var _hlIdx = 0;
  var hlColors = ['#ffd700','#90ee90','#87ceeb','#ffb6c1','transparent'];
  var hlBtn = document.createElement('button'); hlBtn.className = 'storia-fmt-btn'; hlBtn.title = 'Evidenzia';
  hlBtn.innerHTML = '<span style="background:#ffd700;color:#222;padding:1px 3px;border-radius:2px;font-size:10px;">HL</span>';
  hlBtn.onmousedown = function(e) {
    e.preventDefault();
    document.execCommand('hiliteColor', false, hlColors[_hlIdx % hlColors.length]);
    _hlIdx++; storiaScheduleSave();
  };
  toolbar.appendChild(hlBtn);

  // Colore testo
  var colorWrap = document.createElement('label'); colorWrap.title = 'Colore testo'; colorWrap.style.cssText='display:flex;align-items:center;cursor:pointer;';
  var colorInp = document.createElement('input'); colorInp.type = 'color'; colorInp.value = '#e8d5a0';
  colorInp.style.cssText = 'width:22px;height:22px;padding:0;border:2px solid var(--border-default);border-radius:3px;cursor:pointer;background:none;';
  colorInp.title = 'Colore testo';
  colorInp.oninput = function() { document.execCommand('foreColor', false, this.value); storiaScheduleSave(); };
  colorWrap.appendChild(colorInp); toolbar.appendChild(colorWrap);

  // Dimensione font
  var fsWrap = document.createElement('select'); fsWrap.className = 'storia-fmt-btn';
  fsWrap.style.cssText = 'width:56px;padding:0 0.2rem;font-size:11px;';
  fsWrap.title = 'Dimensione carattere';
  [['1','Tiny'],['2','Piccolo'],['3','Normale'],['4','Medio'],['5','Grande'],['6','Molto grande'],['7','Enorme']].forEach(function(p) {
    var op = document.createElement('option'); op.value=p[0]; op.textContent=p[1]; if(p[0]==='3') op.selected=true; fsWrap.appendChild(op);
  });
  fsWrap.onchange = function() { document.execCommand('fontSize', false, this.value); storiaScheduleSave(); };
  toolbar.appendChild(fsWrap);

  var sep2 = document.createElement('div'); sep2.className = 'storia-sep'; toolbar.appendChild(sep2);

  // Pulsante âncora su mappa
  var anchorBtn = document.createElement('button');
  anchorBtn.className = 'storia-anchor-btn'; anchorBtn.id = 'storia-anchor-btn';
  anchorBtn.innerHTML = '📍 Collega a Mappa';
  anchorBtn.title = 'Seleziona del testo, poi premi questo pulsante e clicca sulla mappa per creare un segnalino collegato';
  anchorBtn.onclick = function() {
    _storiaAnchorMode = !_storiaAnchorMode;
    anchorBtn.className = 'storia-anchor-btn' + (_storiaAnchorMode ? ' active' : '');
    if (_storiaAnchorMode) {
      var sel = window.getSelection();
      _storiaSelectedRange = (sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
      if (!state.storia.showMap) {
        state.storia.showMap = true;
        var mp = wrap.querySelector('.storia-map-panel');
        if (mp) { mp.classList.add('open'); mapToggle.className = 'storia-map-toggle active'; setTimeout(initStoriaMap, 100); }
      }
      state.storia.mapMode = 'place'; updateStoriaMapToolbar();
    } else {
      _storiaSelectedRange = null; state.storia.mapMode = 'move'; updateStoriaMapToolbar();
    }
  };
  toolbar.appendChild(anchorBtn);

  // Toggle mappa
  var mapToggle = document.createElement('button');
  mapToggle.className = 'storia-map-toggle' + (state.storia.showMap ? ' active' : '');
  mapToggle.innerHTML = '🗺️ Mappa';
  mapToggle.onclick = function() {
    state.storia.showMap = !state.storia.showMap;
    mapToggle.className = 'storia-map-toggle' + (state.storia.showMap ? ' active' : '');
    var mp = wrap.querySelector('.storia-map-panel');
    if (mp) {
      if (state.storia.showMap) { mp.classList.add('open'); setTimeout(initStoriaMap, 100); }
      else { mp.classList.remove('open'); if (_storiaLeafletMap) { try { _storiaLeafletMap.remove(); } catch(e){} _storiaLeafletMap = null; } }
    }
  };
  toolbar.appendChild(mapToggle);
  wrap.appendChild(toolbar);

  /* ---- Barra filtro persona (solo admin) ---- */
  if (isAdmin()) {
    var storiaFilterBar = document.createElement('div');
    storiaFilterBar.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:0.4rem;padding:0.45rem 0.9rem;background:rgba(60,120,200,0.05);border-bottom:1px solid var(--border-subtle);flex-shrink:0;';
    var sfLabel = document.createElement('span');
    sfLabel.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:0.12em;color:rgba(100,160,240,0.55);white-space:nowrap;margin-right:0.15rem;';
    sfLabel.textContent = 'STORIE:';
    storiaFilterBar.appendChild(sfLabel);
    var _mkStoriaPill = function(label, val) {
      var isActive = (val === '' && !_storiaViewAsUser) || (val !== '' && val === _storiaViewAsUser);
      var btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = 'font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:0.06em;padding:0.28rem 0.75rem;border-radius:20px;cursor:pointer;white-space:nowrap;transition:all 0.15s;' +
        'border:1.5px solid ' + (isActive ? 'rgba(100,160,240,0.85)' : 'rgba(100,160,240,0.3)') + ';' +
        'background:' + (isActive ? 'rgba(100,160,240,0.2)' : 'rgba(100,160,240,0.04)') + ';' +
        'color:' + (isActive ? '#a0c8f8' : 'rgba(100,160,240,0.6)') + ';' +
        'font-weight:' + (isActive ? '700' : '400') + ';';
      btn.onclick = function() {
        _storiaViewAsUser = val === '' ? null : val;
        renderMain();
      };
      return btn;
    };
    storiaFilterBar.appendChild(_mkStoriaPill('📚 Tutte', '__tutte__'));
    storiaFilterBar.appendChild(_mkStoriaPill('⭐ ' + (state.currentUser ? state.currentUser.username : 'Mie'), ''));
    if (_remoteUsers && typeof _remoteUsers === 'object') {
      Object.keys(_remoteUsers).sort().forEach(function(uid) {
        if (uid === (state.currentUser && state.currentUser.username)) return;
        storiaFilterBar.appendChild(_mkStoriaPill('👤 ' + uid, uid));
      });
    }
    wrap.appendChild(storiaFilterBar);
  }

  /* ---- Barra salvataggio ---- */
  var savebar = document.createElement('div');
  savebar.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.35rem 0.9rem;background:rgba(201,165,92,0.06);border-bottom:1px solid var(--border-subtle);flex-shrink:0;flex-wrap:wrap;';

  var saveBtn = document.createElement('button');
  saveBtn.id = 'storia-save-btn';
  saveBtn.style.cssText = 'display:inline-flex;align-items:center;gap:0.4rem;background:rgba(201,165,92,0.2);border:1.5px solid var(--gold);color:var(--gold-bright);border-radius:6px;padding:0.3rem 1rem;cursor:pointer;font-size:12px;font-family:\'Cinzel\',serif;letter-spacing:0.08em;transition:all 0.15s;';
  saveBtn.innerHTML = '💾 Salva';

  var libraryBtn = document.createElement('button');
  libraryBtn.style.cssText = 'display:inline-flex;align-items:center;gap:0.4rem;background:rgba(100,160,240,0.15);border:1.5px solid rgba(100,160,240,0.5);color:#88b8f0;border-radius:6px;padding:0.3rem 1rem;cursor:pointer;font-size:12px;font-family:\'Cinzel\',serif;letter-spacing:0.08em;transition:all 0.15s;';
  libraryBtn.innerHTML = '📚 Seleziona Storia';

  var nuovaBtn = document.createElement('button');
  nuovaBtn.style.cssText = 'display:inline-flex;align-items:center;gap:0.4rem;background:rgba(130,200,130,0.12);border:1.5px solid rgba(130,200,130,0.4);color:#90e090;border-radius:6px;padding:0.3rem 1rem;cursor:pointer;font-size:12px;font-family:\'Cinzel\',serif;letter-spacing:0.08em;transition:all 0.15s;';
  nuovaBtn.innerHTML = '✏️ Nuova';

  var storyNameLabel = document.createElement('span');
  storyNameLabel.style.cssText = 'font-size:12px;font-family:\'Cinzel\',serif;color:var(--text-faint);letter-spacing:0.06em;flex:1;';
  storyNameLabel.textContent = state.storia.currentStoryName ? '📖 ' + state.storia.currentStoryName : 'Nessuna storia aperta';

  var saveStatus = document.createElement('span');
  saveStatus.style.cssText = 'font-size:11px;font-family:\'Cinzel\',serif;color:var(--text-faint);letter-spacing:0.06em;';

  /* Mostra finestra nome */
  function _mostraInputNome(defaultNome, callback) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:10px;padding:1.5rem 2rem;width:360px;max-width:95%;box-shadow:0 12px 48px rgba(0,0,0,0.8);display:flex;flex-direction:column;gap:1rem;';
    var title = document.createElement('div');
    title.style.cssText = 'font-family:\'Cinzel\',serif;font-size:14px;color:var(--gold-bright);letter-spacing:0.08em;';
    title.textContent = 'Nome della storia';
    var inp = document.createElement('input');
    inp.type = 'text'; inp.value = defaultNome || '';
    inp.placeholder = 'Es. La caduta di Chronis...';
    inp.style.cssText = 'background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid var(--border-default);border-radius:6px;padding:0.5rem 0.75rem;color:var(--text-main);font-size:14px;outline:none;';
    var btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;';
    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Annulla';
    cancelBtn.style.cssText = 'padding:0.4rem 1rem;border-radius:6px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-faint);cursor:pointer;font-size:13px;';
    var confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Salva';
    confirmBtn.style.cssText = 'padding:0.4rem 1rem;border-radius:6px;border:1.5px solid var(--gold);background:rgba(201,165,92,0.2);color:var(--gold-bright);cursor:pointer;font-size:13px;font-family:\'Cinzel\',serif;';
    cancelBtn.onclick = function() { document.body.removeChild(overlay); };
    confirmBtn.onclick = function() {
      var nome = inp.value.trim();
      if (!nome) { inp.style.border='1px solid #ff9c9c'; return; }
      document.body.removeChild(overlay);
      callback(nome);
    };
    inp.onkeydown = function(e) { if (e.key === 'Enter') confirmBtn.onclick(); if (e.key === 'Escape') cancelBtn.onclick(); };
    btnRow.appendChild(cancelBtn); btnRow.appendChild(confirmBtn);
    box.appendChild(title); box.appendChild(inp); box.appendChild(btnRow);
    overlay.appendChild(box); document.body.appendChild(overlay);
    setTimeout(function(){ inp.focus(); inp.select(); }, 50);
  }

  saveBtn.onclick = function() {
    var ed = document.getElementById('storia-editor');
    if (ed) state.storia.content = ed.innerHTML;
    if (!_db) { saveStatus.style.color='#ff9c9c'; saveStatus.textContent='❌ Firebase non connesso'; return; }
    function doSave(nome) {
      saveBtn.disabled = true;
      saveStatus.style.color='var(--text-faint)'; saveStatus.textContent='⏳ Salvataggio...';
      _salvaStoriaConNome(nome, function(err) {
        saveBtn.disabled = false;
        if (err) {
          saveStatus.style.color='#ff9c9c';
          saveStatus.textContent = '❌ ' + (err.code==='PERMISSION_DENIED' ? 'Regole Firebase scadute' : err.message);
        } else {
          saveStatus.style.color='#7dce82';
          saveStatus.textContent = '✅ Salvata — ' + new Date().toLocaleTimeString('it-IT');
          storyNameLabel.textContent = '📖 ' + nome;
        }
      });
    }
    if (state.storia.currentStoryId) {
      doSave(state.storia.currentStoryName);
    } else {
      _mostraInputNome('', doSave);
    }
  };

  nuovaBtn.onclick = function() {
    state.storia.content = '';
    state.storia.currentStoryId = null;
    state.storia.currentStoryName = '';
    state.storia.showLibrary = false;
    storyNameLabel.textContent = 'Nessuna storia aperta';
    saveStatus.textContent = '';
    var ed = document.getElementById('storia-editor');
    if (ed) ed.innerHTML = '<p><br></p>';
  };

  libraryBtn.onclick = function() {
    state.storia.showLibrary = !state.storia.showLibrary;
    var edWrap = document.getElementById('storia-editor-wrap');
    var libWrap = document.getElementById('storia-library-wrap');
    if (edWrap) edWrap.style.display = state.storia.showLibrary ? 'none' : '';
    if (libWrap) {
      libWrap.style.display = state.storia.showLibrary ? 'flex' : 'none';
      if (state.storia.showLibrary) _renderLibreria(libWrap);
    }
    libraryBtn.innerHTML = state.storia.showLibrary ? '✏️ Torna all\'editor' : '📚 Seleziona Storia';
  };

  savebar.appendChild(saveBtn);
  savebar.appendChild(nuovaBtn);
  savebar.appendChild(libraryBtn);
  savebar.appendChild(storyNameLabel);
  savebar.appendChild(saveStatus);
  wrap.appendChild(savebar);

  /* ---- Area principale ---- */
  var mainArea = document.createElement('div'); mainArea.className = 'storia-main';

  /* Libreria storie */
  var libWrap = document.createElement('div');
  libWrap.id = 'storia-library-wrap';
  libWrap.style.cssText = 'display:' + (state.storia.showLibrary ? 'flex' : 'none') + ';flex-direction:column;flex:1;overflow-y:auto;padding:1rem 1.2rem;gap:0.6rem;';

  function _renderLibreria(container) {
    container.innerHTML = '';
    var hdr = document.createElement('div');
    hdr.style.cssText = 'font-family:\'Cinzel\',serif;font-size:13px;color:var(--gold-bright);letter-spacing:0.1em;margin-bottom:0.4rem;';
    hdr.textContent = _storiaViewAsUser === '__tutte__' ? 'TUTTE LE STORIE'
                    : _storiaViewAsUser ? ('STORIE DI ' + _storiaViewAsUser.toUpperCase())
                    : 'LE TUE STORIE';
    container.appendChild(hdr);
    var loading = document.createElement('div');
    loading.style.cssText = 'color:var(--text-faint);font-size:13px;';
    loading.textContent = 'Caricamento...';
    container.appendChild(loading);

    // ---- Modalità TUTTE ----
    if (_storiaViewAsUser === '__tutte__') {
      _caricaLibreriaTutti(function(allStories) {
        container.removeChild(loading);
        if (allStories.length === 0) {
          var empty = document.createElement('div');
          empty.style.cssText = 'color:var(--text-faint);font-size:13px;font-style:italic;';
          empty.textContent = 'Nessuna storia trovata.';
          container.appendChild(empty); return;
        }
        allStories.forEach(function(s) {
          var card = document.createElement('div');
          card.style.cssText = 'display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.9rem;background:rgba(201,165,92,0.07);border:1px solid var(--border-subtle);border-radius:8px;cursor:pointer;transition:background 0.15s;';
          card.onmouseenter = function(){ card.style.background='rgba(201,165,92,0.14)'; };
          card.onmouseleave = function(){ card.style.background='rgba(201,165,92,0.07)'; };
          var info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0;';
          var nome = document.createElement('div');
          nome.style.cssText = 'font-family:\'Cinzel\',serif;font-size:13px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
          nome.textContent = s.nome || 'Senza nome';
          var meta = document.createElement('div');
          meta.style.cssText = 'font-size:10px;color:var(--text-faint);margin-top:2px;display:flex;gap:0.5rem;';
          var ownerTag = document.createElement('span');
          ownerTag.style.cssText = 'background:rgba(100,160,240,0.15);border:1px solid rgba(100,160,240,0.3);color:#88b8f0;border-radius:4px;padding:0 0.35rem;font-size:9px;';
          ownerTag.textContent = s._owner;
          var dataSpan = document.createElement('span');
          dataSpan.textContent = s.savedAt ? new Date(s.savedAt).toLocaleString('it-IT') : '';
          meta.appendChild(ownerTag); meta.appendChild(dataSpan);
          info.appendChild(nome); info.appendChild(meta);
          card.onclick = function() {
            state.storia.content = typeof s.content === 'string' ? s.content : '';
            state.storia.currentStoryId = s._realId;
            state.storia.currentStoryName = s.nome || '';
            state.storia.showLibrary = false;
            storyNameLabel.textContent = '📖 ' + (s.nome || '') + ' (' + s._owner + ')';
            saveStatus.textContent = '';
            libraryBtn.innerHTML = '📚 Seleziona Storia';
            var edWrap2 = document.getElementById('storia-editor-wrap');
            var libWrap2 = document.getElementById('storia-library-wrap');
            if (libWrap2) libWrap2.style.display = 'none';
            if (edWrap2) {
              edWrap2.style.display = '';
              var ed2 = document.getElementById('storia-editor');
              if (ed2) { ed2.innerHTML = state.storia.content || '<p><br></p>'; }
            }
            refreshStoriaMarkers();
          };
          card.appendChild(info);
          container.appendChild(card);
        });
      });
      return;
    }

    // ---- Modalità normale (singolo utente) ----
    _caricaLibreria(function(storie) {
      container.removeChild(loading);
      var ids = Object.keys(storie);
      if (ids.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'color:var(--text-faint);font-size:13px;font-style:italic;';
        empty.textContent = 'Nessuna storia salvata. Scrivi qualcosa e clicca Salva.';
        container.appendChild(empty); return;
      }
      ids.sort(function(a,b){ return (storie[b].savedAt||0)-(storie[a].savedAt||0); });
      ids.forEach(function(id) {
        var s = storie[id];
        var card = document.createElement('div');
        card.style.cssText = 'display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.9rem;background:rgba(201,165,92,0.07);border:1px solid var(--border-subtle);border-radius:8px;cursor:pointer;transition:background 0.15s;';
        if (id === state.storia.currentStoryId) card.style.borderColor = 'var(--gold)';
        card.onmouseenter = function(){ card.style.background='rgba(201,165,92,0.14)'; };
        card.onmouseleave = function(){ card.style.background='rgba(201,165,92,0.07)'; };
        var info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0;';
        var nome = document.createElement('div');
        nome.style.cssText = 'font-family:\'Cinzel\',serif;font-size:13px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        nome.textContent = s.nome || 'Senza nome';
        var data = document.createElement('div');
        data.style.cssText = 'font-size:10px;color:var(--text-faint);margin-top:2px;';
        data.textContent = s.savedAt ? new Date(s.savedAt).toLocaleString('it-IT') : '';
        info.appendChild(nome); info.appendChild(data);
        if (!_storiaViewAsUser) {
          var delBtn = document.createElement('button');
          delBtn.innerHTML = '🗑️';
          delBtn.title = 'Elimina';
          delBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:14px;opacity:0.5;padding:0.2rem;border-radius:4px;';
          delBtn.onmouseenter = function(){ delBtn.style.opacity='1'; };
          delBtn.onmouseleave = function(){ delBtn.style.opacity='0.5'; };
          delBtn.onclick = function(e) {
            e.stopPropagation();
            if (!confirm('Eliminare "' + (s.nome||'questa storia') + '"?')) return;
            _db.ref(_storiePrivatePath() + '/' + id).remove(function() {
              if (state.storia.currentStoryId === id) {
                state.storia.currentStoryId = null; state.storia.currentStoryName = '';
                state.storia.content = ''; state.storia.markers = {};
                storyNameLabel.textContent = 'Nessuna storia aperta';
              }
              _renderLibreria(container);
            });
          };
          card.appendChild(delBtn);
        }
        card.onclick = function() {
          state.storia.content = typeof s.content === 'string' ? s.content : '';
          state.storia.currentStoryId = id;
          state.storia.currentStoryName = s.nome || '';
          state.storia.showLibrary = false;
          storyNameLabel.textContent = '📖 ' + (s.nome || '');
          saveStatus.textContent = '';
          libraryBtn.innerHTML = '📚 Seleziona Storia';
          var edWrap2 = document.getElementById('storia-editor-wrap');
          var libWrap2 = document.getElementById('storia-library-wrap');
          if (libWrap2) libWrap2.style.display = 'none';
          if (edWrap2) {
            edWrap2.style.display = '';
            var ed2 = document.getElementById('storia-editor');
            if (ed2) { ed2.innerHTML = state.storia.content || '<p><br></p>'; }
          }
          refreshStoriaMarkers();
        };
        card.appendChild(info);
        container.appendChild(card);
      });
    });
  }
  mainArea.appendChild(libWrap);

  /* Editor */
  var editorWrap = document.createElement('div'); editorWrap.className = 'storia-editor-wrap'; editorWrap.id = 'storia-editor-wrap';
  editorWrap.style.display = state.storia.showLibrary ? 'none' : '';
  var editor = document.createElement('div');
  editor.contentEditable = 'true'; editor.className = 'storia-editor'; editor.id = 'storia-editor';
  editor.setAttribute('spellcheck', 'false');
  if (state.storia.content) editor.innerHTML = state.storia.content;
  else editor.innerHTML = '<p><br></p>';

  editor.oninput = storiaScheduleSave;
  editor.onblur = function() { storiaHighlightNpcs(editor); storiaFlushSave(); };

  editor.addEventListener('mouseover', function(e) {
    var t = e.target.closest('[data-storia-npc]');
    if (!t) { hideStoriaTooltip(); return; }
    var _npcNome = t.dataset.storiaNpc;
    var npc = null;
    (state.worldbuilding || []).forEach(function(z){ (z.citta||[]).forEach(function(c){ (c.npcChiave||[]).forEach(function(p){ if(p&&p.nome===_npcNome) npc=p; }); }); });
    if (npc) showStoriaTooltip(e, npc); else hideStoriaTooltip();
  });
  editor.addEventListener('mouseleave', hideStoriaTooltip);

  editor.addEventListener('click', function(e) {
    var link = e.target.closest('.storia-map-link');
    if (!link) return;
    var mid = link.dataset.markerId;
    if (!mid || !state.storia.markers[mid]) return;
    state.storia.showMap = true;
    var mp = wrap.querySelector('.storia-map-panel');
    if (mp) {
      mp.classList.add('open'); mapToggle.className = 'storia-map-toggle active';
      setTimeout(function() {
        if (!_storiaLeafletMap) initStoriaMap();
        setTimeout(function() {
          var m = state.storia.markers[mid];
          if (_storiaLeafletMap && m) _storiaLeafletMap.flyTo([m.lat, m.lng], 0);
          state.storia.selectedMarker = mid; refreshStoriaMarkers();
          var panel = document.getElementById('storia-marker-panel');
          if (panel) { panel.classList.add('open'); renderStoriaMarkerPanel(panel, mid); }
        }, 350);
      }, 100);
    }
  });

  editorWrap.appendChild(editor);
  mainArea.appendChild(editorWrap);

  /* Pannello NPC — archivio generale + NPC archiviati nelle città della mappa attiva, ordine alfabetico. */
  var _allNpcs = [];
  (state.personaggi || []).forEach(function(p){ if (p && p.nome) _allNpcs.push(p); });
  (state.worldbuilding || []).forEach(function(zone) {
    (zone.citta || []).forEach(function(city) {
      (city.npcChiave || []).forEach(function(p){ if (p && p.nome) _allNpcs.push(p); });
    });
  });
  _allNpcs.sort(function(a,b){ return a.nome.localeCompare(b.nome, 'it'); });

  var npcPanel = document.createElement('div'); npcPanel.className = 'storia-npc-panel';
  var npcHdr = document.createElement('div'); npcHdr.className = 'storia-npc-header'; npcHdr.textContent = 'PERSONAGGI'; npcPanel.appendChild(npcHdr);
  _allNpcs.forEach(function(npc) {
    var item = document.createElement('div'); item.className = 'storia-npc-item';
    if (npc.immagine) {
      var av = document.createElement('img'); av.src = npc.immagine; av.className = 'storia-npc-avatar';
      av.onerror = function(){ this.style.display='none'; }; item.appendChild(av);
    } else {
      var ph = document.createElement('div'); ph.className = 'storia-npc-avatar-ph';
      ph.textContent = npc.nome.charAt(0).toUpperCase(); item.appendChild(ph);
    }
    var nm = document.createElement('span'); nm.className = 'storia-npc-nome'; nm.textContent = npc.nome; item.appendChild(nm);
    item.onmouseenter = function(e) { showStoriaTooltip(e, npc); };
    item.onmouseleave = hideStoriaTooltip;
    item.onclick = function() {
      var ed = document.getElementById('storia-editor');
      if (!ed) return; ed.focus();
      document.execCommand('insertText', false, npc.nome); storiaScheduleSave();
    };
    npcPanel.appendChild(item);
  });
  mainArea.appendChild(npcPanel);

  /* Pannello mappa */
  var mapPanel = document.createElement('div');
  mapPanel.className = 'storia-map-panel' + (state.storia.showMap ? ' open' : '');
  mapPanel.id = 'storia-map-panel';

  var mapTb = document.createElement('div'); mapTb.className = 'storia-map-toolbar';
  var mapTbLabel = document.createElement('span'); mapTbLabel.textContent = 'MODALITÀ:'; mapTb.appendChild(mapTbLabel);
  var moveModeBtn = document.createElement('button');
  moveModeBtn.id = 'storia-move-mode-btn';
  moveModeBtn.className = 'storia-map-mode-btn' + (state.storia.mapMode !== 'place' ? ' active' : '');
  moveModeBtn.textContent = 'Naviga';
  moveModeBtn.onclick = function() {
    state.storia.mapMode = 'move'; updateStoriaMapToolbar();
    _storiaAnchorMode = false; _storiaSelectedRange = null;
    var ab = document.getElementById('storia-anchor-btn'); if (ab) ab.className = 'storia-anchor-btn';
  };
  mapTb.appendChild(moveModeBtn);

  var mapTbSep = document.createElement('span');
  mapTbSep.textContent = 'SEGNALINO:'; mapTbSep.style.cssText = 'margin-left:0.6rem;font-size:10px;opacity:0.6;letter-spacing:0.05em;';
  mapTb.appendChild(mapTbSep);

  var pinBtn = document.createElement('button');
  pinBtn.id = 'storia-marker-type-pin';
  pinBtn.title = 'Segnalino luogo';
  pinBtn.innerHTML = '<svg viewBox="0 0 22 28" width="14" height="17" xmlns="http://www.w3.org/2000/svg"><path d="M11 1C7.13 1 4 4.13 4 8c0 5.25 7 14 7 14s7-8.75 7-14c0-3.87-3.13-7-7-7z" fill="currentColor"/><circle cx="11" cy="8" r="2.8" fill="white" opacity="0.7"/></svg>';
  pinBtn.className = 'storia-map-mode-btn' + (state.storia.mapMode === 'place' && (state.storia.markerType||'pin') === 'pin' ? ' active' : '');
  pinBtn.onclick = function() { state.storia.markerType = 'pin'; state.storia.mapMode = 'place'; updateStoriaMapToolbar(); };
  mapTb.appendChild(pinBtn);

  var clockBtn = document.createElement('button');
  clockBtn.id = 'storia-marker-type-clock';
  clockBtn.title = 'Segnalino orologio';
  clockBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="12" x2="12" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  clockBtn.className = 'storia-map-mode-btn' + (state.storia.mapMode === 'place' && state.storia.markerType === 'clock' ? ' active' : '');
  clockBtn.onclick = function() { state.storia.markerType = 'clock'; state.storia.mapMode = 'place'; updateStoriaMapToolbar(); };
  mapTb.appendChild(clockBtn);

  var swordsBtn = document.createElement('button');
  swordsBtn.id = 'storia-marker-type-swords';
  swordsBtn.title = 'Segnalino battaglia';
  swordsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><line x1="5" y1="19" x2="19" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="7" x2="7" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="9" x2="5" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="19" y1="17" x2="17" y2="19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="21" y1="15" x2="19" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="19" y1="5" x2="17" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="19" x2="7" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="19" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  swordsBtn.className = 'storia-map-mode-btn' + (state.storia.mapMode === 'place' && state.storia.markerType === 'swords' ? ' active' : '');
  swordsBtn.onclick = function() { state.storia.markerType = 'swords'; state.storia.mapMode = 'place'; updateStoriaMapToolbar(); };
  mapTb.appendChild(swordsBtn);

  var savePinSep = document.createElement('span'); savePinSep.style.cssText='flex:1;'; mapTb.appendChild(savePinSep);
  var savePinBtn = document.createElement('button');
  savePinBtn.id = 'storia-save-pin-btn';
  savePinBtn.title = 'Salva tutti i pin sulla mappa';
  savePinBtn.style.cssText = 'display:inline-flex;align-items:center;gap:0.3rem;background:rgba(201,165,92,0.2);border:1.5px solid var(--gold);color:var(--gold-bright);border-radius:6px;padding:0.25rem 0.75rem;cursor:pointer;font-size:11px;font-family:\'Cinzel\',serif;letter-spacing:0.06em;white-space:nowrap;';
  savePinBtn.innerHTML = '💾 Salva Pin';
  savePinBtn.onclick = function() {
    fbSaveStoriaMarkers();
    savePinBtn.innerHTML = '✅ Salvati';
    savePinBtn.style.color = '#7dce82';
    savePinBtn.style.borderColor = '#7dce82';
    setTimeout(function() { savePinBtn.innerHTML = '💾 Salva Pin'; savePinBtn.style.color=''; savePinBtn.style.borderColor=''; }, 2000);
  };
  mapTb.appendChild(savePinBtn);

  mapPanel.appendChild(mapTb);

  var mapContainer = document.createElement('div'); mapContainer.id = 'storia-map-container';
  var mapDiv = document.createElement('div'); mapDiv.id = 'storia-leaflet-map'; mapContainer.appendChild(mapDiv);
  var markerPanel = document.createElement('div'); markerPanel.className = 'storia-marker-panel'; markerPanel.id = 'storia-marker-panel'; mapContainer.appendChild(markerPanel);
  mapPanel.appendChild(mapContainer);
  mainArea.appendChild(mapPanel);
  wrap.appendChild(mainArea);

  // Tooltip NPC (globale nella sezione)
  var tt = document.createElement('div'); tt.id = 'storia-npc-tooltip'; wrap.appendChild(tt);

  if (state.storia.showMap) setTimeout(initStoriaMap, 100);
  return wrap;
}

/* ============================================================
   ARCHIVIO IDEE — sezione privata per ogni DM
   Firebase: archivioIdee/{uid}/{bookId}
   ============================================================ */

/* ============================================================================
   SEZIONE 15: ARCHIVIO IDEE & TOMI DEL MASTER (renderArchivio)
   ============================================================================ */
function renderArchivio() {
  var uid = (_authUser && _authUser.uid) || (state.currentUser && state.currentUser.username);
  if (!uid || !_db) {
    var noDb = document.createElement('div');
    noDb.style.cssText = 'padding:2rem;color:var(--text-muted);text-align:center;';
    noDb.textContent = 'Connessione al database non disponibile.';
    return noDb;
  }

  var _archRef = _db.ref('archivioIdee/' + uid);
  var _archBooks = {};
  var _archSelId = null;
  var _archSaveTimer = null;

  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;background:var(--bg-main);';

  /* Header */
  var hdr = document.createElement('header');
  hdr.className = 'border-b';
  hdr.innerHTML = '<div class="container-main" style="padding-top:1.5rem;padding-bottom:1rem;">' +
    '<div class="header-eyebrow mb-2"><span>DM Privato</span></div>' +
    '<h1 class="header-title">Archivio Idee</h1></div>';
  wrap.appendChild(hdr);

  /* Body = shelf (left) + editor (right) */
  var body = document.createElement('div');
  body.style.cssText = 'display:flex;flex:1;height:calc(100vh - 132px);overflow:hidden;';
  body.className = 'archivio-body-mobile';
  wrap.appendChild(body);

  /* ---- SHELF ---- */
  var shelf = document.createElement('div');
  shelf.style.cssText = 'width:250px;min-width:200px;max-width:270px;display:flex;flex-direction:column;' +
    'background:linear-gradient(180deg,#2a1a08 0%,#1a0d03 100%);' +
    'border-right:2px solid #5a3a1a;position:relative;';
  body.appendChild(shelf);

  var shelfHead = document.createElement('div');
  shelfHead.style.cssText = 'padding:0.9rem 1rem;font-family:"Cinzel",serif;font-size:11px;letter-spacing:0.18em;' +
    'color:rgba(245,166,35,0.65);text-align:center;border-bottom:1px solid rgba(245,166,35,0.18);flex-shrink:0;';
  shelfHead.textContent = '📚 I MIEI LIBRI';
  shelf.appendChild(shelfHead);

  var booksWrap = document.createElement('div');
  booksWrap.style.cssText = 'flex:1;overflow-y:auto;padding:0.75rem;display:flex;flex-direction:column;gap:0.35rem;';
  shelf.appendChild(booksWrap);

  var addBookBtn = document.createElement('button');
  addBookBtn.style.cssText = 'flex-shrink:0;margin:0.6rem;padding:0.55rem;border-radius:8px;cursor:pointer;' +
    'background:rgba(245,166,35,0.1);border:1.5px dashed rgba(245,166,35,0.35);' +
    'color:rgba(245,166,35,0.75);font-family:"Cinzel",serif;font-size:11px;letter-spacing:0.1em;transition:all 0.15s;';
  addBookBtn.textContent = '+ Nuovo Libro';
  addBookBtn.onmouseenter = function() { addBookBtn.style.background='rgba(245,166,35,0.2)'; addBookBtn.style.borderColor='rgba(245,166,35,0.6)'; };
  addBookBtn.onmouseleave = function() { addBookBtn.style.background='rgba(245,166,35,0.1)'; addBookBtn.style.borderColor='rgba(245,166,35,0.35)'; };
  shelf.appendChild(addBookBtn);

  /* ---- EDITOR PANEL ---- */
  var editorPanel = document.createElement('div');
  editorPanel.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
  body.appendChild(editorPanel);

  var emptyState = document.createElement('div');
  emptyState.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'color:var(--text-muted);gap:1.2rem;';
  emptyState.innerHTML = '<div style="font-size:72px;line-height:1;">📖</div>' +
    '<div style="font-family:\'Cinzel\',serif;font-size:16px;letter-spacing:0.1em;color:var(--text-secondary);">Seleziona un libro per aprirlo</div>' +
    '<div style="font-size:12px;opacity:0.55;">o crea un nuovo libro con il pulsante a sinistra</div>';

  /* ---- COLORS ---- */
  var SPINE_COLORS = [
    '#8B2E2E','#2E5B8B','#2E7A3F','#7A4A2E','#5B2E7A','#2E6E7A',
    '#8B7B2E','#7A2E5B','#3D7A4A','#6B3D3D','#3D3D8B','#6B583D',
    '#8B4E2E','#2E4E7A','#5A7A2E','#7A2E72'
  ];

  function _bookColor(id) {
    var keys = Object.keys(_archBooks);
    var i = keys.indexOf(id);
    return SPINE_COLORS[(i < 0 ? 0 : i) % SPINE_COLORS.length];
  }

  function _schedSave(id) {
    if (_archSaveTimer) clearTimeout(_archSaveTimer);
    _archSaveTimer = setTimeout(function() {
      if (_archBooks[id]) _archRef.child(id).set(_archBooks[id]);
    }, 700);
  }

  /* Render a book entry in the shelf */
  function _mkSpine(id) {
    var b = _archBooks[id];
    var col = _bookColor(id);
    var el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:0.55rem;padding:0.45rem 0.55rem;border-radius:6px;cursor:pointer;' +
      'transition:all 0.15s;background:' + (_archSelId===id ? 'rgba(245,166,35,0.13)' : 'transparent') + ';' +
      'border:1px solid ' + (_archSelId===id ? 'rgba(245,166,35,0.35)' : 'transparent') + ';';
    var spine = document.createElement('div');
    spine.style.cssText = 'width:7px;min-width:7px;height:38px;border-radius:3px;flex-shrink:0;background:' + col + ';' +
      'box-shadow:1px 1px 6px rgba(0,0,0,0.6);';
    el.appendChild(spine);
    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-family:"Cinzel",serif;font-size:11px;color:rgba(245,210,120,0.88);line-height:1.3;' +
      'word-break:break-word;flex:1;';
    lbl.textContent = b.titolo || 'Senza titolo';
    el.appendChild(lbl);
    el.onmouseenter = function() { if(_archSelId!==id){el.style.background='rgba(245,166,35,0.07)';el.style.borderColor='rgba(245,166,35,0.18)';} };
    el.onmouseleave = function() { if(_archSelId!==id){el.style.background='transparent';el.style.borderColor='transparent';} };
    el.onclick = function() { _archSelId = id; _rebuildShelf(); _openEditor(id); };
    return el;
  }

  function _rebuildShelf() {
    booksWrap.innerHTML = '';
    var ids = Object.keys(_archBooks);
    if (!ids.length) {
      var hint = document.createElement('div');
      hint.style.cssText = 'text-align:center;color:rgba(245,166,35,0.35);font-size:11px;padding:1.5rem 0.5rem;font-style:italic;line-height:1.6;';
      hint.textContent = 'Nessun libro ancora.\nCreane uno!';
      booksWrap.appendChild(hint);
    } else {
      ids.forEach(function(id) { booksWrap.appendChild(_mkSpine(id)); });
    }
  }

  /* Open a book in the editor */
  function _openEditor(id) {
    var b = _archBooks[id];
    if (!b) return;
    editorPanel.innerHTML = '';
    var col = _bookColor(id);

    /* — Editor header bar — */
    var eHdr = document.createElement('div');
    eHdr.style.cssText = 'display:flex;align-items:center;gap:0.85rem;padding:1rem 1.4rem;' +
      'border-bottom:1px solid var(--border-gold);background:var(--bg-card);flex-shrink:0;';

    var badge = document.createElement('div');
    badge.style.cssText = 'width:14px;height:14px;min-width:14px;border-radius:3px;background:' + col + ';box-shadow:0 1px 5px rgba(0,0,0,0.5);';
    eHdr.appendChild(badge);

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = b.titolo || '';
    titleInput.placeholder = 'Titolo del libro...';
    titleInput.style.cssText = 'flex:1;background:transparent;border:none;outline:none;' +
      'font-family:"Cinzel",serif;font-size:20px;font-weight:700;color:var(--text-primary);letter-spacing:0.04em;';
    titleInput.oninput = function() {
      _archBooks[id].titolo = titleInput.value;
      _rebuildShelf();
      _schedSave(id);
    };
    eHdr.appendChild(titleInput);

    /* Auto-save indicator */
    var saveInd = document.createElement('span');
    saveInd.style.cssText = 'font-size:10px;color:rgba(245,166,35,0.5);letter-spacing:0.08em;white-space:nowrap;';
    saveInd.textContent = 'Salvataggio automatico';
    eHdr.appendChild(saveInd);

    var delBtn = document.createElement('button');
    delBtn.title = 'Elimina libro';
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
    delBtn.style.cssText = 'background:transparent;border:1px solid rgba(200,70,70,0.35);border-radius:6px;' +
      'color:rgba(200,70,70,0.65);cursor:pointer;padding:0.35rem 0.55rem;transition:all 0.15s;display:flex;align-items:center;flex-shrink:0;';
    delBtn.onmouseenter = function() { delBtn.style.background='rgba(200,70,70,0.14)'; delBtn.style.color='#e05555'; };
    delBtn.onmouseleave = function() { delBtn.style.background='transparent'; delBtn.style.color='rgba(200,70,70,0.65)'; };
    delBtn.onclick = function() {
      if (!confirm('Eliminare "' + (_archBooks[id]&&_archBooks[id].titolo||'Senza titolo') + '"?')) return;
      _archRef.child(id).remove();
      delete _archBooks[id];
      _archSelId = null;
      _rebuildShelf();
      editorPanel.innerHTML = '';
      editorPanel.appendChild(emptyState);
    };
    eHdr.appendChild(delBtn);
    editorPanel.appendChild(eHdr);

    /* — Editor body — */
    var eBody = document.createElement('div');
    eBody.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;padding:1.25rem 1.5rem 1rem;gap:0.85rem;';
    editorPanel.appendChild(eBody);

    /* Main textarea */
    var ta = document.createElement('textarea');
    ta.value = b.contenuto || '';
    ta.placeholder = 'Scrivi qui le tue idee, trame, piani, note segrete...\n\nNessuno potrà leggere questo archivio a parte te.';
    ta.style.cssText = 'flex:1;width:100%;box-sizing:border-box;resize:none;padding:1.1rem 1.3rem;' +
      'background:var(--bg-card);border:1px solid var(--border-gold);border-radius:8px;' +
      'color:var(--text-primary);font-size:15px;line-height:1.75;font-family:inherit;outline:none;' +
      'transition:border-color 0.15s;min-height:0;';
    ta.onfocus = function() { ta.style.borderColor='var(--accent-gold)'; };
    ta.onblur = function() { ta.style.borderColor='var(--border-gold)'; };
    ta.oninput = function() {
      _archBooks[id].contenuto = ta.value;
      _schedSave(id);
    };
    eBody.appendChild(ta);

    /* Image strip */
    var imgStrip = document.createElement('div');
    imgStrip.style.cssText = 'flex-shrink:0;';

    var imgBar = document.createElement('div');
    imgBar.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;';
    var imgLbl = document.createElement('span');
    imgLbl.style.cssText = 'font-family:"Cinzel",serif;font-size:10px;letter-spacing:0.14em;color:var(--text-muted);';
    imgLbl.textContent = 'IMMAGINI';
    imgBar.appendChild(imgLbl);

    var imgFileInput = document.createElement('input');
    imgFileInput.type = 'file';
    imgFileInput.accept = 'image/*';
    imgFileInput.style.display = 'none';

    var imgUpBtn = document.createElement('button');
    imgUpBtn.textContent = '+ Aggiungi Immagine';
    imgUpBtn.style.cssText = 'font-size:10px;padding:0.25rem 0.6rem;border-radius:5px;cursor:pointer;' +
      'background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.3);' +
      'color:rgba(245,166,35,0.8);font-family:"Cinzel",serif;letter-spacing:0.06em;transition:all 0.15s;';
    imgUpBtn.onmouseenter = function() { imgUpBtn.style.background='rgba(245,166,35,0.18)'; };
    imgUpBtn.onmouseleave = function() { imgUpBtn.style.background='rgba(245,166,35,0.08)'; };
    imgUpBtn.onclick = function() { imgFileInput.click(); };

    imgFileInput.onchange = function() {
      var f = imgFileInput.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function(ev) {
        if (!_archBooks[id].immagini) _archBooks[id].immagini = [];
        _archBooks[id].immagini.push(ev.target.result);
        _schedSave(id);
        _renderImgGrid();
      };
      rd.readAsDataURL(f);
      imgFileInput.value = '';
    };

    imgBar.appendChild(imgUpBtn);
    imgBar.appendChild(imgFileInput);
    imgStrip.appendChild(imgBar);

    var imgGrid = document.createElement('div');
    imgGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;max-height:130px;overflow-y:auto;';
    imgStrip.appendChild(imgGrid);
    eBody.appendChild(imgStrip);

    function _renderImgGrid() {
      imgGrid.innerHTML = '';
      var imgs = (_archBooks[id] && _archBooks[id].immagini) || [];
      if (!imgs.length) { imgGrid.style.display='none'; return; }
      imgGrid.style.display='flex';
      imgs.forEach(function(src, idx) {
        var cell = document.createElement('div');
        cell.style.cssText = 'position:relative;';
        var img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'width:110px;height:110px;object-fit:cover;border-radius:6px;' +
          'border:1px solid var(--border-gold);cursor:zoom-in;display:block;';
        img.onclick = function() { window.open(src,'_blank'); };
        var xBtn = document.createElement('button');
        xBtn.textContent = '✕';
        xBtn.style.cssText = 'position:absolute;top:3px;right:3px;width:19px;height:19px;' +
          'border-radius:50%;background:rgba(0,0,0,0.75);border:none;color:#fff;font-size:9px;' +
          'cursor:pointer;line-height:19px;text-align:center;padding:0;';
        xBtn.onclick = function(e) {
          e.stopPropagation();
          _archBooks[id].immagini.splice(idx,1);
          _schedSave(id);
          _renderImgGrid();
        };
        cell.appendChild(img);
        cell.appendChild(xBtn);
        imgGrid.appendChild(cell);
      });
    }
    _renderImgGrid();

    setTimeout(function() { ta.focus(); }, 60);
  }

  /* Add book */
  addBookBtn.onclick = function() {
    var id = 'libro_' + Date.now();
    var nb = { id: id, titolo: 'Nuovo Libro', contenuto: '', immagini: [] };
    _archBooks[id] = nb;
    _archRef.child(id).set(nb);
    _archSelId = id;
    _rebuildShelf();
    _openEditor(id);
  };

  /* Load books from Firebase */
  var _archLive = null;
  _archRef.once('value', function(snap) {
    var v = snap.val();
    _archBooks = (v && typeof v === 'object') ? v : {};
    // Ensure immagini is always array
    Object.keys(_archBooks).forEach(function(k) {
      if (!_archBooks[k].immagini) _archBooks[k].immagini = [];
    });
    _rebuildShelf();
    editorPanel.appendChild(emptyState);

    /* Live listener for changes from other sessions */
    _archLive = _archRef.on('value', function(snap2) {
      var v2 = snap2.val();
      var remote = (v2 && typeof v2 === 'object') ? v2 : {};
      /* Add new books from remote, don't override current in-editor book */
      Object.keys(remote).forEach(function(k) {
        if (k !== _archSelId && !_archBooks[k]) {
          _archBooks[k] = remote[k];
          if (!_archBooks[k].immagini) _archBooks[k].immagini = [];
        }
      });
      /* Remove deleted books */
      Object.keys(_archBooks).forEach(function(k) {
        if (!remote[k] && k !== _archSelId) delete _archBooks[k];
      });
      _rebuildShelf();
    });
  });

  /* Cleanup when leaving section */
  _sectionCleanup = function() {
    if (_archLive) { _archRef.off('value', _archLive); _archLive = null; }
    if (_archSaveTimer) {
      clearTimeout(_archSaveTimer);
      if (_archSelId && _archBooks[_archSelId]) _archRef.child(_archSelId).set(_archBooks[_archSelId]);
    }
  };

  return wrap;
}

window.state = state;
window.render = render;
window.renderMain = renderMain;
window.doSignIn = doSignIn;
window.doSignOut = doSignOut;
window.toggleCreateAccount = toggleCreateAccount;
window.doCreateAccount = doCreateAccount;
window.notify = notify;
