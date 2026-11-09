import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Empty } from "../components/ui";
export function NotFoundPage() {
  return (
    <section className="panel">
      <Empty
        title="Esta página no está disponible"
        text="La dirección no corresponde a una vista de VulnTrack."
        action={
          <Link className="button secondary" to="/">
            <ArrowLeft size={16} />
            Volver al resumen
          </Link>
        }
      />
    </section>
  );
}
