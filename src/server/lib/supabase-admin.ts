import "server-only";
import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}

/**
 * Supabase admin client.
 *
 * Uses the service-role key — bypasses Row Level Security.
 * NEVER import this from a Client Component.
 * Use only in:
 *   - Server Components
 *   - Route Handlers (`app/**\/route.ts`)
 *   - Server Actions
 *   - Background jobs / scripts
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
