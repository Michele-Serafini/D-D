var CommerceUI = {
  target: '',
  ensureSheets: function () {
    if (isDM() || state.schedaLoaded || this.loading) return;
    this.loading = true;
    fbLoadSchede(function () {
      CommerceUI.loading = false;
      CommerceService.notify();
    });
  },
  selector: function (label, records) {
    var select = document.createElement('select');
    select.setAttribute('aria-label', label);
    records.forEach(function (record) {
      var option = document.createElement('option');
      option.value = record.username + '/' + record.id;
      option.textContent = CommerceService.label(record);
      select.appendChild(option);
    });
    if (
      records.some(function (record) {
        return record.username + '/' + record.id === CommerceUI.target;
      })
    )
      select.value = CommerceUI.target;
    else if (state.schedaAttivaId) {
      var active = records.find(function (record) {
        return record.id === state.schedaAttivaId;
      });
      if (active) select.value = active.username + '/' + active.id;
    }
    return select;
  },
  targetFor: function (value, records) {
    return records.find(function (record) {
      return record.username + '/' + record.id === value;
    });
  },
};

function renderCommerce() {
  CommerceUI.ensureSheets();
  var wrap = document.createElement('section');
  wrap.className = 'commerce-page container-main';
  wrap.innerHTML =
    '<h1 class="header-title">' +
    (isDM() ? 'Negozio e ricompense' : 'Inventario e acquisti') +
    '</h1><p class="commerce-muted">Acquisti, oggetti e monete dei personaggi della campagna.</p>';
  var body = document.createElement('div');
  wrap.appendChild(body);
  function update() {
    var records = CommerceService.characters();
    body.replaceChildren();
    if (isDM()) {
      var policy = document.createElement('label');
      policy.className = 'commerce-policy';
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = CommerceService.approval;
      checkbox.disabled = !CommerceService.ready;
      checkbox.onchange = function () {
        checkbox.disabled = true;
        CommerceService.setApproval(checkbox.checked)
          .catch(function (error) {
            notify(error.message, 'err');
          })
          .finally(update);
      };
      policy.append(
        checkbox,
        document.createTextNode('Richiedi approvazione del master per gli acquisti')
      );
      body.appendChild(policy);
    }
    if (!records.length) {
      var empty = document.createElement('p');
      empty.className = 'notice';
      empty.textContent =
        'Nessuna scheda disponibile. Crea prima un personaggio nella sezione Scheda PG.';
      body.appendChild(empty);
      return;
    }
    var select = CommerceUI.selector('Personaggio del negozio', records);
    select.onchange = function () {
      CommerceUI.target = select.value;
      select.blur();
      update();
    };
    body.appendChild(select);
    var record = CommerceUI.targetFor(select.value, records);
    body.appendChild(buildCommerceInventory(record));
    if (isDM()) {
      var reward = document.createElement('button');
      reward.className = 'btn-gold';
      reward.textContent = 'Assegna ricompensa';
      reward.onclick = function () {
        openCommerceDialog(null, 'reward', record);
      };
      body.appendChild(reward);
    }
    body.appendChild(buildCommerceOrders(isDM() ? records : [record]));
  }
  onSectionCleanup(CommerceService.subscribe(update));
  onSectionCleanup(SheetStore.subscribe(update));
  update();
  return wrap;
}

function buildCommerceInventory(record) {
  var section = document.createElement('section');
  section.className = 'commerce-panel';
  var title = document.createElement('h2');
  title.textContent = 'Inventario collegato · ' + CommerceService.label(record);
  section.appendChild(title);
  var wallet = document.createElement('p');
  wallet.className = 'commerce-wallet';
  wallet.setAttribute('aria-label', 'Monete del personaggio');
  wallet.textContent = Object.entries(CommerceModel.currencies)
    .map(function (entry) {
      return (record.sheet[entry[1].field] || 0) + ' ' + entry[1].label;
    })
    .join(' · ');
  section.appendChild(wallet);
  var inventory = Object.values((record.sheet.trade && record.sheet.trade.inventory) || {});
  var list = document.createElement('ul');
  list.className = 'commerce-inventory';
  inventory.forEach(function (item) {
    var row = document.createElement('li');
    row.textContent = item.name + ' × ' + item.quantity;
    list.appendChild(row);
  });
  section.appendChild(list);
  if (!inventory.length) {
    var empty = document.createElement('p');
    empty.className = 'commerce-muted';
    empty.textContent =
      'Gli acquisti approvati e le ricompense compariranno qui. L’equipaggiamento inserito a mano resta nella scheda.';
    section.appendChild(empty);
  }
  return section;
}

function buildCommerceSheetPanel() {
  var host = document.createElement('details');
  host.className = 'commerce-sheet-panel';
  var title = document.createElement('summary');
  title.textContent = 'Inventario, monete e acquisti';
  host.appendChild(title);
  var body = document.createElement('div');
  host.appendChild(body);
  var username = state.schedePGViewMode
    ? state.schedePGOpenChar.username
    : state.currentUser.username;
  var id = state.schedaAttivaId;
  function update() {
    var record = CommerceService.characters().find(function (entry) {
      return entry.username === username && entry.id === id;
    });
    if (!record) record = { username: username, id: id, sheet: state.scheda };
    body.replaceChildren(buildCommerceInventory(record));
    body.appendChild(buildCommerceOrders([record]));
  }
  onSectionCleanup(SheetStore.subscribe(update));
  onSectionCleanup(CommerceService.subscribe(update));
  update();
  return host;
}

function buildCommerceOrders(records) {
  var section = document.createElement('section');
  section.className = 'commerce-panel';
  section.innerHTML = '<h2>Richieste e operazioni</h2>';
  var operations = [];
  records.forEach(function (record) {
    Object.entries(CommerceService.requests[record.username]?.[record.id] || {}).forEach(
      function (entry) {
        operations.push({ id: entry[0], operation: entry[1], record: record });
      }
    );
  });
  operations.sort(function (a, b) {
    return (
      (a.operation.status !== 'pending') - (b.operation.status !== 'pending') ||
      b.operation.createdAt - a.operation.createdAt
    );
  });
  var statuses = {
    pending: 'In attesa',
    applied: 'Completata',
    rejected: 'Rifiutata',
    cancelled: 'Annullata',
  };
  operations.slice(0, 50).forEach(function (entry) {
    var operation = entry.operation;
    var row = document.createElement('article');
    row.className = 'commerce-order';
    row.dataset.operationId = entry.id;
    var text = document.createElement('p');
    text.textContent =
      CommerceService.label(entry.record) +
      ' — ' +
      (operation.kind === 'reward' ? 'Ricompensa: ' : 'Acquisto: ') +
      (operation.item ? operation.quantity + ' × ' + operation.item.name : operation.label) +
      ' · ' +
      (operation.kind === 'reward' ? operation.coins : operation.unitPrice * operation.quantity) +
      ' ' +
      operation.currency +
      ' · ' +
      statuses[operation.status];
    row.appendChild(text);
    if (operation.status === 'pending') {
      (isDM()
        ? [
            ['approve', 'Approva'],
            ['reject', 'Rifiuta'],
          ]
        : [['cancel', 'Annulla richiesta']]
      ).forEach(function (action) {
        var button = document.createElement('button');
        button.className = 'btn-dark';
        button.textContent = action[1];
        button.onclick = function () {
          row.querySelectorAll('button').forEach(function (control) {
            control.disabled = true;
          });
          CommerceService.run(entry.record, entry.id, { action: action[0] })
            .then(function () {
              notify(
                action[0] === 'approve'
                  ? 'Acquisto registrato nella scheda.'
                  : 'Richiesta aggiornata.'
              );
            })
            .catch(function (error) {
              notify(error.message, 'err');
              row.querySelectorAll('button').forEach(function (control) {
                control.disabled = false;
              });
            });
        };
        row.appendChild(button);
      });
    }
    section.appendChild(row);
  });
  if (!operations.length) section.appendChild(document.createTextNode('Nessuna operazione.'));
  return section;
}

function buildCommerceItemAction(item, source) {
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-dark commerce-buy';
  button.textContent = 'Acquista';
  button.setAttribute('aria-label', 'Acquista ' + item.nome);
  button.onclick = function (event) {
    event.stopPropagation();
    openCommerceDialog(item, 'purchase', null, source);
  };
  return button;
}
