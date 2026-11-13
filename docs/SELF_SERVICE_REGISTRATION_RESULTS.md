# Resultados de registro V2 — 2026-11-13

- Baseline frontend:72 unitarias aprobadas antes de los cambios.
- `npm run check`: typecheck, ESLint, **77** unitarias en6 archivos y build correctos;
  **0 fallidas,0 omitidas**.
- `npm audit`: **0 vulnerabilidades**, incluidas dependencias de desarrollo.
- Prettier en TS/TSX/CSS/configuración modificados y Ruff del launcher Python: correctos.
- Chromium real, perfil `v2-registration`: **5 aprobadas/0 fallidas/0 omitidas** con
  base actualizada y **5/0/0** con instalación nueva; son los mismos recorridos repetidos.
- Registro/login/me, formulario, error422/409/429 real, workspace y dashboard vacíos,
  aplicación creada por UI, tecnología vacía, separación A/B, cachés, logout y rutas privadas.
- 375px sin desbordamiento y **0 violaciones axe**; también ancho1440px.
  Captura vacía: `docs/screenshots/self-service-registration-375.png`.
- El botón ZAP conserva disabled; sin solicitudes NVD ni escaneos.

La primera ejecución de navegador dio3 aprobadas/2 fallidas: historial vacío
presentaba un error de aplicación inexistente y el formulario móvil carecía de
landmark/encabezado principal. Se corrigieron ambos y un locator que debía usar el
texto real del botón ZAP. No se omitieron reglas axe ni se simularon respuestas de auth.

No ejecutados: E2E MVP históricos, otros navegadores ni apps móviles nativas.
Se conservaron `web.spec.ts` y `z-cve.spec.ts` intactos; verifican rutas antiguas,
no el contrato V2. Backend integrado:371 pytest aprobadas y32 en instalación nueva.
El launcher es desechable; no representa un despliegue persistente ni producción.

Informe coordinado e incidentes de entorno: repositorio Backend,
`docs/SELF_SERVICE_REGISTRATION_RESULTS.md`, rama `feat/v2-self-service-registration`.
