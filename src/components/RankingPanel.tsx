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
            tournament,
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
            tournament,
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
            showGender={genderVisible}
          />
        </CollapsiblePanel>
      )}

      <CollapsiblePanel
        title={
          isGroupStage
            ? S.rankingGroupStage
            : isKnockoutOnly
              ? S.rankingKnockout
              : S.ranking
        }
        titleTitle={S.rankingTitle}
        compact
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
      </CollapsiblePanel>

      {isGroupStage || isKnockoutOnly ? (
        <CollapsiblePanel
          title={S.groupStandingsAll}
          className="group-standings-panel"
        >
          {combinedStandings.length === 0 ? (
            <p className="empty-state">{S.noData}</p>
          ) : (
            <StandingsTable
              rows={combinedStandings}
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
      ) : roundRobinStandings.length === 0 ? (
        <CollapsiblePanel title={S.ranking} titleTitle={S.rankingTitle}>
          <p className="empty-state" title={S.noDataTitle}>
            {S.noData}
          </p>
        </CollapsiblePanel>
      ) : (
        <CollapsiblePanel title={S.ranking} titleTitle={S.rankingTitle}>
          <StandingsTable
            rows={roundRobinStandings}
            rankByPlayer={rankByPlayer}
            players={tournament.players}
            teams={tournament.teams}
            mode={tournament.mode}
            scheduleFormat={tournament.scheduleFormat}
            doublesPairing={tournament.doublesPairing}
            showGender={genderVisible}
          />
        </CollapsiblePanel>
      )}
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
              <td>
                {renderStandingName(row.id, players, mode, teams, showGender, {
                  scheduleFormat,
                  doublesPairing,
                })}
              </td>
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
