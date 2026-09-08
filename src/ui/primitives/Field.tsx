import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}
export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input className="control" {...props} />
);
export const Textarea = (
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) => <textarea className="control textarea" {...props} />;
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className="control" {...props} />
);
export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="switch">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch__track" aria-hidden="true" />
    </label>
  );
}
