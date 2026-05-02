import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline — FPL Confidence',
};

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-text font-sans text-[15px] font-medium">You&apos;re offline.</p>
      <p className="text-muted font-sans text-[13px]">
        Confidence numbers update when you reconnect.
      </p>
    </main>
  );
}
