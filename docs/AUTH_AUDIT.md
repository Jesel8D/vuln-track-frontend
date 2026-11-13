# Auditoría previa — Web V1

Antecedente conservado: la rama actual añade [registro público controlado V2](SELF_SERVICE_REGISTRATION.md).
No introduce otro login, roles globales ni almacenamiento persistente de tokens.
La ausencia de registro descrita abajo corresponde a la revisión original MVP-A.

Repositorios limpios, remotos SSH oficiales y hashes MVP-A sin cambios posteriores
al recuperar: Backend2e12bad, Database80db7fd, Contextcaa7ef1. Frontend sin commits.
Solo se crea feat/frontend-web-v1. No hacen falta cambios Backend/Database.

POST /api/v1/auth/login: username ASCII minúsculas1–80 y password1–256. Devuelve
access_token, token_type=bearer, expires_in (default/máximo900s). JWT HS256 firmado,
issuer/audience/exp/sub/jti/ver comprobados. User activo y versión de cuenta validada
por petición. GET /api/v1/auth/me solo id/username. No role ni RBAC ni admin.

Propiedad por assets.created_by; ajeno/inexistente/sin dueño devuelve404. No hay
bypass administrativo. Seeds inactivos. scripts/provision_user.py permite crear
cuenta nueva mediante URL de mantenimiento privada y getpass; no activa existentes.
No endpoint público de registro, refresh, revocación ni edición de perfil/contraseña.

Decisión: no añadir role sin permisos administrativos concretos. Vistas autenticadas
personales; /admin no existe. RBAC queda PROPUESTA: rol user por defecto y permisos
explícitos verificados en API/migración aditiva antes de una función administrativa
real, nunca acceso global a inventario. Rudi PENDIENTE; Context intacto.

Sesión Bearer solo en memoria, identidad validada en /me antes de entrar. Recargar
requiere login. Expiración local según expires_in y401 de API limpian sesión/caché.
Logout local no revoca JWT servidor.403 muestra denegación sin promover privilegios.
XSS sigue siendo riesgo para tokens en memoria: sin HTML externo, sin tokens en URL,
logs o almacenamiento; despliegue HTTPS/CSP requerirá revisión propia.

La documentación Context es anterior a MVP-A: afirma que version=null falla y que
CPE no está implementado. Código/OpenAPI/fixtures de Backend2e12bad son la referencia
técnica efectiva; no se reescriben aprobaciones históricas ni contratos de Context.

Métricas: total del inventario viene de page.total, nunca items.length. Tipos solo
de la página obtenida; estados CPE solo de una muestra explícitamente rotulada.
Sin CVE/severidades/actividad global inferidos. Búsqueda local identificada por página.
