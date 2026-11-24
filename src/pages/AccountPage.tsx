import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "../features/auth/context";
export function AccountPage() {
  const { user, logout } = useAuth();
  return (
    <div className="v2-page v2-account">
      <header>
        <p className="v2-eyebrow">ACCESO PERSONAL</p>
        <h1>Mi cuenta</h1>
        <p>Tu identidad verificada por VulnTrack.</p>
      </header>
      <section className="v2-panel account-panel">
        <div className="account-heading">
          <span className="large-avatar">
            <UserRound size={30} />
          </span>
          <div>
            <h2>{user?.username}</h2>
            <p>Sesión autenticada</p>
          </div>
        </div>
        <dl className="v2-account-details">
          <div>
            <dt>Usuario</dt>
            <dd>{user?.username}</dd>
          </div>
          <div>
            <dt>Identificador</dt>
            <dd className="mono">{user?.id}</dd>
          </div>
        </dl>
        <div className="v2-panel-footnote">
          Tu acceso depende de tus membresías y roles de workspace. Esta
          instalación no ofrece funciones administrativas ni edición de perfil.
        </div>
        <div className="account-logout">
          <div>
            <h3>Tu sesión, bajo tu control</h3>
            <p>
              Al salir se limpia la sesión de esta ventana. El token no se
              revoca en el servidor y conserva su expiración original.
            </p>
          </div>
          <button className="v2-secondary-button" onClick={logout}>
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </section>
    </div>
  );
}
