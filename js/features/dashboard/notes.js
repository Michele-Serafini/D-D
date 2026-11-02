/* Appunti privati dei master, condivisi solo nella campagna attiva. */
var MasterDashboardNotes = (function () {
  var ref = null;
  var draftKey = null;
  var timer = null;
  var pending = null;
  var revision = 0;
  var listeners = new Set();
  var model = {
    text: '',
    loaded: false,
    dirty: false,
    saving: false,
    status: 'Caricamento appunti…',
  };

  function notify() {
    listeners.forEach(function (listener) {
      listener(model);
    });
  }

  function storeDraft() {
    try {
      localStorage.setItem(draftKey, model.text);
    } catch (_error) {
      model.status = 'Bozza in memoria: salvala prima di chiudere la pagina.';
    }
  }

  model.connect = function () {
    if (ref || !isDM() || !_campaignDb) return;
    draftKey = CampaignManager.storageKey() + ':dashboardNotes';
    try {
      var draft = localStorage.getItem(draftKey);
      if (draft !== null) {
        model.text = draft;
        model.dirty = true;
      }
    } catch (_error) {
      /* Il salvataggio remoto resta disponibile. */
    }
    ref = _campaignDb.ref('dmConfig/dashboardNotes');
    ref.on(
      'value',
      function (snapshot) {
        model.loaded = true;
        if (!model.dirty) model.text = typeof snapshot.val() === 'string' ? snapshot.val() : '';
        if (!model.saving) {
          model.status = model.dirty ? 'Bozza locale da salvare' : 'Appunti sincronizzati';
        }
        notify();
      },
      function () {
        model.loaded = false;
        model.status = 'Appunti non disponibili. Controlla la connessione e i permessi.';
        notify();
      }
    );
  };

  model.subscribe = function (listener) {
    listeners.add(listener);
    listener(model);
    return function () {
      listeners.delete(listener);
    };
  };

  model.update = function (text) {
    if (!ref || !model.loaded || !isDM()) return;
    model.text = text;
    model.dirty = true;
    revision++;
    model.status = 'Modifiche da salvare…';
    storeDraft();
    notify();
    clearTimeout(timer);
    timer = setTimeout(function () {
      model.flush().catch(function () {});
    }, 600);
  };

  model.flush = async function () {
    clearTimeout(timer);
    if (pending) {
      await pending;
      return model.flush();
    }
    if (!ref || !model.dirty) return;
    if (!model.loaded || !isDM()) throw new Error('Appunti non disponibili');
    var savedRevision = revision;
    var text = model.text;
    model.saving = true;
    model.status = 'Salvataggio…';
    notify();
    pending = Promise.resolve()
      .then(function () {
        return ref.set(text);
      })
      .then(function () {
        return SessionJournal.recordNotes(text);
      });
    try {
      await pending;
      if (revision === savedRevision) {
        model.dirty = false;
        try {
          localStorage.removeItem(draftKey);
        } catch (_error) {
          /* Nessun dato remoto perso. */
        }
        model.status = 'Appunti salvati';
      }
    } catch (error) {
      model.status = 'Salvataggio non riuscito. La bozza resta disponibile: riprova.';
      throw error;
    } finally {
      pending = null;
      model.saving = false;
      notify();
    }
    if (model.dirty) return model.flush();
  };
  return model;
})();
