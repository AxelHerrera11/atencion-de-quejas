import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

/** Comparación en tiempo constante para evitar ataques de temporización. */
function iguales(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function login(req, res) {
  const { usuario, contrasena } = req.body ?? {};
  if (!usuario || !contrasena) {
    throw new HttpError(400, 'Ingresa usuario y contraseña.');
  }
  const okUsuario = iguales(usuario, env.adminUser);
  const okContrasena = iguales(contrasena, env.adminPassword);
  if (!(okUsuario && okContrasena)) {
    throw new HttpError(401, 'Usuario o contraseña incorrectos.');
  }
  const token = jwt.sign({ usuario }, env.jwtSecret, { expiresIn: '8h' });
  res.json({ ok: true, token, usuario, expiraEn: 8 * 60 * 60 });
}
