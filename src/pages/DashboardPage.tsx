import { ArrowRight, Fingerprint, Plus } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../features/auth/context";
import { useAssets, useAssetStates } from "../hooks/queries";
import { AssetCollection } from "../features/assets/AssetCollection";
import {
  Empty,
  ErrorPanel,
  Loading,
  PageHeading,
  typeLabel,
} from "../components/ui";
export function DashboardPage() {
  const { user } = useAuth();
  const query = useAssets(20);
  const sample = (query.data?.items ?? []).slice(0, 5);
  const states = useAssetStates(sample);
  const count = (state: string) =>
    states.filter((s) => s.data?.current_state === state).length;
  const loaded = states.filter((s) => s.isSuccess).length;
  const types = new Map<string, number>();
  query.data?.items.forEach((a) =>
    types.set(a.device_type, (types.get(a.device_type) ?? 0) + 1),
  );
  return (
    <>
      <PageHeading
        eyebrow="TU PANORAMA"
        title="Inventario con contexto."
        description={`Hola, ${user?.username}. Cada activo es el inicio de una identidad verificable.`}
        action={
          <Link className="button primary" to="/activos/nuevo">
            <Plus size={18} />
            Registrar activo
          </Link>
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="overview-grid">
            <section className="panel inventory-total">
              <p className="eyebrow">INVENTARIO PERSONAL</p>
              <div className="total-number">
                {query.data.page.total}
                <span>
                  activos
                  <br />
                  registrados
                </span>
              </div>
              <div className="total-footer">
                <span>Total verificado por el servicio</span>
                <Link to="/activos" className="text-link">
                  Abrir inventario
                  <ArrowRight size={16} />
                </Link>
              </div>
            </section>
            <section className="panel identity-summary">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">IDENTIFICACIÓN TECNOLÓGICA</p>
                  <h2>De registro a identidad.</h2>
                </div>
                <Fingerprint size={27} className="accent" aria-hidden="true" />
              </div>
              <div className="identification-counts">
                <div>
                  <strong>{count("confirmed")}</strong>
                  <span>
                    <i className="dot confirmed" />
                    Confirmados
                  </span>
                </div>
                <div>
                  <strong>{count("pending")}</strong>
                  <span>
                    <i className="dot pending" />
                    Pendientes
                  </span>
                </div>
                <div>
                  <strong>{count("needs_review")}</strong>
                  <span>
                    <i className="dot needs_review" />
                    En revisión
                  </span>
                </div>
              </div>
              <p className="coverage-label">
                Muestra de {sample.length} activos de {query.data.page.total} ·{" "}
                {loaded} estados consultados
                {states.some((s) => s.isError)
                  ? " · Hay estados no disponibles"
                  : ""}
              </p>
            </section>
          </div>
          <div className="dashboard-secondary">
            <section className="panel distribution">
              <p className="eyebrow">COMPOSICIÓN VISIBLE</p>
              <h2>Un inventario, distintos equipos.</h2>
              <p className="muted small">
                Distribución de los {query.data.items.length} registros de la
                primera página.
              </p>
              {query.data.items.length ? (
                <ul>
                  {[...types].map(([type, n]) => (
                    <li key={type}>
                      <div>
                        <span>{typeLabel[type] ?? type}</span>
                        <strong>{n}</strong>
                      </div>
                      <div className="distribution-track" aria-hidden="true">
                        <span
                          style={{
                            width: `${(n / query.data.items.length) * 100}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="distribution-empty">
                  Los tipos aparecerán al registrar tu primer activo.
                </p>
              )}
            </section>
            <section className="workflow-note">
              <span className="mono small">01 — 04 / TRAZABILIDAD</span>
              <h2>
                Una selección informada.
                <br />
                Un historial que permanece.
              </h2>
              <p>
                Confirma el CPE y abre el detalle del activo para consultar CVE,
                revisar la evidencia y conservar cada ejecución.
              </p>
              <div className="workflow-steps">
                <span>Registrar</span>
                <ArrowRight size={14} />
                <span>Comparar</span>
                <ArrowRight size={14} />
                <span>Confirmar</span>
              </div>
              <small>
                Un CPE identifica un producto; no confirma una vulnerabilidad.
              </small>
            </section>
          </div>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Activos a mano</h2>
                <p>
                  Primeros {sample.length} registros del inventario, con su
                  estado actual.
                </p>
              </div>
              <Link className="text-link" to="/activos">
                Ver todos
                <ArrowRight size={16} />
              </Link>
            </div>
            {sample.length ? (
              <AssetCollection assets={sample} />
            ) : (
              <Empty
                title="Todo listo para tu primer activo"
                text="No necesitas conocer su CPE ni su versión para registrarlo."
                action={
                  <Link className="button secondary" to="/activos/nuevo">
                    Registrar activo
                    <ArrowRight size={16} />
                  </Link>
                }
              />
            )}
          </section>
        </>
      )}
    </>
  );
}
