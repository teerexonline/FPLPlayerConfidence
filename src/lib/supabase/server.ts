import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for use in Server Components, Route Handlers, and
 * Server Actions. Reads/writes the session from the request cookies so the
 * browser client's JWT is automatically available server-side.
 *
 * Call once per request — Next.js caches `cookies()` within a request boundary.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key)
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll is called from Server Components where cookies cannot be
          // written. The middleware is responsible for refreshing the session.
        }
      },
    },
  });
}
