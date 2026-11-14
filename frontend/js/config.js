/*
 * URL del backend (API).
 * - En local se usa http://localhost:3000 automáticamente.
 * - En producción reemplaza URL_PRODUCCION por la URL de tu servicio en Render
 *   (o define la variable API_URL en Render y el build sobrescribe este archivo).
 */
(function () {
  var URL_PRODUCCION = 'https://atencion-quejas-api.onrender.com';
  var esLocal = ['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1;
  window.APP_CONFIG = { API_URL: esLocal ? 'http://localhost:3000' : URL_PRODUCCION };
})();
