# MVP-B — intención antes del código

Persona: responsable de laboratorio que ya confirmó el firmware y debe interpretar
un CVE sin confundir una correlación con vulnerabilidad demostrada. Dominio:
ejecución, página, cobertura, CPE congelado, configuración AND, evidencia y revisión.
Se conserva la mesa técnica nocturna: acero azulado/rack, tinta documental,
blanco legible, turquesa de acción, ámbar de incertidumbre y rosa de fallo.
Firma ampliada: identidad → consulta fechada → evidencia → decisión humana.
No se añaden scores de riesgo, porcentajes sin total ni métricas globales por N+1.

Checkpoint para cada componente nuevo: todos usan profundidad tonal/bordes suaves,
superficies rack/panel/raised/inset existentes, Plex Sans para jerarquía y Mono
para CPE/CVE/UUID, base 4px, panel 24/16px y controles 44px. No cambia el sistema.

| Componente         | Intención y foco                                      | Jerarquía y expresión                                                                |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| AnalysisSection    | Iniciar una consulta explícita de la identidad actual | CPE y versión antes del CTA turquesa; confirmación inline nativa; intento conservado |
| RunStatus/Coverage | Separar trabajo, alcance y conclusión                 | Texto e icono; turquesa solo cobertura completa, ámbar parcial, rosa fallo           |
| AnalysisHistory    | Abrir una consulta fechada                            | Filas con fecha/estado, CPE histórico secundario; tarjetas móviles y paginación      |
| AnalysisRunPage    | Entender qué se recuperó y qué falta                  | Estado protagonista; 3 contadores documentales, snapshot y cobertura antes de lista  |
| FindingsTable      | Comparar CVE sin declarar vulnerabilidad              | CVE enlazado, métricas versionadas y aplicabilidad independiente de revisión         |
| FindingPage        | Examinar evidencia de una correlación                 | Descripción/condiciones primero; evidencia desplegable nativa y trazabilidad         |
| ReviewForm         | Registrar una decisión humana única                   | Evaluación original visible, campos etiquetados, consentimiento y CTA explícito      |

Inspección requerida: desktop/tablet/móvil 375/768/1280/1440, teclado y axe.
Ningún badge depende solo del color; textos externos como texto React escapado.

SourceDescription: lectura de un solo idioma de origen cada vez, español preferido
si existe, con selector nativo. Usa Plex Sans para texto, controles 44px,
superficie inset y espaciado 16px; conserva los demás idiomas en evidencia.
