# Interfaz de workspaces y aplicaciones — Database V2

Esta rama adapta la web a workspaces, aplicaciones web y tecnologías del modelo
Database V2. La API V2 del backend es la fuente de datos; el frontend no conecta
directamente con PostgreSQL ni con NVD.

## Disponible en este paso

- Listar los workspaces del usuario y cambiar el espacio activo.
- Crear el primer workspace con una clave de idempotencia UUID.
- Consultar y buscar las aplicaciones del workspace.
- Registrar aplicaciones con nombre y descripción.
- Dashboard con aplicaciones y una muestra reciente de tecnologías y CPE
  confirmados. Los conteos de tecnologías/CPE indican su muestra y no se
  presentan como agregados globales.
- Detalle de aplicación con alta de tecnologías, búsqueda CPE bajo demanda y
  selección/confirmación explícita; la API compara la versión observada.
- Consulta CVE explícita e idempotente por tecnología confirmada, presentación
  de cobertura, conteos, avisos, evidencia y referencias seguras de NVD.
- Resultados paginados en bloques de 20 y aplicabilidad rotulada como potencial
  o indeterminada; la interfaz no confirma vulnerabilidades automáticamente.
- Revisión humana de hallazgos abiertos (potencial, indeterminada o no
  aplicable), solo para owner/editor, con control de concurrencia y auditoría.
- Medidas manuales por hallazgo con fuente HTTPS opcional y estados pendiente,
  en corrección, corregido o riesgo aceptado.
- Historial paginado de consultas NVD por aplicación, persistente entre sesiones.
- Mostrar el estado de ZAP como pendiente; no se simulan ejecuciones ni métricas.
- La interfaz permite consultas CPE a `viewer`, pero oculta las acciones de
  escritura y confirmación; el backend sigue siendo quien autoriza cada operación.

## Rutas y datos

- `GET /api/v2/workspaces` y `POST /api/v2/workspaces`
- `GET /api/v2/workspaces/{workspace_id}/applications`
- `POST /api/v2/workspaces/{workspace_id}/applications`
- `GET /api/v2/workspaces/{workspace_id}/applications/{application_id}/technologies`
- `POST /api/v2/workspaces/{workspace_id}/applications/{application_id}/technologies`
- `GET /api/v2/workspaces/{workspace_id}/applications/{application_id}/cpe-candidates`
- `PUT /api/v2/workspaces/{workspace_id}/applications/{application_id}/technologies/{technology_id}/cpe`
- `POST /api/v2/workspaces/{workspace_id}/applications/{application_id}/technologies/{technology_id}/analyses`
- `GET /api/v2/workspaces/{workspace_id}/applications/{application_id}/analyses/{run_id}`
- `GET /api/v2/workspaces/{workspace_id}/applications/{application_id}/analyses?limit=&offset=`
- `GET /api/v2/workspaces/{workspace_id}/applications/{application_id}/analyses/{run_id}/findings`
- `PATCH /api/v2/workspaces/{workspace_id}/applications/{application_id}/findings/{finding_id}`
- `GET/POST /api/v2/workspaces/{workspace_id}/applications/{application_id}/findings/{finding_id}/recommendations`
- `PATCH /api/v2/workspaces/{workspace_id}/applications/{application_id}/recommendations/{recommendation_id}`

La API limita las listas de aplicaciones y tecnologías a 100 registros. El
Dashboard consulta tecnologías solo para las cinco aplicaciones más recientes;
por eso sus cifras están rotuladas como muestra. Database V2 no guarda todavía
una URL de aplicación, de modo que esta vista no inventa ni solicita ese campo.

Los endpoints de aplicación no ofrecen una ruta de detalle ni paginación: el
frontend localiza la aplicación dentro de la lista limitada a 100 registros.

## Por integrar

- OWASP ZAP Baseline y su pantalla de análisis. No se habilita ZAP desde la web
  hasta que el backend implemente autorización de destinos y controles de
  SSRF/salida verificables.

## Desarrollo

El cliente conserva la sesión JWT en memoria. Las rutas de workspace usan el
mismo origen API configurado por `VITE_API_URL`; no se colocan secretos en
variables `VITE_*`. Ejecutar `npm ci` y `npm run dev` para desarrollo local.
