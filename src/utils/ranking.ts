import { getActiveStrings } from '../i18n';
import type {
  GroupAssignment,
  Match,
  MatchMode,
  Player,
  StandingRow,
  Team,
} from '../types';
import type { BestOf } from '../types';
import type { StandingTournamentFields } from './bestOf';
import { resolveMatchBestOf } from './bestOf';
import {
  getMatchWinnerSide,
  isRetired,
  matchHasRecordedScore,
} from './matchOutcome';
import { formatPlayerLabel } from './player';
import { showPlayerGender } from './tournamentCategory';

interface EntityStats {
  id: string;
  label: string;
  played: number;
  wins: number;
  losses: number;
  gamesFor: number;
  gamesAgainst: number;
}

function getEntityLabel(
  ids: string[],
  players: Player[],
  mode: MatchMode,
  teams: Team[],
): string {
  const names = ids.map(
    (id) => players.find((p) => p.id === id)?.name ?? getActiveStrings().unknown,
  );
  if (mode === 'singles') return names[0];
  const team = teams.find(
    (t) =>
      t.playerIds.length === ids.length &&
      t.playerIds.every((pid) => ids.includes(pid)),
  );
  if (team) {
    const teamNames = team.playerIds.map(
      (pid) => players.find((p) => p.id === pid)?.name ?? getActiveStrings().unknown,
    );
    return teamNames.join(' / ');
  }
  return names.join(' / ');
}

function entityKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

/** 循环赛轮换搭档：排名按球员；固定队友及其他赛制按队伍 */
export function usesPlayerStandings(
  mode: MatchMode,
  tournament: Pick<StandingTournamentFields, 'scheduleFormat' | 'doublesPairing'>,
): boolean {
  return (
    mode === 'singles' ||
    (mode === 'doubles' &&
      tournament.scheduleFormat === 'round_robin' &&
      tournament.doublesPairing === 'rotating')
  );
}

function isDoublesPartnerRoundRobin(t: StandingTournamentFields): boolean {
  return usesPlayerStandings(t.mode, t);
}

function buildEntities(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  showGender: boolean,
  tournament: StandingTournamentFields,
): Map<string, EntityStats> {
  const map = new Map<string, EntityStats>();

  if (mode === 'singles' || isDoublesPartnerRoundRobin(tournament)) {
    for (const p of players) {
      map.set(p.id, {
        id: p.id,
        label: formatPlayerLabel(p, showGender),
        played: 0,
        wins: 0,
        losses: 0,
        gamesFor: 0,
        gamesAgainst: 0,
      });
    }
  } else {
    for (const t of teams) {
      const key = entityKey(t.playerIds);
      const label = t.playerIds
        .map((pid) => {
          const p = players.find((pl) => pl.id === pid);
          return p ? formatPlayerLabel(p, showGender) : getActiveStrings().unknown;
        })
        .join(' / ');
      map.set(key, {
        id: key,
        label,
        played: 0,
        wins: 0,
        losses: 0,
        gamesFor: 0,
        gamesAgainst: 0,
      });
    }
  }
  return map;
}

function headToHeadWins(
  matches: Match[],
  entityA: string,
  entityB: string,
): number {
  let wins = 0;
  for (const m of matches) {
    if (m.isBye) continue;
    if (m.scoreA === null || m.scoreB === null) continue;
    const keyA = entityKey(m.sideAIds);
    const keyB = entityKey(m.sideBIds);
    const isPair =
      (keyA === entityA && keyB === entityB) ||
      (keyA === entityB && keyB === entityA);
    if (!isPair) continue;
    const aWon =
      keyA === entityA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
    if (aWon) wins++;
  }
  return wins;
}

/** 双打按球员排名时：统计两人作为对手直接交锋的胜场 */
function headToHeadPlayerWins(
  matches: Match[],
  playerA: string,
  playerB: string,
): number {
  let wins = 0;
  for (const m of matches) {
    if (m.isBye) continue;
    if (m.scoreA === null || m.scoreB === null) continue;
    const aOnA = m.sideAIds.includes(playerA);
    const aOnB = m.sideBIds.includes(playerA);
    const bOnA = m.sideAIds.includes(playerB);
    const bOnB = m.sideBIds.includes(playerB);
    if (!((aOnA && bOnB) || (aOnB && bOnA))) continue;
    const aWon = aOnA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
    if (aWon) wins++;
  }
  return wins;
}

export function computeGroupStandings(
  groupId: number,
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  groups: GroupAssignment[],
  matches: Match[],
  tournament: StandingTournamentFields,
): StandingRow[] {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return [];

  const groupMatches = matches.filter(
    (m) => m.phase === 'group' && m.group === groupId,
  );
  const memberSet = new Set(group.memberIds);

  if (mode === 'singles') {
    const subset = players.filter((p) => memberSet.has(p.id));
    return computeStandings(mode, subset, [], groupMatches, tournament);
  }

  const subsetTeams = teams.filter((t) => memberSet.has(t.id));
  return computeStandings(mode, players, subsetTeams, groupMatches, tournament);
}

function applyPlayerDoublesMatchToStats(
  stats: Map<string, EntityStats>,
  m: Match,
  bestOf: BestOf,
): void {
  const bumpSide = (
    ids: string[],
    won: boolean,
    scoreFor: number,
    scoreAgainst: number,
  ) => {
    for (const id of ids) {
      const row = stats.get(id);
      if (!row) continue;
      row.played++;
      if (won) row.wins++;
      else row.losses++;
      row.gamesFor += scoreFor;
      row.gamesAgainst += scoreAgainst;
    }
  };

  if (isRetired(m) && !matchHasRecordedScore(m, bestOf)) {
    const winner = getMatchWinnerSide(m, bestOf);
    if (!winner) return;
    if (winner === 'A') {
      bumpSide(m.sideAIds, true, 0, 0);
      bumpSide(m.sideBIds, false, 0, 0);
    } else {
      bumpSide(m.sideBIds, true, 0, 0);
      bumpSide(m.sideAIds, false, 0, 0);
    }
    return;
  }

  if (m.scoreA === null || m.scoreB === null) return;

  if (m.scoreA > m.scoreB) {
    bumpSide(m.sideAIds, true, m.scoreA, m.scoreB);
    bumpSide(m.sideBIds, false, m.scoreB, m.scoreA);
  } else if (m.scoreB > m.scoreA) {
    bumpSide(m.sideBIds, true, m.scoreB, m.scoreA);
    bumpSide(m.sideAIds, false, m.scoreA, m.scoreB);
  }
}

function applyMatchToStats(
  stats: Map<string, EntityStats>,
  m: Match,
  tournament: StandingTournamentFields,
): void {
  const bestOf = resolveMatchBestOf(m, tournament);

  if (isDoublesPartnerRoundRobin(tournament)) {
    applyPlayerDoublesMatchToStats(stats, m, bestOf);
    return;
  }

  if (isRetired(m) && !matchHasRecordedScore(m, bestOf)) {
    const winner = getMatchWinnerSide(m, bestOf);
    if (!winner) return;
    const keyA = entityKey(m.sideAIds);
    const keyB = entityKey(m.sideBIds);
    const a = stats.get(keyA);
    const b = stats.get(keyB);
    if (!a || !b) return;
    a.played++;
    b.played++;
    if (winner === 'A') {
      a.wins++;
      b.losses++;
    } else {
      b.wins++;
      a.losses++;
    }
    return;
  }

  if (m.scoreA === null || m.scoreB === null) return;

  if (m.isBye) {
    const winIds =
      m.sideAIds.length > 0 ? m.sideAIds : m.sideBIds.length > 0 ? m.sideBIds : null;
    if (!winIds || winIds.length === 0) return;
    const w = stats.get(entityKey(winIds));
    if (!w) return;
    w.played++;
    w.wins++;
    w.gamesFor += m.scoreA > m.scoreB ? m.scoreA : m.scoreB;
    w.gamesAgainst += m.scoreA > m.scoreB ? m.scoreB : m.scoreA;
    return;
  }

  const keyA = entityKey(m.sideAIds);
  const keyB = entityKey(m.sideBIds);
  const a = stats.get(keyA);
  const b = stats.get(keyB);
  if (!a || !b) return;

  a.played++;
  b.played++;
  a.gamesFor += m.scoreA;
  a.gamesAgainst += m.scoreB;
  b.gamesFor += m.scoreB;
  b.gamesAgainst += m.scoreA;

  if (m.scoreA > m.scoreB) {
    a.wins++;
    b.losses++;
  } else if (m.scoreB > m.scoreA) {
    b.wins++;
    a.losses++;
  }
}

function finalizeStandingRows(
  stats: Map<string, EntityStats>,
  relevant: Match[],
  tournament: StandingTournamentFields,
): StandingRow[] {
  const byPlayer = usesPlayerStandings(tournament.mode, tournament);
  const rows = [...stats.values()].map((s) => ({
    id: s.id,
    label: s.label,
    played: s.played,
    wins: s.wins,
    losses: s.losses,
    gamesFor: s.gamesFor,
    gamesAgainst: s.gamesAgainst,
    gameDiff: s.gamesFor - s.gamesAgainst,
    winRate: s.played > 0 ? s.wins / s.played : 0,
    rank: 0,
  }));

  rows.sort((x, y) => {
    if (byPlayer) {
      if (y.gameDiff !== x.gameDiff) return y.gameDiff - x.gameDiff;
      if (y.wins !== x.wins) return y.wins - x.wins;
      if (y.gamesFor !== x.gamesFor) return y.gamesFor - x.gamesFor;
      const h2h = headToHeadPlayerWins(relevant, x.id, y.id);
      if (h2h !== 0) return h2h > 0 ? -1 : 1;
    } else {
      if (y.wins !== x.wins) return y.wins - x.wins;
      if (y.gameDiff !== x.gameDiff) return y.gameDiff - x.gameDiff;
      if (y.gamesFor !== x.gamesFor) return y.gamesFor - x.gamesFor;
      const h2h = headToHeadWins(relevant, x.id, y.id);
      if (h2h !== 0) return h2h > 0 ? -1 : 1;
    }
    return x.label.localeCompare(y.label, 'zh-CN');
  });

  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    const tiedWithPrev =
      i > 0 &&
      rows[i].gamesFor === rows[i - 1].gamesFor &&
      (byPlayer
        ? rows[i].gameDiff === rows[i - 1].gameDiff &&
          rows[i].wins === rows[i - 1].wins
        : rows[i].wins === rows[i - 1].wins &&
          rows[i].gameDiff === rows[i - 1].gameDiff);
    if (tiedWithPrev) {
      rows[i].rank = rows[i - 1].rank;
    } else {
      rows[i].rank = rank;
    }
    rank++;
  }

  return rows;
}

/** 小组赛 + 淘汰赛已录比分合并统计（用于总排名） */
function isStandingMatch(m: Match): boolean {
  if (m.phase === 'knockout' && m.isBye) return false;
  if (isRetired(m)) return true;
  return m.scoreA !== null && m.scoreB !== null;
}

export function computeGroupAndKnockoutStandings(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  matches: Match[],
  tournament: StandingTournamentFields,
): StandingRow[] {
  const relevant = matches.filter(
    (m) => (m.phase === 'group' || m.phase === 'knockout') && isStandingMatch(m),
  );
  const showGender = showPlayerGender(tournament.category);
  const stats = buildEntities(mode, players, teams, showGender, tournament);
  for (const m of relevant) {
    applyMatchToStats(stats, m, tournament);
  }
  return finalizeStandingRows(stats, relevant, tournament);
}

export function computeStandings(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  matches: Match[],
  tournament: StandingTournamentFields,
): StandingRow[] {
  const relevant = matches.filter(
    (m) => m.phase !== 'knockout' && isStandingMatch(m),
  );
  const showGender = showPlayerGender(tournament.category);
  const stats = buildEntities(mode, players, teams, showGender, tournament);

  for (const m of relevant) {
    applyMatchToStats(stats, m, tournament);
  }

  return finalizeStandingRows(stats, relevant, tournament);
}

export function formatMatchSides(
  sideIds: string[],
  players: Player[],
  showGender = true,
): string {
  return sideIds
    .map((id) => {
      const p = players.find((pl) => pl.id === id);
      return p ? formatPlayerLabel(p, showGender) : getActiveStrings().unknown;
    })
    .join(' / ');
}

export { getEntityLabel };
