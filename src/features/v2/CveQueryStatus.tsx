import type { CveReliability } from "../../types/cveReliability";

const labels = {
  queued: "En cola",
  running: "En curso",
  completed: "Completada",
  failed: "Fallida",
  complete: "Completa dentro de la consulta",
  partial: "Parcial",
  unknown: "No registrada",
  fresh: "Vigente según la política local",
  stale: "Desactualizada",
  current: "Identificación y versión actuales",
  historical: "Identificación o versión histórica",
};
const sources = {
  fixture: "fixture de demostración",
  simulated: "Transporte simulado",
  live: "NVD live",
  unknown: "No registrada",
};
const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("es-MX") : "No registrada";
export function CveQueryStatus({
  value,
}: {
  value: CveReliability & { nvd_mode?: string; mode?: string };
}) {
  const a = value.assessment;
  const p = value.provenance;
  const s = value.storage;
  return (
    <div className="v2-cve-query-status">
      <p>
        Fuente CVE:{" "}
        {p
          ? sources[p.cve_source]
          : (value.nvd_mode ?? value.mode) === "fixture"
            ? sources.fixture
            : "No registrada"}
        .
      </p>
      {s && (
        <p>
          {s.resolution === "reused"
            ? "Datos reutilizados desde almacenamiento; no hubo una nueva llamada al proveedor."
            : s.resolution === "provider"
              ? p?.cve_source === "fixture" || p?.cve_source === "simulated"
                ? "Datos obtenidos del proveedor de demostración y guardados."
                : "Datos obtenidos del proveedor y guardados."
              : s.refresh_attempted
                ? "No se pudo completar la actualización solicitada. Las evidencias anteriores permanecen en el historial."
                : "No se pudo obtener o almacenar la respuesta CVE."}
        </p>
      )}
      {a ? (
        <>
          <p>
            Ejecución: {labels[a.execution]} · Cobertura: {labels[a.coverage]}.
          </p>
          <p>
            Vigencia: {labels[a.freshness]} · Correspondencia:{" "}
            {labels[a.correspondence]}.
          </p>
          {a.requires_new_query && (
            <p>
              Revise la identificación actual y realice una nueva consulta si
              procede.
            </p>
          )}
        </>
      ) : (
        <p>Vigencia y correspondencia: No registradas.</p>
      )}
      <details>
        <summary>Procedencia y fechas de la consulta</summary>
        <p>
          Versión observada al consultar:{" "}
          {p?.observed_version ?? "No registrada"}.
        </p>
        <p>
          Identificación evaluada:{" "}
          <code>{p?.identification_id ?? "No registrada"}</code>.
        </p>
        <p>
          Fuente del CPE: {p?.cpe_source ?? "No registrada"} · Modo CPE:{" "}
          {p?.cpe_mode ?? "No registrado"}.
        </p>
        <p>
          Solicitud: {date(p?.requested_at)} · Respuesta recibida:{" "}
          {date(p?.response_received_at)}.
        </p>
        <p>
          Fecha de respuesta en origen: {date(p?.source_timestamp)} · Expiración
          local: {date(a?.expires_at)}.
        </p>
        {s && s.resolution !== "failed" && (
          <p>
            Obtención original: {date(s.obtained_at)} · Uso de los datos:{" "}
            {date(s.used_at)} · Expiración del almacenamiento:{" "}
            {date(s.expires_at)}.
          </p>
        )}
        {a && (
          <p>
            Política local: {a.freshness_policy_seconds} segundos desde la
            respuesta recibida. Vigencia calculada en la última lectura. No es
            una exigencia de NVD.
          </p>
        )}
      </details>
      <p>
        Una coincidencia no confirma explotación. Cero resultados solo describe
        el alcance consultado; no demuestra ausencia de vulnerabilidades.
      </p>
    </div>
  );
}
