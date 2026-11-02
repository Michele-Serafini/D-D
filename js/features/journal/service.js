/* Each campaign has one active session. Private events are written with their source. */
var SessionJournal = {
  active: null,
  control: { sessions: {} },
  ready: false,
  listeners: new Set(),
  queue: {},
  connect: function () {
    if (this.started || !_campaignDb) return;
    this.started = true;
    this.queueKey = CampaignManager.storageKey() + ':journal-outbox';
    try {
      this.queue = JSON.parse(localStorage.getItem(this.queueKey) || '{}');
    } catch (_error) {
      this.queue = {};
    }
    if (!this.queue || typeof this.queue !== 'object' || Array.isArray(this.queue)) this.queue = {};
    _campaignDb.ref(isDM() ? 'sessionJournal/control' : 'sessionJournal/control/active').on(
      'value',
      function (snapshot) {
        if (isDM()) SessionJournal.control = snapshot.val() || { sessions: {} };
        SessionJournal.active = isDM()
          ? SessionJournal.control.active || null
          : snapshot.val() || null;
        SessionJournal.ready = true;
        SessionJournal.notify();
        SessionJournal.flush();
      },
      function () {
        SessionJournal.ready = false;
        SessionJournal.notify();
      }
    );
    window.addEventListener('online', function () {
      SessionJournal.flush();
    });
  },
  notify: function () {
    this.listeners.forEach(function (listener) {
      listener();
    });
  },
  subscribe: function (listener) {
    this.listeners.add(listener);
    return function () {
      SessionJournal.listeners.delete(listener);
    };
  },
  stash: function (path, event) {
    this.queue[path] = event;
    try {
      localStorage.setItem(this.queueKey, JSON.stringify(this.queue));
    } catch (_error) {
      notify(
        'Diario: impossibile conservare la coda locale. Mantieni aperta la pagina e riprova.',
        'err'
      );
    }
    this.notify();
  },
  flush: function () {
    if (this.flushing) return this.flushing;
    if (!this.ready || !_campaignDb) return Promise.resolve();
    var batch = Object.entries(this.queue);
    this.flushing = Promise.allSettled(
      batch.map(async function (entry) {
        try {
          await _campaignDb.ref(entry[0]).set(entry[1]);
        } catch (error) {
          if (!isDM() || !['checkpoint', 'combat'].includes(entry[1].kind)) throw error;
          var current = (await _campaignDb.ref(entry[0]).once('value')).val();
          if (!current || current.at < entry[1].at) throw error;
        }
        if (SessionJournal.queue[entry[0]] === entry[1]) delete SessionJournal.queue[entry[0]];
      })
    )
      .then(function () {
        try {
          localStorage.setItem(SessionJournal.queueKey, JSON.stringify(SessionJournal.queue));
        } catch (_error) {
          /* The in-memory queue remains available. */
        }
      })
      .finally(function () {
        SessionJournal.flushing = null;
        SessionJournal.notify();
        if (
          Object.entries(SessionJournal.queue).some(function (entry) {
            return !batch.some(function (sent) {
              return sent[0] === entry[0] && sent[1] === entry[1];
            });
          })
        )
          SessionJournal.flush();
      });
    return this.flushing;
  },
  commit: async function (changes, entries) {
    if (Object.keys(this.queue).length) this.flush();
    var extra = {},
      self = this;
    (entries || []).forEach(function (entry) {
      if (entry && entry.data && entry.session)
        extra['sessionJournal/events/' + entry.session + '/' + entry.data.id] = entry.data;
    });
    if (!Object.keys(extra).length) return _campaignDb.ref('').update(changes);
    try {
      var result = await _campaignDb.ref('').update(Object.assign({}, changes, extra));
      Object.entries(extra).forEach(function (entry) {
        if (self.queue[entry[0]] && self.queue[entry[0]].at <= entry[1].at)
          delete self.queue[entry[0]];
      });
      try {
        localStorage.setItem(this.queueKey, JSON.stringify(this.queue));
      } catch (_error) {
        /* Source writes have been confirmed. */
      }
      return result;
    } catch (error) {
      // Journal delivery must not block a roll or reward. Its source is committed first.
      if (Object.keys(changes).length) await _campaignDb.ref('').update(changes);
      Object.entries(extra).forEach(function (entry) {
        self.stash(entry[0], entry[1]);
      });
      this.flush();
    }
  },
  capture: function (data, session) {
    return this.commit({}, [{ session: session || this.active, data: data }]);
  },
  start: async function (title) {
    if (!isDM()) throw new Error('Avvio riservato al master.');
    var id = 's_' + crypto.randomUUID();
    var meta = {
      title: String(title || 'Sessione del ' + new Date().toLocaleDateString('it-IT'))
        .trim()
        .slice(0, 100),
      startedAt: Date.now(),
      createdBy: state.currentUser.username,
    };
    var result = await _campaignDb.ref('sessionJournal/control').transaction(
      function (current) {
        current = current || { sessions: {} };
        if (current.active) return;
        current.sessions = current.sessions || {};
        current.sessions[id] = meta;
        current.active = id;
        return current;
      },
      undefined,
      false
    );
    if (!result.committed) throw new Error('C’è già una sessione in corso.');
    var notes = (await _campaignDb.ref('dmConfig/dashboardNotes').once('value')).val();
    if (typeof notes === 'string' && notes.trim())
      await this.capture(
        JournalModel.event(
          'notes_' + state.currentUser.username,
          'checkpoint',
          'Appunti · ' + state.currentUser.username,
          notes,
          state.currentUser.username,
          Date.now()
        ),
        id
      );
    if (state.encounter && state.encounter.status === 'active') {
      state.encounter.sessionId = id;
      await fbSaveIniziativa(true, [
        {
          session: id,
          data: JournalModel.combat(
            state.encounter,
            'checkpoint',
            state.combatants,
            state.round,
            state.currentUser.username,
            Date.now()
          ),
        },
      ]);
    }
    return id;
  },
  end: async function () {
    if (!isDM() || !this.active) throw new Error('Nessuna sessione attiva.');
    var id = this.active;
    await MasterDashboardNotes.flush();
    if (state.encounter && state.encounter.status === 'active')
      await this.capture(
        JournalModel.combat(
          state.encounter,
          'checkpoint',
          state.combatants,
          state.round,
          state.currentUser.username,
          Date.now()
        ),
        id
      );
    await this.flush();
    var result = await _campaignDb.ref('sessionJournal/control').transaction(
      function (current) {
        if (!current || current.active !== id) return;
        current.sessions[id].endedAt = Date.now();
        delete current.active;
        return current;
      },
      undefined,
      false
    );
    if (!result.committed) throw new Error('La sessione è già stata chiusa o cambiata.');
    return id;
  },
  recordNotes: function (text) {
    if (!this.active || !isDM()) return Promise.resolve();
    var author = state.currentUser.username;
    return this.capture(
      JournalModel.event(
        'notes_' + author,
        'checkpoint',
        'Appunti · ' + author,
        text,
        author,
        Date.now()
      )
    );
  },
};
window.SessionJournal = SessionJournal;

function saveDiceRoll(data) {
  if (!_campaignDb || !state.currentUser) return Promise.resolve();
  var reference = _campaignDb.ref('diceRolls').push();
  data = Object.assign({}, data, {
    username: state.currentUser.username,
    occurredAt: Date.now(),
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    sessionId: SessionJournal.active || '',
  });
  var changes = {};
  changes['diceRolls/' + reference.key] = data;
  return SessionJournal.commit(changes, [
    { session: SessionJournal.active, data: JournalModel.roll(reference.key, data) },
  ]).catch(function () {
    notify('Impossibile salvare il tiro. Riprova quando la connessione è disponibile.', 'err');
  });
}
