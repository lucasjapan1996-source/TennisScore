import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScoreRefreshButton } from './ScoreRefreshButton';
import { ScoreStepper } from './ScoreStepper';
import { useStrings } from '../hooks/useStrings';
import type { SetScore } from '../types';
import { isCompleteSetScore } from '../utils/sets';

type DraftSet = {
  gamesA: number;
  gamesB: number;
  tiebreakA: number;
  tiebreakB: number;
};

function emptyDraft(): DraftSet {
  return { gamesA: 0, gamesB: 0, tiebreakA: 0, tiebreakB: 0 };
}

function draftFromSet(s: SetScore): DraftSet {
  return {
    gamesA: s.gamesA,
    gamesB: s.gamesB,
    tiebreakA: s.tiebreakA,
    tiebreakB: s.tiebreakB,
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
    if (d.gamesA === 0 && d.gamesB === 0) continue;
    const s: SetScore = {
      gamesA: d.gamesA,
      gamesB: d.gamesB,
      tiebreakA: d.tiebreakA,
      tiebreakB: d.tiebreakB,
    };
    if (isCompleteSetScore(s)) parsed.push(s);
  }
  return parsed;
}

export function SetSeriesScoreForm({
  matchId,
  labelA: _labelA,
  labelB: _labelB,
  textLabelA = '',
  textLabelB = '',
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
  textLabelA?: string;
  textLabelB?: string;
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

  const sideA = textLabelA || 'A';
  const sideB = textLabelB || 'B';

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

  const bump = (
    index: number,
    field: keyof DraftSet,
  ) => {
    const draft = drafts[index] ?? emptyDraft();
    updateRow(index, { [field]: draft[field] + 1 });
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
          const setLabel = S.setN(index + 1);
          return (
            <div key={`${matchId}-set-${index}`} className="set-row">
              <span className="set-row-label">{setLabel}</span>
              <ScoreStepper
                value={draft.gamesA}
                onAdd={() => bump(index, 'gamesA')}
                disabled={readOnly}
                size="big"
                addLabel={`${setLabel} ${S.scorePlusOneGames(sideA)}`}
              />
              <ScoreStepper
                value={draft.tiebreakA}
                onAdd={() => bump(index, 'tiebreakA')}
                disabled={readOnly}
                size="small"
                addLabel={`${setLabel} ${S.scorePlusOneTiebreak(sideA)}`}
              />
              <span className="score-colon set-cell-sep" aria-hidden>
                -
              </span>
              <ScoreStepper
                value={draft.gamesB}
                onAdd={() => bump(index, 'gamesB')}
                disabled={readOnly}
                size="big"
                addLabel={`${setLabel} ${S.scorePlusOneGames(sideB)}`}
              />
              <ScoreStepper
                value={draft.tiebreakB}
                onAdd={() => bump(index, 'tiebreakB')}
                disabled={readOnly}
                size="small"
                addLabel={`${setLabel} ${S.scorePlusOneTiebreak(sideB)}`}
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
