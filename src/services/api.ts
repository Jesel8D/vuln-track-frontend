import {
  isAccepted,
  isRun,
  isAnalysisList,
  isFinding,
  isFindingList,
} from "./analysisContract";
import type {
  AnalysisInput,
  ReviewInput,
  Asset,
  AssetInput,
  AssetList,
  CandidateList,
  Identification,
  IdentificationInput,
  IdentificationList,
  Token,
  User,
} from "../types/api";
import {
  isApplicationList,
  isApplicationTargetList,
  isWorkspaceTargetList,
  isV2Dashboard,
  isAnalysisAccepted,
  isAnalysisHistory,
  isAnalysisRun,
  isCpeCandidate,
  isCpeCandidateList,
  isNvdFindingList,
  isNvdFinding,
  isRecommendationList,
  isTechnologyList,
  isWorkspaceCreated,
  isWorkspaceList,
} from "./v2Contract";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "Usuario o contraseña incorrectos, o sesión no válida.",
  VALIDATION_ERROR: "Revisa los campos y los límites indicados.",
  CPE_UNAVAILABLE:
    "Ese CPE no está disponible o fue deprecado. Busca otro candidato.",
  CPE_COMPONENT_MISMATCH:
    "El componente elegido no coincide con el tipo del CPE.",
  CPE_VERSION_MISMATCH:
    "La versión observada del activo no coincide con el CPE. Revisa tu selección.",
  CURRENT_IDENTIFICATION_CHANGED:
    "La identificación cambió. Actualiza los datos antes de confirmar otra selección.",
  IDEMPOTENCY_CONFLICT:
    "Este intento ya está asociado a otros datos. Revisa el resultado antes de continuar.",
  IDEMPOTENCY_EXPIRED:
    "El intento expiró. Comprueba el inventario antes de registrar otra vez.",
  INVALID_TRANSITION:
    "Solo una identificación confirmada puede marcarse para revisión.",
  NVD_TIMEOUT: "NVD tardó demasiado en responder. Tu activo sigue guardado.",
  NVD_INVALID_RESPONSE: "NVD devolvió una respuesta que no pudimos verificar.",
  NVD_UNAVAILABLE:
    "NVD no está disponible temporalmente. Tu activo sigue guardado.",
  NVD_RATE_LIMIT:
    "La cuota de consulta está ocupada. Espera antes de consultar otra vez.",
  NVD_THROTTLED:
    "NVD está aplicando una pausa entre consultas. Espera antes de volver a intentarlo.",
  NVD_PROCESSING_FAILED:
    "No se pudo procesar la consulta NVD. Reintenta el mismo intento para recuperar su estado.",
  CPE_RATE_LIMIT:
    "Alcanzaste el límite temporal de consultas. Espera antes de continuar.",
  IDENTIFICATION_REQUIRED:
    "La identificación actual debe estar confirmada. Actualiza los datos del activo.",
  VERSION_REQUIRED:
    "Se requiere una versión observada conocida para esta consulta CVE.",
  IDENTIFICATION_INCOMPLETE:
    "El CPE no permite una consulta específica. Revisa el componente y la versión.",
  ANALYSIS_IN_PROGRESS:
    "Ya hay una consulta activa para esta tecnología. Espera antes de iniciar otra.",
  FINDING_REVIEW_CONFLICT:
    "El hallazgo ya fue revisado o cambió. Actualiza la lista antes de continuar.",
  RECOMMENDATION_CONFLICT:
    "La medida cambió. Actualiza la lista antes de cambiar su estado.",
  TARGET_AUTHORIZATION_CONFLICT:
    "El destino cambió. Actualiza la vista antes de confirmar la autorización.",
  ANALYSIS_NOT_FOUND: "No encontramos esta consulta dentro de la aplicación.",
  CPE_SELECTION_CHANGED:
    "La selección CPE cambió. Actualiza la tecnología antes de confirmarla.",
  CPE_CONFIRMATION_REQUIRED:
    "Confirma un CPE compatible con la versión observada antes de consultar CVE.",
  APPLICATION_NOT_FOUND: "La aplicación no está disponible en este workspace.",
  TECHNOLOGY_NOT_FOUND: "La tecnología no está disponible en esta aplicación.",
  ANALYSIS_RATE_LIMIT:
    "Espera antes de iniciar otra consulta para este activo.",
  CVE_WORKER_UNAVAILABLE:
    "El procesador de consultas no está disponible. Espera y vuelve a intentarlo.",
  REVIEW_CONFLICT:
    "El hallazgo cambió o ya fue revisado. Consulta el estado actual antes de continuar.",
  BODY_TOO_LARGE: "Los datos exceden el tamaño permitido por el servicio.",
};
export function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No pudimos completar la operación.";
}
interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  body?: unknown;
  key?: string;
  signal?: AbortSignal;
  anonymous?: boolean;
}
export class ApiClient {
  private base: string;
  private active = new Set<AbortController>();
  constructor(
    base: string,
    private getToken: () => string | null,
    private unauthorized: () => void,
    private timeoutMs = 30_000,
  ) {
    const url = new URL(base);
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      (url.protocol === "http:" && !loopback) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["", "/"].includes(url.pathname)
    ) {
      throw new Error(
        "VITE_API_URL requiere un origen HTTPS, o HTTP de loopback para desarrollo.",
      );
    }
    this.base = url.origin;
  }
  abortAll() {
    this.active.forEach((controller) => controller.abort());
    this.active.clear();
  }
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!(
      path.startsWith("/api/v1/") ||
      path.startsWith("/api/v2/") ||
      path === "/health"
    ))
      throw new Error("Ruta API no permitida");
    const token = options.anonymous ? null : this.getToken();
    const controller = new AbortController();
    this.active.add(controller);
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const cancel = () => controller.abort();
    if (options.signal?.aborted) cancel();
    options.signal?.addEventListener("abort", cancel, { once: true });
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (options.body !== undefined)
        headers["Content-Type"] = "application/json";
      if (options.key) headers["Idempotency-Key"] = options.key;
      const response = await fetch(this.base + path, {
        method: options.method ?? "GET",
        headers,
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        if (response.status === 401 && token && token === this.getToken())
          this.unauthorized();
        throw new ApiError(
          response.status,
          "INVALID_RESPONSE",
          "El servicio devolvió una respuesta no válida.",
        );
      }
      if (response.status === 401 && token && token === this.getToken())
        this.unauthorized();
      if (!response.ok) {
        const envelope = data as {
          error?: { code?: unknown; request_id?: unknown };
        };
        const code =
          typeof envelope?.error?.code === "string"
            ? envelope.error.code
            : "HTTP_ERROR";
        const requestId =
          typeof envelope?.error?.request_id === "string"
            ? envelope.error.request_id.slice(0, 128)
            : undefined;
        const retry = Number(response.headers.get("Retry-After"));
        const message =
          response.status === 403
            ? "No tienes permiso para realizar esta operación."
            : response.status === 404
              ? "No encontramos este recurso o no está disponible para tu cuenta."
              : (messages[code] ??
                (response.status === 429
                  ? "Demasiadas solicitudes. Espera antes de intentar otra vez."
                  : response.status >= 500
                    ? "El servicio no está disponible temporalmente."
                    : "No pudimos completar la solicitud."));
        throw new ApiError(
          response.status,
          code,
          message,
          requestId,
          Number.isFinite(retry) && retry > 0
            ? Math.min(retry, 3600)
            : undefined,
        );
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted && !timedOut)
        throw new DOMException("Solicitud cancelada", "AbortError");
      throw new ApiError(
        0,
        timedOut ? "CLIENT_TIMEOUT" : "NETWORK_ERROR",
        timedOut
          ? "El servicio tardó demasiado. Conservamos este intento para que puedas reintentarlo."
          : "No pudimos conectar con el servicio. Comprueba la conexión e inténtalo de nuevo.",
      );
    } finally {
      window.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
      this.active.delete(controller);
    }
  }
  login(username: string, password: string, signal?: AbortSignal) {
    return this.request<Token>("/api/v1/auth/login", {
      method: "POST",
      body: { username, password },
      anonymous: true,
      signal,
    });
  }
  me(signal?: AbortSignal) {
    return this.request<User>("/api/v1/auth/me", { signal });
  }
  assets(limit = 10, offset = 0, signal?: AbortSignal) {
    return this.request<AssetList>(
      `/api/v1/assets?${new URLSearchParams({ limit: String(limit), offset: String(offset) })}`,
      { signal },
    );
  }
  asset(id: string, signal?: AbortSignal) {
    return this.request<Asset>(`/api/v1/assets/${encodeURIComponent(id)}`, {
      signal,
    });
  }
  register(body: AssetInput, key: string) {
    return this.request<Asset>("/api/v1/assets", { method: "POST", body, key });
  }
  identifications(
    id: string,
    scope: "current" | "history" = "current",
    offset = 0,
    signal?: AbortSignal,
  ) {
    return this.request<IdentificationList>(
      `/api/v1/assets/${encodeURIComponent(id)}/cpe-identifications?${new URLSearchParams({ scope, limit: "20", offset: String(offset) })}`,
      { signal },
    );
  }
  candidates(query: string, offset = 0, signal?: AbortSignal) {
    return this.request<CandidateList>(
      `/api/v1/cpe-candidates?${new URLSearchParams({ query, limit: "10", offset: String(offset) })}`,
      { signal },
    );
  }
  identify(id: string, body: IdentificationInput, key: string) {
    return this.request<Identification>(
      `/api/v1/assets/${encodeURIComponent(id)}/cpe-identifications`,
      { method: "POST", body, key },
    );
  }
  private async checked<T>(
    path: string,
    guard: (v: unknown) => v is T,
    options: RequestOptions = {},
  ): Promise<T> {
    const value = await this.request<unknown>(path, options);
    if (!guard(value))
      throw new ApiError(
        200,
        "INVALID_RESPONSE",
        "El servicio devolvió datos que no coinciden con el contrato. Actualiza manualmente.",
      );
    return value;
  }
  startAnalysis(assetId: string, body: AnalysisInput, key: string) {
    return this.checked(
      `/api/v1/assets/${encodeURIComponent(assetId)}/analyses`,
      isAccepted,
      { method: "POST", body, key },
    );
  }
  analyses(assetId: string, limit = 20, offset = 0, signal?: AbortSignal) {
    return this.checked(
      `/api/v1/assets/${encodeURIComponent(assetId)}/analyses?${new URLSearchParams({ limit: String(limit), offset: String(offset) })}`,
      isAnalysisList,
      { signal },
    );
  }
  analysis(assetId: string, runId: string, signal?: AbortSignal) {
    return this.checked(
      `/api/v1/assets/${encodeURIComponent(assetId)}/analyses/${encodeURIComponent(runId)}`,
      isRun,
      { signal },
    );
  }
  findings(assetId: string, runId: string, offset = 0, signal?: AbortSignal) {
    return this.checked(
      `/api/v1/assets/${encodeURIComponent(assetId)}/analyses/${encodeURIComponent(runId)}/findings?${new URLSearchParams({ limit: "20", offset: String(offset) })}`,
      isFindingList,
      { signal },
    );
  }
  finding(id: string, signal?: AbortSignal) {
    return this.checked(
      `/api/v1/findings/${encodeURIComponent(id)}`,
      isFinding,
      { signal },
    );
  }
  reviewFinding(id: string, body: ReviewInput) {
    return this.checked(
      `/api/v1/findings/${encodeURIComponent(id)}`,
      isFinding,
      { method: "PATCH", body },
    );
  }
  health(signal?: AbortSignal) {
    return this.request<{ status: string }>("/health", {
      signal,
      anonymous: true,
    });
  }
  workspaces(signal?: AbortSignal) {
    return this.checked("/api/v2/workspaces", isWorkspaceList, { signal });
  }
  createWorkspace(name: string, key: string) {
    return this.checked("/api/v2/workspaces", isWorkspaceCreated, {
      method: "POST",
      body: { name },
      key,
    });
  }
  applications(workspaceId: string, signal?: AbortSignal) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications`,
      isApplicationList,
      { signal },
    );
  }
  createApplication(
    workspaceId: string,
    body: import("../types/v2").ApplicationInput,
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications`,
      (value): value is import("../types/v2").Application =>
        isApplicationList({ items: [value] }),
      { method: "POST", body },
    );
  }
  technologies(
    workspaceId: string,
    applicationId: string,
    signal?: AbortSignal,
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/technologies`,
      isTechnologyList,
      { signal },
    );
  }
  createTechnology(
    workspaceId: string,
    applicationId: string,
    body: import("../types/v2").TechnologyInput,
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/technologies`,
      (value): value is import("../types/v2").Technology =>
        isTechnologyList({ items: [value] }),
      { method: "POST", body },
    );
  }
  searchV2Cpe(
    workspaceId: string,
    applicationId: string,
    query: string,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      query,
      product_query: query,
      limit: "10",
      offset: "0",
    });
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/cpe-candidates?${params}`,
      isCpeCandidateList,
      { signal },
    );
  }
  confirmV2Cpe(
    workspaceId: string,
    applicationId: string,
    technologyId: string,
    cpeNameId: string,
    expectedSelectedCpe: string | null,
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/technologies/${encodeURIComponent(technologyId)}/cpe`,
      isCpeCandidate,
      {
        method: "PUT",
        body: {
          cpe_name_id: cpeNameId,
          expected_selected_cpe: expectedSelectedCpe,
        },
      },
    );
  }
  startV2Analysis(
    workspaceId: string,
    applicationId: string,
    technologyId: string,
    key: string,
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/technologies/${encodeURIComponent(technologyId)}/analyses`,
      isAnalysisAccepted,
      { method: "POST", key },
    );
  }
  v2Analysis(
    workspaceId: string,
    applicationId: string,
    runId: string,
    signal?: AbortSignal,
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/analyses/${encodeURIComponent(runId)}`,
      isAnalysisRun,
      { signal },
    );
  }
  v2AnalysisHistory(
    workspaceId: string,
    applicationId: string,
    limit = 20,
    offset = 0,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/analyses?${params}`,
      isAnalysisHistory,
      { signal },
    );
  }
  v2Findings(
    workspaceId: string,
    applicationId: string,
    runId: string,
    offset = 0,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({ limit: "20", offset: String(offset) });
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/analyses/${encodeURIComponent(runId)}/findings?${params}`,
      isNvdFindingList,
      { signal },
    );
  }
  reviewV2Finding(
    workspaceId: string,
    applicationId: string,
    findingId: string,
    applicability: import("../types/v2").NvdApplicability,
    expectedUpdatedAt: string,
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/findings/${encodeURIComponent(findingId)}`,
      isNvdFinding,
      {
        method: "PATCH",
        body: { applicability, expected_updated_at: expectedUpdatedAt },
      },
    );
  }
  v2Recommendations(
    workspaceId: string,
    applicationId: string,
    findingId: string,
    signal?: AbortSignal,
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/findings/${encodeURIComponent(findingId)}/recommendations`,
      isRecommendationList,
      { signal },
    );
  }
  createV2Recommendation(
    workspaceId: string,
    applicationId: string,
    findingId: string,
    body: {
      recommendation: string;
      source_url: string | null;
      assigned_to?: string | null;
      due_at?: string | null;
    },
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/findings/${encodeURIComponent(findingId)}/recommendations`,
      (value): value is import("../types/v2").Recommendation =>
        isRecommendationList({ items: [value] }),
      { method: "POST", body },
    );
  }
  updateV2Recommendation(
    workspaceId: string,
    applicationId: string,
    recommendationId: string,
    status: import("../types/v2").RecommendationStatus,
    expectedUpdatedAt: string,
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/recommendations/${encodeURIComponent(recommendationId)}`,
      (value): value is import("../types/v2").Recommendation =>
        isRecommendationList({ items: [value] }),
      {
        method: "PATCH",
        body: { status, expected_updated_at: expectedUpdatedAt },
      },
    );
  }
  v2Targets(workspaceId: string, applicationId: string, signal?: AbortSignal) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/targets`,
      isApplicationTargetList,
      { signal },
    );
  }
  v2WorkspaceTargets(workspaceId: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ limit: "1000", offset: "0" });
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/targets?${params}`,
      isWorkspaceTargetList,
      { signal },
    );
  }
  v2Dashboard(workspaceId: string, signal?: AbortSignal) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/dashboard`,
      isV2Dashboard,
      { signal },
    );
  }
  createV2Target(
    workspaceId: string,
    applicationId: string,
    body: { url: string; label: string | null },
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/targets`,
      (value): value is import("../types/v2").ApplicationTarget =>
        isApplicationTargetList({ items: [value] }),
      { method: "POST", body },
    );
  }
  authorizeV2Target(
    workspaceId: string,
    applicationId: string,
    targetId: string,
    body: {
      authorization_status: "approved" | "rejected";
      authorization_expires_at: string | null;
      authorization_reference: string;
      expected_updated_at: string;
    },
  ) {
    return this.checked(
      `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/applications/${encodeURIComponent(applicationId)}/targets/${encodeURIComponent(targetId)}/authorization`,
      (value): value is import("../types/v2").ApplicationTarget =>
        isApplicationTargetList({ items: [value] }),
      { method: "PATCH", body },
    );
  }
}
