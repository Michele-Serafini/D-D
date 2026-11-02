/* Private campaign journal. Event refreshes never replace an edited recap. */
function renderSessionJournal() {
  var page = document.createElement('section');
  page.className = 'journal-page container-main';
  page.innerHTML =
    '<h1 class="header-title">Diario della sessione</h1><p class="journal-muted">Registro privato dei master: tiri importanti, combattimenti, ricompense e appunti.</p>';
  var controls = document.createElement('section');
  controls.className = 'journal-panel';
  controls.innerHTML = '<h2>Sessione in corso</h2><p class="journal-active" role="status"></p>';
  var name = document.createElement('input');
  name.placeholder = 'Titolo della nuova sessione';
  name.maxLength = 100;
  name.setAttribute('aria-label', 'Titolo della sessione');
  var start = document.createElement('button');
  start.className = 'btn-gold';
  start.textContent = 'Avvia sessione';
  var end = document.createElement('button');
  end.className = 'btn-dark';
  end.textContent = 'Chiudi sessione';
  var previous = document.createElement('button');
  previous.className = 'btn-dark';
  previous.textContent = 'Riepilogo della sessione precedente';
  var retry = document.createElement('button');
  retry.className = 'btn-dark';
  retry.textContent = 'Sincronizza eventi in attesa';
  var status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.className = 'journal-muted';
  controls.append(name, start, end, previous, retry, status);
  page.appendChild(controls);
  var select = document.createElement('select');
  select.setAttribute('aria-label', 'Sessione da consultare');
  page.appendChild(select);
  var notes = document.createElement('section');
  notes.className = 'journal-panel';
  notes.innerHTML =
    '<h2>Annotazione del master</h2><label>Nuova annotazione<textarea rows="3" maxlength="4000"></textarea></label>';
  var noteInput = notes.querySelector('textarea');
  var add = document.createElement('button');
  add.className = 'btn-dark';
  add.textContent = 'Aggiungi annotazione';
  notes.appendChild(add);
  page.appendChild(notes);
  var feed = document.createElement('section');
  feed.className = 'journal-panel';
  feed.innerHTML =
    '<h2>Eventi della sessione</h2><label>Filtra eventi<select><option value="all">Tutti gli eventi</option><option value="roll">Tiri importanti</option><option value="combat">Combattimenti</option><option value="reward">Ricompense</option><option value="note">Appunti del master</option></select></label><ol class="journal-events"></ol>';
  page.appendChild(feed);
  var filter = feed.querySelector('select'),
    list = feed.querySelector('ol');
  var summary = document.createElement('section');
  summary.className = 'journal-panel';
  summary.innerHTML =
    '<h2>Riepilogo da preparare</h2><p class="journal-muted">Bozza privata e modificabile, preparata dagli eventi registrati.</p><label>Riepilogo della sessione<textarea rows="14" maxlength="200000"></textarea></label><p class="journal-draft-status" role="status"></p>';
  var text = summary.querySelector('textarea'),
    draftStatus = summary.querySelector('[role="status"]');
  var generate = document.createElement('button');
  generate.className = 'btn-dark';
  generate.textContent = 'Prepara riepilogo';
  var save = document.createElement('button');
  save.className = 'btn-gold';
  save.textContent = 'Salva riepilogo';
  var download = document.createElement('button');
  download.className = 'btn-dark';
  download.textContent = 'Scarica riepilogo';
  summary.append(generate, save, download);
  page.appendChild(summary);
  var wasQueued = false;
  var selected = null,
    events = {},
    reference = null,
    handler = null,
    disposed = false,
    busy = false,
    loaded = false;
  function draftKey(id) {
    return CampaignManager.storageKey() + ':journal-summary:' + id;
  }
  function localDraft(id) {
    try {
      return localStorage.getItem(draftKey(id));
    } catch (_error) {
      return null;
    }
  }
  function saveLocal() {
    if (selected)
      try {
        localStorage.setItem(draftKey(selected), text.value);
        draftStatus.textContent = 'Bozza locale da salvare';
      } catch (_error) {
        draftStatus.textContent = 'Salva la bozza prima di chiudere la pagina.';
      }
  }
  function renderEvents() {
    list.replaceChildren();
    JournalModel.ordered(events)
      .reverse()
      .filter(function (entry) {
        return (
          filter.value === 'all' ||
          entry.kind === filter.value ||
          (filter.value === 'note' && entry.kind === 'checkpoint')
        );
      })
      .forEach(function (entry) {
        var row = document.createElement('li');
        row.className = 'journal-event';
        row.dataset.eventId = entry.id;
        var title = document.createElement('h3');
        title.textContent = entry.title;
        var time = document.createElement('p');
        time.className = 'journal-muted';
        time.textContent = new Date(entry.at).toLocaleString('it-IT') + ' · ' + entry.author;
        var body = document.createElement('p');
        body.className = 'journal-event-body';
        body.textContent = entry.body;
        row.append(title, time, body);
        list.appendChild(row);
      });
    if (!list.children.length) list.textContent = 'Nessun evento registrato per questa selezione.';
  }
  function choose(id) {
    if (reference) reference.off('value', handler);
    selected = id;
    select.value = id || '';
    events = {};
    loaded = false;
    text.value = '';
    renderEvents();
    refreshButtons();
    if (!id) return;
    reference = _campaignDb.ref('sessionJournal/events/' + id);
    handler = reference.on(
      'value',
      function (snapshot) {
        events = snapshot.val() || {};
        loaded = true;
        renderEvents();
        refreshButtons();
      },
      function () {
        status.textContent = 'Impossibile caricare gli eventi.';
      }
    );
    var local = localDraft(id);
    if (local !== null) {
      text.value = local;
      draftStatus.textContent = 'Bozza locale recuperata';
    } else draftStatus.textContent = 'Caricamento riepilogo…';
    _campaignDb
      .ref('sessionJournal/drafts/' + id)
      .once('value')
      .then(function (snapshot) {
        if (disposed || selected !== id || localDraft(id) !== null) return;
        text.value = (snapshot.val() && snapshot.val().text) || '';
        draftStatus.textContent = snapshot.exists()
          ? 'Riepilogo salvato'
          : 'Nessun riepilogo salvato';
      })
      .catch(function () {
        if (selected === id) draftStatus.textContent = 'Caricamento della bozza non riuscito.';
      });
  }
  function sessions() {
    return Object.entries(SessionJournal.control.sessions || {}).sort(function (a, b) {
      return b[1].startedAt - a[1].startedAt;
    });
  }
  function refreshButtons() {
    retry.disabled = busy || !SessionJournal.ready || !Object.keys(SessionJournal.queue).length;
    start.disabled = busy || !SessionJournal.ready || !!SessionJournal.active;
    name.disabled = start.disabled;
    end.disabled = busy || !SessionJournal.active;
    previous.disabled =
      busy ||
      !sessions().some(function (entry) {
        return !!entry[1].endedAt;
      });
    [generate, save, download, add].forEach(function (button) {
      button.disabled = busy || !selected || !loaded;
    });
  }
  function refresh() {
    var choices = sessions(),
      existing = selected;
    select.replaceChildren();
    choices.forEach(function (entry) {
      var option = document.createElement('option');
      option.value = entry[0];
      option.textContent = entry[1].title + (entry[1].endedAt ? ' · conclusa' : ' · in corso');
      select.appendChild(option);
    });
    var current = SessionJournal.active && SessionJournal.control.sessions[SessionJournal.active];
    controls.querySelector('.journal-active').textContent = current
      ? current.title
      : 'Nessuna sessione in corso. Avviane una per registrare gli eventi automaticamente.';
    var queued = Object.keys(SessionJournal.queue).length;
    if (queued)
      status.textContent = queued + ' eventi conservati in locale, in attesa di sincronizzazione.';
    else if (wasQueued) status.textContent = 'Diario sincronizzato';
    wasQueued = queued > 0;
    if (!existing && choices.length) choose(SessionJournal.active || choices[0][0]);
    else select.value = existing || '';
    refreshButtons();
  }
  async function perform(action) {
    busy = true;
    status.textContent = '';
    refreshButtons();
    try {
      return await UserManager.withTimeout(action());
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      if (!disposed) refreshButtons();
    }
  }
  function prepare() {
    var meta = SessionJournal.control.sessions[selected];
    if (!meta || !loaded) return;
    if (text.value && !confirm('Sostituire la bozza con un nuovo riepilogo dagli eventi?')) return;
    var value = JournalModel.recap(meta, events);
    if (value.length > 200000) {
      draftStatus.textContent = 'Il riepilogo supera il limite: prepara una bozza più breve.';
      return;
    }
    text.value = value;
    saveLocal();
  }
  start.onclick = function () {
    perform(async function () {
      var id = await SessionJournal.start(name.value);
      choose(id);
      name.value = '';
    });
  };
  retry.onclick = function () {
    perform(function () {
      return SessionJournal.flush();
    });
  };
  end.onclick = function () {
    perform(async function () {
      var id = await SessionJournal.end();
      choose(id);
    });
  };
  previous.onclick = function () {
    var last = sessions().find(function (entry) {
      return entry[1].endedAt;
    });
    if (last) {
      choose(last[0]);
      status.textContent =
        'Sessione precedente selezionata. Premi Prepara riepilogo per generare la bozza.';
    }
  };
  select.onchange = function () {
    choose(select.value);
  };
  filter.onchange = renderEvents;
  text.oninput = saveLocal;
  generate.onclick = prepare;
  save.onclick = function () {
    var id = selected,
      value = text.value;
    perform(async function () {
      await _campaignDb
        .ref('sessionJournal/drafts/' + id)
        .set({ text: value, updatedAt: Date.now(), updatedBy: state.currentUser.username });
      if (localDraft(id) === value)
        try {
          localStorage.removeItem(draftKey(id));
        } catch (_error) {
          /* The server has confirmed the draft. */
        }
      if (selected === id)
        draftStatus.textContent =
          localDraft(id) === null ? 'Riepilogo salvato' : 'Modifiche successive da salvare';
    });
  };
  download.onclick = function () {
    triggerDownload(
      new Blob([text.value], { type: 'text/markdown;charset=utf-8' }),
      'riepilogo-sessione.md'
    );
  };
  add.onclick = function () {
    if (!noteInput.value.trim()) return;
    var id = selected,
      value = noteInput.value;
    perform(async function () {
      await SessionJournal.capture(
        JournalModel.event(
          'note_' + crypto.randomUUID(),
          'note',
          'Annotazione del master',
          value,
          state.currentUser.username,
          Date.now()
        ),
        id
      );
      if (noteInput.value === value) noteInput.value = '';
    });
  };
  onSectionCleanup(SessionJournal.subscribe(refresh));
  onSectionCleanup(function () {
    disposed = true;
    if (reference) reference.off('value', handler);
  });
  refresh();
  return page;
}
