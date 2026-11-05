(function () {
  var prompt = null;
  var state = {
    ready: false,
    error: '',
    installed: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  };
  var listeners = new Set();
  function changed() {
    listeners.forEach(function (callback) {
      callback();
    });
  }
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    prompt = event;
    changed();
  });
  window.addEventListener('appinstalled', function () {
    state.installed = true;
    prompt = null;
    changed();
  });
  window.PhoneApp = {
    state: state,
    subscribe: function (callback) {
      listeners.add(callback);
      return function () {
        listeners.delete(callback);
      };
    },
    install: async function () {
      if (prompt) {
        var event = prompt;
        prompt = null;
        await event.prompt();
        await event.userChoice;
        changed();
        return;
      }
      return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        ? 'Su iPhone/iPad apri il sito in Safari, tocca Condividi e scegli Aggiungi alla schermata Home.'
        : 'Dal menu del browser scegli Installa app o Aggiungi alla schermata Home, se disponibile.';
    },
  };
  if (
    'serviceWorker' in navigator &&
    (location.protocol === 'https:' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === 'localhost')
  ) {
    var source = document.currentScript.src;
    var base = new URL('../../', source);
    navigator.serviceWorker
      .register(new URL('sw.js', base), { scope: base.pathname, updateViaCache: 'none' })
      .then(function () {
        return navigator.serviceWorker.ready;
      })
      .then(function () {
        state.ready = true;
        changed();
      })
      .catch(function () {
        state.error = 'L’accesso offline non è pronto. Riprova con una connessione attiva.';
        changed();
      });
  } else state.error = 'Questo browser non supporta l’installazione offline.';
})();
