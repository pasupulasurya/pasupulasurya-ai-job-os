"use client";

import { useSyncExternalStore } from "react";

/**
 * Renders today's date in the VIEWER's local timezone.
 *
 * The server runs in UTC, so a server-computed date shows "tomorrow" for any
 * user whose local clock is behind UTC (e.g. US evening). The browser knows its
 * own timezone, so we compute the date client-side.
 *
 * useSyncExternalStore is the hydration-safe primitive for "server value differs
 * from client value": getServerSnapshot returns a placeholder so SSR and the
 * first client render match, then getSnapshot supplies the real local date.
 * No useEffect, no useState — nothing for the react-hooks rules to flag.
 */
const PLACEHOLDER = "\u00A0"; // non-breaking space; reserves line height pre-hydration

function subscribe() {
  return () => {}; // value is static after mount; nothing to subscribe to
}

function getSnapshot(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getServerSnapshot(): string {
  return PLACEHOLDER;
}

export function GreetingDate() {
  const today = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <p className="mb-1 text-xs tracking-widest text-white/40 uppercase">{today}</p>;
}
