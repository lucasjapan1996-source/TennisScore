import { useEffect, useState, type ReactNode } from 'react';
import { MatchRetirementActions } from './MatchRetirementActions';
import { ScoreMatchupBar } from './ScoreMatchupBar';
import { ScoreRefreshButton } from './ScoreRefreshButton';
import { ScoreStepper } from './ScoreStepper';
import { SetSeriesScoreForm } from './SetSeriesScoreForm';
import { useStrings } from '../hooks/useStrings';
import type { BestOf, SetScore } from '../types';
import type { RetiredSide } from '../utils/matchOutcome';
import { isRetired } from '../utils/matchOutcome';

export function ScoreForm({
  matchId,
  labelA,
  labelB,
  textLabelA = '',
  textLabelB = '',
  scoreA,
  scoreB,
  tiebreakA,
  tiebreakB,
  sets = [],
  retiredSide = null,
  onSave,
  onSaveSets,
  onSetRetirement,
  onClear,
  disabled = false,
  disabledHint,
  bestOf = 1,
}: {
  matchId: string;
  bestOf?: BestOf;
  labelA: ReactNode;
  labelB: ReactNode;
  textLabelA?: string;
  textLabelB?: string;
  disabled?: boolean;
  disabledHint?: string;
  scoreA: number | null;
  scoreB: number | null;
  tiebreakA: number;
  tiebreakB: number;
  sets?: SetScore[];
  retiredSide?: RetiredSide | null;
  onSave: (
    id: string,
    scoreA: number,
    scoreB: number,
    tiebreakA?: number,
    tiebreakB?: number,
  ) => void;
  onSaveSets?: (id: string, sets: SetScore[]) => void;
  onSetRetirement?: (id: string, side: RetiredSide | null) => void;
  onClear: (id: string) => void;
}) {
  const S = useStrings();
  const waitingDisabled = disabled;
  const readOnly = isRetired({ retiredSide });

  return (
    <div className="score-form-wrap">
      {waitingDisabled ? (
        <p className="hint knockout-waiting" title={disabledHint}>
          {disabledHint ?? S.knockoutLocked}
        </p>
      ) : (
        <div className="score-form-stack">
          <ScoreMatchupBar labelA={labelA} labelB={labelB} />
          {bestOf > 1 && onSaveSets ? (
            <SetSeriesScoreForm
              matchId={matchId}
              labelA={labelA}
              labelB={labelB}
              textLabelA={textLabelA}
              textLabelB={textLabelB}
              sets={sets}
              scoreA={scoreA}
              scoreB={scoreB}
              bestOf={bestOf as 3 | 5}
              onSaveSets={onSaveSets}
              onClear={onClear}
              readOnly={readOnly}
              clearTitle={S.clearScoreTitle}
              clearLabel={S.clearScore}
            />
          ) : (
            <Bo1ScoreForm
              matchId={matchId}
              textLabelA={textLabelA}
              textLabelB={textLabelB}
              scoreA={scoreA}
              scoreB={scoreB}
              tiebreakA={tiebreakA}
              tiebreakB={tiebreakB}
              onSave={onSave}
              onClear={onClear}
              readOnly={readOnly}
              clearTitle={S.clearScoreTitle}
              clearLabel={S.clearScore}
            />
          )}
        </div>
      )}
      {onSetRetirement && !waitingDisabled && (
        <MatchRetirementActions
          labelA={labelA}
          labelB={labelB}
          textLabelA={textLabelA}
          textLabelB={textLabelB}
          retiredSide={retiredSide}
          onRetire={(side) => onSetRetirement(matchId, side)}
          onClearRetirement={() => onSetRetirement(matchId, null)}
        />
      )}
    </div>
  );
}

function Bo1ScoreForm({
  matchId,
  textLabelA,
  textLabelB,
  scoreA,
  scoreB,
  tiebreakA,
  tiebreakB,
  onSave,
  onClear,
  readOnly,
  clearLabel,
  clearTitle,
}: {
  matchId: string;
  textLabelA: string;
  textLabelB: string;
  scoreA: number | null;
  scoreB: number | null;
  tiebreakA: number;
  tiebreakB: number;
  onSave: (
    id: string,
    scoreA: number,
    scoreB: number,
    tiebreakA?: number,
    tiebreakB?: number,
  ) => void;
  onClear: (id: string) => void;
  readOnly?: boolean;
  clearLabel: string;
  clearTitle: string;
}) {
  const S = useStrings();
  const [gamesA, setGamesA] = useState(0);
  const [gamesB, setGamesB] = useState(0);
  const [tbA, setTbA] = useState(0);
  const [tbB, setTbB] = useState(0);

  useEffect(() => {
    setGamesA(scoreA ?? 0);
    setGamesB(scoreB ?? 0);
    setTbA(tiebreakA);
    setTbB(tiebreakB);
  }, [matchId, scoreA, scoreB, tiebreakA, tiebreakB]);

  const sideA = textLabelA || 'A';
  const sideB = textLabelB || 'B';

  const persist = (a: number, b: number, ta: number, tb: number) => {
    if (readOnly) return;

    if (a === 0 && b === 0 && ta === 0 && tb === 0) {
      if (scoreA !== null || scoreB !== null) onClear(matchId);
      return;
    }
    if (a === b) return;

    if (
      scoreA === a &&
      scoreB === b &&
      tiebreakA === ta &&
      tiebreakB === tb
    ) {
      return;
    }

    onSave(matchId, a, b, ta, tb);
  };

  const bumpGamesA = () => {
    const next = gamesA + 1;
    setGamesA(next);
    persist(next, gamesB, tbA, tbB);
  };
  const bumpGamesB = () => {
    const next = gamesB + 1;
    setGamesB(next);
    persist(gamesA, next, tbA, tbB);
  };
  const bumpTbA = () => {
    const next = tbA + 1;
    setTbA(next);
    persist(gamesA, gamesB, next, tbB);
  };
  const bumpTbB = () => {
    const next = tbB + 1;
    setTbB(next);
    persist(gamesA, gamesB, tbA, next);
  };

  return (
    <div
      className={`score-form-score-block score-form-compact${readOnly ? ' score-form-readonly' : ''}`}
    >
      <div className="score-inputs-row">
        <ScoreStepper
          value={gamesA}
          onAdd={bumpGamesA}
          disabled={readOnly}
          size="big"
          addLabel={S.scorePlusOneGames(sideA)}
        />
        <ScoreStepper
          value={tbA}
          onAdd={bumpTbA}
          disabled={readOnly}
          size="small"
          addLabel={S.scorePlusOneTiebreak(sideA)}
        />
        <span className="score-colon score-cell-sep" aria-hidden>
          :
        </span>
        <ScoreStepper
          value={gamesB}
          onAdd={bumpGamesB}
          disabled={readOnly}
          size="big"
          addLabel={S.scorePlusOneGames(sideB)}
        />
        <ScoreStepper
          value={tbB}
          onAdd={bumpTbB}
          disabled={readOnly}
          size="small"
          addLabel={S.scorePlusOneTiebreak(sideB)}
        />
      </div>
      {!readOnly && (
        <ScoreRefreshButton
          onClick={() => onClear(matchId)}
          title={clearTitle}
          ariaLabel={clearLabel}
          disabled={scoreA === null && scoreB === null}
        />
      )}
    </div>
  );
}
