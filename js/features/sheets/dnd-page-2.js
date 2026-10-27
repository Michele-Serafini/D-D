/* D&D character sheet, page 2. Fields share the active character context. */
function renderDndPage2(context) {
  var { makePage, s, ss, cellLbl, makeHdrCell, secTitle } = context;
  /* ==================== PAGINA 2 ==================== */
  var pg2 = makePage();
  var hdr2 = document.createElement('div');
  hdr2.style.cssText =
    'border:1.5px solid #555;border-radius:3px;margin-bottom:8px;overflow:hidden;';
  var h2R1 = document.createElement('div');
  h2R1.style.cssText =
    'display:grid;grid-template-columns:2.5fr 1fr 1fr 1fr;border-bottom:1px solid #aaa;';
  var h2N = document.createElement('div');
  h2N.style.cssText = 'padding:3px 4px;';
  var h2NI = document.createElement('input');
  h2NI.type = 'text';
  h2NI.value = s.nomePersonaggio || '';
  h2NI.style.cssText =
    'width:100%;border:none;background:transparent;color:#111;font-size:14px;font-weight:bold;outline:none;';
  h2NI.oninput = function () {
    s.nomePersonaggio = this.value;
    ss();
  };
  h2N.appendChild(h2NI);
  h2N.appendChild(cellLbl('Nome Personaggio'));
  h2R1.appendChild(h2N);
  h2R1.appendChild(makeHdrCell('Età', 'eta', false));
  h2R1.appendChild(makeHdrCell('Altezza', 'altezza', false));
  h2R1.appendChild(makeHdrCell('Peso', 'peso', false));
  var h2R2 = document.createElement('div');
  h2R2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;';
  h2R2.appendChild(makeHdrCell('Occhi', 'occhi', true));
  h2R2.appendChild(makeHdrCell('Carnagione', 'carnagione', false));
  h2R2.appendChild(makeHdrCell('Capelli', 'capelli', false));
  hdr2.appendChild(h2R1);
  hdr2.appendChild(h2R2);
  pg2.appendChild(hdr2);
  var bg2G = document.createElement('div');
  bg2G.style.cssText =
    'display:grid;grid-template-columns:220px 1fr;gap:8px;flex:1;align-items:stretch;';
  var bg2L = document.createElement('div');
  bg2L.style.cssText = 'display:flex;flex-direction:column;gap:6px;height:100%;overflow:hidden;';
  /* immagine personaggio — altezza fissa in alto */
  var aspImgB = document.createElement('div');
  aspImgB.style.cssText =
    'border:1px solid #aaa;border-radius:3px;overflow:hidden;cursor:pointer;position:relative;background:#f5f5f5;display:flex;align-items:center;justify-content:center;height:280px;flex-shrink:0;';
  if (s.aspettoImg) {
    var aspI2 = document.createElement('img');
    aspI2.src = s.aspettoImg;
    aspI2.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    aspImgB.appendChild(aspI2);
    var aspDel = document.createElement('div');
    aspDel.style.cssText =
      'position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.65);color:#fff;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:11px;';
    aspDel.textContent = '✕';
    aspDel.onclick = function (e) {
      e.stopPropagation();
      s.aspettoImg = '';
      ss();
      renderMain();
    };
    aspImgB.appendChild(aspDel);
  } else {
    aspImgB.innerHTML =
      '<div style="text-align:center;color:#aaa;font-family:Arial,sans-serif;"><div style="font-size:36px;">🧙</div><div style="font-size:10px;margin-top:6px;">Clicca per caricare<br>immagine personaggio</div></div>';
  }
  aspImgB.onclick = function (e) {
    if (e.target.textContent === '✕') return;
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = function () {
      if (!this.files[0]) return;
      var r = new FileReader();
      r.onload = function (ev) {
        var im = new Image();
        im.onload = function () {
          var MAX = 700;
          var ratio = Math.min(1, MAX / Math.max(im.width, im.height));
          var cv = document.createElement('canvas');
          cv.width = Math.round(im.width * ratio);
          cv.height = Math.round(im.height * ratio);
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          s.aspettoImg = cv.toDataURL('image/jpeg', 0.72);
          ss();
          renderMain();
        };
        im.src = ev.target.result;
      };
      r.readAsDataURL(this.files[0]);
    };
    inp.click();
  };
  bg2L.appendChild(aspImgB);
  /* descrizione aspetto — riempie lo spazio rimanente */
  var aspDB = document.createElement('div');
  aspDB.style.cssText =
    'border:1px solid #aaa;border-radius:2px;flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:120px;';
  var aspTa = document.createElement('textarea');
  aspTa.style.cssText =
    'width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;flex:1;box-sizing:border-box;';
  aspTa.value = s.aspettoDesc || '';
  aspTa.oninput = function () {
    s.aspettoDesc = this.value;
    ss();
  };
  aspDB.appendChild(aspTa);
  aspDB.appendChild(secTitle('Aspetto del Personaggio'));
  bg2L.appendChild(aspDB);
  bg2G.appendChild(bg2L);
  var bg2R = document.createElement('div');
  bg2R.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  var alleB2 = document.createElement('div');
  alleB2.style.cssText = 'border:1px solid #aaa;border-radius:2px;flex-shrink:0;';
  var orgR2 = document.createElement('div');
  orgR2.style.cssText =
    'display:flex;align-items:center;gap:4px;padding:3px;border-bottom:1px solid #ddd;';
  var orgL2 = document.createElement('span');
  orgL2.style.cssText = 'font-size:7px;color:#555;white-space:nowrap;';
  orgL2.textContent = 'Nome organizzazione:';
  var orgI2 = document.createElement('input');
  orgI2.type = 'text';
  orgI2.value = s.nomeOrg || '';
  orgI2.style.cssText =
    'flex:1;background:transparent;border:none;border-bottom:1px solid #bbb;color:#111;font-size:11px;outline:none;';
  orgI2.oninput = function () {
    s.nomeOrg = this.value;
    ss();
  };
  orgR2.appendChild(orgL2);
  orgR2.appendChild(orgI2);
  alleB2.appendChild(orgR2);
  var alleTa2 = document.createElement('textarea');
  alleTa2.style.cssText =
    'width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;min-height:70px;';
  alleTa2.value = s.alleatiOrg || '';
  alleTa2.oninput = function () {
    s.alleatiOrg = this.value;
    ss();
  };
  alleB2.appendChild(alleTa2);
  alleB2.appendChild(secTitle('Alleati & Organizzazioni'));
  bg2R.appendChild(alleB2);
  [
    ['Storia del Personaggio', 'storia', 160, false],
    ['Tratti & Privilegi Aggiuntivi', 'trattiAgg', 120, false],
    ['Tesoro', 'tesoro', 80, true],
  ].forEach(function (tf) {
    var grow = tf[3];
    var box = document.createElement('div');
    box.style.cssText =
      'border:1px solid #aaa;border-radius:2px;' +
      (grow ? 'flex:1;display:flex;flex-direction:column;overflow:hidden;' : '');
    var ta = document.createElement('textarea');
    ta.style.cssText =
      'width:100%;background:transparent;border:none;resize:none;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9px;outline:none;padding:3px;' +
      (grow ? 'flex:1;min-height:' + tf[2] + 'px;' : 'height:' + tf[2] + 'px;');
    ta.value = s[tf[1]] || '';
    (function (k) {
      ta.oninput = function () {
        s[k] = this.value;
        ss();
      };
    })(tf[1]);
    box.appendChild(ta);
    box.appendChild(secTitle(tf[0]));
    bg2R.appendChild(box);
  });
  bg2G.appendChild(bg2R);
  pg2.appendChild(bg2G);
  return pg2;
}
