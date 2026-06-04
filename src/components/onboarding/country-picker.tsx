"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { COUNTRIES, findCountry } from "@/shared/data/countries";
import { spring } from "@/styles/tokens";

type Props = {
  value: string; // ISO code
  onChange: (code: string) => void;
  disabled?: boolean;
};

export function CountryPicker({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = findCountry(value) ?? COUNTRIES[0];

  const filtered = query.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.dial.includes(query) ||
          c.code.toLowerCase().includes(query.toLowerCase()),
      )
    : COUNTRIES;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function selectCountry(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="bg-card border-border text-text-primary hover:border-border-strong inline-flex h-full items-center gap-1.5 rounded-l-md border border-r-0 px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="text-text-secondary text-xs">{current.code}</span>
        <span className="tabular-nums">{current.dial}</span>
        <ChevronDown size={12} strokeWidth={1.5} className="text-text-tertiary" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={spring.snappy}
            className="bg-card border-border absolute top-full left-0 z-50 mt-2 w-80 overflow-hidden rounded-md border shadow-2xl"
          >
            <div className="border-border border-b p-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or dial code…"
                className="text-text-primary placeholder:text-text-tertiary w-full bg-transparent px-2 py-1.5 text-sm outline-none"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-text-tertiary px-3 py-4 text-center text-xs">
                  No countries match
                </p>
              ) : (
                filtered.map((c) => {
                  const active = c.code === value;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => selectCountry(c.code)}
                      className={`hover:bg-surface flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                        active ? "bg-surface text-accent" : "text-text-primary"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-text-tertiary w-7 text-xs tabular-nums">
                          {c.code}
                        </span>
                        <span>{c.name}</span>
                      </span>
                      <span className="text-text-tertiary text-xs tabular-nums">{c.dial}</span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
