import type {
  GroupAssignment,
  Match,
  MatchMode,
  Player,
  ScheduleFormat,
  Team,
} from '../types';
import {
  buildKnockoutMatches,
  buildPureKnockoutSchedule,
  countKnockoutMatches,
  countPureKnockoutMatches,
  nextPowerOfTwo,
} from './knockout';
import { S } from '../strings';

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

function allPairings<T>(entities: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      pairs.push([entities[i], entities[j]]);
    }
  }
  return pairs;
}

/** 排程：尽量避免同一选手/队伍连续上场 */
export function orderPairingsNoBackToBack<T>(
  pairings: [T, T][],
  idOf: (e: T) => string,
): [T, T][] {
  const remaining = [...pairings];
  const ordered: [T, T][] = [];
  let last = new Set<string>();

  while (remaining.length > 0) {
    let pick = 0;
    let bestConflict = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const ids = new Set([idOf(remaining[i][0]), idOf(remaining[i][1])]);
      const conflict = [...ids].filter((id) => last.has(id)).length;
      if (conflict < bestConflict) {
        bestConflict = conflict;
        pick = i;
        if (conflict === 0) break;
      }
    }
    const [a, b] = remaining.splice(pick, 1)[0];
    ordered.push([a, b]);
    last = new Set([idOf(a), idOf(b)]);
  }

  return ordered;
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
    playedAt: null,
    isBye: false,
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
    playedAt: null,
    isBye: false,
  };
}

export function assignRandomGroups<T>(
  entities: T[],
  groupCount: number,
  idOf: (e: T) => string,
): GroupAssignment[] {
  const shuffled = shuffle(entities);
  const buckets: T[][] = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((e, i) => {
    buckets[i % groupCount].push(e);
  });
  return buckets
    .map((members, idx) => ({
      id: idx + 1,
      memberIds: members.map((m) => idOf(m)),
    }))
    .filter((g) => g.memberIds.length > 0);
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

export function buildRoundRobinSchedule(
  players: Player[],
  teams: Team[],
  mode: MatchMode,
): ScheduleResult {
  if (mode === 'singles') {
    const shuffled = shuffle(players);
    const pairings = allPairings(shuffled);
    const ordered = orderPairingsNoBackToBack(pairings, (p) => p.id);
    const { matches } = buildMatchesFromPairings(
      ordered,
      null,
      1,
      (p) => [p.id],
    );
    return { matches, groups: [] };
  }

  const shuffled = shuffle(teams);
  const pairings = allPairings(shuffled);
  const ordered = orderPairingsNoBackToBack(pairings, (t) => t.id);
  const { matches } = buildMatchesFromPairings(
    ordered,
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
): ScheduleResult {
  if (mode === 'singles') {
    const groups = assignRandomGroups(players, groupCount, (p) => p.id);
    const matches: Match[] = [];
    let order = 1;
    for (const g of groups) {
      const members = g.memberIds
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => !!p);
      if (members.length < 2) continue;
      const pairings = allPairings(shuffle(members));
      const ordered = orderPairingsNoBackToBack(pairings, (p) => p.id);
      const built = buildMatchesFromPairings(
        ordered,
        g.id,
        order,
        (p) => [p.id],
      );
      matches.push(...built.matches);
      order = built.nextOrder;
    }
    const knockout = buildKnockoutMatches(groups, order);
    matches.push(...knockout.matches);
    return { matches, groups };
  }

  const groups = assignRandomGroups(teams, groupCount, (t) => t.id);
  const matches: Match[] = [];
  let order = 1;
  for (const g of groups) {
    const members = g.memberIds
      .map((id) => teams.find((t) => t.id === id))
      .filter((t): t is Team => !!t);
    if (members.length < 2) continue;
    const pairings = allPairings(shuffle(members));
    const ordered = orderPairingsNoBackToBack(pairings, (t) => t.id);
    const built = buildMatchesFromPairings(
      ordered,
      g.id,
      order,
      (t) => [...t.playerIds],
    );
    matches.push(...built.matches);
    order = built.nextOrder;
  }
  const knockout = buildKnockoutMatches(groups, order);
  matches.push(...knockout.matches);
  return { matches, groups };
}

export function estimateMatchCount(
  entityCount: number,
  scheduleFormat: ScheduleFormat,
  groupCount: number,
): number {
  if (entityCount < 2) return 0;
  if (scheduleFormat === 'knockout') {
    return countPureKnockoutMatches(entityCount);
  }
  if (scheduleFormat === 'round_robin') {
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

export function validateBeforeSchedule(
  mode: MatchMode,
  players: Player[],
  teams: Team[],
  scheduleFormat: ScheduleFormat,
  groupCount: number,
): string | null {
  if (players.length < 2) return S.errMinPlayers;
  if (mode === 'doubles') {
    if (players.length % 2 !== 0) return S.errDoublesEven;
    if (teams.length < 2) return S.errMinTeams;
    const used = new Set(teams.flatMap((t) => t.playerIds));
    if (used.size !== players.length) return S.errTeamCoverage;
  }
  if (scheduleFormat === 'group_stage') {
    const entityCount = mode === 'singles' ? players.length : teams.length;
    if (groupCount < 2) return S.errMinGroups;
    if (groupCount > entityCount) return S.errGroupsTooMany;
    const minPerGroup = Math.floor(entityCount / groupCount);
    if (minPerGroup < 2 && entityCount < groupCount * 2) {
      return S.errGroupsTooSmall;
    }
  }
  if (scheduleFormat === 'knockout' || scheduleFormat === 'group_stage') {
    const entityCount = mode === 'singles' ? players.length : teams.length;
    const bracketSize =
      scheduleFormat === 'knockout'
        ? nextPowerOfTwo(entityCount)
        : nextPowerOfTwo(groupCount);
    if (bracketSize > 32) return S.errKnockoutTooMany;
  }
  return null;
}

export function buildKnockoutOnlySchedule(
  players: Player[],
  teams: Team[],
  mode: MatchMode,
): ScheduleResult {
  const result = buildPureKnockoutSchedule(players, teams, mode);
  return { matches: result.matches, groups: [] };
}
