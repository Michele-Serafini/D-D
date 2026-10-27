var state = {
  theme: 'dark',
  section: 'emporio',
  sidebarOpen: false,
  lavagnaOpen: false,
  armi:
    typeof SRD_OGGETTI !== 'undefined' && SRD_OGGETTI.length
      ? SRD_OGGETTI.slice()
      : SAMPLE_DATA.slice(),
  filtroTipo: '',
  filtroValuta: '',
  filtroRarita: '',
  search: '',
  emporioShowHomebrew: false,
  showForm: false,
  editingId: null,
  emporioTab: 'normale',
  impiantiCibernetici: [],
  cyberSearch: '',
  cyberFilterTipo: '',
  cyberFilterRarita: '',
  cyberEditingId: null,
  cyberShowForm: false,
  droghe: [],
  drogheSearch: '',
  drogheShowForm: false,
  drogheEditingId: null,
  veicoli: [],
  veicoliSearch: '',
  veicoliShowForm: false,
  veicoliEditingId: null,
  veicoliTab: 'catalogo',
  veicoliFilterTipo: '',
  veicoliParty: [],
  veicoliPartySearch: '',
  veicoliPartyShowForm: false,
  veicoliPartyEditingId: null,
  armiDaFuoco: [],
  armiDaFuocoSelectedId: null,
  armiDaFuocoSearch: '',
  armiDaFuocoShowForm: false,
  armiDaFuocoEditingId: null,
  armiSubTab: 'armi',
  potenziamenti: [],
  potenziamentiSelectedId: null,
  potenziamentiSearch: '',
  potenziamentiShowForm: false,
  potenziamentiEditingId: null,
  munizioniArmi: [],
  munizioniArmiSelectedId: null,
  munizioniArmiSearch: '',
  munizioniArmiShowForm: false,
  munizioniArmiEditingId: null,
  combatants: [makeEmptyCombatant()],
  round: 1,
  activeIndex: 0,
  expandedCondition: null,
  assigningCondId: null,
  notes: '',

  /* ===== AUTH ===== */
  currentUser: null, // {username, role, dmPriv}

  /* ===== SEZIONE STATISTICHE & CAOS ===== */
  caosPlayers: [], // [{id, nome, fail, succ}]
  doomStage: 1, // 1 = D6, 2 = D8, 3 = D20 finale
  doomFilled: 0, // spicchi/facce attualmente colorate
  doomTransforming: false, // flag animazione di trasformazione in corso
  doomEventOpen: false,
  doomEventText: '',
  doomEventLevel: 1, // 1 = soft, 2 = medium, 3 = catastrofico

  /* ===== SEZIONE GENERATORE NPC ===== */
  geminiKey: '', // chiave API Google Gemini
  groqKey: '', // chiave API Groq (velocissima, gratuita) (salvata in localStorage)
  geminiKeyVisible: false, // mostra/nascondi il box per inserire la chiave
  npcLoading: false, // true durante la chiamata all'AI
  npcIdea: '', // ultimo prompt inserito dal DM
  _avatarLoading: false, // true durante la ricerca immagine
  _showUrlInput: false, // mostra/nascondi input URL manuale
  regiaActive: false, // pannello Regia Sonora aperto/chiuso
  regiaScena: '', // id scena attiva nel pannello regia
  regiaImmagini: {}, // {scenaId: urlImmagine} — personalizzabili come l'Emporio
  regiaUrls: {}, // {scenaId: ytUrl} — URL audio personalizzati per scena
  regiaUrlsSfx: {}, // {sfxId: ytUrl} — URL audio SFX personalizzati
  regiaUrlsBardo: [], // [] — URL tracce bardo personalizzate
  archivioVisible: false, // true = mostra l'archivio in colonna destra
  personaggi: typeof DATABASE_NPC_DEFAULT !== 'undefined' ? DATABASE_NPC_DEFAULT.slice() : [],
  npc: {
    // scheda NPC corrente (tab attivo)
    _id: null,
    nome: '',
    ruolo: '',
    background: '',
    hp: '',
    ca: '',
    eta: '',
    for: '',
    des: '',
    cos: '',
    int: '',
    sag: '',
    car: '',
    tratiCaratteriali: '',
    trattiFisici: '',
    oggettiIncantesimi: '',
    immagine: '',
    attacchi: [{ nome: '', bonus: '', danno: '' }],
    azioniTesto: '',
    citta: '',
    stato: 'vivo',
  },
  npcActiveTab: 0, // tab attivo (0-2)
  npcTabs: [null, null, null], // snapshot delle 3 schede; null = tab vuoto

  /* ===== LANCIATORE DADI ===== */
  diceType: 20, // d20 selezionato default
  diceHistory: [], // [{value, diceType, username, trucco}]

  /* ===== MAPPA DEL MONDO ===== */
  mappaUrl: '', // URL immagine mappa attiva
  mappaFlags: {}, // {flagId: {lat, lng, nome, gradimento, riassunto, immagine}}
  mappaMode: 'move', // 'move' | 'flag'
  mappaSelectedFlag: null, // id flag selezionato
  mappaList: {}, // {mapId: {nome, url, flags}} — lista di tutte le mappe
  mappaActiveId: '', // id mappa attiva
  mappaLayerVisible: 'none', // 'none' | 'political' | 'associations'

  /* ===== BACHECA DEI RICERCATI ===== */
  bacheItems: [], // [{id, url, commento}]

  /* ===== BESTIARIO CUSTOM ===== */
  bestiario: typeof SRD_BESTIARIO !== 'undefined' ? SRD_BESTIARIO.slice() : [],
  bestSearch: '',
  bestFiltroTaglia: '',
  bestFiltroTipo: '',
  bestFiltroGS: '',
  bestEditingId: null,
  bestShowForm: false,
  bestTab: 'bestiario',
  incantesimiAggiuntivi: typeof SRD_INCANTESIMI !== 'undefined' ? SRD_INCANTESIMI.slice() : [],
  incSearch: '',
  incFilterLivello: '',
  incFilterClasse: '',
  incShowForm: false,
  incEditingId: null,
  pet: [],
  petSearch: '',

  /* ===== SCHEDA PERSONAGGIO ===== */
  scheda: {}, // scheda attiva (oggetto con .id)
  schedaTab: 'principale',
  schedaLoaded: false,
  schedeList: [], // [{id,...}] tutte le schede del giocatore
  schedaAttivaId: null, // id scheda aperta, null = lista
  companions: {}, // {charId:{compId:{...}}}
  companionShowForm: false,
  companionEditingId: null,
  companionEditingCharId: null,

  /* ===== WORLDBUILDING ===== */
  worldbuilding: [], // [{id, nome, desc, citta:[]}]

  /* ===== STORIA DELLA CAMPAGNA ===== */
  storia: {
    content: '', // HTML del testo
    markers: {}, // {id: {lat, lng, image, text, type}}
    showMap: false,
    mapMode: 'move', // 'move' | 'place'
    markerType: 'pin', // 'pin' | 'clock' | 'swords'
    selectedMarker: null,
    showLibrary: false,
    currentStoryId: null,
    currentStoryName: '',
  },

  /* ===== SCHEDE PG (DM view) ===== */
  schedePGAll: null, // null = non ancora caricato, {} = caricato (vuoto o con dati)
  schedePGFilter: 'tutti',
  schedePGOpenChar: null, // {username, charId, char} — scheda aperta, null = lista
  schedePGViewMode: false, // true = DM sta guardando scheda completa
  schedePGShowHidden: false, // DM: mostra schede usate/magazzino
  schedaListFilter: '', // PG: filtro per stato scheda

  /* ===== LIBRERIA ===== */
  libriCustom: null, // null = non caricato, {} = caricato
  libriPreferiti: undefined,
  libriShowForm: false, // true = form aggiungi libro visibile
  libriEditId: null,
  libriFilter: 'Tutte',
  libriSearch: '',
  libriSort: 'default',

  /* ===== ELIMINAZIONI ADMIN ===== */
  bestiarioDeleted: [], // IDs mostri SRD eliminati dall'admin
  armiDeleted: [], // IDs armi SRD eliminate dall'admin

  /* ===== NEGOZIO & MONETE ===== */
  shopFilter: { livello: 5, tipo: 'generale' },
  monete: { mr: 0, ma: 0, mo: 0, mp: 0 },

  /* ===== GENERATORE NOMI NPC ===== */
  _ngGender: 'qualsiasi',
};
