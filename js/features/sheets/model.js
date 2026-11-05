/* Defaults, normalization and derived values for character sheets. */
function _spellList(n) {
  var a = [];
  for (var i = 0; i < n; i++) a.push({ nome: '', prep: false });
  return a;
}
function _schedaDefault() {
  return {
    nomePersonaggio: '',
    classelivello: '',
    background: '',
    nomeGiocatore: '',
    razza: '',
    allineamento: '',
    pe: '',
    for: 10,
    des: 10,
    cos: 10,
    int: 10,
    sag: 10,
    car: 10,
    tsFor: false,
    tsDes: false,
    tsCos: false,
    tsInt: false,
    tsSag: false,
    tsCar: false,
    skAcrobazia: false,
    skAnimali: false,
    skArcano: false,
    skAtletica: false,
    skFurtivita: false,
    skIndagare: false,
    skInganno: false,
    skIntimidire: false,
    skIntrattenere: false,
    skIntuizione: false,
    skMedicina: false,
    skNatura: false,
    skPercezione: false,
    skPersuasione: false,
    skRapidita: false,
    skReligione: false,
    skSopravvivenza: false,
    skStoria: false,
    skTecnologia: false,
    ispirazione: false,
    bonusCompetenza: 2,
    ca: '',
    iniziativa: '',
    velocita: '',
    hpMax: '',
    hpAttuali: '',
    hpTemp: '',
    dadiVita: '',
    successi: [false, false, false],
    fallimenti: [false, false, false],
    attacchi: [
      { nome: '', bonus: '', danni: '' },
      { nome: '', bonus: '', danni: '' },
      { nome: '', bonus: '', danni: '' },
    ],
    trattiCar: '',
    ideali: '',
    legami: '',
    difetti: '',
    altreCompetenze: '',
    equipaggiamento: '',
    privilegi: '',
    rame: '',
    argento: '',
    oro: '',
    platino: '',
    crediti: '',
    livelloFollia: 0,
    eta: '',
    altezza: '',
    peso: '',
    occhi: '',
    carnagione: '',
    capelli: '',
    aspettoDesc: '',
    aspettoImg: '',
    alleatiOrg: '',
    nomeOrg: '',
    storia: '',
    trattiAgg: '',
    tesoro: '',
    classInc: '',
    carInc: '',
    cdTs: '',
    bonusAtkInc: '',
    trucchetti: ['', '', '', '', '', '', '', ''],
    sp1: { slots: '', spesi: '', lista: _spellList(13) },
    sp2: { slots: '', spesi: '', lista: _spellList(13) },
    sp3: { slots: '', spesi: '', lista: _spellList(13) },
    sp4: { slots: '', spesi: '', lista: _spellList(13) },
    sp5: { slots: '', spesi: '', lista: _spellList(13) },
    sp6: { slots: '', spesi: '', lista: _spellList(9) },
    sp7: { slots: '', spesi: '', lista: _spellList(9) },
    sp8: { slots: '', spesi: '', lista: _spellList(7) },
    sp9: { slots: '', spesi: '', lista: _spellList(7) },
  };
}
function _schedaFix(raw) {
  if (!raw || typeof raw !== 'object') return _schedaDefault();
  var out = Object.assign(_schedaDefault(), raw);
  if (!Array.isArray(out.successi) || out.successi.length !== 3)
    out.successi = [false, false, false];
  if (!Array.isArray(out.fallimenti) || out.fallimenti.length !== 3)
    out.fallimenti = [false, false, false];
  if (!Array.isArray(out.trucchetti) || out.trucchetti.length < 8)
    out.trucchetti = ['', '', '', '', '', '', '', ''];
  if (!Array.isArray(out.attacchi) || out.attacchi.length < 3)
    out.attacchi = [
      { nome: '', bonus: '', danni: '' },
      { nome: '', bonus: '', danni: '' },
      { nome: '', bonus: '', danni: '' },
    ];
  [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (l) {
    var k = 'sp' + l,
      n = l <= 5 ? 13 : l <= 7 ? 9 : 7;
    var src = raw[k];
    var def = { slots: '', spesi: '', lista: _spellList(n) };
    if (!src || typeof src !== 'object') {
      out[k] = def;
      return;
    }
    out[k] = { slots: src.slots || '', spesi: src.spesi || '', lista: _spellList(n) };
    if (Array.isArray(src.lista))
      src.lista.forEach(function (sp, i) {
        if (i < n) out[k].lista[i] = Object.assign({ nome: '', prep: false }, sp);
      });
  });
  return out;
}
function updateSchedaDerived() {
  var s = state.scheda,
    bc = parseInt(s.bonusCompetenza) || 2;
  function m(v) {
    return Math.floor(((parseInt(v) || 10) - 10) / 2);
  }
  function fmt(n) {
    return (n >= 0 ? '+' : '') + n;
  }
  var st = {
    for: m(s.for),
    des: m(s.des),
    cos: m(s.cos),
    int: m(s.int),
    sag: m(s.sag),
    car: m(s.car),
  };
  ['for', 'des', 'cos', 'int', 'sag', 'car'].forEach(function (k) {
    var el = document.getElementById('pd-mod-' + k);
    if (el) el.textContent = fmt(st[k]);
  });
  [
    ['for', 'tsFor'],
    ['des', 'tsDes'],
    ['cos', 'tsCos'],
    ['int', 'tsInt'],
    ['sag', 'tsSag'],
    ['car', 'tsCar'],
  ].forEach(function (p) {
    var el = document.getElementById('pd-ts-' + p[0]);
    if (el) el.textContent = fmt(st[p[0]] + (s[p[1]] ? bc : 0));
  });
  var skMap = [
    ['des', 'skAcrobazia', 'acrobazia'],
    ['sag', 'skAnimali', 'animali'],
    ['int', 'skArcano', 'arcano'],
    ['for', 'skAtletica', 'atletica'],
    ['des', 'skFurtivita', 'furtivita'],
    ['int', 'skIndagare', 'indagare'],
    ['car', 'skInganno', 'inganno'],
    ['car', 'skIntimidire', 'intimidire'],
    ['car', 'skIntrattenere', 'intrattenere'],
    ['sag', 'skIntuizione', 'intuizione'],
    ['sag', 'skMedicina', 'medicina'],
    ['int', 'skNatura', 'natura'],
    ['sag', 'skPercezione', 'percezione'],
    ['car', 'skPersuasione', 'persuasione'],
    ['des', 'skRapidita', 'rapidita'],
    ['int', 'skReligione', 'religione'],
    ['sag', 'skSopravvivenza', 'sopravvivenza'],
    ['int', 'skStoria', 'storia'],
    ['int', 'skTecnologia', 'tecnologia'],
  ];
  skMap.forEach(function (sk) {
    var el = document.getElementById('pd-sk-' + sk[2]);
    if (el) el.textContent = fmt(st[sk[0]] + (s[sk[1]] ? bc * (s[sk[1] + '_m'] ? 2 : 1) : 0));
  });
  var pp = document.getElementById('pd-pass-perc');
  if (pp) pp.textContent = 10 + st.sag + (s.skPercezione ? bc * (s['skPercezione_m'] ? 2 : 1) : 0);
}
