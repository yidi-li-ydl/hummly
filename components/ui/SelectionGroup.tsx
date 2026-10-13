"use client";

import { useRef, type ReactNode } from "react";

export interface SelectionOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

type Props<T extends string> = {
  label: string;
  value: T;
  options: SelectionOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  hideLabel?: boolean;
};

export default function SelectionGroup<T extends string>({ label, value, options, onChange, className = "", hideLabel = false }: Props<T>) {
  const group = useRef<HTMLDivElement>(null);
  const selectAt = (index: number) => {
    onChange(options[index].value);
    group.current?.querySelectorAll<HTMLButtonElement>("button")[index]?.focus();
  };
  return (
    <div className={`selection-field ${className}`}>
      {!hideLabel && <p className="field-label">{label}</p>}
      <div ref={group} className={`selection-group ${options.length > 3 ? "selection-group--many" : ""}`} role="radiogroup" aria-label={label}>
        {options.map((option, index) => (
          <button
            type="button"
            role="radio"
            key={option.value}
            aria-checked={value === option.value}
            tabIndex={value === option.value ? 0 : -1}
            className="selection-option"
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              let next: number | null = null;
              if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
              if (event.key === "Home") next = 0;
              if (event.key === "End") next = options.length - 1;
              if (next !== null) { event.preventDefault(); selectAt(next); }
            }}
          >
            {option.icon}
            <span>{option.label}</span>
            {option.description && <span className="selection-description">{option.description}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
