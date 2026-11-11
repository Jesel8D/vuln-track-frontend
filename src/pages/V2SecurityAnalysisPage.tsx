import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LockKeyhole,
  Play,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../features/auth/context";
import { useWorkspace } from "../features/v2/WorkspaceContext";
import type { WorkspaceTarget } from "../types/v2";

function formatExpiry(value: string | null) {
  if (!value) return "Vigencia no registrada";
  return `Autorización hasta ${new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(new Date(value))}`;
}

export function V2SecurityAnalysisPage() {
  const { api, user } = useAuth();
  const { selectedId, current } = useWorkspace();
  const [targetId, setTargetId] = useState("");
  const targetsQuery = useQuery({
    queryKey: ["v2", user?.id, selectedId, "authorized-targets"],
    queryFn: ({ signal }) => api.v2WorkspaceTargets(selectedId!, signal),
    enabled: Boolean(selectedId),
    staleTime: 30_000,
  });
  const authorizedTargets = useMemo(
    () =>
      (targetsQuery.data?.items ?? []).filter(
        (target) =>
          target.authorization_status === "approved" &&
          target.application_status === "active",
      ),
    [targetsQuery.data],
  );
  const selectedTarget: WorkspaceTarget | undefined = authorizedTargets.find(
    (target) => target.id === targetId,
  );

  return (
    <div className="v2-page v2-zap-page">
      <section className="v2-security-banner v2-zap-engine-banner">
        <div className="v2-security-icon">
          <ShieldCheck size={25} aria-hidden="true" />
        </div>
        <div className="v2-security-copy">
          <div className="v2-zap-kicker">
            <span>Ejecutor de análisis de seguridad</span>
            <strong>OWASP ZAP BASELINE</strong>
          </div>
          <h1>Análisis web autorizado</h1>
          <p>El backend aún no tiene habilitada la ejecución de ZAP.</p>
        </div>
        <span className="v2-zap-status-pill">
          <i /> Integración pendiente
        </span>
      </section>

      <section className="v2-panel v2-zap-description">
        <div className="v2-security-icon">
          <ShieldCheck size={23} aria-hidden="true" />
        </div>
        <div>
          <h2>OWASP ZAP Baseline Scan</h2>
          <p>
            Perfil pasivo para revisar respuestas y configuración HTTP de una
            aplicación web autorizada. No es un análisis de aplicaciones móviles
            nativas ni garantiza detectar todas las vulnerabilidades.
          </p>
        </div>
        <a
          className="v2-secondary-button"
          href="https://www.zaproxy.org/docs/docker/baseline-scan/"
          target="_blank"
          rel="noreferrer"
        >
          Documentación oficial <ExternalLink size={15} aria-hidden="true" />
        </a>
      </section>

      <div className="v2-zap-workspace-grid">
        <section className="v2-panel v2-zap-target-panel">
          <div className="v2-panel-heading">
            <div>
              <span className="v2-eyebrow">OBJETIVO DEL ANÁLISIS</span>
              <h2>Selecciona una URL autorizada</h2>
              <p>Workspace: {current?.name ?? "Cargando…"}</p>
            </div>
            <span className="v2-zap-step">PASO 1 DE 2</span>
          </div>

          {targetsQuery.isPending ? (
            <p className="v2-zap-empty">Cargando destinos autorizados…</p>
          ) : targetsQuery.isError ? (
            <p className="v2-zap-empty" role="alert">
              No pudimos consultar los destinos del workspace.
            </p>
          ) : authorizedTargets.length === 0 ? (
            <p className="v2-zap-empty">
              Este workspace no tiene URLs activas con autorización vigente.
              Registra el destino y documenta su autorización desde la
              aplicación correspondiente.
            </p>
          ) : (
            <label className="v2-zap-target-select">
              <span>Destino registrado</span>
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value="">Selecciona un destino</option>
                {authorizedTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.application_name} — {target.url}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="v2-zap-target-details">
            <div>
              <span>APLICACIÓN</span>
              <strong>{selectedTarget?.application_name ?? "—"}</strong>
            </div>
            <div>
              <span>DESTINO WEB</span>
              <strong className="v2-zap-url">
                {selectedTarget?.url ?? "Elige una URL autorizada"}
              </strong>
            </div>
            <div>
              <span>AUTORIZACIÓN</span>
              <strong>
                {selectedTarget ? (
                  <>
                    <CheckCircle2 size={15} aria-hidden="true" />{" "}
                    {formatExpiry(selectedTarget.authorization_expires_at)}
                  </>
                ) : (
                  "No seleccionada"
                )}
              </strong>
            </div>
          </div>

          <div className="v2-zap-profile-grid">
            <div>
              <span>PERFIL</span>
              <strong>Baseline pasivo</strong>
            </div>
            <div>
              <span>EJECUCIÓN</span>
              <strong>Pendiente de controles del backend</strong>
            </div>
          </div>

          <div className="v2-zap-actions">
            <button className="v2-primary-button" disabled>
              <Play size={17} aria-hidden="true" /> Iniciar análisis Baseline
            </button>
            <p>
              <LockKeyhole size={15} aria-hidden="true" />
              No se enviará tráfico al objetivo desde esta vista.
            </p>
          </div>
        </section>

        <section className="v2-zap-progress-column">
          <div className="v2-zap-phases" aria-label="Fases del análisis">
            <div className="v2-zap-phase">
              <span>01 · Fase</span>
              <strong>Pendiente</strong>
              <small>Validar objetivo y permiso</small>
            </div>
            <div className="v2-zap-phase is-blocked">
              <span>02 · Fase</span>
              <strong>Bloqueada</strong>
              <small>Esperando controles de seguridad</small>
            </div>
            <div className="v2-zap-phase">
              <span>03 · Fase</span>
              <strong>Sin iniciar</strong>
              <small>Sin resultados registrados</small>
            </div>
          </div>
          <div className="v2-panel v2-zap-console-panel">
            <div className="v2-zap-console-heading">
              <div>
                <span className="v2-status-dot" />
                <strong>Estado de ejecución</strong>
              </div>
              <span>
                <Clock3 size={14} /> Sin ejecución
              </span>
            </div>
            <div className="v2-zap-blocked-state">
              <AlertTriangle size={24} aria-hidden="true" />
              <strong>La ejecución todavía no está habilitada</strong>
              <p>
                Falta aprobar y verificar el aislamiento del proceso, la lista
                permitida y la validación de DNS, redirecciones y conexiones.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="v2-zap-empty-history v2-panel">
        <div className="v2-panel-heading">
          <div>
            <span className="v2-eyebrow">RESULTADOS E HISTORIAL</span>
            <h2>Los análisis ZAP aparecerán aquí</h2>
          </div>
          <ScanLine size={20} aria-hidden="true" />
        </div>
        <p>
          No hay ejecuciones ZAP registradas para mostrar. Los hallazgos NVD se
          consultan desde el historial de cada aplicación y se mantienen como
          una fuente separada.
        </p>
      </section>
    </div>
  );
}
