import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/context";
import { ApiError, errorText } from "../../services/api";

const fields = {
  device_type: "Tipo de dispositivo",
  manufacturer: "Fabricante del equipo",
  model: "Modelo físico",
  site_label: "Ubicación administrativa",
  inventory_label: "Etiqueta de inventario",
  notes: "Notas sin datos sensibles",
  status: "Estado",
  component_kind: "Componente principal",
  product_vendor: "Fabricante del componente",
  product: "Producto del componente",
  version: "Versión observada",
};
type Field = keyof typeof fields;
type Values = Partial<Record<Field, string | null>>;
export type EditableDevice = Record<Field, string | null> & {
  record_version: number;
};
const groups: { title: string; keys: Field[] }[] = [
  {
    title: "Datos administrativos",
    keys: ["site_label", "inventory_label", "notes", "status"],
  },
  {
    title: "Identidad del equipo",
    keys: ["device_type", "manufacturer", "model"],
  },
  {
    title: "Identidad del componente",
    keys: ["component_kind", "product_vendor", "product", "version"],
  },
];
const options: Partial<Record<Field, Record<string, string>>> = {
  device_type: { router: "Router", switch: "Switch", server: "Servidor" },
  component_kind: {
    firmware: "Firmware",
    os: "Sistema operativo",
    software: "Software",
    hardware: "Hardware",
  },
  status: { active: "Activo", retired: "Retirado" },
};
const sensitive = [...groups[1].keys, ...groups[2].keys];
const optional = new Set([
  "inventory_label",
  "notes",
  "product_vendor",
  "product",
  "version",
]);
const valueLabel = (value: string | null | undefined) => value ?? "Sin dato";
const stamp = (date: string) => new Date(date).toLocaleString("es-MX");
const fieldLabel = (key: Field) => fields[key] ?? key;

export function DeviceEditor({
  path,
  device,
  onSave,
  onClose,
}: {
  path: string;
  device: EditableDevice;
  onSave: (device: EditableDevice) => void;
  onClose: () => void;
}) {
  const { api } = useAuth();
  const [baseline, setBaseline] = useState(device);
  const [draft, setDraft] = useState<Values>({});
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const changes = Object.fromEntries(
    (Object.keys(draft) as Field[])
      .filter((key) => draft[key] !== baseline[key])
      .map((key) => [key, draft[key]]),
  ) as Values;
  const keys = Object.keys(changes) as Field[];
  const technological = groups[2].keys.some((key) => keys.includes(key));
  const physical = groups[1].keys.some((key) => keys.includes(key));
  const save = useMutation({
    mutationFn: () =>
      api.request<EditableDevice>(path, {
        method: "PATCH",
        body: {
          ...changes,
          expected_record_version: baseline.record_version,
          reason,
          confirm_sensitive: confirmed,
        },
      }),
    onSuccess: onSave,
  });
  const reload = useMutation({
    mutationFn: () => api.request<EditableDevice>(path),
  });
  const conflict =
    save.error instanceof ApiError &&
    save.error.code === "DEVICE_VERSION_CONFLICT";

  function update(key: Field, value: string) {
    setDraft((previous) => ({
      ...previous,
      [key]: optional.has(key) && !value ? null : value,
    }));
    if (sensitive.includes(key)) setConfirmed(false);
  }

  return (
    <form
      className="rc2-form"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2>Editar dispositivo</h2>
      <p>Revisión {baseline.record_version}</p>
      {groups.map(({ title, keys: groupKeys }) => (
        <fieldset key={title}>
          <legend>{title}</legend>
          <div className="rc2-fields">
            {groupKeys.map((key) => {
              const value = (key in draft ? draft[key] : baseline[key]) ?? "";
              const choices = options[key];
              return (
                <label key={key}>
                  {fields[key]}
                  {choices ? (
                    <select
                      value={value}
                      onChange={(event) => update(key, event.target.value)}
                    >
                      {Object.entries(choices).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : key === "notes" ? (
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={value}
                      onChange={(event) => update(key, event.target.value)}
                    />
                  ) : (
                    <input
                      required={!optional.has(key)}
                      maxLength={key === "product" ? 160 : 120}
                      value={value}
                      onChange={(event) => update(key, event.target.value)}
                      placeholder={
                        key === "version" ? "Vacío si se desconoce" : undefined
                      }
                    />
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      {technological && (
        <p role="status">
          El cambio requiere volver a confirmar un CPE. Las consultas anteriores
          se conservan.
        </p>
      )}
      {physical && (
        <p role="status">
          Revisa la referencia del equipo físico si la documentaste.
        </p>
      )}
      {(technological || physical) && (
        <label>
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          Confirmo los cambios de identidad
        </label>
      )}
      <label>
        Motivo del cambio
        <input
          required
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {save.error && (
        <p role="alert" className="v2-error-panel">
          {errorText(save.error)}
        </p>
      )}
      {conflict && (
        <div>
          <button
            type="button"
            className="v2-secondary-button"
            onClick={() => reload.mutate()}
          >
            Cargar versión actual y comparar
          </button>
          {reload.error && <p role="alert">{errorText(reload.error)}</p>}
          {reload.data && (
            <>
              <p>
                La revisión guardada es {reload.data.record_version}. Revisa los
                cambios antes de volver a editar.
              </p>
              <ul>
                {(Object.keys(fields) as Field[])
                  .filter(
                    (key) =>
                      key in changes || baseline[key] !== reload.data?.[key],
                  )
                  .map((key) => (
                    <li key={key}>
                      {fields[key]} ·{" "}
                      {key === "notes" ? (
                        "Revisa las notas en el formulario"
                      ) : (
                        <>
                          Antes: {valueLabel(baseline[key])} · Actual:{" "}
                          {valueLabel(reload.data?.[key])}
                          {key in changes && (
                            <> · Propuesta: {valueLabel(changes[key])}</>
                          )}
                        </>
                      )}
                    </li>
                  ))}
              </ul>
              <button
                type="button"
                className="v2-secondary-button"
                onClick={() => {
                  if (!reload.data) return;
                  setBaseline(reload.data);
                  setDraft({});
                  setConfirmed(false);
                  save.reset();
                  reload.reset();
                }}
              >
                Editar desde la revisión actual
              </button>
            </>
          )}
        </div>
      )}
      <div className="rc2-actions">
        <button
          className="v2-primary-button"
          disabled={!keys.length || save.isPending || conflict}
        >
          Guardar cambios
        </button>
        <button type="button" className="v2-secondary-button" onClick={onClose}>
          Cancelar edición
        </button>
      </div>
    </form>
  );
}

type Revision = {
  id: string;
  actor_id: string;
  recorded_at: string;
  previous_version: number;
  new_version: number;
  change_kind: "administrative" | "physical" | "technological";
  cpe_review_state: "pending" | "confirmed" | "needs_review";
  reason: string;
} & Difference;
type Difference = {
  changed_fields: Field[];
  previous_values: Values;
  new_values: Values;
};
const kind = {
  administrative: "Administrativo",
  physical: "Identidad física",
  technological: "Identidad tecnológica",
};
const review = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  needs_review: "Requiere revisión",
};

function Changes({
  changed_fields: keys,
  previous_values: before,
  new_values: after,
}: Difference) {
  return keys.length ? (
    <ul>
      {keys.map((key) => (
        <li key={key}>
          <strong>{fieldLabel(key)}</strong>{" "}
          {key === "notes" ? (
            "Se modificaron. El contenido se omite del historial."
          ) : (
            <>
              {valueLabel(before[key])} → {valueLabel(after[key])}
            </>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p>Sin diferencias entre estas revisiones.</p>
  );
}

export function DeviceRevisionHistory({
  path,
  current,
}: {
  path: string;
  current: number;
}) {
  const { api, user } = useAuth();
  const [offset, setOffset] = useState(0);
  const revisions = useQuery({
    queryKey: ["device", user?.id, path, "revisions", offset],
    queryFn: ({ signal }) =>
      api.request<{
        items: Revision[];
        page: { total: number; limit: number };
      }>(path + "/revisions?limit=10&offset=" + offset, { signal }),
  });
  const compare = useMutation({
    mutationFn: (versions: URLSearchParams) =>
      api.request<Difference>(path + "/revisions/compare?" + versions),
  });
  return (
    <section className="v2-panel rc2-panel">
      <h2>Historial de cambios</h2>
      {revisions.isPending && <p role="status">Cargando revisiones…</p>}
      {revisions.error && <p role="alert">{errorText(revisions.error)}</p>}
      {revisions.data?.items.length === 0 && (
        <p>Aún no se han guardado cambios.</p>
      )}
      {revisions.data?.items.map((item) => (
        <details key={item.id}>
          <summary>
            Revisión {item.new_version} · {kind[item.change_kind]} ·{" "}
            {stamp(item.recorded_at)}
          </summary>
          <p>
            Autor: <code>{item.actor_id}</code>
          </p>
          <p>
            {item.reason} · CPE: {review[item.cpe_review_state]}
          </p>
          <Changes {...item} />
        </details>
      ))}
      {revisions.data && revisions.data.page.total > 10 && (
        <div className="rc2-actions">
          <button
            type="button"
            className="v2-secondary-button"
            disabled={!offset}
            onClick={() => setOffset(offset - 10)}
          >
            Revisiones más recientes
          </button>
          <button
            type="button"
            className="v2-secondary-button"
            disabled={offset + 10 >= revisions.data.page.total}
            onClick={() => setOffset(offset + 10)}
          >
            Revisiones anteriores
          </button>
        </div>
      )}
      {current > 1 && (
        <form
          className="rc2-form"
          key={current}
          onSubmit={(event) => {
            event.preventDefault();
            const input = new FormData(event.currentTarget);
            compare.mutate(
              new URLSearchParams({
                from_version: String(input.get("from_version")),
                to_version: String(input.get("to_version")),
              }),
            );
          }}
        >
          <label>
            Desde la revisión
            <input
              type="number"
              name="from_version"
              min={1}
              max={current}
              defaultValue={1}
              required
            />
          </label>
          <label>
            Hasta la revisión
            <input
              type="number"
              name="to_version"
              min={1}
              max={current}
              defaultValue={current}
              required
            />
          </label>
          <button className="v2-secondary-button" disabled={compare.isPending}>
            Comparar revisiones
          </button>
        </form>
      )}
      {compare.error && <p role="alert">{errorText(compare.error)}</p>}
      {compare.data && (
        <div role="status">
          <Changes {...compare.data} />
        </div>
      )}
    </section>
  );
}
