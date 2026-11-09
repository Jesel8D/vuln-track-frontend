import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useAsset, useIdentification } from "../hooks/queries";
import { activeRun, useAnalysis, useFindings } from "../hooks/analyses";
import { useAuth } from "../features/auth/context";
import {
  Button,
  date,
  Empty,
  ErrorPanel,
  Loading,
  PageHeading,
  Pagination,
} from "../components/ui";
import { CoverageNotice, RunStatus } from "../features/analyses/RunStatus";
import { FindingsTable } from "../features/analyses/FindingsTable";
import { duration } from "../features/analyses/presentation";
export function AnalysisRunPage() {
  const { assetId = "", runId = "" } = useParams();
  const [offset, setOffset] = useState(0);
  const { user } = useAuth();
  const cache = useQueryClient();
  const asset = useAsset(assetId);
  const identity = useIdentification(assetId);
  const query = useAnalysis(assetId, runId);
  const found = useFindings(assetId, runId, offset);
  const pages = query.data?.page_count;
  const status = query.data?.status;
  useEffect(() => {
    if (
      status &&
      cache.getQueryData(["findings", user?.id, assetId, runId, offset])
    )
      void cache.invalidateQueries({
        queryKey: ["findings", user?.id, assetId, runId],
      });
  }, [cache, user?.id, assetId, runId, pages, status, offset]);
  if (query.isPending || asset.isPending)
    return <Loading text="Consultando ejecución…" />;
  if (!query.data || !asset.data)
    return (
      <ErrorPanel
        error={query.error ?? asset.error}
        retry={() => {
          void query.refetch();
          void asset.refetch();
        }}
      />
    );
  const run = query.data;
  const working = activeRun(run);
  return (
    <>
      <Link className="text-link back-link" to={`/activos/${assetId}/analisis`}>
        <ArrowLeft size={15} />
        Historial de análisis
      </Link>
      <PageHeading
        eyebrow="CONSULTA NVD / EJECUCIÓN"
        title="De consulta a evidencia."
        description={`${asset.data.manufacturer} ${asset.data.model} · Aceptada el ${date(run.created_at)}`}
        action={
          <Button
            variant="secondary"
            disabled={query.isFetching || found.isFetching}
            onClick={() => {
              void query.refetch();
              void found.refetch();
            }}
          >
            <RefreshCw size={16} />
            Actualizar estado
          </Button>
        }
      />
      {query.isError && (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      )}
      <section className="panel run-overview" aria-labelledby="run-state-title">
        <div className="run-overview-heading">
          <div>
            <p className="eyebrow">ESTADO DE LA EJECUCIÓN</p>
            <h2 id="run-state-title">
              {working
                ? "La consulta está en curso."
                : run.status === "failed"
                  ? "La consulta no obtuvo páginas válidas."
                  : run.coverage === "partial"
                    ? "La evidencia tiene límites pendientes."
                    : "Resultados conservados para revisión."}
            </h2>
          </div>
          <div role="status" aria-live="polite">
            <RunStatus run={run} />
          </div>
        </div>
        <div className="run-counters">
          <div>
            <span>Informados por NVD</span>
            <strong>{run.total_results ?? "—"}</strong>
          </div>
          <div>
            <span>Entradas recuperadas</span>
            <strong>{run.retrieved_count}</strong>
          </div>
          <div>
            <span>CVE distintos guardados</span>
            <strong>{run.stored_count}</strong>
          </div>
        </div>
        <p className="small muted">
          {run.page_count} páginas guardadas · {run.retry_count} reintentos
          externos · Duración {duration(run)}
        </p>
        <p className="small muted">
          {working
            ? "Actualización cada 4 s mientras esta vista esté visible, hasta 15 min. Ante error se pausa; puedes actualizar manualmente."
            : "Ejecución finalizada. La actualización automática está detenida."}
        </p>
        <p className="record-id mono">ID {run.id}</p>
      </section>
      <CoverageNotice run={run} />
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Identificación utilizada</h2>
            <p>
              Snapshot de esta ejecución. No cambia al sustituir el CPE actual.
            </p>
          </div>
        </div>
        <code className="cpe-name">{run.selected_cpe}</code>
        {identity.data &&
          run.identification_id !== identity.data.items[0]?.id && (
            <p className="notice">
              Esta consulta corresponde a una identificación anterior del
              activo.
            </p>
          )}
        <dl className="detail-grid run-dates">
          <div>
            <dt>Versión observada</dt>
            <dd className="mono">
              {run.observed_version ?? "Desconocida / legado"}
            </dd>
          </div>
          <div>
            <dt>Inicio</dt>
            <dd>{run.started_at ? date(run.started_at) : "Aún no inicia"}</dd>
          </div>
          <div>
            <dt>Fin</dt>
            <dd>
              {run.completed_at ? date(run.completed_at) : "Sin finalizar"}
            </dd>
          </div>
          <div>
            <dt>Respuesta de origen</dt>
            <dd>
              {run.source_timestamp
                ? date(run.source_timestamp)
                : "Sin respuesta válida"}
            </dd>
          </div>
        </dl>
        {run.nvd_cooldown_until && (
          <p className="small muted">
            Enfriamiento NVD registrado hasta {date(run.nvd_cooldown_until)}.
          </p>
        )}
      </section>
      <section
        className="panel findings-panel"
        aria-labelledby="findings-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">RESULTADOS DE ESTA EJECUCIÓN</p>
            <h2 id="findings-title">CVE recuperados</h2>
            <p>
              Severidad NVD y aplicabilidad son distintas. Ninguna correlación
              confirma vulnerabilidad en el equipo.
            </p>
          </div>
        </div>
        {found.isPending ? (
          <Loading text="Consultando hallazgos guardados…" />
        ) : found.data ? (
          <>
            {found.isError && (
              <ErrorPanel
                error={found.error}
                retry={() => void found.refetch()}
              />
            )}
            {found.data.items.length ? (
              <FindingsTable
                items={found.data.items}
                assetId={assetId}
                runId={runId}
              />
            ) : (
              <Empty
                title={
                  working
                    ? "Aún no hay CVE guardados"
                    : run.status === "failed"
                      ? "Sin resultados verificables"
                      : "Sin CVE recuperados para esta consulta"
                }
                text={
                  working
                    ? "El worker todavía puede guardar páginas. Esta vista no inicia nuevas consultas."
                    : run.status === "failed"
                      ? "La consulta falló. Revisa el error y el historial antes de solicitar otra ejecución."
                      : "No se encontraron CVE bajo los criterios consultados en la evidencia recuperada. Esto no determina la seguridad del activo."
                }
              />
            )}
            <Pagination
              {...found.data.page}
              busy={found.isFetching}
              onPage={setOffset}
            />
          </>
        ) : (
          <ErrorPanel error={found.error} retry={() => void found.refetch()} />
        )}
      </section>
    </>
  );
}
