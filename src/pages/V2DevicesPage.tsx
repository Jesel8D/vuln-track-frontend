import { isCveReliability } from "../services/cveReliabilityContract";
import { CveQueryStatus } from "../features/v2/CveQueryStatus";
import type { CveReliability } from "../types/cveReliability";
import { Pagination } from "../features/v2/Pagination";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../features/auth/context";
import {
  CpeCatalogFields,
  HardwareReference,
} from "../features/devices/CpeCatalogFields";
import type { CatalogCandidate } from "../features/devices/CpeCatalogFields";
import {
  DeviceEditor,
  DeviceRevisionHistory,
} from "../features/devices/DeviceRevisions";
import { useWorkspace } from "../features/v2/WorkspaceContext";
import { errorText } from "../services/api";
import type { CpeCandidateList } from "../types/v2";

type DeviceType = "router" | "switch" | "server";
type Mode = "fixture" | "live" | "unknown";
type Identification = {
  id: string;
  cpe_name_id: string;
  cpe_name: string;
  mode: Mode;
  created_at: string;
  reason: string;
  identity_generation?: number;
  catalog_evidence?: {
    source?: string;
    observed_vendor?: string | null;
    observed_product?: string | null;
    observed_version?: string | null;
    nvd_modified?: string;
  } | null;
};
type Device = {
  current_cve_query_state?:
    "recorded" | "not_queried" | "unknown" | "identification_required";
  id: string;
  record_version: number;
  cpe_review_state: "pending" | "confirmed" | "needs_review";
  device_type: DeviceType;
  manufacturer: string;
  model: string;
  product_vendor: string | null;
  product: string | null;
  component_kind: string;
  version: string | null;
  site_label: string;
  inventory_label: string | null;
  notes: string | null;
  status: "active" | "retired";
  created_at: string;
  updated_at: string;
  cpe_confirmed?: boolean;
  current_identification?: Identification | null;
};
type Run = CveReliability & {
  id: string;
  mode: Mode;
  status: "running" | "completed" | "failed";
  selected_cpe: string;
  is_current_technology: boolean;
  evaluated_technology: {
    product_vendor: string | null;
    product: string | null;
    observed_version: string;
    basis: "observed" | "historical_cpe";
  };
  coverage: "complete" | "partial" | null;
  total_results: number | null;
  retrieved_count: number;
  stored_count: number;
  created_at: string;
  source_timestamp: string | null;
  failure_code: string | null;
  warning_codes: string[];
};
type Applicability = "potential" | "undetermined" | "not_applicable";
type Finding = {
  id: string;
  title: string | null;
  external_id: string;
  severity: string;
  status: "open" | "reviewed";
  updated_at: string;
  applicability: Applicability;
  review_reason: string | null;
  review_evidence: string | null;
  published_at: string;
  last_modified_at: string;
  cvss: object | null;
  evidence: object;
};
type Measure = { id: string; recommendation: string };
type Page<T> = {
  items: T[];
  page: { total: number; offset: number; limit: number };
};

const types = { router: "Router", switch: "Switch", server: "Servidor" };
const components = {
  firmware: "Firmware",
  os: "Sistema operativo",
  software: "Software",
  hardware: "Hardware",
};
const applicability = {
  potential: "Potencial",
  undetermined: "Indeterminada",
  not_applicable: "No aplicable",
};
const stages = {
  running: "En curso",
  completed: "Completada",
  failed: "Fallida",
};
const time = (value: string) => new Date(value).toLocaleString("es-MX");
const base = (workspace: string) =>
  "/api/v2/workspaces/" + encodeURIComponent(workspace) + "/devices";
export const modeLabel = (mode?: string) =>
  mode === "live"
    ? "Fuente oficial NVD"
    : mode === "fixture"
      ? "NVD de fixture"
      : "Procedencia sin registrar";

function IdentificationDetails({
  entry,
  currentId,
}: {
  entry: Identification;
  currentId?: string;
}) {
  const evidence = entry.catalog_evidence;
  return (
    <dl className="v2-cpe-provenance">
      <dt>Estado</dt>
      <dd>{entry.id === currentId ? "Vigente" : "Histórica"}</dd>
      <dt>Fuente</dt>
      <dd>
        {modeLabel(entry.mode)}
        {evidence?.source ? ` · ${evidence.source}` : ""}
      </dd>
      <dt>UUID del registro CPE</dt>
      <dd>
        <code>{entry.cpe_name_id}</code>
      </dd>
      <dt>Fabricante y producto observados</dt>
      <dd>
        {evidence?.observed_vendor ?? "No registrado"} ·{" "}
        {evidence?.observed_product ?? "No registrado"}
      </dd>
      <dt>Versión observada al confirmar</dt>
      <dd>{evidence?.observed_version ?? "No registrada"}</dd>
      <dt>Confirmación</dt>
      <dd>{time(entry.created_at)}</dd>
      <dt>Motivo</dt>
      <dd>{entry.reason}</dd>
      <dt>Evidencia del catálogo</dt>
      <dd>
        {evidence?.nvd_modified
          ? `Registro modificado por NVD: ${time(evidence.nvd_modified)}`
          : "No registrada"}
      </dd>
    </dl>
  );
}

function Feedback({
  pending,
  error,
  label = "Cargando…",
}: {
  pending?: boolean;
  error?: unknown;
  label?: string;
}) {
  if (error)
    return (
      <p role="alert" className="v2-error-panel">
        {errorText(error)}
      </p>
    );
  return pending ? <p role="status">{label}</p> : null;
}

function DeviceForm({
  workspace,
  onCreated,
}: {
  workspace: string;
  onCreated: () => void;
}) {
  const { api } = useAuth();
  const [manual, setManual] = useState(false);
  const [deviceType, setDeviceType] = useState<DeviceType>("router");
  const [hardware, setHardware] = useState({ vendor: "", model: "" });
  const [manualHardware, setManualHardware] = useState<typeof hardware | null>(
    null,
  );
  const [manualPhysical, setManualPhysical] = useState(false);
  const manufacturerInput = useRef<HTMLInputElement>(null);
  const { vendor: manufacturer, model } =
    (manualPhysical ? manualHardware : null) ?? hardware;
  const physicalReady = !!(manufacturer.trim() && model.trim());
  const [component, setComponent] =
    useState<keyof typeof components>("firmware");
  const [selection, setSelection] = useState<CatalogCandidate | null>(null);
  const [manualValues, setManualValues] = useState({
    vendor: "",
    product: "",
    version: "",
  });
  useEffect(() => {
    if (manualPhysical) manufacturerInput.current?.focus();
  }, [manualPhysical]);
  const lastRequest = useRef<{ json: string; key: string } | null>(null);
  const create = useMutation({
    mutationFn: (body: object) => {
      const json = JSON.stringify(body);
      if (lastRequest.current?.json !== json) {
        lastRequest.current = { json, key: crypto.randomUUID() };
      }
      return api.request<Device>(base(workspace), {
        method: "POST",
        key: lastRequest.current.key,
        body,
      });
    },
    onSuccess: onCreated,
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!physicalReady || (!manual && (!selection || selection.deprecated)))
      return;
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(
      Array.from(form.entries(), ([key, value]) => [
        key,
        String(value).trim() || null,
      ]),
    );
    const { observation, confirmation_reason, ...body } = data;
    const payload = {
      ...body,
      manufacturer: manufacturer.trim(),
      model: model.trim(),
    };
    if (manual) {
      create.mutate(payload);
    } else if (selection && observation === "yes" && confirmation_reason) {
      create.mutate({
        ...payload,
        product_vendor: selection.vendor,
        product: selection.product,
        version: selection.version,
        catalog_selection: {
          cpe_name_id: selection.cpe_name_id,
          expected_cpe_name: selection.cpe_name,
          expected_nvd_modified: selection.nvd_modified,
          mode: selection.mode,
          reason: confirmation_reason,
          confirmed: true,
        },
      });
    }
  }
  const part =
    component === "hardware" ? "h" : component === "software" ? "a" : "o";
  return (
    <form onSubmit={submit} className="rc2-form">
      <h2>Registrar dispositivo</h2>
      <div className="rc2-fields rc2-device-identity">
        <label>
          Tipo de dispositivo
          <select
            name="device_type"
            value={deviceType}
            onChange={(event) =>
              setDeviceType(event.target.value as DeviceType)
            }
          >
            {Object.entries(types).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {manualPhysical ? (
          <>
            <label>
              Fabricante del equipo
              <input
                ref={manufacturerInput}
                required
                maxLength={120}
                value={manufacturer}
                onChange={(event) =>
                  setManualHardware({ vendor: event.target.value, model })
                }
              />
            </label>
            <label>
              Modelo del equipo
              <input
                required
                maxLength={120}
                value={model}
                onChange={(event) =>
                  setManualHardware({
                    vendor: manufacturer,
                    model: event.target.value,
                  })
                }
              />
            </label>
          </>
        ) : (
          <HardwareReference
            vendor={hardware.vendor}
            model={hardware.model}
            onApply={(vendor, model) => setHardware({ vendor, model })}
          />
        )}
      </div>
      <div className="rc2-actions">
        {!manualPhysical && (
          <p>Usa una referencia de hardware NVD que coincida con el equipo.</p>
        )}
        <button
          type="button"
          className="v2-secondary-button"
          onClick={() => {
            if (!manualPhysical)
              setManualHardware((draft) => draft ?? hardware);
            setManualPhysical(!manualPhysical);
          }}
        >
          {manualPhysical
            ? "Volver a los desplegables"
            : "No encuentro mi equipo"}
        </button>
      </div>
      <div className="rc2-fields rc2-device-admin">
        <label>
          Ubicación administrativa
          <input name="site_label" required maxLength={120} />
        </label>
        <label>
          Etiqueta de inventario
          <input name="inventory_label" maxLength={120} />
        </label>
        <label>
          Componente principal
          <select
            name="component_kind"
            value={component}
            onChange={(event) => {
              setComponent(event.target.value as keyof typeof components);
              setSelection(null);
            }}
          >
            {Object.entries(components).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notas no sensibles
          <textarea name="notes" maxLength={1000} />
        </label>
      </div>
      <div className="rc2-actions">
        <button
          type="button"
          className="v2-secondary-button"
          onClick={() => {
            setManual(!manual);
            setSelection(null);
          }}
        >
          {manual ? "Usar catálogo CPE" : "Registrar sin identificación CPE"}
        </button>
      </div>
      {manual ? (
        <>
          <p>
            Pendiente de identificación CPE. Captura solo los datos del producto
            que conozcas.
          </p>
          <div className="rc2-fields">
            <label>
              Fabricante del producto
              <input
                name="product_vendor"
                maxLength={120}
                value={manualValues.vendor}
                onChange={(event) =>
                  setManualValues({
                    ...manualValues,
                    vendor: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Producto principal
              <input
                name="product"
                maxLength={160}
                value={manualValues.product}
                onChange={(event) =>
                  setManualValues({
                    ...manualValues,
                    product: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Versión observada
              <input
                name="version"
                maxLength={120}
                placeholder="Dejar vacía si es desconocida"
                value={manualValues.version}
                onChange={(event) =>
                  setManualValues({
                    ...manualValues,
                    version: event.target.value,
                  })
                }
              />
            </label>
          </div>
        </>
      ) : (
        <>
          <CpeCatalogFields
            key={part}
            part={part}
            selection={selection}
            onSelect={setSelection}
          />
          {physicalReady && selection && !selection.deprecated && (
            <fieldset
              className="rc22-catalog"
              key={JSON.stringify([
                selection.cpe_name_id,
                selection.mode,
                selection.nvd_modified,
                deviceType,
                manufacturer,
                model,
                manualPhysical,
                component,
              ])}
            >
              <legend>Confirmación humana</legend>
              <dl className="rc31-confirmation-details">
                <dt>Equipo observado</dt>
                <dd>
                  {types[deviceType]} · {manufacturer} {model}
                </dd>
                <dt>Componente</dt>
                <dd>
                  {components[component]} · {selection.vendor}{" "}
                  {selection.product}
                </dd>
                <dt>Versión por confirmar</dt>
                <dd>{selection.version}</dd>
                <dt>CPE seleccionado</dt>
                <dd>
                  <code>{selection.cpe_name}</code>
                </dd>
                <dt>Fuente y fecha</dt>
                <dd>
                  {selection.mode === "fixture"
                    ? "Captura fixture"
                    : selection.source === "nvd-feed"
                      ? "Diccionario oficial NVD"
                      : "API oficial NVD"}
                  {" · "}
                  {new Date(selection.nvd_modified).toLocaleDateString("es-MX")}
                </dd>
              </dl>
              <label className="rc31-check">
                <input
                  type="checkbox"
                  name="observation"
                  value="yes"
                  required
                />
                Confirmo que el producto y la versión {selection.version}{" "}
                corresponden al equipo observado.
              </label>
              <label>
                Motivo de confirmación
                <input name="confirmation_reason" maxLength={500} required />
              </label>
            </fieldset>
          )}
        </>
      )}
      <Feedback
        pending={create.isPending}
        error={create.error}
        label="Guardando dispositivo…"
      />
      <button
        className="v2-primary-button"
        disabled={
          create.isPending ||
          !physicalReady ||
          (!manual && (!selection || selection.deprecated))
        }
      >
        Guardar dispositivo
      </button>
    </form>
  );
}

function Inventory({
  workspace,
  writer,
}: {
  workspace: string;
  writer: boolean;
}) {
  const { api, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const manufacturerKey = searchParams.get("manufacturer_key") ?? "";
  const modelKey = searchParams.get("model_key") ?? "";
  const [form, setForm] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState(() =>
    ["active", "retired"].includes(searchParams.get("status") ?? "")
      ? searchParams.get("status")!
      : "",
  );
  const [offset, setOffset] = useState(0);
  const list = useQuery({
    queryKey: [
      "devices",
      user?.id,
      workspace,
      query,
      category,
      status,
      offset,
      manufacturerKey,
      modelKey,
    ],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ q: query, offset: String(offset) });
      if (category) params.set("device_type", category);
      if (status) params.set("status", status);
      if (manufacturerKey) params.set("manufacturer_key", manufacturerKey);
      if (modelKey) params.set("model_key", modelKey);
      return api.request<Page<Device>>(base(workspace) + "?" + params, {
        signal,
      });
    },
  });
  return (
    <div className="v2-page">
      <header className="rc2-heading">
        <div>
          <h1>Dispositivos</h1>
          <p>Inventario de routers, switches y servidores del workspace.</p>
        </div>
        {writer && (
          <button className="v2-primary-button" onClick={() => setForm(!form)}>
            {form ? "Cerrar formulario" : "Registrar dispositivo"}
          </button>
        )}
      </header>
      {form && (
        <section className="v2-panel rc2-panel">
          <DeviceForm
            workspace={workspace}
            onCreated={() => {
              setForm(false);
              setOffset(0);
              void list.refetch();
            }}
          />
        </section>
      )}
      <section className="v2-panel rc2-panel">
        <h2>Inventario de dispositivos</h2>
        {(manufacturerKey || modelKey) && (
          <p>
            Filtro exacto de la gráfica: fabricante {manufacturerKey || "todos"}
            {modelKey ? ` · modelo ${modelKey}` : ""}.{" "}
            <button
              className="v2-text-button"
              onClick={() => {
                setSearchParams({});
                setStatus("");
                setOffset(0);
              }}
            >
              Quitar filtro exacto
            </button>
          </p>
        )}
        <div className="rc2-fields">
          <label>
            Buscar fabricante o modelo
            <input
              maxLength={120}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label>
            Tipo
            <select
              aria-label="Filtrar tipo de dispositivo"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">Todos</option>
              {Object.entries(types).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">Todos</option>
              <option value="active">Activo</option>
              <option value="retired">Retirado</option>
            </select>
          </label>
        </div>
        <Feedback pending={list.isPending} error={list.error} />
        {list.isError && (
          <button
            className="v2-secondary-button"
            onClick={() => void list.refetch()}
          >
            Reintentar
          </button>
        )}
        {list.data?.items.length === 0 && (
          <p>No hay dispositivos con estos filtros.</p>
        )}
        {!!list.data?.items.length && (
          <div
            className="v2-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Tabla de dispositivos"
          >
            <table className="v2-table">
              <thead>
                <tr>
                  <th scope="col">Equipo</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Versión</th>
                  <th scope="col">Estado</th>
                  <th scope="col">CPE</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={"/dispositivos/" + item.id}>
                        {item.manufacturer} {item.model}
                      </Link>
                    </td>
                    <td>{types[item.device_type]}</td>
                    <td>{item.version ?? "Desconocida"}</td>
                    <td>{item.status === "active" ? "Activo" : "Retirado"}</td>
                    <td>
                      {item.cpe_confirmed
                        ? "Confirmado"
                        : "Pendiente de identificación CPE"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={list.data?.page} onChange={setOffset} />
      </section>
    </div>
  );
}

export function DeviceFindings({
  path,
  run,
  writer,
}: {
  path: string;
  run: Run;
  writer: boolean;
}) {
  const { api, user } = useAuth();
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["device-findings", user?.id, path, run.id, offset],
    queryFn: ({ signal }) =>
      api.request<Page<Finding>>(
        path + "/analyses/" + run.id + "/findings?limit=20&offset=" + offset,
        { signal },
      ),
  });
  return (
    <div className="rc2-section">
      <h3>Hallazgos de la consulta</h3>
      <p>
        Consulta: <code>{run.id}</code> · {time(run.created_at)} ·{" "}
        {modeLabel(run.mode)}
      </p>
      <p>
        Producto/version del análisis guardado:{" "}
        {run.evaluated_technology.product_vendor ?? "No registrado"} ·{" "}
        {run.evaluated_technology.product ?? "No registrado"} ·{" "}
        {run.evaluated_technology.observed_version}
      </p>
      <Feedback pending={query.isPending} error={query.error} />
      {query.isError && (
        <button className="v2-text-button" onClick={() => void query.refetch()}>
          Reintentar
        </button>
      )}
      {query.data && !query.isError && (
        <p>Total: {query.data.page.total} hallazgos</p>
      )}
      {query.data?.items.length === 0 && (
        <p>No se guardaron hallazgos en esta consulta.</p>
      )}
      {query.data?.items.map((finding) => (
        <FindingCard
          key={finding.id}
          path={path}
          finding={finding}
          writer={writer}
          onReview={() => void query.refetch()}
        />
      ))}
      {!query.isError && (
        <Pagination page={query.data?.page} onChange={setOffset} />
      )}
    </div>
  );
}

function FindingCard({
  path,
  finding,
  writer,
  onReview,
}: {
  path: string;
  finding: Finding;
  writer: boolean;
  onReview: () => void;
}) {
  const { api, user } = useAuth();
  const location = path + "/findings/" + finding.id;
  const [showMeasures, setShowMeasures] = useState(false);
  const [measureOffset, setMeasureOffset] = useState(0);
  const measures = useQuery({
    queryKey: ["device-measures", user?.id, location, measureOffset],
    enabled: showMeasures,
    queryFn: ({ signal }) =>
      api.request<Page<Measure>>(
        location + "/recommendations?offset=" + measureOffset,
        { signal },
      ),
  });
  const review = useMutation({
    mutationFn: (body: object) =>
      api.request(location, { method: "PATCH", body }),
    onSuccess: onReview,
  });
  const recommendation = useMutation({
    mutationFn: (value: string) =>
      api.request(location + "/recommendations", {
        method: "POST",
        body: { recommendation: value },
        key: crypto.randomUUID(),
      }),
    onSuccess: () => {
      setMeasureOffset(0);
      void measures.refetch();
    },
  });
  return (
    <article className="v2-panel rc2-panel">
      <h4>{finding.external_id}</h4>
      <p>
        Hallazgo: <code>{finding.id}</code>
      </p>
      <p>
        {applicability[finding.applicability]} ·{" "}
        {finding.status === "reviewed" ? "Revisado" : "Abierto"} · Severidad{" "}
        {finding.severity}
      </p>
      <p>{finding.title}</p>
      <p>
        Publicado {time(finding.published_at)} · Modificado{" "}
        {time(finding.last_modified_at)}
      </p>
      <details>
        <summary>Evidencia y métricas NVD</summary>
        <pre>
          {JSON.stringify(
            { evidencia: finding.evidence, cvss: finding.cvss },
            null,
            2,
          )}
        </pre>
      </details>
      {finding.review_reason && (
        <p>
          <strong>Motivo:</strong> {finding.review_reason}
        </p>
      )}
      {finding.review_evidence && (
        <p>
          <strong>Evidencia de revisión:</strong> {finding.review_evidence}
        </p>
      )}
      {writer && finding.status === "open" && (
        <form
          className="rc2-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            review.mutate({
              ...Object.fromEntries(data),
              expected_updated_at: finding.updated_at,
            });
          }}
        >
          <label>
            Resultado de la revisión
            <select name="applicability" defaultValue={finding.applicability}>
              {Object.entries(applicability).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motivo de revisión
            <input name="reason" required maxLength={500} />
          </label>
          <label>
            Evidencia de revisión
            <textarea name="evidence" required maxLength={2000} />
          </label>
          <Feedback pending={review.isPending} error={review.error} />
          <button className="v2-secondary-button" disabled={review.isPending}>
            Guardar revisión
          </button>
        </form>
      )}
      <details onToggle={(event) => setShowMeasures(event.currentTarget.open)}>
        <summary>Medidas recomendadas</summary>
        <div className="rc2-section">
          <Feedback
            pending={showMeasures && measures.isPending}
            error={measures.error}
          />
          {measures.data?.items.length === 0 && (
            <p>No hay medidas registradas.</p>
          )}
          <ul>
            {measures.data?.items.map((item) => (
              <li key={item.id}>{item.recommendation} · Pendiente</li>
            ))}
          </ul>
          <Pagination page={measures.data?.page} onChange={setMeasureOffset} />
          {writer && (
            <form
              className="rc2-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                recommendation.mutate(
                  String(new FormData(form).get("measure") ?? ""),
                  { onSuccess: () => form.reset() },
                );
              }}
            >
              <label>
                Medida recomendada
                <textarea name="measure" required maxLength={4000} />
              </label>
              <Feedback
                pending={recommendation.isPending}
                error={recommendation.error}
              />
              <button
                className="v2-secondary-button"
                disabled={recommendation.isPending}
              >
                Agregar medida
              </button>
            </form>
          )}
        </div>
      </details>
    </article>
  );
}

function Reidentify({
  path,
  row,
  onConfirmed,
}: {
  path: string;
  row: Device;
  onConfirmed: () => void;
}) {
  const { api } = useAuth();
  const [candidate, setCandidate] = useState<CatalogCandidate | null>(null);
  const [verified, setVerified] = useState(false);
  const part =
    row.component_kind === "hardware"
      ? "h"
      : row.component_kind === "software"
        ? "a"
        : "o";
  const save = useMutation({
    mutationFn: (reason: string) =>
      api.request(path + "/reidentification", {
        method: "POST",
        body: {
          expected_record_version: row.record_version,
          expected_identification_id: row.current_identification?.id ?? null,
          cpe_name_id: candidate?.cpe_name_id,
          expected_cpe_name: candidate?.cpe_name,
          expected_nvd_modified: candidate?.nvd_modified,
          mode: candidate?.mode,
          confirmed: verified,
          reason,
        },
      }),
    onSuccess: onConfirmed,
  });
  return (
    <form
      className="rc2-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (candidate && verified && row.version && !candidate.deprecated) {
          save.mutate(String(new FormData(event.currentTarget).get("reason")));
        }
      }}
    >
      <CpeCatalogFields
        part={part}
        selection={candidate}
        onSelect={(value) => {
          setCandidate(value);
          setVerified(false);
        }}
      />
      {candidate && !candidate.deprecated && row.version && (
        <>
          <label>
            <input
              type="checkbox"
              required
              checked={verified}
              onChange={(event) => setVerified(event.target.checked)}
            />
            Confirmo que el CPE corresponde a la versión observada
          </label>
          <label>
            Motivo de la nueva identificación
            <input name="reason" required maxLength={500} />
          </label>
          <button
            className="v2-primary-button"
            disabled={!verified || save.isPending}
          >
            Confirmar nueva identidad
          </button>
        </>
      )}
      <Feedback pending={save.isPending} error={save.error} />
    </form>
  );
}

function DeviceDetail({ path, writer }: { path: string; writer: boolean }) {
  const { api, user } = useAuth();
  const cache = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [searched, setSearched] = useState("");
  const [selection, setSelection] = useState("");
  const [selectedRun, setSelectedRun] = useState("");
  const [runOffset, setRunOffset] = useState(0);
  const [identityOffset, setIdentityOffset] = useState(0);
  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const key = ["device", user?.id, path];
  const detail = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.request<Device>(path, { signal }),
  });
  const confirmed = detail.data?.current_identification;
  const catalogId = confirmed?.cpe_name_id;
  const catalogMode = confirmed?.mode;
  const catalogCurrent = useQuery({
    queryKey: [...key, "catalog-current", catalogId, catalogMode],
    enabled:
      !!catalogId && (catalogMode === "fixture" || catalogMode === "live"),
    queryFn: ({ signal }) =>
      api.request<CatalogCandidate>(
        "/api/v2/cpe-catalog/candidates/" + catalogId + "?mode=" + catalogMode,
        { signal },
      ),
    retry: false,
  });
  const identities = useQuery({
    queryKey: [...key, "identifications", identityOffset],
    enabled: detail.isSuccess,
    queryFn: ({ signal }) =>
      api.request<Page<Identification>>(
        path + "/identifications?offset=" + identityOffset,
        { signal },
      ),
  });
  const runs = useQuery({
    queryKey: [...key, "analyses", runOffset],
    enabled: detail.isSuccess,
    queryFn: async ({ signal }) => {
      const result = await api.request<Page<Run>>(
        path + "/analyses?offset=" + runOffset,
        { signal },
      );
      if (!result.items.every(isCveReliability))
        throw new Error("Respuesta de consulta CVE incompatible");
      return result;
    },
    refetchInterval: (state) =>
      state.state.data?.items.some((item) => item.status === "running")
        ? 2500
        : false,
  });
  const search = useMutation({
    mutationFn: ({ query, offset }: { query: string; offset: number }) =>
      api.request<CpeCandidateList>(
        path +
          "/cpe-candidates?" +
          new URLSearchParams({ query, offset: String(offset) }),
      ),
  });
  const confirm = useMutation({
    mutationFn: (reason: string) =>
      api.request(path + "/identifications", {
        method: "POST",
        body: {
          cpe_name_id: selection,
          expected_identification_id:
            detail.data?.current_identification?.id ?? null,
          reason,
        },
      }),
    onSuccess: () => {
      setSelection("");
      setIdentityOffset(0);
      void cache.invalidateQueries({ queryKey: key });
    },
  });
  const analyze = useMutation({
    mutationFn: (requestKey: string) =>
      api.request<Run>(path + "/analyses", { method: "POST", key: requestKey }),
    onSuccess: (run) => {
      setSelectedRun(run.id);
      setRunOffset(0);
      void runs.refetch();
      void cache.invalidateQueries({ queryKey: key, exact: true });
    },
    onError: () => {
      void runs.refetch();
      void cache.invalidateQueries({ queryKey: key, exact: true });
    },
  });
  const row = detail.data;
  if (!row)
    return (
      <div className="v2-page">
        <Link to="/dispositivos">Volver a dispositivos</Link>
        <h1>Detalle de dispositivo</h1>
        <Feedback pending={detail.isPending} error={detail.error} />
      </div>
    );
  const active = writer && row.status === "active";
  const cveMode = import.meta.env.VITE_NVD_MODE || "disabled";
  const cveBlockedReason =
    !["fixture", "live"].includes(cveMode)
      ? "Las consultas CVE están deshabilitadas en esta instalación. Configura el backend y recompila el frontend para habilitar NVD."
      : !writer
        ? "Tu rol no permite iniciar consultas CVE."
        : row.status !== "active"
          ? "Activa el dispositivo antes de iniciar una consulta CVE."
          : !row.current_identification
            ? "Confirma primero una identificación CPE para este dispositivo."
            : null;
  const found = runs.data?.items.find((item) => item.id === selectedRun);
  return (
    <div className="v2-page">
      <Link to="/dispositivos">Volver a dispositivos</Link>
      <section className="v2-panel rc2-panel">
        <h1>
          {row.manufacturer} {row.model}
        </h1>
        <p>
          {types[row.device_type]} ·{" "}
          {row.status === "active" ? "Activo" : "Retirado"} · {row.site_label}
        </p>
        <p>
          <strong>Producto principal:</strong> {row.product_vendor}{" "}
          {row.product} ·{" "}
          {components[row.component_kind as keyof typeof components]}
        </p>
        <p>
          <strong>Versión observada:</strong> {row.version ?? "Desconocida"}
        </p>
        {row.inventory_label && <p>Inventario: {row.inventory_label}</p>}
        {row.notes && <p>{row.notes}</p>}
        <p>
          Creado {time(row.created_at)} · Actualizado {time(row.updated_at)}
        </p>
        {writer && !editing && (
          <button
            className="v2-secondary-button"
            onClick={() => setEditing(true)}
          >
            Editar dispositivo
          </button>
        )}
        {writer && editing && (
          <DeviceEditor
            key={path}
            path={path}
            device={row}
            onClose={() => setEditing(false)}
            onSave={() => {
              setEditing(false);
              setCatalogOpen(false);
              setSelection("");
              search.reset();
              confirm.reset();
              void cache.invalidateQueries({ queryKey: key });
            }}
          />
        )}
      </section>
      <DeviceRevisionHistory path={path} current={row.record_version} />
      <section className="v2-panel rc2-panel">
        <h2>Identificación CPE</h2>
        {row.current_identification ? (
          <div>
            <strong>CPE vigente</strong>
            <br />
            <code>{row.current_identification.cpe_name}</code> ·{" "}
            {modeLabel(row.current_identification.mode)}
            <IdentificationDetails
              entry={row.current_identification}
              currentId={row.current_identification.id}
            />
          </div>
        ) : (
          <p role="status">
            {row.cpe_review_state === "needs_review"
              ? "El CPE requiere una nueva revisión por el cambio del componente."
              : "No hay un CPE confirmado."}
          </p>
        )}
        {active && row.cpe_review_state === "needs_review" && (
          <>
            <button
              type="button"
              className="v2-secondary-button"
              aria-expanded={catalogOpen}
              onClick={() => setCatalogOpen(!catalogOpen)}
            >
              Buscar nueva identidad
            </button>
            {catalogOpen && (
              <Reidentify
                key={row.record_version}
                path={path}
                row={row}
                onConfirmed={() => {
                  setCatalogOpen(false);
                  setIdentityOffset(0);
                  void cache.invalidateQueries({ queryKey: key });
                }}
              />
            )}
          </>
        )}
        {catalogCurrent.data?.deprecated && (
          <p role="status">
            {catalogMode === "fixture"
              ? "La captura de demostración muestra este CPE como deprecado."
              : "NVD deprecó este CPE."}{" "}
            Revisa la identificación antes de confirmarla de nuevo. Fecha en la
            fuente{" "}
            {new Date(catalogCurrent.data.nvd_modified).toLocaleDateString(
              "es-MX",
            )}
            .
          </p>
        )}
        {!row.version && (
          <p>
            La versión es desconocida. Puedes consultar candidatos y contrastar
            el producto. La confirmación y la consulta CVE requieren una versión
            conocida.
          </p>
        )}
        <form
          className="rc2-form"
          onSubmit={(event) => {
            event.preventDefault();
            setSelection("");
            setSearched(keyword);
            search.mutate({ query: keyword, offset: 0 });
          }}
        >
          <label>
            Buscar candidatos CPE
            <input
              required
              minLength={2}
              maxLength={200}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={row.model}
            />
          </label>
          <button className="v2-secondary-button" disabled={search.isPending}>
            Buscar CPE
          </button>
        </form>
        <Feedback pending={search.isPending} error={search.error} />
        {search.isSuccess && (
          <form
            className="rc2-form"
            onSubmit={(event) => {
              event.preventDefault();
              confirm.mutate(
                String(new FormData(event.currentTarget).get("reason") ?? ""),
              );
            }}
          >
            <fieldset>
              <legend>Candidatos oficiales</legend>
              {search.data.items.length === 0 && (
                <p>No se encontraron candidatos.</p>
              )}
              {search.data.items.map((item) => (
                <label className="rc2-candidate" key={item.cpe_name_id}>
                  <input
                    type="radio"
                    name="candidate"
                    value={item.cpe_name_id}
                    checked={selection === item.cpe_name_id}
                    disabled={!active || !row.version || item.deprecated}
                    onChange={() => setSelection(item.cpe_name_id)}
                  />
                  <span>
                    <strong>{item.title ?? "Producto del catálogo"}</strong>
                    {item.deprecated ? " · Deprecado" : ""}
                    <br />
                    <code>{item.cpe_name}</code>
                  </span>
                </label>
              ))}
            </fieldset>
            <Pagination
              page={search.data.page}
              onChange={(offset) => {
                setSelection("");
                search.mutate({ query: searched, offset });
              }}
            />
            {!!search.data.items.length && active && row.version && (
              <>
                <label>
                  Motivo de confirmación
                  <input name="reason" required maxLength={500} />
                </label>
                <button
                  className="v2-secondary-button"
                  disabled={!selection || confirm.isPending}
                >
                  Confirmar CPE
                </button>
              </>
            )}
            <Feedback pending={confirm.isPending} error={confirm.error} />
          </form>
        )}
        <h3>Historial de identificaciones</h3>
        <Feedback pending={identities.isPending} error={identities.error} />
        {identities.data?.items.length === 0 && <p>Sin cambios registrados.</p>}
        <ul>
          {identities.data?.items.map((entry) => (
            <li key={entry.id}>
              {time(entry.created_at)} · {modeLabel(entry.mode)} ·{" "}
              {entry.reason}
              <br />
              <code>{entry.cpe_name}</code>
              <IdentificationDetails
                entry={entry}
                currentId={row.current_identification?.id}
              />
            </li>
          ))}
        </ul>
        <Pagination page={identities.data?.page} onChange={setIdentityOffset} />
      </section>
      <section className="v2-panel rc2-panel">
        <h2>Consultas CVE del dispositivo</h2>
        <p>
          {cveMode === "fixture"
            ? "La consulta usa datos de demostración y el CPE confirmado. No consulta NVD en vivo ni confirma vulnerabilidades."
            : cveMode === "live"
              ? "La consulta obtiene CVE reales de NVD para el CPE confirmado. La coincidencia es indicativa y requiere validación del activo."
              : "El historial conservado sigue disponible; las consultas CVE están deshabilitadas."}
        </p>
        {cveBlockedReason && (
          <p className="notice" role="status">
            {cveBlockedReason}
          </p>
        )}
        {active && (
          <button
            className="v2-primary-button"
            disabled={
              !["fixture", "live"].includes(cveMode) ||
              !row.current_identification ||
              analyze.isPending
            }
            onClick={() => analyze.mutate(crypto.randomUUID())}
          >
            {cveMode === "live" ? "Consultar CVE en NVD" : "Consultar CVE de demostración"}
          </button>
        )}
        <Feedback
          pending={analyze.isPending}
          error={analyze.error}
          label="Consultando el catálogo CVE…"
        />
        <p>
          {row.current_cve_query_state === "not_queried"
            ? "Identificación actual sin consulta registrada."
            : row.current_cve_query_state === "recorded"
              ? "Hay consultas asociadas a la identificación actual; revise su cobertura y vigencia."
              : "Consulta de la identificación actual: No registrada o sin identificación confirmada."}
        </p>
        <h3>Historial de consultas</h3>
        <Feedback pending={runs.isPending} error={runs.error} />
        {runs.data?.items.length === 0 && <p>Sin consultas registradas.</p>}
        <ul className="rc2-runs">
          {runs.data?.items.map((entry) => (
            <li key={entry.id}>
              <strong>{stages[entry.status]}</strong> · {modeLabel(entry.mode)}{" "}
              · {time(entry.created_at)}
              <p>
                Cobertura{" "}
                {entry.coverage === "complete"
                  ? "completa"
                  : entry.coverage === "partial"
                    ? "parcial"
                    : "sin determinar"}
                {" · "}
                {entry.retrieved_count} recuperados de{" "}
                {entry.total_results ?? "total desconocido"} ·{" "}
                {entry.stored_count} guardados
              </p>
              <CveQueryStatus value={entry} />
              <code>{entry.selected_cpe}</code>
              <p>
                {entry.is_current_technology
                  ? "Identidad tecnológica vigente"
                  : "Identidad tecnológica anterior"}
                {" · "}
                {entry.evaluated_technology.product_vendor}{" "}
                {entry.evaluated_technology.product}
                {" · Versión evaluada "}
                {entry.evaluated_technology.observed_version}
                {entry.evaluated_technology.basis === "historical_cpe" &&
                  " · Producto derivado del CPE histórico"}
              </p>
              {entry.failure_code && <p>Resultado: {entry.failure_code}</p>}
              {!!entry.warning_codes.length && (
                <p>Avisos: {entry.warning_codes.join(", ")}</p>
              )}
              <button
                className="v2-text-button"
                aria-expanded={selectedRun === entry.id}
                onClick={() =>
                  setSelectedRun(selectedRun === entry.id ? "" : entry.id)
                }
              >
                Ver hallazgos
              </button>
            </li>
          ))}
        </ul>
        <Pagination
          page={runs.data?.page}
          onChange={(value) => {
            setSelectedRun("");
            setRunOffset(value);
          }}
        />
        {found && (
          <DeviceFindings
            key={found.id}
            path={path}
            run={found}
            writer={writer}
          />
        )}
      </section>
    </div>
  );
}

export function V2DevicesPage() {
  const { current, isPending, error } = useWorkspace();
  const { deviceId } = useParams();
  if (!current)
    return (
      <div className="v2-page">
        <h1>Dispositivos</h1>
        <Feedback pending={isPending} error={error} />
        {!isPending && !error && (
          <p>Selecciona un workspace para abrir el inventario.</p>
        )}
      </div>
    );
  const workspace = current.workspace_id;
  const writer = current.role === "owner" || current.role === "editor";
  const path = base(workspace) + "/" + encodeURIComponent(deviceId ?? "");
  return deviceId ? (
    <DeviceDetail key={path} path={path} writer={writer} />
  ) : (
    <Inventory key={workspace} workspace={workspace} writer={writer} />
  );
}
