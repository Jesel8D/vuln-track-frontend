# MVP-B Web — resultados verificados

Misión iniciada el 8 y finalizada el 9 de noviembre de 2026, America/Mexico_City.
Rama Frontend `feat/frontend-mvp-b-cve`, sin merge/fuerza. La autorización de
Jesel permite esta implementación; no se atribuye ratificación a Rudi ni
aprobación de producción. [Contrato implementado](MVP_B_WEB.md).

## Estado inicial y preservación

| Repositorio | Rama inicial                   | Commit                                   | Árbol inicial |
| ----------- | ------------------------------ | ---------------------------------------- | ------------- |
| Frontend    | feat/frontend-web-v1           | 2643467864c54226043d43efa5859d38c332ab92 | limpio        |
| Backend     | feat/mvp-b-nvd-cve-backend     | 7126a161040062b6f0f992c65faf8db07d326464 | limpio        |
| Database    | feat/mvp-b-nvd-cve-database    | e39dd357b28e33912ad062efc813244c62f3eb4b | limpio        |
| Context     | docs/mvp-context-consolidation | caa7ef13b0e2b24848991e32b3c0ee3fc59139c7 | limpio        |

Remotos oficiales SSH y referencias reales comprobados con ls-remote. No existía
la rama Frontend propuesta; se creó desde Web V1. Backend/Database ya ofrecían
el contrato necesario y no se modificaron. Context, main, ramas de Rudi, V2 y
registros de decisiones permanecen intactos. No se migraron bases personales.
El resultado histórico [TEST_RESULTS.md](TEST_RESULTS.md) se conserva sin cambios.

## Implementación

Se mantienen React/TypeScript/Vite, Router, TanStack Query, fuentes autoalojadas,
Lucide y sistema visual rack/turquesa. Interface Design instalada fue leída y
aplicada, sin reinstalación; checkpoints en `.interface-design/mvp-b.md`.
Sites se usó como guía de trabajo local, sin hosting externo desconectado de API.

Nuevas pantallas: historial por activo, ejecución con progreso y resultados,
y hallazgo con evidencia/revisión. El detalle añade inicio explícito y última
consulta. Dashboard conserva métricas y muestras existentes; solo cambia el
texto de orientación, sin totales CVE inventados ni N+1 decorativo.

ApiClient conecta las seis rutas MVP-B reales y valida los nuevos estados,
contadores/fechas/IDs/paginación en runtime. Token en memoria y limpieza de
sesión/caché siguen vigentes. POST conserva intención ante respuesta incierta;
PATCH se reconcilia por GET y no se reintenta automáticamente. No se simula
un cambio exitoso ni se altera la evidencia original.

Polling cada 4 s solo en ejecución activa/visible, máximo 15 min, con abort al
desmontar, parada en terminal/error y actualización manual. Sin porcentajes
ficticios. Cobertura y aplicabilidad se presentan por separado. Las fechas NVD
sin sufijo conservan semántica UTC; textos de origen en selector nativo de idioma,
sin traducción inventada ni HTML confiable.

Launcher actualizado: fuerza **un solo worker de Uvicorn**, habilita el worker
CVE de lifespan, verifica OpenAPI MVP-B y espera su cierre acotado. No crea otro
worker ni modifica el Backend. PGDATA y credenciales de pruebas son desechables.

## Pruebas finales

| Comprobación                               | Ejecutadas | Aprobadas | Fallidas | Omitidas |
| ------------------------------------------ | ---------: | --------: | -------: | -------: |
| Vitest unitarias/componentes               |         72 |        72 |        0 |        0 |
| Playwright + FastAPI + PostgreSQL + worker |         18 |        18 |        0 |        0 |

Se conservan **29 casos unitarios/componentes y 7 recorridos V1**; se añaden
43 y 11 respectivamente. No se eliminaron ni relajaron pruebas anteriores.
TypeScript incluye app, pruebas y configuraciones. ESLint, build Vite, Prettier
y Ruff de scripts Python pasan. npm audit: **0 vulnerabilidades reportadas**,
sin cambios de dependencias/lockfile. No representa garantía universal.

Build final aproximado: JS 402.28 kB / 122.14 kB gzip; CSS 45.65 kB / 9.64 kB gzip.
Playwright final: 18 passed (1.6m). Avisos no bloqueantes de NO_COLOR/FORCE_COLOR
del entorno; sin errores de aplicación reportados en recorridos verificados.

Comandos completos, referencias, conteos, ambiente y SHA-256 de logs en
[evidence/MVP_B_WEB_TESTS.json](evidence/MVP_B_WEB_TESTS.json). No se publican
logs de fallos ni artefactos que contengan JWT o contraseñas.

### Qué comprueban las pruebas nuevas

- Tipos de ejecución/hallazgo, enums exactos, paginación y rechazo de estados
  arbitrarios. Los seis métodos HTTP, Idempotency-Key y expected_updated_at.
- Confirmación requerida, versión desconocida, doble clic y replay con misma
  clave/cuerpo. Intentos por usuario/activo en memoria y limpieza.
- Progreso queued/running/terminal, pausa con pestaña oculta, parada por error,
  desconexión controlada, actualización manual, fin de polling y abort de una
  solicitud en curso al desmontar.
- Cero válido frente a failed; parcial 100/101 con 100 hallazgos persistidos;
  22 hallazgos y páginas de 20; historial de muchas ejecuciones con total de API.
- Sin CVSS, múltiples versiones originales, aplicabilidad indeterminada,
  configuración AND, referencias controladas y texto externo escapado.
- Revisión permitida, validación, timestamp obsoleto, pérdida de respuesta,
  conflicto real con otro cliente y consulta del estado ya guardado. Evidencia
  y clasificación inicial permanecen conservadas.
- Usuario B real recibe 404 sobre análisis/hallazgos/revisión de A. Sesión real,
  ausencia de privilegios por role local, rutas privadas y limpieza 401 V1.
- Corrección UTC para timestamps NVD sin offset; descripción de origen por idioma.

Los recorridos E2E usan servicios reales: React/Vite, FastAPI, JWT, autorización,
PostgreSQL y el worker normal. **Solo el transporte NVD** está controlado, bajo
un entrypoint exclusivo de tests que exige clúster/base desechables. No hay
endpoints de control de prueba en el producto. Fixtures verificadas del Backend
más variantes explícitamente simuladas, no otros registros NVD reales.

La cuota virtual, TTL60 y latencia controlada son condiciones E2E, no prueba de
rendimiento/cuotas productivas. El modo normal no importa este entrypoint.
Las pruebas de fallos de interfaz inyectan respuestas de red explícitas y la
pérdida de POST/PATCH ocurre después de que FastAPI persista la operación.
No se hicieron solicitudes NVD externas durante esta misión de frontend.

### Arranque normal y recursos

Se ensayó el launcher normal mediante PTY privada con el getpass/provisionador
real, contraseña efímera generada en memoria, login/me, respuesta Vite, readiness
y OpenAPI MVP-B. No se imprimió ni guardó la contraseña/token. La orden fuerza
--workers 1; CVE_WORKER_ENABLED=true inicia el worker dentro de FastAPI. El
procesamiento de la cola se verificó en los recorridos E2E, sin otro procesador.

Ctrl+C cerró los procesos propios y descartó PGDATA tmpfs. Los runners solo
detienen su contenedor/grupos asignados, no servicios por puerto o nombre ajeno.
No se usaron URLs de bases persistentes ni se borraron volúmenes.

## Responsive, accesibilidad e inspección visual

Chrome del sistema con Playwright; zona America/Mexico_City. En ejecución:

| Viewport | Ancho documento | Overflow horizontal |
| -------- | --------------: | ------------------- |
| 375 px   |          375 px | No                  |
| 768 px   |          768 px | No                  |
| 1280 px  |         1280 px | No                  |
| 1440 px  |         1440 px | No                  |

También se verificó por aserción ausencia de desbordamiento en hallazgo en los
cuatro tamaños y en historial móvil. Axe wcag2a/wcag2aa/wcag21aa: cero violaciones
reportadas en ejecución/hallazgo a los cuatro anchos y en historial 375; se
conservan las comprobaciones V1. No sustituye una auditoría manual exhaustiva.

Se inspeccionaron capturas reales de escritorio y móvil, jerarquía, foco/teclado,
selector de idioma, disclosures nativos, formularios y badges con texto. No son
maquetas. **Las capturas representan datos de prueba controlados**, incluido un
escenario simulado de 22 CVE con IDs CVE-2026-910xx. No acreditan 22 CVE reales
para ese dispositivo ni un inventario operativo.

- [Ejecución escritorio](screenshots/mvp-b/run-1440.png).
- [Ejecución móvil](screenshots/mvp-b/run-375.png).
- [Hallazgo móvil](screenshots/mvp-b/finding-375.png).
- [Hallazgo escritorio](screenshots/mvp-b/finding-1440.png).
- [Historial móvil](screenshots/mvp-b/history-375.png).
- [Geometría medida](screenshots/mvp-b/responsive.json).

## Incidencias resueltas y límites

Durante desarrollo se corrigieron pruebas con tipos/temporizadores incompletos,
una carrera del test que revisaba por API antes de que la vista cargase su estado
anterior, y una inyección de error que contaba el GET cancelado de StrictMode
como dato válido. Se aseguró el orden de la regresión de inventario vacío antes
de las pruebas CVE. No se relajaron controles para obtener resultados verdes.
La inspección visual llevó a presentar un idioma de descripción cada vez y la
revisión temporal detectó la necesidad de interpretar los timestamps crudos NVD
como UTC. Las cifras de arriba corresponden a ejecuciones finales satisfactorias.

| Función                                                     | Estado                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| Login, dashboard, activos, registro y CPE V1                | IMPLEMENTADA Y PROBADA                                    |
| Inicio CVE, idempotencia y progreso real                    | IMPLEMENTADA Y PROBADA                                    |
| Historial, paginación, resultados y evidencia               | IMPLEMENTADA Y PROBADA                                    |
| Revisión única, conflictos e aislamiento                    | IMPLEMENTADA Y PROBADA                                    |
| Responsive y accesibilidad básica automatizada              | IMPLEMENTADA Y PROBADA                                    |
| Interpretación de aplicabilidad/cobertura                   | IMPLEMENTADA CON LIMITACIONES del Backend, visibles en UI |
| Métricas globales CVE                                       | PENDIENTE de contrato global; no se fabrican              |
| Persistencia local, RBAC/admin, producto móvil y producción | PENDIENTE, fuera del alcance                              |

Sin bloqueos de contrato para las funciones de esta misión. Los límites del
backend se conservan: una instancia/egreso, evaluación conservadora incompleta,
consulta NVD sin snapshot garantizado, evidencia ocasionalmente truncada,
revisión una vez y nuevas consultas explícitas para repetir trabajo.

Git: commit/push normal únicamente en feat/frontend-mvp-b-cve, con revisión de
secretos y diff. Hash final/local/remoto se entrega en el chat para evitar
incluir el hash autorreferente en su propio commit. Sin merge de ramas.

Después conviene decidir conservación de datos de desarrollo y guion de demo
académica. RBAC/admin requieren contratos y autorización específicos; la
experiencia móvil debe priorizar lectura/revisión y accesibilidad. No se empezó
ninguna de esas funciones durante esta misión.
