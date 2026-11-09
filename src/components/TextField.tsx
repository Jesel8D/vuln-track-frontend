interface Props {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  max?: number;
  multiline?: boolean;
  disabled?: boolean;
}
export function TextField({
  name,
  label,
  value,
  onChange,
  required,
  error,
  hint,
  max = 120,
  multiline,
  disabled,
}: Props) {
  const props = {
    id: name,
    name,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    required,
    disabled,
    maxLength: max * 2,
    "aria-invalid": !!error,
    "aria-describedby":
      [hint ? `${name}-hint` : "", error ? `${name}-error` : ""]
        .filter(Boolean)
        .join(" ") || undefined,
  };
  return (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required ? (
          <span className="required"> *</span>
        ) : (
          <span className="optional"> Opcional</span>
        )}
      </label>
      {multiline ? (
        <textarea {...props} rows={3} />
      ) : (
        <input {...props} type="text" />
      )}
      {hint && (
        <small id={`${name}-hint`} className="field-hint">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${name}-error`} className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}
