import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuth } from "../auth/context";
import { errorText } from "../../services/api";
import type { CoverageCounts } from "../../types/v2";

const states = [
  { key: "confirmed", label: "CPE confirmado" },
  { key: "pending", label: "Identificación pendiente" },
  { key: "needs_review", label: "Requiere revisión" },
] as const;

function Coverage({ title, data }: { title: string; data: CoverageCounts }) {
  return (
    <>
      <h3>{title}</h3>
      <p>
        {data.total}{" "}
        {data.total === 1 ? "registro activo" : "registros activos"} · cada
        registro cuenta una vez.
      </p>
      {data.total === 0 ? (
        <p>No hay registros activos. Porcentaje no aplicable.</p>
      ) : (
        <>
          <div className="v2-coverage-bar" aria-hidden="true">
            {states.map(({ key }) => (
              <span
                key={key}
                className={`v2-coverage-${key}`}
                style={{ width: `${(100 * data[key]) / data.total}%` }}
              />
            ))}
          </div>
          <ul className="v2-coverage-counts">
            {states.map(({ key, label }) => (
              <li key={key}>
                <span>{label}</span>
                <strong>
                  {data[key]} / {data.total}
                </strong>
                <span>{((100 * data[key]) / data.total).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function InventoryCoveragePanel({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { api, user } = useAuth();
  const query = useQuery({
    queryKey: ["v2", user?.id, workspaceId, "inventory-coverage"],
    queryFn: ({ signal }) => api.inventoryCoverage(workspaceId, signal),
    refetchOnMount: "always",
    staleTime: 0,
  });
  const data = query.data;
  return (
    <section
      className="v2-panel v2-inventory-coverage"
      aria-label="Cobertura CPE del inventario"
    >
      <h2>Cobertura CPE del inventario</h2>
      <p>
        Dispositivos y tecnologías se cuentan por separado, solo en el workspace
        activo.
      </p>
      {query.isPending ? (
        <p role="status">Cargando cobertura del inventario…</p>
      ) : query.isError ? (
        <div role="alert">
          <p>No se pudo cargar la cobertura. {errorText(query.error)}</p>
          <button
            className="v2-secondary-button"
            onClick={() => void query.refetch()}
          >
            Reintentar cobertura
          </button>
        </div>
      ) : (
        data && (
          <div className="v2-coverage-grid">
            <article aria-label="Cobertura de dispositivos">
              <Coverage title="Dispositivos" data={data.devices} />
              <p>
                Sin versión: {data.devices.without_version}. Retirados
                excluidos: {data.devices.excluded_inactive}.
              </p>
              <p>
                Confirmados por modo de catálogo: oficial{" "}
                {data.devices.confirmed_by_mode.live}, fixture{" "}
                {data.devices.confirmed_by_mode.fixture}, sin registrar{" "}
                {data.devices.confirmed_by_mode.unknown}.
              </p>
              <p>
                Requiere revisión cuando un cambio tecnológico deja sin CPE
                vigente.
              </p>
              <Link to="/dispositivos">Abrir inventario de dispositivos</Link>
            </article>
            <article aria-label="Cobertura de tecnologías de aplicaciones">
              <Coverage
                title="Tecnologías de aplicaciones"
                data={data.technologies}
              />
              <p>
                Tecnologías de aplicaciones archivadas excluidas:{" "}
                {data.technologies.excluded_inactive}.
              </p>
              <p>
                Requiere revisión si tiene un CPE sin confirmación humana. La
                procedencia se consulta por tecnología; en selecciones antiguas
                puede no estar registrada.
              </p>
              <Link to="/aplicaciones">Abrir inventario de aplicaciones</Link>
            </article>
          </div>
        )
      )}
      <p className="v2-panel-footnote">
        Un CPE confirmado identifica una tecnología; no demuestra una
        vulnerabilidad. Estos conteos no incluyen el diccionario público NVD ni
        miden riesgo.
      </p>
    </section>
  );
}
