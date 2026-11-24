import { CveQueryStatus } from "./CveQueryStatus";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/context";
import { errorText } from "../../services/api";
import { Pagination } from "./Pagination";
import { HistoricalFindingCard } from "./HistoricalFindingCard";

export function AnalysisFindings({
  workspaceId,
  applicationId,
  runId,
  canWrite,
}: {
  workspaceId: string;
  applicationId: string;
  runId: string;
  canWrite: boolean;
}) {
  const { api, user } = useAuth();
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: [
      "v2",
      user?.id,
      workspaceId,
      applicationId,
      runId,
      "findings",
      offset,
    ],
    queryFn: ({ signal }) =>
      api.v2Findings(workspaceId, applicationId, runId, offset, signal),
  });
  const analysis = query.data?.analysis;
  const evaluated = analysis?.evaluated_technology;
  return (
    <section
      className="v2-history-results"
      aria-label="Hallazgos de la consulta"
      aria-live="polite"
    >
      <h2>Resultados de la consulta seleccionada</h2>
      <p>
        Consulta: <code>{runId}</code> · Aplicación:{" "}
        <code>{applicationId}</code>
      </p>
      {analysis && (
        <>
          <p>
            Tecnología: <code>{analysis.technology_id ?? "No registrada"}</code>{" "}
            · Fecha: {new Date(analysis.created_at).toLocaleString("es-MX")}
          </p>
          <CveQueryStatus value={analysis} />
          <p>
            Producto y versión del CPE guardado:{" "}
            {evaluated
              ? `${evaluated.vendor} · ${evaluated.product} · ${evaluated.version}`
              : "No disponibles"}
            .
          </p>
          <code>{analysis.selected_cpe}</code>
        </>
      )}
      <p>
        Los hallazgos son coincidencias que requieren evaluación; un CPE no
        confirma una vulnerabilidad aplicable.
      </p>
      {query.isPending ? (
        <p role="status">Cargando resultados…</p>
      ) : query.isError ? (
        <div role="alert">
          {errorText(query.error)}{" "}
          <button
            className="v2-text-button"
            onClick={() => void query.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <p>Total: {query.data.page.total} hallazgos</p>
          {query.data.items.length ? (
            <div className="v2-history-findings-list">
              {query.data.items.map((finding) => (
                <HistoricalFindingCard
                  key={finding.id}
                  finding={finding}
                  workspaceId={workspaceId}
                  applicationId={applicationId}
                  canWrite={canWrite}
                />
              ))}
            </div>
          ) : (
            <p>Esta página no contiene hallazgos guardados.</p>
          )}
          <Pagination page={query.data.page} onChange={setOffset} />
        </>
      )}
    </section>
  );
}
