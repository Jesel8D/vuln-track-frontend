# VulnTrack Web — RC4.1-local

Interfaz React del inventario local de VulnTrack. Permite registro/inicio de sesión, workspaces, dispositivos, aplicaciones, tecnologías, búsqueda y confirmación CPE, historial, revisión de hallazgos y recomendaciones asociadas. Owner/editor pueden escribir; viewer consulta. El servidor y PostgreSQL aplican la autorización.

El dashboard principal usa inventario y cobertura CPE registrados. Los resúmenes CVE y sus gráficas existentes se conservan en una sección plegable de **demostración e historial**; no representan un análisis real ni riesgo confirmado. El catálogo oficial CPE local no convierte un resultado CVE fixture en real. Consultas CVE externas, ZAP, verificación remota, gestión de riesgos y despliegue público están aplazados.

La fuente actual de esta instalación es [el índice vigente](../evolucion-vulntrack/00_INDICE_DOCUMENTACION_VIGENTE.md). Consulte [operación](../evolucion-vulntrack/MANUAL_OPERACION_LOCAL.md), [funciones y límites](../evolucion-vulntrack/AUDITORIA_FINAL_FUNCIONAL.md) y [resultados](../evolucion-vulntrack/RESULTADOS_VALIDACION_FINAL_FASE_5.md). Los informes antiguos en `docs/` son históricos.

## Desarrollo local

Node >=22.12, npm, Backend local y dependencias disponibles. React 19, TypeScript 6, Vite 8, React Router 7 y TanStack Query 5; versiones exactas en `package-lock.json`.

```sh
npm ci
npm run check
```

La instalación persistente de esta laptop se inicia desde Backend mediante `scripts.v2_development up --profile rc3-catalog31 --frontend ../vuln-track-frontend --nvd-mode fixture`: configura API y fixture y conserva los volúmenes. Frontend `http://127.0.0.1:5191`, API `http://127.0.0.1:8018`. Para un servidor de desarrollo manual configurar `VITE_API_URL` según el contrato de `src/services/api.ts` y `VITE_NVD_MODE=fixture`; ver `.env.example`. Ninguna variable del frontend activa live en Backend. No incluir secretos en variables `VITE_*`: son públicas.

## Rutas y sesión

`/login`, `/crear-cuenta`; rutas protegidas `/`, `/dispositivos`, `/dispositivos/:deviceId`, `/aplicaciones`, `/aplicaciones/:applicationId`, `/historial`, `/aplicaciones/:applicationId/historial` y `/cuenta`. `/analisis` redirige al dashboard. Las rutas desconocidas tienen estado propio. Los componentes V1 y de ZAP conservados en código no están montados como pantallas operativas.

JWT solo en memoria, sin localStorage/cookies de autenticación. Recargar requiere iniciar sesión. Logout y expiración limpian consultas y selecciones; logout no revoca por sí mismo un JWT robado. No hay reset de contraseña, invitaciones ni gestión de membresías en la interfaz.

## Pruebas y seguridad

`npm run check` ejecuta tipos, lint, Vitest y build. Chromium/axe del cierre usa API y PostgreSQL aislados con datos sintéticos; nunca registrar activos de prueba en la base habitual. `test:e2e:rc1` requiere su perfil de aceptación específico; no apuntarlo a la instalación personal. No anunciar vulnerabilidades confirmadas a partir de coincidencias CPE/CVE. No ejecutar escaneos ni activar NVD. Build es un artefacto local y no una aprobación de despliegue público.

Licencia [MIT](LICENSE). RC4.1-local identifica el conjunto de repositorios; se conserva la versión interna histórica del paquete npm.
