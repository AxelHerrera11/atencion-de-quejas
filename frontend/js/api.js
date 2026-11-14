/**
 * Cliente de la API REST usando fetch.
 * Centraliza la URL base, el token del panel y el manejo de errores.
 */
const API_URL = (window.APP_CONFIG?.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const CLAVE_TOKEN = 'quejas_token';

export class ApiError extends Error {
  constructor(mensaje, status = 0, errores = null) {
    super(mensaje);
    this.status = status;
    this.errores = errores;
  }
}

export const sesion = {
  obtener: () => sessionStorage.getItem(CLAVE_TOKEN),
  guardar: (token) => sessionStorage.setItem(CLAVE_TOKEN, token),
  cerrar: () => sessionStorage.removeItem(CLAVE_TOKEN),
};

async function solicitar(ruta, { metodo = 'GET', cuerpo, autenticado = false, tipo = 'json', timeout = 70000 } = {}) {
  const headers = {};
  let body;
  if (cuerpo instanceof FormData) {
    body = cuerpo; // el navegador agrega el boundary del multipart
  } else if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(cuerpo);
  }
  if (autenticado) {
    const token = sesion.obtener();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeout);
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, { method: metodo, headers, body, signal: controlador.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError('El servidor tardó demasiado en responder. Intenta de nuevo.');
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión a internet.');
  } finally {
    clearTimeout(temporizador);
  }

  if (respuesta.status === 401 && autenticado) {
    sesion.cerrar();
    window.dispatchEvent(new CustomEvent('sesion-expirada'));
  }

  if (!respuesta.ok) {
    let datos = {};
    try { datos = await respuesta.json(); } catch { /* respuesta sin JSON */ }
    throw new ApiError(datos.mensaje || `Error ${respuesta.status} del servidor.`, respuesta.status, datos.errores);
  }
  return tipo === 'blob' ? respuesta.blob() : respuesta.json();
}

export const api = {
  salud: () => solicitar('/api/health', { timeout: 90000 }),
  catalogos: () => solicitar('/api/quejas/catalogos'),
  crearQueja: (formData) => solicitar('/api/quejas', { metodo: 'POST', cuerpo: formData }),
  seguimiento: (codigo) => solicitar(`/api/quejas/seguimiento/${encodeURIComponent(codigo)}`),

  login: (usuario, contrasena) => solicitar('/api/auth/login', { metodo: 'POST', cuerpo: { usuario, contrasena } }),
  listarQuejas: (filtros = {}) => {
    const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
    return solicitar(`/api/quejas?${params}`, { autenticado: true });
  },
  detalleQueja: (id) => solicitar(`/api/quejas/${id}`, { autenticado: true }),
  fotoQueja: (id) => solicitar(`/api/quejas/${id}/foto`, { autenticado: true, tipo: 'blob' }),
  cambiarEstado: (id, estado, nota) =>
    solicitar(`/api/quejas/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado, nota }, autenticado: true }),
};

/**
 * Render (capa gratuita) "duerme" el backend tras inactividad. Mostramos un aviso
 * amable si el primer ping tarda más de 3 segundos.
 */
export function despertarServidor() {
  const banner = document.createElement('div');
  banner.className = 'banner-servidor oculto';
  banner.setAttribute('role', 'status');
  banner.innerHTML = '<span class="spinner spinner--oscuro"></span><span>Conectando con el servidor… puede tardar hasta un minuto la primera vez.</span>';
  document.body.appendChild(banner);
  const aviso = setTimeout(() => banner.classList.remove('oculto'), 3000);
  return api.salud()
    .catch(() => null)
    .finally(() => { clearTimeout(aviso); banner.remove(); });
}
