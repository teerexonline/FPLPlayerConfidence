import type { JSX } from 'react';
import { CalibrationCaveat } from '@/components/confidence/CalibrationCaveat';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import type { PlayerDetailData } from './types';

interface MatchPredictionPanelProps {
  readonly pGoal: number | null;
  readonly pAssist: number | null;
  readonly nextFixtureFdr: number | null;
  readonly position: PlayerDetailData['position'];
}

function FdrDots({ fdr }: { fdr: number }): JSX.Element {
  const clamped = Math.max(1, Math.min(5, fdr));
  return (
    <span
      role="img"
      className="flex items-center gap-0.5"
      aria-label={`FDR ${fdr.toString()} out of 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={
            i < clamped
              ? 'bg-accent h-1.5 w-1.5 rounded-full'
              : 'bg-border h-1.5 w-1.5 rounded-full'
          }
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function MatchPredictionPanel({
  pGoal,
  pAssist,
  nextFixtureFdr,
  position,
}: MatchPredictionPanelProps): JSX.Element {
  const hasData = pGoal !== null && pAssist !== null;

  return (
    <section aria-labelledby="match-prediction-title" className="mt-10">
      <h2
        id="match-prediction-title"
        className="text-muted mb-4 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase"
      >
        Next match prediction
      </h2>

      <div className="border-border bg-surface rounded-[8px] border p-5">
        {!hasData ? (
          <p className="text-muted font-sans text-[14px]">Next fixture not yet scheduled.</p>
        ) : (
          <>
            {/* Probabilities */}
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center gap-1">
                <ConfidenceNumber value={pGoal} mode="g" size="md" animated={false} />
                <div className="flex items-center gap-1">
                  <span className="text-muted font-sans text-[11px]">P(Goal)</span>
                  {position === 'FWD' && <CalibrationCaveat />}
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <ConfidenceNumber value={pAssist} mode="a" size="md" animated={false} />
                <span className="text-muted font-sans text-[11px]">P(Assist)</span>
              </div>

              {nextFixtureFdr !== null && (
                <div className="ml-auto flex flex-col items-end gap-1">
                  <FdrDots fdr={nextFixtureFdr} />
                  <span className="text-muted font-sans text-[11px]">
                    Difficulty {nextFixtureFdr.toString()}/5
                  </span>
                </div>
              )}
            </div>

            <p className="text-muted mt-4 font-sans text-[12px] leading-relaxed">
              Probabilities derived from FPL&apos;s ICT framework against the next fixture&apos;s
              difficulty. Not a guarantee — use as directional signal.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
