/* Campaign selection and membership editing share the same account directory. */
Object.assign(CampaignManager, {
  showSelector: function () {
    var app = document.getElementById('app');
    app.hidden = true;
    app.inert = true;
    document.getElementById('campaign-selector')?.remove();
    var overlay = document.createElement('div');
    overlay.id = 'campaign-selector';
    overlay.className = 'campaign-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'campaign-heading');
    var box = document.createElement('section');
    box.className = 'campaign-panel';
    var heading = document.createElement('h1');
    heading.id = 'campaign-heading';
    heading.textContent = 'Scegli la campagna';
    heading.tabIndex = -1;
    box.appendChild(heading);
    var intro = document.createElement('p');
    intro.textContent =
      'Ogni campagna conserva il proprio gruppo, le schede, le mappe, le note e i contenuti.';
    box.appendChild(intro);
    var status = document.createElement('p');
    status.setAttribute('role', 'status');
    box.appendChild(status);
    function action(button, task) {
      button.addEventListener('click', async function () {
        button.disabled = true;
        status.textContent = '';
        try {
          await task();
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });
    }
    if (!this.campaigns.length) {
      var empty = document.createElement('p');
      empty.textContent =
        'Non sei ancora in una campagna. Chiedi al master di aggiungerti al gruppo.';
      box.appendChild(empty);
    }
    this.campaigns.forEach(function (campaign) {
      var card = document.createElement('article');
      card.className = 'campaign-card';
      card.dataset.campaignId = campaign.id;
      var title = document.createElement('h2');
      title.textContent = campaign.meta.name;
      card.appendChild(title);
      var description = document.createElement('p');
      description.textContent = campaign.meta.description || 'Una nuova avventura.';
      card.appendChild(description);
      var group = document.createElement('p');
      group.textContent = 'Gruppo: ' + Object.keys(campaign.members).join(', ');
      card.appendChild(group);
      var enter = document.createElement('button');
      enter.type = 'button';
      enter.textContent =
        CampaignManager.current?.id === campaign.id ? 'Torna alla campagna' : 'Entra';
      action(enter, function () {
        return CampaignManager.enter(campaign.id);
      });
      card.appendChild(enter);
      if (CampaignManager.canManage(campaign)) {
        var details = document.createElement('details');
        var summary = document.createElement('summary');
        summary.textContent = 'Gestisci giocatori';
        details.appendChild(summary);
        var selections = {};
        var profiles = UserManager.getAllUsers();
        if (
          campaign.members[ACCOUNT_POLICY.adminUsername] &&
          !profiles.some(function (profile) {
            return profile.username === ACCOUNT_POLICY.adminUsername;
          })
        )
          profiles.push(
            UserManager.getProfile(ACCOUNT_POLICY.adminUsername, {
              role: ACCOUNT_POLICY.roles.admin.name,
            })
          );
        profiles.forEach(function (profile) {
          var label = document.createElement('label');
          label.textContent = profile.username;
          var select = document.createElement('select');
          select.setAttribute('aria-label', 'Ruolo di ' + profile.username);
          [
            ['', 'Non partecipa'],
            ['player', 'Giocatore'],
            ['dm', 'Master'],
          ].forEach(function (entry) {
            var option = document.createElement('option');
            option.value = entry[0];
            option.textContent = entry[1];
            select.appendChild(option);
          });
          select.value = campaign.members[profile.username] || '';
          select.disabled = profile.username === campaign.meta.owner;
          selections[profile.username] = select;
          label.appendChild(select);
          details.appendChild(label);
        });
        var save = document.createElement('button');
        save.type = 'button';
        save.textContent = 'Salva gruppo';
        action(save, async function () {
          var members = {};
          Object.entries(selections).forEach(function (entry) {
            if (entry[1].value) members[entry[0]] = entry[1].value;
          });
          await CampaignManager.setMembers(campaign.id, members);
          CampaignManager.showSelector();
        });
        details.appendChild(save);
        card.appendChild(details);
      }
      box.appendChild(card);
    });
    if (this.canCreate()) {
      var form = document.createElement('form');
      form.className = 'campaign-card';
      var title = document.createElement('h2');
      title.textContent = 'Crea una campagna';
      form.appendChild(title);
      function field(labelText, tag) {
        var label = document.createElement('label');
        label.textContent = labelText;
        var input = document.createElement(tag);
        label.appendChild(input);
        form.appendChild(label);
        return input;
      }
      var name = field('Nome della campagna', 'input');
      name.required = true;
      name.maxLength = 80;
      var description = field('Descrizione', 'textarea');
      description.maxLength = 500;
      var players = [];
      UserManager.getAllUsers()
        .filter(function (profile) {
          return profile.username !== UserManager.getUsername();
        })
        .forEach(function (profile) {
          var label = document.createElement('label');
          label.className = 'campaign-player';
          var input = document.createElement('input');
          input.type = 'checkbox';
          input.value = profile.username;
          label.appendChild(input);
          label.appendChild(document.createTextNode(profile.username));
          form.appendChild(label);
          players.push(input);
        });
      var create = document.createElement('button');
      create.type = 'submit';
      create.textContent = 'Crea campagna';
      form.appendChild(create);
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        create.disabled = true;
        try {
          await CampaignManager.create({
            name: name.value,
            description: description.value,
            players: players
              .filter(function (input) {
                return input.checked;
              })
              .map(function (input) {
                return input.value;
              }),
          });
          CampaignManager.showSelector();
        } catch (error) {
          status.textContent = error.message;
        } finally {
          create.disabled = false;
        }
      });
      box.appendChild(form);
    }
    var refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = 'Aggiorna campagne';
    action(refresh, async function () {
      await CampaignManager.load();
      CampaignManager.showSelector();
    });
    box.appendChild(refresh);
    var logout = document.createElement('button');
    logout.type = 'button';
    logout.textContent = 'Esci dall’account';
    action(logout, function () {
      return UserManager.signOut();
    });
    box.appendChild(logout);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    heading.focus();
    // Keep keyboard focus within the selector until a campaign is selected.
    overlay.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      var nodes = Array.from(
        overlay.querySelectorAll(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,summary'
        )
      ).filter(function (node) {
        return node.getClientRects().length;
      });
      var first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === heading)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
  },
});
