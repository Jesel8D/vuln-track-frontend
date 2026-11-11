import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Boxes,
  CircleAlert,
  ExternalLink,
  Fingerprint,
  History,
  Plus,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../features/auth/context";
import { useWorkspace } from "../features/v2/WorkspaceContext";
import { errorText } from "../services/api";
import type { V2Dashboard } from "../types/v2";

const severityRows = [
  { key: "critical_open", label: "Crítico", color: "#c52525" },
  { key: "high_open", label: "Alto", color: "#374a63" },
  { key: "medium_open", label: "Medio", color: "#65758d" },
  { key: "low_open", label: "Bajo", color: "#afc0dc" },
] as const;

function statusLabel(status: string) {
  return status === "completed"
    ? "Completado"
    : status === "failed"
      ? "Con errores"
      : status === "running"
        ? "En curso"
        : "En cola";
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function EmptyWorkspace() {
  const { api, user } = useAuth();
  const cache = useQueryClient();
  const workspace = useWorkspace();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api.createWorkspace(name.trim(), crypto.randomUUID()),
    onSuccess: async () => {
      setName("");
      setMessage(null);
      await cache.invalidateQueries({
        queryKey: ["v2", user?.id, "workspaces"],
      });
      workspace.refresh();
    },
    onError: (error) => setMessage(errorText(error)),
  });
  return (
    <section className="v2-empty-workspace">
      <div className="v2-empty-icon">
        <Boxes size={24} />
      </div>
      <p className="v2-eyebrow">PRIMER PASO</p>
      <h1>Crea un workspace para organizar tus aplicaciones.</h1>
      <p>
        El espacio será privado para tu cuenta. Después podrás registrar
        aplicaciones web y las tecnologías que utilizan.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(null);
          create.mutate();
        }}
      >
        <label htmlFor="workspace-name">Nombre del workspace</label>
        <div className="v2-form-row">
          <input
            id="workspace-name"
            maxLength={120}
            minLength={1}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Equipo, institución o proyecto"
          />
          <button
            className="v2-primary-button"
            type="submit"
            disabled={create.isPending || !name.trim()}
          >
            {create.isPending ? "Creando…" : "Crear workspace"}
          </button>
        </div>
      </form>
      {message && (
        <p className="v2-form-error" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}

function SeverityDistribution({ data }: { data: V2Dashboard }) {
  const total = data.summary.findings_open;
  const known = severityRows.reduce(
    (sum, row) => sum + data.summary[row.key],
    0,
  );
  const other = Math.max(0, total - known);
  const rows = [
    ...severityRows.map((row) => ({ ...row, count: data.summary[row.key] })),
    {
      key: "other",
      label: "Sin clasificación",
      color: "#d9e5f8",
      count: other,
    },
  ];
  return (
    <section className="v2-panel v2-dashboard-panel">
      <div className="v2-panel-heading">
        <div>
          <p className="v2-eyebrow">HALLAZGOS ABIERTOS</p>
          <h2>Severidad del último análisis por tecnología</h2>
          <p>Cuenta cada CVE una vez dentro de cada tecnología.</p>
        </div>
        <TriangleAlert size={20} />
      </div>
      {total > 0 ? (
        <>
          <div
            className="v2-severity-bar"
            aria-label={`${total} hallazgos abiertos`}
          >
            {rows
              .filter((row) => row.count > 0)
              .map((row) => (
                <span
                  key={row.key}
                  style={{
                    width: `${(row.count / total) * 100}%`,
                    background: row.color,
                  }}
                  title={`${row.label}: ${row.count}`}
                />
              ))}
          </div>
          <ul className="v2-severity-legend">
            {rows.map((row) => (
              <li key={row.key}>
                <span>
                  <i style={{ background: row.color }} />
                  {row.label}
                </span>
                <strong>{row.count}</strong>
                <small>
                  {total ? `${((row.count / total) * 100).toFixed(1)}%` : "0%"}
                </small>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="v2-empty-inline">
          <ShieldCheck size={22} />
          <p>No hay hallazgos abiertos en las últimas consultas finalizadas.</p>
        </div>
      )}
      <p className="v2-panel-footnote">
        Se usa la ejecución completada más reciente de cada tecnología. CVE
        repetidos en tecnologías distintas se cuentan una vez por tecnología.
        Esto no confirma aplicabilidad.
      </p>
    </section>
  );
}

function AnalysisTrend({ data }: { data: V2Dashboard }) {
  const points = data.analysis_trend.map((item, index) => ({
    ...item,
    x: 28 + index * 92,
    y:
      82 -
      (item.analyses /
        Math.max(1, ...data.analysis_trend.map((row) => row.analyses))) *
        62,
  }));
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <section className="v2-panel v2-dashboard-panel">
      <div className="v2-panel-heading">
        <div>
          <p className="v2-eyebrow">CONSULTAS NVD</p>
          <h2>Actividad de los últimos seis meses</h2>
          <p>Conteo mensual de ejecuciones guardadas.</p>
        </div>
        <Activity size={20} />
      </div>
      <div className="v2-trend-chart">
        <svg
          viewBox="0 0 520 112"
          role="img"
          aria-label="Consultas NVD por mes durante los últimos seis meses"
        >
          {[20, 51, 82].map((y) => (
            <line key={y} x1="20" y1={y} x2="500" y2={y} />
          ))}
          {points.length > 1 && <polyline points={pointString} />}
          {points.map((point) => (
            <circle key={point.month} cx={point.x} cy={point.y} r="4" />
          ))}
        </svg>
        <div className="v2-trend-labels">
          {points.map((point) => (
            <span key={point.month}>
              {new Date(point.month).toLocaleDateString("es-MX", {
                month: "short",
              })}
              <strong>{point.analyses}</strong>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function V2DashboardPage() {
  const { api, user } = useAuth();
  const { current, isPending, error } = useWorkspace();
  const canWrite = current?.role === "owner" || current?.role === "editor";
  const query = useQuery({
    queryKey: ["v2", user?.id, current?.workspace_id, "dashboard"],
    queryFn: ({ signal }) => api.v2Dashboard(current!.workspace_id, signal),
    enabled: Boolean(current),
    refetchInterval: 30_000,
  });

  if (isPending)
    return (
      <div className="v2-loading" role="status">
        Cargando tus workspaces…
      </div>
    );
  if (error)
    return (
      <section className="v2-panel v2-error-panel">
        <CircleAlert />
        <div>
          <h2>No se pudieron cargar los workspaces</h2>
          <p>{errorText(error)}</p>
        </div>
      </section>
    );
  if (!current) return <EmptyWorkspace />;

  return (
    <div className="v2-page">
      <section className="v2-security-banner">
        <div className="v2-security-icon">
          <ShieldCheck size={26} />
        </div>
        <div className="v2-security-copy">
          <p className="v2-eyebrow">
            ESTADO DEL WORKSPACE{" "}
            <span className="v2-pill v2-pill-info">NVD bajo demanda</span>
          </p>
          <h1>{current.name}</h1>
          <p>
            {query.data
              ? `${query.data.summary.authorized_targets_total} de ${query.data.summary.targets_total} URLs con autorización vigente registrada.`
              : "Consulta CVE por CPE y versión confirmados."}
          </p>
        </div>
        {canWrite ? (
          <Link className="v2-primary-button" to="/aplicaciones">
            <Plus size={18} /> Registrar aplicación
          </Link>
        ) : (
          <span className="v2-readonly-label">Acceso de solo lectura</span>
        )}
      </section>

      {query.isPending ? (
        <div className="v2-loading" role="status">
          Cargando resumen del workspace…
        </div>
      ) : query.isError ? (
        <section className="v2-panel v2-error-panel">
          <CircleAlert />
          <div>
            <h2>No se pudo cargar el dashboard</h2>
            <p>{errorText(query.error)}</p>
            <button
              className="v2-secondary-button"
              onClick={() => void query.refetch()}
            >
              Reintentar
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="v2-stat-grid" aria-label="Resumen del workspace">
            <article className="v2-stat-card">
              <div className="v2-stat-top">
                <span>APLICACIONES ACTIVAS</span>
                <Boxes size={20} />
              </div>
              <strong>{query.data.summary.applications_total}</strong>
              <p>Dentro del workspace</p>
            </article>
            <article className="v2-stat-card">
              <div className="v2-stat-top">
                <span>CONSULTAS NVD</span>
                <History size={20} />
              </div>
              <strong>{query.data.summary.analyses_total}</strong>
              <p>
                {query.data.summary.analyses_in_progress} en curso ·{" "}
                {query.data.summary.analyses_failed} con errores
              </p>
            </article>
            <article className="v2-stat-card">
              <div className="v2-stat-top">
                <span>HALLAZGOS ABIERTOS</span>
                <Fingerprint size={20} />
              </div>
              <strong>{query.data.summary.findings_open}</strong>
              <p>En últimas consultas completadas por tecnología</p>
            </article>
            <article className="v2-stat-card v2-stat-alert">
              <div className="v2-stat-top">
                <span>CRÍTICOS Y ALTOS ABIERTOS</span>
                <TriangleAlert size={20} />
              </div>
              <strong>
                {query.data.summary.critical_open +
                  query.data.summary.high_open}
              </strong>
              <p>
                {query.data.summary.critical_open} críticos ·{" "}
                {query.data.summary.high_open} altos
              </p>
            </article>
          </section>

          <section className="v2-dashboard-target-note">
            <ShieldCheck size={17} />
            <span>
              {query.data.summary.targets_total} destinos registrados ·{" "}
              {query.data.summary.authorized_targets_total} con autorización
              vigente registrada.
            </span>
            <strong>ZAP Baseline aún no está habilitado.</strong>
            <Link to="/aplicaciones">
              Ver inventario <ArrowRight size={14} />
            </Link>
          </section>

          <div className="v2-dashboard-grid">
            <SeverityDistribution data={query.data} />
            <AnalysisTrend data={query.data} />
          </div>

          <div className="v2-dashboard-grid v2-dashboard-bottom">
            <section className="v2-panel v2-dashboard-panel">
              <div className="v2-panel-heading">
                <div>
                  <p className="v2-eyebrow">EJECUCIONES RECIENTES</p>
                  <h2>Consultas NVD</h2>
                  <p>Hasta cinco ejecuciones reales del workspace.</p>
                </div>
                <Link className="v2-text-link" to="/historial">
                  Ver historial <ArrowRight size={15} />
                </Link>
              </div>
              {query.data.recent_analyses.length ? (
                <div className="v2-table-wrap">
                  <table className="v2-table">
                    <thead>
                      <tr>
                        <th>APLICACIÓN / TECNOLOGÍA</th>
                        <th>FECHA</th>
                        <th>ESTADO</th>
                        <th>CVEs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.recent_analyses.map((run) => (
                        <tr key={run.id}>
                          <td>
                            <Link to={`/aplicaciones/${run.application_id}`}>
                              <strong>{run.application_name}</strong>
                            </Link>
                            <small>
                              {run.product} {run.version}
                            </small>
                          </td>
                          <td>{formatDate(run.created_at)}</td>
                          <td>
                            <span
                              className={`v2-status v2-status-${run.status}`}
                            >
                              {statusLabel(run.status)}
                            </span>
                          </td>
                          <td>{run.finding_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="v2-empty-inline">
                  <History size={21} />
                  <p>Aún no hay consultas NVD.</p>
                  <Link className="v2-secondary-button" to="/aplicaciones">
                    Abrir aplicaciones
                  </Link>
                </div>
              )}
            </section>

            <section className="v2-panel v2-dashboard-panel">
              <div className="v2-panel-heading">
                <div>
                  <p className="v2-eyebrow">PRIORIDAD</p>
                  <h2>Hallazgos abiertos</h2>
                  <p>Última consulta completada por tecnología.</p>
                </div>
                <TriangleAlert size={20} />
              </div>
              {query.data.priority_findings.length ? (
                <div className="v2-priority-list">
                  {query.data.priority_findings.map((finding) => (
                    <article className="v2-priority-card" key={finding.id}>
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
                      </div>
                      <h3>{finding.title || finding.external_id}</h3>
                      <p>
                        {finding.product} {finding.version} ·{" "}
                        {finding.application_name}
                      </p>
                      <Link
                        to={`/aplicaciones/${finding.application_id}/historial`}
                      >
                        Ver historial y revisar <ArrowRight size={13} />
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="v2-empty-inline">
                  <ShieldCheck size={21} />
                  <p>
                    No hay hallazgos abiertos en el último análisis completado
                    por tecnología.
                  </p>
                </div>
              )}
              <p className="v2-panel-footnote">
                El dashboard no confirma aplicabilidad. Revisa la evidencia
                antes de tomar medidas.
              </p>
            </section>
          </div>
          <p className="v2-dashboard-footnote">
            Los hallazgos corresponden a la ejecución completada más reciente de
            cada tecnología; el mismo CVE en productos distintos se cuenta por
            separado. Las consultas NVD no escanean la URL.
          </p>
        </>
      )}
    </div>
  );
}
