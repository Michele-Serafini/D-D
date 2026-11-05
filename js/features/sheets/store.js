/* Leaf patches preserve remote purchases when an older sheet saves another field. */
var SheetStore = (function () {
  var baselines = new Map();
  var subscribers = new Set();
  var clone = DataUtils.clone,
    applyPatch = DataUtils.assign;
  function changes(before, after) {
    return DataUtils.diff(before, after, { exclude: ['id', 'trade', '_rev'] }).after;
  }
  function key(username, id) {
    return username + '/' + id;
  }
  function observe(username, id, raw) {
    if (typeof OfflineSheets !== 'undefined' && OfflineSheets.ready)
      raw = OfflineSheets.overlay(username, id, raw);
    raw = raw ? _schedaFix(raw) : raw;
    var token = key(username, id),
      before = baselines.get(token);
    var mine = state.currentUser && state.currentUser.username === username;
    var current =
      mine && state.schedaAttivaId === id && !state.schedePGViewMode ? state.scheda : null;
    var pending = current && before ? changes(before, current) : {};
    baselines.set(token, clone(raw));
    if (current && raw) {
      var incoming = changes(before || {}, raw);
      applyPatch(current, incoming);
      if (raw.trade) current.trade = clone(raw.trade);
      applyPatch(current, pending);
      current.id = id;
      document.querySelectorAll('[data-sheet-field]').forEach(function (input) {
        if (input !== document.activeElement) input.value = current[input.dataset.sheetField] ?? '';
      });
    }
  }
  function seed(username, sheet) {
    if (typeof OfflineSheets !== 'undefined' && OfflineSheets.ready)
      sheet = Object.assign(_schedaFix(OfflineSheets.overlay(username, sheet.id, sheet)), {
        id: sheet.id,
      });
    baselines.set(key(username, sheet.id), clone(sheet));
    return sheet;
  }
  function prepare(username, id, snapshot) {
    return changes(baselines.get(key(username, id)) || {}, snapshot);
  }
  function save(username, id, snapshot) {
    return saveChanges(username, id, prepare(username, id, snapshot));
  }
  function saveChanges(username, id, changes) {
    var token = key(username, id),
      previous = baselines.get(token);
    if (!Object.keys(changes).length) return Promise.resolve();
    // Advance the local baseline now so successive debounced edits only send their delta.
    var expected = applyPatch(clone(previous || {}), changes);
    baselines.set(token, expected);
    var saving =
      typeof OfflineSheets !== 'undefined' && (OfflineSheets.ready || !OfflineSheets.connected)
        ? OfflineSheets.stage(username, id, changes, previous)
        : SheetHistory.save(username, id, changes);
    return saving
      .then(function (value) {
        if (typeof OfflineSheets !== 'undefined' && !OfflineSheets.ready) {
          OfflineSheets.dirty = false;
          OfflineSheets.notify();
        }
        return value;
      })
      .catch(function (error) {
        if (baselines.get(token) === expected) baselines.set(token, previous);
        throw error;
      });
  }
  function connect() {
    if (connect.started || !_campaignDb || !state.currentUser) return;
    connect.started = true;
    var username = state.currentUser.username;
    _campaignDb.ref('schedePG/' + username + '/chars').on('value', function (snapshot) {
      var chars = snapshot.val() || {};
      Object.keys(chars).forEach(function (id) {
        observe(username, id, chars[id]);
      });
      if (state.schedaLoaded)
        state.schedeList = Object.keys(chars).map(function (id) {
          var raw =
            typeof OfflineSheets !== 'undefined' && OfflineSheets.ready
              ? OfflineSheets.overlay(username, id, chars[id])
              : chars[id];
          return Object.assign(_schedaFix(raw), { id: id });
        });
      subscribers.forEach(function (listener) {
        listener();
      });
    });
  }
  return {
    save: save,
    prepare: prepare,
    saveChanges: saveChanges,
    seed: seed,
    observe: observe,
    connect: connect,
    subscribe: function (listener) {
      subscribers.add(listener);
      return function () {
        subscribers.delete(listener);
      };
    },
  };
})();
