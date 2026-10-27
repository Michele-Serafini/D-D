/* Calcola il "livello" estetico in base a fail o succ */
function getCounterLevel(count) {
  if (count >= 5) return 3;
  if (count >= 4) return 2;
  if (count >= 3) return 1;
  return 0;
}

/* Aggrega le classi CSS della player-row in base a fail/succ */
function getPlayerRowClasses(player) {
  var failLvl = getCounterLevel(player.fail);
  var succLvl = getCounterLevel(player.succ);
  /* Prendiamo il livello dominante (massimo dei due). A parità, il fail "vince"
     perché in un'avventura un disastro si nota di più di un trionfo. */
  if (failLvl >= succLvl && failLvl > 0) return 'lvl' + failLvl + '-fail';
  if (succLvl > 0) return 'lvl' + succLvl + '-succ';
  return '';
}

/* ===== BESTIARIO CUSTOM ===== */
function updateBestiarioGrid() {
  var q = (state.bestSearch || '').toLowerCase().trim();
  var fTaglia = state.bestFiltroTaglia || '';
  var fTipo = state.bestFiltroTipo || '';
  var fGS = state.bestFiltroGS || '';
  var filtered = state.bestiario
    .filter(function (m) {
      if (fTaglia && (m.taglia || '') !== fTaglia) return false;
      if (fTipo && (m.tipo || '') !== fTipo) return false;
      if (fGS && (m.grsfida || '') !== fGS) return false;
      if (!q) return true;
      return (m.nome || '').toLowerCase().indexOf(q) >= 0;
    })
    .sort(function (a, b) {
      return (a.nome || '').localeCompare(b.nome || '', 'it');
    });
  var counter = document.getElementById('best-counter');
  if (counter) {
    counter.className = 'results-counter';
    if (filtered.length === state.bestiario.length) {
      counter.innerHTML =
        '<strong>' +
        state.bestiario.length +
        '</strong> <span class="dot"></span> <span>MOSTRI NEL BESTIARIO</span>';
    } else {
      counter.innerHTML =
        '<strong>' +
        filtered.length +
        '</strong> <span class="dot"></span> <span>DI ' +
        state.bestiario.length +
        ' MOSTRI</span>';
    }
  }
  var grid = document.getElementById('bestiario-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (filtered.length === 0) {
    grid.className = '';
    if (state.bestiario.length === 0) {
      grid.innerHTML =
        '<div class="empty-state panel-glass"><div class="rune">🐉</div><h2>Il bestiario è vuoto</h2><p>Aggiungi il primo mostro con il pulsante "Nuovo Mostro".</p>' +
        (isAdmin()
          ? '<button class="btn-gold" id="best-add-empty">' +
            ICON.plus +
            ' Aggiungi primo mostro</button>'
          : '') +
        '</div>';
      var ea = document.getElementById('best-add-empty');
      if (ea)
        ea.onclick = function () {
          state.bestEditingId = null;
          state.bestShowForm = true;
          render();
        };
    } else {
      grid.innerHTML =
        '<div class="empty-state panel-glass"><div class="rune">🐉</div><h2>Nessun mostro trovato</h2><p>La ricerca non corrisponde ad alcun mostro nel bestiario.</p><button class="btn-gold" id="best-clear">Ripulisci ricerca</button></div>';
      var ec = document.getElementById('best-clear');
      if (ec)
        ec.onclick = function () {
          state.bestSearch = '';
          renderMain();
        };
    }
    return;
  }
  grid.className = 'weapon-grid';
  filtered.forEach(function (m) {
    grid.appendChild(renderBestiarCard(m));
  });
}

function fmtStatBlock(text) {
  if (!text) return '';
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var paras = text.split(/\n\n+/);
  var html = paras
    .map(function (para) {
      para = para.trim();
      if (!para) return '';
      var name = '',
        desc = '';
      // Formato 1: "Nome: descrizione" (colon entro 80 chars, inizia con maiuscola)
      var m1 = para.match(/^([A-ZÀÈÉÌÒÙÄ][^:\n]{0,79}):\s*([\s\S]*)$/);
      // Formato 2: "Nome\ndescrizione" (prima riga breve con maiuscola)
      var m2 = !m1 && para.match(/^([A-ZÀÈÉÌÒÙÄ][^\n]{0,79})\n([\s\S]+)$/);
      if (m1) {
        name = m1[1].trim();
        desc = m1[2].trim();
      } else if (m2) {
        name = m2[1].trim();
        desc = m2[2].trim();
      } else {
        desc = para;
      }
      var descHtml = escapeHtml(desc).replace(/\n/g, '<br>');
      if (name) {
        return (
          '<div style="margin-bottom:1.4rem;">' +
          '<div style="font-family:\'Cinzel\',serif;font-size:17px;font-weight:700;color:var(--gold-bright);margin-bottom:0.45rem;padding-bottom:0.3rem;border-bottom:1px solid rgba(201,165,92,0.3);">' +
          escapeHtml(name) +
          '</div>' +
          '<div style="font-family:\'EB Garamond\',serif;font-size:16px;line-height:1.8;color:var(--text-main);">' +
          descHtml +
          '</div>' +
          '</div>'
        );
      } else {
        return (
          '<div style="font-family:\'EB Garamond\',serif;font-size:16px;line-height:1.8;color:var(--text-main);margin-bottom:1.4rem;">' +
          escapeHtml(desc).replace(/\n/g, '<br>') +
          '</div>'
        );
      }
    })
    .join('');
  return html;
}

function openDetailModal(type, data) {
  var existing = document.getElementById('detail-modal-root');
  if (existing) existing.remove();

  var back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.id = 'detail-modal-root';
  function _closeDetail() {
    document.removeEventListener('keydown', kh);
    if (window.SiumAnimations && window.SiumAnimations.closeModalAnimated) {
      window.SiumAnimations.closeModalAnimated(back);
    } else {
      back.remove();
    }
  }
  back.onclick = function (e) {
    if (e.target === back) _closeDetail();
  };

  var kh = function (e) {
    if (e.key === 'Escape') _closeDetail();
  };
  document.addEventListener('keydown', kh);

  var panel = document.createElement('div');
  panel.className = 'detail-modal-panel';
  panel.onclick = function (e) {
    e.stopPropagation();
  };

  /* HEAD */
  var head = document.createElement('div');
  head.className = 'modal-head';
  var headLeft = document.createElement('div');
  var titleEl = document.createElement('h2');
  titleEl.style.cssText =
    "font-family:'Cinzel',serif;font-size:22px;font-weight:700;color:var(--gold-bright);margin:0;";
  titleEl.textContent = data.nome;
  headLeft.appendChild(titleEl);
  var chipRow = document.createElement('div');
  chipRow.style.cssText = 'display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap;';
  if (type === 'mostro') {
    if (data.tipo) {
      var c1 = document.createElement('span');
      c1.className = 'type-chip';
      c1.textContent = data.tipo;
      chipRow.appendChild(c1);
    }
    if (data.taglia) {
      var c2 = document.createElement('span');
      c2.className = 'type-chip';
      c2.style.cssText = 'background:rgba(120,80,10,0.7);border:1px solid #c9a55c;color:#f0cc80;';
      c2.textContent = data.taglia;
      chipRow.appendChild(c2);
    }
    if (data.allineamento) {
      var c3 = document.createElement('span');
      c3.className = 'type-chip';
      c3.style.cssText = 'background:rgba(40,80,140,0.7);border:1px solid #5c9ec9;color:#90c8ef;';
      c3.textContent = data.allineamento;
      chipRow.appendChild(c3);
    }
    if (data.grsfida) {
      var c4 = document.createElement('span');
      c4.className = 'type-chip';
      c4.style.cssText = 'background:rgba(140,30,30,0.7);border:1px solid #e05050;color:#ff9090;';
      c4.textContent = 'GS ' + data.grsfida + (data.pe ? ' (' + data.pe + ' PE)' : '');
      chipRow.appendChild(c4);
    }
  } else {
    if (data.tipo) {
      var c1 = document.createElement('span');
      c1.className = 'type-chip';
      c1.textContent = data.tipo;
      chipRow.appendChild(c1);
    }
    if (data.rarita) {
      var c2 = document.createElement('span');
      c2.className = 'rarity-tag ' + rarityClass(data.rarita);
      c2.textContent = data.rarita;
      chipRow.appendChild(c2);
    }
  }
  if (chipRow.children.length) headLeft.appendChild(chipRow);
  var closeBtn = document.createElement('button');
  closeBtn.className = 'theme-toggle';
  closeBtn.style.cssText = 'width:38px;height:38px;flex-shrink:0;';
  closeBtn.innerHTML = ICON.x;
  closeBtn.onclick = function () {
    _closeDetail();
  };
  head.appendChild(headLeft);
  head.appendChild(closeBtn);
  panel.appendChild(head);

  /* BODY */
  var body = document.createElement('div');
  body.style.cssText = 'padding:1.5rem;';

  var grid = document.createElement('div');
  grid.className = 'detail-modal-grid';

  /* Left: immagine */
  var leftCol = document.createElement('div');
  var imgWrap = document.createElement('div');
  imgWrap.className = 'detail-modal-img-wrap';
  if (data.immagine) {
    var im = createContentImage();
    im.src = data.immagine;
    im.alt = data.nome;
    im.onerror = function () {
      if (type === 'mostro') {
        imgWrap.innerHTML = '<div style="font-size:4rem;">🐉</div>';
      } else {
        this.onerror = null;
        this.src = 'path/to/default-pirate-item.png';
      }
    };
    imgWrap.appendChild(im);
  } else {
    if (type === 'mostro') {
      imgWrap.innerHTML = '<div style="font-size:4rem;">🐉</div>';
    } else {
      var im = createContentImage();
      im.src = 'path/to/default-pirate-item.png';
      im.alt = data.nome;
      imgWrap.appendChild(im);
    }
  }
  leftCol.appendChild(imgWrap);
  if (type === 'mostro' && data.url) {
    var urlLnk = document.createElement('a');
    urlLnk.href = data.url;
    urlLnk.target = '_blank';
    urlLnk.style.cssText =
      "display:block;text-align:center;margin-top:0.65rem;font-family:'EB Garamond',serif;font-size:13px;color:var(--gold-dim);text-decoration:none;";
    urlLnk.textContent = '🔗 Scheda su dungeonedraghi.it';
    leftCol.appendChild(urlLnk);
  }
  grid.appendChild(leftCol);

  /* Right: stats */
  var rightCol = document.createElement('div');

  if (type === 'mostro') {
    /* HP / CA / VEL pills */
    var pillRow = document.createElement('div');
    pillRow.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;';
    [
      ['HP', data.hp, '#c84040'],
      ['CA', data.ca, '#c9a55c'],
      ['VEL', data.velocita, '#5c9ec9'],
    ].forEach(function (s) {
      if (!s[1]) return;
      var pill = document.createElement('div');
      pill.style.cssText =
        'background:' +
        s[2] +
        '22;border:1px solid ' +
        s[2] +
        "88;border-radius:4px;padding:0.4rem 1rem;font-family:'Cinzel',serif;font-size:15px;font-weight:700;color:" +
        s[2] +
        ';';
      pill.textContent = s[0] + ': ' + s[1];
      pillRow.appendChild(pill);
    });
    rightCol.appendChild(pillRow);

    /* Stat grid */
    var sg = document.createElement('div');
    sg.style.cssText =
      'display:grid;grid-template-columns:repeat(6,1fr);gap:0.25rem;margin-bottom:1rem;border:1px solid var(--border-subtle);border-radius:4px;overflow:hidden;';
    [
      ['FOR', data.for],
      ['DES', data.des],
      ['COS', data.cos],
      ['INT', data.int],
      ['SAG', data.sag],
      ['CAR', data.car],
    ].forEach(function (s) {
      var cell = document.createElement('div');
      cell.style.cssText = 'text-align:center;padding:0.4rem 0.1rem;background:var(--bg-base);';
      var lbl = document.createElement('div');
      lbl.style.cssText =
        "font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:var(--gold-bright);letter-spacing:0.1em;";
      lbl.textContent = s[0];
      var val = document.createElement('div');
      val.style.cssText =
        "font-family:'EB Garamond',serif;font-size:22px;font-weight:700;color:var(--text-strong);line-height:1.2;";
      val.textContent = s[1] || '—';
      var mod = document.createElement('div');
      mod.style.cssText = "font-family:'EB Garamond',serif;font-size:15px;color:var(--text-main);";
      var mv = s[1] ? Math.floor((s[1] - 10) / 2) : null;
      mod.textContent = mv !== null ? (mv >= 0 ? '+' + mv : '' + mv) : '';
      cell.appendChild(lbl);
      cell.appendChild(val);
      cell.appendChild(mod);
      sg.appendChild(cell);
    });
    rightCol.appendChild(sg);

    if (data.lingue) {
      var lingP = document.createElement('p');
      lingP.style.cssText =
        "font-size:17px;color:var(--text-main);margin:0 0 0.6rem;font-family:'EB Garamond',serif;";
      lingP.innerHTML =
        '<span style="color:var(--gold-bright);font-weight:700;font-family:\'Cinzel\',serif;font-size:13px;letter-spacing:0.08em;">🗣 LINGUE&nbsp;</span>' +
        escapeHtml(data.lingue);
      rightCol.appendChild(lingP);
    }
    if (data.ts) {
      var tsP = document.createElement('p');
      tsP.style.cssText =
        "font-size:17px;color:var(--text-main);margin:0 0 0.6rem;font-family:'EB Garamond',serif;";
      tsP.innerHTML =
        '<span style="color:var(--gold-bright);font-weight:700;font-family:\'Cinzel\',serif;font-size:13px;letter-spacing:0.08em;">TIRI SALVEZZA&nbsp;</span>' +
        escapeHtml(data.ts);
      rightCol.appendChild(tsP);
    }
    if (data.sensi) {
      var sensiP = document.createElement('p');
      sensiP.style.cssText =
        "font-size:17px;color:var(--text-main);margin:0 0 0.6rem;font-family:'EB Garamond',serif;";
      sensiP.innerHTML =
        '<span style="color:var(--gold-bright);font-weight:700;font-family:\'Cinzel\',serif;font-size:13px;letter-spacing:0.08em;">👁 SENSI&nbsp;</span>' +
        escapeHtml(data.sensi);
      rightCol.appendChild(sensiP);
    }
    if (data.abilita) {
      var abP = document.createElement('p');
      abP.style.cssText =
        "font-size:17px;color:var(--text-main);margin:0 0 0.6rem;font-family:'EB Garamond',serif;";
      abP.innerHTML =
        '<span style="color:var(--gold-bright);font-weight:700;font-family:\'Cinzel\',serif;font-size:13px;letter-spacing:0.08em;">★ ABILITÀ&nbsp;</span>' +
        escapeHtml(data.abilita);
      rightCol.appendChild(abP);
    }
  }

  if (type === 'arma') {
    // Price removed as requested
    if (data.descrizione) {
      var descDiv = document.createElement('div');
      descDiv.style.cssText =
        "font-family:'EB Garamond',serif;font-size:16px;line-height:1.7;color:var(--text-main);";
      descDiv.innerHTML = nl2br(escapeHtml(data.descrizione));
      rightCol.appendChild(descDiv);
    }
  }

  grid.appendChild(rightCol);
  body.appendChild(grid);

  /* Sotto la griglia: tratti, azioni, incantesimi (solo mostro) */
  if (type === 'mostro') {
    if (data.tratti) {
      var ts = document.createElement('div');
      ts.style.cssText =
        'margin-top:1.25rem;border-top:1px solid var(--border-subtle);padding-top:1rem;';
      var th = document.createElement('div');
      th.style.cssText =
        "font-family:'Cinzel',serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--gold-bright);margin-bottom:0.75rem;";
      th.textContent = '★ Tratti Speciali';
      var tt = document.createElement('div');
      tt.style.cssText =
        "font-family:'EB Garamond',serif;font-size:17px;line-height:1.8;color:var(--text-main);";
      tt.innerHTML = fmtStatBlock(data.tratti);
      ts.appendChild(th);
      ts.appendChild(tt);
      body.appendChild(ts);
    }
    if (data.azioni) {
      var as = document.createElement('div');
      as.style.cssText =
        'margin-top:1.25rem;border-top:1px solid var(--border-subtle);padding-top:1rem;';
      var ah = document.createElement('div');
      ah.style.cssText =
        "font-family:'Cinzel',serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--gold-bright);margin-bottom:0.75rem;";
      ah.textContent = '⚔ Azioni';
      var at = document.createElement('div');
      at.style.cssText =
        "font-family:'EB Garamond',serif;font-size:17px;line-height:1.8;color:var(--text-main);";
      at.innerHTML = fmtStatBlock(data.azioni);
      as.appendChild(ah);
      as.appendChild(at);
      body.appendChild(as);
    }
    if (data.incantesimi) {
      var isc = document.createElement('div');
      isc.style.cssText =
        'margin-top:1.25rem;border-top:1px solid var(--border-subtle);padding-top:1rem;';
      var ish = document.createElement('div');
      ish.style.cssText =
        "font-family:'Cinzel',serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--gold-bright);margin-bottom:0.75rem;";
      ish.textContent = '★ Incantesimi';
      var ist = document.createElement('div');
      ist.style.cssText =
        "font-family:'EB Garamond',serif;font-size:17px;line-height:1.8;color:var(--text-main);";
      ist.innerHTML = fmtStatBlock(data.incantesimi);
      isc.appendChild(ish);
      isc.appendChild(ist);
      body.appendChild(isc);
    }
    if (data.azioniLeggendarie) {
      var alg = document.createElement('div');
      alg.style.cssText =
        'margin-top:1.25rem;border-top:1px solid var(--border-subtle);padding-top:1rem;';
      var alh = document.createElement('div');
      alh.style.cssText =
        "font-family:'Cinzel',serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--gold-bright);margin-bottom:0.75rem;";
      alh.textContent = '★ Azioni Leggendarie';
      var alt = document.createElement('div');
      alt.style.cssText =
        "font-family:'EB Garamond',serif;font-size:17px;line-height:1.8;color:var(--text-main);";
      alt.innerHTML = fmtStatBlock(data.azioniLeggendarie);
      alg.appendChild(alh);
      alg.appendChild(alt);
      body.appendChild(alg);
    }
  }

  panel.appendChild(body);
  back.appendChild(panel);
  document.body.appendChild(back);
  if (window.SiumAnimations && window.SiumAnimations.enhanceRelicModal) {
    window.SiumAnimations.enhanceRelicModal(back, type, data);
  }
}

function renderBestiarCard(m) {
  var card = document.createElement('article');
  card.className = 'weapon-card sium-grid-card-enter';
  card.style.cssText = 'cursor:pointer;';
  card.onclick = function () {
    if (window.SiumAnimations && window.SiumAnimations.triggerCardClickPulse) {
      window.SiumAnimations.triggerCardClickPulse(card, '#e05050');
    }
    openDetailModal('mostro', m);
  };

  /* Immagine */
  var imgWrap = document.createElement('div');
  imgWrap.className = 'card-image-wrap';
  imgWrap.style.cssText = 'aspect-ratio:3/4;background:var(--bg-base);';
  if (m.immagine) {
    var im = createContentImage();
    im.alt = m.nome;
    im.src = m.immagine;
    im.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    im.onerror = function () {
      imgWrap.innerHTML = '<div class="img-placeholder">🐉</div>';
    };
    imgWrap.appendChild(im);
  } else {
    var ph = document.createElement('div');
    ph.className = 'img-placeholder';
    ph.textContent = '🐉';
    imgWrap.appendChild(ph);
  }
  card.appendChild(imgWrap);

  /* Solo nome */
  var body = document.createElement('div');
  body.className = 'card-body';
  body.style.cssText = 'padding:0.75rem 1rem;';
  var nameEl = document.createElement('h3');
  nameEl.className = 'font-display font-bold text-lg';
  nameEl.style.cssText = 'color:var(--gold-bright);line-height:1.25;margin:0;text-align:center;';
  nameEl.textContent = m.nome;
  body.appendChild(nameEl);

  /* Bottoni admin (nascosti nel footer) */
  if (isAdmin()) {
    var foot = document.createElement('div');
    foot.className = 'flex items-center justify-end pt-2 border-t';
    foot.style.cssText = 'margin-top:0.5rem;';
    var btnRow = document.createElement('div');
    btnRow.className = 'flex gap-1';
    var editBtn = document.createElement('button');
    editBtn.className = 'btn-dark';
    editBtn.title = 'Modifica';
    editBtn.style.cssText = 'padding:0.4rem 0.65rem;';
    editBtn.innerHTML = ICON.edit;
    var delBtn = document.createElement('button');
    delBtn.className = 'btn-blood';
    delBtn.title = 'Elimina';
    delBtn.style.cssText = 'padding:0.4rem 0.65rem;';
    delBtn.innerHTML = ICON.trash;
    (function (monster) {
      editBtn.onclick = function (e) {
        e.stopPropagation();
        state.bestEditingId = monster.id;
        state.bestShowForm = true;
        var ef = document.getElementById('modal-root');
        if (ef) ef.remove();
        document.body.appendChild(renderBestiarForm());
      };
      delBtn.onclick = function (e) {
        e.stopPropagation();
        if (confirm('Eliminare "' + monster.nome + '" dal bestiario?')) {
          // Aggiungi a bestiarioDeleted (ID + nome) così non ricompare al refresh neanche con ID diverso
          if (!state.bestiarioDeleted) state.bestiarioDeleted = [];
          if (state.bestiarioDeleted.indexOf(monster.id) < 0)
            state.bestiarioDeleted.push(monster.id);
          var _nk = 'nome:' + (monster.nome || '').toLowerCase();
          if (state.bestiarioDeleted.indexOf(_nk) < 0) state.bestiarioDeleted.push(_nk);
          fbSaveBestiarioDeleted();
          state.bestiario = state.bestiario.filter(function (x) {
            return x.id !== monster.id;
          });
          fbSaveBestiario();
          saveToStorage();
          notify('Mostro eliminato.');
          card.remove(); // rimuove solo questa card, scroll invariato
        }
      };
    })(m);
    btnRow.appendChild(editBtn);
    btnRow.appendChild(delBtn);
    foot.appendChild(btnRow);
    body.appendChild(foot);
  }

  card.appendChild(body);
  return card;

  /* legacy placeholder to satisfy old code path */ if (false) {
    var aziP = document.createElement('p');
    aziP.textContent = m.azioni;
    body.appendChild(aziP);
  }
  var foot = document.createElement('div');
  foot.className = 'flex items-center justify-between pt-3 border-t';
  if (m.url) {
    var lnk = document.createElement('a');
    lnk.href = m.url;
    lnk.target = '_blank';
    lnk.style.cssText =
      "font-family:'EB Garamond',serif;font-size:13px;color:var(--gold-dim);text-decoration:none;";
    lnk.textContent = '🔗 Riferimento';
    lnk.onclick = function (e) {
      e.stopPropagation();
    };
    foot.appendChild(lnk);
  } else {
    foot.appendChild(document.createElement('span'));
  }
  if (isAdmin()) {
    var btnRow = document.createElement('div');
    btnRow.className = 'flex gap-1';
    var editBtn = document.createElement('button');
    editBtn.className = 'btn-dark';
    editBtn.title = 'Modifica';
    editBtn.style.cssText = 'padding:0.4rem 0.65rem;';
    editBtn.innerHTML = ICON.edit;
    var delBtn = document.createElement('button');
    delBtn.className = 'btn-blood';
    delBtn.title = 'Elimina';
    delBtn.style.cssText = 'padding:0.4rem 0.65rem;';
    delBtn.innerHTML = ICON.trash;
    (function (monster) {
      editBtn.onclick = function (e) {
        e.stopPropagation();
        state.bestEditingId = monster.id;
        state.bestShowForm = true;
        var ef = document.getElementById('modal-root');
        if (ef) ef.remove();
        document.body.appendChild(renderBestiarForm());
      };
      delBtn.onclick = function (e) {
        e.stopPropagation();
        if (confirm('Eliminare "' + monster.nome + '" dal bestiario?')) {
          if (!state.bestiarioDeleted) state.bestiarioDeleted = [];
          if (state.bestiarioDeleted.indexOf(monster.id) < 0)
            state.bestiarioDeleted.push(monster.id);
          var _nk2 = 'nome:' + (monster.nome || '').toLowerCase();
          if (state.bestiarioDeleted.indexOf(_nk2) < 0) state.bestiarioDeleted.push(_nk2);
          fbSaveBestiarioDeleted();
          state.bestiario = state.bestiario.filter(function (x) {
            return x.id !== monster.id;
          });
          fbSaveBestiario();
          saveToStorage();
          notify('Mostro eliminato.');
          card.remove();
        }
      };
    })(m);
    btnRow.appendChild(editBtn);
    btnRow.appendChild(delBtn);
    foot.appendChild(btnRow);
  }
  body.appendChild(foot);
  card.appendChild(body);
  return card;
}
