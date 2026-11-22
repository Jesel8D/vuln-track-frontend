import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { errorText } from "../../services/api";
import { useAuth } from "../auth/context";

const base = "/api/v2/cpe-catalog";
type Mode = "fixture" | "live";
type Part = "a" | "o" | "h";
type Paging<T> = {
  items: T[];
  page: { limit: number; offset: number; total: number; truncated?: boolean };
};
type Vendor = { vendor: string };
type Product = { vendor: string; product: string; title: string };
type Version = { version: string; deprecated: boolean };
type CatalogStatus = {
  records: number;
  coverage: "complete" | "partial" | "empty";
  last_synchronized_at: string | null;
  stale: boolean;
  last_run: { status: "partial" | "complete" | "failed" } | null;
  feed?: {
    status: "partial" | "complete" | "failed";
    next_item: number;
    total_items: number;
    discarded: number;
  } | null;
};
export type CatalogCandidate = {
  cpe_name_id: string;
  cpe_name: string;
  title: string;
  vendor: string;
  product: string;
  version: string;
  deprecated: boolean;
  deprecated_by: { cpeName: string; cpeNameId: string }[];
  nvd_modified: string;
  source: "nvd-api" | "nvd-feed" | "nvd-captured-fixture";
  mode: Mode;
};

function Combobox<T>({
  label,
  path,
  selected,
  onPick,
  describe,
  enabled = true,
  maxLength = 120,
}: {
  label: string;
  path: string;
  selected?: string;
  onPick: (item: T) => void;
  describe: (item: T) => string;
  enabled?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  const { api, user } = useAuth();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 275);
    return () => window.clearTimeout(timer);
  }, [input]);
  const search = useQuery({
    queryKey: ["cpe-catalog-search", user?.id, path, query, offset],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        q: query,
        offset: String(offset),
        limit: "8",
      });
      return api.request<Paging<T>>(base + path + "&" + params, { signal });
    },
    enabled: open && enabled && query === input.trim(),
    retry: false,
    staleTime: 30_000,
  });
  const items = search.data?.items ?? [];
  const paging = search.data?.page;
  function choose(item: T) {
    onPick(item);
    setInput("");
    setOpen(false);
    setIndex(-1);
    setOffset(0);
  }
  function move(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setIndex(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setIndex((current) => {
        if (!items.length) return -1;
        if (current < 0) return delta === 1 ? 0 : items.length - 1;
        return (current + delta + items.length) % items.length;
      });
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (items[index]) choose(items[index]);
    }
  }
  return (
    <div
      className="rc22-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setIndex(-1);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open && enabled}
        aria-controls={open && enabled ? id + "-options" : undefined}
        aria-activedescendant={
          open && items[index] ? id + "-" + index : undefined
        }
        disabled={!enabled}
        value={input}
        placeholder={selected ?? "Buscar en el catálogo"}
        onChange={(event) => {
          setInput(event.target.value);
          setOffset(0);
          setIndex(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={move}
        maxLength={maxLength}
      />
      {selected && <span className="rc22-selected">{selected}</span>}
      {open && enabled && (
        <div className="rc22-options">
          {query !== input.trim() || search.isFetching ? (
            <p role="status">Buscando…</p>
          ) : null}
          <ul id={id + "-options"} role="listbox" aria-label={label}>
            {items.map((item, position) => (
              <li
                id={id + "-" + position}
                key={describe(item)}
                role="option"
                aria-selected={index === position}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
              >
                {describe(item)}
              </li>
            ))}
          </ul>
          {search.error && (
            <div role="alert">
              <p>{errorText(search.error)}</p>
              <button
                type="button"
                className="v2-secondary-button"
                onClick={() => void search.refetch()}
              >
                Reintentar
              </button>
            </div>
          )}
          {search.isSuccess && !items.length && !search.isFetching && (
            <p>Sin resultados en este alcance.</p>
          )}
          {paging?.truncated && (
            <p>Refina la búsqueda. Se muestran hasta 500 coincidencias.</p>
          )}
          {paging && paging.total > paging.limit && (
            <div className="rc2-actions">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => {
                  setIndex(-1);
                  setOffset(offset - paging.limit);
                }}
              >
                Anterior
              </button>
              <span>
                {1 + Math.floor(offset / paging.limit)} /{" "}
                {Math.ceil(paging.total / paging.limit)}
              </span>
              <button
                type="button"
                disabled={offset + paging.limit >= paging.total}
                onClick={() => {
                  setIndex(-1);
                  setOffset(offset + paging.limit);
                }}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HardwareReference({
  vendor,
  onApply,
}: {
  vendor: string;
  onApply: (vendor: string, product: string) => void;
}) {
  const manufacturer = vendor.trim();
  const query = new URLSearchParams({
    mode: "live",
    part: "h",
    vendor: manufacturer,
  });
  return (
    <details className="rc22-catalog">
      <summary>Consultar referencias CPE de hardware</summary>
      <p>
        Ingresa el fabricante del equipo. Elige una referencia solo si coincide
        con el modelo observado. Estos datos sugieren el nombre del equipo y no
        asignan un CPE.
      </p>
      <Combobox<Product>
        key={manufacturer}
        label="Buscar referencia del modelo físico"
        path={"/products?" + query}
        describe={(item) =>
          item.title + " · " + item.vendor + ":" + item.product
        }
        enabled={manufacturer.length >= 2}
        onPick={(item) => onApply(item.vendor, item.product)}
      />
    </details>
  );
}

export function CpeCatalogFields({
  part,
  selection,
  onSelect,
}: {
  part: Part;
  selection: CatalogCandidate | null;
  onSelect: (candidate: CatalogCandidate | null) => void;
}) {
  const { api, user } = useAuth();
  const [mode, setMode] = useState<Mode>("live");
  const [vendor, setVendor] = useState("");
  const [product, setProduct] = useState("");
  const [version, setVersion] = useState("");
  const [deprecated, setDeprecated] = useState("");
  const status = useQuery({
    queryKey: ["cpe-catalog-status", user?.id, mode],
    queryFn: ({ signal }) =>
      api.request<CatalogStatus>(base + "/status?mode=" + mode, { signal }),
    retry: false,
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.feed?.status === "partial" ? 5_000 : false,
  });
  const params = new URLSearchParams({ mode, part });
  const family = new URLSearchParams({ mode, part, vendor });
  const candidateParams = new URLSearchParams({
    mode,
    part,
    vendor,
    product,
    version,
  });
  if (deprecated) candidateParams.set("deprecated", deprecated);
  const build = (resource: string, values: URLSearchParams) =>
    "/" + resource + "?" + values;
  return (
    <fieldset className="rc22-catalog">
      <legend>Identidad del componente en NVD</legend>
      <label>
        Fuente del catálogo
        <select
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as Mode);
            setVendor("");
            setProduct("");
            setVersion("");
            onSelect(null);
          }}
        >
          <option value="live">NVD oficial sincronizado</option>
          <option value="fixture">Captura NVD de demostración (fixture)</option>
        </select>
      </label>
      {status.isPending && (
        <p role="status">Consultando estado del catálogo…</p>
      )}
      {status.error && (
        <div role="alert">
          <p>{errorText(status.error)}</p>
          <button
            type="button"
            className="v2-secondary-button"
            onClick={() => void status.refetch()}
          >
            Reintentar estado
          </button>
        </div>
      )}
      {status.data && (
        <p role="status">
          {status.data.records === 0 ? (
            "Catálogo vacío para esta fuente."
          ) : (
            <>
              {status.data.records.toLocaleString("es-MX")} CPE en catálogo{" "}
              {status.data.coverage === "complete" ? "completo" : "parcial"}.
              Última sincronización:{" "}
              {new Date(status.data.last_synchronized_at!).toLocaleString(
                "es-MX",
              )}
              .
              {status.data.stale &&
                " Catálogo desactualizado. Verifica la fuente antes de confirmar."}
              {status.data.last_run?.status === "failed" &&
                " La última sincronización falló. Se conservan las filas previas."}
            </>
          )}
        </p>
      )}
      {status.data?.feed && status.data.feed.status !== "complete" && (
        <p role="status">
          {status.data.feed.status === "failed"
            ? "Importación detenida"
            : "Importación en curso"}
          . {status.data.feed.next_item.toLocaleString("es-MX")} de{" "}
          {status.data.feed.total_items.toLocaleString("es-MX")} entradas
          procesadas.
        </p>
      )}
      {status.data?.feed?.status === "complete" &&
        status.data.feed.discarded > 0 && (
          <p>
            La edición se procesó con{" "}
            {status.data.feed.discarded.toLocaleString("es-MX")}{" "}
            {status.data.feed.discarded === 1 ? "descarte" : "descartes"}.
          </p>
        )}
      <div className="rc2-fields">
        <Combobox<Vendor>
          key={"vendor-" + mode}
          label="Buscar fabricante CPE"
          path={build("vendors", params)}
          selected={vendor || undefined}
          describe={(value) => value.vendor}
          onPick={(value) => {
            setVendor(value.vendor);
            setProduct("");
            setVersion("");
            onSelect(null);
          }}
        />
        <Combobox<Product>
          key={"product-" + mode + vendor}
          label="Buscar producto CPE"
          path={build("products", family)}
          selected={product || undefined}
          describe={(value) => value.title + " · " + value.product}
          onPick={(value) => {
            setProduct(value.product);
            setVersion("");
            onSelect(null);
          }}
          enabled={!!vendor}
        />
        <Combobox<Version>
          key={"version-" + mode + vendor + product}
          label="Buscar versión catalogada"
          path={build(
            "versions",
            new URLSearchParams({ mode, part, vendor, product }),
          )}
          selected={version || undefined}
          describe={(value) =>
            value.version + (value.deprecated ? " · Deprecada" : "")
          }
          onPick={(value) => {
            setVersion(value.version);
            onSelect(null);
          }}
          enabled={!!product}
        />
        <label>
          Estado del CPE
          <select
            value={deprecated}
            onChange={(event) => {
              setDeprecated(event.target.value);
              onSelect(null);
            }}
          >
            <option value="">Todos</option>
            <option value="false">Vigentes</option>
            <option value="true">Deprecados</option>
          </select>
        </label>
        <Combobox<CatalogCandidate>
          key={"cpe-" + mode + vendor + product + version + deprecated}
          maxLength={1024}
          label="Buscar CPE exacto"
          path={build("candidates", candidateParams)}
          selected={selection?.cpe_name}
          describe={(value) =>
            value.cpe_name + (value.deprecated ? " · Deprecado" : "")
          }
          onPick={onSelect}
          enabled={!!version}
        />
      </div>
      {selection && (
        <div className="rc22-cpe-result">
          <p>{selection.title}</p>
          <code>{selection.cpe_name}</code>
          <p>
            {selection.source === "nvd-feed"
              ? "Diccionario CPE de NVD"
              : selection.source === "nvd-api"
                ? "API oficial de NVD"
                : "Captura fixture de NVD"}
            . Actualizado por NVD el{" "}
            {new Date(selection.nvd_modified).toLocaleDateString("es-MX")}.
          </p>
          {selection.deprecated && (
            <p role="alert">
              CPE deprecado. Elige un candidato vigente o guarda sin CPE.
            </p>
          )}
          {selection.deprecated_by.length > 0 && (
            <ul aria-label="Reemplazos oficiales">
              {selection.deprecated_by.map((replacement) => (
                <li key={replacement.cpeNameId}>
                  <code>{replacement.cpeName}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
  );
}
