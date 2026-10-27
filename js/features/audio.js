/* Native HTML5 soundscape engine: playback, fades and controls. */
var GRADE_VOLUMES = [0, 0.28, 0.6, 1.0];
var _audios = {};
var _audioFades = {};
var _audioGrades = {};
var _bardoTimer = null;
var _regiaGrade = 0;
var _regiaMode = 'explore';
var _audioUnlocked = false;

/* Sblocca autoplay policy con un buffer silenzioso — va chiamato dentro un click handler diretto */
function unlockAudio(cb) {
  if (_audioUnlocked) {
    if (cb) cb();
    return;
  }
  var sil = new Audio(
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
  );
  sil.volume = 0;
  var done = function () {
    _audioUnlocked = true;
    sil.pause();
    if (cb) cb();
  };
  var p = sil.play();
  if (p && p.then) p.then(done).catch(done);
  else done();
}

/* ── fade lineare ── */
function audioFadeTo(slotId, targetVol, durationMs, onDone) {
  if (_audioFades[slotId]) {
    cancelAnimationFrame(_audioFades[slotId]);
    _audioFades[slotId] = null;
  }
  var entry = _audios[slotId];
  if (!entry) {
    if (onDone) onDone();
    return;
  }
  var startVol = entry.el.volume;
  var startTime = performance.now();
  function step(now) {
    var e2 = _audios[slotId];
    if (!e2) {
      if (onDone) onDone();
      return;
    }
    var t = Math.min(1, (now - startTime) / Math.max(1, durationMs));
    e2.el.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * t));
    if (t < 1) {
      _audioFades[slotId] = requestAnimationFrame(step);
    } else {
      e2.el.volume = targetVol;
      _audioFades[slotId] = null;
      if (onDone) onDone();
    }
  }
  _audioFades[slotId] = requestAnimationFrame(step);
}

/* ── ottieni o crea audio element; NON ricrea se src uguale ── */
function getAudio(slotId, src, loop) {
  var entry = _audios[slotId];
  if (entry && entry.src === src) return entry.el;
  /* src diversa → fade out e sostituisci */
  if (entry) {
    audioFadeTo(slotId, 0, 400, function () {
      entry.el.pause();
      entry.el.src = '';
    });
  }
  if (_audioFades[slotId]) {
    cancelAnimationFrame(_audioFades[slotId]);
    _audioFades[slotId] = null;
  }
  var el = new Audio(src);
  el.loop = loop !== false;
  el.volume = 0;
  el.preload = 'auto';
  _audios[slotId] = { el: el, src: src };
  return el;
}

/* ── risolve src per la scena (rispetta custom URL e combat mode) ── */
function resolveScenaUrl(scenaId, mode) {
  var m = mode || _regiaMode;
  /* URL personalizzati: cerca prima combat poi explore */
  if (state.regiaUrls) {
    var key = m === 'combat' ? scenaId + '__combat' : scenaId;
    if (state.regiaUrls[key]) return state.regiaUrls[key];
    /* fallback sull'explore se combat non impostato */
    if (m === 'combat' && state.regiaUrls[scenaId]) return state.regiaUrls[scenaId];
  }
  var scena = SCENE_AUDIO.filter(function (s) {
    return s.id === scenaId;
  })[0];
  if (!scena) return null;
  if (m === 'combat' && scena.combatFile) return _au(scena.combatFile);
  if (scena.audioFile) return _au(scena.audioFile);
  return null;
}

function resolveSfxUrl(sfxId) {
  if (
    state.regiaUrlsSfx &&
    state.regiaUrlsSfx[state.regiaScena] &&
    state.regiaUrlsSfx[state.regiaScena][sfxId]
  )
    return state.regiaUrlsSfx[state.regiaScena][sfxId];
  return SFX_MAP[sfxId] || null;
}

/* ── avvia o aggiusta volume della scena principale ── */
function playScena(scenaId, grade) {
  _regiaGrade = grade;
  if (grade === 0) {
    stopScena();
    return;
  }
  var src = resolveScenaUrl(scenaId, _regiaMode);
  if (!src) {
    console.warn('[Regia] File mancante:', scenaId, _regiaMode);
    return;
  }
  var slot = 'main';
  var entry = _audios[slot];

  /* Stessa src già caricata → solo fade volume, nessun restart */
  if (entry && entry.src === src) {
    if (entry.el.paused) {
      entry.el.volume = 0;
      var pp = entry.el.play();
      if (pp && pp.catch)
        pp.catch(function (e) {
          console.warn('[Regia]', e.message);
        });
    }
    audioFadeTo(slot, GRADE_VOLUMES[grade], 600);
    return;
  }

  /* Src diversa → cross-fade: fade out vecchio, fade in nuovo */
  if (entry && !entry.el.paused) {
    var oldEntry = entry;
    var oldSlot = 'main_old';
    _audios[oldSlot] = oldEntry;
    audioFadeTo(oldSlot, 0, 700, function () {
      oldEntry.el.pause();
      oldEntry.el.src = '';
      delete _audios[oldSlot];
    });
  }
  var el = getAudio(slot, src, true);
  el.volume = 0;
  var p = el.play();
  if (p && p.catch)
    p.catch(function (e) {
      console.warn('[Regia]', e.message);
    });
  audioFadeTo(slot, GRADE_VOLUMES[grade], 900);
}

/* ── cambia modalità explore/combat mantenendo posizione e grado ── */
function setMode(mode) {
  if (mode === _regiaMode) return;
  var prevMode = _regiaMode;
  _regiaMode = mode;
  if (_regiaGrade > 0 && state.regiaScena) {
    var prevSrc = resolveScenaUrl(state.regiaScena, prevMode);
    var newSrc = resolveScenaUrl(state.regiaScena, mode);
    if (newSrc && newSrc !== prevSrc) {
      // Traccia diversa per i due modi: fade out lento (1.4s) poi fade in
      if (_audios['main'] && !_audios['main'].el.paused) {
        audioFadeTo('main', 0, 1400, function () {
          if (_regiaGrade > 0) playScena(state.regiaScena, _regiaGrade);
        });
      } else {
        playScena(state.regiaScena, _regiaGrade);
      }
    } else {
      // Stessa traccia: "breath" — abbassa poi rialza per segnalare il cambio
      var v = GRADE_VOLUMES[_regiaGrade];
      audioFadeTo('main', v * 0.12, 700, function () {
        audioFadeTo('main', v, 1100);
      });
    }
  }
}

function stopScena() {
  _regiaGrade = 0;
  var entry = _audios['main'];
  if (!entry) return;
  var el = entry.el;
  audioFadeTo('main', 0, 600, function () {
    el.pause();
  });
}

function setSfxGrade(sfxId, grade) {
  _audioGrades[sfxId] = grade;
  var slot = 'sfx_' + sfxId;
  if (grade === 0) {
    var e0 = _audios[slot];
    if (e0)
      audioFadeTo(slot, 0, 400, function () {
        e0.el.pause();
      });
    return;
  }
  var src = resolveSfxUrl(sfxId);
  if (!src) return;
  var el = getAudio(slot, src, true);
  if (el.paused) {
    el.volume = 0;
    var p = el.play();
    if (p && p.catch)
      p.catch(function (e) {
        console.warn('[Regia sfx]', e.message);
      });
  }
  audioFadeTo(slot, GRADE_VOLUMES[grade], 400);
}

var _waCtx = null;
function _getWACtx() {
  if (!_waCtx) {
    try {
      _waCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  return _waCtx;
}
function _synthBell() {
  var ctx = _getWACtx();
  if (!ctx) return;
  var freqs = [523, 784, 1046, 1568];
  freqs.forEach(function (freq, i) {
    var osc = ctx.createOscillator(),
      g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    var t = ctx.currentTime,
      vol = 0.6 / (i + 1),
      dur = 3 - i * 0.5;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
  });
}
function _synthThunder() {
  var ctx = _getWACtx();
  if (!ctx) return;
  var sr = ctx.sampleRate,
    buf = ctx.createBuffer(1, sr * 3, sr),
    d = buf.getChannelData(0);
  for (var i = 0; i < d.length; i++)
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 0.4);
  var src = ctx.createBufferSource(),
    flt = ctx.createBiquadFilter(),
    g = ctx.createGain();
  flt.type = 'lowpass';
  flt.frequency.value = 180;
  src.buffer = buf;
  src.connect(flt);
  flt.connect(g);
  g.connect(ctx.destination);
  var t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1.2, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.001, t + 3);
  src.start(t);
  src.stop(t + 3);
}
function _synthCoin() {
  var ctx = _getWACtx();
  if (!ctx) return;
  [1047, 1319].forEach(function (freq) {
    var osc = ctx.createOscillator(),
      g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.value = freq;
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  });
}
function _synthDiceRoll() {
  /* Suono sintetico del lancio dadi rimosso su richiesta dell utente */
}
function _playSynth(sfxId) {
  if (sfxId === 'campana') _synthBell();
  else if (sfxId === 'tuoni') _synthThunder();
}
function playOneShot(sfxId, durationMs) {
  var src = resolveSfxUrl(sfxId);
  if (!src) {
    _playSynth(sfxId);
    return;
  }
  var slot = 'oneshot_' + sfxId;
  var entry = _audios[slot];
  if (entry) {
    entry.el.pause();
    delete _audios[slot];
  }
  var el = getAudio(slot, src, false);
  el.volume = 1;
  el.currentTime = 0;
  var p = el.play();
  if (p && p.catch)
    p.catch(function (e) {
      _playSynth(sfxId);
    });
  setTimeout(function () {
    var e2 = _audios[slot];
    if (e2) {
      e2.el.pause();
      e2.el.currentTime = 0;
    }
  }, durationMs);
}

function playBardoRoulette() {
  if (_bardoTimer) {
    clearTimeout(_bardoTimer);
    _bardoTimer = null;
  }
  var tracks =
    state.regiaUrlsBardo && state.regiaUrlsBardo.length > 0 ? state.regiaUrlsBardo : BARDO_TRACKS;
  if (!tracks.length) return;
  var src = tracks[Math.floor(Math.random() * tracks.length)];
  if (!src) return;
  var mainVol = _regiaGrade > 0 ? GRADE_VOLUMES[_regiaGrade] : 0;
  audioFadeTo('main', mainVol * 0.12, 500);
  var slot = 'bardo';
  var prev = _audios[slot];
  if (prev) {
    prev.el.pause();
    delete _audios[slot];
  }
  var el = getAudio(slot, src, false);
  el.volume = 0;
  function go() {
    var dur = el.duration;
    var maxStart = dur && !isNaN(dur) && dur > 12 ? dur - 10 : 0;
    el.currentTime = maxStart > 0 ? Math.min(maxStart, 10 + Math.floor(Math.random() * 50)) : 0;
    var p = el.play();
    if (p && p.catch)
      p.catch(function (e) {
        console.warn('[Regia bardo]', e.message);
      });
    audioFadeTo(slot, 0.88, 350);
    _bardoTimer = setTimeout(function () {
      audioFadeTo(slot, 0, 550, function () {
        el.pause();
      });
      audioFadeTo('main', mainVol, 700);
      _bardoTimer = null;
    }, 8000);
  }
  if (el.readyState >= 2) {
    go();
  } else {
    el.addEventListener('canplay', function h() {
      el.removeEventListener('canplay', h);
      go();
    });
    el.load();
  }
}

/* Modale modifica URL audio scena */
function apriModaleUrlAudio(scenaId, scenaNome) {
  var existing = document.getElementById('regia-url-modal');
  if (existing) existing.remove();

  var scena = SCENE_AUDIO.filter(function (s) {
    return s.id === scenaId;
  })[0];
  if (!scena) return;

  var modal = document.createElement('div');
  modal.className = 'regia-img-modal';
  modal.id = 'regia-url-modal';
  modal.onclick = function (e) {
    if (e.target === modal) modal.remove();
  };

  var box = document.createElement('div');
  box.className = 'regia-img-box';

  var ttl = document.createElement('div');
  ttl.className = 'regia-img-box-title';
  ttl.textContent = '🎵 Audio: ' + scenaNome;
  box.appendChild(ttl);

  /* URL musica principale */
  var mkLabel = function (txt) {
    var l = document.createElement('div');
    l.style.cssText =
      "font-family:'Cinzel',serif;font-size:8.5px;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold-dim);margin-top:0.5rem;";
    l.textContent = txt;
    return l;
  };

  box.appendChild(mkLabel('File Musica Principale (es: audio/taverna.mp3)'));
  var mainInp = document.createElement('input');
  mainInp.type = 'text';
  mainInp.style.cssText =
    "background:var(--bg-card);border:1px solid var(--border-soft);color:var(--text-main);font-family:'EB Garamond',serif;font-size:13px;padding:0.5rem 0.75rem;border-radius:3px;outline:none;width:100%;";
  mainInp.placeholder = 'audio/' + (scena.audioFile || scenaId + '.mp3') + ' (default)';
  mainInp.value = state.regiaUrls[scenaId] || '';
  box.appendChild(mainInp);

  /* SFX URLs */
  var sfxNames = {
    pioggia: 'Pioggia',
    tuoni: 'Tuoni',
    vento: 'Vento',
    folla: 'Folla',
    campana: 'Campana',
  };
  var sfxInputs = {};
  if (scena.sfx.length > 0) {
    box.appendChild(mkLabel('File Effetti Sonori (es: audio/pioggia.mp3)'));
    scena.sfx.forEach(function (sfxId) {
      var sfxRow = document.createElement('div');
      sfxRow.style.cssText = 'display:flex;align-items:center;gap:0.4rem;margin-bottom:0.3rem;';
      var sfxLbl = document.createElement('span');
      sfxLbl.style.cssText =
        "font-family:'Cinzel',serif;font-size:8px;color:var(--text-muted);width:55px;flex-shrink:0;text-transform:uppercase;";
      sfxLbl.textContent = sfxNames[sfxId] || sfxId;
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.style.cssText =
        "flex:1;background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-main);font-family:'EB Garamond',serif;font-size:12px;padding:0.35rem 0.5rem;border-radius:3px;outline:none;";
      inp.placeholder = SFX_MAP[sfxId] || '';
      inp.value = (state.regiaUrlsSfx[scenaId] && state.regiaUrlsSfx[scenaId][sfxId]) || '';
      sfxInputs[sfxId] = inp;
      sfxRow.appendChild(sfxLbl);
      sfxRow.appendChild(inp);
      box.appendChild(sfxRow);
    });
  }

  /* Bardo tracks — solo per taverna */
  var bardoTextarea = null;
  if (scenaId === 'taverna') {
    box.appendChild(mkLabel('File Tracce Bardo (uno per riga, spezzone 8s casuale)'));
    bardoTextarea = document.createElement('textarea');
    bardoTextarea.style.cssText =
      "width:100%;background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-main);font-family:'EB Garamond',serif;font-size:12px;padding:0.5rem;border-radius:3px;outline:none;resize:vertical;min-height:80px;";
    bardoTextarea.placeholder = 'audio/bardo1.mp3\naudio/bardo2.mp3\n(uno per riga)';
    bardoTextarea.value = state.regiaUrlsBardo.join('\n');
    box.appendChild(bardoTextarea);
  }

  /* Bottoni */
  var btnRow = document.createElement('div');
  btnRow.className = 'regia-img-btn-row';
  var btnSave = document.createElement('button');
  btnSave.className = 'btn-regia-save';
  btnSave.textContent = 'Salva';
  btnSave.onclick = function () {
    /* Salva URL principale */
    var mainVal = mainInp.value.trim();
    if (mainVal) state.regiaUrls[scenaId] = mainVal;
    else delete state.regiaUrls[scenaId];
    /* Salva SFX */
    if (!state.regiaUrlsSfx[scenaId]) state.regiaUrlsSfx[scenaId] = {};
    Object.keys(sfxInputs).forEach(function (sfxId) {
      var v = sfxInputs[sfxId].value.trim();
      if (v) state.regiaUrlsSfx[scenaId][sfxId] = v;
      else delete state.regiaUrlsSfx[scenaId][sfxId];
    });
    /* Salva Bardo */
    if (bardoTextarea) {
      var lines = bardoTextarea.value
        .split('\n')
        .map(function (l) {
          return l.trim();
        })
        .filter(Boolean);
      state.regiaUrlsBardo = lines;
    }
    saveToStorage();
    modal.remove();
  };
  var btnCanc = document.createElement('button');
  btnCanc.className = 'btn-regia-cancel';
  btnCanc.textContent = 'Annulla';
  btnCanc.onclick = function () {
    modal.remove();
  };
  btnRow.appendChild(btnSave);
  btnRow.appendChild(btnCanc);
  box.appendChild(btnRow);
  modal.appendChild(box);
  document.body.appendChild(modal);
}

function getSafeSceneImageUrl(value) {
  if (typeof value !== 'string') return '';
  var url = value.trim();
  if (/^data:image\/(?:jpeg|png|gif|webp);base64,[a-z0-9+/]+=*$/i.test(url)) return url;
  try {
    var parsed = new URL(url, document.baseURI);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch (e) {
    return '';
  }
}

/* Modale modifica immagine scena — stile Emporio */
function apriModaleImmagineScena(scenaId, scenaNome) {
  var existing = document.getElementById('regia-img-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.className = 'regia-img-modal';
  modal.id = 'regia-img-modal';
  modal.onclick = function (e) {
    if (e.target === modal) modal.remove();
  };

  var box = document.createElement('div');
  box.className = 'regia-img-box';

  var ttl = document.createElement('div');
  ttl.className = 'regia-img-box-title';
  ttl.textContent = '🖼 Immagine: ' + scenaNome;
  box.appendChild(ttl);

  /* Anteprima */
  var preview = null;
  var currentUrl = getSafeSceneImageUrl(state.regiaImmagini[scenaId]);
  if (currentUrl) {
    preview = document.createElement('img');
    preview.className = 'regia-img-preview';
    preview.src = safeImageUrl(currentUrl);
    box.appendChild(preview);
  }

  /* Input URL */
  var urlLbl = document.createElement('div');
  urlLbl.style.cssText =
    "font-family:'Cinzel',serif;font-size:8.5px;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold-dim);";
  urlLbl.textContent = 'URL immagine';
  box.appendChild(urlLbl);
  var urlInp = document.createElement('input');
  urlInp.type = 'text';
  urlInp.placeholder = 'https://esempio.com/immagine.jpg';
  urlInp.value = currentUrl;
  urlInp.oninput = function () {
    var safeUrl = getSafeSceneImageUrl(this.value);
    if (preview) {
      if (safeUrl) preview.src = safeUrl;
      else preview.removeAttribute('src');
    } else if (safeUrl) {
      preview = document.createElement('img');
      preview.className = 'regia-img-preview';
      preview.src = safeUrl;
      box.insertBefore(preview, urlLbl);
    }
  };
  box.appendChild(urlInp);

  /* Upload file */
  var fileLbl = document.createElement('div');
  fileLbl.style.cssText =
    "font-family:'Cinzel',serif;font-size:8.5px;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold-dim);";
  fileLbl.textContent = 'Oppure carica da file';
  box.appendChild(fileLbl);
  var fileInp = document.createElement('input');
  fileInp.type = 'file';
  fileInp.accept = 'image/*';
  fileInp.onchange = function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var MAX = 600;
        var ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        var compressed = canvas.toDataURL('image/jpeg', 0.72);
        urlInp.value = compressed;
        if (!preview) {
          preview = document.createElement('img');
          preview.className = 'regia-img-preview';
          box.insertBefore(preview, urlLbl);
        }
        preview.src = compressed;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  box.appendChild(fileInp);

  /* Bottoni */
  var btnRow = document.createElement('div');
  btnRow.className = 'regia-img-btn-row';
  var btnSave = document.createElement('button');
  btnSave.className = 'btn-regia-save';
  btnSave.textContent = 'Salva';
  btnSave.onclick = function () {
    var val = getSafeSceneImageUrl(urlInp.value);
    if (val) {
      state.regiaImmagini[scenaId] = val;
    } else {
      delete state.regiaImmagini[scenaId];
    }
    saveToStorage();
    modal.remove();
    /* Aggiorna solo il thumbnail nella griglia senza full re-render */
    var p = document.querySelector('.regia-panel');
    if (p) p.replaceWith(renderRegiaSonora());
  };
  var btnCanc = document.createElement('button');
  btnCanc.className = 'btn-regia-cancel';
  btnCanc.textContent = 'Annulla';
  btnCanc.onclick = function () {
    modal.remove();
  };
  btnRow.appendChild(btnSave);
  btnRow.appendChild(btnCanc);

  /* Bottone rimuovi immagine */
  if (currentUrl) {
    var btnDel = document.createElement('button');
    btnDel.style.cssText =
      "background:rgba(138,46,46,0.2);color:#ff9c9c;border:1px solid rgba(138,46,46,0.5);border-radius:3px;padding:0.3rem 0.6rem;cursor:pointer;font-family:'Cinzel',serif;font-size:8.5px;text-transform:uppercase;letter-spacing:0.07em;width:100%;";
    btnDel.textContent = 'Rimuovi immagine';
    btnDel.onclick = function () {
      delete state.regiaImmagini[scenaId];
      saveToStorage();
      modal.remove();
      var p = document.querySelector('.regia-panel');
      if (p) p.replaceWith(renderRegiaSonora());
    };
    btnRow.appendChild(btnDel);
  }

  box.appendChild(btnRow);
  modal.appendChild(box);
  document.body.appendChild(modal);
}

/* ---- RENDER DEL PANNELLO ---- */
var _regiaView = 'list'; /* 'list' | 'detail' */

/* ============================================================================
   SEZIONE 10C: REGIA SONORA & SCENE MUSICALI AMBIENTALI
   ============================================================================ */
function renderRegiaSonora() {
  var panel = document.createElement('aside');
  panel.className = 'regia-panel';

  /* Header */
  var header = document.createElement('div');
  header.className = 'regia-header';
  header.innerHTML = ICON.music;
  var title = document.createElement('div');
  title.className = 'regia-header-title';
  title.textContent = 'Regia Sonora';
  header.appendChild(title);
  var closeBtn = document.createElement('button');
  closeBtn.className = 'regia-close';
  closeBtn.innerHTML = ICON.x;
  closeBtn.title = 'Chiudi Regia';
  closeBtn.onclick = function () {
    state.regiaActive = false;
    render();
  };
  header.appendChild(closeBtn);
  panel.appendChild(header);

  var body = document.createElement('div');
  body.className = 'regia-body';

  if (_regiaView === 'list') {
    /* ===== VISTA LISTA SCENE ===== */
    var scenLbl = document.createElement('div');
    scenLbl.className = 'regia-section-lbl';
    scenLbl.textContent = 'Ambientazione';
    body.appendChild(scenLbl);

    var SCENE_EMOJI = {
      citta: '🏙️',
      taverna: '🍺',
      forest_inc: '🌲',
      citta_enorme: '🌆',
      rovine: '🏚️',
      caverna: '⛏️',
      tempio: '⛩️',
      strada_oscura: '🌑',
      deserto: '🏜️',
      avventura_mare: '⚓',
      citta_nordica: '❄️',
      spiaggia: '🌊',
      mercato: '🛒',
      dungeon: '💀',
      fuga: '⚡',
      castello: '🏰',
      villaggio: '🌾',
      arena: '⚔️',
      pirati: '🏴‍☠️',
      duello: '🗡️',
      abisso: '🕳️',
      tempesta: '🌪️',
      pianura: '🌿',
    };

    var sceneGrid = document.createElement('div');
    sceneGrid.className = 'regia-scene-grid';

    SCENE_AUDIO.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'regia-scene-card' + (state.regiaScena === s.id ? ' active' : '');

      /* Immagine grande */
      var imgWrap = document.createElement('div');
      imgWrap.className = 'regia-scene-img-wrap';
      var imgUrl = state.regiaImmagini[s.id];
      if (imgUrl) {
        var img = document.createElement('img');
        img.src = imgUrl;
        img.alt = s.nome;
        img.onerror = function () {
          this.parentNode.innerHTML =
            '<span class="regia-scene-ph">' + (SCENE_EMOJI[s.id] || '🎵') + '</span>';
        };
        imgWrap.appendChild(img);
      } else {
        imgWrap.innerHTML =
          '<span class="regia-scene-ph">' + (SCENE_EMOJI[s.id] || '🎵') + '</span>';
      }
      card.appendChild(imgWrap);

      /* Footer con nome */
      var footer = document.createElement('div');
      footer.className = 'regia-scene-footer';
      var nameEl = document.createElement('div');
      nameEl.className = 'regia-scene-name';
      if (state.regiaScena === s.id && _regiaGrade > 0) {
        var dot = document.createElement('span');
        dot.className = 'regia-scene-playing-dot';
        nameEl.appendChild(dot);
      }
      nameEl.appendChild(document.createTextNode(s.nome));
      footer.appendChild(nameEl);
      card.appendChild(footer);

      /* Bottoni azione (appaiono all'hover) */
      var actions = document.createElement('div');
      actions.className = 'regia-card-actions';
      var imgBtn = document.createElement('button');
      imgBtn.className = 'btn-scene-img';
      imgBtn.title = 'Immagine';
      imgBtn.textContent = '🖼';
      imgBtn.onclick = function (e) {
        e.stopPropagation();
        apriModaleImmagineScena(s.id, s.nome);
      };
      var urlBtn = document.createElement('button');
      urlBtn.className = 'btn-scene-url';
      urlBtn.title = 'URL audio';
      urlBtn.textContent = '🎵';
      urlBtn.onclick = function (e) {
        e.stopPropagation();
        apriModaleUrlAudio(s.id, s.nome);
      };
      actions.appendChild(imgBtn);
      actions.appendChild(urlBtn);
      card.appendChild(actions);

      /* Click → apri dettaglio */
      card.onclick = function () {
        if (state.regiaScena !== s.id) {
          stopScena();
          Object.keys(_audioGrades).forEach(function (k) {
            setSfxGrade(k, 0);
          });
          _audioGrades = {};
          _regiaGrade = 0;
          state.regiaScena = s.id;
        }
        _regiaView = 'detail';
        var p = document.querySelector('.regia-panel');
        if (p) p.replaceWith(renderRegiaSonora());
      };
      sceneGrid.appendChild(card);
    });
    body.appendChild(sceneGrid);
  } else {
    /* ===== VISTA DETTAGLIO SCENA ===== */
    var scenaCorrente = SCENE_AUDIO.filter(function (s) {
      return s.id === state.regiaScena;
    })[0];
    if (!scenaCorrente) {
      _regiaView = 'list';
      panel.appendChild(body);
      return panel;
    }

    var SCENE_EMOJI2 = {
      citta: '🏙️',
      taverna: '🍺',
      forest_inc: '🌲',
      citta_enorme: '🌆',
      rovine: '🏚️',
      caverna: '⛏️',
      tempio: '⛩️',
      strada_oscura: '🌑',
      deserto: '🏜️',
      avventura_mare: '⚓',
      citta_nordica: '❄️',
      spiaggia: '🌊',
      mercato: '🛒',
      dungeon: '💀',
      fuga: '⚡',
      castello: '🏰',
      villaggio: '🌾',
      arena: '⚔️',
      pirati: '🏴‍☠️',
      duello: '🗡️',
      abisso: '🕳️',
      tempesta: '🌪️',
      pianura: '🌿',
    };

    var detailView = document.createElement('div');
    detailView.className = 'regia-detail-view';

    /* Sfondo immagine trasparente */
    var imgUrl2 = state.regiaImmagini[scenaCorrente.id];
    if (imgUrl2) {
      var bg = document.createElement('div');
      bg.className = 'regia-detail-bg';
      bg.style.backgroundImage = 'url(' + imgUrl2 + ')';
      detailView.appendChild(bg);
    }

    var dc = document.createElement('div');
    dc.className = 'regia-detail-content';

    /* Freccia indietro */
    var backBtn = document.createElement('button');
    backBtn.className = 'regia-back-btn';
    backBtn.innerHTML = '&#8592; Lista';
    backBtn.onclick = function () {
      _regiaView = 'list';
      var p = document.querySelector('.regia-panel');
      if (p) p.replaceWith(renderRegiaSonora());
    };
    dc.appendChild(backBtn);

    /* Titolo scena */
    var detTitle = document.createElement('div');
    detTitle.className = 'regia-detail-title';
    detTitle.textContent = scenaCorrente.nome;
    dc.appendChild(detTitle);

    /* Pulsante modifica URL audio */
    var urlRow = document.createElement('div');
    urlRow.style.cssText = 'display:flex;gap:0.3rem;justify-content:center;';
    var urlEditBtn = document.createElement('button');
    urlEditBtn.style.cssText =
      "background:rgba(100,160,220,0.1);border:1px solid rgba(100,160,220,0.35);color:#a0c8f0;border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-family:'Cinzel',serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;";
    urlEditBtn.innerHTML = '🔗 URL Audio';
    urlEditBtn.onclick = function () {
      apriModaleUrlAudio(scenaCorrente.id, scenaCorrente.nome);
    };
    urlRow.appendChild(urlEditBtn);
    var imgEditBtn2 = document.createElement('button');
    imgEditBtn2.style.cssText =
      "background:rgba(201,165,92,0.1);border:1px solid var(--border-gold);color:var(--gold);border-radius:3px;padding:0.3rem 0.7rem;cursor:pointer;font-family:'Cinzel',serif;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;";
    imgEditBtn2.innerHTML = '🖼 Immagine';
    imgEditBtn2.onclick = function () {
      apriModaleImmagineScena(scenaCorrente.id, scenaCorrente.nome);
    };
    urlRow.appendChild(imgEditBtn2);
    dc.appendChild(urlRow);

    /* Separatore grado */
    var gradeLbl = document.createElement('div');
    gradeLbl.className = 'regia-section-lbl';
    gradeLbl.textContent = 'Intensità';
    dc.appendChild(gradeLbl);

    /* ---- MODALITÀ EXPLORE / COMBAT ---- */
    var modeRow = document.createElement('div');
    modeRow.className = 'regia-mode-row';

    var btnExplore = document.createElement('button');
    btnExplore.className =
      'btn-mode btn-mode-explore' + (_regiaMode === 'explore' ? ' active' : '');
    btnExplore.innerHTML = '🌿 Explore';
    btnExplore.onclick = function () {
      unlockAudio(function () {
        setMode('explore');
        btnExplore.className = 'btn-mode btn-mode-explore active';
        btnCombat.className = 'btn-mode btn-mode-combat';
        updateStatus();
      });
    };

    var btnCombat = document.createElement('button');
    btnCombat.className = 'btn-mode btn-mode-combat' + (_regiaMode === 'combat' ? ' active' : '');
    btnCombat.innerHTML = '⚔️ Combat';
    btnCombat.onclick = function () {
      unlockAudio(function () {
        setMode('combat');
        btnCombat.className = 'btn-mode btn-mode-combat active';
        btnExplore.className = 'btn-mode btn-mode-explore';
        updateStatus();
      });
    };

    modeRow.appendChild(btnExplore);
    modeRow.appendChild(btnCombat);
    dc.appendChild(modeRow);

    var gradeRow = document.createElement('div');
    gradeRow.className = 'regia-grade-btns';
    var gradeLabels = ['OFF', 'I', 'II', 'III'];

    function updateStatus() {
      var st = document.querySelector('.regia-status');
      if (!st) return;
      if (_regiaGrade > 0) {
        var modeLabel = _regiaMode === 'combat' ? '⚔️ Combat' : '🌿 Explore';
        st.className = 'regia-status playing';
        st.textContent =
          '♫ ' +
          scenaCorrente.nome +
          ' — ' +
          modeLabel +
          ' — Grado ' +
          ['I', 'II', 'III'][_regiaGrade - 1];
      } else {
        st.className = 'regia-status';
        st.textContent = 'Nessuna musica in riproduzione.';
      }
    }

    gradeLabels.forEach(function (lbl, g) {
      var btn = document.createElement('button');
      btn.className =
        'btn-grade ' +
        (_regiaGrade === g ? 'btn-grade-active' : g === 0 ? 'btn-grade-off' : 'btn-grade-on');
      btn.textContent = lbl;
      btn.onclick = function () {
        unlockAudio(function () {
          _regiaGrade = g;
          if (g === 0) {
            stopScena();
          } else {
            playScena(state.regiaScena, g);
          }
          gradeRow.querySelectorAll('.btn-grade').forEach(function (b, idx) {
            b.className =
              'btn-grade ' +
              (_regiaGrade === idx
                ? 'btn-grade-active'
                : idx === 0
                  ? 'btn-grade-off'
                  : 'btn-grade-on');
          });
          updateStatus();
        });
      };
      gradeRow.appendChild(btn);
    });
    dc.appendChild(gradeRow);

    /* ---- SFX CONTINUI ---- */
    if (scenaCorrente.sfx.length > 0) {
      var continuousSfx = scenaCorrente.sfx.filter(function (s) {
        return s !== 'tuoni' && s !== 'campana';
      });
      if (continuousSfx.length > 0) {
        var sfxLbl = document.createElement('div');
        sfxLbl.className = 'regia-section-lbl';
        sfxLbl.textContent = 'Effetti Sonori';
        dc.appendChild(sfxLbl);

        var sfxNames = {
          pioggia: 'Pioggia',
          tuoni: 'Tuoni',
          vento: 'Vento',
          folla: 'Folla',
          campana: 'Campana',
        };
        var sfxGrid = document.createElement('div');
        sfxGrid.className = 'regia-sfx-grid';
        continuousSfx.forEach(function (sfxId) {
          var row = document.createElement('div');
          row.className = 'regia-sfx-row';
          var nameDiv = document.createElement('div');
          nameDiv.className = 'regia-sfx-name';
          nameDiv.textContent = sfxNames[sfxId] || sfxId;
          row.appendChild(nameDiv);
          var btns = document.createElement('div');
          btns.className = 'regia-sfx-btns';
          ['0', '1', '2', '3'].forEach(function (gl, g) {
            var btn = document.createElement('button');
            var cur = _audioGrades[sfxId] || 0;
            btn.className =
              'btn-sfx-grade ' +
              (cur === g ? 'btn-sfx-active' : g === 0 ? 'btn-sfx-off' : 'btn-sfx-on');
            btn.textContent = gl;
            btn.onclick = function () {
              unlockAudio(function () {
                setSfxGrade(sfxId, g);
                var allB = btns.querySelectorAll('.btn-sfx-grade');
                allB.forEach(function (b, idx) {
                  b.className =
                    'btn-sfx-grade ' +
                    ((_audioGrades[sfxId] || 0) === idx
                      ? 'btn-sfx-active'
                      : idx === 0
                        ? 'btn-sfx-off'
                        : 'btn-sfx-on');
                });
              });
            };
            btns.appendChild(btn);
          });
          row.appendChild(btns);
          sfxGrid.appendChild(row);
        });
        dc.appendChild(sfxGrid);
      }

      /* ---- ONE-SHOT ---- */
      var hasOneShot =
        scenaCorrente.sfx.indexOf('tuoni') >= 0 || scenaCorrente.sfx.indexOf('campana') >= 0;
      var isTaverna = scenaCorrente.id === 'taverna';
      if (hasOneShot || isTaverna) {
        var osl = document.createElement('div');
        osl.className = 'regia-section-lbl';
        osl.textContent = 'One-Shot';
        dc.appendChild(osl);
        var osRow = document.createElement('div');
        osRow.className = 'regia-oneshot-row';
        if (scenaCorrente.sfx.indexOf('campana') >= 0) {
          var btnB = document.createElement('button');
          btnB.className = 'btn-oneshot btn-oneshot-bell';
          btnB.innerHTML = '&#128276; Campana';
          btnB.onclick = function () {
            unlockAudio(function () {
              playOneShot('campana', 6000);
            });
          };
          osRow.appendChild(btnB);
        }
        if (scenaCorrente.sfx.indexOf('tuoni') >= 0) {
          var btnT = document.createElement('button');
          btnT.className = 'btn-oneshot btn-oneshot-thunder';
          btnT.innerHTML = '&#9928; Tuono';
          btnT.onclick = function () {
            unlockAudio(function () {
              playOneShot('tuoni', 8000);
            });
          };
          osRow.appendChild(btnT);
        }
        if (isTaverna) {
          var btnBrd = document.createElement('button');
          btnBrd.className = 'btn-oneshot btn-oneshot-bard';
          btnBrd.innerHTML = '&#127928; Bardo (8s)';
          btnBrd.onclick = function () {
            unlockAudio(function () {
              playBardoRoulette();
            });
          };
          osRow.appendChild(btnBrd);
        }
        dc.appendChild(osRow);
      }
    }

    /* Status */
    var status = document.createElement('div');
    var modeLabel0 = _regiaMode === 'combat' ? '⚔️ Combat' : '🌿 Explore';
    status.className = 'regia-status' + (_regiaGrade > 0 ? ' playing' : '');
    status.textContent =
      _regiaGrade > 0
        ? '♫ ' +
          scenaCorrente.nome +
          ' — ' +
          modeLabel0 +
          ' — Grado ' +
          ['I', 'II', 'III'][_regiaGrade - 1]
        : 'Nessuna musica in riproduzione.';
    dc.appendChild(status);

    detailView.appendChild(dc);
    body.appendChild(detailView);
  }

  panel.appendChild(body);
  return panel;
}
