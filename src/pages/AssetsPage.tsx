import { useState } from "react";
import { Link } from "react-router";
import { Plus, Search } from "lucide-react";
import { useAssets } from "../hooks/queries";
import {
  Empty,
  ErrorPanel,
  Loading,
  PageHeading,
  Pagination,
  typeLabel,
} from "../components/ui";
import { AssetCollection } from "../features/assets/AssetCollection";
export function AssetsPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const query = useAssets(10, offset);
  const assets = query.data?.items ?? [];
  const filtered = assets.filter(
    (a) =>
      (!type || a.device_type === type) &&
      `${a.manufacturer} ${a.model} ${a.site_label} ${a.inventory_label ?? ""}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="INVENTARIO"
        title="Mis activos"
        description="Tu inventario, con una identidad tecnológica trazable."
        action={
          <Link className="button primary" to="/activos/nuevo">
            <Plus size={18} />
            Registrar activo
          </Link>
        }
      />
      <section
        className="panel inventory-panel"
        aria-label="Inventario personal"
      >
        <div className="section-heading">
          <div>
            <h2>
              Inventario personal{" "}
              <span className="count">{query.data?.page.total ?? "—"}</span>
            </h2>
            <p>Solo los activos que pertenecen a tu cuenta.</p>
          </div>
        </div>
        <div className="filter-bar">
          <div className="search-input">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Filtrar esta página"
              placeholder="Filtrar esta página…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Tipo en esta página"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Todos los tipos de esta página</option>
            {[...new Set(assets.map((a) => a.device_type))].map((t) => (
              <option key={t} value={t}>
                {typeLabel[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <p className="filter-help">
          El filtro se aplica a los {assets.length} registros de esta página; no
          busca en todo el inventario.
        </p>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : query.data.page.total === 0 ? (
          <Empty
            title="Tu inventario empieza aquí"
            text="Registra un router, switch o servidor. Podrás identificar su CPE después."
            action={
              <Link className="button primary" to="/activos/nuevo">
                <Plus size={18} />
                Registrar mi primer activo
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <Empty
            title="Sin resultados en esta página"
            text="Prueba otro término, cambia el tipo o consulta otra página."
          />
        ) : (
          <AssetCollection assets={filtered} />
        )}
        {query.data && query.data.page.total > 0 && (
          <Pagination
            {...query.data.page}
            busy={query.isFetching}
            onPage={(value) => {
              setOffset(value);
              setSearch("");
              setType("");
            }}
          />
        )}
      </section>
    </>
  );
}
