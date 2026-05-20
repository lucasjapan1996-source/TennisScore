import { useMemo, useState } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { formatSideCompactLabel } from '../utils/player';
import { renderSideCompactLabel } from './PlayerSideLabel';
import { knockoutMatchLabel, resolveMatchSides } from '../utils/knockout';
import { groupMatchesBySection, withoutThirdPlaceMatches } from '../utils/schedule';
import { ScoreForm } from './ScoreForm';
import { isMatchPlayed } from '../utils/score';
import { S } from '../strings';

type StatusFilter = 'all' | 'pending' | 'done';
type PhaseFilter = 'all' | number | 'knockout';

export function MatchPanel() {
  const { tournament, updateMatchScore, clearMatchScore, setActiveTab } =
    useTournamentStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');

  const isGroupStage = tournament.scheduleFormat === 'group_stage';
  const isKnockoutOnly = tournament.scheduleFormat === 'knockout';

  const activeMatches = useMemo(
    () => withoutThirdPlaceMatches(tournament.matches, tournament.scheduleFormat),
    [tournament.matches, tournament.scheduleFormat],
  );

  const bySection = useMemo(() => {
    const grouped = groupMatchesBySection(
      activeMatches,
      tournament.scheduleFormat,
    );
    const entries = [...grouped.entries()];
    if (isKnockoutOnly) {
      return entries.filter(([k]) => k === 'knockout');
    }
    if (!isGroupStage) {
      return entries.filter(([k]) => k === 'all');
    }
    return entries.sort((a, b) => {
      if (a[0] === 'knockout') return 1;
      if (b[0] === 'knockout') return -1;
      return Number(a[0].slice(1)) - Number(b[0].slice(1));
    });
  }, [activeMatches, isGroupStage, isKnockoutOnly, tournament.scheduleFormat]);

  const groupIds = useMemo(
    () => tournament.groups.map((g) => g.id),
    [tournament.groups],
  );

  const filteredSections = useMemo(() => {
    if (!isGroupStage || phaseFilter === 'all') return bySection;
    if (phaseFilter === 'knockout') {
      return bySection.filter(([k]) => k === 'knockout');
    }
    return bySection.filter(([k]) => k === `g${phaseFilter}`);
  }, [bySection, phaseFilter, isGroupStage]);

  const filterMatch = (m: (typeof activeMatches)[0]) => {
    const done = isMatchPlayed(m);
    if (statusFilter === 'pending') return !done;
    if (statusFilter === 'done') return done;
    return true;
  };

  const doneCount = activeMatches.filter((m) => isMatchPlayed(m)).length;

  const knockoutCount = activeMatches.filter((m) => m.phase === 'knockout').length;
  const knockoutDone = activeMatches.filter(
    (m) => m.phase === 'knockout' && isMatchPlayed(m),
  ).length;

  if (activeMatches.length === 0) {
    return (
      <section className="panel">
        <p className="empty-state" title={S.noMatchesTitle}>
          <span aria-hidden>??</span>
          <br />
          {S.noMatches}
          <br />
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={() => setActiveTab('setup')}
            title={S.goScheduleTitle}
          >
            {S.goSchedule}
          </button>
        </p>
      </section>
    );
  }

  const sectionTitle = (key: string) => {
    if (key === 'knockout') return S.sectionKnockout;
    if (key === 'all') return S.sectionAllMatches;
    return S.groupLabel(Number(key.slice(1)));
  };

  return (
    <>
      <section className="panel">
        <h2 title={S.scoreEntryTitle}>{S.scoreEntry}</h2>
        <p className="hint score-rules-hint" title={S.scoreHintTitle}>
          {S.scoreHint}
        </p>
        {(isGroupStage || isKnockoutOnly) && (
          <p className="hint">
            {isKnockoutOnly ? S.knockoutOnlyHint : S.knockoutBracketHint}
          </p>
        )}
        <p className="stats-bar">
          <span className="stat-pill" title={S.doneStatTitle}>
            {S.doneStat} <strong>{doneCount}</strong> / {activeMatches.length}
          </span>
        </p>

        {isGroupStage && groupIds.length > 0 && (
          <>
            <p className="filter-label">{S.filterByGroup}</p>
            <p className="btn-row round-filter-row">
              <button
                type="button"
                className="btn-secondary"
                style={phaseFilter === 'all' ? activeStyle : undefined}
                onClick={() => setPhaseFilter('all')}
              >
                {S.filterAllGroups}
              </button>
              {groupIds.map((gid) => {
                const ms = activeMatches.filter(
                  (m) => m.phase === 'group' && m.group === gid,
                );
                const gDone = ms.filter((m) => isMatchPlayed(m)).length;
                return (
                  <button
                    key={gid}
                    type="button"
                    className="btn-secondary"
                    style={phaseFilter === gid ? activeStyle : undefined}
                    onClick={() => setPhaseFilter(gid)}
                    title={S.filterGroupTitle(gid, gDone, ms.length)}
                  >
                    {S.groupLabel(gid)} ({gDone}/{ms.length})
                  </button>
                );
              })}
              {knockoutCount > 0 && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={phaseFilter === 'knockout' ? activeStyle : undefined}
                  onClick={() => setPhaseFilter('knockout')}
                  title={S.filterKnockoutTitle}
                >
                  {S.sectionKnockout} ({knockoutDone}/{knockoutCount})
                </button>
              )}
            </p>
          </>
        )}

        <p className="filter-label">{S.filterByStatus}</p>
        <p className="btn-row">
          {(
            [
              { id: 'all' as const, label: S.filterAll },
              { id: 'pending' as const, label: S.filterPending },
              { id: 'done' as const, label: S.filterDone },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              className="btn-secondary"
              style={statusFilter === f.id ? activeStyle : undefined}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </p>
      </section>

      {filteredSections.every(([, ms]) => ms.filter(filterMatch).length === 0) ? (
        <section className="panel">
          <p className="empty-state">{S.noMatchesInFilter}</p>
        </section>
      ) : (
        filteredSections.map(([key, sectionMatches]) => {
          const shown = sectionMatches.filter(filterMatch);
          if (shown.length === 0) return null;

          const sectionDone = sectionMatches.filter((m) => isMatchPlayed(m)).length;

          return (
            <section key={key} className="panel match-round-panel">
              {(isGroupStage || isKnockoutOnly) && (
                <header className="schedule-round-header">
                  <span className="schedule-round-badge">{sectionTitle(key)}</span>
                  <span className="schedule-round-count">
                    {S.sectionProgress(sectionDone, sectionMatches.length)}
                  </span>
                </header>
              )}

              {shown.map((m) => {
                const resolved = resolveMatchSides(
                  m,
                  tournament,
                  formatSideCompactLabel,
                );
                const labelA =
                  resolved.ready && m.sideAIds.length > 0
                    ? renderSideCompactLabel(m.sideAIds, tournament.players)
                    : resolved.labelA;
                const labelB =
                  resolved.ready && m.sideBIds.length > 0
                    ? renderSideCompactLabel(m.sideBIds, tournament.players)
                    : resolved.labelB;

                if (m.isBye) {
                  return (
                    <article
                      key={m.id}
                      className="match-card match-card-compact done bye-card"
                    >
                      <span className="match-order-badge knockout-stage-badge">
                        {knockoutMatchLabel(m)}
                      </span>
                      <p className="hint knockout-waiting bye-card-text">
                        <span className="bye-winner">{labelA}</span>
                        <span className="bye-status">{S.knockoutByeShort}</span>
                      </p>
                    </article>
                  );
                }

                return (
                  <article
                    key={m.id}
                    className={`match-card match-card-compact${isMatchPlayed(m) ? ' done' : ''}`}
                  >
                    {!isGroupStage && !isKnockoutOnly && (
                      <span className="match-order-badge">#{m.order}</span>
                    )}
                    {m.phase === 'knockout' && m.knockoutStage && (
                      <span className="match-order-badge knockout-stage-badge">
                        {knockoutMatchLabel(m)}
                      </span>
                    )}
                    <ScoreForm
                      key={m.id}
                      matchId={m.id}
                      labelA={labelA}
                      labelB={labelB}
                      scoreA={m.scoreA}
                      scoreB={m.scoreB}
                      tiebreakA={m.tiebreakA}
                      tiebreakB={m.tiebreakB}
                      onSave={updateMatchScore}
                      onClear={clearMatchScore}
                      disabled={!resolved.ready}
                      disabledHint={resolved.waitingReason ?? undefined}
                    />
                  </article>
                );
              })}
            </section>
          );
        })
      )}
    </>
  );
}

const activeStyle = {
  borderColor: 'var(--accent)',
  color: 'var(--text)',
} as const;
