// Immutable receipts and version checks make atomic fan-out safe under retries.
export function commerceRules({ master, owner, actor, automatic }) {
  const oldData = "root.child('campaigns').child($campaign).child('data')";
  const characterPath = ".child('schedePG').child($name).child('chars').child($character)";
  const operationPath =
    ".child('commerceRequests').child($name).child($character).child($operation)";
  const oldCharacter = oldData + characterPath;
  const oldVersion = `(${oldCharacter}.child('trade').child('version').exists() ? ${oldCharacter}.child('trade').child('version').val() : 0)`;
  const nextData = 'newData.parent().parent().parent().parent()';
  const nextCharacter = nextData + characterPath;
  const nextRequest = nextData + operationPath;
  const nextReceipt = `${nextData}.child('commerceReceipts').child($name).child($character).child($operation)`;
  const canApply = `((${master}) || ((${owner}) && (${automatic}) && ${nextRequest}.child('kind').val() === 'purchase'))`;
  const versionMatches = `${nextCharacter}.child('trade').child('version').val() === ${oldVersion} + 1 && ${nextCharacter}.child('trade').child('lastOperation').val() === $operation`;
  const resolve = `newData.child('resolvedBy').val() === (${actor}) && newData.child('resolvedAt').isNumber()`;
  const status = "newData.child('status').val()";
  const decision = `((${status} === 'applied' && ${nextReceipt}.exists() && (${versionMatches})) || (${status} === 'rejected' && (${master})) || (${status} === 'cancelled' && (${owner}))) && (${resolve})`;
  const pending = "data.child('status').val() === 'pending'";
  const unchanged = '!data.exists() || newData.val() === data.val()';
  function fixed(type) {
    return { '.validate': `(${type}) && (${unchanged})` };
  }
  const itemShape = {
    '.validate': "newData.hasChildren(['key','id','name'])",
    key: {
      '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 700',
    },
    id: {
      '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 110',
    },
    name: {
      '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 160',
    },
    $other: { '.validate': false },
  };
  const request = {
    '.write': `newData.exists() && ((!data.exists() && ((${owner}) || (${master})) && newData.child('createdBy').val() === (${actor}) && ${status} === 'pending' && (newData.child('kind').val() === 'purchase' || (${master}))) || (data.exists() && ((${pending}) && (${decision}))))`,
    '.validate': `newData.hasChildren(['kind','quantity','unitPrice','currency','coins','label','createdBy','createdAt','status']) && (data.exists() ? ((${pending}) && (${decision})) : (${status} === 'pending' && (newData.child('kind').val() === 'purchase' || (${master})))) && (newData.child('kind').val() !== 'purchase' || (newData.child('item').exists() && newData.child('quantity').val() >= 1 && newData.child('unitPrice').val() > 0)) && (newData.child('kind').val() !== 'reward' || newData.child('item').exists() || newData.child('coins').val() > 0)`,
    kind: fixed("newData.val() === 'purchase' || newData.val() === 'reward'"),
    quantity: fixed(
      'newData.isNumber() && newData.val() >= 0 && newData.val() <= 999 && newData.val() % 1 === 0'
    ),
    unitPrice: fixed('newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000000'),
    currency: fixed(
      "newData.val() === 'mr' || newData.val() === 'ma' || newData.val() === 'mo' || newData.val() === 'mp' || newData.val() === 'crediti' || newData.val() === 'berry' || newData.val() === 'poke' || newData.val() === 'ryo'"
    ),
    coins: fixed('newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000000'),
    label: fixed('newData.isString() && newData.val().length <= 160'),
    createdBy: fixed('newData.isString()'),
    createdAt: fixed('newData.isNumber() && newData.val() > 0'),
    item: {
      ...itemShape,
      '.validate': `${itemShape['.validate']} && (!data.exists() || (newData.child('key').val() === data.child('key').val() && newData.child('id').val() === data.child('id').val() && newData.child('name').val() === data.child('name').val()))`,
    },
    status: {
      '.validate':
        "newData.val() === 'pending' || newData.val() === 'applied' || newData.val() === 'rejected' || newData.val() === 'cancelled'",
    },
    resolvedBy: { '.validate': 'newData.isString()' },
    resolvedAt: { '.validate': 'newData.isNumber() && newData.val() > 0' },
    $other: { '.validate': false },
  };
  const receiptItem = `${nextCharacter}.child('trade').child('inventory').child(newData.child('item').child('key').val())`;
  const previousItem = `${oldCharacter}.child('trade').child('inventory').child(newData.child('item').child('key').val())`;
  const walletFields = ['rame', 'argento', 'oro', 'platino', 'crediti', 'berry', 'soldi', 'ryo'];
  const walletUnchanged = walletFields
    .map(
      (field) =>
        `newData.child('before').child('${field}').val() === ${oldCharacter}.child('${field}').val()`
    )
    .join(' && ');
  const receipt = {
    '.write': `!data.exists() && newData.exists() && (${canApply})`,
    '.validate': `(${walletUnchanged}) && !data.exists() && (${canApply}) && (${versionMatches}) && ${nextRequest}.child('status').val() === 'applied' && newData.hasChildren(['kind','quantity','currency','delta','actor','at']) && newData.child('actor').val() === (${actor}) && newData.child('kind').val() === ${nextRequest}.child('kind').val() && newData.child('quantity').val() === ${nextRequest}.child('quantity').val() && newData.child('currency').val() === ${nextRequest}.child('currency').val() && ((!newData.child('item').exists() && !${nextRequest}.child('item').exists()) || (newData.child('item').child('key').val() === ${nextRequest}.child('item').child('key').val() && newData.child('item').child('id').val() === ${nextRequest}.child('item').child('id').val() && newData.child('item').child('name').val() === ${nextRequest}.child('item').child('name').val())) && (!newData.child('item').exists() || (${receiptItem}.child('quantity').val() === (${previousItem}.exists() ? ${previousItem}.child('quantity').val() : 0) + newData.child('quantity').val()))`,
    kind: {},
    quantity: {},
    currency: {},
    delta: {
      '.validate':
        'newData.isNumber() && newData.val() % 1 === 0 && newData.val() >= -1000000000000 && newData.val() <= 1000000000000',
    },
    actor: {},
    at: { '.validate': 'newData.isNumber() && newData.val() > 0' },
    item: itemShape,
    before: {
      ...Object.fromEntries(walletFields.map((field) => [field, {}])),
      $other: { '.validate': false },
    },
    $other: { '.validate': false },
  };
  const tradeData = 'newData.parent().parent().parent().parent().parent()';
  const tradeReceipt = `${tradeData}.child('commerceReceipts').child($name).child($character).child(newData.child('lastOperation').val())`;
  const oldTradeReceipt = `${oldData}.child('commerceReceipts').child($name).child($character).child(newData.child('lastOperation').val())`;
  const inventoryData = 'newData.parent().parent().parent().parent().parent().parent().parent()';
  const inventoryTrade = 'newData.parent().parent()';
  const inventoryReceipt = `${inventoryData}.child('commerceReceipts').child($name).child($character).child(${inventoryTrade}.child('lastOperation').val())`;
  const trade = {
    '.validate': `(newData.child('version').isNumber() && newData.child('version').val() === (data.child('version').exists() ? data.child('version').val() : 0) + 1 && newData.child('lastOperation').isString() && !${oldTradeReceipt}.exists() && ${tradeReceipt}.exists())`,
    version: { '.validate': 'newData.isNumber() && newData.val() >= 1 && newData.val() % 1 === 0' },
    lastOperation: { '.validate': 'newData.isString() && newData.val().length <= 100' },
    inventory: {
      $item: {
        '.validate': `(${inventoryReceipt}.child('item').child('key').val() === $item && newData.child('quantity').val() === (data.exists() ? data.child('quantity').val() : 0) + ${inventoryReceipt}.child('quantity').val() && newData.child('id').val() === ${inventoryReceipt}.child('item').child('id').val() && newData.child('name').val() === ${inventoryReceipt}.child('item').child('name').val())`,
        id: { '.validate': 'newData.isString()' },
        name: { '.validate': 'newData.isString()' },
        quantity: {
          '.validate': 'newData.isNumber() && newData.val() > 0 && newData.val() % 1 === 0',
        },
        $other: { '.validate': false },
      },
    },
    $other: { '.validate': false },
  };
  return { trade, request, receipt };
}
