
window._brancaloniaDefault = function(id) {
  return { 
    id: id || '', 
    schedaTipo: 'brancalonia',
    nome: '', 
    avatar: '', 
    branca_data: {} 
  };
};

window.renderBrancaloniaSheet = function(scheda) {
  var _dm = window.state ? window.state.schedePGViewMode : false;
  scheda.branca_data = scheda.branca_data || {};
  var _editMode = false;
  var scale = 1;

  var layout = [];
  var localLayout = localStorage.getItem('sium_branca_layout');
  if (localLayout) {
    try { layout = JSON.parse(localLayout); } catch(e) { layout = null; }
  }
  if (!layout || !layout.length) {
    layout = JSON.parse(JSON.stringify(window.BRANCA_NATIVE || [[],[]]));
    var hasAvatar = layout[0] && layout[0].find(f => f.type === 'image');
    if (!hasAvatar && layout[0]) {
      layout[0].push({ name: 'avatarBox', type: 'image', l: 6.5, t: 69, w: 27.5, h: 26 });
    }
  }

  if (window._db) {
    window._db.ref('state/config/branca_layout').once('value', function(s) {
      var remoteLayout = s.val();
      if (remoteLayout && JSON.stringify(remoteLayout) !== JSON.stringify(layout)) {
        layout = remoteLayout;
        localStorage.setItem('sium_branca_layout', JSON.stringify(layout));
        renderPages();
      }
    });
  }

  function saveLayout() {
    localStorage.setItem('sium_branca_layout', JSON.stringify(layout));
    if (window._db) {
      window._db.ref('state/config/branca_layout').set(layout);
    }
  }

  
  function syncDashboard() {
    let bestNameField = null;
    let minNameDist = 9999;
    
    if (layout[0]) {
      layout[0].forEach(f => {
        if (f.type === 'text' || f.type === 'text-fit' || f.type === 'textarea') {
          let cx = f.l + (f.w / 2);
          let cy = f.t + (f.h / 2);
          let dist = Math.pow(cx - 50, 2) + Math.pow(cy - 22, 2);
          if (dist < minNameDist && scheda.branca_data[f.name]) {
            minNameDist = dist;
            bestNameField = f.name;
          }
        }
      });
      
      if (bestNameField) {
         scheda.nomePersonaggio = scheda.branca_data[bestNameField];
         scheda.nome = scheda.nomePersonaggio;
      }
      
      let avatarField = layout[0].find(f => f.type === 'image' && scheda.branca_data[f.name]);
      if (avatarField) {
         scheda.avatar = scheda.branca_data[avatarField.name];
         scheda.aspettoImg = scheda.avatar;
      }
    }
  }

  function save() {
    syncDashboard();
    if(!_dm && window.fbSaveScheda) {
      if(window._schedaSaveTimer) clearTimeout(window._schedaSaveTimer);
      window._schedaSaveTimer = setTimeout(function(){ window.fbSaveScheda(); }, 600);
    }
  }


  var wrap = document.createElement('div'); 
  wrap.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;background:#2e2e2e;position:relative;overflow:hidden;';
  
  var nav = document.createElement('div'); 
  nav.style.cssText = 'background:#1a1a1a;border-bottom:1px solid #444;padding:0.5rem 1rem;display:flex;align-items:center;gap:0.5rem;z-index:200;flex-shrink:0;';
  
  var bk = document.createElement('button'); bk.innerHTML = '&#8592; Torna'; bk.style.cssText = 'background:#333;color:#fff;border:1px solid #555;padding:4px 10px;cursor:pointer;border-radius:3px;';
  bk.onclick = function() { 
    if(window.state && window.state.schedePGViewMode) { window.state.schedePGViewMode=false; window.state.schedePGOpenChar=null; window.state.schedaAttivaId=null; window.state.scheda={}; } 
    else { window.state.schedaAttivaId=null; window.state.scheda={}; } 
    if(window.renderMain) window.renderMain(); 
  };
  nav.appendChild(bk);

  var sp = document.createElement('span'); sp.style.flex = '1'; nav.appendChild(sp);

  
  

  if(!_dm) {
    
    var lavToggle = document.createElement('button'); 
    lavToggle.innerHTML = '\uD83D\uDCDD Appunti del Canaglia'; 
    lavToggle.style.cssText = 'background:#d63031;color:#fff;border:none;border-radius:3px;padding:4px 10px;cursor:pointer;font-weight:bold;margin-right:10px;';
    lavToggle.onclick = function() {
      if(window._toggleGlobalLavagna) window._toggleGlobalLavagna();
      else { window.state.lavagnaOpen = !window.state.lavagnaOpen; if(window.renderMain) window.renderMain(); }
    };
    nav.appendChild(lavToggle);

    var btnEdit = document.createElement('button'); 
    btnEdit.innerHTML = '📐 Modifica Layout'; 
    btnEdit.style.cssText = 'background:#8e44ad;color:#fff;border:none;border-radius:3px;padding:4px 10px;cursor:pointer;font-weight:bold;margin-right:10px;';
    btnEdit.onclick = function() { 
      _editMode = !_editMode;
      btnEdit.innerHTML = _editMode ? '💾 Salva Layout' : '📐 Modifica Layout';
      btnEdit.style.background = _editMode ? '#27ae60' : '#8e44ad';
      if(!_editMode) saveLayout();
      renderPages();
    };
    nav.appendChild(btnEdit);

    var btnDel = document.createElement('button'); btnDel.textContent = 'Elimina Scheda'; btnDel.style.cssText = 'background:#c0392b;color:#fff;border:none;border-radius:3px;padding:4px 10px;cursor:pointer;font-weight:bold;';
    btnDel.onclick = function() { 
      if(!confirm('ELIMINARE DEFINITIVAMENTE questa scheda?')) return; 
      if(window.state && window.state.schedaAttivaId) { 
        if(window.fbDeleteSchedaItem) window.fbDeleteSchedaItem(window.state.schedaAttivaId);
        else if(window._db) window._db.ref('schedePG/'+window.state.currentUser.username+'/chars/'+window.state.schedaAttivaId).remove();
        let idx = window.state.schedeList.findIndex(s => s.id === window.state.schedaAttivaId); 
        if(idx>=0) window.state.schedeList.splice(idx,1); 
        window.state.schedaAttivaId = null; window.state.scheda = {}; 
        if(window.renderMain) window.renderMain(); 
      } 
    };
    nav.appendChild(btnDel);
  }
  wrap.appendChild(nav);

  var scrollArea = document.createElement('div');
  scrollArea.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;align-items:center;padding:20px;gap:20px;';
  
  scrollArea.addEventListener('wheel', function(e) {
    if(e.ctrlKey || e.metaKey) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? -0.05 : 0.05;
      scale = Math.max(0.3, Math.min(scale + delta, 3.0));
      pagesWrap.style.transform = 'scale(' + scale + ')';
    }
  }, {passive:false});

  var pagesWrap = document.createElement('div');
  pagesWrap.style.cssText = 'display:flex;flex-direction:column;gap:30px;transform-origin:top center;transition:transform 0.1s ease-out;';

  function createField(fieldDef, pageIndex, pDiv) {
    var isCheckbox = fieldDef.type === 'checkbox';
    var isImage = fieldDef.type === 'image';
    var isTextFit = fieldDef.type === 'text-fit';
    var isTextArea = fieldDef.type === 'textarea' || (!isCheckbox && !isImage && !isTextFit && fieldDef.h > 3);
    
    var wrapEl = document.createElement('div');
    wrapEl.style.position = 'absolute';
    wrapEl.style.left = fieldDef.l + '%';
    wrapEl.style.top = fieldDef.t + '%';
    wrapEl.style.width = fieldDef.w + '%';
    wrapEl.style.height = fieldDef.h + '%';
    wrapEl.style.zIndex = '10';

    var el = document.createElement(isCheckbox || isImage ? 'div' : (isTextArea ? 'textarea' : 'input'));
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.boxSizing = 'border-box';
    el.spellcheck = false;
    wrapEl.appendChild(el);

    var val = scheda.branca_data[fieldDef.name] || '';

    // ==================== COMMON STYLE & AUTOFIT ====================
    if (!isCheckbox && !isImage) {
      el.style.fontWeight = fieldDef.bold ? 'bold' : 'normal';
    }

    function doAutoFit() {
      if(isTextFit && wrapEl.offsetHeight > 0) {
        // Find best size to fit height, and center
        el.style.fontSize = (wrapEl.offsetHeight * 0.7) + 'px';
      }
    }

    // ==================== EDIT MODE ====================
    if (_editMode) {
      wrapEl.style.border = '2px dashed #000';
      if (isCheckbox) wrapEl.style.backgroundColor = 'rgba(52, 152, 219, 0.5)';
      else if (isImage) wrapEl.style.backgroundColor = 'rgba(46, 204, 113, 0.5)';
      else if (isTextFit) wrapEl.style.backgroundColor = 'rgba(230, 126, 34, 0.5)';
      else wrapEl.style.backgroundColor = 'rgba(241, 196, 15, 0.5)';
      
      wrapEl.style.cursor = 'move';
      el.style.pointerEvents = 'none';
      el.style.background = 'transparent';
      el.style.border = 'none';
      if(isCheckbox) el.style.borderRadius = '50%';
      
      if(isTextFit) {
        el.style.textAlign = 'center';
        setTimeout(doAutoFit, 100);
        el.value = fieldDef.name.substring(0,6);
      }
      
      var lbl = document.createElement('div');
      lbl.textContent = fieldDef.type.substring(0,3).toUpperCase() + ':' + fieldDef.name.substring(0,8);
      lbl.style.cssText = 'position:absolute;top:2px;left:2px;font-size:8px;color:#000;background:rgba(255,255,255,0.7);pointer-events:none;overflow:hidden;max-height:100%;z-index:20;';
      if(fieldDef.w > 3 && fieldDef.h > 1.5) wrapEl.appendChild(lbl);

      var delBtn = document.createElement('div');
      delBtn.innerHTML = '❌'; 
      delBtn.style.cssText = 'position:absolute;top:-10px;right:-10px;background:#fff;border-radius:50%;cursor:pointer;font-size:12px;line-height:1;padding:3px;box-shadow:0 0 3px #000;z-index:30;display:flex;align-items:center;justify-content:center;width:14px;height:14px;';
      delBtn.onmousedown = function(e) {
        e.stopPropagation();
        if(confirm('Eliminare questo campo?')) {
          var arr = layout[pageIndex];
          arr.splice(arr.indexOf(fieldDef), 1);
          renderPages();
        }
      };
      wrapEl.appendChild(delBtn);

      if (!isCheckbox && !isImage) {
        var boldBtn = document.createElement('div');
        boldBtn.innerHTML = 'B';
        boldBtn.style.cssText = 'position:absolute;top:-10px;right:18px;background:#fff;border-radius:50%;cursor:pointer;font-size:12px;font-weight:900;font-family:serif;line-height:1;padding:3px;box-shadow:0 0 3px #000;z-index:30;display:flex;align-items:center;justify-content:center;width:14px;height:14px;color:'+(fieldDef.bold?'#27ae60':'#333')+';border:'+(fieldDef.bold?'2px solid #27ae60':'none')+';';
        boldBtn.onmousedown = function(e) {
          e.stopPropagation();
          fieldDef.bold = !fieldDef.bold;
          boldBtn.style.color = fieldDef.bold ? '#27ae60' : '#333';
          boldBtn.style.border = fieldDef.bold ? '2px solid #27ae60' : 'none';
          el.style.fontWeight = fieldDef.bold ? 'bold' : 'normal';
        };
        wrapEl.appendChild(boldBtn);
      }

      var res = document.createElement('div');
      res.style.cssText = 'position:absolute;bottom:-5px;right:-5px;width:12px;height:12px;background:#c0392b;border:1px solid #fff;border-radius:50%;cursor:se-resize;z-index:30;';
      wrapEl.appendChild(res);

      var isDragging = false, isResizing = false;
      var startX, startY, startL, startT, startW, startH;
      var pw, ph;
      
      res.onmousedown = function(e) { 
        e.stopPropagation(); isResizing = true; 
        startX = e.clientX; startY = e.clientY; 
        startW = fieldDef.w; startH = fieldDef.h; 
        pw = pDiv.offsetWidth; ph = pDiv.offsetHeight;
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); 
      };
      
      wrapEl.onmousedown = function(e) { 
        if(e.target === res || e.target === delBtn || e.target.innerHTML === 'B') return;
        e.stopPropagation(); isDragging = true; 
        startX = e.clientX; startY = e.clientY; 
        startL = fieldDef.l; startT = fieldDef.t; 
        pw = pDiv.offsetWidth; ph = pDiv.offsetHeight;
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); 
      };

      function onMove(e) {
        var dx = (e.clientX - startX) / scale;
        var dy = (e.clientY - startY) / scale;
        if(isResizing) {
          fieldDef.w = Math.max(0.5, startW + (dx / pw * 100));
          fieldDef.h = Math.max(0.5, startH + (dy / ph * 100));
          wrapEl.style.width = fieldDef.w + '%'; wrapEl.style.height = fieldDef.h + '%';
          doAutoFit();
        } else if(isDragging) {
          fieldDef.l = startL + (dx / pw * 100);
          fieldDef.t = startT + (dy / ph * 100);
          wrapEl.style.left = fieldDef.l + '%'; wrapEl.style.top = fieldDef.t + '%';
        }
      }
      function onUp() { isDragging=false; isResizing=false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
      
      return wrapEl; 
    }

    // ==================== PLAY MODE ====================
    if(isCheckbox) {
      el.style.cursor = _dm ? 'default' : 'pointer';
      el.style.background = val ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.4)';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid rgba(0,0,0,0.6)';
      if(!_dm) {
        el.onclick = function() {
          scheda.branca_data[fieldDef.name] = !scheda.branca_data[fieldDef.name];
          el.style.background = scheda.branca_data[fieldDef.name] ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.4)';
          save();
        };
      }
    } else if (isImage) {
      el.style.borderRadius = '4px';
      el.style.overflow = 'hidden';
      el.style.display = 'flex'; el.style.flexDirection = 'column'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
      el.style.background = 'rgba(0,0,0,0.05)';
      
      var aIm = document.createElement('img'); 
      aIm.style.cssText = 'width:100%;height:100%;object-fit:cover;display:'+(val?'block':'none')+';'; 
      aIm.src = val;
      // Sync on load
      if (val && (!scheda.avatar || scheda.avatar !== val)) {
         scheda.avatar = val; scheda.aspettoImg = val;
      }
      
      var hint = document.createElement('div');
      hint.innerHTML = '📷<br>Carica Foto';
      hint.style.cssText = 'color:rgba(0,0,0,0.4);text-align:center;font-size:18px;font-family:Cinzel,serif;font-weight:bold;pointer-events:none;display:'+(val?'none':'block')+';';
      
      var bRem = document.createElement('button'); bRem.innerHTML = '❌';
      bRem.style.cssText = 'position:absolute;top:5px;right:5px;background:rgba(255,255,255,0.8);border:none;border-radius:50%;cursor:pointer;display:'+(val?'block':'none')+';font-size:10px;padding:3px;';
      
      el.appendChild(aIm); el.appendChild(hint); el.appendChild(bRem);
      
      if(!_dm) {
        el.onclick = function(e) {
          if(e.target === bRem) {
            e.stopPropagation(); scheda.branca_data[fieldDef.name] = ''; aIm.src = ''; aIm.style.display = 'none';
            bRem.style.display = 'none'; hint.style.display = 'block'; save(); return;
          }
          var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.style.display = 'none';
          document.body.appendChild(fi);
          fi.onchange = function(e) {
            document.body.removeChild(fi);
            var f = e.target.files[0]; if(!f) return;
            var rd = new FileReader(); rd.onload = function(ev) {
              scheda.branca_data[fieldDef.name] = ev.target.result; scheda.avatar = ev.target.result; scheda.aspettoImg = ev.target.result; aIm.src = ev.target.result; aIm.style.display = 'block'; hint.style.display = 'none'; bRem.style.display = 'block';
              save();
            }; rd.readAsDataURL(f);
          }; fi.click();
        };
      }
    } else {
      if(!isTextArea) el.type = 'text';
      el.value = val;
      el.readOnly = _dm;
      
      // Sync on load
      if (pageIndex === 0 && (fieldDef.name === 'Text-yh8c2D_kEU' || (fieldDef.w > 30 && fieldDef.l > 25 && fieldDef.l < 40 && fieldDef.t > 18 && fieldDef.t < 25))) {
        if (val && (!scheda.nomePersonaggio || scheda.nomePersonaggio !== val)) {
           scheda.nomePersonaggio = val; scheda.nome = val;
           // avoid recursive saves on bulk init, just set it
        }
      }
      el.style.background = '#ffffff'; el.style.border = 'none'; el.style.outline = 'none'; el.style.color = '#111';
      el.style.fontFamily = '"Nunito", Arial, sans-serif';
      
      if(isTextFit) {
        el.style.textAlign = 'center';
        setTimeout(doAutoFit, 50);
        window.addEventListener('resize', doAutoFit);
      } else {
        el.style.fontSize = Math.min(16, Math.max(12, fieldDef.h * 10)) + 'px';
      }
      
      if(isTextArea) {
        el.style.resize = 'none'; el.style.overflow = 'hidden'; el.style.lineHeight = '1.3'; el.style.fontSize = '14px';
      }

      el.oninput = function() {
        scheda.branca_data[fieldDef.name] = el.value;
        if (pageIndex === 0 && (fieldDef.name === 'Text-yh8c2D_kEU' || (fieldDef.w > 30 && fieldDef.l > 25 && fieldDef.l < 40 && fieldDef.t > 18 && fieldDef.t < 25))) {
            scheda.nomePersonaggio = el.value; scheda.nome = el.value;
        }
        save();
      };
      
      // Quando finisce di scrivere (blur), riadatta
      el.onblur = function() {
        if(isTextFit) doAutoFit();
      };
    }
    
    return wrapEl;
  }

  function renderPages() {
    pagesWrap.innerHTML = '';
    
    layout.forEach(function(pageWidgets, i) {
      var pDiv = document.createElement('div');
      pDiv.style.cssText = 'width:1050px;aspect-ratio:1/1.414;background:url(schede/branca_p'+(i+1)+'.jpg) center/contain no-repeat;position:relative;box-shadow:0 0 15px rgba(0,0,0,0.5);';
      
      pageWidgets.forEach(function(w) { pDiv.appendChild(createField(w, i, pDiv)); });

      if (_editMode) {
        var ab = document.createElement('div');
        ab.style.cssText = 'position:absolute;top:-40px;left:0;right:0;display:flex;gap:10px;justify-content:center;background:rgba(0,0,0,0.7);padding:5px;border-radius:4px;';
        
        function addBtn(lbl, type, w, h) {
          var btn = document.createElement('button'); btn.textContent = '+ ' + lbl;
          btn.style.cssText = 'background:#f39c12;border:none;color:#fff;padding:4px 8px;border-radius:3px;cursor:pointer;font-weight:bold;';
          btn.onclick = function() {
            layout[i].push({ name: 'Custom_' + Date.now(), type: type, l: 40, t: 40, w: w, h: h, bold: false });
            renderPages();
          };
          ab.appendChild(btn);
        }
        addBtn('Testo (Normale)', 'text', 20, 2);
        addBtn('Testo (Lungo)', 'textarea', 20, 10);
        addBtn('Testo (Centrato/Auto)', 'text-fit', 10, 5);
        addBtn('Pallino', 'checkbox', 1.5, 1);
        addBtn('Immagine', 'image', 15, 15);
        
        pDiv.appendChild(ab);
      }
      
      pagesWrap.appendChild(pDiv);
    });

    if (!_editMode) {
      var hw = document.createElement('div');
      hw.style.cssText = 'width:1050px; background:#f4e9d8; border:4px solid #553b28; border-radius:8px; padding:30px; margin-top:20px; box-shadow:0 0 15px rgba(0,0,0,0.5); font-family:"Cinzel", serif; box-sizing:border-box;';
      var ht = document.createElement('h2'); ht.textContent = "Storia del Personaggio";
      ht.style.cssText = 'color:#553b28; font-weight:900; margin:0 0 15px 0; border-bottom:3px solid #d63031; padding-bottom:10px; text-transform:uppercase; font-size:24px;';
      var ha = document.createElement('textarea');
      ha.placeholder = 'Scrivi qui le gesta...';
      ha.style.cssText = 'width:100%; min-height:300px; background:rgba(255,255,255,0.5); border:1px dashed #553b28; outline:none; resize:vertical; font-family:"Nunito", Arial, sans-serif; font-size:16px; color:#111; line-height:1.6; padding:15px; box-sizing:border-box; border-radius:4px;';
      ha.value = scheda.branca_data.storia_personaggio || '';
      ha.readOnly = _dm;
      ha.oninput = function() { scheda.branca_data.storia_personaggio = this.value; save(); };
      ha.onfocus = function() { this.style.background = '#fff'; this.style.borderStyle = 'solid'; };
      ha.onblur = function() { this.style.background = 'rgba(255,255,255,0.5)'; this.style.borderStyle = 'dashed'; };
      
      hw.appendChild(ht); hw.appendChild(ha);
      pagesWrap.appendChild(hw);
    }
  }

  renderPages();
  scrollArea.appendChild(pagesWrap);
  wrap.appendChild(scrollArea);
  
  syncDashboard();
  return wrap;
};
