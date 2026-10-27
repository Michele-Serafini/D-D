/* ============================================================================
   SEZIONE 6: STATISTICHE PARTY & RUOTA DEL CAOS (renderCaos)
   ============================================================================ */
function renderCaos() {
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
    '<div class="header-eyebrow mb-3"><span>Cronaca del Fato</span></div>' +
    '<h1 class="header-title">Statistiche & Caos</h1>' +
    '<p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Contatori del destino e Orologio della Tensione</p>' +
    '</div>';
  hc.appendChild(top);

  var fd = document.createElement('div');
  fd.className = 'filigree-divider mt-7';
  hc.appendChild(fd);

  var notice = document.createElement('div');
  notice.className = 'notice mt-5';
  notice.innerHTML =
    '<strong style="color:var(--gold);font-style:normal;">\u{1F3B2} Promemoria del Fato: </strong>' +
    'tieni traccia dei <em>1 naturali</em> (fallimenti critici) e dei <em>20 naturali</em> (successi critici) di ogni giocatore. ' +
    'Al raggiungere certe soglie, animazioni speciali appariranno: <em>3 = leggera, 4 = intensa, 5+ = devastante</em>. ' +
    'I contatori sono salvati nel browser e sopravvivono al ricaricamento della pagina.';
  hc.appendChild(notice);
  header.appendChild(hc);
  wrap.appendChild(header);

  /* BODY */
  var section = document.createElement('section');
  section.className = 'caos-wrap pb-20';
  section.style.cssText = 'padding-top:2rem;';

  var grid = document.createElement('div');
  grid.className = 'caos-grid';

  /* === COLONNA SX: COUNTER DEL DESTINO === */
  var left = document.createElement('div');

  var sectionTitle = document.createElement('div');
  sectionTitle.className = 'counter-section-title';
  sectionTitle.innerHTML = '<span>\u269C Counter del Destino \u269C</span>';
  left.appendChild(sectionTitle);

  /* Toolbar azioni */
  var actions = document.createElement('div');
  actions.className = 'caos-actions';

  var addBtn = document.createElement('button');
  addBtn.className = 'btn-gold';
  addBtn.style.cssText = 'padding:0.5rem 0.85rem;';
  addBtn.innerHTML = ICON.plus + ' Aggiungi Giocatore';
  addBtn.onclick = function () {
    state.caosPlayers.push(makeCaosPlayer(''));
    saveToStorage();
    fbSaveCaos();
    renderCaosBody();
    setTimeout(function () {
      var inputs = document.querySelectorAll('.player-row-name-input');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 0);
  };
  if (isDM()) actions.appendChild(addBtn);

  var importBtn = document.createElement('button');
  importBtn.className = 'btn-dark';
  importBtn.style.cssText = 'padding:0.5rem 0.85rem;';
  importBtn.innerHTML = ICON.swords + ' Importa da Iniziativa';
  importBtn.onclick = function () {
    var imported = 0;
    var existingNames = state.caosPlayers.map(function (p) {
      return (p.nome || '').toLowerCase().trim();
    });
    state.combatants.forEach(function (c) {
      if (!c.nome || !c.nome.trim()) return;
      if (c.tipo !== 'pg') return;
      var nm = c.nome.trim();
      if (existingNames.indexOf(nm.toLowerCase()) >= 0) return;
      state.caosPlayers.push(makeCaosPlayer(nm));
      existingNames.push(nm.toLowerCase());
      imported++;
    });
    if (imported > 0) {
      saveToStorage();
      fbSaveCaos();
      renderCaosBody();
      notify('Importati ' + imported + " PG dall'iniziativa.");
    } else {
      notify('Nessun nuovo PG da importare.', 'err');
    }
  };
  if (isDM()) actions.appendChild(importBtn);

  var clearBtn = document.createElement('button');
  clearBtn.className = 'btn-blood';
  clearBtn.style.cssText = 'padding:0.5rem 0.85rem;margin-left:auto;';
  clearBtn.innerHTML = ICON.refresh + ' Azzera Contatori';
  clearBtn.onclick = function () {
    if (state.caosPlayers.length === 0) return;
    if (
      !confirm(
        'Azzerare tutti i contatori (1 e 20 naturali) di tutti i giocatori? I nomi resteranno.'
      )
    )
      return;
    state.caosPlayers.forEach(function (p) {
      p.fail = 0;
      p.succ = 0;
    });
    saveToStorage();
    fbSaveCaos();
    renderCaosBody();
    notify('Contatori azzerati.');
  };
  if (isDM()) actions.appendChild(clearBtn);

  left.appendChild(actions);

  var playersWrap = document.createElement('div');
  playersWrap.id = 'caos-players-wrap';
  left.appendChild(playersWrap);

  grid.appendChild(left);

  /* === COLONNA DX: D20 DELLA CONDANNA === */
  var right = document.createElement('div');
  right.id = 'caos-doom-col';
  grid.appendChild(right);

  section.appendChild(grid);
  wrap.appendChild(section);

  /* Render dopo che il DOM è pronto */
  setTimeout(function () {
    renderCaosPlayers();
    renderDoomWheel();
  }, 0);

  return wrap;
}

function renderCaosBody() {
  renderCaosPlayers();
  /* La doom-wheel non dipende dai players, non serve ridipingerla */
}

function renderCaosPlayers() {
  var wrap = document.getElementById('caos-players-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (state.caosPlayers.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'empty-state panel-glass';
    empty.style.cssText = 'padding:3rem 1.5rem;';
    empty.innerHTML =
      '<div class="rune">\u{1F3B2}</div>' +
      '<h2>Nessun giocatore registrato</h2>' +
      '<p>Aggiungi i tuoi PG manualmente o importali dalla sezione Iniziativa.</p>';
    wrap.appendChild(empty);
    return;
  }

  var list = document.createElement('div');
  list.className = 'player-counters';

  state.caosPlayers.forEach(function (player) {
    list.appendChild(renderPlayerRow(player));
  });

  wrap.appendChild(list);
}

/* ===========================================================
   SVG HELPERS — Forme procedurali per le animazioni rituali
   =========================================================== */

/* Pentacolo (soglia 4 fail): stella a 5 punte iscritta in cerchio,
   con stroke-dasharray controllato dal CSS per il drawing. */
function svgPentacle() {
  /* Calcoliamo i 5 vertici della stella su un cerchio di raggio 36, centro (40,40).
     Stella a 5 punte si disegna unendo i vertici a salto di 2 (pentagramma). */
  var cx = 40,
    cy = 40,
    r = 32;
  var pts = [];
  for (var i = 0; i < 5; i++) {
    var a = ((-90 + i * 72) * Math.PI) / 180;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  var order = [0, 2, 4, 1, 3, 0];
  var d = 'M ' + pts[order[0]].x.toFixed(1) + ' ' + pts[order[0]].y.toFixed(1);
  for (var k = 1; k < order.length; k++) {
    d += ' L ' + pts[order[k]].x.toFixed(1) + ' ' + pts[order[k]].y.toFixed(1);
  }
  return (
    '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">' +
    '<circle class="pentacle-circle" cx="40" cy="40" r="35"/>' +
    '<path class="pentacle-star" d="' +
    d +
    '"/>' +
    '</svg>'
  );
}

/* Pentacolo fiammeggiante (soglia 5 fail): versione più decorata,
   con cerchio interno riempito e doppio bordo. */
function svgPentacleBurning() {
  var cx = 45,
    cy = 45,
    r = 38;
  var pts = [];
  for (var i = 0; i < 5; i++) {
    var a = ((-90 + i * 72) * Math.PI) / 180;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  var order = [0, 2, 4, 1, 3, 0];
  var d = 'M ' + pts[order[0]].x.toFixed(1) + ' ' + pts[order[0]].y.toFixed(1);
  for (var k = 1; k < order.length; k++) {
    d += ' L ' + pts[order[k]].x.toFixed(1) + ' ' + pts[order[k]].y.toFixed(1);
  }
  return (
    '<svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">' +
    '<circle class="pentacle-inner-circle" cx="45" cy="45" r="20"/>' +
    '<circle class="pentacle-circle" cx="45" cy="45" r="42"/>' +
    '<circle class="pentacle-circle" cx="45" cy="45" r="38"/>' +
    '<path class="pentacle-star" d="' +
    d +
    '"/>' +
    /* Rune brevi attorno al cerchio esterno per "carattere occulto" */
    '<g stroke="#ffaa30" stroke-width="1" fill="none" opacity="0.7">' +
    '<path d="M 45 2 L 45 6 M 43 4 L 47 4"/>' +
    '<path d="M 81 27 L 84 31 M 81 31 L 84 27"/>' +
    '<path d="M 81 60 L 84 62 L 81 64 M 84 60 L 84 64"/>' +
    '<path d="M 45 84 L 45 88 M 41 86 L 49 86"/>' +
    '<path d="M 6 60 L 9 64 M 6 64 L 9 60"/>' +
    '<path d="M 6 27 L 9 25 L 9 31 L 6 29"/>' +
    '</g>' +
    '</svg>'
  );
}

/* Mano spettrale stilizzata (semplice silhouette) */
function svgSpectralHand(side) {
  /* Una mano stilizzata: palmo + 5 dita orientate verso il centro.
     L'animazione di traccia è gestita dal CSS via rotazione su
     transform-origin esterno. */
  var flipAttr = side === 'right' ? ' transform="scale(-1,1) translate(-32,0)"' : '';
  return (
    '<div class="hand ' +
    side +
    '">' +
    '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" width="32" height="32">' +
    '<g' +
    flipAttr +
    ' fill="currentColor">' +
    /* Palmo */
    '<path d="M 14 14 Q 10 13 8 17 Q 7 22 10 26 L 22 26 Q 26 24 24 18 Q 22 13 18 14 Z" opacity="0.85"/>' +
    /* Dita allungate */
    '<path d="M 11 16 Q 9 11 7 8 Q 6 6 8 5 Q 10 5 11 9 Z" opacity="0.85"/>' +
    '<path d="M 14 14 Q 13 8 13 3 Q 13 1 15 1 Q 17 1 17 4 Q 17 10 17 14 Z" opacity="0.85"/>' +
    '<path d="M 18 14 Q 19 9 21 5 Q 22 3 24 4 Q 25 5 24 8 Q 22 12 20 15 Z" opacity="0.85"/>' +
    '<path d="M 21 16 Q 24 13 27 11 Q 29 10 30 12 Q 30 14 27 16 Q 24 18 22 19 Z" opacity="0.8"/>' +
    '</g>' +
    '</svg>' +
    '</div>'
  );
}

/* Figura in preghiera (soglia 4 succ): sagoma stilizzata di
   persona inginocchiata con mani giunte. */
function svgPrayingFigure() {
  return (
    '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">' +
    /* Glow di sfondo (multipli cerchi concentrici sottili) */
    '<circle class="figure-glow" cx="36" cy="40" r="32" opacity="0.4"/>' +
    '<circle class="figure-glow" cx="36" cy="40" r="26" opacity="0.55"/>' +
    /* Sagoma: testa */
    '<circle class="figure-body" cx="36" cy="18" r="6"/>' +
    /* Aureola */
    '<ellipse class="angel-halo" cx="36" cy="15" rx="9" ry="2.5" fill="none" stroke="#fff0b0" stroke-width="1.2"/>' +
    /* Corpo (forma genuflessa, mani giunte) */
    '<path class="figure-body" d="' +
    'M 36 25 ' +
    'Q 28 28 26 38 ' +
    'Q 25 48 28 54 ' +
    'L 44 54 ' +
    'Q 47 48 46 38 ' +
    'Q 44 28 36 25 ' +
    'Z"/>' +
    /* Mani giunte (rombo davanti al petto) */
    '<path class="figure-body" d="M 36 30 L 40 36 L 36 42 L 32 36 Z" opacity="0.95"/>' +
    /* Base/piedi piegati */
    '<path class="figure-body" d="M 24 54 L 48 54 L 50 60 L 22 60 Z"/>' +
    '</svg>'
  );
}

/* Angelo maestoso (soglia 5+ succ): silhouette frontale con ali estese,
   aureola e veste. Le ali sono separate per essere animate via CSS. */
function svgAngel() {
  return (
    '<svg viewBox="0 0 130 100" xmlns="http://www.w3.org/2000/svg">' +
    /* Ala sinistra */
    '<path class="wing-left" d="' +
    'M 65 30 ' +
    'Q 35 15 8 25 ' +
    'Q 6 30 14 32 ' +
    'Q 25 33 32 38 ' +
    'Q 20 40 14 48 ' +
    'Q 18 52 28 50 ' +
    'Q 38 49 50 48 ' +
    'L 65 45 Z"/>' +
    /* Ala destra */
    '<path class="wing-right" d="' +
    'M 65 30 ' +
    'Q 95 15 122 25 ' +
    'Q 124 30 116 32 ' +
    'Q 105 33 98 38 ' +
    'Q 110 40 116 48 ' +
    'Q 112 52 102 50 ' +
    'Q 92 49 80 48 ' +
    'L 65 45 Z"/>' +
    /* Aureola */
    '<ellipse class="angel-halo" cx="65" cy="22" rx="14" ry="3"/>' +
    /* Testa */
    '<circle class="angel-body" cx="65" cy="28" r="6"/>' +
    /* Corpo (lunga veste) */
    '<path class="angel-body" d="' +
    'M 65 35 ' +
    'Q 56 38 54 50 ' +
    'Q 52 65 56 80 ' +
    'Q 60 95 65 95 ' +
    'Q 70 95 74 80 ' +
    'Q 78 65 76 50 ' +
    'Q 74 38 65 35 Z"/>' +
    /* Riflesso/luce sul petto */
    '<path d="M 60 45 Q 65 42 70 45 Q 68 52 65 55 Q 62 52 60 45 Z" fill="rgba(255,250,220,0.5)"/>' +
    '</svg>'
  );
}

/* Cuore Minecraft Hardcore stilizzato — facce cattive (Prono).
   Stile pixel-art: blocchi 22x22, occhi vuoti, ghigno spigoloso. */
function svgHardcoreHeart() {
  return (
    '<div class="mc-heart">' +
    '<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">' +
    /* Corpo del cuore — pixel art rosso scuro hardcore */
    '<g>' +
    /* Riga 1 (top) — due "lobi" */
    '<rect x="3" y="3" width="6" height="2" fill="#a01818"/>' +
    '<rect x="13" y="3" width="6" height="2" fill="#a01818"/>' +
    /* Riga 2 — lobi più larghi */
    '<rect x="2" y="5" width="8" height="2" fill="#c83030"/>' +
    '<rect x="12" y="5" width="8" height="2" fill="#c83030"/>' +
    /* Riga 3 — ponte centrale */
    '<rect x="2" y="7" width="18" height="2" fill="#c83030"/>' +
    /* Riga 4 */
    '<rect x="2" y="9" width="18" height="2" fill="#a82020"/>' +
    /* Riga 5 — restringimento */
    '<rect x="3" y="11" width="16" height="2" fill="#a82020"/>' +
    /* Riga 6 */
    '<rect x="4" y="13" width="14" height="2" fill="#881818"/>' +
    /* Riga 7 */
    '<rect x="6" y="15" width="10" height="2" fill="#881818"/>' +
    /* Riga 8 — punta */
    '<rect x="8" y="17" width="6" height="2" fill="#601010"/>' +
    '<rect x="10" y="19" width="2" height="1" fill="#601010"/>' +
    '</g>' +
    /* Highlight pixel art (in alto a sx) */
    '<g>' +
    '<rect x="4" y="5" width="2" height="2" fill="#ff5050"/>' +
    '<rect x="3" y="7" width="2" height="2" fill="#ff5050"/>' +
    '</g>' +
    /* Faccia cattiva: occhi vuoti + bocca arcigna */
    '<g fill="#1a0606">' +
    /* Occhi inclinati arrabbiati */
    '<rect x="7" y="8" width="2" height="2"/>' +
    '<rect x="6" y="9" width="2" height="1"/>' +
    '<rect x="13" y="8" width="2" height="2"/>' +
    '<rect x="14" y="9" width="2" height="1"/>' +
    /* Bocca a ghigno */
    '<rect x="9" y="12" width="4" height="1"/>' +
    '<rect x="8" y="13" width="1" height="1"/>' +
    '<rect x="13" y="13" width="1" height="1"/>' +
    '</g>' +
    /* Bordo nero esterno per definire il cuore */
    '<g fill="#1a0606">' +
    '<rect x="2" y="3" width="1" height="2"/>' +
    '<rect x="9" y="3" width="4" height="2" fill="#1a0606" opacity="0"/>' +
    '<rect x="9" y="3" width="1" height="1"/>' +
    '<rect x="12" y="3" width="1" height="1"/>' +
    '<rect x="19" y="3" width="1" height="2"/>' +
    '<rect x="1" y="5" width="1" height="2"/>' +
    '<rect x="20" y="5" width="1" height="2"/>' +
    '<rect x="1" y="7" width="1" height="4"/>' +
    '<rect x="20" y="7" width="1" height="4"/>' +
    '<rect x="2" y="11" width="1" height="2"/>' +
    '<rect x="19" y="11" width="1" height="2"/>' +
    '<rect x="3" y="13" width="1" height="2"/>' +
    '<rect x="18" y="13" width="1" height="2"/>' +
    '<rect x="5" y="15" width="1" height="2"/>' +
    '<rect x="16" y="15" width="1" height="2"/>' +
    '<rect x="7" y="17" width="1" height="2"/>' +
    '<rect x="14" y="17" width="1" height="2"/>' +
    '<rect x="9" y="19" width="1" height="1"/>' +
    '<rect x="12" y="19" width="1" height="1"/>' +
    '<rect x="10" y="20" width="2" height="1"/>' +
    '</g>' +
    '</svg>' +
    '</div>'
  );
}

function renderPlayerRow(player) {
  var row = document.createElement('div');
  var lvlClass = getPlayerRowClasses(player);
  row.className = 'player-row' + (lvlClass ? ' ' + lvlClass : '');

  /* ===== Layer di animazione in base ai livelli ===== */
  /* Le animazioni base (aure, glow, pulse) sono nel CSS della classe .lvlN-*.
     Qui aggiungiamo solo gli elementi DOM extra necessari per gli effetti
     più complessi (rito oscuro, apocalisse, devozione, intervento divino). */
  var failLvl = getCounterLevel(player.fail);
  var succLvl = getCounterLevel(player.succ);
  var domFail = failLvl >= succLvl && failLvl > 0;
  var domSucc = succLvl > failLvl && succLvl > 0;

  if (domFail) {
    if (failLvl === 1) {
      /* Soglia 3: solo aura rossa (interamente CSS via ::before).
         Nessun layer DOM aggiuntivo necessario. */
    } else if (failLvl === 2) {
      /* Soglia 4 — RITO OSCURO: mani spettrali che disegnano il pentacolo */
      var hands = document.createElement('div');
      hands.className = 'fx-spectral-hands';
      hands.innerHTML = svgSpectralHand('left') + svgSpectralHand('right');
      row.appendChild(hands);
      var pentacle = document.createElement('div');
      pentacle.className = 'fx-pentacle';
      pentacle.innerHTML = svgPentacle();
      row.appendChild(pentacle);
    } else if (failLvl >= 3) {
      /* Soglia 5+ — APOCALISSE: pentacolo completo fiammeggiante,
         lampi rossi, fumo nero alla base */
      var pentacleBurn = document.createElement('div');
      pentacleBurn.className = 'fx-pentacle-burning';
      pentacleBurn.innerHTML = svgPentacleBurning();
      row.appendChild(pentacleBurn);
      var smoke = document.createElement('div');
      smoke.className = 'fx-black-smoke';
      row.appendChild(smoke);
      var lightning = document.createElement('div');
      lightning.className = 'fx-lightning';
      lightning.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
      row.appendChild(lightning);
    }
  } else if (domSucc) {
    if (succLvl === 1) {
      /* Soglia 3: solo aura dorata (CSS via ::before).
         Nessun layer DOM aggiuntivo. */
    } else if (succLvl === 2) {
      /* Soglia 4 — DEVOZIONE: figura in preghiera + particelle di luce che salgono */
      var prayer = document.createElement('div');
      prayer.className = 'fx-praying-figure';
      prayer.innerHTML = svgPrayingFigure();
      row.appendChild(prayer);
      var lightParts = document.createElement('div');
      lightParts.className = 'fx-light-particles';
      lightParts.innerHTML =
        '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>';
      row.appendChild(lightParts);
    } else if (succLvl >= 3) {
      /* Soglia 5+ — INTERVENTO DIVINO: angelo SVG, raggi di sfondo,
         luce accecante che emana dai bordi */
      var raysBg = document.createElement('div');
      raysBg.className = 'fx-divine-rays-bg';
      row.appendChild(raysBg);
      var angel = document.createElement('div');
      angel.className = 'fx-angel';
      angel.innerHTML = svgAngel();
      row.appendChild(angel);
      var divineLight = document.createElement('div');
      divineLight.className = 'fx-divine-light';
      row.appendChild(divineLight);
    }
  }

  /* ===== Contenuto effettivo della riga ===== */

  /* Nome (input modificabile) */
  var nameWrap = document.createElement('div');
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'player-row-name-input';
  nameInput.value = player.nome;
  nameInput.placeholder = 'Nome del giocatore...';
  nameInput.dataset.pid = player.id;
  nameInput.oninput = function () {
    player.nome = this.value;
    saveToStorage();
    if (_fbSaveCaosNomeTimer) clearTimeout(_fbSaveCaosNomeTimer);
    _fbSaveCaosNomeTimer = setTimeout(fbSaveCaos, 600);
  };
  nameWrap.appendChild(nameInput);
  row.appendChild(nameWrap);

  /* Counter Fail (1 naturale) */
  row.appendChild(renderD20Counter(player, 'fail'));

  /* Counter Success (20 naturale) */
  row.appendChild(renderD20Counter(player, 'succ'));

  /* Azione: rimuovi — solo DM */
  var actions = document.createElement('div');
  actions.className = 'player-row-actions';
  if (isDM()) {
    var del = document.createElement('button');
    del.className = 'row-delete';
    del.title = 'Rimuovi giocatore';
    del.innerHTML = ICON.x;
    del.onclick = function () {
      if (!confirm('Rimuovere ' + (player.nome || 'questo giocatore') + ' dalla cronaca?')) return;
      state.caosPlayers = state.caosPlayers.filter(function (p) {
        return p.id !== player.id;
      });
      saveToStorage();
      fbSaveCaos();
      renderCaosBody();
    };
    actions.appendChild(del);
  }
  row.appendChild(actions);

  return row;
}

function renderD20Counter(player, kind) {
  var isFail = kind === 'fail';
  var count = isFail ? player.fail : player.succ;

  var wrap = document.createElement('div');
  wrap.className = 'd20-counter' + (isFail ? ' crit-fail' : ' crit-success');

  /* Icona D20 */
  var icon = document.createElement('div');
  icon.className = 'd20-icon';
  icon.innerHTML = d20IconSvg(isFail);
  wrap.appendChild(icon);

  /* Numero */
  var num = document.createElement('div');
  num.className = 'd20-count ' + (isFail ? 'fail-color' : 'succ-color');
  num.textContent = count;
  wrap.appendChild(num);

  /* Frecce */
  var arrows = document.createElement('div');
  arrows.className = 'd20-arrows';

  var up = document.createElement('button');
  up.className = 'd20-arrow';
  up.title = 'Incrementa';
  up.innerHTML =
    '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6 L5 3 L8 6"/></svg>';
  up.disabled = !isDM();
  up.style.opacity = isDM() ? '' : '0.35';
  up.onclick = function () {
    if (!isDM()) return;
    if (isFail) player.fail++;
    else player.succ++;
    saveToStorage();
    fbSaveCaos();
    renderCaosPlayers();
  };
  arrows.appendChild(up);

  var down = document.createElement('button');
  down.className = 'd20-arrow';
  down.title = 'Decrementa';
  down.innerHTML =
    '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4 L5 7 L8 4"/></svg>';
  down.disabled = !isDM();
  down.style.opacity = isDM() ? '' : '0.35';
  down.onclick = function () {
    if (!isDM()) return;
    if (isFail) {
      if (player.fail > 0) player.fail--;
    } else {
      if (player.succ > 0) player.succ--;
    }
    saveToStorage();
    fbSaveCaos();
    renderCaosPlayers();
  };
  arrows.appendChild(down);

  wrap.appendChild(arrows);
  return wrap;
}

/* Icona D20 stilizzata: '1' rosso o '20' oro */
function d20IconSvg(isFail) {
  var color = isFail ? '#d83030' : '#ffd870';
  var outlineColor = isFail ? '#5a1010' : '#7a5818';
  var fillColor = isFail ? '#2a0a0a' : '#2a1e08';
  var text = isFail ? '1' : '20';
  var fontSize = isFail ? '13' : '11';
  return (
    '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">' +
    /* esagono d20 a forma di losanga */
    '<polygon points="20,3 36,12 36,28 20,37 4,28 4,12" fill="' +
    fillColor +
    '" stroke="' +
    outlineColor +
    '" stroke-width="1.5"/>' +
    '<polygon points="20,3 36,12 28,18 12,18 4,12" fill="rgba(255,255,255,0.05)"/>' +
    '<polygon points="20,37 4,28 12,22 28,22 36,28" fill="rgba(0,0,0,0.3)"/>' +
    '<text x="20" y="25" text-anchor="middle" font-family="Cinzel, serif" font-weight="800" font-size="' +
    fontSize +
    '" fill="' +
    color +
    '" style="text-shadow: 0 0 6px ' +
    color +
    '">' +
    text +
    '</text>' +
    '</svg>'
  );
}

/* ===========================================================
   D20 DELLA CONDANNA — Orologio della Tensione
   =========================================================== */

function renderDoomWheel() {
  var col = document.getElementById('caos-doom-col');
  if (!col) return;
  col.innerHTML = '';

  var panel = document.createElement('div');
  panel.className = 'condanna-panel doom-stage-' + state.doomStage;
  if (state.doomTransforming) panel.classList.add('doom-shaking');

  var title = document.createElement('div');
  title.className = 'condanna-title';
  if (state.doomStage === 1) title.textContent = 'D6 della Condanna';
  else if (state.doomStage === 2) title.textContent = 'D8 della Condanna';
  else title.textContent = 'D20 INFERNALE';
  panel.appendChild(title);

  var sub = document.createElement('div');
  sub.className = 'condanna-sub';
  if (state.doomStage === 1)
    sub.textContent = "Stadio I — l'orologio della tensione inizia a battere.";
  else if (state.doomStage === 2)
    sub.textContent = 'Stadio II — la pressione cresce, gli spicchi si stringono.';
  else
    sub.textContent =
      'Stadio III — emerso dagli inferi. Ogni clic illumina una faccia con luce lavica.';
  panel.appendChild(sub);

  /* Wheel — diverso per stadio 1/2 (anello di spicchi) vs stadio 3 (D20 3D) */
  var wheelWrap = document.createElement('div');
  wheelWrap.className = 'doom-wheel-wrap';

  if (state.doomStage < 3) {
    wheelWrap.appendChild(buildSpicchiWheel());
  } else {
    wheelWrap.appendChild(buildD20Stage3());
  }

  /* Teschio centrale cliccabile (sempre presente) */
  var skull = document.createElement('button');
  var totalSeg = doomSegmentsForStage(state.doomStage);
  skull.className =
    'doom-skull-btn doom-skull-stage-' +
    state.doomStage +
    (state.doomFilled >= totalSeg ? ' full' : '') +
    (state.doomTransforming ? ' transforming' : '');
  skull.title = 'Clicca per avanzare la Condanna';
  skull.textContent = '\u{1F480}';
  skull.disabled = state.doomTransforming;
  skull.onclick = onSkullClick;
  wheelWrap.appendChild(skull);

  /* Layer per particelle di cenere durante la trasformazione */
  if (state.doomTransforming) {
    var ash = document.createElement('div');
    ash.className = 'doom-ash-layer';
    var ashHtml = '';
    for (var ai = 0; ai < 24; ai++) ashHtml += '<span class="ash-particle"></span>';
    ash.innerHTML = ashHtml;
    wheelWrap.appendChild(ash);
  }

  panel.appendChild(wheelWrap);

  /* Indicatore di stadio */
  var stageInd = document.createElement('div');
  stageInd.className = 'doom-stage-indicator';
  stageInd.innerHTML =
    '<span class="stage-dot' +
    (state.doomStage >= 1 ? ' active' : '') +
    (state.doomStage === 1 ? ' current' : '') +
    '">D6</span>' +
    '<span class="stage-arrow">\u25B6</span>' +
    '<span class="stage-dot' +
    (state.doomStage >= 2 ? ' active' : '') +
    (state.doomStage === 2 ? ' current' : '') +
    '">D8</span>' +
    '<span class="stage-arrow">\u25B6</span>' +
    '<span class="stage-dot' +
    (state.doomStage >= 3 ? ' active' : '') +
    (state.doomStage === 3 ? ' current final' : '') +
    '">D20</span>';
  panel.appendChild(stageInd);

  /* Progresso testuale */
  var prog = document.createElement('div');
  prog.className = 'doom-progress';
  prog.innerHTML = 'Tensione: <strong>' + state.doomFilled + ' / ' + totalSeg + '</strong>';
  panel.appendChild(prog);

  /* Controlli — solo DM */
  if (isDM()) {
    var ctrl = document.createElement('div');
    ctrl.className = 'doom-controls';

    var resetBtn = document.createElement('button');
    resetBtn.textContent = 'Azzera Tensione';
    resetBtn.disabled = state.doomTransforming;
    resetBtn.onclick = function () {
      if (state.doomFilled === 0) return;
      state.doomFilled = 0;
      saveToStorage();
      fbSaveCaos();
      renderDoomWheel();
    };
    ctrl.appendChild(resetBtn);

    var stageResetBtn = document.createElement('button');
    stageResetBtn.textContent = 'Reset Stadio';
    stageResetBtn.disabled = state.doomTransforming;
    stageResetBtn.title = 'Riporta tutto allo Stadio I (D6)';
    stageResetBtn.onclick = function () {
      if (
        !confirm(
          "Riportare la Condanna allo Stadio I (D6)? L'evoluzione narrativa verrà annullata."
        )
      )
        return;
      state.doomStage = 1;
      state.doomFilled = 0;
      state.doomTransforming = false;
      saveToStorage();
      fbSaveCaos();
      renderDoomWheel();
    };
    ctrl.appendChild(stageResetBtn);

    panel.appendChild(ctrl);
  }
  col.appendChild(panel);

  /* Render timer subito sotto il dado — solo DM */
  if (isDM()) renderDmTimer();
}

/* ===========================================================
   TIMER DM
   =========================================================== */
var _timerState = {
  totalSec: 0 /* secondi impostati */,
  remaining: 0 /* secondi rimanenti */,
  running: false,
  interval: null,
};

function _timerTick() {
  if (!_timerState.running) return;
  _timerState.remaining = Math.max(0, _timerState.remaining - 1);
  renderDmTimer();
  if (_timerState.remaining === 0) {
    _timerState.running = false;
    clearInterval(_timerState.interval);
    _timerState.interval = null;
    /* Lampeggia urgente già gestito dal CSS con classe urgent */
  }
}

function renderDmTimer() {
  var col = document.getElementById('caos-doom-col');
  if (!col) return;

  var existing = document.getElementById('dm-timer-widget');
  if (existing) existing.remove();

  var wrap = document.createElement('div');
  wrap.className = 'dm-timer-wrap';
  wrap.id = 'dm-timer-widget';

  /* Titolo */
  var ttl = document.createElement('div');
  ttl.className = 'dm-timer-title';
  ttl.textContent = '⏱ Timer';
  wrap.appendChild(ttl);

  /* Display */
  var mm = Math.floor(_timerState.remaining / 60);
  var ss = _timerState.remaining % 60;
  var displayStr = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  var disp = document.createElement('div');
  var isUrgent = _timerState.remaining > 0 && _timerState.remaining <= 10;
  disp.className =
    'dm-timer-display' +
    (_timerState.running ? (isUrgent ? ' urgent' : ' running') : isUrgent ? ' urgent' : '');
  disp.textContent = displayStr;
  wrap.appendChild(disp);

  /* Preset rapidi */
  var presetsDiv = document.createElement('div');
  presetsDiv.className = 'dm-timer-presets';
  [
    [30, '30s'],
    [60, '1m'],
    [120, '2m'],
    [300, '5m'],
    [600, '10m'],
  ].forEach(function (p) {
    var btn = document.createElement('button');
    btn.className = 'dm-timer-preset';
    btn.textContent = p[1];
    btn.onclick = function () {
      if (_timerState.interval) clearInterval(_timerState.interval);
      _timerState.totalSec = p[0];
      _timerState.remaining = p[0];
      _timerState.running = false;
      _timerState.interval = null;
      renderDmTimer();
    };
    presetsDiv.appendChild(btn);
  });
  wrap.appendChild(presetsDiv);

  /* Input manuale mm:ss */
  var setRow = document.createElement('div');
  setRow.className = 'dm-timer-set-row';
  var inpM = document.createElement('input');
  inpM.type = 'number';
  inpM.className = 'dm-timer-input';
  inpM.min = '0';
  inpM.max = '99';
  inpM.value = String(Math.floor(_timerState.totalSec / 60));
  inpM.placeholder = 'mm';
  var sep = document.createElement('span');
  sep.className = 'dm-timer-sep';
  sep.textContent = ':';
  var inpS = document.createElement('input');
  inpS.type = 'number';
  inpS.className = 'dm-timer-input';
  inpS.min = '0';
  inpS.max = '59';
  inpS.value = String(_timerState.totalSec % 60).padStart(2, '0');
  inpS.placeholder = 'ss';
  var setBtn = document.createElement('button');
  setBtn.className = 'dm-timer-btn dm-timer-btn-pause';
  setBtn.style.flex = '0 0 auto';
  setBtn.style.padding = '0.4rem 0.7rem';
  setBtn.textContent = 'Imposta';
  setBtn.onclick = function () {
    var m = Math.max(0, parseInt(inpM.value) || 0);
    var s = Math.max(0, Math.min(59, parseInt(inpS.value) || 0));
    var tot = m * 60 + s;
    if (!tot) return;
    if (_timerState.interval) clearInterval(_timerState.interval);
    _timerState.totalSec = tot;
    _timerState.remaining = tot;
    _timerState.running = false;
    _timerState.interval = null;
    renderDmTimer();
  };
  setRow.appendChild(inpM);
  setRow.appendChild(sep);
  setRow.appendChild(inpS);
  setRow.appendChild(setBtn);
  wrap.appendChild(setRow);

  /* Bottoni Start/Pausa/Reset */
  var btnRow = document.createElement('div');
  btnRow.className = 'dm-timer-btn-row';

  var startBtn = document.createElement('button');
  startBtn.className = 'dm-timer-btn dm-timer-btn-start';
  startBtn.textContent = _timerState.running ? '⏸ Pausa' : '▶ Avvia';
  if (_timerState.running) startBtn.className = 'dm-timer-btn dm-timer-btn-pause';
  startBtn.onclick = function () {
    if (_timerState.remaining === 0) return;
    if (_timerState.running) {
      /* Pausa */
      _timerState.running = false;
      if (_timerState.interval) {
        clearInterval(_timerState.interval);
        _timerState.interval = null;
      }
    } else {
      /* Avvia */
      _timerState.running = true;
      _timerState.interval = setInterval(_timerTick, 1000);
    }
    renderDmTimer();
  };
  btnRow.appendChild(startBtn);

  var resetBtn2 = document.createElement('button');
  resetBtn2.className = 'dm-timer-btn dm-timer-btn-reset';
  resetBtn2.textContent = '↺ Reset';
  resetBtn2.onclick = function () {
    if (_timerState.interval) clearInterval(_timerState.interval);
    _timerState.running = false;
    _timerState.interval = null;
    _timerState.remaining = _timerState.totalSec;
    renderDmTimer();
  };
  btnRow.appendChild(resetBtn2);

  wrap.appendChild(btnRow);
  col.appendChild(wrap);
}

/* Costruisce la "ruota" classica con anello di spicchi (D6/D8) */
function buildSpicchiWheel() {
  var svgNs = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 260 260');
  svg.setAttribute('class', 'doom-wheel-svg');

  var cx = 130,
    cy = 130;
  var outerR = 122;
  var innerR = 74;
  var n = doomSegmentsForStage(state.doomStage);
  var gap = 3;
  var sweep = 360 / n;
  var actualSweep = sweep - gap;

  for (var i = 0; i < n; i++) {
    var startAngle = i * sweep - 90 + gap / 2;
    var endAngle = startAngle + actualSweep;
    var path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', arcSlicePath(cx, cy, innerR, outerR, startAngle, endAngle));
    path.setAttribute('class', 'doom-slice' + (i < state.doomFilled ? ' filled' : ''));
    svg.appendChild(path);
  }

  /* Anelli decorativi */
  var ringOuter = document.createElementNS(svgNs, 'circle');
  ringOuter.setAttribute('cx', cx);
  ringOuter.setAttribute('cy', cy);
  ringOuter.setAttribute('r', outerR + 4);
  ringOuter.setAttribute('fill', 'none');
  ringOuter.setAttribute('stroke', 'rgba(180,60,60,0.5)');
  ringOuter.setAttribute('stroke-width', '1.2');
  svg.appendChild(ringOuter);

  var ringInner = document.createElementNS(svgNs, 'circle');
  ringInner.setAttribute('cx', cx);
  ringInner.setAttribute('cy', cy);
  ringInner.setAttribute('r', innerR - 4);
  ringInner.setAttribute('fill', 'none');
  ringInner.setAttribute('stroke', 'rgba(180,60,60,0.4)');
  ringInner.setAttribute('stroke-width', '1');
  svg.appendChild(ringInner);

  return svg;
}

/* Stadio 3 — D20 stilizzato 3D-ish con 20 facce illuminabili. */
function buildD20Stage3() {
  var svgNs = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 260 260');
  svg.setAttribute('class', 'doom-wheel-svg doom-d20-svg');

  var cx = 130,
    cy = 130;
  /* Disegno un icosaedro stilizzato (proiezione 2D):
     12 vertici, 20 facce. Uso una proiezione canonica top-down
     che mostra ~10 facce visibili al fronte, e simuliamo le 10 retro
     con un secondo anello esterno di triangoli più scuri. */

  /* Anello frontale: 10 triangoli interni */
  var rInnerHex = 38; /* esagono centrale */
  var rMid = 78; /* punte triangoli centrali */
  var rOuter = 115; /* punte triangoli esterni */
  var rRim = 122; /* bordo esterno */

  /* Cornice esterna di luce viola scuro */
  var rim = document.createElementNS(svgNs, 'circle');
  rim.setAttribute('cx', cx);
  rim.setAttribute('cy', cy);
  rim.setAttribute('r', rRim);
  rim.setAttribute('fill', 'none');
  rim.setAttribute('stroke', 'rgba(255,80,30,0.4)');
  rim.setAttribute('stroke-width', '2');
  rim.setAttribute('class', 'd20-rim');
  svg.appendChild(rim);

  /* Facce esterne (10 triangoli "back-faces" attorno) — angoli sfalsati */
  for (var i = 0; i < 10; i++) {
    var aMid = ((i * 36 - 90) * Math.PI) / 180;
    var aLeft = ((i * 36 - 18 - 90) * Math.PI) / 180;
    var aRight = ((i * 36 + 18 - 90) * Math.PI) / 180;
    var pTip = pointOnCircle(cx, cy, rOuter, aMid);
    var pL = pointOnCircle(cx, cy, rMid, aLeft);
    var pR = pointOnCircle(cx, cy, rMid, aRight);
    var face = document.createElementNS(svgNs, 'polygon');
    face.setAttribute(
      'points',
      pTip.x.toFixed(1) +
        ',' +
        pTip.y.toFixed(1) +
        ' ' +
        pL.x.toFixed(1) +
        ',' +
        pL.y.toFixed(1) +
        ' ' +
        pR.x.toFixed(1) +
        ',' +
        pR.y.toFixed(1)
    );
    face.setAttribute(
      'class',
      'd20-face d20-face-outer' + (i < Math.min(state.doomFilled, 10) ? ' lit' : '')
    );
    face.setAttribute('data-face-index', i);
    svg.appendChild(face);
  }

  /* Facce interne (10 triangoli "front-faces") tra l'esagono e i back-faces.
     Disegniamo coppie alternate puntando verso esterno e verso interno. */
  for (var j = 0; j < 10; j++) {
    var bMid = ((j * 36 - 18 - 90) * Math.PI) / 180; /* punta del triangolo */
    var bLeft = ((j * 36 - 90) * Math.PI) / 180;
    var bRight = (((j - 1) * 36 - 90) * Math.PI) / 180;
    var pTip2 = pointOnCircle(cx, cy, rInnerHex, bMid);
    var pL2 = pointOnCircle(cx, cy, rMid, bLeft);
    var pR2 = pointOnCircle(cx, cy, rMid, bRight);
    var face2 = document.createElementNS(svgNs, 'polygon');
    face2.setAttribute(
      'points',
      pTip2.x.toFixed(1) +
        ',' +
        pTip2.y.toFixed(1) +
        ' ' +
        pL2.x.toFixed(1) +
        ',' +
        pL2.y.toFixed(1) +
        ' ' +
        pR2.x.toFixed(1) +
        ',' +
        pR2.y.toFixed(1)
    );
    face2.setAttribute(
      'class',
      'd20-face d20-face-inner' + (j + 10 < state.doomFilled ? ' lit' : '')
    );
    face2.setAttribute('data-face-index', j + 10);
    svg.appendChild(face2);
  }

  return svg;
}

function pointOnCircle(cx, cy, r, angleRad) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

/* Path SVG per uno spicchio anulare (donut slice) */
function arcSlicePath(cx, cy, rInner, rOuter, startAngle, endAngle) {
  var startRad = (startAngle * Math.PI) / 180;
  var endRad = (endAngle * Math.PI) / 180;
  var x1 = cx + rOuter * Math.cos(startRad);
  var y1 = cy + rOuter * Math.sin(startRad);
  var x2 = cx + rOuter * Math.cos(endRad);
  var y2 = cy + rOuter * Math.sin(endRad);
  var x3 = cx + rInner * Math.cos(endRad);
  var y3 = cy + rInner * Math.sin(endRad);
  var x4 = cx + rInner * Math.cos(startRad);
  var y4 = cy + rInner * Math.sin(startRad);
  var largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return (
    'M ' +
    x1.toFixed(2) +
    ' ' +
    y1.toFixed(2) +
    ' A ' +
    rOuter +
    ' ' +
    rOuter +
    ' 0 ' +
    largeArc +
    ' 1 ' +
    x2.toFixed(2) +
    ' ' +
    y2.toFixed(2) +
    ' L ' +
    x3.toFixed(2) +
    ' ' +
    y3.toFixed(2) +
    ' A ' +
    rInner +
    ' ' +
    rInner +
    ' 0 ' +
    largeArc +
    ' 0 ' +
    x4.toFixed(2) +
    ' ' +
    y4.toFixed(2) +
    ' Z'
  );
}

function onSkullClick() {
  if (state.doomTransforming) return;
  if (!isDM()) return; // solo DM può cliccare
  var total = doomSegmentsForStage(state.doomStage);
  if (state.doomFilled >= total) {
    triggerDoomEvent();
    return;
  }
  state.doomFilled++;
  saveToStorage();
  fbSaveCaos();
  if (state.doomFilled >= total) {
    renderDoomWheel();
    setTimeout(triggerDoomEvent, 800);
  } else {
    renderDoomWheel();
  }
}

function triggerDoomEvent() {
  /* Seleziona la lista in base allo stadio attuale */
  var list;
  if (state.doomStage === 1) {
    list = EVENTI_SOFT;
    state.doomEventLevel = 1;
  } else if (state.doomStage === 2) {
    list = EVENTI_MEDIUM;
    state.doomEventLevel = 2;
  } else {
    list = EVENTI_CATASTROFICI;
    state.doomEventLevel = 3;
  }

  var idx = Math.floor(Math.random() * list.length);
  state.doomEventText = list[idx];
  state.doomEventOpen = true;
  document.body.appendChild(renderDoomEventModal());
}

function renderDoomEventModal() {
  var existing = document.getElementById('doom-modal-root');
  if (existing) existing.remove();

  var back = document.createElement('div');
  back.className = 'doom-modal-backdrop doom-modal-lvl-' + state.doomEventLevel;
  back.id = 'doom-modal-root';
  back.onclick = function (e) {
    if (e.target === back) closeDoomModal();
  };

  var modal = document.createElement('div');
  modal.className = 'doom-modal doom-modal-stage-' + state.doomStage;

  var skull = document.createElement('div');
  skull.className = 'doom-modal-skull';
  skull.textContent = '\u{1F480}';
  modal.appendChild(skull);

  var eyebrow = document.createElement('div');
  eyebrow.className = 'doom-modal-eyebrow';
  if (state.doomEventLevel === 1) eyebrow.textContent = 'Stadio I — Presagio';
  else if (state.doomEventLevel === 2) eyebrow.textContent = 'Stadio II — Tormento';
  else eyebrow.textContent = 'Stadio III — CATASTROFE';
  modal.appendChild(eyebrow);

  var title = document.createElement('div');
  title.className = 'doom-modal-title';
  if (state.doomEventLevel === 1) title.textContent = 'Un sussurro nella notte';
  else if (state.doomEventLevel === 2) title.textContent = 'La Condanna ha parlato';
  else title.textContent = "L'INFERNO SI APRE";
  modal.appendChild(title);

  var ev = document.createElement('div');
  ev.className = 'doom-event-text';
  ev.textContent = state.doomEventText;
  modal.appendChild(ev);

  var actions = document.createElement('div');
  actions.className = 'doom-modal-actions';

  var rerollBtn = document.createElement('button');
  rerollBtn.className = 'doom-modal-btn alt';
  rerollBtn.textContent = 'Tira di nuovo';
  rerollBtn.onclick = function () {
    var list;
    if (state.doomEventLevel === 1) list = EVENTI_SOFT;
    else if (state.doomEventLevel === 2) list = EVENTI_MEDIUM;
    else list = EVENTI_CATASTROFICI;
    var idx = Math.floor(Math.random() * list.length);
    state.doomEventText = list[idx];
    ev.textContent = state.doomEventText;
  };
  actions.appendChild(rerollBtn);

  var continueBtn = document.createElement('button');
  continueBtn.className = 'doom-modal-btn';
  if (state.doomStage < 3) continueBtn.textContent = 'Subisci ed evolvi il Dado';
  else continueBtn.textContent = 'Subisci la Catastrofe';
  continueBtn.onclick = function () {
    closeDoomModal();
    if (state.doomStage < 3) {
      /* Transizione al prossimo stadio con animazione */
      runDoomTransformation();
    } else {
      /* Stadio 3 completato: azzera ma resta D20 */
      state.doomFilled = 0;
      saveToStorage();
      renderDoomWheel();
    }
  };
  actions.appendChild(continueBtn);

  var skipBtn = document.createElement('button');
  skipBtn.className = 'doom-modal-btn alt';
  skipBtn.textContent = 'Chiudi senza azzerare';
  skipBtn.onclick = closeDoomModal;
  actions.appendChild(skipBtn);

  modal.appendChild(actions);
  back.appendChild(modal);
  return back;
}

function closeDoomModal() {
  state.doomEventOpen = false;
  state.doomEventText = '';
  var m = document.getElementById('doom-modal-root');
  if (m) m.remove();
}

/* ===========================================================
   TRASFORMAZIONE EPICA DEL DADO — D6 → D8 → D20
   =========================================================== */
function runDoomTransformation() {
  if (state.doomStage >= 3) return;

  state.doomTransforming = true;
  state.doomFilled = 0;
  saveToStorage();

  /* Aggiungiamo uno scuotimento globale temporaneo + flash overlay */
  var flash = document.createElement('div');
  flash.className = 'doom-transform-flash';
  /* Se sta entrando nello stadio 3, è la trasformazione finale = più epica */
  if (state.doomStage === 2) flash.classList.add('final');
  document.body.appendChild(flash);

  /* Re-render con stato transforming = true (mostra cenere e blocca interazioni) */
  renderDoomWheel();

  /* Tempistica:
     - 0ms: inizia shake + flash overlay
     - 200ms: peak flash
     - 900ms: avanza lo stadio
     - 1400ms: termina transforming, render finale */
  setTimeout(function () {
    state.doomStage++;
    state.doomFilled = 0;
    saveToStorage();
    renderDoomWheel();
  }, 900);

  setTimeout(function () {
    state.doomTransforming = false;
    saveToStorage();
    renderDoomWheel();
    if (flash && flash.parentNode) flash.parentNode.removeChild(flash);
  }, 1700);
}
