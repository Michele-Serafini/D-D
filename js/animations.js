/**
 * ============================================================================
 * MOTORE DELLE ANIMAZIONI ED EFFETTI INTERATTIVI 3D / 4D (js/animations.js)
 * ============================================================================
 * Gestisce in modo centralizzato e modulare:
 *   1. Preferenze Utente (Tema Chiaro/Scuro + Toggle Effetti FX + Reduced Motion)
 *   2. Sistema Particellare Canvas (Braci di Taverna, Polvere Runica, Lucciole)
 *   3. Scia Magica del Cursore (Cursor Trail) e Onde d'Urto / Scintille al Click
 *   4. Inclinazione 3D (Card Tilt) con Riflesso Speculare Dinamico
 *   5. Rivelazione Scaglionata Universale (Stagger) e Araldo Cambio Sezione
 *   6. Costruttore e Lanciatore Dadi Fisico 4D (Traiettoria, Rimbalzi, Tesseract & Numeri Dinamici)
 *   7. Cerimonia Reliquiario 3D dell'Emporio (Armi, Oggetti, Droghe, Veicoli, Cyber)
 *   8. Cerimonia Grimorio 3D degli Incantesimi Aggiuntivi (Sigillo Scuola & Canalizzazione)
 *   9. D20 Fluttuante di Accesso Rapido
 * ============================================================================
 */
(function () {
  "use strict";

  var CONFIG = {
    storageKeyTheme: "sium_theme_mode",
    storageKeyFx: "sium_fx_enabled",
    maxParticlesDesktop: 44,
    maxParticlesMobile: 18,
    tiltMaxDeg: 6.5,
    cursorTrailLength: 8
  };

  var SECTION_META = {
    regole:       { title: "Regolamento & Compendio",   kicker: "Tomo delle Leggi",        icon: "📜" },
    emporio:      { title: "Emporio delle Meraviglie",  kicker: "Mercato & Artefatti",     icon: "⚔️" },
    png:          { title: "Galleria dei PNG",          kicker: "Volti del Regno",         icon: "🎭" },
    "genera-png": { title: "Forgia dei PNG",            kicker: "Creazione Assistita",     icon: "✨" },
    bestiario:    { title: "Bestiario dei Mostri",      kicker: "Creature & Leggende",     icon: "🐉" },
    "schede-pg":  { title: "Schede dei Personaggi",     kicker: "Eroi della Campagna",     icon: "🛡️" },
    iniziativa:   { title: "Tracker Iniziativa",        kicker: "Ordine di Combattimento", icon: "⚡" },
    dadi:         { title: "Arena dei Dadi 4D",         kicker: "Lancio Iper-Poliedrico",  icon: "🎲" },
    caos:         { title: "Tabella del Caos",          kicker: "Fato Imprevedibile",      icon: "🌀" },
    incantesimi:  { title: "Grimorio degli Incantesimi",kicker: "Arti Arcane",             icon: "🔮" },
    mappa:        { title: "Atlante & Mappa Tattica",   kicker: "Cartografia del Mondo",   icon: "🗺️" },
    bacheca:      { title: "Bacheca dei Ricercati",     kicker: "Taglie & Missioni",       icon: "📌" },
    fazioni:      { title: "Fazioni & Gilde",           kicker: "Poteri & Alleanze",       icon: "🚩" },
    "regia-audio":{ title: "Regia Audio & Atmosfera",   kicker: "Sinfonia del Master",     icon: "🎵" },
    "note-dm":    { title: "Sanctum del Dungeon Master",kicker: "Segreti della Campagna",  icon: "👁️" }
  };

  /* Palette Scuole di Magia per gli Incantesimi Aggiuntivi */
  var SPELL_SCHOOL_THEMES = {
    invocazione:   { color: "#ff6b3d", glow: "rgba(255, 107, 61, 0.34)",  icon: "🔥", label: "Fiamma Arcana" },
    evocazione:    { color: "#818cf8", glow: "rgba(129, 140, 248, 0.34)", icon: "🌌", label: "Portale Astrale" },
    abiurazione:   { color: "#38bdf8", glow: "rgba(56, 189, 248, 0.34)",  icon: "🛡️", label: "Egida Runica" },
    necromanzia:   { color: "#a855f7", glow: "rgba(168, 85, 247, 0.36)",  icon: "💀", label: "Ombra Eldritch" },
    divinazione:   { color: "#7dd3fc", glow: "rgba(125, 211, 252, 0.34)", icon: "👁️", label: "Terzo Occhio" },
    illusione:     { color: "#ec4899", glow: "rgba(236, 72, 153, 0.34)",  icon: "🪞", label: "Miraggio" },
    trasmutazione: { color: "#10b981", glow: "rgba(16, 185, 129, 0.34)",  icon: "⚗️", label: "Alchimia Pura" },
    ammaliamento:  { color: "#f472b6", glow: "rgba(244, 114, 182, 0.34)", icon: "💫", label: "Sussurro Fatato" },
    default:       { color: "#d8b25c", glow: "rgba(216, 178, 92, 0.32)",  icon: "✨", label: "Trama Arcana" }
  };

  /* Palette Rarità per il Reliquiario dell'Emporio */
  var RARITY_AURA_MAP = {
    "comune":      "#c4b9a5",
    "non comune":  "#2ecc71",
    "raro":        "#3b82f6",
    "molto raro":  "#a855f7",
    "leggendario": "#f59e0b",
    "artefatto":   "#ef4444"
  };

  var state = {
    fxEnabled: true,
    reducedMotion: false,
    theme: "dark",
    particles: [],
    canvas: null,
    ctx: null,
    rafId: null,
    observer: null,
    mutationObserver: null,
    heraldEl: null,
    heraldTimer: null,
    lastSection: null
  };

  /* ==========================================================================
     1. PREFERENZE TEMA ED EFFETTI
     ========================================================================== */
  function detectPreferences() {
    var mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    state.reducedMotion = !!(mq && mq.matches);

    try {
      var savedFx = localStorage.getItem(CONFIG.storageKeyFx);
      if (savedFx !== null) {
        state.fxEnabled = savedFx === "1";
      } else {
        state.fxEnabled = !state.reducedMotion;
      }

      var savedTheme =
        (window.state && window.state.theme) ||
        localStorage.getItem(CONFIG.storageKeyTheme) ||
        localStorage.getItem("theme");
      if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "halloween" || savedTheme === "christmas" || savedTheme === "valentine" || savedTheme === "easter") {
        state.theme = savedTheme;
      }
    } catch (e) {}

    applyFxClass();
  }

  function getCurrentTheme() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark" || attr === "halloween" || attr === "christmas" || attr === "valentine" || attr === "easter") {
      state.theme = attr;
    } else if (window.state && (window.state.theme === "light" || window.state.theme === "dark" || window.state.theme === "halloween" || window.state.theme === "christmas" || window.state.theme === "valentine" || window.state.theme === "easter")) {
      state.theme = window.state.theme;
    }
    return state.theme || "dark";
  }

  function getThemeMeta(themeId) {
    if (themeId === "easter") {
      return { id: "easter", icon: "🐰", label: "Tema: Pasqua", shortLabel: "Pasqua" };
    }
    if (themeId === "valentine") {
      return { id: "valentine", icon: "💘", label: "Tema: S. Valentino", shortLabel: "S. Valentino" };
    }
    if (themeId === "christmas") {
      return { id: "christmas", icon: "🎄", label: "Tema: Natale", shortLabel: "Natale" };
    }
    if (themeId === "halloween") {
      return { id: "halloween", icon: "🎃", label: "Tema: Halloween", shortLabel: "Halloween" };
    }
    if (themeId === "light") {
      return { id: "light", icon: "☀️", label: "Tema: Chiaro", shortLabel: "Chiaro" };
    }
    return { id: "dark", icon: "🌙", label: "Tema: Scuro", shortLabel: "Scuro" };
  }

  function setTheme(newTheme) {
    if (newTheme !== "dark" && newTheme !== "light" && newTheme !== "halloween" && newTheme !== "christmas" && newTheme !== "valentine" && newTheme !== "easter") {
      newTheme = "dark";
    }
    state.theme = newTheme;
    document.documentElement.setAttribute("data-theme", newTheme);
    try {
      localStorage.setItem(CONFIG.storageKeyTheme, newTheme);
      localStorage.setItem("theme", newTheme);
    } catch (e) {}

    if (typeof window.setAppTheme === "function") {
      window.setAppTheme(newTheme, true);
    } else if (window.state) {
      window.state.theme = newTheme;
      if (typeof window.saveToStorage === "function") window.saveToStorage();
      if (typeof window.render === "function") window.render();
    }

    onThemeChange(newTheme);
  }

  function onThemeChange(newTheme) {
    if (newTheme) state.theme = newTheme;
    else state.theme = getCurrentTheme();
    populateFloatingEntities();
    if (state.fxEnabled && !state.reducedMotion) {
      startParticles();
    }
    updateThemeButtons();
  }

  function updateThemeButtons() {
    var cur = getCurrentTheme();
    var meta = getThemeMeta(cur);
    var btns = document.querySelectorAll(".sium-theme-picker-btn");
    btns.forEach(function (btn) {
      btn.innerHTML = '<span>' + meta.icon + '</span><span class="theme-btn-label">' + meta.label + '</span>';
      btn.title = "Scegli il tema del sito (Normale Scuro, Normale Chiaro, Halloween, Natale, San Valentino o Pasqua)";
      btn.classList.toggle("active", cur === "halloween" || cur === "christmas" || cur === "valentine" || cur === "easter");
    });

    var opts = document.querySelectorAll(".sium-theme-option");
    opts.forEach(function (opt) {
      var t = opt.getAttribute("data-theme-opt");
      opt.classList.toggle("is-selected", t === cur);
    });
  }

  function toggleThemePickerMenu(anchorEl) {
    createTopControlsBar();
    var menu = document.getElementById("sium-theme-picker-menu");
    if (!menu) return;
    var isOpen = menu.classList.contains("is-open");
    if (isOpen) {
      menu.classList.remove("is-open");
      return;
    }
    updateThemeButtons();
    if (anchorEl && anchorEl.getBoundingClientRect) {
      var rect = anchorEl.getBoundingClientRect();
      menu.style.top = "auto";
      menu.style.bottom = Math.max(12, window.innerHeight - rect.top + 8) + "px";
      if (rect.left > window.innerWidth * 0.5) {
        /* Aperto dalla barra fissa in basso a destra */
        menu.style.right = Math.max(12, window.innerWidth - rect.right) + "px";
        menu.style.left = "auto";
      } else {
        /* Aperto dal pulsante nella sidebar in basso a sinistra */
        menu.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - 310)) + "px";
        menu.style.right = "auto";
      }
    }
    menu.classList.add("is-open");
  }

  function applyFxClass() {
    if (!document.body) return;
    if (!state.fxEnabled || state.reducedMotion) {
      document.body.classList.add("sium-fx-off");
      document.documentElement.setAttribute("data-fx", "off");
    } else {
      document.body.classList.remove("sium-fx-off");
      document.documentElement.setAttribute("data-fx", "on");
    }
    updateFxToggleButtons();
  }

  function toggleFx() {
    state.fxEnabled = !state.fxEnabled;
    try {
      localStorage.setItem(CONFIG.storageKeyFx, state.fxEnabled ? "1" : "0");
    } catch (e) {}
    applyFxClass();

    if (state.fxEnabled && !state.reducedMotion) {
      startParticles();
    } else {
      stopParticles();
    }
    return state.fxEnabled;
  }

  function updateFxToggleButtons() {
    var btns = document.querySelectorAll(".sium-fx-toggle-btn");
    btns.forEach(function (btn) {
      btn.setAttribute("aria-pressed", state.fxEnabled ? "true" : "false");
      btn.classList.toggle("active", state.fxEnabled);
      btn.title = state.fxEnabled
        ? "Animazioni attive (clicca per spegnere le animazioni)"
        : "Animazioni spente (clicca per riattivare le animazioni)";
      var label = btn.querySelector(".fx-label");
      if (label) {
        label.textContent = state.fxEnabled ? "Animazioni: ON" : "Animazioni: OFF";
      } else {
        btn.innerHTML = state.fxEnabled
          ? '<span>✨</span><span class="fx-label">Animazioni: ON</span>'
          : '<span>💤</span><span class="fx-label">Animazioni: OFF</span>';
      }
    });
  }

  /* ==========================================================================
     2. SISTEMA PARTICELLE AMBIENTALI, LUCETTE E CREATURE HALLOWEEN (60FPS)
     ========================================================================== */
  function populateFloatingEntities() {
    var ffContainer = document.getElementById("sium-floating-fireflies");
    if (!ffContainer) return;

    var curTheme = getCurrentTheme();
    if (ffContainer.getAttribute("data-rendered-theme") === curTheme && ffContainer.children.length > 0) {
      return;
    }
    ffContainer.setAttribute("data-rendered-theme", curTheme);
    ffContainer.innerHTML = "";

    var isMobile = window.innerWidth < 768;

    if (curTheme === "easter") {
      /* TEMA PASQUA: Coniglietti, Uova di Pasqua, Pulcini che schiudono, Fiori di Primavera, Farfalle, Carote e Cioccolatini che fluttuano! */
      var easterItems = [
        "🐰", "🥚", "🐣", "🌷", "🐇", "🥚", "🐥", "🌸",
        "🐰", "🥚", "🦋", "🌼", "🧺", "🥕", "🍫", "🐣",
        "🎀", "🍀", "🐰", "🥚"
      ];
      var eCount = isMobile ? 16 : 28;
      for (var ea = 0; ea < eCount; ea++) {
        var eIcon = easterItems[ea % easterItems.length];
        var eEl = document.createElement("div");
        var eExtra = (eIcon === "🐰" || eIcon === "🐇") ? " is-bunny" : " is-egg";
        eEl.className = "sium-easter-floater" + eExtra;
        eEl.textContent = eIcon;
        var eSize = (16 + (ea % 4) * 5) + "px";
        eEl.style.setProperty("--ea-size", eSize);
        eEl.style.left = ((ea * 37) % 94 + 2) + "%";
        eEl.style.top = ((ea * 53) % 90 + 4) + "%";
        eEl.style.setProperty("--ff-dur", (11.0 + (ea % 7) * 2.2).toFixed(1) + "s");
        eEl.style.setProperty("--ff-twinkle", (2.3 + (ea % 5) * 0.6).toFixed(1) + "s");
        eEl.style.setProperty("--ff-delay", (-((ea * 1.7) % 14)).toFixed(1) + "s");
        eEl.style.setProperty("--ff-dx1", ((ea % 2 === 0 ? 1 : -1) * (28 + (ea % 4) * 16)) + "px");
        eEl.style.setProperty("--ff-dy1", (-(38 + (ea % 5) * 18)) + "px");
        eEl.style.setProperty("--ff-dx2", ((ea % 2 === 0 ? -1 : 1) * (24 + (ea % 3) * 15)) + "px");
        eEl.style.setProperty("--ff-dy2", (-(80 + (ea % 4) * 24)) + "px");
        eEl.style.setProperty("--ff-dx3", ((ea % 3 === 0 ? 1 : -1) * (20 + (ea % 5) * 14)) + "px");
        eEl.style.setProperty("--ff-dy3", (-(134 + (ea % 4) * 26)) + "px");
        ffContainer.appendChild(eEl);
      }
    } else if (curTheme === "valentine") {
      /* TEMA SAN VALENTINO: Cupido, Cuoricini trafitti, Rose rosse, Lettere d'amore, Angioletti e Cioccolatini che fluttuano! */
      var valItems = [
        "💘", "💖", "👼", "❤️", "🌹", "💌", "💕", "💗",
        "💘", "💓", "💞", "💝", "👼", "🌹", "🍫", "💋",
        "💍", "💘", "💖", "💕"
      ];
      var vCount = isMobile ? 16 : 28;
      for (var v = 0; v < vCount; v++) {
        var vIcon = valItems[v % valItems.length];
        var vEl = document.createElement("div");
        var vExtra = (vIcon === "💘" || vIcon === "👼") ? " is-cupid" : " is-heart";
        vEl.className = "sium-valentine-floater" + vExtra;
        vEl.textContent = vIcon;
        var vSize = (16 + (v % 4) * 5) + "px";
        vEl.style.setProperty("--val-size", vSize);
        vEl.style.left = ((v * 37) % 94 + 2) + "%";
        vEl.style.top = ((v * 53) % 90 + 4) + "%";
        vEl.style.setProperty("--ff-dur", (11.2 + (v % 7) * 2.2).toFixed(1) + "s");
        vEl.style.setProperty("--ff-twinkle", (2.2 + (v % 5) * 0.6).toFixed(1) + "s");
        vEl.style.setProperty("--ff-delay", (-((v * 1.7) % 14)).toFixed(1) + "s");
        vEl.style.setProperty("--ff-dx1", ((v % 2 === 0 ? 1 : -1) * (28 + (v % 4) * 16)) + "px");
        vEl.style.setProperty("--ff-dy1", (-(38 + (v % 5) * 18)) + "px");
        vEl.style.setProperty("--ff-dx2", ((v % 2 === 0 ? -1 : 1) * (24 + (v % 3) * 15)) + "px");
        vEl.style.setProperty("--ff-dy2", (-(82 + (v % 4) * 24)) + "px");
        vEl.style.setProperty("--ff-dx3", ((v % 3 === 0 ? 1 : -1) * (20 + (v % 5) * 14)) + "px");
        vEl.style.setProperty("--ff-dy3", (-(136 + (v % 4) * 26)) + "px");
        ffContainer.appendChild(vEl);
      }
    } else if (curTheme === "christmas") {
      /* TEMA NATALE: Fiocchi di neve, Babbi Natale, Alberi di Natale, Pupazzi di neve, Biscotti e Caramelle che fluttuano! */
      var xmasItems = [
        "❄️", "🎅", "🎄", "⛄", "🍪", "🍬", "❄️", "🎅", "🎄", "⛄",
        "🍭", "🎁", "🔔", "🦌", "🌟", "❅", "❆", "🍪", "🍬", "🎅"
      ];
      var xCount = isMobile ? 16 : 28;
      for (var c = 0; c < xCount; c++) {
        var xIcon = xmasItems[c % xmasItems.length];
        var xEl = document.createElement("div");
        var extraCls = (xIcon === "❄️" || xIcon === "❅" || xIcon === "❆") ? " is-snowflake" : (xIcon === "🎅" ? " is-santa" : "");
        xEl.className = "sium-christmas-floater" + extraCls;
        xEl.textContent = xIcon;
        var xSize = (16 + (c % 4) * 5) + "px";
        xEl.style.setProperty("--xm-size", xSize);
        xEl.style.left = ((c * 37) % 94 + 2) + "%";
        xEl.style.top = ((c * 53) % 88 + 3) + "%";
        xEl.style.setProperty("--ff-dur", (11 + (c % 7) * 2.3).toFixed(1) + "s");
        xEl.style.setProperty("--ff-twinkle", (2.5 + (c % 5) * 0.6).toFixed(1) + "s");
        xEl.style.setProperty("--ff-delay", (-((c * 1.8) % 14)).toFixed(1) + "s");
        xEl.style.setProperty("--ff-dx1", ((c % 2 === 0 ? 1 : -1) * (28 + (c % 4) * 15)) + "px");
        xEl.style.setProperty("--ff-dy1", (35 + (c % 5) * 16) + "px");
        xEl.style.setProperty("--ff-dx2", ((c % 2 === 0 ? -1 : 1) * (24 + (c % 3) * 15)) + "px");
        xEl.style.setProperty("--ff-dy2", (75 + (c % 4) * 22) + "px");
        xEl.style.setProperty("--ff-dx3", ((c % 3 === 0 ? 1 : -1) * (20 + (c % 5) * 14)) + "px");
        xEl.style.setProperty("--ff-dy3", (120 + (c % 4) * 24) + "px");
        ffContainer.appendChild(xEl);
      }
    } else if (curTheme === "halloween") {
      /* TEMA HALLOWEEN: Zucche, Tombe, Fantasmini, Ragni, Pipistrelli, Teschi e Mostri che fluttuano! */
      var creatures = [
        "🎃", "🪦", "👻", "🕷️", "🎃", "🪦", "👻",
        "🦇", "💀", "🕷️", "🧟", "🧛", "👾", "🪦",
        "🎃", "👻", "💀", "🦇"
      ];
      var count = isMobile ? 16 : 28;
      for (var h = 0; h < count; h++) {
        var icon = creatures[h % creatures.length];
        var el = document.createElement("div");
        var hwExtra = icon === "🎃" ? " is-pumpkin" : (icon === "🪦" ? " is-tomb" : "");
        el.className = "sium-halloween-floater" + hwExtra;
        el.textContent = icon;
        var fontSize = (16 + (h % 4) * 5) + "px";
        el.style.setProperty("--hw-size", fontSize);
        el.style.left = ((h * 39) % 94 + 2) + "%";
        el.style.top = ((h * 57) % 90 + 4) + "%";
        el.style.setProperty("--ff-dur", (11.5 + (h % 7) * 2.3).toFixed(1) + "s");
        el.style.setProperty("--ff-twinkle", (2.6 + (h % 5) * 0.7).toFixed(1) + "s");
        el.style.setProperty("--ff-delay", (-((h * 1.8) % 14)).toFixed(1) + "s");
        el.style.setProperty("--ff-dx1", ((h % 2 === 0 ? 1 : -1) * (30 + (h % 4) * 16)) + "px");
        el.style.setProperty("--ff-dy1", (-(40 + (h % 5) * 18)) + "px");
        el.style.setProperty("--ff-dx2", ((h % 2 === 0 ? -1 : 1) * (26 + (h % 3) * 16)) + "px");
        el.style.setProperty("--ff-dy2", (-(85 + (h % 4) * 24)) + "px");
        el.style.setProperty("--ff-dx3", ((h % 3 === 0 ? 1 : -1) * (22 + (h % 5) * 14)) + "px");
        el.style.setProperty("--ff-dy3", (-(140 + (h % 4) * 26)) + "px");
        ffContainer.appendChild(el);
      }
    } else {
      /* TEMA NORMALE (SCURO / CHIARO): Lucette magiche dorate che fluttuano */
      var orbCount = isMobile ? 16 : 28;
      for (var i = 0; i < orbCount; i++) {
        var orb = document.createElement("div");
        orb.className = "sium-firefly-orb";
        var size = (4 + (i % 5) * 1.8).toFixed(1);
        orb.style.width = size + "px";
        orb.style.height = size + "px";
        orb.style.left = ((i * 37) % 96 + 2) + "%";
        orb.style.top = ((i * 53) % 94 + 3) + "%";
        orb.style.setProperty("--ff-dur", (11 + (i % 7) * 2.2).toFixed(1) + "s");
        orb.style.setProperty("--ff-twinkle", (2.4 + (i % 5) * 0.7).toFixed(1) + "s");
        orb.style.setProperty("--ff-delay", (-((i * 1.7) % 12)).toFixed(1) + "s");
        orb.style.setProperty("--ff-dx1", ((i % 2 === 0 ? 1 : -1) * (24 + (i % 4) * 14)) + "px");
        orb.style.setProperty("--ff-dy1", (-(35 + (i % 5) * 16)) + "px");
        orb.style.setProperty("--ff-dx2", ((i % 2 === 0 ? -1 : 1) * (20 + (i % 3) * 15)) + "px");
        orb.style.setProperty("--ff-dy2", (-(80 + (i % 4) * 22)) + "px");
        orb.style.setProperty("--ff-dx3", ((i % 3 === 0 ? 1 : -1) * (18 + (i % 5) * 12)) + "px");
        orb.style.setProperty("--ff-dy3", (-(130 + (i % 4) * 25)) + "px");
        ffContainer.appendChild(orb);
      }
    }
  }

  function createAmbientLayers() {
    if (!document.getElementById("sium-ambient-mist")) {
      var mist = document.createElement("div");
      mist.id = "sium-ambient-mist";
      mist.setAttribute("aria-hidden", "true");
      document.body.prepend(mist);
    }

    if (!document.getElementById("sium-halloween-decor")) {
      var hwDecor = document.createElement("div");
      hwDecor.id = "sium-halloween-decor";
      hwDecor.setAttribute("aria-hidden", "true");

      /* Ragnatela radiale realistica in seta bianca per gli angoli superiori */
      var realisticCornerWebSvg =
        '<svg viewBox="0 0 240 210" width="100%" height="100%" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
          '<g stroke="#ffffff" stroke-width="1.25" opacity="0.92">' +
            '<path d="M0,0 L240,2 M0,0 L232,36 M0,0 L216,74 M0,0 L190,114 M0,0 L154,152 M0,0 L110,182 M0,0 L62,202 M0,0 L22,208 M2,0 L2,210"/>' +
          '</g>' +
          '<g stroke="#f8fafc" stroke-width="0.95" opacity="0.84">' +
            '<path d="M26,0 Q22,5 25,4 Q20,9 23,8 Q17,13 20,12 Q14,17 16,16 Q10,20 12,19 Q6,23 7,22 Q3,25 2,26"/>' +
            '<path d="M54,0 Q46,10 52,8 Q42,18 48,16 Q36,26 42,25 Q30,34 34,33 Q21,41 24,40 Q12,46 14,45 Q6,50 2,52"/>' +
            '<path d="M86,1 Q74,16 83,13 Q68,28 77,26 Q58,41 67,40 Q48,54 54,53 Q34,65 38,64 Q20,74 22,73 Q9,80 2,82"/>' +
            '<path d="M122,1 Q106,22 118,19 Q96,40 109,37 Q82,58 95,57 Q68,77 77,76 Q48,93 54,92 Q28,106 31,104 Q13,114 2,116"/>' +
            '<path d="M162,1 Q140,29 156,25 Q128,52 145,50 Q109,77 126,75 Q90,102 102,101 Q64,124 72,122 Q38,140 41,138 Q18,150 2,152"/>' +
            '<path d="M204,2 Q178,36 198,32 Q162,65 183,63 Q138,96 160,94 Q114,128 128,127 Q82,156 91,154 Q48,176 52,174 Q22,188 2,190"/>' +
          '</g>' +
          '<g fill="#ffffff" opacity="0.9">' +
            '<circle cx="77" cy="26" r="1.4"/><circle cx="95" cy="57" r="1.5"/><circle cx="126" cy="75" r="1.4"/><circle cx="54" cy="92" r="1.3"/>' +
          '</g>' +
        '</svg>';

      /* Festone continuo di ragnatele bianche realistiche lungo tutto il bordo superiore del sito */
      var topBorderWebCanopySvg =
        '<svg viewBox="0 0 1440 115" width="100%" height="100%" preserveAspectRatio="none" fill="none" stroke-linecap="round">' +
          '<g stroke="#ffffff" stroke-width="1.2" opacity="0.88">' +
            '<path d="M0,0 Q120,68 240,0 Q360,56 480,0 Q600,72 720,0 Q840,58 960,0 Q1080,70 1200,0 Q1320,56 1440,0"/>' +
            '<path d="M120,34 L120,0 M60,18 L120,34 L180,18 M360,28 L360,0 M300,15 L360,28 L420,15 M600,36 L600,0 M540,19 L600,36 L660,19 M840,29 L840,0 M780,15 L840,29 L900,15 M1080,35 L1080,0 M1020,18 L1080,35 L1140,18 M1320,28 L1320,0 M1260,15 L1320,28 L1380,15"/>' +
          '</g>' +
          '<g stroke="#f1f5f9" stroke-width="0.9" opacity="0.78">' +
            '<path d="M0,0 Q120,44 240,0 Q360,36 480,0 Q600,48 720,0 Q840,38 960,0 Q1080,46 1200,0 Q1320,36 1440,0"/>' +
            '<path d="M0,0 Q120,22 240,0 Q360,18 480,0 Q600,24 720,0 Q840,19 960,0 Q1080,23 1200,0 Q1320,18 1440,0"/>' +
            '<path d="M120,0 Q240,86 360,0 Q480,78 600,0 Q720,88 840,0 Q960,76 1080,0 Q1200,84 1320,0"/>' +
          '</g>' +
        '</svg>';

      var tombRipSvg =
        '<svg class="sium-hw-tomb-svg" viewBox="0 0 40 48">' +
          '<path d="M6,46 L6,18 C6,7 34,7 34,18 L34,46 Z" fill="#120824" stroke="#a855f7" stroke-width="1.8"/>' +
          '<path d="M20,11 L20,23 M15,15 L25,15" stroke="#ff7518" stroke-width="2" stroke-linecap="round"/>' +
          '<text x="20" y="35" text-anchor="middle" fill="#e9d5ff" font-family="serif" font-size="8.5" font-weight="bold">RIP</text>' +
          '<path d="M2,46 Q20,42 38,46" stroke="#a855f7" stroke-width="2" fill="none"/>' +
        '</svg>';
      var hwGarlandIcons = ["🎃", "🪦", "💀", "🕷️", "👻", "🎃", "🪦", "🦇", "💀", "🎃", "🪦", "👻", "🕷️", "🎃", "🪦"];
      var hwGarlandHtml = "";
      for (var g = 0; g < hwGarlandIcons.length; g++) {
        var gIc = hwGarlandIcons[g];
        var gGlow = (gIc === "🎃") ? "rgba(255, 117, 24, 0.9)" : "rgba(168, 85, 247, 0.9)";
        var gDur = (1.6 + (g % 4) * 0.45).toFixed(2) + "s";
        var gDelay = (-((g * 0.3) % 2.4)).toFixed(2) + "s";
        hwGarlandHtml +=
          '<div class="sium-hw-lantern-node" style="--hw-glow:' + gGlow + ';--hw-dur:' + gDur + ';--hw-delay:' + gDelay + ';">' + gIc + '</div>';
      }
      hwDecor.innerHTML =
        '<div class="sium-hw-top-web-canopy">' + topBorderWebCanopySvg + '</div>' +
        '<div class="sium-hw-corner-web web-top-left">' + realisticCornerWebSvg + '</div>' +
        '<div class="sium-hw-corner-web web-top-right">' + realisticCornerWebSvg + '</div>' +
        '<div class="sium-hw-top-garland">' + hwGarlandHtml + '</div>' +
        '<div class="sium-dangling-spider" style="right: 190px; --sp-len: 105px; --sp-dur: 8.5s; --sp-delay: -1.5s;">' +
          '<div class="sium-spider-thread"></div>' +
          '<div class="sium-spider-body">🕷️</div>' +
        '</div>' +
        '<div class="sium-dangling-spider" style="left: 270px; --sp-len: 85px; --sp-dur: 10.5s; --sp-delay: -4s;">' +
          '<div class="sium-spider-thread"></div>' +
          '<div class="sium-spider-body">🕷️</div>' +
        '</div>' +
        '<div class="sium-dangling-spider" style="left: 52%; --sp-len: 70px; --sp-dur: 9.2s; --sp-delay: -2.8s;">' +
          '<div class="sium-spider-thread"></div>' +
          '<div class="sium-spider-body">🕷️</div>' +
        '</div>' +
        '<div class="sium-hw-graveyard-bar" title="Notte di Halloween!">' +
          tombRipSvg +
          '<span>🎃</span>' +
          tombRipSvg +
          '<span>💀</span><span>👻</span><span>🕷️</span>' +
          tombRipSvg +
        '</div>';
      document.body.prepend(hwDecor);
    }

    if (!document.getElementById("sium-christmas-decor")) {
      var xmDecor = document.createElement("div");
      xmDecor.id = "sium-christmas-decor";
      xmDecor.setAttribute("aria-hidden", "true");
      var bulbColors = [
        { c: "#ef233c", g: "rgba(239, 35, 60, 0.75)" },
        { c: "#ffd56b", g: "rgba(255, 213, 107, 0.80)" },
        { c: "#22c55e", g: "rgba(34, 197, 94, 0.75)" },
        { c: "#38bdf8", g: "rgba(56, 189, 248, 0.75)" },
        { c: "#ffffff", g: "rgba(255, 255, 255, 0.85)" }
      ];
      var bulbsHtml = "";
      for (var b = 0; b < 22; b++) {
        var bc = bulbColors[b % bulbColors.length];
        var bDur = (1.2 + (b % 4) * 0.45).toFixed(2) + "s";
        var bDelay = (-((b * 0.35) % 2.5)).toFixed(2) + "s";
        bulbsHtml +=
          '<div class="sium-xmas-bulb" style="--bulb-color:' + bc.c + ';--bulb-glow:' + bc.g + ';--bulb-dur:' + bDur + ';--bulb-delay:' + bDelay + ';"></div>';
      }
      xmDecor.innerHTML =
        '<div class="sium-xmas-lights-garland">' + bulbsHtml + '</div>' +
        '<div class="sium-xmas-snow-corner" title="Buon Natale!">⛄ 🎄 🎅 🍪 🍬 🎁</div>';
      document.body.prepend(xmDecor);
    }

    if (!document.getElementById("sium-valentine-decor")) {
      var valDecor = document.createElement("div");
      valDecor.id = "sium-valentine-decor";
      valDecor.setAttribute("aria-hidden", "true");

      /* Festone superiore di pizzo rosa/bianco e cuoricini sospesi lungo il bordo alto del sito */
      var topLaceCanopySvg =
        '<svg viewBox="0 0 1440 110" width="100%" height="100%" preserveAspectRatio="none" fill="none" stroke-linecap="round">' +
          '<g stroke="#fff0f6" stroke-width="1.35" opacity="0.9">' +
            '<path d="M0,0 Q120,64 240,0 Q360,54 480,0 Q600,68 720,0 Q840,54 960,0 Q1080,66 1200,0 Q1320,54 1440,0"/>' +
            '<path d="M0,0 Q120,38 240,0 Q360,32 480,0 Q600,42 720,0 Q840,32 960,0 Q1080,40 1200,0 Q1320,32 1440,0" stroke="#ffb3d1" stroke-dasharray="4 4"/>' +
          '</g>' +
          '<g fill="#ff4d8d" stroke="#fff0f6" stroke-width="1">' +
            '<path d="M120,46 C120,46 110,38 110,32 C110,28 115,26 118,29 L120,31 L122,29 C125,26 130,28 130,32 C130,38 120,46 120,46 Z"/>' +
            '<path d="M360,40 C360,40 350,32 350,26 C350,22 355,20 358,23 L360,25 L362,23 C365,20 370,22 370,26 C370,32 360,40 360,40 Z"/>' +
            '<path d="M600,48 C600,48 590,40 590,34 C590,30 595,28 598,31 L600,33 L602,31 C605,28 610,30 610,34 C610,40 600,48 600,48 Z"/>' +
            '<path d="M840,40 C840,40 830,32 830,26 C830,22 835,20 838,23 L840,25 L842,23 C845,20 850,22 850,26 C850,32 840,40 840,40 Z"/>' +
            '<path d="M1080,46 C1080,46 1070,38 1070,32 C1070,28 1075,26 1078,29 L1080,31 L1082,29 C1085,26 1090,28 1090,32 C1090,38 1080,46 1080,46 Z"/>' +
            '<path d="M1320,40 C1320,40 1310,32 1310,26 C1310,22 1315,20 1318,23 L1320,25 L1322,23 C1325,20 1330,22 1330,26 C1330,32 1320,40 1320,40 Z"/>' +
          '</g>' +
        '</svg>';

      /* Cupido con ali, arco d'oro e freccia con cuore per gli angoli superiori */
      var cornerCupidSvg =
        '<svg viewBox="0 0 190 170" width="100%" height="100%" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M0,0 Q90,18 175,6 M0,0 Q75,55 150,48 M0,0 Q55,95 112,102 M0,0 Q28,125 62,145" stroke="#ffb3d1" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.82"/>' +
          '<path d="M36,42 C18,24 10,40 24,54 C12,58 18,74 36,66 Z" fill="#fff0f6" stroke="#ff8fb3" stroke-width="1.4"/>' +
          '<circle cx="48" cy="44" r="10" fill="#ffe4ec" stroke="#ff4d8d" stroke-width="1.5"/>' +
          '<path d="M40,68 C40,56 56,56 56,68 L52,88 L44,88 Z" fill="#ff4d8d" stroke="#fff0f6" stroke-width="1.2"/>' +
          '<path d="M62,30 C78,44 78,72 62,86" stroke="#ffd166" stroke-width="2.6" fill="none"/>' +
          '<line x1="62" y1="30" x2="62" y2="86" stroke="#fff0f6" stroke-width="1"/>' +
          '<line x1="46" y1="58" x2="96" y2="58" stroke="#ffd166" stroke-width="2.2"/>' +
          '<path d="M102,58 C102,58 94,51 94,47 C94,44 98,43 100,45 L102,47 L104,45 C106,43 110,44 110,47 C110,51 102,58 102,58 Z" fill="#ff2a6d" stroke="#ffd166" stroke-width="1"/>' +
        '</svg>';

      var piercedHeartSvg =
        '<svg class="sium-val-heart-svg" viewBox="0 0 44 44">' +
          '<line x1="5" y1="38" x2="39" y2="8" stroke="#ffd166" stroke-width="2.2" stroke-linecap="round"/>' +
          '<polygon points="40,7 32,9 37,14" fill="#ffd166"/>' +
          '<path d="M22,36 C22,36 8,26 8,16 C8,10 13,7 18,10 C20,11 22,14 22,14 C22,14 24,11 26,10 C31,7 36,10 36,16 C36,26 22,36 22,36 Z" fill="#ff2a6d" stroke="#ffb3d1" stroke-width="1.6"/>' +
        '</svg>';

      var valGarlandIcons = ["💘", "💖", "🌹", "💌", "👼", "💕", "💘", "🌹", "💖", "💌", "👼", "💝", "💘", "🌹", "💖"];
      var valGarlandHtml = "";
      for (var vg = 0; vg < valGarlandIcons.length; vg++) {
        var vIc = valGarlandIcons[vg];
        var vGlow = (vIc === "💘" || vIc === "👼") ? "rgba(255, 209, 102, 0.92)" : "rgba(255, 77, 141, 0.92)";
        var vDur = (1.5 + (vg % 4) * 0.4).toFixed(2) + "s";
        var vDelay = (-((vg * 0.28) % 2.2)).toFixed(2) + "s";
        valGarlandHtml +=
          '<div class="sium-val-heart-node" style="--val-glow:' + vGlow + ';--val-dur:' + vDur + ';--val-delay:' + vDelay + ';">' + vIc + '</div>';
      }

      valDecor.innerHTML =
        '<div class="sium-val-top-lace-canopy">' + topLaceCanopySvg + '</div>' +
        '<div class="sium-val-corner-cupid cupid-top-left">' + cornerCupidSvg + '</div>' +
        '<div class="sium-val-corner-cupid cupid-top-right">' + cornerCupidSvg + '</div>' +
        '<div class="sium-val-top-garland">' + valGarlandHtml + '</div>' +
        '<div class="sium-dangling-heart" style="right: 195px; --sp-len: 100px; --sp-dur: 8.2s; --sp-delay: -1.2s;">' +
          '<div class="sium-heart-ribbon"></div>' +
          '<div class="sium-heart-charm">💘</div>' +
        '</div>' +
        '<div class="sium-dangling-heart" style="left: 275px; --sp-len: 82px; --sp-dur: 9.8s; --sp-delay: -3.6s;">' +
          '<div class="sium-heart-ribbon"></div>' +
          '<div class="sium-heart-charm">💖</div>' +
        '</div>' +
        '<div class="sium-dangling-heart" style="left: 53%; --sp-len: 68px; --sp-dur: 8.8s; --sp-delay: -2.4s;">' +
          '<div class="sium-heart-ribbon"></div>' +
          '<div class="sium-heart-charm">👼</div>' +
        '</div>' +
        '<div class="sium-val-bottom-shrine" title="Buon San Valentino!">' +
          piercedHeartSvg +
          '<span>💘</span><span>👼</span>' +
          piercedHeartSvg +
          '<span>🌹</span><span>💌</span><span>🍫</span>' +
          piercedHeartSvg +
        '</div>';
      document.body.prepend(valDecor);
    }

    if (!document.getElementById("sium-easter-decor")) {
      var eaDecor = document.createElement("div");
      eaDecor.id = "sium-easter-decor";
      eaDecor.setAttribute("aria-hidden", "true");

      var paintedEggSvgPink =
        '<svg class="sium-easter-egg-svg" viewBox="0 0 36 44">' +
          '<ellipse cx="18" cy="24" rx="13" ry="17" fill="#f472b6" stroke="#fef08a" stroke-width="1.8"/>' +
          '<path d="M6,21 L12,16 L18,21 L24,16 L30,21" fill="none" stroke="#fde047" stroke-width="2.2" stroke-linecap="round"/>' +
          '<path d="M7,29 Q18,34 29,29" fill="none" stroke="#38bdf8" stroke-width="2.2"/>' +
          '<circle cx="13" cy="12" r="2" fill="#ffffff"/><circle cx="23" cy="12" r="2" fill="#4ade80"/>' +
        '</svg>';

      var paintedEggSvgBlue =
        '<svg class="sium-easter-egg-svg" viewBox="0 0 36 44">' +
          '<ellipse cx="18" cy="24" rx="13" ry="17" fill="#38bdf8" stroke="#fef08a" stroke-width="1.8"/>' +
          '<path d="M6,23 L12,18 L18,23 L24,18 L30,23" fill="none" stroke="#f472b6" stroke-width="2.2" stroke-linecap="round"/>' +
          '<circle cx="14" cy="31" r="2.2" fill="#fde047"/><circle cx="22" cy="31" r="2.2" fill="#4ade80"/>' +
        '</svg>';

      var eaGarlandIcons = ["🐰", "🥚", "🐣", "🌷", "🐰", "🥚", "🌸", "🐥", "🥚", "🐰", "🌷", "🐣", "🥚", "🌸", "🐰"];
      var eaGarlandGlows = ["rgba(244, 114, 182, 0.92)", "rgba(250, 204, 21, 0.92)", "rgba(74, 222, 128, 0.92)", "rgba(56, 189, 248, 0.92)"];
      var eaGarlandHtml = "";
      for (var eg = 0; eg < eaGarlandIcons.length; eg++) {
        var eIc = eaGarlandIcons[eg];
        var eGl = eaGarlandGlows[eg % eaGarlandGlows.length];
        var eDur = (1.5 + (eg % 4) * 0.42).toFixed(2) + "s";
        var eDelay = (-((eg * 0.28) % 2.2)).toFixed(2) + "s";
        eaGarlandHtml +=
          '<div class="sium-easter-egg-node" style="--ea-glow:' + eGl + ';--ea-dur:' + eDur + ';--ea-delay:' + eDelay + ';">' + eIc + '</div>';
      }

      eaDecor.innerHTML =
        '<div class="sium-easter-top-garland">' + eaGarlandHtml + '</div>' +
        '<div class="sium-dangling-egg" style="right: 195px; --sp-len: 95px; --sp-dur: 8.4s; --sp-delay: -1.4s;">' +
          '<div class="sium-egg-ribbon"></div>' +
          '<div class="sium-egg-charm">🐰</div>' +
        '</div>' +
        '<div class="sium-dangling-egg" style="left: 275px; --sp-len: 80px; --sp-dur: 9.6s; --sp-delay: -3.5s;">' +
          '<div class="sium-egg-ribbon"></div>' +
          '<div class="sium-egg-charm">🥚</div>' +
        '</div>' +
        '<div class="sium-dangling-egg" style="left: 53%; --sp-len: 68px; --sp-dur: 8.9s; --sp-delay: -2.5s;">' +
          '<div class="sium-egg-ribbon"></div>' +
          '<div class="sium-egg-charm">🐣</div>' +
        '</div>' +
        '<div class="sium-easter-bottom-meadow" title="Buona Pasqua!">' +
          paintedEggSvgPink +
          '<span>🐰</span><span>🐣</span>' +
          paintedEggSvgBlue +
          '<span>🌷</span><span>🌸</span><span>🥕</span><span>🍫</span>' +
          paintedEggSvgPink +
        '</div>';
      document.body.prepend(eaDecor);
    }

    if (!document.getElementById("sium-floating-fireflies")) {
      var ffContainer = document.createElement("div");
      ffContainer.id = "sium-floating-fireflies";
      ffContainer.setAttribute("aria-hidden", "true");
      document.body.prepend(ffContainer);
    }
    populateFloatingEntities();

    if (!document.getElementById("sium-particles-canvas")) {
      var canvas = document.createElement("canvas");
      canvas.id = "sium-particles-canvas";
      canvas.setAttribute("aria-hidden", "true");
      document.body.prepend(canvas);
      state.canvas = canvas;
      state.ctx = canvas.getContext("2d");
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas, { passive: true });
    }
  }

  function resizeCanvas() {
    if (!state.canvas) return;
    state.canvas.width = window.innerWidth;
    state.canvas.height = window.innerHeight;
  }

  function createParticle() {
    var w = window.innerWidth || 1280;
    var h = window.innerHeight || 800;
    var curTheme = getCurrentTheme();
    var palette;
    var isSnow = curTheme === "christmas";
    var isValentine = curTheme === "valentine";
    var isEaster = curTheme === "easter";
    if (isEaster) {
      palette = [
        "rgba(244, 114, 182, 0.92)",
        "rgba(250, 204, 21, 0.92)",
        "rgba(74, 222, 128, 0.88)",
        "rgba(56, 189, 248, 0.90)",
        "rgba(192, 132, 252, 0.88)"
      ];
    } else if (isValentine) {
      palette = [
        "rgba(255, 77, 141, 0.92)",
        "rgba(255, 179, 209, 0.90)",
        "rgba(255, 42, 109, 0.86)",
        "rgba(255, 209, 102, 0.84)"
      ];
    } else if (isSnow) {
      palette = [
        "rgba(255, 255, 255, 0.95)",
        "rgba(224, 242, 254, 0.90)",
        "rgba(255, 213, 107, 0.85)",
        "rgba(255, 255, 255, 0.88)"
      ];
    } else if (curTheme === "halloween") {
      palette = [
        "rgba(168, 85, 247, 0.88)",
        "rgba(216, 180, 254, 0.82)",
        "rgba(147, 51, 234, 0.78)",
        "rgba(255, 117, 24, 0.78)"
      ];
    } else if (curTheme === "light") {
      palette = ["rgba(180, 125, 25, 0.65)", "rgba(210, 150, 35, 0.55)", "rgba(160, 45, 35, 0.42)"];
    } else {
      palette = ["rgba(255, 232, 158, 0.88)", "rgba(245, 217, 142, 0.78)", "rgba(245, 158, 11, 0.72)", "rgba(235, 100, 65, 0.58)"];
    }

    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: isSnow ? (Math.random() * 3.2 + 1.4) : ((isValentine || isEaster) ? (Math.random() * 3.4 + 1.8) : (Math.random() * 2.6 + 1.1)),
      vx: (Math.random() - 0.5) * (isSnow ? 0.55 : 0.38),
      vy: isSnow ? (Math.random() * 0.75 + 0.32) : -(Math.random() * 0.52 + 0.18),
      alpha: Math.random() * 0.65 + 0.34,
      phase: Math.random() * Math.PI * 2,
      isCrystal: isSnow && Math.random() > 0.45,
      isHeart: isValentine && Math.random() > 0.32,
      isEgg: isEaster && Math.random() > 0.30,
      color: palette[Math.floor(Math.random() * palette.length)]
    };
  }

  function startParticles() {
    if (state.reducedMotion || !state.fxEnabled) return;
    createAmbientLayers();
    if (!state.ctx) return;

    var count = window.innerWidth < 768 ? 34 : 70;
    state.particles = [];
    for (var i = 0; i < count; i++) {
      state.particles.push(createParticle());
    }

    if (state.rafId) cancelAnimationFrame(state.rafId);

    function renderLoop() {
      if (!state.fxEnabled || state.reducedMotion) return;
      if (document.hidden) {
        state.rafId = requestAnimationFrame(renderLoop);
        return;
      }

      var ctx = state.ctx;
      var w = state.canvas.width;
      var h = state.canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < state.particles.length; i++) {
        var p = state.particles[i];
        p.phase += 0.026;
        p.x += p.vx + Math.sin(p.phase) * 0.28;
        p.y += p.vy;

        if (p.vy < 0 && p.y < -12) {
          p.y = h + 12;
          p.x = Math.random() * w;
        } else if (p.vy > 0 && p.y > h + 12) {
          p.y = -12;
          p.x = Math.random() * w;
        }
        if (p.x < -12) p.x = w + 12;
        if (p.x > w + 12) p.x = -12;

        var pulse = 0.58 + 0.42 * Math.sin(p.phase * 1.6);
        ctx.save();
        ctx.globalAlpha = p.alpha * pulse;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;

        if (p.isEgg) {
          /* Disegna un ovetto di Pasqua pastello luminoso sul canvas a 60fps */
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.phase * 0.7) * 0.25);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 0.82, p.r * 1.15, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.isHeart) {
          /* Disegna un cuoricino luminoso sul canvas a 60fps */
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.phase * 0.7) * 0.22);
          var hs = p.r * 0.95;
          ctx.beginPath();
          ctx.moveTo(0, hs * 0.85);
          ctx.bezierCurveTo(-hs * 1.35, -hs * 0.15, -hs * 0.7, -hs * 1.2, 0, -hs * 0.35);
          ctx.bezierCurveTo(hs * 0.7, -hs * 1.2, hs * 1.35, -hs * 0.15, 0, hs * 0.85);
          ctx.fill();
        } else if (p.isCrystal) {
          /* Disegna un cristallo di neve a 6 punte */
          ctx.translate(p.x, p.y);
          ctx.rotate(p.phase * 0.35);
          ctx.lineWidth = 1.25;
          var arm = p.r * 1.65;
          for (var k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.moveTo(-arm, 0);
            ctx.lineTo(arm, 0);
            ctx.stroke();
            ctx.rotate(Math.PI / 3);
          }
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      state.rafId = requestAnimationFrame(renderLoop);
    }

    state.rafId = requestAnimationFrame(renderLoop);
  }

  function stopParticles() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    if (state.ctx && state.canvas) {
      state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    }
  }

  /* ==========================================================================
     3. ONDE D'URTO RUNICHE E SCINTILLE AL CLICK (CLICK BURST)
     ========================================================================== */
  function spawnClickSparks(x, y, customColor) {
    if (!state.fxEnabled || state.reducedMotion) return;

    var ripple = document.createElement("div");
    ripple.className = "sium-click-ripple";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    if (customColor) {
      ripple.style.borderColor = customColor;
      ripple.style.boxShadow = "0 0 18px " + customColor;
    }
    document.body.appendChild(ripple);
    setTimeout(function () {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 580);

    var sparkCount = customColor ? 9 : 6;
    for (var i = 0; i < sparkCount; i++) {
      var spark = document.createElement("div");
      spark.className = "sium-click-spark";
      var angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.4;
      var dist = 24 + Math.random() * 34;
      spark.style.left = x + "px";
      spark.style.top = y + "px";
      if (customColor) {
        spark.style.background = customColor;
        spark.style.boxShadow = "0 0 10px " + customColor;
      }
      spark.style.setProperty("--tx", Math.round(Math.cos(angle) * dist) + "px");
      spark.style.setProperty("--ty", Math.round(Math.sin(angle) * dist) + "px");
      document.body.appendChild(spark);
      (function (el) {
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 560);
      })(spark);
    }
  }

  function triggerCardClickPulse(cardEl, accentColor) {
    if (!cardEl || state.reducedMotion) return;
    cardEl.classList.remove("sium-card-activated");
    void cardEl.offsetWidth;
    cardEl.classList.add("sium-card-activated");
    var rect = cardEl.getBoundingClientRect();
    if (rect && rect.width > 0) {
      spawnClickSparks(
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + Math.min(rect.height / 2, 120)),
        accentColor || "#f5d98e"
      );
    }
    setTimeout(function () {
      cardEl.classList.remove("sium-card-activated");
    }, 480);
  }

  function initClickBurst() {
    document.addEventListener("pointerdown", function (e) {
      if (!state.fxEnabled || state.reducedMotion) return;
      var target = e.target;
      if (!target || !target.closest) return;

      /* Animazione dedicata cliccando sulla Scheda dei PG (carte, caratteristiche, abilità, pallini, box) */
      var pgItem = target.closest(
        ".sium-pg-card, .sium-pg-stat-box, .sium-pg-ts-row, .sium-pg-skill-row, .sium-pg-bubble, .sium-pg-trait-box, .sium-pg-hdr-cell, .dnd-stat-box, .dnd-skill-row, .dnd-spell-circle"
      );
      if (pgItem) {
        pgItem.classList.remove("sium-pg-clicked");
        void pgItem.offsetWidth;
        pgItem.classList.add("sium-pg-clicked");
        spawnClickSparks(e.clientX, e.clientY, "#f5d98e");
        setTimeout(function () {
          pgItem.classList.remove("sium-pg-clicked");
        }, 520);
        return;
      }

      var insidePgSheet = target.closest(".sium-pg-page, .dnd-book-container");
      if (insidePgSheet) {
        var boxEl = target.closest("div[style*='border'], button, input, select, textarea");
        if (boxEl && boxEl !== insidePgSheet) {
          boxEl.classList.remove("sium-pg-click-feedback");
          void boxEl.offsetWidth;
          boxEl.classList.add("sium-pg-click-feedback");
          setTimeout(function () {
            boxEl.classList.remove("sium-pg-click-feedback");
          }, 440);
        }
        spawnClickSparks(e.clientX, e.clientY, "#f5d98e");
        return;
      }

      var interactive = target.closest(
        "button, .sidebar-item, .nav-item, .weapon-card, .cyber-card, .veicolo-card, .droga-card, .sium-spell-card, .sium-3d-dice-arena, .theme-toggle, .bacheca-btn"
      );
      if (!interactive) return;
      spawnClickSparks(e.clientX, e.clientY);
    }, { passive: true });
  }

  /* ==========================================================================
     4. INCLINAZIONE 3D (TILT) E SCIA DEL CURSORE
     ========================================================================== */
  function initCardTiltDelegation() {
    var activeCard = null;

    document.addEventListener("mousemove", function (e) {
      if (!state.fxEnabled || state.reducedMotion || window.innerWidth < 768) return;

      var card = e.target && e.target.closest
        ? e.target.closest(".weapon-card, .cyber-card, .sium-spell-card, .panel-glass.tilt-enabled, .bacheca-item")
        : null;

      if (activeCard && activeCard !== card) {
        resetCardTilt(activeCard);
        activeCard = null;
      }

      if (!card) return;
      activeCard = card;
      card.classList.add("sium-tilt-card");

      var rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      var relX = e.clientX - rect.left;
      var relY = e.clientY - rect.top;
      var pctX = (relX / rect.width) - 0.5;
      var pctY = (relY / rect.height) - 0.5;

      var rotX = (-pctY * CONFIG.tiltMaxDeg * 2).toFixed(2);
      var rotY = (pctX * CONFIG.tiltMaxDeg * 2).toFixed(2);

      card.style.setProperty("--mouse-x", Math.round(relX) + "px");
      card.style.setProperty("--mouse-y", Math.round(relY) + "px");
      card.style.transform =
        "perspective(900px) rotateX(" + rotX + "deg) rotateY(" + rotY + "deg) translateY(-4px)";
    }, { passive: true });

    document.addEventListener("mouseleave", function () {
      if (activeCard) {
        resetCardTilt(activeCard);
        activeCard = null;
      }
    }, { passive: true });
  }

  function resetCardTilt(card) {
    if (!card) return;
    card.style.transform = "";
  }

  function initCursorTrail() {
    if (window.innerWidth < 768) return;
    var dots = [];
    var mouse = { x: -100, y: -100 };

    for (var i = 0; i < CONFIG.cursorTrailLength; i++) {
      var d = document.createElement("div");
      d.className = "sium-cursor-trail-dot";
      d.style.opacity = String((1 - i / CONFIG.cursorTrailLength) * 0.52);
      var size = Math.max(2.5, 6.5 - i * 0.6);
      d.style.width = size + "px";
      d.style.height = size + "px";
      document.body.appendChild(d);
      dots.push({ el: d, x: -100, y: -100 });
    }

    window.addEventListener("mousemove", function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }, { passive: true });

    function updateTrail() {
      if (state.fxEnabled && !state.reducedMotion && !document.hidden) {
        var tx = mouse.x;
        var ty = mouse.y;
        for (var i = 0; i < dots.length; i++) {
          var dot = dots[i];
          dot.x += (tx - dot.x) * 0.36;
          dot.y += (ty - dot.y) * 0.36;
          dot.el.style.left = dot.x + "px";
          dot.el.style.top = dot.y + "px";
          tx = dot.x;
          ty = dot.y;
        }
      }
      requestAnimationFrame(updateTrail);
    }
    requestAnimationFrame(updateTrail);
  }

  /* ==========================================================================
     5. ARALDO DI SEZIONE E RIVELAZIONE SCAGLIONATA UNIVERSALE
     ========================================================================== */
  function showSectionHerald(sectionId) {
    if (state.reducedMotion) return;
    var meta = SECTION_META[sectionId];
    if (!meta) return;

    if (!state.heraldEl) {
      var el = document.createElement("div");
      el.className = "sium-section-herald";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML =
        '<div class="sium-section-herald-kicker"></div>' +
        '<div class="sium-section-herald-title"></div>' +
        '<div class="sium-section-herald-line"></div>';
      document.body.appendChild(el);
      state.heraldEl = el;
    }

    var kicker = state.heraldEl.querySelector(".sium-section-herald-kicker");
    var title = state.heraldEl.querySelector(".sium-section-herald-title");
    if (kicker) kicker.textContent = "❖ " + meta.kicker + " ❖";
    if (title) title.textContent = meta.icon + " " + meta.title;

    state.heraldEl.classList.remove("is-showing");
    void state.heraldEl.offsetWidth;
    state.heraldEl.classList.add("is-showing");
  }

  function initScrollReveal() {
    var isAutomated = !!(navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || ""));

    if ("IntersectionObserver" in window && !isAutomated) {
      state.observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            state.observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05, rootMargin: "0px 0px -10px 0px" });
    }

    scanAndRevealNewNodes();

    if ("MutationObserver" in window && document.body) {
      var debounceTimer = null;
      state.mutationObserver = new MutationObserver(function () {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scanAndRevealNewNodes, 35);
      });
      state.mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function scanAndRevealNewNodes() {
    var main = document.getElementById("main-content");
    if (!main) return;

    var curSec = window.state && window.state.section ? window.state.section : null;
    if (curSec && curSec !== state.lastSection) {
      if (state.lastSection !== null) {
        showSectionHerald(curSec);
      }
      state.lastSection = curSec;
    }

    if (main.firstElementChild && !main.firstElementChild.dataset.siumSecAnim) {
      main.firstElementChild.dataset.siumSecAnim = "1";
      main.firstElementChild.classList.add("sium-section-transition");
    }

    var headings = main.querySelectorAll("h1:not([data-sium-h]), .section-title:not([data-sium-h])");
    headings.forEach(function (h) {
      h.dataset.siumH = "1";
      h.classList.add("sium-rune-title");
    });

    var selector = [
      ".weapon-card:not([data-sium-rev])",
      ".cyber-card:not([data-sium-rev])",
      ".sium-spell-card:not([data-sium-rev])",
      ".panel-glass:not([data-sium-rev])",
      ".regole-card:not([data-sium-rev])",
      ".fazione-card:not([data-sium-rev])",
      ".bacheca-item:not([data-sium-rev])",
      ".caos-row:not([data-sium-rev])",
      ".init-row:not([data-sium-rev])"
    ].join(", ");

    var items = main.querySelectorAll(selector);
    var isAutomated = !!(navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || ""));

    items.forEach(function (el, index) {
      el.dataset.siumRev = "1";
      el.style.setProperty("--stagger-idx", String(index % 12));
      el.classList.add("sium-reveal");
      if (state.observer && !state.reducedMotion && state.fxEnabled && !isAutomated) {
        state.observer.observe(el);
      } else {
        el.classList.add("is-visible");
      }
      setTimeout(function () {
        el.classList.add("is-visible");
      }, 280 + (index % 12) * 35);
    });
  }

  /* ==========================================================================
     6. COSTRUTTORE E LANCIATORE DADI IPER-DIMENSIONALE 4D
     ========================================================================== */
  function getPolyhedronInnerSVG(faces, labelText, strokeColor, fillGradId) {
    var numStr = labelText !== null && labelText !== undefined ? String(labelText) : "";
    var fontSize = numStr.length >= 3 ? "20" : numStr.length === 2 ? "25" : "30";

    var shapes = "";
    if (faces === 4) {
      shapes =
        '<polygon points="50,8 92,84 8,84" fill="url(#' + fillGradId + ')" stroke="' + strokeColor + '" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<line x1="50" y1="8" x2="50" y2="58" stroke="' + strokeColor + '" stroke-width="1.3" opacity="0.65"/>' +
        '<line x1="50" y1="58" x2="8" y2="84" stroke="' + strokeColor + '" stroke-width="1.3" opacity="0.65"/>' +
        '<line x1="50" y1="58" x2="92" y2="84" stroke="' + strokeColor + '" stroke-width="1.3" opacity="0.65"/>';
    } else if (faces === 8) {
      shapes =
        '<polygon points="50,6 92,50 50,94 8,50" fill="url(#' + fillGradId + ')" stroke="' + strokeColor + '" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<line x1="8" y1="50" x2="92" y2="50" stroke="' + strokeColor + '" stroke-width="1.4" opacity="0.65"/>' +
        '<line x1="50" y1="6" x2="50" y2="94" stroke="' + strokeColor + '" stroke-width="1.4" opacity="0.48"/>';
    } else if (faces === 10 || faces === 100) {
      shapes =
        '<polygon points="50,5 92,42 74,93 26,93 8,42" fill="url(#' + fillGradId + ')" stroke="' + strokeColor + '" stroke-width="2.3" stroke-linejoin="round"/>' +
        '<polyline points="8,42 50,58 92,42" fill="none" stroke="' + strokeColor + '" stroke-width="1.3" opacity="0.65"/>' +
        '<line x1="50" y1="5" x2="50" y2="58" stroke="' + strokeColor + '" stroke-width="1.3" opacity="0.65"/>' +
        '<line x1="50" y1="58" x2="26" y2="93" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.5"/>' +
        '<line x1="50" y1="58" x2="74" y2="93" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.5"/>';
    } else if (faces === 12) {
      shapes =
        '<polygon points="50,6 86,22 95,60 72,92 28,92 5,60 14,22" fill="url(#' + fillGradId + ')" stroke="' + strokeColor + '" stroke-width="2.3" stroke-linejoin="round"/>' +
        '<polygon points="50,24 74,41 65,71 35,71 26,41" fill="none" stroke="' + strokeColor + '" stroke-width="1.4" opacity="0.68"/>' +
        '<line x1="50" y1="6" x2="50" y2="24" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.55"/>' +
        '<line x1="86" y1="22" x2="74" y2="41" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.55"/>' +
        '<line x1="95" y1="60" x2="65" y2="71" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.55"/>' +
        '<line x1="28" y1="92" x2="35" y2="71" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.55"/>' +
        '<line x1="5" y1="60" x2="26" y2="41" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.55"/>' +
        '<line x1="14" y1="22" x2="26" y2="41" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.55"/>';
    } else {
      /* Default: Icosaedro d20 */
      shapes =
        '<polygon points="50,5 91,28 91,72 50,95 9,72 9,28" fill="url(#' + fillGradId + ')" stroke="' + strokeColor + '" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<polygon points="50,21 77,67 23,67" fill="none" stroke="' + strokeColor + '" stroke-width="1.5" opacity="0.78"/>' +
        '<line x1="50" y1="5" x2="50" y2="21" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.6"/>' +
        '<line x1="91" y1="28" x2="50" y2="21" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.55"/>' +
        '<line x1="9" y1="28" x2="50" y2="21" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.55"/>' +
        '<line x1="91" y1="72" x2="77" y2="67" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.6"/>' +
        '<line x1="9" y1="72" x2="23" y2="67" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.6"/>' +
        '<line x1="50" y1="95" x2="77" y2="67" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.55"/>' +
        '<line x1="50" y1="95" x2="23" y2="67" stroke="' + strokeColor + '" stroke-width="1.2" opacity="0.55"/>';
    }

    var isHw = getCurrentTheme() === "halloween";
    var stop1 = isHw ? "#0d2647" : "#3a2816";
    var stop2 = isHw ? "#051124" : "#1b120b";
    var stop3 = isHw ? "#02060d" : "#0c0805";
    var numFill = isHw ? "#a6ffcb" : "#fff3c4";
    var textY = faces === 4 ? "69" : "58";
    return (
      '<svg viewBox="0 0 100 100" width="96" height="96" style="overflow:visible;display:block;">' +
        '<defs>' +
          '<linearGradient id="' + fillGradId + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="' + stop1 + '" stop-opacity="0.96"/>' +
            '<stop offset="55%" stop-color="' + stop2 + '" stop-opacity="0.98"/>' +
            '<stop offset="100%" stop-color="' + stop3 + '" stop-opacity="0.99"/>' +
          '</linearGradient>' +
        '</defs>' +
        shapes +
        (numStr
          ? '<text class="sium-die-svg-num" x="50" y="' + textY + '" text-anchor="middle" fill="' + numFill + '" font-family="Cinzel, serif" font-weight="900" font-size="' + fontSize + '" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.95));">' + numStr + '</text>'
          : "") +
      '</svg>'
    );
  }

  /**
   * Costruisce un vero dado 3D fisico per qualsiasi taglio (d4, d6, d8, d10, d12, d20, d100).
   * Separa il binario parabolico di lancio/rimbalzo (.sium-die-throw-track) dalla rotazione
   * continua 3D (.sium-die-3d-rig) per un rotolamento totalmente fluido a 60fps senza scatti.
   */
  function build3DDieElement(faces, value, isRolling, isCrit, isFail, finalTargetVal) {
    var slot = document.createElement("div");
    slot.className = "sium-die-3d-slot " + (isRolling ? "is-rolling" : "is-idle");
    if (isCrit) slot.classList.add("is-crit");
    if (isFail) slot.classList.add("is-fail");

    /* Coordinate fisiche di lancio (da sinistra o destra verso il centro del tavolo) */
    var dirX = Math.random() > 0.5 ? -1 : 1;
    var throwX = dirX * (135 + Math.floor(Math.random() * 50));
    var throwY = -(85 + Math.floor(Math.random() * 35));
    /* Multipli esatti di 360° in modo che a fine rotolamento (0deg, 0deg, 0deg) la faccia frontale sia perfettamente allineata */
    var spinX = -(3 + Math.floor(Math.random() * 2)) * 360;
    var spinY = dirX * (4 + Math.floor(Math.random() * 2)) * 360;
    var spinZ = dirX * (2 + Math.floor(Math.random() * 2)) * 360;

    slot.style.setProperty("--throw-x", throwX + "px");
    slot.style.setProperty("--throw-y", throwY + "px");
    slot.style.setProperty("--spin-x", spinX + "deg");
    slot.style.setProperty("--spin-y", spinY + "deg");
    slot.style.setProperty("--spin-z", spinZ + "deg");

    /* Ombra dinamica sul panno */
    var shadow = document.createElement("div");
    shadow.className = "sium-die-3d-shadow";
    slot.appendChild(shadow);

    /* Anello d'impatto sul tavolo */
    var ring = document.createElement("div");
    ring.className = "sium-die-impact-ring";
    slot.appendChild(ring);

    /* Binario di lancio e rimbalzo parabolico */
    var track = document.createElement("div");
    track.className = "sium-die-throw-track";

    /* Rig di rotolamento 3D continuo */
    var rig = document.createElement("div");
    rig.className = "sium-die-3d-rig";

    var strokeColor = isCrit ? "#fde047" : isFail ? "#f87171" : "#d8b25c";
    var uid = "dg_" + faces + "_" + Math.floor(Math.random() * 99999);
    var targetNumber = (finalTargetVal !== undefined && finalTargetVal !== null)
      ? finalTargetVal
      : (value !== null && value !== undefined ? value : faces);

    if (faces === 6) {
      /* Cubo 3D reale a 6 facce con backface-visibility: hidden */
      var base6 = Number(targetNumber) || 6;
      var faceConfigs = [
        { cls: "face-front",  num: base6 },
        { cls: "face-back",   num: Math.max(1, 7 - base6) },
        { cls: "face-right",  num: (base6 % 6) + 1 },
        { cls: "face-left",   num: ((base6 + 3) % 6) + 1 },
        { cls: "face-top",    num: ((base6 + 1) % 6) + 1 },
        { cls: "face-bottom", num: ((base6 + 4) % 6) + 1 }
      ];
      faceConfigs.forEach(function (fc) {
        var f = document.createElement("div");
        f.className = "sium-die-cube-face " + fc.cls;
        if (isCrit || isFail) f.style.borderColor = strokeColor;
        f.textContent = String(fc.num);
        rig.appendChild(f);
      });
    } else {
      /* Vero Corpo Poliedrico 3D sfaccettato (d4, d8, d10, d12, d20, d100) */
      var body3d = document.createElement("div");
      body3d.className = "sium-true-die-3d";

      var core = document.createElement("div");
      core.className = "sium-die-core-3d";
      body3d.appendChild(core);

      var baseNum = Number(targetNumber) || faces;
      var oppVal = Math.max(1, faces + 1 - baseNum);
      var polyFaces = [
        { cls: "face-front",  num: baseNum },
        { cls: "face-back",   num: oppVal },
        { cls: "face-right",  num: ((baseNum + 1) % faces) + 1 },
        { cls: "face-left",   num: ((baseNum + Math.floor(faces / 2)) % faces) + 1 },
        { cls: "face-top",    num: ((baseNum + 2) % faces) + 1 },
        { cls: "face-bottom", num: ((baseNum + Math.floor(faces / 3)) % faces) + 1 }
      ];
      polyFaces.forEach(function (pf, idx) {
        var faceEl = document.createElement("div");
        faceEl.className = "sium-die-face-3d " + pf.cls;
        faceEl.innerHTML = getPolyhedronInnerSVG(faces, pf.num, strokeColor, uid + "_pf" + idx);
        body3d.appendChild(faceEl);
      });
      rig.appendChild(body3d);
    }

    track.appendChild(rig);
    slot.appendChild(track);

    /* Durante i primi istanti del rotolamento aggiorniamo fluidamente le facce prima che si fermi sul valore finale */
    if (isRolling) {
      var frontNumEl = slot.querySelector(".face-front .sium-die-svg-num") || slot.querySelector(".face-front");
      if (frontNumEl) {
        var steps = [80, 170, 270, 390, 520, 660];
        steps.forEach(function (ms, idx) {
          setTimeout(function () {
            if (!slot.isConnected) return;
            if (idx === steps.length - 1) {
              frontNumEl.textContent = String(targetNumber);
            } else {
              var rnd = Math.floor(Math.random() * faces) + 1;
              frontNumEl.textContent = String(rnd);
            }
          }, ms);
        });
      }
    }

    return slot;
  }

  /* ==========================================================================
     7. CERIMONIA DI CHIUSURA FLUIDA ED EFFETTI MODALI (EMPORIO & INCANTESIMI)
     ========================================================================== */
  function closeModalAnimated(backdropEl, onAfterClose) {
    if (!backdropEl) return;
    if (backdropEl.dataset.siumClosing === "1") return;
    backdropEl.dataset.siumClosing = "1";

    var isFast = !!(navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || ""));
    if (isFast || state.reducedMotion) {
      backdropEl.remove();
      if (typeof onAfterClose === "function") onAfterClose();
      return;
    }

    backdropEl.classList.add("is-closing");
    setTimeout(function () {
      if (backdropEl.parentNode) backdropEl.remove();
      if (typeof onAfterClose === "function") onAfterClose();
    }, 260);
  }

  function getRarityAuraColor(rarita) {
    var key = String(rarita || "comune").trim().toLowerCase();
    return RARITY_AURA_MAP[key] || "#d8b25c";
  }

  function getSpellSchoolTheme(scuola) {
    var s = String(scuola || "").trim().toLowerCase();
    for (var k in SPELL_SCHOOL_THEMES) {
      if (k !== "default" && s.indexOf(k) >= 0) {
        return SPELL_SCHOOL_THEMES[k];
      }
    }
    return SPELL_SCHOOL_THEMES.default;
  }

  /**
   * Arricchisce la modale di dettaglio dell'Emporio / Bestiario con:
   * - Sigillo Arcano rotante dietro l'immagine
   * - Scintille magiche fluttuanti
   * - Inclinazione 3D sull'immagine
   * - Pulsante "Esamina Aura 360°"
   * - Rivelazione scaglionata dei contenuti
   */
  function enhanceRelicModal(backdropEl, type, data) {
    if (!backdropEl || !data) return;
    var panel = backdropEl.querySelector(".detail-modal-panel, .modal-panel");
    if (!panel) return;

    var auraColor = type === "mostro" ? "#e05050" : getRarityAuraColor(data.rarita);
    panel.style.setProperty("--relic-aura", auraColor);
    panel.style.boxShadow = "0 24px 70px rgba(0,0,0,0.88), 0 0 42px " + auraColor + "44";

    var imgWrap = panel.querySelector(".detail-modal-img-wrap");
    if (imgWrap) {
      imgWrap.style.setProperty("--relic-aura", auraColor);

      /* Sigillo Arcano SVG rotante dietro la reliquia */
      var sealSvg = document.createElement("div");
      sealSvg.className = "sium-relic-seal-bg";
      sealSvg.innerHTML =
        '<svg viewBox="0 0 200 200" width="100%" height="100%">' +
          '<circle cx="100" cy="100" r="88" fill="none" stroke="' + auraColor + '" stroke-width="1.2" stroke-dasharray="6 4"/>' +
          '<circle cx="100" cy="100" r="72" fill="none" stroke="' + auraColor + '" stroke-width="0.9"/>' +
          '<polygon points="100,16 184,100 100,184 16,100" fill="none" stroke="' + auraColor + '" stroke-width="1"/>' +
          '<polygon points="100,16 184,100 100,184 16,100" fill="none" stroke="' + auraColor + '" stroke-width="1" transform="rotate(45 100 100)"/>' +
        '</svg>';
      imgWrap.prepend(sealSvg);

      /* Scintille fluttuanti dentro il quadro dell'oggetto */
      for (var m = 0; m < 5; m++) {
        var mote = document.createElement("div");
        mote.className = "sium-relic-mote";
        mote.style.left = (15 + m * 18) + "%";
        mote.style.bottom = (8 + (m % 3) * 12) + "%";
        mote.style.animationDelay = (m * 0.45) + "s";
        imgWrap.appendChild(mote);
      }

      /* Tilt 3D interattivo sul ritratto dell'oggetto */
      imgWrap.addEventListener("mousemove", function (e) {
        if (state.reducedMotion) return;
        var r = imgWrap.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        imgWrap.style.transform =
          "perspective(700px) rotateX(" + (-py * 14).toFixed(1) + "deg) rotateY(" + (px * 14).toFixed(1) + "deg) scale(1.03)";
      });
      imgWrap.addEventListener("mouseleave", function () {
        imgWrap.style.transform = "";
      });

      /* Pulsante interattivo "Esamina Reliquia 360°" */
      if (imgWrap.parentNode) {
        var inspectBtn = document.createElement("button");
        inspectBtn.type = "button";
        inspectBtn.className = "sium-arcane-action-btn";
        inspectBtn.style.setProperty("--relic-aura", auraColor);
        inspectBtn.innerHTML = type === "mostro" ? "👁️ Percepisci Aura Creatura" : "✨ Esamina Reliquia in 3D";
        inspectBtn.onclick = function (ev) {
          ev.stopPropagation();
          imgWrap.classList.remove("is-inspecting-360");
          void imgWrap.offsetWidth;
          imgWrap.classList.add("is-inspecting-360");
          var rect = inspectBtn.getBoundingClientRect();
          spawnClickSparks(rect.left + rect.width / 2, rect.top, auraColor);
        };
        imgWrap.parentNode.appendChild(inspectBtn);
      }
    }

    /* Rivelazione scaglionata degli elementi testuali della modale */
    var staggerEls = panel.querySelectorAll("h2, .type-chip, .rarity-tag, p, .detail-modal-grid > div > div");
    staggerEls.forEach(function (el, idx) {
      el.style.setProperty("--m-idx", String(Math.min(idx, 10)));
      el.classList.add("sium-modal-stagger");
    });
  }

  /**
   * Modale Reliquiario / Ologramma 3D per tutte le sotto-sezioni dell'Emporio:
   * Droghe, Veicoli, Laboratorio Cibernetico, Potenziamenti, Munizioni.
   */
  function openEmporioSubItemModal(category, item, accentColor) {
    if (!item) return;
    var existing = document.getElementById("emporio-sub-modal-root");
    if (existing) existing.remove();

    var aura = accentColor || "#d8b25c";
    var back = document.createElement("div");
    back.className = "modal-backdrop";
    back.id = "emporio-sub-modal-root";

    var kh = function (e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", kh);
        closeModalAnimated(back);
      }
    };
    document.addEventListener("keydown", kh);
    back.onclick = function (e) {
      if (e.target === back) {
        document.removeEventListener("keydown", kh);
        closeModalAnimated(back);
      }
    };

    var panel = document.createElement("div");
    panel.className = "detail-modal-panel";
    panel.style.setProperty("--relic-aura", aura);
    panel.style.borderColor = aura;
    panel.onclick = function (e) { e.stopPropagation(); };

    /* Header */
    var head = document.createElement("div");
    head.className = "modal-head";
    head.style.borderBottomColor = aura + "55";

    var headLeft = document.createElement("div");
    var catKicker = document.createElement("div");
    catKicker.style.cssText =
      "font-family:var(--font-display);font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:" + aura + ";margin-bottom:0.3rem;";
    catKicker.textContent = "❖ EMPORIO · " + String(category || "CATALOGO").toUpperCase();
    headLeft.appendChild(catKicker);

    var titleEl = document.createElement("h2");
    titleEl.style.cssText = "font-family:'Cinzel',serif;font-size:23px;font-weight:800;color:var(--text-primary);margin:0;";
    titleEl.textContent = item.nome || "Oggetto speciale";
    headLeft.appendChild(titleEl);

    var closeBtn = document.createElement("button");
    closeBtn.className = "theme-toggle";
    closeBtn.style.cssText = "width:38px;height:38px;flex-shrink:0;";
    closeBtn.textContent = "✕";
    closeBtn.onclick = function () {
      document.removeEventListener("keydown", kh);
      closeModalAnimated(back);
    };

    head.appendChild(headLeft);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    /* Body */
    var body = document.createElement("div");
    body.style.cssText = "padding:1.5rem;";

    var imgSrc = item.immagine || (item.immagini && item.immagini[0]) || "";
    var grid = document.createElement("div");
    grid.className = imgSrc ? "detail-modal-grid" : "";

    if (imgSrc) {
      var leftCol = document.createElement("div");
      var imgWrap = document.createElement("div");
      imgWrap.className = "detail-modal-img-wrap";
      var im = document.createElement("img");
      im.src = imgSrc;
      im.alt = item.nome || "";
      imgWrap.appendChild(im);
      leftCol.appendChild(imgWrap);
      grid.appendChild(leftCol);
    }

    var rightCol = document.createElement("div");
    var metaRows = [
      ["Tipo / Categoria", item.tipo],
      ["Rarità", item.rarita],
      ["Installazione", item.installazione],
      ["TS Dipendenza", item.tsDipendenza],
      ["Velocità", item.velocita],
      ["Equipaggio / Passeggeri", item.equipaggio],
      ["Classe Armatura (CA)", item.ca],
      ["Punti Ferita (PF)", item.pf],
      ["Danni", item.danni],
      ["Gittata", item.gittata],
      ["Munizioni", item.munizioni],
      ["Costo / Prezzo", item.costo ? item.costo + " " + (item.valuta || "mo") : item.prezzo ? item.prezzo + " " + (item.valuta || "mo") : ""]
    ];

    var statGrid = document.createElement("div");
    statGrid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.65rem;margin-bottom:1.2rem;";
    metaRows.forEach(function (pair) {
      if (!pair[1]) return;
      var cell = document.createElement("div");
      cell.style.cssText = "padding:0.55rem 0.75rem;background:rgba(255,255,255,0.03);border:1px solid " + aura + "33;border-radius:6px;";
      cell.innerHTML =
        '<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:' + aura + ';margin-bottom:0.2rem;">' + pair[0] + '</div>' +
        '<div style="font-size:15px;font-weight:700;color:var(--text-primary);">' + String(pair[1]) + '</div>';
      statGrid.appendChild(cell);
    });
    if (statGrid.children.length) rightCol.appendChild(statGrid);

    var textBlocks = [
      ["Descrizione & Specifiche", item.descrizione],
      ["Effetto", item.effetto],
      ["Effetti Collaterali / Malus", item.effettiCollaterali || item.malus]
    ];
    textBlocks.forEach(function (tb) {
      if (!tb[1]) return;
      var sec = document.createElement("div");
      sec.style.cssText = "margin-top:0.9rem;padding-top:0.9rem;border-top:1px solid var(--border-subtle);";
      var h = document.createElement("div");
      h.style.cssText = "font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:" + aura + ";margin-bottom:0.4rem;";
      h.textContent = tb[0];
      var p = document.createElement("div");
      p.style.cssText = "font-size:16px;line-height:1.75;color:var(--text-main);white-space:pre-wrap;";
      p.textContent = tb[1];
      sec.appendChild(h);
      sec.appendChild(p);
      rightCol.appendChild(sec);
    });

    grid.appendChild(rightCol);
    body.appendChild(grid);
    panel.appendChild(body);
    back.appendChild(panel);
    document.body.appendChild(back);

    enhanceRelicModal(back, "arma", { rarita: item.rarita || "Raro" });
    panel.style.setProperty("--relic-aura", aura);
  }

  /**
   * Arricchisce la modale degli Incantesimi Aggiuntivi (_openIncantesimoDetail)
   * con Cerchio Magico della Scuola, Stelle del Livello e pulsante "Canalizza Incantesimo".
   */
  function enhanceSpellModal(overlayEl, panelEl, s) {
    if (!overlayEl || !panelEl || !s) return;
    var theme = getSpellSchoolTheme(s.scuola);
    overlayEl.className = "sium-spell-modal-backdrop modal-backdrop";
    panelEl.className = "sium-spell-modal-panel";
    panelEl.style.setProperty("--spell-color", theme.color);
    panelEl.style.setProperty("--spell-glow", theme.glow);

    /* Watermark SVG del Cerchio Magico della Scuola */
    var watermark = document.createElement("div");
    watermark.className = "sium-spell-sigil-watermark";
    watermark.innerHTML =
      '<svg viewBox="0 0 200 200" width="100%" height="100%">' +
        '<circle cx="100" cy="100" r="90" fill="none" stroke="' + theme.color + '" stroke-width="1.5" stroke-dasharray="8 4"/>' +
        '<circle cx="100" cy="100" r="74" fill="none" stroke="' + theme.color + '" stroke-width="1"/>' +
        '<polygon points="100,14 176,146 24,146" fill="none" stroke="' + theme.color + '" stroke-width="1.2"/>' +
        '<polygon points="100,186 176,54 24,54" fill="none" stroke="' + theme.color + '" stroke-width="1.2"/>' +
        '<circle cx="100" cy="100" r="36" fill="none" stroke="' + theme.color + '" stroke-width="1" stroke-dasharray="3 3"/>' +
      '</svg>';
    panelEl.prepend(watermark);

    /* Rivelazione scaglionata su tutti i blocchi della modale incantesimo */
    var children = panelEl.querySelectorAll("div > div");
    children.forEach(function (el, idx) {
      if (idx < 14) {
        el.style.setProperty("--m-idx", String(idx));
        el.classList.add("sium-modal-stagger");
      }
    });

    /* Pulsante "✨ Canalizza Incantesimo" con vortice runico */
    var actionWrap = document.createElement("div");
    actionWrap.style.cssText = "padding: 0 1.5rem 1.4rem; position: relative; z-index: 2;";
    var castBtn = document.createElement("button");
    castBtn.type = "button";
    castBtn.className = "sium-arcane-action-btn";
    castBtn.style.setProperty("--relic-aura", theme.color);
    castBtn.innerHTML = theme.icon + " Canalizza Incantesimo (" + (s.nome || "Arcano") + ")";
    castBtn.onclick = function (e) {
      e.stopPropagation();
      panelEl.classList.remove("is-casting");
      void panelEl.offsetWidth;
      panelEl.classList.add("is-casting");

      var rect = castBtn.getBoundingClientRect();
      spawnClickSparks(rect.left + rect.width / 2, rect.top, theme.color);

      var runes = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᛉ", "", "✦", theme.icon];
      for (var i = 0; i < 10; i++) {
        var rEl = document.createElement("div");
        rEl.className = "sium-spell-cast-rune";
        rEl.textContent = runes[i % runes.length];
        rEl.style.left = (15 + Math.random() * 70) + "%";
        rEl.style.bottom = "24px";
        rEl.style.fontSize = (14 + Math.floor(Math.random() * 10)) + "px";
        rEl.style.setProperty("--rx", Math.round((Math.random() - 0.5) * 90) + "px");
        panelEl.appendChild(rEl);
        (function (node) {
          setTimeout(function () {
            if (node.parentNode) node.remove();
          }, 1200);
        })(rEl);
      }
    };
    actionWrap.appendChild(castBtn);
    panelEl.appendChild(actionWrap);
  }

  /* ==========================================================================
     8. BARRA SUPERIORE CON SELETTORE TEMA + SPEGNI/ACCENDI ANIMAZIONI + D20
     ========================================================================== */
  function createTopControlsBar() {
    if (document.getElementById("sium-top-controls")) {
      updateFxToggleButtons();
      updateThemeButtons();
      return;
    }

    var bar = document.createElement("div");
    bar.id = "sium-top-controls";
    bar.className = "sium-top-controls";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Controlli tema e animazioni");

    /* Bottone Selettore Tema (Normale Scuro / Normale Chiaro / Halloween / Natale / San Valentino / Pasqua) */
    var curMeta = getThemeMeta(getCurrentTheme());
    var themeBtn = document.createElement("button");
    themeBtn.type = "button";
    themeBtn.id = "sium-theme-picker-top";
    themeBtn.className = "sium-ctrl-btn sium-theme-picker-btn" + ((curMeta.id === "halloween" || curMeta.id === "christmas" || curMeta.id === "valentine" || curMeta.id === "easter") ? " active" : "");
    themeBtn.innerHTML = '<span>' + curMeta.icon + '</span><span class="theme-btn-label">' + curMeta.label + '</span>';
    themeBtn.onclick = function (e) {
      e.stopPropagation();
      toggleThemePickerMenu(themeBtn);
    };
    bar.appendChild(themeBtn);

    /* Bottone Spegni/Accendi Animazioni */
    var fxBtn = document.createElement("button");
    fxBtn.type = "button";
    fxBtn.id = "sium-fx-toggle-top";
    fxBtn.className = "sium-ctrl-btn sium-fx-toggle-btn" + (state.fxEnabled ? " active" : "");
    fxBtn.innerHTML = state.fxEnabled
      ? '<span>✨</span><span class="fx-label">Animazioni: ON</span>'
      : '<span>💤</span><span class="fx-label">Animazioni: OFF</span>';
    fxBtn.onclick = function (e) {
      e.stopPropagation();
      toggleFx();
    };
    bar.appendChild(fxBtn);

    document.body.appendChild(bar);

    /* Menu Popover per la scelta del Tema */
    if (!document.getElementById("sium-theme-picker-menu")) {
      var menu = document.createElement("div");
      menu.id = "sium-theme-picker-menu";
      menu.className = "sium-theme-picker-menu";
      menu.onclick = function (e) { e.stopPropagation(); };

      var hdr = document.createElement("div");
      hdr.className = "sium-theme-picker-header";
      hdr.innerHTML = '<span>🎨 Scegli il Tema</span><span style="opacity:0.7;">✦</span>';
      menu.appendChild(hdr);

      var themeChoices = [
        {
          id: "dark",
          icon: "🌙",
          title: "Normale — Scuro",
          sub: "Taverna arcana, cuoio, oro e lucette",
          swatches: ["#0b0907", "#221a14", "#d8b25c"]
        },
        {
          id: "light",
          icon: "☀️",
          title: "Normale — Chiaro",
          sub: "Pergamena antica, bronzo e inchiostro",
          swatches: ["#f3ead8", "#e8dcc4", "#8c5d19"]
        },
        {
          id: "halloween",
          icon: "🎃",
          title: "Halloween Spettrale",
          sub: "Nero abissale, viola cupo & arancio con zucche, tombe e ragnatele",
          swatches: ["#05020a", "#160a2c", "#a855f7"]
        },
        {
          id: "christmas",
          icon: "🎄",
          title: "Natale Magico",
          sub: "Neve, Babbi Natale, alberi, pupazzi, biscotti, caramelle e lucette",
          swatches: ["#061b12", "#ef233c", "#ffd56b"]
        },
        {
          id: "valentine",
          icon: "💘",
          title: "San Valentino Amoroso",
          sub: "Cupido, cuoricini fluttuanti, rose, pizzi e frecce d'amore",
          swatches: ["#1d050f", "#ff4d8d", "#ffb3d1"]
        },
        {
          id: "easter",
          icon: "🐰",
          title: "Pasqua Fiorita",
          sub: "Uova di Pasqua dipinte, coniglietti, pulcini, fiori e prato",
          swatches: ["#0b2116", "#f472b6", "#facc15"]
        }
      ];

      themeChoices.forEach(function (tc) {
        var opt = document.createElement("button");
        opt.type = "button";
        opt.className = "sium-theme-option" + (getCurrentTheme() === tc.id ? " is-selected" : "");
        opt.setAttribute("data-theme-opt", tc.id);
        opt.innerHTML =
          '<span class="sium-theme-option-icon">' + tc.icon + '</span>' +
          '<span class="sium-theme-option-info">' +
            '<span class="sium-theme-option-title">' + tc.title + '</span>' +
            '<span class="sium-theme-option-sub">' + tc.sub + '</span>' +
          '</span>' +
          '<span class="sium-theme-option-swatch">' +
            tc.swatches.map(function (c) { return '<span style="background:' + c + ';"></span>'; }).join("") +
          '</span>';
        opt.onclick = function (e) {
          e.stopPropagation();
          setTheme(tc.id);
          menu.classList.remove("is-open");
        };
        menu.appendChild(opt);
      });

      document.body.appendChild(menu);

      document.addEventListener("click", function () {
        menu.classList.remove("is-open");
      });
    }

    updateFxToggleButtons();
    updateThemeButtons();
  }

  function createFloatingD20Roller() {
    if (document.getElementById("sium-floating-d20")) return;

    var container = document.createElement("div");
    container.id = "sium-floating-d20";
    container.style.cssText =
      "position:fixed;bottom:1.25rem;left:1.25rem;z-index:900;display:flex;align-items:center;gap:0.6rem;";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Lancia un dado D20 rapido");
    btn.title = "Lancio rapido D20 (clicca per tirare!)";
    btn.style.cssText =
      "width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#231a12,#120d09);" +
      "border:1px solid rgba(216,178,92,0.55);color:#f5d98e;cursor:pointer;display:flex;align-items:center;" +
      "justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,0.65),0 0 15px rgba(216,178,92,0.18);" +
      "transition:transform 0.25s ease,border-color 0.25s ease;";

    btn.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
      '<polygon points="12 2 21 7 21 17 12 22 3 17 3 7"></polygon>' +
      '<polyline points="12 2 12 12 21 7"></polyline>' +
      '<polyline points="3 7 12 12 12 22"></polyline>' +
      '<line x1="3" y1="17" x2="12" y2="12"></line>' +
      '<line x1="21" y1="17" x2="12" y2="12"></line>' +
      "</svg>";

    var badge = document.createElement("div");
    badge.id = "sium-floating-d20-result";
    badge.style.cssText =
      "padding:0.35rem 0.75rem;border-radius:8px;background:rgba(15,12,9,0.94);border:1px solid rgba(216,178,92,0.5);" +
      "color:#f5d98e;font-family:var(--font-display);font-size:12px;font-weight:700;letter-spacing:0.08em;" +
      "box-shadow:0 6px 20px rgba(0,0,0,0.6);opacity:0;transform:translateX(-8px);pointer-events:none;" +
      "transition:opacity 0.25s ease,transform 0.25s ease;white-space:nowrap;";

    var hideTimer = null;
    btn.addEventListener("click", function () {
      btn.style.transform = "rotate(360deg) scale(1.12)";
      setTimeout(function () {
        btn.style.transform = "";
      }, 420);

      var roll = Math.floor(Math.random() * 20) + 1;
      var label = "🎲 D20: " + roll;
      if (roll === 20) {
        label = "🌟 20 NATURALE! CRITICO!";
        badge.style.borderColor = "#fde047";
        badge.style.color = "#fde047";
      } else if (roll === 1) {
        label = "💀 1 NATURALE! FALLIMENTO!";
        badge.style.borderColor = "#f87171";
        badge.style.color = "#f87171";
      } else {
        badge.style.borderColor = "rgba(216,178,92,0.5)";
        badge.style.color = "#f5d98e";
      }

      badge.textContent = label;
      badge.style.opacity = "1";
      badge.style.transform = "translateX(0)";

      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        badge.style.opacity = "0";
        badge.style.transform = "translateX(-8px)";
      }, 3600);
    });

    container.appendChild(btn);
    container.appendChild(badge);
    document.body.appendChild(container);
  }

  /* ==========================================================================
     9. INIZIALIZZAZIONE GENERALE ED ESPORTAZIONE GLOBALE
     ========================================================================== */
  function init() {
    var loader = document.getElementById("sium-arcane-loader");
    if (loader) {
      loader.style.display = "none";
    }
    detectPreferences();
    createAmbientLayers();
    createTopControlsBar();
    if (state.fxEnabled && !state.reducedMotion) {
      startParticles();
    }
    initCardTiltDelegation();
    initClickBurst();
    initCursorTrail();
    initScrollReveal();
    createFloatingD20Roller();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.SiumAnimations = {
    SECTION_HERALDS: SECTION_META,
    onRender: function () {
      scanAndRevealNewNodes();
      updateFxToggleButtons();
      updateThemeButtons();
      populateFloatingEntities();
    },
    toggleFx: toggleFx,
    isFxEnabled: function () { return state.fxEnabled; },
    setTheme: setTheme,
    onThemeChange: onThemeChange,
    toggleThemePickerMenu: toggleThemePickerMenu,
    refreshReveal: scanAndRevealNewNodes,
    build3DDieElement: build3DDieElement,
    showSectionHerald: showSectionHerald,
    spawnClickSparks: spawnClickSparks,
    triggerCardClickPulse: triggerCardClickPulse,
    closeModalAnimated: closeModalAnimated,
    enhanceRelicModal: enhanceRelicModal,
    openEmporioSubItemModal: openEmporioSubItemModal,
    enhanceSpellModal: enhanceSpellModal,
    getSpellSchoolTheme: getSpellSchoolTheme
  };
})();
