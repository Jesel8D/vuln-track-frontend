import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Fingerprint,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../features/auth/context";
import { useWorkspace } from "../features/v2/WorkspaceContext";
import { V2CveAnalysis } from "../features/v2/V2CveAnalysis";
import { errorText } from "../services/api";
import type { CpeCandidate, Technology } from "../types/v2";

function TechnologyCard({
  workspaceId,
  applicationId,
  technology,
  canWrite,
  activeApplication,
}: {
  workspaceId: string;
  applicationId: string;
  technology: Technology;
  canWrite: boolean;
  activeApplication: boolean;
}) {
  const { api, user } = useAuth();
  const cache = useQueryClient();
  const [searchText, setSearchText] = useState(technology.product);
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [queryVersion, setQueryVersion] = useState(0);
  const technologiesKey = [
    "v2",
    user?.id,
    workspaceId,
    applicationId,
    "technologies",
  ];
  const candidates = useQuery({
    queryKey: [
      "v2",
      user?.id,
      workspaceId,
      applicationId,
      technology.id,
      "cpe",
      submittedSearch,
      queryVersion,
    ],
    queryFn: ({ signal }) =>
      api.searchV2Cpe(workspaceId, applicationId, submittedSearch, signal),
    enabled: submittedSearch.length >= 2,
    staleTime: 30_000,
  });
  const confirm = useMutation({
    mutationFn: (candidate: CpeCandidate) =>
      api.confirmV2Cpe(
        workspaceId,
        applicationId,
        technology.id,
        candidate.cpe_name_id,
        technology.selected_cpe,
      ),
    onSuccess: async () => {
      setMessage("CPE confirmado por el usuario.");
      setSelectedCandidate(null);
      setSubmittedSearch("");
      await cache.invalidateQueries({ queryKey: technologiesKey });
    },
    onError: (error) => setMessage(errorText(error)),
  });

  const isConfirmed =
    technology.confidence === "user_confirmed" &&
    Boolean(technology.selected_cpe);
  const runSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchText.trim().length < 2) return;
    setMessage(null);
    setSelectedCandidate(null);
    setQueryVersion((version) => version + 1);
    setSubmittedSearch(searchText.trim());
  };

  return (
    <article className="v2-technology-card">
      <div className="v2-technology-heading">
        <div className="v2-technology-icon">
          <Fingerprint size={19} />
        </div>
        <div className="v2-technology-name">
          <strong>{technology.product}</strong>
          <span>
            {technology.vendor || "Fabricante sin registrar"} · versión{" "}
            <code>{technology.version}</code>
          </span>
        </div>
        <span
          className={`v2-status ${isConfirmed ? "v2-status-active" : "v2-status-pending"}`}
        >
          {isConfirmed ? "CPE confirmado" : "Sin confirmar"}
        </span>
      </div>
      <div className="v2-technology-meta">
        <span>
          Método:{" "}
          {technology.detection_method === "manual"
            ? "Registro manual"
            : technology.detection_method === "http_fingerprint"
              ? "Huella HTTP"
              : "Importación de manifiesto"}
        </span>
        <span>
          Registrada{" "}
          {new Date(technology.observed_at).toLocaleDateString("es-MX")}
        </span>
      </div>
      {technology.selected_cpe && (
        <div className="v2-selected-cpe">
          <CheckCircle2 size={16} />
          <div>
            <small>{isConfirmed ? "CPE NVD confirmado" : "CPE actual"}</small>
            <code>{technology.selected_cpe}</code>
          </div>
        </div>
      )}
      {activeApplication ? (
        <div className="v2-cpe-search-area">
          <form className="v2-cpe-search-form" onSubmit={runSearch}>
            <label htmlFor={`cpe-search-${technology.id}`}>
              {isConfirmed
                ? "Buscar otro candidato para reemplazar la selección"
                : "Buscar candidatos en el catálogo CPE de NVD"}
            </label>
            <div className="v2-cpe-search-row">
              <div className="v2-search">
                <Search size={17} />
                <input
                  id={`cpe-search-${technology.id}`}
                  minLength={2}
                  maxLength={200}
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Producto o fabricante"
                />
              </div>
              <button
                className="v2-secondary-button"
                type="submit"
                disabled={searchText.trim().length < 2 || candidates.isFetching}
              >
                Buscar
              </button>
            </div>
          </form>
          {submittedSearch && (
            <div className="v2-candidate-results">
              {candidates.isPending || candidates.isFetching ? (
                <p className="v2-loading">Consultando NVD…</p>
              ) : candidates.isError ? (
                <div className="v2-error-inline" role="alert">
                  <CircleAlert size={16} />
                  <span>{errorText(candidates.error)}</span>
                  <button
                    className="v2-text-button"
                    onClick={() => void candidates.refetch()}
                  >
                    Reintentar
                  </button>
                </div>
              ) : candidates.data.items.length === 0 ? (
                <p className="v2-no-candidates">
                  NVD no devolvió candidatos para esta búsqueda. Revisa el
                  nombre del producto o registra la versión correcta.
                </p>
              ) : (
                <>
                  <div className="v2-candidate-source">
                    {candidates.data.page.total} candidatos · catálogo
                    consultado{" "}
                    {new Date(candidates.data.source_timestamp).toLocaleString(
                      "es-MX",
                    )}
                  </div>
                  <fieldset className="v2-candidate-list">
                    <legend>
                      Selecciona un producto que corresponda exactamente con la
                      versión observada ({technology.version})
                    </legend>
                    {candidates.data.items.map((candidate) => (
                      <label
                        key={candidate.cpe_name_id}
                        className={`v2-candidate${selectedCandidate === candidate.cpe_name_id ? " selected" : ""}${candidate.deprecated ? " deprecated" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`cpe-${technology.id}`}
                          value={candidate.cpe_name_id}
                          disabled={candidate.deprecated || confirm.isPending}
                          checked={selectedCandidate === candidate.cpe_name_id}
                          onChange={() =>
                            setSelectedCandidate(candidate.cpe_name_id)
                          }
                        />
                        <span className="v2-candidate-copy">
                          <strong>
                            {candidate.title || "Producto sin título"}
                          </strong>
                          <code>{candidate.cpe_name}</code>
                          {candidate.deprecated && (
                            <small>Deprecado por NVD</small>
                          )}
                        </span>
                        <span className="v2-candidate-mark">
                          {selectedCandidate === candidate.cpe_name_id
                            ? "Seleccionado"
                            : candidate.deprecated
                              ? "No disponible"
                              : "Elegir"}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div className="v2-confirm-cpe-row">
                    <p>
                      El backend valida que la versión del CPE coincida con la
                      versión registrada.
                    </p>
                    {canWrite ? (
                      <button
                        className="v2-primary-button"
                        disabled={!selectedCandidate || confirm.isPending}
                        onClick={() => {
                          const candidate = candidates.data.items.find(
                            (item) => item.cpe_name_id === selectedCandidate,
                          );
                          if (candidate) confirm.mutate(candidate);
                        }}
                      >
                        {confirm.isPending ? "Validando…" : "Confirmar CPE"}
                      </button>
                    ) : (
                      <span className="v2-readonly-label">
                        Solo owner/editor puede confirmar
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="v2-readonly-note">
          La aplicación está archivada; las búsquedas y modificaciones están
          deshabilitadas.
        </p>
      )}
      {!canWrite && (
        <p className="v2-readonly-note">
          Tu membresía permite consultar, pero no modificar tecnologías ni CPE.
        </p>
      )}
      {message && (
        <p
          className={`v2-message${message.startsWith("CPE confirmado") ? " success" : ""}`}
          role="status"
        >
          {message}
        </p>
      )}
      <p className="v2-cpe-disclaimer">
        Un CPE identifica producto y versión. Los CVE asociados son potenciales
        hasta su evaluación.
      </p>
      <V2CveAnalysis
        workspaceId={workspaceId}
        applicationId={applicationId}
        technologyId={technology.id}
        selectedCpe={technology.selected_cpe}
        confirmed={isConfirmed}
        canWrite={canWrite}
        activeApplication={activeApplication}
      />
    </article>
  );
}

export function V2ApplicationPage() {
  const { applicationId } = useParams();
  const { api, user } = useAuth();
  const { current } = useWorkspace();
  const cache = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [product, setProduct] = useState("");
  const [vendor, setVendor] = useState("");
  const [version, setVersion] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const applications = useQuery({
    queryKey: ["v2", user?.id, current?.workspace_id, "applications"],
    queryFn: ({ signal }) => api.applications(current!.workspace_id, signal),
    enabled: Boolean(current),
  });
  const application = useMemo(
    () => applications.data?.items.find((item) => item.id === applicationId),
    [applications.data?.items, applicationId],
  );
  const canWrite =
    (current?.role === "owner" || current?.role === "editor") &&
    application?.status === "active";
  const technologiesKey = [
    "v2",
    user?.id,
    current?.workspace_id,
    applicationId,
    "technologies",
  ];
  const technologies = useQuery({
    queryKey: technologiesKey,
    queryFn: ({ signal }) =>
      api.technologies(current!.workspace_id, applicationId!, signal),
    enabled: Boolean(current && applicationId && application),
  });
  const createTechnology = useMutation({
    mutationFn: () =>
      api.createTechnology(current!.workspace_id, applicationId!, {
        product: product.trim(),
        vendor: vendor.trim() || null,
        version: version.trim(),
        detection_method: "manual",
      }),
    onSuccess: async (created) => {
      setFormOpen(false);
      setMessage(`Tecnología “${created.product}” registrada.`);
      setProduct("");
      setVendor("");
      setVersion("");
      await cache.invalidateQueries({ queryKey: technologiesKey });
    },
    onError: (error) => setMessage(errorText(error)),
  });

  if (!current)
    return (
      <section className="v2-panel v2-empty-inline">
        <h1>Selecciona o crea un workspace</h1>
        <p>Las aplicaciones pertenecen a un workspace.</p>
      </section>
    );
  if (applications.isPending)
    return (
      <div className="v2-loading" role="status">
        Cargando aplicación…
      </div>
    );
  if (applications.isError)
    return (
      <section className="v2-panel v2-error-panel">
        <CircleAlert />
        <div>
          <h2>No se pudo cargar la aplicación</h2>
          <p>{errorText(applications.error)}</p>
        </div>
      </section>
    );
  if (!application)
    return (
      <section className="v2-panel v2-empty-inline">
        <CircleAlert />
        <h1>Aplicación no encontrada</h1>
        <p>
          Puede que ya no esté disponible o que no pertenezca al workspace
          seleccionado.
        </p>
        <Link className="v2-secondary-button" to="/aplicaciones">
          <ArrowLeft size={16} /> Volver al inventario
        </Link>
      </section>
    );

  return (
    <div className="v2-page">
      <Link className="v2-back-link" to="/aplicaciones">
        <ArrowLeft size={16} /> Aplicaciones
      </Link>
      <section className="v2-application-hero">
        <div className="v2-security-icon">
          <Fingerprint size={24} />
        </div>
        <div className="v2-application-hero-copy">
          <p className="v2-eyebrow">{current.name} · APLICACIÓN</p>
          <h1>{application.name}</h1>
          <p>{application.description || "Sin descripción registrada."}</p>
        </div>
        <span className={`v2-status v2-status-${application.status}`}>
          {application.status === "active" ? "Activa" : "Archivada"}
        </span>
      </section>
      <section className="v2-detail-summary">
        <article>
          <span>TECNOLOGÍAS LISTADAS</span>
          <strong>{technologies.data?.items.length ?? "—"}</strong>
        </article>
        <article>
          <span>CPE CONFIRMADOS</span>
          <strong>
            {technologies.data?.items.filter(
              (technology) =>
                technology.confidence === "user_confirmed" &&
                Boolean(technology.selected_cpe),
            ).length ?? "—"}
          </strong>
        </article>
        <article>
          <span>ESTADO DE ESCANEO</span>
          <strong className="v2-detail-small">ZAP pendiente</strong>
        </article>
      </section>
      <section className="v2-panel v2-detail-panel">
        <div className="v2-panel-heading">
          <div>
            <p className="v2-eyebrow">IDENTIFICACIÓN DE PRODUCTOS</p>
            <h2>Tecnologías</h2>
            <p>
              Confirma cada producto y versión antes de consultar CVE en NVD.
            </p>
          </div>
          {canWrite && (
            <button
              className="v2-primary-button"
              onClick={() => {
                setMessage(null);
                setFormOpen(true);
              }}
            >
              <Plus size={17} /> Agregar tecnología
            </button>
          )}
        </div>
        {message && !formOpen && (
          <p className="v2-success-message" role="status">
            {message}
          </p>
        )}
        {technologies.isPending ? (
          <div className="v2-loading" role="status">
            Cargando tecnologías…
          </div>
        ) : technologies.isError ? (
          <div className="v2-error-panel">
            <CircleAlert />
            <div>
              <h2>No se pudieron cargar las tecnologías</h2>
              <p>{errorText(technologies.error)}</p>
              <button
                className="v2-secondary-button"
                onClick={() => void technologies.refetch()}
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : technologies.data.items.length === 0 ? (
          <div className="v2-empty-inline">
            <Fingerprint size={24} />
            <h3>Aún no hay tecnologías registradas</h3>
            <p>
              Agrega producto y versión. La búsqueda CPE se hará por separado y
              requerirá confirmación.
            </p>
            {canWrite && (
              <button
                className="v2-secondary-button"
                onClick={() => setFormOpen(true)}
              >
                Agregar la primera tecnología
              </button>
            )}
          </div>
        ) : (
          <div className="v2-technology-list">
            {technologies.data.items.map((technology) => (
              <TechnologyCard
                key={`${user?.id}:${current.workspace_id}:${application.id}:${technology.id}`}
                workspaceId={current.workspace_id}
                applicationId={application.id}
                technology={technology}
                canWrite={canWrite}
                activeApplication={application.status === "active"}
              />
            ))}
          </div>
        )}
      </section>
      <aside className="v2-review-note">
        <ShieldCheck size={18} />
        <p>
          Los candidatos provienen del catálogo CPE de NVD. Confirma solo si
          fabricante, producto y versión coinciden; no se deduce vulnerabilidad
          por nombre parecido.
        </p>
      </aside>
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="technology-dialog-title"
          >
            <div className="v2-modal-heading">
              <div>
                <p className="v2-eyebrow">TECNOLOGÍA OBSERVADA</p>
                <h2 id="technology-dialog-title">Agregar producto y versión</h2>
              </div>
              <button
                className="v2-icon-button"
                aria-label="Cerrar"
                onClick={() => setFormOpen(false)}
              >
                ×
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setMessage(null);
                createTechnology.mutate();
              }}
            >
              <label htmlFor="technology-product">Producto</label>
              <input
                id="technology-product"
                required
                maxLength={160}
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                placeholder="Apache HTTP Server"
              />
              <label htmlFor="technology-vendor">
                Fabricante <span className="v2-muted">(opcional)</span>
              </label>
              <input
                id="technology-vendor"
                maxLength={160}
                value={vendor}
                onChange={(event) => setVendor(event.target.value)}
                placeholder="Apache Software Foundation"
              />
              <label htmlFor="technology-version">Versión observada</label>
              <input
                id="technology-version"
                required
                maxLength={120}
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="2.4.58"
              />
              <p className="v2-form-help">
                Solo se guardará lo que registres. La versión debe coincidir
                exactamente con el CPE que selecciones.
              </p>
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
                  disabled={
                    createTechnology.isPending ||
                    !product.trim() ||
                    !version.trim()
                  }
                >
                  {createTechnology.isPending
                    ? "Guardando…"
                    : "Registrar tecnología"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
