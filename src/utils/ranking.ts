import { S } from '../strings';
import type {
  GroupAssignment,
  Match,
  MatchMode,
  Player,
  StandingRow,
  Team,
} from '../types';
import { formatPlayerLabel } from './player';

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
    (id) => players.find((p) => p.id === id)?.name ?? S.unknown,
  );
  if (mode === 'singles') return names[0];
  const team = teams.find(
    (t) =>
      t.playerIds.length === ids.length &&
      t.playerIds.every((pid) => ids.includes(pid)),
  );
  if (team) {
    const teamNames = team.playerIds.map(
      (pid) => players.find((p) => p.id === pid)?.name ?? S.unknown,
    );
    return teamNames.join(' / ');
  }
  return names.join(' / ');
}

function entityKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

function buildEntities(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
): Map<string, EntityStats> {
  const map = new Map<string, EntityStats>();

  if (mode === 'singles') {
    for (const p of players) {
      map.set(p.id, {
        id: p.id,
        label: formatPlayerLabel(p),
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
          return p ? formatPlayerLabel(p) : S.unknown;
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

export function computeGroupStandings(
  groupId: number,
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  groups: GroupAssignment[],
  matches: Match[],
): StandingRow[] {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return [];

  const groupMatches = matches.filter(
    (m) => m.phase === 'group' && m.group === groupId,
  );
  const memberSet = new Set(group.memberIds);

  if (mode === 'singles') {
    const subset = players.filter((p) => memberSet.has(p.id));
    return computeStandings(mode, subset, [], groupMatches);
  }

  const subsetTeams = teams.filter((t) => memberSet.has(t.id));
  return computeStandings(mode, players, subsetTeams, groupMatches);
}

function applyMatchToStats(
  stats: Map<string, EntityStats>,
  m: Match,
): void {
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
): StandingRow[] {
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
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.gameDiff !== x.gameDiff) return y.gameDiff - x.gameDiff;
    if (y.gamesFor !== x.gamesFor) return y.gamesFor - x.gamesFor;
    const h2h = headToHeadWins(relevant, x.id, y.id);
    if (h2h !== 0) return h2h > 0 ? -1 : 1;
    return x.label.localeCompare(y.label, 'zh-CN');
  });

  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (
      i > 0 &&
      rows[i].wins === rows[i - 1].wins &&
      rows[i].gameDiff === rows[i - 1].gameDiff &&
      rows[i].gamesFor === rows[i - 1].gamesFor
    ) {
      rows[i].rank = rows[i - 1].rank;
    } else {
      rows[i].rank = rank;
    }
    rank++;
  }

  return rows;
}

/** 小组赛 + 淘汰赛已录比分合并统计（用于总排名） */
export function computeGroupAndKnockoutStandings(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  matches: Match[],
): StandingRow[] {
  const relevant = matches.filter(
    (m) =>
      (m.phase === 'group' || m.phase === 'knockout') &&
      m.scoreA !== null &&
      m.scoreB !== null,
  );
  const stats = buildEntities(mode, players, teams);
  for (const m of relevant) {
    applyMatchToStats(stats, m);
  }
  return finalizeStandingRows(stats, relevant);
}

export function computeStandings(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  matches: Match[],
): StandingRow[] {
  const relevant = matches.filter((m) => m.phase !== 'knockout');
  const stats = buildEntities(mode, players, teams);

  for (const m of relevant) {
    applyMatchToStats(stats, m);
  }

  return finalizeStandingRows(stats, relevant);
}

export function formatMatchSides(
  sideIds: string[],
  players: Player[],
): string {
  return sideIds
    .map((id) => {
      const p = players.find((pl) => pl.id === id);
      return p ? formatPlayerLabel(p) : S.unknown;
    })
    .join(' / ');
}

export { getEntityLabel };
