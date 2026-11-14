import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/quejas.controller.js';
import { requiereAdmin } from '../middlewares/auth.js';
import { subirFoto } from '../middlewares/upload.js';

const router = Router();

const limiteEnvio = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  message: { ok: false, mensaje: 'Has enviado demasiadas quejas en poco tiempo. Intenta más tarde.' },
});

// ── Rutas públicas (portal ciudadano) ──
router.get('/catalogos', ctrl.catalogos);
router.post('/', limiteEnvio, subirFoto, ctrl.crear);
router.get('/seguimiento/:codigo', ctrl.seguimiento);

// ── Rutas protegidas (panel municipal) ──
router.get('/', requiereAdmin, ctrl.listar);
router.get('/:id', requiereAdmin, ctrl.detalle);
router.get('/:id/foto', requiereAdmin, ctrl.foto);
router.patch('/:id/estado', requiereAdmin, ctrl.cambiarEstado);

export default router;
