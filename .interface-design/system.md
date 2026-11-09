# VulnTrack — sistema de interfaz

Skill interface-design: Dammyjay93/interface-design, commit
2f9be3206855bcb2d1d0af262c8bae25cba6658d, MIT. Instalada con el instalador oficial
Codex desde .claude/skills/interface-design; licencia conservada en instalación.
Instrucciones leídas/aplicadas, no solo descripción. Sin runtime ni scripts.

## Intención y exploración antes de implementar

Persona: responsable de laboratorio que acaba de registrar un router y necesita
comparar su firmware con un identificador oficial sin declarar una vulnerabilidad.
Acción central: conservar inventario y confirmar identidad tecnológica con evidencia.
Sensación: mesa técnica nocturna, precisa, tranquila y legible.
Dominio: inventario, firmware, diccionario CPE, trazabilidad, procedencia NVD,
confirmación humana, estado pendiente y sustitución histórica.
Mundo de color: acero azulado de rack, tinta de etiquetas, cian de enlace,
blanco de documentación, ámbar de revisión, verde azulado de confirmación.
Firma: cadena de identidad que separa registro, candidato, confirmación e historial;
se expresa en login, navegación, dashboard, estado de activo y timeline histórico.
Defaults reconocidos: score de riesgo ornamental→conteo real con cobertura;
cuatro tarjetas idénticas→total protagonista y muestra explícita; escudo gigante
con gradiente→marca lineal y estructura de trazabilidad.

## Tokens y composición

Paleta: --rack (canvas/nav), --panel, --raised, --inset; --ink, --secondary,
--muted, --faint; --link (turquesa), --review (ámbar), --danger, --line.
Profundidad: superficies tonales con bordes discretos; sin sombras dramáticas.
Tipo: IBM Plex Sans400/500/600; IBM Plex Mono400/500 para UUID/CPE/versiones.
Escala aproximada1.25:12/14/16/20/28/36/52. Cifras tabulares.
Espaciado base4px:4/8/12/16/24/32/48. Panel24px desktop,16px móvil.
Sidebar240px. Contenido máximo1240px. Controles44px de alto y radio8px.
Botón primario turquesa con tinta oscura; focus ring visible. Selección radio
nativa y formularios con etiquetas; sin controles div-onClick.
Responsive375/768/1280/1440: sidebar desktop; navegación compacta móvil sin
modal ni focus trap innecesario. Tablas→tarjetas móviles. CPE wrap-anywhere.
Animación120ms solo opacity/transform, reducción de movimiento respetada.

## Intención por componente (checkpoint previo al código)

| Componente     | Foco/jerarquía                          | Aplicación del sistema                                              |
| -------------- | --------------------------------------- | ------------------------------------------------------------------- |
| Marca/layout   | orientación estable, acción de registro | rack continuo,24/16px, Plex600, enlace activo turquesa              |
| Login          | formulario y acceso real                | columnas asimétricas, título36, inputs inset, controles44           |
| Dashboard      | total verificado antes de muestra       | cifra52, paneles distintos, distribución por página rotulada        |
| Inventario     | identificar y abrir activo              | filas16px, secundarios14, badges semánticos y metadatos mono        |
| Registro       | datos mínimos y conservar intento       | secciones relacionadas, labels14, ayuda secundaria, CTA único       |
| Detalle        | identidad actual y procedencia          | cadena de estado, snapshot mono, acciones jerarquizadas             |
| Candidatos     | comparar antes de confirmar             | radio explícito, versión/part/plataforma visibles, sin preselección |
| Confirmación   | intención humana/motivo                 | panel raised, checkbox y reason, versión observada junto a CPE      |
| Historial      | orden y vigencia                        | timeline discreto, fecha/actor/motivo, revisión no es confirmación  |
| Cuenta         | identidad suministrada por /me          | username protagonista, UUID mono, logout secundario                 |
| Errores/vacíos | recuperación concreta                   | icono SVG semántico, texto14/16, acción real y request_id           |
