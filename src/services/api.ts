import type {
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
  CPE_RATE_LIMIT:
    "Alcanzaste el límite temporal de consultas. Espera antes de continuar.",
  BODY_TOO_LARGE: "Los datos exceden el tamaño permitido por el servicio.",
};
export function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No pudimos completar la operación.";
}
interface RequestOptions {
  method?: "GET" | "POST";
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
    if (!(path.startsWith("/api/v1/") || path === "/health"))
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
              ? "No encontramos este recurso entre tus activos."
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
  health(signal?: AbortSignal) {
    return this.request<{ status: string }>("/health", {
      signal,
      anonymous: true,
    });
  }
}
