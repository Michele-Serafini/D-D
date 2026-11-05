/* A durable outbox survives reloads. Only a Firebase ACK removes an operation. */
var OfflineSheets = {
  ready: false,
  connected: false,
  serverConnected: false,
  error: '',
  operations: [],
  staging: new Map(),
  listeners: new Set(),
  connect: async function () {
    this.uid = firebase.auth().currentUser.uid;
    this.owner = state.currentUser.username;
    this.campaign = CampaignManager.current.id;
    this.scope = this.uid + ':' + this.campaign;
    try {
      await OfflineStore.session(this.uid);
      this.snapshot = await OfflineStore.get('snapshots', this.scope);
      await this.refresh();
      this.ready = true;
    } catch (error) {
      this.error = error.message;
    }
    var self = this;
    CampaignManager.watchConnection(function (connected) {
      self.serverConnected = connected;
      self.connection();
    });
    window.addEventListener('online', function () {
      self.connection();
    });
    window.addEventListener('offline', function () {
      self.connection();
    });
    this.timer = setInterval(function () {
      if (self.operations.length && self.connected) self.flush();
    }, 30000);
    this.connection();
  },
  connection: function () {
    this.connected = this.serverConnected && navigator.onLine;
    this.notify();
    if (this.connected && this.ready) this.flush();
  },
  notify: function () {
    this.listeners.forEach(function (callback) {
      callback();
    });
  },
  subscribe: function (callback) {
    this.listeners.add(callback);
    return function () {
      OfflineSheets.listeners.delete(callback);
    };
  },
  refresh: async function () {
    this.operations = await OfflineStore.operations(this.scope);
    this.notify();
  },
  overlay: function (owner, id, raw) {
    var operations = this.operations.concat(
      Array.from(this.staging.values()).filter(function (op) {
        return !OfflineSheets.operations.some(function (saved) {
          return saved.id === op.id;
        });
      })
    );
    return operations
      .filter(function (op) {
        return op.owner === owner && op.character === id;
      })
      .reduce(function (sheet, op) {
        return DataUtils.apply(sheet, op.patch);
      }, DataUtils.clone(raw));
  },
  stage: async function (owner, id, patch, before) {
    if (!this.ready)
      throw new Error('Archivio locale non disponibile: la scheda non è stata salvata.');
    var operation = {
      id: 'queued_' + crypto.randomUUID(),
      scope: this.scope,
      owner: owner,
      character: id,
      at: Date.now(),
      patch: DataUtils.clone(patch),
      before: DataUtils.clone(before || {}),
      error: '',
      conflicts: [],
    };
    this.staging.set(operation.id, operation);
    var dirtyVersion = this.dirtyVersion;
    this.notify();
    try {
      await OfflineStore.enqueue(operation);
      this.localError = '';
      await this.refresh();
    } catch (error) {
      this.localError = error.message;
      throw error;
    } finally {
      this.staging.delete(operation.id);
      if (!this.localError && this.dirtyVersion === dirtyVersion) this.dirty = false;
      this.notify();
    }
    this.flush();
  },
  fresh: function (path) {
    var ref = _campaignDb.ref(path);
    return typeof ref.get === 'function' ? ref.get() : ref.once('value');
  },
  flush: function () {
    if (this.flushing) return this.flushing;
    if (!this.ready || !this.connected) return Promise.resolve();
    var self = this;
    async function work() {
      await self.refresh();
      while (self.connected && self.operations.length) {
        var op = self.operations[0];
        if (op.conflicts?.length) break;
        try {
          var paths = SheetHistory.paths(op.owner, op.character);
          var receipt = await self.fresh(paths.history + '/entries/' + op.id);
          var confirmed;
          if (!receipt.exists()) {
            var current = await SheetHistory.read(op.owner, op.character, true);
            if (!current.sheet && Object.keys(op.before).length)
              throw new Error(
                'La scheda è stata eliminata online. Esporta le modifiche locali prima di scartarle.'
              );
            var conflicts = OfflineModel.conflicts(
              op,
              current.sheet ? _schedaFix(current.sheet) : {}
            );
            if (conflicts.length) {
              op.conflicts = conflicts;
              op.remote = Object.fromEntries(
                Object.keys(op.patch).map(function (path) {
                  return [path, DataUtils.value(_schedaFix(current.sheet), path)];
                })
              );
              op.error = 'Alcuni campi sono cambiati online. Controlla prima di sincronizzare.';
              await OfflineStore.put('operations', op);
              break;
            }
            self.inflight = op.id;
            self.notify();
            confirmed = await SheetHistory.save(op.owner, op.character, op.patch, {
              expected: current.head.revision || '',
              revision: op.id,
            });
            self.inflight = null;
          } else confirmed = (await self.fresh(paths.sheet)).val();
          if (self.snapshot) {
            var key = op.owner + '/' + op.character;
            if (confirmed) self.snapshot.sheets[key] = confirmed;
            else delete self.snapshot.sheets[key];
            self.snapshot.savedAt = Date.now();
            await OfflineStore.put('snapshots', self.snapshot);
          }
          await OfflineStore.remove('operations', op.id);
          self.error = '';
        } catch (error) {
          self.inflight = null;
          op.error = /permission|denied/i.test(error.message || error.code || '')
            ? 'Sincronizzazione non autorizzata o versione cambiata. Accedi di nuovo e riprova.'
            : error.message;
          await OfflineStore.put('operations', op);
          self.error = op.error;
          break;
        }
        await self.refresh();
      }
      await self.refresh();
    }
    this.flushing = (
      navigator.locks ? navigator.locks.request('mercante-sheets:' + this.scope, work) : work()
    )
      .catch(function (error) {
        self.error = error.message;
      })
      .finally(function () {
        self.flushing = null;
        self.notify();
      });
    this.notify();
    return this.flushing;
  },
  requireSynced: async function () {
    if (!this.connected)
      throw new Error(
        'Questa operazione richiede una connessione a Firebase. Le modifiche alle schede restano sul dispositivo.'
      );
    await UserManager.withTimeout(this.flush());
    if (this.operations.length)
      throw new Error(
        'Ci sono modifiche alle schede ancora da sincronizzare. Controlla Telefono e offline.'
      );
  },
  resolve: async function (id, useLocal) {
    if (!this.connected)
      throw new Error('Riconnettiti prima di risolvere o scartare le modifiche.');
    if (this.flushing) await UserManager.withTimeout(this.flushing);
    var op = await OfflineStore.get('operations', id);
    if (!op || op.scope !== this.scope) return;
    if (useLocal) {
      if (!this.connected) throw new Error('Riconnettiti prima di risolvere il conflitto.');
      var current = await SheetHistory.read(op.owner, op.character, true);
      if (!current.sheet)
        throw new Error('La scheda non esiste più online. Esporta la copia locale.');
      var normalized = _schedaFix(current.sheet);
      if (
        op.remote &&
        Object.keys(op.patch).some(function (path) {
          return !DataUtils.equal(op.remote[path], DataUtils.value(normalized, path));
        })
      ) {
        op.remote = Object.fromEntries(
          Object.keys(op.patch).map(function (path) {
            return [path, DataUtils.value(normalized, path)];
          })
        );
        op.error =
          'I dati online sono cambiati di nuovo. Controlla i nuovi valori prima di applicare le modifiche.';
        await OfflineStore.put('operations', op);
        await this.refresh();
        return;
      }
      op.before = normalized;
      op.remote = null;
      op.conflicts = [];
      op.error = '';
      await OfflineStore.put('operations', op);
    } else await OfflineStore.remove('operations', id);
    await this.refresh();
    await this.flush();
    var actual = (await this.fresh(SheetHistory.paths(op.owner, op.character).sheet)).val();
    if (actual) {
      SheetStore.observe(op.owner, op.character, actual);
      if (op.owner === this.owner)
        state.schedeList = state.schedeList.map(function (sheet) {
          return sheet.id === op.character
            ? Object.assign(_schedaFix(actual), { id: sheet.id })
            : sheet;
        });
      if (this.snapshot) {
        this.snapshot.sheets[op.owner + '/' + op.character] = actual;
        this.snapshot.savedAt = Date.now();
        await OfflineStore.put('snapshots', this.snapshot);
      }
    }
    // Release stale input closures before showing the newly confirmed state.
    if (state.section === 'telefono') return;
    renderMain();
  },
  prepare: async function () {
    await fbSaveScheda(true);
    await this.requireSynced();
    var sheets = {},
      self = this;
    var data = (await this.fresh(isDM() ? 'schedePG' : 'schedePG/' + this.owner)).val() || {};
    var users = isDM() ? data : { [this.owner]: data };
    Object.entries(users).forEach(function (user) {
      Object.entries(user[1].chars || {}).forEach(function (entry) {
        sheets[user[0] + '/' + entry[0]] = entry[1];
      });
    });
    var images = {};
    await Promise.all(
      Object.values(sheets).flatMap(function (sheet) {
        return (sheet.boardImages || []).map(async function (image) {
          if (image.id) {
            var value = await ImageDB.get(image.id);
            if (value) images[image.id] = value;
          }
        });
      })
    );
    var snapshot = {
      scope: this.scope,
      uid: this.uid,
      owner: this.owner,
      campaign: this.campaign,
      campaignName: CampaignManager.current.meta.name,
      sheets: sheets,
      images: images,
      savedAt: Date.now(),
    };
    await OfflineStore.put('snapshots', snapshot);
    this.snapshot = snapshot;
    if (navigator.storage?.persist) navigator.storage.persist().catch(function () {});
    self.notify();
  },
  forget: async function () {
    await this.refresh();
    if (this.operations.length)
      throw new Error(
        'Sincronizza o esporta e scarta le modifiche in attesa prima di rimuovere la copia.'
      );
    await OfflineStore.remove('snapshots', this.scope);
    this.snapshot = null;
    this.notify();
  },
  lock: async function () {
    await OfflineStore.session(null);
  },
};
