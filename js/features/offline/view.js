function buildSheetSyncStatus() {
  var banner = document.createElement('div');
  banner.className = 'sheet-sync-status';
  var text = document.createElement('span');
  text.setAttribute('role', 'status');
  var open = document.createElement('button');
  open.className = 'btn-dark';
  open.textContent = 'Telefono e offline';
  open.onclick = function () {
    state.section = 'telefono';
    renderMain();
  };
  banner.append(text, open);
  function update() {
    var count = OfflineSheets.operations.length;
    if (OfflineSheets.localError)
      text.textContent = 'Schede: salvataggio locale non riuscito. ' + OfflineSheets.localError;
    else if (!OfflineSheets.ready)
      text.textContent =
        'Schede: copia offline non disponibile. ' +
        (OfflineSheets.connected ? 'Salvataggio online disponibile.' : OfflineSheets.error);
    else if (OfflineSheets.dirty || OfflineSheets.staging.size)
      text.textContent = 'Schede: salvataggio locale in corso…';
    else if (count)
      text.textContent =
        'Schede: ' +
        count +
        ' modifiche sul dispositivo, ancora da sincronizzare' +
        (OfflineSheets.connected ? '.' : ' · offline.');
    else
      text.textContent = OfflineSheets.connected
        ? 'Schede sincronizzate con Firebase'
        : 'Offline · consulta le schede salvate sul dispositivo';
    banner.dataset.pending = String(
      count > 0 || !!OfflineSheets.dirty || !!OfflineSheets.staging.size || !OfflineSheets.ready
    );
  }
  onSectionCleanup(OfflineSheets.subscribe(update));
  update();
  return banner;
}

function renderPhoneOffline() {
  var page = document.createElement('section');
  page.className = 'phone-page container-main';
  page.innerHTML =
    '<h1 class="header-title">Telefono e offline</h1><p>Installa il sito per aprirlo dalla schermata Home. Le copie offline delle schede sono consultabili senza rete; per modificarle riapri il sito con la connessione.</p>';
  var status = document.createElement('p');
  status.setAttribute('role', 'status');
  page.appendChild(status);
  var install = document.createElement('button');
  install.className = 'btn-gold';
  install.textContent = 'Installa sul telefono';
  install.onclick = async function () {
    status.textContent =
      (await PhoneApp.install()) || 'Segui le indicazioni del browser per installare il sito.';
  };
  var installState = document.createElement('p');
  function phoneState() {
    install.disabled = PhoneApp.state.installed;
    installState.textContent = PhoneApp.state.installed
      ? 'Il sito è aperto come app installata.'
      : PhoneApp.state.ready
        ? 'Accesso offline pronto sul browser.'
        : PhoneApp.state.error || 'Preparazione dell’accesso offline…';
    if (prepare) update();
  }
  page.append(install, installState);
  var description = document.createElement('p');
  description.textContent =
    'Le copie sono leggibili senza login su questo browser: usa un dispositivo personale. Esci dall’account per bloccare l’accesso dalla vista offline. Questa copia include le schede a cui hai accesso nella campagna corrente.';
  page.appendChild(description);
  var saved = document.createElement('p');
  page.appendChild(saved);
  var prepare = document.createElement('button');
  prepare.className = 'btn-gold';
  prepare.textContent = 'Prepara schede offline';
  var forget = document.createElement('button');
  forget.className = 'btn-dark';
  forget.textContent = 'Rimuovi copia offline';
  var retry = document.createElement('button');
  retry.className = 'btn-dark';
  retry.textContent = 'Sincronizza adesso';
  var link = document.createElement('a');
  link.href = 'offline.html';
  link.className = 'btn-dark';
  link.textContent = 'Apri schede offline';
  page.append(prepare, forget, retry, link);
  var notes = document.createElement('p');
  notes.textContent =
    'La copia mostra data e stato di salvataggio. Aggiornala prima di andare offline. Le immagini esterne possono richiedere rete. Lo stato di sincronizzazione riguarda le schede; acquisti, ricompense e ripristini richiedono una connessione.';
  page.appendChild(notes);
  var operations = document.createElement('div');
  page.appendChild(operations);
  var busy = false,
    disposed = false;
  async function action(task, message) {
    busy = true;
    update();
    status.textContent = '';
    try {
      await UserManager.withTimeout(task(), 30000);
      if (!disposed) status.textContent = message || '';
    } catch (error) {
      if (!disposed) status.textContent = error.message;
    } finally {
      busy = false;
      if (!disposed) update();
    }
  }
  prepare.onclick = function () {
    action(function () {
      return OfflineSheets.prepare();
    }, 'Schede salvate sul dispositivo. Puoi aprire la vista offline.');
  };
  forget.onclick = function () {
    action(function () {
      return OfflineSheets.forget();
    }, 'Copia offline rimossa da questo dispositivo.');
  };
  retry.onclick = function () {
    action(function () {
      return OfflineSheets.flush();
    }, 'Controllo di sincronizzazione completato.');
  };
  function update() {
    var snapshot = OfflineSheets.snapshot;
    saved.textContent = snapshot
      ? Object.keys(snapshot.sheets).length +
        ' schede · copia del ' +
        new Date(snapshot.savedAt).toLocaleString('it-IT')
      : 'Nessuna copia delle schede preparata su questo dispositivo.';
    prepare.textContent = snapshot ? 'Aggiorna schede offline' : 'Prepara schede offline';
    prepare.disabled =
      busy || !OfflineSheets.ready || !OfflineSheets.connected || !PhoneApp.state.ready;
    forget.disabled = busy || !snapshot || OfflineSheets.operations.length > 0;
    retry.disabled = busy || !OfflineSheets.connected || !OfflineSheets.operations.length;
    link.hidden = !snapshot;
    operations.replaceChildren();
    if (OfflineSheets.error || OfflineSheets.localError) {
      var error = document.createElement('p');
      error.textContent = OfflineSheets.localError || OfflineSheets.error;
      operations.appendChild(error);
    }
    OfflineSheets.operations.forEach(function (op) {
      var card = document.createElement('article');
      card.className = 'offline-operation';
      var title = document.createElement('h2');
      title.textContent =
        (op.before.nomePersonaggio || op.before.nome || op.character) +
        ' · modifiche non sincronizzate';
      var body = document.createElement('p');
      body.textContent =
        op.error ||
        (OfflineSheets.connected
          ? 'In attesa della conferma di Firebase.'
          : 'Conservate sul dispositivo. Verranno inviate alla riconnessione.');
      card.append(title, body);
      if (op.conflicts?.length) {
        var fields = document.createElement('p');
        fields.textContent =
          'Campi cambiati online: ' + op.conflicts.map(SheetHistoryModel.label).join(', ');
        card.appendChild(fields);
      }
      var detail = document.createElement('details'),
        summary = document.createElement('summary'),
        pre = document.createElement('pre');
      summary.textContent = 'Modifiche locali';
      function display(value) {
        if (typeof value === 'string' && value.startsWith('data:image/'))
          return '(immagine conservata sul dispositivo)';
        var text =
          value == null
            ? '(vuoto)'
            : typeof value === 'object'
              ? JSON.stringify(value, null, 2)
              : String(value);
        return text.length > 1500
          ? text.slice(0, 1500) + '… (esporta la copia per il contenuto completo)'
          : text;
      }
      pre.textContent = Object.entries(op.patch)
        .map(function (entry) {
          return (
            SheetHistoryModel.label(entry[0]) +
            '\nLocale: ' +
            display(entry[1]) +
            (op.remote ? '\nOnline: ' + display(op.remote[entry[0]]) : '')
          );
        })
        .join('\n\n');
      detail.append(summary, pre);
      card.appendChild(detail);
      var exportButton = document.createElement('button');
      exportButton.className = 'btn-dark';
      exportButton.textContent = 'Esporta copia locale';
      exportButton.onclick = function () {
        triggerDownload(
          new Blob([JSON.stringify(OfflineModel.apply(op.before, op.patch), null, 2)], {
            type: 'application/json',
          }),
          'scheda-locale.json'
        );
      };
      var discard = document.createElement('button');
      discard.className = 'btn-dark';
      discard.textContent = 'Mantieni dati online e scarta questa modifica';
      discard.disabled = busy || !!OfflineSheets.flushing || !OfflineSheets.connected;
      discard.onclick = function () {
        action(function () {
          return OfflineSheets.resolve(op.id, false);
        });
      };
      card.append(exportButton, discard);
      if (op.conflicts?.length) {
        var apply = document.createElement('button');
        apply.className = 'btn-gold';
        apply.textContent = 'Applica le mie modifiche ai campi indicati';
        apply.disabled = busy || !OfflineSheets.connected;
        apply.onclick = function () {
          action(function () {
            return OfflineSheets.resolve(op.id, true);
          });
        };
        card.appendChild(apply);
      }
      operations.appendChild(card);
    });
  }
  onSectionCleanup(function () {
    disposed = true;
  });
  onSectionCleanup(OfflineSheets.subscribe(update));
  onSectionCleanup(PhoneApp.subscribe(phoneState));
  update();
  phoneState();
  return page;
}
