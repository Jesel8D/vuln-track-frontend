import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Info,
  LoaderCircle,
  Server,
} from "lucide-react";
import { useAuth } from "../features/auth/context";
import { ApiError } from "../services/api";
import { emptyAsset, validateAsset } from "../services/validation";
import type { AssetDraft } from "../services/validation";
import type { AssetInput } from "../types/api";
import {
  BackToAssets,
  Button,
  ErrorPanel,
  PageHeading,
} from "../components/ui";
import { TextField } from "../components/TextField";
export function RegisterAssetPage() {
  const { api } = useAuth();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<AssetDraft>({ ...emptyAsset });
  const [unknown, setUnknown] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof AssetInput, string>>
  >({});
  const [intent, setIntent] = useState<{
    key: string;
    body: AssetInput;
  } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const flight = useRef(false);
  const mutation = useMutation({
    mutationFn: (request: { key: string; body: AssetInput }) =>
      api.register(request.body, request.key),
  });
  const edit = (field: keyof AssetInput, value: string) =>
    setDraft((previous) => ({ ...previous, [field]: value }));
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current) return;
    const validated = validateAsset(draft, unknown);
    setErrors(validated.errors);
    if (Object.keys(validated.errors).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const request = intent ?? {
      key: crypto.randomUUID(),
      body: validated.body,
    };
    setIntent(request);
    flight.current = true;
    try {
      const asset = await mutation.mutateAsync(request);
      await cache.invalidateQueries({ queryKey: ["assets"] });
      navigate(`/activos/${asset.id}`, {
        replace: true,
        state: { created: true },
      });
    } catch (error) {
      if (error instanceof ApiError && [400, 422].includes(error.status)) {
        setIntent(null);
        setUncertain(false);
      } else setUncertain(true);
    } finally {
      flight.current = false;
    }
  }
  const locked = mutation.isPending || uncertain;
  return (
    <>
      <BackToAssets />
      <PageHeading
        eyebrow="NUEVO REGISTRO"
        title="Agrega contexto a tu inventario."
        description="Registra el equipo tal como lo observas. Su identidad CPE se confirma en el siguiente paso."
      />
      <div className="form-layout">
        <form className="panel register-form" onSubmit={submit} noValidate>
          <div className="section-heading">
            <div>
              <h2>Datos del activo</h2>
              <p>Los campos con * son obligatorios.</p>
            </div>
            <Server size={22} className="muted" aria-hidden="true" />
          </div>
          <fieldset disabled={locked}>
            <legend className="sr-only">
              Información administrativa y tecnológica
            </legend>
            <div className="field">
              <label htmlFor="device_type">
                Tipo de equipo <span className="required">*</span>
              </label>
              <select
                id="device_type"
                value={draft.device_type}
                onChange={(e) => edit("device_type", e.target.value)}
              >
                <option value="router">Router</option>
                <option value="switch">Switch</option>
                <option value="server">Servidor</option>
              </select>
            </div>
            <div className="form-row">
              <TextField
                name="manufacturer"
                label="Fabricante"
                required
                value={draft.manufacturer}
                onChange={(v) => edit("manufacturer", v)}
                error={errors.manufacturer}
              />
              <TextField
                name="model"
                label="Modelo"
                required
                value={draft.model}
                onChange={(v) => edit("model", v)}
                error={errors.model}
              />
            </div>
            <TextField
              name="version"
              label="Versión del componente principal"
              value={draft.version}
              onChange={(v) => edit("version", v)}
              error={errors.version}
              disabled={unknown}
              hint="Versión del firmware, sistema operativo o software que identificarás."
            />
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={unknown}
                onChange={(e) => setUnknown(e.target.checked)}
              />
              No la conozco
            </label>
            <div className="form-divider" />
            <div className="form-row">
              <TextField
                name="site_label"
                label="Ubicación o sitio"
                required
                value={draft.site_label}
                onChange={(v) => edit("site_label", v)}
                error={errors.site_label}
                hint="Una etiqueta administrativa, por ejemplo: LAB-A."
              />
              <TextField
                name="inventory_label"
                label="Etiqueta de inventario"
                value={draft.inventory_label}
                onChange={(v) => edit("inventory_label", v)}
                error={errors.inventory_label}
              />
            </div>
            <TextField
              name="notes"
              label="Notas"
              multiline
              max={1000}
              value={draft.notes}
              onChange={(v) => edit("notes", v)}
              error={errors.notes}
              hint="Solo observaciones no sensibles. No incluyas credenciales."
            />
          </fieldset>
          {mutation.isError && <ErrorPanel error={mutation.error} />}{" "}
          {uncertain && (
            <div className="notice" role="status">
              Conservamos los datos y la clave de este intento. Reintenta sin
              cambiarlos para evitar duplicados. Si abandonas esta pantalla,
              comprueba primero el inventario antes de crear otro registro.
            </div>
          )}
          <div className="form-actions">
            <Link to="/activos" className="text-link">
              Volver al inventario
            </Link>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <LoaderCircle size={18} className="spin" />
                  Guardando…
                </>
              ) : (
                <>
                  {uncertain
                    ? "Reintentar el mismo registro"
                    : "Guardar activo"}
                  <ArrowRight size={17} />
                </>
              )}
            </Button>
          </div>
        </form>
        <aside className="form-aside">
          <span className="eyebrow">PRIMERO, EL INVENTARIO</span>
          <h2>
            No necesitas tener
            <br />
            todas las respuestas.
          </h2>
          <p>
            Puedes guardar un activo sin conocer su versión y sin elegir un CPE.
          </p>
          <ol className="registration-steps">
            <li className="active">
              <span>01</span>
              <div>
                <strong>Registra el equipo</strong>
                <p>Conserva los datos observados.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Busca su identidad</strong>
                <p>Compara candidatos oficiales.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Confirma tu selección</strong>
                <p>Queda en el historial del activo.</p>
              </div>
            </li>
          </ol>
          <div className="small-info">
            <Info size={18} />
            <p>
              Una versión desconocida permite registrar e identificar, pero no
              evaluar vulnerabilidades específicas.
            </p>
          </div>
          <p className="small muted">
            <CheckCircle2 size={15} className="inline-icon" />
            El propietario se asigna desde tu sesión.
          </p>
        </aside>
      </div>
    </>
  );
}
