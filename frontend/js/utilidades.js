/** Utilidades compartidas entre el portal y el panel. */

export const ESTILO_CATEGORIA = {
  baches: { icono: '🚧', color: 'var(--durazno)' },
  alumbrado: { icono: '💡', color: 'var(--limon)' },
  basura: { icono: '🗑️', color: 'var(--menta)' },
  agua: { icono: '💧', color: 'var(--cielo)' },
  parques: { icono: '🌳', color: '#e2f3d6' },
  seguridad: { icono: '🛡️', color: 'var(--rosa)' },
  otro: { icono: '📝', color: 'var(--lavanda)' },
};

export const COLOR_ESTADO = {
  pendiente: 'var(--durazno-fuerte)',
  en_proceso: 'var(--cielo-fuerte)',
  resuelta: 'var(--menta-fuerte)',
  rechazada: 'var(--rosa-fuerte)',
};

/** Escapa texto para insertarlo de forma segura en HTML (previene XSS). */
export function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fmtFecha = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
export const formatearFecha = (iso) => (iso ? fmtFecha.format(new Date(iso)) : '—');

export function tiempoRelativo(iso) {
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (seg < 60) return 'hace un momento';
  if (seg < 3600) return rtf.format(-Math.floor(seg / 60), 'minute');
  if (seg < 86400) return rtf.format(-Math.floor(seg / 3600), 'hour');
  if (seg < 2592000) return rtf.format(-Math.floor(seg / 86400), 'day');
  return formatearFecha(iso);
}

export const chipEstado = (estado, nombre) =>
  `<span class="chip chip--${escapar(estado)}">${escapar(nombre)}</span>`;

/**
 * Comprime la imagen en el navegador antes de subirla (ahorra datos móviles).
 * Si el navegador no puede decodificarla, se envía el archivo original.
 */
export async function comprimirImagen(archivo, ladoMax = 1600, calidad = 0.82) {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', calidad));
    if (!blob) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg' });
  } catch {
    return archivo;
  }
}

export const formatearBytes = (b) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
