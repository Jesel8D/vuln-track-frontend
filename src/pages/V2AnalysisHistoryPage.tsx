import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CircleAlert, History } from "lucide-react";
import { Link, useParams } from "react-router";
import { useAuth } from "../features/auth/context";
import { useWorkspace } from "../features/v2/WorkspaceContext";
import { errorText } from "../services/api";
import { HistoricalFindingCard } from "../features/v2/HistoricalFindingCard";

const PAGE_SIZE = 20;

function statusLabel(status: string) {
  return status === "completed"
    ? "Completado"
    : status === "failed"
      ? "Con errores"
      : status === "running"
        ? "En curso"
        : "En cola";
}

export function V2AnalysisHistoryPage() {
  const { applicationId: routeApplicationId } = useParams();
  const { api, user } = useAuth();
  const { current } = useWorkspace();
  const canWrite = current?.role === "owner" || current?.role === "editor";
  const [offset, setOffset] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    string | null
  >(null);
  const applications = useQuery({
    queryKey: ["v2", user?.id, current?.workspace_id, "applications"],
    queryFn: ({ signal }) => api.applications(current!.workspace_id, signal),
    enabled: Boolean(current),
  });
  const applicationId =
    routeApplicationId ??
    selectedApplicationId ??
    applications.data?.items[0]?.id ??
    "";
  const application = applications.data?.items.find(
    (item) => item.id === applicationId,
  );
  const history = useQuery({
    queryKey: [
      "v2",
      user?.id,
      current?.workspace_id,
      applicationId,
      "analysis-history",
      offset,
    ],
    queryFn: ({ signal }) =>
      api.v2AnalysisHistory(
        current!.workspace_id,
        applicationId,
        PAGE_SIZE,
        offset,
        signal,
      ),
    enabled: Boolean(current && applicationId),
  });
  const selectedFindings = useQuery({
    queryKey: [
      "v2",
      user?.id,
      current?.workspace_id,
      applicationId,
      selectedRunId,
      "findings",
      0,
    ],
    queryFn: ({ signal }) =>
      api.v2Findings(
        current!.workspace_id,
        applicationId,
        selectedRunId!,
        0,
        signal,
      ),
    enabled: Boolean(current && applicationId && selectedRunId),
  });

  if (applications.isPending || (history.isPending && application)) {
    return (
      <div className="v2-loading" role="status">
        Cargando historial…
      </div>
    );
  }
  if (applications.isError || history.isError) {
    const error = applications.error ?? history.error;
    return (
      <section className="v2-panel v2-error-panel">
        <CircleAlert />
        <div>
          <h1>No se pudo cargar el historial</h1>
          <p>{errorText(error)}</p>
          <button
            className="v2-secondary-button"
            onClick={() =>
              void (applications.isError
                ? applications.refetch()
                : history.refetch())
            }
          >
            Reintentar
          </button>
        </div>
      </section>
    );
  }
  if (!routeApplicationId && applications.data?.items.length === 0) {
    return (
      <section className="v2-panel v2-empty-inline">
        <History aria-hidden="true" />
        <h1>Aún no hay análisis registrados</h1>
        <p>
          Registra una aplicación y añade sus tecnologías para comenzar tu
          historial.
        </p>
        <Link className="v2-secondary-button" to="/aplicaciones">
          {canWrite ? "Registrar aplicación" : "Ver aplicaciones"}
        </Link>
      </section>
    );
  }
  if (!application) {
    return (
      <section className="v2-panel v2-empty-inline">
        <CircleAlert />
        <h1>Aplicación no disponible</h1>
        <p>No encontramos la aplicación en el workspace activo.</p>
        <Link className="v2-secondary-button" to="/aplicaciones">
          Volver al inventario
        </Link>
      </section>
    );
  }

  const result = history.data;
  const pageCount = Math.max(
    1,
    Math.ceil((result?.page.total ?? 0) / PAGE_SIZE),
  );
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="v2-page">
      <Link className="v2-back-link" to={`/aplicaciones/${application.id}`}>
        <ArrowLeft size={16} /> {application.name}
      </Link>
      <section className="v2-panel v2-inventory-panel">
        <div className="v2-panel-heading">
          <div>
            <p className="v2-eyebrow">CONSULTAS NVD</p>
            <h1>Historial de análisis</h1>
            <p>Consultas de CVE registradas para {application.name}.</p>
          </div>
          <History size={22} aria-hidden="true" />
        </div>
        {!routeApplicationId && applications.data?.items.length ? (
          <label className="v2-history-application-picker">
            <span>Aplicación</span>
            <select
              value={applicationId}
              onChange={(event) => {
                setOffset(0);
                setSelectedApplicationId(event.target.value);
              }}
            >
              {applications.data.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {result?.items.length ? (
          <>
            <div className="v2-table-wrap">
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>TECNOLOGÍA</th>
                    <th>FECHA</th>
                    <th>ESTADO</th>
                    <th>COBERTURA</th>
                    <th>HALLAZGOS</th>
                    <th>RESULTADOS</th>
                    <th>AVISOS</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <strong>
                          {run.product} {run.version}
                        </strong>
                        <small>{run.id}</small>
                      </td>
                      <td>
                        {new Date(run.created_at).toLocaleString("es-MX")}
                      </td>
                      <td>
                        <span className={`v2-status v2-status-${run.status}`}>
                          {statusLabel(run.status)}
                        </span>
                      </td>
                      <td>
                        {run.coverage === "complete"
                          ? "Completa"
                          : run.coverage === "partial"
                            ? "Parcial"
                            : "Sin determinar"}
                      </td>
                      <td>{run.stored_count}</td>
                      <td>
                        <button
                          className="v2-text-button"
                          aria-expanded={selectedRunId === run.id}
                          onClick={() =>
                            setSelectedRunId(
                              selectedRunId === run.id ? null : run.id,
                            )
                          }
                        >
                          {selectedRunId === run.id
                            ? "Ocultar"
                            : "Ver resultados"}
                        </button>
                      </td>
                      <td>
                        {run.warning_codes.length
                          ? run.warning_codes.join(", ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedRunId && (
              <section className="v2-history-results" aria-live="polite">
                <h2>Resultados de la consulta seleccionada</h2>
                {selectedFindings.isPending ? (
                  <p className="v2-loading" role="status">
                    Cargando resultados…
                  </p>
                ) : selectedFindings.isError ? (
                  <div className="v2-error-inline" role="alert">
                    <span>{errorText(selectedFindings.error)}</span>
                    <button
                      className="v2-text-button"
                      onClick={() => void selectedFindings.refetch()}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : selectedFindings.data.items.length ? (
                  <div className="v2-history-findings-list">
                    {selectedFindings.data.items.map((finding) => (
                      <HistoricalFindingCard
                        key={finding.id}
                        finding={finding}
                        workspaceId={current!.workspace_id}
                        applicationId={application.id}
                        canWrite={canWrite && application.status === "active"}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="v2-analysis-help">
                    Esta consulta no guardó hallazgos.
                  </p>
                )}
              </section>
            )}
            <div
              className="v2-pagination"
              aria-label="Paginación del historial"
            >
              <span>
                {result.page.total} consultas · página {pageNumber} de{" "}
                {pageCount}
              </span>
              <div>
                <button
                  className="v2-secondary-button"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Anterior
                </button>
                <button
                  className="v2-secondary-button"
                  disabled={offset + PAGE_SIZE >= result.page.total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="v2-empty-inline">
            <History size={24} />
            <h2>Aún no hay análisis registrados</h2>
            <p>
              Las consultas NVD que completes para las tecnologías confirmadas
              aparecerán aquí.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
