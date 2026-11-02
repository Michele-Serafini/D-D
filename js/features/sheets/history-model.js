/* Reversible deltas keep the audit small, including nested and alternative sheets. */
var SheetHistoryModel = (function () {
  var reserved = ['id', '_rev'];
  var money = ['rame', 'argento', 'oro', 'platino', 'crediti', 'berry', 'soldi', 'ryo'];
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }
  function empty(value) {
    return value == null || (typeof value === 'object' && Object.keys(value).length === 0);
  }
  function equal(a, b) {
    // RTDB removes empty arrays and objects; they do not constitute a new revision.
    if (empty(a) && empty(b)) return true;
    if (object(a) && object(b)) {
      var keys = new Set(Object.keys(a).concat(Object.keys(b)));
      return Array.from(keys).every(function (key) {
        return equal(a[key], b[key]);
      });
    }
    return JSON.stringify(a) === JSON.stringify(b);
  }
  function diff(before, after) {
    var old = {},
      next = {};
    function walk(a, b, prefix) {
      new Set(Object.keys(a || {}).concat(Object.keys(b || {}))).forEach(function (key) {
        if (!prefix && reserved.includes(key)) return;
        if (/[.#$\[\]/]/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key))
          throw new Error('La scheda contiene un campo non valido.');
        var left = a && a[key],
          right = b && b[key];
        if (equal(left, right)) return;
        var path = prefix ? prefix + '/' + key : key;
        if (object(left) && object(right)) walk(left, right, path);
        else {
          old[path] = empty(left) ? null : clone(left);
          next[path] = empty(right) ? null : clone(right);
        }
      });
    }
    walk(before, after, '');
    return { before: old, after: next };
  }
  function apply(sheet, changes) {
    var result = clone(sheet || {});
    Object.entries(changes).forEach(function (entry) {
      var keys = entry[0].split('/'),
        node = result;
      if (
        keys.some(function (key) {
          return (
            !key || /[.#$\[\]]/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)
          );
        })
      )
        throw new Error('Percorso della modifica non valido.');
      keys.slice(0, -1).forEach(function (key) {
        if (!object(node[key])) node[key] = {};
        node = node[key];
      });
      if (entry[1] == null) delete node[keys[keys.length - 1]];
      else node[keys[keys.length - 1]] = clone(entry[1]);
    });
    return result;
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
  function label(path) {
    var labels = {
      nomePersonaggio: 'Nome personaggio',
      hpAttuali: 'Punti vita attuali',
      hpMassimi: 'Punti vita massimi',
      equipaggiamento: 'Equipaggiamento',
      oro: 'Oro',
      argento: 'Argento',
      rame: 'Rame',
      platino: 'Platino',
      schedaTipo: 'Tipo di scheda',
      stato: 'Stato',
      trade: 'Inventario del negozio',
      annotations: 'Annotazioni',
      note: 'Nota',
      inventory: 'Inventario',
      boardImages: 'Immagini della lavagna',
      avatar: 'Ritratto',
      nome: 'Nome',
      eroe: 'Eroe',
    };
    return path
      .split('/')
      .map(function (key) {
        return labels[key] || key;
      })
      .join(' › ');
  }
  return {
    clone: clone,
    diff: diff,
    apply: apply,
    ordered: ordered,
    restore: restore,
    label: label,
  };
})();
