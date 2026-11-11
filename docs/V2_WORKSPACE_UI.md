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
- Mostrar el estado de ZAP como pendiente; no se simulan ejecuciones ni métricas.
- La interfaz oculta acciones de escritura para membresías `viewer`; el backend
  sigue siendo quien autoriza cada operación.

## Rutas y datos

- `GET /api/v2/workspaces` y `POST /api/v2/workspaces`
- `GET /api/v2/workspaces/{workspace_id}/applications`
- `POST /api/v2/workspaces/{workspace_id}/applications`
- `GET /api/v2/workspaces/{workspace_id}/applications/{application_id}/technologies`

La API limita las listas de aplicaciones y tecnologías a 100 registros. El
Dashboard consulta tecnologías solo para las cinco aplicaciones más recientes;
por eso sus cifras están rotuladas como muestra. Database V2 no guarda todavía
una URL de aplicación, de modo que esta vista no inventa ni solicita ese campo.

## Por integrar

- Detalle de aplicación y administración de tecnologías.
- Búsqueda y confirmación humana de CPE desde la interfaz.
- Inicio/consulta de ejecuciones CVE y presentación de evidencia.
- Historial de ejecuciones y hallazgos globales; la API actual no expone una
  lista agregada de esas ejecuciones.
- Seguimiento/revisión de hallazgos; requiere endpoints V2 dedicados.
- OWASP ZAP Baseline y su pantalla de análisis. No se habilita ZAP desde la web
  hasta que el backend implemente autorización de destinos y controles de
  SSRF/salida verificables.

## Desarrollo

El cliente conserva la sesión JWT en memoria. Las rutas de workspace usan el
mismo origen API configurado por `VITE_API_URL`; no se colocan secretos en
variables `VITE_*`. Ejecutar `npm ci` y `npm run dev` para desarrollo local.
