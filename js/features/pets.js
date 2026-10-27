function updatePetGrid() {
  /* Giocatori vedono solo i propri pet */
  var me = !isDM() && state.currentUser ? state.currentUser.username.toLowerCase() : null;
  var petList =
    me !== null
      ? state.pet.filter(function (p) {
          return (p.proprietario || '').toLowerCase() === me;
        })
      : state.pet;
  var q = (state.petSearch || '').toLowerCase().trim();
  var filtered = petList.filter(function (p) {
    if (!q) return true;
    return (
      (p.nome || '').toLowerCase().indexOf(q) >= 0 ||
      (p.proprietario || '').toLowerCase().indexOf(q) >= 0 ||
      (p.tipo || '').toLowerCase().indexOf(q) >= 0
    );
  });
  var counter = document.getElementById('pet-counter');
  if (counter) {
    counter.className = 'results-counter';
    counter.innerHTML =
      '<strong>' +
      filtered.length +
      '</strong> <span class="dot"></span> <span>' +
      (isDM() ? 'PET DEL PARTY' : 'I MIEI PET') +
      '</span>';
  }
  var grid = document.getElementById('pet-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (filtered.length === 0) {
    grid.className = '';
    var emptyTitle = isDM()
      ? state.pet.length === 0
        ? 'Nessun pet registrato'
        : 'Nessun pet trovato'
      : 'Nessun pet trovato';
    var emptyDesc = isDM()
      ? state.pet.length === 0
        ? 'Adotta un mostro dal bestiario.'
        : 'La ricerca non corrisponde ad alcun pet.'
      : petList.length === 0
        ? 'Non hai ancora un pet nel party. Chiedi al DM di assegnartene uno.'
        : 'La ricerca non corrisponde ad alcun tuo pet.';
    grid.innerHTML =
      '<div class="empty-state panel-glass"><div class="rune">🐾</div><h2>' +
      emptyTitle +
      '</h2><p>' +
      emptyDesc +
      '</p></div>';
    return;
  }
  grid.className = 'weapon-grid';
  filtered.forEach(function (p) {
    grid.appendChild(renderPetCard(p));
  });
}

function renderPetCard(p) {
  var card = document.createElement('article');
  card.className = 'weapon-card';
  /* Immagine: petImmagine è la foto personale del pet (modificabile dal proprietario),
     p.immagine è quella del bestiario usata come fallback */
  var imgWrap = document.createElement('div');
  imgWrap.className = 'card-image-wrap';
  var displayImg = p.petImmagine || p.immagine;
  if (displayImg) {
    var im = createContentImage();
    im.alt = p.nome;
    im.src = displayImg;
    imgWrap.appendChild(im);
  } else {
    var ph = document.createElement('div');
    ph.className = 'img-placeholder';
    ph.textContent = '🐾';
    imgWrap.appendChild(ph);
  }
  /* Badge tipo */
  if (p.tipo || p.taglia) {
    var tagW = document.createElement('div');
    tagW.style.cssText =
      'position:absolute;top:12px;right:12px;z-index:2;display:flex;flex-direction:column;gap:0.25rem;align-items:flex-end;';
    if (p.tipo) tagW.innerHTML += '<span class="type-chip">' + escapeHtml(p.tipo) + '</span>';
    if (p.taglia)
      tagW.innerHTML +=
        '<span class="type-chip" style="background:rgba(120,80,20,0.75);border-color:#c9a55c88;">' +
        escapeHtml(p.taglia) +
        '</span>';
    imgWrap.appendChild(tagW);
  }
  /* Badge 🐾 pet */
  var petBadge = document.createElement('div');
  petBadge.style.cssText =
    "position:absolute;top:12px;left:12px;z-index:2;background:rgba(80,140,80,0.85);border:1px solid #6dbc6d;border-radius:3px;padding:0.15rem 0.4rem;font-family:'Cinzel',serif;font-size:9px;font-weight:700;color:#b8ffb8;letter-spacing:0.08em;";
  petBadge.textContent = '🐾 PET';
  imgWrap.appendChild(petBadge);
  card.appendChild(imgWrap);
  /* Body */
  var body = document.createElement('div');
  body.className = 'card-body';
  var nameEl = document.createElement('h3');
  nameEl.className = 'font-display font-bold text-lg mb-2';
  nameEl.style.cssText = 'color:var(--gold-bright);line-height:1.25;margin:0 0 0.25rem;';
  nameEl.textContent = p.petNome || p.nome;
  body.appendChild(nameEl);
  /* Proprietario */
  if (p.proprietario) {
    var propEl = document.createElement('div');
    propEl.style.cssText =
      "font-family:'EB Garamond',serif;font-size:13px;color:#6dbc6d;margin-bottom:0.35rem;";
    propEl.innerHTML = '🧙 ' + escapeHtml(p.proprietario);
    body.appendChild(propEl);
  }
  /* HP / CA */
  var statRow = document.createElement('div');
  statRow.style.cssText = 'display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.4rem;';
  [
    ['HP', p.hp, '#c84040'],
    ['CA', p.ca, '#c9a55c'],
    ['VEL', p.velocita, '#5c9ec9'],
  ].forEach(function (s) {
    if (!s[1]) return;
    var pill = document.createElement('div');
    pill.style.cssText =
      'background:' +
      s[2] +
      '22;border:1px solid ' +
      s[2] +
      "55;border-radius:3px;padding:0.15rem 0.5rem;font-family:'Cinzel',serif;font-size:11px;font-weight:700;color:" +
      s[2] +
      ';';
    pill.textContent = s[0] + ': ' + s[1];
    statRow.appendChild(pill);
  });
  body.appendChild(statRow);
  /* Stats */
  var hasStats = p.for || p.des || p.cos || p.int || p.sag || p.car;
  if (hasStats) {
    var sg = document.createElement('div');
    sg.style.cssText =
      'display:grid;grid-template-columns:repeat(6,1fr);gap:0.25rem;margin-bottom:0.5rem;border:1px solid var(--border-subtle);border-radius:4px;overflow:hidden;';
    [
      ['FOR', p.for],
      ['DES', p.des],
      ['COS', p.cos],
      ['INT', p.int],
      ['SAG', p.sag],
      ['CAR', p.car],
    ].forEach(function (s) {
      var c2 = document.createElement('div');
      c2.style.cssText = 'text-align:center;padding:0.25rem 0.1rem;background:var(--bg-base);';
      c2.innerHTML =
        '<div style="font-family:\'Cinzel\',serif;font-size:8px;font-weight:700;color:var(--gold-dim);letter-spacing:0.1em;">' +
        s[0] +
        '</div><div style="font-family:\'EB Garamond\',serif;font-size:15px;font-weight:700;color:var(--text-strong);line-height:1.2;">' +
        (s[1] || '—') +
        '</div>';
      sg.appendChild(c2);
    });
    body.appendChild(sg);
  }
  if (p.tratti) {
    var trD = document.createElement('div');
    trD.style.cssText =
      "font-family:'EB Garamond',serif;font-size:13px;color:var(--text-muted);white-space:pre-wrap;border:1px solid var(--border-subtle);border-radius:3px;padding:0.4rem 0.5rem;margin-bottom:0.4rem;background:var(--bg-base);max-height:80px;overflow-y:auto;";
    trD.innerHTML =
      '<div style="font-family:\'Cinzel\',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold-dim);margin-bottom:0.2rem;">★ Tratti</div>' +
      nl2br(escapeHtml(p.tratti));
    body.appendChild(trD);
  }
  if (p.azioni) {
    var aziD = document.createElement('div');
    aziD.style.cssText =
      "font-family:'EB Garamond',serif;font-size:13px;color:var(--text-muted);white-space:pre-wrap;border:1px solid var(--border-subtle);border-radius:3px;padding:0.4rem 0.5rem;margin-bottom:0.4rem;background:var(--bg-base);max-height:100px;overflow-y:auto;";
    aziD.innerHTML =
      '<div style="font-family:\'Cinzel\',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold-dim);margin-bottom:0.2rem;">⚔ Azioni</div>' +
      nl2br(escapeHtml(p.azioni));
    body.appendChild(aziD);
  }
  /* Footer */
  var foot = document.createElement('div');
  foot.className = 'flex items-center justify-between pt-3 border-t';
  foot.appendChild(document.createElement('span'));
  var isOwner =
    !isDM() &&
    state.currentUser &&
    (p.proprietario || '').toLowerCase() === state.currentUser.username.toLowerCase();
  if (isDM()) {
    var btnRow = document.createElement('div');
    btnRow.className = 'flex gap-1';
    var delBtn = document.createElement('button');
    delBtn.className = 'btn-blood';
    delBtn.title = 'Rimuovi pet';
    delBtn.style.cssText = 'padding:0.4rem 0.65rem;';
    delBtn.innerHTML = ICON.trash;
    (function (pet) {
      delBtn.onclick = function () {
        if (confirm('Rimuovere "' + pet.nome + '" dai pet del party?')) {
          state.pet = state.pet.filter(function (x) {
            return x.id !== pet.id;
          });
          fbSavePet();
          saveToStorage();
          notify('Pet rimosso.');
          renderMain();
        }
      };
    })(p);
    /* Pulsante modifica proprietario */
    var editPropBtn = document.createElement('button');
    editPropBtn.className = 'btn-dark';
    editPropBtn.title = 'Modifica proprietario';
    editPropBtn.style.cssText = 'padding:0.4rem 0.65rem;font-size:11px;';
    editPropBtn.textContent = '🧙';
    (function (pet) {
      editPropBtn.onclick = function () {
        var np = prompt('Proprietario del pet (nome personaggio):', pet.proprietario || '');
        if (np === null) return;
        pet.proprietario = np.trim();
        fbSavePet();
        saveToStorage();
        renderMain();
      };
    })(p);
    btnRow.appendChild(editPropBtn);
    btnRow.appendChild(delBtn);
    foot.appendChild(btnRow);
  } else if (isOwner) {
    var ownerRow = document.createElement('div');
    ownerRow.className = 'flex gap-1';
    /* Rinomina pet */
    var renBtn = document.createElement('button');
    renBtn.className = 'btn-dark';
    renBtn.title = 'Rinomina il tuo pet';
    renBtn.style.cssText = 'font-size:11px;padding:0.3rem 0.65rem;';
    renBtn.textContent = '✏ Rinomina';
    (function (pet) {
      renBtn.onclick = function () {
        var nn = prompt(
          'Nome personalizzato per il tuo pet (lascia vuoto per usare il nome originale):',
          pet.petNome || ''
        );
        if (nn === null) return;
        pet.petNome = nn.trim() || '';
        fbSavePet();
        saveToStorage();
        renderMain();
      };
    })(p);
    ownerRow.appendChild(renBtn);
    /* Cambia foto */
    var imgUpBtn = document.createElement('button');
    imgUpBtn.className = 'btn-dark';
    imgUpBtn.title = 'Cambia foto del pet';
    imgUpBtn.style.cssText = 'font-size:11px;padding:0.3rem 0.65rem;';
    imgUpBtn.textContent = '📁 Foto';
    (function (pet) {
      imgUpBtn.onclick = function () {
        var inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/jpeg,image/png';
        inp.onchange = function () {
          if (!this.files[0]) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            pet.petImmagine = ev.target.result;
            fbSavePet();
            saveToStorage();
            renderMain();
          };
          reader.readAsDataURL(this.files[0]);
        };
        inp.click();
      };
    })(p);
    ownerRow.appendChild(imgUpBtn);
    foot.appendChild(ownerRow);
  }
  body.appendChild(foot);
  card.appendChild(body);
  return card;
}

function adottaDalBestiario() {
  if (state.bestiario.length === 0) {
    notify('Il bestiario è vuoto. Aggiungi prima dei mostri.', 'err');
    return;
  }
  var back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.style.zIndex = '100001';
  back.onclick = function (e) {
    if (e.target === back) back.remove();
  };
  var panel = document.createElement('div');
  panel.className = 'modal-panel';
  panel.style.maxWidth = '460px';
  var head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML =
    '<div><div class="font-display font-semibold tracking-widest" style="font-size:11px;color:var(--gold-dim);margin-bottom:0.25rem;">PET DEL PARTY</div><h2 class="font-display font-bold" style="font-size:20px;color:var(--gold-bright);margin:0;">Adotta un Mostro</h2></div><button class="theme-toggle" style="width:38px;height:38px;">✕</button>';
  head.querySelector('button').onclick = function () {
    back.remove();
  };
  panel.appendChild(head);
  var mbody = document.createElement('div');
  mbody.className = 'modal-body';
  /* Ricerca */
  var srchInp = document.createElement('input');
  srchInp.type = 'text';
  srchInp.className = 'field';
  srchInp.placeholder = 'Cerca mostro…';
  srchInp.style.marginBottom = '0.75rem';
  mbody.appendChild(srchInp);
  /* Lista mostri */
  var listEl = document.createElement('div');
  listEl.style.cssText =
    'max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:0.3rem;';
  function buildList(q) {
    listEl.innerHTML = '';
    var items = state.bestiario.filter(function (m) {
      return !q || (m.nome || '').toLowerCase().indexOf(q) >= 0;
    });
    if (items.length === 0) {
      listEl.innerHTML =
        '<div style="color:var(--text-faint);font-family:\'EB Garamond\',serif;font-size:14px;text-align:center;padding:1rem;">Nessun mostro trovato</div>';
      return;
    }
    items.forEach(function (m) {
      var row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0.5rem;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:4px;cursor:pointer;';
      row.onmouseover = function () {
        this.style.borderColor = 'var(--border-gold)';
      };
      row.onmouseout = function () {
        this.style.borderColor = 'var(--border-subtle)';
      };
      if (m.immagine) {
        var th = createContentImage();
        th.src = m.immagine;
        th.style.cssText =
          'width:36px;height:36px;object-fit:cover;border-radius:3px;flex-shrink:0;';
        row.appendChild(th);
      }
      var info = document.createElement('div');
      info.style.flex = '1';
      info.innerHTML =
        '<div style="font-family:\'Cinzel\',serif;font-size:12px;font-weight:700;color:var(--text-strong);">' +
        escapeHtml(m.nome) +
        '</div><div style="font-family:\'EB Garamond\',serif;font-size:13px;color:var(--text-muted);">' +
        (m.taglia ? m.taglia + ' · ' : '') +
        (m.tipo || '') +
        '</div>';
      row.appendChild(info);
      var selBtn = document.createElement('button');
      selBtn.className = 'btn-gold';
      selBtn.style.cssText = 'font-size:11px;padding:0.25rem 0.6rem;white-space:nowrap;';
      selBtn.textContent = 'Adotta';
      (function (monster) {
        selBtn.onclick = function () {
          var prop = prompt('Chi nel party lo adotta? (nome personaggio, opzionale)', '');
          if (prop === null) return;
          var clone = JSON.parse(JSON.stringify(monster));
          clone.id = 'pet_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
          clone.proprietario = prop.trim();
          clone.petImmagine = ''; // foto personale del pet, separata dall'immagine del bestiario
          state.pet.push(clone);
          fbSavePet();
          saveToStorage();
          notify('"' + monster.nome + '" è ora un pet del party! 🐾');
          back.remove();
          renderMain();
        };
      })(m);
      row.appendChild(selBtn);
      listEl.appendChild(row);
    });
  }
  buildList('');
  srchInp.oninput = function () {
    buildList(this.value.toLowerCase().trim());
  };
  mbody.appendChild(listEl);
  panel.appendChild(mbody);
  back.appendChild(panel);
  document.body.appendChild(back);
}
