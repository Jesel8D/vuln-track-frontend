import type { AnalysisRun, FindingApplicability } from "../../types/api";
import { object } from "../../services/analysisContract";
export const applicabilityLabel: Record<FindingApplicability, string> = {
  potential: "Potencialmente aplicable",
  undetermined: "Aplicabilidad no determinada",
  not_applicable: "No aplicable según revisión",
};
export function runLabel(run: Pick<AnalysisRun, "status" | "coverage">) {
  return run.status === "queued"
    ? "Pendiente"
    : run.status === "running"
      ? "Procesando"
      : run.status === "failed"
        ? "Fallida"
        : run.coverage === "partial"
          ? "Parcial"
          : "Completada";
}
export function duration(run: AnalysisRun) {
  if (!run.started_at || !run.completed_at) return "—";
  const seconds = Math.max(
    0,
    Math.round(
      (Date.parse(run.completed_at) - Date.parse(run.started_at)) / 1000,
    ),
  );
  return seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
export const reasonLabels: Record<string, string> = {
  POSITIVE_OR_LITERAL_MATCH:
    "Existe un criterio OR compatible por componentes y versión. Esto no confirma vulnerabilidad en el equipo.",
  COMPLEX_CONFIGURATION:
    "La configuración requiere evaluar condiciones adicionales, operadores AND o negación.",
  VERSION_RANGE_OR_UNSUPPORTED_CRITERION:
    "El criterio contiene rangos de versiones u otras condiciones que este evaluador no resuelve.",
  CONFIGURATIONS_MISSING: "El registro no aporta configuraciones evaluables.",
  ENVIRONMENT_CONDITION:
    "Hay criterios de entorno; vulnerable=false puede representar un componente requerido.",
  CRITERION_MISMATCH:
    "Un criterio no coincide. Esto no basta para descartar otras condiciones o componentes.",
  ATTRIBUTE_UNKNOWN_OR_PATTERN:
    "Faltan atributos específicos o hay patrones no soportados.",
  UNSUPPORTED_EXPRESSION:
    "La expresión supera el subconjunto de evaluación implementado.",
  UNSUPPORTED_CPE: "El criterio CPE no puede evaluarse con este subconjunto.",
  VERSION_UNKNOWN: "La versión es desconocida.",
  OBSERVED_VERSION_MISMATCH:
    "La versión observada no coincide con el CPE usado.",
  INSUFFICIENT_EVIDENCE: "La evidencia no permite determinar la aplicabilidad.",
  CVE_REJECTED:
    "El registro CVE fue rechazado por la fuente y requiere revisión.",
  EVIDENCE_BUDGET_REACHED:
    "La evidencia excedió el presupuesto y se omitieron bloques. No puede reconstruirse solo con su hash.",
  PAGE_BUDGET_REACHED: "Se alcanzó el límite de páginas de esta consulta.",
  TIME_BUDGET_REACHED: "Se agotó el tiempo de ejecución.",
  TOTAL_CHANGED: "El total informado por NVD cambió entre páginas.",
  DUPLICATE_CVE: "Se recibieron CVE repetidos entre las entradas recuperadas.",
  CVE_CHANGED:
    "Un CVE repetido cambió durante la paginación; se conservó su primera versión.",
  ORDER_CHANGED: "Cambió el orden esperado de los resultados.",
  INTERRUPTED:
    "La ejecución fue interrumpida; se conservaron las páginas ya guardadas.",
  PROCESSING_ERROR:
    "No pudo guardarse una página; los resultados anteriores se conservaron.",
  NVD_TIMEOUT: "NVD excedió el tiempo de espera.",
  NVD_THROTTLED: "NVD solicitó detener temporalmente las consultas.",
  NVD_UNAVAILABLE: "NVD no estuvo disponible.",
  NVD_INVALID_RESPONSE: "Una respuesta de NVD no pudo validarse.",
  NVD_METRICS_TOO_LARGE: "Las métricas excedieron el presupuesto permitido.",
  ACTOR_INACTIVE: "La cuenta que inició la consulta dejó de estar activa.",
};
export const reasonText = (code: string) =>
  reasonLabels[code] ?? `Código registrado: ${code}`;
export interface CVSSMetric {
  version: string;
  score: number;
  severity: string | null;
  vector: string | null;
  source: string | null;
  type: string | null;
}
const severity: Record<string, string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
  NONE: "Ninguna",
};
export function metrics(cvss: Record<string, unknown> | null): CVSSMetric[] {
  if (!cvss) return [];
  return Object.values(cvss).flatMap((group) =>
    Array.isArray(group)
      ? group.flatMap((item) => {
          if (!object(item) || !object(item.cvssData)) return [];
          const data = item.cvssData;
          if (
            typeof data.version !== "string" ||
            !["2.0", "3.0", "3.1", "4.0"].includes(data.version) ||
            typeof data.baseScore !== "number" ||
            !Number.isFinite(data.baseScore) ||
            data.baseScore < 0 ||
            data.baseScore > 10
          )
            return [];
          const raw = data.baseSeverity ?? item.baseSeverity;
          return [
            {
              version: data.version,
              score: data.baseScore,
              severity:
                typeof raw === "string"
                  ? (severity[raw.toUpperCase()] ?? null)
                  : null,
              vector:
                typeof data.vectorString === "string"
                  ? data.vectorString
                  : null,
              source: typeof item.source === "string" ? item.source : null,
              type: typeof item.type === "string" ? item.type : null,
            },
          ];
        })
      : [],
  );
}
export function nvdLink(id: string): string | null {
  return /^CVE-[0-9]{4}-[0-9]{4,}$/.test(id)
    ? `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id)}`
    : null;
}
export function httpsReference(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    [...value].some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)
  )
    return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

// NVD CVE published/lastModified strings may omit the UTC suffix. Preserve their UTC meaning.
export function sourceTimestamp(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(
      value,
    )
  )
    return null;
  const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + "Z";
  return Number.isFinite(Date.parse(timestamp)) ? timestamp : null;
}
