function renderRevealedContent() {
  var master = isDM(),
    drafts = {},
    shared = {},
    ready = !master,
    publicReady = false;
  var uploadedImage = '';
  var busy = false,
    disposed = false,
    editing = null,
    previous = null;
  var page = document.createElement('section');
  page.className = 'reveals-page container-main';
  page.innerHTML =
    '<h1 class="header-title">' + (master ? 'Contenuti e segreti' : 'Contenuti rivelati') + '</h1>';
  var intro = document.createElement('p');
  intro.textContent = master
    ? 'Prepara luoghi, NPC, immagini e indizi. I giocatori vedono solo le versioni che riveli; le note del master restano private.'
    : 'Luoghi, incontri e indizi condivisi dal master di questa campagna.';
  page.appendChild(intro);
  var status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  page.appendChild(status);
  var form = document.createElement('form');
  form.className = 'reveal-editor';
  var fields = {},
    editorTitle = document.createElement('h2');
  editorTitle.textContent = 'Nuovo contenuto segreto';
  function field(name, label, tag, max) {
    var holder = document.createElement('label');
    holder.textContent = label;
    var input = document.createElement(tag || 'input');
    if (max) input.maxLength = max;
    if (tag === 'textarea') input.rows = 4;
    holder.appendChild(input);
    form.appendChild(holder);
    fields[name] = input;
    return input;
  }
  function button(label, action, gold) {
    var result = document.createElement('button');
    result.type = 'button';
    result.className = gold ? 'btn-gold' : 'btn-dark';
    result.textContent = label;
    result.disabled = busy || !ready || !publicReady;
    result.onclick = action;
    return result;
  }
  function editor(id) {
    editing = id || 'content_' + crypto.randomUUID();
    previous = id ? drafts[id] : null;
    var value = previous || { type: 'luogo', title: '', text: '', image: '', masterNotes: '' };
    Object.keys(fields).forEach(function (key) {
      fields[key].value = value[key] || '';
    });
    uploadedImage = value.image.startsWith('data:image/') ? value.image : '';
    if (uploadedImage) fields.image.value = '';
    fields.image.placeholder = uploadedImage ? 'Immagine caricata' : 'https://…';
    updateImagePreview();
    editorTitle.textContent = id ? 'Modifica contenuto' : 'Nuovo contenuto segreto';
    form.hidden = false;
    form.querySelector('[type=file]').value = '';
    form.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    fields.title.focus();
  }
  async function act(action, message) {
    if (busy) return;
    busy = true;
    status.textContent = '';
    page
      .querySelectorAll(
        'button, .reveal-editor input, .reveal-editor select, .reveal-editor textarea'
      )
      .forEach(function (input) {
        input.disabled = true;
      });
    try {
      await UserManager.withTimeout(action());
      if (!disposed) status.textContent = message || '';
    } catch (error) {
      if (!disposed)
        status.textContent = /permission|denied/i.test(error.message || '')
          ? 'Salvataggio non riuscito: il contenuto potrebbe essere stato modificato da un altro master. Riaprilo prima di riprovare.'
          : error.message;
    } finally {
      busy = false;
      if (!disposed) {
        page
          .querySelectorAll(
            'button, .reveal-editor input, .reveal-editor select, .reveal-editor textarea'
          )
          .forEach(function (input) {
            input.disabled = false;
          });
        renderList();
      }
    }
  }
  if (master) {
    page.appendChild(
      button(
        'Nuovo contenuto',
        function () {
          editor();
        },
        true
      )
    );
    form.hidden = true;
    form.appendChild(editorTitle);
    var type = field('type', 'Tipo di contenuto', 'select');
    Object.entries(RevealModel.types).forEach(function (entry) {
      var option = document.createElement('option');
      option.value = entry[0];
      option.textContent = entry[1];
      type.appendChild(option);
    });
    field('title', 'Titolo', 'input', 160).required = true;
    field('text', 'Testo per i giocatori', 'textarea', 20000);
    field('image', 'Immagine (indirizzo HTTPS o immagine caricata)', 'input', 600000);
    var imagePreview = document.createElement('img');
    imagePreview.className = 'reveal-image-preview';
    imagePreview.alt = 'Anteprima immagine da condividere';
    imagePreview.referrerPolicy = 'no-referrer';
    imagePreview.hidden = true;
    form.appendChild(imagePreview);
    fields.image.oninput = function () {
      uploadedImage = '';
      updateImagePreview();
    };
    form.appendChild(
      button('Rimuovi immagine', function () {
        uploadedImage = '';
        fields.image.value = '';
        fields.image.placeholder = 'https://…';
        updateImagePreview();
      })
    );
    var uploadLabel = document.createElement('label');
    uploadLabel.textContent = 'Carica immagine';
    var upload = document.createElement('input');
    upload.type = 'file';
    upload.accept = 'image/png,image/jpeg,image/webp,image/gif';
    uploadLabel.appendChild(upload);
    form.appendChild(uploadLabel);
    upload.onchange = function () {
      var file = upload.files[0];
      if (file)
        act(async function () {
          uploadedImage = await RevealService.upload(file);
          fields.image.value = '';
          fields.image.placeholder = 'Immagine caricata';
          updateImagePreview();
        }, 'Immagine pronta. Salva la bozza per conservarla.');
    };
    field('masterNotes', 'Note segrete del master (mai condivise)', 'textarea', 20000);
    var help = document.createElement('p');
    help.textContent =
      'Salvare mantiene il contenuto segreto. Se era già rivelato, la vecchia versione rimane visibile fino ad Aggiorna per i giocatori.';
    form.appendChild(help);
    var save = document.createElement('button');
    save.type = 'submit';
    save.className = 'btn-gold';
    save.textContent = 'Salva bozza';
    form.append(
      save,
      button('Chiudi editor', function () {
        form.hidden = true;
      })
    );
    form.onsubmit = function (event) {
      event.preventDefault();
      var input = Object.fromEntries(
        Object.entries(fields).map(function (entry) {
          return [entry[0], entry[1].value];
        })
      );
      input.image = fields.image.value || uploadedImage;
      act(async function () {
        await RevealService.save(editing, input, previous);
        form.hidden = true;
      }, 'Bozza salvata. Puoi rivelarla quando vuoi.');
    };
    page.appendChild(form);
  }
  function updateImagePreview() {
    if (!imagePreview) return;
    try {
      var source = RevealModel.image(fields.image.value || uploadedImage);
      imagePreview.hidden = !source;
      if (source) imagePreview.src = source;
      else imagePreview.removeAttribute('src');
    } catch (_error) {
      imagePreview.hidden = true;
      imagePreview.removeAttribute('src');
    }
  }
  var filters = document.createElement('div');
  filters.className = 'reveal-filters';
  var search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Cerca un contenuto';
  search.setAttribute('aria-label', 'Cerca contenuti');
  var filter = document.createElement('select');
  filter.setAttribute('aria-label', 'Filtra contenuti');
  [['all', 'Tutti i contenuti']]
    .concat(Object.entries(RevealModel.types))
    .forEach(function (entry) {
      var option = document.createElement('option');
      option.value = entry[0];
      option.textContent = entry[1];
      filter.appendChild(option);
    });
  filters.append(search, filter);
  page.appendChild(filters);
  var list = document.createElement('div');
  list.className = 'reveal-grid';
  page.appendChild(list);
  search.oninput = renderList;
  filter.onchange = renderList;
  function renderList() {
    page.querySelectorAll(':scope > button').forEach(function (item) {
      item.disabled = busy || !ready || !publicReady;
    });
    list.replaceChildren();
    if (!ready || !publicReady) {
      list.textContent = 'Caricamento contenuti…';
      return;
    }
    var entries = Object.entries(master ? drafts : shared)
      .filter(function (entry) {
        var item = entry[1];
        return (
          (filter.value === 'all' || item.type === filter.value) &&
          (item.title + ' ' + item.text)
            .toLocaleLowerCase('it')
            .includes(search.value.toLocaleLowerCase('it'))
        );
      })
      .sort(function (a, b) {
        return (
          (b[1].updatedAt || b[1].revealedAt) - (a[1].updatedAt || a[1].revealedAt) ||
          a[0].localeCompare(b[0])
        );
      });
    if (!entries.length) {
      list.textContent = master
        ? 'Nessun contenuto. Prepara una nuova bozza segreta.'
        : 'Il master non ha ancora rivelato contenuti per questa selezione.';
      return;
    }
    entries.forEach(function (entry) {
      var id = entry[0],
        item = entry[1],
        published = shared[id];
      var card = document.createElement('article');
      card.className = 'reveal-card';
      card.dataset.contentId = id;
      var kind = document.createElement('p');
      kind.className = 'reveal-kind';
      kind.textContent = RevealModel.types[item.type];
      var title = document.createElement('h2');
      title.textContent = item.title;
      card.append(kind, title);
      if (item.image) {
        var image = document.createElement('img');
        image.src = item.image;
        image.alt = item.title;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        card.appendChild(image);
      }
      var text = document.createElement('p');
      text.className = 'reveal-text';
      text.textContent = item.text;
      card.appendChild(text);
      if (master) {
        var visibility = document.createElement('p');
        visibility.className = 'reveal-visibility';
        visibility.textContent = !published
          ? 'Segreto · solo master'
          : published.revision === item.revision
            ? 'Visibile ai giocatori'
            : 'Bozza aggiornata · i giocatori vedono la versione precedente';
        card.appendChild(visibility);
        if (item.masterNotes) {
          var notes = document.createElement('details'),
            summary = document.createElement('summary'),
            noteText = document.createElement('p');
          summary.textContent = 'Note segrete del master';
          noteText.textContent = item.masterNotes;
          noteText.className = 'reveal-text';
          notes.append(summary, noteText);
          card.appendChild(notes);
        }
        var actions = document.createElement('div');
        actions.className = 'reveal-actions';
        actions.appendChild(
          button('Modifica', function () {
            editor(id);
          })
        );
        if (!published || published.revision !== item.revision)
          actions.appendChild(
            button(
              published ? 'Aggiorna per i giocatori' : 'Rivela ai giocatori',
              function () {
                act(function () {
                  return RevealService.reveal(id, item.revision);
                }, 'Contenuto rivelato ai giocatori.');
              },
              true
            )
          );
        if (published)
          actions.appendChild(
            button('Nascondi ai giocatori', function () {
              act(function () {
                return RevealService.hide(id);
              }, 'Contenuto nascosto. La bozza è conservata.');
            })
          );
        actions.appendChild(
          button('Elimina', function () {
            act(async function () {
              await RevealService.remove(id);
              if (editing === id) form.hidden = true;
            }, 'Contenuto eliminato.');
          })
        );
        card.appendChild(actions);
      }
      list.appendChild(card);
    });
  }
  function listen(path, callback) {
    var reference = _campaignDb.ref(path);
    var handler = reference.on(
      'value',
      function (snapshot) {
        if (disposed) return;
        callback(snapshot.val() || {});
        renderList();
      },
      function () {
        if (!disposed)
          status.textContent =
            'Impossibile caricare i contenuti. Controlla la connessione e riprova.';
      }
    );
    onSectionCleanup(function () {
      reference.off('value', handler);
    });
  }
  onSectionCleanup(function () {
    disposed = true;
  });
  listen('revealedContent', function (value) {
    shared = value;
    publicReady = true;
  });
  if (master)
    listen('secretContent', function (value) {
      drafts = value;
      ready = true;
    });
  renderList();
  return page;
}
