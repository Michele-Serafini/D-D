var RevealService = {
  master: function () {
    if (!isDM()) throw new Error('Operazione riservata al master.');
  },
  save: async function (id, input, previous) {
    this.master();
    var draft = RevealModel.draft(input, previous, state.currentUser.username, Date.now());
    id = id || 'content_' + crypto.randomUUID();
    await _campaignDb.ref('secretContent/' + id).set(draft);
    return id;
  },
  reveal: async function (id, revision) {
    this.master();
    var draft = (await _campaignDb.ref('secretContent/' + id).once('value')).val();
    if (!draft || draft.revision !== revision)
      throw new Error(
        'Il contenuto è cambiato. Controlla la versione aggiornata prima di rivelarlo.'
      );
    await _campaignDb
      .ref('revealedContent/' + id)
      .set(RevealModel.publicCopy(draft, state.currentUser.username, Date.now()));
  },
  hide: function (id) {
    this.master();
    return _campaignDb.ref('revealedContent/' + id).remove();
  },
  remove: function (id) {
    this.master();
    var changes = {};
    changes['secretContent/' + id] = changes['revealedContent/' + id] = null;
    return _campaignDb.ref('').update(changes);
  },
  upload: function (file) {
    if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 10 * 1024 * 1024)
      return Promise.reject(new Error('Scegli un’immagine PNG, JPEG, WebP o GIF fino a 10 MB.'));
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file),
        image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(url);
        var ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        var context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        var data = canvas.toDataURL('image/jpeg', 0.72);
        if (data.length > 600000)
          reject(new Error('Immagine troppo dettagliata. Riduci le dimensioni e riprova.'));
        else resolve(data);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Immagine non leggibile.'));
      };
      image.src = url;
    });
  },
};
