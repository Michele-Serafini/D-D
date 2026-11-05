(async function () {
  try {
    var theme = localStorage.getItem('sium_theme_mode') || localStorage.getItem('theme') || 'dark';
    if (['dark', 'light', 'halloween', 'christmas', 'valentine', 'easter'].includes(theme))
      document.documentElement.dataset.theme = theme;
  } catch (_error) {
    /* The reader also works with browser storage restrictions. */
  }

  var status = document.getElementById('status'),
    campaign = document.getElementById('campaign'),
    character = document.getElementById('character'),
    host = document.getElementById('sheet');
  var snapshots = [],
    current = null;
  var labels = {
    for: 'Forza',
    des: 'Destrezza',
    cos: 'Costituzione',
    int: 'Intelligenza',
    sag: 'Saggezza',
    car: 'Carisma',
    nomePersonaggio: 'Nome personaggio',
    nome: 'Nome',
    hpAttuali: 'Punti vita attuali',
    hpMassimi: 'Punti vita massimi',
    oro: 'Oro',
    argento: 'Argento',
    rame: 'Rame',
    platino: 'Platino',
    equipaggiamento: 'Equipaggiamento',
    trade: 'Inventario del negozio',
    inventory: 'Inventario',
    annotations: 'Annotazioni',
    boardImages: 'Immagini della lavagna',
    schedaTipo: 'Sistema di gioco',
    branca_data: 'Scheda Brancalonia',
  };
  function label(key) {
    return labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
  }
  function meaningful(value) {
    return (
      value != null &&
      value !== '' &&
      (typeof value !== 'object' || Object.values(value).some(meaningful))
    );
  }
  function render(value, key) {
    var section = document.createElement('section'),
      title = document.createElement('h3');
    title.textContent = label(key);
    section.appendChild(title);
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(function (entry) {
        if (!['version', 'lastOperation', '_rev', 'id'].includes(entry[0]) && meaningful(entry[1]))
          section.appendChild(render(entry[1], entry[0]));
      });
    } else if (typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(value)) {
      var image = document.createElement('img');
      image.alt = label(key);
      image.src = value;
      section.appendChild(image);
    } else {
      var text = document.createElement('p');
      text.textContent = typeof value === 'boolean' ? (value ? 'Sì' : 'No') : String(value);
      section.appendChild(text);
    }
    return section;
  }
  async function chooseCampaign() {
    current = snapshots.find(function (snapshot) {
      return snapshot.scope === campaign.value;
    });
    character.replaceChildren();
    host.replaceChildren();
    if (!current) return;
    var operations = await OfflineStore.operations(current.scope),
      sheets = OfflineModel.sheets(current, operations);
    status.textContent =
      current.owner +
      ' · copia del ' +
      new Date(current.savedAt).toLocaleString('it-IT') +
      (operations.length
        ? ' · ' +
          operations.length +
          ' modifiche ancora da sincronizzare. Riapri il sito con la rete e accedi allo stesso account.'
        : ' · nessuna modifica locale in attesa. La copia può essere precedente ai dati online.');
    Object.entries(sheets).forEach(function (entry) {
      var option = document.createElement('option');
      option.value = entry[0];
      option.textContent =
        entry[0].split('/')[0] +
        ' · ' +
        (entry[1].nomePersonaggio || entry[1].nome || entry[1].eroe || 'Senza nome');
      character.appendChild(option);
    });
    character.onchange = function () {
      host.replaceChildren();
      var sheet = sheets[character.value];
      if (!sheet) return;
      Object.entries(sheet).forEach(function (entry) {
        if (
          !['id', '_rev', 'abilityBoard', 'boardImages'].includes(entry[0]) &&
          meaningful(entry[1])
        )
          host.appendChild(render(entry[1], entry[0]));
      });
      (sheet.boardImages || []).forEach(function (item) {
        var source = current.images?.[item.id] || item.dataUrl;
        if (source && /^data:image\/(png|jpeg|webp);base64,/.test(source))
          host.appendChild(render(source, item.name || 'Immagine della lavagna'));
      });
      if (!host.children.length) host.textContent = 'Questa scheda non contiene ancora dati.';
    };
    character.onchange();
  }
  try {
    var uid = await OfflineStore.get('meta', 'activeUser');
    if (typeof BroadcastChannel !== 'undefined') {
      var session = new BroadcastChannel('mercante-offline-session');
      session.onmessage = function (event) {
        if (event.data === uid) return;
        host.replaceChildren();
        campaign.replaceChildren();
        character.replaceChildren();
        campaign.disabled = character.disabled = true;
        status.textContent =
          'Account cambiato o disconnesso. Riapri la vista dopo aver effettuato l’accesso.';
      };
      window.addEventListener('pagehide', function () {
        session.close();
      });
    }
    if (uid)
      snapshots = (await OfflineStore.all('snapshots')).filter(function (row) {
        return row.uid === uid;
      });
    if (!snapshots.length) {
      status.textContent =
        'Nessuna copia disponibile per l’account attivo. Accedi online e usa Telefono e offline → Prepara schede offline.';
      campaign.disabled = character.disabled = true;
      return;
    }
    snapshots.forEach(function (snapshot) {
      var option = document.createElement('option');
      option.value = snapshot.scope;
      option.textContent = snapshot.campaignName;
      campaign.appendChild(option);
    });
    campaign.onchange = chooseCampaign;
    await chooseCampaign();
  } catch (_error) {
    status.textContent = 'Archivio locale non disponibile. Riprova oppure accedi online.';
  }
})();
