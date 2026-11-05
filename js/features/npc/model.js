/* ===========================================================
   === SEZIONE GENERATORE NPC ===
   =========================================================== */

function npcModifier(score) {
  var s = parseInt(score, 10);
  if (isNaN(s)) return '—';
  var mod = Math.floor((s - 10) / 2);
  return (mod >= 0 ? '+' : '') + mod;
}

/* Crea un blocco label + input/textarea collegato a state.npc */
function makeNpcField(labelText, fieldKey, placeholder, type) {
  var block = document.createElement('div');
  block.className = 'npc-field-block' + (type === 'full' ? ' full' : '');
  if (labelText) {
    var lbl = document.createElement('span');
    lbl.className = 'npc-field-lbl';
    lbl.textContent = labelText;
    block.appendChild(lbl);
  }
  if (type === 'textarea') {
    var ta = document.createElement('textarea');
    ta.className = 'npc-field-textarea';
    ta.value = state.npc[fieldKey] || '';
    ta.placeholder = placeholder || '';
    ta.oninput = function () {
      state.npc[fieldKey] = this.value;
    };
    block.appendChild(ta);
  } else {
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'npc-field-input';
    inp.value = state.npc[fieldKey] || '';
    inp.placeholder = placeholder || '';
    inp.oninput = function () {
      state.npc[fieldKey] = this.value;
    };
    block.appendChild(inp);
  }
  return block;
}

/* Griglia 6 stat: abbreviazione sopra, modificatore GRANDE, punteggio piccolo sotto */
function renderNpcStatsGrid() {
  var statDefs = [
    { abbr: 'FOR', key: 'for' },
    { abbr: 'DES', key: 'des' },
    { abbr: 'COS', key: 'cos' },
    { abbr: 'INT', key: 'int' },
    { abbr: 'SAG', key: 'sag' },
    { abbr: 'CAR', key: 'car' },
  ];
  var grid = document.createElement('div');
  grid.className = 'npc-stats-grid';
  statDefs.forEach(function (stat) {
    var block = document.createElement('div');
    block.className = 'stat-block';

    var abbr = document.createElement('div');
    abbr.className = 'stat-abbr';
    abbr.textContent = stat.abbr;
    block.appendChild(abbr);

    var modDiv = document.createElement('div');
    modDiv.className = 'stat-modifier';
    modDiv.textContent = state.npc[stat.key] ? npcModifier(state.npc[stat.key]) : '—';
    block.appendChild(modDiv);

    var scoreInp = document.createElement('input');
    scoreInp.type = 'number';
    scoreInp.className = 'stat-score-input';
    scoreInp.min = '1';
    scoreInp.max = '30';
    scoreInp.value = state.npc[stat.key] || '';
    scoreInp.placeholder = '—';
    scoreInp.title = stat.abbr;
    /* closure per catturare stat e modDiv correttamente */
    (function (k, md) {
      scoreInp.oninput = function () {
        state.npc[k] = this.value;
        md.textContent = this.value ? npcModifier(this.value) : '—';
      };
    })(stat.key, modDiv);
    block.appendChild(scoreInp);
    grid.appendChild(block);
  });
  return grid;
}

/* ---- ARCHIVIO PERSONAGGI ---- */
function salvaNpcInArchivio() {
  var nome = (state.npc.nome || '').trim();
  if (!nome) {
    notify('Inserisci almeno il Nome prima di salvare.', 'err');
    return;
  }
  var NPC_FIELDS = [
    'nome',
    'ruolo',
    'background',
    'hp',
    'ca',
    'eta',
    'for',
    'des',
    'cos',
    'int',
    'sag',
    'car',
    'tratiCaratteriali',
    'trattiFisici',
    'oggettiIncantesimi',
    'immagine',
    'azioniTesto',
    'bgShort',
    'razza',
    'competenza',
    'velocita',
    'hpMax',
    'alleati',
    'classeIncantatore',
    'charIncantatore',
    'cdIncantesimi',
    'bonusAttaccoInc',
  ];
  var snapshot = {};
  NPC_FIELDS.forEach(function (f) {
    snapshot[f] = state.npc[f] || '';
  });
  snapshot.attacchi = DataUtils.clone(state.npc.attacchi || []);
  // Salva tutti i campi dinamici (proficiency, spell prepared, tiri salvezza, ecc.)
  Object.keys(state.npc).forEach(function (k) {
    if (
      k.endsWith('_p') ||
      k.startsWith('spPrep_') ||
      k.startsWith('ts_') ||
      k.startsWith('spell_') ||
      k.startsWith('trucco_') ||
      k.startsWith('slotTot') ||
      k.startsWith('slotSp')
    ) {
      snapshot[k] = state.npc[k];
    }
  });
  var existingIdx = -1;
  if (state.npc._id) {
    state.personaggi.forEach(function (p, i) {
      if (p._id === state.npc._id) existingIdx = i;
    });
  }
  if (existingIdx >= 0) {
    snapshot._id = state.npc._id;
    state.personaggi[existingIdx] = snapshot;
    notify("Personaggio aggiornato nell'archivio.");
  } else {
    snapshot._id = 'npc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    state.npc._id = snapshot._id;
    state.personaggi.push(snapshot);
    notify("Personaggio salvato nell'archivio.");
  }
  saveToStorage();
  fbSavePersonaggi();
  renderMain();
}

function caricaNpcDaArchivio(p) {
  // Prima AZZERA completamente state.npc per non sporcare col personaggio precedente
  var keysToReset = Object.keys(state.npc).filter(function (k) {
    return (
      k.endsWith('_p') ||
      k.startsWith('spPrep_') ||
      k.startsWith('ts_') ||
      k.startsWith('spell_') ||
      k.startsWith('trucco_') ||
      k.startsWith('slotTot') ||
      k.startsWith('slotSp')
    );
  });
  keysToReset.forEach(function (k) {
    delete state.npc[k];
  });
  // Poi carica i campi base
  var NPC_FIELDS = [
    '_id',
    'nome',
    'ruolo',
    'background',
    'hp',
    'ca',
    'eta',
    'for',
    'des',
    'cos',
    'int',
    'sag',
    'car',
    'tratiCaratteriali',
    'trattiFisici',
    'oggettiIncantesimi',
    'immagine',
    'azioniTesto',
    'bgShort',
    'razza',
    'competenza',
    'velocita',
    'hpMax',
    'alleati',
    'classeIncantatore',
    'charIncantatore',
    'cdIncantesimi',
    'bonusAttaccoInc',
    'citta',
    'stato',
  ];
  NPC_FIELDS.forEach(function (f) {
    state.npc[f] = p[f] !== undefined ? p[f] : '';
  });
  state.npc.attacchi =
    p.attacchi && p.attacchi.length
      ? DataUtils.clone(p.attacchi)
      : [{ nome: '', bonus: '', danno: '' }];
  // Ripristina i campi dinamici salvati col personaggio
  Object.keys(p).forEach(function (k) {
    if (
      k.endsWith('_p') ||
      k.startsWith('spPrep_') ||
      k.startsWith('ts_') ||
      k.startsWith('spell_') ||
      k.startsWith('trucco_') ||
      k.startsWith('slotTot') ||
      k.startsWith('slotSp')
    ) {
      state.npc[k] = p[k];
    }
  });
  state.archivioVisible = false;
  renderMain();
}

function eliminaNpcDaArchivio(id, nome) {
  if (!confirm('Eliminare "' + (nome || 'questo personaggio') + '" dall\'archivio?')) return;
  state.personaggi = state.personaggi.filter(function (p) {
    return p._id !== id;
  });
  saveToStorage();
  fbSavePersonaggi();
  saveNpc();
  renderMain();
}

function archivaNpcInCitta(npc) {
  var cities = [];
  (state.worldbuilding || []).forEach(function (zone) {
    (zone.citta || []).forEach(function (city) {
      cities.push({ zone: zone, city: city, label: zone.nome + ' → ' + city.nome });
    });
  });
  if (cities.length === 0) {
    notify('Nessuna città nel Worldbuilding. Aggiungine prima dalla sezione Worldbuilding.', 'err');
    return;
  }
  var back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.style.cssText = 'z-index:100001;';
  var panel = document.createElement('div');
  panel.className = 'modal-panel';
  panel.style.maxWidth = '380px';
  var head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML =
    '<div><div class="font-display font-semibold tracking-widest" style="font-size:11px;color:var(--gold-dim);margin-bottom:0.25rem;">WORLDBUILDING</div><h2 class="font-display font-bold" style="font-size:18px;color:var(--gold-bright);margin:0;">Archivia in una Città</h2></div><button class="theme-toggle" style="width:38px;height:38px;">' +
    ICON.x +
    '</button>';
  head.querySelector('button').onclick = function () {
    back.remove();
  };
  back.onclick = function (e) {
    if (e.target === back) back.remove();
  };
  panel.appendChild(head);
  var mbody = document.createElement('div');
  mbody.className = 'modal-body';
  var desc = document.createElement('p');
  desc.style.cssText =
    "font-family:'EB Garamond',serif;font-size:15px;color:var(--text-muted);margin-bottom:1rem;";
  desc.innerHTML =
    'Archivia <strong style="color:var(--text-strong);">' +
    escapeHtml(npc.nome || '(senza nome)') +
    '</strong> nella città:';
  mbody.appendChild(desc);
  var sel = document.createElement('select');
  sel.className = 'field';
  sel.style.marginBottom = '1rem';
  cities.forEach(function (c, i) {
    var o = document.createElement('option');
    o.value = i;
    o.textContent = c.label;
    sel.appendChild(o);
  });
  mbody.appendChild(sel);
  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn-gold';
  confirmBtn.style.cssText = 'width:100%;justify-content:center;';
  confirmBtn.textContent = '📦 Archivia qui';
  confirmBtn.onclick = function () {
    var chosen = cities[parseInt(sel.value)];
    if (!chosen) return;
    var snapshot = DataUtils.clone(npc);
    if (!chosen.city.npcChiave) chosen.city.npcChiave = [];
    chosen.city.npcChiave.push(snapshot);
    state.personaggi = state.personaggi.filter(function (p) {
      return p._id !== npc._id;
    });
    fbSaveWorldbuilding();
    fbSavePersonaggi();
    saveToStorage();
    notify(
      '"' + escapeHtml(npc.nome || 'NPC') + '" archiviato in ' + escapeHtml(chosen.city.nome) + '.'
    );
    back.remove();
    renderMain();
  };
  mbody.appendChild(confirmBtn);
  panel.appendChild(mbody);
  back.appendChild(panel);
  document.body.appendChild(back);
}

function _snapshotNpc() {
  return DataUtils.clone(state.npc);
}

function _restoreNpc(snap) {
  // pulisce i campi dinamici
  Object.keys(state.npc).forEach(function (k) {
    if (
      k.endsWith('_p') ||
      k.startsWith('spPrep_') ||
      k.startsWith('ts_') ||
      k.startsWith('spell_') ||
      k.startsWith('trucco_') ||
      k.startsWith('slotTot') ||
      k.startsWith('slotSp')
    ) {
      delete state.npc[k];
    }
  });
  // ripristina tutto dallo snapshot
  Object.assign(state.npc, snap);
}

function _emptyNpc() {
  return {
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
  };
}

function switchNpcTab(idx) {
  if (idx === state.npcActiveTab) return;
  // salva il tab corrente
  state.npcTabs[state.npcActiveTab] = _snapshotNpc();
  state.npcActiveTab = idx;
  // carica il nuovo tab (o scheda vuota)
  var target = state.npcTabs[idx];
  _restoreNpc(target || _emptyNpc());
  saveToStorage();
  renderMain();
}

/* ---- RIPARAZIONE JSON TRONCATO ---- */
function repairTruncatedJson(text) {
  var s = text;
  /* Chiudi stringa aperta: conta virgolette non-escaped */
  var inStr = false,
    bs = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (bs) {
      bs = false;
      continue;
    }
    if (ch === '\\') {
      bs = true;
      continue;
    }
    if (ch === '"') inStr = !inStr;
  }
  if (inStr) s += '"';
  /* Rimuovi virgola trailing */
  s = s.replace(/,\s*$/, '');
  /* Chiudi strutture aperte */
  var opens = [];
  inStr = false;
  bs = false;
  for (var j = 0; j < s.length; j++) {
    var c = s[j];
    if (bs) {
      bs = false;
      continue;
    }
    if (c === '\\') {
      bs = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (!inStr) {
      if (c === '{') opens.push('}');
      else if (c === '[') opens.push(']');
      else if (c === '}' || c === ']') opens.pop();
    }
  }
  while (opens.length) s += opens.pop();
  return s;
}

/* Estrazione di emergenza con regex quando il JSON non è recuperabile */
function extractFieldsFromRaw(text) {
  function exStr(key) {
    var m = text.match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', 'i'));
    return m ? m[1] : '';
  }
  function exNum(key) {
    var m = text.match(new RegExp('"' + key + '"\\s*:\\s*(\\d+)', 'i'));
    return m ? m[1] : '';
  }
  var obj = {
    nome: exStr('nome'),
    ruolo: exStr('ruolo'),
    background: exStr('background'),
    for: exNum('for'),
    des: exNum('des'),
    cos: exNum('cos'),
    int: exNum('int'),
    sag: exNum('sag'),
    car: exNum('car'),
    tratiCaratteriali: exStr('tratiCaratteriali'),
    trattiFisici: exStr('trattiFisici'),
    oggettiIncantesimi: exStr('oggettiIncantesimi'),
  };
  return obj.nome || obj.ruolo ? obj : null;
}

/* ================================================================
   DATABASE FALLBACK PROCEDURALE — usato quando tutta l'AI è KO
   AI sempre prima: questo scatta SOLO se Groq + Gemini falliscono
   ================================================================ */
/* ---- similarità di Jaro per il matching testuale ---- */
function jaroSimilarity(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  if (s1 === s2) return 1;
  var len1 = s1.length,
    len2 = s2.length;
  var matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  if (matchDist < 0) matchDist = 0;
  var s1Matches = new Array(len1).fill(false);
  var s2Matches = new Array(len2).fill(false);
  var matches = 0,
    transpositions = 0;
  for (var i = 0; i < len1; i++) {
    var start = Math.max(0, i - matchDist);
    var end = Math.min(i + matchDist + 1, len2);
    for (var j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  var k = 0;
  for (var i2 = 0; i2 < len1; i2++) {
    if (!s1Matches[i2]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i2] !== s2[k]) transpositions++;
    k++;
  }
  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
}

/* Punteggio di rilevanza di un testo rispetto all'idea del DM */
function relevanceScore(text, idea) {
  var words = idea.toLowerCase().split(/\s+/);
  var score = 0;
  words.forEach(function (w) {
    if (w.length < 3) return;
    if (text.toLowerCase().indexOf(w) >= 0) {
      score += 2;
      return;
    }
    /* similarità Jaro su ogni parola del testo */
    text
      .toLowerCase()
      .split(/\s+/)
      .forEach(function (tw) {
        var sim = jaroSimilarity(w, tw);
        if (sim > 0.85) score += sim;
      });
  });
  return score;
}

/* Determina il tag del personaggio dall'idea */
function getTagFromIdea(idea) {
  var l = idea.toLowerCase();
  if (/ninja|assassin|ladro|spia|furtivo|scassinatore|borseggiator|rogue/.test(l)) return 'furtivo';
  if (/mago|stregone|druido|chierico|warlock|bardo|alchimist|incantator|magico|arcano/.test(l))
    return 'magico';
  if (
    /guerriero|paladino|barbaro|ranger|monaco|soldato|cavaliere|guardia|combatt|lottator|pugile|gladiator/.test(
      l
    )
  )
    return 'combattente';
  return 'civile';
}

/* Genera una scheda NPC completa usando solo le tabelle locali
   con matching Jaro per scegliere gli elementi più coerenti con l'idea */
function generaFallbackProcedurale(idea, livello, isBoss, isCombattente, slots) {
  var tag = getTagFromIdea(idea);

  /* Nome: prendi il più rilevante dall'idea, o casuale */
  var nomeScores = FALLBACK_DB.nomi.map(function (n) {
    return { n: n, s: relevanceScore(n, idea) };
  });
  nomeScores.sort(function (a, b) {
    return b.s - a.s;
  });
  /* Se nessun nome è rilevante, prendi uno casuale */
  var nome =
    nomeScores[0].s > 0
      ? nomeScores[Math.floor(Math.random() * Math.min(3, nomeScores.length))].n
      : FALLBACK_DB.nomi[Math.floor(Math.random() * FALLBACK_DB.nomi.length)];

  /* Classe: cerca la più vicina all'idea per testo e tag */
  var classiCompatibili = FALLBACK_DB.classi.filter(function (c) {
    return c.tag === tag || c.tag === 'civile';
  });
  var classeScores = (classiCompatibili.length ? classiCompatibili : FALLBACK_DB.classi).map(
    function (c) {
      return { c: c, s: relevanceScore(c.nome, idea) };
    }
  );
  classeScores.sort(function (a, b) {
    return b.s - a.s;
  });
  var classe =
    classeScores[0].s > 0
      ? classeScores[0].c.nome
      : classiCompatibili[Math.floor(Math.random() * classiCompatibili.length)].nome;
  /* Aggiusta con l'idea diretta se contiene keyword esplicita */
  var ideaL = idea.toLowerCase();
  if (/ninja/.test(ideaL)) classe = 'Ninja';
  else if (/assassin/.test(ideaL)) classe = 'Assassino';
  else if (/guerriero|warrior/.test(ideaL)) classe = 'Guerriero';
  else if (/mago|wizard/.test(ideaL)) classe = 'Mago';
  else if (/ladro|rogue/.test(ideaL)) classe = 'Ladro';
  else if (/paladino/.test(ideaL)) classe = 'Paladino';
  else if (/barbaro/.test(ideaL)) classe = 'Barbaro';
  else if (/ranger/.test(ideaL)) classe = 'Ranger';
  else if (/bardo/.test(ideaL)) classe = 'Bardo';

  /* Background: filtra per compatibilità tag, poi ordina per rilevanza */
  var bgPool = FALLBACK_DB.backgrounds.filter(function (b) {
    return b.tag.indexOf(tag) >= 0;
  });
  if (!bgPool.length) bgPool = FALLBACK_DB.backgrounds;
  var bgScores = bgPool.map(function (b) {
    return { b: b, s: relevanceScore(b.testo, idea) };
  });
  bgScores.sort(function (a, b) {
    return b.s - a.s;
  });
  /* Prendi uno dei top-5 per varietà */
  var top5bg = bgScores.slice(0, Math.min(5, bgScores.length));
  var bg = top5bg[Math.floor(Math.random() * top5bg.length)].b.testo;

  /* Tratti: prendi quelli più rilevanti all'idea */
  function pickBest(pool, n) {
    var scored = pool.map(function (t) {
      return { t: t, s: relevanceScore(t, idea) };
    });
    scored.sort(function (a, b) {
      return b.s - a.s;
    });
    var top = scored.slice(0, Math.min(n * 3, scored.length));
    return top[Math.floor(Math.random() * top.length)].t;
  }
  var tratto = pickBest(FALLBACK_DB.trattiCaratteriali, 5);
  var fisico = pickBest(FALLBACK_DB.trattiFisici, 5);

  /* Statistiche procedurali con dado */
  function roll4d6drop() {
    var rolls = [0, 0, 0, 0].map(function () {
      return Math.floor(Math.random() * 6) + 1;
    });
    rolls.sort(function (a, b) {
      return a - b;
    });
    return rolls[1] + rolls[2] + rolls[3];
  }
  var statKeys = ['for', 'des', 'cos', 'int', 'sag', 'car'];
  var statVals = statKeys.map(function () {
    return roll4d6drop();
  });
  /* Scala i valori per il livello */
  if (livello) {
    var maxStat =
      livello <= 5
        ? 16
        : livello <= 10
          ? 18
          : livello <= 15
            ? 20
            : livello <= 16
              ? 22
              : isBoss
                ? 26
                : 24;
    statVals = statVals.map(function (v) {
      return Math.min(maxStat, Math.max(8, v));
    });
  }
  /* Assegna la stat più alta alla caratteristica primaria del ruolo */
  var statObj = {};
  statKeys.forEach(function (k, i) {
    statObj[k] = statVals[i];
  });
  var sorted = statVals.slice().sort(function (a, b) {
    return b - a;
  });
  if (tag === 'combattente') {
    statObj['for'] = sorted[0];
    statObj['cos'] = sorted[1];
  } else if (tag === 'magico') {
    statObj['int'] = sorted[0];
    statObj['sag'] = sorted[1];
  } else if (tag === 'furtivo') {
    statObj['des'] = sorted[0];
    statObj['int'] = sorted[1];
  }

  /* HP e CA procedurali */
  var dv = isCombattente ? 10 : 8;
  var lv = livello || 4;
  var conMod = Math.floor((statObj['cos'] - 10) / 2);
  var hp = Math.max(1, dv * lv + conMod * lv + (isBoss ? Math.round(dv * lv * 0.6) : 0));
  hp += Math.floor(Math.random() * 10) - 5;
  var ca = isCombattente ? 13 : 11;
  if (livello) ca = livello <= 5 ? 12 : livello <= 10 ? 14 : livello <= 15 ? 16 : 17;
  ca += Math.floor(Math.random() * 3);

  /* Equipaggiamento dal database armi */
  var equip = slots.map(function (slot) {
    var fromDb = pescaDalDatabase(slot.rarita, slot.isArma);
    return fromDb
      ? fromDb.nome
      : slot.isArma
        ? 'Arma (' + slot.rarita + ')'
        : 'Oggetto (' + slot.rarita + ')';
  });

  /* Età procedurale: coerente con il livello e il ruolo */
  var etaBase = livello ? Math.max(16, 18 + livello * 3) : 30;
  var etaCalc = etaBase + Math.floor(Math.random() * 15) - 5;
  if (isBoss) etaCalc = Math.max(etaCalc, 35);

  return {
    nome: nome,
    ruolo: classe + (livello ? ' Lv.' + livello : ''),
    background: bg,
    tratiCaratteriali: tratto,
    trattiFisici: fisico,
    oggettiIncantesimi: equip.join(', '),
    for: String(statObj['for']),
    des: String(statObj['des']),
    cos: String(statObj['cos']),
    int: String(statObj['int']),
    sag: String(statObj['sag']),
    car: String(statObj['car']),
    hp: String(hp),
    ca: String(ca),
    eta: String(etaCalc),
  };
}
