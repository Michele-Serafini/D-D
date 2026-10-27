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
      if (typeof data.doomStage === 'number' && data.doomStage >= 1 && data.doomStage <= 3)
        state.doomStage = data.doomStage;
      if (typeof data.doomFilled === 'number')
        state.doomFilled = Math.max(
          0,
          Math.min(doomSegmentsForStage(state.doomStage), data.doomFilled)
        );
      if (typeof data.notes === 'string') state.notes = data.notes;
      if (
        data.theme === 'dark' ||
        data.theme === 'light' ||
        data.theme === 'halloween' ||
        data.theme === 'christmas' ||
        data.theme === 'valentine' ||
        data.theme === 'easter'
      )
        state.theme = data.theme;
      if (typeof data.geminiKey === 'string') state.geminiKey = data.geminiKey;
      if (typeof data.groqKey === 'string') state.groqKey = data.groqKey;
      if (Array.isArray(data.personaggi)) state.personaggi = data.personaggi;
      if (Array.isArray(data.bestiario)) state.bestiario = data.bestiario;
      if (data.partyResetVersion === PARTY_RESET_VERSION && Array.isArray(data.pet))
        state.pet = data.pet;
      if (Array.isArray(data.worldbuilding)) state.worldbuilding = data.worldbuilding;
      if (data.bestSearch !== undefined) state.bestSearch = data.bestSearch;
      if (data.regiaImmagini && typeof data.regiaImmagini === 'object')
        state.regiaImmagini = data.regiaImmagini;
      if (data.regiaUrls && typeof data.regiaUrls === 'object') state.regiaUrls = data.regiaUrls;
      if (data.regiaUrlsSfx && typeof data.regiaUrlsSfx === 'object')
        state.regiaUrlsSfx = data.regiaUrlsSfx;
      if (Array.isArray(data.regiaUrlsBardo)) state.regiaUrlsBardo = data.regiaUrlsBardo;
      if (data.npc && typeof data.npc === 'object') {
        var npcFields = [
          '_id',
          'nome',
          'ruolo',
          'background',
          'hp',
          'ca',
          'eta',
          'for',
          'des',
          'cos',
          'int',
          'sag',
          'car',
          'tratiCaratteriali',
          'trattiFisici',
          'oggettiIncantesimi',
          'immagine',
          'azioniTesto',
          'bgShort',
          'razza',
          'competenza',
          'velocita',
          'hpMax',
          'dadiVita',
          'alleati',
          'privilegiTratti',
          'ideali',
          'legami',
          'difetti',
          'altreComp',
          'classeIncantatore',
          'charIncantatore',
          'cdIncantesimi',
          'bonusAttaccoInc',
          'citta',
          'stato',
        ];
        npcFields.forEach(function (f) {
          if (data.npc[f] !== undefined) state.npc[f] = data.npc[f];
        });
        if (Array.isArray(data.npc.attacchi)) state.npc.attacchi = data.npc.attacchi;
        /* Ripristina tutti i campi boolean (circoletti proficiency, spell prepared, ecc.) */
        Object.keys(data.npc).forEach(function (k) {
          if (
            k.endsWith('_p') ||
            k.startsWith('spPrep_') ||
            k.startsWith('ts_') ||
            k.startsWith('spell_') ||
            k.startsWith('trucco_') ||
            k.startsWith('slotTot') ||
            k.startsWith('slotSp') ||
            k.startsWith('sk') ||
            k.startsWith('ts')
          ) {
            state.npc[k] = data.npc[k];
          }
        });
      }
      if (typeof data.npcActiveTab === 'number') state.npcActiveTab = data.npcActiveTab;
      if (Array.isArray(data.npcTabs)) state.npcTabs = data.npcTabs;
      if (data.storia && typeof data.storia === 'object') {
        if (typeof data.storia.content === 'string') state.storia.content = data.storia.content;
      }
      if (typeof data.worldbuildingMapId === 'string' && data.worldbuildingMapId)
        state.mappaActiveId = data.worldbuildingMapId;
    }
  } catch (e) {
    console.warn('[Mercante] Lettura snapshot fallita:', e.message);
  }
}

function loadFromStorageAsync(cb) {
  if (window.ImageDB) {
    window.ImageDB.getState()
      .then(function (snapStr) {
        if (snapStr) {
          _applySnapshot(snapStr);
        } else {
          _applySnapshot(readLocalSnapshot());
        }
        cb();
      })
      .catch(function () {
        _applySnapshot(readLocalSnapshot());
        cb();
      });
  } else {
    _applySnapshot(readLocalSnapshot());
    cb();
  }
}

function readLocalSnapshot() {
  try {
    return localStorage.getItem(LS_KEY);
  } catch (_) {
    return null;
  }
}

var _storageSaveTimer = null;
function saveToStorage() {
  clearTimeout(_storageSaveTimer);
  _storageSaveTimer = setTimeout(flushStorage, 200);
}

function flushStorage() {
  clearTimeout(_storageSaveTimer);
  _storageSaveTimer = null;
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
      partyResetVersion: PARTY_RESET_VERSION,
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
      storia: { content: state.storia.content, markers: state.storia.markers },
    };
    var snapStr = JSON.stringify(snapshot);
    // Salva sempre su IndexedDB per scavalcare i 5MB di quota!
    if (window.ImageDB) window.ImageDB.saveState(snapStr).catch(function () {});
    // E prova a salvare anche su localStorage come fallback
    localStorage.setItem(LS_KEY, snapStr);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      // Ignorato intenzionalmente.
    }
  }
}
