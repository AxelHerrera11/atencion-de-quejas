import { api, ApiError, despertarServidor } from './api.js';
import {
  ESTILO_CATEGORIA, COLOR_ESTADO, escapar, formatearFecha, chipEstado,
  comprimirImagen, formatearBytes,
} from './utilidades.js';

const $ = (sel) => document.querySelector(sel);

const form = $('#form-queja');
const avisoForm = $('#aviso-form');
const btnEnviar = $('#btn-enviar');
const inputFoto = $('#foto');
const zonaFoto = $('#zona-foto');
const vistaPrevia = $('#vista-previa');
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FOTO = 8 * 1024 * 1024;

let fotoSeleccionada = null;
let urlPrevia = null;

/* ───────────── Pestañas ───────────── */
function mostrarPestana(nombre) {
  for (const id of ['registrar', 'seguimiento']) {
    const activa = id === nombre;
    $(`#tab-${id}`).setAttribute('aria-selected', String(activa));
    $(`#vista-${id}`).classList.toggle('oculto', !activa);
  }
}
$('#tab-registrar').addEventListener('click', () => mostrarPestana('registrar'));
$('#tab-seguimiento').addEventListener('click', () => mostrarPestana('seguimiento'));

/* ───────────── Catálogos desde la API ───────────── */
async function cargarCatalogos() {
  try {
    const { categorias, zonas } = await api.catalogos();
    $('#categorias').innerHTML = Object.entries(categorias)
      .map(([clave, nombre]) => {
        const estilo = ESTILO_CATEGORIA[clave] ?? ESTILO_CATEGORIA.otro;
        return `
          <label class="categoria">
            <input type="radio" name="categoria" value="${escapar(clave)}">
            <span style="--c: ${estilo.color}"><b aria-hidden="true">${estilo.icono}</b>${escapar(nombre)}</span>
          </label>`;
      })
      .join('');
    $('#zona').insertAdjacentHTML(
      'beforeend',
      zonas.map((z) => `<option value="${escapar(z)}">${escapar(z)}</option>`).join('')
    );
  } catch (err) {
    $('#categorias').innerHTML = `
      <div class="aviso aviso--error" style="grid-column: 1/-1;">
        ⚠️ ${escapar(err.message)}
        <button type="button" class="btn btn--suave" id="reintentar-catalogos" style="margin-left:auto; padding: 6px 14px;">Reintentar</button>
      </div>`;
    $('#reintentar-catalogos').addEventListener('click', cargarCatalogos);
  }
}

/* ───────────── Validación en el cliente ───────────── */
function marcarError(campo, mensaje) {
  const contenedor = form.querySelector(`[data-campo="${campo}"]`);
  if (!contenedor) return;
  contenedor.classList.toggle('invalido', Boolean(mensaje));
  contenedor.querySelector('.msg-error').textContent = mensaje || '';
}

function limpiarErrores() {
  form.querySelectorAll('[data-campo]').forEach((c) => marcarError(c.dataset.campo, ''));
  avisoForm.classList.add('oculto');
}

function validar() {
  const errores = {};
  const anonimo = $('#anonimo').checked;
  const nombre = $('#nombre').value.trim();
  const telefono = $('#telefono').value.replace(/[\s-]/g, '');
  const correo = $('#correo').value.trim();
  const descripcion = $('#descripcion').value.trim();
  const direccion = $('#direccion').value.trim();

  if (!anonimo && nombre.length < 3) errores.nombre = 'Ingresa tu nombre o marca la opción anónima.';
  if (telefono && !/^[2-7]\d{7}$/.test(telefono)) errores.telefono = 'Debe tener 8 dígitos.';
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) errores.correo = 'Correo no válido.';
  if (!form.querySelector('input[name="categoria"]:checked')) errores.categoria = 'Selecciona una categoría.';
  if (!$('#zona').value) errores.zona = 'Selecciona una zona.';
  if (direccion.length < 5) errores.direccion = 'Indica la dirección (mínimo 5 caracteres).';
  if (descripcion.length < 20) errores.descripcion = `Describe el problema con al menos 20 caracteres (llevas ${descripcion.length}).`;
  if (!fotoSeleccionada) errores.foto = 'Adjunta una fotografía del problema.';

  Object.entries(errores).forEach(([campo, msg]) => marcarError(campo, msg));
  return errores;
}

function mostrarErrores(errores, mensajeGeneral) {
  Object.entries(errores || {}).forEach(([campo, msg]) => marcarError(campo, msg));
  avisoForm.innerHTML = `⚠️ <span>${escapar(mensajeGeneral)}</span>`;
  avisoForm.classList.remove('oculto');
  const primero = form.querySelector('.invalido');
  (primero || avisoForm).scrollIntoView({ behavior: 'smooth', block: 'center' });
  primero?.querySelector('input:not([type=radio]), select, textarea')?.focus({ preventScroll: true });
}

/* Limpia el error de un campo en cuanto el usuario lo corrige */
form.addEventListener('input', (e) => {
  const contenedor = e.target.closest('[data-campo]');
  if (contenedor) marcarError(contenedor.dataset.campo, '');
});

$('#anonimo').addEventListener('change', (e) => {
  const anonimo = e.target.checked;
  const nombre = $('#nombre');
  nombre.disabled = anonimo;
  if (anonimo) { nombre.value = ''; marcarError('nombre', ''); }
  nombre.placeholder = anonimo ? 'Anónimo' : 'Ej. María López';
});

$('#descripcion').addEventListener('input', (e) => {
  $('#contador').textContent = `${e.target.value.length} / 2000`;
});

/* ───────────── Fotografía ───────────── */
async function seleccionarFoto(archivo) {
  if (!archivo) return;
  if (!TIPOS_FOTO.includes(archivo.type)) {
    marcarError('foto', 'Formato no permitido. Usa JPG, PNG o WEBP.');
    return;
  }
  if (archivo.size > MAX_FOTO) {
    marcarError('foto', `La foto pesa ${formatearBytes(archivo.size)}; el máximo es 8 MB.`);
    return;
  }
  marcarError('foto', '');
  fotoSeleccionada = await comprimirImagen(archivo);

  if (urlPrevia) URL.revokeObjectURL(urlPrevia);
  urlPrevia = URL.createObjectURL(fotoSeleccionada);
  $('#img-previa').src = urlPrevia;
  $('#nombre-foto').textContent = archivo.name;
  $('#peso-foto').textContent = `${formatearBytes(fotoSeleccionada.size)} listo para enviar`;
  zonaFoto.classList.add('oculto');
  vistaPrevia.classList.remove('oculto');
}

function quitarFoto() {
  fotoSeleccionada = null;
  inputFoto.value = '';
  if (urlPrevia) URL.revokeObjectURL(urlPrevia);
  urlPrevia = null;
  vistaPrevia.classList.add('oculto');
  zonaFoto.classList.remove('oculto');
}

inputFoto.addEventListener('change', () => seleccionarFoto(inputFoto.files[0]));
$('#quitar-foto').addEventListener('click', quitarFoto);
['dragenter', 'dragover'].forEach((ev) =>
  zonaFoto.addEventListener(ev, (e) => { e.preventDefault(); zonaFoto.classList.add('arrastrando'); })
);
['dragleave', 'drop'].forEach((ev) =>
  zonaFoto.addEventListener(ev, (e) => { e.preventDefault(); zonaFoto.classList.remove('arrastrando'); })
);
zonaFoto.addEventListener('drop', (e) => seleccionarFoto(e.dataTransfer.files[0]));

/* ───────────── Envío ───────────── */
function estadoEnviando(enviando) {
  btnEnviar.disabled = enviando;
  btnEnviar.innerHTML = enviando ? '<span class="spinner"></span> Enviando…' : 'Enviar queja';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarErrores();
  const errores = validar();
  if (Object.keys(errores).length) {
    mostrarErrores({}, 'Revisa los campos marcados en rojo.');
    return;
  }

  const datos = new FormData(form);
  datos.set('anonimo', String($('#anonimo').checked));
  datos.set('telefono', $('#telefono').value.replace(/[\s-]/g, ''));
  datos.set('foto', fotoSeleccionada, fotoSeleccionada.name);

  estadoEnviando(true);
  try {
    const { queja } = await api.crearQueja(datos);
    mostrarConfirmacion(queja);
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.';
    mostrarErrores(err.errores, msg);
  } finally {
    estadoEnviando(false);
  }
});

form.addEventListener('reset', () => {
  limpiarErrores();
  quitarFoto();
  $('#contador').textContent = '0 / 2000';
  $('#nombre').disabled = false;
});

/* ───────────── Confirmación ───────────── */
function mostrarConfirmacion(queja) {
  $('#codigo-generado').textContent = queja.codigo;
  $('#fecha-registro').textContent = `Registrada el ${formatearFecha(queja.fechaCreacion)}`;
  form.classList.add('oculto');
  const conf = $('#confirmacion');
  conf.classList.remove('oculto');
  conf.focus();
  window.scrollTo({ top: conf.offsetTop - 40, behavior: 'smooth' });
}

$('#copiar-codigo').addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText($('#codigo-generado').textContent);
    e.target.textContent = '¡Copiado!';
  } catch {
    e.target.textContent = 'Cópialo manualmente';
  }
  setTimeout(() => (e.target.textContent = 'Copiar'), 2000);
});

$('#nueva-queja').addEventListener('click', () => {
  form.reset();
  $('#confirmacion').classList.add('oculto');
  form.classList.remove('oculto');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('#ver-seguimiento').addEventListener('click', () => {
  $('#codigo').value = $('#codigo-generado').textContent;
  mostrarPestana('seguimiento');
  consultarSeguimiento();
});

/* ───────────── Seguimiento ───────────── */
async function consultarSeguimiento() {
  const codigo = $('#codigo').value.trim().toUpperCase();
  const resultado = $('#resultado-seguimiento');
  if (!/^Q-\d{8}-[A-Z0-9]{5}$/.test(codigo)) {
    resultado.innerHTML = '<div class="aviso aviso--alerta">El código debe tener el formato Q-20261114-AB12C.</div>';
    return;
  }
  const btn = $('#btn-buscar');
  btn.disabled = true;
  resultado.innerHTML = '<div class="cargando"><span class="spinner spinner--oscuro"></span> Buscando…</div>';
  try {
    const { queja } = await api.seguimiento(codigo);
    resultado.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
        <div>
          <strong style="font-family: ui-monospace, Menlo, monospace;">${escapar(queja.codigo)}</strong>
          <div style="color: var(--texto-suave); font-size:.9rem;">${escapar(queja.categoriaNombre)} · ${escapar(queja.zona)}</div>
        </div>
        ${chipEstado(queja.estado, queja.estadoNombre)}
      </div>
      <ol class="linea-tiempo">
        ${[...queja.historial].reverse().map((h) => `
          <li style="--punto: ${COLOR_ESTADO[h.estado] ?? 'var(--lavanda-fuerte)'}">
            <strong>${escapar(h.estadoNombre)}</strong>
            <time datetime="${escapar(h.fecha)}">${formatearFecha(h.fecha)}</time>
            ${h.nota ? `<p>${escapar(h.nota)}</p>` : ''}
          </li>`).join('')}
      </ol>`;
  } catch (err) {
    resultado.innerHTML = `<div class="aviso aviso--error">⚠️ ${escapar(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

$('#form-seguimiento').addEventListener('submit', (e) => {
  e.preventDefault();
  consultarSeguimiento();
});

/* ───────────── Inicio ───────────── */
despertarServidor().then(cargarCatalogos);
