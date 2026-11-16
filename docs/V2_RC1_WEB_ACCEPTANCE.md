# RC1 — aceptación de la interfaz V2

**IMPLEMENTADO CON LIMITACIONES**, 2026-11-15. Base
`0ab0f117651dd058cb2cb70d994999781e18e75f` de
`feat/v2-security-analysis-web-phase2b`; rama nueva `release/v2-rc1-web`.
Usar Backend `release/v2-rc1-integration` basado en
`f571ea8d0f943900b3ddde900d6f7011726e8f56`, Database
`a562e638dfe5b7e8d07eec0e8046e6998f8a2802` de
`feat/v2-security-verification-database`. El conjunto final completo se registra
en el manifiesto/reporte de entrega después del push, sin actualizar development.

Backend contiene los seis documentos `docs/V2_RC1_*.md`: integración,
compatibilidad, guion manual, limitaciones, checklist y ejecución/backup/restore.
Esta revisión conserva el diseño y corrige defectos reproducidos: aviso visible
de NVD fixture, resumen actualizado al volver al dashboard, meses UTC como
períodos de calendario, contraste de notas/estados, encabezados/landmarks y
desbordamiento del dashboard de 768px con nombre largo. No cambia API ni SQL.

## Pruebas de esta misión

- `npm run check`: 96 unitarias/componentes en 8 archivos, TypeScript, ESLint y
  build correctos; cero fallidas/omitidas.
- `scripts/v2_registration_stack.py --e2e` con installation existing/new y puertos
  efímeros: 6 aprobadas por ruta, cero fallidas/omitidas. Cada ruta usa tmpfs propia.
- `npm run test:e2e:rc1`, invocado por la guarda Backend: 9 casos A/C/D/E y UX en
  RC1 persistente. Registro/login/identidad, aplicación/URL/tecnología, confirmación
  explícita CPE, worker/CVE, revisión conservadora, recomendación, historial,
  dashboard contrastado con API, aislamiento y caducidad/revocación reales.
- 375/768/1280/1440: login, registro, dashboard, aplicaciones, CPE poblado, historial
  con CVE/recomendaciones y seguridad; sin desbordamiento y cero violaciones axe
  en las vistas evaluadas. No se desactivaron reglas de contraste o semántica.
- Error/carga/reintento: se aborta solo la solicitud de dashboard, se comprueba
  ausencia de tarjetas inventadas y el reintento real200. Auth y datos positivos
  no se sustituyen por respuestas de navegador ficticias.
- B: una prueba tras reinicio y otra tras restore a volumen nuevo, con login,
  mismos DTO/IDs/CPE/hallazgo/recomendación y aislamiento.

Se probaron las correcciones después de reproducir los fallos. Se ajustaron
supuestos de test201, retorno a ruta protegida, sesión en memoria, selector del
combobox y espera del menú; la batería respeta Retry-After de429 sin ampliar
cuotas. La última ejecución verde y los logs intermedios están en Backend
`api-tests/v2/.artifacts/rc1/`, privados/ignorados.

## Ejecutar sin tocar datos personales

Arrancar primero el perfil RC1 fixture en Backend; puertos web5177/API8004,
PostgreSQL55438. Después, desde ese Backend:

```bash
.venv/bin/python -m scripts.rc1_acceptance --phase create
.venv/bin/python -m scripts.test_rc1_recovery
```

El primero genera cuentas nuevas y conserva el acceso anterior en archivo
privado; no limpia el volumen. El segundo controla solo recursos RC1 y restaura
en otro perfil nuevo. La config Playwright exige un archivo de guarda emitido por
Backend, URL loopback, volumen/perfil RC1 y puertos distintos de development;
Backend valida además proceso/API real y modo fixture. No invocar contra5173/8000.
`test-results-rc1/` está ignorado y separado de la salida de la suite previa.

No publicar `.local`, archivos de guarda/acceso, trazas o contextos de fallos:
pueden incluir contraseñas sintéticas. Las capturas entregadas solo contienen
vistas autenticadas pobladas y datos ficticios revisados, sin tokens/contraseñas.

## Límites

NVD capturado y CVE-2017-6784 AND original: **undetermined**, revisión reviewed,
recomendación manual pending. La URL de inventario nunca se escanea. No abrir
enlaces externos en la exposición. Declaración no equivale a control de dominio;
verify503, egreso público bloqueado y ZAP disabled. La sesión vive en memoria:
recargar requiere login; logout no revoca un JWT servidor ya emitido.

Chromium Linux y axe no certifican todos los navegadores ni accesibilidad con
lector real. Los tests UI V1 `web.spec.ts`/`z-cve.spec.ts` siguen como antecedentes,
sin ejecutarlos contra rutas que App V2 no monta. Dispositivos V1 conservados en
Backend no se presentan como aplicaciones V2; móvil nativo y ratificación de
Jesel/Rudi siguen pendientes. GO solo para revisión académica local controlada.
