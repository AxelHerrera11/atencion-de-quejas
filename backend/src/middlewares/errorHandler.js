import multer from 'multer';
import { HttpError } from '../utils/HttpError.js';

export function noEncontrado(req, _res, next) {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function manejadorErrores(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    const mensaje =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'La fotografía supera el tamaño máximo de 8 MB.'
        : 'Error al recibir el archivo adjunto.';
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ ok: false, mensaje });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ ok: false, mensaje: err.message, errores: err.detalles });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, mensaje: 'El cuerpo de la solicitud no es JSON válido.' });
  }

  console.error('[ERROR]', err);
  res.status(500).json({ ok: false, mensaje: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
}
