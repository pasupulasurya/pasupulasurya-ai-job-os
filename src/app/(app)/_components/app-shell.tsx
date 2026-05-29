"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Briefcase, Settings as SettingsIcon } from "lucide-react";
import { UserMenu } from "./user-menu";

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

export function AppShell({ email, initial, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="bg-background flex min-h-screen">
      {/* Left nav rail */}
      <aside className="bg-card border-border fixed top-0 left-0 flex h-screen w-[220px] flex-col border-r">
        {/* Wordmark */}
        <div className="border-border flex h-16 items-center border-b px-5">
          <p className="text-text-primary text-sm font-medium tracking-tight">AI Job OS</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = !item.disabled && pathname.startsWith(item.href);

              if (item.disabled) {
                return (
                  <li key={item.label}>
                    <div
                      className="text-text-tertiary flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 opacity-50"
                      title={item.comingSoon ? "Coming soon" : undefined}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                      <span className="text-sm">{item.label}</span>
                    </div>
                  </li>
                );
              }

              return (
                <li key={item.label} className="relative">
                  {isActive && (
                    <span className="bg-accent absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r" />
                  )}
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                      isActive
                        ? "bg-surface text-text-primary"
                        : "text-text-secondary hover:bg-surface hover:text-text-primary"
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User menu at bottom */}
        <div className="border-border border-t p-3">
          <UserMenu email={email} initial={initial} />
        </div>
      </aside>

      {/* Main content area */}
      <main className="ml-[220px] flex-1">{children}</main>
    </div>
  );
}
