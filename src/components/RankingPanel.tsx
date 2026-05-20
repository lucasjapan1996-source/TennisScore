import { useMemo } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import {
  computeGroupAndKnockoutStandings,
  computeStandings,
} from '../utils/ranking';
import { computePodium } from '../utils/podium';
import { isMatchPlayed } from '../utils/score';
import { withoutThirdPlaceMatches } from '../utils/schedule';
import { PodiumDisplay } from './PodiumDisplay';
import { renderStandingName } from './PlayerLabel';
import { S } from '../strings';
import type { MatchMode, Player, StandingRow, Team } from '../types';

export function RankingPanel() {
  const { tournament, setActiveTab } = useTournamentStore();
  const isGroupStage = tournament.scheduleFormat === 'group_stage';
  const isKnockoutOnly = tournament.scheduleFormat === 'knockout';
  const isSingles = tournament.mode === 'singles';

  const activeMatches = useMemo(
    () => withoutThirdPlaceMatches(tournament.matches, tournament.scheduleFormat),
    [tournament.matches, tournament.scheduleFormat],
  );

  const finished = activeMatches.filter((m) => isMatchPlayed(m)).length;

  const podium = useMemo(() => computePodium(tournament), [tournament]);

  const combinedStandings = useMemo(
    () =>
      isGroupStage || isKnockoutOnly
        ? computeGroupAndKnockoutStandings(
            tournament.mode,
            tournament.players,
            tournament.teams,
            activeMatches,
          )
        : [],
    [
      isGroupStage,
      isKnockoutOnly,
      tournament.mode,
      tournament.players,
      tournament.teams,
      activeMatches,
    ],
  );

  const roundRobinStandings = useMemo(
    () =>
      !isGroupStage && !isKnockoutOnly
        ? computeStandings(
            tournament.mode,
            tournament.players,
            tournament.teams,
            activeMatches,
          )
        : [],
    [
      isGroupStage,
      isKnockoutOnly,
      tournament.mode,
      tournament.players,
      tournament.teams,
      activeMatches,
    ],
  );

  if (activeMatches.length === 0) {
    return (
      <section className="panel">
        <p className="empty-state" title={S.noRankTitle}>
          <span aria-hidden>🏆</span>
          <br />
          {S.noRank}
          <br />
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={() => setActiveTab('setup')}
            title={S.goSetupTitle}
          >
            {S.goSetup}
          </button>
        </p>
      </section>
    );
  }

  const rankHint = isGroupStage
    ? S.rankingGroupStageHint
    : isKnockoutOnly
      ? S.combinedRankHintKnockout
      : S.rankRule;

  return (
    <>
      {podium && (
        <section className="panel podium-panel">
          <PodiumDisplay
            places={podium}
            players={tournament.players}
            teams={tournament.teams}
            mode={tournament.mode}
          />
          <p className="hint podium-hint">
            {isGroupStage
              ? S.podiumHint
              : isKnockoutOnly
                ? S.podiumHintKnockout
                : S.podiumHintRoundRobin}
          </p>
        </section>
      )}

      <section className="panel">
        <h2 title={S.rankingTitle}>
          {isGroupStage
            ? S.rankingGroupStage
            : isKnockoutOnly
              ? S.rankingKnockout
              : S.ranking}
        </h2>
        <p className="stats-bar">
          <span className="stat-pill">
            {S.finishedMatches(finished, activeMatches.length)}
          </span>
          <span className="stat-pill">
            {S.modeStat}{' '}
            <strong>{isSingles ? S.singles : S.doubles}</strong>
          </span>
        </p>
        <p className="hint" title={S.rankRuleTitle}>
          {rankHint}
        </p>
      </section>

      {isGroupStage || isKnockoutOnly ? (
        <section className="panel group-standings-panel">
          <h3 className="group-rank-title">{S.groupStandingsAll}</h3>
          {combinedStandings.length === 0 ? (
            <p className="empty-state">{S.noData}</p>
          ) : (
            <StandingsTable
              rows={combinedStandings}
              isSingles={isSingles}
              players={tournament.players}
              teams={tournament.teams}
              mode={tournament.mode}
            />
          )}
        </section>
      ) : roundRobinStandings.length === 0 ? (
        <section className="panel">
          <p className="empty-state" title={S.noDataTitle}>
            {S.noData}
          </p>
        </section>
      ) : (
        <section className="panel">
          <StandingsTable
            rows={roundRobinStandings}
            isSingles={isSingles}
            players={tournament.players}
            teams={tournament.teams}
            mode={tournament.mode}
          />
        </section>
      )}
    </>
  );
}

function StandingsTable({
  rows,
  isSingles,
  players,
  teams,
  mode,
}: {
  rows: StandingRow[];
  isSingles: boolean;
  players: Player[];
  teams: Team[];
  mode: MatchMode;
}) {
  return (
    <div className="rank-table-wrap">
      <table className="rank-table rank-table-minimal" title={S.tableTitle}>
        <thead>
          <tr>
            <th className="num" title={S.colRank}>
              {S.colRank}
            </th>
            <th title={isSingles ? S.colPlayer : S.colTeam}>
              {isSingles ? S.colPlayer : S.colTeam}
            </th>
            <th className="num" title={S.colDiff}>
              {S.colDiff}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.rank === 1 ? 'top1' : ''}
              title={S.standingRowTitle(row.rank, row.gameDiff)}
            >
              <td className="num">
                <span
                  className={`rank-badge${row.rank === 1 ? ' gold' : ''}`}
                  title={row.rank === 1 ? S.champion : S.rankN(row.rank)}
                >
                  {row.rank}
                </span>
              </td>
              <td>{renderStandingName(row.id, players, mode, teams)}</td>
              <td className="num diff-cell">
                {row.gameDiff > 0 ? '+' : ''}
                {row.gameDiff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
