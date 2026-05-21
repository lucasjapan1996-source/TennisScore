import { useEffect, useState, type ReactNode } from 'react';
import { MatchRetirementActions } from './MatchRetirementActions';
import { ScoreMatchupBar } from './ScoreMatchupBar';
import { SetSeriesScoreForm } from './SetSeriesScoreForm';
import { useStrings } from '../hooks/useStrings';
import type { BestOf, SetScore } from '../types';
import type { RetiredSide } from '../utils/matchOutcome';
import { isRetired } from '../utils/matchOutcome';
import { parseSmallScore } from '../utils/score';

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
      <ScoreMatchupBar labelA={labelA} labelB={labelB} />
      {waitingDisabled ? (
        <p className="hint knockout-waiting" title={disabledHint}>
          {disabledHint ?? S.knockoutLocked}
        </p>
      ) : bestOf > 1 && onSaveSets ? (
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
          clearLabel={S.clearScore}
          clearTitle={S.clearScoreTitle}
        />
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
  const [bigA, setBigA] = useState('');
  const [smallA, setSmallA] = useState('');
  const [bigB, setBigB] = useState('');
  const [smallB, setSmallB] = useState('');

  useEffect(() => {
    setBigA(scoreA !== null ? String(scoreA) : '');
    setBigB(scoreB !== null ? String(scoreB) : '');
    setSmallA(tiebreakA > 0 ? String(tiebreakA) : '');
    setSmallB(tiebreakB > 0 ? String(tiebreakB) : '');
  }, [matchId, scoreA, scoreB, tiebreakA, tiebreakB]);

  const persist = (a: string, sa: string, b: string, sb: string) => {
    if (readOnly) return;

    const trimmedA = a.trim();
    const trimmedB = b.trim();

    if (trimmedA === '' && trimmedB === '') {
      if (scoreA !== null || scoreB !== null) onClear(matchId);
      return;
    }

    if (trimmedA === '' || trimmedB === '') return;

    const na = parseInt(trimmedA, 10);
    const nb = parseInt(trimmedB, 10);
    if (Number.isNaN(na) || Number.isNaN(nb) || na < 0 || nb < 0 || na === nb) return;

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
      className={`score-form-compact${readOnly ? ' score-form-readonly' : ''}`}
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
          placeholder="·"
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
          placeholder="·"
          aria-label={`${labelB} tiebreak`}
        />
      </div>
      {!readOnly && scoreA !== null && (
        <button
          type="button"
          className="btn-clear-score score-clear-centered"
          onClick={() => onClear(matchId)}
          title={clearTitle}
          aria-label={clearLabel}
        >
          ×
        </button>
      )}
    </div>
  );
}
