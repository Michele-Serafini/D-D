/* Regia della sessione: il combattimento usa gli stessi componenti di Iniziativa. */
function renderDashboard() {
  var wrap = document.createElement('section');
  wrap.className = 'master-dashboard container-main';
  var header = document.createElement('header');
  header.className = 'dashboard-header';
  var title = document.createElement('div');
  title.innerHTML =
    '<p class="header-eyebrow">Regia della sessione</p><h1 class="header-title">Dashboard del master</h1>';
  var campaign = document.createElement('p');
  campaign.className = 'dashboard-muted';
  campaign.textContent = CampaignManager.current.meta.name;
  title.appendChild(campaign);
  header.appendChild(title);
  header.appendChild(buildCombatActions());
  wrap.appendChild(header);

  var layout = document.createElement('div');
  layout.className = 'dashboard-layout';
  var combat = document.createElement('div');
  combat.className = 'dashboard-combat';
  var summary = document.createElement('section');
  summary.className = 'dashboard-panel';
  summary.innerHTML =
    '<h2>Ordine dei turni</h2><p id="dashboard-current-turn" role="status"></p><ol id="dashboard-turn-order" class="dashboard-turn-order" aria-label="Ordine dei turni"></ol>';
  combat.appendChild(summary);
  combat.appendChild(buildCombatTracker());
  layout.appendChild(combat);

  var tools = document.createElement('aside');
  tools.className = 'dashboard-tools';
  tools.appendChild(buildDashboardNotes());
  tools.appendChild(buildDashboardShortcuts());
  var conditions = document.createElement('div');
  conditions.className = 'conditions-panel';
  conditions.id = 'conditions-panel';
  tools.appendChild(conditions);
  layout.appendChild(tools);
  wrap.appendChild(layout);
  return wrap;
}

function updateDashboardCombatSummary() {
  var list = document.getElementById('dashboard-turn-order');
  if (!list) return;
  var ordered = getOrderedActive();
  var current = ordered[state.activeIndex];
  document.getElementById('dashboard-current-turn').textContent = current
    ? 'Tocca a ' + current.nome + ' · Round ' + state.round
    : 'Aggiungi un combattente per iniziare la sessione.';
  var signature = JSON.stringify([
    state.activeIndex,
    ordered.map(function (combatant) {
      return [combatant.id, combatant.nome, combatant.iniziativa];
    }),
  ]);
  if (list.dataset.signature === signature) return;
  list.dataset.signature = signature;
  var focusedId = list.contains(document.activeElement)
    ? document.activeElement.dataset.combatantId
    : null;
  list.replaceChildren();
  ordered.forEach(function (combatant, index) {
    var item = document.createElement('li');
    var button = document.createElement('button');
    button.type = 'button';
    button.dataset.combatantId = combatant.id;
    button.className = 'dashboard-turn' + (index === state.activeIndex ? ' is-current' : '');
    if (index === state.activeIndex) button.setAttribute('aria-current', 'step');
    var initiative = document.createElement('strong');
    initiative.textContent = Number(combatant.iniziativa) || 0;
    var name = document.createElement('span');
    name.textContent = combatant.nome;
    button.append(initiative, name);
    button.title = 'Passa il turno a ' + combatant.nome;
    button.onclick = function () {
      jumpToCombatant(combatant.id);
    };
    item.appendChild(button);
    list.appendChild(item);
    if (focusedId === combatant.id) button.focus({ preventScroll: true });
  });
}

function buildDashboardNotes() {
  var panel = document.createElement('section');
  panel.className = 'dashboard-panel dashboard-notes';
  panel.innerHTML =
    '<h2><label for="dashboard-notes">Appunti del master</label></h2>' +
    '<p class="dashboard-muted" id="dashboard-notes-help">Condivisi con gli altri master di questa campagna. I giocatori non li vedono.</p>' +
    '<textarea id="dashboard-notes" rows="8" maxlength="50000" aria-describedby="dashboard-notes-help" placeholder="Obiettivi della sessione, indizi, PNG, tesori…"></textarea>' +
    '<div class="dashboard-notes-footer"><span class="dashboard-muted" role="status" aria-live="polite"></span><button type="button" class="btn-gold">Salva appunti</button></div>';
  var input = panel.querySelector('textarea');
  var status = panel.querySelector('[role="status"]');
  var save = panel.querySelector('button');
  MasterDashboardNotes.connect();
  onSectionCleanup(
    MasterDashboardNotes.subscribe(function (notes) {
      if (input.value !== notes.text) input.value = notes.text;
      input.disabled = !notes.loaded;
      status.textContent = notes.status;
      save.disabled = !notes.loaded || !notes.dirty || notes.saving;
    })
  );
  input.oninput = function () {
    MasterDashboardNotes.update(input.value);
  };
  save.onclick = function () {
    MasterDashboardNotes.flush().catch(function () {});
  };
  return panel;
}

function buildDashboardShortcuts() {
  var panel = document.createElement('section');
  panel.className = 'dashboard-panel';
  panel.innerHTML = '<h2>Comandi rapidi</h2>';
  var grid = document.createElement('div');
  grid.className = 'dashboard-shortcuts';
  [
    ['iniziativa', 'Iniziativa completa', ICON.swords],
    ['mappa', 'Mappa della campagna', ICON.map],
    ['schedepg', 'Schede dei personaggi', ICON.scroll],
    ['generatore', 'Generatore PNG', ICON.npc],
    ['dadi', 'Lancia dadi', ICON.skullDice],
    ['libri', 'Libri e documenti', ICON.scroll],
    ['regia', state.regiaActive ? 'Chiudi regia sonora' : 'Apri regia sonora', ICON.music],
  ].forEach(function (shortcut) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-dark';
    button.innerHTML = (shortcut[2] || '') + '<span>' + shortcut[1] + '</span>';
    button.onclick = function () {
      if (shortcut[0] === 'regia') state.regiaActive = !state.regiaActive;
      else state.section = shortcut[0];
      state.sidebarOpen = false;
      render();
    };
    grid.appendChild(button);
  });
  panel.appendChild(grid);
  return panel;
}
