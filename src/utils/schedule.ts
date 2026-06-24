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
  scheduleItemsIntoCourtWaves,
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

/** 固定双打编组要求偶数球员 */
export function isFixedDoublesPairingAllowed(playerCount: number): boolean {
  return playerCount >= 2 && playerCount % 2 === 0;
}

/** 奇数球员时强制轮换搭档 */
export function normalizeDoublesPairingForPlayers(
  mode: MatchMode,
  pairing: DoublesPairing,
  playerCount: number,
): DoublesPairing {
  if (mode !== 'doubles') return pairing;
  if (pairing === 'fixed' && !isFixedDoublesPairingAllowed(playerCount)) {
    return 'rotating';
  }
  return pairing;
}

/** 双打排程/分组用的实体数量 */
export function doublesScheduleEntityCount(
  playerCount: number,
  teams: Team[],
  doublesPairing: DoublesPairing,
): number {
  if (doublesPairing === 'rotating') return playerCount;
  return teams.length;
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
    courtWave: null,
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
    courtWave: null,
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

function buildGroupStageRotatingDoublesSchedule(
  players: Player[],
  groupCount: number,
  seedMode: ScheduleSeedMode,
): ScheduleResult {
  const groups = assignGroups(players, groupCount, (p) => p.id, seedMode);
  const matches: Match[] = [];
  let order = 1;

  if (seedMode === 'sequential') {
    for (const g of groups) {
      const members = g.memberIds
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => !!p);
      if (members.length < 4) continue;
      const ordered = orderEntities(members, seedMode);
      const batch = buildDoublesPartnerRoundRobinMatches(
        ordered.map((p) => p.id),
        (o, sideAIds, sideBIds) => emptyGroupMatch(g.id, o, sideAIds, sideBIds),
        order,
        seedMode,
      );
      matches.push(...batch);
      order += batch.length;
    }
  } else {
    for (const g of groups) {
      const members = g.memberIds
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => !!p);
      if (members.length < 4) continue;
      const ordered = orderEntities(members, seedMode);
      const batch = buildDoublesPartnerRoundRobinMatches(
        ordered.map((p) => p.id),
        (o, sideAIds, sideBIds) => emptyGroupMatch(g.id, o, sideAIds, sideBIds),
        order,
        seedMode,
      );
      matches.push(...batch);
      order += batch.length;
    }
  }

  const knockout = buildKnockoutMatches(groups, order, seedMode);
  matches.push(...knockout.matches);
  return { matches, groups };
}

export function buildGroupStageSchedule(
  players: Player[],
  teams: Team[],
  mode: MatchMode,
  groupCount: number,
  seedMode: ScheduleSeedMode = 'random',
  doublesPairing: DoublesPairing = 'fixed',
): ScheduleResult {
  if (mode === 'doubles' && doublesPairing === 'rotating') {
    return buildGroupStageRotatingDoublesSchedule(players, groupCount, seedMode);
  }
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

function matchParticipantIds(m: Match): string[] {
  return [...m.sideAIds, ...m.sideBIds];
}

/** 按人数与模式，同时开打的场地数上限（实际意义） */
export function maxMeaningfulCourtCount(
  mode: MatchMode,
  playerCount: number,
  teamCount = 0,
): number {
  if (playerCount < 2) return 1;
  if (mode === 'doubles') {
    if (playerCount < 8) return 1;
    if (teamCount >= 2) {
      return Math.max(1, Math.floor(teamCount / 2));
    }
    return Math.max(1, Math.floor(playerCount / 4));
  }
  return Math.max(1, Math.floor(playerCount / 2));
}

/** 用户设定与上限取小；生成对阵时使用 */
export function effectiveCourtCount(
  requested: number,
  mode: MatchMode,
  playerCount: number,
  teamCount = 0,
): number {
  const max = maxMeaningfulCourtCount(mode, playerCount, teamCount);
  return Math.max(1, Math.min(max, Math.floor(requested) || 1));
}

/** 按赛段/小组/淘汰轮次切分，便于在各段内按场地分轮 */
function splitMatchesForCourtReorder(matches: Match[]): Match[][] {
  const sorted = [...matches].sort((a, b) => a.order - b.order);
  const units: Match[][] = [];
  let current: Match[] = [];
  let currentKey: string | null = null;

  for (const m of sorted) {
    const unitKey =
      m.phase === 'knockout'
        ? `ko:${m.knockoutRound ?? 0}`
        : m.group === null
          ? 'all'
          : `g:${m.group}`;

    if (currentKey !== null && unitKey !== currentKey) {
      units.push(current);
      current = [];
    }
    currentKey = unitKey;
    current.push(m);
  }
  if (current.length > 0) units.push(current);
  return units;
}

function packUnitByCourts(
  unit: Match[],
  courtCount: number,
): Match[][] {
  const sorted = [...unit].sort((a, b) => a.order - b.order);
  // 单面场：保持生成器顺序（休息已在排程阶段以软约束处理）
  if (courtCount <= 1) return [sorted];
  return scheduleItemsIntoCourtWaves(sorted, courtCount, matchParticipantIds, {
    restAware: true,
  });
}

/** 按场地数分轮重排对阵序号（同段内每轮最多 courtCount 场，同一球员不重复） */
export function reorderMatchesByCourtCount(
  matches: Match[],
  courtCount: number,
  startWave = 0,
  options?: {
    mode?: MatchMode;
    playerCount?: number;
    teamCount?: number;
  },
): Match[] {
  const effective =
    options?.mode != null && options.playerCount != null
      ? effectiveCourtCount(
          courtCount,
          options.mode,
          options.playerCount,
          options.teamCount ?? 0,
        )
      : Math.max(1, courtCount);

  if (matches.length === 0) return matches;

  const minOrder = Math.min(...matches.map((m) => m.order));
  let waveNo = startWave;
  const packed: Match[] = [];

  for (const unitWaves of splitMatchesForCourtReorder(matches).map((unit) =>
    packUnitByCourts(unit, effective),
  )) {
    for (const wave of unitWaves) {
      for (const m of wave) {
        packed.push({
          ...m,
          courtWave: effective > 1 ? waveNo : null,
        });
      }
      if (effective > 1) waveNo++;
    }
  }

  return packed.map((m, i) => ({ ...m, order: minOrder + i }));
}

/** 将已排序对阵切分为场地轮次（用于展示分组） */
export function groupMatchesIntoCourtWaves(
  matches: Match[],
  courtCount: number,
): Match[][] {
  if (courtCount <= 1 || matches.length === 0) return [matches];

  if (matches.some((m) => m.courtWave != null)) {
    const sorted = [...matches].sort((a, b) => a.order - b.order);
    const waves: Match[][] = [];
    let currentWave: number | null = null;
    let wave: Match[] = [];
    for (const m of sorted) {
      const w = m.courtWave ?? 0;
      if (currentWave !== null && w !== currentWave) {
        waves.push(wave);
        wave = [];
      }
      currentWave = w;
      wave.push(m);
    }
    if (wave.length > 0) waves.push(wave);
    return waves;
  }

  const sorted = [...matches].sort((a, b) => a.order - b.order);
  const waves: Match[][] = [];
  let wave: Match[] = [];
  const busy = new Set<string>();

  for (const m of sorted) {
    const ids = matchParticipantIds(m);
    const conflict = ids.some((id) => busy.has(id));
    if (wave.length > 0 && (conflict || wave.length >= courtCount)) {
      waves.push(wave);
      wave = [];
      busy.clear();
    }
    wave.push(m);
    for (const id of ids) busy.add(id);
  }
  if (wave.length > 0) waves.push(wave);
  return waves;
}

/** 统计选手在相邻两轮连续上场次数（用于多场地排程质量） */
export function countConsecutiveCourtWaveAppearances(
  waves: readonly { sideAIds: string[]; sideBIds: string[] }[][],
): number {
  const lastWave = new Map<string, number>();
  let count = 0;

  waves.forEach((wave, waveIndex) => {
    const inWave = new Set<string>();
    for (const m of wave) {
      for (const id of [...m.sideAIds, ...m.sideBIds]) {
        inWave.add(id);
      }
    }
    for (const id of inWave) {
      const prev = lastWave.get(id);
      if (prev !== undefined && prev === waveIndex - 1) count++;
      lastWave.set(id, waveIndex);
    }
  });

  return count;
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
    if (
      doublesPairing === 'fixed' &&
      !isFixedDoublesPairingAllowed(players.length)
    ) {
      return getActiveStrings().errDoublesOddFixed;
    }
    const pairing = normalizeDoublesPairingForPlayers(
      mode,
      doublesPairing,
      players.length,
    );
    if (pairing === 'rotating') {
      if (players.length < 4) return getActiveStrings().errDoublesPartnerMin;
      if (
        scheduleFormat === 'knockout' &&
        players.length % 2 !== 0
      ) {
        return getActiveStrings().errDoublesEven;
      }
    } else {
      if (!isFixedDoublesPairingAllowed(players.length)) {
        return getActiveStrings().errDoublesOddFixed;
      }
      if (teams.length < 2) return getActiveStrings().errMinTeams;
      const used = new Set(teams.flatMap((t) => t.playerIds));
      if (used.size !== players.length) return getActiveStrings().errTeamCoverage;
    }
  }
  if (scheduleFormat === 'group_stage') {
    const entityCount =
      mode === 'singles'
        ? players.length
        : doublesScheduleEntityCount(
            players.length,
            teams,
            normalizeDoublesPairingForPlayers(mode, doublesPairing, players.length),
          );
    if (groupCount < 2) return getActiveStrings().errMinGroups;
    if (groupCount > entityCount) return getActiveStrings().errGroupsTooMany;
    const minPerGroup = Math.floor(entityCount / groupCount);
    if (minPerGroup < 2 && entityCount < groupCount * 2) {
      return getActiveStrings().errGroupsTooSmall;
    }
  }
  if (scheduleFormat === 'knockout' || scheduleFormat === 'group_stage') {
    const entityCount =
      mode === 'singles'
        ? players.length
        : doublesScheduleEntityCount(
            players.length,
            teams,
            normalizeDoublesPairingForPlayers(mode, doublesPairing, players.length),
          );
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
  courtCount = 1,
): ScheduleResult {
  const scheduleTeams =
    mode === 'doubles' && doublesPairing === 'rotating'
      ? buildDoublesTeamsFromPlayers(players, seedMode)
      : teams;
  let result: ScheduleResult;
  if (scheduleFormat === 'group_stage') {
    result = buildGroupStageSchedule(
      players,
      scheduleTeams,
      mode,
      groupCount,
      seedMode,
      doublesPairing,
    );
  } else if (scheduleFormat === 'knockout') {
    result = buildKnockoutOnlySchedule(
      players,
      scheduleTeams,
      mode,
      seedMode,
    );
  } else {
    result = buildRoundRobinSchedule(
      players,
      scheduleTeams,
      mode,
      seedMode,
      doublesPairing,
    );
  }
  return {
    ...result,
    matches: reorderMatchesByCourtCount(result.matches, courtCount, 0, {
      mode,
      playerCount: players.length,
      teamCount: scheduleTeams.length,
    }),
  };
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
  courtCount = 1,
): { matches: Match[]; groups: GroupAssignment[]; appendedCount: number } {
  const batch = buildScheduleFromSettings(
    players,
    teams,
    mode,
    scheduleFormat,
    groupCount,
    seedMode,
    doublesPairing,
    courtCount,
  );
  const maxOrder = existingMatches.reduce(
    (max, m) => Math.max(max, m.order),
    0,
  );
  const maxWave = existingMatches.reduce(
    (max, m) => Math.max(max, m.courtWave ?? -1),
    -1,
  );
  const waveOffset = maxWave + 1;
  const appended = batch.matches.map((m, i) => ({
    ...m,
    id: uid(),
    order: maxOrder + i + 1,
    courtWave:
      m.courtWave != null && courtCount > 1
        ? m.courtWave + waveOffset
        : m.courtWave,
  }));
  return {
    matches: [...existingMatches, ...appended],
    groups: batch.groups,
    appendedCount: appended.length,
  };
}
