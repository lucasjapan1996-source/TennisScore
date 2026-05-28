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
import { resolveMatchSides, type ResolveSidesTournament } from './knockout';
import {
  getMatchWinnerSide,
  isRetired,
  matchHasRecordedScore,
} from './matchOutcome';
import { formatPlayerLabel, formatSideCompactLabel } from './player';
import { isMatchPlayed } from './score';
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

/** 混合赛同分时：含女球员的一方/球员靠前 */
function mixedGenderPriority(
  entityId: string,
  byPlayer: boolean,
  players: Player[],
  teams: Team[],
): number {
  let ids: string[];
  if (byPlayer) {
    ids = [entityId];
  } else {
    const team = teams.find(
      (t) => t.id === entityId || entityKey(t.playerIds) === entityId,
    );
    ids = team ? [...team.playerIds] : entityId.split(',');
  }
  return ids.some((id) => players.find((p) => p.id === id)?.gender === 'female')
    ? 1
    : 0;
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
    return computeStandings(mode, subset, [], groupMatches, tournament, {
      groupPhase: true,
    });
  }

  const subsetTeams = teams.filter((t) => memberSet.has(t.id));
  return computeStandings(
    mode,
    players,
    subsetTeams,
    groupMatches,
    tournament,
    { groupPhase: true },
  );
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

type FinalizeOptions = { groupPhase?: boolean };

export function standingEntityId(
  sideIds: string[],
  tournament: StandingTournamentFields,
): string | null {
  if (sideIds.length === 0) return null;
  if (usesPlayerStandings(tournament.mode, tournament)) {
    return sideIds[0] ?? null;
  }
  return entityKey(sideIds);
}

function groupMemberToEntityId(
  memberId: string,
  mode: MatchMode,
  teams: Team[],
): string {
  if (mode === 'singles') return memberId;
  const team = teams.find((t) => t.id === memberId);
  return team ? entityKey(team.playerIds) : memberId;
}

function compareGroupPhaseStats(
  entityA: string,
  entityB: string,
  groupMatches: Match[],
  tournament: StandingTournamentFields,
  players: Player[],
  teams: Team[],
): number {
  const showGender = showPlayerGender(tournament.category);
  const stats = buildEntities(
    tournament.mode,
    players,
    teams,
    showGender,
    tournament,
  );
  for (const m of groupMatches) {
    applyMatchToStats(stats, m, tournament);
  }
  const a = stats.get(entityA);
  const b = stats.get(entityB);
  if (!a || !b) return 0;
  if (b.wins !== a.wins) return b.wins - a.wins;
  const byPlayer = usesPlayerStandings(tournament.mode, tournament);
  const h2h = byPlayer
    ? headToHeadPlayerWins(groupMatches, entityA, entityB)
    : headToHeadWins(groupMatches, entityA, entityB);
  if (h2h !== 0) return h2h > 0 ? -1 : 1;
  if (tournament.category === 'mixed') {
    const gx = mixedGenderPriority(entityA, byPlayer, players, teams);
    const gy = mixedGenderPriority(entityB, byPlayer, players, teams);
    if (gy !== gx) return gy - gx;
  }
  return a.label.localeCompare(b.label, 'zh-CN');
}

function collectTierEntrantIds(
  tier: number,
  groups: GroupAssignment[],
  matches: Match[],
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  tournament: StandingTournamentFields,
): string[] {
  const sorted = [...groups].sort((a, b) => a.id - b.id);
  return sorted
    .map((g) => {
      const standings = computeGroupStandings(
        g.id,
        mode,
        players,
        teams,
        groups,
        matches,
        tournament,
      );
      const row = standings.find((r) => r.rank === tier);
      if (row) return row.id;
      const fallbackMember = g.memberIds[tier - 1];
      return fallbackMember
        ? groupMemberToEntityId(fallbackMember, mode, teams)
        : null;
    })
    .filter((id): id is string => id != null);
}

function resolvedMatchWinnerLoser(
  m: Match,
  tournament: ResolveSidesTournament & StandingTournamentFields,
  players: Player[],
): { winnerId: string; loserId: string | null } | null {
  const showGender = showPlayerGender(tournament.category);
  const resolved = resolveMatchSides(m, tournament, (ids, pls) =>
    formatSideCompactLabel(ids, pls, showGender),
  );
  if (m.isBye) {
    const ids =
      resolved.sideAIds.length > 0 ? resolved.sideAIds : resolved.sideBIds;
    const winnerId = standingEntityId(ids, tournament);
    return winnerId ? { winnerId, loserId: null } : null;
  }
  if (!isMatchPlayed(m) || !resolved.ready) return null;
  const winnerSide = getMatchWinnerSide(m, resolveMatchBestOf(m, tournament));
  if (!winnerSide) return null;
  const winIds = winnerSide === 'A' ? resolved.sideAIds : resolved.sideBIds;
  const loseIds = winnerSide === 'A' ? resolved.sideBIds : resolved.sideAIds;
  const winnerId = standingEntityId(winIds, tournament);
  const loserId = standingEntityId(loseIds, tournament);
  if (!winnerId) return null;
  return { winnerId, loserId };
}

function entityKnockoutDepthInTier(
  entityId: string,
  tierMatches: Match[],
  resolveCtx: ResolveSidesTournament & StandingTournamentFields,
  players: Player[],
): number {
  let best = 0;
  for (const m of tierMatches) {
    const round = m.knockoutRound ?? 0;
    const wl = resolvedMatchWinnerLoser(m, resolveCtx, players);
    if (!wl) continue;
    if (wl.loserId === entityId) return round;
    if (wl.winnerId === entityId) best = Math.max(best, round);
  }
  return best;
}

/** 两组赛制：各组第 tier 名仅交叉一场，胜者=档内第1、败者=档内第2 */
function computeTwoGroupCrossTierPlacements(
  tier: number,
  tierMatches: Match[],
  groups: GroupAssignment[],
  matches: Match[],
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  tournament: StandingTournamentFields,
): Map<string, number> {
  const placements = new Map<string, number>();
  const tierEntrants = collectTierEntrantIds(
    tier,
    groups,
    matches,
    mode,
    players,
    teams,
    tournament,
  );
  if (tierEntrants.length === 0) return placements;

  const resolveCtx = {
    ...tournament,
    matches,
    players,
    teams,
    groups,
  } as ResolveSidesTournament & StandingTournamentFields;

  const crossMatch =
    tierMatches.find(
      (m) =>
        !m.isBye &&
        (m.knockoutStage === 'final' || m.knockoutStage === 'cross'),
    ) ?? tierMatches.find((m) => !m.isBye);

  if (crossMatch) {
    const wl = resolvedMatchWinnerLoser(crossMatch, resolveCtx, players);
    if (wl?.loserId) {
      placements.set(wl.winnerId, 1);
      placements.set(wl.loserId, 2);
      return placements;
    }
  }

  const groupMatches = matches.filter((m) => m.phase === 'group');
  const sorted = [...tierEntrants].sort((a, b) =>
    compareGroupPhaseStats(a, b, groupMatches, tournament, players, teams),
  );
  placements.set(sorted[0]!, 1);
  if (sorted[1]) placements.set(sorted[1], 2);
  return placements;
}

function computeKnockoutTierPlacements(
  tier: number,
  tierMatches: Match[],
  groups: GroupAssignment[],
  matches: Match[],
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  tournament: StandingTournamentFields,
): Map<string, number> {
  if (groups.length === 2) {
    return computeTwoGroupCrossTierPlacements(
      tier,
      tierMatches,
      groups,
      matches,
      mode,
      players,
      teams,
      tournament,
    );
  }

  const placements = new Map<string, number>();
  const tierEntrants = collectTierEntrantIds(
    tier,
    groups,
    matches,
    mode,
    players,
    teams,
    tournament,
  );
  const blockSize = tierEntrants.length;
  if (blockSize === 0) return placements;

  const playable = tierMatches.filter((m) => !m.isBye);
  const maxRound = playable.reduce(
    (mx, m) => Math.max(mx, m.knockoutRound ?? 0),
    0,
  );

  const resolveCtx = {
    ...tournament,
    matches,
    players,
    teams,
    groups,
  } as ResolveSidesTournament & StandingTournamentFields;

  let place = 1;

  if (maxRound > 0) {
    const topRound = playable.filter((m) => (m.knockoutRound ?? 0) === maxRound);
    const final =
      topRound.find(
        (m) => m.knockoutStage === 'final' || m.knockoutStage === 'cross',
      ) ?? topRound[topRound.length - 1];

    if (final) {
      const wl = resolvedMatchWinnerLoser(final, resolveCtx, players);
      if (wl?.loserId) {
        placements.set(wl.winnerId, 1);
        placements.set(wl.loserId, 2);
        place = 3;
      }
    }

    for (let round = maxRound - 1; round >= 1; round--) {
      const roundMatches = playable
        .filter((m) => (m.knockoutRound ?? 0) === round)
        .sort((a, b) => a.order - b.order);
      for (const m of roundMatches) {
        const wl = resolvedMatchWinnerLoser(m, resolveCtx, players);
        if (!wl?.loserId || placements.has(wl.loserId)) continue;
        placements.set(wl.loserId, place++);
      }
    }
  }

  const groupMatches = matches.filter((m) => m.phase === 'group');
  const unplaced = tierEntrants.filter((id) => !placements.has(id));
  if (unplaced.length > 0) {
    const sorted = [...unplaced].sort((a, b) => {
      const depthB = entityKnockoutDepthInTier(b, tierMatches, resolveCtx, players);
      const depthA = entityKnockoutDepthInTier(a, tierMatches, resolveCtx, players);
      if (depthB !== depthA) return depthB - depthA;
      return compareGroupPhaseStats(
        a,
        b,
        groupMatches,
        tournament,
        players,
        teams,
      );
    });
    for (const id of sorted) {
      placements.set(id, place++);
    }
  }

  while (place <= blockSize) {
    const missing = tierEntrants.find((id) => !placements.has(id));
    if (!missing) break;
    placements.set(missing, place++);
  }

  return placements;
}

function finalizeStandingRows(
  stats: Map<string, EntityStats>,
  relevant: Match[],
  tournament: StandingTournamentFields,
  players: Player[],
  teams: Team[],
  options: FinalizeOptions = {},
): StandingRow[] {
  const byPlayer = usesPlayerStandings(tournament.mode, tournament);
  const groupPhase = options.groupPhase === true;
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
    if (groupPhase) {
      if (y.wins !== x.wins) return y.wins - x.wins;
      const h2h = byPlayer
        ? headToHeadPlayerWins(relevant, x.id, y.id)
        : headToHeadWins(relevant, x.id, y.id);
      if (h2h !== 0) return h2h > 0 ? -1 : 1;
      if (y.gameDiff !== x.gameDiff) return y.gameDiff - x.gameDiff;
      if (y.gamesFor !== x.gamesFor) return y.gamesFor - x.gamesFor;
    } else if (byPlayer) {
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
    if (tournament.category === 'mixed') {
      const gx = mixedGenderPriority(x.id, byPlayer, players, teams);
      const gy = mixedGenderPriority(y.id, byPlayer, players, teams);
      if (gy !== gx) return gy - gx;
    }
    return x.label.localeCompare(y.label, 'zh-CN');
  });

  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    const tiedWithPrev =
      i > 0 &&
      (groupPhase
        ? rows[i].wins === rows[i - 1].wins &&
          (byPlayer
            ? headToHeadPlayerWins(relevant, rows[i].id, rows[i - 1].id) === 0
            : headToHeadWins(relevant, rows[i].id, rows[i - 1].id) === 0) &&
          rows[i].gameDiff === rows[i - 1].gameDiff
        : rows[i].gamesFor === rows[i - 1].gamesFor &&
          (byPlayer
            ? rows[i].gameDiff === rows[i - 1].gameDiff &&
              rows[i].wins === rows[i - 1].wins
            : rows[i].wins === rows[i - 1].wins &&
              rows[i].gameDiff === rows[i - 1].gameDiff));
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

/**
 * 小组赛最终排名：各组第 k 名进入第 k 档交叉淘汰。
 * 两组时：A 组第 k 名 vs B 组第 k 名，胜者总第 (2k-1) 名、败者总第 2k 名。
 * 多组时：同档内按签表淘汰决出名次，总第 (k-1)*G+1 … (k-1)*G+G 名（G=组数）。
 */
export function computeGroupStageFinalStandings(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  groups: GroupAssignment[],
  matches: Match[],
  tournament: StandingTournamentFields,
): StandingRow[] {
  const numGroups = groups.length;
  if (numGroups === 0) return [];

  const maxTier = Math.min(...groups.map((g) => g.memberIds.length));
  if (!Number.isFinite(maxTier) || maxTier < 1) return [];

  const globalPlacements = new Map<string, number>();

  for (let tier = 1; tier <= maxTier; tier++) {
    const tierMatches = matches.filter(
      (m) => m.phase === 'knockout' && m.knockoutRank === tier,
    );
    const tierMap = computeKnockoutTierPlacements(
      tier,
      tierMatches,
      groups,
      matches,
      mode,
      players,
      teams,
      tournament,
    );
    const base = (tier - 1) * numGroups;
    for (const [entityId, placeInTier] of tierMap) {
      globalPlacements.set(entityId, base + placeInTier);
    }
  }

  let tailPlace =
    maxTier * numGroups +
    1;
  for (const g of groups) {
    for (const memberId of g.memberIds) {
      const entityId = groupMemberToEntityId(memberId, mode, teams);
      if (!globalPlacements.has(entityId)) {
        globalPlacements.set(entityId, tailPlace++);
      }
    }
  }

  const showGender = showPlayerGender(tournament.category);
  const stats = buildEntities(mode, players, teams, showGender, tournament);

  const sorted = [...globalPlacements.entries()].sort((a, b) => a[1] - b[1]);

  return sorted.map(([entityId], index) => {
    const s = stats.get(entityId);
    return {
      id: entityId,
      label: s?.label ?? entityId,
      played: s?.played ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      gamesFor: 0,
      gamesAgainst: 0,
      gameDiff: 0,
      winRate: 0,
      rank: index + 1,
    };
  });
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
  return finalizeStandingRows(stats, relevant, tournament, players, teams);
}

export function computeStandings(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  matches: Match[],
  tournament: StandingTournamentFields,
  options: FinalizeOptions = {},
): StandingRow[] {
  const relevant = matches.filter(
    (m) => m.phase !== 'knockout' && isStandingMatch(m),
  );
  const showGender = showPlayerGender(tournament.category);
  const stats = buildEntities(mode, players, teams, showGender, tournament);

  for (const m of relevant) {
    applyMatchToStats(stats, m, tournament);
  }

  return finalizeStandingRows(
    stats,
    relevant,
    tournament,
    players,
    teams,
    options,
  );
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
