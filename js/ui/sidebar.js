/* ============================================================================
   SEZIONE 3: NAVIGAZIONE LATERALE & MENU SEZIONI (renderSidebar)
   ============================================================================ */
function renderSidebar() {
  var sb = document.createElement('aside');
  sb.className = 'sidebar' + (state.sidebarOpen ? ' open' : '');
  sb.innerHTML =
    '<div class="sidebar-brand"><div class="brand-rune">\u269C</div><div class="brand-name">Mercante<br>Errante</div></div>';

  var campaignButton = document.createElement('button');
  campaignButton.type = 'button';
  campaignButton.className = 'nav-item';
  campaignButton.textContent = 'Cambia campagna · ' + CampaignManager.current.meta.name;
  campaignButton.onclick = function () {
    CampaignManager.showSelector();
    CampaignManager.load()
      .then(function () {
        CampaignManager.showSelector();
      })
      .catch(function (error) {
        var status = document.querySelector('#campaign-selector [role=status]');
        if (status) status.textContent = error.message;
      });
  };
  sb.appendChild(campaignButton);

  var sections = [
    { id: 'emporio', label: 'Emporio', icon: ICON.sword },
    {
      id: 'bestiario',
      label: isDM() ? 'Bestiario' : 'Pet del Party',
      icon: isDM()
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8 2 4 6 4 10c0 3 2 5 3 7l1 3h8l1-3c1-2 3-4 3-7 0-4-4-8-8-8z"/><path d="M9 17v3M15 17v3M9 21h6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    },
    {
      id: 'incantesimi',
      label: 'Incantesimi Aggiuntivi',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>',
    },
    {
      id: 'mappa',
      label: 'Mappa del Mondo',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>',
    },
    {
      id: 'worldbuilding',
      label: 'Worldbuilding',
      dmOnly: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    },
    {
      id: 'storia',
      label: 'Storia',
      dmOnly: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    },
    {
      id: 'archivio',
      label: 'Archivio Idee',
      dmOnly: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="7" x2="16" y2="7"/><line x1="12" y1="11" x2="16" y2="11"/></svg>',
    },
    { id: 'generatore', label: 'Generatore NPC', dmOnly: true, icon: ICON.npc },
    { id: 'iniziativa', label: 'Iniziativa', icon: ICON.swords },
    { id: 'caos', label: 'Statistiche & Caos', icon: ICON.skullDice },
    { id: 'note', label: 'Note di Sessione', icon: ICON.scroll, playerOnly: true },
    {
      id: 'scheda',
      label: 'Scheda PG',
      playerOnly: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    },
  ];
  sections.forEach(function (s) {
    // Nascondi sezioni dmOnly ai giocatori e sezioni playerOnly al DM
    if (s.dmOnly && !isDM()) return;
    if (s.playerOnly && isDM()) return;
    var item = document.createElement('div');
    item.className = 'nav-item' + (state.section === s.id ? ' active' : '');
    item.innerHTML = s.icon + '<span>' + s.label + '</span>';
    item.onclick = function () {
      state.section = s.id;
      state.sidebarOpen = false;
      renderMain();
    };
    sb.appendChild(item);
  });

  /* Separatore */
  var sep = document.createElement('div');
  sep.style.cssText = 'height:1px;background:var(--border-subtle);margin:0.5rem 0.75rem;';
  sb.appendChild(sep);

  /* Pulsante Regia Sonora — solo DM */
  if (isDM()) {
    var regiaItem = document.createElement('div');
    regiaItem.className = 'nav-item' + (state.regiaActive ? ' active' : '');
    regiaItem.style.cssText = state.regiaActive ? 'background:rgba(201,165,92,0.12);' : '';
    regiaItem.innerHTML = ICON.music + '<span>Regia Sonora</span>';
    if (state.regiaActive) {
      regiaItem.innerHTML +=
        '<span style="margin-left:auto;font-size:8px;font-family:\'Cinzel\',serif;color:var(--gold);letter-spacing:0.05em;">ON</span>';
    }
    regiaItem.onclick = function () {
      state.regiaActive = !state.regiaActive;
      state.sidebarOpen = false;
      render();
    };
    sb.appendChild(regiaItem);
  }

  /* Pulsante Lanciatore Dadi — visibile a tutti */
  var dadiIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>';
  var dadiItem = document.createElement('div');
  dadiItem.className = 'nav-item' + (state.section === 'dadi' ? ' active' : '');
  dadiItem.innerHTML = dadiIcon + '<span>Lanciatore Dadi</span>';
  dadiItem.onclick = function () {
    state.section = 'dadi';
    state.sidebarOpen = false;
    renderMain();
  };
  sb.appendChild(dadiItem);

  /* Pulsante Schede PG — solo DM */
  if (isDM()) {
    var schedePGIcon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    var schedePGItem = document.createElement('div');
    schedePGItem.className = 'nav-item' + (state.section === 'schedepg' ? ' active' : '');
    schedePGItem.innerHTML = schedePGIcon + '<span>Schede PG</span>';
    schedePGItem.onclick = function () {
      state.section = 'schedepg';
      state.sidebarOpen = false;
      renderMain();
    };
    sb.appendChild(schedePGItem);
  }

  /* Pulsante Libreria — visibile a tutti, ultimo prima del footer */
  var libriIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
  var libriItem = document.createElement('div');
  libriItem.className = 'nav-item' + (state.section === 'libri' ? ' active' : '');
  libriItem.innerHTML = libriIcon + '<span>Libreria</span>';
  libriItem.onclick = function () {
    state.section = 'libri';
    state.sidebarOpen = false;
    if (state.libriCustom === null) {
      state.libriCustom = {};
      _campaignDb &&
        _campaignDb.ref('libri/books').on('value', function (snap) {
          state.libriCustom = snap.val() || {};
          if (state.section === 'libri') renderMain();
        });
    }
    if (state.libriPreferiti === undefined) {
      state.libriPreferiti = {};
      var u = state.currentUser ? state.currentUser.username : '_guest';
      _campaignDb &&
        _campaignDb.ref('libri/preferiti/' + u).on('value', function (snap) {
          state.libriPreferiti = snap.val() || {};
          if (state.section === 'libri') renderMain();
        });
    }
    renderMain();
  };
  sb.appendChild(libriItem);

  /* Tavolo da Gioco */
  var tavoloIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="7" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg>';
  var tavoloItem = document.createElement('div');
  tavoloItem.className = 'nav-item' + (state.section === 'tavolo' ? ' active' : '');
  tavoloItem.innerHTML = tavoloIcon + '<span>Tavolo da Gioco</span>';
  tavoloItem.onclick = function () {
    state.section = 'tavolo';
    state.sidebarOpen = false;
    renderMain();
  };
  sb.appendChild(tavoloItem);

  var footer = document.createElement('div');
  footer.className = 'sidebar-footer';

  window.setAppTheme = function (newTheme, fromAnimEngine) {
    if (
      newTheme !== 'dark' &&
      newTheme !== 'light' &&
      newTheme !== 'halloween' &&
      newTheme !== 'christmas' &&
      newTheme !== 'valentine' &&
      newTheme !== 'easter'
    )
      newTheme = 'dark';
    state.theme = newTheme;
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem('sium_theme_mode', newTheme);
      localStorage.setItem('theme', newTheme);
    } catch (e) {}
    saveToStorage();
    render();
    if (
      !fromAnimEngine &&
      window.SiumAnimations &&
      typeof window.SiumAnimations.onThemeChange === 'function'
    ) {
      window.SiumAnimations.onThemeChange(newTheme);
    }
  };

  var footerControlsRow = document.createElement('div');
  footerControlsRow.style.cssText =
    'display:flex;align-items:center;justify-content:center;gap:0.45rem;width:100%;';

  var tb = document.createElement('button');
  tb.className = 'theme-toggle';
  tb.title = 'Alterna Modalità Chiara / Scura';
  tb.innerHTML = state.theme === 'light' ? ICON.moon : ICON.sun;
  tb.onclick = function () {
    var nextT = state.theme === 'dark' ? 'light' : 'dark';
    window.setAppTheme(nextT);
  };
  footerControlsRow.appendChild(tb);

  var themePickerSidebarBtn = document.createElement('button');
  themePickerSidebarBtn.type = 'button';
  themePickerSidebarBtn.className =
    'sium-ctrl-btn sium-theme-picker-btn' +
    (state.theme === 'halloween' ||
    state.theme === 'christmas' ||
    state.theme === 'valentine' ||
    state.theme === 'easter'
      ? ' active'
      : '');
  themePickerSidebarBtn.style.cssText = 'flex:1;justify-content:center;padding:0.42rem 0.55rem;';
  var tIcon =
    state.theme === 'easter'
      ? '🐰'
      : state.theme === 'valentine'
        ? '💘'
        : state.theme === 'christmas'
          ? '🎄'
          : state.theme === 'halloween'
            ? '🎃'
            : state.theme === 'light'
              ? '☀️'
              : '🌙';
  var tLabel =
    state.theme === 'easter'
      ? 'Tema: Pasqua'
      : state.theme === 'valentine'
        ? 'Tema: S. Valentino'
        : state.theme === 'christmas'
          ? 'Tema: Natale'
          : state.theme === 'halloween'
            ? 'Tema: Halloween'
            : state.theme === 'light'
              ? 'Tema: Chiaro'
              : 'Tema: Scuro';
  themePickerSidebarBtn.innerHTML =
    '<span>' + tIcon + '</span><span class="theme-btn-label">' + tLabel + '</span>';
  themePickerSidebarBtn.onclick = function (e) {
    e.stopPropagation();
    if (
      window.SiumAnimations &&
      typeof window.SiumAnimations.toggleThemePickerMenu === 'function'
    ) {
      window.SiumAnimations.toggleThemePickerMenu(themePickerSidebarBtn);
    }
  };
  footerControlsRow.appendChild(themePickerSidebarBtn);
  footer.appendChild(footerControlsRow);

  var fxSidebarBtn = document.createElement('button');
  var isFxOn = !(
    window.SiumAnimations &&
    typeof window.SiumAnimations.isFxEnabled === 'function' &&
    !window.SiumAnimations.isFxEnabled()
  );
  fxSidebarBtn.type = 'button';
  fxSidebarBtn.className = 'sium-ctrl-btn sium-fx-toggle-btn' + (isFxOn ? ' active' : '');
  fxSidebarBtn.style.cssText =
    'width:100%;margin-top:0.45rem;justify-content:center;padding:0.42rem 0.6rem;';
  fxSidebarBtn.innerHTML = isFxOn
    ? '<span>✨</span><span class="fx-label">Animazioni: ON</span>'
    : '<span>💤</span><span class="fx-label">Animazioni: OFF</span>';
  fxSidebarBtn.onclick = function () {
    if (window.SiumAnimations && typeof window.SiumAnimations.toggleFx === 'function') {
      window.SiumAnimations.toggleFx();
    }
  };
  footer.appendChild(fxSidebarBtn);

  /* Pulsante Logout \u2014 se loggato con Google */
  if (_authUser) {
    var logoutBtn = document.createElement('button');
    logoutBtn.style.cssText =
      "width:100%;margin-top:0.5rem;background:transparent;border:1px solid rgba(201,165,92,0.25);color:var(--gold-dim);font-family:'Cinzel',serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:0.4rem 0.75rem;cursor:pointer;border-radius:3px;";
    logoutBtn.textContent = '\u293B Disconnetti';
    logoutBtn.onmouseenter = function () {
      this.style.borderColor = 'var(--border-gold)';
      this.style.color = 'var(--gold)';
    };
    logoutBtn.onmouseleave = function () {
      this.style.borderColor = 'rgba(201,165,92,0.25)';
      this.style.color = 'var(--gold-dim)';
    };
    logoutBtn.onclick = doSignOut;
    footer.appendChild(logoutBtn);
  }

  var lab = document.createElement('div');
  lab.className = 'font-display text-center';
  lab.style.cssText =
    'font-size:9px;color:var(--gold-dim);letter-spacing:0.18em;margin-top:0.5rem;';
  lab.textContent = '\u269C OFFLINE READY \u269C';
  footer.appendChild(lab);
  sb.appendChild(footer);
  return sb;
}
