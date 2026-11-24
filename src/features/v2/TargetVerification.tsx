import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/context";
import { errorText } from "../../services/api";
import type { WorkspaceTarget } from "../../types/v2";
import type {
  VerificationChallenge,
  VerificationIssue,
} from "../../types/verification";

function label(row: VerificationChallenge) {
  if (row.evidence.length && row.effective_state === "failed")
    return "Control no acreditado";
  return {
    pending: "Desafío pendiente",
    failed: "Verificación fallida",
    expired: "Desafío expirado",
    revoked: "Desafío revocado",
    unavailable: "Verificación temporalmente no disponible",
  }[row.effective_state];
}

export function TargetVerification({
  workspaceId,
  target,
  canWrite,
}: {
  workspaceId: string;
  target: Omit<WorkspaceTarget, "application_name">;
  canWrite: boolean;
}) {
  const { api, user } = useAuth();
  const cache = useQueryClient();
  const queryKey = [
    "v2",
    user?.id,
    workspaceId,
    target.application_id,
    target.id,
    "verifications",
  ];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      api.v2Verifications(
        workspaceId,
        target.application_id,
        target.id,
        signal,
      ),
    retry: false,
  });
  const [instructions, setInstructions] =
    useState<VerificationIssue["instructions"]>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestKey = useRef<string | null>(null);
  const current = query.data?.items[0];
  const active =
    current?.state === "pending" && current.effective_state !== "expired";
  const canIssue =
    canWrite &&
    target.application_status === "active" &&
    target.authorization_status === "approved" &&
    target.url.startsWith("https://") &&
    target.analysis_readiness.url_policy_allowed &&
    !active &&
    query.isSuccess;

  async function issue() {
    setBusy(true);
    setNotice(null);
    setInstructions(null);
    requestKey.current ??= crypto.randomUUID();
    try {
      const response = await api.issueV2Verification(
        workspaceId,
        target.application_id,
        target.id,
        target.updated_at,
        requestKey.current,
      );
      setInstructions(response.instructions);
      setNotice(
        response.created
          ? "Desafío registrado. El token solo se muestra en esta respuesta; la comprobación remota sigue bloqueada."
          : "El desafío ya existe y su token no puede recuperarse. Revócalo antes de emitir otro.",
      );
      requestKey.current = null;
      await cache.invalidateQueries({ queryKey });
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!current) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.revokeV2Verification(
        workspaceId,
        target.application_id,
        target.id,
        current.id,
        current.version,
      );
      setInstructions(null);
      requestKey.current = null;
      setNotice(
        "Desafío revocado. El control del dominio sigue sin acreditar.",
      );
      await cache.invalidateQueries({ queryKey });
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="v2-verification-card"
      aria-label="Verificación del destino"
    >
      <h3>Desafío de control del dominio</h3>
      <p className="v2-analysis-help">
        Puedes registrar un desafío. Su comprobación remota no está disponible
        en esta instalación y no habilita análisis.
      </p>
      {query.isPending ? (
        <p>Cargando verificación…</p>
      ) : query.isError ? (
        <p role="alert">
          Verificación temporalmente no disponible. {errorText(query.error)}
        </p>
      ) : current ? (
        <div className="v2-verification-state">
          <strong>{label(current)}</strong>
          {current.evidence.length > 0 && (
            <small>Evidencia de laboratorio; sin verificación real</small>
          )}
          <small>
            Emitido: {new Date(current.created_at).toLocaleString("es-MX")}
          </small>
          <small>
            Caduca: {new Date(current.expires_at).toLocaleString("es-MX")}
          </small>
          {current.scope_invalidated && (
            <small>
              La declaración o el destino cambió; este desafío ya no es válido.
            </small>
          )}
          {current.revoked_at && (
            <small>
              Revocado: {new Date(current.revoked_at).toLocaleString("es-MX")}
            </small>
          )}
        </div>
      ) : (
        <p>Sin desafíos registrados.</p>
      )}
      <div className="v2-verification-actions">
        {canWrite && (
          <button
            className="v2-secondary-button"
            disabled={!canIssue || busy}
            onClick={() => void issue()}
          >
            Emitir desafío
          </button>
        )}
        {canWrite && current && current.state !== "revoked" && (
          <button
            className="v2-text-button"
            disabled={busy}
            onClick={() => void revoke()}
          >
            Revocar desafío
          </button>
        )}
        <button
          className="v2-text-button"
          disabled={busy || query.isFetching}
          onClick={() => void query.refetch()}
        >
          Actualizar verificación
        </button>
      </div>
      {instructions && (
        <div className="v2-verification-instructions">
          <label>
            Ruta del archivo de desafío
            <input readOnly value={instructions.url} />
          </label>
          <label>
            Contenido del archivo de desafío
            <textarea readOnly rows={4} value={instructions.body} />
          </label>
          <p className="v2-analysis-help">
            Conserva el contenido solo si vas a publicar este archivo en tu
            propio destino. La aplicación no lo publicará ni lo comprobará
            automáticamente.
          </p>
        </div>
      )}
      {notice && (
        <p role="status" className="v2-analysis-help">
          {notice}
        </p>
      )}
    </section>
  );
}
