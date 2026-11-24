import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/context";
import type { CpeConfirmation, Technology } from "../../types/v2";
import { errorText } from "../../services/api";
import { Pagination } from "./Pagination";

export function ConfirmationDetails({ row }: { row: CpeConfirmation }) {
  const snapshot = row.catalog_evidence;
  return (
    <dl className="v2-cpe-provenance">
      <dt>Fuente</dt>
      <dd>
        {row.mode === "fixture"
          ? "Fixture de demostración"
          : "Catálogo oficial NVD"}{" "}
        · {row.source}
      </dd>
      <dt>UUID del registro CPE</dt>
      <dd>
        <code>{row.cpe_name_id}</code>
      </dd>
      <dt>Producto observado</dt>
      <dd>
        {row.observed_vendor ?? "Fabricante no registrado"} ·{" "}
        {row.observed_product} · {row.observed_version}
      </dd>
      <dt>Confirmación</dt>
      <dd>{new Date(row.confirmed_at).toLocaleString("es-MX")}</dd>
      <dt>Motivo</dt>
      <dd>{row.reason ?? "No registrado"}</dd>
      <dt>Evidencia aportada</dt>
      <dd>{row.evidence ?? "No registrada"}</dd>
      {snapshot?.record && (
        <>
          <dt>Producto en el catálogo al confirmar</dt>
          <dd>
            {snapshot.record.vendor} · {snapshot.record.product} ·{" "}
            {snapshot.record.version}
          </dd>
          <dt>Modificación NVD registrada</dt>
          <dd>
            {new Date(snapshot.record.nvd_modified).toLocaleString("es-MX")}
          </dd>
        </>
      )}
      {snapshot?.feed && (
        <>
          <dt>Edición del feed disponible al confirmar</dt>
          <dd>
            {new Date(snapshot.feed.source_modified).toLocaleString("es-MX")}
          </dd>
          <dt>SHA-256 del feed registrado</dt>
          <dd>
            <code>{snapshot.feed.digest}</code>
          </dd>
        </>
      )}
    </dl>
  );
}

function ConfirmationHistory({
  workspaceId,
  applicationId,
  technologyId,
}: {
  workspaceId: string;
  applicationId: string;
  technologyId: string;
}) {
  const { api, user } = useAuth();
  const [offset, setOffset] = useState(0);
  const history = useQuery({
    queryKey: [
      "v2",
      user?.id,
      workspaceId,
      applicationId,
      "technologies",
      technologyId,
      "confirmations",
      offset,
    ],
    queryFn: ({ signal }) =>
      api.cpeConfirmations(
        workspaceId,
        applicationId,
        technologyId,
        offset,
        signal,
      ),
  });
  if (history.isPending) return <p role="status">Cargando confirmaciones…</p>;
  if (history.isError)
    return (
      <p role="alert">
        {errorText(history.error)}{" "}
        <button
          className="v2-text-button"
          onClick={() => void history.refetch()}
        >
          Reintentar
        </button>
      </p>
    );
  return (
    <>
      {history.data.items.length === 0 && (
        <p>
          No hay confirmaciones con procedencia registrada. Las selecciones
          antiguas no se han reconstruido.
        </p>
      )}
      <ol>
        {history.data.items.map((row) => (
          <li key={row.id}>
            <strong>{row.is_current ? "Vigente" : "Histórica"}</strong>
            <br />
            <code>{row.cpe_name}</code>
            <ConfirmationDetails row={row} />
          </li>
        ))}
      </ol>
      <Pagination page={history.data.page} onChange={setOffset} />
    </>
  );
}

export function CpeProvenance({
  workspaceId,
  applicationId,
  technology,
}: {
  workspaceId: string;
  applicationId: string;
  technology: Technology;
}) {
  const [open, setOpen] = useState(false);
  const row = technology.cpe_confirmation;
  const current =
    row &&
    row.cpe_name === technology.selected_cpe &&
    row.observed_vendor === technology.vendor &&
    row.observed_product === technology.product &&
    row.observed_version === technology.version;
  return (
    <div>
      {technology.selected_cpe &&
        (current ? (
          <ConfirmationDetails row={row} />
        ) : (
          <p>
            Procedencia, UUID y fecha de confirmación: no registrados. No se
            infiere que sea fixture u oficial.
          </p>
        ))}
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>Historial de confirmaciones CPE</summary>
        {open && (
          <ConfirmationHistory
            workspaceId={workspaceId}
            applicationId={applicationId}
            technologyId={technology.id}
          />
        )}
      </details>
    </div>
  );
}
