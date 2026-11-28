# VulnTrack Web — RC4.1 / candidato de entrega

Interfaz React del inventario local de VulnTrack. Permite registro/inicio de sesión, workspaces, dispositivos, aplicaciones, tecnologías, búsqueda y confirmación CPE, historial, revisión de hallazgos y recomendaciones asociadas. Owner/editor pueden escribir; viewer consulta. El servidor y PostgreSQL aplican la autorización.

El dashboard principal usa inventario y cobertura CPE registrados. Los resúmenes CVE y sus gráficas existentes se conservan en una sección plegable de **demostración e historial**; no representan un análisis real ni riesgo confirmado. El catálogo oficial CPE local no convierte un resultado CVE fixture en real. La interfaz incluye el flujo CVE live detrás de `VITE_NVD_MODE=live`, siempre que el backend también esté configurado explícitamente para consultar NVD. La configuración de ejemplo y la instalación documentada usan `disabled`/fixture. ZAP, verificación remota, gestión de riesgos y despliegue público siguen aplazados.

La fuente actual de esta instalación es [el índice vigente](../evolucion-vulntrack/00_INDICE_DOCUMENTACION_VIGENTE.md). Consulte [operación](../evolucion-vulntrack/MANUAL_OPERACION_LOCAL.md), [funciones y límites](../evolucion-vulntrack/AUDITORIA_FINAL_FUNCIONAL.md) y [resultados](../evolucion-vulntrack/RESULTADOS_VALIDACION_FINAL_FASE_5.md). Los informes antiguos en `docs/` son históricos.

## Preparación de producción

El Dockerfile compila React con API del mismo origen y consultas CVE deshabilitadas; Caddy sirve los archivos estáticos. El Compose único y la [guía de despliegue](https://github.com/Jesel8D/vuln-track-backend/blob/release/v1.0.0-rc1/deploy/production/GUIA_DESPLIEGUE_VULNTRACK_PRODUCCION.md) están en Backend. Clonar ambos repositorios como directorios hermanos junto con Database. No usar Vite dev ni configurar secretos en `VITE_*`. Esta rama es un candidato; la exposición pública depende de validar EC2.

## Desarrollo local

Node >=22.12, npm, Backend local y dependencias disponibles. React 19, TypeScript 6, Vite 8, React Router 7 y TanStack Query 5; versiones exactas en `package-lock.json`.

```sh
npm ci
npm run check
```

La instalación persistente local se inicia desde Backend mediante `scripts.v2_development up --profile rc3-catalog31 --frontend ../vuln-track-frontend --nvd-mode fixture`: configura API y fixture y conserva los volúmenes. Frontend `http://127.0.0.1:5191`, API `http://127.0.0.1:8018`. Para un servidor de desarrollo manual configurar `VITE_API_URL` según `src/services/api.ts` y `VITE_NVD_MODE=disabled` o `fixture`; ver `.env.example`. Para CVE live, habilitar backend conscientemente y compilar con `VITE_NVD_MODE=live`; la bandera del frontend por sí sola no activa las consultas en el servidor. No incluir secretos en variables `VITE_*`: son públicas.

## Rutas y sesión

`/login`, `/crear-cuenta`; rutas protegidas `/`, `/dispositivos`, `/dispositivos/:deviceId`, `/aplicaciones`, `/aplicaciones/:applicationId`, `/historial`, `/aplicaciones/:applicationId/historial` y `/cuenta`. `/analisis` redirige al dashboard. Las rutas desconocidas tienen estado propio. Los componentes V1 y de ZAP conservados en código no están montados como pantallas operativas.

JWT solo en memoria, sin localStorage/cookies de autenticación. Recargar requiere iniciar sesión. Logout y expiración limpian consultas y selecciones; logout no revoca por sí mismo un JWT robado. No hay reset de contraseña, invitaciones ni gestión de membresías en la interfaz.

## Pruebas y seguridad

`npm run check` ejecuta tipos, lint, Vitest y build. Chromium/axe del cierre usa API y PostgreSQL aislados con datos sintéticos; nunca registrar activos de prueba en la base habitual. `test:e2e:rc1` requiere su perfil de aceptación específico; no apuntarlo a la instalación personal. No anunciar vulnerabilidades confirmadas a partir de coincidencias CPE/CVE. No ejecutar escaneos ni activar NVD. Build es un artefacto local y no una aprobación de despliegue público.

Licencia [MIT](LICENSE). RC4.1-local identifica el conjunto de repositorios; se conserva la versión interna histórica del paquete npm.
