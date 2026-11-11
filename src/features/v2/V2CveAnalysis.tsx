import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { ApiError, errorText } from "../../services/api";
import { useAuth } from "../auth/context";
import { v2AnalysisIntents } from "./analysisIntents";
import type {
  AnalysisAccepted,
  NvdApplicability,
  NvdFinding,
} from "../../types/v2";

const warningLabels: Record<string, string> = {
  EVIDENCE_BUDGET_REACHED:
    "Evidencia extensa: se conservó el hash y la evaluación quedó indeterminada.",
  METRICS_OMITTED:
    "Métricas CVSS omitidas por exceder el límite de almacenamiento.",
  PAGE_BUDGET_REACHED:
    "La consulta quedó parcial: NVD reportó más resultados que el límite recuperado.",
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cvssSummary(metrics: Record<string, unknown> | null) {
  if (!metrics) return null;
  for (const key of [
    "cvssMetricV40",
    "cvssMetricV31",
    "cvssMetricV30",
    "cvssMetricV2",
  ]) {
    const metric = metrics[key];
    if (!Array.isArray(metric) || !metric.length) continue;
    const first = object(metric[0]);
    const data = object(first?.cvssData);
    const score = data?.baseScore;
    const severity = data?.baseSeverity ?? first?.baseSeverity;
    const version = data?.version;
    if (typeof score === "number" && Number.isFinite(score)) {
      return `${score.toFixed(1)}${typeof severity === "string" ? ` · ${severity}` : ""}${typeof version === "string" ? ` · CVSS ${version}` : ""}`;
    }
  }
  return null;
}

function safeReference(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function FindingCard({
  finding,
  canReview,
  isReviewing,
  onReview,
}: {
  finding: NvdFinding;
  canReview: boolean;
  isReviewing: boolean;
  onReview: (applicability: NvdApplicability) => void;
}) {
  const [reviewApplicability, setReviewApplicability] =
    useState<NvdApplicability>(finding.applicability);
  const evidence = finding.evidence;
  const descriptions = Array.isArray(evidence.descriptions)
    ? evidence.descriptions
    : [];
  const englishDescription = descriptions
    .map(object)
    .find(
      (item) => item?.lang === "en" && typeof item.value === "string",
    )?.value;
  const references = Array.isArray(evidence.references)
    ? evidence.references
    : [];
  const rules = Array.isArray(evidence.rule_codes)
    ? evidence.rule_codes.filter(
        (item): item is string =>
          typeof item === "string" && /^[A-Z0-9_]{1,80}$/.test(item),
      )
    : [];
  const score = cvssSummary(finding.cvss);
  return (
    <article className="v2-finding-card">
      <div className="v2-finding-top">
        <span
          className={`v2-severity v2-severity-${finding.severity ?? "unknown"}`}
        >
          {finding.severity === "none"
            ? "SIN PUNTUACIÓN"
            : (finding.severity ?? "SEVERIDAD DESCONOCIDA").toUpperCase()}
        </span>
        <a
          className="v2-cve-link"
          href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(finding.external_id)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {finding.external_id}
          <ExternalLink size={13} />
        </a>
        {score && <span className="v2-cvss-score">{score}</span>}
      </div>
      <h4>{finding.title || "Registro CVE sin descripción breve"}</h4>
      <p className="v2-applicability-label">
        <AlertTriangle size={14} />
        {finding.status === "reviewed"
          ? finding.applicability === "potential"
            ? "Revisión manual: se conserva como potencial"
            : finding.applicability === "not_applicable"
              ? "Revisión manual: marcado como no aplicable"
              : "Revisión manual: aplicabilidad indeterminada"
          : finding.applicability === "potential"
            ? "Potencialmente aplicable · requiere revisión humana"
            : finding.applicability === "not_applicable"
              ? "Marcado como no aplicable"
              : "Aplicabilidad indeterminada · evidencia insuficiente"}
      </p>
      {canReview && finding.status === "open" && (
        <div className="v2-finding-review">
          <label>
            Resultado de la revisión
            <select
              value={reviewApplicability}
              onChange={(event) =>
                setReviewApplicability(event.target.value as NvdApplicability)
              }
              disabled={isReviewing}
            >
              <option value="potential">Potencialmente aplicable</option>
              <option value="undetermined">No se pudo determinar</option>
              <option value="not_applicable">No aplicable</option>
            </select>
          </label>
          <button
            className="v2-secondary-button"
            disabled={isReviewing}
            onClick={() => onReview(reviewApplicability)}
          >
            {isReviewing ? "Guardando…" : "Guardar revisión"}
          </button>
        </div>
      )}
      {finding.status === "reviewed" && (
        <p className="v2-review-saved" role="status">
          Revisión guardada por el equipo.
        </p>
      )}
      <p className="v2-finding-description">
        {typeof englishDescription === "string"
          ? englishDescription
          : "NVD no proporcionó una descripción en inglés para este registro."}
      </p>
      <details className="v2-evidence-details">
        <summary>
          <ChevronRight size={15} /> Evidencia y criterios
        </summary>
        <div className="v2-evidence-body">
          <dl>
            <dt>CPE consultado</dt>
            <dd>
              <code>
                {typeof evidence.selected_cpe === "string"
                  ? evidence.selected_cpe
                  : "No disponible"}
              </code>
            </dd>
            <dt>Versión observada</dt>
            <dd>
              {typeof evidence.observed_version === "string"
                ? evidence.observed_version
                : "No disponible"}
            </dd>
            <dt>Evaluador conservador</dt>
            <dd>
              {typeof evidence.evaluator === "string"
                ? evidence.evaluator
                : "No disponible"}
            </dd>
            <dt>Publicado / modificado</dt>
            <dd>
              {new Date(finding.published_at).toLocaleDateString("es-MX")} ·{" "}
              {new Date(finding.last_modified_at).toLocaleDateString("es-MX")}
            </dd>
            <dt>Estado del hallazgo</dt>
            <dd>
              {finding.status === "open"
                ? "Pendiente de revisión"
                : finding.status === "reviewed"
                  ? "Revisado"
                  : finding.status === "resolved"
                    ? "Resuelto"
                    : "Riesgo aceptado"}
            </dd>
          </dl>
          {rules.length > 0 && (
            <div className="v2-rule-codes">
              <span>Códigos de evaluación</span>
              {rules.map((rule) => (
                <code key={rule}>{rule}</code>
              ))}
            </div>
          )}
          {evidence.truncated === true && (
            <p className="v2-evidence-warning">
              El registro excedió el presupuesto de evidencia. La aplicabilidad
              se redujo a indeterminada y se conserva un hash de origen.
            </p>
          )}
          {typeof evidence.source_record_sha256 === "string" && (
            <p className="v2-evidence-hash">
              SHA-256 del registro NVD:{" "}
              <code>{evidence.source_record_sha256}</code>
            </p>
          )}
          {references.length > 0 && (
            <ul className="v2-reference-list">
              {references.slice(0, 8).map((item, index) => {
                const row = object(item);
                const href = safeReference(row?.url);
                return href ? (
                  <li key={`${href}-${index}`}>
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {typeof row?.source === "string"
                        ? row.source
                        : "Referencia NVD"}
                      <ExternalLink size={12} />
                    </a>
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </div>
      </details>
    </article>
  );
}

export function V2CveAnalysis({
  workspaceId,
  applicationId,
  technologyId,
  selectedCpe,
  confirmed,
  canWrite,
  activeApplication,
}: {
  workspaceId: string;
  applicationId: string;
  technologyId: string;
  selectedCpe: string | null;
  confirmed: boolean;
  canWrite: boolean;
  activeApplication: boolean;
}) {
  const { api, user } = useAuth();
  const cache = useQueryClient();
  const scope = [user?.id, workspaceId, applicationId, technologyId].join(":");
  const cachedIntent = v2AnalysisIntents.get(scope);
  const [runId, setRunId] = useState<string | null>(cachedIntent.runId);
  const [requestKey, setRequestKey] = useState<string | null>(
    cachedIntent.requestKey,
  );
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: (key: string) =>
      api.startV2Analysis(workspaceId, applicationId, technologyId, key),
    onSuccess: (accepted: AnalysisAccepted) => {
      setRunId(accepted.id);
      setRequestKey(null);
      setOffset(0);
      setNotice(null);
      v2AnalysisIntents.setRun(scope, accepted.id);
    },
    onError: (error) => setNotice(errorText(error)),
  });
  const run = useQuery({
    queryKey: [
      "v2",
      user?.id,
      workspaceId,
      applicationId,
      technologyId,
      "analysis",
      runId,
    ],
    queryFn: ({ signal }) =>
      api.v2Analysis(workspaceId, applicationId, runId!, signal),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || !["queued", "running"].includes(data.status)) return false;
      return Date.now() - Date.parse(data.created_at) < 15 * 60_000
        ? 4_000
        : false;
    },
  });
  const findings = useQuery({
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
      api.v2Findings(workspaceId, applicationId, runId!, offset, signal),
    enabled: Boolean(
      runId && run.data && ["completed", "failed"].includes(run.data.status),
    ),
  });
  const review = useMutation({
    mutationFn: ({
      finding,
      applicability,
    }: {
      finding: NvdFinding;
      applicability: NvdApplicability;
    }) =>
      api.reviewV2Finding(
        workspaceId,
        applicationId,
        finding.id,
        applicability,
        finding.updated_at,
      ),
    onSuccess: async () => {
      setNotice(
        "Revisión guardada y registrada en la auditoría del workspace.",
      );
      await cache.invalidateQueries({
        queryKey: [
          "v2",
          user?.id,
          workspaceId,
          applicationId,
          runId,
          "findings",
        ],
      });
    },
    onError: (error) => setNotice(errorText(error)),
  });

  const requestAnalysis = () => {
    const key = requestKey ?? crypto.randomUUID();
    setRequestKey(key);
    setRunId(null);
    v2AnalysisIntents.clear(scope);
    v2AnalysisIntents.setRequest(scope, key);
    setNotice(null);
    start.mutate(key);
  };

  const isUncertain =
    start.isError &&
    start.error instanceof ApiError &&
    start.error.status === 0;
  const warningCodes = run.data?.warning_codes ?? [];
  const findingsCount = findings.data?.page.total;

  return (
    <section className="v2-cve-analysis">
      <div className="v2-cve-analysis-heading">
        <div>
          <p className="v2-eyebrow">CONSULTA DE VULNERABILIDADES</p>
          <h4>CVEs en NVD</h4>
          <p>
            {selectedCpe ? <code>{selectedCpe}</code> : "Sin CPE seleccionado"}
          </p>
        </div>
        {canWrite && activeApplication && (
          <button
            className="v2-secondary-button"
            onClick={requestAnalysis}
            disabled={!confirmed || !selectedCpe || start.isPending}
          >
            {start.isPending ? (
              <>
                <RefreshCw size={15} className="v2-spin" /> Consultando…
              </>
            ) : requestKey ? (
              <>
                <RefreshCw size={15} /> Reintentar mismo intento
              </>
            ) : (
              <>
                <Play size={15} />{" "}
                {runId ? "Nueva consulta CVE" : "Consultar CVE"}
              </>
            )}
          </button>
        )}
      </div>
      {!confirmed || !selectedCpe ? (
        <p className="v2-analysis-help">
          Confirma primero un CPE compatible con la versión observada para
          habilitar la consulta.
        </p>
      ) : !canWrite ? (
        <p className="v2-analysis-help">
          Solo owner/editor puede iniciar una consulta CVE.
        </p>
      ) : !activeApplication ? (
        <p className="v2-analysis-help">
          Las consultas están deshabilitadas para aplicaciones archivadas.
        </p>
      ) : (
        <p className="v2-analysis-help">
          NVD consulta vulnerabilidades conocidas. No se escanea la URL y la
          coincidencia no confirma una vulnerabilidad.
        </p>
      )}
      {notice && (
        <div className="v2-analysis-notice" role="alert">
          <CircleAlert size={15} />
          <span>
            {isUncertain
              ? `${notice} Puedes reintentar el mismo intento sin crear otra solicitud.`
              : notice}
          </span>
        </div>
      )}
      {runId && run.isPending && (
        <p className="v2-loading">Cargando resultado de la consulta…</p>
      )}
      {run.isError && (
        <div className="v2-error-inline" role="alert">
          <CircleAlert size={15} />
          <span>{errorText(run.error)}</span>
          <button className="v2-text-button" onClick={() => void run.refetch()}>
            Reintentar lectura
          </button>
        </div>
      )}
      {run.data && (
        <div className="v2-run-summary">
          <div className="v2-run-status">
            <span className={`v2-run-indicator ${run.data.status}`} />
            {run.data.status === "completed"
              ? run.data.coverage === "partial"
                ? "Completada · cobertura parcial"
                : run.data.coverage === "complete"
                  ? "Completada · cobertura completa"
                  : "Completada · cobertura desconocida"
              : run.data.status === "failed"
                ? "Consulta fallida"
                : run.data.status === "running"
                  ? "En ejecución"
                  : "En cola"}
          </div>
          <div className="v2-run-counts">
            <span>
              <strong>{run.data.total_results ?? "—"}</strong> informados por
              NVD
            </span>
            <span>
              <strong>{run.data.retrieved_count}</strong> recuperados
            </span>
            <span>
              <strong>{run.data.stored_count}</strong> hallazgos guardados
            </span>
          </div>
          {run.data.source_timestamp && (
            <p className="v2-run-source">
              Datos NVD consultados{" "}
              {new Date(run.data.source_timestamp).toLocaleString("es-MX")}
            </p>
          )}
          {run.data.failure_code && (
            <p className="v2-analysis-notice" role="status">
              Código de fallo: {run.data.failure_code}
            </p>
          )}
          {warningCodes.length > 0 && (
            <ul className="v2-run-warnings">
              {warningCodes.map((warning) => (
                <li key={warning}>
                  {warningLabels[warning] ?? `Advertencia de NVD: ${warning}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {findings.isPending &&
        run.data &&
        ["completed", "failed"].includes(run.data.status) && (
          <p className="v2-loading">Cargando hallazgos…</p>
        )}
      {findings.isError && (
        <div className="v2-error-inline" role="alert">
          <CircleAlert size={15} />
          <span>{errorText(findings.error)}</span>
          <button
            className="v2-text-button"
            onClick={() => void findings.refetch()}
          >
            Reintentar
          </button>
        </div>
      )}
      {findings.data && (
        <div className="v2-findings-section">
          <div className="v2-findings-heading">
            <h5>
              Hallazgos de esta consulta <span>{findingsCount ?? 0}</span>
            </h5>
            <span>
              {findings.data.coverage === "partial"
                ? "Cobertura parcial"
                : findings.data.coverage === "complete"
                  ? "Cobertura completa"
                  : "Cobertura no disponible"}
            </span>
          </div>
          {findings.data.items.length ? (
            <div className="v2-findings-list">
              {findings.data.items.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  canReview={canWrite && activeApplication}
                  isReviewing={
                    review.isPending &&
                    review.variables?.finding.id === finding.id
                  }
                  onReview={(applicability) =>
                    review.mutate({ finding, applicability })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="v2-no-findings">
              <ShieldCheck size={19} />
              <p>NVD no devolvió CVEs para el CPE y la versión consultados.</p>
            </div>
          )}
          {findings.data.page.total > findings.data.page.limit && (
            <div className="v2-findings-pagination">
              <button
                className="v2-secondary-button"
                disabled={offset === 0 || findings.isFetching}
                onClick={() =>
                  setOffset(Math.max(0, offset - findings.data!.page.limit))
                }
              >
                Anterior
              </button>
              <span>
                {offset + 1}–
                {Math.min(
                  offset + findings.data.page.limit,
                  findings.data.page.total,
                )}{" "}
                de {findings.data.page.total}
              </span>
              <button
                className="v2-secondary-button"
                disabled={
                  offset + findings.data.page.limit >=
                    findings.data.page.total || findings.isFetching
                }
                onClick={() => setOffset(offset + findings.data!.page.limit)}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
