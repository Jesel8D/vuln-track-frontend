import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Globe2, Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/context";
import { errorText } from "../../services/api";

function authorizationLabel(status: string) {
  return status === "approved"
    ? "Autorización registrada"
    : status === "rejected"
      ? "Autorización rechazada"
      : status === "expired"
        ? "Autorización vencida"
        : "Pendiente de autorización";
}

export function ApplicationTargets({
  workspaceId,
  applicationId,
  canWrite,
}: {
  workspaceId: string;
  applicationId: string;
  canWrite: boolean;
}) {
  const { api, user } = useAuth();
  const cache = useQueryClient();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [reference, setReference] = useState("");
  const [attested, setAttested] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const queryKey = ["v2", user?.id, workspaceId, applicationId, "targets"];
  const targets = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.v2Targets(workspaceId, applicationId, signal),
  });
  const refresh = () => cache.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: () =>
      api.createV2Target(workspaceId, applicationId, {
        url: url.trim(),
        label: label.trim() || null,
      }),
    onSuccess: async () => {
      setUrl("");
      setLabel("");
      setNotice("Destino agregado en estado pendiente de autorización.");
      await refresh();
    },
    onError: (error) => setNotice(errorText(error)),
  });
  const authorize = useMutation({
    mutationFn: (target: NonNullable<typeof targets.data>["items"][number]) =>
      api.authorizeV2Target(workspaceId, applicationId, target.id, {
        authorization_status: "approved",
        authorization_expires_at: new Date(
          `${expiryDate}T23:59:59`,
        ).toISOString(),
        authorization_reference: reference.trim(),
        expected_updated_at: target.updated_at,
      }),
    onSuccess: async () => {
      setSelectedTarget(null);
      setReference("");
      setAttested(false);
      setNotice(
        "Autorización registrada. El análisis web aún no está habilitado.",
      );
      await refresh();
    },
    onError: (error) => setNotice(errorText(error)),
  });

  return (
    <section className="v2-panel v2-target-panel">
      <div className="v2-panel-heading">
        <div>
          <p className="v2-eyebrow">SUPERFICIE WEB</p>
          <h2>URLs de la aplicación</h2>
          <p>Registrar una URL no inicia ningún escaneo.</p>
        </div>
        <Globe2 size={21} />
      </div>
      {targets.isPending ? (
        <p className="v2-loading" role="status">
          Cargando URLs…
        </p>
      ) : targets.isError ? (
        <div className="v2-error-inline" role="alert">
          <span>{errorText(targets.error)}</span>
          <button
            className="v2-text-button"
            onClick={() => void targets.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="v2-target-list">
          {targets.data.items.map((target) => (
            <article className="v2-target-item" key={target.id}>
              <div className="v2-target-main">
                <a href={target.url} target="_blank" rel="noopener noreferrer">
                  {target.label || target.url} <ExternalLink size={13} />
                </a>
                {target.label && <small>{target.url}</small>}
                <span
                  className={`v2-status v2-status-${target.authorization_status}`}
                >
                  {authorizationLabel(target.authorization_status)}
                </span>
                {target.authorization_status === "approved" &&
                  target.authorization_expires_at && (
                    <small>
                      Vigente hasta{" "}
                      {new Date(
                        target.authorization_expires_at,
                      ).toLocaleDateString("es-MX")}
                    </small>
                  )}
                {target.authorization_reference && (
                  <small>Referencia: {target.authorization_reference}</small>
                )}
              </div>
              {canWrite && target.authorization_status !== "approved" && (
                <details className="v2-target-authorization">
                  <summary onClick={() => setSelectedTarget(target.id)}>
                    <ShieldCheck size={14} /> Registrar autorización
                  </summary>
                  {selectedTarget === target.id && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        authorize.mutate(target);
                      }}
                    >
                      <label>
                        Vigencia hasta
                        <input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          required
                          value={expiryDate}
                          onChange={(event) =>
                            setExpiryDate(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Referencia interna
                        <input
                          maxLength={500}
                          minLength={1}
                          required
                          value={reference}
                          onChange={(event) => setReference(event.target.value)}
                          placeholder="Ticket, correo o registro de autorización"
                        />
                      </label>
                      <label className="v2-target-attestation">
                        <input
                          type="checkbox"
                          required
                          checked={attested}
                          onChange={(event) =>
                            setAttested(event.target.checked)
                          }
                        />
                        Confirmo que soy propietario o tengo autorización
                        explícita para este destino.
                      </label>
                      <button
                        className="v2-secondary-button"
                        disabled={
                          authorize.isPending ||
                          !expiryDate ||
                          !reference.trim() ||
                          !attested
                        }
                      >
                        {authorize.isPending
                          ? "Guardando…"
                          : "Confirmar autorización"}
                      </button>
                    </form>
                  )}
                </details>
              )}
            </article>
          ))}
          {!targets.data.items.length && (
            <p className="v2-analysis-help">Aún no hay URLs registradas.</p>
          )}
        </div>
      )}
      {canWrite && (
        <form
          className="v2-target-form"
          onSubmit={(event) => {
            event.preventDefault();
            setNotice(null);
            create.mutate();
          }}
        >
          <label>
            URL base
            <input
              type="url"
              minLength={8}
              maxLength={2048}
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://app.ejemplo.edu"
            />
          </label>
          <label>
            Etiqueta (opcional)
            <input
              maxLength={120}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Portal público"
            />
          </label>
          <button
            className="v2-secondary-button"
            disabled={create.isPending || !url.trim()}
          >
            <Plus size={15} /> {create.isPending ? "Guardando…" : "Agregar URL"}
          </button>
        </form>
      )}
      {notice && (
        <p className="v2-review-saved" role="status">
          {notice}
        </p>
      )}
      <p className="v2-target-disclaimer">
        El estado de autorización es una declaración registrada por el usuario.
        ZAP permanece deshabilitado hasta integrar validaciones de destino y
        controles contra SSRF.
      </p>
    </section>
  );
}
