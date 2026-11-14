import { CATEGORIAS, ZONAS, ESTADOS } from './catalogos.js';
import { HttpError } from './HttpError.js';

const limpiar = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const limpiarMultilinea = (v) => (typeof v === 'string' ? v.trim().replace(/[ \t]+/g, ' ') : '');

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_TELEFONO = /^[2-7]\d{7}$/; // Teléfonos de Guatemala: 8 dígitos

/**
 * Valida y normaliza los datos de una nueva queja.
 * Devuelve el objeto limpio o lanza HttpError 400 con el detalle por campo.
 */
export function validarNuevaQueja(body = {}) {
  const errores = {};
  const anonimo = body.anonimo === true || body.anonimo === 'true';

  const datos = {
    anonimo,
    nombre: anonimo ? '' : limpiar(body.nombre),
    telefono: limpiar(body.telefono).replace(/[\s-]/g, ''),
    correo: limpiar(body.correo).toLowerCase(),
    categoria: limpiar(body.categoria),
    zona: limpiar(body.zona),
    direccion: limpiar(body.direccion),
    referencia: limpiar(body.referencia),
    descripcion: limpiarMultilinea(body.descripcion),
  };

  if (!anonimo) {
    if (datos.nombre.length < 3) errores.nombre = 'Ingresa tu nombre (mínimo 3 caracteres) o marca la opción anónima.';
    else if (datos.nombre.length > 80) errores.nombre = 'El nombre no debe superar 80 caracteres.';
  }
  if (datos.telefono && !REGEX_TELEFONO.test(datos.telefono)) {
    errores.telefono = 'El teléfono debe tener 8 dígitos (ej. 5555 1234).';
  }
  if (datos.correo && (!REGEX_CORREO.test(datos.correo) || datos.correo.length > 120)) {
    errores.correo = 'El correo electrónico no es válido.';
  }
  if (!CATEGORIAS[datos.categoria]) errores.categoria = 'Selecciona una categoría válida.';
  if (!ZONAS.includes(datos.zona)) errores.zona = 'Selecciona una zona válida.';
  if (datos.direccion.length < 5) errores.direccion = 'Indica la dirección o lugar (mínimo 5 caracteres).';
  else if (datos.direccion.length > 150) errores.direccion = 'La dirección no debe superar 150 caracteres.';
  if (datos.referencia.length > 150) errores.referencia = 'La referencia no debe superar 150 caracteres.';
  if (datos.descripcion.length < 20) errores.descripcion = 'Describe el problema con al menos 20 caracteres.';
  else if (datos.descripcion.length > 2000) errores.descripcion = 'La descripción no debe superar 2000 caracteres.';

  if (Object.keys(errores).length) {
    throw new HttpError(400, 'Revisa los datos del formulario.', errores);
  }
  return datos;
}

export function validarCambioEstado(body = {}) {
  const estado = limpiar(body.estado);
  const nota = limpiarMultilinea(body.nota);
  const errores = {};
  if (!ESTADOS[estado]) errores.estado = 'Estado no válido.';
  if (nota.length > 500) errores.nota = 'La nota no debe superar 500 caracteres.';
  if (Object.keys(errores).length) throw new HttpError(400, 'Datos inválidos.', errores);
  return { estado, nota };
}

export function validarCodigoSeguimiento(codigo) {
  const limpio = limpiar(codigo).toUpperCase();
  if (!/^Q-\d{8}-[A-Z0-9]{5}$/.test(limpio)) {
    throw new HttpError(400, 'El código de seguimiento no tiene un formato válido (ej. Q-20261114-AB12C).');
  }
  return limpio;
}
