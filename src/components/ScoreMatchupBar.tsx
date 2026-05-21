import type { ReactNode } from 'react';
import { useStrings } from '../hooks/useStrings';

export function ScoreMatchupBar({
  labelA,
  labelB,
}: {
  labelA: ReactNode;
  labelB: ReactNode;
}) {
  const S = useStrings();
  return (
    <div className="score-matchup" aria-label="matchup">
      <span className="score-matchup-side score-matchup-side--a">{labelA}</span>
      <span className="score-matchup-vs" aria-hidden>
        {S.matchupVs}
      </span>
      <span className="score-matchup-side score-matchup-side--b">{labelB}</span>
    </div>
  );
}
