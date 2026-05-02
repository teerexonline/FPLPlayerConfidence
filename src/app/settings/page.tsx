import type { Metadata } from 'next';
import type { JSX } from 'react';
import { getRepositories } from '@/lib/db/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SYNC_STATE_KEY, parseCronSyncState } from '@/lib/sync/cronSync';
import { SettingsShell } from './_components/SettingsShell';
import { ThemeSelector } from './_components/ThemeSelector';
import { DataSyncSection } from './_components/DataSyncSection';
import { TeamConnectionSection } from './_components/TeamConnectionSection';

export const metadata: Metadata = {
  title: 'Settings · FPL Confidence',
  description: 'Manage appearance, data sync, and your FPL team connection.',
};

async function readSyncInfo(): Promise<{
  lastSync: number | null;
  phase: import('@/lib/sync/cronSync').CronSyncPhase;
}> {
  try {
    const repos = getRepositories();
    const [rawState] = await Promise.all([repos.syncMeta.get(SYNC_STATE_KEY)]);
    const state = parseCronSyncState(rawState);
    return { lastSync: state.completedAt, phase: state.phase };
  } catch {
    return { lastSync: null, phase: 'idle' };
  }
}

async function readTeamProps(): Promise<{
  isAuthenticated: boolean;
  profileTeamId: number | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user === null) return { isAuthenticated: false, profileTeamId: null };

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('fpl_manager_id')
      .eq('user_id', user.id)
      .single<{ fpl_manager_id: number | null }>();

    return {
      isAuthenticated: true,
      profileTeamId: profile?.fpl_manager_id ?? null,
    };
  } catch {
    return { isAuthenticated: false, profileTeamId: null };
  }
}

export default async function SettingsPage(): Promise<JSX.Element> {
  const [{ lastSync, phase }, { isAuthenticated, profileTeamId }] = await Promise.all([
    readSyncInfo(),
    readTeamProps(),
  ]);

  return (
    <SettingsShell
      appearanceSection={<ThemeSelector />}
      dataSyncSection={<DataSyncSection initialLastSync={lastSync} initialPhase={phase} />}
      teamSection={
        <TeamConnectionSection isAuthenticated={isAuthenticated} profileTeamId={profileTeamId} />
      }
    />
  );
}
