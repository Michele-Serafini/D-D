/* Variabili per il drag-and-drop dell'iniziativa */
var _dragSrcId = null;

function makeCaosPlayer(nome) {
  return {
    id: 'cp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    nome: nome || '',
    fail: 0,
    succ: 0,
  };
}

function makeEmptyCombatant() {
  return {
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    nome: '',
    iniziativa: '',
    hp: '',
    tipo: 'pg',
    condizioni: [],
  };
}

function createContentImage() {
  var image = document.createElement('img');
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

function applySheetZoom(element, zoom) {
  var scale = Math.max(0.4, Math.min(2.5, Number(zoom) || 1));
  if ('zoom' in element.style) {
    element.style.zoom = String(scale);
  } else {
    // Older Gecko versions do not implement the CSS zoom property.
    element.style.transformOrigin = 'top left';
    element.style.transform = 'scale(' + scale + ')';
    element.style.width = 100 / scale + '%';
  }
}

function appendRenderedItems(container, items, renderItem) {
  var fragment = document.createDocumentFragment();
  items.forEach(function (item, index) {
    fragment.appendChild(renderItem(item, index));
  });
  container.appendChild(fragment);
}

function rarityClass(r) {
  return 'rarity-' + r.replace(/\s+/g, '');
}
function glyphFor(name) {
  if (!name) return '\u2694';
  var c = name.trim().charAt(0);
  return c ? c.toUpperCase() : '\u2694';
}
function getCategoria(id) {
  for (var i = 0; i < CATEGORIE.length; i++) if (CATEGORIE[i].id === id) return CATEGORIE[i];
  return CATEGORIE[0];
}
function getCondizione(id) {
  for (var i = 0; i < CONDIZIONI.length; i++) if (CONDIZIONI[i].id === id) return CONDIZIONI[i];
  return null;
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function nl2br(s) {
  return s ? s.replace(/\n/g, '<br>') : '';
}
function safeImageUrl(value) {
  if (typeof value !== 'string') return '';
  var candidate = value.trim();
  if (!candidate) return '';
  if (/^data:image\/(?:gif|jpe?g|png|webp);base64,/i.test(candidate)) return encodeURI(candidate);
  try {
    var parsed = new URL(candidate, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? encodeURI(parsed.href)
      : '';
  } catch (e) {
    return '';
  }
}
function safeLinkUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    var parsed = new URL(value, window.location.href);
    return parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'mailto:'
      ? encodeURI(parsed.href)
      : '';
  } catch (e) {
    return '';
  }
}
function sanitizeRichText(html) {
  var parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
  var allowed = {
    a: 1,
    b: 1,
    blockquote: 1,
    br: 1,
    code: 1,
    div: 1,
    em: 1,
    h1: 1,
    h2: 1,
    h3: 1,
    i: 1,
    li: 1,
    ol: 1,
    p: 1,
    pre: 1,
    s: 1,
    span: 1,
    strong: 1,
    u: 1,
    ul: 1,
  };
  function copy(node) {
    if (node.nodeType === 3) return document.createTextNode(node.nodeValue);
    if (node.nodeType !== 1) return null;
    var tag = node.tagName.toLowerCase();
    if (!allowed[tag]) {
      var unwrapped = document.createDocumentFragment();
      Array.prototype.forEach.call(node.childNodes, function (child) {
        var cleanChild = copy(child);
        if (cleanChild) unwrapped.appendChild(cleanChild);
      });
      return unwrapped;
    }
    var clean = document.createElement(tag);
    if (tag === 'a') {
      var href = safeLinkUrl(node.getAttribute('href'));
      if (href) {
        clean.setAttribute('href', href);
        clean.setAttribute('target', '_blank');
        clean.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (tag === 'span') {
      if (node.classList.contains('storia-map-link')) clean.className = 'storia-map-link';
      var markerId = node.getAttribute('data-marker-id');
      if (markerId && /^[A-Za-z0-9_-]+$/.test(markerId)) clean.dataset.markerId = markerId;
      var npcName = node.getAttribute('data-storia-npc');
      if (npcName) clean.dataset.storiaNpc = npcName;
    }
    Array.prototype.forEach.call(node.childNodes, function (child) {
      var cleanChild = copy(child);
      if (cleanChild) clean.appendChild(cleanChild);
    });
    return clean;
  }
  var fragment = document.createDocumentFragment();
  Array.prototype.forEach.call(parsed.body.childNodes, function (child) {
    var cleanChild = copy(child);
    if (cleanChild) fragment.appendChild(cleanChild);
  });
  return fragment;
}
function _textScore() {
  var score = 0;
  for (var i = 0; i < arguments.length; i++) {
    var t = arguments[i] || '';
    score += t.length + (t.match(/\n/g) || []).length * 28;
  }
  return score;
}

var toastTimer = null;
function notify(msg, kind) {
  var ex = document.querySelector('.toast');
  if (ex) ex.remove();
  if (toastTimer) clearTimeout(toastTimer);
  var t = document.createElement('div');
  t.className = 'toast' + (kind === 'err' ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  toastTimer = setTimeout(function () {
    t.remove();
  }, 3000);
}

var ICON = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  save: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.25 15.75H3.75a1.5 1.5 0 0 1-1.5-1.5v-10.5a1.5 1.5 0 0 1 1.5-1.5h7.5l4.5 4.5v7.5a1.5 1.5 0 0 1-1.5 1.5z"/><path d="M12 15.75v-6H6v6M6 2.25v3.75h5.25"/></svg>',
  folder:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15.75 13.5a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5h3.75l1.5 2.25h5.25a1.5 1.5 0 0 1 1.5 1.5z"/></svg>',
  plus: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 3.75v10.5M3.75 9h10.5"/></svg>',
  edit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.333 2L14 4.667 5.333 13.333 2 14l.667-3.333L11.333 2z"/></svg>',
  trash:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5.333 4V2.667A1.333 1.333 0 0 1 6.667 1.333h2.666A1.333 1.333 0 0 1 10.667 2.667V4M12.667 4v9.333A1.333 1.333 0 0 1 11.333 14.667H4.667a1.333 1.333 0 0 1-1.334-1.334V4"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>',
  sparkle:
    '<svg viewBox="0 0 18 18" fill="currentColor"><path d="M9 0 L10.5 6 L17 7.5 L10.5 9 L9 15 L7.5 9 L1 7.5 L7.5 6 Z" opacity="0.9"/></svg>',
  sword:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/></svg>',
  swords:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 17.5 3 3-3 3-3-3"/><path d="M21 21L7.5 7.5 6 6H3v3l1.5 1.5L18 24"/><path d="m9.5 6.5 3-3 3 3-3 3"/><path d="M15 3h6v6"/><path d="m15 9 6-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  arrowRight:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  refresh:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.25 3v4.5h4.5M15.75 15v-4.5h-4.5"/><path d="M3.945 8.25a6 6 0 0 1 10.16-2.475L15.75 7.5M2.25 10.5l1.645 1.725a6 6 0 0 0 10.16-2.475"/></svg>',
  scroll:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/><path d="M5 18a3 3 0 0 1-3-3V9a2 2 0 0 1 4 0"/><path d="M9 8h8M9 12h8M9 16h5"/></svg>',
  download:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12v3a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 15 15v-3"/><path d="M5.25 7.5 9 11.25 12.75 7.5"/><path d="M9 11.25V2.25"/></svg>',
  skullDice:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L21 8 L18 20 H6 L3 8 Z"/><path d="M12 2 L12 22"/><path d="M3 8 L21 8"/><circle cx="9.5" cy="12.5" r="1.2" fill="currentColor"/><circle cx="14.5" cy="12.5" r="1.2" fill="currentColor"/><path d="M10 17 L14 17"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  npc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  sparkles:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/><path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/><path d="M4 4l.5 1.5L6 6l-1.5.5L4 8l-.5-1.5L2 6l1.5-.5z"/></svg>',
  dragHandle:
    '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>',
  music:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
};

function getFilteredArmi() {
  var filtered = state.armi.filter(function (w) {
    if (state.filtroTipo && w.tipo !== state.filtroTipo) return false;
    if (state.filtroValuta && w.valuta !== state.filtroValuta) return false;
    if (state.filtroRarita && w.rarita !== state.filtroRarita) return false;
    if (!state.emporioShowHomebrew && (w.id || '').startsWith('w_')) return false;

    if (state.search) {
      var s = state.search.toLowerCase();
      var n = (w.nome || '').toLowerCase();
      var d = (w.descrizione || '').toLowerCase();
      if (n.indexOf(s) < 0 && d.indexOf(s) < 0) return false;
    }
    return true;
  });

  filtered.sort(function (a, b) {
    var nA = (a.nome || '').toLowerCase();
    var nB = (b.nome || '').toLowerCase();

    if (state.search) {
      var s = state.search.toLowerCase();
      var exactA = nA === s;
      var exactB = nB === s;
      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;

      var startA = nA.indexOf(s) === 0;
      var startB = nB.indexOf(s) === 0;
      if (startA && !startB) return -1;
      if (!startA && startB) return 1;

      var nameMatchA = nA.indexOf(s) >= 0;
      var nameMatchB = nB.indexOf(s) >= 0;
      if (nameMatchA && !nameMatchB) return -1;
      if (!nameMatchA && nameMatchB) return 1;
    }

    if (nA < nB) return -1;
    if (nA > nB) return 1;
    return 0;
  });

  return filtered;
}
