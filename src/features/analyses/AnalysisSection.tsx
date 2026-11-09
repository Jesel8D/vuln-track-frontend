import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, History, ScanSearch } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/context";
import { useIdentification } from "../../hooks/queries";
import { useAnalyses, activeRun } from "../../hooks/analyses";
import { useCooldown } from "../../hooks/useCooldown";
import { Button, date, ErrorPanel, Loading } from "../../components/ui";
import { ApiError } from "../../services/api";
import { cpeParts } from "../../services/validation";
import { analysisIntents, type AnalysisIntent } from "./intents";
import { RunStatus } from "./RunStatus";
export function AnalysisSection({ assetId }: { assetId: string }) {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const identity = useIdentification(assetId);
  const latest = useAnalyses(assetId, 1);
  const [confirm, setConfirm] = useState(false);
  const [consent, setConsent] = useState(false);
  const [intent, setIntent] = useState(() =>
    analysisIntents.get(user!.id, assetId),
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const flight = useRef(false);
  const cooldown = useCooldown();
  const mutation = useMutation({
    mutationFn: (request: AnalysisIntent) =>
      api.startAnalysis(assetId, request.body, request.key),
    retry: false,
  });
  const current = identity.data?.items[0];
  const last = latest.data?.items[0];
  const blocked =
    !current || current.state !== "confirmed"
      ? "Confirma primero la identidad tecnológica de este activo."
      : current.observed_version === null
        ? "La versión observada es desconocida. Puedes conservar la identidad, pero una consulta CVE específica necesita una versión conocida."
        : !["o", "a"].includes(cpeParts(current.cpe_name).part)
          ? "Este componente no permite una consulta CVE específica en el MVP. Revisa su identificación."
          : activeRun(last)
            ? "Ya existe una consulta activa. Abre su detalle para seguir el progreso."
            : null;
  async function start(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      flight.current ||
      cooldown.seconds ||
      (!intent && (!current || blocked || !consent))
    )
      return;
    const request = intent ?? {
      key: crypto.randomUUID(),
      body: { identification_id: current!.id },
      uncertain: false,
    };
    setIntent(request);
    analysisIntents.set(user!.id, assetId, request);
    flight.current = true;
    try {
      const accepted = await mutation.mutateAsync(request);
      if (!mounted.current) return;
      analysisIntents.remove(user!.id, assetId);
      setIntent(null);
      await cache.invalidateQueries({
        queryKey: ["analyses", user!.id, assetId],
      });
      navigate(`/activos/${assetId}/analisis/${accepted.id}`);
    } catch (error) {
      if (!mounted.current) return;
      cooldown.receive(error);
      const known =
        error instanceof ApiError &&
        ([400, 422, 429].includes(error.status) ||
          (error.status === 409 && error.code !== "IDEMPOTENCY_CONFLICT") ||
          error.code === "CVE_WORKER_UNAVAILABLE");
      if (known) {
        analysisIntents.remove(user!.id, assetId);
        setIntent(null);
        setConsent(false);
        await Promise.all([
          cache.invalidateQueries({
            queryKey: ["analyses", user!.id, assetId],
          }),
          cache.invalidateQueries({
            queryKey: ["identification", user!.id, assetId],
          }),
        ]);
      } else {
        const uncertain = { ...request, uncertain: true };
        setIntent(uncertain);
        analysisIntents.set(user!.id, assetId, uncertain);
      }
    } finally {
      flight.current = false;
    }
  }
  return (
    <section
      className="panel analysis-section"
      aria-labelledby="analysis-section-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">DE IDENTIDAD A EVIDENCIA</p>
          <h2 id="analysis-section-title">Análisis de vulnerabilidades</h2>
          <p>
            Consulta CVE relacionados con el CPE confirmado. La correlación
            requiere criterio humano.
          </p>
        </div>
        <ScanSearch size={26} className="accent" aria-hidden="true" />
      </div>
      {identity.isPending || latest.isPending ? (
        <Loading text="Consultando identidad y última ejecución…" />
      ) : identity.isError || latest.isError ? (
        <ErrorPanel
          error={identity.error ?? latest.error}
          retry={() => {
            void identity.refetch();
            void latest.refetch();
          }}
        />
      ) : (
        <>
          {current && (
            <div className="analysis-identity">
              <span className="small muted">
                {current.state === "confirmed"
                  ? "CPE confirmado"
                  : "Identificación en revisión"}{" "}
                · {date(current.recorded_at)}
              </span>
              <code className="cpe-name">{current.cpe_name}</code>
              <span className="small">
                Versión observada:{" "}
                <span className="mono">
                  {current.observed_version ?? "Desconocida"}
                </span>
              </span>
            </div>
          )}
          {last ? (
            <div className="latest-run">
              <div>
                <span className="small muted">
                  Última consulta · {date(last.created_at)}
                </span>
                <RunStatus run={last} />
              </div>
              <p className="small">
                {last.stored_count} CVE guardados · {last.retrieved_count}{" "}
                entradas recuperadas
              </p>
              <Link
                className="text-link"
                to={`/activos/${assetId}/analisis/${last.id}`}
              >
                Abrir consulta
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <p className="muted">
              Este activo todavía no tiene consultas CVE registradas.
            </p>
          )}
          {blocked && (
            <p className="notice">
              {blocked}{" "}
              {!activeRun(last) && (
                <Link
                  className="text-link"
                  to={`/activos/${assetId}/identificacion`}
                >
                  Ir a identificación CPE
                </Link>
              )}
            </p>
          )}
          {(confirm || intent) && (
            <form onSubmit={start} className="analysis-confirm">
              <h3>Consultar la identidad seleccionada</h3>
              <p>
                Se guardará una ejecución con el CPE y la versión observada. El
                resultado puede ser parcial y no confirma vulnerabilidad en el
                equipo.
              </p>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={consent || !!intent}
                  disabled={!!intent || mutation.isPending}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Confirmo consultar CVE para esta identificación.
              </label>
              {intent?.uncertain && (
                <p className="notice" role="status">
                  No pudimos verificar la aceptación. Conservamos la clave y el
                  cuerpo de este intento; el reintento recupera la misma
                  ejecución. Consulta también el historial.
                </p>
              )}
              {mutation.isError && <ErrorPanel error={mutation.error} />}
              <div className="action-row">
                <Button
                  type="submit"
                  disabled={
                    mutation.isPending ||
                    cooldown.seconds > 0 ||
                    (!intent && (!!blocked || !consent))
                  }
                >
                  {mutation.isPending
                    ? "Enviando…"
                    : cooldown.seconds
                      ? `Esperar ${cooldown.seconds} s`
                      : intent?.uncertain
                        ? "Reintentar el mismo intento"
                        : "Iniciar consulta NVD"}
                </Button>
                {!intent && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setConfirm(false);
                      setConsent(false);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          )}
          <div className="action-row">
            {!confirm && !intent && (
              <Button disabled={!!blocked} onClick={() => setConfirm(true)}>
                <ScanSearch size={17} />
                Consultar CVE
              </Button>
            )}
            <Link
              className="button secondary"
              to={`/activos/${assetId}/analisis`}
            >
              <History size={16} />
              Historial de análisis
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
