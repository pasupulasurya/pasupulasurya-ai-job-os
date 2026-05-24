"use client";

import { useState, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { spring } from "@/styles/tokens";

interface ChipInputProps {
  label: string;
  placeholder?: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  maxChips?: number;
}

/**
 * Chip input: type a value, press Enter or comma → becomes a removable pill.
 * Used for keywords, locations, exclude lists.
 */
export function ChipInput({
  label,
  placeholder = "Type and press Enter",
  hint,
  values,
  onChange,
  maxChips = 20,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");

  function addChip(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (values.includes(value)) {
      setDraft("");
      return;
    }
    if (values.length >= maxChips) return;
    onChange([...values, value]);
    setDraft("");
  }

  function removeChip(target: string) {
    onChange(values.filter((v) => v !== target));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip(draft);
    } else if (e.key === "Backspace" && !draft && values.length > 0) {
      removeChip(values[values.length - 1]);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-text-secondary block text-xs font-medium tracking-wide uppercase">
        {label}
      </label>

      <div className="bg-card border-border focus-within:border-accent focus-within:ring-accent/20 flex min-h-[52px] flex-wrap items-center gap-2 rounded-md border px-3 py-2 transition-all focus-within:ring-2">
        <AnimatePresence initial={false}>
          {values.map((chip) => (
            <motion.span
              key={chip}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={spring.snappy}
              className="bg-surface text-text-primary border-border flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
            >
              {chip}
              <button
                type="button"
                onClick={() => removeChip(chip)}
                className="text-text-tertiary hover:text-text-primary transition-colors"
                aria-label={`Remove ${chip}`}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && addChip(draft)}
          placeholder={values.length === 0 ? placeholder : ""}
          className="text-text-primary placeholder:text-text-tertiary min-w-[120px] flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {hint && <p className="text-text-tertiary text-xs leading-relaxed">{hint}</p>}
    </div>
  );
}
