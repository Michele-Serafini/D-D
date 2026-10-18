/**
 * ============================================================================
 * MOTORE DELLE ANIMAZIONI ED EFFETTI INTERATTIVI 3D (js/animations.js)
 * ============================================================================
 * Gestisce in modo centralizzato e ad alte prestazioni (60fps):
 * 1. Configurazione centralizzata (ANIM_CONFIG) facile da modificare
 * 2. Particelle atmosferiche su Canvas (braci di taverna, polvere runica, lucciole)
 * 3. Inclinazione 3D (Tilt) delle card e bagliore radiale che segue il cursore
 * 4. Transizioni scenografiche al cambio sezione (Araldo Runico + Pergamena 3D)
 * 5. Onda d'urto runica e scintille dorate al click su bottoni, tab e menu
 * 6. Costruttore Dadi 3D Poliedrici (Cubo 3D reale per d6 + Poliedri 3D estrusi per d4..d100)
 * 7. Contatori numerici animati e Scroll-Reveal scaglionato universale
 * 8. Easter Egg D&D ("Il Forziere Segreto / Mimic del Dungeon Master")
 * 9. Fallback automatico SVG per eventuali immagini esterne non raggiungibili
 * ============================================================================
 */
(function () {
  'use strict';

  /* ── 1. Costanti Centralizzate delle Animazioni (facili da personalizzare) ── */
  var ANIM_CONFIG = {
    enabledByDefault: true,
    particleCountDesktop: 44,
    particleCountMobile: 18,
    maxTiltDeg: 6.5,
    staggerStepMs: 38,
    maxStaggerItems: 16,
    cursorTrailEnabled: true,
    cursorSparkThrottleMs: 48,
    clickSparksCount: 6,
    storageKeyFx: 'sium_fx_enabled'
  };

  /* Metadati Araldo per l'animazione di cambio sezione */
  var SECTION_HERALDS = {
    emporio:       { icon: '⚔', title: 'Emporio del Mercante Errante' },
    bestiario:     { icon: '🐉', title: 'Bestiario & Creature del Mondo' },
    incantesimi:   { icon: '✨', title: 'Grimorio degli Incantesimi' },
    dadi:          { icon: '🎲', title: 'Arena 3D del Destino' },
    iniziativa:    { icon: '⚖', title: 'Ordine di Iniziativa & Scontri' },
    caos:          { icon: '💀', title: 'Statistiche & Ruota del Caos' },
    generatore:    { icon: '🧙', title: 'Forgia dei Personaggi (NPC)' },
    mappa:         { icon: '🗺', title: 'Atlante Cartografico Interattivo' },
    worldbuilding: { icon: '🏛', title: 'Architettura dei Regni' },
    bacheca:       { icon: '📌', title: 'Bacheca degli Avventurieri' },
    storia:        { icon: '📜', title: 'Cronache della Campagna' },
    archivio:      { icon: '🗂', title: 'Archivio Segreto del Master' },
    schedepg:      { icon: '🛡', title: 'Registro delle Schede Eroiche' },
    scheda:        { icon: '⚔', title: 'Scheda del Personaggio' },
    note:          { icon: '🖋', title: 'Diario di Sessione' },
    libri:         { icon: '📚', title: ' Grande Biblioteca Arcana' },
    tavolo:        { icon: '♟', title: 'Tavolo da Gioco Virtuale (VTT)' }
  };

  var isHeadless = !!(
    navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || '')
  );
  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouchDevice =
    'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

  var fxEnabled = ANIM_CONFIG.enabledByDefault;
  try {
    var savedFx = localStorage.getItem(ANIM_CONFIG.storageKeyFx);
    if (savedFx !== null) fxEnabled = savedFx !== 'off';
  } catch (e) {}

  if (prefersReducedMotion) fxEnabled = false;

  function applyFxState() {
    document.documentElement.setAttribute('data-fx', fxEnabled ? 'on' : 'off');
    var btn = document.getElementById('sium-fx-toggle-btn');
    if (btn) {
      btn.className = 'sium-ctrl-btn' + (fxEnabled ? ' active' : '');
      btn.setAttribute('aria-pressed', fxEnabled ? 'true' : 'false');
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6z"/></svg>' +
        '<span class="ctrl-label">FX ' + (fxEnabled ? 'ON' : 'OFF') + '</span>';
    }
    var sbFxBtn = document.getElementById('sium-sidebar-fx-btn');
    if (sbFxBtn) {
      sbFxBtn.textContent = fxEnabled ? 'Effetti Magici: ATTIVI' : 'Effetti Magici: RIDOTTI';
    }
  }

  function toggleFx() {
    fxEnabled = !fxEnabled;
    try {
      localStorage.setItem(ANIM_CONFIG.storageKeyFx, fxEnabled ? 'on' : 'off');
    } catch (e) {}
    applyFxState();
    if (fxEnabled) {
      startParticles();
    } else {
      stopParticles();
    }
    if (typeof window.notify === 'function') {
      window.notify(
        fxEnabled
          ? 'Effetti magici e particelle attivati'
          : 'Effetti pesanti disattivati (modalità leggera)'
      );
    }
  }

  /* ── 2. Loader Scenografico Iniziale ── */
  function initLoader() {
    var loader = document.getElementById('sium-arcane-loader');
    if (!loader) return;
    var delay = isHeadless ? 40 : 480;
    setTimeout(function () {
      loader.classList.add('hidden');
      setTimeout(function () {
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
      }, 700);
    }, delay);
  }

  /* ── 3. Atmosfera di Sfondo: Canvas Particelle (Braci, Polvere d'Oro, Lucciole) ── */
  var canvas = null;
  var ctx = null;
  var particles = [];
  var rafId = null;

  function createParticle(w, h) {
    var isEmber = Math.random() > 0.45;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: isEmber ? Math.random() * 2.2 + 0.8 : Math.random() * 1.6 + 0.5,
      vx: (Math.random() - 0.5) * 0.34,
      vy: -(Math.random() * 0.5 + 0.16),
      alpha: Math.random() * 0.65 + 0.15,
      phase: Math.random() * Math.PI * 2,
      color: isEmber ? '235, 165, 68' : '245, 222, 155'
    };
  }

  function setupAtmosphereLayers() {
    if (!document.getElementById('sium-particles-canvas')) {
      canvas = document.createElement('canvas');
      canvas.id = 'sium-particles-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
    }
    if (!document.querySelector('.sium-torch-vignette')) {
      var vig = document.createElement('div');
      vig.className = 'sium-torch-vignette';
      vig.setAttribute('aria-hidden', 'true');
      document.body.appendChild(vig);
    }
    if (!document.querySelector('.sium-mist-layer')) {
      var mist = document.createElement('div');
      mist.className = 'sium-mist-layer';
      mist.setAttribute('aria-hidden', 'true');
      document.body.appendChild(mist);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth || 1280;
    canvas.height = window.innerHeight || 800;
    var count =
      window.innerWidth < 768
        ? ANIM_CONFIG.particleCountMobile
        : ANIM_CONFIG.particleCountDesktop;
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push(createParticle(canvas.width, canvas.height));
    }
  }

  function drawParticlesFrame() {
    if (!ctx || !canvas) return;
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx + Math.sin(p.phase) * 0.12;
      p.y += p.vy;
      p.phase += 0.02;
      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      var flicker = 0.65 + 0.35 * Math.sin(p.phase * 1.7);
      var a = p.alpha * flicker * (isLight ? 0.55 : 0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = isLight
        ? 'rgba(140, 93, 25, ' + a.toFixed(3) + ')'
        : 'rgba(' + p.color + ', ' + a.toFixed(3) + ')';
      ctx.fill();
    }
  }

  function loopParticles() {
    if (!fxEnabled || document.hidden) {
      rafId = null;
      return;
    }
    drawParticlesFrame();
    if (!isHeadless) {
      rafId = window.requestAnimationFrame(loopParticles);
    }
  }

  function startParticles() {
    if (!fxEnabled) return;
    if (!canvas) setupAtmosphereLayers();
    if (isHeadless) {
      drawParticlesFrame();
      return;
    }
    if (!rafId) rafId = window.requestAnimationFrame(loopParticles);
  }

  function stopParticles() {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopParticles();
    else if (fxEnabled) startParticles();
  });

  /* ── 4. Inclinazione 3D (Tilt) & Spotlight Runico sulle Card ── */
  var CARD_SELECTOR =
    '.weapon-card, .best-card, .pet-card, .libro-card, .scena-card, .cyber-card, .droga-card, .veicolo-card, .bacheca-card, .panel-glass, .dice-panel';
  var activeTiltCard = null;

  function initCardTilt() {
    if (isTouchDevice) return;
    document.addEventListener(
      'mousemove',
      function (e) {
        if (!fxEnabled) return;
        var card = e.target && e.target.closest ? e.target.closest(CARD_SELECTOR) : null;
        // Evita tilt sul dice-panel intero se stiamo sopra l'arena 3D
        if (card && card.classList.contains('dice-panel')) card = null;
        if (activeTiltCard && activeTiltCard !== card) {
          activeTiltCard.style.transform = '';
          activeTiltCard = null;
        }
        if (!card) return;
        activeTiltCard = card;
        var rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var px = (x / rect.width) * 100;
        var py = (y / rect.height) * 100;
        var ry = ((x / rect.width - 0.5) * 2 * ANIM_CONFIG.maxTiltDeg).toFixed(2);
        var rx = ((0.5 - y / rect.height) * 2 * ANIM_CONFIG.maxTiltDeg).toFixed(2);
        card.style.setProperty('--mouse-x', px.toFixed(1) + '%');
        card.style.setProperty('--mouse-y', py.toFixed(1) + '%');
        card.style.transform =
          'perspective(850px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-3px)';
      },
      { passive: true }
    );

    document.addEventListener(
      'mouseout',
      function (e) {
        if (activeTiltCard && (!e.relatedTarget || !activeTiltCard.contains(e.relatedTarget))) {
          activeTiltCard.style.transform = '';
          activeTiltCard = null;
        }
      },
      { passive: true }
    );
  }

  /* ── 5. Scia Magica del Cursore & Onda Runica / Scintille al Click ── */
  var lastSparkTime = 0;
  function initCursorTrail() {
    if (isTouchDevice || isHeadless || !ANIM_CONFIG.cursorTrailEnabled) return;
    document.addEventListener(
      'mousemove',
      function (e) {
        if (!fxEnabled) return;
        var now = Date.now();
        if (now - lastSparkTime < ANIM_CONFIG.cursorSparkThrottleMs) return;
        lastSparkTime = now;
        var spark = document.createElement('div');
        spark.className = 'sium-cursor-spark';
        spark.style.left = e.clientX + 'px';
        spark.style.top = e.clientY + 'px';
        document.body.appendChild(spark);
        setTimeout(function () {
          if (spark.parentNode) spark.parentNode.removeChild(spark);
        }, 650);
      },
      { passive: true }
    );
  }

  function spawnClickBurst(x, y) {
    if (!fxEnabled || isHeadless) return;
    var ripple = document.createElement('div');
    ripple.className = 'sium-click-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    document.body.appendChild(ripple);
    setTimeout(function () {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 540);

    for (var i = 0; i < ANIM_CONFIG.clickSparksCount; i++) {
      var ember = document.createElement('div');
      ember.className = 'sium-click-ember';
      ember.style.left = x + 'px';
      ember.style.top = y + 'px';
      var angle = (Math.PI * 2 * i) / ANIM_CONFIG.clickSparksCount + (Math.random() - 0.5) * 0.5;
      var dist = 18 + Math.random() * 24;
      ember.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
      ember.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
      document.body.appendChild(ember);
      (function (el) {
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 600);
      })(ember);
    }
  }

  function initClickInteractions() {
    document.addEventListener(
      'click',
      function (e) {
        if (!fxEnabled) return;
        var target = e.target;
        if (!target || !target.closest) return;
        var interactive = target.closest(
          'button, .nav-item, .weapon-card, .best-card, .pet-card, .libro-card, .scena-card, .dice-type-btn, .sium-3d-dice-arena'
        );
        if (interactive && e.clientX && e.clientY) {
          spawnClickBurst(e.clientX, e.clientY);
        }
      },
      { passive: true }
    );
  }

  /* ── 6. Araldo Runico al Cambio di Sezione ── */
  function showSectionHerald(sectionId) {
    if (!fxEnabled || isHeadless) return;
    var info = SECTION_HERALDS[sectionId];
    if (!info) return;

    var old = document.getElementById('sium-active-herald');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var herald = document.createElement('div');
    herald.id = 'sium-active-herald';
    herald.className = 'sium-section-herald';
    herald.setAttribute('aria-hidden', 'true');
    herald.innerHTML =
      '<span class="herald-wing"></span>' +
      '<span class="herald-icon">' + info.icon + '</span>' +
      '<span class="herald-text">' + info.title + '</span>' +
      '<span class="herald-wing"></span>';

    document.body.appendChild(herald);
    setTimeout(function () {
      if (herald.parentNode) herald.parentNode.removeChild(herald);
    }, 800);
  }

  /* ── 7. Scroll-Reveal Scaglionato Universale & Ornamenti Sezioni ── */
  var revealObserver = null;

  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('sium-reveal');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -15px 0px' }
    );
  }

  function applyImgFallbackIfNeeded(img) {
    if (!img || img.dataset.siumFallbackApplied) return;
    var label =
      img.getAttribute('alt') ||
      (img.closest && img.closest('.weapon-card, .best-card')
        ? img.closest('.weapon-card, .best-card').textContent.trim().slice(0, 26)
        : 'Compendium D&D');
    if (typeof window.DATABASE_ARMI_FILE !== 'undefined' && Array.isArray(window.DATABASE_ARMI_FILE)) {
      var altLower = (img.getAttribute('alt') || '').trim().toLowerCase();
      for (var i = 0; i < window.DATABASE_ARMI_FILE.length; i++) {
        var entry = window.DATABASE_ARMI_FILE[i];
        if (
          entry &&
          entry.nome &&
          entry.nome.trim().toLowerCase() === altLower &&
          entry.immagine &&
          entry.immagine.indexOf('img/') === 0 &&
          img.getAttribute('src') !== entry.immagine
        ) {
          img.dataset.siumFallbackApplied = 'local';
          img.src = entry.immagine;
          return;
        }
      }
    }
    img.dataset.siumFallbackApplied = '1';
    img.src = buildSvgFallbackDataUri(label);
  }

  function decorateAndObserveDOM(sectionChanged) {
    var main = document.querySelector('.main-content');
    if (!main) return;

    if (sectionChanged && fxEnabled) {
      main.classList.remove('sium-section-transition');
      void main.offsetWidth;
      main.classList.add('sium-section-transition');
      if (window.state && window.state.section) {
        showSectionHerald(window.state.section);
      }
    }

    // Controlla immagini fallite
    var imgs = main.querySelectorAll('img');
    imgs.forEach(function (img) {
      if (!img.dataset.siumErrBound) {
        img.dataset.siumErrBound = '1';
        img.addEventListener('error', function () {
          applyImgFallbackIfNeeded(img);
        });
      }
      if (img.complete && img.naturalWidth === 0) {
        applyImgFallbackIfNeeded(img);
      }
    });

    // Decora titoli principali con rivelazione inchiostro
    var headers = main.querySelectorAll('header h1, header .header-title');
    headers.forEach(function (h1) {
      if (!h1.dataset.siumDecorated) {
        h1.dataset.siumDecorated = '1';
        h1.classList.add('sium-title-reveal');
      }
    });

    // Selettore esteso per animare non solo le card ma anche gli elementi di tutte le 15 sezioni
    var universalTargets = main.querySelectorAll(
      CARD_SELECTOR +
        ', .dice-type-btn, .dice-history-item, .container-main > div > div, .main-content table tbody tr'
    );
    universalTargets.forEach(function (el, idx) {
      if (el.dataset.siumObserved) return;
      // Non applicare reveal a wrapper che contengono la mappa Leaflet per non alterarne il resize
      if (el.querySelector && el.querySelector('.leaflet-container')) return;
      el.dataset.siumObserved = '1';
      var delay = Math.min(idx, ANIM_CONFIG.maxStaggerItems) * ANIM_CONFIG.staggerStepMs;
      el.style.setProperty('--stagger-delay', delay + 'ms');
      if (revealObserver && fxEnabled && !isHeadless) {
        revealObserver.observe(el);
      } else {
        el.classList.add('sium-reveal');
      }
    });

    // Aggiungi controllo FX nel footer della sidebar se presente
    var sbFooter = document.querySelector('.sidebar-footer');
    if (sbFooter && !document.getElementById('sium-sidebar-fx-btn')) {
      var fxBtn = document.createElement('button');
      fxBtn.id = 'sium-sidebar-fx-btn';
      fxBtn.type = 'button';
      fxBtn.style.cssText =
        'width:100%;margin-top:0.45rem;background:rgba(216,178,92,0.08);border:1px solid var(--border-subtle);color:var(--gold);font-family:var(--font-display);font-size:9.5px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;padding:0.42rem 0.6rem;cursor:pointer;border-radius:4px;';
      fxBtn.textContent = fxEnabled
        ? 'Effetti Magici: ATTIVI'
        : 'Effetti Magici: RIDOTTI';
      fxBtn.onclick = toggleFx;
      sbFooter.insertBefore(fxBtn, sbFooter.firstChild);
    }

    // Aggancia Easter Egg sulla runa del brand nella sidebar (3 click rapidi)
    var brand = document.querySelector('.sidebar-brand');
    if (brand && !brand.dataset.siumEasterEgg) {
      brand.dataset.siumEasterEgg = '1';
      brand.title = 'Triplo click per tentare la sorte del Dungeon Master...';
      var clicks = 0;
      var clickTimer = null;
      brand.addEventListener('click', function () {
        clicks++;
        if (clickTimer) clearTimeout(clickTimer);
        if (clicks >= 3) {
          clicks = 0;
          openEasterEggModal();
        } else {
          clickTimer = setTimeout(function () {
            clicks = 0;
          }, 900);
        }
      });
    }

    ensureTopControlsBar();
  }

  /* ── 8. Barra Superiore Rapida (Tema, FX, D20 3D, Scarica ZIP) ── */
  function ensureTopControlsBar() {
    var bar = document.getElementById('sium-top-controls');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'sium-top-controls';
      bar.className = 'sium-top-controls';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'Controlli rapidi Compendium');
      document.body.appendChild(bar);
    }
    var isDark =
      (window.state && window.state.theme === 'dark') ||
      document.documentElement.getAttribute('data-theme') !== 'light';

    bar.innerHTML = '';

    // 1) Pulsante Lancio Rapido D20 3D
    var d20Btn = document.createElement('button');
    d20Btn.type = 'button';
    d20Btn.className = 'sium-ctrl-btn';
    d20Btn.setAttribute('aria-label', 'Lancia Dado D20 3D');
    d20Btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><polygon points="12 2 21 7.5 21 16.5 12 22 3 16.5 3 7.5"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="3" y1="7.5" x2="21" y2="7.5"/><line x1="3" y1="16.5" x2="21" y2="16.5"/></svg>' +
      '<span class="ctrl-label">D20 3D</span>';
    d20Btn.onclick = openQuickD20Modal;
    bar.appendChild(d20Btn);

    // 2) Pulsante Toggle Tema (Taverna Scuro / Pergamena Chiaro)
    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'sium-ctrl-btn';
    themeBtn.setAttribute(
      'aria-label',
      isDark ? 'Passa al tema Pergamena (Chiaro)' : 'Passa al tema Taverna (Scuro)'
    );
    themeBtn.innerHTML = isDark
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg><span class="ctrl-label">Pergamena</span>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span class="ctrl-label">Taverna</span>';
    themeBtn.onclick = function () {
      if (window.state) {
        window.state.theme = window.state.theme === 'dark' ? 'light' : 'dark';
        if (typeof window.saveToStorage === 'function') window.saveToStorage();
        if (typeof window.render === 'function') window.render();
      } else {
        var cur = document.documentElement.getAttribute('data-theme');
        document.documentElement.setAttribute(
          'data-theme',
          cur === 'light' ? 'dark' : 'light'
        );
      }
      ensureTopControlsBar();
    };
    bar.appendChild(themeBtn);

    // 3) Pulsante Toggle Effetti Magici (FX ON/OFF)
    var fxBtn = document.createElement('button');
    fxBtn.id = 'sium-fx-toggle-btn';
    fxBtn.type = 'button';
    fxBtn.className = 'sium-ctrl-btn' + (fxEnabled ? ' active' : '');
    fxBtn.setAttribute('aria-label', 'Attiva o disattiva effetti pesanti e particelle');
    fxBtn.setAttribute('aria-pressed', fxEnabled ? 'true' : 'false');
    fxBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6z"/></svg>' +
      '<span class="ctrl-label">FX ' + (fxEnabled ? 'ON' : 'OFF') + '</span>';
    fxBtn.onclick = toggleFx;
    bar.appendChild(fxBtn);

    // 4) Link Scarica ZIP Progetto Completo
    var zipLink = document.createElement('a');
    zipLink.href = 'mercante-errante-redesign.zip';
    zipLink.download = 'mercante-errante-redesign.zip';
    zipLink.className = 'sium-ctrl-btn';
    zipLink.style.textDecoration = 'none';
    zipLink.setAttribute('aria-label', 'Scarica archivio ZIP del progetto');
    zipLink.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
      '<span class="ctrl-label">ZIP</span>';
    bar.appendChild(zipLink);
  }

  /* ── 9. Costruttore Dadi 3D Poliedrici (Usato nella sezione Lancio Dadi e nel Modale D20) ── */
  var DICE_PALETTES = {
    4:   { bg1: '#3b156e', bg2: '#180730', stroke: '#b388ff', text: '#ede7f6' },
    6:   { bg1: '#16427d', bg2: '#081b36', stroke: '#64b5f6', text: '#e3f2fd' },
    8:   { bg1: '#0b4f32', bg2: '#042215', stroke: '#4db6ac', text: '#e0f2f1' },
    10:  { bg1: '#6e2c07', bg2: '#2b1002', stroke: '#ffb74d', text: '#fff3e0' },
    12:  { bg1: '#123873', bg2: '#06152d', stroke: '#82b1ff', text: '#e8eaf6' },
    20:  { bg1: '#631010', bg2: '#240404', stroke: '#f5d98e', text: '#fef08a' },
    100: { bg1: '#282466', bg2: '#0f0d29', stroke: '#9fa8da', text: '#e8eaf6' }
  };

  var DICE_OUTER_POINTS = {
    4:  '60,10 110,98 10,98',
    8:  '60,6 112,60 60,114 8,60',
    10: '60,6 108,38 90,104 30,104 12,38',
    12: '60,6 110,42 91,104 29,104 10,42',
    20: '60,6 108,33 108,87 60,114 12,87 12,33'
  };

  var DICE_INNER_POINTS = {
    4:  '60,30 90,84 30,84',
    8:  '60,24 92,60 60,96 28,60',
    10: '60,24 90,48 78,88 42,88 30,48',
    12: '60,24 91,50 77,88 43,88 29,50',
    20: '60,24 91,78 29,78'
  };

  function buildPolyhedronFaceSvg(faces, labelVal, isCrit, isFail, isBackLayer) {
    var pal = isCrit
      ? { bg1: '#92400e', bg2: '#451a03', stroke: '#fde047', text: '#fef9c3' }
      : isFail
      ? { bg1: '#7f1d1d', bg2: '#2a0404', stroke: '#f87171', text: '#fecaca' }
      : (DICE_PALETTES[faces] || DICE_PALETTES[20]);

    var uid = 'd3d_' + faces + '_' + Math.floor(Math.random() * 999999);
    var outerPts = DICE_OUTER_POINTS[faces] || DICE_OUTER_POINTS[20];
    var innerPts = DICE_INNER_POINTS[faces] || DICE_INNER_POINTS[20];
    var valStr = labelVal !== null && labelVal !== undefined ? String(labelVal) : '?';
    var fontSize = valStr.length > 2 ? 21 : valStr.length > 1 ? 26 : 30;
    var textY = faces === 4 ? 76 : 67;

    var shapeMarkup = '';
    if (faces === 100) {
      shapeMarkup =
        '<circle cx="60" cy="60" r="52" fill="url(#' + uid + ')" stroke="' + pal.stroke + '" stroke-width="2.6"/>' +
        '<circle cx="60" cy="60" r="39" fill="none" stroke="' + pal.stroke + '" stroke-width="1.4" stroke-dasharray="5 3" opacity="0.7"/>';
    } else {
      shapeMarkup =
        '<polygon points="' + outerPts + '" fill="url(#' + uid + ')" stroke="' + pal.stroke + '" stroke-width="2.6" stroke-linejoin="round"/>' +
        '<polygon points="' + innerPts + '" fill="rgba(255,255,255,0.05)" stroke="' + pal.stroke + '" stroke-width="1.5" stroke-linejoin="round" opacity="0.8"/>';
    }

    // Costole di sfaccettatura per D20 / D12 / D8
    var facetsMarkup = '';
    if (faces === 20) {
      facetsMarkup =
        '<line x1="60" y1="6" x2="60" y2="24" stroke="' + pal.stroke + '" stroke-width="1.3" opacity="0.75"/>' +
        '<line x1="108" y1="33" x2="60" y2="24" stroke="' + pal.stroke + '" stroke-width="1.3" opacity="0.75"/>' +
        '<line x1="12" y1="33" x2="60" y2="24" stroke="' + pal.stroke + '" stroke-width="1.3" opacity="0.75"/>' +
        '<line x1="108" y1="33" x2="91" y2="78" stroke="' + pal.stroke + '" stroke-width="1.3" opacity="0.75"/>' +
        '<line x1="12" y1="33" x2="29" y2="78" stroke="' + pal.stroke + '" stroke-width="1.3" opacity="0.75"/>' +
        '<line x1="108" y1="87" x2="91" y2="78" stroke="' + pal.stroke + '" stroke-width="1.3" opacity="0.75"/>' +
        '<line x1="12" y1="87" x2="29" y2="78" stroke="' + pal.stroke + '" stroke-width="1.3" opacity="0.75"/>' +
        '<line x1="60" y1="114" x2="91" y2="78" stroke="' + pal.stroke + '" stroke-width="1.3" opacity="0.75"/>' +
        '<line x1="60" y1="114" x2="29" y2="78" stroke="' + pal.stroke + '" stroke-width="1.3" opacity="0.75"/>';
    } else if (faces === 8) {
      facetsMarkup =
        '<line x1="60" y1="6" x2="60" y2="114" stroke="' + pal.stroke + '" stroke-width="1.4" opacity="0.65"/>' +
        '<line x1="8" y1="60" x2="112" y2="60" stroke="' + pal.stroke + '" stroke-width="1.4" opacity="0.65"/>';
    }

    var textMarkup = isBackLayer
      ? '<text x="60" y="67" text-anchor="middle" font-family="Cinzel, serif" font-weight="700" font-size="22" fill="' + pal.stroke + '" opacity="0.55">⚜</text>'
      : '<text x="60" y="' + textY + '" text-anchor="middle" font-family="Cinzel, serif" font-weight="900" font-size="' + fontSize + '" fill="' + pal.text + '">' + valStr + '</text>';

    return (
      '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible;">' +
        '<defs>' +
          '<linearGradient id="' + uid + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="' + pal.bg1 + '"/>' +
            '<stop offset="100%" stop-color="' + pal.bg2 + '"/>' +
          '</linearGradient>' +
        '</defs>' +
        shapeMarkup +
        facetsMarkup +
        textMarkup +
      '</svg>'
    );
  }

  /**
   * Costruisce un elemento DOM `.sium-die-3d-slot` con vero volume 3D (`preserve-3d`).
   * - Se faces === 6: costruisce un vero cubo 3D a 6 facce (`translateZ(38px)`).
   * - Altrimenti: costruisce un poliedro 3D multistrato con piani anteriore, posteriore e costole 3D.
   */
  function build3DDieElement(faces, value, rolling, isCrit, isFail) {
    var slot = document.createElement('div');
    var stClass = rolling ? 'rolling' : ('landed' + (isCrit ? ' crit' : isFail ? ' fumble' : ''));
    slot.className = 'sium-die-3d-slot ' + stClass;

    var shadow = document.createElement('div');
    shadow.className = 'sium-die-3d-shadow';
    slot.appendChild(shadow);

    var wave = document.createElement('div');
    wave.className = 'sium-die-shockwave';
    slot.appendChild(wave);

    var rig = document.createElement('div');
    rig.className = 'sium-die-3d-rig';

    var dispVal = rolling ? '🎲' : (value !== null && value !== undefined ? value : faces);

    if (faces === 6) {
      var cube = document.createElement('div');
      cube.className = 'sium-cube-3d';
      var opps = [dispVal, 7 - (Number(value) || 1), 2, 5, 3, 4];
      var fNames = ['face-front', 'face-back', 'face-right', 'face-left', 'face-top', 'face-bottom'];
      for (var fi = 0; fi < 6; fi++) {
        var face = document.createElement('div');
        face.className = 'sium-cube-face ' + fNames[fi];
        face.textContent = fi === 0 ? dispVal : opps[fi];
        cube.appendChild(face);
      }
      rig.appendChild(cube);
    } else {
      var front = document.createElement('div');
      front.className = 'sium-poly-layer sium-poly-front';
      front.innerHTML = buildPolyhedronFaceSvg(faces, dispVal, isCrit, isFail, false);

      var mid = document.createElement('div');
      mid.className = 'sium-poly-layer sium-poly-mid';
      mid.innerHTML = buildPolyhedronFaceSvg(faces, '', isCrit, isFail, true);

      var back = document.createElement('div');
      back.className = 'sium-poly-layer sium-poly-back';
      back.innerHTML = buildPolyhedronFaceSvg(faces, faces, isCrit, isFail, true);

      var ribX = document.createElement('div');
      ribX.className = 'sium-poly-layer sium-poly-rib-x';
      ribX.innerHTML = buildPolyhedronFaceSvg(faces, '', isCrit, isFail, true);

      var ribY = document.createElement('div');
      ribY.className = 'sium-poly-layer sium-poly-rib-y';
      ribY.innerHTML = buildPolyhedronFaceSvg(faces, '', isCrit, isFail, true);

      rig.appendChild(back);
      rig.appendChild(ribX);
      rig.appendChild(ribY);
      rig.appendChild(mid);
      rig.appendChild(front);
    }

    slot.appendChild(rig);
    return slot;
  }

  /* ── 10. Modale Lanciatore D20 3D Rapido ── */
  function openQuickD20Modal() {
    var existing = document.getElementById('sium-d20-overlay');
    if (existing) existing.remove();

    var mod = 0;
    var mode = 'normale';

    var ov = document.createElement('div');
    ov.id = 'sium-d20-overlay';
    ov.className = 'sium-d20-overlay';
    ov.onclick = function (e) {
      if (e.target === ov) ov.remove();
    };

    var box = document.createElement('div');
    box.className = 'sium-d20-modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Lanciatore Dado D20 3D');

    box.innerHTML =
      '<div style="font-family:var(--font-display);font-size:15px;font-weight:700;letter-spacing:0.15em;color:var(--gold-bright);text-transform:uppercase;">Dado del Destino — D20 3D</div>' +
      '<div class="ornate-divider">— ⚜ —</div>' +
      '<div id="sium-d20-stage" class="sium-d20-stage" title="Clicca sul dado 3D per lanciare"></div>' +
      '<div id="sium-d20-result-lbl" style="min-height:2.4rem;font-family:var(--font-display);font-size:13px;color:var(--text-secondary);margin-bottom:0.85rem;">Clicca sul D20 3D o premi "Lancia D20"</div>' +
      '<div style="display:flex;justify-content:center;gap:0.4rem;margin-bottom:0.85rem;">' +
      '<button type="button" data-mode="svantaggio" class="sium-ctrl-btn">Svantaggio</button>' +
      '<button type="button" data-mode="normale" class="sium-ctrl-btn active">Normale</button>' +
      '<button type="button" data-mode="vantaggio" class="sium-ctrl-btn">Vantaggio</button>' +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:0.6rem;margin-bottom:1.1rem;">' +
      '<span style="font-family:var(--font-display);font-size:11px;color:var(--text-muted);text-transform:uppercase;">Modificatore:</span>' +
      '<button type="button" id="sium-mod-minus" class="sium-ctrl-btn" style="padding:0.25rem 0.55rem;">−</button>' +
      '<span id="sium-mod-val" class="combat-num" style="font-family:var(--font-mono);font-size:14px;font-weight:700;color:var(--gold-bright);min-width:2.2rem;">+0</span>' +
      '<button type="button" id="sium-mod-plus" class="sium-ctrl-btn" style="padding:0.25rem 0.55rem;">+</button>' +
      '</div>' +
      '<div style="display:flex;justify-content:center;gap:0.6rem;">' +
      '<button type="button" id="sium-roll-trigger" class="btn-primary" style="padding:0.55rem 1.35rem;cursor:pointer;">🎲 Lancia D20</button>' +
      '<button type="button" id="sium-d20-close" class="btn-secondary" style="padding:0.55rem 1rem;cursor:pointer;">Chiudi</button>' +
      '</div>';

    ov.appendChild(box);
    document.body.appendChild(ov);

    var stage = box.querySelector('#sium-d20-stage');
    var resLbl = box.querySelector('#sium-d20-result-lbl');
    var modVal = box.querySelector('#sium-mod-val');

    stage.appendChild(build3DDieElement(20, 20, false, false, false));

    box.querySelectorAll('[data-mode]').forEach(function (b) {
      b.onclick = function () {
        mode = b.getAttribute('data-mode');
        box.querySelectorAll('[data-mode]').forEach(function (x) {
          x.classList.toggle('active', x === b);
        });
      };
    });

    box.querySelector('#sium-mod-minus').onclick = function () {
      mod = Math.max(-10, mod - 1);
      modVal.textContent = (mod >= 0 ? '+' : '') + mod;
    };
    box.querySelector('#sium-mod-plus').onclick = function () {
      mod = Math.min(20, mod + 1);
      modVal.textContent = (mod >= 0 ? '+' : '') + mod;
    };
    box.querySelector('#sium-d20-close').onclick = function () {
      ov.remove();
    };

    function triggerRoll() {
      if (typeof window._synthDiceRoll === 'function') {
        try {
          window._synthDiceRoll();
        } catch (e) {}
      }
      stage.innerHTML = '';
      stage.appendChild(build3DDieElement(20, null, true, false, false));

      var r1 = Math.floor(Math.random() * 20) + 1;
      var r2 = Math.floor(Math.random() * 20) + 1;
      var nat =
        mode === 'vantaggio'
          ? Math.max(r1, r2)
          : mode === 'svantaggio'
          ? Math.min(r1, r2)
          : r1;
      var total = nat + mod;

      setTimeout(function () {
        var isCrit = nat === 20;
        var isFail = nat === 1;
        stage.innerHTML = '';
        stage.appendChild(build3DDieElement(20, nat, false, isCrit, isFail));

        var detail =
          mode !== 'normale' ? ' [' + r1 + ', ' + r2 + ' → ' + nat + ']' : ' [Nat ' + nat + ']';
        if (mod !== 0) detail += (mod > 0 ? ' + ' + mod : ' − ' + Math.abs(mod));

        if (isCrit) {
          resLbl.innerHTML =
            '<span style="color:#fde047;font-weight:700;">CRITICO NATURALE! Totale: ' +
            total +
            '</span> <span style="font-size:11px;opacity:0.8;">' +
            detail +
            '</span>';
        } else if (isFail) {
          resLbl.innerHTML =
            '<span style="color:#f87171;font-weight:700;">FALLIMENTO CRITICO! Totale: ' +
            total +
            '</span> <span style="font-size:11px;opacity:0.8;">' +
            detail +
            '</span>';
        } else {
          resLbl.innerHTML =
            'Risultato Totale: <strong style="color:var(--gold-bright);font-size:16px;">' +
            total +
            '</strong> <span style="font-size:11px;opacity:0.8;">' +
            detail +
            '</span>';
        }
      }, isHeadless ? 40 : 760);
    }

    stage.onclick = triggerRoll;
    box.querySelector('#sium-roll-trigger').onclick = triggerRoll;
  }

  /* ── 11. Easter Egg a Tema D&D ("Il Forziere Segreto / Mimic") ── */
  function openEasterEggModal() {
    var existing = document.getElementById('sium-easter-egg-overlay');
    if (existing) existing.remove();

    var isMimic = Math.random() < 0.35;
    var pool =
      typeof window.SRD_OGGETTI !== 'undefined' && window.SRD_OGGETTI.length
        ? window.SRD_OGGETTI.filter(function (i) {
            return (
              i.rarita === 'Leggendario' ||
              i.rarita === 'Molto raro' ||
              i.rarita === 'Arma divina' ||
              i.rarita === 'Arma unica'
            );
          })
        : [];
    var loot =
      pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : {
            nome: 'Spada Vorpal del Crepuscolo',
            rarita: 'Leggendario',
            descrizione: 'Una lama leggendaria trovata nel forziere segreto della locanda.'
          };

    var ov = document.createElement('div');
    ov.id = 'sium-easter-egg-overlay';
    ov.className = 'sium-d20-overlay';
    ov.onclick = function (e) {
      if (e.target === ov) ov.remove();
    };

    var box = document.createElement('div');
    box.className = 'sium-d20-modal';
    box.innerHTML = isMimic
      ? '<div style="font-size:2.6rem;margin-bottom:0.4rem;">👾</div>' +
        '<div style="font-family:var(--font-display);font-size:15px;font-weight:700;letter-spacing:0.14em;color:#f87171;text-transform:uppercase;">È UN MIMIC!</div>' +
        '<div class="ornate-divider">— ☠ —</div>' +
        '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:1.1rem;">Il forziere sotto il bancone del Mercante Errante spalanca le fauci! Tira Iniziativa con un D20 per sfuggire alla sua presa appiccicosa.</p>' +
        '<div style="display:flex;justify-content:center;gap:0.6rem;">' +
        '<button type="button" id="sium-ee-roll" class="btn-primary" style="padding:0.5rem 1.2rem;cursor:pointer;">⚔ Tira Iniziativa</button>' +
        '<button type="button" id="sium-ee-close" class="btn-secondary" style="padding:0.5rem 1rem;cursor:pointer;">Chiudi</button>' +
        '</div>'
      : '<div style="font-size:2.6rem;margin-bottom:0.4rem;">✨</div>' +
        '<div style="font-family:var(--font-display);font-size:15px;font-weight:700;letter-spacing:0.14em;color:var(--gold-bright);text-transform:uppercase;">Forziere Segreto del Mercante</div>' +
        '<div class="ornate-divider">— ⚜ —</div>' +
        '<p style="font-size:12px;color:var(--text-muted);margin-bottom:0.4rem;">Hai scoperto il tesoro nascosto! Il Mercante ti mostra una reliquia (' +
        (loot.rarita || 'Leggendario') +
        '):</p>' +
        '<div style="padding:0.85rem;background:rgba(216,178,92,0.1);border:1px solid var(--border-gold);border-radius:8px;margin-bottom:1rem;">' +
        '<div style="font-family:var(--font-display);font-weight:700;color:var(--gold-bright);font-size:14px;">' +
        loot.nome +
        '</div>' +
        '<div style="font-size:12px;color:var(--text-secondary);margin-top:0.35rem;max-height:90px;overflow:auto;">' +
        (loot.descrizione || '').slice(0, 220) +
        '</div>' +
        '</div>' +
        '<button type="button" id="sium-ee-close" class="btn-primary" style="padding:0.5rem 1.4rem;cursor:pointer;">Custodisci Reliquia</button>';

    ov.appendChild(box);
    document.body.appendChild(ov);

    var closeBtn = box.querySelector('#sium-ee-close');
    if (closeBtn)
      closeBtn.onclick = function () {
        ov.remove();
      };
    var rollBtn = box.querySelector('#sium-ee-roll');
    if (rollBtn)
      rollBtn.onclick = function () {
        ov.remove();
        openQuickD20Modal();
      };
  }

  /* ── 12. Zero-Broken-Image Policy: Fallback SVG Stemma Fantasy ── */
  function buildSvgFallbackDataUri(title) {
    var clean = String(title || 'Reliquia Arcana')
      .replace(/[<>&"']/g, '')
      .slice(0, 28);
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280">' +
      '<defs>' +
      '<radialGradient id="g" cx="50%" cy="45%" r="65%">' +
      '<stop offset="0%" stop-color="#2a1f16"/>' +
      '<stop offset="100%" stop-color="#0e0a07"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<rect width="400" height="280" fill="url(#g)"/>' +
      '<rect x="14" y="14" width="372" height="252" rx="8" fill="none" stroke="#c9a55c" stroke-opacity="0.35" stroke-width="1.5"/>' +
      '<polygon points="200,52 242,76 242,124 200,148 158,124 158,76" fill="rgba(216,178,92,0.08)" stroke="#d8b25c" stroke-width="1.8"/>' +
      '<text x="200" y="108" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-size="26" fill="#f3d586">⚜</text>' +
      '<text x="200" y="198" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-size="14" font-weight="bold" fill="#e8d5b5">' +
      clean +
      '</text>' +
      '<text x="200" y="220" text-anchor="middle" font-family="Georgia,serif" font-size="10" fill="#9c8462" letter-spacing="2">ARCHIVIO DEL MERCANTE</text>' +
      '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  window.addEventListener(
    'error',
    function (e) {
      var el = e.target;
      if (el && el.tagName === 'IMG' && !el.dataset.siumFallbackApplied) {
        el.dataset.siumFallbackApplied = '1';
        var label =
          el.getAttribute('alt') ||
          (el.closest && el.closest('.weapon-card, .best-card')
            ? el.closest('.weapon-card, .best-card').textContent.trim().slice(0, 26)
            : 'Compendium D&D');
        el.src = buildSvgFallbackDataUri(label);
      }
    },
    true
  );

  /* ── 13. Inizializzazione e API Pubblica ── */
  function init() {
    applyFxState();
    initLoader();
    initScrollReveal();
    initCardTilt();
    initCursorTrail();
    initClickInteractions();
    if (fxEnabled) startParticles();
    ensureTopControlsBar();

    var obs = new MutationObserver(function () {
      decorateAndObserveDOM(false);
    });
    var appEl = document.getElementById('app');
    if (appEl) {
      obs.observe(appEl, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SiumAnimations = {
    config: ANIM_CONFIG,
    onRender: function (sectionChanged) {
      decorateAndObserveDOM(sectionChanged);
    },
    showSectionHerald: showSectionHerald,
    build3DDieElement: build3DDieElement,
    toggleFx: toggleFx,
    openQuickD20Modal: openQuickD20Modal,
    openEasterEggModal: openEasterEggModal
  };
})();
