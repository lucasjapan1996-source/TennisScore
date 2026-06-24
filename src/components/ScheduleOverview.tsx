import { useMemo } from 'react';
import { CollapsiblePanel } from './CollapsiblePanel';
import type {
  BestOf,
  BestOfMode,
  DoublesPairing,
  GroupAssignment,
  Match,
  MatchMode,
  Player,
  ScheduleFormat,
  Team,
  TournamentCategory,
} from '../types';
import type { ResolveSidesTournament } from '../utils/knockout';
import {
  groupMatchesBySection,
  groupMatchesIntoCourtWaves,
  isMatchScheduleMarkedDone,
  matchPairKey,
  splitMatchesByBatches,
} from '../utils/schedule';
import {
  formatScheduleMatchLine,
  formatScheduleMatchLineByName,
  formatScheduleSideNameLabel,
} from '../utils/player';
import {
  formatKnockoutByeLine,
  knockoutMatchLabel,
  resolveKnockoutSideIds,
  resolveMatchSides,
  slotLabel,
} from '../utils/knockout';
import { formatMatchScoreForRow } from '../utils/score';
import { getActiveStrings } from '../i18n';
import { useStrings } from '../hooks/useStrings';
import { ScheduleMatchStatusSwitch } from './ScheduleMatchStatusSwitch';

interface ScheduleOverviewProps {
  mode: MatchMode;
  doublesPairing: DoublesPairing;
  scheduleFormat: ScheduleFormat;
  category: TournamentCategory;
  bestOfMode: BestOfMode;
  bestOf: BestOf;
  customBestOfDefault: BestOf;
  customBestOfFinal: BestOf;
  players: Player[];
  teams: Team[];
  groups: GroupAssignment[];
  matches: Match[];
  scheduleBatchSizes?: number[];
  courtCount?: number;
  onAppendSchedule?: () => void;
  onGoScore?: () => void;
  onToggleMatchStatus?: (matchId: string, played: boolean) => void;
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
  const S = getActiveStrings();
  if (key === 'knockout') return S.sectionKnockout;
  if (key === 'all') return S.sectionAllMatches;
  return S.groupLabel(Number(key.slice(1)));
}

export function ScheduleOverview({
  mode,
  doublesPairing,
  scheduleFormat,
  category,
  bestOfMode,
  bestOf,
  customBestOfDefault,
  customBestOfFinal,
  players,
  teams,
  groups,
  matches,
  scheduleBatchSizes = [],
  courtCount = 1,
  onAppendSchedule,
  onGoScore,
  onToggleMatchStatus,
}: ScheduleOverviewProps) {
  const resolveCtx: ResolveSidesTournament = {
    matches,
    mode,
    doublesPairing,
    players,
    teams,
    groups,
    scheduleFormat,
    category,
    bestOfMode,
    bestOf,
    customBestOfDefault,
    customBestOfFinal,
  };
  const S = useStrings();
  const isGroupStage = scheduleFormat === 'group_stage';
  const isKnockoutOnly = scheduleFormat === 'knockout';
  const nameLabel = (sideIds: string[], pls: Player[]) =>
    formatScheduleSideNameLabel(sideIds, pls, mode, teams);

  const buildMatchupLine = (m: Match) => {
    if (m.isBye) {
      const resolved = resolveMatchSides(m, resolveCtx, nameLabel);
      return formatKnockoutByeLine(resolved.labelA);
    }
    if (
      isGroupStage &&
      m.phase === 'knockout' &&
      m.slotA?.kind === 'group_rank' &&
      m.slotB?.kind === 'group_rank'
    ) {
      return `${slotLabel(m.slotA)} vs ${slotLabel(m.slotB)}`;
    }
    const sideAIds =
      m.sideAIds.length > 0
        ? m.sideAIds
        : (resolveKnockoutSideIds(m, 'A', resolveCtx) ?? []);
    const sideBIds =
      m.sideBIds.length > 0
        ? m.sideBIds
        : (resolveKnockoutSideIds(m, 'B', resolveCtx) ?? []);
    if (sideAIds.length > 0 && sideBIds.length > 0) {
      return isGroupStage
        ? formatScheduleMatchLineByName(sideAIds, sideBIds, players, mode, teams)
        : formatScheduleMatchLine(sideAIds, sideBIds, players, mode);
    }
    const resolved = resolveMatchSides(m, resolveCtx, nameLabel);
    return `${resolved.labelA} vs ${resolved.labelB}`;
  };

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

  const entities = useMemo(
    () => buildMatrixEntities(mode, players, teams),
    [mode, players, teams],
  );

  const showMatrix =
    !isGroupStage &&
    !isKnockoutOnly &&
    entities.length >= 2 &&
    entities.length <= 10;

  const matrixBatches = useMemo(() => {
    if (!showMatrix) return [];
    const rrMatches = matches.filter(
      (m) => m.phase !== 'knockout' && m.group === null,
    );
    return splitMatchesByBatches(rrMatches, scheduleBatchSizes);
  }, [showMatrix, matches, scheduleBatchSizes]);

  const doneCount = matches.filter(
    (m) => !m.isBye && isMatchScheduleMarkedDone(m),
  ).length;

  const renderMatchRow = (m: Match) => {
    const resolved = resolveMatchSides(m, resolveCtx, nameLabel);
    const matchupLine = buildMatchupLine(m);
    const markedDone = isMatchScheduleMarkedDone(m);
    const canToggle =
      !m.isBye &&
      !!onToggleMatchStatus &&
      resolved.ready &&
      resolved.sideAIds.length > 0 &&
      resolved.sideBIds.length > 0;
    const stageLabel =
      m.knockoutStage != null ? knockoutMatchLabel(m) : null;
    return (
      <li
        key={m.id}
        className={`schedule-match-row${m.isBye ? ' schedule-match-row--bye' : ''}${markedDone ? ' done' : ''}`}
      >
        <span
          className={
            stageLabel ? 'schedule-match-stage' : 'schedule-match-no'
          }
          title={stageLabel ? stageLabel : S.matchNoTitle(m.order)}
        >
          {stageLabel ?? m.order}
        </span>
        <span
          className={`schedule-match-line${m.isBye ? ' schedule-match-line--bye' : ''}`}
          title={matchupLine}
        >
          {matchupLine}
        </span>
        {!m.isBye && (
          <ScheduleMatchStatusSwitch
            played={markedDone}
            disabled={!canToggle}
            disabledHint={resolved.waitingReason ?? undefined}
            onChange={(next) => onToggleMatchStatus?.(m.id, next)}
          />
        )}
      </li>
    );
  };

  return (
    <CollapsiblePanel
      title={S.fullSchedule}
      titleTitle={S.fullScheduleTitle}
      className="schedule-panel"
      defaultOpen
    >
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

      {showMatrix && matrixBatches.length > 0 && (
        <details
          className="schedule-matrix-wrap"
          open={entities.length <= 6}
        >
          <summary title={S.matrixTitle}>{S.matrix}</summary>
          <div className="schedule-matrix-inner">
            {matrixBatches.map((batchMatches, batchIndex) => (
              <div
                key={batchIndex}
                className="schedule-matrix-batch"
                data-batch={batchIndex + 1}
              >
                {matrixBatches.length > 1 && (
                  <p className="schedule-matrix-batch-label">
                    {S.matrixBatchTitle(batchIndex + 1)}
                  </p>
                )}
                <ScheduleMatrixTable
                  batchMatches={batchMatches}
                  entities={entities}
                  mode={mode}
                />
              </div>
            ))}
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
            {courtCount > 1 ? (
              groupMatchesIntoCourtWaves(sectionMatches, courtCount).map(
                (waveMatches, waveIndex) => (
                  <div
                    key={waveIndex}
                    className="schedule-court-wave"
                    data-wave={waveIndex + 1}
                  >
                    <header className="schedule-court-wave-header">
                      <span className="schedule-court-wave-badge">
                        {S.courtWaveTitle(waveIndex + 1, waveMatches.length)}
                      </span>
                    </header>
                    <ol className="schedule-match-list">
                      {waveMatches.map((m) => renderMatchRow(m))}
                    </ol>
                  </div>
                ),
              )
            ) : (
              <ol className="schedule-match-list">
                {sectionMatches.map((m) => renderMatchRow(m))}
              </ol>
            )}
          </section>
        ))}
      </div>

      {(onAppendSchedule || onGoScore) && (
        <p className="btn-row btn-row-schedule-actions">
          {onAppendSchedule && (
            <button
              type="button"
              className="btn-secondary btn-schedule-action"
              onClick={onAppendSchedule}
              title={S.appendScheduleTitle}
            >
              {S.appendSchedule}
            </button>
          )}
          {onGoScore && (
            <button
              type="button"
              className="btn-primary btn-schedule-action"
              onClick={onGoScore}
              title={S.goScoreTitle}
            >
              {S.goScore}
            </button>
          )}
        </p>
      )}
    </CollapsiblePanel>
  );
}

function abbreviate(label: string, max = 6): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

function ScheduleMatrixTable({
  batchMatches,
  entities,
  mode,
}: {
  batchMatches: Match[];
  entities: MatrixEntity[];
  mode: MatchMode;
}) {
  const S = getActiveStrings();
  const matchLookup = useMemo(() => {
    const map = new Map<string, Match>();
    for (const m of batchMatches) {
      map.set(matchPairKey(m.sideAIds, m.sideBIds), m);
    }
    return map;
  }, [batchMatches]);

  return (
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
            {entities.map((row) => (
              <tr key={row.id}>
                <th title={row.label}>
                  <span className="matrix-row-head">{abbreviate(row.label)}</span>
                </th>
                {entities.map((col) => {
                  if (row.id === col.id) {
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
  );
}
