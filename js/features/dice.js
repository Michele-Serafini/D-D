/* ============================================================================
   SEZIONE 11: ARENA 3D DEL DESTINO — LANCIATORE DI DADI POLIEDRICO 3D
   ============================================================================ */
function renderDadi() {
  var wrap = document.createElement('div');

  /* Intestazione della Sezione */
  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2rem;padding-bottom:1.5rem;';
  hc.innerHTML =
    '<div class="header-eyebrow mb-3"><span>Sala dei Dadi &amp; Destino 3D</span></div>' +
    '<h1 class="header-title">Lanciatore di Dadi 3D</h1>' +
    '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">I poliedri del destino vengono lanciati e rimbalzano in 4 dimensioni con nucleo Tesseract ed echi temporali.</p>';
  header.appendChild(hc);
  wrap.appendChild(header);

  var panel = document.createElement('div');
  panel.className = 'dice-wrap';

  var diceBox = document.createElement('div');
  diceBox.className = 'dice-panel';
  diceBox.style.maxWidth = '640px';

  /* Stato locale dei controlli 3D */
  var diceCount = state.diceCount || 1;
  var diceMod = state.diceMod || 0;
  var diceRollMode = state.diceRollMode || 'normale'; // normale | vantaggio | svantaggio

  /* 1. Titolo Selezione Dado */
  var diceTitle = document.createElement('div');
  diceTitle.style.cssText =
    'font-family:var(--font-display);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.25em;color:var(--gold);margin-bottom:0.85rem;';
  diceTitle.textContent = 'Seleziona il Poliedro 4D';
  diceBox.appendChild(diceTitle);

  /* 2. Griglia Tipi Dado (d4, d6, d8, d10, d12, d20, d100) */
  var diceGrid = document.createElement('div');
  diceGrid.className = 'dice-type-grid';
  [4, 6, 8, 10, 12, 20, 100].forEach(function (d) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dice-type-btn' + (state.diceType === d ? ' active' : '');
    btn.textContent = 'd' + d;
    btn.onclick = function () {
      state.diceType = d;
      diceGrid.querySelectorAll('.dice-type-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      rollBtn.innerHTML = '🎲 Lancia ' + (diceCount > 1 ? diceCount : '') + 'd' + d + ' in 4D';
      renderIdle3DDice();
    };
    diceGrid.appendChild(btn);
  });
  diceBox.appendChild(diceGrid);

  /* 3. Barra Quantità Dadi, Modalità (Normale/Vantaggio/Svantaggio) e Modificatore */
  var controlsRow = document.createElement('div');
  controlsRow.style.cssText =
    'display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;justify-content:center;margin:0.65rem 0;';

  // Quantità rapida (1d, 2d, 3d, 4d)
  [1, 2, 3, 4].forEach(function (cnt) {
    var qBtn = document.createElement('button');
    qBtn.type = 'button';
    qBtn.className = 'sium-ctrl-btn' + (diceCount === cnt ? ' active' : '');
    qBtn.textContent = cnt + 'x';
    qBtn.title = 'Lancia ' + cnt + ' dadi contemporaneamente';
    qBtn.onclick = function () {
      diceCount = cnt;
      state.diceCount = cnt;
      controlsRow.querySelectorAll('[data-qbtn]').forEach(function (b) {
        b.classList.remove('active');
      });
      qBtn.classList.add('active');
      rollBtn.innerHTML =
        '🎲 Lancia ' + (diceCount > 1 ? diceCount : '') + 'd' + state.diceType + ' in 4D';
      renderIdle3DDice();
    };
    qBtn.setAttribute('data-qbtn', String(cnt));
    controlsRow.appendChild(qBtn);
  });

  // Separatore
  var sepDot = document.createElement('span');
  sepDot.style.cssText = 'color:var(--border-gold);margin:0 0.2rem;';
  sepDot.textContent = '•';
  controlsRow.appendChild(sepDot);

  // Modalità Vantaggio / Svantaggio
  [
    { id: 'svantaggio', label: 'Svantaggio' },
    { id: 'normale', label: 'Normale' },
    { id: 'vantaggio', label: 'Vantaggio' },
  ].forEach(function (m) {
    var mBtn = document.createElement('button');
    mBtn.type = 'button';
    mBtn.className = 'sium-ctrl-btn' + (diceRollMode === m.id ? ' active' : '');
    mBtn.setAttribute('data-rmode', m.id);
    mBtn.textContent = m.label;
    mBtn.onclick = function () {
      diceRollMode = m.id;
      state.diceRollMode = m.id;
      controlsRow.querySelectorAll('[data-rmode]').forEach(function (b) {
        b.classList.remove('active');
      });
      mBtn.classList.add('active');
    };
    controlsRow.appendChild(mBtn);
  });

  diceBox.appendChild(controlsRow);

  /* 4. Riga Formula Personalizzata e Modificatore Rapido */
  var formulaWrap = document.createElement('div');
  formulaWrap.style.cssText =
    'display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:0.85rem;';

  var formulaInput = document.createElement('input');
  formulaInput.type = 'text';
  formulaInput.placeholder = 'Formula opzionale (es. 2d6+3, d20+5, 4d8-2)...';
  formulaInput.style.cssText =
    'flex:1;min-width:190px;background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:13px;padding:0.45rem 0.75rem;border-radius:6px;outline:none;';
  formulaInput.title = 'Formula dadi personalizzata (es. 2d6+3)';
  formulaWrap.appendChild(formulaInput);

  var modWrap = document.createElement('div');
  modWrap.style.cssText = 'display:flex;align-items:center;gap:0.35rem;';
  var modMinus = document.createElement('button');
  modMinus.type = 'button';
  modMinus.className = 'sium-ctrl-btn';
  modMinus.textContent = '−';
  var modBadge = document.createElement('span');
  modBadge.className = 'combat-num';
  modBadge.style.cssText =
    'font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--gold-bright);min-width:2.4rem;text-align:center;';
  modBadge.textContent = (diceMod >= 0 ? '+' : '') + diceMod;
  var modPlus = document.createElement('button');
  modPlus.type = 'button';
  modPlus.className = 'sium-ctrl-btn';
  modPlus.textContent = '+';

  modMinus.onclick = function () {
    diceMod = Math.max(-20, diceMod - 1);
    state.diceMod = diceMod;
    modBadge.textContent = (diceMod >= 0 ? '+' : '') + diceMod;
  };
  modPlus.onclick = function () {
    diceMod = Math.min(30, diceMod + 1);
    state.diceMod = diceMod;
    modBadge.textContent = (diceMod >= 0 ? '+' : '') + diceMod;
  };

  modWrap.appendChild(modMinus);
  modWrap.appendChild(modBadge);
  modWrap.appendChild(modPlus);
  formulaWrap.appendChild(modWrap);
  diceBox.appendChild(formulaWrap);
  var importantLabel = document.createElement('label');
  importantLabel.className = 'journal-important';
  var importantRoll = document.createElement('input');
  importantRoll.type = 'checkbox';
  importantLabel.append(
    importantRoll,
    document.createTextNode('Segna il prossimo tiro come importante')
  );
  diceBox.appendChild(importantLabel);

  /* 5. ARENA 3D DEL VASSOIO DADI (.sium-3d-dice-arena) */
  var arena = document.createElement('div');
  arena.className = 'sium-3d-dice-arena';
  arena.title = 'Clicca sul vassoio 3D per lanciare i dadi!';

  // Cerchio runico prospettico inciso sul fondo del vassoio
  var runeFloor = document.createElement('div');
  runeFloor.className = 'sium-arena-rune-floor';
  runeFloor.innerHTML =
    '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="100" cy="100" r="92" fill="none" stroke="#d8b25c" stroke-width="1.5" stroke-dasharray="6 4"/>' +
    '<circle cx="100" cy="100" r="74" fill="none" stroke="#d8b25c" stroke-width="1"/>' +
    '<polygon points="100,12 188,100 100,188 12,100" fill="none" stroke="#d8b25c" stroke-width="1"/>' +
    '<polygon points="100,26 174,100 100,174 26,100" fill="none" stroke="#f5d98e" stroke-width="0.9" transform="rotate(45 100 100)"/>' +
    '</svg>';
  arena.appendChild(runeFloor);

  var diceVisual = document.createElement('div');
  diceVisual.className = 'sium-dice-3d-stage-wrap';
  arena.appendChild(diceVisual);

  var arenaHint = document.createElement('div');
  arenaHint.style.cssText =
    'position:relative;z-index:3;font-family:var(--font-display);font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-muted);margin-top:0.35rem;';
  arenaHint.textContent = '— Clicca sul vassoio 4D o premi Lancia —';
  arena.appendChild(arenaHint);

  diceBox.appendChild(arena);

  /* Etichetta Risultato Totale */
  var totalLbl = document.createElement('div');
  totalLbl.className = 'combat-num';
  totalLbl.style.cssText =
    'text-align:center;font-family:var(--font-display);font-size:21px;font-weight:900;color:var(--gold-bright);min-height:32px;margin-bottom:0.35rem;letter-spacing:0.06em;';
  diceBox.appendChild(totalLbl);

  function createDie3DNode(faces, val, rolling, isCrit, isFail, targetVal) {
    if (window.SiumAnimations && typeof window.SiumAnimations.build3DDieElement === 'function') {
      return window.SiumAnimations.build3DDieElement(
        faces,
        val,
        rolling,
        isCrit,
        isFail,
        targetVal
      );
    }
    var fallback = document.createElement('div');
    fallback.textContent = val !== null ? String(val) : '🎲';
    return fallback;
  }

  function renderIdle3DDice() {
    diceVisual.innerHTML = '';
    var previewCount = Math.min(diceCount, 4);
    for (var i = 0; i < previewCount; i++) {
      diceVisual.appendChild(
        createDie3DNode(state.diceType, state.diceType, false, false, false, state.diceType)
      );
    }
  }

  renderIdle3DDice();

  function _showRoll3D(rolls, faces, total, mod, detailNote) {
    arena.classList.add('is-rolling');
    diceVisual.innerHTML = '';
    totalLbl.textContent = '✦ Il dado 3D sta rotolando sul panno... ✦';
    totalLbl.style.color = 'var(--text-secondary)';

    var thrownNodes = [];
    rolls.forEach(function (v) {
      var startFace = Math.floor(Math.random() * faces) + 1;
      var node = createDie3DNode(faces, startFace, true, false, false, v);
      diceVisual.appendChild(node);
      thrownNodes.push({ node: node, val: v });
    });

    var isFast = !!(navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || ''));
    setTimeout(
      function () {
        arena.classList.remove('is-rolling');
        thrownNodes.forEach(function (item) {
          var v = item.val;
          var slot = item.node;
          var isCrit = faces === 20 && v === 20;
          var isFail = faces === 20 && v === 1;
          slot.classList.remove('is-rolling');
          slot.classList.add('is-settled');
          if (isCrit) slot.classList.add('is-crit');
          if (isFail) slot.classList.add('is-fail');
          var numEl =
            slot.querySelector('.face-front .sium-die-svg-num') ||
            slot.querySelector('.sium-die-svg-num') ||
            slot.querySelector('.face-front');
          if (numEl) numEl.textContent = String(v);
        });

        var breakdown = rolls.join(' + ');
        var modStr = mod ? (mod > 0 ? ' + ' + mod : ' − ' + Math.abs(mod)) : '';
        var fullText =
          rolls.length > 1 || mod
            ? 'Totale: ' + total + '  (' + breakdown + modStr + ')'
            : 'Risultato: ' + total;
        if (detailNote) fullText += ' ' + detailNote;

        var onlyCrit = faces === 20 && rolls.indexOf(20) >= 0;
        var onlyFail = faces === 20 && rolls.indexOf(1) >= 0 && !onlyCrit;

        if (onlyCrit) {
          totalLbl.style.color = '#fde047';
          totalLbl.textContent = '🌟 CRITICO! ' + fullText;
        } else if (onlyFail) {
          totalLbl.style.color = '#f87171';
          totalLbl.textContent = '💀 FALLIMENTO CRITICO! ' + fullText;
        } else {
          totalLbl.style.color = 'var(--gold-bright)';
          totalLbl.textContent = fullText;
        }
      },
      isFast ? 50 : 1000
    );
  }

  function executeDiceRoll() {
    var formula = formulaInput ? formulaInput.value.trim().toLowerCase() : '';
    if (formula) {
      var fMatch = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/);
      if (fMatch) {
        var nDice = Math.min(parseInt(fMatch[1], 10) || 1, 12);
        var faces = Math.min(parseInt(fMatch[2], 10) || 20, 1000);
        var mod = parseInt(fMatch[3] || '0', 10);
        var total = 0;
        var rolls = [];
        for (var ri = 0; ri < nDice; ri++) {
          var rv = Math.floor(Math.random() * faces) + 1;
          rolls.push(rv);
          total += rv;
        }
        total += mod;
        var validFaces = [4, 6, 8, 10, 12, 20, 100].indexOf(faces) >= 0 ? faces : 20;
        _showRoll3D(rolls, validFaces, total, mod, '[' + formula + ']');
        state.diceHistory.unshift({
          value: total,
          diceType: faces,
          username: state.currentUser ? state.currentUser.username : '?',
          formula: formula,
        });
        if (state.diceHistory.length > 20) state.diceHistory.pop();
        if (_campaignDb && state.currentUser) {
          saveDiceRoll({
            value: total,
            diceType: faces,
            rolls: rolls,
            formula: formula,
            important: importantRoll.checked,
            critical: faces === 20 && rolls.includes(20),
            failure: faces === 20 && rolls.includes(1) && !rolls.includes(20),
          });
          importantRoll.checked = false;
        }
        updateDiceHistory(histList);
        return;
      }
    }

    /* Probabilità 100% equa e uniforme per TUTTI gli account (nessun bonus o vantaggio nascosto per account) */
    var dtype = state.diceType || 20;
    var rollsArr = [];
    var sum = 0;
    var detailNote = '';

    if (diceRollMode !== 'normale' && diceCount === 1) {
      var a1 = Math.floor(Math.random() * dtype) + 1;
      var a2 = Math.floor(Math.random() * dtype) + 1;
      var chosen = diceRollMode === 'vantaggio' ? Math.max(a1, a2) : Math.min(a1, a2);
      rollsArr = [chosen];
      sum = chosen + diceMod;
      detailNote = '[' + diceRollMode.toUpperCase() + ': ' + a1 + ', ' + a2 + ' → ' + chosen + ']';
    } else {
      for (var c = 0; c < diceCount; c++) {
        var val = Math.floor(Math.random() * dtype) + 1;
        rollsArr.push(val);
        sum += val;
      }
      sum += diceMod;
    }

    _showRoll3D(rollsArr, dtype, sum, diceMod, detailNote);

    var isCrit = dtype === 20 && rollsArr.indexOf(20) >= 0;
    var isFail = dtype === 20 && rollsArr.indexOf(1) >= 0 && !isCrit;

    state.diceHistory.unshift({
      value: sum,
      diceType: dtype,
      username: state.currentUser ? state.currentUser.username : '?',
    });
    if (state.diceHistory.length > 20) state.diceHistory.pop();

    if (_campaignDb && state.currentUser) {
      saveDiceRoll({
        value: sum,
        diceType: dtype,
        rolls: rollsArr,
        formula: diceCount + 'd' + dtype + (diceMod ? (diceMod > 0 ? '+' : '') + diceMod : ''),
        mode: diceRollMode,
        important: importantRoll.checked,
        critical: isCrit,
        failure: isFail,
      });
      importantRoll.checked = false;
    }

    updateDiceHistory(histList);

    if (isCrit && state.currentUser) {
      notify('🌟 CRITICO! ' + state.currentUser.username + ' ha ottenuto un 20 naturale!');
    }
    if (isFail && state.currentUser) {
      notify('💀 FALLIMENTO CRITICO! ' + state.currentUser.username + ' ha ottenuto 1!');
    }
  }

  arena.onclick = executeDiceRoll;

  /* Pulsante Principale Lancia 3D */
  var rollBtn = document.createElement('button');
  rollBtn.type = 'button';
  rollBtn.className = 'dice-roll-btn';
  rollBtn.innerHTML =
    '🎲 Lancia ' + (diceCount > 1 ? diceCount : '') + 'd' + state.diceType + ' in 4D';
  rollBtn.onclick = executeDiceRoll;
  diceBox.appendChild(rollBtn);

  /* Storico Ultimi Lanci */
  var histSection = document.createElement('div');
  histSection.className = 'dice-history';
  var histTitle = document.createElement('div');
  histTitle.className = 'dice-history-title';
  histTitle.textContent = 'Ultimi Lanci';
  histSection.appendChild(histTitle);
  var histList = document.createElement('div');
  histList.className = 'dice-history-list';
  updateDiceHistory(histList);
  histSection.appendChild(histList);
  diceBox.appendChild(histSection);

  panel.appendChild(diceBox);
  wrap.appendChild(panel);
  return wrap;
}

function updateDiceHistory(listEl) {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!state.diceHistory.length) {
    listEl.innerHTML =
      '<div style="font-family:\'EB Garamond\',serif;font-style:italic;color:var(--text-faint);font-size:14px;padding:0.5rem;">Nessun lancio ancora.</div>';
    return;
  }
  state.diceHistory.slice(0, 12).forEach(function (h) {
    var isCrit =
      h.critical === true || (h.critical === undefined && h.diceType === 20 && h.value === 20);
    var isFail =
      h.failure === true || (h.failure === undefined && h.diceType === 20 && h.value === 1);
    var item = document.createElement('div');
    item.className = 'dice-history-item';
    var valEl = document.createElement('div');
    valEl.className = 'dice-history-value' + (isCrit ? ' crit' : isFail ? ' fail' : '');
    valEl.textContent = h.value;
    var infoEl = document.createElement('div');
    infoEl.style.cssText = 'flex:1;font-size:11px;';
    infoEl.textContent = (h.username || '?') + ' · d' + (h.diceType || 20);
    if (isCrit) infoEl.textContent += ' 🌟';
    if (isFail) infoEl.textContent += ' 💀';
    item.appendChild(valEl);
    item.appendChild(infoEl);
    listEl.appendChild(item);
  });
}
