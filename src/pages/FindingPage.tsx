import { SourceDescription } from "../features/analyses/SourceDescription";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router";
import { useAnalysis, useFinding } from "../hooks/analyses";
import { date, ErrorPanel, Loading, PageHeading } from "../components/ui";
import { ApiError } from "../services/api";
import { object } from "../services/analysisContract";
import { Applicability, CoverageNotice } from "../features/analyses/RunStatus";
import { Metrics } from "../features/analyses/Metrics";
import { ReviewForm } from "../features/analyses/ReviewForm";
import {
  applicabilityLabel,
  httpsReference,
  nvdLink,
  reasonText,
  sourceTimestamp,
} from "../features/analyses/presentation";
export function FindingPage() {
  const { assetId = "", runId = "", findingId = "" } = useParams();
  const query = useFinding(findingId);
  const run = useAnalysis(assetId, runId);
  if (query.isPending || run.isPending)
    return <Loading text="Consultando hallazgo y evidencia…" />;
  if (!query.data || !run.data)
    return (
      <ErrorPanel
        error={query.error ?? run.error}
        retry={() => {
          void query.refetch();
          void run.refetch();
        }}
      />
    );
  const f = query.data;
  const r = run.data;
  if (f.analysis_id !== r.id)
    return (
      <ErrorPanel
        error={
          new ApiError(
            404,
            "FINDING_NOT_FOUND",
            "No encontramos este hallazgo en la ejecución seleccionada.",
          )
        }
      />
    );
  const evidence = f.evidence;
  const rules = Array.isArray(evidence?.rule_codes)
    ? evidence.rule_codes.filter((v): v is string => typeof v === "string")
    : [];
  const references = Array.isArray(evidence?.references)
    ? evidence.references.filter(object)
    : [];
  const initial = evidence?.initial_applicability;
  const official = nvdLink(f.external_id);
  const published = sourceTimestamp(evidence?.published);
  const modified = sourceTimestamp(evidence?.lastModified);
  return (
    <>
      <Link
        className="text-link back-link"
        to={`/activos/${assetId}/analisis/${runId}`}
      >
        <ArrowLeft size={15} />
        Resultados de la consulta
      </Link>
      <PageHeading
        eyebrow="HALLAZGO / EVIDENCIA DE ORIGEN"
        title={f.external_id}
        description={`Recuperado el ${date(f.observed_at)} · ${f.status === "reviewed" ? "Revisado" : "Pendiente de revisión"}`}
        action={
          official ? (
            <a
              className="button secondary"
              href={official}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ficha oficial NVD
              <ExternalLink size={16} />
            </a>
          ) : undefined
        }
      />
      {query.isError && (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      )}
      {run.isError && (
        <ErrorPanel error={run.error} retry={() => void run.refetch()} />
      )}
      <section className="panel finding-identity">
        <Applicability value={f.applicability} />
        <h2>Descripción del CVE</h2>
        <SourceDescription
          descriptions={evidence?.descriptions}
          fallback={f.title}
        />
        <dl className="detail-grid">
          <div>
            <dt>Estado NVD</dt>
            <dd>
              {typeof evidence?.vulnStatus === "string"
                ? evidence.vulnStatus
                : "No disponible"}
            </dd>
          </div>
          <div>
            <dt>Publicado</dt>
            <dd>{published ? date(published) : "No disponible"}</dd>
          </div>
          <div>
            <dt>Modificado en origen</dt>
            <dd>{modified ? date(modified) : "No disponible"}</dd>
          </div>
        </dl>
      </section>
      <section className="panel">
        <h2>Métricas CVSS de origen</h2>
        <p className="muted small">
          Cada versión y fuente se conserva por separado. La severidad no
          confirma riesgo en este activo.
        </p>
        <Metrics cvss={f.cvss} detail />
      </section>
      <CoverageNotice run={r} />
      <section className="panel">
        <p className="eyebrow">CORRELACIÓN CONSERVADORA</p>
        <h2>Por qué requiere tu criterio</h2>
        <p>
          Evaluación inicial:{" "}
          <strong>
            {initial === "potential" || initial === "undetermined"
              ? applicabilityLabel[initial]
              : "No disponible en el registro legado"}
          </strong>
        </p>
        <code className="cpe-name">{r.selected_cpe}</code>
        <p className="small">
          Versión observada: {r.observed_version ?? "Desconocida"}
        </p>
        {rules.length > 0 && (
          <ul className="evaluation-reasons">
            {rules.map((code) => (
              <li key={code}>{reasonText(code)}</li>
            ))}
          </ul>
        )}
        <p className="notice">
          El evaluador no resuelve universalmente rangos de versiones,
          condiciones AND, negación ni componentes adicionales. Un CVE
          relacionado no demuestra vulnerabilidad en el dispositivo.
        </p>
        {evidence?.truncated === true && (
          <p className="notice">
            Evidencia incompleta por presupuesto: se omitieron bloques de
            origen. El hash permite cotejar un registro, no reconstruir los
            datos omitidos.
          </p>
        )}
        <details className="evidence-details">
          <summary>Configuraciones y condiciones NVD</summary>
          <pre>
            {evidence?.configurations
              ? JSON.stringify(evidence.configurations, null, 2)
              : "Sin configuraciones conservadas."}
          </pre>
        </details>
        <details className="evidence-details">
          <summary>Evidencia almacenada completa</summary>
          <pre>
            {evidence
              ? JSON.stringify(evidence, null, 2)
              : "Sin evidencia de origen disponible."}
          </pre>
        </details>
        <p className="small muted">
          Evaluador:{" "}
          {typeof evidence?.evaluator === "string"
            ? evidence.evaluator
            : "no disponible"}
        </p>
      </section>
      <section className="panel">
        <h2>Referencias de origen</h2>
        {references.length ? (
          <ul className="reference-list">
            {references.map((ref, i) => {
              const href = httpsReference(ref.url);
              return (
                <li key={i}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link"
                    >
                      {href}
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <span>
                      {typeof ref.url === "string"
                        ? ref.url
                        : "Referencia sin URL válida"}{" "}
                      <small className="muted">
                        (sin enlace: requiere HTTPS válido)
                      </small>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">Sin referencias conservadas.</p>
        )}
      </section>
      <ReviewForm key={f.id} finding={f} run={r} />
      <section className="panel">
        <h2>Trazabilidad</h2>
        <dl className="detail-grid">
          <div>
            <dt>Ejecución</dt>
            <dd>
              <Link
                className="text-link mono"
                to={`/activos/${assetId}/analisis/${runId}`}
              >
                {r.id}
              </Link>
            </dd>
          </div>
          <div>
            <dt>Actualización del hallazgo</dt>
            <dd>{date(f.updated_at)}</dd>
          </div>
        </dl>
        <p className="record-id mono">Hallazgo {f.id}</p>
      </section>
    </>
  );
}
