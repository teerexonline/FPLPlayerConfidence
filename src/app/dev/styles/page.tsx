import { notFound } from 'next/navigation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

// Excluded from production — returns 404 when NODE_ENV !== 'development'.
// Note: Next.js App Router treats `_`-prefixed folders as private (non-routable),
// so this lives at /dev/styles rather than /_dev/styles.
export default function StylesPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <div className="bg-bg text-text min-h-screen font-sans">
      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <header className="border-border bg-bg/80 sticky top-0 z-10 flex items-center justify-between border-b px-8 py-4 backdrop-blur-sm">
        <div>
          <p className="text-muted text-[11px] font-medium tracking-[0.08em] uppercase">
            FPL Confidence
          </p>
          <h1 className="text-text text-[18px] leading-tight font-semibold tracking-[-0.01em]">
            Design System
          </h1>
        </div>
        <ThemeToggle className="border-border bg-surface text-muted hover:border-accent hover:text-accent focus-visible:ring-accent rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none" />
      </header>

      <main className="mx-auto max-w-[1280px] space-y-20 px-8 py-16">
        {/* ── §1 Color tokens ─────────────────────────────────────────── */}
        <Section label="01" title="Color tokens">
          <div className="space-y-8">
            {/* Theme-adaptive */}
            <div>
              <SectionSubtitle>Theme-adaptive</SectionSubtitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Swatch bg="bg-bg" label="bg" hex={['#FAFAF9', '#0A0A0A']} bordered />
                <Swatch bg="bg-surface" label="surface" hex={['#FFFFFF', '#141414']} bordered />
                <Swatch bg="bg-border" label="border" hex={['#E7E5E4', '#1F1F1F']} bordered />
                <Swatch bg="bg-text" label="text" hex={['#0A0A0A', '#FAFAF9']} />
                <Swatch bg="bg-muted" label="muted" hex={['#78716C', '#A1A1AA']} />
              </div>
            </div>

            {/* Semantic */}
            <div>
              <SectionSubtitle>Semantic — mode-invariant</SectionSubtitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Swatch bg="bg-positive" label="positive" hex={['#16A34A']} />
                <Swatch bg="bg-negative" label="negative" hex={['#DC2626']} />
                <Swatch bg="bg-neutral" label="neutral" hex={['#A1A1AA']} />
                <Swatch bg="bg-accent" label="accent" hex={['#1E40AF']} />
              </div>
            </div>
          </div>
        </Section>

        {/* ── §2 Typography ───────────────────────────────────────────── */}
        <Section label="02" title="Typography">
          <div className="divide-border space-y-1 divide-y">
            {/* Hero confidence number */}
            <TypeRow
              spec="96px · weight 600 · −0.02em · tabular · Geist Sans"
              label="Hero confidence"
            >
              <div className="flex items-baseline gap-6">
                <span
                  className="text-positive font-sans text-[96px] leading-none font-semibold tracking-[-0.02em] tabular-nums"
                  data-sign="positive"
                >
                  +3
                </span>
                <span
                  className="text-neutral font-sans text-[96px] leading-none font-semibold tracking-[-0.02em] tabular-nums"
                  data-sign="neutral"
                >
                  0
                </span>
                <span
                  className="text-negative font-sans text-[96px] leading-none font-semibold tracking-[-0.02em] tabular-nums"
                  data-sign="negative"
                >
                  {/* U+2212 minus sign, not ASCII hyphen */}
                  &#x2212;2
                </span>
              </div>
            </TypeRow>

            {/* Page title */}
            <TypeRow spec="32px · weight 600 · −0.01em · Geist Sans" label="Page title">
              <span className="text-text font-sans text-[32px] leading-tight font-semibold tracking-[-0.01em]">
                Players
              </span>
            </TypeRow>

            {/* Display serif */}
            <TypeRow
              spec="44px · weight 400 · Fraunces · opsz 96 · display only"
              label="Display serif"
            >
              <span
                className="font-display text-text text-[44px] leading-tight font-normal"
                style={{ fontOpticalSizing: 'auto' }}
              >
                M. Salah
              </span>
            </TypeRow>

            {/* Section header */}
            <TypeRow spec="14px · weight 500 · +0.05em · uppercase · muted" label="Section header">
              <span className="text-muted font-sans text-[14px] font-medium tracking-[0.05em] uppercase">
                Top movers this gameweek
              </span>
            </TypeRow>

            {/* Body */}
            <TypeRow spec="15px · weight 400 · 1.5 line-height · Geist Sans" label="Body">
              <p className="text-text max-w-prose font-sans text-[15px] leading-[1.5] font-normal">
                Confidence is a rolling score from −5 to +5 that tells you whether a player is
                trending toward a return. Above 0 = back them. Below 0 = bench or transfer.
              </p>
            </TypeRow>

            {/* Table cell */}
            <TypeRow spec="14px · weight 400 · tabular-nums · Geist Sans" label="Table cell">
              <div className="text-text flex items-center gap-8 font-sans text-[14px] font-normal tabular-nums">
                <span>Salah</span>
                <span className="text-muted">MID</span>
                <span>£13.0m</span>
                <span className="text-positive">+3</span>
                <span>38&thinsp;pts</span>
              </div>
            </TypeRow>

            {/* Caption */}
            <TypeRow spec="12px · weight 500 · muted" label="Caption / meta">
              <span className="text-muted font-sans text-[12px] font-medium">
                Last synced 4 minutes ago · GW 32
              </span>
            </TypeRow>
          </div>
        </Section>

        {/* ── §3 Spacing scale ────────────────────────────────────────── */}
        <Section label="03" title="Spacing scale">
          <p className="text-muted mb-6 text-[13px]">Base grid: 4px. All values are multiples.</p>
          <div className="flex flex-col gap-3">
            {[
              { px: 4, label: '1 (4px)' },
              { px: 8, label: '2 (8px)' },
              { px: 12, label: '3 (12px)' },
              { px: 16, label: '4 (16px)' },
              { px: 24, label: '6 (24px)' },
              { px: 32, label: '8 (32px)' },
              { px: 48, label: '12 (48px)' },
            ].map(({ px, label }) => (
              <div key={px} className="flex items-center gap-4">
                <span className="text-muted w-16 shrink-0 font-mono text-[12px]">{label}</span>
                <div
                  className="bg-accent rounded-sm opacity-70"
                  style={{ width: px * 4, height: 20 }}
                />
                <span className="text-muted font-mono text-[11px]">{px}px</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── §4 Confidence number — the protagonist ──────────────────── */}
        <Section label="04" title="Confidence number — the protagonist">
          <p className="text-muted mb-8 text-[13px]">
            Every size × every sign state. Uses Unicode minus (U+2212), not ASCII hyphen. Exposes{' '}
            <code className="bg-surface rounded px-1 font-mono text-[12px]">data-sign</code> for
            test assertions.
          </p>

          {/* XL — detail page hero */}
          <div className="mb-10">
            <SectionSubtitle>xl — 96px — player detail hero</SectionSubtitle>
            <div className="flex flex-wrap items-end gap-10">
              <ConfidenceDemo value={4} size="xl" label="GW positive streak" />
              <ConfidenceDemo value={0} size="xl" label="Neutral / opening state" />
              <ConfidenceDemo value={-3} size="xl" label="Poor run of form" />
              <ConfidenceDemo value={5} size="xl" label="Clamped maximum" />
              <ConfidenceDemo value={-5} size="xl" label="Clamped minimum" />
            </div>
          </div>

          {/* MD — cards */}
          <div className="mb-10">
            <SectionSubtitle>md — 32px — player cards</SectionSubtitle>
            <div className="flex flex-wrap items-end gap-8">
              <ConfidenceDemo value={3} size="md" label="Salah" />
              <ConfidenceDemo value={1} size="md" label="Trent" />
              <ConfidenceDemo value={0} size="md" label="Havertz" />
              <ConfidenceDemo value={-1} size="md" label="Isak" />
              <ConfidenceDemo value={-4} size="md" label="Pedro" />
            </div>
          </div>

          {/* SM — table cells */}
          <div>
            <SectionSubtitle>sm — 16px — table cells</SectionSubtitle>
            <div className="flex flex-wrap items-center gap-6">
              {[5, 3, 2, 1, 0, -1, -2, -4, -5].map((v) => (
                <ConfidenceDemo key={v} value={v} size="sm" />
              ))}
            </div>
          </div>
        </Section>

        {/* ── §5 Buttons ──────────────────────────────────────────────── */}
        <Section label="05" title="Buttons">
          <div className="flex flex-wrap items-center gap-4">
            {/* Primary */}
            <button
              type="button"
              className="bg-accent focus-visible:ring-accent h-9 rounded-[6px] px-3 text-[14px] font-medium text-white transition-colors hover:bg-[#1e3a8a] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:opacity-90"
            >
              Refresh data
            </button>

            {/* Secondary */}
            <button
              type="button"
              className="border-border bg-surface text-text hover:border-accent/40 hover:bg-bg focus-visible:ring-accent h-9 rounded-[6px] border px-3 text-[14px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:opacity-80"
            >
              Export CSV
            </button>

            {/* Ghost */}
            <button
              type="button"
              className="text-muted hover:bg-surface hover:text-text focus-visible:ring-accent h-9 rounded-[6px] px-3 text-[14px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:opacity-80"
            >
              Cancel
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="border-border text-muted rounded-full border px-3 py-1 text-[12px] font-medium">
              GK
            </span>
            <span className="border-accent bg-accent/10 text-accent rounded-full border px-3 py-1 text-[12px] font-medium">
              MID
            </span>
            <span className="border-border text-muted rounded-full border px-3 py-1 text-[12px] font-medium">
              DEF
            </span>
            <span className="border-border text-muted rounded-full border px-3 py-1 text-[12px] font-medium">
              FWD
            </span>
          </div>
        </Section>

        {/* ── §6 Card ─────────────────────────────────────────────────── */}
        <Section label="06" title="Cards">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Player card */}
            <div className="border-border bg-surface rounded-lg border p-6 dark:shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-muted text-[12px] font-medium tracking-[0.05em] uppercase">
                    Liverpool · MID
                  </p>
                  <p className="text-text mt-0.5 text-[15px] font-semibold">M. Salah</p>
                </div>
                <span
                  className="text-positive font-sans text-[32px] leading-none font-semibold tracking-[-0.01em] tabular-nums"
                  data-sign="positive"
                >
                  +3
                </span>
              </div>
              <div className="border-border flex items-center justify-between border-t pt-4">
                <span className="text-muted text-[13px]">£13.0m</span>
                <span className="text-muted text-[13px]">284 pts</span>
                <span className="text-accent text-[13px] font-medium">↑ +2 this GW</span>
              </div>
            </div>

            {/* Empty state card */}
            <div className="border-border bg-surface flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
              <p className="text-text text-[13px] font-medium">No watchlist yet</p>
              <p className="text-muted mt-1 text-[12px]">
                Pin players from the players list to see them here.
              </p>
              <button
                type="button"
                className="border-border bg-bg text-muted hover:border-accent hover:text-accent focus-visible:ring-accent mt-4 h-8 rounded-[6px] border px-3 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Browse players →
              </button>
            </div>
          </div>
        </Section>

        {/* ── §7 Table ────────────────────────────────────────────────── */}
        <Section label="07" title="Table — Linear style">
          <p className="text-muted mb-4 text-[13px]">
            1px row borders only. No vertical lines. No zebra striping. 56px row height. Hover
            reveals left accent border.
          </p>
          <div className="border-border bg-surface overflow-hidden rounded-lg border">
            {/* Header */}
            <div className="border-border grid grid-cols-[1fr_80px_64px_80px_64px] border-b px-4 py-2">
              {['Player', 'Team', 'Pos', 'Price', 'Confidence'].map((h) => (
                <span
                  key={h}
                  className="text-muted text-[12px] font-medium tracking-[0.04em] uppercase"
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {[
              { name: 'M. Salah', team: 'LIV', pos: 'MID', price: '£13.0m', conf: 3 },
              { name: 'E. Haaland', team: 'MCI', pos: 'FWD', price: '£14.5m', conf: 0 },
              { name: 'A. Trent', team: 'LIV', pos: 'DEF', price: '£7.2m', conf: -2 },
            ].map((row) => (
              <div
                key={row.name}
                className="group border-border hover:border-l-accent hover:bg-bg relative grid h-14 grid-cols-[1fr_80px_64px_80px_64px] items-center border-b px-4 last:border-0 hover:border-l-2"
              >
                <span className="text-text text-[14px] font-medium">{row.name}</span>
                <span className="text-muted font-mono text-[13px]">{row.team}</span>
                <span className="text-muted text-[13px]">{row.pos}</span>
                <span className="text-muted text-[14px] tabular-nums">{row.price}</span>
                <span
                  className={`text-[14px] font-semibold tabular-nums ${
                    row.conf > 0 ? 'text-positive' : row.conf < 0 ? 'text-negative' : 'text-neutral'
                  }`}
                  data-sign={row.conf > 0 ? 'positive' : row.conf < 0 ? 'negative' : 'neutral'}
                >
                  {row.conf > 0
                    ? `+${row.conf.toString()}`
                    : row.conf < 0
                      ? `−${Math.abs(row.conf).toString()}`
                      : '0'}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── §8 Focus + accessibility ─────────────────────────────────── */}
        <Section label="08" title="Focus rings + accessibility">
          <p className="text-muted mb-6 text-[13px]">
            2px solid accent ring on all interactive elements. Keyboard-only visible via
            focus-visible. Color never the only signal — glyphs always present.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              className="border-border bg-surface text-text focus-visible:ring-accent rounded-[6px] border px-4 py-2 text-[14px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Tab to me
            </button>
            <input
              type="text"
              placeholder="Search players…"
              className="border-border bg-surface text-text placeholder:text-muted focus:border-accent focus:ring-accent/30 h-10 rounded-[4px] border px-3 text-[14px] focus:ring-2 focus:outline-none"
            />
          </div>
        </Section>
      </main>
    </div>
  );
}

/* ── Sub-components (styles-page only) ─────────────────────────────────── */

interface SectionProps {
  readonly label: string;
  readonly title: string;
  readonly children: React.ReactNode;
}

function Section({ label, title, children }: SectionProps) {
  return (
    <section>
      <div className="mb-8 flex items-baseline gap-3">
        <span className="text-muted font-mono text-[11px] font-medium">{label}</span>
        <h2 className="text-muted text-[14px] font-medium tracking-[0.05em] uppercase">{title}</h2>
        <div className="bg-border h-px flex-1" />
      </div>
      {children}
    </section>
  );
}

function SectionSubtitle({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="text-muted/60 mb-3 text-[12px] font-medium tracking-[0.04em] uppercase">
      {children}
    </p>
  );
}

interface SwatchProps {
  readonly bg: string;
  readonly label: string;
  readonly hex: readonly string[];
  readonly bordered?: boolean;
}

function Swatch({ bg, label, hex, bordered = false }: SwatchProps) {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className={`h-20 w-full ${bg} ${bordered ? 'border-border border-b' : ''}`} />
      <div className="bg-surface p-3">
        <p className="text-text text-[13px] font-medium">{label}</p>
        {hex.map((h, i) => (
          <p key={i} className="text-muted font-mono text-[11px]">
            {hex.length > 1 ? (i === 0 ? 'light: ' : 'dark: ') : ''}
            {h}
          </p>
        ))}
      </div>
    </div>
  );
}

interface ConfidenceDemoProps {
  readonly value: number;
  readonly size: 'xl' | 'md' | 'sm';
  readonly label?: string;
}

function ConfidenceDemo({ value, size, label }: ConfidenceDemoProps) {
  const sign = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  const colorClass =
    sign === 'positive' ? 'text-positive' : sign === 'negative' ? 'text-negative' : 'text-neutral';

  // Use Unicode minus (U+2212) for negative, not ASCII hyphen-minus
  const display =
    value > 0 ? `+${value.toString()}` : value < 0 ? `−${Math.abs(value).toString()}` : '0';

  const sizeClass =
    size === 'xl'
      ? 'text-[96px] font-semibold leading-none tracking-[-0.02em]'
      : size === 'md'
        ? 'text-[32px] font-semibold leading-none tracking-[-0.01em]'
        : 'text-[16px] font-medium leading-none';

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`font-sans tabular-nums ${sizeClass} ${colorClass}`}
        data-sign={sign}
        aria-label={`Confidence: ${display}`}
      >
        {display}
      </span>
      {label !== undefined && <span className="text-muted text-[11px]">{label}</span>}
    </div>
  );
}

interface TypeRowProps {
  readonly spec: string;
  readonly label: string;
  readonly children: React.ReactNode;
}

function TypeRow({ spec, label, children }: TypeRowProps) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-6 py-6 first:pt-0">
      <div className="pt-1">
        <p className="text-text text-[12px] font-medium">{label}</p>
        <p className="text-muted mt-0.5 font-mono text-[11px] leading-relaxed">{spec}</p>
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
