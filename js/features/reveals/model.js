/* Only this projection is shared. Master notes never enter the players' branch. */
var RevealModel = {
  types: { luogo: 'Luogo', npc: 'NPC', immagine: 'Immagine', indizio: 'Indizio' },
  image: function (value) {
    value = String(value || '').trim();
    if (!value) return '';
    if (
      /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value) &&
      value.length <= 600000
    )
      return value;
    try {
      var url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password && value.length <= 2000)
        return url.href;
    } catch (_error) {
      /* Invalid URLs stay out of image elements. */
    }
    throw new Error('Usa un indirizzo HTTPS oppure carica un’immagine PNG, JPEG o WebP.');
  },
  draft: function (input, previous, actor, at) {
    var title = String(input.title || '').trim();
    if (
      !Object.prototype.hasOwnProperty.call(this.types, input.type) ||
      !title ||
      title.length > 160
    )
      throw new Error('Scegli un tipo e un titolo da 1 a 160 caratteri.');
    var text = String(input.text || ''),
      notes = String(input.masterNotes || '');
    if (text.length > 20000 || notes.length > 20000)
      throw new Error('Testi troppo lunghi: massimo 20.000 caratteri per campo.');
    var image = this.image(input.image);
    if (input.type === 'immagine' && !image) throw new Error('Aggiungi un’immagine al contenuto.');
    return {
      type: input.type,
      title: title,
      text: text,
      image: image,
      masterNotes: notes,
      createdBy: previous ? previous.createdBy : actor,
      createdAt: previous ? previous.createdAt : at,
      updatedBy: actor,
      updatedAt: at,
      revision: (previous ? previous.revision : 0) + 1,
    };
  },
  publicCopy: function (draft, actor, at) {
    return {
      type: draft.type,
      title: draft.title,
      text: draft.text,
      image: draft.image,
      revision: draft.revision,
      revealedBy: actor,
      revealedAt: at,
    };
  },
};
