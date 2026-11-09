import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  ShieldQuestion,
} from "lucide-react";
import type { AnalysisRun, FindingApplicability } from "../../types/api";
import { applicabilityLabel, reasonText, runLabel } from "./presentation";
export function RunStatus({
  run,
}: {
  run: Pick<AnalysisRun, "status" | "coverage">;
}) {
  const Icon =
    run.status === "queued"
      ? Clock3
      : run.status === "running"
        ? LoaderCircle
        : run.status === "failed"
          ? AlertCircle
          : run.coverage === "partial"
            ? ShieldQuestion
            : CheckCircle2;
  const tone =
    run.status === "failed"
      ? "failed"
      : run.coverage === "complete"
        ? "complete"
        : run.coverage === "partial"
          ? "partial"
          : "active-run";
  return (
    <span className={`status run-status ${tone}`}>
      <Icon
        size={14}
        aria-hidden="true"
        className={run.status === "running" ? "spin" : ""}
      />
      {runLabel(run)}
    </span>
  );
}
export function Applicability({ value }: { value: FindingApplicability }) {
  return (
    <span className={`applicability ${value}`}>
      {applicabilityLabel[value]}
    </span>
  );
}
export function CoverageNotice({ run }: { run: AnalysisRun }) {
  const active = run.status === "queued" || run.status === "running";
  const text = active
    ? "La consulta sigue en curso. Los resultados guardados todavía no representan su cobertura final."
    : run.status === "failed"
      ? "La consulta falló sin páginas válidas guardadas. Este resultado no equivale a una búsqueda con cero CVE."
      : run.coverage === "partial"
        ? "Consulta incompleta: se conservaron resultados, pero faltan páginas o existe incertidumbre en los datos recibidos."
        : "Se recuperó el conjunto esperado bajo los parámetros y límites observados. La cobertura no confirma aplicabilidad ni garantiza identificar todas las vulnerabilidades.";
  return (
    <aside
      className={`coverage-notice ${run.coverage ?? run.status}`}
      aria-label="Cobertura de consulta"
    >
      <strong>
        {active
          ? "Cobertura pendiente"
          : run.status === "failed"
            ? "Sin cobertura verificable"
            : run.coverage === "partial"
              ? "Cobertura parcial"
              : "Cobertura completa de esta consulta"}
      </strong>
      <p>{text}</p>
      {run.total_results !== null && (
        <p className="mono small">
          {run.retrieved_count}{" "}
          {run.retrieved_count === 1
            ? "entrada recuperada"
            : "entradas recuperadas"}{" "}
          / {run.total_results}{" "}
          {run.total_results === 1 ? "informada" : "informadas"} ·{" "}
          {run.stored_count}{" "}
          {run.stored_count === 1
            ? "CVE distinto guardado"
            : "CVE distintos guardados"}
        </p>
      )}
      {run.warning_codes.length > 0 && (
        <ul>
          {run.warning_codes.map((code) => (
            <li key={code}>{reasonText(code)}</li>
          ))}
        </ul>
      )}
      {run.failure_code && !run.warning_codes.includes(run.failure_code) && (
        <p>{reasonText(run.failure_code)}</p>
      )}
    </aside>
  );
}
