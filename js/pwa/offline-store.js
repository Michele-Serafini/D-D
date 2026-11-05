/* Shared by the online app and the small, dependency-free offline reader. */
var OfflineStore = {
  opening: null,
  open: function () {
    if (this.opening) return this.opening;
    var self = this;
    this.opening = new Promise(function (resolve, reject) {
      var request = indexedDB.open('MercanteOffline', 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        db.createObjectStore('snapshots', { keyPath: 'scope' });
        var ops = db.createObjectStore('operations', { keyPath: 'id' });
        ops.createIndex('scope', 'scope');
        db.createObjectStore('meta');
      };
      request.onsuccess = function () {
        var db = request.result;
        db.onversionchange = function () {
          db.close();
          self.opening = null;
        };
        resolve(db);
      };
      request.onerror = request.onblocked = function () {
        self.opening = null;
        reject(new Error('Archivio offline non disponibile. Controlla lo spazio del dispositivo.'));
      };
    });
    return this.opening;
  },
  request: async function (store, mode, task) {
    var db = await this.open();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(store, mode),
        result = task(tx.objectStore(store));
      tx.oncomplete = function () {
        resolve(result.result);
      };
      tx.onerror = tx.onabort = function () {
        reject(tx.error || result.error || new Error('Salvataggio locale non riuscito.'));
      };
    });
  },
  get: function (store, key) {
    return this.request(store, 'readonly', function (s) {
      return s.get(key);
    });
  },
  put: function (store, value, key) {
    return this.request(store, 'readwrite', function (s) {
      return key === undefined ? s.put(value) : s.put(value, key);
    });
  },
  remove: function (store, key) {
    return this.request(store, 'readwrite', function (s) {
      return s.delete(key);
    });
  },
  session: async function (uid) {
    if (uid) await this.put('meta', uid, 'activeUser');
    else await this.remove('meta', 'activeUser');
    if (typeof BroadcastChannel !== 'undefined') {
      var channel = new BroadcastChannel('mercante-offline-session');
      channel.postMessage(uid);
      channel.close();
    }
  },
  all: function (store) {
    return this.request(store, 'readonly', function (s) {
      return s.getAll();
    });
  },
  operations: async function (scope) {
    var rows = await this.request('operations', 'readonly', function (s) {
      return s.index('scope').getAll(scope);
    });
    return rows.sort(function (a, b) {
      return a.order - b.order;
    });
  },
  enqueue: async function (operation) {
    var db = await this.open();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(['meta', 'operations'], 'readwrite'),
        meta = tx.objectStore('meta');
      var request = meta.get('sequence');
      request.onsuccess = function () {
        operation.order = (request.result || 0) + 1;
        meta.put(operation.order, 'sequence');
        tx.objectStore('operations').put(operation);
      };
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = tx.onabort = function () {
        reject(tx.error || new Error('Modifica non conservata sul dispositivo.'));
      };
    });
  },
};

var OfflineModel = {
  clone: function (value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  },
  value: function (object, path) {
    return (
      path.split('/').reduce(function (node, key) {
        return node == null ? null : node[key];
      }, object) ?? null
    );
  },
  equal: function (a, b) {
    if (a == null && b == null) return true;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      var keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
      return keys.every(function (key) {
        return OfflineModel.equal(a[key], b[key]);
      });
    }
    return JSON.stringify(a) === JSON.stringify(b);
  },
  apply: function (sheet, patch) {
    var copy = this.clone(sheet || {});
    Object.entries(patch).forEach(function (entry) {
      var keys = entry[0].split('/'),
        node = copy;
      if (
        keys.some(function (key) {
          return !key || ['__proto__', 'constructor', 'prototype'].includes(key);
        })
      )
        throw new Error('Campo non valido.');
      keys.slice(0, -1).forEach(function (key) {
        if (!node[key] || typeof node[key] !== 'object') node[key] = {};
        node = node[key];
      });
      if (entry[1] == null) delete node[keys.at(-1)];
      else node[keys.at(-1)] = OfflineModel.clone(entry[1]);
    });
    return copy;
  },
  conflicts: function (operation, current) {
    return Object.keys(operation.patch).filter(function (path) {
      var actual = OfflineModel.value(current, path);
      return (
        !OfflineModel.equal(actual, OfflineModel.value(operation.before, path)) &&
        !OfflineModel.equal(actual, operation.patch[path])
      );
    });
  },
  sheets: function (snapshot, operations) {
    var sheets = this.clone(snapshot?.sheets || {});
    operations.forEach(function (op) {
      var key = op.owner + '/' + op.character;
      sheets[key] = OfflineModel.apply(sheets[key], op.patch);
    });
    return sheets;
  },
};
