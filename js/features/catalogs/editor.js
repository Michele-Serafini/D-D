/* Campaign masters share one create/edit flow; players keep read-only catalogs. */
var CatalogEditor = {
  drafts: {},
  definitions: {
    object: { field: 'armi', path: 'state/armi', prefix: 'item_', label: 'Aggiungi oggetto' },
    spell: {
      field: 'incantesimiAggiuntivi',
      path: 'state/incantesimiAggiuntivi',
      prefix: 'inc_',
      label: 'Aggiungi incantesimo',
    },
  },
  button: function (kind) {
    if (!isDM()) return null;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-gold catalog-add-button';
    button.innerHTML = ICON.plus + '<span>' + this.definitions[kind].label + '</span>';
    button.onclick = function () {
      CatalogEditor.open(kind);
    };
    return button;
  },
  open: function (kind, id) {
    if (!isDM()) return;
    delete this.drafts[kind];
    if (kind === 'object') {
      document.getElementById('modal-root')?.remove();
      state.editingId = id || null;
      state.showForm = true;
      document.body.appendChild(renderWeaponForm());
    } else {
      state.incEditingId = id || null;
      state.incShowForm = true;
      renderMain();
    }
  },
  draftId: function (kind) {
    return this.definitions[kind].prefix + crypto.randomUUID();
  },
  draft: function (kind, editing, defaults) {
    var key = editing ? editing.id : 'new';
    if (!this.drafts[kind] || this.drafts[kind].key !== key)
      this.drafts[kind] = {
        key: key,
        id: editing ? editing.id : this.draftId(kind),
        value: defaults,
      };
    return this.drafts[kind];
  },
  upsert: function (items, entry, editing) {
    var found = items.some(function (item) {
      return item.id === entry.id;
    });
    if (editing && !found) return undefined;
    return found
      ? items.map(function (item) {
          return item.id === entry.id ? Object.assign({}, item, entry) : item;
        })
      : [entry].concat(items);
  },
  receive: function (kind, snapshot) {
    var items = snapshot.val() || [];
    state[this.definitions[kind].field] =
      kind === 'spell' ? CatalogSync.visibleSpells(items) : items;
  },
  save: async function (kind, form, id, editing) {
    if (!isDM()) throw new Error('Solo il master della campagna può modificare il catalogo.');
    if (!OfflineSheets.connected)
      throw new Error('Riconnettiti per salvare il catalogo. Il modulo resta aperto.');
    if (!String(form.nome || '').trim()) throw new Error('Inserisci un nome.');
    var definition = this.definitions[kind];
    var entry = Object.assign({}, DataUtils.clone(form), {
      id: id,
      nome: form.nome.trim(),
      _customized: true,
    });
    if (kind === 'object' && (!Number.isFinite(Number(entry.prezzo)) || Number(entry.prezzo) < 0))
      throw new Error('Inserisci un prezzo valido, maggiore o uguale a zero.');
    var fallback = DataUtils.clone(state[definition.field] || []);
    _localWrite[definition.field] = true;
    try {
      var result = await UserManager.withTimeout(
        _campaignDb.ref(definition.path).transaction(
          function (current) {
            return CatalogEditor.upsert(
              Array.isArray(current) ? current : fallback,
              entry,
              editing
            );
          },
          undefined,
          false
        ),
        30000
      );
      if (!result.committed)
        throw new Error('La voce è stata eliminata da un altro master. Riapri il catalogo.');
      this.receive(kind, result.snapshot);
      return entry;
    } finally {
      _localWrite[definition.field] = false;
    }
  },
  remove: async function (kind, item) {
    if (!isDM()) throw new Error('Solo il master della campagna può modificare il catalogo.');
    if (!OfflineSheets.connected)
      throw new Error('Riconnettiti per eliminare una voce del catalogo.');
    var definition = this.definitions[kind];
    if (kind === 'spell') {
      var source = CatalogSync.index(SRD_INCANTESIMI).byName[item.nome.toLowerCase()];
      var deleted = [item.id].concat(source ? [source.id] : []);
      var mark = await UserManager.withTimeout(
        _campaignDb.ref('state/incantesimiDeleted').transaction(function (current) {
          return Array.from(new Set((Array.isArray(current) ? current : []).concat(deleted)));
        })
      );
      CatalogSync.deletedSpells = mark.snapshot.val() || [];
    }
    _localWrite[definition.field] = true;
    try {
      var result = await UserManager.withTimeout(
        _campaignDb.ref(definition.path).transaction(
          function (current) {
            return (Array.isArray(current) ? current : state[definition.field] || []).filter(
              function (entry) {
                return entry.id !== item.id;
              }
            );
          },
          undefined,
          false
        )
      );
      this.receive(kind, result.snapshot);
    } finally {
      _localWrite[definition.field] = false;
    }
  },
};
