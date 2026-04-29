import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import { ConfidenceTrend } from '@/components/confidence/ConfidenceTrend';
import { SkeletonRow } from '@/app/players/_components/SkeletonRow';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { MatchHistoryCard } from '@/app/players/[id]/_components/MatchHistoryCard';

/* ── ConfidenceTrend showcase data ───────────────────────────────────────── */

const SMOKE_PLAYERS = [
  { name: 'M. Salah', team: 'LIV', pos: 'MID', price: '£13.0m', conf: 3, deltas: [2, 1, 2, 3, 2] },
  {
    name: 'E. Haaland',
    team: 'MCI',
    pos: 'FWD',
    price: '£14.5m',
    conf: 0,
    deltas: [1, -1, 1, -1, 0],
  },
  { name: 'B. Saka', team: 'ARS', pos: 'MID', price: '£10.0m', conf: 2, deltas: [1, 2, -1, 2, 1] },
  {
    name: 'V. van Dijk',
    team: 'LIV',
    pos: 'DEF',
    price: '£6.5m',
    conf: 0,
    deltas: [-1, -1, 1, -1, 0],
  },
  {
    name: 'J. Pickford',
    team: 'EVE',
    pos: 'GK',
    price: '£5.5m',
    conf: -4,
    deltas: [-1, -1, -1, -1, -1],
  },
] as const;

interface TrendShowcaseProps {
  readonly variant: 'sparkline' | 'strip' | 'both';
}

function TrendShowcase({ variant }: TrendShowcaseProps) {
  return (
    <div className="border-border bg-surface overflow-hidden rounded-lg border">
      <div className="border-border grid grid-cols-[1fr_88px_60px_72px_72px_96px] border-b px-4 py-2.5">
        {['Player', 'Team', 'Pos', 'Price', 'Confidence', 'Last 5'].map((h) => (
          <span key={h} className="text-muted text-[11px] font-medium tracking-[0.05em] uppercase">
            {h}
          </span>
        ))}
      </div>
      {SMOKE_PLAYERS.map((p) => (
        <div
          key={p.name}
          className="border-border hover:border-l-accent hover:bg-bg grid h-14 grid-cols-[1fr_88px_60px_72px_72px_96px] items-center border-b px-4 last:border-0 hover:border-l-2"
        >
          <div className="flex items-center gap-3">
            <div className="bg-border h-8 w-8 shrink-0 rounded-full" aria-hidden="true" />
            <span className="text-text text-[14px] font-medium">{p.name}</span>
          </div>
          <span className="text-muted text-[13px]">{p.team}</span>
          <span className="border-border text-muted inline-flex h-6 w-fit items-center rounded-full border px-2.5 text-[11px] font-medium">
            {p.pos}
          </span>
          <span className="text-muted text-[14px] tabular-nums">{p.price}</span>
          <ConfidenceNumber value={p.conf} mode="c" size="sm" animated={false} />
          <ConfidenceTrend deltas={p.deltas} variant={variant} />
        </div>
      ))}
    </div>
  );
}

// Dev-only design system review page at /dev/styles.
// The '.dev.tsx' extension is only registered in pageExtensions when
// NODE_ENV === 'development' (see next.config.ts), so this file is completely
// invisible to the production build — the route does not exist at all in prod.
// Next.js App Router treats '_'-prefixed folders as private (non-routable),
// so this lives at /dev/styles rather than /_dev/styles.
export default function StylesPage() {
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

        {/* ── §4 ConfidenceNumber — the protagonist ───────────────────── */}
        <Section label="04" title="ConfidenceNumber — the protagonist">
          <p className="text-muted mb-8 text-[13px]">
            Real component. Three sizes × five sign states × animated on/off. Uses Unicode minus
            (U+2212), not ASCII hyphen. Exposes{' '}
            <code className="bg-surface rounded px-1 font-mono text-[12px]">data-sign</code> and{' '}
            <code className="bg-surface rounded px-1 font-mono text-[12px]">data-size</code> for
            test assertions. Animated versions count up from 0 on mount.
          </p>

          {/* Animated — the default experience */}
          <div className="mb-12">
            <SectionSubtitle>animated=true (default) — counts up from 0 on mount</SectionSubtitle>
            <div className="space-y-10">
              <ConfidenceRow size="xl" label="xl — 96px — player detail hero" animated />
              <ConfidenceRow size="md" label="md — 32px — player cards" animated />
              <ConfidenceRow size="sm" label="sm — 16px — table cells" animated />
            </div>
          </div>

          {/* Static — animated={false} */}
          <div>
            <SectionSubtitle>animated=false — instant render (no count-up)</SectionSubtitle>
            <div className="space-y-10">
              <ConfidenceRow size="xl" label="xl — 96px" />
              <ConfidenceRow size="md" label="md — 32px" />
              <ConfidenceRow size="sm" label="sm — 16px" />
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

        {/* ── §9 ConfidenceTrend — checkpoint (a) variants ─────────────── */}
        <Section label="09" title="ConfidenceTrend — 3 variants (choose one)">
          <p className="text-muted mb-6 text-[13px]">
            Five smoke-test players shown for each variant. Pick one before checkpoint (a) sign-off.
            Variant A: accent-coloured line + semantic end-dot. Variant B: 5-slot colour bar (oldest
            → newest, left → right). Variant C: both stacked.
          </p>

          <div className="space-y-10">
            <div>
              <SectionSubtitle>Variant A — Sparkline</SectionSubtitle>
              <TrendShowcase variant="sparkline" />
            </div>
            <div>
              <SectionSubtitle>Variant B — Colour strip</SectionSubtitle>
              <TrendShowcase variant="strip" />
            </div>
            <div>
              <SectionSubtitle>Variant C — Both stacked</SectionSubtitle>
              <TrendShowcase variant="both" />
            </div>
          </div>
        </Section>

        {/* ── §10 EmptyFilterState ─────────────────────────────────────── */}
        <Section label="10" title="EmptyFilterState">
          <p className="text-muted mb-4 text-[13px]">
            Shown when filters return 0 rows. Centered, quiet. &quot;Clear all filters&quot;
            navigates to /players with no params. (Live component shown — button navigates when
            clicked.)
          </p>
          <div className="border-border rounded-lg border">
            {/* Static preview — mirrors EmptyFilterState without the useRouter dependency */}
            <div className="flex flex-col items-center py-24 text-center">
              <div className="border-border bg-surface mb-5 flex h-12 w-12 items-center justify-center rounded-full border">
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="text-muted"
                  aria-hidden="true"
                >
                  <circle cx={11} cy={11} r={8} />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                  <path d="M8 11h6" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-text text-[14px] font-semibold">No players match your filters</p>
              <p className="text-muted mt-1.5 max-w-[260px] text-[13px] leading-relaxed">
                Try broadening your search or adjusting the position and confidence filters.
              </p>
              <div className="border-border bg-surface text-text hover:border-accent/40 mt-5 inline-flex h-8 items-center rounded-[6px] border px-4 text-[13px] font-medium">
                Clear all filters
              </div>
            </div>
          </div>
        </Section>

        {/* ── §13 MatchHistoryCard — 5 event types ─────────────────────── */}
        <Section label="13" title="MatchHistoryCard — event types in isolation">
          <p className="text-muted mb-6 text-[13px]">
            Fixed 80px-wide card. Background tint encodes delta sign at a glance. GW label top-left.
            Large delta number. Confidence-after footer in semantic color.
          </p>
          <div className="flex flex-wrap gap-3" role="list" aria-label="Sample match cards">
            <MatchHistoryCard
              snapshot={{
                gameweek: 28,
                delta: 3,
                rawDelta: 3,
                confidenceAfter: 4,
                reason: 'MOTM vs FDR 5 opponent',
                fatigueApplied: false,
                motmCounter: 1,
                defConCounter: 0,
                saveConCounter: 0,
              }}
            />
            <MatchHistoryCard
              snapshot={{
                gameweek: 25,
                delta: 2,
                rawDelta: 2,
                confidenceAfter: 3,
                reason: 'MOTM vs FDR 3 opponent',
                fatigueApplied: false,
                motmCounter: 2,
                defConCounter: 0,
                saveConCounter: 0,
              }}
            />
            <MatchHistoryCard
              snapshot={{
                gameweek: 22,
                delta: 1,
                rawDelta: 1,
                confidenceAfter: 1,
                reason: 'Clean sheet vs FDR 2 opponent',
                fatigueApplied: false,
                motmCounter: 0,
                defConCounter: 0,
                saveConCounter: 0,
              }}
            />
            <MatchHistoryCard
              snapshot={{
                gameweek: 30,
                delta: -1,
                rawDelta: -1,
                confidenceAfter: -1,
                reason: 'Blank vs FDR 3 opponent',
                fatigueApplied: false,
                motmCounter: 0,
                defConCounter: 0,
                saveConCounter: 0,
              }}
            />
            <MatchHistoryCard
              snapshot={{
                gameweek: 32,
                delta: -2,
                rawDelta: -2,
                confidenceAfter: 0,
                reason: 'Blank vs FDR 1 opponent',
                fatigueApplied: false,
                motmCounter: 0,
                defConCounter: 0,
                saveConCounter: 0,
              }}
            />
            <MatchHistoryCard
              snapshot={{
                gameweek: 10,
                delta: -2,
                rawDelta: 2,
                confidenceAfter: -3,
                reason: 'MOTM vs FDR 3 opponent + Fatigue −2',
                fatigueApplied: true,
                motmCounter: 3,
                defConCounter: 0,
                saveConCounter: 0,
              }}
            />
          </div>
          <p className="text-muted mt-4 text-[12px]">
            Compound reason (last card): primary event = MOTM, fatigue clause annotated below the
            delta.
          </p>
        </Section>

        {/* ── §10.1 Strip refinement note ──────────────────────────────── */}
        {/* §09 strips now use full-opacity semantic colors per decision:
            bg-positive (green), bg-negative (red), bg-neutral/25 (gray/zero).
            No opacity encoding of magnitude — ConfidenceNumber owns magnitude. */}

        {/* ── §11 Skeleton loading rows ────────────────────────────────── */}
        <Section label="11" title="Skeleton loading rows">
          <p className="text-muted mb-4 text-[13px]">
            12 rows on initial load. Grid matches PlayerRow exactly — no layout shift. animate-pulse
            with bg-border fill.
          </p>
          <div
            className="border-border bg-surface overflow-hidden rounded-lg border"
            aria-busy="true"
            aria-label="Loading players"
          >
            <div className="border-border grid grid-cols-[1fr_88px_60px_72px_72px_96px] border-b px-4 py-2.5">
              {['Player', 'Team', 'Pos', 'Price', 'Confidence', 'Last 5'].map((h) => (
                <span
                  key={h}
                  className="text-muted text-[11px] font-medium tracking-[0.05em] uppercase"
                >
                  {h}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </Section>
        {/* ── §12 PlayerCard — mobile layout ──────────────────────────── */}
        <Section label="12" title="PlayerCard — mobile layout (≤ 640px)">
          <p className="text-muted mb-6 text-[13px]">
            Replaces the table below the sm: breakpoint. ~80px per card. Line 1: name + md
            ConfidenceNumber (hero). Line 2: team · pos · price + 5-square strip. Same hover pattern
            as table rows. Container constrained to 375px to simulate mobile viewport.
          </p>

          {/* Constrain to 375px. Capture at ≥440px viewport so the card isn't clipped by px-8 margins. */}
          <div className="max-w-[375px]">
            <div className="border-border bg-surface overflow-hidden rounded-lg border">
              {SMOKE_PLAYERS.map((p) => (
                <div
                  key={p.name}
                  className="border-border hover:border-l-accent hover:bg-bg relative border-b px-4 py-3 last:border-0 hover:border-l-2"
                >
                  {/* Line 1: name | confidence */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text min-w-0 truncate text-[15px] leading-tight font-semibold">
                      {p.name}
                    </span>
                    <ConfidenceNumber value={p.conf} mode="c" size="md" animated={false} />
                  </div>
                  {/* Line 2: meta | strip */}
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-muted text-[12px]">
                      {p.team} · {p.pos} · {p.price}
                    </span>
                    <ConfidenceTrend deltas={p.deltas} variant="strip" />
                  </div>
                </div>
              ))}
            </div>
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

const SHOWCASE_VALUES = [5, 2, 0, -2, -4] as const;

interface ConfidenceRowProps {
  readonly size: 'xl' | 'md' | 'sm';
  readonly label: string;
  readonly animated?: boolean;
}

function ConfidenceRow({ size, label, animated = false }: ConfidenceRowProps) {
  const gap = size === 'xl' ? 'gap-10' : size === 'md' ? 'gap-8' : 'gap-6';
  return (
    <div>
      <p className="text-muted/60 mb-4 font-mono text-[11px]">{label}</p>
      <div className={`flex flex-wrap items-end ${gap}`}>
        {SHOWCASE_VALUES.map((v) => (
          <div key={v} className="flex flex-col items-center gap-2">
            <ConfidenceNumber value={v} mode="c" size={size} animated={animated} />
            <span className="text-muted font-mono text-[10px]">
              {v > 0 ? `+${v.toString()}` : v.toString()}
            </span>
          </div>
        ))}
      </div>
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
