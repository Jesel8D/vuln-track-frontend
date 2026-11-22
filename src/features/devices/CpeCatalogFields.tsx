import { useEffect, useId, useRef, useState } from "react";
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
  catalog_backend: "local" | "external_readonly";
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
  describe,
  onPick,
  onClear,
  enabled = true,
  maxLength = 120,
  prompt = "Seleccionar",
}: {
  label: string;
  path: string;
  selected?: string;
  describe: (item: T) => string;
  onPick: (item: T) => void;
  onClear: () => void;
  enabled?: boolean;
  maxLength?: number;
  prompt?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { api, user } = useAuth();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(-1);
  const current = query === input.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 275);
    return () => window.clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open && index >= 0) {
      document
        .getElementById(id + "-" + index)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [id, index, open]);
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
    enabled: open && enabled && current,
    retry: false,
    staleTime: 30_000,
  });
  const items = current ? (search.data?.items ?? []) : [];
  const paging = current ? search.data?.page : undefined;

  function close(focus = false) {
    setOpen(false);
    setIndex(-1);
    if (focus) trigger.current?.focus();
  }

  function choose(item: T) {
    onPick(item);
    setInput("");
    setQuery("");
    setOffset(0);
    close(true);
  }

  function move(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!items.length) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setIndex((position) =>
        position < 0
          ? delta === 1
            ? 0
            : items.length - 1
          : (position + delta + items.length) % items.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (items[index]) choose(items[index]);
    }
  }

  function changePage(value: number) {
    setIndex(-1);
    setOffset(value);
  }

  return (
    <div
      className="rc22-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <span className="rc31-picker-label">{label}</span>
      <div className="rc31-picker-actions">
        <button
          ref={trigger}
          type="button"
          className="rc31-picker-trigger"
          aria-label={label + (selected ? " · " + selected : "")}
          aria-expanded={open && enabled}
          aria-controls={open && enabled ? id + "-panel" : undefined}
          disabled={!enabled}
          onClick={() => (open ? close() : setOpen(true))}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span>
            {selected || (enabled ? prompt : "Selecciona el campo anterior")}
          </span>
          <span className="rc31-picker-chevron" aria-hidden="true" />
        </button>
        {selected && (
          <button
            type="button"
            className="rc31-picker-clear"
            aria-label={"Limpiar " + label}
            onClick={() => {
              onClear();
              setInput("");
              setQuery("");
              setOffset(0);
              close(true);
            }}
          >
            Limpiar
          </button>
        )}
      </div>
      {open && enabled && (
        <div className="rc22-options" id={id + "-panel"}>
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-label={label}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={id + "-options"}
            aria-activedescendant={items[index] ? id + "-" + index : undefined}
            placeholder="Filtrar opciones"
            value={input}
            maxLength={maxLength}
            onChange={(event) => {
              setInput(event.target.value);
              setOffset(0);
              setIndex(-1);
            }}
            onKeyDown={move}
          />
          <ul id={id + "-options"} role="listbox" aria-label={label}>
            {items.map((item, position) => (
              <li
                id={id + "-" + position}
                key={id + "-" + position}
                role="option"
                aria-selected={index === position}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
              >
                {describe(item)}
              </li>
            ))}
          </ul>
          {(!current || search.isFetching) && (
            <p role="status">Buscando opciones…</p>
          )}
          {current && search.isError && (
            <div role="alert">
              <p>{errorText(search.error)}</p>
              <button type="button" onClick={() => void search.refetch()}>
                Reintentar
              </button>
            </div>
          )}
          {current &&
            search.isSuccess &&
            !items.length &&
            !search.isFetching && (
              <p role="status">No hay opciones para esta búsqueda.</p>
            )}
          {paging?.truncated && (
            <p>Refina la búsqueda para ver otras coincidencias.</p>
          )}
          {paging && paging.total > paging.limit && (
            <div className="rc2-actions">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => changePage(offset - paging.limit)}
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
                onClick={() => changePage(offset + paging.limit)}
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
  model,
  onApply,
}: {
  vendor: string;
  model: string;
  onApply: (vendor: string, model: string) => void;
}) {
  const scope = new URLSearchParams({ mode: "live", part: "h" });
  const products = new URLSearchParams(scope);
  products.set("vendor", vendor);
  return (
    <>
      <Combobox<Vendor>
        label="Fabricante del equipo"
        prompt="Seleccionar fabricante"
        path={"/vendors?" + scope}
        selected={vendor}
        describe={(item) => item.vendor}
        onPick={(item) => {
          if (item.vendor !== vendor) onApply(item.vendor, "");
        }}
        onClear={() => onApply("", "")}
      />
      <Combobox<Product>
        key={vendor}
        label="Modelo del equipo"
        prompt="Seleccionar modelo"
        path={"/products?" + products}
        selected={model}
        describe={(item) => item.title + " · " + item.product}
        enabled={!!vendor}
        onPick={(item) => onApply(item.vendor, item.product)}
        onClear={() => onApply(vendor, "")}
      />
    </>
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
  const cveMode = import.meta.env.VITE_NVD_MODE;
  const clearVersion = () => {
    setVersion("");
    onSelect(null);
  };
  const clearProduct = () => {
    setProduct("");
    clearVersion();
  };
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
            clearProduct();
          }}
        >
          <option value="live">NVD oficial sincronizado</option>
          <option value="fixture">Captura NVD de demostración (fixture)</option>
        </select>
      </label>
      {cveMode === "fixture" && (
        <p>
          Consultas CVE en modo demostración.{" "}
          {mode === "live" &&
            "Para consultar CVE en este perfil, confirma un CPE de la captura fixture."}
        </p>
      )}
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
          {mode === "live" &&
            (status.data.catalog_backend === "external_readonly"
              ? "Catálogo externo de solo lectura. "
              : "Catálogo local de esta instalación. ")}
          {status.data.records === 0 ? (
            "Catálogo vacío para esta fuente."
          ) : (
            <>
              {status.data.records.toLocaleString("es-MX")} CPE en catálogo{" "}
              {status.data.coverage === "complete" ? "completo" : "parcial"}.
              Última sincronización:{" "}
              {status.data.last_synchronized_at
                ? new Date(status.data.last_synchronized_at).toLocaleString(
                    "es-MX",
                  )
                : "sin fecha"}
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
            clearProduct();
          }}
          onClear={() => {
            setVendor("");
            clearProduct();
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
            clearVersion();
          }}
          onClear={clearProduct}
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
          onClear={clearVersion}
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
          onClear={() => onSelect(null)}
          enabled={!!version}
        />
      </div>
      {selection && (
        <div className="rc22-cpe-result">
          <p>{selection.title}</p>
          <code>{selection.cpe_name}</code>
          <p>
            UUID del CPE <code>{selection.cpe_name_id}</code>
          </p>
          <p>
            {selection.source === "nvd-feed"
              ? "Diccionario CPE de NVD"
              : selection.source === "nvd-api"
                ? "API oficial de NVD"
                : "Captura fixture de NVD"}
            . Actualizado por NVD el{" "}
            {new Date(selection.nvd_modified).toLocaleDateString("es-MX")}.{" "}
            {selection.deprecated ? "Deprecado." : "Vigente en el catálogo."}
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
