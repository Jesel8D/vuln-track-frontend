import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { errorText } from "../../services/api";
import { useAuth } from "../auth/context";
import type { NvdApplicability, NvdFinding } from "../../types/v2";
import { FindingRecommendations } from "./FindingRecommendations";

export function HistoricalFindingCard({
  finding,
  workspaceId,
  applicationId,
  canWrite,
}: {
  finding: NvdFinding;
  workspaceId: string;
  applicationId: string;
  canWrite: boolean;
}) {
  const { api, user } = useAuth();
  const cache = useQueryClient();
  const [applicability, setApplicability] = useState<NvdApplicability>(
    finding.applicability,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const review = useMutation({
    mutationFn: () =>
      api.reviewV2Finding(
        workspaceId,
        applicationId,
        finding.id,
        applicability,
        finding.updated_at,
      ),
    onSuccess: async () => {
      setNotice("Revisión guardada en la auditoría del workspace.");
      await cache.invalidateQueries({
        queryKey: ["v2", user?.id, workspaceId, applicationId],
      });
    },
    onError: (error) => setNotice(errorText(error)),
  });
  const description = Array.isArray(finding.evidence.descriptions)
    ? (finding.evidence.descriptions.find(
        (item) =>
          item &&
          typeof item === "object" &&
          (item as { lang?: unknown }).lang === "en",
      ) as { value?: unknown } | undefined)
    : undefined;

  return (
    <article className="v2-history-finding">
      <div className="v2-finding-top">
        <span
          className={`v2-severity v2-severity-${finding.severity ?? "unknown"}`}
        >
          {(finding.severity ?? "unknown").toUpperCase()}
        </span>
        <a
          className="v2-cve-link"
          href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(finding.external_id)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {finding.external_id} <ExternalLink size={12} />
        </a>
        <span className="v2-status v2-status-info">
          {finding.status === "reviewed" ? "Revisado" : "Pendiente de revisión"}
        </span>
      </div>
      <h3>{finding.title || finding.external_id}</h3>
      <p className="v2-finding-description">
        {typeof description?.value === "string"
          ? description.value
          : "NVD no proporcionó descripción en inglés."}
      </p>
      <p className="v2-applicability-label">
        <AlertTriangle size={14} /> Aplicabilidad:{" "}
        {finding.applicability === "not_applicable"
          ? "no aplicable"
          : finding.applicability === "potential"
            ? "potencial"
            : "indeterminada"}
      </p>
      {canWrite && finding.status === "open" && (
        <div className="v2-finding-review">
          <label>
            Resultado de la revisión
            <select
              value={applicability}
              onChange={(event) =>
                setApplicability(event.target.value as NvdApplicability)
              }
            >
              <option value="potential">Potencialmente aplicable</option>
              <option value="undetermined">No se pudo determinar</option>
              <option value="not_applicable">No aplicable</option>
            </select>
          </label>
          <button
            className="v2-secondary-button"
            disabled={review.isPending}
            onClick={() => review.mutate()}
          >
            {review.isPending ? "Guardando…" : "Guardar revisión"}
          </button>
        </div>
      )}
      {notice && (
        <p className="v2-review-saved" role="status">
          {notice}
        </p>
      )}
      <FindingRecommendations
        workspaceId={workspaceId}
        applicationId={applicationId}
        findingId={finding.id}
        canWrite={canWrite}
      />
    </article>
  );
}
