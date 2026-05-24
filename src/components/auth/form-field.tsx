"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/**
 * Apple-grade input field with floating label, focus ring, error state.
 */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, className, id, ...props },
  ref,
) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="text-text-secondary block text-xs font-medium tracking-wide uppercase"
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "bg-card border-border text-text-primary placeholder:text-text-tertiary w-full rounded-md border px-4 py-3 text-base transition-all outline-none",
          "focus:border-accent focus:ring-accent/20 focus:ring-2",
          error && "border-danger focus:border-danger focus:ring-danger/20",
          className,
        )}
        {...props}
      />
      {error && <p className="text-danger text-xs leading-relaxed">{error}</p>}
    </div>
  );
});
