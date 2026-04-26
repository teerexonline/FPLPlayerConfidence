import type { Metadata } from 'next';
import type { JSX } from 'react';
import { MyTeamPageClient } from './_components/MyTeamPageClient';

export const metadata: Metadata = {
  title: 'My Team · FPL Confidence',
  description: 'Your FPL squad confidence breakdown — starters, bench, and positional ratings.',
};

export default function MyTeamPage(): JSX.Element {
  return <MyTeamPageClient />;
}
