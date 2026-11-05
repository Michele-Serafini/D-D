/* Category routing and menu labels are defined together. */
var ShopCategories = [
  {
    id: 'normale',
    icon: '⚔',
    label: 'Emporio',
    color: 'var(--gold)',
    render: renderEmporioClassic,
  },
  { id: 'veicoli', icon: '🚗', label: 'Veicoli', color: '#f5a623', render: renderEmporioVeicoli },
  { id: 'droghe', icon: '💊', label: 'Droghe', color: '#7fff7f', render: renderEmporioDroghe },
  {
    id: 'cyber',
    icon: '🕷',
    label: 'Laboratorio Cibernetico',
    color: '#1af',
    render: renderEmporioCyber,
  },
  {
    id: 'armifuoco',
    icon: '🔫',
    label: 'Armi da Fuoco',
    color: '#e53030',
    render: renderEmporioArmiFuoco,
  },
];

function renderEmporio() {
  var category = ShopCategories.find(function (item) {
    return item.id === state.emporioTab;
  });
  return (category || ShopCategories[0]).render();
}

function renderShopCategories() {
  var bar = document.createElement('div');
  bar.className = 'shop-category-bar';
  var controls = document.createElement('div');
  controls.className = 'container-main shop-category-controls';
  ShopCategories.forEach(function (category) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'shop-category';
    button.style.setProperty('--shop-accent', category.color);
    button.textContent = category.icon + ' ' + category.label;
    if (category.id === state.emporioTab) button.setAttribute('aria-current', 'page');
    button.onclick = function () {
      state.emporioTab = category.id;
      renderMain();
    };
    controls.appendChild(button);
  });
  bar.appendChild(controls);
  return bar;
}
