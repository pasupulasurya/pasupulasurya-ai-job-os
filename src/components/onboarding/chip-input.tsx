"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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
  suggestions?: string[];
}

const MAX_VISIBLE_SUGGESTIONS = 8;

export function ChipInput({
  label,
  placeholder = "Type and press Enter",
  hint,
  values,
  onChange,
  maxChips = 20,
  suggestions,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filteredSuggestions =
    suggestions && draft.trim().length > 0
      ? suggestions
          .filter((s) => !values.includes(s))
          .filter((s) => s.toLowerCase().includes(draft.trim().toLowerCase()))
          .slice(0, MAX_VISIBLE_SUGGESTIONS)
      : [];

  const showDropdown = open && filteredSuggestions.length > 0;

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
    setActiveIdx(0);
  }

  function removeChip(target: string) {
    onChange(values.filter((v) => v !== target));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (showDropdown) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filteredSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filteredSuggestions.length) % filteredSuggestions.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        addChip(filteredSuggestions[activeIdx] ?? draft);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip(draft);
    } else if (e.key === "Backspace" && !draft && values.length > 0) {
      removeChip(values[values.length - 1]);
    }
  }

  // Close dropdown on click outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-text-secondary block text-xs font-medium tracking-wide uppercase">
        {label}
      </label>

      <div className="relative">
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
            onChange={(e) => {
              setDraft(e.target.value);
              setActiveIdx(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              // Delay blur to allow click-on-suggestion to register
              setTimeout(() => {
                if (draft) addChip(draft);
                setOpen(false);
              }, 120);
            }}
            placeholder={values.length === 0 ? placeholder : ""}
            className="text-text-primary placeholder:text-text-tertiary min-w-[120px] flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <AnimatePresence>
          {showDropdown && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={spring.snappy}
              className="bg-card border-border absolute top-full right-0 left-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-md border shadow-lg"
            >
              {filteredSuggestions.map((s, i) => (
                <li
                  key={s}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addChip(s);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                    i === activeIdx
                      ? "bg-surface text-text-primary"
                      : "text-text-secondary hover:bg-surface hover:text-text-primary"
                  }`}
                >
                  {s}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {hint && <p className="text-text-tertiary text-xs leading-relaxed">{hint}</p>}
    </div>
  );
}
