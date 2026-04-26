import type { JSX } from 'react';

export function DashboardEmptyState(): JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center py-32"
      role="status"
      aria-label="No data available"
    >
      {/* Data-missing icon — a simple clock/refresh mark */}
      <svg
        width={40}
        height={40}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="text-border mb-4"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.5} />
        <path
          d="M12 7v5l3 3"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <h1 className="text-text font-sans text-[15px] font-medium">Data sync pending</h1>
      <p className="text-muted mt-1.5 max-w-[300px] text-center font-sans text-[13px] leading-relaxed">
        Confidence scores will appear here once the FPL sync runs for the first time.
      </p>
    </div>
  );
}
