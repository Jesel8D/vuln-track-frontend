import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { useAssetStates } from "../../hooks/queries";
import type { Asset } from "../../types/api";
import { AssetIcon, date, Status, typeLabel } from "../../components/ui";
export function AssetCollection({ assets }: { assets: Asset[] }) {
  const states = useAssetStates(assets);
  return (
    <>
      <div className="table-scroll">
        <table className="asset-table">
          <caption className="sr-only">
            Activos y estado de identificación CPE
          </caption>
          <thead>
            <tr>
              <th scope="col">Activo</th>
              <th scope="col">Tipo</th>
              <th scope="col">Versión</th>
              <th scope="col">Identidad CPE</th>
              <th scope="col">Sitio</th>
              <th scope="col">
                <span className="sr-only">Detalle</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, i) => (
              <tr key={asset.id}>
                <td>
                  <Link
                    aria-label={`${asset.manufacturer} ${asset.model}`}
                    className="asset-name"
                    to={`/activos/${asset.id}`}
                  >
                    <AssetIcon type={asset.device_type} />
                    <span>
                      <strong>
                        {asset.manufacturer} {asset.model}
                      </strong>
                      <small>
                        {asset.inventory_label ?? "Sin etiqueta de inventario"}
                      </small>
                    </span>
                  </Link>
                </td>
                <td>{typeLabel[asset.device_type] ?? asset.device_type}</td>
                <td className="mono">
                  {asset.version ?? <span className="muted">Desconocida</span>}
                </td>
                <td>
                  {states[i]?.isPending ? (
                    <span className="muted small">Consultando…</span>
                  ) : (
                    <Status state={states[i]?.data?.current_state} />
                  )}
                </td>
                <td>{asset.site_label}</td>
                <td>
                  <Link
                    className="icon-link"
                    to={`/activos/${asset.id}`}
                    aria-label={`Ver ${asset.manufacturer} ${asset.model}`}
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="asset-cards">
        {assets.map((asset, i) => (
          <li key={asset.id}>
            <Link
              aria-label={`${asset.manufacturer} ${asset.model}`}
              className="asset-name"
              to={`/activos/${asset.id}`}
            >
              <AssetIcon type={asset.device_type} />
              <span>
                <strong>
                  {asset.manufacturer} {asset.model}
                </strong>
                <small>
                  {typeLabel[asset.device_type] ?? asset.device_type} ·{" "}
                  {asset.site_label}
                </small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
            <div className="asset-card-meta">
              <span>
                Versión{" "}
                <strong className="mono">
                  {asset.version ?? "Desconocida"}
                </strong>
              </span>
              <Status state={states[i]?.data?.current_state} />
            </div>
            <small className="muted">Registrado {date(asset.created_at)}</small>
          </li>
        ))}
      </ul>
    </>
  );
}
