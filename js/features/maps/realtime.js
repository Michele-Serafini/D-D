/* Campaign-scoped map and worldbuilding listeners and paths. */
function _mappaActivePath() {
  if (state.mappaActiveId) return _mappaBasePath() + '/maps/' + state.mappaActiveId;
  return _mappaBasePath();
}
function _mappaFlagPath(fid) {
  return _mappaActivePath() + '/flags/' + fid;
}

/* ---- Salvataggio Firebase per i dati shared ---- */
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
  if (isDM() && _storiaViewAsUser && _storiaViewAsUser !== '__tutte__')
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
