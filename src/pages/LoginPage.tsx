import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  GitBranch,
  Layers3,
  LoaderCircle,
} from "lucide-react";
import { safeReturnPath } from "../services/validation";
import { useAuth } from "../features/auth/context";
import { Brand, Button, ErrorPanel } from "../components/ui";
export function LoginPage() {
  const { user, login, notice } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = safeReturnPath(
    (location.state as { from?: unknown } | null)?.from,
  );
  if (user) return <Navigate to={returnTo} replace />;
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      setPassword("");
      navigate(returnTo, { replace: true });
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Brand />
        <div className="story-content">
          <p className="eyebrow">CONOCE LO QUE PROTEGES</p>
          <h1>
            Todo empieza
            <br />
            por identificar
            <br />
            <span>bien tus activos.</span>
          </h1>
          <p className="story-description">
            Conecta tu inventario con el catálogo oficial CPE. Compara, confirma
            y conserva cada decisión.
          </p>
          <div className="login-chain">
            <span>
              <Layers3 size={19} />
              Inventario
            </span>
            <i />
            <span>
              <Fingerprint size={19} />
              Identidad CPE
            </span>
            <i />
            <span>
              <GitBranch size={19} />
              Trazabilidad
            </span>
          </div>
          <div className="technical-mark" aria-hidden="true">
            <span>ASSET</span>
            <svg viewBox="0 0 340 100" fill="none">
              <path
                d="M15 50h75l30-30h95l35 30h70M90 50l30 30h95l35-30"
                stroke="currentColor"
                strokeWidth="1"
              />
              <circle cx="15" cy="50" r="5" />
              <circle cx="165" cy="20" r="5" />
              <circle cx="165" cy="80" r="5" />
              <circle cx="320" cy="50" r="5" />
            </svg>
            <span>CPE 2.3</span>
          </div>
        </div>
        <p className="login-footnote">
          Registro manual. Selección humana. Evidencia conservada.
        </p>
      </div>
      <main className="login-form-area">
        <div className="login-form-wrap">
          <span className="login-kicker">
            <span className="scope-mark" />
            ACCESO PERSONAL
          </span>
          <h2>Bienvenido a VulnTrack</h2>
          <p className="muted">Ingresa con tu cuenta para continuar.</p>
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {error != null && <ErrorPanel error={error} />}
          <form onSubmit={submit} className="form-stack">
            <div className="field">
              <label htmlFor="username">Usuario</label>
              <input
                id="username"
                name="username"
                required
                minLength={1}
                maxLength={80}
                pattern="[a-z0-9][a-z0-9_.\-]{0,79}"
                title="Entre 1 y 80 caracteres: minúsculas, números, punto, guion o guion bajo."
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={busy}
                placeholder="Tu nombre de usuario"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  required
                  minLength={1}
                  maxLength={256}
                  autoComplete="current-password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  placeholder="Tu contraseña"
                />
                <button
                  type="button"
                  aria-label={
                    show ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={show}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={busy} className="full-width">
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  Verificando acceso…
                </>
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
          </form>
          <p className="session-help">
            Tu sesión se mantiene mientras usas esta ventana. Si recargas,
            vuelve a iniciar sesión.
          </p>
          <div className="access-note">
            <strong>¿Aún no tienes una cuenta?</strong>
            <p>
              <Link to="/crear-cuenta">Crear cuenta</Link>
            </p>
          </div>
        </div>
        <span className="login-version mono">VULNTRACK / WEB V1</span>
      </main>
    </div>
  );
}
