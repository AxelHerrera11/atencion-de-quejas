import multer from 'multer';
import { HttpError } from '../utils/HttpError.js';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const subirFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 20 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      return cb(new HttpError(400, 'Formato de imagen no permitido. Usa JPG, PNG o WEBP.'));
    }
    cb(null, true);
  },
}).single('foto');
