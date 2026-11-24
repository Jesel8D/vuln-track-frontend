export function Pagination({
  page,
  onChange,
}: {
  page?: { total: number; limit: number; offset: number };
  onChange: (offset: number) => void;
}) {
  if (!page || (!page.offset && page.total <= page.limit)) return null;
  return (
    <div className="rc2-actions">
      <button
        className="v2-secondary-button"
        type="button"
        disabled={page.offset === 0}
        onClick={() => onChange(Math.max(0, page.offset - page.limit))}
      >
        Anterior
      </button>
      <span>
        Página {1 + Math.floor(page.offset / page.limit)} de{" "}
        {Math.ceil(page.total / page.limit)}
      </span>
      <button
        className="v2-secondary-button"
        type="button"
        disabled={page.offset + page.limit >= page.total}
        onClick={() => onChange(page.offset + page.limit)}
      >
        Siguiente
      </button>
    </div>
  );
}
