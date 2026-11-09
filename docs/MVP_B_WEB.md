# MVP-B Web — consultas CVE, evidencia y revisión

Misión de Jesel, 8–9 de noviembre de 2026 (America/Mexico_City). Rama
`feat/frontend-mvp-b-cve`, basada en Web V1 `2643467864c54226043d43efa5859d38c332ab92`.
Backend `7126a161040062b6f0f992c65faf8db07d326464` y Database
`e39dd357b28e33912ad062efc813244c62f3eb4b` se consumen sin modificaciones.
Ratificación de Rudi y preparación de producción permanecen pendientes. No se
alteran Context, decisiones D-001/D-002, main ni Database V2.

## Recorrido y navegación

Login real → Mis activos → Detalle → CPE confirmado → Consultar CVE →
confirmación explícita → ejecución/progreso → CVE → evidencia → revisión → historial.

| Vista                      | Ruta web                                                 | Comportamiento                                                      |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Detalle de activo ampliado | `/activos/:assetId`                                      | Identidad actual, última ejecución, acción y enlace al historial    |
| Historial por activo       | `/activos/:assetId/analisis`                             | Inicio y ejecuciones paginadas; CPE histórico conservado            |
| Ejecución                  | `/activos/:assetId/analisis/:runId`                      | Estado, progreso, cobertura, fechas, snapshot y hallazgos paginados |
| Hallazgo                   | `/activos/:assetId/analisis/:runId/hallazgos/:findingId` | CVE, métricas, evidencia, revisión y trazabilidad                   |

No hay página global de CVE: FastAPI no ofrece ese endpoint. La navegación se
organiza por activo, con retornos al historial y los resultados. El dashboard
mantiene sus métricas de inventario/muestras y añade solo orientación textual;
no calcula totales globales CVE ni hace N+1 para tarjetas decorativas.

Sin identificación actual confirmed, la consulta se deshabilita y ofrece el
acceso a CPE. Versión desconocida y hardware tienen explicación específica.
Los casos restantes son validados por el backend: no se concatena un CPE ni se
acepta uno arbitrario. Confirmar identidad no acredita presencia ni vulnerabilidad.

## Diseño conservado

Se aplicó la skill instalada [Interface Design](https://github.com/Dammyjay93/interface-design),
commit `2f9be3206855bcb2d1d0af262c8bae25cba6658d`, sin reinstalarla. Se conservan
rack/panel/raised/inset, turquesa, IBM Plex Sans/Mono, sidebar, controles de 44px,
espaciado base 4px y Lucide. La firma se amplía a identidad → consulta fechada →
evidencia → decisión humana. [Intención y checkpoints](../.interface-design/mvp-b.md).
Sites se consultó como guía local; no se crea hosting externo para una API local.

Componentes nuevos: AnalysisSection, RunStatus/CoverageNotice, FindingsTable,
Metrics, SourceDescription y ReviewForm. Se reutilizan Button, TextField,
PageHeading, ErrorPanel, Loading, Empty y Pagination. Tablas se presentan como
filas en escritorio y bloques legibles en móvil. Los estados tienen texto e
iconos; el color no es su única señal. No hay gráficos o porcentajes inventados.

## Contrato HTTP real

Verificados `backend/app/schemas/analyses.py`, rutas y pruebas, y OpenAPI del
servidor real durante el launcher. Todos requieren Bearer, usuario activo y
propiedad de activo. Se amplía ApiClient, sin otra infraestructura HTTP.

| Método/ruta bajo `/api/v1`                 | Entrada                                      | Salida                             |
| ------------------------------------------ | -------------------------------------------- | ---------------------------------- |
| POST `/assets/{id}/analyses`               | `{identification_id}` + Idempotency-Key UUID | 202 `{id,accepted_at}`             |
| GET `/assets/{id}/analyses`                | limit/offset                                 | items de AnalysisRead + page       |
| GET `/assets/{id}/analyses/{run}`          | —                                            | AnalysisRead                       |
| GET `/assets/{id}/analyses/{run}/findings` | limit=20/offset                              | items + page + run_status/coverage |
| GET `/findings/{id}`                       | —                                            | FindingRead                        |
| PATCH `/findings/{id}`                     | ReviewInput plano                            | FindingRead actualizado            |

Las rutas web en español no son rutas API adicionales. Los IDs y parámetros se
codifican. `AnalysisProgress` y `FindingReview` son agrupaciones TypeScript de
campos del esquema, no objetos nuevos enviados al servidor.

Los tipos de ejecución incluyen identificación/CPE/versión congelados, actor,
fechas, total_results, retrieved_count, stored_count, page_count, next_index,
retry_count, query_parameters, warning_codes, source_timestamps, page_manifest,
failure_code y nvd_cooldown_until. Los hallazgos conservan external_id/source,
title, applicability/status, cvss/evidence y campos de revisión.

Los seis métodos validan JSON de respuesta en runtime: enums exactos, UUID/CVE,
fechas, contadores y paginación. Un HTTP 200 con estado desconocido produce
INVALID_RESPONSE; no se convierte en un estado válido ni mantiene un bucle de
polling. cvss/evidence son objetos de origen con campos opcionales, interpretados
con comprobaciones de tipos y renderizados como texto seguro.

No se detectó bloqueo ni incompatibilidad que exigiera cambiar Backend/Database.
La documentación histórica que aún llama pendiente a CVE se conserva como
antecedente; el contrato de esta entrega usa las rutas/Pydantic MVP-B reales.

## Inicio e idempotencia

El usuario revisa CPE/versión y confirma explícitamente antes del POST. Un guard
de envío evita doble clic; además se conserva clave UUID y cuerpo del intento.
Si la aceptación es incierta por red/timeout/5xx/respuesta inválida, el formulario
bloquea otra intención y ofrece repetir exactamente la misma solicitud.

El intento CVE se conserva en memoria por usuario/activo incluso al cambiar de
ruta, y se limpia tras aceptación, logout o expiración. No hay almacenamiento
persistente. Tras recargar y volver a entrar, consultar historial antes de otra
intención. Un intento aceptado puede haber terminado aunque no se haya visto
su respuesta; el backend conserva el replay estable.

401 usa la limpieza de sesión existente; 403/404 se presentan sin conceder
privilegios. 409 identificación/ejecución activa actualiza identidad e historial;
429 respeta Retry-After mediante useCooldown. IDEMPOTENCY_CONFLICT no se resuelve
creando automáticamente otra clave. CVE_WORKER_UNAVAILABLE es un rechazo conocido.
No hay reintento automático de POST ni bucle de nuevas ejecuciones.

## Estados, progreso y polling

| Datos backend        | Texto visual                                    |
| -------------------- | ----------------------------------------------- |
| queued / null        | Pendiente                                       |
| running / null       | Procesando                                      |
| completed / complete | Completada, cobertura completa de esta consulta |
| completed / partial  | Parcial, consulta incompleta                    |
| failed / null        | Fallida, sin cobertura verificable              |

La cobertura describe la consulta; la aplicabilidad describe un hallazgo. Una
respuesta HTTP correcta no significa completed. No se calcula porcentaje.
Informados, entradas recuperadas y CVE distintos guardados son contadores
separados; los duplicados pueden hacerlos diferentes. Total desconocido se
representa con guion, sin inventar denominador. Duración solo con inicio/fin.

TanStack Query consulta el GET de ejecución cada 4 segundos únicamente con
queued/running, sin error y durante los primeros 15 minutos de la vista. No
polling en segundo plano con pestaña oculta, ni después de terminal/desmontaje.
Las solicitudes usan AbortSignal y TanStack deduplica el trabajo en curso.
Ante error, conserva el último dato válido, pausa el intervalo y ofrece
actualización manual. Reconexión permite consultar una ejecución activa; no
reenvía POST. Tras 15 minutos se mantiene la actualización manual.

Los hallazgos se invalidan al cambiar estado o páginas guardadas de la ejecución;
no se descargan todas las páginas ni se consultan por cada fila. Una respuesta
perdida o una actualización visual no constituye un reintento de ejecución NVD.

Una consulta completa con cero CVE muestra «Sin CVE recuperados para esta
consulta», con límites explícitos. failed no se presenta como cero válido.
Parcial muestra total informado/recuperado y avisos saneados. Nunca se afirma
activo seguro, vulnerabilidad confirmada o cobertura universal.

## Hallazgos y evidencia

La tabla muestra CVE, descripción resumida, todas las métricas CVSS reconocidas,
aplicabilidad y revisión por separado. Cada métrica identifica versión/puntuación;
el detalle añade fuente, tipo, vector y severidad disponible. No se mezclan
versiones ni se deriva severidad baja de ausencia de métricas. Formatos desconocidos
permanecen en el registro y no se convierten en puntuaciones ficticias.

La descripción muestra preferentemente español **del origen** si existe, con
selector nativo de idiomas; no se inventa traducción. Configuraciones y evidencia
completa son desplegables nativos con JSON escapado. Fechas published/lastModified
sin sufijo se interpretan como UTC de NVD antes de mostrarse en hora local.

Aplicabilidad: potential→Potencialmente aplicable; undetermined→Aplicabilidad no
determinada; not_applicable→No aplicable según revisión. La evaluación inicial
permanece visible después de revisar. Se explican AND, vulnerable=false, rangos,
negación, componentes desconocidos, evidencia truncada y otros códigos. No se
reinterpreta una ejecución anterior usando el CPE actual.

La ficha NVD se construye solo desde un CVE ID validado. Referencias de origen
solo habilitan enlaces HTTPS válidos, sin credenciales ni controles; HTTP u
otros valores quedan como texto. Todos los enlaces externos usan noopener/
noreferrer. No se visitan desde FastAPI ni se ejecuta HTML externo en React.
Un hash de evidencia omitida no se presenta como capacidad de reconstrucción.

## Revisión única

Solo una ejecución terminal y un hallazgo open con evidencia habilitan revisión.
El formulario exige applicability permitida, motivo 1–500, evidencia 1–2000,
normalización/validación compartida y consentimiento. Se envían status=reviewed
y expected_updated_at del último GET; no se inventan estados ni confirmed.

PATCH **no es idempotente** en este contrato. No lleva Idempotency-Key ni retry.
Ante conflicto o pérdida de respuesta se consulta GET del hallazgo, preservando
la evaluación original. Si el servidor ya revisó, aparece su decisión y desaparece
el formulario. Si sigue abierto, solo una preparación explícita permite otro
intento basado en el estado reconciliado. Un éxito se anuncia accesiblemente y
actualiza caché/listas sin simular cambios de evidencia o CVSS.

## Seguridad y sesión

Se conserva AuthProvider: token en memoria, /auth/me real, expiración/401,
cancelación, caché por usuario y limpieza de intentos. No hay role local, RBAC,
admin, cookies, JWT en URL/storage, API key NVD en VITE ni consultas NVD de React.
Los errores no muestran mensajes externos/SQL; las referencias request_id
permiten localizar un problema sin revelar credenciales. Logout sigue siendo
local: no representa revocación de JWT en el servidor.

## Ejecutar y detener

Requisitos: Node >=22.12, dependencias del backend instaladas en su .venv,
Docker y repositorios hermanos en los commits MVP-B indicados.

```bash
cd /home/mz/Desktop/VulnTrack/frontend
npm ci
../backend/.venv/bin/python scripts/dev_stack.py --username tu_usuario --api-port 8000 --web-port 5173
```

El aprovisionador real solicita contraseña privada mediante getpass. Abrir
http://127.0.0.1:5173. Puertos ocupados se rechazan; omitir flags asigna puertos
libres que se imprimen al arrancar.

El launcher crea solo un PostgreSQL tmpfs propio, aplica V1 y Alembic hasta 0004,
provisiona runtime mínimo y configura CORS. Inicia FastAPI con **--workers 1** y
CVE_WORKER_ENABLED=true: el worker corre en su lifespan. No iniciar otro proceso
worker. El lock y la cuota local son responsabilidad Backend; varias instancias
o egresos necesitan diseño posterior, no una promesa de cuota distribuida.
El backend aplica enfriamiento inicial de 60 s y espaciado NVD compartido: una
consulta recién aceptada puede permanecer en curso mientras espera presupuesto.

El modo normal usa NVD real, con API key opcional solo backend. Vite recibe
únicamente su origen público `VITE_API_URL`; no recibe secretos DB/JWT/NVD.
No se invoca el entrypoint de fixtures en uso normal. Una API remota requiere
HTTPS y CORS explícito; no hay hosting público ni configuración de producción.

Ctrl+C detiene únicamente los grupos de procesos asignados y su contenedor;
permite hasta 50 s para cierre acotado del worker. **Todos los datos temporales
se pierden**, no hay base persistente ni respaldo. No se aceptan bases existentes
ni se borran volúmenes ajenos. Se verificaron arranque normal, getpass, login/me,
Vite, esquema MVP-B y cierre, sin emitir solicitudes NVD durante ese smoke.

## Pruebas, fixtures y alcance posterior

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
npm audit
../backend/.venv/bin/ruff check scripts/dev_stack.py tests/e2e/api_server.py
../backend/.venv/bin/python scripts/dev_stack.py --e2e
```

E2E inicia FastAPI/JWT/SQL/worker reales en un clúster nuevo y Playwright. Solo
se reemplaza el transporte NVD bajo guard estricto de entorno/base temporal.
No hay endpoints de control de prueba. Se usa el CVE verificado del backend y
variantes explícitamente simuladas para vacío/parcial/fallo/muchos/sin métricas;
los CVE-2026-910xx de las capturas son identificadores de prueba, no evidencia
de otros CVE reales. TTL60, cuota virtual y latencia controlada son exclusivos
de tests; no se afirman como prueba de tiempos o cuotas productivos.

La suite anterior `web.spec.ts` conserva sus siete casos. `z-cve.spec.ts` se
ordena después porque la regresión inicial comprueba inventario vacío y sus
pruebas visuales reutilizan el activo registrado por esa misma suite anterior.
Cada runner tiene un clúster propio. Capturas en test-results son ignoradas;
selección en docs/screenshots/mvp-b, descrita como escenarios controlados.
Sin storageState, traces, HAR, video, contraseñas ni JWT en artefactos.

Ver [MVP_B_WEB_RESULTS.md](MVP_B_WEB_RESULTS.md). Fuera de esta misión quedan
persistencia local de desarrollo, RBAC/admin, nuevas experiencias móviles,
exportaciones y producción. Antes de una demostración conviene decidir la
conservación de datos y preparar un guion con cobertura/incertidumbre visibles.
