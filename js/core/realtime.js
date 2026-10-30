/**
 * ============================================================================
 * SINCRONIZZAZIONE REALTIME DEL COMPENDIUM
 * ============================================================================
 * NOTA: Tutta la gestione Utenti, Account, Ruoli, Login e Impostazioni è
 * unificata nel modulo dedicato `js/users.js` (window.UserManager).
 * ============================================================================
 */
'use strict';

/* ---- Listener realtime per sincronizzare lo state ---- */

// _localWrite: true mentre stiamo noi scrivendo su Firebase.
// Il listener lo legge e salta il re-render per non disturbare chi scrive.
var _localWrite = {
  iniziativa: false,
  caos: false,
  armi: false,
  bestiario: false,
  incantesimiAggiuntivi: false,
};

/* ============================================================================
   SEZIONE 1: SINCRONIZZAZIONE FIREBASE REALTIME & SALVATAGGIO CLOUD
   ============================================================================ */
function setupRealtimeListeners() {
  if (!_campaignDb || setupRealtimeListeners.started) return;
  setupRealtimeListeners.started = true;

  // ---- INIZIATIVA ----
  _campaignDb.ref('state/iniziativa').on('value', function (snap) {
    if (_localWrite.iniziativa) return;
    var v = snap.val();
    if (v && v.combatants && Array.isArray(v.combatants) && v.combatants.length > 0) {
      state.combatants = v.combatants.map(function (c) {
        if (!Array.isArray(c.condizioni)) c.condizioni = [];
        return c;
      });
      if (typeof v.round === 'number') state.round = v.round;
      if (typeof v.activeIndex === 'number') state.activeIndex = v.activeIndex;
    } else {
      if (state.combatants.length === 0) state.combatants = [makeEmptyCombatant()];
    }
    if (state.section === 'iniziativa') {
      ensureTrailingEmpty();
      renderIniziativaBody();
    } else ensureTrailingEmpty();
  });

  // ---- CAOS ----
  _campaignDb.ref('state/caos/players').on('value', function (snap) {
    if (_localWrite.caos) return;
    var v = snap.val();
    if (v && Array.isArray(v)) {
      state.caosPlayers = v;
      if (state.section === 'caos') renderCaosBody();
    }
  });
  _campaignDb.ref('state/caos/doom').on('value', function (snap) {
    if (_localWrite.caos) return;
    var v = snap.val();
    if (v) {
      if (typeof v.doomStage === 'number') state.doomStage = v.doomStage;
      if (typeof v.doomFilled === 'number') state.doomFilled = v.doomFilled;
      if (state.section === 'caos') renderDoomWheel();
    }
  });

  // ---- BACHECA ----
  _campaignDb.ref('state/bacheca/items').on('value', function (snap) {
    var v = snap.val();
    if (v && typeof v === 'object')
      state.bacheItems = Object.keys(v).map(function (k) {
        return Object.assign({ id: k }, v[k]);
      });
    else state.bacheItems = [];
    if (state.section === 'bacheca') {
      var grid = document.querySelector('.bacheca-grid');
      if (grid) renderBacheGrid(grid);
    }
  });

  // ---- PERSONAGGI NPC ----
  _campaignDb.ref('state/personaggi').on('value', function (snap) {
    var v = snap.val();
    if (v && Array.isArray(v)) {
      state.personaggi = v;
      if (state.section === 'generatore' || state.section === 'storia') scheduleRenderMain();
    }
  });

  // ---- SCHEDE PG ----
  if (isDM())
    _campaignDb.ref('schedePG').on('value', function (snap) {
      state.schedePGAll = snap.val() || {};

      if (state.section === 'schedepg') scheduleRenderMain();
    });

  // ---- DELETED LISTS (admin) ----
  // NOTA: il listener bestiario è annidato qui dentro per garantire che bestiarioDeleted
  // sia caricato PRIMA della merge SRD (evita race condition che riaggiungeva mostri eliminati)
  _campaignDb.ref('state/bestiarioDeleted').once('value', function (snap) {
    var v = snap.val();
    if (v && Array.isArray(v)) state.bestiarioDeleted = v;

    // ---- BESTIARIO CUSTOM ----
    _campaignDb.ref('state/bestiario').on('value', function (snap) {
      if (_localWrite.bestiario) return;
      var v = snap.val();
      var existing = v && Array.isArray(v) ? v : [];
      // Deduplica existing per nome (tiene il primo, rimuove i doppi da Firebase)
      var seenDup = {};
      existing = existing.filter(function (x) {
        var k = (x.nome || '').toLowerCase();
        if (seenDup[k]) return false;
        seenDup[k] = 1;
        return true;
      });
      var nomi = {};
      existing.forEach(function (x) {
        nomi[(x.nome || '').toLowerCase()] = 1;
      });
      // Aggiorna immagini SRD esistenti che hanno immagine vuota
      var srdBById = {};
      (typeof SRD_BESTIARIO !== 'undefined' ? SRD_BESTIARIO : []).forEach(function (x) {
        if (x.id) srdBById[x.id] = x;
      });
      var bImgChanged = false;
      existing = existing.map(function (x) {
        var srd = x.id && srdBById[x.id] ? srdBById[x.id] : null;
        if (!srd) return x;
        // Se SRD ha versione _v più alta, sostituisce i dati Firebase (aggiornamento mostri)
        if (srd._v && (!x._v || srd._v > x._v)) {
          bImgChanged = true;
          return Object.assign({}, srd, { id: x.id });
        }
        // Aggiorna immagine vuota
        if (!x.immagine && srd.immagine) {
          bImgChanged = true;
          return Object.assign({}, x, { immagine: srd.immagine });
        }
        return x;
      });
      var _deleted = state.bestiarioDeleted || [];
      // Migrazione: rimuovi entry duplicate SRD aggiunte con nomi diversi dagli originali
      var _dupIds = [
        'srd_b_258',
        'srd_b_267',
        'srd_b_323',
        'srd_b_324',
        'srd_b_325',
        'srd_b_326',
        'srd_b_333',
        'srd_b_346',
        'srd_b_348',
        'srd_b_356',
        'srd_b_358',
        'srd_b_360',
        'srd_b_361',
        'srd_b_362',
      ];
      var _lenBefore = existing.length;
      existing = existing.filter(function (x) {
        return _dupIds.indexOf(x.id) < 0;
      });
      var migChanged = existing.length < _lenBefore;
      if (migChanged) {
        nomi = {};
        existing.forEach(function (x) {
          nomi[(x.nome || '').toLowerCase()] = 1;
        });
        var _newDel = _dupIds.filter(function (id) {
          return _deleted.indexOf(id) < 0;
        });
        if (_newDel.length) {
          _deleted = _deleted.concat(_newDel);
          state.bestiarioDeleted = _deleted;
          if (isDM()) _campaignDb.ref('state/bestiarioDeleted').set(_deleted);
        }
      }
      // Costruisce set di nomi eliminati (da voci "nome:xxx" in bestiarioDeleted)
      var _deletedNomi = {};
      _deleted.forEach(function (x) {
        if (x && x.indexOf('nome:') === 0) _deletedNomi[x.slice(5)] = 1;
      });
      var toAdd = (typeof SRD_BESTIARIO !== 'undefined' ? SRD_BESTIARIO : []).filter(function (x) {
        var nl = (x.nome || '').toLowerCase();
        return !nomi[nl] && _deleted.indexOf(x.id) < 0 && !_deletedNomi[nl];
      });
      if (toAdd.length || bImgChanged || migChanged) {
        var merged = existing.concat(toAdd).sort(function (a, b) {
          return (a.nome || '').localeCompare(b.nome || '', 'it');
        });
        if (isDM()) {
          _localWrite.bestiario = true;
          _campaignDb.ref('state/bestiario').set(merged, function () {
            _localWrite.bestiario = false;
          });
        }
        state.bestiario = merged;
      } else {
        state.bestiario = existing;
      }
      if (state.section === 'bestiario') scheduleRenderMain();
    });
  }); // fine bestiarioDeleted.once

  _campaignDb.ref('state/armiDeleted').once('value', function (snap) {
    var v = snap.val();
    if (v && Array.isArray(v)) state.armiDeleted = v;
  });

  // ---- ARMI ----
  _campaignDb.ref('state/armi').on('value', function (snap) {
    if (_localWrite.armi) return;
    var v = snap.val();
    var existing =
      v && Array.isArray(v) ? v : typeof SRD_OGGETTI !== 'undefined' ? SRD_OGGETTI.slice() : [];

    // Aggiorna immagini SRD esistenti che hanno immagine vuota
    var srdById = {};
    var srdByName = {};
    (typeof SRD_OGGETTI !== 'undefined' ? SRD_OGGETTI : []).forEach(function (x) {
      if (x.id) srdById[x.id] = x;
      if (x.nome) srdByName[x.nome.trim().toLowerCase()] = x;
    });
    var imgChanged = false;
    existing = existing.map(function (x) {
      var srd = (x.id && srdById[x.id]) || (x.nome && srdByName[x.nome.trim().toLowerCase()]);
      if (srd && srd.immagine) {
        if (!x.immagine || (srd.immagine.indexOf('img/') === 0 && x.immagine !== srd.immagine)) {
          imgChanged = true;
          return Object.assign({}, x, { immagine: srd.immagine });
        }
      }
      return x;
    });

    var seen = {};
    var deduped = [];
    var dedupChanged = false;
    existing.forEach(function (w) {
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

    if (imgChanged && isDM()) {
      _localWrite.armi = true;
      _campaignDb.ref('state/armi').set(existing, function () {
        _localWrite.armi = false;
      });
    }
    state.armi = existing;
    if (state.section === 'emporio') updateResults();
  });

  // ---- IMPIANTI CIBERNETICI ----
  _campaignDb.ref('state/impianti').on('value', function (snap) {
    var v = snap.val();
    if (v && Array.isArray(v)) {
      state.impiantiCibernetici = v;
      if (state.section === 'emporio' && state.emporioTab === 'cyber') scheduleRenderMain();
    }
  });

  // ---- DROGHE ----
  _campaignDb.ref('state/droghe').on('value', function (snap) {
    var v = snap.val();
    state.droghe = v && Array.isArray(v) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'droghe') scheduleRenderMain();
  });

  // ---- VEICOLI ----
  _campaignDb.ref('state/veicoli').on('value', function (snap) {
    var v = snap.val();
    state.veicoli = v && Array.isArray(v) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'veicoli') scheduleRenderMain();
  });

  // ---- VEICOLI PARTY ----
  _campaignDb.ref('state/veicoliParty').on('value', function (snap) {
    var v = snap.val();
    state.veicoliParty = v && Array.isArray(v) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'veicoli') scheduleRenderMain();
  });

  // ---- ARMI DA FUOCO ----
  _campaignDb.ref('state/armiFuoco').on('value', function (snap) {
    var v = snap.val();
    state.armiDaFuoco = v && Array.isArray(v) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'armifuoco') scheduleRenderMain();
  });
  _campaignDb.ref('state/armiFuocoPotenziamenti').on('value', function (snap) {
    var v = snap.val();
    state.potenziamenti = v && Array.isArray(v) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'armifuoco') scheduleRenderMain();
  });
  _campaignDb.ref('state/armiFuocoMunizioni').on('value', function (snap) {
    var v = snap.val();
    state.munizioniArmi = v && Array.isArray(v) ? v : [];
    if (state.section === 'emporio' && state.emporioTab === 'armifuoco') scheduleRenderMain();
  });

  // ---- NOTE ----
  _campaignDb.ref('state/notes').on('value', function (snap) {
    var v = snap.val();
    if (typeof v === 'string' && v !== state.notes) {
      state.notes = v;
      var ta = document.getElementById('notes-area');
      if (ta && document.activeElement !== ta) ta.value = v;
    }
  });

  // Account e revoca delle sessioni sono gestiti solo da UserManager.
  UserManager.watchUsers();

  // ---- PRESENCE ----
  _campaignDb.ref('presence').on('value', function (snap) {
    _presenceMap = snap.val() || {};
    var settEl = document.getElementById('settings-overlay');
    if (settEl) {
      settEl.remove();
      renderSettingsPanel();
    }
  });

  _campaignDb.ref('state/pet').on('value', function (snap) {
    state.pet = Array.isArray(snap.val()) ? snap.val() : [];
    if (state.section === 'bestiario') scheduleRenderMain();
  });

  _campaignDb.ref('state/incantesimiAggiuntivi').on('value', function (snap) {
    if (_localWrite.incantesimiAggiuntivi) return;
    var v = snap.val();
    var existing = v && Array.isArray(v) ? v : [];
    // Dedup existing per nome; rimuovi 'Mending' se 'Riparare' esiste in SRD
    var srdSpNames = {};
    (typeof SRD_INCANTESIMI !== 'undefined' ? SRD_INCANTESIMI : []).forEach(function (x) {
      if (x.nome) srdSpNames[(x.nome || '').toLowerCase()] = 1;
    });
    var seenSpDup = {};
    existing = existing.filter(function (x) {
      var k = (x.nome || '').toLowerCase();
      // Rimuovi 'mending' e altri alias inglesi già presenti in SRD italiano
      var ALIAS = {
        mending: 'riparare',
        repair: 'riparare',
        'mage hand': 'mano magica',
        prestidigitation: 'prestidigitazione',
        'minor illusion': 'illusione minore',
      };
      if (ALIAS[k] && srdSpNames[ALIAS[k]]) return false;
      if (seenSpDup[k]) return false;
      seenSpDup[k] = 1;
      return true;
    });
    var srdArr = typeof SRD_INCANTESIMI !== 'undefined' ? SRD_INCANTESIMI : [];
    var srdByName = {};
    srdArr.forEach(function (x) {
      if (x.nome) srdByName[(x.nome || '').toLowerCase()] = x;
    });
    var nomi = {};
    existing.forEach(function (x) {
      nomi[(x.nome || '').toLowerCase()] = 1;
    });
    var toAdd = srdArr.filter(function (x) {
      return !nomi[(x.nome || '').toLowerCase()];
    });
    // Aggiorna descrizione/altiLivelli degli incantesimi SRD già presenti in Firebase
    var needsUpdate = false;
    existing = existing.map(function (x) {
      var srd = srdByName[(x.nome || '').toLowerCase()];
      if (!srd || !srd.id || (srd.id + '').indexOf('srd_sp_') !== 0) return x;
      var changed = false;
      var upd = {};
      if (srd.descrizione && x.descrizione !== srd.descrizione) {
        upd.descrizione = srd.descrizione;
        changed = true;
      }
      if (srd.altiLivelli !== undefined && x.altiLivelli !== srd.altiLivelli) {
        upd.altiLivelli = srd.altiLivelli;
        changed = true;
      }
      if (srd.componenti && JSON.stringify(x.componenti) !== JSON.stringify(srd.componenti)) {
        upd.componenti = srd.componenti;
        changed = true;
      }
      if (srd.valMateria !== undefined && x.valMateria !== srd.valMateria) {
        upd.valMateria = srd.valMateria;
        changed = true;
      }
      if (srd.consumaMateria !== undefined && x.consumaMateria !== srd.consumaMateria) {
        upd.consumaMateria = srd.consumaMateria;
        changed = true;
      }
      if (
        srd.classi &&
        srd.classi.length &&
        JSON.stringify(x.classi) !== JSON.stringify(srd.classi)
      ) {
        upd.classi = srd.classi;
        changed = true;
      }
      if (srd.rituale !== undefined && x.rituale !== srd.rituale) {
        upd.rituale = srd.rituale;
        changed = true;
      }
      if (srd.concentrazione !== undefined && x.concentrazione !== srd.concentrazione) {
        upd.concentrazione = srd.concentrazione;
        changed = true;
      }
      if (changed) {
        needsUpdate = true;
        return Object.assign({}, x, upd);
      }
      return x;
    });
    if (toAdd.length || needsUpdate) {
      var merged = existing.concat(toAdd).sort(function (a, b) {
        return (a.nome || '').localeCompare(b.nome || '', 'it');
      });
      if (isDM()) {
        _localWrite.incantesimiAggiuntivi = true;
        _campaignDb.ref('state/incantesimiAggiuntivi').set(merged, function () {
          _localWrite.incantesimiAggiuntivi = false;
        });
      }
      state.incantesimiAggiuntivi = merged;
    } else {
      state.incantesimiAggiuntivi = existing;
    }
    if (state.section === 'incantesimi') scheduleRenderMain();
  });

  // ---- WORLDBUILDING: agganciato dentro il listener mappa (vedi sotto) ----

  // ---- DICE ROLLS ----
  _campaignDb
    .ref('diceRolls')
    .limitToLast(15)
    .on('value', function (snap) {
      var rolls = [];
      snap.forEach(function (child) {
        rolls.unshift(child.val());
      });
      state.diceHistory = rolls;
      var histList = document.querySelector('.dice-history-list');
      if (histList) updateDiceHistory(histList);
    });

  // ---- MAPPA DEL MONDO ----
  _attachMappaListener();

  // ---- STORIA MARKERS (privati per DM, per mappa) ----
  var _smListenerUser = state.currentUser && state.currentUser.username;
  if (_smListenerUser) {
    _campaignDb.ref('state/storia_markers/' + _smListenerUser).on('value', function (snap) {
      window._storiaMarkersCache = snap.val() || {};
      var mid = state.mappaActiveId || 'default';
      state.storia.markers =
        window._storiaMarkersCache[mid] && typeof window._storiaMarkersCache[mid] === 'object'
          ? window._storiaMarkersCache[mid]
          : {};
      refreshStoriaMarkers();
    });
  }
}

function fbSave(path, value) {
  if (!_campaignDb) return;
  _campaignDb
    .ref(path)
    .set(value)
    .catch(function (e) {
      console.warn('[Firebase] write error:', e.message);
    });
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
  if (!_campaignDb) return;
  _campaignDb.ref('state/personaggi').set(state.personaggi.length > 0 ? state.personaggi : null);
}

/* Salva chiavi API su Firebase — persistenti su qualsiasi dominio/dispositivo */
function fbSaveApiKeys() {
  if (!_campaignDb || !isDM()) return;
  _campaignDb.ref('dmConfig/apiKeys').set({
    geminiKey: state.geminiKey || '',
    groqKey: state.groqKey || '',
  });
}

/* Carica chiavi API da Firebase (priorità su localStorage) */
function fbLoadApiKeys() {
  if (!_campaignDb || !isDM()) return;
  _campaignDb.ref('dmConfig/apiKeys').once('value', function (snap) {
    var v = snap.val();
    if (!v) return;
    if (v.geminiKey) state.geminiKey = v.geminiKey;
    if (v.groqKey) state.groqKey = v.groqKey;
    saveToStorage();
  });
}

function fbSaveBestiario() {
  if (!_campaignDb) return;
  _localWrite.bestiario = true;
  _campaignDb
    .ref('state/bestiario')
    .set(state.bestiario.length > 0 ? state.bestiario : null, function () {
      setTimeout(function () {
        _localWrite.bestiario = false;
      }, 300);
    });
}
function fbSaveBestiarioDeleted() {
  if (!_campaignDb) return;
  _campaignDb
    .ref('state/bestiarioDeleted')
    .set(state.bestiarioDeleted.length > 0 ? state.bestiarioDeleted : null);
}
function fbSaveArmiDeleted() {
  if (!_campaignDb) return;
  _campaignDb.ref('state/armiDeleted').set(state.armiDeleted.length > 0 ? state.armiDeleted : null);
}
function fbSavePet() {
  if (!_campaignDb) return;
  _campaignDb.ref('state/pet').set(state.pet.length > 0 ? state.pet : null);
}
function fbSaveIncantesimiAggiuntivi() {
  if (!_campaignDb) return;
  _campaignDb
    .ref('state/incantesimiAggiuntivi')
    .set(state.incantesimiAggiuntivi.length > 0 ? state.incantesimiAggiuntivi : null);
}

/* ===== SCHEDA PERSONAGGIO — Firebase ===== */
function _spellList(n) {
  var a = [];
  for (var i = 0; i < n; i++) a.push({ nome: '', prep: false });
  return a;
}
function _schedaDefault() {
  return {
    nomePersonaggio: '',
    classelivello: '',
    background: '',
    nomeGiocatore: '',
    razza: '',
    allineamento: '',
    pe: '',
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
    skAcrobazia: false,
    skAnimali: false,
    skArcano: false,
    skAtletica: false,
    skFurtivita: false,
    skIndagare: false,
    skInganno: false,
    skIntimidire: false,
    skIntrattenere: false,
    skIntuizione: false,
    skMedicina: false,
    skNatura: false,
    skPercezione: false,
    skPersuasione: false,
    skRapidita: false,
    skReligione: false,
    skSopravvivenza: false,
    skStoria: false,
    skTecnologia: false,
    ispirazione: false,
    bonusCompetenza: 2,
    ca: '',
    iniziativa: '',
    velocita: '',
    hpMax: '',
    hpAttuali: '',
    hpTemp: '',
    dadiVita: '',
    successi: [false, false, false],
    fallimenti: [false, false, false],
    attacchi: [
      { nome: '', bonus: '', danni: '' },
      { nome: '', bonus: '', danni: '' },
      { nome: '', bonus: '', danni: '' },
    ],
    trattiCar: '',
    ideali: '',
    legami: '',
    difetti: '',
    altreCompetenze: '',
    equipaggiamento: '',
    privilegi: '',
    rame: '',
    argento: '',
    oro: '',
    platino: '',
    crediti: '',
    livelloFollia: 0,
    eta: '',
    altezza: '',
    peso: '',
    occhi: '',
    carnagione: '',
    capelli: '',
    aspettoDesc: '',
    aspettoImg: '',
    alleatiOrg: '',
    nomeOrg: '',
    storia: '',
    trattiAgg: '',
    tesoro: '',
    classInc: '',
    carInc: '',
    cdTs: '',
    bonusAtkInc: '',
    trucchetti: ['', '', '', '', '', '', '', ''],
    sp1: { slots: '', spesi: '', lista: _spellList(13) },
    sp2: { slots: '', spesi: '', lista: _spellList(13) },
    sp3: { slots: '', spesi: '', lista: _spellList(13) },
    sp4: { slots: '', spesi: '', lista: _spellList(13) },
    sp5: { slots: '', spesi: '', lista: _spellList(13) },
    sp6: { slots: '', spesi: '', lista: _spellList(9) },
    sp7: { slots: '', spesi: '', lista: _spellList(9) },
    sp8: { slots: '', spesi: '', lista: _spellList(7) },
    sp9: { slots: '', spesi: '', lista: _spellList(7) },
  };
}
function _schedaFix(raw) {
  if (!raw || typeof raw !== 'object') return _schedaDefault();
  var out = Object.assign(_schedaDefault(), raw);
  if (!Array.isArray(out.successi) || out.successi.length !== 3)
    out.successi = [false, false, false];
  if (!Array.isArray(out.fallimenti) || out.fallimenti.length !== 3)
    out.fallimenti = [false, false, false];
  if (!Array.isArray(out.trucchetti) || out.trucchetti.length < 8)
    out.trucchetti = ['', '', '', '', '', '', '', ''];
  if (!Array.isArray(out.attacchi) || out.attacchi.length < 3)
    out.attacchi = [
      { nome: '', bonus: '', danni: '' },
      { nome: '', bonus: '', danni: '' },
      { nome: '', bonus: '', danni: '' },
    ];
  [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (l) {
    var k = 'sp' + l,
      n = l <= 5 ? 13 : l <= 7 ? 9 : 7;
    var src = raw[k];
    var def = { slots: '', spesi: '', lista: _spellList(n) };
    if (!src || typeof src !== 'object') {
      out[k] = def;
      return;
    }
    out[k] = { slots: src.slots || '', spesi: src.spesi || '', lista: _spellList(n) };
    if (Array.isArray(src.lista))
      src.lista.forEach(function (sp, i) {
        if (i < n) out[k].lista[i] = Object.assign({ nome: '', prep: false }, sp);
      });
  });
  return out;
}
var _schedaSaveTimer = null;
function fbSaveScheda(immediate) {
  if (
    !_campaignDb ||
    !state.currentUser ||
    !state.schedaAttivaId ||
    !state.scheda ||
    Object.keys(state.scheda).length === 0
  )
    return;
  clearTimeout(_schedaSaveTimer);
  var _sid = state.schedaAttivaId;
  var snapshot = JSON.parse(JSON.stringify(state.scheda));
  delete snapshot.id;
  if (snapshot.schedaTipo === 'pokemon') console.log('[POKEMON SAVE] Payload inviato:', snapshot);
  if (snapshot.schedaTipo === 'naruto') console.log('[NARUTO SAVE] Payload inviato:', snapshot);
  var doSave = function () {
    _schedaSaveTimer = null;
    _campaignDb.ref('schedePG/' + state.currentUser.username + '/chars/' + _sid).set(snapshot);
    var _idx = state.schedeList.findIndex(function (s) {
      return s.id === _sid;
    });
    if (_idx >= 0) {
      state.schedeList[_idx] = JSON.parse(JSON.stringify(snapshot));
      state.schedeList[_idx].id = _sid;
    }
  };
  if (immediate === true) doSave();
  else _schedaSaveTimer = setTimeout(doSave, 600);
}
function fbLoadSchede(cb) {
  if (!_campaignDb || !state.currentUser) {
    state.schedeList = [];
    state.companions = {};
    state.schedaLoaded = true;
    if (cb) cb();
    return;
  }
  _campaignDb.ref('schedePG/' + state.currentUser.username).once('value', function (snap) {
    var raw = snap.val();
    if (!raw) {
      state.schedeList = [];
      state.companions = {};
      state.schedaLoaded = true;
      if (cb) cb();
      return;
    }
    if (raw._v2) {
      var chars = raw.chars || {};

      state.schedeList = Object.keys(chars).map(function (k) {
        return Object.assign(_schedaFix(chars[k]), { id: k });
      });

      // --- CLEANUP TROLL CHARACTERS ---
      state.schedeList.forEach(function (c) {
        if (c.nome && c.nome.includes('iiiiiiiii')) {
          _campaignDb.ref('schedePG/' + state.currentUser.username + '/chars/' + c.id).remove();
        }
      });

      // --- CLEANUP TROLL E BRANCALONIA VECCHIE ---
      state.schedeList.forEach(function (c) {
        if (
          c.schedaTipo === 'brancalonia' &&
          (!c.branca_data || Object.keys(c.branca_data).length === 0)
        ) {
          _campaignDb.ref('schedePG/' + state.currentUser.username + '/chars/' + c.id).remove();
        }
      });
      state.schedeList = state.schedeList.filter(function (c) {
        return !(
          c.schedaTipo === 'brancalonia' &&
          (!c.branca_data || Object.keys(c.branca_data).length === 0)
        );
      });
      // --------------------------------

      // --------------------------------

      state.companions = raw.companions || {};
      state.schedaLoaded = true;
      if (cb) cb();
    } else {
      var newId = 'c' + Date.now();
      var oldFix = _schedaFix(raw);
      var upd = { _v2: true };
      upd['chars/' + newId] = oldFix;
      _campaignDb.ref('schedePG/' + state.currentUser.username).update(upd, function () {
        state.schedeList = [Object.assign({}, oldFix, { id: newId })];
        state.companions = {};
        state.schedaLoaded = true;
        if (cb) cb();
      });
    }
  });
}
function fbSaveCompanion(charId, comp) {
  if (!_campaignDb || !state.currentUser || !charId || !comp.id) return;
  var data = Object.assign({}, comp);
  delete data.id;
  _campaignDb
    .ref('schedePG/' + state.currentUser.username + '/companions/' + charId + '/' + comp.id)
    .set(data);
}
function fbDeleteCompanion(charId, compId) {
  if (!_campaignDb || !state.currentUser) return;
  _campaignDb
    .ref('schedePG/' + state.currentUser.username + '/companions/' + charId + '/' + compId)
    .remove();
}
function fbDeleteSchedaItem(id) {
  if (!_campaignDb || !state.currentUser) return;
  _campaignDb.ref('schedePG/' + state.currentUser.username + '/chars/' + id).remove();
}
function updateSchedaDerived() {
  var s = state.scheda,
    bc = parseInt(s.bonusCompetenza) || 2;
  function m(v) {
    return Math.floor(((parseInt(v) || 10) - 10) / 2);
  }
  function fmt(n) {
    return (n >= 0 ? '+' : '') + n;
  }
  var st = {
    for: m(s.for),
    des: m(s.des),
    cos: m(s.cos),
    int: m(s.int),
    sag: m(s.sag),
    car: m(s.car),
  };
  ['for', 'des', 'cos', 'int', 'sag', 'car'].forEach(function (k) {
    var el = document.getElementById('pd-mod-' + k);
    if (el) el.textContent = fmt(st[k]);
  });
  [
    ['for', 'tsFor'],
    ['des', 'tsDes'],
    ['cos', 'tsCos'],
    ['int', 'tsInt'],
    ['sag', 'tsSag'],
    ['car', 'tsCar'],
  ].forEach(function (p) {
    var el = document.getElementById('pd-ts-' + p[0]);
    if (el) el.textContent = fmt(st[p[0]] + (s[p[1]] ? bc : 0));
  });
  var skMap = [
    ['des', 'skAcrobazia', 'acrobazia'],
    ['sag', 'skAnimali', 'animali'],
    ['int', 'skArcano', 'arcano'],
    ['for', 'skAtletica', 'atletica'],
    ['des', 'skFurtivita', 'furtivita'],
    ['int', 'skIndagare', 'indagare'],
    ['car', 'skInganno', 'inganno'],
    ['car', 'skIntimidire', 'intimidire'],
    ['car', 'skIntrattenere', 'intrattenere'],
    ['sag', 'skIntuizione', 'intuizione'],
    ['sag', 'skMedicina', 'medicina'],
    ['int', 'skNatura', 'natura'],
    ['sag', 'skPercezione', 'percezione'],
    ['car', 'skPersuasione', 'persuasione'],
    ['des', 'skRapidita', 'rapidita'],
    ['int', 'skReligione', 'religione'],
    ['sag', 'skSopravvivenza', 'sopravvivenza'],
    ['int', 'skStoria', 'storia'],
    ['int', 'skTecnologia', 'tecnologia'],
  ];
  skMap.forEach(function (sk) {
    var el = document.getElementById('pd-sk-' + sk[2]);
    if (el) el.textContent = fmt(st[sk[0]] + (s[sk[1]] ? bc * (s[sk[1] + '_m'] ? 2 : 1) : 0));
  });
  var pp = document.getElementById('pd-pass-perc');
  if (pp) pp.textContent = 10 + st.sag + (s.skPercezione ? bc * (s['skPercezione_m'] ? 2 : 1) : 0);
}

var _wbLocalWrite = false;
var _wbListenerRef = null; // riferimento al listener Firebase corrente del worldbuilding

/* ── Mappe / Storia per-utente ─────────────────────────────────────────────
   _mappaViewAsUser : username di cui l'admin sta visualizzando le mappe (null = proprie)
   _storiaViewAsUser: username di cui l'admin sta visualizzando la libreria storie (null = proprie)
   _mappaListenerRef: riferimento al listener Firebase mappa corrente (per poterlo staccare) */
var _mappaViewAsUser = null;
var _storiaViewAsUser = null;
var _mappaListenerRef = null;
var _mappaOwnerMap = {}; // mapId → username proprietario (usato in modalità 'Tutte')

/* Restituisce il path Firebase base per le mappe dell'utente corrente (o di quello visualizzato). */
function _mappaBasePath() {
  if (_mappaViewAsUser === '__multiverso__') return 'state/multiverso/mappa';
  if (_mappaViewAsUser === '__tutte__') {
    var mid = state.mappaActiveId;
    if (mid && _mappaOwnerMap[mid]) return 'users/' + _mappaOwnerMap[mid] + '/mappa';
    return 'state/mappa';
  }
  /* PG: legge la mappa del DM principale (role==='DM'), non la propria */
  if (isPG()) {
    var master = UserManager.getMasterUsername();
    if (master) return 'users/' + master + '/mappa';
    return 'state/mappa';
  }
  /* Ogni utente (admin incluso) salva sotto il proprio username */
  var uid =
    _mappaViewAsUser ||
    (_authUser && _authUser.uid) ||
    (state.currentUser && state.currentUser.username);
  return uid ? 'users/' + uid + '/mappa' : 'state/mappa';
}

/* Restituisce il path Firebase per il worldbuilding di una mappa (segue _mappaViewAsUser). */
function _wbPath(mapId) {
  if (_mappaViewAsUser === '__tutte__') {
    if (mapId && _mappaOwnerMap[mapId])
      return 'users/' + _mappaOwnerMap[mapId] + '/worldbuilding/' + mapId;
    return 'state/worldbuilding/' + mapId;
  }
  var uid =
    _mappaViewAsUser ||
    (_authUser && _authUser.uid) ||
    (state.currentUser && state.currentUser.username);
  return uid ? 'users/' + uid + '/worldbuilding/' + mapId : 'state/worldbuilding/' + mapId;
}

/* Restituisce il path Firebase per la libreria storie da visualizzare. */
function _storieActivePath() {
  if (isAdmin() && _storiaViewAsUser && _storiaViewAsUser !== '__tutte__')
    return 'storie_private/' + _storiaViewAsUser;
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
    var s = localStorage.getItem(LS_KEY);
    if (!s) return null;
    var d = JSON.parse(s);
    if (!d.worldbuilding || !Array.isArray(d.worldbuilding) || !d.worldbuilding.length) return null;
    if (d.worldbuildingMapId && d.worldbuildingMapId !== forMapId) return null;
    return d.worldbuilding;
  } catch (e) {
    return null;
  }
}

function _attachWorldbuildingListener(mapId) {
  if (!_campaignDb) return;
  var mid = mapId || 'default';
  var fbPath = _wbPath(mid);
  // Forza re-attach se il path è cambiato (es. admin cambia utente visualizzato)
  var cacheKey = fbPath;
  if (cacheKey === _lastWbMapId) return;
  _lastWbMapId = cacheKey;
  _wbLocalWrite = false;
  if (_wbListenerRef) {
    _wbListenerRef.off();
    _wbListenerRef = null;
  }

  _wbListenerRef = _campaignDb.ref(fbPath);
  _wbListenerRef.on('value', function (snap) {
    if (_wbLocalWrite) {
      _wbLocalWrite = false;
      return;
    }
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
        _campaignDb.ref(fbPath).set(lsWb);
        notify('Worldbuilding ripristinato correttamente.');
      } else {
        state.worldbuilding = [];
      }
    } else {
      state.worldbuilding = [];
    }
    if (state.section === 'worldbuilding' || state.section === 'storia') scheduleRenderMain();
  });
}

function fbSaveWorldbuilding() {
  if (!_campaignDb) return;
  if (_mappaViewAsUser) return; // non salvare dati altrui
  _wbLocalWrite = true;
  var mid = state.mappaActiveId || 'default';
  _campaignDb.ref(_wbPath(mid)).set(state.worldbuilding.length > 0 ? state.worldbuilding : null);
}

/* Attacca (o ri-attacca) il listener Firebase per le mappe dell'utente corrente/visualizzato.
   Chiamata all'init e quando l'admin cambia utente da visualizzare. */
function _attachMappaListener() {
  if (!_campaignDb) return;
  if (_mappaListenerRef) {
    _mappaListenerRef.off();
    _mappaListenerRef = null;
  }
  // Reset stato mappa prima di caricare nuovi dati
  state.mappaList = {};
  state.mappaActiveId = '';
  state.mappaUrl = '';
  state.mappaFlags = {};
  _lastWbMapId = null;
  _mappaOwnerMap = {};

  if (_mappaViewAsUser === '__tutte__') {
    // Modalità "Tutte le mappe": aggrega da tutti gli utenti con letture singole
    var _tPaths = [
      { path: 'state/mappa', owner: null },
      { path: 'state/multiverso/mappa', owner: '__multiverso__' },
    ]; // legacy e multiverso
    var _tSeen = {};
    // Path personale dell'admin corrente
    var _myUid = _authUser && _authUser.uid;
    if (_myUid) {
      _tPaths.push({ path: 'users/' + _myUid + '/mappa', owner: _myUid });
      _tSeen[_myUid] = true;
    }
    if (CampaignManager.profiles() && typeof CampaignManager.profiles() === 'object') {
      Object.keys(CampaignManager.profiles()).forEach(function (uid) {
        if (!_tSeen[uid]) {
          _tPaths.push({ path: 'users/' + uid + '/mappa', owner: uid });
          _tSeen[uid] = true;
        }
      });
    }
    var _tDone = 0;
    _tPaths.forEach(function (p) {
      _campaignDb.ref(p.path).once('value', function (snap) {
        var v = snap.val();
        if (v && v.maps && typeof v.maps === 'object') {
          Object.keys(v.maps).forEach(function (mid) {
            state.mappaList[mid] = v.maps[mid];
            if (p.owner) _mappaOwnerMap[mid] = p.owner;
          });
        }
        _tDone++;
        if (_tDone === _tPaths.length) {
          state.mappaList['world-map-ohara'] = {
            nome: 'Mappa Mondiale Completa (Library of Ohara)',
            url: 'iframe',
            flags: {},
            isInteractive: true,
          };
          state.mappaList['naruto-world-map'] = {
            nome: 'Naruto',
            url: 'iframe',
            flags: {},
            isInteractive: true,
          };
          var keys = Object.keys(state.mappaList);
          if (keys.length > 0) {
            state.mappaActiveId = keys[0];
            var am = state.mappaList[state.mappaActiveId];
            if (am) {
              state.mappaUrl = am.url || '';
              state.mappaFlags = am.flags || {};
            }
            _attachWorldbuildingListener(state.mappaActiveId);
          }
          if (state.section === 'mappa') scheduleRenderMain();
        }
      });
    });
    return;
  }

  /* PG: usa _mappaViewAsUser se già scelto, altrimenti trova il DM principale */
  if (isPG()) {
    var _pgDoAttach = function (dmKey) {
      var pgMapPath = dmKey ? 'users/' + dmKey + '/mappa' : 'state/mappa';
      if (_mappaViewAsUser === '__multiverso__') pgMapPath = 'state/multiverso/mappa';
      if (_mappaListenerRef) {
        _mappaListenerRef.off();
        _mappaListenerRef = null;
      }
      _mappaListenerRef = _campaignDb.ref(pgMapPath);
      _mappaListenerRef.on('value', function (snap) {
        var v = snap.val();
        if (v) {
          if (v.maps && typeof v.maps === 'object') state.mappaList = v.maps;
          else if (!v.maps) state.mappaList = state.mappaList || {};
          if (_mappaViewAsUser === '__tutte__' || _mappaViewAsUser === '__multiverso__') {
            state.mappaList['world-map-ohara'] = {
              nome: 'Mappa Mondiale Completa (Library of Ohara)',
              url: 'iframe',
              flags: {},
              isInteractive: true,
            };
            state.mappaList['naruto-world-map'] = {
              nome: 'Naruto',
              url: 'iframe',
              flags: {},
              isInteractive: true,
            };
          } else {
            delete state.mappaList['world-map-ohara'];
            delete state.mappaList['naruto-world-map'];
          }
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
                  if (_leafletMap) {
                    try {
                      _leafletMap.remove();
                    } catch (e) {}
                    _leafletMap = null;
                  }
                  if (state.mappaUrl) initLeafletMap(md, ip);
                  else
                    md.innerHTML =
                      '<div class="mappa-no-img"><div class="mappa-no-img-title">Nessuna mappa caricata da questo DM</div></div>';
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
      var adminKey = UserManager.getMasterUsername();
      if (adminKey) _mappaViewAsUser = adminKey;
      _pgDoAttach(adminKey);
    }
    return;
  }

  _mappaListenerRef = _campaignDb.ref(_mappaBasePath());
  _mappaListenerRef.on('value', function (snap) {
    var v = snap.val();
    if (v) {
      if (v.maps && typeof v.maps === 'object') state.mappaList = v.maps;
      else if (!v.maps) state.mappaList = state.mappaList || {};
      if (_mappaViewAsUser === '__tutte__' || _mappaViewAsUser === '__multiverso__') {
        state.mappaList['world-map-ohara'] = {
          nome: 'Mappa Mondiale Completa (Library of Ohara)',
          url: 'iframe',
          flags: {},
          isInteractive: true,
        };
        state.mappaList['naruto-world-map'] = {
          nome: 'Naruto',
          url: 'iframe',
          flags: {},
          isInteractive: true,
        };
      } else {
        delete state.mappaList['world-map-ohara'];
        delete state.mappaList['naruto-world-map'];
      }

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
                if (_leafletMap) {
                  try {
                    _leafletMap.remove();
                  } catch (e) {}
                  _leafletMap = null;
                }
                if (state.mappaUrl) initLeafletMap(md, ip);
              }
              var sel = document.getElementById('mappa-selector');
              if (sel) {
                sel.value = state.mappaActiveId;
                _refreshMappaSelectorOptions(sel);
              }
            } else {
              refreshMappaFlags();
            }
          }
        }
        if (state.mappaActiveId !== prevMapId && prevMapId !== '') {
          if (state.section === 'storia') scheduleRenderMain();
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
    var blob = new Blob([json], { type: 'application/json' });
    triggerDownload(blob, 'database_npc.json');
  } catch (e) {
    notify('Errore esportazione NPC: ' + e.message, 'err');
  }
}

function loadNpc() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function (ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Il file non contiene un array di NPC.');
        state.personaggi = data.map(function (p, i) {
          return Object.assign({ _id: 'npc_imp_' + Date.now() + '_' + i }, p);
        });
        saveToStorage();
        fbSavePersonaggi();
        notify('Importati ' + state.personaggi.length + ' NPC.');
        scheduleRenderMain();
      } catch (err) {
        notify('Errore: ' + err.message, 'err');
      }
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
  _fbSaveIniziativaTimer = null;
  if (!_campaignDb) return;
  _localWrite.iniziativa = true;
  var toSave = state.combatants.length > 0 ? state.combatants : null;
  _campaignDb.ref('state/iniziativa').set(
    {
      combatants: toSave,
      round: state.round,
      activeIndex: state.activeIndex,
    },
    function () {
      setTimeout(function () {
        _localWrite.iniziativa = false;
      }, 200);
    }
  );
}
function fbSaveCaos() {
  if (!_campaignDb) return;
  _localWrite.caos = true;
  _campaignDb.ref('state/caos/players').set(state.caosPlayers, function () {
    setTimeout(function () {
      _localWrite.caos = false;
    }, 200);
  });
  _campaignDb
    .ref('state/caos/doom')
    .set({ doomStage: state.doomStage, doomFilled: state.doomFilled });
}
function fbSaveArmi() {
  if (!_campaignDb) return;
  _localWrite.armi = true;
  _campaignDb.ref('state/armi').set(state.armi, function () {
    setTimeout(function () {
      _localWrite.armi = false;
    }, 200);
  });
}
function fbSaveImpianti() {
  if (!_campaignDb) return;
  _campaignDb
    .ref('state/impianti')
    .set(state.impiantiCibernetici.length > 0 ? state.impiantiCibernetici : null);
}
function fbSaveDroghe() {
  if (!_campaignDb) return;
  _campaignDb.ref('state/droghe').set(state.droghe.length > 0 ? state.droghe : null);
}
function fbSaveVeicoli() {
  if (!_campaignDb) return;
  _campaignDb.ref('state/veicoli').set(state.veicoli.length > 0 ? state.veicoli : null);
}
function fbSaveVeicoliParty() {
  if (!_campaignDb) return;
  _campaignDb
    .ref('state/veicoliParty')
    .set(state.veicoliParty.length > 0 ? state.veicoliParty : null);
}
function fbSaveArmiFuoco() {
  if (!_campaignDb) return;
  _campaignDb.ref('state/armiFuoco').set(state.armiDaFuoco.length > 0 ? state.armiDaFuoco : null);
}
function fbSavePotenziamentiArmi() {
  if (!_campaignDb) return;
  _campaignDb
    .ref('state/armiFuocoPotenziamenti')
    .set(state.potenziamenti.length > 0 ? state.potenziamenti : null);
}
function fbSaveMunizioniArmi() {
  if (!_campaignDb) return;
  _campaignDb
    .ref('state/armiFuocoMunizioni')
    .set(state.munizioniArmi.length > 0 ? state.munizioniArmi : null);
}
function fbSaveNotes() {
  fbSave('state/notes', state.notes);
}

/* ---- STATO CENTRALE DELL'APPLICAZIONE ---- */
