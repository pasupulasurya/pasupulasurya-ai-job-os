import { PostHog } from "posthog-node";

let client: PostHog | null = null;

/**
 * Server-side PostHog client.
 *
 * Use from Server Actions, API routes, or background jobs to
 * capture events that originate on the server (e.g. "scrape.completed",
 * "match.computed", "application.submitted_by_user").
 *
 * Returns `null` if PostHog is not configured (safe to call in any env).
 */
export function getPostHogServerClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;

  if (!client) {
    client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1, // serverless: flush immediately
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Capture an event from the server.
 *
 * @example
 *   await captureServerEvent(userId, "scrape.completed", { jobs: 42 });
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const ph = getPostHogServerClient();
  if (!ph) return;

  ph.capture({
    distinctId,
    event,
    properties,
  });

  await ph.flush();
}
