/* JSON data operations shared by sheets, history, commerce and the offline reader. */
var DataUtils = (function () {
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function empty(value) {
    return value == null || (typeof value === 'object' && Object.values(value).every(empty));
  }
  function equal(a, b) {
    if (a == null && b == null) return true;
    if (a === b) return true;
    if (
      !a ||
      !b ||
      typeof a !== 'object' ||
      typeof b !== 'object' ||
      Array.isArray(a) !== Array.isArray(b)
    )
      return false;
    var keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every(function (key) {
        return Object.hasOwn(b, key) && equal(a[key], b[key]);
      })
    );
  }
  function equalStored(a, b) {
    if (empty(a) && empty(b)) return true;
    if (object(a) && object(b))
      return Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).every(function (key) {
        return equalStored(a[key], b[key]);
      });
    return equal(a, b);
  }
  function validKey(key) {
    return (
      !!key && !/[.#$\[\]/]/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key)
    );
  }
  function keys(path) {
    var result = path.split('/');
    if (!result.every(validKey)) throw new Error('Percorso della modifica non valido.');
    return result;
  }
  function value(data, path) {
    return (
      keys(path).reduce(function (node, key) {
        return node == null ? null : node[key];
      }, data) ?? null
    );
  }
  function write(target, changes, removeNull) {
    Object.entries(changes).forEach(function (entry) {
      var path = keys(entry[0]),
        node = target;
      path.slice(0, -1).forEach(function (key) {
        if (!object(node[key])) node[key] = {};
        node = node[key];
      });
      var leaf = path[path.length - 1];
      if (removeNull && entry[1] == null) delete node[leaf];
      else node[leaf] = clone(entry[1]);
    });
    return target;
  }
  function assign(target, changes) {
    return write(target, changes, false);
  }
  function apply(data, changes) {
    return write(clone(data || {}), changes, true);
  }
  function diff(before, after, options) {
    options = options || {};
    var previous = {},
      next = {},
      same = options.firebase ? equalStored : equal;
    function normalize(value) {
      return (options.firebase ? empty(value) : value == null) ? null : clone(value);
    }
    function walk(a, b, prefix) {
      new Set(Object.keys(a || {}).concat(Object.keys(b || {}))).forEach(function (key) {
        if (!prefix && options.exclude && options.exclude.includes(key)) return;
        if (!validKey(key)) throw new Error('La scheda contiene un campo non valido.');
        var left = a && a[key],
          right = b && b[key];
        if (same(left, right)) return;
        var path = prefix ? prefix + '/' + key : key;
        if (object(left) && object(right)) walk(left, right, path);
        else {
          previous[path] = normalize(left);
          next[path] = normalize(right);
        }
      });
    }
    walk(before, after, '');
    return { before: previous, after: next };
  }
  var labels = {
    for: 'Forza',
    des: 'Destrezza',
    cos: 'Costituzione',
    int: 'Intelligenza',
    sag: 'Saggezza',
    car: 'Carisma',
    nomePersonaggio: 'Nome personaggio',
    nome: 'Nome',
    eroe: 'Eroe',
    hpAttuali: 'Punti vita attuali',
    hpMassimi: 'Punti vita massimi',
    oro: 'Oro',
    argento: 'Argento',
    rame: 'Rame',
    platino: 'Platino',
    equipaggiamento: 'Equipaggiamento',
    trade: 'Inventario del negozio',
    inventory: 'Inventario',
    annotations: 'Annotazioni',
    boardImages: 'Immagini della lavagna',
    schedaTipo: 'Sistema di gioco',
    branca_data: 'Scheda Brancalonia',
    stato: 'Stato',
    note: 'Nota',
    avatar: 'Ritratto',
  };
  function fieldLabel(key) {
    return labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
  }
  function label(path) {
    return path.split('/').map(fieldLabel).join(' › ');
  }
  return {
    clone: clone,
    equal: equal,
    equalStored: equalStored,
    value: value,
    diff: diff,
    apply: apply,
    assign: assign,
    label: label,
    fieldLabel: fieldLabel,
  };
})();
