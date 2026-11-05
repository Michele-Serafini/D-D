/* ============================================================================
   SEZIONE 3: NAVIGAZIONE LATERALE & MENU SEZIONI (renderSidebar)
   ============================================================================ */
function renderSidebar() {
  var sb = document.createElement('aside');
  sb.className = 'sidebar' + (state.sidebarOpen ? ' open' : '');
  sb.innerHTML =
    '<div class="sidebar-brand"><div class="brand-rune">\u269C</div><div class="brand-name">Mercante<br>Errante</div></div>';

  var campaignButton = document.createElement('button');
  campaignButton.type = 'button';
  campaignButton.className = 'nav-item';
  campaignButton.textContent = 'Cambia campagna · ' + CampaignManager.current.meta.name;
  campaignButton.onclick = function () {
    CampaignManager.showSelector();
    CampaignManager.load()
      .then(function () {
        CampaignManager.showSelector();
      })
      .catch(function (error) {
        var status = document.querySelector('#campaign-selector [role=status]');
        if (status) status.textContent = error.message;
      });
  };
  sb.appendChild(campaignButton);

  function addItem(item) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item' + (AppNavigation.active(item) ? ' active' : '');
    button.dataset.section = item.id;
    button.innerHTML = AppNavigation.icon(item) + '<span>' + AppNavigation.label(item) + '</span>';
    if (AppNavigation.active(item)) button.setAttribute('aria-current', 'page');
    button.onclick = function () {
      AppNavigation.open(item.id);
    };
    sb.appendChild(button);
  }
  var visible = AppNavigation.items.filter(AppNavigation.visible);
  visible
    .filter(function (item) {
      return item.group !== 'tools';
    })
    .forEach(addItem);
  var separator = document.createElement('div');
  separator.className = 'sidebar-separator';
  sb.appendChild(separator);
  visible
    .filter(function (item) {
      return item.group === 'tools';
    })
    .forEach(addItem);
  var tools = document.createElement('div');
  tools.className = 'sidebar-tools';

  var themeLabel = document.createElement('label');
  themeLabel.className = 'sidebar-theme';
  themeLabel.textContent = 'Tema del sito';
  var themeSelect = document.createElement('select');
  themeSelect.id = 'site-theme';
  themeSelect.setAttribute('aria-label', 'Tema del sito');
  Object.entries(ThemePreferences.themes).forEach(function (entry) {
    var option = document.createElement('option');
    option.value = entry[0];
    option.textContent = entry[1];
    themeSelect.appendChild(option);
  });
  themeSelect.value = state.theme || 'dark';
  themeSelect.onchange = function () {
    if (window.SiumAnimations) window.SiumAnimations.setTheme(themeSelect.value);
    else setAppTheme(themeSelect.value);
  };
  themeLabel.appendChild(themeSelect);
  tools.appendChild(themeLabel);

  var account = document.createElement('button');
  account.type = 'button';
  account.id = 'account-settings-button';
  account.className = 'btn-dark sidebar-account';
  account.textContent = 'Account e impostazioni · ' + state.currentUser.username;
  account.onclick = function () {
    UserManager.renderSettingsPanel();
  };
  tools.appendChild(account);
  var dice = document.createElement('div');
  dice.dataset.quickDice = '';
  tools.appendChild(dice);
  sb.insertBefore(tools, campaignButton);
  return sb;
}
