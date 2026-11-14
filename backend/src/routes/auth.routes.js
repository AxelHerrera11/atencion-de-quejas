import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login } from '../controllers/auth.controller.js';

const router = Router();

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { ok: false, mensaje: 'Demasiados intentos de inicio de sesión. Espera unos minutos.' },
});

router.post('/login', limiteLogin, login);

export default router;
