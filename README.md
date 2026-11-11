# VulnTrack · Web MVP-B

## Estado de la rama `rudi`

La interfaz principal en esta rama se está migrando a Database V2: workspaces,
aplicaciones web y tecnologías. El Dashboard, inventario, búsqueda/confirmación
CPE y consultas CVE con evidencia ya consumen las rutas `/api/v2` del backend.
La guía del alcance actual está en
[`docs/V2_WORKSPACE_UI.md`](docs/V2_WORKSPACE_UI.md). El resto de este README
describe el MVP-B de activos/dispositivos como antecedente; no es el contrato de
la interfaz V2.

Aplicación React conectada a FastAPI: login → inventario → CPE confirmado →
consulta NVD → CVE/evidencia → revisión humana → historial. Los estados y
resultados provienen del backend real; la correlación no confirma vulnerabilidad.

[Contrato e integración MVP-B](docs/MVP_B_WEB.md) ·
[Resultados nuevos y capturas](docs/MVP_B_WEB_RESULTS.md).
El [informe Web V1](docs/TEST_RESULTS.md) se conserva como antecedente.

## Requisitos

- Node ≥22.12 (validado con24.18), npm y Chrome/Chromium para pruebas de navegador.
- Docker disponible. PostgreSQL16.15 Alpine fijado por digest en el runner.
- Repositorios hermanos: Backend MVP-B `7126a16` y Database MVP-B `e39dd35`
  (ramas `feat/mvp-b-nvd-cve-backend` / `feat/mvp-b-nvd-cve-database`).
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
puerto localhost efímero; aplica V1, privilegios y Alembic0001→0002→0003→0004, crea un
login SQL mínimo y configura CORS para el origen Vite exacto. FastAPI no recibe la
URL administrativa de migración y Vite no recibe secretos de base/token/NVD.

**Ctrl+C detiene los servicios propios y descarta todos los datos de esta sesión.**
El worker CVE corre dentro del único proceso FastAPI (`--workers 1`,
`CVE_WORKER_ENABLED=true`). No hay que iniciar otro worker. Su arranque aplica
un enfriamiento NVD mínimo de 60 s compartido con CPE.

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
- Consulta CVE explícita e idempotente desde el detalle del activo.
- Historial paginado de análisis, snapshot CPE y progreso con polling acotado.
- Resultados completos/parciales/fallidos, CVE, métricas CVSS versionadas y evidencia.
- Revisión única con motivo/evidencia y timestamp esperado; conflicto/pérdida de respuesta se reconcilian por GET.
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
duplicados. En el nuevo inicio de análisis, el intento incierto sobrevive cambios
de ruta en esta sesión; logout/expiración lo limpian. Al recargar se pierde la
sesión y ese estado en memoria: revisa primero
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
Capturas locales reproducibles en test-results/visual y test-results/cve-visual
(ignorados). Una selección inspeccionada se conserva en docs/screenshots/mvp-b. No se guardan
storageState, HAR, traces, contraseñas ni tokens en artefactos.

Resultados actuales: [MVP_B_WEB_RESULTS.md](docs/MVP_B_WEB_RESULTS.md).
Resultados históricos Web V1: [TEST_RESULTS.md](docs/TEST_RESULTS.md).
Contratos/tipos: [docs/API.md](docs/API.md), src/types/api.ts y OpenAPI real de FastAPI.

## Build y siguiente etapa

`npm run build` genera dist. Para una publicación futura, el host debe servir las
rutas SPA con fallback a index.html, HTTPS y cabeceras/CSP adecuadas, y apuntar a
una API HTTPS operativa con CORS explícito. No se sustituye FastAPI por hosting de
archivos ni se publican datos de una base local.

MVP-B Web implementa consulta, evidencia y revisión según el contrato existente.
Persistencia local de desarrollo, RBAC/admin y preparación de producción quedan
pendientes. Esta misión solo modifica Frontend; Backend/Database/main/rudi/V2/Context
permanecen intactos. No hay totales globales CVE: el backend ofrece consultas por activo.
