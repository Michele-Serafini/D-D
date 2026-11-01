/* Pure transaction model: prices, coin exchange, stacked inventory and receipts. */
var CommerceModel = (function () {
  var currencies = {
    mr: { field: 'rame', label: 'MR', rate: 1 },
    ma: { field: 'argento', label: 'MA', rate: 10 },
    mo: { field: 'oro', label: 'MO', rate: 100 },
    mp: { field: 'platino', label: 'MP', rate: 1000 },
    crediti: { field: 'crediti', label: 'Crediti' },
    berry: { field: 'berry', label: 'Berry' },
    poke: { field: 'soldi', label: 'Poké' },
    ryo: { field: 'ryo', label: 'Ryō' },
  };
  function integer(value, label) {
    var number = value === '' || value == null ? 0 : Number(value);
    if (!Number.isSafeInteger(number) || number < 0 || number > 1e12)
      throw new Error(label + ': inserisci un numero intero non negativo.');
    return number;
  }
  function currency(code) {
    code = String(code || '').toLowerCase();
    if (code === 'cr' || code === 'credits') code = 'crediti';
    if (!currencies[code]) throw new Error('Valuta non supportata.');
    return code;
  }
  function amount(value, code) {
    var number = Number(value),
      scaled = number * (currencies[currency(code)].rate || 1);
    if (
      !Number.isFinite(scaled) ||
      scaled < 0 ||
      scaled > 1e12 ||
      Math.abs(scaled - Math.round(scaled)) > 1e-6
    )
      throw new Error('Importo non valido per questa valuta.');
    return Math.round(scaled);
  }
  function balance(sheet, code) {
    code = currency(code);
    if (!currencies[code].rate)
      return integer(sheet[currencies[code].field], currencies[code].label);
    return ['mr', 'ma', 'mo', 'mp'].reduce(function (sum, key) {
      return (
        sum + integer(sheet[currencies[key].field], currencies[key].label) * currencies[key].rate
      );
    }, 0);
  }
  function changeMoney(sheet, code, delta) {
    var next = balance(sheet, code) + delta;
    if (!Number.isSafeInteger(next) || next < 0 || next > 1e12)
      throw new Error('Monete insufficienti o importo troppo elevato.');
    if (!currencies[code].rate) {
      sheet[currencies[code].field] = next;
      return;
    }
    ['mp', 'mo', 'ma', 'mr'].forEach(function (key) {
      sheet[currencies[key].field] = Math.floor(next / currencies[key].rate);
      next %= currencies[key].rate;
    });
  }
  function product(item, source) {
    if (!item || !item.id || !item.nome) throw new Error('Oggetto non disponibile.');
    var id = String(source || 'emporio') + ':' + String(item.id);
    if (id.length > 110) throw new Error('Identificativo oggetto troppo lungo.');
    var key =
      'i' +
      Array.from(id)
        .map(function (c) {
          return c.codePointAt(0).toString(16).padStart(6, '0');
        })
        .join('');
    if (key.length > 700) throw new Error('Identificativo oggetto troppo lungo.');
    return { key: key, id: id, name: String(item.nome).slice(0, 160) };
  }
  function request(options, actor, now) {
    var kind = options.kind === 'reward' ? 'reward' : 'purchase';
    var code = currency(options.currency || 'mo');
    var quantity = options.item ? integer(options.quantity, 'Quantità') : 0;
    if (options.item && (quantity < 1 || quantity > 999))
      throw new Error('Quantità consentita: da 1 a 999.');
    var price = kind === 'purchase' ? Number(options.unitPrice) : 0;
    var coins = kind === 'reward' ? Number(options.coins || 0) : 0;
    if (kind === 'purchase' && (!options.item || amount(price, code) <= 0))
      throw new Error('Prezzo non disponibile: chiedi al master.');
    if (kind === 'reward' && !options.item && amount(coins, code) === 0)
      throw new Error('Aggiungi un oggetto o delle monete alla ricompensa.');
    amount(coins, code);
    if (amount(price, code) * quantity > 1e12) throw new Error('Importo troppo elevato.');
    var result = {
      kind: kind,
      quantity: quantity,
      unitPrice: price,
      currency: code,
      coins: coins,
      label: String(options.label || (options.item ? options.item.name : 'Ricompensa')).slice(
        0,
        160
      ),
      createdBy: actor,
      createdAt: now,
      status: 'pending',
    };
    if (options.item) result.item = options.item;
    return result;
  }
  function apply(raw, id, original, actor, now) {
    if (!raw) throw new Error('La scheda non esiste più.');
    if (original.status !== 'pending') throw new Error('Operazione già conclusa.');
    var sheet = JSON.parse(JSON.stringify(raw));
    var operation = JSON.parse(JSON.stringify(original));
    var trade = (sheet.trade = sheet.trade || {});
    trade.inventory = trade.inventory || {};
    var delta =
      operation.kind === 'purchase'
        ? -amount(operation.unitPrice, operation.currency) * operation.quantity
        : amount(operation.coins, operation.currency);
    changeMoney(sheet, operation.currency, delta);
    if (operation.item) {
      var previous = trade.inventory[operation.item.key];
      trade.inventory[operation.item.key] = {
        id: operation.item.id,
        name: operation.item.name,
        quantity: integer(previous && previous.quantity, 'Quantità') + operation.quantity,
      };
    }
    trade.version = integer(trade.version, 'Versione inventario') + 1;
    trade.lastOperation = id;
    operation.status = 'applied';
    operation.resolvedBy = actor;
    operation.resolvedAt = now;
    var receipt = {
      kind: operation.kind,
      quantity: operation.quantity,
      currency: operation.currency,
      delta: delta,
      actor: actor,
      at: now,
    };
    receipt.before = {};
    Object.values(currencies).forEach(function (currency) {
      if (raw[currency.field] != null) receipt.before[currency.field] = raw[currency.field];
    });
    if (operation.item) receipt.item = operation.item;
    return { sheet: sheet, operation: operation, receipt: receipt };
  }
  return {
    currencies: currencies,
    currency: currency,
    amount: amount,
    balance: balance,
    product: product,
    request: request,
    apply: apply,
  };
})();
