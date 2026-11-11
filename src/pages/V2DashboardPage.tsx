import { useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Fingerprint,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../features/auth/context";
import { useWorkspace } from "../features/v2/WorkspaceContext";
import { errorText } from "../services/api";

function EmptyWorkspace() {
  const { api, user } = useAuth();
  const cache = useQueryClient();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const workspace = useWorkspace();
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

export function V2DashboardPage() {
  const { api, user } = useAuth();
  const { current, isPending, error } = useWorkspace();
  const canWrite = current?.role === "owner" || current?.role === "editor";
  const applications = useQuery({
    queryKey: ["v2", user?.id, current?.workspace_id, "applications"],
    queryFn: ({ signal }) => api.applications(current!.workspace_id, signal),
    enabled: Boolean(current),
  });
  const recent = applications.data?.items.slice(0, 5) ?? [];
  const technologyQueries = useQueries({
    queries: recent.map((application) => ({
      queryKey: [
        "v2",
        user?.id,
        current?.workspace_id,
        application.id,
        "technologies",
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.technologies(current!.workspace_id, application.id, signal),
      enabled: Boolean(current),
      staleTime: 30_000,
    })),
  });
  const sample = useMemo(
    () => technologyQueries.flatMap((query) => query.data?.items ?? []),
    [technologyQueries],
  );
  const technologyCountKnown = technologyQueries.every(
    (query) => query.isSuccess,
  );
  const technologyAppsLoaded = technologyQueries.filter(
    (query) => query.isSuccess,
  ).length;
  const confirmedCount = sample.filter(
    (technology) =>
      technology.confidence === "user_confirmed" && technology.selected_cpe,
  ).length;

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
          <button
            className="v2-secondary-button"
            onClick={() => window.location.reload()}
          >
            Volver a intentar
          </button>
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
            <span className="v2-pill v2-pill-info">Inventario activo</span>
          </p>
          <h1>{current.name}</h1>
          <p>
            Consultas de vulnerabilidades conocidas por producto y versión
            confirmados.
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

      {applications.isPending ? (
        <div className="v2-loading" role="status">
          Cargando aplicaciones…
        </div>
      ) : applications.isError ? (
        <section className="v2-panel v2-error-panel">
          <CircleAlert />
          <div>
            <h2>No se pudo cargar el inventario</h2>
            <p>{errorText(applications.error)}</p>
            <button
              className="v2-secondary-button"
              onClick={() => void applications.refetch()}
            >
              Reintentar
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="v2-stat-grid" aria-label="Resumen del inventario">
            <article className="v2-stat-card">
              <div className="v2-stat-top">
                <span>APLICACIONES VISIBLES</span>
                <Boxes size={20} />
              </div>
              <strong>{applications.data.items.length}</strong>
              <p>Hasta 100 devueltas por la API</p>
            </article>
            <article className="v2-stat-card">
              <div className="v2-stat-top">
                <span>TECNOLOGÍAS</span>
                <Fingerprint size={20} />
              </div>
              <strong>{technologyCountKnown ? sample.length : "—"}</strong>
              <p>
                {technologyCountKnown
                  ? `Muestra de ${recent.length} aplicaciones`
                  : `${technologyAppsLoaded} de ${recent.length} aplicaciones consultadas`}
              </p>
            </article>
            <article className="v2-stat-card">
              <div className="v2-stat-top">
                <span>CPE CONFIRMADOS</span>
                <CheckCircle2 size={20} />
              </div>
              <strong>{technologyCountKnown ? confirmedCount : "—"}</strong>
              <p>
                {technologyCountKnown
                  ? `Dentro de la muestra de ${recent.length} aplicaciones`
                  : "Muestra incompleta; no se muestra un total"}
              </p>
            </article>
            <article className="v2-stat-card v2-stat-note">
              <div className="v2-stat-top">
                <span>ANÁLISIS WEB</span>
                <ShieldCheck size={20} />
              </div>
              <strong className="v2-stat-word">ZAP pendiente</strong>
              <p>El escaneo Baseline aún no está integrado.</p>
            </article>
          </section>

          <div className="v2-dashboard-grid">
            <section className="v2-panel v2-recent-panel">
              <div className="v2-panel-heading">
                <div>
                  <p className="v2-eyebrow">INVENTARIO DEL WORKSPACE</p>
                  <h2>Aplicaciones recientes</h2>
                  <p>Mostrando hasta cinco registros reales del servicio.</p>
                </div>
                <Link className="v2-text-link" to="/aplicaciones">
                  Ver inventario <ArrowRight size={16} />
                </Link>
              </div>
              {recent.length ? (
                <div className="v2-table-wrap">
                  <table className="v2-table">
                    <thead>
                      <tr>
                        <th>APLICACIÓN</th>
                        <th>ESTADO</th>
                        <th>ACTUALIZADA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((application) => (
                        <tr key={application.id}>
                          <td>
                            <strong>{application.name}</strong>
                            <small>
                              {application.description || "Sin descripción"}
                            </small>
                          </td>
                          <td>
                            <span
                              className={`v2-status v2-status-${application.status}`}
                            >
                              {application.status === "active"
                                ? "Activa"
                                : "Archivada"}
                            </span>
                          </td>
                          <td>
                            {new Date(
                              application.updated_at,
                            ).toLocaleDateString("es-MX", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="v2-empty-inline">
                  <Boxes size={23} />
                  <h3>Aún no hay aplicaciones</h3>
                  <p>
                    Registra la primera aplicación web para empezar a organizar
                    sus tecnologías.
                  </p>
                  <Link className="v2-secondary-button" to="/aplicaciones">
                    Registrar aplicación
                  </Link>
                </div>
              )}
              <div className="v2-panel-footnote">
                Las cifras de tecnología y CPE se calculan solo para la muestra
                visible; no representan un total global.
              </div>
            </section>
            <aside className="v2-panel v2-workflow-panel">
              <p className="v2-eyebrow">FLUJO DE IDENTIFICACIÓN</p>
              <h2>Del registro a la evidencia</h2>
              <ol className="v2-steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Registra la aplicación</strong>
                    <p>Organiza cada proyecto en el workspace.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Agrega sus tecnologías</strong>
                    <p>Producto y versión observada son necesarios.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Confirma un CPE</strong>
                    <p>La selección humana precede a la consulta NVD.</p>
                  </div>
                </li>
                <li>
                  <span>4</span>
                  <div>
                    <strong>Revisa los CVE</strong>
                    <p>Los resultados se presentan como potenciales.</p>
                  </div>
                </li>
              </ol>
              <p className="v2-disclaimer">
                NVD aporta registros conocidos; una coincidencia no confirma que
                la aplicación sea vulnerable. Las vistas CPE/CVE se conectan en
                el siguiente paso.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
