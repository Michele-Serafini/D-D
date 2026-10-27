/* ===========================================================
   LOGICA EQUIPAGGIAMENTO NPC ↔ DATABASE ARMI
   =========================================================== */

/* Determina se il personaggio è un combattente (ha senso dargli armi da combattimento) */
function npcIsCombattente(idea) {
  return /\b(guerrier|soldato|paladin|barbar|ranger|ladro|assassin|ninja|samurai|cavalier|knight|combatt|spadaccin|arciere|balestriere|cacciator|mercenari|guardia|duellist|berserker|spadach|lottator|pugile|gladiator|ranger|scout|spadacc|sbirro|guardie|truppe|miliz|capitano|ammiraglio|generale|warlord|mercenari|bandito|brigante|pirata|corsaro)\b/i.test(
    idea
  );
}

/* Determina se il personaggio ha una professione civile/comune (cuoco, artigiano, ecc.)
   In questo caso le stat vengono calibrate in modo realistico: una sola massimizzata, le altre nella norma */
function npcIsCivile(idea) {
  return /\b(cuoco|chef|cuoca|fornaio|fornaia|fornaggiar|pasticcier|oste|ostessa|tavern|locandier|lacandier|artigian|fabbro|falegnam|tessitor|calzolair|sartore|sarta|gioiellier|mercant|commerciant|bottegai|bottegaia|contadin|fattore|agric|mugnaio|pescator|pescatrice|boscaiolo|boscaiola|minatori|minatore|miniera|medico|guaritore|guaritrice|farmacist|apotecar|spezial|stregona|sacerdot|chieric|monaco|monaca|prete|pastore|maestro|maestra|insegnan|bibliotec|archivista|scrivano|contabile|contabilità|notaio|avvocato|giudice|mercato|venditore|venditrice|arald|banditore|giostellier)\b/i.test(
    idea
  );
}

/* Slot di equipaggiamento in base al livello:
   Tabella standard:
   lv 1-5:  1 arma Rara + 1 oggetto Non comune
   lv 6-10: 1 arma Molto rara + 1 oggetto Raro + 1 arma Non comune
   lv 11-15:1 arma Molto rara + 2 oggetti Molto rari + 1 arma Rara
   lv 16-20:1 arma Leggendaria + 2 oggetti Molto rari
   Se non combattente, isArma=false su tutto → si usano solo "Oggetti magici/utensili" */
function getEquipSlots(livello, isCombattente) {
  var slots = [];
  if (!livello) {
    /* Nessun livello specificato: 1 oggetto raro + 1 non comune */
    slots.push({ rarita: 'Raro', isArma: isCombattente });
    slots.push({ rarita: 'Non comune', isArma: false });
    return slots;
  }
  if (livello <= 5) {
    /* lv 1-5: 1 arma Rara + 1 oggetto Non comune */
    slots.push({ rarita: 'Raro', isArma: isCombattente });
    slots.push({ rarita: 'Non comune', isArma: false });
  } else if (livello <= 10) {
    /* lv 6-10: 1 arma Molto rara + 1 oggetto Raro + 1 arma Non comune */
    slots.push({ rarita: 'Molto raro', isArma: isCombattente });
    slots.push({ rarita: 'Raro', isArma: false });
    slots.push({ rarita: 'Non comune', isArma: isCombattente });
  } else if (livello <= 15) {
    /* lv 11-15: 1 arma Molto rara + 2 oggetti Molto rari + 1 arma Rara */
    slots.push({ rarita: 'Molto raro', isArma: isCombattente });
    slots.push({ rarita: 'Molto raro', isArma: false });
    slots.push({ rarita: 'Molto raro', isArma: false });
    slots.push({ rarita: 'Raro', isArma: isCombattente });
  } else {
    /* lv 16-20: 1 arma Leggendaria + 2 oggetti Molto rari */
    slots.push({ rarita: 'Leggendario', isArma: isCombattente });
    slots.push({ rarita: 'Molto raro', isArma: false });
    slots.push({ rarita: 'Molto raro', isArma: false });
  }
  return slots;
}

/* Tipi di item considerati "armi da combattimento" */
var TIPI_ARMA = [
  'Spada lunga',
  'Spada',
  'Tridente',
  'Pugnale',
  'Falce',
  'Ascia',
  'Mazza',
  'Martello da guerra',
  'Arco',
  'Balestra',
  'Lancia',
  'Bacchetta/Bastone magico',
  'Bastone',
];
var TIPI_OGGETTO = ['Oggetti magici', 'Pozioni', 'Armature', 'Elmi'];

/* Pesca un item dal database (state.armi) rispettando rarità e tipo */
function pescaDalDatabase(rarita, isArma) {
  var pool = state.armi.filter(function (w) {
    if (w.rarita !== rarita) return false;
    if (isArma) return TIPI_ARMA.indexOf(w.tipo) >= 0;
    return TIPI_OGGETTO.indexOf(w.tipo) >= 0;
  });
  /* Se non trova con tipo esatto, allarga a qualsiasi tipo con quella rarità */
  if (pool.length === 0) {
    pool = state.armi.filter(function (w) {
      return w.rarita === rarita;
    });
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* Aggiunge un item generato dall'AI al database armi (state.armi) */
function aggiungiAlDatabase(item) {
  /* Evita duplicati per nome */
  var exists = state.armi.some(function (w) {
    return w.nome.toLowerCase() === item.nome.toLowerCase();
  });
  if (exists) return false;
  var newId = 'w_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
  var pv = prezzoPerRarita(item.rarita || 'Non comune');
  /* La descrizione è l'effetto magico generato dall'AI, oppure la descrizione esplicita */
  var descrizione = item.descrizione || item.effetto || '';
  state.armi.unshift({
    id: newId,
    nome: item.nome,
    descrizione: descrizione,
    tipo: item.tipo || 'Oggetti magici',
    rarita: item.rarita || 'Non comune',
    valuta: pv.valuta,
    prezzo: pv.prezzo,
    immagine: '',
  });
  return true;
}

/* Costruisce la stringa oggettiIncantesimi mescolando item dal DB e nuovi generati dall'AI,
   poi aggiunge quelli nuovi al database */
function costruisciEquipNpc(slots, aiItems, isCombattente) {
  var risultato = [];
  var nuoviAggiunti = 0;

  slots.forEach(function (slot, idx) {
    /* Prima prova a pescare dal database */
    var fromDb = pescaDalDatabase(slot.rarita, slot.isArma);

    /* Se c'è un item AI disponibile per questo slot, usalo e salvalo nel DB */
    var aiItem = aiItems && aiItems[idx] ? aiItems[idx] : null;

    if (aiItem && aiItem.nome) {
      /* Usa l'item AI, salvalo nel DB */
      var tipoGuess = slot.isArma ? TIPI_ARMA[Math.floor(Math.random() * 6)] : 'Oggetti magici';
      aiItem.tipo = aiItem.tipo || tipoGuess;
      aiItem.rarita = slot.rarita;
      /* prezzo e valuta calcolati dentro aggiungiAlDatabase */
      var aggiunto = aggiungiAlDatabase(aiItem);
      if (aggiunto) nuoviAggiunti++;
      risultato.push(aiItem.nome + (aiItem.effetto ? ' (' + aiItem.effetto + ')' : ''));
    } else if (fromDb) {
      /* Usa item dal DB esistente */
      risultato.push(fromDb.nome);
    } else {
      /* Fallback generico */
      risultato.push(
        slot.isArma ? 'Lama senza nome (' + slot.rarita + ')' : 'Amuleto (' + slot.rarita + ')'
      );
    }
  });

  return { testo: risultato.join(', '), nuoviAggiunti: nuoviAggiunti };
}

function prezzoPerRarita(rarita) {
  /* Ritorna {prezzo, valuta} con range casuali come da regolamento ufficiale */
  function rnd(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  switch (rarita) {
    case 'Comune':
      return { prezzo: rnd(1, 10), valuta: 'mo' };
    case 'Non comune':
      return { prezzo: rnd(11, 100), valuta: 'mo' };
    case 'Raro':
      return { prezzo: rnd(101, 500), valuta: 'mo' };
    case 'Molto raro':
      return { prezzo: rnd(501, 1000), valuta: 'mo' };
    case 'Leggendario':
      return { prezzo: rnd(1001, 2500), valuta: 'mo' };
    case 'Arma unica':
      return { prezzo: rnd(2501, 5000), valuta: 'mo' };
    case 'Arma divina':
      return { prezzo: rnd(5001, 10000), valuta: 'mo' };
    default:
      return { prezzo: rnd(11, 100), valuta: 'mo' };
  }
}

/* ================================================================
   SISTEMA IMMAGINE NPC — Lexica.art (API pubblica, no key) + Picsum fallback
   ================================================================ */
function buildImageQuery(npc) {
  var parts = [];
  if (npc.ruolo) parts.push(npc.ruolo.replace(/lv\.?\s*\d+/gi, '').trim());
  parts.push('DnD fantasy character portrait art');
  if (npc.trattiFisici) parts.push(npc.trattiFisici.split(/\s+/).slice(0, 4).join(' '));
  return parts.join(' ').slice(0, 100);
}

async function cercaImmagineNpc(npc) {
  state._avatarLoading = true;
  aggiornaPannelloAvatar();
  try {
    var resp = await fetch(
      'https://lexica.art/api/v1/search?q=' + encodeURIComponent(buildImageQuery(npc)),
      { signal: AbortSignal.timeout(6000) }
    );
    if (resp.ok) {
      var data = await resp.json();
      var imgs = (data.images || []).filter(function (img) {
        return img.src && img.width >= 200 && img.height >= 200;
      });
      if (imgs.length > 0) {
        var portraits = imgs.filter(function (img) {
          return img.height >= img.width;
        });
        var pool = portraits.length > 0 ? portraits : imgs;
        state.npc.immagine = pool[Math.floor(Math.random() * Math.min(6, pool.length))].src;
        state._avatarLoading = false;
        aggiornaPannelloAvatar();
        saveToStorage();
        return;
      }
    }
  } catch (e) {
    /* passa al fallback */
  }
  /* Fallback: Picsum con seed deterministico sul nome */
  var seed = (npc.nome || 'npc').split('').reduce(function (a, c) {
    return a + c.charCodeAt(0);
  }, 0);
  state.npc.immagine = 'https://picsum.photos/seed/' + seed + '/400/500';
  state._avatarLoading = false;
  aggiornaPannelloAvatar();
  saveToStorage();
}

function aggiornaPannelloAvatar() {
  var frame = document.getElementById('npc-avatar-frame');
  if (!frame) return;
  frame.innerHTML = '';
  if (state._avatarLoading) {
    var ov = document.createElement('div');
    ov.className = 'npc-avatar-ov';
    ov.innerHTML = '<div class="npc-av-spin"></div>';
    frame.appendChild(ov);
    return;
  }
  if (state.npc.immagine) {
    var img = document.createElement('img');
    img.src = state.npc.immagine;
    img.alt = state.npc.nome || 'NPC';
    img.onerror = function () {
      state.npc.immagine = '';
      aggiornaPannelloAvatar();
    };
    frame.appendChild(img);
  } else {
    var ph = document.createElement('div');
    ph.className = 'npc-avatar-ph';
    ph.innerHTML = ICON.npc + '<span>Cerca immagine</span>';
    frame.appendChild(ph);
  }
}

/* ===========================================================
   generateNpcFromAI — FASE 1: scheda veloce, FASE 2: item in background
   =========================================================== */
async function generateNpcFromAI(idea) {
  if (!idea || !idea.trim()) {
    notify("Scrivi un'idea per l'NPC prima di generare.", 'err');
    return;
  }

  state.npcLoading = true;
  renderMain();

  /* --- Analisi --- */
  var lvlMatch = idea.match(/\b(?:livello|lv[l]?\.?|level)\s*(\d{1,2})\b/i);
  var livello = lvlMatch ? parseInt(lvlMatch[1], 10) : null;
  var isBoss =
    /\b(boss|villain|distruttore|signore oscuro|lich|semidio|dio|leggendario|overlord|tiranno|arcimago|imperatore|sterminatore)\b/i.test(
      idea
    );
  var isCombattente = npcIsCombattente(idea);
  var isCivile = !isCombattente && npcIsCivile(idea);
  var slots = getEquipSlots(livello, isCombattente);

  /* Calibrazione stat */
  var statNote;
  if (isCivile && livello) {
    /* Professione civile: 1 stat primaria alta (coerente col ruolo), le altre 8-12 */
    statNote =
      'Lv' +
      livello +
      ' CIVILE: max 1 stat primaria 14-18 coerente col ruolo (es. Des per cuoco, Int per medico, Sag per sacerdote), le altre 8-12, NO valori alti ovunque';
  } else if (isCivile) {
    statNote = 'CIVILE: max 1 stat primaria 14-16, le altre 8-12';
  } else if (livello) {
    if (livello <= 5) statNote = 'Lv' + livello + ': 8-16';
    else if (livello <= 10) statNote = 'Lv' + livello + ': primarie max 18';
    else if (livello <= 15) statNote = 'Lv' + livello + ': primarie 18-20';
    else if (livello <= 16) statNote = 'Lv' + livello + ': primarie 20-22';
    else
      statNote = isBoss
        ? 'Lv' + livello + ' BOSS: primarie 22-26'
        : 'Lv' + livello + ': primarie 20-24';
  } else {
    statNote = isBoss ? 'BOSS: primarie 20-26' : 'coerenti col ruolo';
  }

  /* HP e CA */
  var hpNote, caNote;
  if (livello) {
    var dv = isCombattente ? 10 : 8;
    var hpMin = dv * livello,
      hpMax = (dv + 4) * livello + livello * 2;
    if (isBoss) {
      hpMin = Math.round(hpMin * 1.5);
      hpMax = Math.round(hpMax * 1.8);
    }
    hpNote = hpMin + '-' + hpMax;
    caNote = livello <= 5 ? '11-14' : livello <= 10 ? '13-16' : livello <= 15 ? '15-18' : '17-22';
  } else {
    hpNote = isBoss ? '120-250' : '30-80';
    caNote = isBoss ? '16-20' : '11-15';
  }

  /* Nomi degli item esistenti nel DB da evitare */
  var existingNames = state.armi
    .slice(0, 30)
    .map(function (w) {
      return w.nome;
    })
    .join(', ');

  /* Archetipo casuale — passato come spunto breve nel prompt */
  var archP = [
    'ironico e sarcastico',
    'ossessivo e perfezionista',
    'gentile ma con lato oscuro',
    'paranoico e diffidente',
    'impulsivo e istintivo',
    'melanconico e poetico',
    'inquietantemente allegro',
    'pragmatico e freddo',
    "devoto a un'idea astratta",
    'curioso compulsivo',
    'bugiardo cronico',
    'silenzioso e osservatore',
  ][Math.floor(Math.random() * 12)];
  var archF = [
    'cicatrice al sopracciglio, voce roca',
    'capelli bianchi, mani fredde',
    'tatuaggi tribali sul collo',
    'porta sempre guanti, non li toglie mai',
    'occhi di colore diverso',
    'altissimo e magrissimo, si muove in silenzio',
    'capelli rossi con campanelle',
    'basso e tozzo, forza enorme',
    'bruciature sul lato sinistro',
    'volto giovane su corpo invecchiato',
    'abbigliamento vistoso e rumoroso',
    'portamento militare, cicatrici multiple',
  ][Math.floor(Math.random() * 12)];

  /* seed DEVE essere dichiarato prima di essere usato nel prompt */
  var seed = Math.floor(Math.random() * 90000) + 10000;

  /* Prompt Fase 1 — minimo assoluto di token, massima velocità */
  var promptScheda =
    'NPC generator D&D5e. JSON solo, no backtick.\n' +
    '{"nome":"","ruolo":"","background":"","tratiCaratteriali":"","trattiFisici":"","for":0,"des":0,"cos":0,"int":0,"sag":0,"car":0,"hp":0,"ca":0,"eta":0}\n' +
    'stat=' +
    statNote +
    ' hp=' +
    hpNote +
    ' ca=' +
    caNote +
    '\n' +
    'eta=numero intero (anni del personaggio, coerente col ruolo e livello).\n' +
    'background=2 frasi complete, NON vuoto.\n' +
    'personalita="' +
    archP +
    '"+difetto+tic. fisico="' +
    archF +
    '"+abbigliamento.\n' +
    'Max 120 car per stringa. S=' +
    seed;

  var hasGroq = state.groqKey && state.groqKey.trim();
  var hasGemini = state.geminiKey && state.geminiKey.trim();
  if (!hasGroq && !hasGemini) {
    notify('Configura almeno una chiave API. Clicca \u2699.', 'err');
    state.npcLoading = false;
    renderMain();
    return;
  }

  var rawScheda = null,
    lastErr = null,
    modelUsed = null;
  /* AI PRIMA — Groq poi Gemini */
  try {
    var result = await callAI(promptScheda, 'NPC:"' + idea.trim().slice(0, 200) + '"');
    rawScheda = result.raw;
    modelUsed = result.engine;
  } catch (err) {
    lastErr = err;
    /* Se tutta l'AI è KO → fallback procedurale istantaneo */
    notify('\u26A0 AI non disponibile, uso tabelle locali...', 'err');
  }

  /* ---- Percorso AI ---- */
  if (rawScheda) {
    var npcData = null;
    var clean = rawScheda
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    try {
      npcData = JSON.parse(clean);
    } catch (e1) {
      try {
        npcData = JSON.parse(repairTruncatedJson(clean));
      } catch (e2) {
        npcData = extractFieldsFromRaw(clean);
      }
    }

    if (npcData) {
      /* Popola state.npc dai dati AI */
      var ALL = [
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
      ];
      ALL.forEach(function (f) {
        state.npc[f] = '';
      });
      state.npc._id = null;

      [
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
      ].forEach(function (f) {
        var v = npcData[f];
        if (v !== undefined && v !== null) {
          var s = String(v).trim();
          if (s && s !== 'N/A' && s !== '-') state.npc[f] = s;
        }
      });

      /* Fallback testi per campi vuoti — pool dal DB locale */
      var rndFb = function (arr) {
        return arr[Math.floor(Math.random() * arr.length)];
      };
      if (!state.npc.tratiCaratteriali || state.npc.tratiCaratteriali.trim().length < 20)
        state.npc.tratiCaratteriali = rndFb(FALLBACK_DB.trattiCaratteriali);
      if (!state.npc.trattiFisici || state.npc.trattiFisici.trim().length < 20)
        state.npc.trattiFisici = rndFb(FALLBACK_DB.trattiFisici);
      var bgVuoto =
        !state.npc.background ||
        state.npc.background.trim().length < 30 ||
        state.npc.background.trim() === (state.npc.nome || '').trim();
      if (bgVuoto) {
        var bgComp = FALLBACK_DB.backgrounds.filter(function (b) {
          return b.tag.indexOf(getTagFromIdea(idea)) >= 0;
        });
        state.npc.background = rndFb(bgComp.length ? bgComp : FALLBACK_DB.backgrounds).testo;
      }

      /* Fallback stat */
      var statKeys = ['for', 'des', 'cos', 'int', 'sag', 'car'];
      var statVals = statKeys.map(function (k) {
        return parseInt(state.npc[k], 10);
      });
      var allBad = statVals.every(function (v) {
        return isNaN(v) || v <= 0;
      });
      var allFlat =
        !allBad &&
        statVals.every(function (v) {
          return !isNaN(v) && v >= 8 && v <= 12;
        });
      /* Per civili: forza il ricalcolo se i valori sono troppo alti o tutti uguali */
      var civileOverbuffed =
        isCivile &&
        !allBad &&
        statVals.some(function (v) {
          return !isNaN(v) && v >= 17;
        });
      if (allBad || (allFlat && (livello >= 15 || isBoss)) || civileOverbuffed) {
        var ideaL2 = idea.toLowerCase(),
          statSet;
        if (isCivile) {
          /* Professione civile: 1 stat dominante, le altre basse */
          var base = [10, 10, 10, 10, 10, 10];
          if (/cuoco|chef|fornaio|pasticcier|oste|tavern/.test(ideaL2)) {
            base[3] = 15;
            base[4] = 14;
          } /* Int/Sag per cuochi */
          else if (/fabbro|falegnam|artigian|calzolair/.test(ideaL2)) {
            base[0] = 14;
            base[2] = 13;
          } /* For/Cos */
          else if (/medico|guaritore|farmacist|apotecar/.test(ideaL2)) {
            base[3] = 15;
            base[4] = 14;
          } /* Int/Sag */
          else if (/sacerdot|chieric|monaco|prete|pastore/.test(ideaL2)) {
            base[4] = 15;
            base[5] = 13;
          } /* Sag/Car */
          else if (/mercant|venditore|botteg|contadin/.test(ideaL2)) {
            base[3] = 13;
            base[5] = 14;
          } /* Int/Car */
          else if (/maestro|maestra|insegn|bibliotec|scrivano/.test(ideaL2)) {
            base[3] = 15;
            base[4] = 12;
          } /* Int */
          else {
            base[3] = 14;
          } /* default Int */
          var jitterC = function (v) {
            return Math.max(8, Math.min(18, v + Math.floor(Math.random() * 3) - 1));
          };
          statKeys.forEach(function (k, i) {
            state.npc[k] = String(jitterC(base[i]));
          });
        } else if (livello >= 17 || isBoss) {
          if (/mago|arci|stregone|necroman|scienziat|professor|crono|intellett/.test(ideaL2))
            statSet = [20, 16, 22, 26, 18, 14];
          else if (/guerriero|paladin|barbar|soldato|knight|berserker/.test(ideaL2))
            statSet = [26, 18, 24, 12, 16, 14];
          else statSet = [22, 18, 20, 20, 16, 14];
          var jitter = function (v) {
            return Math.max(3, Math.min(30, v + Math.floor(Math.random() * 3) - 1));
          };
          statKeys.forEach(function (k, i) {
            state.npc[k] = String(jitter(statSet[i]));
          });
        } else if (livello >= 12) {
          statSet = [18, 16, 18, 16, 14, 12];
          var jitter2 = function (v) {
            return Math.max(3, Math.min(30, v + Math.floor(Math.random() * 3) - 1));
          };
          statKeys.forEach(function (k, i) {
            state.npc[k] = String(jitter2(statSet[i]));
          });
        } else if (livello >= 8) {
          statSet = [16, 14, 16, 14, 12, 10];
          var jitter3 = function (v) {
            return Math.max(3, Math.min(30, v + Math.floor(Math.random() * 3) - 1));
          };
          statKeys.forEach(function (k, i) {
            state.npc[k] = String(jitter3(statSet[i]));
          });
        } else {
          statSet = [14, 12, 14, 12, 10, 10];
          var jitter4 = function (v) {
            return Math.max(3, Math.min(30, v + Math.floor(Math.random() * 3) - 1));
          };
          statKeys.forEach(function (k, i) {
            state.npc[k] = String(jitter4(statSet[i]));
          });
        }
      }

      /* Fallback HP / CA */
      if (!state.npc.hp || parseInt(state.npc.hp, 10) <= 0) {
        var baseHp2 = livello
          ? (isCombattente ? 10 : 8) * livello + livello * 2
          : isBoss
            ? 150
            : 45;
        if (isBoss) baseHp2 = Math.round(baseHp2 * 1.6);
        state.npc.hp = String(baseHp2 + Math.floor(Math.random() * 20) - 10);
      }
      if (!state.npc.ca || parseInt(state.npc.ca, 10) <= 0) {
        var baseCA2 = livello
          ? livello <= 5
            ? 12
            : livello <= 10
              ? 14
              : livello <= 15
                ? 16
                : 18
          : isBoss
            ? 17
            : 12;
        state.npc.ca = String(baseCA2 + Math.floor(Math.random() * 3));
      }

      /* Equipaggiamento dal DB */
      var dbEquip2 = slots.map(function (slot) {
        var fromDb = pescaDalDatabase(slot.rarita, slot.isArma);
        return fromDb
          ? fromDb.nome
          : slot.isArma
            ? 'Arma (' + slot.rarita + ')'
            : 'Oggetto (' + slot.rarita + ')';
      });
      state.npc.oggettiIncantesimi = dbEquip2.join(', ');

      /* Scheda AI pronta */
      state.npcLoading = false;
      saveToStorage();
      renderMain();
      notify('Scheda pronta (' + modelUsed + ')! Genero oggetti in background...');
      /* Ricerca immagine in parallelo — non blocca la UI */
      cercaImmagineNpc(state.npc);
      setTimeout(function () {
        generaItemInBackground(idea, slots, isCombattente, existingNames);
      }, 80);
      return;
    }
  }

  /* ---- Percorso FALLBACK PROCEDURALE ---- */
  /* Scheda generata istantaneamente dalle tabelle locali con matching Jaro */
  var fbNpc = generaFallbackProcedurale(idea, livello, isBoss, isCombattente, slots);
  var ALL2 = [
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
  ];
  ALL2.forEach(function (f) {
    state.npc[f] = '';
  });
  state.npc._id = null;
  ALL2.forEach(function (f) {
    if (fbNpc[f]) state.npc[f] = fbNpc[f];
  });

  state.npcLoading = false;
  saveToStorage();
  renderMain();
  notify('\u{1F4DA} Scheda generata con tabelle locali (AI non disponibile).');
  cercaImmagineNpc(state.npc);
}

/* Genera gli item per l'NPC in background e aggiorna scheda + DB */
async function generaItemInBackground(idea, slots, isCombattente, existingNames) {
  /* Quanti item creativi garantiti: almeno 2, fino al totale degli slot */
  var nNuovi = Math.max(2, Math.ceil(slots.length * 0.6));

  var tipiValidi = isCombattente
    ? 'Spada lunga,Spada,Pugnale,Ascia,Arco,Lancia,Mazza,Bastone,Oggetti magici,Armature,Elmi,Pozioni'
    : 'Oggetti magici,Pozioni,Utensili magici,Strumenti del mestiere,Amuleti,Anelli,Mantelli,Borse';
  var slotStr = slots
    .slice(0, nNuovi)
    .map(function (s, i) {
      return i + 1 + ')' + s.rarita + (s.isArma ? '[ARMA]' : '[OGG]');
    })
    .join(' ');

  var promptItems =
    'D&D5e item creator. JSON only.\n' +
    'Crea ' +
    nNuovi +
    ' oggetti per: "' +
    idea.trim().slice(0, 100) +
    '".\n' +
    'Slot: ' +
    slotStr +
    '\n' +
    'tipo da: ' +
    tipiValidi +
    '\n' +
    'nome evocativo unico. effetto max 80 car. No nomi: ' +
    existingNames.slice(0, 200);

  var itemsData = null;
  try {
    var wrappedSys =
      promptItems +
      '\nRispondi con JSON oggetto: {"items":[{"nome":"","tipo":"","rarita":"","effetto":""}]}';
    var result = await callAI(wrappedSys, 'Crea gli oggetti.');
    var clean = result.raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    var parsed = JSON.parse(clean);
    itemsData = Array.isArray(parsed) ? parsed : parsed.items || [];
  } catch (e) {
    return;
  }

  if (!Array.isArray(itemsData) || itemsData.length === 0) return;

  /* Aggiungi al database e costruisci la stringa aggiornata */
  var nuoviNomi = [];
  var nuoviAggiunti = 0;
  itemsData.forEach(function (item, i) {
    if (!item || !item.nome) return;
    item.rarita = item.rarita || (slots[i] ? slots[i].rarita : 'Non comune');
    var aggiunto = aggiungiAlDatabase(item);
    if (aggiunto) nuoviAggiunti++;
    nuoviNomi.push(
      item.nome +
        (item.effetto
          ? ' (' + item.effetto.slice(0, 60) + (item.effetto.length > 60 ? '...' : '') + ')'
          : '')
    );
  });

  if (nuoviNomi.length === 0) return;

  /* Integra con gli item del DB già assegnati:
     sostituisce i primi N slot con quelli nuovi, mantiene il resto */
  var esistentiParts = state.npc.oggettiIncantesimi ? state.npc.oggettiIncantesimi.split(', ') : [];
  var merged = nuoviNomi.concat(esistentiParts.slice(nuoviNomi.length));
  state.npc.oggettiIncantesimi = merged.join(', ');

  saveToStorage();
  renderMain();

  notify(
    '\u2728 ' +
      nuoviAggiunti +
      ' nuov' +
      (nuoviAggiunti === 1 ? 'o oggetto aggiunto' : 'i oggetti aggiunti') +
      " all'Emporio!"
  );
}
