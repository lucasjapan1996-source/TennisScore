import { useState } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { estimateMatchCount } from '../utils/schedule';
import { PlayerLabel } from './PlayerLabel';
import { ScheduleOverview } from './ScheduleOverview';
import { useStrings } from '../hooks/useStrings';
import { tournamentHasFinal } from '../utils/bestOf';
import type { BestOf } from '../types';
import { showPlayerGender } from '../utils/tournamentCategory';
import { CollapsiblePanel } from './CollapsiblePanel';

const BEST_OF_OPTIONS: BestOf[] = [1, 3, 5];

function BestOfButtons({
  value,
  onChange,
  ariaLabel,
}: {
  value: BestOf;
  onChange: (n: BestOf) => void;
  ariaLabel: string;
}) {
  const S = useStrings();
  return (
    <section
      className="mode-toggle mode-toggle-3 best-of-row"
      role="group"
      aria-label={ariaLabel}
    >
      {BEST_OF_OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          className={value === n ? 'active' : ''}
          onClick={() => onChange(n)}
          title={n === 1 ? S.bo1Title : n === 3 ? S.bo3Title : S.bo5Title}
        >
          {n === 1 ? S.bo1 : n === 3 ? S.bo3 : S.bo5}
        </button>
      ))}
    </section>
  );
}

export function SetupPanel() {
  const S = useStrings();
  const [error, setError] = useState<string | null>(null);
  const {
    tournament,
    setMode,
    setDoublesPairing,
    setScheduleFormat,
    setScheduleSeedMode,
    setBestOfMode,
    setBestOf,
    setCustomBestOfDefault,
    setCustomBestOfFinal,
    setGroupCount,
    setTeamPair,
    generateSchedule,
    appendSchedule,
    setMatchScheduleMarkedDone,
    setActiveTab,
  } = useTournamentStore();
  const genderVisible = showPlayerGender(tournament.category);

  const handleGenerate = () => {
    const err = generateSchedule();
    setError(err);
  };

  const handleAppendSchedule = () => {
    const err = appendSchedule();
    setError(err);
  };

  const handleToggleMatchStatus = (matchId: string, marked: boolean) => {
    setMatchScheduleMarkedDone(matchId, marked);
  };

  const isDoubles = tournament.mode === 'doubles';
  const isDoublesFixed = isDoubles && tournament.doublesPairing === 'fixed';
  const isDoublesRotating = isDoubles && tournament.doublesPairing === 'rotating';

  const entityCount =
    tournament.mode === 'singles'
      ? tournament.players.length
      : isDoublesRotating
        ? Math.max(0, Math.floor(tournament.players.length / 2))
        : tournament.teams.length;

  const matchCount = estimateMatchCount(
    entityCount,
    tournament.scheduleFormat,
    tournament.groupCount,
    {
      mode: tournament.mode,
      playerCount: tournament.players.length,
      doublesPairing: tournament.doublesPairing,
    },
  );

  const canGenerate =
    tournament.mode === 'singles'
      ? tournament.players.length >= 2
      : isDoublesRotating
        ? tournament.players.length >= 4
        : entityCount >= 2;

  const isRoundRobin = tournament.scheduleFormat === 'round_robin';
  const hasFinal = tournamentHasFinal(tournament.scheduleFormat);
  const isCustomBo = !isRoundRobin && tournament.bestOfMode === 'custom';
  const bestOfSummary = isCustomBo
    ? S.bestOfCustomHintShort(
        tournament.customBestOfDefault,
        tournament.customBestOfFinal,
      )
    : S.bestOfHintShort(tournament.bestOf);

  const memberLabel = (id: string) => {
    if (tournament.mode === 'singles') {
      const p = tournament.players.find((x) => x.id === id);
      return p ? p.name : '?';
    }
    const t = tournament.teams.find((x) => x.id === id);
    if (!t) return '?';
    return t.playerIds
      .map((pid) => tournament.players.find((p) => p.id === pid)?.name ?? '?')
      .join(' / ');
  };

  return (
    <div className="setup-tab">
      <CollapsiblePanel title={S.mode} titleTitle={S.modeTitle} compact>
        <section className="mode-toggle mode-toggle-2">
          <button
            type="button"
            className={tournament.mode === 'singles' ? 'active' : ''}
            onClick={() => setMode('singles')}
            title={S.singlesTitle}
          >
            {S.singles}
          </button>
          <button
            type="button"
            className={tournament.mode === 'doubles' ? 'active' : ''}
            onClick={() => setMode('doubles')}
            title={S.doublesTitle}
          >
            {S.doubles}
          </button>
        </section>
        {isDoubles && (
          <>
            <h2 className="panel-subtitle" title={S.doublesPairingTitle}>
              {S.doublesPairing}
            </h2>
            <section className="mode-toggle mode-toggle-2">
              <button
                type="button"
                className={isDoublesFixed ? 'active' : ''}
                onClick={() => setDoublesPairing('fixed')}
                title={S.doublesPairingFixedTitle}
              >
                {S.doublesPairingFixed}
              </button>
              <button
                type="button"
                className={isDoublesRotating ? 'active' : ''}
                onClick={() => setDoublesPairing('rotating')}
                title={S.doublesPairingRotatingTitle}
              >
                {S.doublesPairingRotating}
              </button>
            </section>
          </>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        title={S.scheduleFormat}
        titleTitle={S.scheduleFormatTitle}
        compact
      >
        <section className="mode-toggle mode-toggle-3">
          <button
            type="button"
            className={tournament.scheduleFormat === 'round_robin' ? 'active' : ''}
            onClick={() => setScheduleFormat('round_robin')}
            title={S.roundRobinTitle}
          >
            {S.roundRobin}
          </button>
          <button
            type="button"
            className={tournament.scheduleFormat === 'group_stage' ? 'active' : ''}
            onClick={() => setScheduleFormat('group_stage')}
            title={S.groupStageTitle}
          >
            {S.groupStage}
          </button>
          <button
            type="button"
            className={tournament.scheduleFormat === 'knockout' ? 'active' : ''}
            onClick={() => setScheduleFormat('knockout')}
            title={S.knockoutOnlyTitle}
          >
            {S.knockoutOnly}
          </button>
        </section>
        {isRoundRobin ? (
          <>
            <h2 className="best-of-round-robin-title" title={S.bestOfTitle}>
              {S.bestOf}
            </h2>
            <BestOfButtons
              value={tournament.bestOf}
              onChange={setBestOf}
              ariaLabel={S.bestOf}
            />
          </>
        ) : (
          <>
            <div className="panel-field-row">
              <h2 className="panel-field-label" title={S.bestOfTitle}>
                {S.bestOf}
              </h2>
              <div className="panel-field-control">
                <section
                  className="mode-toggle mode-toggle-2"
                  role="group"
                  aria-label={S.bestOf}
                >
                  <button
                    type="button"
                    className={!isCustomBo ? 'active' : ''}
                    onClick={() => setBestOfMode('uniform')}
                    title={S.bestOfModeUniformTitle}
                  >
                    {S.bestOfModeUniform}
                  </button>
                  <button
                    type="button"
                    className={isCustomBo ? 'active' : ''}
                    onClick={() => setBestOfMode('custom')}
                    title={S.bestOfModeCustomTitle}
                  >
                    {S.bestOfModeCustom}
                  </button>
                </section>
              </div>
            </div>
            {!isCustomBo ? (
              <BestOfButtons
                value={tournament.bestOf}
                onChange={setBestOf}
                ariaLabel={S.bestOfModeUniform}
              />
            ) : (
              <div className="best-of-custom">
                <label className="best-of-custom-label">
                  <span title={S.customBestOfDefaultTitle}>
                    {S.customBestOfDefault}
                  </span>
                  <BestOfButtons
                    value={tournament.customBestOfDefault}
                    onChange={setCustomBestOfDefault}
                    ariaLabel={S.customBestOfDefault}
                  />
                </label>
                <label
                  className={`best-of-custom-label${!hasFinal ? ' disabled' : ''}`}
                >
                  <span
                    title={
                      hasFinal
                        ? S.customBestOfFinalTitle
                        : S.customBestOfFinalDisabledHint
                    }
                  >
                    {S.customBestOfFinal}
                  </span>
                  <BestOfButtons
                    value={tournament.customBestOfFinal}
                    onChange={setCustomBestOfFinal}
                    ariaLabel={S.customBestOfFinal}
                  />
                </label>
              </div>
            )}
          </>
        )}

        {tournament.scheduleFormat === 'group_stage' && (
          <label className="field-label field-label-compact">
            <span title={S.groupCountTitle}>{S.groupCount}</span>
            <input
              type="number"
              min={2}
              max={Math.max(2, entityCount)}
              value={tournament.groupCount}
              onChange={(e) => setGroupCount(parseInt(e.target.value, 10) || 2)}
              title={S.groupCountTitle}
            />
          </label>
        )}
      </CollapsiblePanel>

      {isDoublesFixed && tournament.players.length >= 2 && (
        <CollapsiblePanel title={S.teamGroup} titleTitle={S.teamGroupTitle} compact>
          {tournament.teams.map((team, idx) => (
            <article key={team.id} className="team-card">
              <label title={S.teamNTitle(idx + 1)}>{S.teamN(idx + 1)}</label>
              <p className="row">
                <select
                  value={team.playerIds[0]}
                  onChange={(e) =>
                    setTeamPair(idx, e.target.value, team.playerIds[1])
                  }
                >
                  {tournament.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span style={{ color: 'var(--muted)' }} aria-hidden>
                  +
                </span>
                <select
                  value={team.playerIds[1]}
                  onChange={(e) =>
                    setTeamPair(idx, team.playerIds[0], e.target.value)
                  }
                >
                  {tournament.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </p>
            </article>
          ))}
        </CollapsiblePanel>
      )}

      {tournament.groups.length > 0 && (
        <CollapsiblePanel title={S.groupAssignment}>
          {tournament.groups.map((g) => (
            <article key={g.id} className="team-card">
              <label>
                {S.groupLabel(g.id)}
                {S.groupMemberSeparator}
                {S.groupMembers(g.memberIds.length)}
              </label>
              <p className="hint group-member-list">
                {g.memberIds.map((id, i) => {
                  const p = tournament.players.find((x) => x.id === id);
                  const team = tournament.teams.find((t) => t.id === id);
                  return (
                    <span key={id}>
                      {i > 0 && S.groupMemberSeparator}
                      {p ? (
                        <PlayerLabel player={p} compact showGender={genderVisible} />
                      ) : team ? (
                        team.playerIds.map((pid, j) => {
                          const pl = tournament.players.find((x) => x.id === pid);
                          return pl ? (
                            <span key={pid}>
                              {j > 0 && ' / '}
                              <PlayerLabel player={pl} compact showGender={genderVisible} />
                            </span>
                          ) : null;
                        })
                      ) : (
                        memberLabel(id)
                      )}
                    </span>
                  );
                })}
              </p>
            </article>
          ))}
        </CollapsiblePanel>
      )}

      <CollapsiblePanel title={S.schedule} titleTitle={S.scheduleTitle} compact>
        <p className="stats-bar">
          <span className="stat-pill">
            {S.statPlayers} <strong>{tournament.players.length}</strong>
          </span>
          {isDoublesFixed && (
            <span className="stat-pill">
              {S.statTeams} <strong>{tournament.teams.length}</strong>
            </span>
          )}
          <span className="stat-pill">
            {S.statMatches} <strong>{matchCount}</strong>
          </span>
          <span className="stat-pill" title={S.bestOfTitle}>
            {S.bestOf} <strong>{bestOfSummary}</strong>
          </span>
        </p>
        {error && <p className="error-banner">{error}</p>}
        <div className="panel-field-row">
          <h2 className="panel-field-label" title={S.scheduleSeedTitle}>
            {S.scheduleSeed}
          </h2>
          <div className="panel-field-control">
            <section
              className="mode-toggle mode-toggle-2"
              role="group"
              aria-label={S.scheduleSeed}
            >
              <button
                type="button"
                className={
                  tournament.scheduleSeedMode === 'sequential' ? 'active' : ''
                }
                onClick={() => setScheduleSeedMode('sequential')}
                title={S.scheduleSeedSequentialTitle}
              >
                {S.scheduleSeedSequential}
              </button>
              <button
                type="button"
                className={tournament.scheduleSeedMode === 'random' ? 'active' : ''}
                onClick={() => setScheduleSeedMode('random')}
                title={S.scheduleSeedRandomTitle}
              >
                {S.scheduleSeedRandom}
              </button>
            </section>
          </div>
        </div>
        <p className="btn-row btn-row-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleGenerate}
            disabled={!canGenerate}
            title={!canGenerate ? S.generateDisabledTitle : S.generateTitle}
          >
            {S.generate}
          </button>
          {tournament.matches.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveTab('matches')}
              title={S.viewMatchesTitle}
            >
              {S.viewMatches}
            </button>
          )}
        </p>
      </CollapsiblePanel>

      {tournament.matches.length > 0 && (
        <ScheduleOverview
          mode={tournament.mode}
          doublesPairing={tournament.doublesPairing}
          scheduleFormat={tournament.scheduleFormat}
          category={tournament.category}
          bestOfMode={tournament.bestOfMode}
          bestOf={tournament.bestOf}
          customBestOfDefault={tournament.customBestOfDefault}
          customBestOfFinal={tournament.customBestOfFinal}
          players={tournament.players}
          teams={tournament.teams}
          groups={tournament.groups}
          matches={tournament.matches}
          scheduleBatchSizes={tournament.scheduleBatchSizes}
          onAppendSchedule={handleAppendSchedule}
          onToggleMatchStatus={handleToggleMatchStatus}
          onGoScore={() => setActiveTab('matches')}
        />
      )}
    </div>
  );
}
