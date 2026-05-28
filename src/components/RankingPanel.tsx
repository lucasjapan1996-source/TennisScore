import { useMemo } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import {
  computeGroupStageFinalStandings,
  computeGroupAndKnockoutStandings,
  computeStandings,
} from '../utils/ranking';
import { computePodium } from '../utils/podium';
import { isMatchPlayed } from '../utils/score';
import { withoutThirdPlaceMatches } from '../utils/schedule';
import { PodiumDisplay } from './PodiumDisplay';
import { MatchResultsCard } from './MatchResultsCard';
import { renderStandingName } from './PlayerLabel';
import { useStrings } from '../hooks/useStrings';
import type { DoublesPairing, MatchMode, Player, ScheduleFormat, StandingRow, Team } from '../types';
import { usesPlayerStandings } from '../utils/ranking';
import { showPlayerGender } from '../utils/tournamentCategory';
import { CollapsiblePanel } from './CollapsiblePanel';

export function RankingPanel() {
  const S = useStrings();
  const { tournament, setActiveTab } = useTournamentStore();
  const isGroupStage = tournament.scheduleFormat === 'group_stage';
  const isKnockoutOnly = tournament.scheduleFormat === 'knockout';
  const isSingles = tournament.mode === 'singles';
  const rankByPlayer = usesPlayerStandings(tournament.mode, tournament);
  const genderVisible = showPlayerGender(tournament.category);
  const categoryLabel =
    tournament.category === 'women'
      ? S.categoryWomen
      : tournament.category === 'mixed'
        ? S.categoryMixed
        : S.categoryMen;

  const rankingTitle = isGroupStage
    ? S.rankingGroupStage
    : isKnockoutOnly
      ? S.rankingKnockout
      : S.ranking;

  const activeMatches = useMemo(
    () => withoutThirdPlaceMatches(tournament.matches, tournament.scheduleFormat),
    [tournament.matches, tournament.scheduleFormat],
  );

  const finished = activeMatches.filter((m) => isMatchPlayed(m)).length;

  const podium = useMemo(() => computePodium(tournament), [tournament]);

  const groupStageFinalStandings = useMemo(
    () =>
      isGroupStage
        ? computeGroupStageFinalStandings(
            tournament.mode,
            tournament.players,
            tournament.teams,
            tournament.groups,
            activeMatches,
            tournament,
          )
        : [],
    [isGroupStage, tournament, activeMatches],
  );

  const knockoutOnlyStandings = useMemo(
    () =>
      isKnockoutOnly
        ? computeGroupAndKnockoutStandings(
            tournament.mode,
            tournament.players,
            tournament.teams,
            activeMatches,
            tournament,
          )
        : [],
    [isKnockoutOnly, tournament, activeMatches],
  );

  const roundRobinStandings = useMemo(
    () =>
      !isGroupStage && !isKnockoutOnly
        ? computeStandings(
            tournament.mode,
            tournament.players,
            tournament.teams,
            activeMatches,
            tournament,
          )
        : [],
    [isGroupStage, isKnockoutOnly, tournament, activeMatches],
  );

  const standings = isGroupStage
    ? groupStageFinalStandings
    : isKnockoutOnly
      ? knockoutOnlyStandings
      : roundRobinStandings;

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

  return (
    <>
      {podium && (
        <CollapsiblePanel
          title={S.podiumTitle}
          titleTitle={S.podiumTitle}
          compact
          className="podium-panel"
        >
          <PodiumDisplay
            places={podium}
            players={tournament.players}
            teams={tournament.teams}
            mode={tournament.mode}
          />
        </CollapsiblePanel>
      )}

      <CollapsiblePanel
        title={rankingTitle}
        titleTitle={
          isGroupStage ? S.rankingGroupStageHint : S.rankingTitle
        }
        compact
        defaultOpen
        className="ranking-panel-main"
      >
        <p className="stats-bar">
          <span className="stat-pill">
            {S.finishedMatches(finished, activeMatches.length)}
          </span>
          <span className="stat-pill">
            {S.modeStat}{' '}
            <strong>{isSingles ? S.singles : S.doubles}</strong>
          </span>
          <span className="stat-pill">
            {S.categoryStat}{' '}
            <strong>{categoryLabel}</strong>
          </span>
        </p>
        {standings.length === 0 ? (
          <p className="empty-state" title={S.noDataTitle}>
            {S.noData}
          </p>
        ) : (
          <StandingsTable
            rows={standings}
            rankByPlayer={rankByPlayer}
            players={tournament.players}
            teams={tournament.teams}
            mode={tournament.mode}
            scheduleFormat={tournament.scheduleFormat}
            doublesPairing={tournament.doublesPairing}
            showGender={genderVisible}
          />
        )}
      </CollapsiblePanel>

      <MatchResultsCard />
    </>
  );
}

function StandingsTable({
  rows,
  rankByPlayer,
  players,
  teams,
  mode,
  scheduleFormat,
  doublesPairing,
  showGender,
}: {
  rows: StandingRow[];
  rankByPlayer: boolean;
  players: Player[];
  teams: Team[];
  mode: MatchMode;
  scheduleFormat: ScheduleFormat;
  doublesPairing: DoublesPairing;
  showGender: boolean;
}) {
  const S = useStrings();
  return (
    <div className="rank-table-wrap">
      <table className="rank-table rank-table-minimal" title={S.tableTitle}>
        <thead>
          <tr>
            <th className="num" title={S.colRank}>
              {S.colRank}
            </th>
            <th title={rankByPlayer ? S.colPlayer : S.colTeam}>
              {rankByPlayer ? S.colPlayer : S.colTeam}
            </th>
            {scheduleFormat !== 'group_stage' && (
              <th className="num" title={S.colDiff}>
                {S.colDiff}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.rank === 1 ? 'top1' : ''}
              title={
                scheduleFormat === 'group_stage'
                  ? row.rank === 1
                    ? S.champion
                    : S.rankN(row.rank)
                  : S.standingRowTitle(row.rank, row.gameDiff)
              }
            >
              <td className="num">
                <span
                  className={`rank-badge${row.rank === 1 ? ' gold' : ''}`}
                  title={row.rank === 1 ? S.champion : S.rankN(row.rank)}
                >
                  {row.rank}
                </span>
              </td>
              <td>
                {renderStandingName(row.id, players, mode, teams, showGender, {
                  scheduleFormat,
                  doublesPairing,
                })}
              </td>
              {scheduleFormat !== 'group_stage' && (
                <td className="num diff-cell">
                  {row.gameDiff > 0 ? '+' : ''}
                  {row.gameDiff}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
