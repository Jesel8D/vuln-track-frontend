import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Check, GitBranch, ShieldQuestion } from "lucide-react";
import { useAsset, useIdentification } from "../hooks/queries";
import { useAuth } from "../features/auth/context";
import {
  componentLabel,
  date,
  Empty,
  ErrorPanel,
  Loading,
  PageHeading,
  Pagination,
  Status,
} from "../components/ui";
export function HistoryPage() {
  const { assetId = "" } = useParams();
  const [offset, setOffset] = useState(0);
  const asset = useAsset(assetId);
  const query = useIdentification(assetId, "history", offset);
  const { user } = useAuth();
  return (
    <>
      <Link className="text-link back-link" to={`/activos/${assetId}`}>
        <ArrowLeft size={15} />
        Detalle del activo
      </Link>
      <PageHeading
        eyebrow="TRAZABILIDAD"
        title="Cada decisión permanece."
        description={
          asset.data
            ? `Historial de identificación de ${asset.data.manufacturer} ${asset.data.model}.`
            : "Historial de identificación CPE."
        }
      />
      <section className="panel history-panel">
        <div className="section-heading">
          <div>
            <h2>Historial de identificación</h2>
            <p>
              Orden cronológico · los cambios no reescriben los eventos
              anteriores.
            </p>
          </div>
          <GitBranch size={22} className="muted" aria-hidden="true" />
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : !query.data.items.length ? (
          <Empty
            title="El historial todavía está por comenzar"
            text="Tu primera confirmación CPE quedará registrada aquí."
            action={
              <Link
                className="button secondary"
                to={`/activos/${assetId}/identificacion`}
              >
                Buscar un candidato
              </Link>
            }
          />
        ) : (
          <ol className="timeline">
            {query.data.items.map((item) => (
              <li key={item.id}>
                <span className={`timeline-marker ${item.state}`}>
                  {item.state === "confirmed" ? (
                    <Check size={16} />
                  ) : (
                    <ShieldQuestion size={16} />
                  )}
                </span>
                <article>
                  <div className="event-heading">
                    <div>
                      <h3>
                        {item.state === "confirmed"
                          ? "Identificación confirmada"
                          : "Identificación marcada para revisión"}
                      </h3>
                      <time dateTime={item.recorded_at}>
                        {date(item.recorded_at)}
                      </time>
                    </div>
                    {item.is_current ? (
                      <Status state={item.state} />
                    ) : (
                      <span className="event-ended">Evento anterior</span>
                    )}
                  </div>
                  <p className="cpe-name mono">{item.cpe_name}</p>
                  <dl className="event-meta">
                    <div>
                      <dt>Componente</dt>
                      <dd>{componentLabel[item.component_kind]}</dd>
                    </div>
                    <div>
                      <dt>Versión observada</dt>
                      <dd>{item.observed_version ?? "Desconocida"}</dd>
                    </div>
                    <div>
                      <dt>Registrado por</dt>
                      <dd>
                        {item.recorded_by === user?.id
                          ? `${user.username} (tú)`
                          : item.recorded_by}
                      </dd>
                    </div>
                  </dl>
                  <p className="event-reason">{item.reason}</p>
                  <div className="event-provenance">
                    <span>Fuente NVD · validada {date(item.validated_at)}</span>
                    <span>
                      {item.is_current
                        ? "Evento actual"
                        : `Sustituido ${item.valid_to ? date(item.valid_to) : ""}`}
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        )}
        {query.data && query.data.page.total > 20 && (
          <Pagination
            {...query.data.page}
            onPage={setOffset}
            busy={query.isFetching}
          />
        )}
      </section>
    </>
  );
}
