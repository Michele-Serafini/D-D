/* One definition per simple realtime collection: state field, path and destination. */
var AppCollections = {
  definitions: {
    impiantiCibernetici: { path: 'state/impianti', tab: 'cyber' },
    droghe: { tab: 'droghe' },
    veicoli: { tab: 'veicoli' },
    veicoliParty: { tab: 'veicoli' },
    armiDaFuoco: { path: 'state/armiFuoco', tab: 'armifuoco' },
    potenziamenti: { path: 'state/armiFuocoPotenziamenti', tab: 'armifuoco' },
    munizioniArmi: { path: 'state/armiFuocoMunizioni', tab: 'armifuoco' },
    pet: { section: 'bestiario' },
  },
  path: function (field) {
    return this.definitions[field].path || 'state/' + field;
  },
  connect: function () {
    var self = this;
    Object.entries(this.definitions).forEach(function (entry) {
      var field = entry[0],
        definition = entry[1];
      _campaignDb.ref(self.path(field)).on('value', function (snapshot) {
        var value = snapshot.val();
        state[field] = Array.isArray(value) ? value : [];
        if (
          state.section === (definition.section || 'emporio') &&
          (!definition.tab || state.emporioTab === definition.tab)
        )
          scheduleRenderMain();
      });
    });
  },
  save: function (field) {
    if (!_campaignDb) return;
    var items = state[field] || [];
    return _campaignDb.ref(this.path(field)).set(items.length ? items : null);
  },
};

// Keep the existing public handlers used by forms and imported sheet templates.
function fbSaveImpianti() {
  return AppCollections.save('impiantiCibernetici');
}
function fbSaveDroghe() {
  return AppCollections.save('droghe');
}
function fbSaveVeicoli() {
  return AppCollections.save('veicoli');
}
function fbSaveVeicoliParty() {
  return AppCollections.save('veicoliParty');
}
function fbSaveArmiFuoco() {
  return AppCollections.save('armiDaFuoco');
}
function fbSavePotenziamentiArmi() {
  return AppCollections.save('potenziamenti');
}
function fbSaveMunizioniArmi() {
  return AppCollections.save('munizioniArmi');
}
function fbSavePet() {
  return AppCollections.save('pet');
}
