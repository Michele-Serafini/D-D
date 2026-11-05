/* Reversible deltas keep the audit small, including nested and alternative sheets. */
var SheetHistoryModel = (function () {
  var reserved = ['id', '_rev'];
  var money = ['rame', 'argento', 'oro', 'platino', 'crediti', 'berry', 'soldi', 'ryo'];
  var clone = DataUtils.clone;
  var apply = DataUtils.apply;
  function diff(before, after) {
    return DataUtils.diff(before, after, { exclude: reserved, firebase: true });
  }
  function ordered(entries) {
    return Object.values(entries || {}).sort(function (a, b) {
      return a.version - b.version;
    });
  }
  function restore(current, entries, version, head) {
    var later = ordered(entries).filter(function (entry) {
      return entry.version > version;
    });
    if (version === 0 && later[0]?.kind === 'create')
      throw new Error('La scheda non esisteva prima della sua creazione.');
    if (
      version < 0 ||
      version >= head.version ||
      later.length !== head.version - version ||
      later.some(function (entry, i) {
        return entry.version !== version + i + 1;
      })
    )
      throw new Error('Storico incompleto. Carica le versioni mancanti prima del ripristino.');
    var restored = clone(current),
      protectedMoney = false;
    later
      .slice()
      .reverse()
      .forEach(function (entry) {
        restored = apply(restored, JSON.parse(entry.before));
        if (entry.kind === 'purchase' || entry.kind === 'reward') protectedMoney = true;
      });
    // Confirmed transactions keep their inventory and, when newer, their balances.
    if (current.trade) restored.trade = clone(current.trade);
    else delete restored.trade;
    if (protectedMoney)
      money.forEach(function (field) {
        if (current[field] == null) delete restored[field];
        else restored[field] = current[field];
      });
    delete restored._rev;
    delete restored.id;
    return restored;
  }
  return {
    clone: clone,
    diff: diff,
    apply: apply,
    ordered: ordered,
    restore: restore,
    label: DataUtils.label,
  };
})();
