import sharp from 'sharp';
import { HttpError } from './HttpError.js';

// Firestore permite documentos de hasta 1 MiB; dejamos margen para metadatos.
const MAX_BYTES_GUARDADO = 850 * 1024;

/**
 * Normaliza la fotografía: corrige orientación, la redimensiona y la convierte a JPEG
 * para que pueda almacenarse en Firestore (capa gratuita, sin Cloud Storage).
 */
export async function procesarFoto(buffer) {
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new HttpError(400, 'El archivo adjunto no es una imagen válida.');
  }
  if (!metadata.width || !metadata.height) {
    throw new HttpError(400, 'No se pudo leer la imagen adjunta.');
  }

  let lado = 1600;
  let calidad = 80;
  for (let intento = 0; intento < 6; intento++) {
    const { data, info } = await sharp(buffer)
      .rotate() // respeta la orientación EXIF
      .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: calidad, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    if (data.length <= MAX_BYTES_GUARDADO) {
      return { buffer: data, mimeType: 'image/jpeg', ancho: info.width, alto: info.height, bytes: data.length };
    }
    lado = Math.round(lado * 0.8);
    calidad = Math.max(55, calidad - 5);
  }
  throw new HttpError(413, 'La imagen es demasiado pesada aun después de comprimirla. Intenta con otra fotografía.');
}
