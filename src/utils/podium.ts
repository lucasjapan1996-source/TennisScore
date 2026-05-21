import type { Match, Tournament } from '../types';
import { resolveMatchBestOf } from './bestOf';
import { resolveMatchSides, type ResolveSidesTournament } from './knockout';
import { getMatchWinnerSide } from './matchOutcome';
import { computeStandings, usesPlayerStandings } from './ranking';
import { formatSideCompactLabel } from './player';
import { showPlayerGender } from './tournamentCategory';
import { isMatchPlayed } from './score';

export interface PodiumPlace {
  place: 1 | 2;
  sideIds: string[] | null;
  ready: boolean;
}

function entityKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

function matchSides(
  m: Match,
  tournament: ResolveSidesTournament,
): { winnerIds: string[]; loserIds: string[] } | null {
  if (!isMatchPlayed(m)) return null;
  const showGender = showPlayerGender(tournament.category);
  const resolved = resolveMatchSides(m, tournament, (ids, players) =>
    formatSideCompactLabel(ids, players, showGender),
  );
  if (!resolved.ready) return null;
  const winnerSide = getMatchWinnerSide(m, resolveMatchBestOf(m, tournament));
  if (winnerSide === 'A') {
    return { winnerIds: resolved.sideAIds, loserIds: resolved.sideBIds };
  }
  if (winnerSide === 'B') {
    return { winnerIds: resolved.sideBIds, loserIds: resolved.sideAIds };
  }
  return null;
}

function computeKnockoutPodium(tournament: Tournament): PodiumPlace[] | null {
  const finalMatch = tournament.matches.find(
    (m) =>
      m.phase === 'knockout' &&
      m.knockoutRank === 1 &&
      (m.knockoutStage === 'final' || m.knockoutStage === 'cross'),
  );
  if (!finalMatch) return null;

  const title = matchSides(finalMatch, tournament);
  if (!title) {
    return [
      { place: 1, sideIds: null, ready: false },
      { place: 2, sideIds: null, ready: false },
    ];
  }

  return [
    { place: 1, sideIds: title.winnerIds, ready: true },
    { place: 2, sideIds: title.loserIds, ready: true },
  ];
}

function computeRoundRobinPodium(tournament: Tournament): PodiumPlace[] | null {
  const standings = computeStandings(
    tournament.mode,
    tournament.players,
    tournament.teams,
    tournament.matches,
    tournament,
  );
  if (standings.length === 0) return null;

  const top2 = standings.filter((r) => r.rank <= 2).sort((a, b) => a.rank - b.rank);
  const places: PodiumPlace[] = [
    { place: 1, sideIds: null, ready: false },
    { place: 2, sideIds: null, ready: false },
  ];

  for (const row of top2) {
    const idx = row.rank - 1;
    if (idx < 0 || idx > 1) continue;
    let sideIds: string[];
    if (usesPlayerStandings(tournament.mode, tournament)) {
      sideIds = [row.id];
    } else {
      const team = tournament.teams.find(
        (t) => t.id === row.id || entityKey(t.playerIds) === row.id,
      );
      sideIds = team ? [...team.playerIds] : row.id.split(',');
    }
    const played = row.played > 0;
    places[idx] = {
      place: row.rank as 1 | 2,
      sideIds,
      ready: played,
    };
  }

  return places;
}

export function computePodium(tournament: Tournament): PodiumPlace[] | null {
  if (tournament.matches.length === 0) return null;
  if (
    tournament.scheduleFormat === 'group_stage' ||
    tournament.scheduleFormat === 'knockout'
  ) {
    return computeKnockoutPodium(tournament);
  }
  return computeRoundRobinPodium(tournament);
}

export function isPodiumComplete(places: PodiumPlace[]): boolean {
  return places.every((p) => p.ready && p.sideIds && p.sideIds.length > 0);
}
