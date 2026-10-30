/* NOTE */
function renderNote() {
  var wrap = document.createElement('div');

  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';
  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  top.innerHTML =
    '<div><div class="header-eyebrow mb-3"><span>Tomo del Cronista</span></div><h1 class="header-title">Note di Sessione</h1><p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Il diario del Dungeon Master \u2014 annotazioni, eventi, intrighi</p></div>';

  var actions = document.createElement('div');
  actions.className = 'flex flex-wrap items-center gap-2';
  var exp = document.createElement('button');
  exp.className = 'btn-gold';
  exp.innerHTML = ICON.download + ' Esporta Note (.txt)';
  exp.onclick = exportNotes;
  actions.appendChild(exp);
  var clr = document.createElement('button');
  clr.className = 'btn-blood';
  clr.innerHTML = ICON.trash + ' Cancella';
  clr.onclick = clearNotes;
  actions.appendChild(clr);
  top.appendChild(actions);
  hc.appendChild(top);

  var fd = document.createElement('div');
  fd.className = 'filigree-divider mt-7';
  hc.appendChild(fd);

  var notice = document.createElement('div');
  notice.className = 'notice mt-5';
  notice.innerHTML =
    '<strong style="color:var(--gold);font-style:normal;">\u{1F4DC} Promemoria del Cronista: </strong>le note vivono nella memoria del browser solo finch&eacute; la pagina &egrave; aperta. Premi <em>"Esporta Note (.txt)"</em> per scaricare il file. I dati permangono cambiando sezione, ma non sopravvivono alla chiusura del browser.';
  hc.appendChild(notice);
  header.appendChild(hc);
  wrap.appendChild(header);

  var section = document.createElement('section');
  section.style.cssText = 'max-width:1100px;margin:0 auto;padding:2rem 1rem 4rem;';
  var toolbar = document.createElement('div');
  toolbar.className = 'notes-toolbar';
  toolbar.id = 'notes-toolbar';
  section.appendChild(toolbar);

  var ta = document.createElement('textarea');
  ta.className = 'notes-area';
  ta.id = 'notes-area';
  ta.value = state.notes;
  ta.placeholder =
    "Inizia a scrivere il resoconto della sessione...\n\nEsempi di cosa annotare:\n- Eventi chiave e svolte narrative\n- Decisioni dei personaggi e loro conseguenze\n- Indizi e segreti rivelati o ancora celati\n- Tesoro e XP assegnati\n- NPC incontrati e loro reazioni\n- Idee per la prossima sessione\n\nQuando hai finito, premi 'Esporta Note (.txt)' per scaricare il file sulla chiavetta.";
  ta.spellcheck = true;
  ta.oninput = function () {
    state.notes = this.value;
    updateNotesStats();
    // Debounce Firebase save per evitare troppi write durante la scrittura
    if (ta._fbTimer) clearTimeout(ta._fbTimer);
    ta._fbTimer = setTimeout(function () {
      fbSaveNotes();
    }, 1500);
  };
  section.appendChild(ta);

  var stats = document.createElement('div');
  stats.className = 'notes-stats';
  stats.id = 'notes-stats';
  section.appendChild(stats);

  wrap.appendChild(section);

  setTimeout(updateNotesStats, 0);
  return wrap;
}

function computeNoteStats() {
  var text = state.notes || '';
  var chars = text.length;
  var words = text.trim() ? text.trim().split(/\s+/).length : 0;
  var lines = text ? text.split('\n').length : 0;
  return { chars: chars, words: words, lines: lines };
}

function updateNotesStats() {
  saveToStorage();
  var s = computeNoteStats();
  var tb = document.getElementById('notes-toolbar');
  if (tb) {
    tb.innerHTML =
      '<div class="notes-meta">' +
      '<span>\u{1F4D6} IL TUO DIARIO</span>' +
      '<span class="dot"></span>' +
      '<span><strong>' +
      s.words +
      '</strong> parole</span>' +
      '<span class="dot"></span>' +
      '<span><strong>' +
      s.chars +
      '</strong> caratteri</span>' +
      '<span class="dot"></span>' +
      '<span><strong>' +
      s.lines +
      '</strong> righe</span>' +
      '</div>' +
      '<div class="font-script italic" style="font-size:14px;color:var(--text-muted);">' +
      (state.notes && state.notes.trim() ? 'Scribendo...' : 'Foglio bianco in attesa') +
      '</div>';
  }
  var st = document.getElementById('notes-stats');
  if (st) {
    st.innerHTML =
      '<span>\u269C STATO: <strong>' +
      (state.notes && state.notes.trim() ? 'BOZZA IN CORSO' : 'VUOTO') +
      '</strong></span><span>\u269C FILE: <strong>note_sessione_[data].txt</strong></span>';
  }
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}
function formatDateForFile() {
  var d = new Date();
  return (
    d.getFullYear() +
    '-' +
    pad2(d.getMonth() + 1) +
    '-' +
    pad2(d.getDate()) +
    '_' +
    pad2(d.getHours()) +
    '-' +
    pad2(d.getMinutes())
  );
}
function formatDateForHeader() {
  var d = new Date();
  var giorni = [
    'Domenica',
    'Luned\u00EC',
    'Marted\u00EC',
    'Mercoled\u00EC',
    'Gioved\u00EC',
    'Venerd\u00EC',
    'Sabato',
  ];
  var mesi = [
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno',
    'Luglio',
    'Agosto',
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre',
  ];
  return (
    giorni[d.getDay()] +
    ' ' +
    d.getDate() +
    ' ' +
    mesi[d.getMonth()] +
    ' ' +
    d.getFullYear() +
    ' \u2014 ' +
    pad2(d.getHours()) +
    ':' +
    pad2(d.getMinutes())
  );
}

function exportNotes() {
  if (!state.notes || !state.notes.trim()) {
    notify('Le note sono vuote, nulla da esportare.', 'err');
    return;
  }
  var s = computeNoteStats();
  var line = '===========================================================';
  var header =
    line +
    '\n  NOTE DI SESSIONE - IL MERCANTE ERRANTE\n  ' +
    formatDateForHeader() +
    '\n' +
    line +
    '\n\n';
  var footer =
    '\n\n' +
    line +
    '\n  Fine note - ' +
    s.words +
    ' parole - ' +
    s.chars +
    ' caratteri\n' +
    line +
    '\n';
  var content = header + state.notes + footer;
  var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, 'note_sessione_' + formatDateForFile() + '.txt');
  notify('File scaricato. Salvalo nella tua chiavetta.');
}

function clearNotes() {
  if (!state.notes || !state.notes.trim()) return;
  if (!confirm("Cancellare tutto il testo delle note? L'azione non e' reversibile.")) return;
  state.notes = '';
  var ta = document.querySelector('.notes-area');
  if (ta) ta.value = '';
  updateNotesStats();
  notify('Note azzerate.');
}
