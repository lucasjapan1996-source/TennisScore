import type {
  DoublesPairing,
  GroupAssignment,
  Match,
  MatchMode,
  Player,
  ScheduleFormat,
  ScheduleSeedMode,
  Team,
} from '../types';
import {
  buildKnockoutMatches,
  buildPureKnockoutSchedule,
  countKnockoutMatches,
  countPureKnockoutMatches,
  initialKnockoutBracketSize,
} from './knockout';
import { getActiveStrings } from '../i18n';
import {
  buildDoublesPartnerRoundRobinMatches,
  countDoublesPartnerRoundMatches,
} from './doublesRoundRobin';
import { isMatchPlayed } from './score';
import {
  buildCircleRoundRobinRounds,
  buildMatchOrderWithSequentialFirst,
  buildTeamMatchOrderWithSequentialFirst,
  interleaveRoundRobinRounds,
  orderByRestAndFairness,
} from './matchOrder';
import { scheduleSinglesTimeline } from './singlesScheduler';

function uid(): string {
  return crypto.randomUUID();
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function orderEntities<T>(entities: T[], seedMode: ScheduleSeedMode): T[] {
  return seedMode === 'random' ? shuffle(entities) : [...entities];
}

function emptyGroupMatch(
  group: number,
  order: number,
  sideAIds: string[],
  sideBIds: string[],
): Match {
  return {
    id: uid(),
    phase: 'group',
    group,
    knockoutStage: null,
    knockoutRound: null,
    knockoutRank: null,
    slotA: null,
    slotB: null,
    order,
    sideAIds,
    sideBIds,
    scoreA: null,
    scoreB: null,
    tiebreakA: 0,
    tiebreakB: 0,
    sets: [],
    retiredSide: null,
    playedAt: null,
    isBye: false,
    scheduleMarkedDone: false,
  };
}

function emptyRoundRobinMatch(
  order: number,
  sideAIds: string[],
  sideBIds: string[],
): Match {
  return {
    id: uid(),
    phase: 'group',
    group: null,
    knockoutStage: null,
    knockoutRound: null,
    knockoutRank: null,
    slotA: null,
    slotB: null,
    order,
    sideAIds,
    sideBIds,
    scoreA: null,
    scoreB: null,
    tiebreakA: 0,
    tiebreakB: 0,
    sets: [],
    retiredSide: null,
    playedAt: null,
    isBye: false,
    scheduleMarkedDone: false,
  };
}

/** 对战表上的完赛标记（不影响比分与排名逻辑） */
export function isMatchScheduleMarkedDone(m: Match): boolean {
  return m.scheduleMarkedDone === true;
}

/** 录入有效比分后自动标记为完赛（可再手动改 Switch） */
export function applyScheduleMarkAfterScoreUpdate(m: Match): Match {
  if (isMatchPlayed(m)) {
    return { ...m, scheduleMarkedDone: true };
  }
  return m;
}

export function assignGroups<T>(
  entities: T[],
  groupCount: number,
  idOf: (e: T) => string,
  seedMode: ScheduleSeedMode,
): GroupAssignment[] {
  const ordered = orderEntities(entities, seedMode);
  const buckets: T[][] = Array.from({ length: groupCount }, () => []);
  ordered.forEach((e, i) => {
    buckets[i % groupCount].push(e);
  });
  return buckets
    .map((members, idx) => ({
      id: idx + 1,
      memberIds: members.map((m) => idOf(m)),
    }))
    .filter((g) => g.memberIds.length > 0);
}

/** @deprecated 使用 assignGroups */
export function assignRandomGroups<T>(
  entities: T[],
  groupCount: number,
  idOf: (e: T) => string,
): GroupAssignment[] {
  return assignGroups(entities, groupCount, idOf, 'random');
}

export interface ScheduleResult {
  matches: Match[];
  groups: GroupAssignment[];
}

function buildMatchesFromPairings<T>(
  pairings: [T, T][],
  group: number | null,
  startOrder: number,
  sideIds: (e: T) => string[],
): { matches: Match[]; nextOrder: number } {
  const matches: Match[] = [];
  let order = startOrder;
  for (const [a, b] of pairings) {
    if (group === null) {
      matches.push(emptyRoundRobinMatch(order++, sideIds(a), sideIds(b)));
    } else {
      matches.push(emptyGroupMatch(group, order++, sideIds(a), sideIds(b)));
    }
  }
  return { matches, nextOrder: order };
}

/** 轮换搭档：按签位顺序或随机打乱后相邻两人一队 */
export function buildDoublesTeamsFromPlayers(
  players: Player[],
  seedMode: ScheduleSeedMode,
): Team[] {
  return autoPairPlayers(orderEntities(players, seedMode));
}

export function buildRoundRobinSchedule(
  players: Player[],
  teams: Team[],
  mode: MatchMode,
  seedMode: ScheduleSeedMode = 'random',
  doublesPairing: DoublesPairing = 'fixed',
): ScheduleResult {
  if (mode === 'singles') {
    const ordered = orderEntities(players, seedMode);
    const matchOrder = buildMatchOrderWithSequentialFirst(
      ordered,
      (p) => p.id,
      seedMode,
    );
    const { matches } = buildMatchesFromPairings(
      matchOrder,
      null,
      1,
      (p) => [p.id],
    );
    return { matches, groups: [] };
  }

  if (doublesPairing === 'rotating') {
    const orderedIds = orderEntities(players, seedMode).map((p) => p.id);
    const matches = buildDoublesPartnerRoundRobinMatches(
      orderedIds,
      (order, sideAIds, sideBIds) =>
        emptyRoundRobinMatch(order, sideAIds, sideBIds),
      1,
      seedMode,
    );
    return { matches, groups: [] };
  }

  const orderedTeams = orderEntities(teams, seedMode);
  const matchOrder = buildTeamMatchOrderWithSequentialFirst(
    orderedTeams,
    (t) => t.id,
    seedMode,
  );
  const { matches } = buildMatchesFromPairings(
    matchOrder,
    null,
    1,
    (t) => [...t.playerIds],
  );
  return { matches, groups: [] };
}

export function buildGroupStageSchedule(
  players: Player[],
  teams: Team[],
  mode: MatchMode,
  groupCount: number,
  seedMode: ScheduleSeedMode = 'random',
): ScheduleResult {
  if (mode === 'singles') {
    const groups = assignGroups(players, groupCount, (p) => p.id, seedMode);
    const matches: Match[] = [];
    let order = 1;

    if (seedMode === 'sequential') {
      for (const g of groups) {
        const members = g.memberIds
          .map((id) => players.find((p) => p.id === id))
          .filter((p): p is Player => !!p);
        if (members.length < 2) continue;
        const ordered = orderEntities(members, seedMode);
        const matchOrder = buildMatchOrderWithSequentialFirst(
          ordered,
          (p) => p.id,
          seedMode,
        );
        for (const [a, b] of matchOrder) {
          matches.push(emptyGroupMatch(g.id, order++, [a.id], [b.id]));
        }
      }
    } else {
      const roundsPerGroup: [Player, Player][][][] = [];
      for (const g of groups) {
        const members = g.memberIds
          .map((id) => players.find((p) => p.id === id))
          .filter((p): p is Player => !!p);
        if (members.length < 2) continue;
        roundsPerGroup.push(
          buildCircleRoundRobinRounds(orderEntities(members, seedMode)),
        );
      }
      const flat = interleaveRoundRobinRounds(roundsPerGroup) as [
        Player,
        Player,
      ][];
      const allIds = [...new Set(flat.flatMap(([a, b]) => [a.id, b.id]))];
      const matchOrder = scheduleSinglesTimeline(
        flat.map(([a, b]) => [a.id, b.id] as const),
        allIds,
        seedMode,
      ).map(([aId, bId]) => {
        const byId = new Map(players.map((p) => [p.id, p]));
        return [byId.get(aId)!, byId.get(bId)!] as [Player, Player];
      });
      for (const [a, b] of matchOrder) {
        const groupId =
          groups.find(
            (g) => g.memberIds.includes(a.id) && g.memberIds.includes(b.id),
          )?.id ?? 1;
        matches.push(emptyGroupMatch(groupId, order++, [a.id], [b.id]));
      }
    }

    const knockout = buildKnockoutMatches(groups, order, seedMode);
    matches.push(...knockout.matches);
    return { matches, groups };
  }

  const groups = assignGroups(teams, groupCount, (t) => t.id, seedMode);
  const matches: Match[] = [];
  let order = 1;

  if (seedMode === 'sequential') {
    for (const g of groups) {
      const members = g.memberIds
        .map((id) => teams.find((t) => t.id === id))
        .filter((t): t is Team => !!t);
      if (members.length < 2) continue;
      const ordered = orderEntities(members, seedMode);
      const matchOrder = buildTeamMatchOrderWithSequentialFirst(
        ordered,
        (t) => t.id,
        seedMode,
      );
      for (const [ta, tb] of matchOrder) {
        matches.push(
          emptyGroupMatch(g.id, order++, [...ta.playerIds], [...tb.playerIds]),
        );
      }
    }
  } else {
    const roundsPerGroup: [Team, Team][][][] = [];
    for (const g of groups) {
      const members = g.memberIds
        .map((id) => teams.find((t) => t.id === id))
        .filter((t): t is Team => !!t);
      if (members.length < 2) continue;
      roundsPerGroup.push(
        buildCircleRoundRobinRounds(orderEntities(members, seedMode)),
      );
    }
    const matchOrder = orderByRestAndFairness(
      interleaveRoundRobinRounds(roundsPerGroup),
      ([ta, tb]) => [ta.id, tb.id],
    );
    for (const [ta, tb] of matchOrder) {
      const groupId =
        groups.find(
          (g) =>
            g.memberIds.includes(ta.id) && g.memberIds.includes(tb.id),
        )?.id ?? 1;
      matches.push(
        emptyGroupMatch(groupId, order++, [...ta.playerIds], [...tb.playerIds]),
      );
    }
  }

  const knockout = buildKnockoutMatches(groups, order, seedMode);
  matches.push(...knockout.matches);
  return { matches, groups };
}

export function estimateMatchCount(
  entityCount: number,
  scheduleFormat: ScheduleFormat,
  groupCount: number,
  options?: {
    mode?: MatchMode;
    playerCount?: number;
    doublesPairing?: DoublesPairing;
  },
): number {
  if (entityCount < 2) return 0;
  if (scheduleFormat === 'knockout') {
    return countPureKnockoutMatches(entityCount);
  }
  if (scheduleFormat === 'round_robin') {
    if (
      options?.mode === 'doubles' &&
      options.doublesPairing === 'rotating'
    ) {
      const n = options.playerCount ?? entityCount * 2;
      return countDoublesPartnerRoundMatches(n);
    }
    return (entityCount * (entityCount - 1)) / 2;
  }
  const base = Math.floor(entityCount / groupCount);
  const rem = entityCount % groupCount;
  let total = 0;
  const sizes: number[] = [];
  for (let i = 0; i < groupCount; i++) {
    const n = base + (i < rem ? 1 : 0);
    sizes.push(n);
    if (n >= 2) total += (n * (n - 1)) / 2;
  }
  const minSize = sizes.length > 0 ? Math.min(...sizes) : 0;
  total += countKnockoutMatches(groupCount, minSize);
  return total;
}

/** 网球淘汰赛仅决冠亚军，过滤历史数据中的季军赛 */
export function withoutThirdPlaceMatches(
  matches: Match[],
  scheduleFormat: ScheduleFormat,
): Match[] {
  if (scheduleFormat === 'round_robin') return matches;
  return matches.filter((m) => m.knockoutStage !== 'third');
}

export function groupMatchesBySection(
  matches: Match[],
  scheduleFormat?: ScheduleFormat,
): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  const list =
    scheduleFormat !== undefined
      ? withoutThirdPlaceMatches(matches, scheduleFormat)
      : matches;
  const sorted = [...list].sort((a, b) => a.order - b.order);
  for (const m of sorted) {
    const key =
      m.phase === 'knockout'
        ? 'knockout'
        : m.group === null
          ? 'all'
          : `g${m.group}`;
    const list = map.get(key) ?? [];
    list.push(m);
    if (key === 'knockout') {
      list.sort(
        (a, b) =>
          (a.knockoutRank ?? 0) - (b.knockoutRank ?? 0) || a.order - b.order,
      );
    }
    map.set(key, list);
  }
  return map;
}

/** 按 scheduleBatchSizes 切分对阵批次（用于多块对阵矩阵） */
export function splitMatchesByBatches(
  matches: Match[],
  batchSizes: number[],
): Match[][] {
  const sorted = [...matches].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return [];
  if (batchSizes.length === 0) return [sorted];

  const batches: Match[][] = [];
  let cursor = 0;
  for (const size of batchSizes) {
    if (size <= 0) continue;
    batches.push(sorted.slice(cursor, cursor + size));
    cursor += size;
  }
  if (cursor < sorted.length) {
    batches.push(sorted.slice(cursor));
  }
  return batches.filter((b) => b.length > 0);
}

export function matchPairKey(sideAIds: string[], sideBIds: string[]): string {
  const a = [...sideAIds].sort().join(',');
  const b = [...sideBIds].sort().join(',');
  return [a, b].sort().join('|');
}

export function autoPairPlayers(players: Player[]): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i + 1 < players.length; i += 2) {
    teams.push({
      id: uid(),
      playerIds: [players[i].id, players[i + 1].id],
    });
  }
  return teams;
}

/**
 * 修改一队搭档后，其余队伍自动用剩余球员按列表顺序重新配对。
 * 例：原 1+2 / 3+4，改为 1+3 后 → 2+4。
 */
export function applyTeamPairChange(
  teams: Team[],
  teamIndex: number,
  playerAId: string,
  playerBId: string,
  playerOrder: string[],
): Team[] {
  if (
    playerAId === playerBId ||
    teamIndex < 0 ||
    teamIndex >= teams.length
  ) {
    return teams;
  }

  const result = teams.map((t) => ({
    ...t,
    playerIds: [...t.playerIds] as [string, string],
  }));

  result[teamIndex] = {
    ...result[teamIndex],
    playerIds: [playerAId, playerBId],
  };

  const locked = new Set([playerAId, playerBId]);
  const pool: string[] = [];

  for (let i = 0; i < result.length; i++) {
    if (i === teamIndex) continue;
    const [p0, p1] = result[i].playerIds;
    if (locked.has(p0) || locked.has(p1)) {
      if (!locked.has(p0)) pool.push(p0);
      if (!locked.has(p1)) pool.push(p1);
      result[i].playerIds = ['', ''];
    }
  }

  const assigned = new Set<string>();
  for (const t of result) {
    for (const id of t.playerIds) {
      if (id) assigned.add(id);
    }
  }
  for (const id of playerOrder) {
    if (!assigned.has(id)) pool.push(id);
  }

  const sortedPool = [...new Set(pool)].sort(
    (a, b) => playerOrder.indexOf(a) - playerOrder.indexOf(b),
  );

  let cursor = 0;
  for (let i = 0; i < result.length; i++) {
    if (i === teamIndex) continue;
    const [p0, p1] = result[i].playerIds;
    if (!p0 || !p1 || locked.has(p0) || locked.has(p1)) {
      const nextA = sortedPool[cursor++];
      const nextB = sortedPool[cursor++];
      if (nextA && nextB) {
        result[i].playerIds = [nextA, nextB];
      }
    }
  }

  return result;
}

export function validateBeforeSchedule(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  scheduleFormat: ScheduleFormat,
  groupCount: number,
  doublesPairing: DoublesPairing = 'fixed',
): string | null {
  if (players.length < 2) return getActiveStrings().errMinPlayers;
  if (mode === 'doubles') {
    if (players.length % 2 !== 0) return getActiveStrings().errDoublesEven;
    if (doublesPairing === 'rotating') {
      if (scheduleFormat === 'round_robin' && players.length < 4) {
        return getActiveStrings().errDoublesPartnerMin;
      }
      if (scheduleFormat !== 'round_robin' && players.length < 4) {
        return getActiveStrings().errDoublesPartnerMin;
      }
    } else {
      if (teams.length < 2) return getActiveStrings().errMinTeams;
      const used = new Set(teams.flatMap((t) => t.playerIds));
      if (used.size !== players.length) return getActiveStrings().errTeamCoverage;
    }
  }
  if (scheduleFormat === 'group_stage') {
    const entityCount = mode === 'singles' ? players.length : teams.length;
    if (groupCount < 2) return getActiveStrings().errMinGroups;
    if (groupCount > entityCount) return getActiveStrings().errGroupsTooMany;
    const minPerGroup = Math.floor(entityCount / groupCount);
    if (minPerGroup < 2 && entityCount < groupCount * 2) {
      return getActiveStrings().errGroupsTooSmall;
    }
  }
  if (scheduleFormat === 'knockout' || scheduleFormat === 'group_stage') {
    const entityCount = mode === 'singles' ? players.length : teams.length;
    const bracketSize =
      scheduleFormat === 'knockout'
        ? initialKnockoutBracketSize(entityCount)
        : initialKnockoutBracketSize(groupCount);
    if (bracketSize > 32) return getActiveStrings().errKnockoutTooMany;
  }
  return null;
}

export function buildKnockoutOnlySchedule(
  players: Player[],
  teams: Team[],
  mode: MatchMode,
  seedMode: ScheduleSeedMode = 'random',
): ScheduleResult {
  const result = buildPureKnockoutSchedule(players, teams, mode, seedMode);
  return { matches: result.matches, groups: [] };
}

/** 按当前赛事设置生成完整对阵（与「生成对阵」相同规则） */
export function buildScheduleFromSettings(
  players: Player[],
  teams: Team[],
  mode: MatchMode,
  scheduleFormat: ScheduleFormat,
  groupCount: number,
  seedMode: ScheduleSeedMode,
  doublesPairing: DoublesPairing,
): ScheduleResult {
  const scheduleTeams =
    mode === 'doubles' && doublesPairing === 'rotating'
      ? buildDoublesTeamsFromPlayers(players, seedMode)
      : teams;
  if (scheduleFormat === 'group_stage') {
    return buildGroupStageSchedule(
      players,
      scheduleTeams,
      mode,
      groupCount,
      seedMode,
    );
  }
  if (scheduleFormat === 'knockout') {
    return buildKnockoutOnlySchedule(
      players,
      scheduleTeams,
      mode,
      seedMode,
    );
  }
  return buildRoundRobinSchedule(
    players,
    scheduleTeams,
    mode,
    seedMode,
    doublesPairing,
  );
}

/** 在现有对阵后追加一批（同规则完整生成，场次序号续编） */
export function appendScheduleMatches(
  existingMatches: Match[],
  players: Player[],
  teams: Team[],
  mode: MatchMode,
  scheduleFormat: ScheduleFormat,
  groupCount: number,
  seedMode: ScheduleSeedMode,
  doublesPairing: DoublesPairing,
): { matches: Match[]; groups: GroupAssignment[]; appendedCount: number } {
  const batch = buildScheduleFromSettings(
    players,
    teams,
    mode,
    scheduleFormat,
    groupCount,
    seedMode,
    doublesPairing,
  );
  const maxOrder = existingMatches.reduce(
    (max, m) => Math.max(max, m.order),
    0,
  );
  const appended = batch.matches.map((m, i) => ({
    ...m,
    id: uid(),
    order: maxOrder + i + 1,
  }));
  return {
    matches: [...existingMatches, ...appended],
    groups: batch.groups,
    appendedCount: appended.length,
  };
}
