import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`API escuchando en http://localhost:${env.port}`);
  if (env.corsOrigins.length === 0) {
    console.warn('[AVISO] CORS_ORIGINS vacío: se aceptan peticiones de cualquier origen.');
  }
});
