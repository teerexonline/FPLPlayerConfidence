import type { Metadata } from 'next';
import type { JSX } from 'react';
import { getRepositories } from '@/lib/db/server';
import { SettingsShell } from './_components/SettingsShell';
import { ThemeSelector } from './_components/ThemeSelector';
import { DataSyncSection } from './_components/DataSyncSection';
import { TeamConnectionSection } from './_components/TeamConnectionSection';

export const metadata: Metadata = {
  title: 'Settings · FPL Confidence',
  description: 'Manage appearance, data sync, and your FPL team connection.',
};

async function readLastSync(): Promise<number | null> {
  try {
    const repos = getRepositories();
    const raw = await repos.syncMeta.get('last_sync');
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

export default async function SettingsPage(): Promise<JSX.Element> {
  const lastSync = await readLastSync();

  return (
    <SettingsShell
      appearanceSection={<ThemeSelector />}
      dataSyncSection={<DataSyncSection initialLastSync={lastSync} />}
      teamSection={<TeamConnectionSection />}
    />
  );
}
