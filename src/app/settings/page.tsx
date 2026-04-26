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

function readLastSync(): number | null {
  try {
    const repos = getRepositories();
    const raw = repos.syncMeta.get('last_sync');
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

export default function SettingsPage(): JSX.Element {
  const lastSync = readLastSync();

  return (
    <SettingsShell
      appearanceSection={<ThemeSelector />}
      dataSyncSection={<DataSyncSection initialLastSync={lastSync} />}
      teamSection={<TeamConnectionSection />}
    />
  );
}
