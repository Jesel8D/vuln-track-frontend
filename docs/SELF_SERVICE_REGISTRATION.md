# Crear cuenta con la API V2 real

Base: `rudi` `6cbdb0bc7424635d8d594467b413c303f91aa75a`; rama de revisión
`feat/v2-registration-web`. Se conserva el diseño, navegación y sesión en memoria.
Backend requerido: `feat/v2-self-service-registration`; Database:
`feat/v2-registration-database`, SQL001/002/004/005/006 y Alembic backend0004.
No usar el launcher MVP-B antiguo para validar este flujo V2.

## Vistas y contrato

`/login` enlaza a **Crear cuenta**, ruta pública `/crear-cuenta`.
Usuario ASCII3–80 (se envía minúsculo), contraseña15–128 y confirmación local.
El formulario permite mostrar/ocultar ambas contraseñas, expone sus requisitos,
asocia labels/hints y bloquea doble envío. No persiste confirmación ni contraseñas.

El cliente HTTP existente envía exclusivamente username/password a
`POST /api/v1/auth/register`, sin Bearer, cookies, rol ni workspace_id. Valida que
el cuerpo de éxito contenga solo UUID/id y username esperado. Solo después de la
confirmación muestra “Cuenta creada” y el enlace al login; no inventa sesión.
Errores422/409/429/503 se presentan con mensajes controlados y Retry-After.
Al terminar un intento se vacían contraseñas; no se reintenta automáticamente.
Ante respuesta perdida, intentar login antes de repetir el registro.

El login existente obtiene JWT, verifica `/api/v1/auth/me` y habilita rutas
privadas. `GET /api/v2/workspaces` devuelve el workspace personal creado
transaccionalmente en el servidor. El selector solo muestra el directorio
autorizado; modificarlo en el navegador no concede acceso en PostgreSQL.
Las cachés incluyen usuario/workspace y se limpian al cerrar sesión/expirar.
No se guardan roles ni tokens en localStorage/sessionStorage; logout local no
revoca un JWT servidor, que caduca como máximo a los900s.

El dashboard recién creado muestra conteos cero recibidos de la API; aplicaciones,
tecnologías e historial tienen estados vacíos. Se corrigió el historial global
vacío que antes mostraba erróneamente “Aplicación no disponible”. Registrar una
aplicación y añadir tecnología utilizan las rutas V2 existentes. No se inventan
CVE/recomendaciones, ni se habilita ningún análisis ZAP. Su botón sigue disabled.
El inventario de dispositivos MVP conserva su implementación histórica, pero no
es la navegación principal de rudi; no se resuelve esa decisión de alcance aquí.

## Probar desde Ubuntu/Kubuntu

Clonar/recuperar los tres repositorios como directorios hermanos `vuln-track-backend`,
`vuln-track-database` y `vuln-track-frontend`, con las ramas coordinadas anteriores.
Requisitos: Python3.12, Node>=22.12, npm, Docker funcional y Chromium para E2E.

Desde Backend:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.lock
.venv/bin/python -m pip install --no-deps -e .
```

Desde Frontend:

```bash
npm ci
../vuln-track-backend/.venv/bin/python scripts/v2_registration_stack.py --api-port 8000 --web-port 5173
```

Abrir `http://127.0.0.1:5173/crear-cuenta`, elegir usuario/frase propios, confirmar
creación, iniciar sesión, comprobar workspace personal y dashboard vacío. Registrar
una aplicación, abrirla y comprobar el estado sin tecnologías; cerrar sesión.
Una segunda cuenta no verá aplicaciones ni workspace de la primera.

**El launcher crea PostgreSQL nuevo en tmpfs y Ctrl+C descarta esos datos**.
No sirve para conservar el trabajo del equipo ni conecta con bases existentes.
La persistencia real requiere la instalación administrada y respaldada descrita
por Database; el registro no borra información por login/logout.
No solicita acceso SQL ni aprovisionamiento manual de cada usuario.

Si se eligen otros nombres de carpetas, definir `VULNTRACK_BACKEND_PATH` y
`DATABASE_V2_PATH`; los scripts no dependen de rutas de computadoras del equipo.
Puertos ocupados se rechazan; `--api-port 0 --web-port 0` selecciona puertos libres.

Para una API revisada ya existente:

```bash
VITE_API_URL=http://127.0.0.1:8000 npm run dev -- --port 5173
```

Backend debe habilitar registro, tener el rol de inscripción y configurar
`CORS_ORIGINS=["http://127.0.0.1:5173"]`. localhost y127.0.0.1 son orígenes distintos.
VITE_API_URL es pública: nunca poner secretos SQL, HMAC, JWT o NVD en VITE_*.
API remota requiere HTTPS. En producción hacen falta CSP/HTTPS, protección de
abuso compartida y revisión de despliegue; no se afirma preparación de producción.

## Pruebas

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium ../vuln-track-backend/.venv/bin/python scripts/v2_registration_stack.py --e2e --api-port 0 --web-port 0
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium ../vuln-track-backend/.venv/bin/python scripts/v2_registration_stack.py --e2e --installation new --api-port 0 --web-port 0
```

En Kubuntu, si Chromium tiene otra ruta, usar su ejecutable real. Se puede instalar
el navegador oficial de Playwright y proporcionar su ruta; no desactivar TLS para
descargarlo. No es necesario consultar NVD para estos recorridos.

El perfil `v2-registration` selecciona cinco casos de `registration.spec.ts`:
registro/login/logout, validaciones/duplicado, aislamiento A/B y caché, formulario
responsive/accessibilidad axe, y429 real. Se prueban React/FastAPI/JWT/RLS/PostgreSQL
sin interceptar las respuestas de autenticación. El launcher aumenta la cuota por
IP a10/min solo en E2E; el parámetro normal sigue3/min. No hay endpoints de prueba.
No se guardan HAR, traces, videos, passwords ni tokens. La captura de formulario
vacío no contiene datos de cuentas.

Los E2E MVP `web.spec.ts`/`z-cve.spec.ts` se conservan sin modificar; corresponden
a rutas antiguas y no se presentan como ejecutados para esta interfaz V2.
Resultados exactos: `docs/SELF_SERVICE_REGISTRATION_RESULTS.md`.

## Pendientes

No existe email verificado ni recuperación/cambio de contraseña autoservicio.
No hay refresh ni revocación individual; no crear roles administrativos locales.
Demo anónima solo evaluada: una futura experiencia de fixtures públicos aislados,
sin guardar workspaces ni consultar NVD/ejecutar análisis. No está activada.
