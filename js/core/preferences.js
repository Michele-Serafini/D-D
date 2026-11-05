/* Shared by the application, animation engine and offline reader. */
var ThemePreferences = (function () {
  var themes = Object.freeze({
    dark: '🌙 Taverna (Scuro)',
    light: '☀️ Pergamena (Chiaro)',
    halloween: '🎃 Halloween',
    christmas: '🎄 Natale',
    valentine: '💘 San Valentino',
    easter: '🐰 Pasqua',
  });
  var storageKeys = ['sium_theme_mode', 'theme'];
  function valid(value) {
    return Object.hasOwn(themes, value);
  }
  function normalize(value) {
    return valid(value) ? value : 'dark';
  }
  function read(fallback) {
    try {
      for (var key of storageKeys) {
        var value = localStorage.getItem(key);
        if (valid(value)) return value;
      }
    } catch (_error) {}
    return normalize(fallback);
  }
  function apply(value) {
    value = normalize(value);
    document.documentElement.setAttribute('data-theme', value);
    if (typeof state !== 'undefined') state.theme = value;
    var picker = document.getElementById('site-theme');
    if (picker) picker.value = value;
    return value;
  }
  function set(value) {
    value = apply(value);
    try {
      storageKeys.forEach(function (key) {
        localStorage.setItem(key, value);
      });
    } catch (_error) {}
    if (typeof saveToStorage === 'function') saveToStorage();
    return value;
  }
  return { themes: themes, valid: valid, normalize: normalize, read: read, apply: apply, set: set };
})();

function setAppTheme(value, fromAnimationEngine) {
  value = ThemePreferences.set(value);
  if (!fromAnimationEngine && window.SiumAnimations) window.SiumAnimations.onThemeChange(value);
  return value;
}

ThemePreferences.apply(ThemePreferences.read());

var EffectPreferences = {
  version: '2026-11-restored-effects',
  read: function () {
    try {
      // Restore the requested effects once, then preserve each device's explicit choice.
      if (localStorage.getItem('sium_fx_version') !== this.version) {
        this.set(true);
        return true;
      }
      return localStorage.getItem('sium_fx_enabled') !== '0';
    } catch (_error) {
      return true;
    }
  },
  set: function (enabled) {
    try {
      localStorage.setItem('sium_fx_enabled', enabled ? '1' : '0');
      localStorage.setItem('sium_fx_version', this.version);
    } catch (_error) {}
  },
};
