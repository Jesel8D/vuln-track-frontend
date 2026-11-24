import { useDialogFocus } from "../components/useDialogFocus";
import { Pagination } from "../features/v2/Pagination";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  AppWindow,
  CircleAlert,
  ExternalLink,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../features/auth/context";
import { useWorkspace } from "../features/v2/WorkspaceContext";
import { errorText } from "../services/api";

export function V2ApplicationsPage() {
  const { api, user } = useAuth();
  const { current } = useWorkspace();
  const canWrite = current?.role === "owner" || current?.role === "editor";
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const dialogRef = useDialogFocus(formOpen, setFormOpen);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: [
      "v2",
      user?.id,
      current?.workspace_id,
      "applications",
      search,
      offset,
    ],
    queryFn: ({ signal }) =>
      api.applications(current!.workspace_id, signal, {
        q: search,
        limit: 20,
        offset,
      }),
    enabled: Boolean(current),
  });
  const create = useMutation({
    mutationFn: () =>
      api.createApplication(current!.workspace_id, {
        name: name.trim(),
        description: description.trim() || null,
      }),
    onSuccess: async (application) => {
      await cache.invalidateQueries({
        queryKey: ["v2", user?.id, current?.workspace_id, "applications"],
      });
      setOffset(0);
      setFormOpen(false);
      setName("");
      setDescription("");
      setMessage(`“${application.name}” quedó registrada.`);
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const applications = query.data?.items ?? [];

  if (!current)
    return (
      <section className="v2-panel v2-empty-inline">
        <h1>Selecciona o crea un workspace</h1>
        <p>El inventario de aplicaciones está organizado por workspace.</p>
      </section>
    );

  return (
    <div className="v2-page">
      <div className="v2-page-title-row">
        <div>
          <p className="v2-eyebrow">WORKSPACE · {current.name}</p>
          <h1>Aplicaciones</h1>
          <p>Inventario de aplicaciones web y sus tecnologías.</p>
        </div>
        {canWrite && (
          <button
            className="v2-primary-button"
            onClick={() => {
              setFormOpen(true);
              setMessage(null);
            }}
          >
            <Plus size={18} /> Registrar aplicación
          </button>
        )}
      </div>
      <section className="v2-stat-grid v2-compact-stats">
        <article className="v2-stat-card">
          <div className="v2-stat-top">
            <span>APLICACIONES EN EL FILTRO</span>
            <AppWindow size={20} />
          </div>
          <strong>{query.data?.page?.total ?? "—"}</strong>
          <p>Total del filtro; hasta 20 por página</p>
        </article>
        <article className="v2-stat-card">
          <div className="v2-stat-top">
            <span>WORKSPACE</span>
          </div>
          <strong className="v2-stat-word">{current.name}</strong>
          <p>La API valida la membresía al consultar cada recurso.</p>
        </article>
        <article className="v2-stat-card v2-stat-note">
          <div className="v2-stat-top">
            <span>ALCANCE</span>
            <CircleAlert size={20} />
          </div>
          <strong className="v2-stat-word">Registro manual</strong>
          <p>Inventario de tecnologías declaradas, sin escanear destinos.</p>
        </article>
      </section>
      <section className="v2-panel v2-inventory-panel">
        <div className="v2-panel-heading">
          <div>
            <p className="v2-eyebrow">INVENTARIO</p>
            <h2>
              Aplicaciones registradas{" "}
              <span className="v2-count">{query.data?.page?.total ?? "—"}</span>
            </h2>
            <p>La lista corresponde únicamente a {current.name}.</p>
          </div>
        </div>
        <div className="v2-search-row">
          <label className="v2-search">
            <Search size={18} />
            <input
              aria-label="Buscar aplicaciones"
              placeholder="Buscar por nombre o descripción"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOffset(0);
              }}
            />
          </label>
        </div>
        {message && !formOpen && (
          <p className="v2-success-message" role="status">
            {message}
          </p>
        )}
        {query.isPending ? (
          <div className="v2-loading" role="status">
            Cargando aplicaciones…
          </div>
        ) : query.isError ? (
          <div className="v2-error-panel">
            <CircleAlert />
            <div>
              <h2>No se pudo cargar el inventario</h2>
              <p>{errorText(query.error)}</p>
              <button
                className="v2-secondary-button"
                onClick={() => void query.refetch()}
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : applications.length ? (
          <div className="v2-table-wrap">
            <table className="v2-table v2-applications-table">
              <thead>
                <tr>
                  <th>NOMBRE</th>
                  <th>URL / DESTINOS</th>
                  <th>DESCRIPCIÓN</th>
                  <th>ESTADO</th>
                  <th>AUTORIZACIÓN</th>
                  <th>ÚLTIMA ACTUALIZACIÓN</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <Link
                        className="v2-application-link"
                        to={`/aplicaciones/${application.id}`}
                      >
                        <strong>{application.name}</strong>
                      </Link>
                      <small className="v2-mono">{application.id}</small>
                    </td>
                    <td>
                      {query.isPending ? (
                        <span className="v2-muted">Cargando URLs…</span>
                      ) : query.isError ? (
                        <span className="v2-muted">No disponible</span>
                      ) : (application.target_summary?.items ?? []).length ? (
                        <div className="v2-application-targets-cell">
                          {(application.target_summary?.items ?? [])
                            .slice(0, 2)
                            .map((target) => (
                              <div key={target.id}>
                                <a
                                  href={target.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {target.label || target.url}{" "}
                                  <ExternalLink size={12} />
                                </a>
                                <span
                                  className={`v2-status v2-status-${target.authorization_status}`}
                                >
                                  {target.authorization_status === "approved"
                                    ? "Declaración vigente"
                                    : target.authorization_status === "rejected"
                                      ? "Rechazada o retirada"
                                      : target.authorization_status ===
                                          "expired"
                                        ? "Vencida"
                                        : "Pendiente"}
                                </span>
                              </div>
                            ))}
                          {(application.target_summary?.total ?? 0) > 2 && (
                            <Link to={`/aplicaciones/${application.id}`}>
                              +{application.target_summary!.total - 2} destinos
                              · Ver todos
                            </Link>
                          )}
                        </div>
                      ) : (
                        <span className="v2-muted">
                          {application.target_summary
                            ? "Sin URL registrada"
                            : "Resumen no disponible"}
                        </span>
                      )}
                    </td>
                    <td>
                      {application.description || (
                        <span className="v2-muted">Sin descripción</span>
                      )}
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
                      {application.target_summary
                        ? `${application.target_summary.approved} de ${application.target_summary.total} con declaración vigente`
                        : "Resumen no disponible"}
                    </td>
                    <td>
                      {new Date(application.updated_at).toLocaleDateString(
                        "es-MX",
                        { day: "2-digit", month: "short", year: "numeric" },
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="v2-empty-inline">
            <AppWindow size={24} />
            <h3>
              {search
                ? "No encontramos coincidencias"
                : "Aún no hay aplicaciones en este workspace"}
            </h3>
            <p>
              {search
                ? "Prueba con otro nombre o descripción."
                : "Registra una aplicación web para comenzar el inventario."}
            </p>
            {!search && canWrite && (
              <button
                className="v2-secondary-button"
                onClick={() => setFormOpen(true)}
              >
                Registrar aplicación
              </button>
            )}
          </div>
        )}
        <Pagination page={query.data?.page} onChange={setOffset} />
      </section>
      {formOpen && (
        <div
          className="v2-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFormOpen(false);
          }}
        >
          <section
            className="v2-modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-dialog-title"
          >
            <div className="v2-modal-heading">
              <div>
                <p className="v2-eyebrow">NUEVA APLICACIÓN</p>
                <h2 id="application-dialog-title">Registrar aplicación</h2>
              </div>
              <button
                className="v2-icon-button"
                aria-label="Cerrar"
                onClick={() => setFormOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setMessage(null);
                create.mutate();
              }}
            >
              <label htmlFor="application-name">Nombre</label>
              <input
                id="application-name"
                maxLength={160}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Portal institucional"
              />
              <label htmlFor="application-description">
                Descripción <span className="v2-muted">(opcional)</span>
              </label>
              <textarea
                id="application-description"
                maxLength={2000}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Propósito o equipo responsable"
              />
              {message && (
                <p className="v2-form-error" role="alert">
                  {message}
                </p>
              )}
              <div className="v2-modal-actions">
                <button
                  className="v2-secondary-button"
                  type="button"
                  onClick={() => setFormOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="v2-primary-button"
                  type="submit"
                  disabled={create.isPending || !name.trim()}
                >
                  {create.isPending ? "Guardando…" : "Guardar aplicación"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
