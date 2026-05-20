import { useState } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { estimateMatchCount } from '../utils/schedule';
import { PlayerLabel } from './PlayerLabel';
import { ScheduleOverview } from './ScheduleOverview';
import { S } from '../strings';

export function SetupPanel() {
  const [error, setError] = useState<string | null>(null);
  const {
    tournament,
    setMode,
    setScheduleFormat,
    setGroupCount,
    autoPairTeams,
    setTeamPair,
    generateSchedule,
    setActiveTab,
  } = useTournamentStore();

  const handleGenerate = () => {
    const err = generateSchedule();
    setError(err);
  };

  const entityCount =
    tournament.mode === 'singles'
      ? tournament.players.length
      : tournament.teams.length;

  const matchCount = estimateMatchCount(
    entityCount,
    tournament.scheduleFormat,
    tournament.groupCount,
  );

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
    <>
      <section className="panel">
        <h2 title={S.modeTitle}>{S.mode}</h2>
        <section className="mode-toggle">
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
      </section>

      <section className="panel">
        <h2 title={S.scheduleFormatTitle}>{S.scheduleFormat}</h2>
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
        <p className="hint" style={{ marginTop: '0.75rem' }}>
          {tournament.scheduleFormat === 'round_robin'
            ? S.roundRobinHint
            : tournament.scheduleFormat === 'group_stage'
              ? S.groupStageHint
              : S.knockoutOnlyHint}
        </p>
        {tournament.scheduleFormat === 'group_stage' && (
          <p className="hint">{S.knockoutBracketHint}</p>
        )}

        {tournament.scheduleFormat === 'group_stage' && (
          <label className="field-label" style={{ marginTop: '0.75rem' }}>
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
      </section>

      {tournament.mode === 'doubles' && tournament.players.length >= 2 && (
        <section className="panel">
          <h2 title={S.teamGroupTitle}>{S.teamGroup}</h2>
          <p className="hint" title={S.teamGroupHintTitle}>
            {S.teamGroupHint}
          </p>
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
          <p className="btn-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={autoPairTeams}
              title={S.autoPairTitle}
            >
              {S.autoPair}
            </button>
          </p>
        </section>
      )}

      {tournament.groups.length > 0 && (
        <section className="panel">
          <h2>{S.groupAssignment}</h2>
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
                        <PlayerLabel player={p} compact />
                      ) : team ? (
                        team.playerIds.map((pid, j) => {
                          const pl = tournament.players.find((x) => x.id === pid);
                          return pl ? (
                            <span key={pid}>
                              {j > 0 && ' / '}
                              <PlayerLabel player={pl} compact />
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
        </section>
      )}

      <section className="panel">
        <h2 title={S.scheduleTitle}>{S.schedule}</h2>
        <p className="stats-bar">
          <span className="stat-pill">
            {S.statPlayers} <strong>{tournament.players.length}</strong>
          </span>
          {tournament.mode === 'doubles' && (
            <span className="stat-pill">
              {S.statTeams} <strong>{tournament.teams.length}</strong>
            </span>
          )}
          <span className="stat-pill">
            {S.statMatches} <strong>{matchCount}</strong>
          </span>
        </p>
        {error && <p className="error-banner">{error}</p>}
        <p className="btn-row">
          <button
            type="button"
            className="btn-primary"
            onClick={handleGenerate}
            disabled={entityCount < 2}
            title={entityCount < 2 ? S.generateDisabledTitle : S.generateTitle}
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
        {tournament.matches.length > 0 && (
          <p className="hint" style={{ marginTop: '0.5rem' }} title={S.regenWarningTitle}>
            {S.regenWarning}
          </p>
        )}
      </section>

      {tournament.matches.length > 0 && (
        <ScheduleOverview
          mode={tournament.mode}
          scheduleFormat={tournament.scheduleFormat}
          players={tournament.players}
          teams={tournament.teams}
          groups={tournament.groups}
          matches={tournament.matches}
          onGoScore={() => setActiveTab('matches')}
        />
      )}
    </>
  );
}
