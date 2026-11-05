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
  SheetStore.connect();
  CommerceService.connect();
  SessionJournal.connect();

  // ---- INIZIATIVA ----
  _campaignDb.ref('state/iniziativa').on('value', function (snap) {
    if (_localWrite.iniziativa) return;
    var v = snap.val();
    state.encounter = (v && v.encounter) || null;
    if (v && v.combatants && Array.isArray(v.combatants) && v.combatants.length > 0) {
      var existing = new Map(
        state.combatants.map(function (combatant) {
          return [combatant.id, combatant];
        })
      );
      state.combatants = v.combatants
        .filter(function (combatant) {
          return combatant && typeof combatant === 'object';
        })
        .map(function (combatant) {
          if (!Array.isArray(combatant.condizioni)) combatant.condizioni = [];
          // Keep the objects captured by existing input handlers current.
          return Object.assign(existing.get(combatant.id) || {}, combatant);
        });
      if (typeof v.round === 'number') state.round = v.round;
      if (typeof v.activeIndex === 'number') state.activeIndex = v.activeIndex;
    } else {
      state.combatants = [makeEmptyCombatant()];
      state.round = 1;
      state.activeIndex = 0;
    }
    if (state.section === 'iniziativa' || state.section === 'dashboard') {
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
      CommerceService.notify();

      if (state.section === 'schedepg') scheduleRenderMain();
    });

  CatalogSync.connect();

  AppCollections.connect();

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

function fbSaveIncantesimiAggiuntivi() {
  if (!_campaignDb) return;
  _campaignDb
    .ref('state/incantesimiAggiuntivi')
    .set(state.incantesimiAggiuntivi.length > 0 ? state.incantesimiAggiuntivi : null);
}

/* ===== SCHEDA PERSONAGGIO — Firebase ===== */
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

function fbSaveIniziativa(immediate, entries) {
  refreshCombatControls();
  // Salva immediatamente (azioni esplicite) o con debounce (input testo)
  if (immediate) {
    clearTimeout(_fbSaveIniziativaTimer);
    return _doFbSaveIniziativa(entries);
  } else {
    if (_fbSaveIniziativaTimer) clearTimeout(_fbSaveIniziativaTimer);
    _fbSaveIniziativaTimer = setTimeout(_doFbSaveIniziativa, 600);
  }
}

function _doFbSaveIniziativa(entries) {
  _fbSaveIniziativaTimer = null;
  if (!_campaignDb) return;
  _localWrite.iniziativa = true;
  var toSave = state.combatants.length > 0 ? state.combatants : null;
  var saving = SessionJournal.commit(
    {
      'state/iniziativa': {
        combatants: toSave,
        round: state.round,
        activeIndex: state.activeIndex,
        encounter: state.encounter || null,
      },
    },
    entries
  );
  saving.then(
    function () {
      setTimeout(function () {
        _localWrite.iniziativa = false;
      }, 200);
    },
    function () {
      _localWrite.iniziativa = false;
      notify('Salvataggio del combattimento non riuscito.', 'err');
    }
  );
  return saving;
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

function fbSaveNotes() {
  fbSave('state/notes', state.notes);
}
