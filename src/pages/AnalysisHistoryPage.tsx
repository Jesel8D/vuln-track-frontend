import { useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Link, useParams } from "react-router";
import { useAsset, useIdentification } from "../hooks/queries";
import { useAnalyses } from "../hooks/analyses";
import {
  date,
  Empty,
  ErrorPanel,
  Loading,
  PageHeading,
  Pagination,
} from "../components/ui";
import { AnalysisSection } from "../features/analyses/AnalysisSection";
import { RunStatus } from "../features/analyses/RunStatus";
import { duration } from "../features/analyses/presentation";
export function AnalysisHistoryPage() {
  const { assetId = "" } = useParams();
  const [offset, setOffset] = useState(0);
  const asset = useAsset(assetId);
  const identity = useIdentification(assetId);
  const query = useAnalyses(assetId, 20, offset);
  if (asset.isPending) return <Loading />;
  if (!asset.data)
    return (
      <ErrorPanel error={asset.error} retry={() => void asset.refetch()} />
    );
  return (
    <>
      <Link to={`/activos/${assetId}`} className="text-link back-link">
        <ArrowLeft size={15} />
        Detalle del activo
      </Link>
      <PageHeading
        eyebrow="ANÁLISIS NVD / HISTORIAL"
        title="Consultas con trazabilidad."
        description={`${asset.data.manufacturer} ${asset.data.model} · Cada ejecución conserva su identidad y evidencia.`}
      />
      <AnalysisSection key={assetId} assetId={assetId} />
      <section className="panel" aria-labelledby="analysis-history-title">
        <div className="section-heading">
          <div>
            <h2 id="analysis-history-title">Historial de consultas</h2>
            <p>El CPE de cada fila corresponde al momento de su aceptación.</p>
          </div>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <Empty
            title="Sin consultas registradas"
            text="Cuando inicies una consulta NVD, conservarás aquí su estado, cobertura y resultados."
          />
        ) : (
          <>
            <div className="analysis-history-list">
              {query.data.items.map((run) => (
                <article key={run.id} className="analysis-history-row">
                  <div>
                    <Link
                      className="text-link"
                      to={`/activos/${assetId}/analisis/${run.id}`}
                    >
                      {date(run.created_at)}
                      <ArrowUpRight size={15} />
                    </Link>
                    <RunStatus run={run} />
                    <small className="mono muted">{duration(run)}</small>
                  </div>
                  <code className="cpe-name">{run.selected_cpe}</code>
                  {identity.data &&
                    run.identification_id !== identity.data.items[0]?.id && (
                      <span className="historical-label">
                        Identificación anterior · snapshot conservado
                      </span>
                    )}
                  {run.identification_id === null && (
                    <span className="historical-label">
                      Registro legado · procedencia incompleta
                    </span>
                  )}
                  <p className="small muted">
                    {run.stored_count} CVE distintos · {run.retrieved_count}{" "}
                    entradas recuperadas · Total NVD{" "}
                    {run.total_results ?? "no disponible"}
                  </p>
                </article>
              ))}
            </div>
            <Pagination
              {...query.data.page}
              busy={query.isFetching}
              onPage={setOffset}
            />
          </>
        )}
      </section>
    </>
  );
}
