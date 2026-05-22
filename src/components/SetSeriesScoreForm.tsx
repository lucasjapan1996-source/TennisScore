import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScoreRefreshButton } from './ScoreRefreshButton';
import { useStrings } from '../hooks/useStrings';
import type { SetScore } from '../types';
import { isCompleteSetScore } from '../utils/sets';
import { parseSmallScore } from '../utils/score';

type DraftSet = {
  gamesA: string;
  gamesB: string;
  tiebreakA: string;
  tiebreakB: string;
};

function emptyDraft(): DraftSet {
  return { gamesA: '', gamesB: '', tiebreakA: '', tiebreakB: '' };
}

function draftFromSet(s: SetScore): DraftSet {
  return {
    gamesA: String(s.gamesA),
    gamesB: String(s.gamesB),
    tiebreakA: s.tiebreakA > 0 ? String(s.tiebreakA) : '',
    tiebreakB: s.tiebreakB > 0 ? String(s.tiebreakB) : '',
  };
}

function draftsFromSets(sets: SetScore[], rowCount: number): DraftSet[] {
  return Array.from({ length: rowCount }, (_, i) =>
    sets[i] ? draftFromSet(sets[i]) : emptyDraft(),
  );
}

function parseCompleteDrafts(drafts: DraftSet[]): SetScore[] {
  const parsed: SetScore[] = [];
  for (const d of drafts) {
    const ga = d.gamesA.trim();
    const gb = d.gamesB.trim();
    if (ga === '' || gb === '') continue;
    const gamesA = parseInt(ga, 10);
    const gamesB = parseInt(gb, 10);
    if (Number.isNaN(gamesA) || Number.isNaN(gamesB)) continue;
    const s: SetScore = {
      gamesA,
      gamesB,
      tiebreakA: parseSmallScore(d.tiebreakA),
      tiebreakB: parseSmallScore(d.tiebreakB),
    };
    if (isCompleteSetScore(s)) parsed.push(s);
  }
  return parsed;
}

export function SetSeriesScoreForm({
  matchId,
  labelA,
  labelB,
  sets,
  scoreA = null,
  scoreB = null,
  bestOf,
  onSaveSets,
  onClear,
  readOnly = false,
  clearTitle,
  clearLabel,
}: {
  matchId: string;
  labelA: ReactNode;
  labelB: ReactNode;
  sets: SetScore[];
  scoreA?: number | null;
  scoreB?: number | null;
  bestOf: 3 | 5;
  onSaveSets: (id: string, sets: SetScore[]) => void;
  onClear: (id: string) => void;
  readOnly?: boolean;
  clearTitle: string;
  clearLabel: string;
}) {
  const S = useStrings();
  const completed = useMemo(() => sets.filter(isCompleteSetScore), [sets]);
  const showMatchResultOnly =
    readOnly &&
    completed.length === 0 &&
    scoreA !== null &&
    scoreB !== null;

  const [drafts, setDrafts] = useState<DraftSet[]>(() =>
    draftsFromSets(sets, bestOf),
  );

  useEffect(() => {
    setDrafts(draftsFromSets(sets, bestOf));
  }, [matchId, bestOf, sets]);

  const syncToStore = (nextDrafts: DraftSet[]) => {
    if (readOnly) return;
    onSaveSets(matchId, parseCompleteDrafts(nextDrafts));
  };

  const updateRow = (index: number, patch: Partial<DraftSet>) => {
    if (readOnly) return;
    const next = drafts.map((d, i) => (i === index ? { ...d, ...patch } : d));
    setDrafts(next);
    syncToStore(next);
  };

  if (showMatchResultOnly) {
    return (
      <div className="score-form-score-block set-series-form score-form-readonly">
        <div className="set-series-match-result" aria-label="match result">
          <span className="set-series-match-score">{scoreA}</span>
          <span className="score-colon set-cell-sep" aria-hidden>
            :
          </span>
          <span className="set-series-match-score">{scoreB}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`score-form-score-block set-series-form${readOnly ? ' score-form-readonly' : ''}`}
    >
      <div className="set-series-rows">
      {Array.from({ length: bestOf }, (_, index) => {
        const draft = drafts[index] ?? emptyDraft();
        return (
          <div key={`${matchId}-set-${index}`} className="set-row">
            <span className="set-row-label">{S.setN(index + 1)}</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="score-big set-cell-a-big"
              value={draft.gamesA}
              disabled={readOnly}
              readOnly={readOnly}
              onChange={(e) => updateRow(index, { gamesA: e.target.value })}
              placeholder="0"
              aria-label={`${S.setN(index + 1)} ${labelA}`}
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="score-small set-cell-a-small"
              value={draft.tiebreakA}
              disabled={readOnly}
              readOnly={readOnly}
              onChange={(e) => updateRow(index, { tiebreakA: e.target.value })}
              placeholder="0"
              aria-label={`${S.setN(index + 1)} ${labelA} tiebreak`}
            />
            <span className="score-colon set-cell-sep" aria-hidden>
              -
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="score-big set-cell-b-big"
              value={draft.gamesB}
              disabled={readOnly}
              readOnly={readOnly}
              onChange={(e) => updateRow(index, { gamesB: e.target.value })}
              placeholder="0"
              aria-label={`${S.setN(index + 1)} ${labelB}`}
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="score-small set-cell-b-small"
              value={draft.tiebreakB}
              disabled={readOnly}
              readOnly={readOnly}
              onChange={(e) => updateRow(index, { tiebreakB: e.target.value })}
              placeholder="0"
              aria-label={`${S.setN(index + 1)} ${labelB} tiebreak`}
            />
          </div>
        );
      })}
      </div>
      {!readOnly && (completed.length > 0 || sets.length > 0) && (
        <ScoreRefreshButton
          onClick={() => onClear(matchId)}
          title={clearTitle}
          ariaLabel={clearLabel}
        />
      )}
    </div>
  );
}
