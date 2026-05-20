import { useEffect, useState, type ReactNode } from 'react';
import { parseSmallScore } from '../utils/score';
import { S } from '../strings';

export function ScoreForm({
  matchId,
  labelA,
  labelB,
  scoreA,
  scoreB,
  tiebreakA,
  tiebreakB,
  onSave,
  onClear,
  disabled = false,
  disabledHint,
}: {
  matchId: string;
  labelA: ReactNode;
  labelB: ReactNode;
  disabled?: boolean;
  disabledHint?: string;
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
    const trimmedA = a.trim();
    const trimmedB = b.trim();

    if (trimmedA === '' && trimmedB === '') {
      if (scoreA !== null || scoreB !== null) onClear(matchId);
      return;
    }

    if (trimmedA === '' || trimmedB === '') {
      return;
    }

    const na = parseInt(trimmedA, 10);
    const nb = parseInt(trimmedB, 10);
    if (Number.isNaN(na) || Number.isNaN(nb) || na < 0 || nb < 0) return;
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

  if (disabled) {
    return (
      <p className="hint knockout-waiting" title={disabledHint}>
        {labelA} VS {labelB}
        <br />
        {disabledHint ?? S.knockoutLocked}
      </p>
    );
  }

  return (
    <div className="score-form-compact">
      <span className="score-side-label">
        {labelA}
      </span>
      <span className="score-side-group">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="score-big"
          value={bigA}
          onChange={(e) => {
            const v = e.target.value;
            setBigA(v);
            persist(v, smallA, bigB, smallB);
          }}
          placeholder="0"
          aria-label={`${labelA} big`}
        />
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="score-small"
          value={smallA}
          onChange={(e) => {
            const v = e.target.value;
            setSmallA(v);
            persist(bigA, v, bigB, smallB);
          }}
          placeholder="·"
          aria-label={`${labelA} tiebreak`}
        />
      </span>
      <span className="score-colon" aria-hidden>
        :
      </span>
      <span className="score-side-group">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="score-big"
          value={bigB}
          onChange={(e) => {
            const v = e.target.value;
            setBigB(v);
            persist(bigA, smallA, v, smallB);
          }}
          placeholder="0"
          aria-label={`${labelB} big`}
        />
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="score-small"
          value={smallB}
          onChange={(e) => {
            const v = e.target.value;
            setSmallB(v);
            persist(bigA, smallA, bigB, v);
          }}
          placeholder="·"
          aria-label={`${labelB} tiebreak`}
        />
      </span>
      <span className="score-side-label">
        {labelB}
      </span>
      {scoreA !== null && (
        <button
          type="button"
          className="btn-clear-score"
          onClick={() => onClear(matchId)}
          title={S.clearScoreTitle}
          aria-label={S.clearScore}
        >
          ×
        </button>
      )}
    </div>
  );
}
