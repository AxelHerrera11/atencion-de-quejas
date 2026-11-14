# Sistema de Atención de Quejas Ciudadanas

Examen final — Desarrollo y Diseño Web (Series I y II).

Un ciudadano registra una queja con fotografía desde el **portal público**; la información viaja a una **API REST** (Node.js + Express), se guarda en **Firebase Firestore** (capa gratuita) y el personal municipal la revisa desde el **Panel de Administración**.

```
Ciudadano ➜ Frontend (fetch) ➜ Backend/API ➜ Firestore ➜ Backend/API ➜ Panel de Administración
```

## Demo en línea

| | URL |
|---|---|
| Portal ciudadano | <https://atencion-quejas.onrender.com> |
| Panel municipal | <https://atencion-quejas.onrender.com/admin.html> |
| API | <https://atencion-quejas-api.onrender.com/api/health> |

**Credenciales de prueba del panel**

- Usuario: `admin`
- Contraseña: `Z8lvtSNIQUFJ`

> Credenciales publicadas solo con fines de evaluación académica.
> La primera carga puede tardar ~1 minuto mientras el servidor gratuito de Render se activa.

## Estructura

```
├── frontend/              Sitio estático (HTML, CSS, JS con fetch)
│   ├── index.html         A. Portal público de atención ciudadana
│   ├── admin.html         B. Panel de Administración Municipal
│   ├── css/styles.css
│   └── js/
│       ├── config.js      URL del backend
│       ├── api.js         Cliente REST (fetch, token, manejo de errores)
│       ├── utilidades.js
│       ├── portal.js
│       └── admin.js
├── backend/               API REST
│   └── src/
│       ├── server.js / app.js
│       ├── config/        Variables de entorno y Firebase Admin
│       ├── routes/        Definición de endpoints
│       ├── controllers/   Lógica HTTP
│       ├── services/      Acceso a Firestore
│       ├── middlewares/   Auth JWT, subida de foto, errores
│       └── utils/         Validaciones, catálogos, compresión de imagen
└── render.yaml            Despliegue en Render (backend + frontend)
```

## Funcionalidades

**Portal ciudadano**
- Formulario por pasos: datos de contacto (u opción anónima), categoría, ubicación, descripción y fotografía.
- Validación en el navegador y en el servidor, con mensajes por campo.
- Compresión de la foto en el navegador antes de subirla (arrastrar o tomar con la cámara).
- Confirmación con **código de seguimiento** (ej. `Q-20261114-AB12C`).
- Consulta pública del estado e historial de la queja.

**Panel municipal** (protegido con usuario/contraseña → token JWT)
- Indicadores por estado (clic para filtrar) y distribución por categoría.
- Búsqueda por texto y filtros por estado, categoría, zona y rango de fechas.
- Detalle con la descripción original, fotografía (ampliable), ubicación y datos del ciudadano.
- Cambio de estado (Pendiente → En proceso → Resuelta / Rechazada) con nota e historial.

## API REST

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/health` | Público | Estado del servicio |
| GET | `/api/quejas/catalogos` | Público | Categorías, zonas y estados |
| POST | `/api/quejas` | Público | Registra una queja (`multipart/form-data` con `foto`) |
| GET | `/api/quejas/seguimiento/:codigo` | Público | Estado e historial (sin datos personales) |
| POST | `/api/auth/login` | Público | `{ usuario, contrasena }` → `{ token }` |
| GET | `/api/quejas?estado=&categoria=&zona=&q=&desde=&hasta=` | Admin | Listado + resumen/indicadores |
| GET | `/api/quejas/:id` | Admin | Detalle de la queja |
| GET | `/api/quejas/:id/foto` | Admin | Fotografía (imagen JPEG) |
| PATCH | `/api/quejas/:id/estado` | Admin | `{ estado, nota }` |

Las rutas de administración requieren `Authorization: Bearer <token>`. Los errores responden con `{ ok: false, mensaje, errores? }` y el código HTTP correspondiente (400, 401, 404, 413, 429, 500).

## Modelo de datos (Firestore)

- **`quejas/{id}`**: `codigo`, `anonimo`, `nombre`, `telefono`, `correo`, `categoria`, `zona`, `direccion`, `referencia`, `descripcion`, `estado`, `foto { mimeType, ancho, alto, bytes }`, `historial[] { estado, fecha, nota, usuario }`, `fechaCreacion`, `fechaActualizacion`.
- **`quejas_fotos/{id}`**: `mimeType`, `data` (base64), `fechaCreacion`.

> La fotografía se guarda en Firestore (comprimida a JPEG ≤ 850 KB con `sharp`) porque Cloud Storage para Firebase ya no está disponible en el plan gratuito Spark para proyectos nuevos. Se separa en otra colección para que el listado sea liviano.

## Seguridad
- Credenciales de Firebase, usuario/contraseña del panel y secreto JWT **solo en variables de entorno** (`.env` está en `.gitignore`).
- Firestore se usa únicamente desde el backend con Firebase Admin SDK; las reglas de Firestore pueden quedar en modo bloqueado.
- `helmet`, CORS restringido al dominio del frontend, límite de peticiones (envío de quejas y login), validación de tipo/tamaño de imagen y escape de HTML en el frontend (previene XSS).

## Configurar Firebase

1. Entra a <https://console.firebase.google.com> → **Crear proyecto**.
2. **Compilación → Firestore Database → Crear base de datos** → modo **producción** → ubicación (ej. `us-central1`).
3. **⚙️ Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Se descarga un `.json` (no lo subas a GitHub).
4. Convierte el JSON a base64 (una sola línea):
   ```bash
   base64 -i ruta/al/archivo.json | tr -d '\n'
   ```

## Ejecutar en local

```bash
# Backend
cd backend
cp .env.example .env      # completa los valores
npm install
npm run dev               # http://localhost:3000

# Frontend (en otra terminal) — debe servirse por HTTP, no abriendo el archivo
npx serve frontend -l 5500   # o la extensión "Live Server" de VS Code
```

Abre <http://localhost:5500> (portal) y <http://localhost:5500/admin.html> (panel).

## Despliegue en Render

1. Sube el repositorio a GitHub.
2. En <https://dashboard.render.com> → **New → Blueprint** → selecciona el repositorio. Render lee `render.yaml` y crea dos servicios.
3. Completa las variables que pide:
   - `ADMIN_PASSWORD`: contraseña del panel.
   - `FIREBASE_SERVICE_ACCOUNT_BASE64`: el base64 del paso anterior.
   - `CORS_ORIGINS`: `https://atencion-quejas.onrender.com` (URL del frontend).
   - `API_URL`: `https://atencion-quejas-api.onrender.com` (URL del backend).
4. Si Render asigna URLs distintas, actualiza `CORS_ORIGINS` y `API_URL` con las reales y vuelve a desplegar.

> En el plan gratuito el backend se "duerme" tras 15 min sin uso; la primera petición puede tardar ~1 minuto. El frontend muestra un aviso mientras despierta.
