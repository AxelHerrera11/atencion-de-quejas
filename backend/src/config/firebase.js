import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { env } from './env.js';

/**
 * Inicializa Firebase Admin SDK.
 * Las credenciales se leen de variables de entorno, nunca del código fuente.
 */
function obtenerCredencial() {
  if (env.firebaseServiceAccountBase64) {
    const json = Buffer.from(env.firebaseServiceAccountBase64, 'base64').toString('utf8');
    return cert(JSON.parse(json));
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }
  throw new Error(
    'No se encontraron credenciales de Firebase. Define FIREBASE_SERVICE_ACCOUNT_BASE64 o GOOGLE_APPLICATION_CREDENTIALS.'
  );
}

if (!getApps().length) {
  initializeApp({ credential: obtenerCredencial() });
}

export const db = getFirestore();
export { FieldValue, Timestamp };
