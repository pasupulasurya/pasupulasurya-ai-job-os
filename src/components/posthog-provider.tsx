"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useAuthUser } from "@/lib/use-auth-user";

/**
 * Client-side PostHog provider.
 *
 * Initializes PostHog once on mount.
 * When a user logs in, calls posthog.identify() with their auth ID + email.
 * When a user logs out, calls posthog.reset() to start a fresh anon session.
 */
function PostHogIdentifier() {
  const { user, loading } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;
    if (!posthog.__loaded) return;

    if (user) {
      posthog.identify(user.id, {
        email: user.email,
      });
    } else {
      posthog.reset();
    }
  }, [user, loading]);

  return null;
}

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

  return (
    <PHProvider client={posthog}>
      <PostHogIdentifier />
      {children}
    </PHProvider>
  );
}
