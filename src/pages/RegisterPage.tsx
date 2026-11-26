import { useRef, useState } from "react";
import { Link, Navigate } from "react-router";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Brand, Button, ErrorPanel } from "../components/ui";
import { useAuth } from "../features/auth/context";
import { ApiError } from "../services/api";

function usernameProblem(value: string) {
  const username = value.trim().toLowerCase();
  if (!username) return "Ingresa un usuario.";
  if (username.length < 3 || username.length > 80)
    return "El usuario debe tener entre 3 y 80 caracteres.";
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(username))
    return "Usa solo letras ASCII, números, punto, guion o guion bajo; empieza con letra o número.";
  return "";
}

function passwordProblem(value: string, username: string) {
  const length = Array.from(value).length;
  if (!value) return "Ingresa una contraseña.";
  if (length < 15 || length > 128)
    return "La contraseña debe tener entre 15 y 128 caracteres.";
  if (/\p{C}/u.test(value))
    return "La contraseña contiene caracteres no admitidos.";

  const simplified = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const common = new Set([
    "password",
    "password123",
    "password123456789",
    "123456789012345",
    "qwertyuiopasdfgh",
    "letmein",
    "admin",
    "administrator",
    "vulntrack",
    "contraseña",
    "contrasena",
    "correcthorsebatterystaple",
  ]);
  const normalizedUser = username.trim().toLowerCase();
  const characters = Array.from(value);
  const repeated = Array.from(
    { length: Math.floor(length / 2) },
    (_, index) => index + 1,
  ).some((size) => {
    const prefix = characters.slice(0, size).join("");
    return (
      length % size === 0 &&
      value === Array.from({ length: length / size }, () => prefix).join("")
    );
  });
  if (
    new Set(value).size < 5 ||
    common.has(simplified) ||
    /^(password|vulntrack|admin|administrator|contrasena|letmein)\d*$/.test(
      simplified,
    ) ||
    [normalizedUser, `${normalizedUser}123`, `${normalizedUser}123456`].some(
      (candidate) =>
        candidate && simplified === candidate.replace(/[^a-z0-9]/g, ""),
    ) ||
    repeated
  )
    return "Elige una frase menos predecible; evita contraseñas comunes, repeticiones y tu usuario.";
  return "";
}

export function RegisterPage() {
  const { api, user } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState(false);
  const pending = useRef(false);
  const usernameError = usernameProblem(username);
  const passwordError = passwordProblem(password, username);
  const confirmationError = !confirmation
    ? "Confirma tu contraseña."
    : confirmation !== password
      ? "Las contraseñas no coinciden."
      : "";
  const formValid = !usernameError && !passwordError && !confirmationError;
  if (user) return <Navigate to="/" replace />;

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError(null);
    setTouched({ username: true, password: true, confirmation: true });
    if (!formValid) {
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await api.registerAccount(username.trim().toLowerCase(), password);
      setPassword("");
      setConfirmation("");
      setCreated(true);
    } catch (reason) {
      setPassword("");
      setConfirmation("");
      setError(reason);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="login-page registration-page">
      <aside className="login-story" aria-label="Acerca de VulnTrack">
        <Brand />
        <div className="story-content">
          <p className="eyebrow">TU ESPACIO PERSONAL</p>
          <h2>
            Identifica.
            <br />
            Revisa.
            <br />
            <span>Conserva tu historial.</span>
          </h2>
          <p className="story-description">
            Organiza tus aplicaciones y tecnologías en un workspace propio. Cada
            consulta requiere una sesión y permisos verificados.
          </p>
        </div>
        <p className="login-footnote">
          Selección humana. Evidencia conservada.
        </p>
      </aside>
      <main className="login-form-area">
        <div className="login-form-wrap">
          <span className="login-kicker">
            <span className="scope-mark" />
            ACCESO PERSONAL
          </span>
          <h1 className="registration-title">
            {created ? "Cuenta creada" : "Crear cuenta"}
          </h1>
          {created ? (
            <>
              <p role="status">
                Tu cuenta y tu workspace personal están listos. Inicia sesión
                para continuar.
              </p>
              <Link className="button primary full-width" to="/login">
                Ir a iniciar sesión <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <p className="muted">
                Solo necesitamos un usuario y una contraseña. No solicitamos
                correo.
              </p>
              {error instanceof ApiError &&
              error.code === "REGISTRATION_DISABLED" ? (
                <div className="error-panel" role="alert">
                  <strong>
                    El registro está deshabilitado en esta instalación.
                  </strong>
                  <p>
                    Tus datos pueden ser válidos, pero el servidor no permite
                    crear cuentas ahora. Un administrador debe habilitar el
                    aprovisionamiento controlado.
                  </p>
                </div>
              ) : error != null ? (
                <ErrorPanel error={error} />
              ) : null}
              <form
                className="form-stack"
                onSubmit={submit}
                aria-busy={busy}
                noValidate
              >
                <div className="field">
                  <label htmlFor="new-username">Usuario</label>
                  <input
                    id="new-username"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={busy}
                    aria-invalid={Boolean(
                      (touched.username || username) && usernameError,
                    )}
                    aria-describedby="username-help username-error"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setError(null);
                    }}
                    onBlur={() =>
                      setTouched((value) => ({ ...value, username: true }))
                    }
                  />
                  <small id="username-help" className="field-hint">
                    3–80 caracteres ASCII: letras, números, punto, guion o guion
                    bajo. Se guarda en minúsculas.
                  </small>
                  {(touched.username || username) && usernameError && (
                    <small id="username-error" className="field-error">
                      {usernameError}
                    </small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="new-password">Contraseña</label>
                  <div className="password-field">
                    <input
                      id="new-password"
                      name="password"
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      aria-invalid={Boolean(
                        (touched.password || password) && passwordError,
                      )}
                      aria-describedby="password-help password-error"
                      disabled={busy}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError(null);
                      }}
                      onBlur={() =>
                        setTouched((value) => ({ ...value, password: true }))
                      }
                    />
                    <button
                      type="button"
                      aria-label={
                        show ? "Ocultar contraseñas" : "Mostrar contraseñas"
                      }
                      aria-pressed={show}
                      onClick={() => setShow(!show)}
                    >
                      {show ? (
                        <EyeOff size={18} aria-hidden="true" />
                      ) : (
                        <Eye size={18} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <small id="password-help" className="field-hint">
                    15–128 caracteres. Usa una frase única; evita contraseñas
                    comunes, repeticiones y tu usuario. Se admiten espacios.
                  </small>
                  {(touched.password || password) && passwordError && (
                    <small id="password-error" className="field-error">
                      {passwordError}
                    </small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">Confirmar contraseña</label>
                  <input
                    id="confirm-password"
                    name="confirmation"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    disabled={busy}
                    aria-invalid={Boolean(
                      (touched.confirmation || confirmation) &&
                      confirmationError,
                    )}
                    aria-describedby="confirmation-help confirmation-error"
                    value={confirmation}
                    onChange={(event) => {
                      setConfirmation(event.target.value);
                      setError(null);
                    }}
                    onBlur={() =>
                      setTouched((value) => ({ ...value, confirmation: true }))
                    }
                  />
                  <small id="confirmation-help" className="field-hint">
                    Escribe de nuevo la misma contraseña.
                  </small>
                  {(touched.confirmation || confirmation) &&
                    confirmationError && (
                      <small id="confirmation-error" className="field-error">
                        {confirmationError}
                      </small>
                    )}
                </div>
                <Button
                  type="submit"
                  className="full-width"
                  disabled={busy || !formValid}
                >
                  {busy ? (
                    <>
                      <LoaderCircle
                        className="spin"
                        size={18}
                        aria-hidden="true"
                      />
                      Creando cuenta…
                    </>
                  ) : (
                    <>
                      Crear cuenta
                      <ArrowRight size={18} aria-hidden="true" />
                    </>
                  )}
                </Button>
              </form>
              <p className="session-help">
                Si se pierde la respuesta, intenta iniciar sesión antes de
                repetir el registro. No se enviará tu contraseña fuera de esta
                solicitud.
              </p>
              <p className="access-note">
                ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
