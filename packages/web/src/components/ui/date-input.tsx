"use client";

import { useState } from "react";

interface DateOnlyInputProps {
  name: string;
  label?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
}

export function DateOnlyInput({
  name,
  label,
  defaultValue,
  value: controlledValue,
  onChange,
  required,
  className,
}: DateOnlyInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const dateValue = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    onChange?.(val);
  };

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-zinc-300 mb-1.5"
        >
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {/* Overlay showing yyyy-mm-dd format consistently */}
        <div className="pointer-events-none absolute inset-0 flex items-center px-3 font-mono text-sm text-zinc-100">
          {dateValue || (
            <span className="text-zinc-500">yyyy-mm-dd</span>
          )}
        </div>
        {/* Native date input with transparent text */}
        <input
          type="date"
          id={name}
          value={dateValue}
          onChange={handleChange}
          required={required}
          lang="en-CA"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-transparent caret-transparent focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        {/* Hidden input for form submission */}
        <input type="hidden" name={name} value={dateValue} />
      </div>
    </div>
  );
}
