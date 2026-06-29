import type { VariableSpec } from "../types/asset";

// Renders quick-input fields for a loop's variables. Used in the detail view
// and the command bar before running/injecting.
export default function VariableForm({
  variables,
  values,
  onChange,
}: {
  variables: VariableSpec[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  const set = (name: string, value: string) =>
    onChange({ ...values, [name]: value });

  return (
    <div className="varform">
      {variables.map((v) => (
        <label key={v.name} className="field">
          <span className="field__label">
            {v.label || v.name}
            {v.required && <span className="req">*</span>}
          </span>
          {v.type === "enum" ? (
            <select
              value={values[v.name] ?? ""}
              onChange={(e) => set(v.name, e.target.value)}
            >
              <option value="">Select…</option>
              {v.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={v.type === "number" ? "number" : "text"}
              value={values[v.name] ?? ""}
              placeholder={v.default ?? ""}
              onChange={(e) => set(v.name, e.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  );
}
