import { useMemo } from 'react';
import type { GroupAssignment, Match, MatchMode, Player, ScheduleFormat, Team, Tournament } from '../types';
import { groupMatchesBySection, matchPairKey } from '../utils/schedule';
import { formatSideCompactLabel } from '../utils/player';
import { renderMatchSides } from './PlayerLabel';
import { knockoutMatchLabel, resolveMatchSides } from '../utils/knockout';
import {
  formatMatchScore,
  formatMatchScoreForRow,
  isMatchPlayed,
} from '../utils/score';
import { S } from '../strings';

interface ScheduleOverviewProps {
  mode: MatchMode;
  scheduleFormat: ScheduleFormat;
  players: Player[];
  teams: Team[];
  groups: GroupAssignment[];
  matches: Match[];
  onGoScore?: () => void;
}

interface MatrixEntity {
  id: string;
  label: string;
}

function buildMatrixEntities(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
): MatrixEntity[] {
  if (mode === 'singles') {
    return players.map((p) => ({ id: p.id, label: p.name }));
  }
  return teams.map((t) => {
    const members = t.playerIds
      .map((pid) => players.find((p) => p.id === pid))
      .filter((p): p is Player => !!p);
    const label =
      members.length === 2
        ? `${members[0].name} / ${members[1].name}`
        : members.map((p) => p.name).join(' / ');
    return { id: t.playerIds.slice().sort().join(','), label };
  });
}

function sectionTitle(key: string): string {
  if (key === 'knockout') return S.sectionKnockout;
  if (key === 'all') return S.sectionAllMatches;
  return S.groupLabel(Number(key.slice(1)));
}

export function ScheduleOverview({
  mode,
  scheduleFormat,
  players,
  teams,
  groups,
  matches,
  onGoScore,
}: ScheduleOverviewProps) {
  const isGroupStage = scheduleFormat === 'group_stage';
  const isKnockoutOnly = scheduleFormat === 'knockout';

  const bySection = useMemo(() => {
    const grouped = groupMatchesBySection(matches, scheduleFormat);
    const entries = [...grouped.entries()];
    if (isKnockoutOnly) return entries.filter(([k]) => k === 'knockout');
    if (!isGroupStage) return entries.filter(([k]) => k === 'all');
    return entries.sort((a, b) => {
      if (a[0] === 'knockout') return 1;
      if (b[0] === 'knockout') return -1;
      const na = a[0] === 'all' ? 0 : Number(a[0].slice(1));
      const nb = b[0] === 'all' ? 0 : Number(b[0].slice(1));
      return na - nb;
    });
  }, [matches, isGroupStage, isKnockoutOnly]);

  const matchLookup = useMemo(() => {
    const map = new Map<string, Match>();
    for (const m of matches) {
      map.set(matchPairKey(m.sideAIds, m.sideBIds), m);
    }
    return map;
  }, [matches]);

  const entities = useMemo(
    () => buildMatrixEntities(mode, players, teams),
    [mode, players, teams],
  );

  const doneCount = matches.filter((m) => isMatchPlayed(m)).length;

  return (
    <section className="panel schedule-panel">
      <h2 title={S.fullScheduleTitle}>{S.fullSchedule}</h2>
      <p className="stats-bar">
        <span className="stat-pill">
          {S.scheduleTotal} <strong>{matches.length}</strong>
        </span>
        {isGroupStage && (
          <>
            <span className="stat-pill">
              {S.scheduleGroups} <strong>{groups.length}</strong>
            </span>
            <span className="stat-pill">
              {S.scheduleKnockout}{' '}
              <strong>
                {matches.filter((m) => m.phase === 'knockout').length}
              </strong>
            </span>
          </>
        )}
        <span className="stat-pill">
          {S.scheduleScored} <strong>{doneCount}</strong>
        </span>
      </p>

      {!isGroupStage && !isKnockoutOnly && entities.length >= 2 && entities.length <= 10 && (
        <details className="schedule-matrix-wrap" open={entities.length <= 6}>
          <summary title={S.matrixTitle}>{S.matrix}</summary>
          <p className="hint">{S.matrixHint}</p>
          <div className="matrix-scroll">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th className="matrix-corner" />
                  {entities.map((e) => (
                    <th key={e.id} title={e.label}>
                      <span className="matrix-head">{abbreviate(e.label)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entities.map((row, ri) => (
                  <tr key={row.id}>
                    <th title={row.label}>
                      <span className="matrix-row-head">{abbreviate(row.label)}</span>
                    </th>
                    {entities.map((col, ci) => {
                      if (ri === ci) {
                        return (
                          <td key={col.id} className="matrix-diag">
                            —
                          </td>
                        );
                      }
                      const sideA =
                        mode === 'singles' ? [row.id] : row.id.split(',');
                      const sideB =
                        mode === 'singles' ? [col.id] : col.id.split(',');
                      const m = matchLookup.get(matchPairKey(sideA, sideB));
                      if (!m) {
                        return (
                          <td key={col.id} className="matrix-empty">
                            ·
                          </td>
                        );
                      }
                      const rowSideIds =
                        mode === 'singles' ? [row.id] : row.id.split(',');
                      const score = formatMatchScoreForRow(m, rowSideIds);
                      const done = score !== '';
                      return (
                        <td
                          key={col.id}
                          className={done ? 'matrix-done' : 'matrix-pending'}
                          title={S.matrixCellTitle(
                            row.label,
                            col.label,
                            m.order,
                            score,
                          )}
                        >
                          {done ? (
                            <span className="matrix-score">{score}</span>
                          ) : (
                            <span className="matrix-round">
                              {S.matrixPendingOrder(m.order)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="schedule-rounds">
        {bySection.map(([key, sectionMatches]) => (
          <section key={key} className="schedule-round-block">
            {(isGroupStage || isKnockoutOnly) && (
              <header className="schedule-round-header">
                <span className="schedule-round-badge">{sectionTitle(key)}</span>
                <span className="schedule-round-count">
                  {sectionMatches.length} {S.scheduleMatchesUnit}
                </span>
              </header>
            )}
            <ol className="schedule-match-list">
              {sectionMatches.map((m) => {
                const ctx: Pick<
                  Tournament,
                  'matches' | 'mode' | 'players' | 'teams' | 'groups' | 'scheduleFormat'
                > = { matches, mode, players, teams, groups, scheduleFormat };
                const resolved = resolveMatchSides(m, ctx, formatSideCompactLabel);
                const sideA =
                  resolved.ready && m.sideAIds.length > 0
                    ? renderMatchSides(m.sideAIds, players, mode, teams)
                    : m.phase === 'knockout'
                      ? resolved.labelA
                      : renderMatchSides(m.sideAIds, players, mode, teams);
                const sideB =
                  resolved.ready && m.sideBIds.length > 0
                    ? renderMatchSides(m.sideBIds, players, mode, teams)
                    : m.phase === 'knockout'
                      ? resolved.labelB
                      : renderMatchSides(m.sideBIds, players, mode, teams);
                const score = m.isBye ? S.knockoutByeShort : formatMatchScore(m);
                const done = m.isBye || score !== '';
                const stageLabel =
                  m.knockoutStage != null ? knockoutMatchLabel(m) : null;
                return (
                  <li
                    key={m.id}
                    className={`schedule-match-row${done ? ' done' : ''}`}
                  >
                    <span className="schedule-match-no" title={S.matchNoTitle(m.order)}>
                      {stageLabel ?? m.order}
                    </span>
                    <span className="schedule-match-sides">
                      <span className="schedule-side-a">{sideA}</span>
                      <span className="schedule-vs">VS</span>
                      <span className="schedule-side-b">{sideB}</span>
                    </span>
                    <span
                      className={`schedule-match-status${done ? ' scored' : ''}`}
                    >
                      {done ? score : S.matchPendingShort}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      {onGoScore && (
        <p className="btn-row">
          <button
            type="button"
            className="btn-primary btn-block"
            onClick={onGoScore}
            title={S.goScoreTitle}
          >
            {S.goScore}
          </button>
        </p>
      )}
    </section>
  );
}

function abbreviate(label: string, max = 6): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}
