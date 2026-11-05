/* Character sheet shell, zoom, shared field builders and extra trackers. */
function renderScheda() {
  if (isDM() && !state.schedePGViewMode) return document.createElement('div');

  if (!state.schedaLoaded) {
    var ld = document.createElement('div');
    ld.style.cssText =
      'display:flex;align-items:center;justify-content:center;min-height:60vh;background:#5a5a5a;';
    ld.innerHTML =
      '<div style="background:#fff;padding:2rem 3rem;border-radius:4px;text-align:center;font-family:Arial,sans-serif;color:#333;"><div style="font-size:36px;margin-bottom:0.75rem;">📜</div><h2 style="margin:0;">Caricamento schede…</h2></div>';
    fbLoadSchede(function () {
      renderMain();
    });
    return ld;
  }

  if (
    !state.schedePGViewMode &&
    state.companionShowForm &&
    state.companionEditingCharId === state.schedaAttivaId
  )
    return _renderCompanionForm(state.schedaAttivaId);
  if (state.schedaAttivaId === null) return _renderSchedaList();

  /* Routing per schede alternative */
  var _sTipo = state.scheda.schedaTipo || 'normale';
  var isOP = _sTipo === 'onepiece';
  if (_sTipo === 'pokemon' && window.renderPokemonSheet)
    return window.renderPokemonSheet(state.scheda);
  if (_sTipo === 'naruto' && window.renderNarutoSheet)
    return window.renderNarutoSheet(state.scheda);
  if (_sTipo === 'brancalonia' && window.renderBrancaloniaSheet)
    return window.renderBrancaloniaSheet(state.scheda);
  if (_sTipo === 'sw5e' && window.renderSW5eSheet) return window.renderSW5eSheet(state.scheda);
  if (_sTipo !== 'normale' && SHEET_DEFS[_sTipo]) return _renderAltSheet(_sTipo);

  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;background:#5a5a5a;';
  /* nav bar */
  var _nb = document.createElement('div');
  _nb.style.cssText =
    'background:#1a1a1a;border-bottom:1px solid #333;padding:0.45rem 1rem;display:flex;align-items:center;gap:0.5rem;flex-shrink:0;';
  var _bk = document.createElement('button');
  if (state.schedePGViewMode) {
    _bk.innerHTML = '&#8592; Schede PG';
    _bk.onclick = function () {
      state.schedePGViewMode = false;
      state.schedePGOpenChar = null;
      state.schedaAttivaId = null;
      state.scheda = {};
      state.companions = {};
      renderMain();
    };
  } else {
    _bk.innerHTML = '&#8592; Personaggi';
    _bk.onclick = function () {
      state.schedaAttivaId = null;
      state.scheda = {};
      renderMain();
    };
  }
  _bk.style.cssText =
    "background:#444;border:1px solid #666;color:#ccc;border-radius:3px;padding:0.3rem 0.75rem;font-size:11px;cursor:pointer;font-family:'Cinzel',serif;";
  _nb.appendChild(_bk);
  var _sp = document.createElement('span');
  _sp.style.flex = '1';
  _nb.appendChild(_sp);
  if (state.schedePGViewMode) {
    var _dmBadge = document.createElement('span');
    _dmBadge.style.cssText =
      "font-family:'Cinzel',serif;font-size:10px;color:#c9a55c;letter-spacing:0.15em;text-transform:uppercase;border:1px solid #6b5a2a;background:rgba(201,165,92,0.1);padding:2px 10px;border-radius:3px;";
    _dmBadge.textContent = '⚔ Vista Master — sola lettura';
    _nb.appendChild(_dmBadge);
  } else {
    var _bN = document.createElement('button');
    _bN.textContent = '+ Nuova Scheda';
    _bN.style.cssText =
      "background:#8b6f3f;border:1px solid #c9a55c;color:#f0e4cc;border-radius:3px;padding:0.3rem 0.75rem;font-size:11px;cursor:pointer;font-family:'Cinzel',serif;letter-spacing:0.07em;";
    _bN.onclick = function () {
      _newScheda();
    };
    _nb.appendChild(_bN);

    var _bExport = document.createElement('button');
    _bExport.textContent = '⬇ Scarica Scheda (Backup JSON)';
    _bExport.style.cssText =
      "background:#2d4a22;border:1px solid #4caf50;color:#e8f5e9;border-radius:3px;padding:0.3rem 0.75rem;font-size:11px;cursor:pointer;font-family:'Cinzel',serif;margin-left:4px;";
    _bExport.onclick = function () {
      var bExportOrigText = _bExport.textContent;
      _bExport.textContent = '⏳ Preparazione...';
      var schedaExport = DataUtils.clone(state.scheda);
      var promises = [];
      if (schedaExport.boardImages) {
        schedaExport.boardImages.forEach(function (img) {
          if (window.ImageDB) {
            promises.push(
              window.ImageDB.get(img.id).then(function (du) {
                if (du) img.dataUrl = du;
              })
            );
          }
        });
      }
      Promise.all(promises)
        .then(function () {
          var dataStr =
            'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(schedaExport));
          var dlAnchorElem = document.createElement('a');
          dlAnchorElem.setAttribute('href', dataStr);
          dlAnchorElem.setAttribute(
            'download',
            (schedaExport.nomePersonaggio || 'Personaggio') + '_Backup.json'
          );
          dlAnchorElem.click();
          _bExport.textContent = bExportOrigText;
        })
        .catch(function (err) {
          alert("Errore durante l'esportazione delle immagini.");
          _bExport.textContent = bExportOrigText;
        });
    };
    _nb.appendChild(_bExport);

    var _bImport = document.createElement('button');
    _bImport.textContent = '⬆ Carica Scheda (Ripristina JSON)';
    _bImport.style.cssText =
      "background:#4a3b10;border:1px solid #ff9800;color:#fff3e0;border-radius:3px;padding:0.3rem 0.75rem;font-size:11px;cursor:pointer;font-family:'Cinzel',serif;margin-left:4px;";
    _bImport.onclick = function () {
      var fi = document.createElement('input');
      fi.type = 'file';
      fi.accept = '.json';
      fi.onchange = function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function (ev) {
          try {
            var parsed = JSON.parse(ev.target.result);
            if (
              confirm(
                'Sovrascrivere il personaggio attuale con il backup caricato? ATTENZIONE: Questa azione distruggerà i dati correnti di questa scheda.'
              )
            ) {
              var oldId = state.scheda.id || state.schedaAttivaId;
              parsed.id = oldId;
              state.scheda = parsed;
              if (window.migrateImagesToDB) window.migrateImagesToDB();
              ss();
              renderMain();
            }
          } catch (err) {
            alert('File JSON non valido.');
          }
        };
        r.readAsText(f);
      };
      fi.click();
    };
    _nb.appendChild(_bImport);

    var _bA = document.createElement('button');
    _bA.textContent = '+ Associa Scheda';
    _bA.style.cssText =
      "background:#2a4060;border:1px solid #4a70a0;color:#aacef0;border-radius:3px;padding:0.3rem 0.75rem;font-size:11px;cursor:pointer;font-family:'Cinzel',serif;margin-left:4px;letter-spacing:0.07em;";
    _bA.onclick = function () {
      state.companionShowForm = true;
      state.companionEditingId = null;
      state.companionEditingCharId = state.schedaAttivaId;
      renderMain();
    };
    _nb.appendChild(_bA);
    var _bD = document.createElement('button');
    _bD.textContent = 'Elimina personaggio';
    _bD.style.cssText =
      "background:#4a1010;border:1px solid #c04040;color:#f08080;border-radius:3px;padding:0.3rem 0.75rem;font-size:10px;cursor:pointer;font-family:'Cinzel',serif;margin-left:0.5rem;";
    _bD.onclick = function () {
      var _sch = state.scheda;
      if (
        !confirm(
          'Eliminare "' +
            (_sch.nomePersonaggio || _sch.eroe || _sch.nome || 'questo personaggio') +
            '"? Non recuperabile.'
        )
      )
        return;
      var _did = state.schedaAttivaId;
      state.schedeList = state.schedeList.filter(function (x) {
        return x.id !== _did;
      });
      if (state.companions) delete state.companions[_did];
      fbDeleteSchedaItem(_did);
      state.schedaAttivaId = null;
      state.scheda = {};
      renderMain();
    };
    _nb.appendChild(_bD);
  }
  wrap.appendChild(_nb);

  var s = state.scheda;
  var _dmView = state.schedePGViewMode;
  function ss() {
    if (!_dmView) fbSaveScheda();
  }
  function m(v) {
    return Math.floor(((parseInt(v) || 10) - 10) / 2);
  }
  function fmt(n) {
    return (n >= 0 ? '+' : '') + n;
  }
  function fsv(stat, profi) {
    var bc = parseInt(s.bonusCompetenza) || 2;
    return fmt(m(stat) + (profi ? bc : 0));
  }
  function fsvM(statVal, profKey, maestKey) {
    var bc = parseInt(s.bonusCompetenza) || 2;
    return fmt(m(statVal) + (s[profKey] ? bc * (s[maestKey] ? 2 : 1) : 0));
  }

  /* ---- ZOOM BAR ---- */
  var zBar = document.createElement('div');
  zBar.style.cssText =
    'background:#333;border-bottom:1px solid #222;padding:0.35rem 1rem;display:flex;align-items:center;gap:0.5rem;flex-shrink:0;position:sticky;top:0;z-index:200;';
  var zOut = document.createElement('button');
  zOut.textContent = '−';
  zOut.style.cssText =
    'background:#555;border:1px solid #777;color:#eee;border-radius:3px;padding:0.15rem 0.65rem;font-size:15px;font-weight:bold;cursor:pointer;line-height:1;';
  var zLbl = document.createElement('span');
  zLbl.style.cssText =
    "color:#ccc;font-family:'Cinzel',serif;font-size:11px;min-width:44px;text-align:center;";
  zLbl.textContent = Math.round((state.schedaZoom || 1) * 100) + '%';
  var zIn = document.createElement('button');
  zIn.textContent = '+';
  zIn.style.cssText =
    'background:#555;border:1px solid #777;color:#eee;border-radius:3px;padding:0.15rem 0.65rem;font-size:15px;font-weight:bold;cursor:pointer;line-height:1;';
  var zReset = document.createElement('button');
  zReset.textContent = '100%';
  zReset.style.cssText =
    "background:#444;border:1px solid #666;color:#bbb;border-radius:3px;padding:0.15rem 0.5rem;font-size:10px;cursor:pointer;font-family:'Cinzel',serif;";
  var zHint = document.createElement('span');
  zHint.style.cssText =
    "color:#777;font-family:'EB Garamond',serif;font-size:12px;margin-left:0.5rem;";
  zHint.textContent = 'Ctrl+Rotella per zoomare';
  zBar.appendChild(zOut);
  zBar.appendChild(zLbl);
  zBar.appendChild(zIn);
  zBar.appendChild(zReset);
  zBar.appendChild(zHint);
  wrap.appendChild(zBar);

  var pgWrap;
  function applyZoom() {
    var z = Math.max(0.4, Math.min(2.5, state.schedaZoom || 1));
    state.schedaZoom = z;
    zLbl.textContent = Math.round(z * 100) + '%';
    if (pgWrap) {
      pgWrap.style.transform = 'scale(' + z + ')';
      pgWrap.style.transformOrigin = 'top center';
      scrollArea.style.height = pgWrap.scrollHeight * z + 80 + 'px';
    }
  }
  zOut.onclick = function () {
    state.schedaZoom = Math.max(0.4, (state.schedaZoom || 1) - 0.1);
    applyZoom();
  };
  zIn.onclick = function () {
    state.schedaZoom = Math.min(2.5, (state.schedaZoom || 1) + 0.1);
    applyZoom();
  };
  zReset.onclick = function () {
    state.schedaZoom = 1;
    applyZoom();
  };

  /* ---- SCROLL AREA ---- */
  var scrollArea = document.createElement('div');
  scrollArea.style.cssText = 'overflow:auto;padding:1.5rem;display:flex;justify-content:center;';
  scrollArea.addEventListener(
    'wheel',
    function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        state.schedaZoom = Math.max(
          0.4,
          Math.min(2.5, (state.schedaZoom || 1) - (e.deltaY > 0 ? 0.1 : -0.1))
        );
        applyZoom();
      }
    },
    { passive: false }
  );

  pgWrap = document.createElement('div');
  pgWrap.className = 'sium-pg-sheet-wrap';
  pgWrap.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:20px;transform-origin:top center;';

  /* ---- HELPERS ---- */
  function makePage() {
    var pg = document.createElement('div');
    pg.className = 'sium-pg-page';
    pg.style.cssText =
      'width:760px;min-height:1040px;background:#fff;color:#111;box-shadow:0 3px 20px rgba(0,0,0,0.6);padding:14px 16px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:10px;display:flex;flex-direction:column;';
    return pg;
  }
  function makeTraitBox(label, key, minH, grow) {
    var box = document.createElement('div');
    box.className = 'sium-pg-trait-box';
    box.style.cssText =
      'border:1px solid #aaa;border-radius:2px;margin-bottom:4px;overflow:hidden;' +
      (grow ? 'flex:1;display:flex;flex-direction:column;' : '');
    var ta = document.createElement('textarea');
    ta.style.cssText =
      'width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;min-height:' +
      minH +
      'px;line-height:1.4;' +
      (grow ? 'flex:1;' : '');
    ta.value = s[key] || '';
    (function (k) {
      ta.oninput = function () {
        s[k] = this.value;
        ss();
      };
    })(key);
    var lbl = document.createElement('div');
    lbl.style.cssText =
      'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#555;text-align:center;background:#f0f0f0;border-top:1px solid #bbb;padding:2px;flex-shrink:0;';
    lbl.textContent = label;
    box.appendChild(ta);
    box.appendChild(lbl);
    return box;
  }
  function secTitle(text) {
    var d = document.createElement('div');
    d.style.cssText =
      'font-size:6px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#333;text-align:center;border-top:1.5px solid #777;margin-top:2px;padding-top:2px;';
    d.textContent = text;
    return d;
  }
  function cellLbl(text) {
    var d = document.createElement('div');
    d.style.cssText =
      'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#555;border-top:1px solid #ccc;padding-top:1px;margin-top:1px;';
    d.textContent = text;
    return d;
  }
  function makeBubble(checked, onChange) {
    var bub = document.createElement('div');
    bub.className = 'sium-pg-bubble';
    bub.style.cssText =
      'width:9px;height:9px;border-radius:50%;border:1.5px solid #555;cursor:pointer;flex-shrink:0;background:' +
      (checked ? '#111' : 'transparent') +
      ';';
    bub.onclick = function () {
      var v = this.style.background === 'transparent';
      this.style.background = v ? '#111' : 'transparent';
      onChange(v);
    };
    return bub;
  }
  function makeStatBox(name, statKey) {
    var box = document.createElement('div');
    box.className = 'sium-pg-stat-box';
    box.style.cssText =
      'border:2px solid #555;border-radius:5px;text-align:center;padding:3px 2px;margin-bottom:4px;cursor:pointer;';
    var nameLbl = document.createElement('div');
    nameLbl.style.cssText =
      'font-size:5.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#333;';
    nameLbl.textContent = name;
    var valInp = document.createElement('input');
    valInp.type = 'number';
    valInp.min = 1;
    valInp.max = 30;
    valInp.value = parseInt(s[statKey]) || 10;
    valInp.style.cssText =
      'width:100%;text-align:center;font-size:20px;font-weight:bold;color:#111;background:transparent;border:none;border-bottom:1px solid #bbb;outline:none;padding:1px;';
    var modSpan = document.createElement('div');
    modSpan.id = 'pd-mod-' + statKey;
    modSpan.style.cssText =
      'font-size:13px;font-weight:bold;color:#111;border:1.5px solid #555;border-radius:50%;width:26px;height:26px;line-height:24px;text-align:center;margin:2px auto 0;';
    modSpan.textContent = fmt(m(s[statKey]));
    (function (k) {
      valInp.oninput = function () {
        s[k] = parseInt(this.value) || 10;
        updateSchedaDerived();
        ss();
      };
    })(statKey);
    box.appendChild(nameLbl);
    box.appendChild(valInp);
    box.appendChild(modSpan);
    return box;
  }
  function makeTsRow(name, statKey, profKey) {
    var row = document.createElement('div');
    row.className = 'sium-pg-ts-row';
    row.style.cssText =
      'display:flex;align-items:center;gap:2px;padding:1.5px 0;border-bottom:1px solid rgba(0,0,0,0.07);cursor:pointer;';
    var bub = makeBubble(!!s[profKey], function (v) {
      s[profKey] = v;
      updateSchedaDerived();
      ss();
    });
    var val = document.createElement('span');
    val.id = 'pd-ts-' + statKey;
    val.style.cssText = 'font-size:9px;font-weight:bold;min-width:18px;text-align:right;';
    val.textContent = fsv(s[statKey], s[profKey]);
    var nm = document.createElement('span');
    nm.style.cssText = 'font-size:8px;margin-left:1px;';
    nm.textContent = name;
    row.appendChild(bub);
    row.appendChild(val);
    row.appendChild(nm);
    return row;
  }
  function makeSkillRow(name, statKey, profKey, idSuffix, abbr) {
    var maestKey = profKey + '_m';
    var row = document.createElement('div');
    row.className = 'sium-pg-skill-row';
    row.style.cssText =
      'display:flex;align-items:center;gap:2px;padding:1px 0;border-bottom:1px solid rgba(0,0,0,0.06);cursor:pointer;';
    var star = document.createElement('span');
    star.textContent = s[maestKey] ? '★' : '☆';
    star.title = 'Maestria (★): raddoppia il bonus di competenza — attiva prima la competenza (●)';
    star.style.cssText =
      'font-size:12px;cursor:pointer;flex-shrink:0;line-height:1;user-select:none;color:' +
      (s[maestKey] ? '#c8a000' : '#aaa') +
      ';transition:color 0.15s;';
    var bub = makeBubble(!!s[profKey], function (v) {
      s[profKey] = v;
      if (!v) {
        s[maestKey] = false;
        star.textContent = '☆';
        star.style.color = '#aaa';
      }
      updateSchedaDerived();
      ss();
    });
    star.onmouseenter = function () {
      if (!s[maestKey]) star.style.color = s[profKey] ? '#c8a000' : '#888';
    };
    star.onmouseleave = function () {
      star.style.color = s[maestKey] ? '#c8a000' : '#aaa';
    };
    star.onclick = function () {
      if (!s[profKey]) return;
      s[maestKey] = !s[maestKey];
      star.textContent = s[maestKey] ? '★' : '☆';
      star.style.color = s[maestKey] ? '#c8a000' : '#aaa';
      updateSchedaDerived();
      ss();
    };
    var val = document.createElement('span');
    val.id = 'pd-sk-' + idSuffix;
    val.style.cssText = 'font-size:9px;font-weight:bold;min-width:18px;text-align:right;';
    val.textContent = fsvM(s[statKey], profKey, maestKey);
    var nm = document.createElement('span');
    nm.style.cssText = 'font-size:8px;margin-left:1px;';
    nm.innerHTML = name + ' <em style="color:#888;font-size:7px;">(' + abbr + ')</em>';
    row.appendChild(star);
    row.appendChild(bub);
    row.appendChild(val);
    row.appendChild(nm);
    return row;
  }
  function makeHdrCell(label, key, isFirst) {
    var cell = document.createElement('div');
    cell.className = 'sium-pg-hdr-cell';
    cell.style.cssText = (isFirst ? '' : 'border-left:1px solid #aaa;') + 'padding:2px 4px;';
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = s[key] || '';
    inp.style.cssText =
      'width:100%;border:none;background:transparent;color:#111;font-size:11px;outline:none;';
    (function (k) {
      inp.oninput = function () {
        s[k] = this.value;
        ss();
      };
    })(key);
    cell.appendChild(inp);
    cell.appendChild(cellLbl(label));
    return cell;
  }
  function makeSpellBlock(lvlLabel, spells, slotKey, isCantrip) {
    var box = document.createElement('div');
    box.style.cssText = 'border:1px solid #aaa;border-radius:2px;padding:4px;break-inside:avoid;';
    var head = document.createElement('div');
    head.style.cssText =
      'display:flex;align-items:center;gap:3px;margin-bottom:3px;border-bottom:1px solid #ddd;padding-bottom:2px;';
    var badge = document.createElement('div');
    badge.style.cssText =
      'font-size:11px;font-weight:bold;border:1.5px solid #555;border-radius:50%;width:20px;height:20px;line-height:18px;text-align:center;flex-shrink:0;';
    badge.textContent = lvlLabel;
    head.appendChild(badge);
    if (isCantrip) {
      var cl = document.createElement('span');
      cl.style.cssText =
        'font-size:7px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#444;';
      cl.textContent = 'Trucchetti';
      head.appendChild(cl);
    } else {
      var spd = state.scheda[slotKey];
      var slotLbl2 = document.createElement('span');
      slotLbl2.style.cssText = 'font-size:7px;color:#666;';
      slotLbl2.textContent = 'Slot:';
      head.appendChild(slotLbl2);
      var slotI = document.createElement('input');
      slotI.type = 'text';
      slotI.value = spd.slots || '';
      slotI.style.cssText =
        'width:22px;text-align:center;font-size:9px;font-weight:bold;background:#f5f5f5;border:1px solid #bbb;border-radius:2px;color:#111;padding:1px;outline:none;';
      (function (sk) {
        slotI.oninput = function () {
          state.scheda[sk].slots = this.value;
          ss();
        };
      })(slotKey);
      head.appendChild(slotI);
      var spesiLbl2 = document.createElement('span');
      spesiLbl2.style.cssText = 'font-size:7px;color:#666;';
      spesiLbl2.textContent = ' Spesi:';
      head.appendChild(spesiLbl2);
      var spesiI = document.createElement('input');
      spesiI.type = 'text';
      spesiI.value = spd.spesi || '';
      spesiI.style.cssText =
        'width:22px;text-align:center;font-size:9px;font-weight:bold;background:#f5f5f5;border:1px solid #bbb;border-radius:2px;color:#c00;padding:1px;outline:none;';
      (function (sk) {
        spesiI.oninput = function () {
          state.scheda[sk].spesi = this.value;
          ss();
        };
      })(slotKey);
      head.appendChild(spesiI);
    }
    box.appendChild(head);
    spells.forEach(function (sp, i) {
      var row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;gap:2px;padding:1px 0;border-bottom:1px solid rgba(0,0,0,0.05);';
      if (!isCantrip) {
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!sp.prep;
        cb.style.cssText = 'width:10px;height:10px;cursor:pointer;flex-shrink:0;';
        (function (idx, sk) {
          cb.onchange = function () {
            state.scheda[sk].lista[idx].prep = this.checked;
            ss();
          };
        })(i, slotKey);
        row.appendChild(cb);
      }
      var ni = document.createElement('input');
      ni.type = 'text';
      ni.value = sp.nome || '';
      ni.style.cssText =
        'flex:1;background:transparent;border:none;border-bottom:1px solid rgba(0,0,0,0.1);color:#111;font-size:9px;outline:none;padding:1px 0;';
      ni.onfocus = function () {
        this.style.borderBottomColor = '#555';
      };
      ni.onblur = function () {
        this.style.borderBottomColor = 'rgba(0,0,0,0.1)';
      };
      if (isCantrip) {
        (function (idx) {
          ni.oninput = function () {
            state.scheda.trucchetti[idx] = this.value;
            ss();
          };
        })(i);
      } else {
        (function (idx, sk) {
          ni.oninput = function () {
            state.scheda[sk].lista[idx].nome = this.value;
            ss();
          };
        })(i, slotKey);
      }
      row.appendChild(ni);
      box.appendChild(row);
    });
    return box;
  }

  var sheetContext = {
    m,
    makePage,
    makeHdrCell,
    s,
    ss,
    cellLbl,
    makeStatBox,
    makeTsRow,
    secTitle,
    makeSkillRow,
    makeTraitBox,
    isOP,
    makeSpellBlock,
  };
  pgWrap.appendChild(renderDndPage1(sheetContext));
  pgWrap.appendChild(renderDndPage2(sheetContext));
  pgWrap.appendChild(renderDndPage3(sheetContext));

  /* companion mini-sheets below character pages */
  var _cMapC = (state.companions || {})[state.schedaAttivaId] || {};
  Object.keys(_cMapC).forEach(function (k) {
    _cMapC[k].id = k;
    pgWrap.appendChild(_renderCompanionMiniSheet(state.schedaAttivaId, _cMapC[k]));
  });

  if (isOP || _sTipo === 'normale') {
    if (s.staminaMax !== undefined && !s.staminaMigrated) {
      if (!s.customTrackers) s.customTrackers = [];
      s.customTrackers.push({
        id: 'migrated_stamina',
        name: 'Punti Stamina / Vigore',
        cur: s.staminaCur || 0,
        max: s.staminaMax || 0,
      });
      s.staminaMigrated = true;
      ss();
    }

    var masterWrap = document.createElement('div');
    masterWrap.style.cssText =
      'display:flex; gap:20px; align-items:flex-start; transform-origin:top center;';

    pgWrap.style.transform = '';
    pgWrap.style.transformOrigin = '';
    masterWrap.appendChild(pgWrap);

    var trackerCol = document.createElement('div');
    trackerCol.style.cssText =
      'width:280px; display:flex; flex-direction:column; gap:16px; margin-top:0; padding:12px; background:#e8e1d5; border:2px solid #5a3d2b; border-radius:6px; box-shadow:0 4px 10px rgba(0,0,0,0.5);';

    var tHdr = document.createElement('div');
    tHdr.style.cssText =
      'text-align:center; border-bottom:2px solid #5a3d2b; padding-bottom:10px; margin-bottom:4px;';
    var tTitle = document.createElement('div');
    tTitle.style.cssText =
      'font-family:"Cinzel",serif; font-size:16px; font-weight:bold; color:#3e2723; margin-bottom:10px; letter-spacing:0.05em;';
    tTitle.textContent = isOP
      ? '\u2693 CONTATORI CIURMA \u2693'
      : '\u2694\uFE0F CONTATORI EXTRA \u2694\uFE0F';
    var tAdd = document.createElement('button');
    tAdd.type = 'button';
    tAdd.innerHTML = '+ Aggiungi Contatore';
    tAdd.style.cssText =
      'background:#5a3d2b; color:#f4ebd8; border:1px solid #3e2723; padding:6px 12px; font-size:11px; font-weight:bold; border-radius:3px; cursor:pointer; width:100%; font-family:"Cinzel",serif; transition:background 0.2s;';
    tAdd.onmouseover = function () {
      this.style.background = '#3e2723';
    };
    tAdd.onmouseout = function () {
      this.style.background = '#5a3d2b';
    };
    tAdd.onclick = function (e) {
      e.preventDefault();
      if (!s.customTrackers) s.customTrackers = [];
      s.customTrackers.push({ id: Date.now().toString(), name: 'Nuovo Contatore', cur: 0, max: 0 });
      ss();
      renderMain();
    };
    tHdr.appendChild(tTitle);
    tHdr.appendChild(tAdd);
    trackerCol.appendChild(tHdr);

    if (s.customTrackers && s.customTrackers.length > 0) {
      s.customTrackers.forEach(function (tr, i) {
        var trk = document.createElement('div');
        trk.style.cssText =
          'background:#fdfbf7; border:2px dashed #8b6b55; border-radius:4px; padding:10px; box-shadow:inset 0 0 10px rgba(0,0,0,0.05); position:relative;';

        var trDel = document.createElement('button');
        trDel.type = 'button';
        trDel.title = 'Elimina contatore';
        trDel.setAttribute('aria-label', 'Elimina contatore');
        trDel.innerHTML = '✖';
        trDel.style.cssText =
          'position:absolute; top:4px; right:4px; z-index:5; width:24px; height:24px; display:flex; align-items:center; justify-content:center; background:rgba(170,51,51,0.10); border:1px solid rgba(170,51,51,0.35); border-radius:4px; color:#b71c1c; font-size:13px; cursor:pointer; font-weight:bold; transition:all 0.15s ease;';
        trDel.onmouseover = function () {
          this.style.background = '#b71c1c';
          this.style.color = '#fff';
        };
        trDel.onmouseout = function () {
          this.style.background = 'rgba(170,51,51,0.10)';
          this.style.color = '#b71c1c';
        };
        trDel.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          s.customTrackers.splice(i, 1);
          ss();
          renderMain();
          if (typeof notify === 'function') notify('Contatore extra rimosso.');
        };
        trk.appendChild(trDel);

        var nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.value = tr.name;
        nameInp.style.cssText =
          'width:85%; border:none; border-bottom:1px solid #c9a55c; background:transparent; font-family:"Cinzel",serif; font-size:12px; font-weight:bold; color:#3e2723; outline:none; margin-bottom:10px;';
        nameInp.oninput = function () {
          tr.name = this.value;
          ss();
        };
        trk.appendChild(nameInp);

        var valRow = document.createElement('div');
        valRow.style.cssText =
          'display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;';

        var ctrlL = document.createElement('div');
        ctrlL.style.cssText = 'display:flex; gap:4px;';
        var btnM = document.createElement('button');
        btnM.type = 'button';
        btnM.textContent = '-';
        btnM.style.cssText =
          'width:24px;height:24px;border:1px solid #5a3d2b;background:#e8e1d5;color:#3e2723;cursor:pointer;font-weight:bold;border-radius:3px;display:flex;align-items:center;justify-content:center;';
        btnM.onclick = function (e) {
          e.preventDefault();
          tr.cur = Math.max(0, (parseInt(tr.cur) || 0) - 1);
          ss();
          renderMain();
        };
        var btnP = document.createElement('button');
        btnP.type = 'button';
        btnP.textContent = '+';
        btnP.style.cssText =
          'width:24px;height:24px;border:1px solid #5a3d2b;background:#e8e1d5;color:#3e2723;cursor:pointer;font-weight:bold;border-radius:3px;display:flex;align-items:center;justify-content:center;';
        btnP.onclick = function (e) {
          e.preventDefault();
          tr.cur = (parseInt(tr.cur) || 0) + 1;
          ss();
          renderMain();
        };
        ctrlL.appendChild(btnM);
        ctrlL.appendChild(btnP);

        var vals = document.createElement('div');
        vals.style.cssText =
          'display:flex; align-items:center; gap:2px; font-size:14px; font-weight:bold; color:#3e2723;';
        var iCur = document.createElement('input');
        iCur.type = 'number';
        iCur.value = tr.cur;
        iCur.style.cssText =
          'width:36px;text-align:right;border:1px solid #aaa;outline:none;background:#fff;padding:2px;border-radius:2px;font-weight:bold;font-size:12px;';
        iCur.oninput = function () {
          tr.cur = this.value;
          ss();
        };
        var iMax = document.createElement('input');
        iMax.type = 'number';
        iMax.value = tr.max;
        iMax.style.cssText =
          'width:36px;text-align:center;border:1px solid #aaa;outline:none;background:#fff;padding:2px;border-radius:2px;font-weight:bold;font-size:12px;';
        iMax.oninput = function () {
          tr.max = this.value;
          ss();
        };
        vals.appendChild(iCur);
        vals.appendChild(document.createTextNode('/'));
        vals.appendChild(iMax);

        valRow.appendChild(ctrlL);
        valRow.appendChild(vals);
        trk.appendChild(valRow);

        var rRow = document.createElement('div');
        rRow.style.cssText = 'display:flex; gap:4px;';
        var rbB = document.createElement('button');
        rbB.type = 'button';
        rbB.textContent = 'Riposo Breve';
        rbB.style.cssText =
          'flex:1; font-size:9px; padding:3px; cursor:pointer; background:#fff; border:1px solid #8b6b55; border-radius:2px; font-weight:bold; color:#5a3d2b; text-transform:uppercase;';
        rbB.onclick = function (e) {
          e.preventDefault();
          tr.cur = Math.min(parseInt(tr.max) || 0, parseInt(tr.cur) || 0);
          ss();
          renderMain();
        };
        var rbL = document.createElement('button');
        rbL.type = 'button';
        rbL.textContent = 'Riposo Lungo';
        rbL.style.cssText =
          'flex:1; font-size:9px; padding:3px; cursor:pointer; background:#fff; border:1px solid #8b6b55; border-radius:2px; font-weight:bold; color:#5a3d2b; text-transform:uppercase;';
        rbL.onclick = function (e) {
          e.preventDefault();
          tr.cur = parseInt(tr.max) || 0;
          ss();
          renderMain();
        };
        rRow.appendChild(rbB);
        rRow.appendChild(rbL);
        trk.appendChild(rRow);

        trackerCol.appendChild(trk);
      });
    }
    masterWrap.appendChild(trackerCol);
    pgWrap = masterWrap;
  }

  scrollArea.appendChild(pgWrap);
  wrap.appendChild(scrollArea);
  setTimeout(function () {
    applyZoom();
  }, 0);
  return wrap;
}
