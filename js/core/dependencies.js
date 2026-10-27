/* Leaflet is needed only by maps. Cache one load, and allow retry after failure. */
var _leafletLoading = null;
function ensureLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (_leafletLoading) return _leafletLoading;
  _leafletLoading = new Promise(function (resolve, reject) {
    var stylesheet = document.querySelector('link[data-leaflet]');
    if (!stylesheet) {
      stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'vendor/leaflet/leaflet.css';
      stylesheet.dataset.leaflet = 'true';
      document.head.appendChild(stylesheet);
    }
    var script = document.createElement('script');
    script.src = 'vendor/leaflet/leaflet.js';
    script.onload = function () {
      resolve(window.L);
    };
    script.onerror = function () {
      script.remove();
      _leafletLoading = null;
      reject(new Error('Impossibile caricare il motore delle mappe. Riprova.'));
    };
    document.head.appendChild(script);
  });
  return _leafletLoading;
}
