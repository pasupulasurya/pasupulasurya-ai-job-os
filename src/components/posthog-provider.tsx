"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

/**
 * Client-side PostHog provider.
 *
 * Initializes PostHog once on mount with the public key.
 * Uses `identified_only` mode — anonymous visitors don't generate person records.
 * Identification happens explicitly via `posthog.identify(userId, traits)`
 * after the user signs in.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (posthog.__loaded) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: "history_change",
      capture_pageleave: true,
      person_profiles: "identified_only",
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.debug(false);
        }
      },
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
