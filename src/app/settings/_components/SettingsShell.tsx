import type { JSX, ReactNode } from 'react';

interface SectionProps {
  readonly index: string;
  readonly heading: string;
  readonly children: ReactNode;
}

function Section({ index, heading, children }: SectionProps): JSX.Element {
  return (
    <section>
      {/* Section header row */}
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-muted font-sans text-[11px] font-medium tracking-[0.06em] tabular-nums">
          {index}
        </span>
        <span className="text-muted font-sans text-[11px] font-semibold tracking-[0.08em] uppercase">
          {heading}
        </span>
      </div>

      {/* Content card */}
      <div className="border-border bg-surface rounded-[8px] border px-6 py-5">{children}</div>
    </section>
  );
}

interface SettingsShellProps {
  readonly appearanceSection: ReactNode;
  readonly dataSyncSection: ReactNode;
  readonly teamSection: ReactNode;
}

export function SettingsShell({
  appearanceSection,
  dataSyncSection,
  teamSection,
}: SettingsShellProps): JSX.Element {
  return (
    <main className="bg-bg text-text min-h-screen font-sans">
      <div className="mx-auto max-w-[600px] px-4 py-12 sm:px-8">
        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-text font-sans text-[32px] leading-tight font-semibold tracking-[-0.01em]">
            Settings
          </h1>
          <p className="text-muted mt-2 font-sans text-[15px] leading-relaxed">
            Manage your appearance, data, and team connection.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          <Section index="01" heading="Appearance">
            {appearanceSection}
          </Section>

          <Section index="02" heading="Data">
            {dataSyncSection}
          </Section>

          <Section index="03" heading="My Team">
            {teamSection}
          </Section>
        </div>
      </div>
    </main>
  );
}
