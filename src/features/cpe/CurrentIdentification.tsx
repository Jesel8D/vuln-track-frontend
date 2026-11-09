import { Link } from "react-router";
import { ArrowRight, Fingerprint, History } from "lucide-react";
import { useIdentification } from "../../hooks/queries";
import {
  componentLabel,
  date,
  ErrorPanel,
  Loading,
  Status,
} from "../../components/ui";
export function CurrentIdentification({ assetId }: { assetId: string }) {
  const query = useIdentification(assetId);
  if (query.isPending)
    return (
      <section className="panel">
        <Loading text="Consultando identidad CPE…" />
      </section>
    );
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const current = query.data.items[0];
  return (
    <section className="panel current-identification">
      <div className="section-heading">
        <div>
          <p className="eyebrow">IDENTIDAD TECNOLÓGICA</p>
          <h2>CPE principal</h2>
        </div>
        <Status state={query.data.current_state} />
      </div>
      {current ? (
        <>
          <p className="cpe-name mono">{current.cpe_name}</p>
          <dl className="detail-grid">
            <div>
              <dt>Componente</dt>
              <dd>{componentLabel[current.component_kind]}</dd>
            </div>
            <div>
              <dt>Versión observada</dt>
              <dd>{current.observed_version ?? "Desconocida"}</dd>
            </div>
            <div>
              <dt>
                {current.state === "confirmed"
                  ? "Confirmación humana"
                  : "Marcado para revisión"}
              </dt>
              <dd>{date(current.recorded_at)}</dd>
            </div>
            <div>
              <dt>Última verificación en NVD</dt>
              <dd>{date(current.validated_at)}</dd>
            </div>
          </dl>
          <div className="reason">
            <span>Motivo registrado</span>
            <p>{current.reason}</p>
          </div>
          {current.state === "needs_review" && (
            <p className="notice">
              Esta selección requiere revisión; no se considera una confirmación
              vigente.
            </p>
          )}
        </>
      ) : (
        <div className="pending-identity">
          <Fingerprint size={32} aria-hidden="true" />
          <div>
            <h3>El activo está guardado. Su identidad, pendiente.</h3>
            <p>
              Busca un candidato oficial y confírmalo después de compararlo con
              el equipo.
            </p>
          </div>
        </div>
      )}
      <div className="section-actions">
        <Link
          className="button primary"
          to={`/activos/${assetId}/identificacion`}
        >
          {current ? "Revisar identificación" : "Buscar candidatos CPE"}
          <ArrowRight size={16} />
        </Link>
        <Link className="text-link" to={`/activos/${assetId}/historial`}>
          <History size={16} />
          Ver historial
        </Link>
      </div>
    </section>
  );
}
