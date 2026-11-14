import 'dotenv/config';

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno obligatoria: ${nombre}`);
  }
  return valor;
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  adminUser: requerida('ADMIN_USER'),
  adminPassword: requerida('ADMIN_PASSWORD'),
  jwtSecret: requerida('JWT_SECRET'),
  firebaseServiceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
};
