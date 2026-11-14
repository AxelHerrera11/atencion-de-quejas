import * as servicio from '../services/quejas.service.js';
import { procesarFoto } from '../utils/imagen.js';
import { HttpError } from '../utils/HttpError.js';
import { CATEGORIAS, ZONAS, ESTADOS } from '../utils/catalogos.js';
import {
  validarNuevaQueja,
  validarCambioEstado,
  validarCodigoSeguimiento,
} from '../utils/validaciones.js';

export function catalogos(_req, res) {
  res.json({ ok: true, categorias: CATEGORIAS, zonas: ZONAS, estados: ESTADOS });
}

export async function crear(req, res) {
  const datos = validarNuevaQueja(req.body);
  if (!req.file) {
    throw new HttpError(400, 'Revisa los datos del formulario.', {
      foto: 'Adjunta una fotografía del problema.',
    });
  }
  const foto = await procesarFoto(req.file.buffer);
  const creada = await servicio.crearQueja(datos, foto);
  res.status(201).json({
    ok: true,
    mensaje: 'Tu queja fue registrada correctamente.',
    queja: creada,
  });
}

export async function seguimiento(req, res) {
  const codigo = validarCodigoSeguimiento(req.params.codigo);
  res.json({ ok: true, queja: await servicio.consultarPorCodigo(codigo) });
}

export async function listar(req, res) {
  const { estado, categoria, zona, q, desde, hasta } = req.query;
  const fechaValida = (f) => !f || /^\d{4}-\d{2}-\d{2}$/.test(f);
  if (!fechaValida(desde) || !fechaValida(hasta)) {
    throw new HttpError(400, 'Las fechas deben tener el formato AAAA-MM-DD.');
  }
  const resultado = await servicio.listarQuejas({ estado, categoria, zona, q, desde, hasta });
  res.json({ ok: true, ...resultado });
}

export async function detalle(req, res) {
  res.json({ ok: true, queja: await servicio.obtenerQueja(req.params.id) });
}

export async function foto(req, res) {
  const { mimeType, buffer } = await servicio.obtenerFoto(req.params.id);
  res.set('Content-Type', mimeType);
  res.set('Cache-Control', 'private, max-age=3600');
  res.send(buffer);
}

export async function cambiarEstado(req, res) {
  const cambios = validarCambioEstado(req.body);
  const queja = await servicio.actualizarEstado(req.params.id, cambios, req.usuario.usuario);
  res.json({ ok: true, mensaje: 'Estado actualizado.', queja });
}
