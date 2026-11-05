/* One scoped service for purchases, master approvals and rewards. */
var CommerceService = {
  approval: true,
  ready: false,
  listeners: new Set(),
  requests: {},
  connect: function () {
    if (this.started || !_campaignDb) return;
    this.started = true;
    _campaignDb.ref('commercePolicy/requireApproval').on(
      'value',
      function (snapshot) {
        CommerceService.approval = snapshot.val() !== false;
        CommerceService.ready = true;
        CommerceService.notify();
      },
      function () {
        CommerceService.ready = false;
        CommerceService.notify();
      }
    );
    var username = state.currentUser.username;
    _campaignDb
      .ref('commerceRequests' + (isDM() ? '' : '/' + username))
      .on('value', function (snapshot) {
        CommerceService.requests = isDM()
          ? snapshot.val() || {}
          : { [username]: snapshot.val() || {} };
        CommerceService.notify();
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
      CommerceService.listeners.delete(listener);
    };
  },
  setApproval: function (value) {
    if (!isDM()) return Promise.reject(new Error('Impostazione riservata al master.'));
    return _campaignDb.ref('commercePolicy/requireApproval').set(!!value);
  },
  characters: function () {
    var records = [];
    if (isDM()) {
      Object.entries(state.schedePGAll || {}).forEach(function (entry) {
        if (!CampaignManager.current.members[entry[0]]) return;
        Object.entries(entry[1].chars || {}).forEach(function (character) {
          records.push({ username: entry[0], id: character[0], sheet: character[1] });
        });
      });
    } else {
      state.schedeList.forEach(function (sheet) {
        records.push({ username: state.currentUser.username, id: sheet.id, sheet: sheet });
      });
    }
    return records;
  },
  label: function (record) {
    return (
      record.username +
      ' · ' +
      (record.sheet.nomePersonaggio || record.sheet.eroe || record.sheet.nome || 'Senza nome')
    );
  },
  run: async function (target, id, command) {
    if (!this.ready)
      throw new Error('Caricamento delle impostazioni del negozio. Riprova tra poco.');
    var actor = state.currentUser.username;
    if (target.username !== actor && !isDM()) throw new Error('Puoi usare soltanto le tue schede.');
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Operazione non valida.');
    if (state.schedaAttivaId && !state.schedePGViewMode) await fbSaveScheda(true);
    if (typeof OfflineSheets !== 'undefined') await OfflineSheets.requireSynced();
    var characterPath = 'schedePG/' + target.username + '/chars/' + target.id;
    var operationPath = 'commerceRequests/' + target.username + '/' + target.id + '/' + id;
    var receiptPath = 'commerceReceipts/' + target.username + '/' + target.id + '/' + id;
    var character = _campaignDb.ref(characterPath),
      reference = _campaignDb.ref(operationPath);
    if (!(await character.once('value')).exists()) throw new Error('La scheda non esiste più.');
    if (command.action === 'submit') {
      var created = CommerceModel.request(command, actor, Date.now());
      if (created.kind === 'reward' && !isDM()) throw new Error('Ricompense riservate al master.');
      await reference.transaction(
        function (current) {
          return current ? undefined : created;
        },
        undefined,
        false
      );
    }
    for (var attempt = 0; attempt < 5; attempt++) {
      var snapshots = await Promise.all([
        character.once('value'),
        reference.once('value'),
        _campaignDb.ref(receiptPath).once('value'),
        _campaignDb
          .ref(SheetHistory.paths(target.username, target.id).history + '/head')
          .once('value'),
      ]);
      var operation = snapshots[1].val();
      if (snapshots[2].exists() || (operation && operation.status !== 'pending')) return id;
      if (!operation) throw new Error('Richiesta non trovata.');
      if (command.action === 'cancel' || command.action === 'reject') {
        if (!isDM() && (command.action !== 'cancel' || operation.createdBy !== actor))
          throw new Error('Operazione non consentita.');
        await reference.transaction(
          function (current) {
            if (!current || current.status !== 'pending') return;
            return Object.assign({}, current, {
              status: command.action === 'cancel' ? 'cancelled' : 'rejected',
              resolvedBy: actor,
              resolvedAt: Date.now(),
            });
          },
          undefined,
          false
        );
        return id;
      }
      if (!isDM() && this.approval) return id;
      if ((snapshots[0].val()?._rev || '') !== (snapshots[3].val()?.revision || '')) {
        if (attempt === 4) throw new Error('La scheda è cambiata durante la lettura. Riprova.');
        continue;
      }
      var result = CommerceModel.apply(snapshots[0].val(), id, operation, actor, Date.now());
      var changes = {};
      changes[characterPath + '/trade/version'] = result.sheet.trade.version;
      changes[characterPath + '/trade/lastOperation'] = id;
      if (operation.item)
        changes[characterPath + '/trade/inventory/' + operation.item.key] =
          result.sheet.trade.inventory[operation.item.key];
      Object.values(CommerceModel.currencies).forEach(function (currency) {
        if (result.sheet[currency.field] !== snapshots[0].val()[currency.field])
          changes[characterPath + '/' + currency.field] = result.sheet[currency.field];
      });
      changes[operationPath] = result.operation;
      changes[receiptPath] = result.receipt;
      Object.assign(
        changes,
        SheetHistory.record(
          target.username,
          target.id,
          snapshots[0].val(),
          result.sheet,
          snapshots[3].val() || { version: 0 },
          operation.kind,
          id
        )
      );
      try {
        // The database validates version + 1. Conflicting purchases retry on fresh balances.
        var entries =
          operation.kind === 'reward'
            ? [
                {
                  session: SessionJournal.active,
                  data: JournalModel.reward(
                    target.username,
                    target.id,
                    id,
                    operation,
                    result.receipt,
                    target.sheet &&
                      (target.sheet.nomePersonaggio || target.sheet.nome || target.sheet.eroe)
                  ),
                },
              ]
            : [];
        await SessionJournal.commit(changes, entries);
        return id;
      } catch (error) {
        if (attempt === 4 || !/permission|denied/i.test(error.message || error.code || ''))
          throw error;
      }
    }
    return id;
  },
  operationId: function () {
    return 'op_' + crypto.randomUUID();
  },
};
