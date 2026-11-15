import type { ApplicationTarget } from "../../types/v2";

export function targetAuthorizationLabel(
  status: ApplicationTarget["authorization_status"],
) {
  return {
    pending: "Pendiente de declaración",
    approved: "Declaración vigente; control sin verificar",
    rejected: "Declaración rechazada o retirada",
    expired: "Declaración vencida",
  }[status];
}

export function targetControlLabel(target: ApplicationTarget) {
  if (!target.analysis_readiness.url_policy_allowed)
    return "URL fuera de la política pública";
  if (target.analysis_readiness.control_verified)
    return "Control verificado; ejecución bloqueada";
  return {
    registered: "Control del destino sin verificar",
    requested: "Verificación técnica solicitada",
    verification_pending: "Pendiente de verificación técnica",
    verified: "Datos de verificación incompletos",
    rejected: "Declaración rechazada o retirada; control sin verificar",
    revoked: "Verificación técnica revocada",
    expired: "Autorización expirada; análisis no elegible",
    incomplete: "Datos de autorización incompletos",
  }[target.analysis_readiness.authorization_state];
}
