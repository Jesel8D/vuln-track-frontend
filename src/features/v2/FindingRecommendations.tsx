import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { errorText } from "../../services/api";
import { useAuth } from "../auth/context";
import type { Recommendation, RecommendationStatus } from "../../types/v2";

function statusLabel(status: RecommendationStatus) {
  return status === "pending"
    ? "Pendiente"
    : status === "in_progress"
      ? "En corrección"
      : status === "fixed"
        ? "Corregido"
        : "Riesgo aceptado";
}

function safeHttps(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function FindingRecommendations({
  workspaceId,
  applicationId,
  findingId,
  canWrite,
}: {
  workspaceId: string;
  applicationId: string;
  findingId: string;
  canWrite: boolean;
}) {
  const { api, user } = useAuth();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [recommendation, setRecommendation] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const queryKey = [
    "v2",
    user?.id,
    workspaceId,
    applicationId,
    findingId,
    "recommendations",
  ];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      api.v2Recommendations(workspaceId, applicationId, findingId, signal),
    enabled: open,
  });
  const refresh = () => cache.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: () =>
      api.createV2Recommendation(workspaceId, applicationId, findingId, {
        recommendation: recommendation.trim(),
        source_url: sourceUrl.trim() || null,
      }),
    onSuccess: async () => {
      setRecommendation("");
      setSourceUrl("");
      setNotice("Medida agregada al seguimiento.");
      await refresh();
    },
    onError: (error) => setNotice(errorText(error)),
  });
  const update = useMutation({
    mutationFn: ({
      item,
      status,
    }: {
      item: Recommendation;
      status: RecommendationStatus;
    }) =>
      api.updateV2Recommendation(
        workspaceId,
        applicationId,
        item.id,
        status,
        item.updated_at,
      ),
    onSuccess: async () => {
      setNotice("Estado actualizado.");
      await refresh();
    },
    onError: (error) => setNotice(errorText(error)),
  });

  return (
    <details
      className="v2-recommendations"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <CheckCircle2 size={15} /> Medidas de seguimiento
        {query.data && <span>{query.data.items.length}</span>}
      </summary>
      {query.isPending ? (
        <p className="v2-analysis-help">Cargando medidas…</p>
      ) : query.isError ? (
        <div className="v2-error-inline" role="alert">
          <span>{errorText(query.error)}</span>
          <button
            className="v2-text-button"
            onClick={() => void query.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="v2-recommendation-list">
          {query.data.items.map((item) => {
            const href = safeHttps(item.source_url);
            return (
              <article className="v2-recommendation-item" key={item.id}>
                <p>{item.recommendation}</p>
                <div className="v2-recommendation-meta">
                  <span className={`v2-status v2-status-${item.status}`}>
                    {statusLabel(item.status)}
                  </span>
                  {item.due_at && (
                    <span>
                      Vence {new Date(item.due_at).toLocaleDateString("es-MX")}
                    </span>
                  )}
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      Fuente <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                {canWrite && (
                  <label className="v2-recommendation-state">
                    Estado
                    <select
                      value={item.status}
                      disabled={update.isPending}
                      onChange={(event) =>
                        update.mutate({
                          item,
                          status: event.target.value as RecommendationStatus,
                        })
                      }
                    >
                      <option value="pending">Pendiente</option>
                      <option value="in_progress">En corrección</option>
                      <option value="fixed">Corregido</option>
                      <option value="accepted_risk">Riesgo aceptado</option>
                    </select>
                  </label>
                )}
              </article>
            );
          })}
          {!query.data.items.length && (
            <p className="v2-analysis-help">Aún no hay medidas registradas.</p>
          )}
          {canWrite && (
            <form
              className="v2-recommendation-form"
              onSubmit={(event) => {
                event.preventDefault();
                setNotice(null);
                create.mutate();
              }}
            >
              <label>
                Medida recomendada
                <textarea
                  maxLength={4000}
                  minLength={1}
                  required
                  value={recommendation}
                  onChange={(event) => setRecommendation(event.target.value)}
                  placeholder="Ej. Revisar el aviso del proveedor y planear la actualización a una versión corregida."
                />
              </label>
              <label>
                Fuente HTTPS (opcional)
                <input
                  type="url"
                  maxLength={2048}
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://fabricante.example/aviso"
                />
              </label>
              <button
                className="v2-secondary-button"
                type="submit"
                disabled={create.isPending || !recommendation.trim()}
              >
                {create.isPending ? "Guardando…" : "Agregar medida"}
              </button>
            </form>
          )}
          {notice && (
            <p className="v2-review-saved" role="status">
              {notice}
            </p>
          )}
        </div>
      )}
    </details>
  );
}
