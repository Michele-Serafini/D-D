/* Account presentation; all account data and mutations belong to UserManager. */
Object.assign(UserManager, {
  playLoginPortalCeremony: function (username, role, hasDmPriv) {
    var ov = document.getElementById('login-overlay');
    if (!ov) return;

    var isFast = !!(navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || ''));
    var profile =
      this.getCurrentUser() || this.getProfile(username, { role: role, dmPriv: hasDmPriv });
    var roleTitle = profile.title;
    var roleIcon = profile.crest;

    // Crea o aggiorna i battenti del Portale Runico se non presenti
    var portal = document.getElementById('sium-login-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'sium-login-portal';
      portal.className = 'sium-login-portal';
      portal.innerHTML =
        '<div class="portal-door portal-door-left">' +
        '<div class="portal-door-filigree"></div>' +
        '</div>' +
        '<div class="portal-door portal-door-right">' +
        '<div class="portal-door-filigree"></div>' +
        '</div>' +
        '<div class="portal-seal-center">' +
        '<div class="portal-seal-rings">' +
        '<svg class="seal-ring-outer" viewBox="0 0 200 200">' +
        '<circle cx="100" cy="100" r="92" fill="none" stroke="#d8b25c" stroke-width="1.5" stroke-dasharray="8 5" />' +
        '<circle cx="100" cy="100" r="82" fill="none" stroke="#c93b2b" stroke-width="1" stroke-dasharray="3 6" />' +
        '<polygon points="100,10 190,100 100,190 10,100" fill="none" stroke="#d8b25c" stroke-width="1.2" opacity="0.55" />' +
        '<polygon points="100,24 176,100 100,176 24,100" fill="none" stroke="#f5d98e" stroke-width="1" opacity="0.4" transform="rotate(45 100 100)" />' +
        '</svg>' +
        '<svg class="seal-ring-inner" viewBox="0 0 120 120">' +
        '<polygon points="60,8 106,34 106,86 60,112 14,86 14,34" fill="rgba(18,13,9,0.92)" stroke="#f5d98e" stroke-width="2.2" />' +
        '<polygon points="60,22 92,78 28,78" fill="rgba(216,178,92,0.12)" stroke="#d8b25c" stroke-width="1.4" />' +
        '</svg>' +
        '<div class="portal-seal-crest" id="portal-seal-crest">⚜</div>' +
        '</div>' +
        '<div class="portal-welcome-box">' +
        '<div class="portal-welcome-sub">Sigillo Riconosciuto</div>' +
        '<div class="portal-welcome-name" id="portal-welcome-name"></div>' +
        '<div class="portal-welcome-role" id="portal-welcome-role"></div>' +
        '</div>' +
        '</div>';
      ov.appendChild(portal);
    }

    var crestEl = document.getElementById('portal-seal-crest');
    var nameEl = document.getElementById('portal-welcome-name');
    var roleEl = document.getElementById('portal-welcome-role');
    if (crestEl) crestEl.textContent = roleIcon;
    if (nameEl) nameEl.textContent = username;
    if (roleEl) roleEl.textContent = roleTitle;

    ov.classList.add('opening');

    var duration = isFast ? 450 : 1450;
    setTimeout(function () {
      ov.style.display = 'none';
      ov.classList.remove('opening');
    }, duration);
  },
  renderUserBadge: function () {
    var ex = document.getElementById('user-badge-el');
    if (ex) ex.remove();
    var ex2 = document.getElementById('gear-btn-el');
    if (ex2) ex2.remove();

    var cu = this.getCurrentUser();
    if (!cu) return;

    var self = this;

    // Pulsante Impostazioni (Ingranaggio)
    var gear = document.createElement('button');
    gear.type = 'button';
    gear.className = 'gear-btn';
    gear.id = 'gear-btn-el';
    gear.setAttribute('aria-label', 'Impostazioni Account e Party');
    gear.innerHTML = typeof ICON !== 'undefined' && ICON.gear ? ICON.gear : '⚙';
    gear.title = 'Impostazioni Account & Gestione Party';
    gear.onclick = function () {
      self.renderSettingsPanel();
    };
    document.body.appendChild(gear);

    // Badge Utente Attivo
    var badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'user-badge';
    badge.id = 'user-badge-el';
    badge.style.cursor = 'pointer';
    var roleText = this.isAdmin() ? 'Admin / DM' : this.isDM() ? 'Dungeon Master' : 'Giocatore';
    badge.title = cu.username + ' (' + roleText + ') — Clicca per aprire le impostazioni utente';

    var dot = document.createElement('span');
    dot.className = 'online-dot';
    badge.appendChild(dot);

    var nameSpan = document.createElement('span');
    var roleEmoji = this.isAdmin() ? ' 👑' : this.isDM() ? ' ⚔' : ' 🛡';
    nameSpan.textContent = (cu.username || '') + roleEmoji;
    badge.appendChild(nameSpan);

    badge.onclick = function () {
      self.renderSettingsPanel();
    };
    document.body.appendChild(badge);
  },
  renderSettingsPanel: function () {
    var self = this;
    var ex = document.getElementById('settings-overlay');
    if (ex) ex.remove();

    var ov = document.createElement('div');
    ov.id = 'settings-overlay';
    ov.onclick = function (e) {
      if (e.target === ov) ov.remove();
    };

    var box = document.createElement('div');
    box.className = 'settings-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Impostazioni Compendium e Party');

    // Header
    var hdr = document.createElement('div');
    hdr.className = 'settings-header';
    hdr.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;gap:0.75rem;';
    var titleEl = document.createElement('div');
    titleEl.className = 'settings-title';
    titleEl.innerHTML = 'Impostazioni &amp; Gilda Avventurieri';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sium-ctrl-btn';
    closeBtn.setAttribute('aria-label', 'Chiudi Impostazioni');
    closeBtn.style.cssText = 'padding:0.25rem 0.55rem;font-size:12px;';
    closeBtn.textContent = 'Chiudi';
    closeBtn.onclick = function () {
      ov.remove();
    };
    hdr.appendChild(titleEl);
    hdr.appendChild(closeBtn);
    box.appendChild(hdr);

    var body = document.createElement('div');
    body.className = 'settings-body';

    var cu = this.getCurrentUser();

    /* 1. Profilo Utente Corrente */
    if (cu) {
      var profLbl = document.createElement('div');
      profLbl.className = 'settings-section-lbl';
      profLbl.textContent = 'Profilo Attivo';
      body.appendChild(profLbl);

      var profCard = document.createElement('div');
      profCard.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.75rem 0.9rem;background:rgba(216,178,92,0.08);border:1px solid var(--border-gold);border-radius:8px;';
      var roleBadgeText = this.isAdmin()
        ? 'Dungeon Master (Admin) 👑'
        : this.isDM()
          ? 'Co-Master (DM) ⚔'
          : 'Avventuriero (PG) 🛡';

      profCard.innerHTML =
        '<div>' +
        '<div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--gold-bright);">' +
        String(cu.username).replace(/[&<>"']/g, function (c) {
          return '&#' + c.charCodeAt(0) + ';';
        }) +
        '</div>' +
        '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">' +
        roleBadgeText +
        '</div>' +
        '</div>';

      // Cambio rapido account per test o cambio giocatore al volo
      var switchBtn = document.createElement('button');
      switchBtn.type = 'button';
      switchBtn.className = 'sium-ctrl-btn';
      switchBtn.textContent = 'Cambia Account';
      switchBtn.onclick = function () {
        ov.remove();
        self.signOut();
      };
      profCard.appendChild(switchBtn);
      body.appendChild(profCard);
    }

    /* 2. Account attivi della Gilda */
    var usersLbl = document.createElement('div');
    usersLbl.className = 'settings-section-lbl';
    usersLbl.textContent = 'Membri del Party (' + this.getCampaignUsers().length + ')';
    body.appendChild(usersLbl);

    var usersWrap = document.createElement('div');
    usersWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;';

    var allUsers = this.getCampaignUsers();
    allUsers.forEach(function (uObj) {
      var uname = uObj.username;
      var pres = _presenceMap[uname] || {};
      var isSelf = cu && cu.username.toLowerCase() === uname.toLowerCase();
      var isOnline = isSelf || !!pres.online;
      var isMaster = self.getPrivileges(uObj).authRole === 'admin';

      var row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.7rem;border-radius:6px;background:var(--bg-card);border:1px solid ' +
        (isSelf ? 'var(--border-gold)' : 'var(--border-subtle)') +
        ';';

      var dot = document.createElement('span');
      dot.style.cssText =
        'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' +
        (isOnline ? '#34d399' : '#6b7280') +
        ';box-shadow:' +
        (isOnline ? '0 0 6px #34d399' : 'none') +
        ';';

      var nameEl = document.createElement('span');
      nameEl.style.cssText =
        'flex:1;font-family:var(--font-display);font-size:12.5px;font-weight:600;color:' +
        (isOnline ? 'var(--text-primary)' : 'var(--text-secondary)') +
        ';';
      nameEl.textContent = uname + ' ' + (uObj.crest || '') + (isSelf ? ' (Tu)' : '');

      var statusEl = document.createElement('span');
      statusEl.style.cssText =
        'font-size:10px;font-family:var(--font-display);letter-spacing:0.06em;color:' +
        (isOnline ? '#34d399' : 'var(--text-muted)') +
        ';min-width:48px;text-align:right;';
      statusEl.textContent = isOnline ? 'Online' : 'Offline';

      row.appendChild(dot);
      row.appendChild(nameEl);
      row.appendChild(statusEl);

      // Se l'utente attivo è Admin, può promuovere/revocare privilegi DM agli altri giocatori
      if (self.isAdmin() && !isMaster) {
        var hasDM = !!uObj.dmPriv;
        var togBtn = document.createElement('button');
        togBtn.type = 'button';
        togBtn.style.cssText =
          'font-size:10px;font-family:var(--font-display);padding:0.22rem 0.55rem;border-radius:4px;cursor:pointer;border:1px solid ' +
          (hasDM ? 'var(--gold)' : 'var(--border-subtle)') +
          ';background:transparent;color:' +
          (hasDM ? 'var(--gold-bright)' : 'var(--text-muted)') +
          ';margin-left:0.35rem;';
        togBtn.textContent = hasDM ? '⚔ DM' : '🛡 PG';
        togBtn.onclick = (function (targetName, btn, currentPriv) {
          return async function () {
            var newVal = !currentPriv;
            btn.disabled = true;
            try {
              await self.setDmPrivileges(targetName, newVal);
            } catch (error) {
              if (typeof notify === 'function') notify(error.message);
              return;
            } finally {
              btn.disabled = false;
            }
            currentPriv = newVal;
            btn.style.borderColor = newVal ? 'var(--gold)' : 'var(--border-subtle)';
            btn.style.color = newVal ? 'var(--gold-bright)' : 'var(--text-muted)';
            btn.textContent = newVal ? '⚔ DM' : '🛡 PG';
            if (typeof notify === 'function') {
              notify(targetName + (newVal ? ' ora ha i privilegi DM.' : ' è tornato Giocatore.'));
            }
          };
        })(uname, togBtn, hasDM);
        row.appendChild(togBtn);
      }

      usersWrap.appendChild(row);
    });
    body.appendChild(usersWrap);

    /* 3. Cambio Password */
    if (cu) {
      var pwLbl = document.createElement('div');
      pwLbl.className = 'settings-section-lbl';
      pwLbl.textContent = 'Cambio Password';
      body.appendChild(pwLbl);

      var pwWrap = document.createElement('div');
      pwWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.45rem;';

      var mkPwInp = function (ph, id) {
        var inp = document.createElement('input');
        inp.type = 'password';
        inp.placeholder = ph;
        inp.id = id;
        inp.style.cssText =
          'width:100%;background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary);padding:0.45rem 0.65rem;border-radius:6px;font-size:13px;';
        return inp;
      };

      pwWrap.appendChild(mkPwInp('Password attuale', 'pw-old'));
      pwWrap.appendChild(mkPwInp('Nuova password', 'pw-new'));
      pwWrap.appendChild(mkPwInp('Conferma nuova password', 'pw-new2'));

      var pwMsg = document.createElement('div');
      pwMsg.style.cssText = 'font-size:12px;display:none;text-align:center;';

      var pwBtn = document.createElement('button');
      pwBtn.type = 'button';
      pwBtn.className = 'btn-secondary';
      pwBtn.style.cssText = 'width:100%;justify-content:center;font-size:11px;padding:0.5rem;';
      pwBtn.textContent = '🔑 Aggiorna Password';
      pwBtn.onclick = async function () {
        var oldP = document.getElementById('pw-old').value;
        var newP = document.getElementById('pw-new').value;
        var newP2 = document.getElementById('pw-new2').value;
        pwMsg.style.display = 'none';

        if (!oldP || !newP || !newP2) {
          pwMsg.style.color = '#f87171';
          pwMsg.textContent = 'Compila tutti i campi.';
          pwMsg.style.display = 'block';
          return;
        }
        if (newP.length < 6) {
          pwMsg.style.color = '#f87171';
          pwMsg.textContent = 'La nuova password deve avere almeno 4 caratteri.';
          pwMsg.style.display = 'block';
          return;
        }
        if (newP !== newP2) {
          pwMsg.style.color = '#f87171';
          pwMsg.textContent = 'Le nuove password non coincidono.';
          pwMsg.style.display = 'block';
          return;
        }

        pwBtn.disabled = true;
        try {
          await self.changePassword(cu.username, oldP, newP);
        } catch (error) {
          pwMsg.style.color = '#f87171';
          pwMsg.textContent = error.message;
          pwMsg.style.display = 'block';
          return;
        } finally {
          pwBtn.disabled = false;
        }
        pwMsg.style.color = '#34d399';
        pwMsg.textContent = 'Password aggiornata con successo!';
        pwMsg.style.display = 'block';
        document.getElementById('pw-old').value = '';
        document.getElementById('pw-new').value = '';
        document.getElementById('pw-new2').value = '';
      };

      pwWrap.appendChild(pwBtn);
      pwWrap.appendChild(pwMsg);
      body.appendChild(pwWrap);
    }

    /* 4. Tema & Effetti Visivi */
    var themeLbl = document.createElement('div');
    themeLbl.className = 'settings-section-lbl';
    themeLbl.textContent = 'Aspetto & Atmosfera';
    body.appendChild(themeLbl);

    var themeRow = document.createElement('div');
    themeRow.style.cssText = 'display:flex;gap:0.5rem;';
    var curTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    [
      ['dark', '🌙 Taverna (Scuro)'],
      ['light', '☀ Pergamena (Chiaro)'],
    ].forEach(function (t) {
      var tb = document.createElement('button');
      tb.type = 'button';
      tb.className = 'btn-secondary';
      tb.style.cssText =
        'flex:1;justify-content:center;font-size:11px;padding:0.45rem;' +
        (curTheme === t[0] ? 'border-color:var(--gold);color:var(--gold-bright);' : '');
      tb.textContent = t[1];
      tb.onclick = function () {
        if (typeof state !== 'undefined') state.theme = t[0];
        document.documentElement.setAttribute('data-theme', t[0]);
        if (typeof saveToStorage === 'function') saveToStorage();
        if (typeof render === 'function') render();
        ov.remove();
      };
      themeRow.appendChild(tb);
    });
    body.appendChild(themeRow);

    /* 5. Disconnessione */
    if (_authUser) {
      var logoutBtn = document.createElement('button');
      logoutBtn.type = 'button';
      logoutBtn.className = 'btn-blood';
      logoutBtn.style.cssText =
        'margin-top:0.65rem;width:100%;justify-content:center;padding:0.55rem;';
      logoutBtn.textContent = '⤻ Disconnetti dal Compendium';
      logoutBtn.onclick = function () {
        ov.remove();
        self.signOut();
      };
      body.appendChild(logoutBtn);
    }

    box.appendChild(body);
    ov.appendChild(box);
    document.body.appendChild(ov);
  },
});
