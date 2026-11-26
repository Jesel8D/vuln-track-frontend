export function FixtureNotice() {
  const mode = import.meta.env.VITE_NVD_MODE || "disabled";
  if (mode === "live")
    return (
      <div className="v2-fixture-notice" role="note" aria-label="Fuente NVD">
        <strong>Consultas CVE reales · NVD</strong>
        <p>
          Los resultados provienen de la API NVD para un CPE confirmado. Son
          coincidencias potenciales y requieren validación humana; no se escanean
          destinos.
        </p>
      </div>
    );
  if (mode !== "fixture")
    return (
      <div className="v2-fixture-notice" role="note" aria-label="Fuente NVD">
        <strong>Consultas CVE externas aplazadas</strong>
        <p>
          Una variable de entorno no activa NVD en vivo. Los resultados previos
          conservan su procedencia y requieren revisión humana.
        </p>
      </div>
    );
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
