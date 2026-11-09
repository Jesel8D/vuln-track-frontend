import { Link } from "react-router";
import type { Finding } from "../../types/api";
import { date } from "../../components/ui";
import { Applicability } from "./RunStatus";
import { Metrics } from "./Metrics";
export function FindingsTable({
  items,
  assetId,
  runId,
}: {
  items: Finding[];
  assetId: string;
  runId: string;
}) {
  return (
    <div className="findings-table-wrap">
      <table className="findings-table">
        <caption className="sr-only">
          CVE de esta ejecución; severidad, aplicabilidad y revisión son
          conceptos distintos
        </caption>
        <thead>
          <tr>
            <th scope="col">CVE / descripción</th>
            <th scope="col">Métricas de origen</th>
            <th scope="col">Aplicabilidad</th>
            <th scope="col">Revisión</th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id}>
              <td>
                <Link
                  className="text-link mono"
                  to={`/activos/${assetId}/analisis/${runId}/hallazgos/${f.id}`}
                >
                  {f.external_id}
                </Link>
                <p className="finding-excerpt">
                  {f.title ?? "Sin descripción resumida disponible"}
                </p>
                <small className="muted">
                  Recuperado {date(f.observed_at)}
                </small>
              </td>
              <td data-label="Métricas de origen">
                <Metrics cvss={f.cvss} />
              </td>
              <td data-label="Aplicabilidad">
                <Applicability value={f.applicability} />
              </td>
              <td data-label="Revisión">
                <span className="review-status">
                  {f.status === "reviewed"
                    ? "Revisado"
                    : "Pendiente de revisión"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
