# Interface Design aplicada

Fuente original: https://github.com/Dammyjay93/interface-design
Referencia revisada:2f9be3206855bcb2d1d0af262c8bae25cba6658d. MIT (Damola Akinleye).
Se consultó la página indicada de open-design.ai; no fue accesible desde la
herramienta web. Se leyó el README oficial, SKILL.md completo y LICENSE del repo.

No estaba instalada en ~/.codex/skills ni ~/.agents/skills. Instalación revisada:

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo Dammyjay93/interface-design \
  --path .claude/skills/interface-design \
  --ref 2f9be3206855bcb2d1d0af262c8bae25cba6658d \
  --name interface-design
```

Se conservó LICENSE junto a la instalación. El núcleo solo contiene Markdown y
agents/openai.yaml: sin scripts, hooks ni dependencias ejecutables. No se ejecutó
el instalador npx de terceros. Se aplicó su contenido leído en esta sesión; la
instalación queda disponible para descubrimiento en turnos posteriores de Codex.
No se instaló UI UX Pro Max: no aportaba una necesidad adicional.

Aplicación concreta: exploración de dominio, colores de rack/enlace/etiqueta,
jerarquía con total protagonista y muestras rotuladas, tokens semánticos, componentes
reutilizados, controles nativos, foco visible, métricas tabulares, estados de carga/
error/vacío y cadena visual de identificación. Se guardaron intención/checkpoints
por componente en .interface-design/system.md, como parte del entregable solicitado.

Verificación: comparación visual de escritorio/móvil, revisión de capturas reales,
sin iconos emoji, gradientes ornamentales, métricas CVE inventadas o controles
vacíos. Firma en login, navegación, dashboard, cadena de activo/CPE e historial.

Complemento: workflow Sites en modalidad de repositorio local, respetando React/
Vite solicitado. No se creó un Site hospedado: el alcance es frontend local con
FastAPI y publicación de su rama GitHub. No se cambió autenticación por ChatGPT.
