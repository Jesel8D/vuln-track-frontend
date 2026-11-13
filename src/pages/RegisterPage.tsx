import { useRef, useState } from "react";
import { Link, Navigate } from "react-router";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Brand, Button, ErrorPanel } from "../components/ui";
import { useAuth } from "../features/auth/context";

export function RegisterPage() {
  const { api, user } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState(false);
  const pending = useRef(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError(null);
    if (password !== confirmation) {
      setError(new Error("Las contraseñas no coinciden."));
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
              {error != null && <ErrorPanel error={error} />}
              <form className="form-stack" onSubmit={submit} aria-busy={busy}>
                <div className="field">
                  <label htmlFor="new-username">Usuario</label>
                  <input
                    id="new-username"
                    name="username"
                    required
                    minLength={3}
                    maxLength={80}
                    pattern="[A-Za-z0-9][A-Za-z0-9_.\-]{2,79}"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={busy}
                    aria-describedby="username-help"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                  <small id="username-help" className="field-hint">
                    3–80 caracteres ASCII: letras, números, punto, guion o guion
                    bajo. Se guarda en minúsculas.
                  </small>
                </div>
                <div className="field">
                  <label htmlFor="new-password">Contraseña</label>
                  <div className="password-field">
                    <input
                      id="new-password"
                      name="password"
                      type={show ? "text" : "password"}
                      required
                      minLength={15}
                      maxLength={128}
                      autoComplete="new-password"
                      aria-describedby="password-help"
                      disabled={busy}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
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
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">Confirmar contraseña</label>
                  <input
                    id="confirm-password"
                    name="confirmation"
                    type={show ? "text" : "password"}
                    required
                    minLength={15}
                    maxLength={128}
                    autoComplete="new-password"
                    disabled={busy}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </div>
                <Button type="submit" className="full-width" disabled={busy}>
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
