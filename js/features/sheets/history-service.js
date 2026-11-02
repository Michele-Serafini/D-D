/* Source changes and their immutable audit entry are acknowledged atomically. */
var SheetHistory = (function () {
  var pending = new Map();
  function paths(username, id) {
    return {
      sheet: 'schedePG/' + username + '/chars/' + id,
      history: 'sheetHistory/' + username + '/' + id,
    };
  }
  async function read(username, id) {
    var path = paths(username, id);
    for (var attempt = 0; attempt < 5; attempt++) {
      var snapshots = await Promise.all([
        _campaignDb.ref(path.sheet).once('value'),
        _campaignDb.ref(path.history + '/head').once('value'),
      ]);
      var sheet = snapshots[0].val(),
        head = snapshots[1].val() || { version: 0 };
      // The two reads can straddle another editor's commit. Never audit a stale "before".
      if (!sheet || (sheet._rev || '') === (head.revision || ''))
        return { sheet: sheet, head: head };
    }
    throw new Error('La scheda è cambiata durante la lettura. Riprova.');
  }
  function record(username, id, before, after, head, kind, source) {
    var delta = SheetHistoryModel.diff(before, after);
    if (!Object.keys(delta.after).length) return null;
    var revision = 'r_' + crypto.randomUUID(),
      at = firebase.database.ServerValue.TIMESTAMP;
    var entry = {
      version: (head.version || 0) + 1,
      actor: state.currentUser.username,
      at: at,
      kind: kind || (before ? 'edit' : 'create'),
      before: JSON.stringify(delta.before),
      after: JSON.stringify(delta.after),
      source: source || '',
    };
    if (entry.before.length > 8000000 || entry.after.length > 8000000)
      throw new Error(
        'Modifica troppo grande per lo storico. Riduci le immagini incorporate nella scheda.'
      );
    var path = paths(username, id),
      changes = {};
    changes[path.sheet + '/_rev'] = revision;
    changes[path.history + '/head'] = {
      version: entry.version,
      revision: revision,
      at: at,
      actor: entry.actor,
      name: String(after.nomePersonaggio || after.nome || after.eroe || 'Senza nome').slice(0, 160),
    };
    changes[path.history + '/entries/' + revision] = entry;
    return changes;
  }
  function serial(username, id, task) {
    var key = username + '/' + id;
    var next = (pending.get(key) || Promise.resolve()).catch(function () {}).then(task);
    pending.set(key, next);
    next
      .finally(function () {
        if (pending.get(key) === next) pending.delete(key);
      })
      .catch(function () {});
    return next;
  }
  function save(username, id, patch, options) {
    options = options || {};
    return serial(username, id, async function () {
      for (var attempt = 0; attempt < 5; attempt++) {
        var current = await read(username, id);
        if (!current.sheet && current.head.version) throw new Error('La scheda è stata eliminata.');
        if (options.expected && (current.head.revision || '') !== options.expected)
          throw new Error(
            'La scheda è cambiata. Aggiorna lo storico e controlla le nuove modifiche.'
          );
        if (options.expected && !current.sheet) throw new Error('La scheda è stata eliminata.');
        var after = SheetHistoryModel.apply(current.sheet, patch);
        var changes = record(
          username,
          id,
          current.sheet,
          after,
          current.head,
          options.kind,
          options.source
        );
        if (!changes) return current.sheet;
        var path = paths(username, id);
        Object.entries(SheetHistoryModel.diff(current.sheet, after).after).forEach(
          function (entry) {
            changes[path.sheet + '/' + entry[0]] = entry[1];
          }
        );
        changes['schedePG/' + username + '/_v2'] = true;
        try {
          await _campaignDb.ref('').update(changes);
          return after;
        } catch (error) {
          if (
            options.expected ||
            attempt === 4 ||
            !/permission|denied/i.test(error.message || error.code || '')
          )
            throw error;
        }
      }
    });
  }
  async function restore(username, id, entries, version, head) {
    if (state.schedaAttivaId && !state.schedePGViewMode) await fbSaveScheda(true);
    var current = await read(username, id);
    if (current.head.revision !== head.revision || !current.sheet)
      throw new Error('La scheda è cambiata. Aggiorna lo storico e controlla le nuove modifiche.');
    var restored = SheetHistoryModel.restore(current.sheet, entries, version, head);
    var result = await save(username, id, SheetHistoryModel.diff(current.sheet, restored).after, {
      kind: 'restore',
      source: String(version),
      expected: head.revision,
    });
    SheetStore.observe(username, id, result);
    if (
      state.schedaAttivaId === id &&
      (state.currentUser.username === username || state.schedePGOpenChar?.username === username)
    )
      state.scheda = Object.assign(_schedaFix(result), { id: id });
    return result;
  }
  return {
    paths: paths,
    read: read,
    record: record,
    save: save,
    restore: restore,
    flush: async function () {
      while (pending.size) await Promise.all(Array.from(pending.values()));
    },
  };
})();
