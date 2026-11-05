/* ============================================================================
   SEZIONE 10B: WORLDBUILDING — REGIONI, CITTÀ E LUOGHI
   ============================================================================ */
function renderWorldbuilding() {
  var wrap = document.createElement('div');

  /* HEADER */
  var header = document.createElement('header');
  header.className = 'border-b';
  var hc = document.createElement('div');
  hc.className = 'container-main';
  hc.style.cssText = 'padding-top:2.25rem;padding-bottom:2.25rem;';
  var top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-5';
  var _wbMapNome =
    state.mappaActiveId && state.mappaList && state.mappaList[state.mappaActiveId]
      ? state.mappaList[state.mappaActiveId].nome
      : '';
  var _wbMapBadge = _wbMapNome
    ? '<span style="display:inline-block;margin-left:0.75rem;background:rgba(201,165,92,0.15);border:1px solid var(--border-gold);border-radius:3px;padding:0.15rem 0.6rem;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold);letter-spacing:0.1em;vertical-align:middle;">🗺 ' +
      escapeHtml(_wbMapNome) +
      '</span>'
    : '';
  top.innerHTML =
    '<div><div class="header-eyebrow mb-3"><span>Atlante del Mondo</span>' +
    _wbMapBadge +
    '</div><h1 class="header-title">Worldbuilding & Città</h1><p class="font-script italic mt-2 text-lg" style="color:var(--text-muted);">Macro-zone, città, luoghi di interesse e segreti del tuo mondo</p></div>';
  hc.appendChild(top);
  var fd = document.createElement('div');
  fd.className = 'filigree-divider mt-7';
  hc.appendChild(fd);
  header.appendChild(hc);
  wrap.appendChild(header);

  var body = document.createElement('section');
  body.className = 'container-main';
  body.style.cssText = 'padding-top:2rem;padding-bottom:5rem;';

  /* Bottone aggiungi zona */
  if (isDM()) {
    var addZoneRow = document.createElement('div');
    addZoneRow.style.cssText = 'display:flex;gap:0.5rem;align-items:center;margin-bottom:1.5rem;';
    var zoneInp = document.createElement('input');
    zoneInp.type = 'text';
    zoneInp.className = 'field';
    zoneInp.placeholder = 'Nome nuova macro-zona (es. Foresta Maledetta, Porto del Nord…)';
    zoneInp.style.flex = '1';
    var addZoneBtn = document.createElement('button');
    addZoneBtn.className = 'btn-gold';
    addZoneBtn.innerHTML = ICON.plus + ' Aggiungi Zona';
    addZoneBtn.onclick = function () {
      var n = zoneInp.value.trim();
      if (!n) {
        notify('Inserisci il nome della zona.', 'err');
        return;
      }
      state.worldbuilding.push({ id: 'z_' + Date.now(), nome: n, desc: '', citta: [] });
      fbSaveWorldbuilding();
      saveToStorage();
      zoneInp.value = '';
      renderMain();
    };
    zoneInp.onkeydown = function (e) {
      if (e.key === 'Enter') addZoneBtn.click();
    };
    addZoneRow.appendChild(zoneInp);
    addZoneRow.appendChild(addZoneBtn);
    body.appendChild(addZoneRow);
  }

  if (state.worldbuilding.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'empty-state panel-glass';
    empty.innerHTML =
      '<div class="rune">🌍</div><h2>Nessuna zona creata</h2><p>Aggiungi la prima macro-zona del tuo mondo con il campo sopra.</p>';
    body.appendChild(empty);
  } else {
    /* Zona accordion */
    state.worldbuilding.forEach(function (zone, zi) {
      var zonaEl = document.createElement('div');
      zonaEl.style.cssText =
        'margin-bottom:1.5rem;border:1px solid var(--border-gold);border-radius:6px;overflow:hidden;';

      /* Header zona */
      var zonaHdr = document.createElement('div');
      zonaHdr.style.cssText =
        'display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:var(--bg-card-elevated);cursor:pointer;';
      var zonaIcon = document.createElement('span');
      zonaIcon.textContent = '🗺';
      zonaIcon.style.fontSize = '18px';
      var zonaNome = document.createElement('span');
      zonaNome.style.cssText =
        "font-family:'Cinzel',serif;font-size:14px;font-weight:700;color:var(--gold);flex:1;";
      zonaNome.textContent = zone.nome;
      var zonaBadge = document.createElement('span');
      zonaBadge.style.cssText =
        "background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:8px;padding:0.1rem 0.5rem;font-family:'Cinzel',serif;font-size:10px;color:var(--gold-dim);";
      zonaBadge.textContent = (zone.citta || []).length + ' città';
      var zonaArrow = document.createElement('span');
      zonaArrow.textContent = '▾';
      zonaArrow.style.cssText = 'color:var(--text-faint);font-size:12px;transition:transform 0.2s;';
      zonaHdr.appendChild(zonaIcon);
      zonaHdr.appendChild(zonaNome);
      zonaHdr.appendChild(zonaBadge);

      if (isDM()) {
        var delZoneBtn = document.createElement('button');
        delZoneBtn.style.cssText =
          'background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:14px;padding:0.2rem 0.4rem;';
        delZoneBtn.innerHTML = ICON.trash;
        delZoneBtn.title = 'Elimina zona';
        (function (z, i) {
          delZoneBtn.onclick = function (e) {
            e.stopPropagation();
            if (confirm('Eliminare la zona "' + z.nome + '" e tutte le sue città?')) {
              state.worldbuilding.splice(i, 1);
              fbSaveWorldbuilding();
              saveToStorage();
              renderMain();
            }
          };
        })(zone, zi);
        zonaHdr.appendChild(delZoneBtn);
      }
      zonaHdr.appendChild(zonaArrow);

      var zonaBody = document.createElement('div');
      zonaBody.style.cssText = 'background:var(--bg-panel);padding:1rem;';

      zonaHdr.onclick = function () {
        var col = zonaBody.style.display === 'none';
        zonaBody.style.display = col ? 'block' : 'none';
        zonaArrow.style.transform = col ? '' : 'rotate(-90deg)';
      };

      /* Descrizione zona */
      var descG = document.createElement('div');
      descG.style.marginBottom = '1rem';
      descG.innerHTML = '<label class="field-label">Descrizione zona</label>';
      var descTA = document.createElement('textarea');
      descTA.className = 'field';
      descTA.rows = 2;
      descTA.placeholder = 'Breve descrizione della macro-zona…';
      descTA.value = zone.desc || '';
      (function (z) {
        descTA.onchange = function () {
          z.desc = this.value;
          fbSaveWorldbuilding();
          saveToStorage();
        };
      })(zone);
      descG.appendChild(descTA);
      zonaBody.appendChild(descG);

      /* Città nella zona */
      var cittaTitle = document.createElement('div');
      cittaTitle.style.cssText =
        "font-family:'Cinzel',serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:var(--gold-dim);margin-bottom:0.5rem;";
      cittaTitle.textContent = 'Città e Luoghi';
      zonaBody.appendChild(cittaTitle);

      (zone.citta || []).forEach(function (city, ci) {
        var cityCard = document.createElement('div');
        cityCard.style.cssText =
          'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:4px;margin-bottom:0.5rem;overflow:hidden;';

        var cityHdr = document.createElement('div');
        cityHdr.style.cssText =
          'display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;cursor:pointer;';
        var cityIcon = document.createElement('span');
        cityIcon.textContent =
          city.tipo === 'dungeon'
            ? '⚔'
            : city.tipo === 'fortezza'
              ? '🏰'
              : city.tipo === 'villaggio'
                ? '🏘'
                : '🏙';
        cityIcon.style.fontSize = '15px';
        var cityNome = document.createElement('span');
        cityNome.style.cssText =
          "font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:var(--text-strong);flex:1;";
        cityNome.textContent = city.nome + (city.tipo ? ' · ' + city.tipo : '');
        var cityArrow = document.createElement('span');
        cityArrow.textContent = '▾';
        cityArrow.style.cssText = 'color:var(--text-faint);font-size:11px;';

        if (isDM()) {
          var delCityBtn = document.createElement('button');
          delCityBtn.style.cssText =
            'background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:13px;padding:0.1rem 0.3rem;';
          delCityBtn.innerHTML = ICON.trash;
          (function (z, c, i) {
            delCityBtn.onclick = function (e) {
              e.stopPropagation();
              if (confirm('Eliminare "' + c.nome + '"?')) {
                z.citta.splice(i, 1);
                fbSaveWorldbuilding();
                saveToStorage();
                renderMain();
              }
            };
          })(zone, city, ci);
          cityHdr.appendChild(cityIcon);
          cityHdr.appendChild(cityNome);
          cityHdr.appendChild(delCityBtn);
          cityHdr.appendChild(cityArrow);
        } else {
          cityHdr.appendChild(cityIcon);
          cityHdr.appendChild(cityNome);
          cityHdr.appendChild(cityArrow);
        }

        var cityBody = document.createElement('div');
        cityBody.style.cssText =
          'padding:0.75rem;border-top:1px solid var(--border-subtle);display:none;';

        cityHdr.onclick = function () {
          var col = cityBody.style.display === 'none';
          cityBody.style.display = col ? 'block' : 'none';
          cityArrow.textContent = col ? '▴' : '▾';
        };

        /* Immagini città */
        /* === 2 IMMAGINI AFFIANCATE === */
        var imgPairGrid = document.createElement('div');
        imgPairGrid.style.cssText =
          'display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;';

        function makeImagePanel(labelTxt, imgKey) {
          if (!city[imgKey]) city[imgKey] = '';
          var cell = document.createElement('div');

          var lbl = document.createElement('div');
          lbl.className = 'field-label';
          lbl.textContent = labelTxt;
          cell.appendChild(lbl);

          /* Box immagine — dimensione fissa, overflow hidden per pan/zoom */
          var imgBox = document.createElement('div');
          imgBox.style.cssText =
            'position:relative;width:100%;padding-top:68%;border-radius:5px;overflow:hidden;border:2px dashed var(--border-subtle);background:var(--bg-base);cursor:pointer;';

          /* Immagine: object-fit cover, transform gestito via JS per pan/zoom */
          var imgEl = document.createElement('img');
          imgEl.draggable = false;
          imgEl.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:' +
            (city[imgKey] ? 'block' : 'none') +
            ';transform-origin:center center;user-select:none;pointer-events:none;';
          if (city[imgKey]) {
            imgEl.src = city[imgKey];
            imgBox.style.borderStyle = 'solid';
            imgBox.style.borderColor = 'var(--border-soft)';
          }
          imgBox.appendChild(imgEl);

          /* Placeholder */
          var phDiv = document.createElement('div');
          phDiv.style.cssText =
            'position:absolute;inset:0;display:' +
            (city[imgKey] ? 'none' : 'flex') +
            ';flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;pointer-events:none;';
          phDiv.innerHTML =
            '<span style="font-size:36px;opacity:0.28;">🖼</span><span style="font-family:\'Cinzel\',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-faint);">Clicca per aggiungere</span>';
          imgBox.appendChild(phDiv);

          /* Hint zoom (visibile solo quando c'è immagine) */
          var hintEl = document.createElement('div');
          hintEl.style.cssText =
            "position:absolute;top:6px;left:8px;font-family:'Cinzel',serif;font-size:8px;letter-spacing:0.1em;color:rgba(255,255,255,0.55);background:rgba(0,0,0,0.45);padding:0.15rem 0.4rem;border-radius:3px;pointer-events:none;display:" +
            (city[imgKey] ? 'block' : 'none') +
            ';';
          hintEl.textContent = '🔍 Rotella = zoom · Trascina = pan · 2× click = reset';
          imgBox.appendChild(hintEl);

          /* Overlay pulsanti */
          var overlay = document.createElement('div');
          overlay.style.cssText =
            'position:absolute;bottom:0;left:0;right:0;padding:0.4rem 0.5rem;display:' +
            (city[imgKey] ? 'flex' : 'none') +
            ';gap:0.3rem;justify-content:flex-end;background:linear-gradient(transparent,rgba(0,0,0,0.65));z-index:2;';
          var changeBtn = document.createElement('button');
          changeBtn.type = 'button';
          changeBtn.className = 'btn-dark';
          changeBtn.style.cssText = 'font-size:10px;padding:0.2rem 0.5rem;';
          changeBtn.textContent = '✎ Cambia';
          var removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'btn-blood';
          removeBtn.style.cssText = 'font-size:10px;padding:0.2rem 0.45rem;';
          removeBtn.textContent = '✕';
          overlay.appendChild(changeBtn);
          overlay.appendChild(removeBtn);
          imgBox.appendChild(overlay);

          var fI = document.createElement('input');
          fI.type = 'file';
          fI.accept = 'image/*';
          fI.style.display = 'none';
          cell.appendChild(fI);

          (function (k, box, el, ph, ov, hint) {
            /* --- stato pan/zoom --- */
            var sc = 1,
              tx = 0,
              ty = 0;
            var dragging = false,
              didDrag = false;
            var mx0 = 0,
              my0 = 0,
              tx0 = 0,
              ty0 = 0;

            function applyT() {
              el.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
            }
            function resetView() {
              sc = 1;
              tx = 0;
              ty = 0;
              applyT();
              box.style.cursor = city[k] ? 'zoom-in' : 'pointer';
            }

            /* Zoom con rotella — centrato sul cursore */
            box.addEventListener(
              'wheel',
              function (e) {
                if (!city[k]) return;
                e.preventDefault();
                var rect = box.getBoundingClientRect();
                var cx = e.clientX - rect.left - rect.width / 2;
                var cy = e.clientY - rect.top - rect.height / 2;
                var factor = e.deltaY < 0 ? 1.12 : 0.89;
                var ns = Math.max(1, Math.min(7, sc * factor));
                if (ns > 1) {
                  tx = cx - (cx - tx) * (ns / sc);
                  ty = cy - (cy - ty) * (ns / sc);
                } else {
                  tx = 0;
                  ty = 0;
                }
                sc = ns;
                applyT();
                box.style.cursor = sc > 1 ? 'grab' : 'zoom-in';
              },
              { passive: false }
            );

            /* Drag per spostare */
            box.addEventListener('mousedown', function (e) {
              if (!city[k]) return;
              if (e.target === changeBtn || e.target === removeBtn) return;
              e.preventDefault();
              dragging = true;
              didDrag = false;
              mx0 = e.clientX;
              my0 = e.clientY;
              tx0 = tx;
              ty0 = ty;
              box.style.cursor = 'grabbing';
            });

            function onMove(e) {
              if (!dragging) return;
              var dx = e.clientX - mx0,
                dy = e.clientY - my0;
              if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag = true;
              tx = tx0 + dx;
              ty = ty0 + dy;
              applyT();
            }
            function onUp(e) {
              if (!dragging) return;
              dragging = false;
              if (!didDrag && !city[k]) openPicker();
              else if (!didDrag && sc <= 1) openPicker();
              box.style.cursor = sc > 1 ? 'grab' : city[k] ? 'zoom-in' : 'pointer';
            }
            listenInSection(document, 'mousemove', onMove);
            listenInSection(document, 'mouseup', onUp);

            /* Doppio click = reset vista */
            box.addEventListener('dblclick', function (e) {
              if (e.target === changeBtn || e.target === removeBtn) return;
              resetView();
            });

            function openPicker() {
              fI.value = '';
              fI.click();
            }

            function setImg(src) {
              city[k] = src;
              el.src = src;
              el.style.display = 'block';
              ph.style.display = 'none';
              ov.style.display = 'flex';
              hint.style.display = 'block';
              box.style.borderStyle = 'solid';
              box.style.borderColor = 'var(--border-soft)';
              box.style.cursor = 'zoom-in';
              resetView();
              fbSaveWorldbuilding();
              saveToStorage();
            }
            function clearImg() {
              city[k] = '';
              el.style.display = 'none';
              el.src = '';
              ph.style.display = 'flex';
              ov.style.display = 'none';
              hint.style.display = 'none';
              box.style.borderStyle = 'dashed';
              box.style.borderColor = 'var(--border-subtle)';
              box.style.cursor = 'pointer';
              resetView();
              fbSaveWorldbuilding();
              saveToStorage();
            }

            fI.onchange = function () {
              var file = this.files[0];
              if (!file) return;
              var reader = new FileReader();
              reader.onload = function (ev) {
                var img = new Image();
                img.onload = function () {
                  var MAX = 1400;
                  var ratio = Math.min(MAX / img.width, MAX / img.height, 1);
                  var canvas = document.createElement('canvas');
                  canvas.width = Math.round(img.width * ratio);
                  canvas.height = Math.round(img.height * ratio);
                  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                  setImg(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.src = ev.target.result;
              };
              reader.readAsDataURL(file);
            };

            changeBtn.onclick = function (e) {
              e.stopPropagation();
              openPicker();
            };
            removeBtn.onclick = function (e) {
              e.stopPropagation();
              if (confirm('Rimuovere questa immagine?')) clearImg();
            };

            /* Cursore iniziale */
            box.style.cursor = city[k] ? 'zoom-in' : 'pointer';
          })(imgKey, imgBox, imgEl, phDiv, overlay, hintEl);

          cell.appendChild(imgBox);

          /* Pulsante carica file sotto il box */
          var uploadRow = document.createElement('div');
          uploadRow.style.cssText = 'margin-top:0.35rem;';
          var uploadBtn = document.createElement('button');
          uploadBtn.type = 'button';
          uploadBtn.className = 'btn-dark';
          uploadBtn.style.cssText = 'width:100%;font-size:11px;justify-content:center;';
          uploadBtn.innerHTML = '📁 Carica immagine (JPEG / PNG)';
          uploadBtn.onclick = function () {
            fI.value = '';
            fI.click();
          };
          uploadRow.appendChild(uploadBtn);
          cell.appendChild(uploadRow);

          return cell;
        }

        imgPairGrid.appendChild(makeImagePanel("🗺 Mappa dall'alto", 'immagineMappaAlto'));
        imgPairGrid.appendChild(makeImagePanel('🏙 Vista dinamica', 'immagineDinamica'));
        cityBody.appendChild(imgPairGrid);

        /* Note città */
        var noteG = document.createElement('div');
        noteG.style.marginBottom = '0.75rem';
        var noteLblRow = document.createElement('div');
        noteLblRow.style.cssText =
          'display:flex;align-items:center;justify-content:space-between;margin-bottom:0.25rem;';
        var noteLbl = document.createElement('label');
        noteLbl.className = 'field-label';
        noteLbl.style.margin = '0';
        noteLbl.textContent = 'Note generali';
        var noteExpandBtn = document.createElement('button');
        noteExpandBtn.type = 'button';
        noteExpandBtn.className = 'btn-dark';
        noteExpandBtn.style.cssText =
          "font-size:9px;padding:0.15rem 0.5rem;font-family:'Cinzel',serif;letter-spacing:0.08em;text-transform:uppercase;";
        noteExpandBtn.textContent = '⤢ Ingrandisci';
        noteLblRow.appendChild(noteLbl);
        noteLblRow.appendChild(noteExpandBtn);
        noteG.appendChild(noteLblRow);
        var noteTA = document.createElement('textarea');
        noteTA.className = 'field';
        noteTA.rows = 2;
        noteTA.placeholder = 'Atmosfera, storia, situazione attuale…';
        noteTA.value = city.note || '';
        (function (c, smallTA, expandBtn) {
          smallTA.oninput = function () {
            c.note = this.value;
            fbSaveWorldbuilding();
            saveToStorage();
          };
          expandBtn.onclick = function () {
            /* Crea pannello flottante se non già aperto */
            var existingId = 'note-float-' + c.id;
            if (document.getElementById(existingId)) {
              document.getElementById(existingId).focus &&
                document.getElementById(existingId).querySelector('textarea').focus();
              return;
            }
            var floatPanel = document.createElement('div');
            floatPanel.id = existingId;
            floatPanel.style.cssText =
              'position:fixed;z-index:99990;background:var(--bg-panel);border:1px solid var(--border-gold);border-radius:6px;box-shadow:0 8px 40px rgba(0,0,0,0.7);min-width:340px;min-height:260px;width:520px;height:420px;resize:both;overflow:hidden;display:flex;flex-direction:column;top:50%;left:50%;transform:translate(-50%,-50%);';
            /* Header draggabile */
            var floatHead = document.createElement('div');
            floatHead.style.cssText =
              'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:var(--bg-card-elevated);border-bottom:1px solid var(--border-gold);cursor:grab;user-select:none;flex-shrink:0;';
            var floatTitle = document.createElement('div');
            floatTitle.style.cssText =
              "font-family:'Cinzel',serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:var(--gold);";
            floatTitle.textContent = '📝 Note — ' + (c.nome || 'Città');
            var floatClose = document.createElement('button');
            floatClose.type = 'button';
            floatClose.className = 'theme-toggle';
            floatClose.style.cssText = 'width:28px;height:28px;font-size:14px;';
            floatClose.textContent = '✕';
            floatClose.onclick = function () {
              stopMove();
              stopUp();
              floatPanel.remove();
            };
            floatHead.appendChild(floatTitle);
            floatHead.appendChild(floatClose);
            floatPanel.appendChild(floatHead);
            /* Textarea grande */
            var bigTA = document.createElement('textarea');
            bigTA.style.cssText =
              "flex:1;width:100%;box-sizing:border-box;background:var(--bg-base);color:var(--text-main);font-family:'EB Garamond',serif;font-size:16px;line-height:1.65;border:none;outline:none;resize:none;padding:0.75rem 1rem;";
            bigTA.placeholder = 'Atmosfera, storia, situazione attuale, trame in corso…';
            bigTA.value = c.note || '';
            bigTA.oninput = function () {
              c.note = this.value;
              smallTA.value = this.value;
              fbSaveWorldbuilding();
              saveToStorage();
            };
            floatPanel.appendChild(bigTA);
            document.body.appendChild(floatPanel);
            bigTA.focus();
            /* Drag logica */
            var dragging = false,
              ox = 0,
              oy = 0,
              px = 0,
              py = 0;
            floatHead.addEventListener('mousedown', function (e) {
              if (e.target === floatClose) return;
              dragging = true;
              floatHead.style.cursor = 'grabbing';
              ox = e.clientX;
              oy = e.clientY;
              var rect = floatPanel.getBoundingClientRect();
              px = rect.left;
              py = rect.top;
              floatPanel.style.transform = 'none';
              floatPanel.style.left = px + 'px';
              floatPanel.style.top = py + 'px';
            });
            var stopMove = listenInSection(document, 'mousemove', function (e) {
              if (!dragging) return;
              floatPanel.style.left = px + (e.clientX - ox) + 'px';
              floatPanel.style.top = py + (e.clientY - oy) + 'px';
            });
            var stopUp = listenInSection(document, 'mouseup', function () {
              if (dragging) {
                dragging = false;
                floatHead.style.cursor = 'grab';
              }
            });
          };
        })(city, noteTA, noteExpandBtn);
        noteG.appendChild(noteTA);
        cityBody.appendChild(noteG);

        /* Sottosezioni: Luoghi / NPC / Loot */
        function makeCityList(labelText, emoji, listKey) {
          if (!city[listKey]) city[listKey] = [];
          var sec = document.createElement('div');
          sec.style.marginBottom = '0.75rem';
          sec.innerHTML = '<label class="field-label">' + emoji + ' ' + labelText + '</label>';
          var listEl = document.createElement('div');
          function rebuildList() {
            listEl.innerHTML = '';
            (city[listKey] || []).forEach(function (item, ii) {
              var row = document.createElement('div');
              row.style.cssText =
                "display:flex;align-items:center;gap:0.4rem;padding:0.2rem 0;font-family:'EB Garamond',serif;font-size:15px;color:var(--text-main);";
              var txt = document.createElement('span');
              txt.textContent = item;
              txt.style.flex = '1';
              row.appendChild(txt);
              if (isDM()) {
                var d = document.createElement('button');
                d.style.cssText =
                  'background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:13px;';
                d.textContent = '✕';
                (function (k, i) {
                  d.onclick = function () {
                    city[k].splice(i, 1);
                    fbSaveWorldbuilding();
                    saveToStorage();
                    rebuildList();
                  };
                })(listKey, ii);
                row.appendChild(d);
              }
              listEl.appendChild(row);
            });
            if (isDM()) {
              var addR = document.createElement('div');
              addR.style.cssText = 'display:flex;gap:0.35rem;margin-top:0.25rem;';
              var addI = document.createElement('input');
              addI.className = 'field';
              addI.placeholder = 'Aggiungi voce…';
              addI.style.flex = '1';
              addI.style.fontSize = '14px';
              var addB = document.createElement('button');
              addB.className = 'btn-dark';
              addB.style.cssText = 'font-size:11px;padding:0.3rem 0.5rem;white-space:nowrap;';
              addB.textContent = '+ Aggiungi';
              (function (k) {
                addB.onclick = function () {
                  var v = addI.value.trim();
                  if (!v) return;
                  if (!city[k]) city[k] = [];
                  city[k].push(v);
                  fbSaveWorldbuilding();
                  saveToStorage();
                  addI.value = '';
                  rebuildList();
                };
                addI.onkeydown = function (e) {
                  if (e.key === 'Enter') addB.click();
                };
              })(listKey);
              addR.appendChild(addI);
              addR.appendChild(addB);
              listEl.appendChild(addR);
            }
          }
          rebuildList();
          sec.appendChild(listEl);
          return sec;
        }

        cityBody.appendChild(makeCityList('Luoghi di Interesse', '🏛', 'luoghi'));
        /* Sezione NPC Chiave — NPC archiviati dall'archivio generatore */
        (function (c) {
          if (!c.npcChiave) c.npcChiave = [];
          var npcSec = document.createElement('div');
          npcSec.style.marginBottom = '0.75rem';
          var npcLbl = document.createElement('label');
          npcLbl.className = 'field-label';
          npcLbl.textContent = '👤 NPC Chiave (Archivio Città)';
          npcSec.appendChild(npcLbl);
          var npcList = document.createElement('div');
          function rebuildNPCList() {
            npcList.innerHTML = '';
            var npcArr = c.npcChiave.filter(function (n) {
              return n && typeof n === 'object';
            });
            if (npcArr.length === 0) {
              var emp = document.createElement('div');
              emp.style.cssText =
                "font-family:'EB Garamond',serif;font-size:14px;color:var(--text-faint);font-style:italic;padding:0.3rem 0;";
              emp.textContent =
                "Nessun NPC. Usa 📦 nell'archivio del Generatore per archiviare un NPC qui.";
              npcList.appendChild(emp);
              return;
            }
            npcArr.forEach(function (npc, ni) {
              var row = document.createElement('div');
              row.className = 'city-npc-item';
              var thumb = document.createElement('div');
              thumb.className = 'city-npc-thumb';
              if (npc.immagine) {
                var img = document.createElement('img');
                img.src = npc.immagine;
                img.alt = npc.nome || '';
                thumb.appendChild(img);
              } else {
                thumb.innerHTML = ICON.npc;
              }
              row.appendChild(thumb);
              var info = document.createElement('div');
              info.className = 'city-npc-info';
              var nName = document.createElement('div');
              nName.className = 'city-npc-name';
              nName.textContent = npc.nome || '(senza nome)';
              var nRole = document.createElement('div');
              nRole.className = 'city-npc-role';
              nRole.textContent =
                (npc.ruolo || '') +
                (npc.eta ? ' · ' + npc.eta + ' anni' : '') +
                (npc.stato && npc.stato !== 'vivo'
                  ? ' ' + (npc.stato === 'ferito' ? '🩸' : '☠')
                  : '');
              info.appendChild(nName);
              info.appendChild(nRole);
              row.appendChild(info);
              var reabBtn = document.createElement('button');
              reabBtn.className = 'btn-reabilita';
              reabBtn.textContent = '⬆ Riabilita';
              (function (n, i) {
                reabBtn.onclick = function () {
                  var restored = DataUtils.clone(n);
                  restored._id = restored._id || 'npc_ria_' + Date.now() + '_' + i;
                  state.personaggi.push(restored);
                  var fresh = c.npcChiave.filter(function (x) {
                    return x && typeof x === 'object';
                  });
                  fresh.splice(i, 1);
                  c.npcChiave = fresh;
                  fbSavePersonaggi();
                  fbSaveWorldbuilding();
                  saveToStorage();
                  notify(
                    '"' + (n.nome || 'NPC') + '" riabilitato nell\'archivio del Generatore NPC.'
                  );
                  rebuildNPCList();
                };
              })(npc, ni);
              row.appendChild(reabBtn);
              npcList.appendChild(row);
            });
          }
          rebuildNPCList();
          npcSec.appendChild(npcList);
          cityBody.appendChild(npcSec);
        })(city);

        /* Loot & Segreti - textarea */
        var lootG = document.createElement('div');
        lootG.innerHTML = '<label class="field-label">💎 Loot & Segreti</label>';
        var lootTA = document.createElement('textarea');
        lootTA.className = 'field';
        lootTA.rows = 3;
        lootTA.placeholder = 'Oggetti nascosti, segreti della città, trame…';
        lootTA.value = city.lootSegreti || '';
        (function (c) {
          lootTA.onchange = function () {
            c.lootSegreti = this.value;
            fbSaveWorldbuilding();
            saveToStorage();
          };
        })(city);
        lootG.appendChild(lootTA);
        cityBody.appendChild(lootG);

        cityCard.appendChild(cityHdr);
        cityCard.appendChild(cityBody);
        zonaBody.appendChild(cityCard);
      });

      /* Aggiungi città */
      if (isDM()) {
        var addCittaRow = document.createElement('div');
        addCittaRow.style.cssText =
          'display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem;flex-wrap:wrap;';
        var cittaI = document.createElement('input');
        cittaI.type = 'text';
        cittaI.className = 'field';
        cittaI.placeholder = 'Nome città…';
        cittaI.style.flex = '1';
        cittaI.style.minWidth = '140px';
        var tipoSel = document.createElement('select');
        tipoSel.className = 'field';
        tipoSel.style.cssText = 'flex:0 1 140px;min-width:100px;';
        ['città', 'villaggio', 'dungeon', 'fortezza', 'altro'].forEach(function (t) {
          var o = document.createElement('option');
          o.value = t;
          o.textContent = t;
          tipoSel.appendChild(o);
        });
        var addCittaBtn = document.createElement('button');
        addCittaBtn.className = 'btn-gold';
        addCittaBtn.style.cssText = 'white-space:nowrap;font-size:12px;';
        addCittaBtn.textContent = '+ Città';
        (function (z) {
          addCittaBtn.onclick = function () {
            var n = cittaI.value.trim();
            if (!n) {
              notify('Inserisci il nome della città.', 'err');
              return;
            }
            if (!z.citta) z.citta = [];
            z.citta.push({
              id: 'c_' + Date.now(),
              nome: n,
              tipo: tipoSel.value,
              note: '',
              luoghi: [],
              npcChiave: [],
              lootSegreti: '',
              immagineMappaAlto: '',
              immagineDinamica: '',
            });
            fbSaveWorldbuilding();
            saveToStorage();
            cittaI.value = '';
            renderMain();
          };
          cittaI.onkeydown = function (e) {
            if (e.key === 'Enter') addCittaBtn.click();
          };
        })(zone);
        addCittaRow.appendChild(cittaI);
        addCittaRow.appendChild(tipoSel);
        addCittaRow.appendChild(addCittaBtn);
        zonaBody.appendChild(addCittaRow);
      }

      zonaEl.appendChild(zonaHdr);
      zonaEl.appendChild(zonaBody);
      body.appendChild(zonaEl);
    });
  }

  wrap.appendChild(body);
  return wrap;
}
