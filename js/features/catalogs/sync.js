/* Catalog merges and historical migrations; indexes are built once per source array. */
var CatalogSync = {
  indexes: new WeakMap(),
  index: function (items, trim) {
    var modes = this.indexes.get(items);
    if (!modes) {
      modes = {};
      this.indexes.set(items, modes);
    }
    var key = trim ? 'trimmed' : 'lower';
    if (!modes[key]) {
      var byId = Object.create(null),
        byName = Object.create(null);
      items.forEach(function (item) {
        if (item.id) byId[item.id] = item;
        if (item.nome) byName[(trim ? item.nome.trim() : item.nome).toLowerCase()] = item;
      });
      modes[key] = { byId: byId, byName: byName };
    }
    return modes[key];
  },
  deletedSpells: [],
  visibleSpells: function (items) {
    var deleted = this.deletedSpells;
    return (Array.isArray(items) ? items : []).filter(function (item) {
      return !deleted.includes(item.id);
    });
  },
  spellAliases: {
    mending: 'riparare',
    repair: 'riparare',
    'mage hand': 'mano magica',
    prestidigitation: 'prestidigitazione',
    'minor illusion': 'illusione minore',
  },
  connect: function () {
    // ---- DELETED LISTS (admin) ----
    // NOTA: il listener bestiario è annidato qui dentro per garantire che bestiarioDeleted
    // sia caricato PRIMA della merge SRD (evita race condition che riaggiungeva mostri eliminati)
    _campaignDb.ref('state/bestiarioDeleted').once('value', function (snap) {
      var v = snap.val();
      if (v && Array.isArray(v)) state.bestiarioDeleted = v;

      // ---- BESTIARIO CUSTOM ----
      _campaignDb.ref('state/bestiario').on('value', function (snap) {
        if (_localWrite.bestiario) return;
        var v = snap.val();
        var existing = v && Array.isArray(v) ? v : [];
        // Deduplica existing per nome (tiene il primo, rimuove i doppi da Firebase)
        var seenDup = {};
        existing = existing.filter(function (x) {
          var k = (x.nome || '').toLowerCase();
          if (seenDup[k]) return false;
          seenDup[k] = 1;
          return true;
        });
        var nomi = {};
        existing.forEach(function (x) {
          nomi[(x.nome || '').toLowerCase()] = 1;
        });
        // Aggiorna immagini SRD esistenti che hanno immagine vuota
        var srdBById = CatalogSync.index(SRD_BESTIARIO).byId;
        var bImgChanged = false;
        existing = existing.map(function (x) {
          var srd = x.id && srdBById[x.id] ? srdBById[x.id] : null;
          if (!srd) return x;
          // Se SRD ha versione _v più alta, sostituisce i dati Firebase (aggiornamento mostri)
          if (srd._v && (!x._v || srd._v > x._v)) {
            bImgChanged = true;
            return Object.assign({}, srd, { id: x.id });
          }
          // Aggiorna immagine vuota
          if (!x.immagine && srd.immagine) {
            bImgChanged = true;
            return Object.assign({}, x, { immagine: srd.immagine });
          }
          return x;
        });
        var _deleted = state.bestiarioDeleted || [];
        // Migrazione: rimuovi entry duplicate SRD aggiunte con nomi diversi dagli originali
        var _dupIds = [
          'srd_b_258',
          'srd_b_267',
          'srd_b_323',
          'srd_b_324',
          'srd_b_325',
          'srd_b_326',
          'srd_b_333',
          'srd_b_346',
          'srd_b_348',
          'srd_b_356',
          'srd_b_358',
          'srd_b_360',
          'srd_b_361',
          'srd_b_362',
        ];
        var _lenBefore = existing.length;
        existing = existing.filter(function (x) {
          return _dupIds.indexOf(x.id) < 0;
        });
        var migChanged = existing.length < _lenBefore;
        if (migChanged) {
          nomi = {};
          existing.forEach(function (x) {
            nomi[(x.nome || '').toLowerCase()] = 1;
          });
          var _newDel = _dupIds.filter(function (id) {
            return _deleted.indexOf(id) < 0;
          });
          if (_newDel.length) {
            _deleted = _deleted.concat(_newDel);
            state.bestiarioDeleted = _deleted;
            if (isDM()) _campaignDb.ref('state/bestiarioDeleted').set(_deleted);
          }
        }
        // Costruisce set di nomi eliminati (da voci "nome:xxx" in bestiarioDeleted)
        var _deletedNomi = {};
        _deleted.forEach(function (x) {
          if (x && x.indexOf('nome:') === 0) _deletedNomi[x.slice(5)] = 1;
        });
        var toAdd = (typeof SRD_BESTIARIO !== 'undefined' ? SRD_BESTIARIO : []).filter(
          function (x) {
            var nl = (x.nome || '').toLowerCase();
            return !nomi[nl] && _deleted.indexOf(x.id) < 0 && !_deletedNomi[nl];
          }
        );
        if (toAdd.length || bImgChanged || migChanged) {
          var merged = existing.concat(toAdd).sort(function (a, b) {
            return (a.nome || '').localeCompare(b.nome || '', 'it');
          });
          if (isDM()) {
            _localWrite.bestiario = true;
            _campaignDb.ref('state/bestiario').set(merged, function () {
              _localWrite.bestiario = false;
            });
          }
          state.bestiario = merged;
        } else {
          state.bestiario = existing;
        }
        if (state.section === 'bestiario') scheduleRenderMain();
      });
    }); // fine bestiarioDeleted.once

    _campaignDb.ref('state/armiDeleted').once('value', function (snap) {
      var v = snap.val();
      if (v && Array.isArray(v)) state.armiDeleted = v;
    });

    // ---- ARMI ----
    _campaignDb.ref('state/armi').on('value', function (snap) {
      if (_localWrite.armi) return;
      var v = snap.val();
      var existing =
        v && Array.isArray(v) ? v : typeof SRD_OGGETTI !== 'undefined' ? SRD_OGGETTI.slice() : [];

      // Aggiorna immagini SRD esistenti che hanno immagine vuota
      var index = CatalogSync.index(SRD_OGGETTI, true),
        srdById = index.byId,
        srdByName = index.byName;
      var imgChanged = false;
      existing = existing.map(function (x) {
        if (x._customized) return x;
        var srd = (x.id && srdById[x.id]) || (x.nome && srdByName[x.nome.trim().toLowerCase()]);
        if (srd && srd.immagine) {
          if (!x.immagine || (srd.immagine.indexOf('img/') === 0 && x.immagine !== srd.immagine)) {
            imgChanged = true;
            return Object.assign({}, x, { immagine: srd.immagine });
          }
        }
        return x;
      });

      var seen = {};
      var deduped = [];
      var dedupChanged = false;
      existing.forEach(function (w) {
        var key = (w.nome || '').trim().toLowerCase();
        if (!key) return;
        if (!seen[key]) {
          seen[key] = w;
          deduped.push(w);
        } else {
          dedupChanged = true;
          // Dai priorità all'elemento con metadati/percorsi immagine corretti
          if (!seen[key].immagine && w.immagine) {
            deduped[deduped.indexOf(seen[key])] = w;
            seen[key] = w;
          }
        }
      });
      if (dedupChanged) {
        existing = deduped;
        imgChanged = true;
      }

      if (imgChanged && isDM()) {
        _localWrite.armi = true;
        _campaignDb.ref('state/armi').set(existing, function () {
          _localWrite.armi = false;
        });
      }
      state.armi = existing;
      if (state.section === 'emporio') updateResults();
    });

    _campaignDb.ref('state/incantesimiDeleted').on('value', function (deletedSnapshot) {
      CatalogSync.deletedSpells = deletedSnapshot.val() || [];
      if (CatalogSync.watchingSpells) {
        state.incantesimiAggiuntivi = CatalogSync.visibleSpells(state.incantesimiAggiuntivi);
        if (state.section === 'incantesimi') scheduleRenderMain();
        return;
      }
      CatalogSync.watchingSpells = true;
      _campaignDb.ref('state/incantesimiAggiuntivi').on('value', function (snap) {
        if (_localWrite.incantesimiAggiuntivi) return;
        var v = snap.val();
        var existing = CatalogSync.visibleSpells(v);
        // Dedup existing per nome; rimuovi 'Mending' se 'Riparare' esiste in SRD
        var srdSpNames = CatalogSync.index(SRD_INCANTESIMI).byName;
        var seenSpDup = {};
        existing = existing.filter(function (x) {
          var k = (x.nome || '').toLowerCase();
          // Rimuovi 'mending' e altri alias inglesi già presenti in SRD italiano
          var ALIAS = CatalogSync.spellAliases;
          if (ALIAS[k] && srdSpNames[ALIAS[k]]) return false;
          if (seenSpDup[k]) return false;
          seenSpDup[k] = 1;
          return true;
        });
        var srdArr = typeof SRD_INCANTESIMI !== 'undefined' ? SRD_INCANTESIMI : [];
        var srdByName = CatalogSync.index(srdArr).byName;
        var nomi = {};
        existing.forEach(function (x) {
          nomi[(x.nome || '').toLowerCase()] = 1;
        });
        var toAdd = srdArr.filter(function (x) {
          return !nomi[(x.nome || '').toLowerCase()] && !CatalogSync.deletedSpells.includes(x.id);
        });
        // Aggiorna descrizione/altiLivelli degli incantesimi SRD già presenti in Firebase
        var needsUpdate = false;
        existing = existing.map(function (x) {
          if (x._customized) return x;
          var srd = srdByName[(x.nome || '').toLowerCase()];
          if (!srd || !srd.id || (srd.id + '').indexOf('srd_sp_') !== 0) return x;
          var changed = false;
          var upd = {};
          if (srd.descrizione && x.descrizione !== srd.descrizione) {
            upd.descrizione = srd.descrizione;
            changed = true;
          }
          if (srd.altiLivelli !== undefined && x.altiLivelli !== srd.altiLivelli) {
            upd.altiLivelli = srd.altiLivelli;
            changed = true;
          }
          if (srd.componenti && JSON.stringify(x.componenti) !== JSON.stringify(srd.componenti)) {
            upd.componenti = srd.componenti;
            changed = true;
          }
          if (srd.valMateria !== undefined && x.valMateria !== srd.valMateria) {
            upd.valMateria = srd.valMateria;
            changed = true;
          }
          if (srd.consumaMateria !== undefined && x.consumaMateria !== srd.consumaMateria) {
            upd.consumaMateria = srd.consumaMateria;
            changed = true;
          }
          if (
            srd.classi &&
            srd.classi.length &&
            JSON.stringify(x.classi) !== JSON.stringify(srd.classi)
          ) {
            upd.classi = srd.classi;
            changed = true;
          }
          if (srd.rituale !== undefined && x.rituale !== srd.rituale) {
            upd.rituale = srd.rituale;
            changed = true;
          }
          if (srd.concentrazione !== undefined && x.concentrazione !== srd.concentrazione) {
            upd.concentrazione = srd.concentrazione;
            changed = true;
          }
          if (changed) {
            needsUpdate = true;
            return Object.assign({}, x, upd);
          }
          return x;
        });
        if (toAdd.length || needsUpdate) {
          var merged = existing.concat(toAdd).sort(function (a, b) {
            return (a.nome || '').localeCompare(b.nome || '', 'it');
          });
          if (isDM()) {
            _localWrite.incantesimiAggiuntivi = true;
            _campaignDb.ref('state/incantesimiAggiuntivi').set(merged, function () {
              _localWrite.incantesimiAggiuntivi = false;
            });
          }
          state.incantesimiAggiuntivi = merged;
        } else {
          state.incantesimiAggiuntivi = existing;
        }
        if (state.section === 'incantesimi') scheduleRenderMain();
      });
    });
  },
};
