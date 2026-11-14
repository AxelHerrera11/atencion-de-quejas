import crypto from 'node:crypto';
import { db, FieldValue, Timestamp } from '../config/firebase.js';
import { CATEGORIAS, ESTADOS } from '../utils/catalogos.js';
import { HttpError } from '../utils/HttpError.js';

/*
 * Estructura en Firestore
 * ───────────────────────
 * quejas/{id}        → datos del reporte (ligero, para listar rápido)
 * quejas_fotos/{id}  → fotografía en base64 (mismo id que la queja)
 */
const quejasCol = db.collection('quejas');
const fotosCol = db.collection('quejas_fotos');

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusiones

function generarCodigo(fecha = new Date()) {
  const ymd = fecha.toISOString().slice(0, 10).replace(/-/g, '');
  const bytes = crypto.randomBytes(5);
  const sufijo = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
  return `Q-${ymd}-${sufijo}`;
}

const aISO = (ts) => (ts instanceof Timestamp ? ts.toDate().toISOString() : ts ?? null);

function serializar(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    codigo: d.codigo,
    anonimo: d.anonimo,
    nombre: d.nombre,
    telefono: d.telefono,
    correo: d.correo,
    categoria: d.categoria,
    categoriaNombre: CATEGORIAS[d.categoria] ?? d.categoria,
    zona: d.zona,
    direccion: d.direccion,
    referencia: d.referencia,
    descripcion: d.descripcion,
    estado: d.estado,
    estadoNombre: ESTADOS[d.estado] ?? d.estado,
    foto: d.foto ?? null,
    historial: (d.historial ?? []).map((h) => ({ ...h, fecha: aISO(h.fecha) })),
    fechaCreacion: aISO(d.fechaCreacion),
    fechaActualizacion: aISO(d.fechaActualizacion),
  };
}

export async function crearQueja(datos, foto) {
  const ahora = Timestamp.now();
  const ref = quejasCol.doc();
  const codigo = generarCodigo(ahora.toDate());

  const batch = db.batch();
  batch.set(ref, {
    ...datos,
    codigo,
    estado: 'pendiente',
    foto: { mimeType: foto.mimeType, ancho: foto.ancho, alto: foto.alto, bytes: foto.bytes },
    historial: [{ estado: 'pendiente', fecha: ahora, nota: 'Queja registrada por el ciudadano.' }],
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
  });
  batch.set(fotosCol.doc(ref.id), {
    mimeType: foto.mimeType,
    data: foto.buffer.toString('base64'),
    fechaCreacion: ahora,
  });
  await batch.commit();

  return { id: ref.id, codigo, estado: 'pendiente', fechaCreacion: ahora.toDate().toISOString() };
}

/** Lista quejas aplicando filtros en memoria (evita índices compuestos en Firestore). */
export async function listarQuejas({ estado, categoria, zona, q, desde, hasta } = {}) {
  const snap = await quejasCol.orderBy('fechaCreacion', 'desc').limit(1000).get();
  const todas = snap.docs.map(serializar);

  const resumen = {
    total: todas.length,
    porEstado: Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, 0])),
    porCategoria: Object.fromEntries(Object.keys(CATEGORIAS).map((k) => [k, 0])),
    ultimas24h: 0,
  };
  const hace24h = Date.now() - 24 * 60 * 60 * 1000;
  for (const qj of todas) {
    resumen.porEstado[qj.estado] = (resumen.porEstado[qj.estado] ?? 0) + 1;
    resumen.porCategoria[qj.categoria] = (resumen.porCategoria[qj.categoria] ?? 0) + 1;
    if (new Date(qj.fechaCreacion).getTime() >= hace24h) resumen.ultimas24h++;
  }

  const texto = (q || '').trim().toLowerCase();
  const desdeMs = desde ? new Date(`${desde}T00:00:00`).getTime() : null;
  const hastaMs = hasta ? new Date(`${hasta}T23:59:59.999`).getTime() : null;

  const datos = todas.filter((qj) => {
    const fecha = new Date(qj.fechaCreacion).getTime();
    if (estado && qj.estado !== estado) return false;
    if (categoria && qj.categoria !== categoria) return false;
    if (zona && qj.zona !== zona) return false;
    if (desdeMs && fecha < desdeMs) return false;
    if (hastaMs && fecha > hastaMs) return false;
    if (texto) {
      const campos = [qj.codigo, qj.nombre, qj.descripcion, qj.direccion, qj.referencia, qj.zona]
        .join(' ')
        .toLowerCase();
      if (!campos.includes(texto)) return false;
    }
    return true;
  });

  return { datos, resumen };
}

export async function obtenerQueja(id) {
  const doc = await quejasCol.doc(id).get();
  if (!doc.exists) throw new HttpError(404, 'La queja solicitada no existe.');
  return serializar(doc);
}

export async function obtenerFoto(id) {
  const doc = await fotosCol.doc(id).get();
  if (!doc.exists) throw new HttpError(404, 'Esta queja no tiene fotografía asociada.');
  const { mimeType, data } = doc.data();
  return { mimeType, buffer: Buffer.from(data, 'base64') };
}

export async function actualizarEstado(id, { estado, nota }, usuario) {
  const ref = quejasCol.doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new HttpError(404, 'La queja solicitada no existe.');

  const ahora = Timestamp.now();
  await ref.update({
    estado,
    fechaActualizacion: ahora,
    historial: FieldValue.arrayUnion({
      estado,
      fecha: ahora,
      nota: nota || `Estado cambiado a "${ESTADOS[estado]}".`,
      usuario,
    }),
  });
  return serializar(await ref.get());
}

/** Consulta pública: solo expone datos no sensibles. */
export async function consultarPorCodigo(codigo) {
  const snap = await quejasCol.where('codigo', '==', codigo).limit(1).get();
  if (snap.empty) throw new HttpError(404, 'No encontramos una queja con ese código.');
  const q = serializar(snap.docs[0]);
  return {
    codigo: q.codigo,
    categoriaNombre: q.categoriaNombre,
    zona: q.zona,
    estado: q.estado,
    estadoNombre: q.estadoNombre,
    fechaCreacion: q.fechaCreacion,
    fechaActualizacion: q.fechaActualizacion,
    historial: q.historial.map(({ estado, fecha, nota }) => ({
      estado,
      estadoNombre: ESTADOS[estado] ?? estado,
      fecha,
      nota,
    })),
  };
}
