/* Leaf patches preserve remote purchases when an older sheet saves another field. */
var SheetStore = (function () {
  var baselines = new Map();
  var subscribers = new Set();
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function equal(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  function patch(before, after, prefix, output) {
    Array.from(new Set(Object.keys(before || {}).concat(Object.keys(after)))).forEach(
      function (key) {
        if (!prefix && (key === 'id' || key === 'trade' || key === '_rev')) return;
        var path = prefix ? prefix + '/' + key : key;
        var value = after[key],
          old = before && before[key];
        if (equal(old, value)) return;
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          old &&
          typeof old === 'object' &&
          !Array.isArray(old)
        )
          patch(old, value, path, output);
        else output[path] = value == null ? null : clone(value);
      }
    );
  }
  function applyPatch(target, changes) {
    Object.keys(changes).forEach(function (path) {
      var keys = path.split('/'),
        node = target;
      keys.slice(0, -1).forEach(function (key) {
        node = node[key] = node[key] || {};
      });
      node[keys[keys.length - 1]] = clone(changes[path]);
    });
    return target;
  }
  function key(username, id) {
    return username + '/' + id;
  }
  function observe(username, id, raw) {
    raw = raw ? _schedaFix(raw) : raw;
    var token = key(username, id),
      before = baselines.get(token);
    var mine = state.currentUser && state.currentUser.username === username;
    var current =
      mine && state.schedaAttivaId === id && !state.schedePGViewMode ? state.scheda : null;
    var pending = {};
    if (current && before) patch(before, current, '', pending);
    baselines.set(token, clone(raw));
    if (current && raw) {
      var incoming = {};
      patch(before || {}, raw, '', incoming);
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
    baselines.set(key(username, sheet.id), clone(sheet));
    return sheet;
  }
  function prepare(username, id, snapshot) {
    var changes = {};
    patch(baselines.get(key(username, id)) || {}, snapshot, '', changes);
    return changes;
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
    return SheetHistory.save(username, id, changes).catch(function (error) {
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
          return Object.assign(_schedaFix(chars[id]), { id: id });
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
