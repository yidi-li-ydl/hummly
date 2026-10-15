"use client";

interface Props<T extends string> {
  label: string;
  hideLabel?: boolean;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export default function CompactSelect<T extends string>({ label, hideLabel = false, value, options, onChange }: Props<T>) {
  return <label className="compact-select-field">
    <span className={hideLabel ? "sr-only" : "field-label"}>{label}</span>
    <span className="compact-select-control">
      <select value={value} onChange={event => onChange(event.target.value as T)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  </label>;
}
