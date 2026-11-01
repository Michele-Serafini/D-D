/* Purchase and reward form. One stable operation ID is reused on retries. */
async function openCommerceDialog(item, kind, initialRecord, source) {
  document.getElementById('commerce-dialog')?.remove();
  if (!isDM() && !state.schedaLoaded)
    await new Promise(function (resolve) {
      fbLoadSchede(resolve);
    });
  var records = CommerceService.characters();
  var overlay = document.createElement('div');
  overlay.id = 'commerce-dialog';
  overlay.className = 'modal-backdrop';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'commerce-dialog-title');
  var form = document.createElement('form');
  form.className = 'commerce-dialog modal-panel';
  form.innerHTML =
    '<h2 id="commerce-dialog-title">' +
    (kind === 'reward' ? 'Assegna ricompensa' : 'Acquista oggetto') +
    '</h2>';
  var close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-dark';
  close.textContent = 'Chiudi';
  function dismiss() {
    overlay.remove();
    document.removeEventListener('keydown', escape);
  }
  function escape(event) {
    if (event.key === 'Escape') dismiss();
  }
  close.onclick = dismiss;
  overlay.onclick = function (event) {
    if (event.target === overlay) dismiss();
  };
  document.addEventListener('keydown', escape);
  onSectionCleanup(dismiss);
  var select = CommerceUI.selector('Personaggio destinatario', records);
  if (initialRecord) select.value = initialRecord.username + '/' + initialRecord.id;
  form.appendChild(select);
  var status = document.createElement('p');
  status.setAttribute('role', 'status');
  function field(label, type, value) {
    var holder = document.createElement('label');
    holder.textContent = label;
    var input = document.createElement('input');
    input.type = type;
    input.value = value;
    holder.appendChild(input);
    form.appendChild(holder);
    return input;
  }
  var product = item ? CommerceModel.product(item, source) : null;
  if (item) {
    var name = document.createElement('p');
    name.textContent = item.nome;
    form.appendChild(name);
  }
  var quantity = item ? field('Quantità', 'number', 1) : null;
  if (quantity) {
    quantity.min = '1';
    quantity.max = '999';
    quantity.required = true;
  }
  var price = Number(item && (item.prezzo ?? item.costo));
  var currency = String((item && item.valuta) || 'mo').toLowerCase();
  var reason = kind === 'reward' ? field('Motivo della ricompensa', 'text', '') : null;
  var coins = kind === 'reward' ? field('Monete da assegnare', 'number', 0) : null;
  if (coins) {
    coins.min = '0';
    coins.step = '0.01';
  }
  var moneySelect = document.createElement('select');
  moneySelect.setAttribute('aria-label', 'Valuta della ricompensa');
  Object.entries(CommerceModel.currencies).forEach(function (entry) {
    var option = document.createElement('option');
    option.value = entry[0];
    option.textContent = entry[1].label;
    moneySelect.appendChild(option);
  });
  moneySelect.value = 'mo';
  if (kind === 'reward') form.appendChild(moneySelect);
  var description = document.createElement('p');
  description.className = 'commerce-muted';
  description.textContent =
    kind === 'purchase'
      ? 'Prezzo unitario: ' +
        (price > 0 ? price + ' ' + currency : 'non disponibile') +
        '. ' +
        (CommerceService.approval && !isDM()
          ? 'Il master approverà prima di scalare le monete.'
          : 'Le monete saranno scalate subito.') +
        ' Cambio automatico fra rame, argento, oro e platino.'
      : 'Oggetti e monete vengono aggiunti insieme alla scheda scelta.';
  form.appendChild(description);
  if (kind === 'purchase' && isDM() && item) {
    var give = document.createElement('button');
    give.type = 'button';
    give.className = 'btn-dark';
    give.textContent = 'Assegna questo oggetto come ricompensa';
    give.onclick = function () {
      dismiss();
      openCommerceDialog(item, 'reward', CommerceUI.targetFor(select.value, records), source);
    };
    form.appendChild(give);
  }
  var submit = document.createElement('button');
  submit.className = 'btn-gold';
  submit.type = 'submit';
  submit.textContent = kind === 'reward' ? 'Conferma ricompensa' : 'Conferma acquisto';
  submit.disabled =
    !records.length || !CommerceService.ready || (kind === 'purchase' && !(price > 0));
  if (!records.length) status.textContent = 'Crea prima una scheda personaggio.';
  form.append(status, submit, close);
  var id = CommerceService.operationId(),
    command = null,
    target = null;
  form.onsubmit = async function (event) {
    event.preventDefault();
    if (submit.disabled) return;
    if (!command) {
      target = CommerceUI.targetFor(select.value, records);
      command = {
        action: 'submit',
        kind: kind,
        item: product,
        quantity: quantity ? Number(quantity.value) : 0,
        unitPrice: price,
        currency: kind === 'reward' ? moneySelect.value : currency,
        coins: coins ? Number(coins.value) : 0,
        label: reason ? reason.value : '',
      };
      form.querySelectorAll('input, select').forEach(function (input) {
        input.disabled = true;
      });
    }
    submit.disabled = true;
    status.textContent = 'Salvataggio…';
    try {
      await CommerceService.run(target, id, command);
      status.textContent =
        'Operazione registrata. Consulta Inventario e acquisti per seguirne lo stato.';
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
      submit.textContent = 'Riprova la stessa operazione';
    }
  };
  overlay.appendChild(form);
  document.body.appendChild(overlay);
  select.focus();
}
