# Fase 2B — desafíos reales, comprobación remota bloqueada

**IMPLEMENTADO CON LIMITACIONES.** La vista actual conserva su diseño y añade un
panel de metadatos al seleccionar un destino. Lee hasta veinte desafíos desde la
API real; owners/editors pueden emitir y revocar. Viewer solo consulta. No se
realizan solicitudes al destino al registrar URL, emitir o revocar un desafío.

Se distinguen declaración, desafío pendiente, fallo, expiración, revocación y
indisponibilidad. El backend no tiene un productor operativo de control verificado;
no se muestra completado al emitir y ningún resultado de laboratorio acredita
propiedad. source laboratory se explica explícitamente incluso tras revocación.
Las fechas mostradas vienen de PostgreSQL. No se simula historial ni auditoría.

La respuesta de emisión contiene instrucciones una sola vez. El contenido queda
solo en estado local del componente, nunca en localStorage ni en query cache,
y se elimina al revocar o cambiar de destino/workspace. Se reutiliza la misma
Idempotency-Key tras una respuesta perdida; si el servidor ya emitió el desafío
no se inventa otro token: se explica cómo revocarlo y emitir uno nuevo.

El cliente verifica tipos, fechas, límites, IDs de workspace/aplicación/destino,
URL fija e instrucciones de propósito único. Rechaza digests expuestos, flags de
ejecución/control activos, evidencia con procedencia desconocida y respuestas de
otro workspace. La pertenencia y el rol se vuelven a comprobar en Backend/RLS.

El botón Baseline sigue disabled y no tiene activación oculta. No se añadió una
llamada automática a POST verify: ese endpoint autorizado devuelve 503 sin red
ni intentos. Actualizar verificación hace únicamente GET de metadatos del API.
Las instrucciones se muestran como campos de solo lectura, no como enlaces que
el navegador deba visitar automáticamente.

Pruebas: diez casos React nuevos, regresiones previas, tipos/lint/build y flujo
de navegador con JWT/PostgreSQL reales y puertos efímeros. El flujo emite, comprueba
503 sin consumo, prueba acceso ajeno, revoca y revisa desktop/móvil y Axe. Los
fixtures y capturas viven en tests/artefactos privados, no en la base personal.

Requiere el par Backend Fase 2B y SQL008 compatible. Backend antiguo sigue
sirviendo su API anterior, pero carece de este servicio. No se desplegó sobre la
instalación personal. El plan emparejado está en Backend
docs/V2_PHASE2B_LOCAL_UPGRADE.md. No hay garantía de producción ni autorización ZAP.
