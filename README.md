# VulnTrack · Web V1

Aplicación React para el Backend MVP-A real: iniciar sesión → inventario → registro
→ candidatos CPE → confirmación humana → historial. Sin CVE ficticias ni login demo.

## Requisitos

- Node ≥22.12 (validado con24.18), npm y Chrome/Chromium para pruebas de navegador.
- Docker disponible. PostgreSQL16.15 Alpine fijado por digest en el runner.
- Repositorios hermanos `backend` en MVP-A2e12bad y `database` en MVP-A80db7fd.
- Python3.12 y entorno backend con sus dependencias instaladas.

En una recuperación nueva:

```bash
cd ../backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.lock
.venv/bin/python -m pip install --no-deps -e .
cd ../frontend
npm ci
```

## Abrir y utilizar la aplicación

Desde frontend:

```bash
../backend/.venv/bin/python scripts/dev_stack.py --username tu_usuario --api-port 8000 --web-port 5173
```

Elige un nombre ASCII en minúsculas propio (no una cuenta compartida). El script
pide tu contraseña dos veces mediante **getpass**, usando el aprovisionador real
`backend/scripts/provision_user.py`. No hay contraseña publicada ni administrador
obligatorio. La cuenta seed demo_operator continúa inactiva y no se utiliza.

Abre **http://127.0.0.1:5173** e inicia sesión con esa cuenta. FastAPI queda en
http://127.0.0.1:8000. Si los puertos están ocupados, el script se detiene sin tocar
el servicio existente. Puedes omitir ambos flags para obtener puertos libres;
las URLs exactas se imprimen cuando los servicios están listos.

El runner crea **únicamente su propio PostgreSQL desechable**, con PGDATA tmpfs y
puerto localhost efímero; aplica V1, privilegios y Alembic0001→0002→0003, crea un
login SQL mínimo y configura CORS para el origen Vite exacto. FastAPI no recibe la
URL administrativa de migración y Vite no recibe secretos de base/token/NVD.

**Ctrl+C detiene los servicios propios y descarta todos los datos de esta sesión.**
No es una instalación persistente ni un respaldo. No reutiliza bases existentes,
no borra volúmenes ajenos y no aplica Database V2. El modo normal consulta NVD real;
puede recibir cuotas o errores externos. NVD_API_KEY opcional queda solo en backend.

### Usar un FastAPI de pruebas ya preparado

`.env.example` contiene solo VITE_API_URL, un origen público. Puedes crear `.env`
local (ignorado) o pasar la variable al proceso:

```bash
VITE_API_URL=http://127.0.0.1:8000 npm run dev -- --port 5173
```

Configura ese backend con `CORS_ORIGINS=["http://127.0.0.1:5173"]`; localhost y
127.0.0.1 son orígenes distintos. Nunca pongas claves, passwords o JWT en variables
VITE_: son públicas. La API remota requiere HTTPS; HTTP solo se acepta en loopback.

## Funcionalidad

- Login real y GET /auth/me antes de habilitar vistas privadas.
- Sesión solo en memoria, expiración/401, logout y caché separada por usuario.
- Dashboard con total de API y muestras de tipos/identificación rotuladas.
- Inventario paginado, filtro **local de esta página** y detalle por propietario.
- Registro con versión opcional/null, validación e idempotencia.
- Candidatos oficiales, elección explícita, componente/motivo y revalidación backend.
- Revisión, sustitución, historial inmutable y consulta del evento actual.
- Mi cuenta muestra únicamente id/username. No hay edición o registro público.
- Navegación responsive, estados vacíos/carga/error y página no encontrada.

La interfaz no implementa RBAC ni administra usuarios: el backend no tiene role,
permisos administrativos ni endpoints para ello. Un valor admin en localStorage
no concede acceso. Ver [auditoría](docs/AUTH_AUDIT.md).

### Sesión e intentos inciertos

Recargar, cerrar o abrir otra pestaña requiere login. No hay refresh improvisado,
cookies, tokens en URL/almacenamiento ni decodificación de claims para autorizar.
Logout limpia esta ventana; **no revoca** el JWT servidor.

Registro y confirmación mantienen clave y cuerpo del intento si se pierde una
respuesta. Los datos quedan bloqueados para reintentar la misma operación y evitar
duplicados. Al abandonar/recargar se pierde ese estado en memoria: revisa primero
inventario/historial antes de crear una nueva intención. No hay persistencia offline.

## Diseño

React19, TypeScript6, Vite8, React Router7, TanStack Query5, Tailwind4 y Lucide.
IBM Plex Sans/Mono autoalojadas, con licencias en public/licenses. Sistema visual
azul de rack/turquesa y cadena activo→catálogo→confirmación→historial.

Se aplicó la skill real [Interface Design](https://github.com/Dammyjay93/interface-design),
MIT, commit2f9be3206855bcb2d1d0af262c8bae25cba6658d. Instalación mediante el instalador
oficial de skills Codex después de revisar SKILL.md, licencia y agentes; sin
scripts remotos de terceros. [Decisiones visuales](.interface-design/system.md).
Sites se usó como guía de trabajo local; esta entrega se publica en GitHub y no
crea hosting externo para una API que funciona en la PC local.

## Pruebas

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit
../backend/.venv/bin/python scripts/dev_stack.py --e2e
```

El último comando genera credenciales temporales únicamente en memoria, ejecuta
FastAPI/JWT/propiedad/PostgreSQL reales y abre Chrome con Playwright. Solo NVD usa
MockTransport con las fixtures verificadas del backend. No hay endpoints de prueba
ni transporte NVD simulado en la aplicación normal. Un guard exige clúster/nombre
controlados. E2E configura login100/min, TTL60s y reloj NVD virtual para reproducir
varios recorridos sin bloquearse por cuotas; no altera parámetros normales.

Chrome predeterminado: /usr/bin/google-chrome. Para otra instalación local,
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/chromium` al ejecutar el runner. También puede
instalarse Chromium de Playwright y pasar su ruta; no se instala globalmente.
Capturas locales reproducibles en test-results/visual (ignorado). No se guardan
storageState, HAR, traces, contraseñas ni tokens en artefactos.

Resultados y capturas inspeccionadas: [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md).
Contratos/tipos: [docs/API.md](docs/API.md), src/types/api.ts y OpenAPI real de FastAPI.

## Build y siguiente etapa

`npm run build` genera dist. Para una publicación futura, el host debe servir las
rutas SPA con fallback a index.html, HTTPS y cabeceras/CSP adecuadas, y apuntar a
una API HTTPS operativa con CORS explícito. No se sustituye FastAPI por hosting de
archivos ni se publican datos de una base local.

MVP-B (consulta CVE, aplicabilidad, evidencia y seguimiento) y RBAC administrativo
con permisos concretos quedan PENDIENTES. No hay backend/database modificados ni
ramas extra para esos repositorios; main/rudi/V2/Context permanecen intactos.
