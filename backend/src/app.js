import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import quejasRoutes from './routes/quejas.routes.js';
import authRoutes from './routes/auth.routes.js';
import { noEncontrado, manejadorErrores } from './middlewares/errorHandler.js';

const app = express();

app.set('trust proxy', 1); // Render está detrás de un proxy (necesario para el rate limit)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(null, false);
    },
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '100kb' }));

app.get('/', (_req, res) => res.json({ ok: true, servicio: 'API de Atención de Quejas Ciudadanas' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, fecha: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/quejas', quejasRoutes);

app.use(noEncontrado);
app.use(manejadorErrores);

export default app;
