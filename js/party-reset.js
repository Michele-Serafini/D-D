/* Piano puro e idempotente: nessun percorso di catalogo viene cancellato. */
(function (root) {
  'use strict';
  var VERSION = '2026-10-26-party-v1';
  function plan(current, defaults) {
    current = current || {};
    if (current.meta && current.meta.partyResetVersion === VERSION) return null;
    var next = Object.assign({}, current);
    var users = {};
    defaults.forEach(function (u) { users[u.username] = Object.assign({}, u); });
    // Mappe e worldbuilding erano salvati anche sotto users: conservarli separatamente.
    var legacy = Object.assign({}, (current.state || {}).legacyUserContent || {});
    Object.keys(current.users || {}).forEach(function (name) {
      var content = Object.assign({}, current.users[name]);
      ['username', 'password', 'role', 'dmPriv', 'crest', 'title', 'disabled'].forEach(function (key) { delete content[key]; });
      if (Object.keys(content).length) legacy[name] = content;
    });
    next.users = users;
    delete next.schedePG;
    delete next.presence;
    next.state = Object.assign({}, current.state || {});
    delete next.state.pet;
    if (Object.keys(legacy).length) next.state.legacyUserContent = legacy;
    next.meta = Object.assign({}, current.meta || {}, { partyResetVersion: VERSION });
    return next;
  }
  var api = { version: VERSION, plan: plan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PartyReset = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
