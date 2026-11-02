/* One history view for every sheet system, the owner and campaign masters. */
var SheetHistoryUI = { target: '' };
function buildSheetHistoryButton() {
  var button = document.createElement('button');
  button.className = 'btn-dark sheet-history-shortcut';
  button.textContent = 'Storico e ripristino';
  button.onclick = function () {
    var username = state.schedePGViewMode
      ? state.schedePGOpenChar.username
      : state.currentUser.username;
    SheetHistoryUI.target = username + '/' + state.schedaAttivaId;
    state.section = 'storico-schede';
    renderMain();
  };
  return button;
}
function renderSheetHistory() {
  CommerceUI.ensureSheets();
  var page = document.createElement('section');
  page.className = 'sheet-history container-main';
  page.innerHTML =
    '<h1 class="header-title">Storico e ripristino</h1><p>Versioni delle schede della campagna, con autore e modifiche. Lo storico parte dal primo salvataggio con questa funzione.</p>';
  var select = document.createElement('select');
  select.setAttribute('aria-label', 'Personaggio dello storico');
  var refresh = document.createElement('button');
  refresh.className = 'btn-dark';
  refresh.textContent = 'Aggiorna storico';
  var status = document.createElement('p');
  status.setAttribute('role', 'status');
  var body = document.createElement('div');
  body.className = 'sheet-history-layout';
  page.append(select, refresh, status, body);
  var disposed = false,
    token = 0,
    limit = 30,
    busy = false,
    record = null;
  var data = null,
    entries = {},
    selected = null,
    reference = null,
    handler = null;
  var kinds = {
    create: 'Creazione',
    edit: 'Modifica',
    restore: 'Ripristino',
    purchase: 'Acquisto',
    reward: 'Ricompensa',
  };
  function valueText(value) {
    if (value == null) return 'Campo assente';
    if (typeof value === 'string') return value || '(vuoto)';
    return JSON.stringify(value, null, 2);
  }
  function table(before, after, left, right) {
    var holder = document.createElement('div');
    holder.className = 'sheet-history-diff';
    Object.keys(after).forEach(function (path) {
      var item = document.createElement('article');
      var title = document.createElement('h3');
      title.textContent = SheetHistoryModel.label(path);
      var values = document.createElement('div');
      values.className = 'sheet-history-values';
      [
        [left, before[path]],
        [right, after[path]],
      ].forEach(function (pair) {
        var part = document.createElement('section');
        var label = document.createElement('h4');
        label.textContent = pair[0];
        var text = document.createElement('pre');
        text.textContent = valueText(pair[1]);
        part.append(label, text);
        values.appendChild(part);
      });
      item.append(title, values);
      holder.appendChild(item);
    });
    return holder;
  }
  function draw() {
    body.replaceChildren();
    if (!data || !data.sheet) {
      body.textContent = 'Nessuna scheda disponibile.';
      return;
    }
    var ordered = SheetHistoryModel.ordered(entries);
    if (!ordered.length) {
      body.textContent = 'Nessuna modifica registrata. I prossimi salvataggi appariranno qui.';
      return;
    }
    var timeline = document.createElement('nav');
    timeline.className = 'sheet-history-timeline';
    timeline.setAttribute('aria-label', 'Versioni della scheda');
    function versionButton(version, title, entry) {
      var button = document.createElement('button');
      button.className = 'btn-dark';
      button.setAttribute('aria-pressed', String(selected === version));
      button.textContent =
        'Versione ' +
        version +
        ' · ' +
        title +
        (entry ? '\n' + entry.actor + ' · ' + new Date(entry.at).toLocaleString('it-IT') : '');
      button.onclick = function () {
        selected = version;
        draw();
      };
      button.disabled = busy;
      timeline.appendChild(button);
    }
    ordered
      .slice()
      .reverse()
      .forEach(function (entry) {
        versionButton(entry.version, kinds[entry.kind] || entry.kind, entry);
      });
    if (ordered[0].version === 1 && ordered[0].kind !== 'create')
      versionButton(0, 'Prima della prima modifica');
    if (ordered[0].version > 1) {
      var more = document.createElement('button');
      more.className = 'btn-dark';
      more.textContent = 'Carica versioni precedenti';
      more.disabled = busy;
      more.onclick = function () {
        limit += 30;
        load();
      };
      timeline.appendChild(more);
    }
    var detail = document.createElement('section');
    detail.className = 'sheet-history-detail';
    var entry = ordered.find(function (item) {
      return item.version === selected;
    });
    var title = document.createElement('h2');
    title.textContent =
      'Versione ' + selected + (selected === data.head.version ? ' · attuale' : '');
    detail.appendChild(title);
    if (entry) {
      var description = document.createElement('p');
      description.textContent =
        kinds[entry.kind] +
        ' di ' +
        entry.actor +
        ' · ' +
        new Date(entry.at).toLocaleString('it-IT') +
        (entry.kind === 'restore' ? ' · dalla versione ' + entry.source : '');
      detail.append(
        description,
        table(JSON.parse(entry.before), JSON.parse(entry.after), 'Prima', 'Dopo')
      );
    } else
      detail.appendChild(
        document.createTextNode('Stato precedente alla prima modifica registrata.')
      );
    if (selected < data.head.version) {
      var preview = document.createElement('button');
      preview.className = 'btn-gold';
      preview.textContent = 'Anteprima ripristino';
      preview.disabled = busy;
      var previewArea = document.createElement('div');
      preview.onclick = function () {
        previewArea.replaceChildren();
        try {
          var restored = SheetHistoryModel.restore(data.sheet, entries, selected, data.head);
          var delta = SheetHistoryModel.diff(data.sheet, restored);
          var notice = document.createElement('p');
          notice.textContent =
            'Il ripristino crea una nuova versione. Gli oggetti del negozio restano attuali; anche le monete restano attuali se ci sono acquisti o ricompense successivi.';
          previewArea.append(
            notice,
            table(delta.before, delta.after, 'Attuale', 'Dopo il ripristino')
          );
          if (!Object.keys(delta.after).length) {
            previewArea.appendChild(
              document.createTextNode('I dati ripristinabili coincidono già con quelli attuali.')
            );
            return;
          }
          var confirm = document.createElement('button');
          confirm.className = 'btn-gold';
          confirm.textContent = 'Conferma ripristino';
          confirm.onclick = async function () {
            busy = true;
            confirm.disabled = true;
            body.querySelectorAll('button').forEach(function (button) {
              button.disabled = true;
            });
            refresh.disabled = select.disabled = true;
            status.textContent = 'Ripristino in corso…';
            try {
              await UserManager.withTimeout(
                SheetHistory.restore(record.username, record.id, entries, selected, data.head)
              );
              await load();
              if (!disposed)
                status.textContent =
                  'Scheda ripristinata. La versione precedente è conservata nello storico.';
            } catch (error) {
              if (!disposed) status.textContent = error.message;
            } finally {
              busy = false;
              if (!disposed) {
                refresh.disabled = select.disabled = false;
                draw();
              }
            }
          };
          previewArea.appendChild(confirm);
        } catch (error) {
          status.textContent = error.message;
        }
      };
      detail.append(preview, previewArea);
    }
    body.append(timeline, detail);
  }
  async function load() {
    if (!record) return;
    var request = ++token,
      target = record;
    refresh.disabled = true;
    status.textContent = 'Caricamento storico…';
    if (reference) reference.off('value', handler);
    try {
      if (state.schedaAttivaId && !state.schedePGViewMode) await fbSaveScheda(true);
      var loaded = await UserManager.withTimeout(
        Promise.all([
          SheetHistory.read(target.username, target.id),
          _campaignDb
            .ref(SheetHistory.paths(target.username, target.id).history + '/entries')
            .orderByChild('version')
            .limitToLast(limit)
            .once('value'),
        ])
      );
      if (disposed || request !== token) return;
      data = loaded[0];
      entries = loaded[1].val() || {};
      selected = data.head.version;
      status.textContent = '';
      draw();
      reference = _campaignDb.ref(SheetHistory.paths(target.username, target.id).history + '/head');
      handler = reference.on('value', function (snapshot) {
        if (disposed || request !== token) return;
        if (snapshot.val()?.revision !== data.head.revision) {
          status.textContent =
            'La scheda è cambiata. Premi Aggiorna storico per vedere le nuove modifiche.';
          body.querySelectorAll('button').forEach(function (button) {
            button.disabled = true;
          });
        }
      });
    } catch (error) {
      if (!disposed && request === token) status.textContent = error.message;
    } finally {
      if (!disposed && request === token) refresh.disabled = false;
    }
  }
  function characters() {
    var records = CommerceService.characters(),
      old = select.value;
    select.replaceChildren();
    records.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item.username + '/' + item.id;
      option.textContent = CommerceService.label(item);
      select.appendChild(option);
    });
    var desired = old || SheetHistoryUI.target;
    if (
      records.some(function (item) {
        return item.username + '/' + item.id === desired;
      })
    )
      select.value = desired;
    var target = records.find(function (item) {
      return item.username + '/' + item.id === select.value;
    });
    if (!record || record.username !== target?.username || record.id !== target?.id) {
      record = target;
      data = null;
      limit = 30;
      if (record) load();
      else {
        token++;
        if (reference) reference.off('value', handler);
        draw();
      }
    }
  }
  select.onchange = function () {
    SheetHistoryUI.target = select.value;
    record = null;
    characters();
  };
  refresh.onclick = load;
  onSectionCleanup(SheetStore.subscribe(characters));
  onSectionCleanup(CommerceService.subscribe(characters));
  onSectionCleanup(function () {
    disposed = true;
    token++;
    if (reference) reference.off('value', handler);
  });
  characters();
  return page;
}
