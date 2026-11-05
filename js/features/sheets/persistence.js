/* Sheet writes, durable staging and companion persistence. */
var _schedaSaveTimer = null;
var _schedaPendingSaves = new Map();
function flushPendingSchede() {
  clearTimeout(_schedaSaveTimer);
  _schedaSaveTimer = null;
  var saves = Array.from(_schedaPendingSaves.values());
  _schedaPendingSaves.clear();
  return Promise.all(
    saves.map(function (save) {
      return save();
    })
  );
}
function fbSaveScheda(immediate) {
  if (
    !_campaignDb ||
    !state.currentUser ||
    !state.schedaAttivaId ||
    !state.scheda ||
    !Object.keys(state.scheda).length
  )
    return immediate === true ? flushPendingSchede() : undefined;
  clearTimeout(_schedaSaveTimer);
  var id = state.schedaAttivaId;
  var snapshot = DataUtils.clone(state.scheda);
  delete snapshot.id;
  var username = state.currentUser.username,
    key = username + '/' + id;
  var changes = SheetStore.prepare(username, id, snapshot);
  if (Object.keys(changes).length)
    _schedaPendingSaves.set(key, function () {
      var saving = SheetStore.saveChanges(username, id, changes);
      saving.catch(function () {
        notify('Salvataggio della scheda non riuscito. Riprova.', 'err');
      });
      return saving;
    });
  else _schedaPendingSaves.delete(key);
  if (typeof OfflineSheets !== 'undefined') {
    OfflineSheets.dirty = _schedaPendingSaves.size > 0;
    if (!OfflineSheets.dirty) OfflineSheets.localError = '';
    OfflineSheets.dirtyVersion = (OfflineSheets.dirtyVersion || 0) + 1;
    OfflineSheets.notify();
  }
  if (immediate === true) return flushPendingSchede();
  _schedaSaveTimer = _schedaPendingSaves.size
    ? setTimeout(function () {
        flushPendingSchede().catch(function () {});
      }, 600)
    : null;
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
        return SheetStore.seed(
          state.currentUser.username,
          Object.assign(_schedaFix(chars[k]), { id: k })
        );
      });

      state.companions = raw.companions || {};
      state.schedaLoaded = true;
      if (cb) cb();
    } else {
      var newId = 'c' + Date.now();
      var oldFix = _schedaFix(raw);
      SheetHistory.save(state.currentUser.username, newId, oldFix)
        .then(function () {
          state.schedeList = [
            SheetStore.seed(state.currentUser.username, Object.assign({}, oldFix, { id: newId })),
          ];
          state.companions = {};
          state.schedaLoaded = true;
          if (cb) cb();
        })
        .catch(function () {
          notify('Migrazione della scheda non riuscita. Riprova.', 'err');
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
  var path = 'schedePG/' + state.currentUser.username + '/chars/' + id;
  return flushPendingSchede()
    .then(function () {
      return SheetHistory.flush();
    })
    .then(function () {
      if (typeof OfflineSheets !== 'undefined') return OfflineSheets.requireSynced();
    })
    .then(function () {
      return _campaignDb.ref(path).remove();
    })
    .catch(function () {
      notify('Eliminazione della scheda non riuscita. Riprova.', 'err');
    });
}
