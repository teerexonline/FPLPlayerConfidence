import type { Metadata } from 'next';
import type { JSX } from 'react';
import { getRepositories } from '@/lib/db/server';
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

export default async function SettingsPage(): Promise<JSX.Element> {
  const { lastSync, phase } = await readSyncInfo();

  return (
    <SettingsShell
      appearanceSection={<ThemeSelector />}
      dataSyncSection={<DataSyncSection initialLastSync={lastSync} initialPhase={phase} />}
      teamSection={<TeamConnectionSection />}
    />
  );
}
