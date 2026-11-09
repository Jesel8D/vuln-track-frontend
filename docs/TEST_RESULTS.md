# Web V1 — resultados del 2026-11-08

Zona de referencia: America/Mexico_City. Evidencia ejecutada, no resultados inferidos
de build. Único repositorio modificado: frontend, rama feat/frontend-web-v1.

## Estado inicial verificado

| Repositorio | Rama                           | Commit                                   |
| ----------- | ------------------------------ | ---------------------------------------- |
| Backend     | feat/mvp-cpe-backend           | 2e12badb7a29d421c72c1faf1cf11de5383d0b1b |
| Database    | feat/mvp-cpe-database          | 80db7fd411f49f648263f275b412384bc49f7ed8 |
| Context     | docs/mvp-context-consolidation | caa7ef13b0e2b24848991e32b3c0ee3fc59139c7 |
| Frontend    | remoto vacío; main sin commits | sin HEAD                                 |

Fetch/ls-remote y árboles limpios comprobados; sin cambios posteriores a las
referencias de la misión. No hubo sobrescritura, merge, rebase ni modificación
de main, Backend, Database, Context, Rudi o V2. No se necesitaron ramas adicionales.

## Stack y diseño

React19.3.1, TypeScript6.0.3, Vite8.3.6, React Router7.18.5, TanStack Query5.107.1,
Tailwind4.3.5, Lucide1.70 y fuentes IBM Plex autoalojadas. Node24.18/npm11.16.
Interface Design original instalada y aplicada desde commit2f9be32, licencia MIT,
mediante instalador oficial Codex, sin ejecutar scripts remotos de terceros.
Detalles y procedencia en DESIGN_SKILL.md y .interface-design/system.md.

Se usan ESLint10 y axe en navegador. El plugin JSX a11y solo admitía ESLint9,
ya deprecado: no se forzó el peer. Overrides limitados a minimatch11.0.1+ en
herramientas ESLint/TypeScript corrigen GHSA-g3hv-75wg-m249; lint/build probados
con esa resolución. npm audit completo y de producción:0 vulnerabilidades
reportadas al verificar; no implica garantía universal de seguridad.

## Verificaciones

| Comprobación                                      | Resultado                                             |
| ------------------------------------------------- | ----------------------------------------------------- |
| Typecheck (app, unitarias, E2E y configuraciones) | Correcto                                              |
| ESLint                                            | Correcto                                              |
| Unitarias/componentes Vitest                      | **29 passed**, tres archivos                          |
| Playwright + FastAPI + PostgreSQL                 | **7 passed**,21.3s                                    |
| Build Vite                                        | Correcto; JS aprox365kB/112kB gzip                    |
| Ruff scripts Python                               | Correcto                                              |
| Normal dev_stack + getpass/provision_user         | Correcto; login/me, registro version null y Vite HTTP |
| Limpieza normal y E2E                             | Servicios propios detenidos; datos tmpfs descartados  |

PostgreSQL16.15 Alpine fijado por digest y puerto localhost efímero. V1 instalado
en clúster nuevo propio; Alembic0001/0002/0003 aplicado con flags explícitos y
catálogos verificados. Runtime SQL sin superusuario y sin URL administrativa en
proceso API. No se actualizó una base persistente ni se aplicó004/V2.

El recorrido de arranque normal se ensayó mediante terminal privado automatizado:
contraseña efímera generada sin salida, getpass real del aprovisionador existente,
login real, /me, registro/consulta y HTTP Vite. Sin cuentas/passwords compartidas.

## Qué prueban los siete recorridos de navegador

1. Ruta privada sin sesión, credenciales incorrectas, mostrar/ocultar contraseña,
   login real, redirección a ruta solicitada, inventario vacío, cuenta y logout.
2. Validación de registro, versión desconocida, detalle, varios candidatos no
   preseleccionados, confirmación, revisión, sustitución y tres eventos históricos.
3. Cero candidatos, fallo NVD, timeout, Retry-After,429 y denegación403 sin conceder permisos.
4. Dos usuarios reales:404 al leer/confirmar activo ajeno; /admin no existe; un
   role=admin en localStorage no concede privilegios ni cambia navegación.
5. Pérdida de respuesta después de persistir: registro y confirmación reintentan
   con la **misma clave**, dejan un solo activo/evento y recuperan la respuesta.
6. Sin tokens en localStorage/sessionStorage, recarga requiere login, expiración
   local según expires_in y401 autenticado limpia sesión/caché.
7. Navegación móvil, teclado, capturas y axe en login/resumen/candidatos/historial.

Los usuarios, JWT y persistencia son reales. **Solo NVD** usa MockTransport con
respuestas oficiales verificadas del Backend, limitado al entrypoint de tests y
al clúster desechable. Escenarios429/403/401 de UI usan respuestas controladas
explícitas en Playwright. Esas respuestas no se presentan como hallazgos reales.
El modo normal no importa dicho entrypoint y consulta NVD real.

E2E usa TTL60s y reloj del navegador para expiración, login100/min y reloj de cuota
NVD virtual para varios recorridos seguidos. No se afirma haber probado en E2E los
límites productivos; Backend MVP-A ya conserva sus pruebas/políticas originales.
Se apagaron traces/HAR/video/storageState para no persistir credenciales.

Durante desarrollo hubo fallos: una fixture reutilizaba un Response consumido,
una importación antigua tras separar AuthContext, navegación esperada incorrecta,
cuota de login de pruebas agotada y capturas prematuras de carga. Se corrigieron
antes de la ejecución final; no se ocultaron fallos ni se declararon exitosas esas
iteraciones. Se corrigió una carrera real que podía sobrescribir el retorno a una
ruta privada después del login.

## Responsive y revisión visual real

Chrome headless del sistema, Playwright1.65, zona America/Mexico_City. En dashboard:

| Ancho viewport | Ancho documento | Desbordamiento horizontal |
| -------------- | --------------- | ------------------------- |
| 375            | 375             | No                        |
| 768            | 768             | No                        |
| 1280           | 1280            | No                        |
| 1440           | 1440            | No                        |

También se comprobó ausencia de desbordamiento en candidatos/historial375px.
Axe sin violaciones reportadas para wcag2a/wcag2aa/wcag21aa en las vistas
escaneadas. Es accesibilidad básica automatizada; no una auditoría exhaustiva con
lectores de pantalla, todos los navegadores o todos los estados posibles.

Capturas efectivas, inspeccionadas después de resolver la carga:

- [Login1440](screenshots/login-1440.png).
- [Dashboard1440](screenshots/dashboard-1440.png).
- [Comparación CPE1280](screenshots/candidates-1280.png).
- [Detalle375](screenshots/detail-375.png).
- [Historial375](screenshots/history-375.png).
- [Mediciones responsive](screenshots/responsive.json).

Los datos/usuarios visibles pertenecen exclusivamente a pruebas desechables y las
respuestas NVD a fixtures documentadas; no hay credenciales publicadas ni cuentas
reutilizables. No son datos de operación o vulnerabilidades simuladas del producto.

## Estado de entrega

| Funcionalidad                                                   | Clasificación                                      |
| --------------------------------------------------------------- | -------------------------------------------------- |
| Login/sesión/logout/protección/401/403                          | IMPLEMENTADA Y PROBADA                             |
| Dashboard real con cobertura explícita                          | IMPLEMENTADA Y PROBADA                             |
| Listado, filtros locales, registro y detalle                    | IMPLEMENTADA Y PROBADA                             |
| Candidatos, confirmación, revisión e historial                  | IMPLEMENTADA Y PROBADA                             |
| Idempotencia de registro/confirmación ante pérdida de respuesta | IMPLEMENTADA Y PROBADA                             |
| Mi cuenta y navegación responsive                               | IMPLEMENTADA Y PROBADA                             |
| Accesibilidad básica automatizada                               | IMPLEMENTADA Y PROBADA                             |
| Auditoría exhaustiva de accesibilidad/múltiples navegadores     | PENDIENTE                                          |
| RBAC/admin                                                      | PENDIENTE; no hay soporte backend ni vistas falsas |
| Hosting de producción, API HTTPS y base persistente             | PENDIENTE; alcance local de esta misión            |
| CVE/aplicabilidad/seguimiento MVP-B                             | PENDIENTE; no iniciado                             |

Sesión/drafts solo en memoria. Recarga pierde sesión y un intento incierto requiere
reconciliar inventario/historial antes de una intención nueva. Logout no revoca JWT.
Cuota NVD normal sigue siendo por proceso/instancia del Backend MVP-A; no escalar
sin presupuesto compartido. Ratificación Rudi/global continúa PENDIENTE.

Commits/push normal y hash remoto se verifican en el informe final del chat para
no introducir autorreferencias imposibles. Instalación y cuenta privada: README.md.
