export function FixtureNotice() {
  const mode = import.meta.env.VITE_NVD_MODE;
  if (mode === "live")
    return (
      <div className="v2-fixture-notice" role="note" aria-label="Fuente NVD">
        <strong>NVD en vivo</strong>
        <p>
          Las consultas CVE bajo demanda usan NVD. Los resultados previos
          conservan su procedencia. Los CVE relacionados requieren revisión
          humana.
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
        Las consultas CVE usan datos capturados, sin consultas CVE en vivo. El
        diccionario CPE oficial se consulta por separado cuando está conectado.
        Los CVE relacionados no confirman vulnerabilidades. Estas consultas no
        escanean destinos.
      </p>
    </div>
  );
}
