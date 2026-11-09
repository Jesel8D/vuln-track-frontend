import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "../features/auth/context";
import { Button, PageHeading } from "../components/ui";
export function AccountPage() {
  const { user, logout } = useAuth();
  return (
    <>
      <PageHeading
        eyebrow="ACCESO PERSONAL"
        title="Mi cuenta"
        description="Tu identidad verificada por VulnTrack."
      />
      <section className="panel account-panel">
        <div className="account-heading">
          <span className="large-avatar">
            <UserRound size={30} />
          </span>
          <div>
            <h2>{user?.username}</h2>
            <p>Sesión autenticada</p>
          </div>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Usuario</dt>
            <dd>{user?.username}</dd>
          </div>
          <div>
            <dt>Identificador</dt>
            <dd className="mono">{user?.id}</dd>
          </div>
        </dl>
        <div className="notice">
          Tu acceso comprende tus propios activos. Esta instalación no ofrece
          funciones administrativas ni edición de perfil.
        </div>
        <div className="account-logout">
          <div>
            <h3>Tu sesión, bajo tu control</h3>
            <p>
              Al salir se limpia la sesión de esta ventana. El token no se
              revoca en el servidor y conserva su expiración original.
            </p>
          </div>
          <Button variant="secondary" onClick={logout}>
            <LogOut size={17} />
            Cerrar sesión
          </Button>
        </div>
      </section>
    </>
  );
}
