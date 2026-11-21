export function FixtureNotice() {
  const mode = import.meta.env.VITE_NVD_MODE;
  if (mode === "live")
    return (
      <div className="v2-fixture-notice" role="note" aria-label="Fuente NVD">
        <strong>NVD en vivo</strong>
        <p>
          Las consultas bajo demanda usan el cat?logo oficial. Los resultados
          previos conservan su procedencia. Los CVE relacionados requieren
          revisi?n humana.
        </p>
      </div>
    );
  if (mode !== "fixture") return null;
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
