'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Updates the authenticated user's fpl_manager_id in user_profiles.
 * Passing null clears the team connection.
 *
 * Uses the session-aware anon client so the RLS policy (authenticated users
 * can UPDATE their own row) enforces the ownership check server-side.
 */
export async function updateFplManagerIdAction(
  teamId: number | null,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError !== null || user === null) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ fpl_manager_id: teamId, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  return { error: error?.message ?? null };
}
