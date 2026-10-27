/* ---- RENDER PRINCIPALE ---- */

/* ============================================================================
   SEZIONE 7: FORGIA DEI PERSONAGGI — GENERATORE NPC (renderGeneratore)
   ============================================================================ */
function renderGeneratore() {
  var wrap = document.createElement('div');

  /* HEADER */
  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';
  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  top.innerHTML =
    '<div>' +
    '<div class="header-eyebrow mb-3"><span>Archivio delle Ombre</span></div>' +
    '<h1 class="header-title">Generatore NPC</h1>' +
    '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Crea e archivia i personaggi non giocanti</p>' +
    '</div>';
  hc.appendChild(top);
  var fd = document.createElement('div');
  fd.className = 'filigree-divider mt-7';
  hc.appendChild(fd);
  var notice = document.createElement('div');
  notice.className = 'notice mt-5';
  notice.innerHTML =
    '<strong style="color:var(--gold);font-style:normal;">\u{1F4DC} Istruzioni: </strong>descrivi il tuo NPC (puoi specificare il livello, es. <em>"Ladro elfo livello 6"</em>), poi premi <em>Genera con AI</em>. Modifica i campi a mano, poi <em>Salva in Archivio</em>. Clicca \u2699 per impostare la chiave Gemini.';
  hc.appendChild(notice);
  header.appendChild(hc);
  wrap.appendChild(header);

  // ---- GENERATORE NOMI ----
  var nameGenWrap = document.createElement('div');
  nameGenWrap.style.cssText =
    'background:var(--bg-panel);border:1px solid var(--border-gold);border-radius:8px;padding:1rem 1.25rem;margin:1rem auto;max-width:900px;';

  var ngTitle = document.createElement('div');
  ngTitle.style.cssText =
    "font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--gold-bright);letter-spacing:0.12em;margin-bottom:0.6rem;";
  ngTitle.textContent = '🎲 Generatore di Nomi';
  nameGenWrap.appendChild(ngTitle);

  var ngRow = document.createElement('div');
  ngRow.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;';

  var ngGender = state._ngGender || 'qualsiasi';
  ['Maschio', 'Femmina', 'Qualsiasi'].forEach(function (g) {
    var gl = g.toLowerCase();
    var isA = ngGender === gl;
    var btn = document.createElement('button');
    btn.textContent = g === 'Maschio' ? '♂ Maschio' : g === 'Femmina' ? '♀ Femmina' : '⚥ Qualsiasi';
    btn.style.cssText =
      "font-family:'Cinzel',serif;font-size:11px;padding:0.3rem 0.8rem;border-radius:20px;cursor:pointer;transition:all 0.15s;border:1.5px solid " +
      (isA ? 'var(--gold)' : 'var(--border-subtle)') +
      ';background:' +
      (isA ? 'rgba(201,165,92,0.2)' : 'var(--bg-card)') +
      ';color:' +
      (isA ? 'var(--gold-bright)' : 'var(--text-faint)') +
      ';font-weight:' +
      (isA ? '700' : '400') +
      ';';
    btn.onclick = function () {
      state._ngGender = gl;
      renderMain();
    };
    ngRow.appendChild(btn);
  });

  var ngBtn = document.createElement('button');
  ngBtn.style.cssText =
    "font-family:'Cinzel',serif;font-size:12px;font-weight:700;padding:0.35rem 1.2rem;border-radius:5px;cursor:pointer;background:rgba(201,165,92,0.18);border:1.5px solid var(--gold);color:var(--gold-bright);letter-spacing:0.1em;";
  ngBtn.textContent = '✨ Genera';
  ngRow.appendChild(ngBtn);

  var ngDisplay = document.createElement('div');
  ngDisplay.style.cssText =
    "font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:var(--gold-bright);padding:0.35rem 0.9rem;background:rgba(201,165,92,0.07);border:1px solid var(--border-gold);border-radius:5px;cursor:pointer;min-width:120px;text-align:center;letter-spacing:0.08em;";
  ngDisplay.title = 'Clicca per copiare nel campo Nome';
  ngDisplay.textContent = '—';
  ngRow.appendChild(ngDisplay);

  ngBtn.onclick = function () {
    var pool = [];
    var g = state._ngGender || 'qualsiasi';
    if (g === 'maschio') pool = NOMI_MASCHILI;
    else if (g === 'femmina') pool = NOMI_FEMMINILI;
    else pool = NOMI_MASCHILI.concat(NOMI_FEMMINILI);
    if (!pool.length) return;
    var name = pool[Math.floor(Math.random() * pool.length)];
    ngDisplay.textContent = name;
  };

  ngDisplay.onclick = function () {
    var name = ngDisplay.textContent;
    if (name && name !== '—') {
      state.npc.nome = name;
      var nomeInput = document.getElementById('npc-nome-input');
      if (nomeInput) {
        nomeInput.value = name;
      } else renderMain();
    }
  };

  nameGenWrap.appendChild(ngRow);
  wrap.appendChild(nameGenWrap);

  var section = document.createElement('section');
  section.className = 'generatore-wrap pb-20';
  section.style.cssText = 'padding-top:1.5rem;';

  var grid = document.createElement('div');
  grid.className = 'generatore-grid';

  /* ===================== COLONNA SINISTRA ===================== */
  var left = document.createElement('div');
  left.style.cssText = 'display:flex;flex-direction:column;gap:0.55rem;';

  /* ---- BARRA TAB (3 schede) ---- */
  var tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:0.35rem;margin-bottom:0.1rem;';
  ['Scheda 1', 'Scheda 2', 'Scheda 3'].forEach(function (label, idx) {
    var snap = idx === state.npcActiveTab ? state.npc : state.npcTabs[idx];
    var tabLabel = snap && snap.nome && snap.nome.trim() ? snap.nome.trim().slice(0, 16) : label;
    var isActive = idx === state.npcActiveTab;
    var btn = document.createElement('button');
    btn.style.cssText =
      "flex:1;padding:0.3rem 0.4rem;font-family:'Cinzel',serif;font-size:9px;" +
      'letter-spacing:0.08em;text-transform:uppercase;border-radius:3px 3px 0 0;cursor:pointer;' +
      'border:1px solid ' +
      (isActive ? 'var(--border-gold)' : 'var(--border-subtle)') +
      ';' +
      'border-bottom:' +
      (isActive ? '1px solid var(--bg-panel)' : '1px solid var(--border-subtle)') +
      ';' +
      'background:' +
      (isActive ? 'var(--bg-panel)' : 'var(--bg-card)') +
      ';' +
      'color:' +
      (isActive ? 'var(--gold)' : 'var(--text-muted)') +
      ';' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    btn.title = tabLabel;
    btn.textContent = tabLabel;
    if (!isActive)
      btn.onclick = (function (i) {
        return function () {
          switchNpcTab(i);
        };
      })(idx);
    tabBar.appendChild(btn);
  });
  left.appendChild(tabBar);

  var ctrl = document.createElement('div');
  ctrl.className = 'panel-glass';
  ctrl.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;padding:0.75rem;';

  /* Riga: label + ingranaggio */
  var ctrlHead = document.createElement('div');
  ctrlHead.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
  var ctrlLbl = document.createElement('span');
  ctrlLbl.className = 'npc-field-lbl';
  ctrlLbl.style.cssText = 'font-size:9px;';
  ctrlLbl.textContent = 'Descrivi il tuo NPC (includi livello se vuoi)';
  ctrlHead.appendChild(ctrlLbl);
  var gearBtn = document.createElement('button');
  gearBtn.className = 'btn-gear' + (state.geminiKeyVisible ? ' active' : '');
  gearBtn.title = 'Configura API Key Google Gemini';
  gearBtn.innerHTML = ICON.gear;
  gearBtn.onclick = function () {
    state.geminiKeyVisible = !state.geminiKeyVisible;
    renderMain();
  };
  ctrlHead.appendChild(gearBtn);
  ctrl.appendChild(ctrlHead);

  /* Box API Key — Groq (primario) + Gemini (fallback) */
  if (state.geminiKeyVisible) {
    var apiBox = document.createElement('div');
    apiBox.className = 'api-key-box';

    /* --- GROQ --- */
    var groqLbl = document.createElement('span');
    groqLbl.className = 'npc-field-lbl';
    groqLbl.innerHTML =
      '\u26A1 Groq API Key <span style="color:var(--gold);font-size:8px;">(VELOCE — consigliata)</span>';
    apiBox.appendChild(groqLbl);
    var groqRow = document.createElement('div');
    groqRow.className = 'api-key-row';
    var groqInp = document.createElement('input');
    groqInp.type = 'password';
    groqInp.placeholder = 'Inserisci chiave Groq...';
    groqInp.value = state.groqKey || '';
    groqInp.autocomplete = 'off';
    groqRow.appendChild(groqInp);
    var groqSave = document.createElement('button');
    groqSave.className = 'btn-npc btn-npc-gold';
    groqSave.style.cssText = 'width:auto;padding:0.25rem 0.6rem;font-size:9px;';
    groqSave.textContent = 'Salva';
    groqSave.onclick = function () {
      state.groqKey = groqInp.value.trim();
      saveToStorage();
      fbSaveApiKeys();
      notify('\u26A1 Chiave Groq salvata — generazione ultra-veloce attiva!');
    };
    groqRow.appendChild(groqSave);
    apiBox.appendChild(groqRow);

    var groqHint = document.createElement('div');
    groqHint.className = 'api-key-hint';
    groqHint.innerHTML =
      '\u26A1 Groq \u00E8 <strong>10-50x pi\u00F9 veloce</strong> di Gemini. Chiave gratuita su <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>';
    apiBox.appendChild(groqHint);

    /* Separatore */
    var sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid var(--border-subtle);margin:0.5rem 0 0.4rem;';
    apiBox.appendChild(sep);

    /* --- GEMINI --- */
    var gemLbl = document.createElement('span');
    gemLbl.className = 'npc-field-lbl';
    gemLbl.innerHTML =
      'Gemini API Key <span style="color:var(--text-faint);font-size:8px;">(fallback)</span>';
    apiBox.appendChild(gemLbl);
    var apiRow = document.createElement('div');
    apiRow.className = 'api-key-row';
    var apiInp = document.createElement('input');
    apiInp.type = 'password';
    apiInp.placeholder = 'Inserisci chiave Gemini...';
    apiInp.value = state.geminiKey || '';
    apiInp.autocomplete = 'off';
    apiRow.appendChild(apiInp);
    var apiSave = document.createElement('button');
    apiSave.className = 'btn-npc btn-npc-gold';
    apiSave.style.cssText = 'width:auto;padding:0.25rem 0.6rem;font-size:9px;';
    apiSave.textContent = 'Salva';
    apiSave.onclick = function () {
      state.geminiKey = apiInp.value.trim();
      saveToStorage();
      fbSaveApiKeys();
      notify('Chiave Gemini salvata.');
    };
    apiRow.appendChild(apiSave);
    apiBox.appendChild(apiRow);
    var apiHint = document.createElement('div');
    apiHint.className = 'api-key-hint';
    apiHint.innerHTML =
      'Gemini gratuito su <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>. Usato come fallback se Groq non \u00E8 configurata.';
    apiBox.appendChild(apiHint);

    ctrl.appendChild(apiBox);
  }

  /* Textarea idea (alta: triplo rispetto a prima) */
  var ideaTA = document.createElement('textarea');
  ideaTA.className = 'npc-field-textarea npc-idea-tall';
  ideaTA.id = 'npc-idea-input';
  ideaTA.placeholder =
    'es. Un assassino elfo livello 6, silenzioso e spietato, ex guardia del corpo reale in cerca di redenzione...\n\nSpecifica: razza, classe, livello, obiettivi, personalità.';
  /* Ripristina l'ultimo prompt inserito (sopravvive ai re-render) */
  ideaTA.value = state.npcIdea || '';
  /* Salva in state ad ogni modifica — così è sempre disponibile anche dopo renderMain() */
  ideaTA.oninput = function () {
    state.npcIdea = this.value;
  };
  ctrl.appendChild(ideaTA);

  /* Bottone GENERA */
  var genBtn = document.createElement('button');
  genBtn.className = 'btn-npc btn-npc-gold';
  genBtn.disabled = state.npcLoading;
  genBtn.innerHTML = state.npcLoading
    ? '<span class="npc-spin"></span> Generazione in corso...'
    : ICON.sparkles + ' Genera con AI';
  /* Indicatore motore attivo */
  var engineLabel = document.createElement('div');
  engineLabel.style.cssText =
    "font-family:'Cinzel',serif;font-size:8px;text-align:center;color:var(--text-faint);margin-top:0.1rem;letter-spacing:0.08em;";
  var hasG = state.groqKey && state.groqKey.trim();
  var hasGem = state.geminiKey && state.geminiKey.trim();
  if (hasG) engineLabel.textContent = '\u26A1 Groq attiva' + (hasGem ? ' + Gemini fallback' : '');
  else if (hasGem) engineLabel.textContent = 'Gemini attiva (configura Groq per velocit\u00E0 max)';
  else engineLabel.textContent = '\u26A0 Nessuna chiave API — clicca \u2699';
  engineLabel.style.color = hasG ? 'var(--gold-dim)' : hasGem ? 'var(--text-faint)' : '#ff9c9c';
  ctrl.appendChild(engineLabel);
  genBtn.onclick = function () {
    var idea = state.npcIdea || '';
    generateNpcFromAI(idea);
  };
  ctrl.appendChild(genBtn);

  /* Bottone TABELLE LOCALI — risposta istantanea, legge lo stesso prompt dell'AI */
  var tblBtn = document.createElement('button');
  tblBtn.className = 'btn-npc btn-npc-dark';
  tblBtn.style.cssText = 'font-size:8.5px;opacity:0.8;';
  tblBtn.title =
    'Genera istantaneamente dalle tabelle locali usando lo stesso prompt — nessuna AI richiesta';
  tblBtn.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" style="width:10px;height:10px;flex-shrink:0"><rect x="1" y="1" width="14" height="4" rx="1"/><rect x="1" y="6.5" width="14" height="4" rx="1"/><rect x="1" y="12" width="8" height="3" rx="1"/></svg> Tabelle Locali (istant.)';
  tblBtn.onclick = function () {
    /* Legge SEMPRE da state.npcIdea — persiste anche durante il caricamento AI */
    var ideaTbl = state.npcIdea || '';
    if (!ideaTbl.trim()) {
      notify("Scrivi un'idea nella textarea prima di generare.", 'err');
      return;
    }
    var lvlMt = ideaTbl.match(/\b(?:livello|lv[l]?\.?|level)\s*(\d{1,2})\b/i);
    var lvTbl = lvlMt ? parseInt(lvlMt[1], 10) : null;
    var isBossTbl =
      /boss|villain|distruttore|signore oscuro|lich|semidio|dio|leggendario|overlord|tiranno|arcimago|imperatore|sterminatore/i.test(
        ideaTbl
      );
    var isCombTbl = npcIsCombattente(ideaTbl);
    var slotsTbl = getEquipSlots(lvTbl, isCombTbl);
    var fbResult = generaFallbackProcedurale(ideaTbl, lvTbl, isBossTbl, isCombTbl, slotsTbl);
    /* Resetta e popola scheda — stessi campi di sempre */
    var TBLFIELDS = [
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
    TBLFIELDS.forEach(function (f) {
      state.npc[f] = '';
    });
    state.npc._id = null;
    state.npc.attacchi = [{ nome: '', bonus: '', danno: '' }];
    state.npc.azioniTesto = '';
    TBLFIELDS.forEach(function (f) {
      if (fbResult[f]) state.npc[f] = fbResult[f];
    });
    /* Se l'AI stava ancora girando, fermiamola visivamente */
    state.npcLoading = false;
    saveToStorage();
    renderMain();
    notify(
      '\u{1F4DA} Scheda da tabelle pronta! (prompt: "' +
        ideaTbl.slice(0, 40) +
        (ideaTbl.length > 40 ? '...' : '') +
        '")'
    );
    cercaImmagineNpc(state.npc);
  };
  ctrl.appendChild(tblBtn);

  /* Bottone NUOVA SCHEDA */
  var resetBtn = document.createElement('button');
  resetBtn.className = 'btn-npc btn-npc-dark';
  resetBtn.innerHTML = ICON.refresh + ' Nuova Scheda';
  resetBtn.onclick = function () {
    if (!confirm('Resettare la scheda corrente?')) return;
    var k;
    for (k in state.npc) state.npc[k] = k === '_id' ? null : '';
    state.npc.attacchi = [{ nome: '', bonus: '', danno: '' }];
    state.npc.azioniTesto = '';
    saveToStorage();
    renderMain();
  };
  ctrl.appendChild(resetBtn);

  /* Bottone ARCHIVIO */
  var archBtn = document.createElement('button');
  archBtn.className = 'btn-npc btn-npc-arch';
  archBtn.innerHTML = ICON.folder + ' Archivio Personaggi (' + state.personaggi.length + ')';
  archBtn.onclick = function () {
    state.archivioVisible = !state.archivioVisible;
    renderMain();
  };
  ctrl.appendChild(archBtn);

  /* Riga esporta / importa JSON */
  var jsonRow = document.createElement('div');
  jsonRow.style.cssText = 'display:flex;gap:0.35rem;margin-top:0.1rem;';

  var btnExp = document.createElement('button');
  btnExp.className = 'btn-npc btn-npc-dark';
  btnExp.style.cssText = 'flex:1;font-size:9px;padding:0.28rem 0.4rem;';
  btnExp.innerHTML = '&#x2B07; Esporta database_npc.json';
  btnExp.title = 'Scarica tutti gli NPC come file JSON';
  btnExp.onclick = function () {
    saveNpc();
    notify('File database_npc.json scaricato.');
  };
  jsonRow.appendChild(btnExp);

  var btnImp = document.createElement('button');
  btnImp.className = 'btn-npc btn-npc-dark';
  btnImp.style.cssText = 'flex:1;font-size:9px;padding:0.28rem 0.4rem;';
  btnImp.innerHTML = '&#x2B06; Importa database_npc.json';
  btnImp.title = 'Carica NPC da un file JSON precedentemente salvato';
  btnImp.onclick = loadNpc;
  jsonRow.appendChild(btnImp);

  ctrl.appendChild(jsonRow);

  left.appendChild(ctrl);
  grid.appendChild(left);

  /* ===================== COLONNA DESTRA ===================== */
  var right = document.createElement('div');

  if (state.archivioVisible) {
    /* ---- VISTA ARCHIVIO ---- */
    var archPanel = document.createElement('div');
    archPanel.className = 'npc-sheet';
    var archHead = document.createElement('div');
    archHead.className = 'npc-sheet-header';
    archHead.innerHTML =
      '<div class="npc-sheet-header-left">' +
      ICON.folder +
      '<div class="npc-sheet-title">Archivio Personaggi</div></div>' +
      '<span style="font-family:\'Cinzel\',serif;font-size:8.5px;color:var(--gold-dim);letter-spacing:0.15em;">' +
      state.personaggi.length +
      ' salvati</span>';
    archPanel.appendChild(archHead);
    var archBody = document.createElement('div');
    archBody.className = 'npc-sheet-body';
    if (state.personaggi.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'archivio-empty';
      empty.textContent =
        'Nessun personaggio salvato. Compila o genera una scheda, poi premi "Salva in Archivio".';
      archBody.appendChild(empty);
    } else {
      /* Raggruppa per città */
      var byCity = {};
      state.personaggi.forEach(function (p) {
        var city = p.citta && p.citta.trim() ? p.citta.trim() : '— Senza città —';
        if (!byCity[city]) byCity[city] = [];
        byCity[city].push(p);
      });

      var cityKeys = Object.keys(byCity).sort(function (a, b) {
        if (a === '— Senza città —') return 1;
        if (b === '— Senza città —') return -1;
        return a.localeCompare(b, 'it');
      });

      var list = document.createElement('div');
      list.className = 'archivio-list';
      list.style.maxHeight = 'none';

      cityKeys.forEach(function (city) {
        var members = byCity[city];

        /* Cartella città */
        var folder = document.createElement('div');
        folder.style.cssText = 'margin-bottom:0.2rem;';

        var folderHdr = document.createElement('div');
        folderHdr.style.cssText =
          'display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.5rem;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:3px;cursor:pointer;';
        folderHdr.innerHTML =
          '<span style="color:var(--gold);font-size:12px;">📁</span>' +
          '<span style="font-family:\'Cinzel\',serif;font-size:10px;font-weight:700;color:var(--text-strong);flex:1;">' +
          city +
          '</span>' +
          '<span style="background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:8px;padding:0 0.35rem;font-family:\'Cinzel\',serif;font-size:9px;color:var(--gold-dim);">' +
          members.length +
          '</span>' +
          '<span class="folder-arrow" style="color:var(--text-faint);font-size:10px;">▾</span>';

        var folderBody = document.createElement('div');
        folderBody.style.cssText =
          'border:1px solid var(--border-subtle);border-top:none;border-radius:0 0 3px 3px;';

        folderHdr.onclick = function () {
          var isCollapsed = folderBody.style.display === 'none';
          folderBody.style.display = isCollapsed ? 'block' : 'none';
          var arrow = folderHdr.querySelector('.folder-arrow');
          if (arrow) arrow.textContent = isCollapsed ? '▾' : '▸';
        };

        /* Items nella cartella */
        members
          .sort(function (a, b) {
            return (a.nome || '').localeCompare(b.nome || '', 'it');
          })
          .forEach(function (p) {
            var item = document.createElement('div');
            var statusStyle = '';
            if (p.stato === 'ferito') statusStyle = 'border-left:3px solid var(--blood);';
            else if (p.stato === 'morto') statusStyle = 'opacity:0.5;filter:grayscale(1);';
            item.className = 'archivio-item';
            item.style.cssText = statusStyle + 'border-radius:0;';
            (function (npc) {
              item.onclick = function () {
                caricaNpcDaArchivio(npc);
              };
            })(p);

            var thumb = document.createElement('div');
            thumb.className = 'archivio-thumb';
            if (p.immagine) {
              var tImg = document.createElement('img');
              tImg.src = p.immagine;
              tImg.alt = p.nome || '';
              tImg.onerror = function () {
                this.parentNode.innerHTML = ICON.npc;
              };
              thumb.appendChild(tImg);
            } else {
              thumb.innerHTML = ICON.npc;
            }
            item.appendChild(thumb);

            var textCol = document.createElement('div');
            textCol.className = 'archivio-text';
            var nameEl = document.createElement('div');
            nameEl.className = 'archivio-item-name';
            if (p.stato === 'morto') {
              nameEl.style.cssText = 'text-decoration:line-through;color:var(--text-faint);';
            }
            nameEl.textContent = p.nome || '(senza nome)';
            textCol.appendChild(nameEl);
            var roleEl = document.createElement('div');
            roleEl.className = 'archivio-item-role';
            var statusLabel = p.stato === 'ferito' ? ' 🩸' : p.stato === 'morto' ? ' ☠' : '';
            roleEl.textContent =
              (p.ruolo || '') + (p.eta ? ' · ' + p.eta + ' anni' : '') + statusLabel;
            textCol.appendChild(roleEl);
            item.appendChild(textCol);

            var archBtn = document.createElement('button');
            archBtn.className = 'archivio-del';
            archBtn.title = 'Archivia in una città del Worldbuilding';
            archBtn.style.cssText = 'font-size:14px;width:22px;height:22px;';
            archBtn.textContent = '📦';
            (function (npc) {
              archBtn.onclick = function (e) {
                e.stopPropagation();
                archivaNpcInCitta(npc);
              };
            })(p);
            item.appendChild(archBtn);
            var delBtn = document.createElement('button');
            delBtn.className = 'archivio-del';
            delBtn.title = 'Elimina';
            delBtn.innerHTML = ICON.trash;
            (function (pid, pnome) {
              delBtn.onclick = function (e) {
                e.stopPropagation();
                eliminaNpcDaArchivio(pid, pnome);
              };
            })(p._id, p.nome);
            item.appendChild(delBtn);
            folderBody.appendChild(item);
          });

        folder.appendChild(folderHdr);
        folder.appendChild(folderBody);
        list.appendChild(folder);
      });
      archBody.appendChild(list);
    }
    archPanel.appendChild(archBody);
    right.appendChild(archPanel);
  } else {
    /* ---- VISTA SCHEDA NPC — BOOK VIEWER 3 PAGINE ---- */

    function ni(val, ph, cls) {
      var el = document.createElement('input');
      el.type = 'number';
      el.value = val || '';
      el.placeholder = ph || '—';
      if (cls) el.className = cls;
      el.style.MozAppearance = 'textfield';
      el.style.webkitAppearance = 'none';
      return el;
    }
    function ti(val, ph, cls) {
      var el = document.createElement('input');
      el.type = 'text';
      el.value = val || '';
      el.placeholder = ph || '';
      if (cls) el.className = cls;
      return el;
    }
    function mta(val, ph, cls, minH) {
      var el = document.createElement('textarea');
      el.value = val || '';
      el.placeholder = ph || '';
      if (cls) el.className = cls;
      if (minH) el.style.minHeight = minH;
      return el;
    }
    function bind(inp, field) {
      inp.addEventListener('input', function () {
        state.npc[field] = this.value;
      });
    }
    function nv(f) {
      return state.npc[f] || '';
    }
    function statMod(v) {
      var n = parseInt(v) || 10;
      var m = Math.floor((n - 10) / 2);
      return (m >= 0 ? '+' : '') + m;
    }

    var STAT_MAP = {
      for: ['tsFor', 'skAtle'],
      des: ['tsDes', 'skAcro', 'skFurt', 'skRapi'],
      cos: ['tsCos'],
      int: ['tsInt', 'skArca', 'skInda', 'skNatu', 'skReli', 'skStor'],
      sag: ['tsSag', 'skAnim', 'skIntu', 'skMedi', 'skPerc', 'skSopr'],
      car: ['tsCar', 'skInga', 'skInti', 'skIntr', 'skPers'],
    };
    function calcBonus(field) {
      var base = 0;
      for (var stat in STAT_MAP) {
        if (STAT_MAP[stat].indexOf(field) >= 0) {
          base = Math.floor((parseInt(nv(stat)) || 10 - 10) / 2);
          base = Math.floor((parseInt(nv(stat)) || 10) - 10) / 2;
          base = Math.floor(base);
          break;
        }
      }
      var prof = parseInt(nv('competenza')) || 2;
      return base + (state.npc[field + '_p'] ? prof : 0);
    }
    var _autoCalcEls = {};
    function refreshAutoCalc() {
      var af = [
        'tsFor',
        'tsDes',
        'tsCos',
        'tsInt',
        'tsSag',
        'tsCar',
        'skAcro',
        'skAnim',
        'skArca',
        'skAtle',
        'skFurt',
        'skInda',
        'skInga',
        'skInti',
        'skIntr',
        'skIntu',
        'skMedi',
        'skNatu',
        'skPerc',
        'skPers',
        'skRapi',
        'skReli',
        'skSopr',
        'skStor',
      ];
      af.forEach(function (f) {
        if (_autoCalcEls[f]) {
          var v = calcBonus(f);
          _autoCalcEls[f].textContent = (v >= 0 ? '+' : '') + v;
        }
      });
    }

    /* top bar */
    var bookWrap = document.createElement('div');
    bookWrap.className = 'dnd-book-container';
    /* Make the whole sheet wider */
    bookWrap.style.cssText = 'position:relative;width:100%;margin:0 auto;';
    var bookTopBar = document.createElement('div');
    bookTopBar.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0.6rem 0.3rem;background:var(--bg-card);border:2px solid var(--border-gold);border-bottom:none;border-radius:4px 4px 0 0;';
    var bookTitle = document.createElement('div');
    bookTitle.style.cssText =
      "font-family:'Cinzel',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:var(--gold-dim);";
    bookTitle.textContent = 'Scheda Personaggio';
    bookTopBar.appendChild(bookTitle);
    var saveBtn2 = document.createElement('button');
    saveBtn2.className = 'btn-save-arch';
    saveBtn2.textContent = '+ Salva in Archivio';
    saveBtn2.onclick = salvaNpcInArchivio;
    bookTopBar.appendChild(saveBtn2);
    bookWrap.appendChild(bookTopBar);

    var bookPages = document.createElement('div');
    bookPages.className = 'dnd-book-pages';
    /* Increase base font for parchment pages */
    bookPages.style.cssText =
      'position:relative;overflow:hidden;border-radius:0 0 4px 4px;border:2px solid var(--border-gold);border-top:none;box-shadow:0 8px 40px rgba(0,0,0,0.55);background:#f5f0e8;font-size:14px;';
    if (!state._npcBookPage) state._npcBookPage = 1;

    /* ════════════════════
       PAGINA 1 — Storia & Aspetto (prima cosa: descrivi l'NPC)
       ════════════════════ */
    var page1 = document.createElement('div');
    page1.className = 'dnd-page dnd-parchment' + (state._npcBookPage === 1 ? ' active' : '');

    /* banner p1 */
    var banner1 = document.createElement('div');
    banner1.className = 'dnd-header-banner';
    var nc1 = document.createElement('div');
    nc1.className = 'dnd-banner-name-col';
    var nl1 = document.createElement('div');
    nl1.className = 'dnd-banner-name-label';
    nl1.style.fontSize = '7px';
    nl1.textContent = 'Nome Personaggio';
    var nameInp1 = ti(nv('nome'), 'Nome...', 'dnd-banner-name-input dnd-name-sync');
    nameInp1.id = 'npc-nome-input';
    nameInp1.style.fontSize = '16px';
    nameInp1.addEventListener('input', function () {
      state.npc.nome = this.value;
      document.querySelectorAll('.dnd-name-sync').forEach(function (e) {
        if (e !== nameInp1) e.value = state.npc.nome;
      });
    });
    nc1.appendChild(nl1);
    nc1.appendChild(nameInp1);
    banner1.appendChild(nc1);
    var bf1 = document.createElement('div');
    bf1.className = 'dnd-banner-fields';
    bf1.style.gridTemplateColumns = 'repeat(3,1fr)';
    [
      { lbl: 'Classe & Livello', key: 'ruolo', ph: 'es. Guerriero 5' },
      { lbl: 'Background', key: 'bgShort', ph: 'es. Soldato' },
      { lbl: 'Razza', key: 'razza', ph: 'es. Umano' },
    ].forEach(function (bf, i) {
      var w = document.createElement('div');
      w.className = 'dnd-banner-field';
      w.style.borderBottom = 'none';
      if (i === 2) w.style.borderRight = 'none';
      var l = document.createElement('div');
      l.className = 'dnd-banner-field-lbl';
      l.style.fontSize = '6.5px';
      l.textContent = bf.lbl;
      var inp = ti(nv(bf.key), bf.ph, 'dnd-banner-field-inp');
      inp.style.fontSize = '13px';
      bind(inp, bf.key);
      w.appendChild(l);
      w.appendChild(inp);
      bf1.appendChild(w);
    });
    banner1.appendChild(bf1);
    page1.appendChild(banner1);

    var p1b = document.createElement('div');
    p1b.className = 'dnd-page2-body'; /* reuse page2 layout: left col + right col */

    /* LEFT col p1: immagine + aspetto */
    var p1l = document.createElement('div');
    p1l.className = 'dnd-page2-left';
    p1l.style.width = '290px';

    var appFr = document.createElement('div');
    appFr.className = 'dnd-appearance-frame';
    appFr.id = 'npc-avatar-frame';
    appFr.title = 'Clicca per cercare immagine';
    appFr.onclick = function () {
      if (!state._avatarLoading) cercaImmagineNpc(state.npc);
    };
    if (state._avatarLoading) {
      var avOv1 = document.createElement('div');
      avOv1.className = 'npc-avatar-ov';
      avOv1.innerHTML = '<div class="npc-av-spin"></div>';
      appFr.appendChild(avOv1);
    } else if (state.npc.immagine) {
      var avI1 = document.createElement('img');
      avI1.src = state.npc.immagine;
      avI1.alt = state.npc.nome || 'NPC';
      avI1.onerror = function () {
        state.npc.immagine = '';
        aggiornaPannelloAvatar();
      };
      appFr.appendChild(avI1);
    } else {
      var avPh1 = document.createElement('div');
      avPh1.className = 'dnd-appearance-ph';
      avPh1.innerHTML = '&#128247;<br>Clicca per immagine';
      appFr.appendChild(avPh1);
    }
    p1l.appendChild(appFr);
    var ib1 = document.createElement('div');
    ib1.style.cssText = 'display:flex;gap:4px;margin:4px 0;';
    var bs1 = document.createElement('button');
    bs1.className = 'btn-av btn-av-gold';
    bs1.style.fontSize = '12px';
    bs1.innerHTML = ICON.sparkles + ' Cerca';
    bs1.onclick = function () {
      cercaImmagineNpc(state.npc);
    };
    /* Bottone Carica da dispositivo — salva base64 in Firebase, non scade mai */
    var bup1 = document.createElement('button');
    bup1.className = 'btn-av btn-av-dim';
    bup1.style.fontSize = '12px';
    bup1.textContent = '📁 Carica';
    bup1.onclick = function () {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = function () {
        if (!this.files[0]) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          state.npc.immagine = ev.target.result;
          saveToStorage();
          fbSavePersonaggi();
          aggiornaPannelloAvatar();
          notify('Immagine caricata e salvata.');
        };
        reader.readAsDataURL(this.files[0]);
      };
      inp.click();
    };
    var bu1 = document.createElement('button');
    bu1.className = 'btn-av btn-av-dim';
    bu1.style.fontSize = '12px';
    bu1.textContent = 'URL';
    var ur1 = document.createElement('div');
    ur1.style.cssText = 'display:none;gap:3px;margin-bottom:4px;';
    var ui1 = ti(state.npc.immagine || '', 'https://...', '');
    ui1.style.cssText =
      'flex:1;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-size:12px;color:#111;';
    var uo1 = document.createElement('button');
    uo1.className = 'btn-av btn-av-gold';
    uo1.style.cssText = 'flex:0;padding:2px 6px;font-size:12px;';
    uo1.textContent = 'OK';
    uo1.onclick = function () {
      state.npc.immagine = ui1.value.trim();
      ur1.style.display = 'none';
      saveToStorage();
      aggiornaPannelloAvatar();
    };
    bu1.onclick = function () {
      ur1.style.display = ur1.style.display === 'flex' ? 'none' : 'flex';
    };
    ur1.appendChild(ui1);
    ur1.appendChild(uo1);
    ib1.appendChild(bs1);
    ib1.appendChild(bup1);
    ib1.appendChild(bu1);
    p1l.appendChild(ib1);
    p1l.appendChild(ur1);

    /* Aspetto fisico */
    var p1aspBox = document.createElement('div');
    p1aspBox.className = 'dnd-big-box';
    p1aspBox.style.flex = '1';
    var p1aspTa = mta(
      nv('trattiFisici'),
      'Descrizione fisica, abbigliamento, segni particolari...',
      'dnd-big-box-ta',
      '60px'
    );
    p1aspTa.style.fontSize = '13px';
    bind(p1aspTa, 'trattiFisici');
    var p1aspLbl = document.createElement('div');
    p1aspLbl.className = 'dnd-big-box-lbl';
    p1aspLbl.style.fontSize = '7.5px';
    p1aspLbl.textContent = 'Aspetto del Personaggio';
    p1aspBox.appendChild(p1aspTa);
    p1aspBox.appendChild(p1aspLbl);
    p1l.appendChild(p1aspBox);
    p1b.appendChild(p1l);

    /* RIGHT col p1: tratti + storia + alleati + tesoro */
    var p1r = document.createElement('div');
    p1r.className = 'dnd-page2-right';

    /* Tratti Caratteriali (spostati dalla p2 alla p1 per questa facciata) */
    var tcBox1 = document.createElement('div');
    tcBox1.className = 'dnd-big-box';
    var tcLbl1 = document.createElement('div');
    tcLbl1.className = 'dnd-big-box-lbl';
    tcLbl1.style.fontSize = '7.5px';
    tcLbl1.textContent = 'Tratti Caratteriali';
    var tcTa1 = mta(
      nv('tratiCaratteriali'),
      'Personalità, motivazioni, tic, ossessioni...',
      'dnd-big-box-ta',
      '70px'
    );
    tcTa1.style.fontSize = '13px';
    bind(tcTa1, 'tratiCaratteriali');
    tcBox1.appendChild(tcTa1);
    tcBox1.appendChild(tcLbl1);
    p1r.appendChild(tcBox1);

    /* Campo Città / Zona */
    var cittaBox1 = document.createElement('div');
    cittaBox1.className = 'dnd-big-box';
    cittaBox1.style.cssText =
      'border:1px solid #ccc;border-radius:3px;padding:6px 8px;background:#f9f5ec;';
    var cittaLbl1 = document.createElement('div');
    cittaLbl1.className = 'dnd-big-box-lbl';
    cittaLbl1.style.fontSize = '7.5px';
    cittaLbl1.textContent = 'Città / Zona';
    var cittaInp1 = ti(nv('citta'), 'Es. Porto del Nord, Foresta Oscura…', 'dnd-banner-field-inp');
    cittaInp1.style.fontSize = '13px';
    bind(cittaInp1, 'citta');
    cittaBox1.appendChild(cittaInp1);
    cittaBox1.appendChild(cittaLbl1);
    p1r.appendChild(cittaBox1);

    var allyBox1 = document.createElement('div');
    allyBox1.className = 'dnd-big-box';
    var allyTa1 = mta(
      nv('alleati'),
      'Alleati, organizzazioni, contatti chiave...',
      'dnd-big-box-ta',
      '75px'
    );
    allyTa1.style.fontSize = '13px';
    bind(allyTa1, 'alleati');
    var allyLbl1 = document.createElement('div');
    allyLbl1.className = 'dnd-big-box-lbl';
    allyLbl1.style.fontSize = '7.5px';
    allyLbl1.textContent = 'Alleati & Organizzazioni';
    allyBox1.appendChild(allyTa1);
    allyBox1.appendChild(allyLbl1);
    p1r.appendChild(allyBox1);

    var storiaBox1 = document.createElement('div');
    storiaBox1.className = 'dnd-big-box';
    storiaBox1.style.flex = '1';
    var storiaTa1 = mta(
      nv('background'),
      'Origini, storia, motivazioni, segreti...',
      'dnd-big-box-ta',
      '100px'
    );
    storiaTa1.style.fontSize = '13px';
    bind(storiaTa1, 'background');
    var storiaLbl1 = document.createElement('div');
    storiaLbl1.className = 'dnd-big-box-lbl';
    storiaLbl1.style.fontSize = '7.5px';
    storiaLbl1.textContent = 'Storia del Personaggio';
    storiaBox1.appendChild(storiaTa1);
    storiaBox1.appendChild(storiaLbl1);
    p1r.appendChild(storiaBox1);

    var tesoroBox1 = document.createElement('div');
    tesoroBox1.className = 'dnd-big-box';
    var tesoroTa1 = mta(
      nv('oggettiIncantesimi'),
      'Oggetti magici, monete, gemme, armi speciali...',
      'dnd-big-box-ta',
      '60px'
    );
    tesoroTa1.style.fontSize = '13px';
    bind(tesoroTa1, 'oggettiIncantesimi');
    var tesoroLbl1 = document.createElement('div');
    tesoroLbl1.className = 'dnd-big-box-lbl';
    tesoroLbl1.style.fontSize = '7.5px';
    tesoroLbl1.textContent = 'Tesoro & Equipaggiamento';
    tesoroBox1.appendChild(tesoroTa1);
    tesoroBox1.appendChild(tesoroLbl1);
    p1r.appendChild(tesoroBox1);

    p1b.appendChild(p1r);
    page1.appendChild(p1b);
    bookPages.appendChild(page1);

    /* ════════════════════
       PAGINA 2 — Scheda Combat (stats, saves, skills, CA, HP, attacchi, azioni)
       ════════════════════ */
    var page2 = document.createElement('div');
    page2.className = 'dnd-page dnd-parchment' + (state._npcBookPage === 2 ? ' active' : '');

    var banner2 = document.createElement('div');
    banner2.className = 'dnd-header-banner';
    var nc2 = document.createElement('div');
    nc2.className = 'dnd-banner-name-col';
    var nl2 = document.createElement('div');
    nl2.className = 'dnd-banner-name-label';
    nl2.style.fontSize = '7px';
    nl2.textContent = 'Nome Personaggio';
    var nameInp2 = ti(nv('nome'), 'Nome...', 'dnd-banner-name-input dnd-name-sync');
    nameInp2.style.fontSize = '16px';
    nameInp2.addEventListener('input', function () {
      state.npc.nome = this.value;
      document.querySelectorAll('.dnd-name-sync').forEach(function (e) {
        if (e !== nameInp2) e.value = state.npc.nome;
      });
    });
    nc2.appendChild(nl2);
    nc2.appendChild(nameInp2);
    banner2.appendChild(nc2);
    var bf2 = document.createElement('div');
    bf2.className = 'dnd-banner-fields';
    bf2.style.gridTemplateColumns = 'repeat(3,1fr)';
    [
      { lbl: 'Classe & Livello', key: 'ruolo', ph: 'es. Guerriero 5' },
      { lbl: 'Razza', key: 'razza', ph: 'es. Umano' },
      { lbl: 'Età', key: 'eta', ph: '—' },
    ].forEach(function (bf, i) {
      var w = document.createElement('div');
      w.className = 'dnd-banner-field';
      w.style.borderBottom = 'none';
      if (i === 2) w.style.borderRight = 'none';
      var l = document.createElement('div');
      l.className = 'dnd-banner-field-lbl';
      l.style.fontSize = '6.5px';
      l.textContent = bf.lbl;
      var inp = ti(nv(bf.key), bf.ph, 'dnd-banner-field-inp');
      inp.style.fontSize = '13px';
      bind(inp, bf.key);
      w.appendChild(l);
      w.appendChild(inp);
      bf2.appendChild(w);
    });
    banner2.appendChild(bf2);
    page2.appendChild(banner2);

    var p2b = document.createElement('div');
    p2b.className = 'dnd-page1-body'; /* 3-col layout */

    /* STATS col */
    var statsCol = document.createElement('div');
    statsCol.className = 'dnd-stats-col';
    statsCol.style.width = '80px';
    var STAT_DEFS = [
      { lbl: 'Forza', key: 'for' },
      { lbl: 'Destrezza', key: 'des' },
      { lbl: 'Costituzione', key: 'cos' },
      { lbl: 'Intelligenza', key: 'int' },
      { lbl: 'Saggezza', key: 'sag' },
      { lbl: 'Carisma', key: 'car' },
    ];
    STAT_DEFS.forEach(function (s) {
      var box = document.createElement('div');
      box.className = 'dnd-stat-box';
      var sl = document.createElement('div');
      sl.className = 'dnd-stat-lbl';
      sl.style.fontSize = '6px';
      sl.textContent = s.lbl;
      var sc = ni(nv(s.key), '10', 'dnd-stat-score');
      sc.style.cssText = 'width:100%;font-size:24px;';
      sc.addEventListener('input', function () {
        state.npc[s.key] = this.value;
        mod.textContent = statMod(this.value);
        refreshAutoCalc();
      });
      var mod = document.createElement('div');
      mod.className = 'dnd-stat-mod';
      mod.style.cssText = 'font-size:14px;width:26px;height:26px;';
      mod.textContent = statMod(nv(s.key));
      box.appendChild(sl);
      box.appendChild(sc);
      box.appendChild(mod);
      statsCol.appendChild(box);
    });
    p2b.appendChild(statsCol);

    /* MID col: competenza + tiri salvezza + abilità */
    var midCol = document.createElement('div');
    midCol.className = 'dnd-mid-col';

    var compRow = document.createElement('div');
    compRow.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:3px;';
    var compCircle = document.createElement('div');
    compCircle.style.cssText =
      'width:32px;height:32px;border:1.5px solid #444;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;';
    var compInp = ni(nv('competenza'), '2', 'dnd-comp-num');
    compInp.style.fontSize = '16px';
    compCircle.appendChild(compInp);
    compInp.addEventListener('input', function () {
      state.npc.competenza = this.value;
      refreshAutoCalc();
    });
    var compLblWrap = document.createElement('div');
    compLblWrap.className = 'dnd-border-box';
    compLblWrap.style.cssText = 'flex:1;padding:3px 6px;';
    var compLbl2 = document.createElement('div');
    compLbl2.className = 'dnd-comp-lbl';
    compLbl2.style.fontSize = '7.5px';
    compLbl2.textContent = 'Bonus di Competenza';
    compLblWrap.appendChild(compLbl2);
    compRow.appendChild(compCircle);
    compRow.appendChild(compLblWrap);
    midCol.appendChild(compRow);

    var savesBox = document.createElement('div');
    savesBox.className = 'dnd-border-box';
    [
      { lbl: 'Forza', f: 'tsFor' },
      { lbl: 'Destrezza', f: 'tsDes' },
      { lbl: 'Costituzione', f: 'tsCos' },
      { lbl: 'Intelligenza', f: 'tsInt' },
      { lbl: 'Saggezza', f: 'tsSag' },
      { lbl: 'Carisma', f: 'tsCar' },
    ].forEach(function (sv) {
      var row = document.createElement('div');
      row.className = 'dnd-skill-row';
      row.style.lineHeight = '1.5';
      var c = document.createElement('div');
      c.className = 'dnd-skill-circle' + (state.npc[sv.f + '_p'] ? ' filled' : '');
      c.style.cssText =
        'width:12px;height:12px;border-radius:50%;border:1.5px solid #444;background:transparent;flex-shrink:0;cursor:pointer;';
      if (state.npc[sv.f + '_p']) c.style.background = '#333';
      c.onclick = function () {
        state.npc[sv.f + '_p'] = !state.npc[sv.f + '_p'];
        c.style.background = state.npc[sv.f + '_p'] ? '#333' : 'transparent';
        refreshAutoCalc();
      };
      var vEl = document.createElement('span');
      vEl.className = 'dnd-skill-val';
      vEl.style.cssText =
        'min-width:24px;font-weight:700;text-align:right;font-size:12px;color:#111;';
      _autoCalcEls[sv.f] = vEl;
      vEl.textContent = (calcBonus(sv.f) >= 0 ? '+' : '') + calcBonus(sv.f);
      var nm = document.createElement('span');
      nm.className = 'dnd-skill-name';
      nm.style.fontSize = '12px';
      nm.textContent = sv.lbl;
      row.appendChild(c);
      row.appendChild(vEl);
      row.appendChild(nm);
      savesBox.appendChild(row);
    });
    var savT = document.createElement('div');
    savT.className = 'dnd-box-title';
    savT.style.fontSize = '8px';
    savT.textContent = 'Tiri Salvezza';
    savesBox.appendChild(savT);
    midCol.appendChild(savesBox);

    var skBox = document.createElement('div');
    skBox.className = 'dnd-border-box';
    [
      { lbl: 'Acrobazia', a: '(Des)', k: 'skAcro' },
      { lbl: 'Addestrare Animali', a: '(Sag)', k: 'skAnim' },
      { lbl: 'Arcano', a: '(Int)', k: 'skArca' },
      { lbl: 'Atletica', a: '(For)', k: 'skAtle' },
      { lbl: 'Furtività', a: '(Des)', k: 'skFurt' },
      { lbl: 'Indagare', a: '(Int)', k: 'skInda' },
      { lbl: 'Inganno', a: '(Car)', k: 'skInga' },
      { lbl: 'Intimidire', a: '(Car)', k: 'skInti' },
      { lbl: 'Intrattenere', a: '(Car)', k: 'skIntr' },
      { lbl: 'Intuizione', a: '(Sag)', k: 'skIntu' },
      { lbl: 'Medicina', a: '(Sag)', k: 'skMedi' },
      { lbl: 'Natura', a: '(Int)', k: 'skNatu' },
      { lbl: 'Percezione', a: '(Sag)', k: 'skPerc' },
      { lbl: 'Persuasione', a: '(Car)', k: 'skPers' },
      { lbl: 'Rapidità di Mano', a: '(Des)', k: 'skRapi' },
      { lbl: 'Religione', a: '(Int)', k: 'skReli' },
      { lbl: 'Sopravvivenza', a: '(Sag)', k: 'skSopr' },
      { lbl: 'Storia', a: '(Int)', k: 'skStor' },
    ].forEach(function (sk) {
      var row = document.createElement('div');
      row.className = 'dnd-skill-row';
      row.style.lineHeight = '1.45';
      var c = document.createElement('div');
      c.className = 'dnd-skill-circle' + (state.npc[sk.k + '_p'] ? ' filled' : '');
      c.style.cssText =
        'width:12px;height:12px;border-radius:50%;border:1.5px solid #444;background:transparent;flex-shrink:0;cursor:pointer;';
      if (state.npc[sk.k + '_p']) c.style.background = '#333';
      c.onclick = function () {
        state.npc[sk.k + '_p'] = !state.npc[sk.k + '_p'];
        c.style.background = state.npc[sk.k + '_p'] ? '#333' : 'transparent';
        refreshAutoCalc();
      };
      var vEl = document.createElement('span');
      vEl.className = 'dnd-skill-val';
      vEl.style.cssText =
        'min-width:24px;font-weight:700;text-align:right;font-size:11px;color:#111;';
      _autoCalcEls[sk.k] = vEl;
      vEl.textContent = (calcBonus(sk.k) >= 0 ? '+' : '') + calcBonus(sk.k);
      var nm = document.createElement('span');
      nm.className = 'dnd-skill-name';
      nm.style.fontSize = '11px';
      nm.innerHTML = sk.lbl + ' <span style="color:#777;font-size:9.5px;">' + sk.a + '</span>';
      row.appendChild(c);
      row.appendChild(vEl);
      row.appendChild(nm);
      skBox.appendChild(row);
    });
    var skT = document.createElement('div');
    skT.className = 'dnd-box-title';
    skT.style.fontSize = '8px';
    skT.textContent = 'Abilità';
    skBox.appendChild(skT);
    midCol.appendChild(skBox);
    p2b.appendChild(midCol);

    /* RIGHT col: CA + HP + ATTACCHI (grande) + AZIONI (grande) */
    var rc2 = document.createElement('div');
    rc2.style.cssText = 'display:flex;flex-direction:column;gap:7px;flex:1;min-width:0;';

    /* CA + Velocità */
    var combRow2 = document.createElement('div');
    combRow2.className = 'dnd-combat-row';
    combRow2.style.marginBottom = '4px';
    var shieldWrap = document.createElement('div');
    shieldWrap.className = 'dnd-shield-ca';
    shieldWrap.style.cssText = 'position:relative;width:58px;height:64px;flex-shrink:0;';
    shieldWrap.innerHTML =
      '<svg style="width:58px;height:64px;display:block;" viewBox="0 0 52 58"><path style="fill:#fff;stroke:#333;stroke-width:2;" d="M26 2 L50 10 L50 30 Q50 50 26 56 Q2 50 2 30 L2 10 Z"/></svg>';
    var shInp = ni(nv('ca'), '—', 'dnd-shield-inp');
    shInp.style.cssText =
      'position:absolute;top:44%;left:50%;transform:translate(-50%,-50%);font-size:22px;font-weight:700;border:none;outline:none;background:transparent;text-align:center;width:40px;color:#111;-moz-appearance:textfield;';
    bind(shInp, 'ca');
    var shLbl = document.createElement('div');
    shLbl.className = 'dnd-shield-lbl';
    shLbl.style.cssText =
      "position:absolute;bottom:5px;left:0;right:0;font-family:'Cinzel',serif;font-size:6px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#444;text-align:center;";
    shLbl.textContent = 'CA';
    shieldWrap.appendChild(shInp);
    shieldWrap.appendChild(shLbl);
    combRow2.appendChild(shieldWrap);
    var velB2 = document.createElement('div');
    velB2.className = 'dnd-combat-blob';
    var velI2 = ti(nv('velocita'), '30m', 'dnd-combat-blob-inp');
    velI2.style.fontSize = '20px';
    bind(velI2, 'velocita');
    var velL2 = document.createElement('div');
    velL2.className = 'dnd-combat-lbl';
    velL2.style.fontSize = '6.5px';
    velL2.textContent = 'Velocità';
    velB2.appendChild(velI2);
    velB2.appendChild(velL2);
    combRow2.appendChild(velB2);
    rc2.appendChild(combRow2);

    /* HP */
    var hpSect = document.createElement('div');
    hpSect.className = 'dnd-hp-section';
    var hpMr = document.createElement('div');
    hpMr.className = 'dnd-hp-max-row';
    hpMr.style.fontSize = '11px';
    hpMr.innerHTML = 'Max HP: ';
    var hpMi = ni(nv('hpMax'), '—', 'dnd-hp-max-inp');
    hpMi.style.fontSize = '11px';
    bind(hpMi, 'hpMax');
    hpMr.appendChild(hpMi);
    var hpCi = ni(nv('hp'), '—', 'dnd-hp-cur-inp');
    hpCi.style.fontSize = '26px';
    bind(hpCi, 'hp');
    var hpLb = document.createElement('div');
    hpLb.className = 'dnd-hp-lbl';
    hpLb.style.fontSize = '7.5px';
    hpLb.textContent = 'Punti Ferita Attuali';
    hpSect.appendChild(hpMr);
    hpSect.appendChild(hpCi);
    hpSect.appendChild(hpLb);
    rc2.appendChild(hpSect);

    /* Status vitale */
    var statusRow = document.createElement('div');
    statusRow.className = 'npc-status-row';
    ['vivo', 'ferito', 'morto'].forEach(function (s) {
      var btn = document.createElement('button');
      btn.className = 'npc-status-btn';
      var labels = { vivo: '⚔ Vivo', ferito: '🩸 Ferito', morto: '☠ Morto' };
      btn.textContent = labels[s];
      var currentStato = state.npc.stato || 'vivo';
      if (currentStato === s) btn.classList.add('active-' + s);
      (function (stato, btnEl) {
        btnEl.onclick = function () {
          state.npc.stato = stato;
          saveToStorage();
          statusRow.querySelectorAll('.npc-status-btn').forEach(function (b) {
            b.className = 'npc-status-btn';
          });
          btnEl.classList.add('active-' + stato);
        };
      })(s, btn);
      statusRow.appendChild(btn);
    });
    rc2.appendChild(statusRow);

    /* ═══ ATTACCHI & INCANTESIMI — grande e centrale ═══ */
    (function () {
      if (!Array.isArray(state.npc.attacchi) || state.npc.attacchi.length === 0)
        state.npc.attacchi = [
          { nome: '', bonus: '', danno: '' },
          { nome: '', bonus: '', danno: '' },
          { nome: '', bonus: '', danno: '' },
          { nome: '', bonus: '', danno: '' },
          { nome: '', bonus: '', danno: '' },
        ];
      var atkWrap = document.createElement('div');
      atkWrap.style.cssText =
        'border:2px solid #666;border-radius:4px;overflow:hidden;background:#fff;flex-shrink:0;min-height:220px;';

      var thead = document.createElement('div');
      thead.style.cssText =
        'display:grid;grid-template-columns:1fr 100px 170px;background:#e4ddc8;border-bottom:2px solid #888;';
      ['Nome', 'Bonus Att.', 'Danni / Tipo'].forEach(function (h) {
        var th = document.createElement('div');
        th.style.cssText =
          "font-family:'Cinzel',serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#333;padding:7px 8px;border-right:1px solid #bbb;";
        th.textContent = h;
        thead.appendChild(th);
      });
      atkWrap.appendChild(thead);

      var tbody = document.createElement('div');
      tbody.id = 'dnd-atk-tbody2';
      function renderAtkRows() {
        tbody.innerHTML = '';
        state.npc.attacchi.forEach(function (atk, idx) {
          var tr = document.createElement('div');
          tr.style.cssText =
            'display:grid;grid-template-columns:1fr 100px 170px;border-bottom:1px solid #ddd;';
          [
            { k: 'nome', ph: 'es. Spada lunga' },
            { k: 'bonus', ph: '+5' },
            { k: 'danno', ph: '1d8+3 tagl.' },
          ].forEach(function (f) {
            var td = document.createElement('div');
            td.style.cssText = 'border-right:1px solid #e0dbd0;padding:2px 4px;';
            var inp = ti(atk[f.k], f.ph, '');
            inp.style.cssText =
              "border:none;outline:none;background:transparent;font-family:'EB Garamond',serif;font-size:16px;color:#111;width:100%;padding:4px 5px;";
            (function (i2, fk) {
              inp.addEventListener('input', function () {
                state.npc.attacchi[i2][fk] = this.value;
                var last = state.npc.attacchi[state.npc.attacchi.length - 1];
                if (
                  i2 === state.npc.attacchi.length - 1 &&
                  (last.nome || last.bonus || last.danno)
                ) {
                  state.npc.attacchi.push({ nome: '', bonus: '', danno: '' });
                  renderAtkRows();
                }
              });
            })(idx, f.k);
            td.appendChild(inp);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      }
      renderAtkRows();
      atkWrap.appendChild(tbody);

      var tfoot = document.createElement('div');
      tfoot.style.cssText =
        "font-family:'Cinzel',serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:#555;text-align:center;padding:6px;border-top:2px solid #888;background:#e4ddc8;";
      tfoot.textContent = 'Attacchi & Incantesimi';
      atkWrap.appendChild(tfoot);

      var addBtn = document.createElement('button');
      addBtn.style.cssText =
        "display:block;width:100%;background:transparent;border:1px dashed #bbb;color:#999;font-family:'Cinzel',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;padding:6px;cursor:pointer;border-radius:0 0 4px 4px;transition:all 0.15s;margin-top:2px;";
      addBtn.textContent = '+ Aggiungi Riga';
      addBtn.onclick = function () {
        state.npc.attacchi.push({ nome: '', bonus: '', danno: '' });
        renderAtkRows();
      };
      addBtn.onmouseenter = function () {
        this.style.background = '#f0ece0';
        this.style.color = '#444';
        this.style.borderColor = '#888';
      };
      addBtn.onmouseleave = function () {
        this.style.background = 'transparent';
        this.style.color = '#999';
        this.style.borderColor = '#bbb';
      };

      rc2.appendChild(atkWrap);
      rc2.appendChild(addBtn);
    })();

    /* ═══ AZIONI & AZIONI LEGGENDARIE — grande ═══ */
    var azWrap = document.createElement('div');
    azWrap.style.cssText =
      'border:2px solid #666;border-radius:4px;overflow:hidden;background:#fff;flex:1;display:flex;flex-direction:column;min-height:320px;';
    var azHead = document.createElement('div');
    azHead.style.cssText =
      "font-family:'Cinzel',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#333;background:#e4ddc8;border-bottom:2px solid #888;padding:8px 10px;flex-shrink:0;";
    azHead.textContent = 'Azioni & Azioni Leggendarie';
    var azTa = mta(
      nv('azioniTesto'),
      'Es:\nMultiattacco: effettua 2 attacchi con la spada\n\nAzione leggendaria – Passo Spettrale (1 pt): si sposta di 9m senza provocare attacchi di opportunità\nAzione leggendaria – Attacco Rapido (2 pt): effettua un attacco immediato',
      ''
    );
    azTa.style.cssText =
      "flex:1;border:none;outline:none;background:transparent;font-family:'EB Garamond',serif;font-size:16px;color:#111;padding:10px 12px;resize:none;min-height:320px;line-height:1.6;display:block;box-sizing:border-box;width:100%;";
    azTa.addEventListener('input', function () {
      state.npc.azioniTesto = this.value;
    });
    azWrap.appendChild(azHead);
    azWrap.appendChild(azTa);
    rc2.appendChild(azWrap);

    p2b.appendChild(rc2);
    page2.appendChild(p2b);
    bookPages.appendChild(page2);

    /* ════════════════════
       PAGINA 3 — Incantesimi
       ════════════════════ */
    var page3 = document.createElement('div');
    page3.className = 'dnd-page dnd-parchment' + (state._npcBookPage === 3 ? ' active' : '');
    var banner3 = document.createElement('div');
    banner3.className = 'dnd-header-banner';
    var nc3 = document.createElement('div');
    nc3.className = 'dnd-banner-name-col';
    var nl3 = document.createElement('div');
    nl3.className = 'dnd-banner-name-label';
    nl3.style.fontSize = '7px';
    nl3.textContent = 'Classe da Incantatore';
    var ni3 = ti(nv('classeIncantatore'), 'es. Mago', 'dnd-banner-name-input');
    ni3.style.fontSize = '16px';
    bind(ni3, 'classeIncantatore');
    nc3.appendChild(nl3);
    nc3.appendChild(ni3);
    banner3.appendChild(nc3);
    var bf3 = document.createElement('div');
    bf3.className = 'dnd-banner-fields';
    bf3.style.gridTemplateColumns = 'repeat(3,1fr)';
    [
      { lbl: 'Caratteristica da Incantatore', key: 'charIncantatore' },
      { lbl: 'CD Tiro Salvezza Incantesimi', key: 'cdIncantesimi' },
      { lbl: 'Bonus di Attacco Incantesimi', key: 'bonusAttaccoInc' },
    ].forEach(function (bf, i) {
      var w = document.createElement('div');
      w.className = 'dnd-banner-field';
      w.style.borderBottom = 'none';
      if (i === 2) w.style.borderRight = 'none';
      var l = document.createElement('div');
      l.className = 'dnd-banner-field-lbl';
      l.style.fontSize = '6.5px';
      l.textContent = bf.lbl;
      var inp = ti(nv(bf.key), '', 'dnd-banner-field-inp');
      inp.style.fontSize = '13px';
      bind(inp, bf.key);
      w.appendChild(l);
      w.appendChild(inp);
      bf3.appendChild(w);
    });
    banner3.appendChild(bf3);
    page3.appendChild(banner3);

    var p3b = document.createElement('div');
    p3b.className = 'dnd-page3-body';
    function makeSpellCol(levels) {
      var col = document.createElement('div');
      col.className = 'dnd-spell-col';
      levels.forEach(function (lvD) {
        if (lvD.level === 0) {
          var sect = document.createElement('div');
          sect.className = 'dnd-trucchi-section';
          var lbl0 = document.createElement('div');
          lbl0.className = 'dnd-trucchi-lbl';
          lbl0.style.fontSize = '8px';
          lbl0.textContent = 'Trucchetti (Livello 0)';
          sect.appendChild(lbl0);
          var sl = document.createElement('div');
          sl.className = 'dnd-spell-list';
          for (var i = 0; i < 8; i++) {
            var row = document.createElement('div');
            row.className = 'dnd-spell-row';
            var inp = ti(nv('trucco_' + i), '', 'dnd-spell-inp');
            inp.style.fontSize = '13px';
            bind(inp, 'trucco_' + i);
            row.appendChild(inp);
            sl.appendChild(row);
          }
          sect.appendChild(sl);
          col.appendChild(sect);
        } else {
          var sh = document.createElement('div');
          sh.className = 'dnd-spell-slot-header';
          var badge = document.createElement('div');
          badge.className = 'dnd-spell-level-badge';
          badge.style.cssText = 'width:30px;height:30px;font-size:17px;';
          badge.textContent = String(lvD.level);
          var si = document.createElement('div');
          si.className = 'dnd-spell-slots-info';
          var sll = document.createElement('div');
          sll.className = 'dnd-spell-slots-lbl';
          sll.style.fontSize = '6.5px';
          sll.innerHTML = 'Slot Totali&nbsp;&nbsp;Slot Spesi';
          var sr = document.createElement('div');
          sr.className = 'dnd-spell-slots-row';
          var st2 = ni(nv('slotTot' + lvD.level), '', 'dnd-spell-slots-inp');
          st2.style.fontSize = '13px';
          bind(st2, 'slotTot' + lvD.level);
          var ss2 = ni(nv('slotSp' + lvD.level), '', 'dnd-spell-slots-inp');
          ss2.style.fontSize = '13px';
          bind(ss2, 'slotSp' + lvD.level);
          sr.appendChild(st2);
          sr.appendChild(ss2);
          si.appendChild(sll);
          si.appendChild(sr);
          sh.appendChild(badge);
          sh.appendChild(si);
          col.appendChild(sh);
          var sl2 = document.createElement('div');
          sl2.className = 'dnd-spell-list';
          for (var j = 0; j < lvD.slots; j++) {
            var row2 = document.createElement('div');
            row2.className = 'dnd-spell-row';
            var circ2 = document.createElement('div');
            circ2.className =
              'dnd-spell-circle' + (state.npc['spPrep_' + lvD.level + '_' + j] ? ' filled' : '');
            circ2.onclick = (function (lv, si2) {
              return function () {
                var k = 'spPrep_' + lv + '_' + si2;
                state.npc[k] = !state.npc[k];
                this.classList.toggle('filled');
              };
            })(lvD.level, j);
            var sinp = ti(nv('spell_' + lvD.level + '_' + j), '', 'dnd-spell-inp');
            sinp.style.fontSize = '13px';
            bind(sinp, 'spell_' + lvD.level + '_' + j);
            row2.appendChild(circ2);
            row2.appendChild(sinp);
            sl2.appendChild(row2);
          }
          col.appendChild(sl2);
        }
      });
      return col;
    }
    p3b.appendChild(makeSpellCol([{ level: 0 }, { level: 1, slots: 12 }, { level: 2, slots: 13 }]));
    p3b.appendChild(
      makeSpellCol([
        { level: 3, slots: 13 },
        { level: 4, slots: 13 },
        { level: 5, slots: 9 },
      ])
    );
    p3b.appendChild(
      makeSpellCol([
        { level: 6, slots: 9 },
        { level: 7, slots: 9 },
        { level: 8, slots: 7 },
        { level: 9, slots: 7 },
      ])
    );
    page3.appendChild(p3b);
    bookPages.appendChild(page3);
    bookWrap.appendChild(bookPages);

    /* ════════ NAVIGAZIONE ════════ */
    var PNAMES = ['Storia & Aspetto', 'Scheda Combat', 'Incantesimi'];
    var bookNav = document.createElement('div');
    bookNav.className = 'dnd-book-nav';
    var btnPrev = document.createElement('button');
    btnPrev.className = 'dnd-nav-btn';
    btnPrev.innerHTML = '&#8592; Precedente';
    var dotWrap = document.createElement('div');
    dotWrap.className = 'dnd-page-dots';
    var pgLbl = document.createElement('div');
    pgLbl.className = 'dnd-page-label';
    var btnNext = document.createElement('button');
    btnNext.className = 'dnd-nav-btn';
    btnNext.innerHTML = 'Successiva &#8594;';

    var allPages = [page1, page2, page3];
    var allDots = [];
    for (var ppi = 0; ppi < 3; ppi++) {
      var dot = document.createElement('div');
      dot.className = 'dnd-page-dot';
      if (state._npcBookPage === ppi + 1) dot.classList.add('active');
      (function (pn) {
        dot.addEventListener('click', function () {
          _goPage(pn);
        });
      })(ppi + 1);
      dotWrap.appendChild(dot);
      allDots.push(dot);
    }
    dotWrap.appendChild(pgLbl);

    function _goPage(n) {
      var prev = state._npcBookPage;
      state._npcBookPage = n;
      allPages.forEach(function (p) {
        p.classList.remove('active', 'flip-left');
      });
      var target = allPages[n - 1];
      target.classList.add('active');
      if (n < prev) target.classList.add('flip-left');
      pgLbl.textContent = PNAMES[n - 1];
      btnPrev.disabled = n <= 1;
      btnNext.disabled = n >= 3;
      allDots.forEach(function (d, di) {
        d.classList.toggle('active', di + 1 === n);
      });
    }
    _goPage(state._npcBookPage || 1);
    btnPrev.addEventListener('click', function () {
      if (state._npcBookPage > 1) _goPage(state._npcBookPage - 1);
    });
    btnNext.addEventListener('click', function () {
      if (state._npcBookPage < 3) _goPage(state._npcBookPage + 1);
    });

    bookNav.appendChild(btnPrev);
    bookNav.appendChild(dotWrap);
    bookNav.appendChild(btnNext);
    bookWrap.appendChild(bookNav);
    right.appendChild(bookWrap);
  }

  grid.appendChild(right);
  section.appendChild(grid);
  wrap.appendChild(section);
  return wrap;
}

/* ===========================================================
   === SEZIONE STATISTICHE & CAOS ===
   =========================================================== */
