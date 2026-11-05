/* Add a page here once: menu, permissions, renderer and shortcuts share this registry. */
var AppNavigation = (function () {
  var items = [
    {
      id: 'dashboard',
      label: 'Dashboard del master',
      dmOnly: true,
      icon: 'swords',
      render: renderDashboard,
    },
    {
      id: 'contenuti',
      label: 'Contenuti e segreti',
      playerLabel: 'Contenuti rivelati',
      icon: 'scroll',
      render: renderRevealedContent,
    },
    {
      id: 'diario',
      label: 'Diario della sessione',
      dmOnly: true,
      icon: 'scroll',
      render: renderSessionJournal,
      shortcut: 3,
    },
    { id: 'emporio', label: 'Emporio', icon: 'sword', render: renderEmporio },
    { id: 'telefono', label: 'Telefono e offline', icon: 'folder', render: renderPhoneOffline },
    {
      id: 'storico-schede',
      label: 'Storico e ripristino',
      icon: 'scroll',
      render: renderSheetHistory,
    },
    {
      id: 'commercio',
      label: 'Negozio e ricompense',
      playerLabel: 'Inventario e acquisti',
      icon: 'folder',
      render: renderCommerce,
      shortcut: 2,
    },
    {
      id: 'bestiario',
      label: 'Bestiario',
      playerLabel: 'Pet del Party',
      icon: 'monster',
      playerIcon: 'heart',
      render: renderBestiario,
    },
    {
      id: 'incantesimi',
      label: 'Incantesimi Aggiuntivi',
      icon: 'star',
      render: renderIncantesimiAggiuntivi,
    },
    {
      id: 'mappa',
      label: 'Mappa del Mondo',
      icon: 'map',
      render: renderMappa,
      shortcut: 4,
      shortcutLabel: 'Mappa della campagna',
    },
    {
      id: 'worldbuilding',
      label: 'Worldbuilding',
      dmOnly: true,
      icon: 'globe',
      render: renderWorldbuilding,
    },
    { id: 'storia', label: 'Storia', dmOnly: true, icon: 'bookOpen', render: renderStoria },
    {
      id: 'archivio',
      label: 'Archivio Idee',
      dmOnly: true,
      icon: 'archive',
      render: renderArchivio,
    },
    {
      id: 'generatore',
      label: 'Generatore NPC',
      dmOnly: true,
      icon: 'npc',
      render: renderGeneratore,
      shortcut: 6,
      shortcutLabel: 'Generatore PNG',
    },
    {
      id: 'iniziativa',
      label: 'Iniziativa',
      icon: 'swords',
      render: renderIniziativa,
      shortcut: 1,
      shortcutLabel: 'Iniziativa completa',
    },
    { id: 'caos', label: 'Statistiche & Caos', icon: 'skullDice', render: renderCaos },
    { id: 'note', label: 'Note di Sessione', icon: 'scroll', playerOnly: true, render: renderNote },
    {
      id: 'scheda',
      label: 'Scheda PG',
      playerOnly: true,
      icon: 'sheet',
      render: _buildSchedaWithLavagna,
    },
    {
      id: 'regia',
      label: 'Regia Sonora',
      dmOnly: true,
      icon: 'music',
      group: 'tools',
      shortcut: 9,
      shortcutLabel: function () {
        return state.regiaActive ? 'Chiudi regia sonora' : 'Apri regia sonora';
      },
      active: function () {
        return state.regiaActive;
      },
      action: function () {
        state.regiaActive = !state.regiaActive;
        render();
      },
    },
    {
      id: 'dadi',
      label: 'Lanciatore Dadi',
      icon: 'dice',
      group: 'tools',
      render: renderDadi,
      shortcut: 7,
      shortcutLabel: 'Lancia dadi',
    },
    {
      id: 'schedepg',
      label: 'Schede PG',
      dmOnly: true,
      icon: 'party',
      group: 'tools',
      shortcut: 5,
      shortcutLabel: 'Schede dei personaggi',
      render: function () {
        return state.schedePGViewMode ? _buildSchedaWithLavagna() : renderSchedePG();
      },
    },
    {
      id: 'libri',
      label: 'Libreria',
      icon: 'book',
      group: 'tools',
      render: renderLibri,
      prepare: connectLibrary,
      shortcut: 8,
      shortcutLabel: 'Libri e documenti',
    },
    {
      id: 'tavolo',
      label: 'Tavolo da Gioco',
      icon: 'table',
      group: 'tools',
      render: function () {
        var table = renderTavolo();
        table.style.height = 'calc(100vh - 120px)';
        return table;
      },
    },
    { id: 'bacheca', hidden: true, render: renderBacheca },
  ];
  var heralds = {
    regole: { title: 'Regolamento & Compendio', kicker: 'Tomo delle Leggi', icon: '📜' },
    emporio: { title: 'Emporio delle Meraviglie', kicker: 'Mercato & Artefatti', icon: '⚔️' },
    png: { title: 'Galleria dei PNG', kicker: 'Volti del Regno', icon: '🎭' },
    'genera-png': { title: 'Forgia dei PNG', kicker: 'Creazione Assistita', icon: '✨' },
    bestiario: { title: 'Bestiario dei Mostri', kicker: 'Creature & Leggende', icon: '🐉' },
    'schede-pg': { title: 'Schede dei Personaggi', kicker: 'Eroi della Campagna', icon: '🛡️' },
    iniziativa: { title: 'Tracker Iniziativa', kicker: 'Ordine di Combattimento', icon: '⚡' },
    dadi: { title: 'Arena dei Dadi 4D', kicker: 'Lancio Iper-Poliedrico', icon: '🎲' },
    caos: { title: 'Tabella del Caos', kicker: 'Fato Imprevedibile', icon: '🌀' },
    incantesimi: { title: 'Grimorio degli Incantesimi', kicker: 'Arti Arcane', icon: '🔮' },
    mappa: { title: 'Atlante & Mappa Tattica', kicker: 'Cartografia del Mondo', icon: '🗺️' },
    bacheca: { title: 'Bacheca dei Ricercati', kicker: 'Taglie & Missioni', icon: '📌' },
    fazioni: { title: 'Fazioni & Gilde', kicker: 'Poteri & Alleanze', icon: '🚩' },
    'regia-audio': { title: 'Regia Audio & Atmosfera', kicker: 'Sinfonia del Master', icon: '🎵' },
    'note-dm': {
      title: 'Sanctum del Dungeon Master',
      kicker: 'Segreti della Campagna',
      icon: '👁️',
    },
  };
  var byId = new Map(
    items.map(function (item) {
      return [item.id, item];
    })
  );
  function allowed(item) {
    return !!item && (!item.dmOnly || isDM());
  }
  function visible(item) {
    return !item.hidden && allowed(item) && (!item.playerOnly || !isDM());
  }
  function label(item, shortcut) {
    var value = (shortcut && item.shortcutLabel) || (!isDM() && item.playerLabel) || item.label;
    return typeof value === 'function' ? value() : value;
  }
  function icon(item) {
    return ICON[(!isDM() && item.playerIcon) || item.icon] || '';
  }
  function active(item) {
    return item.active ? item.active() : item.id === state.section;
  }
  function open(id) {
    var item = byId.get(id);
    if (!allowed(item)) return;
    setSidebarOpen(false);
    if (item.action) return item.action();
    state.section = id;
    renderMain();
  }
  function herald(id) {
    var aliases = {
      generatore: 'genera-png',
      schedepg: 'schede-pg',
      worldbuilding: 'fazioni',
      dashboard: 'note-dm',
    };
    var item = byId.get(id);
    return item
      ? heralds[aliases[id] || id] || { title: label(item), kicker: 'Mercante Errante', icon: '⚜' }
      : null;
  }
  return {
    items: items,
    heralds: heralds,
    herald: herald,
    get: function (id) {
      return byId.get(id);
    },
    allowed: allowed,
    visible: visible,
    label: label,
    icon: icon,
    active: active,
    open: open,
    shortcuts: function () {
      return items
        .filter(function (item) {
          return item.shortcut && allowed(item);
        })
        .sort(function (a, b) {
          return a.shortcut - b.shortcut;
        });
    },
  };
})();
