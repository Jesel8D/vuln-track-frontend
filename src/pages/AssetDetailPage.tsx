import { AnalysisSection } from "../features/analyses/AnalysisSection";
import { Link, useLocation, useParams } from "react-router";
import { CheckCircle2, History } from "lucide-react";
import { useAsset, useIdentification } from "../hooks/queries";
import {
  BackToAssets,
  date,
  ErrorPanel,
  IdentityChain,
  Loading,
  PageHeading,
  typeLabel,
} from "../components/ui";
import { CurrentIdentification } from "../features/cpe/CurrentIdentification";
export function AssetDetailPage() {
  const { assetId = "" } = useParams();
  const query = useAsset(assetId);
  const identity = useIdentification(assetId);
  const location = useLocation();
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <>
        <BackToAssets />
        <PageHeading eyebrow="INVENTARIO" title="Activo no disponible" />
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      </>
    );
  const asset = query.data;
  return (
    <>
      <BackToAssets />
      {(location.state as { created?: boolean } | null)?.created && (
        <p className="success-message" role="status">
          <CheckCircle2 size={18} />
          Activo guardado. Puedes continuar con la identificación CPE.
        </p>
      )}
      <PageHeading
        eyebrow={`${typeLabel[asset.device_type] ?? asset.device_type} / ${asset.site_label}`}
        title={`${asset.manufacturer} ${asset.model}`}
        description={`Registrado el ${date(asset.created_at)}`}
        action={
          <Link
            className="button secondary"
            to={`/activos/${assetId}/historial`}
          >
            <History size={17} />
            Historial
          </Link>
        }
      />
      <IdentityChain state={identity.data?.current_state ?? "pending"} />
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Información del activo</h2>
            <p>Datos administrativos y tecnológicos observados.</p>
          </div>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Fabricante</dt>
            <dd>{asset.manufacturer}</dd>
          </div>
          <div>
            <dt>Modelo</dt>
            <dd>{asset.model}</dd>
          </div>
          <div>
            <dt>Versión principal observada</dt>
            <dd className="mono">{asset.version ?? "Desconocida"}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{typeLabel[asset.device_type] ?? asset.device_type}</dd>
          </div>
          <div>
            <dt>Ubicación o sitio</dt>
            <dd>{asset.site_label}</dd>
          </div>
          <div>
            <dt>Etiqueta de inventario</dt>
            <dd>{asset.inventory_label ?? "Sin etiqueta"}</dd>
          </div>
        </dl>
        {asset.notes && (
          <div className="reason">
            <span>Notas</span>
            <p>{asset.notes}</p>
          </div>
        )}
        <p className="record-id mono">ID {asset.id}</p>
      </section>
      <CurrentIdentification assetId={assetId} />
      <AnalysisSection key={assetId} assetId={assetId} />
    </>
  );
}
