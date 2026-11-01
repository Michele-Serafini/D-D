/* INIZIATIVA */
function ensureTrailingEmpty() {
  if (state.combatants.length === 0) {
    state.combatants.push(makeEmptyCombatant());
    return;
  }
  var last = state.combatants[state.combatants.length - 1];
  var hasContent =
    (last.nome && last.nome.trim() !== '') ||
    (last.iniziativa !== '' && last.iniziativa !== null && last.iniziativa !== undefined);
  if (hasContent) state.combatants.push(makeEmptyCombatant());
}

/* ============================================================
   INIZIATIVA — riscritta da zero
   Principio: lo state è la fonte di verità.
   La UI legge lo state e basta. Firebase aggiorna lo state
   degli altri utenti; la UI locale non viene mai distrutta
   mentre si digita.
   ============================================================ */

/* ============================================================================
   SEZIONE 5: TRACKER INIZIATIVA, COMBATTIMENTO & ENCOUNTER BUILDER
   ============================================================================ */
function renderIniziativa() {
  var wrap = document.createElement('div');

  // HEADER
  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';

  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  top.innerHTML =
    '<div><div class="header-eyebrow mb-3"><span>Tomo del Conflitto</span></div>' +
    '<h1 class="header-title">Ordine di Iniziativa</h1>' +
    '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Gestore dinamico per personaggi, boss e condizioni di gioco</p></div>';

  var actions = buildCombatActions();

  top.appendChild(actions);
  hc.appendChild(top);

  var fd = document.createElement('div');
  fd.className = 'filigree-divider mt-7';
  hc.appendChild(fd);

  var notice = document.createElement('div');
  notice.className = 'notice mt-5';
  notice.innerHTML =
    '<strong style="color:var(--gold);font-style:normal;">&#x1F4DC; Istruzioni: </strong>' +
    'scrivi il nome e il valore di <em>iniziativa</em>. Premi <em>Invio</em> per aggiungere un altro combattente.';
  hc.appendChild(notice);
  header.appendChild(hc);
  wrap.appendChild(header);

  // BODY
  var section = document.createElement('section');
  section.className = 'container-main pb-20';
  section.style.cssText = 'padding-top:2rem;';

  section.appendChild(buildCombatWorkspace());
  wrap.appendChild(section);

  return wrap;
}

function buildCombatActions() {
  var actions = document.createElement('div');
  actions.className = 'combat-actions flex flex-wrap items-center gap-2';

  var rc = document.createElement('div');
  rc.className = 'round-counter';
  rc.innerHTML = '<span>ROUND</span><span class="round-num">' + state.round + '</span>';
  actions.appendChild(rc);

  if (isDM()) {
    var nb = document.createElement('button');
    nb.className = 'btn-gold';
    nb.classList.add('combat-next-turn');
    nb.disabled = getOrderedActive().length === 0;
    nb.innerHTML = ICON.arrowRight + ' Prossimo Turno';
    nb.onclick = nextTurn;
    actions.appendChild(nb);

    var rb = document.createElement('button');
    rb.className = 'btn-blood';
    rb.innerHTML = ICON.refresh + ' Reset';
    rb.onclick = function () {
      if (!confirm('Azzerare il combattimento?')) return;
      state.combatants = [makeEmptyCombatant()];
      state.round = 1;
      state.activeIndex = 0;
      state.expandedCondition = null;
      state.assigningCondId = null;
      fbSaveIniziativa(true);
      renderMain();
    };
    actions.appendChild(rb);
  }

  return actions;
}

function buildCombatTracker() {
  var left = document.createElement('div');

  // Toolbar
  var toolbar = document.createElement('div');
  toolbar.className = 'combatants-toolbar';
  var namedCount = state.combatants.filter(function (c) {
    return c.nome && c.nome.trim();
  }).length;
  var addBtnStr = isDM()
    ? '<button class="add-icon-btn" title="Aggiungi combattente">' + ICON.plus + '</button>'
    : '';
  toolbar.innerHTML =
    '<div class="toolbar-title">Combattenti <span class="toolbar-count">(' +
    namedCount +
    ')</span></div><div>' +
    addBtnStr +
    '</div>';

  var addIconBtn = toolbar.querySelector('.add-icon-btn');
  if (addIconBtn) {
    addIconBtn.onclick = function () {
      addCombatant();
    };
  }
  left.appendChild(toolbar);

  // Lista combattenti
  var listEl = document.createElement('div');
  listEl.id = 'combatants-list';
  left.appendChild(listEl);

  // Pulsante thin in fondo
  if (isDM()) {
    var thin = document.createElement('div');
    thin.className = 'add-combatant-thin mt-3';
    thin.innerHTML = ICON.plus + '<span>Nuovo combattente</span>';
    thin.onclick = function () {
      addCombatant();
    };
    left.appendChild(thin);
  }

  var initialRender = setTimeout(renderIniziativaBody, 0);
  onSectionCleanup(function () {
    clearTimeout(initialRender);
  });
  return left;
}

function buildCombatWorkspace() {
  var layout = document.createElement('div');
  layout.className = 'initiative-layout';
  layout.appendChild(buildCombatTracker());
  var panel = document.createElement('aside');
  panel.className = 'conditions-panel';
  panel.id = 'conditions-panel';
  layout.appendChild(panel);
  return layout;
}

// Aggiunge un combattente e fa focus sul nuovo input
function addCombatant() {
  var newC = makeEmptyCombatant();
  state.combatants.push(newC);
  // NON salvare su Firebase la riga vuota — lo faremo quando l'utente la riempie
  renderCombatantsList();
  updateToolbarCount();
  setTimeout(function () {
    var inputs = document.querySelectorAll('.combatant-name-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 30);
}

function updateToolbarCount() {
  var tc = document.querySelector('.toolbar-count');
  if (tc) {
    var n = state.combatants.filter(function (c) {
      return c.nome && c.nome.trim();
    }).length;
    tc.textContent = '(' + n + ')';
  }
}

function renderIniziativaBody() {
  renderCombatantsList();
  renderConditionsPanel();
  updateToolbarCount();
  refreshCombatControls();
}

function getOrderedActive() {
  return state.combatants
    .filter(function (c) {
      return c.nome && c.nome.trim() !== '';
    })
    .sort(function (a, b) {
      return (Number(b.iniziativa) || 0) - (Number(a.iniziativa) || 0);
    });
}

function refreshCombatControls() {
  var ordered = getOrderedActive();
  if (state.activeIndex >= ordered.length || state.activeIndex < 0) state.activeIndex = 0;
  document.querySelectorAll('.round-num').forEach(function (el) {
    el.textContent = state.round;
  });
  document.querySelectorAll('.combat-next-turn').forEach(function (el) {
    el.disabled = !ordered.length;
  });
  var current = ordered[state.activeIndex];
  document.querySelectorAll('.combatant-card').forEach(function (el) {
    el.classList.toggle('is-active', !!current && el.dataset.combatantId === current.id);
  });
  if (state.section === 'dashboard') updateDashboardCombatSummary();
}

function jumpToCombatant(id) {
  if (!isDM()) return;
  var index = getOrderedActive().findIndex(function (c) {
    return c.id === id;
  });
  if (index === -1) return;
  state.activeIndex = index;
  fbSaveIniziativa(true);
  renderIniziativaBody();
}

function adjustCombatantHp(combatant, amount) {
  if (!isDM()) return;
  var hp = Number(combatant.hp);
  combatant.hp = Math.max(0, (Number.isFinite(hp) ? hp : 0) + amount);
  fbSaveIniziativa(true);
  renderCombatantsList();
}

function renderCombatantsList() {
  var list = document.getElementById('combatants-list');
  if (!list) return;

  var ordered = getOrderedActive();
  var activeId = ordered[state.activeIndex] ? ordered[state.activeIndex].id : null;

  // Aggiornamento chirurgico: aggiorna le card esistenti se possibile,
  // aggiunge/rimuove solo le differenze. Non distrugge mai i campi attivi.
  var existingCards = Array.from(list.children);
  var existingIds = existingCards.map(function (el) {
    return el.dataset.combatantId;
  });
  var newIds = state.combatants.map(function (c) {
    return c.id;
  });

  // Rimuovi card non più presenti
  existingCards.forEach(function (el) {
    if (newIds.indexOf(el.dataset.combatantId) === -1) {
      list.removeChild(el);
    }
  });

  // Aggiorna o inserisci in ordine
  state.combatants.forEach(function (c, idx) {
    var isActive = c.id === activeId;
    var existing = list.querySelector('[data-combatant-id="' + c.id + '"]');

    if (existing) {
      // Card già esistente: aggiorna solo badge, classe attiva, e metti nella posizione giusta
      updateCombatantCard(existing, c, isActive);
      // Riposiziona se necessario (senza distruggere)
      var currentIdx = Array.from(list.children).indexOf(existing);
      if (currentIdx !== idx) {
        list.insertBefore(existing, list.children[idx] || null);
      }
    } else {
      // Card nuova: creala e inseriscila nella posizione giusta
      var newCard = buildCombatantCard(c, isActive);
      var refNode = list.children[idx] || null;
      list.insertBefore(newCard, refNode);
    }
  });
}

// Aggiorna solo gli aspetti non-input di una card esistente
// (badge, classe attiva, ecc.) senza toccare gli input
function updateCombatantCard(cardEl, c, isActive) {
  if (!Array.isArray(c.condizioni)) c.condizioni = [];
  var cat = getCategoria(c.tipo);
  var condClasses = c.condizioni
    .map(function (cid) {
      var co = getCondizione(cid);
      return co ? co.cssClass : '';
    })
    .filter(Boolean)
    .join(' ');
  var hasAnyCond = c.condizioni.length > 0;
  cardEl.className =
    'combatant-card ' +
    cat.cssClass +
    ' ' +
    condClasses +
    (isActive ? ' is-active' : '') +
    (hasAnyCond ? ' has-conditions' : '');

  // Aggiorna badge categoria
  var badge = cardEl.querySelector('.category-badge');
  if (badge) {
    badge.className = 'category-badge ' + cat.badgeClass;
    badge.textContent = cat.label;
  }

  // Aggiorna select categoria (se presente e non ha focus)
  var sel = cardEl.querySelector('.category-select');
  if (sel && document.activeElement !== sel) {
    sel.value = c.tipo;
  }

  // Aggiorna HP input (se non ha focus)
  var hpInput = cardEl.querySelector('.hp-control input');
  if (hpInput && document.activeElement !== hpInput) {
    hpInput.value = c.hp;
  }

  // Aggiorna initInput (se non ha focus)
  var initInput = cardEl.querySelector('.combatant-init input');
  if (initInput && document.activeElement !== initInput) {
    initInput.value = c.iniziativa;
  }

  // Aggiorna nameInput (se non ha focus)
  var nameInput = cardEl.querySelector('.combatant-name-input');
  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = c.nome;
  }

  // Aggiorna condizioni attive
  var ac = cardEl.querySelector('.active-conditions');
  if (c.condizioni.length > 0) {
    if (!ac) {
      ac = document.createElement('div');
      ac.className = 'active-conditions';
      cardEl.appendChild(ac);
    }
    ac.innerHTML = '';
    c.condizioni.forEach(function (cid) {
      var co = getCondizione(cid);
      if (!co) return;
      var b = document.createElement('span');
      b.className = 'condition-badge';
      var style = conditionBadgeStyle(cid);
      b.style.cssText =
        'background:' + style.bg + ';color:' + style.color + ';border-color:' + style.border + ';';
      b.title = co.descrizione[0];
      b.innerHTML =
        '<span>' +
        co.icon +
        '</span><span>' +
        co.nome +
        '</span><button title="Rimuovi" aria-label="Rimuovi ' +
        escapeHtml(co.nome) +
        '">' +
        ICON.x +
        '</button>';
      b.querySelector('button').onclick = function () {
        c.condizioni = c.condizioni.filter(function (x) {
          return x !== cid;
        });
        fbSaveIniziativa(true);
        renderCombatantsList();
      };
      ac.appendChild(b);
    });
  } else if (ac) {
    cardEl.removeChild(ac);
  }
}

// Costruisce una card da zero (solo per nuovi combattenti)
function buildCombatantCard(c, isActive) {
  if (!Array.isArray(c.condizioni)) c.condizioni = [];
  var cat = getCategoria(c.tipo);
  var condClasses = c.condizioni
    .map(function (cid) {
      var co = getCondizione(cid);
      return co ? co.cssClass : '';
    })
    .filter(Boolean)
    .join(' ');
  var hasAnyCond = c.condizioni.length > 0;
  var isNamed = c.nome && c.nome.trim() !== '';

  var card = document.createElement('div');
  card.className =
    'combatant-card ' +
    cat.cssClass +
    ' ' +
    condClasses +
    (isActive ? ' is-active' : '') +
    (hasAnyCond ? ' has-conditions' : '');
  card.dataset.combatantId = c.id;

  // La card è sempre drop target (il drag parte solo dall'handle)
  card.ondragover = function (e) {
    e.preventDefault();
    if (c.id !== _dragSrcId) card.classList.add('drag-over');
  };
  card.ondragleave = function (e) {
    if (!card.contains(e.relatedTarget)) card.classList.remove('drag-over');
  };
  card.ondrop = function (e) {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (!_dragSrcId || _dragSrcId === c.id) return;
    var srcIdx = -1,
      dstIdx = -1;
    state.combatants.forEach(function (x, i) {
      if (x.id === _dragSrcId) srcIdx = i;
      if (x.id === c.id) dstIdx = i;
    });
    if (srcIdx < 0 || dstIdx < 0) return;
    var moved = state.combatants.splice(srcIdx, 1)[0];
    state.combatants.splice(dstIdx, 0, moved);
    _dragSrcId = null;
    fbSaveIniziativa(true);
    renderCombatantsList();
  };

  // Layer condizioni atmosferiche
  function addCondLayer(condId, className, childrenHtml) {
    if (c.condizioni.indexOf(condId) < 0) return;
    var el = document.createElement('div');
    el.className = 'fx-layer ' + className;
    if (childrenHtml) el.innerHTML = childrenHtml;
    card.appendChild(el);
  }
  addCondLayer('accecato', 'fx-blind', '');
  addCondLayer(
    'affascinato',
    'fx-charm',
    '<span class="heart"></span><span class="heart"></span><span class="heart"></span><span class="heart"></span><span class="heart"></span><span class="heart"></span>'
  );
  addCondLayer(
    'afferrato',
    'fx-grappled',
    '<div class="chain tl"></div><div class="chain tr"></div><div class="chain bl"></div><div class="chain br"></div>'
  );
  addCondLayer('assordato', 'fx-deaf', '');
  addCondLayer(
    'avvelenato',
    'fx-poison',
    '<span class="bubble"></span><span class="bubble"></span><span class="bubble"></span><span class="bubble"></span><span class="bubble"></span><span class="bubble"></span>'
  );
  addCondLayer(
    'incapacitato',
    'fx-incap',
    '<span class="ash"></span><span class="ash"></span><span class="ash"></span><span class="ash"></span><span class="ash"></span><span class="ash"></span><span class="ash"></span><span class="ash"></span>'
  );
  addCondLayer('invisibile', 'fx-invisible', '');
  addCondLayer(
    'paralizzato',
    'fx-paralyzed',
    '<div class="bolt top"></div><div class="bolt bottom"></div><div class="bolt left"></div><div class="bolt right"></div>'
  );
  addCondLayer('pietrificato', 'fx-stone', '');
  if (c.condizioni.indexOf('pietrificato') >= 0) {
    var cracks = document.createElement('div');
    cracks.className = 'fx-layer fx-stone-cracks';
    card.appendChild(cracks);
  }
  addCondLayer('priv-di-sensi', 'fx-unconscious', '');
  addCondLayer(
    'spaventato',
    'fx-fear',
    '<div class="ghost"></div><div class="ghost"></div><div class="ghost"></div>'
  );
  addCondLayer(
    'stordito',
    'fx-stunned',
    '<div class="spark-orbit"><div class="extra-spark"></div></div>'
  );
  addCondLayer(
    'trattenuto',
    'fx-restrained',
    '<div class="web tl"></div><div class="web tr"></div><div class="web bl"></div><div class="web br"></div>'
  );
  addCondLayer(
    'indebolito',
    'fx-weakened',
    '<div class="drain"></div><div class="drain"></div><div class="drain"></div><div class="drain"></div><div class="drain"></div><div class="drain"></div>'
  );
  if (c.condizioni.indexOf('prono') >= 0) {
    var proneH = document.createElement('div');
    proneH.className = 'fx-layer fx-prone-hearts';
    proneH.innerHTML = svgHardcoreHeart() + svgHardcoreHeart() + svgHardcoreHeart();
    card.appendChild(proneH);
  }

  // Header della card
  var header = document.createElement('div');
  header.className = 'combatant-header';

  // Drag handle — il drag parte da qui, non dalla card intera
  if (isNamed) {
    var dh = document.createElement('div');
    dh.className = 'drag-handle';
    dh.title = 'Trascina per riordinare';
    dh.innerHTML = ICON.dragHandle;
    dh.draggable = true;
    dh.ondragstart = function (e) {
      _dragSrcId = c.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', c.id);
    };
    dh.ondragend = function () {
      card.classList.remove('dragging');
      document.querySelectorAll('.combatant-card.drag-over').forEach(function (el) {
        el.classList.remove('drag-over');
      });
    };
    header.appendChild(dh);
  }

  // Input iniziativa
  var initEl = document.createElement('div');
  initEl.className = 'combatant-init';
  initEl.title = 'Iniziativa';
  var initInput = document.createElement('input');
  initInput.type = 'number';
  initInput.setAttribute('aria-label', 'Iniziativa');
  initInput.value = c.iniziativa;
  initInput.placeholder = '\u2014';
  initInput.oninput = function () {
    c.iniziativa = this.value;
    ensureTrailingEmpty();
    fbSaveIniziativa(); // debounce
  };
  initEl.appendChild(initInput);
  header.appendChild(initEl);

  // Input nome
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.setAttribute('aria-label', 'Nome combattente');
  nameInput.className = 'combatant-name-input';
  nameInput.value = c.nome;
  nameInput.placeholder = 'Nome del combattente...';
  nameInput.dataset.cid = c.id;
  nameInput.oninput = function () {
    var wasEmpty = !c.nome || !c.nome.trim();
    c.nome = this.value;
    var nowHas = !!(c.nome && c.nome.trim());

    if (wasEmpty && nowHas) {
      // Ha iniziato a scrivere: assicura riga vuota in fondo
      ensureTrailingEmpty();
      // Aggiunge la nuova card vuota SENZA distruggere quella corrente
      var list = document.getElementById('combatants-list');
      if (list) {
        var lastC = state.combatants[state.combatants.length - 1];
        var alreadyThere = list.querySelector('[data-combatant-id="' + lastC.id + '"]');
        if (!alreadyThere) {
          var newCard = buildCombatantCard(lastC, false);
          list.appendChild(newCard);
        }
      }
      updateToolbarCount();
      // Aggiunta drag handle con eventi quando il nome appare per la prima volta
      if (!card.querySelector('.drag-handle')) {
        var dh2 = document.createElement('div');
        dh2.className = 'drag-handle';
        dh2.title = 'Trascina per riordinare';
        dh2.innerHTML = ICON.dragHandle;
        dh2.draggable = true;
        dh2.ondragstart = function (e) {
          _dragSrcId = c.id;
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', c.id);
        };
        dh2.ondragend = function () {
          card.classList.remove('dragging');
          document.querySelectorAll('.combatant-card.drag-over').forEach(function (el) {
            el.classList.remove('drag-over');
          });
        };
        header.insertBefore(dh2, header.firstChild);
      }
    } else if (!nowHas && !wasEmpty) {
      updateToolbarCount();
    }

    fbSaveIniziativa(); // debounce
  };
  nameInput.onkeydown = function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Aggiungi un nuovo combattente e vai al suo input
      var newC = makeEmptyCombatant();
      state.combatants.push(newC);
      var list = document.getElementById('combatants-list');
      if (list) {
        var newCard = buildCombatantCard(newC, false);
        list.appendChild(newCard);
        setTimeout(function () {
          var ni = newCard.querySelector('.combatant-name-input');
          if (ni) ni.focus();
        }, 0);
      }
      fbSaveIniziativa(); // debounce — non necessario salvare subito una riga vuota
    }
  };
  header.appendChild(nameInput);

  // Badge categoria
  var badge = document.createElement('span');
  badge.className = 'category-badge ' + cat.badgeClass;
  badge.textContent = cat.label;
  header.appendChild(badge);

  // Select categoria (solo DM)
  if (isDM()) {
    var sel = document.createElement('select');
    sel.className = 'category-select';
    sel.setAttribute('aria-label', 'Categoria combattente');
    CATEGORIE.forEach(function (ct) {
      var op = document.createElement('option');
      op.value = ct.id;
      op.textContent = ct.label;
      if (ct.id === c.tipo) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () {
      c.tipo = this.value;
      fbSaveIniziativa(true);
      // Aggiorna solo badge e classe della card corrente
      var updCat = getCategoria(c.tipo);
      badge.className = 'category-badge ' + updCat.badgeClass;
      badge.textContent = updCat.label;
      renderConditionsPanel();
    };
    header.appendChild(sel);
  }

  // HP
  var hpW = document.createElement('div');
  hpW.className = 'hp-control';
  hpW.title = 'Punti Ferita';
  hpW.innerHTML = '<span>HP</span>';
  var isMonster = c.tipo === 'boss' || c.tipo === 'sgherri';
  var hpInput = document.createElement('input');
  hpInput.type = 'number';
  hpInput.setAttribute('aria-label', 'Punti vita');
  hpInput.value = c.hp;
  hpInput.placeholder = '\u2014';
  if (isDM() || !isMonster) {
    hpInput.oninput = function () {
      c.hp = this.value;
      fbSaveIniziativa();
    };
  } else {
    hpInput.readOnly = true;
    hpInput.style.cssText = 'pointer-events:none;opacity:0.75;';
  }
  hpW.appendChild(hpInput);
  if (isDM()) {
    [-1, 1].forEach(function (amount) {
      var adjust = document.createElement('button');
      adjust.type = 'button';
      adjust.className = 'hp-adjust';
      adjust.textContent = amount > 0 ? '+1' : '−1';
      adjust.setAttribute(
        'aria-label',
        amount > 0 ? 'Recupera un punto vita' : 'Infliggi un danno'
      );
      adjust.onclick = function () {
        adjustCombatantHp(c, amount);
      };
      hpW.appendChild(adjust);
    });
  }
  header.appendChild(hpW);

  // Pulsante elimina (solo DM)
  if (isDM()) {
    var del = document.createElement('button');
    del.className = 'row-delete';
    del.title = 'Rimuovi';
    del.innerHTML = ICON.x;
    del.onclick = function () {
      state.combatants = state.combatants.filter(function (x) {
        return x.id !== c.id;
      });
      if (state.combatants.length === 0) state.combatants = [makeEmptyCombatant()];
      ensureTrailingEmpty();
      fbSaveIniziativa(true);
      // Rimuove solo questa card dal DOM, senza ricostruire tutto
      if (card.parentNode) card.parentNode.removeChild(card);
      updateToolbarCount();
      renderConditionsPanel();
    };
    header.appendChild(del);
  }

  card.appendChild(header);

  // Condizioni attive in fondo alla card
  if (c.condizioni.length > 0) {
    var ac = document.createElement('div');
    ac.className = 'active-conditions';
    c.condizioni.forEach(function (cid) {
      var co = getCondizione(cid);
      if (!co) return;
      var b = document.createElement('span');
      b.className = 'condition-badge';
      var style = conditionBadgeStyle(cid);
      b.style.cssText =
        'background:' + style.bg + ';color:' + style.color + ';border-color:' + style.border + ';';
      b.title = co.descrizione[0];
      b.innerHTML =
        '<span>' +
        co.icon +
        '</span><span>' +
        co.nome +
        '</span><button title="Rimuovi" aria-label="Rimuovi ' +
        escapeHtml(co.nome) +
        '">' +
        ICON.x +
        '</button>';
      b.querySelector('button').onclick = function () {
        c.condizioni = c.condizioni.filter(function (x) {
          return x !== cid;
        });
        fbSaveIniziativa(true);
        renderCombatantsList();
      };
      ac.appendChild(b);
    });
    card.appendChild(ac);
  }

  return card;
}

function conditionBadgeStyle(condId) {
  var palette = {
    accecato: { bg: 'rgba(40,40,40,0.4)', color: '#cccccc', border: 'rgba(120,120,120,0.6)' },
    affascinato: { bg: 'rgba(200,100,160,0.2)', color: '#ffb0d4', border: 'rgba(233,139,184,0.6)' },
    afferrato: { bg: 'rgba(139,98,56,0.25)', color: '#d4a070', border: 'rgba(139,98,56,0.6)' },
    assordato: { bg: 'rgba(104,120,160,0.2)', color: '#a8b8d8', border: 'rgba(104,120,160,0.6)' },
    avvelenato: { bg: 'rgba(60,140,60,0.25)', color: '#9eda9e', border: 'rgba(93,179,93,0.6)' },
    incapacitato: {
      bg: 'rgba(100,100,100,0.25)',
      color: '#cccccc',
      border: 'rgba(140,140,140,0.6)',
    },
    invisibile: { bg: 'rgba(180,220,255,0.15)', color: '#c8e0f8', border: 'rgba(180,220,255,0.7)' },
    paralizzato: { bg: 'rgba(79,168,232,0.22)', color: '#a8d0f0', border: 'rgba(79,168,232,0.65)' },
    pietrificato: {
      bg: 'rgba(140,140,140,0.3)',
      color: '#d0d0d0',
      border: 'rgba(160,160,160,0.6)',
    },
    'priv-di-sensi': {
      bg: 'rgba(74,56,112,0.3)',
      color: '#c0a8e0',
      border: 'rgba(120,90,170,0.6)',
    },
    prono: { bg: 'rgba(160,120,72,0.22)', color: '#e0b888', border: 'rgba(160,120,72,0.6)' },
    spaventato: { bg: 'rgba(157,95,200,0.25)', color: '#d8b0f0', border: 'rgba(157,95,200,0.65)' },
    stordito: { bg: 'rgba(232,200,79,0.22)', color: '#ffe480', border: 'rgba(232,200,79,0.65)' },
    trattenuto: { bg: 'rgba(184,148,106,0.25)', color: '#e0c098', border: 'rgba(184,148,106,0.6)' },
    indebolito: { bg: 'rgba(176,104,104,0.25)', color: '#e0a0a0', border: 'rgba(176,104,104,0.6)' },
  };
  return (
    palette[condId] || {
      bg: 'rgba(201,165,92,0.2)',
      color: 'var(--gold-bright)',
      border: 'var(--gold)',
    }
  );
}

function nextTurn() {
  var ordered = getOrderedActive();
  if (ordered.length === 0) return;
  state.activeIndex++;
  if (state.activeIndex >= ordered.length) {
    state.activeIndex = 0;
    state.round++;
  }
  fbSaveIniziativa(true);
  renderIniziativaBody();
}

function renderConditionsPanel() {
  var panel = document.getElementById('conditions-panel');
  if (!panel) return;
  panel.innerHTML = '';

  var hd = document.createElement('div');
  hd.innerHTML =
    '<div class="header-eyebrow" style="font-size:10px;margin-bottom:0.5rem;"><span>Grimorio</span></div>' +
    '<h2 class="font-display font-bold mb-2" style="font-size:18px;color:var(--gold-bright);margin:0 0 0.5rem;">Condizioni</h2>' +
    '<p class="font-script italic" style="font-size:14px;color:var(--text-muted);margin:0 0 0.75rem;">Clicca un nome per espandere la descrizione. Usa <em>Assegna</em> per applicarla.</p>';
  panel.appendChild(hd);

  var listEl = document.createElement('div');
  CONDIZIONI.forEach(function (cond) {
    var item = document.createElement('div');
    item.className = 'condition-item' + (state.expandedCondition === cond.id ? ' expanded' : '');

    var head = document.createElement('div');
    head.className = 'condition-head';
    head.innerHTML =
      '<div class="condition-name"><span style="font-size:14px;">' +
      cond.icon +
      '</span><span>' +
      cond.nome +
      '</span></div>' +
      '<div class="condition-actions"><button class="condition-assign-btn">' +
      (state.assigningCondId === cond.id ? 'Chiudi' : 'Assegna') +
      '</button>' +
      '<span style="color:var(--gold-dim);font-size:10px;' +
      (state.expandedCondition === cond.id ? 'transform:rotate(90deg);display:inline-block;' : '') +
      '">\u25B6</span></div>';

    head.onclick = function (e) {
      if (e.target.tagName === 'BUTTON') return;
      state.expandedCondition = state.expandedCondition === cond.id ? null : cond.id;
      renderConditionsPanel();
    };
    head.querySelector('.condition-assign-btn').onclick = function (e) {
      e.stopPropagation();
      state.assigningCondId = state.assigningCondId === cond.id ? null : cond.id;
      if (state.assigningCondId && state.expandedCondition !== cond.id)
        state.expandedCondition = cond.id;
      renderConditionsPanel();
    };
    item.appendChild(head);

    if (state.expandedCondition === cond.id) {
      var body = document.createElement('div');
      body.className = 'condition-body';
      cond.descrizione.forEach(function (p) {
        var pe = document.createElement('p');
        pe.textContent = p;
        body.appendChild(pe);
      });

      if (state.assigningCondId === cond.id) {
        var pop = document.createElement('div');
        pop.className = 'assign-popover';
        pop.innerHTML = '<div class="popover-title">Applica a:</div>';
        var tl = document.createElement('div');
        tl.className = 'target-list';
        var targets = getOrderedActive();
        if (targets.length === 0) {
          tl.innerHTML =
            '<div style="font-style:italic;font-size:12px;color:var(--text-faint);padding:0.4rem 0;text-align:center;">Nessun combattente con nome.</div>';
        } else {
          targets.forEach(function (t) {
            var has = t.condizioni.indexOf(cond.id) >= 0;
            var b = document.createElement('button');
            b.className = 'target-btn' + (has ? ' has-condition' : '');
            var suffix = '';
            if (t.tipo && t.tipo !== 'pg') {
              var tcat = getCategoria(t.tipo);
              var palette = { boss: '#ff9c9c', npc: '#d8d8e8', sgherri: '#d8e090' };
              suffix =
                ' <span style="color:' +
                (palette[tcat.id] || 'var(--gold)') +
                ';margin-left:4px;font-size:11px;">(' +
                tcat.label +
                ')</span>';
            }
            b.innerHTML = (has ? '\u2713 ' : '') + escapeHtml(t.nome) + suffix;
            b.onclick = function () {
              if (has) {
                t.condizioni = t.condizioni.filter(function (x) {
                  return x !== cond.id;
                });
              } else {
                t.condizioni.push(cond.id);
              }
              fbSaveIniziativa(true);
              renderCombatantsList();
              renderConditionsPanel();
            };
            tl.appendChild(b);
          });
        }
        pop.appendChild(tl);
        body.appendChild(pop);
      }
      item.appendChild(body);
    }
    listEl.appendChild(item);
  });
  panel.appendChild(listEl);
}
