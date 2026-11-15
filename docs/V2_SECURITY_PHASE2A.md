# Fase 2A de la vista de análisis

**IMPLEMENTADO CON LIMITACIONES. ZAP permanece BLOQUEADO.**

La vista conserva el diseño y el contrato HTTP de Fase 1. Se separa el estado
de la declaración de propiedad del estado técnico recibido en analysis_readiness.
Las etiquetas contemplan pendiente, verificado, rechazado/retirado, revocado,
expirado e incompleto. No se infiere control técnico desde approved, una casilla
o una fecha futura. Solo se muestran los estados proporcionados por la API.

El servicio real no emite desafíos ni persiste evidencia técnica; sus destinos
siguen sin verificar. Los componentes HTTPS/desafíos probados en laboratorio
Backend no habilitan ese servicio. No se añade una llamada de verificación,
botón operativo nuevo, historial simulado o hallazgo ZAP. Baseline sigue disabled
incluso si un contrato futuro informa control verificado; la API tampoco tiene
executor ni un flag que lo habilite.

Las pruebas React cubren selección, contrato incompleto/inconsistente, estados,
retirada versionada y viewer sin escrituras. Playwright usa JWT/PostgreSQL reales
en tmpfs y puertos efímeros; revisa escritorio/móvil, Axe, overflow y ausencia de
tráfico externo. Fixtures de estados futuros solo viven en tests, no en la base
personal ni en resultados que se presenten como reales.

Usar Backend Fase 1 o Fase 2A compatible y Frontend emparejado. La versión estable
anterior no entrega analysis_readiness y es rechazada por la validación del
contrato. El plan de actualización/rollback está en Backend
docs/V2_PHASE1_LOCAL_UPGRADE.md; las ramas nuevas no se despliegan automáticamente.
