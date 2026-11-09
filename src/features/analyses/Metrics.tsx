import { metrics } from "./presentation";
export function Metrics({
  cvss,
  detail = false,
}: {
  cvss: Record<string, unknown> | null;
  detail?: boolean;
}) {
  const values = metrics(cvss);
  if (!values.length)
    return (
      <span className="muted small">
        Sin métricas CVSS disponibles{cvss ? " para presentar" : ""}. No implica
        severidad baja.
      </span>
    );
  return (
    <div className={detail ? "metric-details" : "cvss-list"}>
      {values.map((m, i) => (
        <div key={`${m.version}-${m.source}-${i}`} className="cvss-metric">
          <span className="mono">
            CVSS {m.version} <strong>{m.score.toFixed(1)}</strong>
          </span>
          <span>{m.severity ?? "Severidad no informada"}</span>
          {detail && (
            <>
              <small>
                {m.source ?? "Fuente no informada"}
                {m.type ? ` · ${m.type}` : ""}
              </small>
              {m.vector && <code>{m.vector}</code>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
