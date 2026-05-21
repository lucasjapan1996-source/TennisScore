import { useMemo, useState } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { formatSideCompactLabel } from '../utils/player';
import { showPlayerGender } from '../utils/tournamentCategory';
import { renderSideCompactLabel } from './PlayerSideLabel';
import { knockoutMatchLabel, resolveMatchSides } from '../utils/knockout';
import { groupMatchesBySection, withoutThirdPlaceMatches } from '../utils/schedule';
import { ScoreForm } from './ScoreForm';
import { isMatchPlayed } from '../utils/score';
import { useStrings } from '../hooks/useStrings';
import { resolveMatchBestOf } from '../utils/bestOf';
import { CollapsiblePanel } from './CollapsiblePanel';

type StatusFilter = 'all' | 'pending' | 'done';
type PhaseFilter = 'all' | number | 'knockout';

export function MatchPanel() {
  const S = useStrings();
  const {
    tournament,
    updateMatchScore,
    updateMatchSets,
    setMatchRetirement,
    clearMatchScore,
    setActiveTab,
  } = useTournamentStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');

  const isGroupStage = tournament.scheduleFormat === 'group_stage';
  const isKnockoutOnly = tournament.scheduleFormat === 'knockout';
  const genderVisible = showPlayerGender(tournament.category);
  const compactLabel = (sideIds: string[], players: typeof tournament.players) =>
    formatSideCompactLabel(sideIds, players, genderVisible);

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
      <CollapsiblePanel
        title={S.scoreEntry}
        titleTitle={S.scoreEntryTitle}
        compact
      >
        <p className="stats-bar">
          <span className="stat-pill" title={S.doneStatTitle}>
            {S.doneStat} <strong>{doneCount}</strong> / {activeMatches.length}
          </span>
        </p>

        {isGroupStage && groupIds.length > 0 && (
          <div className="filter-row">
            <span className="filter-label-inline">{S.filterByGroup}</span>
            <div className="btn-row round-filter-row">
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
            </div>
          </div>
        )}

        <div className="filter-row filter-row-status">
          <span className="filter-label-inline">{S.filterByStatus}</span>
          <div className="btn-row status-filter-btns">
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
          </div>
        </div>
      </CollapsiblePanel>

      {filteredSections.every(([, ms]) => ms.filter(filterMatch).length === 0) ? (
        <section className="panel">
          <p className="empty-state">{S.noMatchesInFilter}</p>
        </section>
      ) : (
        filteredSections.map(([key, sectionMatches]) => {
          const shown = sectionMatches.filter(filterMatch);
          if (shown.length === 0) return null;

          const sectionDone = sectionMatches.filter((m) => isMatchPlayed(m)).length;

          const roundTitle = `${sectionTitle(key)} · ${S.sectionProgress(
            sectionDone,
            sectionMatches.length,
          )}`;

          return (
            <CollapsiblePanel
              key={key}
              className="match-round-panel"
              title={roundTitle}
              defaultOpen={key === filteredSections[0]?.[0]}
            >
              {shown.map((m) => {
                const resolved = resolveMatchSides(m, tournament, compactLabel);
                const labelA =
                  resolved.ready && m.sideAIds.length > 0
                    ? renderSideCompactLabel(
                        m.sideAIds,
                        tournament.players,
                        genderVisible,
                      )
                    : resolved.labelA;
                const labelB =
                  resolved.ready && m.sideBIds.length > 0
                    ? renderSideCompactLabel(
                        m.sideBIds,
                        tournament.players,
                        genderVisible,
                      )
                    : resolved.labelB;
                const textLabelA =
                  m.sideAIds.length > 0
                    ? compactLabel(m.sideAIds, tournament.players)
                    : String(resolved.labelA);
                const textLabelB =
                  m.sideBIds.length > 0
                    ? compactLabel(m.sideBIds, tournament.players)
                    : String(resolved.labelB);

                if (m.isBye) {
                  return (
                    <article
                      key={m.id}
                      className="match-card match-card-compact done bye-card"
                    >
                      <div className="match-card-meta">
                        <span className="match-order-badge knockout-stage-badge">
                          {knockoutMatchLabel(m)}
                        </span>
                      </div>
                      <p className="hint knockout-waiting bye-card-text">
                        <span className="bye-winner">{labelA}</span>
                        <span className="bye-status">{S.knockoutByeShort}</span>
                      </p>
                    </article>
                  );
                }

                const matchBestOf = resolveMatchBestOf(m, tournament);

                const showMeta =
                  (!isGroupStage && !isKnockoutOnly) ||
                  (m.phase === 'knockout' && !!m.knockoutStage) ||
                  tournament.bestOfMode === 'custom';

                return (
                  <article
                    key={m.id}
                    className={`match-card match-card-compact${isMatchPlayed(m) ? ' done' : ''}`}
                  >
                    {showMeta && (
                      <div className="match-card-meta">
                        {!isGroupStage && !isKnockoutOnly && (
                          <span className="match-order-badge">#{m.order}</span>
                        )}
                        {m.phase === 'knockout' && m.knockoutStage && (
                          <span className="match-order-badge knockout-stage-badge">
                            {knockoutMatchLabel(m)}
                          </span>
                        )}
                        {tournament.bestOfMode === 'custom' && (
                          <span
                            className="match-order-badge match-bo-badge"
                            title={S.scoreBestOfHint(matchBestOf)}
                          >
                            {S.matchBestOfBadge(matchBestOf)}
                          </span>
                        )}
                      </div>
                    )}
                    <ScoreForm
                      key={m.id}
                      matchId={m.id}
                      labelA={labelA}
                      labelB={labelB}
                      textLabelA={textLabelA}
                      textLabelB={textLabelB}
                      scoreA={m.scoreA}
                      scoreB={m.scoreB}
                      tiebreakA={m.tiebreakA}
                      tiebreakB={m.tiebreakB}
                      sets={m.sets ?? []}
                      retiredSide={m.retiredSide}
                      bestOf={matchBestOf}
                      onSave={updateMatchScore}
                      onSaveSets={updateMatchSets}
                      onSetRetirement={setMatchRetirement}
                      onClear={clearMatchScore}
                      disabled={!resolved.ready}
                      disabledHint={resolved.waitingReason ?? undefined}
                    />
                  </article>
                );
              })}
            </CollapsiblePanel>
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
