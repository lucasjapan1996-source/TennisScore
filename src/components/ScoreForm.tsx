import { useEffect, useState, type ReactNode } from 'react';
import { MatchRetirementActions } from './MatchRetirementActions';
import { ScoreMatchupBar } from './ScoreMatchupBar';
import { ScoreRefreshButton } from './ScoreRefreshButton';
import { SetSeriesScoreForm } from './SetSeriesScoreForm';
import { useStrings } from '../hooks/useStrings';
import type { BestOf, SetScore } from '../types';
import type { RetiredSide } from '../utils/matchOutcome';
import { isRetired } from '../utils/matchOutcome';
import { parseBigScorePair, parseSmallScore } from '../utils/score';

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
              labelA={labelA}
              labelB={labelB}
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
  labelA,
  labelB,
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
  labelA: ReactNode;
  labelB: ReactNode;
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
  const [bigA, setBigA] = useState('0');
  const [smallA, setSmallA] = useState('');
  const [bigB, setBigB] = useState('0');
  const [smallB, setSmallB] = useState('');

  useEffect(() => {
    setBigA(scoreA !== null ? String(scoreA) : '0');
    setBigB(scoreB !== null ? String(scoreB) : '0');
    setSmallA(String(tiebreakA));
    setSmallB(String(tiebreakB));
  }, [matchId, scoreA, scoreB, tiebreakA, tiebreakB]);

  const persist = (a: string, sa: string, b: string, sb: string) => {
    if (readOnly) return;

    const parsed = parseBigScorePair(a, b);
    if (parsed === 'clear') {
      if (scoreA !== null || scoreB !== null) onClear(matchId);
      return;
    }
    if (!parsed) return;

    const { scoreA: na, scoreB: nb } = parsed;
    if (na === nb) return;

    const ta = parseSmallScore(sa);
    const tb = parseSmallScore(sb);

    if (
      scoreA === na &&
      scoreB === nb &&
      tiebreakA === ta &&
      tiebreakB === tb
    ) {
      return;
    }

    onSave(matchId, na, nb, ta, tb);
  };

  return (
    <div
      className={`score-form-score-block score-form-compact${readOnly ? ' score-form-readonly' : ''}`}
    >
      <div className="score-inputs-row">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="score-big score-cell-a-big"
          value={bigA}
          disabled={readOnly}
          readOnly={readOnly}
          onChange={(e) => {
            const v = e.target.value;
            setBigA(v);
            persist(v, smallA, bigB, smallB);
          }}
          placeholder="0"
          aria-label={`${labelA} big`}
        />
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="score-small score-cell-a-small"
          value={smallA}
          disabled={readOnly}
          readOnly={readOnly}
          onChange={(e) => {
            const v = e.target.value;
            setSmallA(v);
            persist(bigA, v, bigB, smallB);
          }}
          placeholder="0"
          aria-label={`${labelA} tiebreak`}
        />
        <span className="score-colon score-cell-sep" aria-hidden>
          :
        </span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="score-big score-cell-b-big"
          value={bigB}
          disabled={readOnly}
          readOnly={readOnly}
          onChange={(e) => {
            const v = e.target.value;
            setBigB(v);
            persist(bigA, smallA, v, smallB);
          }}
          placeholder="0"
          aria-label={`${labelB} big`}
        />
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="score-small score-cell-b-small"
          value={smallB}
          disabled={readOnly}
          readOnly={readOnly}
          onChange={(e) => {
            const v = e.target.value;
            setSmallB(v);
            persist(bigA, smallA, bigB, v);
          }}
          placeholder="0"
          aria-label={`${labelB} tiebreak`}
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
