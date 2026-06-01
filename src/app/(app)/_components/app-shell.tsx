"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { House, Briefcase, Settings as SettingsIcon, Menu, X } from "lucide-react";
import { UserMenu } from "./user-menu";
import { spring } from "@/styles/tokens";

export type AppShellProps = {
  email: string;
  initial: string;
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: typeof House;
  disabled?: boolean;
  comingSoon?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: House },
  { label: "Applications", href: "#", icon: Briefcase, disabled: true, comingSoon: true },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];

function NavItemRow({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const isActive = !item.disabled && pathname.startsWith(item.href);

  if (item.disabled) {
    return (
      <div
        className="text-text-tertiary flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-3 opacity-50 md:py-2"
        title={item.comingSoon ? "Coming soon" : undefined}
      >
        <Icon size={16} strokeWidth={1.5} />
        <span className="text-sm">{item.label}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {isActive && (
        <span className="bg-accent absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r" />
      )}
      <Link
        href={item.href}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-md px-3 py-3 transition-colors md:py-2 ${
          isActive
            ? "bg-surface text-text-primary"
            : "text-text-secondary hover:bg-surface hover:text-text-primary"
        }`}
      >
        <Icon size={16} strokeWidth={1.5} />
        <span className="text-sm">{item.label}</span>
      </Link>
    </div>
  );
}

export function AppShell({ email, initial, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on Escape; lock body scroll while open
  useEffect(() => {
    if (!mobileOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="bg-background min-h-screen">
      {/* Mobile top bar */}
      <header className="bg-card border-border fixed top-0 right-0 left-0 z-30 flex h-14 items-center justify-between border-b px-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="text-text-primary hover:bg-surface flex h-11 w-11 items-center justify-center rounded-md transition-colors"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        <p className="text-text-primary text-sm font-medium tracking-tight">AI Job OS</p>
        <div className="w-11" aria-hidden="true" />
      </header>

      {/* Desktop nav rail */}
      <aside className="bg-card border-border fixed top-0 left-0 hidden h-screen w-[220px] flex-col border-r md:flex">
        <div className="border-border flex h-16 items-center border-b px-5">
          <p className="text-text-primary text-sm font-medium tracking-tight">AI Job OS</p>
        </div>
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavItemRow item={item} pathname={pathname} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-border border-t p-3">
          <UserMenu email={email} initial={initial} />
        </div>
      </aside>

      {/* Mobile slide-in */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              aria-hidden="true"
            />
            <motion.aside
              key="panel"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={spring.smooth}
              className="bg-card border-border fixed top-0 bottom-0 left-0 z-50 flex w-[280px] flex-col border-r md:hidden"
            >
              <div className="border-border flex h-14 items-center justify-between border-b px-3">
                <p className="text-text-primary text-sm font-medium tracking-tight">AI Job OS</p>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="text-text-primary hover:bg-surface flex h-11 w-11 items-center justify-center rounded-md transition-colors"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4">
                <ul className="space-y-1">
                  {NAV_ITEMS.map((item) => (
                    <li key={item.label}>
                      <NavItemRow
                        item={item}
                        pathname={pathname}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="border-border border-t p-3">
                <UserMenu email={email} initial={initial} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 pt-14 md:ml-[220px] md:pt-0">{children}</main>
    </div>
  );
}
