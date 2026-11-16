export function FixtureNotice() {
  if (import.meta.env.VITE_NVD_MODE !== "fixture") return null;
  return (
    <div
      className="v2-fixture-notice"
      role="note"
      aria-label="Datos de demostración"
    >
      <strong>Demostración · NVD de fixture</strong>
      <p>
        Datos capturados, sin consultas NVD en vivo. Los CVE relacionados no
        confirman vulnerabilidades. ZAP y la verificación remota siguen
        bloqueados.
      </p>
    </div>
  );
}
