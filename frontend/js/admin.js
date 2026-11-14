import { api, sesion, despertarServidor } from './api.js';
import {
  ESTILO_CATEGORIA, COLOR_ESTADO, escapar, formatearFecha, tiempoRelativo, chipEstado,
} from './utilidades.js';

const $ = (sel) => document.querySelector(sel);

const CLAVE_USUARIO = 'quejas_usuario';
let catalogos = null;
let urlFotoActual = null;
let idDetalleAbierto = null;

/* ───────────── Sesión ───────────── */
function mostrarLogin(mensaje = '') {
  $('#vista-panel').classList.add('oculto');
  $('#vista-login').classList.remove('oculto');
  cerrarDetalle();
  const error = $('#error-login');
  error.textContent = mensaje;
  error.classList.toggle('oculto', !mensaje);
  $('#usuario').focus();
}

async function mostrarPanel() {
  $('#vista-login').classList.add('oculto');
  $('#vista-panel').classList.remove('oculto');
  $('#nombre-usuario').textContent = sessionStorage.getItem(CLAVE_USUARIO) || 'admin';
  if (!catalogos) {
    try {
      await cargarCatalogos();
    } catch (err) {
      $('#lista-quejas').innerHTML = `
        <div class="aviso aviso--error">⚠️ ${escapar(err.message)}
          <button class="btn btn--suave" style="margin-left:auto; padding: 6px 14px;" id="reintentar-panel">Reintentar</button>
        </div>`;
      $('#reintentar-panel').addEventListener('click', mostrarPanel);
      return;
    }
  }
  await cargarQuejas();
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuario = $('#usuario').value.trim();
  const contrasena = $('#contrasena').value;
  const error = $('#error-login');
  if (!usuario || !contrasena) {
    error.textContent = 'Ingresa usuario y contraseña.';
    error.classList.remove('oculto');
    return;
  }
  const btn = $('#btn-login');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Ingresando…';
  try {
    const { token } = await api.login(usuario, contrasena);
    sesion.guardar(token);
    sessionStorage.setItem(CLAVE_USUARIO, usuario);
    $('#contrasena').value = '';
    error.classList.add('oculto');
    await mostrarPanel();
  } catch (err) {
    error.textContent = err.message;
    error.classList.remove('oculto');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ingresar';
  }
});

$('#btn-salir').addEventListener('click', () => {
  sesion.cerrar();
  sessionStorage.removeItem(CLAVE_USUARIO);
  mostrarLogin();
});

window.addEventListener('sesion-expirada', () => mostrarLogin('Tu sesión expiró. Inicia sesión nuevamente.'));

/* ───────────── Catálogos ───────────── */
async function cargarCatalogos() {
  catalogos = await api.catalogos();
  const opciones = (obj) => Object.entries(obj).map(([v, t]) => `<option value="${escapar(v)}">${escapar(t)}</option>`).join('');
  $('#f-estado').insertAdjacentHTML('beforeend', opciones(catalogos.estados));
  $('#f-categoria').insertAdjacentHTML('beforeend', opciones(catalogos.categorias));
  $('#f-zona').insertAdjacentHTML('beforeend', catalogos.zonas.map((z) => `<option>${escapar(z)}</option>`).join(''));
}

/* ───────────── Listado ───────────── */
function leerFiltros() {
  return Object.fromEntries(new FormData($('#form-filtros')));
}

async function cargarQuejas() {
  const lista = $('#lista-quejas');
  lista.setAttribute('aria-busy', 'true');
  if (!lista.querySelector('.item-queja')) {
    lista.innerHTML = '<div class="cargando"><span class="spinner spinner--oscuro"></span> Cargando quejas…</div>';
  }
  try {
    const { datos, resumen } = await api.listarQuejas(leerFiltros());
    pintarIndicadores(resumen);
    pintarCategorias(resumen);
    pintarLista(datos, resumen.total);
    $('#ultima-actualizacion').textContent = `Actualizado ${formatearFecha(new Date().toISOString())}`;
  } catch (err) {
    if (err.status === 401) return;
    lista.innerHTML = `
      <div class="aviso aviso--error">⚠️ ${escapar(err.message)}
        <button class="btn btn--suave" style="margin-left:auto; padding: 6px 14px;" id="reintentar">Reintentar</button>
      </div>`;
    $('#reintentar').addEventListener('click', cargarQuejas);
  } finally {
    lista.removeAttribute('aria-busy');
  }
}

function pintarIndicadores(resumen) {
  $('[data-total="total"]').textContent = resumen.total;
  for (const [estado, n] of Object.entries(resumen.porEstado)) {
    const el = $(`[data-total="${estado}"]`);
    if (el) el.textContent = n;
  }
  const estadoActivo = $('#f-estado').value;
  document.querySelectorAll('.indicador').forEach((b) => b.classList.toggle('activo', b.dataset.estado === estadoActivo));
}

function pintarCategorias(resumen) {
  const max = Math.max(1, ...Object.values(resumen.porCategoria));
  $('#barra-categorias').innerHTML = Object.entries(resumen.porCategoria)
    .sort((a, b) => b[1] - a[1])
    .map(([clave, n]) => {
      const estilo = ESTILO_CATEGORIA[clave] ?? ESTILO_CATEGORIA.otro;
      return `
        <div class="barra-categorias__fila">
          <span>${estilo.icono} ${escapar(catalogos.categorias[clave] ?? clave)}</span>
          <div class="barra-categorias__pista"><div class="barra-categorias__relleno" style="width:${(n / max) * 100}%"></div></div>
          <b>${n}</b>
        </div>`;
    })
    .join('');
  $('#ultimas24h').textContent = resumen.ultimas24h;
}

function pintarLista(quejas, total) {
  const lista = $('#lista-quejas');
  const hayFiltros = Object.values(leerFiltros()).some(Boolean);
  $('#conteo-resultados').textContent = hayFiltros
    ? `Mostrando ${quejas.length} de ${total} quejas`
    : `${total} quejas registradas`;

  if (!quejas.length) {
    lista.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio__icono">${hayFiltros ? '🔍' : '🌤️'}</div>
        <p><strong>${hayFiltros ? 'Ninguna queja coincide con los filtros.' : 'Aún no hay quejas registradas.'}</strong></p>
        <p>${hayFiltros ? 'Prueba con otros criterios de búsqueda.' : 'Cuando un ciudadano envíe un reporte aparecerá aquí.'}</p>
      </div>`;
    return;
  }

  lista.innerHTML = quejas.map((q) => {
    const estilo = ESTILO_CATEGORIA[q.categoria] ?? ESTILO_CATEGORIA.otro;
    return `
      <button class="item-queja" data-id="${escapar(q.id)}">
        <span class="item-queja__icono" style="--c:${estilo.color}" aria-hidden="true">${estilo.icono}</span>
        <span style="min-width:0;">
          <span class="item-queja__titulo">${escapar(q.categoriaNombre)} <span class="item-queja__codigo">${escapar(q.codigo)}</span></span>
          <span class="item-queja__desc">${escapar(q.descripcion)}</span>
          <small style="color: var(--texto-suave);">📍 ${escapar(q.zona)} · ${escapar(q.direccion)}</small>
        </span>
        <span class="item-queja__meta">
          ${chipEstado(q.estado, q.estadoNombre)}
          <time datetime="${escapar(q.fechaCreacion)}" title="${formatearFecha(q.fechaCreacion)}">${tiempoRelativo(q.fechaCreacion)}</time>
        </span>
      </button>`;
  }).join('');
}

$('#lista-quejas').addEventListener('click', (e) => {
  const item = e.target.closest('.item-queja');
  if (item) abrirDetalle(item.dataset.id);
});

/* ───────────── Filtros ───────────── */
let temporizadorBusqueda;
$('#form-filtros').addEventListener('input', (e) => {
  clearTimeout(temporizadorBusqueda);
  const espera = e.target.id === 'f-texto' ? 400 : 0;
  temporizadorBusqueda = setTimeout(cargarQuejas, espera);
});
$('#form-filtros').addEventListener('submit', (e) => { e.preventDefault(); cargarQuejas(); });
$('#form-filtros').addEventListener('reset', () => setTimeout(cargarQuejas, 0));
$('#indicadores').addEventListener('click', (e) => {
  const b = e.target.closest('.indicador');
  if (!b) return;
  $('#f-estado').value = b.dataset.estado;
  cargarQuejas();
});
$('#btn-refrescar').addEventListener('click', cargarQuejas);

/* ───────────── Detalle ───────────── */
function liberarFoto() {
  if (urlFotoActual) URL.revokeObjectURL(urlFotoActual);
  urlFotoActual = null;
}

function cerrarDetalle() {
  idDetalleAbierto = null;
  $('#detalle').classList.add('oculto');
  $('#fondo-detalle').classList.add('oculto');
  document.body.style.overflow = '';
  liberarFoto();
}

async function abrirDetalle(id) {
  idDetalleAbierto = id;
  liberarFoto();
  $('#detalle').classList.remove('oculto');
  $('#fondo-detalle').classList.remove('oculto');
  document.body.style.overflow = 'hidden';
  const cuerpo = $('#detalle-cuerpo');
  cuerpo.innerHTML = '<div class="cargando"><span class="spinner spinner--oscuro"></span> Cargando detalle…</div>';
  $('#cerrar-detalle').focus();

  try {
    const { queja } = await api.detalleQueja(id);
    if (idDetalleAbierto !== id) return;
    pintarDetalle(queja);
    cargarFoto(id);
  } catch (err) {
    cuerpo.innerHTML = `<div class="aviso aviso--error">⚠️ ${escapar(err.message)}</div>`;
  }
}

async function cargarFoto(id) {
  const contenedor = $('#detalle-foto');
  try {
    const blob = await api.fotoQueja(id);
    if (idDetalleAbierto !== id) return;
    urlFotoActual = URL.createObjectURL(blob);
    contenedor.innerHTML = `<img src="${urlFotoActual}" alt="Fotografía adjunta por el ciudadano" id="img-detalle">`;
    $('#img-detalle').addEventListener('click', () => abrirVisor(urlFotoActual));
  } catch (err) {
    contenedor.innerHTML = `<p style="color: var(--texto-suave); padding: 20px;">📷 ${escapar(err.message)}</p>`;
  }
}

function abrirVisor(url) {
  const visor = document.createElement('div');
  visor.className = 'visor';
  visor.innerHTML = `<img src="${url}" alt="Fotografía en tamaño completo">`;
  visor.addEventListener('click', () => visor.remove());
  document.body.appendChild(visor);
}

function pintarDetalle(q) {
  const estilo = ESTILO_CATEGORIA[q.categoria] ?? ESTILO_CATEGORIA.otro;
  const opcionesEstado = Object.entries(catalogos.estados)
    .map(([v, t]) => `<option value="${v}" ${v === q.estado ? 'selected' : ''}>${escapar(t)}</option>`)
    .join('');

  $('#detalle-titulo').innerHTML = `${estilo.icono} ${escapar(q.codigo)}`;
  $('#detalle-cuerpo').innerHTML = `
    <div style="display:flex; gap: 8px; flex-wrap: wrap; align-items:center;">
      ${chipEstado(q.estado, q.estadoNombre)}
      <span class="chip chip--categoria">${escapar(q.categoriaNombre)}</span>
      <span style="color: var(--texto-suave); font-size: .85rem; margin-left: auto;">${formatearFecha(q.fechaCreacion)}</span>
    </div>

    <section class="tarjeta">
      <h3>Descripción original del ciudadano</h3>
      <p class="descripcion-original">${escapar(q.descripcion)}</p>
    </section>

    <section class="tarjeta">
      <h3>Fotografía adjunta</h3>
      <div class="detalle__foto" id="detalle-foto"><span class="spinner spinner--oscuro"></span></div>
      ${q.foto ? `<small style="color: var(--texto-suave);">${q.foto.ancho}×${q.foto.alto}px · clic para ampliar</small>` : ''}
    </section>

    <section class="tarjeta">
      <h3>Ubicación</h3>
      <dl class="datos">
        <dt>Zona</dt><dd>${escapar(q.zona)}</dd>
        <dt>Dirección</dt><dd>${escapar(q.direccion)}</dd>
        <dt>Referencia</dt><dd>${escapar(q.referencia || '—')}</dd>
      </dl>
    </section>

    <section class="tarjeta">
      <h3>Ciudadano</h3>
      <dl class="datos">
        <dt>Nombre</dt><dd>${q.anonimo ? '<em>Anónimo</em>' : escapar(q.nombre)}</dd>
        <dt>Teléfono</dt><dd>${q.telefono ? `<a href="tel:${escapar(q.telefono)}">${escapar(q.telefono)}</a>` : '—'}</dd>
        <dt>Correo</dt><dd>${q.correo ? `<a href="mailto:${escapar(q.correo)}">${escapar(q.correo)}</a>` : '—'}</dd>
      </dl>
    </section>

    <section class="tarjeta">
      <h3>Gestión</h3>
      <form id="form-estado">
        <div class="campo" style="margin-bottom: 12px;">
          <label for="nuevo-estado">Cambiar estado</label>
          <select class="select" id="nuevo-estado">${opcionesEstado}</select>
        </div>
        <div class="campo" style="margin-bottom: 12px;">
          <label for="nota-estado">Nota para el ciudadano <span class="opcional">(visible en el seguimiento)</span></label>
          <textarea class="textarea" id="nota-estado" maxlength="500" style="min-height: 80px;" placeholder="Ej. Se asignó una cuadrilla para el día lunes."></textarea>
        </div>
        <div id="aviso-estado" class="oculto" style="margin-bottom: 12px;"></div>
        <button class="btn btn--primario btn--bloque" id="btn-estado">Guardar cambios</button>
      </form>
    </section>

    <section class="tarjeta">
      <h3>Historial</h3>
      <ol class="linea-tiempo">
        ${[...q.historial].reverse().map((h) => `
          <li style="--punto: ${COLOR_ESTADO[h.estado] ?? 'var(--lavanda-fuerte)'}">
            <strong>${escapar(catalogos.estados[h.estado] ?? h.estado)}</strong>
            <time datetime="${escapar(h.fecha)}">${formatearFecha(h.fecha)}${h.usuario ? ` · ${escapar(h.usuario)}` : ''}</time>
            ${h.nota ? `<p>${escapar(h.nota)}</p>` : ''}
          </li>`).join('')}
      </ol>
    </section>`;

  $('#form-estado').addEventListener('submit', (e) => guardarEstado(e, q));
}

async function guardarEstado(e, q) {
  e.preventDefault();
  const estado = $('#nuevo-estado').value;
  const nota = $('#nota-estado').value.trim();
  const aviso = $('#aviso-estado');
  if (estado === q.estado && !nota) {
    aviso.className = 'aviso aviso--alerta';
    aviso.textContent = 'Selecciona un estado distinto o agrega una nota.';
    return;
  }
  const btn = $('#btn-estado');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando…';
  try {
    const { queja } = await api.cambiarEstado(q.id, estado, nota);
    const urlFoto = urlFotoActual;
    pintarDetalle(queja);
    if (urlFoto) {
      $('#detalle-foto').innerHTML = `<img src="${urlFoto}" alt="Fotografía adjunta por el ciudadano" id="img-detalle">`;
      $('#img-detalle').addEventListener('click', () => abrirVisor(urlFoto));
    } else {
      cargarFoto(q.id);
    }
    const nuevoAviso = $('#aviso-estado');
    nuevoAviso.className = 'aviso aviso--exito';
    nuevoAviso.textContent = '✅ Cambios guardados correctamente.';
    cargarQuejas();
  } catch (err) {
    aviso.className = 'aviso aviso--error';
    aviso.textContent = `⚠️ ${err.message}`;
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }
}

$('#cerrar-detalle').addEventListener('click', cerrarDetalle);
$('#fondo-detalle').addEventListener('click', cerrarDetalle);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const visor = document.querySelector('.visor');
  if (visor) visor.remove();
  else if (idDetalleAbierto) cerrarDetalle();
});

/* ───────────── Inicio ───────────── */
despertarServidor().then(() => (sesion.obtener() ? mostrarPanel() : mostrarLogin()));
