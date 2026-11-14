import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

/** Protege las rutas del panel municipal con un token JWT (Authorization: Bearer <token>). */
export function requiereAdmin(req, _res, next) {
  const header = req.get('Authorization') || '';
  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Debes iniciar sesión para acceder al panel.'));
  }
  try {
    req.usuario = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    next(new HttpError(401, 'Tu sesión expiró o no es válida. Inicia sesión nuevamente.'));
  }
}
