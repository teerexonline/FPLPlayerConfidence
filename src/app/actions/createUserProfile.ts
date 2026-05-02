'use server';

import { createClient } from '@supabase/supabase-js';

/**
 * Creates a user_profiles row for a newly registered user.
 *
 * Called immediately after supabase.auth.signUp() succeeds on the client —
 * the user UUID is available even before email confirmation.
 *
 * Uses the service-role key (BYPASSRLS) so no INSERT policy is needed on
 * user_profiles. Idempotent: ON CONFLICT DO NOTHING means re-calling after
 * a page refresh or retry is safe.
 */
export async function createUserProfileAction(authUserId: string): Promise<void> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !serviceKey) throw new Error('Missing Supabase service-role credentials');
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  await supabase
    .from('user_profiles')
    .upsert({ user_id: authUserId }, { onConflict: 'user_id', ignoreDuplicates: true });
}
