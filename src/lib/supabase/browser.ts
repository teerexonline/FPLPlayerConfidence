import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase browser client.
 * Safe to call multiple times — only one client is created per page load.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (client !== null) return client;

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key)
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');

  client = createBrowserClient(url, key, {
    cookies: {
      getAll() {
        return document.cookie
          .split('; ')
          .filter(Boolean)
          .map((part) => {
            const eqIdx = part.indexOf('=');
            return { name: part.slice(0, eqIdx), value: part.slice(eqIdx + 1) };
          });
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          const parts: string[] = [`${name}=${value}`, `path=${options.path ?? '/'}`];
          if (options.maxAge !== undefined) parts.push(`max-age=${options.maxAge.toString()}`);
          if (options.domain) parts.push(`domain=${options.domain}`);
          if (options.expires) parts.push(`expires=${options.expires.toUTCString()}`);
          if (options.sameSite === true) parts.push('SameSite=Strict');
          else if (options.sameSite) {
            parts.push(`SameSite=${options.sameSite}`);
          }
          if (options.secure) parts.push('Secure');
          document.cookie = parts.join('; ');
        }
      },
    },
  }) as SupabaseClient;

  return client;
}
