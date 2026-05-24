"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Home,
  Sparkles,
  Settings,
  Sun,
  Moon,
  LogIn,
  LogOut,
  UserPlus,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { spring, duration } from "@/styles/tokens";
import { useAuthUser } from "@/lib/use-auth-user";
import { signOutAction } from "@/server/actions/auth";

type CommandItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  group: "Navigate" | "Theme" | "Account";
  shortcut?: string[];
  onSelect: () => void;
};

/**
 * Command Palette — the cinematic ⌘K experience.
 *
 * Context-aware:
 *   - Logged out → shows Sign In / Sign Up
 *   - Logged in  → shows Preferences / Sign Out (with user's email)
 *
 * Always shows: Home, Theme toggle.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user } = useAuthUser();
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const close = () => setOpen(false);

  // Build the item list based on auth state
  const items: CommandItem[] = [
    {
      id: "home",
      label: "Go to Home",
      icon: Home,
      group: "Navigate",
      shortcut: ["g", "h"],
      onSelect: () => {
        router.push("/");
        close();
      },
    },
    ...(user
      ? [
          {
            id: "preferences",
            label: "Edit preferences",
            icon: SlidersHorizontal,
            group: "Navigate" as const,
            shortcut: ["g", "p"],
            onSelect: () => {
              router.push("/onboarding/preferences");
              close();
            },
          },
          {
            id: "settings",
            label: "Settings",
            icon: Settings,
            group: "Navigate" as const,
            onSelect: () => {
              close();
            },
          },
        ]
      : []),
    {
      id: "theme-dark",
      label: "Switch to Dark mode",
      icon: Moon,
      group: "Theme",
      onSelect: () => {
        setTheme("dark");
        close();
      },
    },
    {
      id: "theme-light",
      label: "Switch to Light mode",
      icon: Sun,
      group: "Theme",
      onSelect: () => {
        setTheme("light");
        close();
      },
    },
    ...(user
      ? [
          {
            id: "sign-out",
            label: `Sign out (${user.email})`,
            icon: LogOut,
            group: "Account" as const,
            onSelect: () => {
              startTransition(async () => {
                await signOutAction();
              });
              close();
            },
          },
        ]
      : [
          {
            id: "sign-in",
            label: "Sign in",
            icon: LogIn,
            group: "Account" as const,
            onSelect: () => {
              router.push("/login");
              close();
            },
          },
          {
            id: "sign-up",
            label: "Create account",
            icon: UserPlus,
            group: "Account" as const,
            onSelect: () => {
              router.push("/signup");
              close();
            },
          },
        ]),
  ];

  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cmdk-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.short }}
          className="fixed inset-0 z-[400] flex items-start justify-center px-4 pt-[18vh]"
          style={{
            background: "var(--overlay-bg)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
          onClick={close}
        >
          <motion.div
            key="cmdk-panel"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={spring.smooth}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[640px] overflow-hidden"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "0 24px 60px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            <Command label="Global Command Palette" shouldFilter={true} loop className="w-full">
              <div
                className="flex items-center gap-3 border-b px-5 py-4"
                style={{ borderColor: "var(--border)" }}
              >
                <Search size={18} strokeWidth={1.5} style={{ color: "var(--text-tertiary)" }} />
                <Command.Input
                  autoFocus
                  placeholder="Type a command or search…"
                  className="flex-1 bg-transparent text-base outline-none placeholder:opacity-40"
                  style={{ color: "var(--text-primary)" }}
                />
                <kbd
                  className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs md:flex"
                  style={{
                    background: "var(--card)",
                    color: "var(--text-tertiary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  esc
                </kbd>
              </div>

              <Command.List className="max-h-[400px] overflow-y-auto px-2 py-2">
                <Command.Empty className="px-4 py-12 text-center text-sm">
                  <span style={{ color: "var(--text-tertiary)" }}>No matches found.</span>
                </Command.Empty>

                {groups.map((group) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
                    style={
                      {
                        ["--heading-color" as string]: "var(--text-tertiary)",
                      } as React.CSSProperties
                    }
                  >
                    {items
                      .filter((i) => i.group === group)
                      .map((item) => {
                        const Icon = item.icon;
                        const isActiveTheme =
                          (item.id === "theme-dark" && theme === "dark") ||
                          (item.id === "theme-light" && theme === "light");
                        return (
                          <Command.Item
                            key={item.id}
                            value={item.label}
                            onSelect={item.onSelect}
                            className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors aria-selected:bg-[var(--card)] data-[selected=true]:bg-[var(--card)]"
                            style={{ color: "var(--text-primary)" }}
                          >
                            <Icon
                              size={16}
                              strokeWidth={1.5}
                              style={{ color: "var(--text-secondary)" }}
                            />
                            <span className="flex-1">{item.label}</span>
                            {isActiveTheme && (
                              <Sparkles
                                size={14}
                                strokeWidth={1.5}
                                style={{ color: "var(--accent)" }}
                              />
                            )}
                            {item.shortcut && (
                              <div className="flex items-center gap-1">
                                {item.shortcut.map((k) => (
                                  <kbd
                                    key={k}
                                    className="rounded px-1.5 py-0.5 text-[10px] uppercase"
                                    style={{
                                      background: "var(--card)",
                                      color: "var(--text-tertiary)",
                                      border: "1px solid var(--border)",
                                    }}
                                  >
                                    {k}
                                  </kbd>
                                ))}
                              </div>
                            )}
                          </Command.Item>
                        );
                      })}
                  </Command.Group>
                ))}
              </Command.List>

              <div
                className="flex items-center justify-between border-t px-4 py-3 text-xs"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                  color: "var(--text-tertiary)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <kbd
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: "var(--card)" }}
                    >
                      ↑↓
                    </kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1.5">
                    <kbd
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: "var(--card)" }}
                    >
                      ↵
                    </kbd>
                    select
                  </span>
                </div>
                <span>{user ? user.email : "AI Job OS"}</span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
