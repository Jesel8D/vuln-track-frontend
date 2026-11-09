# Contrato integrado Web V1

Referencia comprobada: Backend2e12badb7a29d421c72c1faf1cf11de5383d0b1b.
Se inspeccionaron rutas/Pydantic/ORM/JWT/ownership y OpenAPI servido por FastAPI
contra PostgreSQL real. Context es anterior a MVP-A: version nullable y CPE ya
funcionan; esa diferencia se documenta sin reescribir sus decisiones.

| Operación                                    | Entrada y respuesta efectiva                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| POST /api/v1/auth/login                      | username ASCII minúsculas1–80 y password1–256; access_token/token_type/expires_in |
| GET /api/v1/auth/me                          | Bearer; solo id/username, sin role                                                |
| GET /api/v1/assets                           | limit1–100/offset0–1000000; items y page(limit/offset/total)                      |
| POST /api/v1/assets                          | Idempotency-Key UUID;201 Asset, Location                                          |
| GET /api/v1/assets/{id}                      | Asset propio;404 para ajeno/inexistente/sin dueño                                 |
| GET /api/v1/cpe-candidates                   | query2–200, limit10/offset0–10000; items/page/source_timestamp                    |
| POST /api/v1/assets/{id}/cpe-identifications | Idempotency-Key UUID;201 evento inmutable                                         |
| GET /api/v1/assets/{id}/cpe-identifications  | scope=current/history, limit20/offset; current_state/items/page                   |
| GET /health                                  | Solo disponibilidad API; no se presenta como seguridad del sistema                |

Registro: device_type1–80, manufacturer/model/site_label1–120 requeridos;
version1–120 o null, inventory_label1–120 o null, notes1–1000 o null. NFC/trim,
texto estricto, controles prohibidos y extras rechazados. No hay display_name,
owner ni credenciales en body. Nombres de UI se derivan de manufacturer/model.
La UI limita categorías a router/switch/server, pero muestra tipos históricos
libres devueltos por API.

Confirmación: state=confirmed, cpe_name_id UUID, component_kind=hardware/firmware/
os/software, expected_current_id obligatorio (null para primera), reason1–500.
Revisión: state=needs_review, expected_current_id y reason; prohíbe identidad
entrante. Solo confirmed puede pasar a needs_review. Nueva confirmación puede
sustituir confirmed o needs_review. Nunca se preselecciona un candidato.

POST responde id/asset_id/state/CPE/component/observed_version/source/validated_at/
recorded_by/recorded_at/reason/replaces_id. GET añade valid_to/is_current. Estado
pending es ausencia de evento. Revisión muestra su fecha como revisión, no como
nueva confirmación. Historial se pagina cronológicamente sin modificar snapshots.

Cliente HTTP central: origen configurable validado, Bearer en memoria, JSON,
Idempotency-Key, AbortController, timeout30s, no cookies/redirects ni retry automático.
401 invalida solo la sesión cuyo token salió en la petición (un401 antiguo no
invalida una sesión nueva);403 conserva identidad y muestra denegación. Errores
502/503/504 de NVD,429 y Retry-After se distinguen de200 sin resultados.409 conserva
semántica de concurrencia/idempotencia; no se informa éxito hasta recibir201.
Error normalizado con code/request_id; no se muestran mensajes externos en bruto.

TanStack Query usa claves por usuario/activo/página, cancela lecturas desmontadas,
limpia caché al salir e invalida tras mutaciones. NVD solo se busca al pulsar Buscar,
sin refetch al enfocar ventana ni consultas automáticas. Los candidatos son
catálogo público consultado por FastAPI; la UI nunca llama directamente a NVD.

Dashboard: page.total es el total real de inventario. Tipos corresponden a los
primeros20 activos; CPE a una muestra máxima5 con conteo de estados consultados.
Inventario consulta10 activos/página y su estado CPE; no implica agregación global.
Los errores de estado no se cuentan como pendientes. No existen métricas CVE.

Sin API administrativa, signup, refresh, revocación, edición/eliminación de activo,
cambio de contraseña, CVE o seguimiento. Las vistas y acciones correspondientes
no se muestran como funcionalidades disponibles.
