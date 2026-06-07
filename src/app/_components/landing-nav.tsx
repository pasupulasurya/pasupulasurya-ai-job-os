"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Sticky top nav for the landing page. Transparent at the top of the page,
 * gains a translucent blurred background + hairline border once scrolled,
 * so it never fights the hero on first paint.
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-border/60 bg-background/70 border-b backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-text-primary text-sm font-semibold tracking-tight">
          AI Job OS
        </Link>
        <Link
          href="/signup"
          className="bg-accent text-accent-foreground hover:bg-accent-hover rounded-md px-5 py-2 text-sm font-medium transition-colors"
        >
          Get started
        </Link>
      </nav>
    </header>
  );
}
