"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, LogOut } from "lucide-react";
import { signOutAction } from "@/server/actions/auth";
import { spring } from "@/styles/tokens";

export function UserMenu({ email, initial }: { email: string; initial: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-surface flex w-full items-center gap-3 rounded-md px-2 py-2 transition-colors"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="bg-accent text-accent-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium uppercase">
          {initial}
        </div>
        <span className="text-text-secondary min-w-0 flex-1 truncate text-left text-xs">
          {email}
        </span>
        <ChevronUp
          size={14}
          strokeWidth={1.5}
          className={`text-text-tertiary shrink-0 transition-transform ${open ? "" : "rotate-180"}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={spring.snappy}
            role="menu"
            className="bg-card border-border absolute right-0 bottom-full left-0 mb-2 overflow-hidden rounded-md border shadow-lg"
          >
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="text-text-secondary hover:bg-surface hover:text-text-primary flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
              >
                <LogOut size={14} strokeWidth={1.5} />
                Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
