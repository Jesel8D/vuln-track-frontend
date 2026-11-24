import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuth } from "../auth/context";
import { errorText } from "../../services/api";
import type {
  InventoryCategory,
  InventoryDimension,
  InventoryDistribution,
  InventoryEventKey,
  InventoryEvents,
  InventoryKind,
} from "../../types/inventoryAnalytics";
import "../../styles/inventory-analytics.css";

const eventSeries: { key: InventoryEventKey; label: string; color: string }[] =
  [
    {
      key: "first_confirmations",
      label: "Primera confirmación registrada",
      color: "#326da0",
    },
    {
      key: "subsequent_confirmations",
      label: "Confirmaciones posteriores",
      color: "#7856a2",
    },
    {
      key: "technology_confirmations",
      label: "Confirmaciones de tecnologías",
      color: "#326da0",
    },
    {
      key: "version_changes",
      label: "Cambios de versión/firmware",
      color: "#ac7a25",
    },
    {
      key: "identity_changes_without_version",
      label: "Otros cambios tecnológicos",
      color: "#687c8d",
    },
  ];
const percentage = (n: number, total: number) =>
  total ? `${((n * 100) / total).toFixed(1)}%` : "No aplicable";

function categoryLink(row: InventoryCategory) {
  const params = new URLSearchParams({
    status: "active",
    manufacturer_key: row.vendor_key,
  });
  if (row.product_key) params.set("model_key", row.product_key);
  return "/dispositivos?" + params;
}

function Distribution({ data }: { data: InventoryDistribution }) {
  const rows = [
    ...data.categories.map((row) => ({
      ...row,
      id: JSON.stringify([row.vendor_key, row.product_key]),
      href: data.inventory_kind === "devices" ? categoryLink(row) : null,
    })),
    {
      id: "other",
      label: "Otros (fuera del top)",
      count: data.other,
      href: null,
    },
    {
      id: "unknown",
      label:
        data.dimension === "vendor"
          ? "Fabricante/proveedor sin registrar"
          : "Fabricante y modelo / proveedor y producto incompletos",
      count: data.unknown,
      href: null,
    },
  ];
  return (
    <>
      <p>
        <strong>
          {data.total}{" "}
          {data.total === 1 ? "registro activo" : "registros activos"}
        </strong>{" "}
        · {data.excluded_inactive} excluidos por estado inactivo.
      </p>
      <p>
        {data.inventory_kind === "devices"
          ? "Fabricante y modelo físicos del dispositivo; no describen su firmware."
          : "Proveedor y producto declarados de tecnologías de aplicaciones activas."}
      </p>
      {data.total === 0 ? (
        <p>
          No hay registros activos para esta distribución. Porcentaje no
          aplicable.
        </p>
      ) : (
        <>
          <div className="v2-inventory-distribution" aria-hidden="true">
            {rows
              .filter((row) => row.count > 0)
              .map((row) => (
                <div key={row.id} className="v2-inventory-bar-row">
                  <span>{row.label}</span>
                  <div className="v2-inventory-track">
                    <i style={{ width: percentage(row.count, data.total) }} />
                  </div>
                  <strong>{row.count}</strong>
                </div>
              ))}
          </div>
          <div
            className="v2-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Tabla de distribución del inventario"
          >
            <table className="v2-table">
              <caption>
                Distribución completa del denominador, incluidos otros y sin
                registrar
              </caption>
              <thead>
                <tr>
                  <th scope="col">Categoría</th>
                  <th scope="col">Registros</th>
                  <th scope="col">Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      {row.href ? (
                        <Link to={row.href}>{row.label}</Link>
                      ) : (
                        row.label
                      )}
                    </th>
                    <td>
                      {row.count} / {data.total}
                    </td>
                    <td>{percentage(row.count, data.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="v2-panel-footnote">
        Hasta {data.limit} categorías completas. “Otros” conserva el resto y
        “sin registrar” conserva datos incompletos. Solo se agrupan diferencias
        de mayúsculas y espacios, sin resolver nombres comerciales.
      </p>
      {data.inventory_kind === "devices" ? (
        <p>
          Los enlaces de categorías abren dispositivos activos con coincidencia
          exacta de fabricante y modelo.
        </p>
      ) : (
        <p>
          No existe un listado transversal de tecnologías.{" "}
          <Link to="/aplicaciones">
            Abrir aplicaciones (sin filtro de proveedor)
          </Link>
          .
        </p>
      )}
    </>
  );
}

function Events({ data }: { data: InventoryEvents }) {
  const series = eventSeries.filter((s) =>
    data.inventory_kind === "devices"
      ? s.key !== "technology_confirmations"
      : s.key === "technology_confirmations",
  );
  const total = series.reduce((n, s) => n + data.totals[s.key], 0);
  const dailyTotal = data.daily.map((day) =>
    series.reduce((n, s) => n + day.counts[s.key], 0),
  );
  const maximum = Math.max(1, ...dailyTotal);
  const width = 900 / data.daily.length;
  return (
    <>
      <p>
        <strong>
          {total} {total === 1 ? "evento registrado" : "eventos registrados"}
        </strong>{" "}
        · {data.window.start} a {data.daily.at(-1)!.date}, días UTC.
      </p>
      <p>
        Incluye entidades retiradas y aplicaciones archivadas. El día actual es
        parcial. Es actividad registrada, no una reconstrucción del estado
        pasado.
      </p>
      <ul className="v2-inventory-event-legend">
        {series.map((s) => (
          <li key={s.key}>
            <i aria-hidden="true" style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{data.totals[s.key]}</strong>
          </li>
        ))}
      </ul>
      {total === 0 ? (
        <p>
          No hay eventos registrados en esta ventana. Esto no demuestra que no
          hayan ocurrido cambios sin registrar.
        </p>
      ) : (
        <>
          <svg
            className="v2-inventory-event-chart"
            viewBox="0 0 900 160"
            role="img"
            aria-label={`${total} eventos CPE registrados por día UTC; valores disponibles en la tabla diaria`}
          >
            <title>
              Actividad CPE registrada, no riesgo ni cobertura histórica
            </title>
            <line x1="0" x2="900" y1="150" y2="150" stroke="#8795a7" />
            {data.daily.map((day, index) => {
              let stacked = 0;
              return (
                <g key={day.date}>
                  {series.map((s) => {
                    const h = (day.counts[s.key] / maximum) * 140;
                    stacked += h;
                    return h > 0 ? (
                      <rect
                        key={s.key}
                        x={index * width + 1}
                        y={150 - stacked}
                        width={Math.max(1, width - 2)}
                        height={h}
                        fill={s.color}
                      >
                        <title>
                          {day.date}: {s.label}, {day.counts[s.key]}
                        </title>
                      </rect>
                    ) : null;
                  })}
                </g>
              );
            })}
          </svg>
          <div className="v2-inventory-chart-dates">
            <span>{data.window.start}</span>
            <span>Máximo diario: {maximum}</span>
            <span>{data.daily.at(-1)!.date}</span>
          </div>
        </>
      )}
      <details>
        <summary>Ver tabla diaria de eventos (UTC)</summary>
        <div
          className="v2-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Tabla diaria de actividad CPE"
        >
          <table className="v2-table">
            <caption>
              Eventos registrados por día, sin duplicar revisiones
            </caption>
            <thead>
              <tr>
                <th scope="col">Fecha UTC</th>
                {series.map((s) => (
                  <th scope="col" key={s.key}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.daily.map((day) => (
                <tr key={day.date}>
                  <th scope="row">{day.date}</th>
                  {series.map((s) => (
                    <td key={s.key}>{day.counts[s.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p>
        Confirmaciones por modo CPE persistido: oficial{" "}
        {data.confirmation_modes.live}, fixture{" "}
        {data.confirmation_modes.fixture}, sin registrar{" "}
        {data.confirmation_modes.unknown}. No son resultados CVE.
      </p>
      {data.inventory_kind === "devices" ? (
        <p>
          La primera confirmación es la primera que consta por dispositivo; las
          posteriores no implican por sí mismas un cambio de firmware. Una
          revisión que cambia versión y otros campos cuenta solo como cambio de
          versión. No se suman los eventos de auditoría ni revisiones
          administrativas/físicas.
        </p>
      ) : (
        <p>
          Selecciones CPE sin evento de confirmación registrado:{" "}
          {data.selections_without_confirmation_events} (fuera de la serie). No
          existe historial de cambios de versión de tecnologías; no se deduce de
          su versión actual.
        </p>
      )}
      <p className="v2-panel-footnote">
        Pendiente y requiere revisión son estados actuales del panel de
        cobertura, no series históricas inferidas. Observado:{" "}
        {new Date(data.window.observed_at).toLocaleString("es-MX", {
          timeZone: "UTC",
        })}{" "}
        UTC.
      </p>
    </>
  );
}

export function InventoryAnalyticsPanel({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const { api, user } = useAuth();
  const [view, setView] = useState("distribution");
  const [kind, setKind] = useState<InventoryKind>("devices");
  const [dimension, setDimension] = useState<InventoryDimension>("vendor");
  const [days, setDays] = useState<30 | 90>(30);
  const distribution = useQuery({
    queryKey: [
      "v2",
      user?.id,
      workspaceId,
      "inventory-distribution",
      kind,
      dimension,
    ],
    queryFn: ({ signal }) =>
      api.inventoryDistribution(workspaceId, kind, dimension, signal),
    enabled: view === "distribution",
    staleTime: 0,
  });
  const events = useQuery({
    queryKey: ["v2", user?.id, workspaceId, "inventory-events", kind, days],
    queryFn: ({ signal }) =>
      api.inventoryEvents(workspaceId, kind, days, signal),
    enabled: view === "events",
    staleTime: 0,
  });
  const query = view === "distribution" ? distribution : events;
  return (
    <section
      className="v2-panel v2-inventory-analytics"
      aria-label="Analítica del inventario"
    >
      <h2>Inventario y actividad CPE</h2>
      <p>
        Workspace: <strong>{workspaceName}</strong>. Entidades inventariadas y
        eventos reales guardados, sin consultar el diccionario público ni medir
        riesgo.
      </p>
      <div className="v2-inventory-controls">
        <label>
          Vista de analítica
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option value="distribution">Distribución del inventario</option>
            <option value="events">Actividad CPE registrada</option>
          </select>
        </label>
        <label>
          Tipo de inventario
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as InventoryKind)}
          >
            <option value="devices">Dispositivos</option>
            <option value="technologies">Tecnologías de aplicaciones</option>
          </select>
        </label>
        {view === "distribution" ? (
          <label>
            Agrupar inventario por
            <select
              value={dimension}
              onChange={(e) =>
                setDimension(e.target.value as InventoryDimension)
              }
            >
              <option value="vendor">Fabricante / proveedor</option>
              <option value="product">
                Fabricante y modelo / proveedor y producto
              </option>
            </select>
          </label>
        ) : (
          <label>
            Ventana de actividad
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value) as 30 | 90)}
            >
              <option value={30}>30 días UTC</option>
              <option value={90}>90 días UTC</option>
            </select>
          </label>
        )}
      </div>
      <p className="v2-panel-footnote">
        Esta analítica es independiente del filtro de procedencia de consultas
        CVE del dashboard. Dispositivos y tecnologías tienen denominadores
        separados.
      </p>
      <div aria-live="polite">
        {query.isPending ? (
          <p role="status">Cargando analítica del inventario…</p>
        ) : query.isError ? (
          <div role="alert">
            <p>No se pudo cargar la analítica. {errorText(query.error)}</p>
            <button
              className="v2-secondary-button"
              onClick={() => void query.refetch()}
            >
              Reintentar analítica
            </button>
          </div>
        ) : view === "distribution" && distribution.data ? (
          <Distribution data={distribution.data} />
        ) : events.data ? (
          <Events data={events.data} />
        ) : null}
      </div>
    </section>
  );
}
