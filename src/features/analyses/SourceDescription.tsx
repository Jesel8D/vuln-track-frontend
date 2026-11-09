import { useState } from "react";
import { object } from "../../services/analysisContract";
export function SourceDescription({
  descriptions,
  fallback,
}: {
  descriptions: unknown;
  fallback: string | null;
}) {
  const items = Array.isArray(descriptions)
    ? descriptions.filter(object).filter((d) => typeof d.value === "string")
    : [];
  const preferred = items.findIndex((d) => d.lang === "es");
  const [selected, setSelected] = useState(preferred < 0 ? 0 : preferred);
  const current = items[selected] ?? items[0];
  if (!current)
    return (
      <p>
        {fallback ?? "Sin descripción disponible en la evidencia conservada."}
      </p>
    );
  return (
    <div className="external-description">
      {items.length > 1 && (
        <div className="field description-language">
          <label htmlFor="source-language">Idioma de la descripción</label>
          <select
            id="source-language"
            value={selected}
            onChange={(e) => {
              const index = Number(e.target.value);
              if (Number.isInteger(index) && index >= 0 && index < items.length)
                setSelected(index);
            }}
          >
            {items.map((d, i) => (
              <option key={i} value={i}>
                {d.lang === "es"
                  ? "Español (es)"
                  : d.lang === "en"
                    ? "Inglés (en)"
                    : typeof d.lang === "string"
                      ? d.lang
                      : `Descripción ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
      <span className="small muted">
        Texto de origen ·{" "}
        {typeof current.lang === "string" ? current.lang : "idioma no indicado"}
      </span>
      <p>{String(current.value)}</p>
    </div>
  );
}
