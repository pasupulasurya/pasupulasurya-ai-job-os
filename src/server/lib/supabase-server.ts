import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
}

/**
 * Supabase server client.
 *
 * Use in Server Components, Server Actions, and Route Handlers
 * when you need queries scoped to the logged-in user (respects RLS).
 *
 * For background jobs or admin operations, use `supabaseAdmin` instead.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookies cannot be set here.
            // This is fine; middleware will refresh sessions.
          }
        },
      },
    },
  );
}
