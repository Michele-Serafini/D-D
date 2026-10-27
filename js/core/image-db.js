/* One IndexedDB connection for board images and application snapshots. */
const ImageDB = {
  dbName: 'SiumBoardImages',
  storeName: 'images',
  version: 2,
  _opening: null,
  init: function () {
    if (this._opening) return this._opening;
    var self = this;
    this._opening = new Promise(function (resolve, reject) {
      var request = indexedDB.open(self.dbName, self.version);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(self.storeName))
          db.createObjectStore(self.storeName, { keyPath: 'id' });
        if (!db.objectStoreNames.contains('app_state')) db.createObjectStore('app_state');
      };
      request.onsuccess = function () {
        var db = request.result;
        db.onversionchange = function () {
          db.close();
          self._opening = null;
        };
        resolve(db);
      };
      request.onerror = function () {
        self._opening = null;
        reject(request.error);
      };
      request.onblocked = function () {
        self._opening = null;
        reject(new Error('Chiudi le altre schede per aggiornare l’archivio locale.'));
      };
    });
    return this._opening;
  },
  request: function (store, mode, operation) {
    return this.init().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(store, mode);
        var request = operation(transaction.objectStore(store));
        transaction.oncomplete = function () {
          resolve(request.result);
        };
        transaction.onerror = transaction.onabort = function () {
          reject(transaction.error || request.error);
        };
      });
    });
  },
  saveState: function (snapshot) {
    return this.request('app_state', 'readwrite', function (store) {
      return store.put(snapshot, 'state');
    });
  },
  getState: function () {
    return this.request('app_state', 'readonly', function (store) {
      return store.get('state');
    });
  },
  save: function (id, dataUrl) {
    return this.request(this.storeName, 'readwrite', function (store) {
      return store.put({ id: id, dataUrl: dataUrl });
    });
  },
  get: function (id) {
    return this.request(this.storeName, 'readonly', function (store) {
      return store.get(id);
    }).then(function (record) {
      return record ? record.dataUrl : null;
    });
  },
  remove: function (id) {
    return this.request(this.storeName, 'readwrite', function (store) {
      return store.delete(id);
    });
  },
};
window.ImageDB = ImageDB;

function migrateImagesToDB() {
  var pending = [];
  function migrateBoard(board) {
    (board || []).forEach(function (image) {
      if (image.dataUrl && image.dataUrl.length > 100) {
        pending.push(
          ImageDB.save(image.id, image.dataUrl).then(function () {
            delete image.dataUrl;
          })
        );
      }
    });
  }
  function migrateCharacter(character) {
    if (!character) return;
    if (character.abilityBoard) {
      character.boardImages = character.abilityBoard;
      delete character.abilityBoard;
    }
    migrateBoard(character.boardImages);
  }
  migrateCharacter(state.scheda);
  Object.keys(state.personaggi || {}).forEach(function (id) {
    migrateCharacter(state.personaggi[id]);
  });
  // Keep the original data until its transaction is committed.
  Promise.all(pending)
    .then(function () {
      if (pending.length) saveToStorage();
    })
    .catch(function (error) {
      console.warn('[Archivio locale] Migrazione immagini non completata:', error.message);
      saveToStorage();
    });
}
