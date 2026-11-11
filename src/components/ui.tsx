import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  LoaderCircle,
  Server,
  ShieldQuestion,
} from "lucide-react";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { Link } from "react-router";
import { ApiError, errorText } from "../services/api";
import type { IdentificationState } from "../types/api";
export const stateLabel: Record<IdentificationState, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  needs_review: "Requiere revisión",
};
export const typeLabel: Record<string, string> = {
  router: "Router",
  switch: "Switch",
  server: "Servidor",
};
export const componentLabel: Record<string, string> = {
  hardware: "Hardware",
  firmware: "Firmware",
  os: "Sistema operativo",
  software: "Software",
};
export const date = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg
        width="36"
        height="36"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 10 20 32 32 10M15 10l5 9 5-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M5 26v9h9m21-9v9h-9"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity=".5"
        />
      </svg>
      {!compact && (
        <span>
          Vuln<span className="brand-light">Track</span>
          <small>SECOPS CORE</small>
        </span>
      )}
    </span>
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button {...props} className={`button ${variant} ${className}`}>
      {children}
    </button>
  );
}
export function Status({ state }: { state?: IdentificationState }) {
  const Icon =
    state === "confirmed"
      ? CheckCircle2
      : state === "needs_review"
        ? ShieldQuestion
        : Clock3;
  return (
    <span className={`status ${state ?? "unavailable"}`}>
      <Icon size={14} aria-hidden="true" />
      {state ? stateLabel[state] : "No disponible"}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}
export function Loading({
  text = "Consultando tus datos…",
}: {
  text?: string;
}) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={20} className="spin" aria-hidden="true" />
      {text}
    </div>
  );
}
export function ErrorPanel({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-panel" role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <div>
        <strong>No pudimos completar la operación</strong>
        <p>{errorText(error)}</p>
        {error instanceof ApiError && error.retryAfter && (
          <p>
            Espera al menos {error.retryAfter} segundos antes de reintentar.
          </p>
        )}
        {error instanceof ApiError && error.requestId && (
          <small className="mono">Referencia: {error.requestId}</small>
        )}
        {retry && (
          <Button variant="secondary" onClick={retry}>
            Volver a intentar
          </Button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Database size={28} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Pagination({
  offset,
  limit,
  total,
  busy,
  onPage,
}: {
  offset: number;
  limit: number;
  total: number;
  busy?: boolean;
  onPage: (offset: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Paginación">
      <span>
        {total === 0
          ? "Sin registros"
          : `${offset + 1}–${Math.min(offset + limit, total)} de ${total}`}
      </span>
      <div>
        <Button
          variant="ghost"
          aria-label="Página anterior"
          disabled={busy || offset === 0}
          onClick={() => onPage(Math.max(0, offset - limit))}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Anterior
        </Button>
        <Button
          variant="ghost"
          aria-label="Página siguiente"
          disabled={busy || offset + limit >= total}
          onClick={() => onPage(offset + limit)}
        >
          Siguiente
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
export function IdentityChain({ state }: { state: IdentificationState }) {
  const steps = [
    "Activo registrado",
    "Catálogo NVD",
    "Confirmación humana",
    "Historial",
  ];
  return (
    <ol className="identity-chain" aria-label="Cadena de identificación">
      {steps.map((step, index) => (
        <li
          key={step}
          className={index === 0 || state !== "pending" ? "reached" : ""}
        >
          <span>
            {index === 0 || state !== "pending" ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              String(index + 1).padStart(2, "0")
            )}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
export function AssetIcon({ type }: { type: string }) {
  return (
    <span className="asset-icon">
      <Server size={20} aria-hidden="true" />
      <span className="sr-only">{typeLabel[type] ?? type}</span>
    </span>
  );
}
export function BackToAssets() {
  return (
    <Link className="text-link back-link" to="/activos">
      <ArrowLeft size={15} aria-hidden="true" />
      Mis activos
    </Link>
  );
}
