import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, date, ErrorPanel } from "../../components/ui";
import { TextField } from "../../components/TextField";
import { useAuth } from "../auth/context";
import { normalize, textError } from "../../services/validation";
import type {
  AnalysisRun,
  Finding,
  FindingApplicability,
  ReviewInput,
} from "../../types/api";
import { applicabilityLabel } from "./presentation";
import { activeRun } from "../../hooks/analyses";
export function ReviewForm({
  finding,
  run,
}: {
  finding: Finding;
  run: AnalysisRun;
}) {
  const { api, user } = useAuth();
  const cache = useQueryClient();
  const [applicability, setApplicability] = useState<FindingApplicability>(
    finding.applicability,
  );
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ reason?: string; evidence?: string }>(
    {},
  );
  const [uncertain, setUncertain] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const flight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const mutation = useMutation({
    mutationFn: (body: ReviewInput) => api.reviewFinding(finding.id, body),
    retry: false,
  });
  async function refresh() {
    setReconciled(false);
    try {
      const current = await api.finding(finding.id);
      if (!mounted.current) return;
      cache.setQueryData(["finding", user!.id, finding.id], current);
      await cache.invalidateQueries({ queryKey: ["findings", user!.id] });
      setReconciled(true);
    } catch {
      setReconciled(false);
    }
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current || uncertain || !consent) return;
    const re = textError(reason, 500),
      ev = textError(evidence, 2000);
    setErrors({ reason: re ?? undefined, evidence: ev ?? undefined });
    if (re || ev) return;
    flight.current = true;
    try {
      const result = await mutation.mutateAsync({
        status: "reviewed",
        applicability,
        expected_updated_at: finding.updated_at,
        reason: normalize(reason),
        evidence: normalize(evidence),
      });
      if (!mounted.current) return;
      cache.setQueryData(["finding", user!.id, finding.id], result);
      await cache.invalidateQueries({ queryKey: ["findings", user!.id] });
    } catch {
      if (!mounted.current) return;
      // PATCH is not idempotent. Never replay it automatically, even on a lost response.
      setUncertain(true);
      await refresh();
    } finally {
      flight.current = false;
    }
  }
  if (finding.status === "reviewed")
    return (
      <section className="panel" aria-labelledby="review-title">
        <p className="eyebrow">DECISIÓN HUMANA CONSERVADA</p>
        <h2 id="review-title">Hallazgo revisado</h2>
        <p role="status">
          Revisión registrada. La evidencia original se conserva.
        </p>
        <dl className="detail-grid">
          <div>
            <dt>Aplicabilidad tras revisión</dt>
            <dd>{applicabilityLabel[finding.applicability]}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>
              {finding.reviewed_at
                ? date(finding.reviewed_at)
                : "No disponible"}
            </dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd className="mono">
              {finding.reviewed_by === user?.id
                ? `${user.username} (tú)`
                : (finding.reviewed_by ?? "No disponible")}
            </dd>
          </div>
        </dl>
        <div className="reason">
          <span>Motivo</span>
          <p>{finding.review_reason ?? "Sin motivo registrado"}</p>
        </div>
        <div className="reason">
          <span>Evidencia de revisión</span>
          <p>{finding.review_evidence ?? "Sin evidencia registrada"}</p>
        </div>
        <p className="small muted">
          El MVP admite una revisión. La evidencia de origen y la evaluación
          inicial permanecen intactas.
        </p>
      </section>
    );
  if (!finding.evidence || activeRun(run))
    return (
      <p className="notice">
        {!finding.evidence
          ? "Este registro legado no tiene evidencia suficiente para habilitar la revisión del MVP."
          : "La revisión estará disponible cuando termine esta ejecución."}
      </p>
    );
  return (
    <section className="panel review-panel" aria-labelledby="review-title">
      <p className="eyebrow">CRITERIO HUMANO</p>
      <h2 id="review-title">Revisar el hallazgo</h2>
      <p className="muted">
        Registra una decisión con motivo y evidencia. Solo se admite una
        revisión y no reemplaza los datos de NVD.
      </p>
      {mutation.isError && <ErrorPanel error={mutation.error} />}
      {uncertain && (
        <div className="notice" role="status">
          <p>
            {reconciled
              ? "Se consultó el estado actual. La revisión sigue abierta. El envío anterior no se repetirá automáticamente."
              : "No pudimos verificar la revisión. Consulta el estado actual antes de continuar."}
          </p>
          <Button variant="secondary" onClick={() => void refresh()}>
            Consultar revisión actual
          </Button>
          {reconciled && (
            <Button
              variant="ghost"
              onClick={() => {
                setUncertain(false);
                setConsent(false);
                mutation.reset();
              }}
            >
              Preparar una revisión con el estado actual
            </Button>
          )}
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <fieldset disabled={mutation.isPending || uncertain}>
          <div className="field">
            <label htmlFor="review-applicability">
              Aplicabilidad tras revisión
            </label>
            <select
              id="review-applicability"
              value={applicability}
              onChange={(e) => {
                const v = e.target.value;
                if (
                  v === "potential" ||
                  v === "undetermined" ||
                  v === "not_applicable"
                )
                  setApplicability(v);
              }}
            >
              {Object.entries(applicabilityLabel).map(([v, label]) => (
                <option value={v} key={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <TextField
            name="review-reason"
            label="Motivo de la revisión"
            required
            max={500}
            multiline
            value={reason}
            onChange={setReason}
            error={errors.reason}
          />
          <TextField
            name="review-evidence"
            label="Evidencia de la revisión"
            required
            max={2000}
            multiline
            value={evidence}
            onChange={setEvidence}
            error={errors.evidence}
            hint="Cita la observación o documento que sustenta la decisión. No incluyas credenciales."
          />
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Confirmo guardar esta revisión única con su evidencia.
          </label>
        </fieldset>
        <Button
          type="submit"
          disabled={mutation.isPending || uncertain || !consent}
        >
          {mutation.isPending
            ? "Guardando revisión…"
            : "Guardar revisión del hallazgo"}
        </Button>
      </form>
    </section>
  );
}
