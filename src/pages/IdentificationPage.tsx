import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  History,
  LoaderCircle,
  Search,
  ShieldQuestion,
} from "lucide-react";
import { useAuth } from "../features/auth/context";
import { useAsset, useIdentification } from "../hooks/queries";
import { useCooldown } from "../hooks/useCooldown";
import { ApiError } from "../services/api";
import { cpeParts, normalize, textError } from "../services/validation";
import type {
  Candidate,
  CandidateList,
  ComponentKind,
  IdentificationInput,
} from "../types/api";
import {
  Button,
  componentLabel,
  date,
  Empty,
  ErrorPanel,
  IdentityChain,
  Loading,
  PageHeading,
  Status,
} from "../components/ui";
import { TextField } from "../components/TextField";
export function IdentificationPage() {
  const { assetId = "" } = useParams();
  const { api } = useAuth();
  const cache = useQueryClient();
  const asset = useAsset(assetId);
  const current = useIdentification(assetId);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [candidates, setCandidates] = useState<CandidateList | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<unknown>(null);
  const [searchValidation, setSearchValidation] = useState<string | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [component, setComponent] = useState<ComponentKind | "">("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [consent, setConsent] = useState(false);
  const [review, setReview] = useState(false);
  const [intent, setIntent] = useState<{
    key: string;
    body: IdentificationInput;
  } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const flight = useRef(false);
  const cooldown = useCooldown();
  const mutation = useMutation({
    mutationFn: (request: { key: string; body: IdentificationInput }) =>
      api.identify(assetId, request.body, request.key),
  });
  useEffect(() => () => controller.current?.abort(), []);
  async function search(offset = 0) {
    const term = normalize(offset ? searched : query);
    const error =
      textError(term, 200) ??
      ([...term].length < 2 ? "Escribe al menos 2 caracteres." : null);
    setSearchValidation(error);
    if (error || cooldown.seconds || intent || searchBusy) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setSearchBusy(true);
    setSearchError(null);
    setCandidates(null);
    setSelected(null);
    setConsent(false);
    setReview(false);
    setSuccess(null);
    try {
      const result = await api.candidates(term, offset, request.signal);
      if (!request.signal.aborted) {
        setCandidates(result);
        setSearched(term);
      }
    } catch (error) {
      if (!request.signal.aborted) {
        setSearchError(error);
        cooldown.receive(error);
      }
    } finally {
      if (!request.signal.aborted) setSearchBusy(false);
    }
  }
  async function confirm(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current || !current.data || cooldown.seconds) return;
    const invalid = textError(reason, 500);
    setReasonError(invalid ?? undefined);
    if (invalid || (!review && (!selected || !component || !consent))) return;
    const body: IdentificationInput = review
      ? {
          state: "needs_review",
          expected_current_id: current.data.items[0]?.id ?? null,
          reason: normalize(reason),
        }
      : {
          state: "confirmed",
          cpe_name_id: selected!.cpe_name_id,
          component_kind: component as ComponentKind,
          expected_current_id: current.data.items[0]?.id ?? null,
          reason: normalize(reason),
        };
    const request = intent ?? { key: crypto.randomUUID(), body };
    setIntent(request);
    flight.current = true;
    setSuccess(null);
    try {
      const event = await mutation.mutateAsync(request);
      setIntent(null);
      setUncertain(false);
      setSelected(null);
      setConsent(false);
      setReason("");
      setReview(false);
      setComponent("");
      setSuccess(
        event.state === "confirmed"
          ? "Identificación confirmada. El evento quedó guardado en el historial."
          : "Identificación marcada para revisión. Se conservó la confirmación anterior en el historial.",
      );
      await cache.invalidateQueries({ queryKey: ["identification"] });
    } catch (error) {
      cooldown.receive(error);
      const knownExternal =
        error instanceof ApiError &&
        ["NVD_UNAVAILABLE", "NVD_TIMEOUT", "NVD_INVALID_RESPONSE"].includes(
          error.code,
        );
      const rejected =
        error instanceof ApiError &&
        ([400, 422, 429].includes(error.status) ||
          (error.status === 409 &&
            !["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_EXPIRED"].includes(
              error.code,
            )));
      if (knownExternal || rejected) {
        setIntent(null);
        setUncertain(false);
      } else setUncertain(true);
      if (
        error instanceof ApiError &&
        error.code === "CURRENT_IDENTIFICATION_CHANGED"
      ) {
        setSelected(null);
        setConsent(false);
        await cache.invalidateQueries({ queryKey: ["identification"] });
      }
    } finally {
      flight.current = false;
    }
  }
  if (asset.isPending || current.isPending)
    return <Loading text="Consultando el activo y su identidad actual…" />;
  if (asset.isError)
    return (
      <ErrorPanel error={asset.error} retry={() => void asset.refetch()} />
    );
  if (current.isError)
    return (
      <ErrorPanel error={current.error} retry={() => void current.refetch()} />
    );
  const active = current.data.items[0];
  const locked = mutation.isPending || uncertain;
  return (
    <>
      <Link className="text-link back-link" to={`/activos/${assetId}`}>
        <ArrowLeft size={15} />
        Detalle del activo
      </Link>
      <PageHeading
        eyebrow="IDENTIFICACIÓN ASISTIDA"
        title="Encuentra la identidad correcta."
        description={`${asset.data.manufacturer} ${asset.data.model} · Versión observada: ${asset.data.version ?? "desconocida"}`}
        action={
          <Link
            className="button secondary"
            to={`/activos/${assetId}/historial`}
          >
            <History size={16} />
            Ver historial
          </Link>
        }
      />
      <IdentityChain state={current.data.current_state} />
      {success && (
        <div className="success-message" role="status">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      <section className="panel search-panel">
        <div className="section-heading">
          <div>
            <h2>Busca en el catálogo CPE de NVD</h2>
            <p>
              El producto tecnológico puede ser distinto del fabricante físico
              del equipo.
            </p>
          </div>
          <Fingerprint size={25} className="accent" aria-hidden="true" />
        </div>
        <form
          className="cpe-search"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <div className="field">
            <label htmlFor="cpe-query">
              Producto, firmware o sistema operativo
            </label>
            <div className="search-input">
              <Search size={18} aria-hidden="true" />
              <input
                id="cpe-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Por ejemplo: Cisco RV340 firmware"
                aria-invalid={!!searchValidation}
                aria-describedby={
                  searchValidation ? "query-error" : "query-help"
                }
                maxLength={400}
                disabled={!!intent || searchBusy}
              />
            </div>
            {searchValidation && (
              <small id="query-error" className="field-error">
                {searchValidation}
              </small>
            )}
          </div>
          <Button
            type="submit"
            disabled={searchBusy || !!intent || cooldown.seconds > 0}
          >
            {searchBusy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Search size={17} />
            )}{" "}
            {cooldown.seconds
              ? `Esperar ${cooldown.seconds} s`
              : "Buscar candidatos"}
          </Button>
        </form>
        <p id="query-help" className="small muted">
          La búsqueda no envía ubicación, etiqueta de inventario ni notas.
          Ningún resultado se selecciona automáticamente.
        </p>
        {searchError != null && <ErrorPanel error={searchError} />}
      </section>
      <div className="identification-layout">
        <section className="panel candidate-panel">
          <div className="section-heading">
            <div>
              <h2>
                Candidatos oficiales{" "}
                {candidates && (
                  <span className="count">{candidates.page.total}</span>
                )}
              </h2>
              <p>
                {candidates
                  ? `Consulta: ${searched}`
                  : "Busca para comparar productos y versiones."}
              </p>
            </div>
          </div>
          {searchBusy ? (
            <Loading text="Consultando NVD…" />
          ) : candidates?.items.length === 0 ? (
            <Empty
              title="Sin candidatos para esta búsqueda"
              text="Prueba un nombre tecnológico diferente. El activo permanece guardado."
            />
          ) : candidates ? (
            <>
              <fieldset disabled={locked}>
                <legend className="sr-only">
                  Selecciona explícitamente un candidato CPE
                </legend>
                <div className="candidate-list">
                  {candidates.items.map((candidate) => {
                    const parts = cpeParts(candidate.cpe_name);
                    const mismatch =
                      asset.data.version !== null &&
                      parts.version.toLocaleLowerCase() !==
                        asset.data.version.toLocaleLowerCase();
                    return (
                      <label
                        key={candidate.cpe_name_id}
                        className={`candidate ${selected?.cpe_name_id === candidate.cpe_name_id && !review ? "selected" : ""} ${candidate.deprecated ? "deprecated" : ""}`}
                      >
                        <div className="candidate-title">
                          <input
                            type="radio"
                            name="cpe-candidate"
                            value={candidate.cpe_name_id}
                            checked={
                              selected?.cpe_name_id === candidate.cpe_name_id &&
                              !review
                            }
                            disabled={candidate.deprecated}
                            onChange={() => {
                              setSelected(candidate);
                              setConsent(false);
                              setReview(false);
                              setSuccess(null);
                              mutation.reset();
                            }}
                          />
                          <strong>
                            {candidate.title ??
                              `${parts.vendor} ${parts.product}`}
                          </strong>
                        </div>
                        <code className="cpe-name">{candidate.cpe_name}</code>
                        <dl className="candidate-meta">
                          <div>
                            <dt>Tipo CPE</dt>
                            <dd>
                              {parts.part === "o"
                                ? "SO / firmware"
                                : parts.part === "h"
                                  ? "Hardware"
                                  : "Aplicación"}
                            </dd>
                          </div>
                          <div>
                            <dt>Versión</dt>
                            <dd className="mono">{parts.version}</dd>
                          </div>
                          <div>
                            <dt>Update</dt>
                            <dd className="mono">{parts.update}</dd>
                          </div>
                          <div>
                            <dt>Plataforma SW / HW</dt>
                            <dd className="mono">
                              {parts.targetSw} / {parts.targetHw}
                            </dd>
                          </div>
                        </dl>
                        {candidate.deprecated ? (
                          <span className="candidate-warning">
                            Deprecado · selecciona otra opción
                          </span>
                        ) : mismatch ? (
                          <span className="candidate-warning">
                            La versión difiere de la observada; comprueba el
                            candidato.
                          </span>
                        ) : (
                          <span className="candidate-origin">
                            Diccionario oficial NVD
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="candidate-pagination">
                <span className="small muted">
                  {candidates.page.offset + 1}–
                  {candidates.page.offset + candidates.items.length} de{" "}
                  {candidates.page.total}
                </span>
                <div>
                  <Button
                    variant="ghost"
                    disabled={
                      searchBusy ||
                      !!intent ||
                      cooldown.seconds > 0 ||
                      candidates.page.offset === 0
                    }
                    aria-label="Candidatos anteriores"
                    onClick={() =>
                      void search(Math.max(0, candidates.page.offset - 10))
                    }
                  >
                    <ArrowLeft size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={
                      searchBusy ||
                      !!intent ||
                      cooldown.seconds > 0 ||
                      candidates.page.offset + 10 >= candidates.page.total ||
                      candidates.page.offset + 10 > 10000
                    }
                    aria-label="Más candidatos"
                    onClick={() => void search(candidates.page.offset + 10)}
                  >
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
              <p className="source-time mono">
                NVD · respuesta {date(candidates.source_timestamp)}
              </p>
            </>
          ) : (
            <Empty
              title="Primero, busca un producto"
              text="Compararemos el tipo de componente, la versión y la plataforma antes de confirmar."
            />
          )}
        </section>
        <aside className="selection-column">
          <section className="panel selection-panel">
            <p className="eyebrow">CONFIRMACIÓN HUMANA</p>
            <h2>
              {review
                ? "Marca la identidad para revisión."
                : "Tu criterio completa la identidad."}
            </h2>
            <div className="observed-version">
              <span>Versión observada del activo</span>
              <strong className="mono">
                {asset.data.version ?? "Desconocida"}
              </strong>
            </div>
            {asset.data.version === null && (
              <p className="notice">
                Puedes confirmar la identidad con versión desconocida. Esto no
                permite una evaluación CVE específica.
              </p>
            )}
            {selected || review ? (
              <form onSubmit={confirm} noValidate>
                <fieldset disabled={locked}>
                  {selected && !review && (
                    <>
                      <p className="selected-caption">Candidato seleccionado</p>
                      <p className="cpe-name mono selected-name">
                        {selected.cpe_name}
                      </p>
                      <div className="field">
                        <label htmlFor="component-kind">
                          Componente principal{" "}
                          <span className="required">*</span>
                        </label>
                        <select
                          id="component-kind"
                          required
                          value={component}
                          onChange={(e) =>
                            setComponent(e.target.value as ComponentKind)
                          }
                        >
                          <option value="">Selecciona el componente</option>
                          {Object.entries(componentLabel).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                    </>
                  )}
                  <TextField
                    name="reason"
                    label="Motivo de la decisión"
                    required
                    max={500}
                    multiline
                    value={reason}
                    onChange={setReason}
                    error={reasonError}
                    hint="Explica qué comparaste, sin incluir datos sensibles."
                  />
                  {!review && (
                    <label className="checkbox-line">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        required
                      />
                      Comparé el componente y la versión observada con este
                      candidato.
                    </label>
                  )}
                </fieldset>
                {mutation.isError && <ErrorPanel error={mutation.error} />}{" "}
                {uncertain && (
                  <p className="notice" role="status">
                    El resultado de este intento es incierto. Conservamos su
                    clave y datos: reintenta exactamente la misma operación para
                    reconciliarla.
                  </p>
                )}
                <Button
                  type="submit"
                  className="full-width"
                  disabled={
                    mutation.isPending ||
                    cooldown.seconds > 0 ||
                    (!review && (!component || !consent))
                  }
                >
                  {mutation.isPending ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}{" "}
                  {cooldown.seconds
                    ? `Esperar ${cooldown.seconds} s`
                    : uncertain
                      ? "Reintentar el mismo intento"
                      : review
                        ? "Guardar revisión"
                        : "Confirmar identificación"}
                </Button>
                {review && !locked && (
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setReview(false);
                      setReason("");
                      mutation.reset();
                    }}
                  >
                    Cancelar revisión
                  </Button>
                )}
              </form>
            ) : (
              <p className="selection-placeholder">
                Selecciona un candidato de la lista. Después, indica el
                componente y el motivo de tu elección.
              </p>
            )}
            <p className="selection-disclaimer">
              El backend revalida el UUID en NVD antes de guardar. Confirmar un
              CPE no confirma vulnerabilidades.
            </p>
          </section>
          <section className="panel current-mini">
            <div className="section-heading">
              <h3>Estado actual</h3>
              <Status state={current.data.current_state} />
            </div>
            {active ? (
              <>
                <p className="cpe-name mono">{active.cpe_name}</p>
                <p className="small muted">
                  {active.state === "confirmed"
                    ? "Confirmado"
                    : "Marcado para revisión"}{" "}
                  {date(active.recorded_at)}
                </p>
                {active.state === "confirmed" && (
                  <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() => {
                      setReview(true);
                      setSelected(null);
                      setReason("");
                      setReasonError(undefined);
                      mutation.reset();
                    }}
                  >
                    <ShieldQuestion size={16} />
                    Marcar para revisión
                  </Button>
                )}
              </>
            ) : (
              <p className="small muted">
                Aún no hay una identificación guardada.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
