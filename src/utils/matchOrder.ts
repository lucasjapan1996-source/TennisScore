/**
 * 对阵顺序：圈赛分轮、按签位顺序分块；单打排程见 singlesScheduler。
 */

import type { ScheduleSeedMode } from '../types';
import { buildSinglesRoundRobinSchedule } from './singlesScheduler';

export function pairingKey<T>(a: T, b: T, idOf: (e: T) => string): string {
  const x = idOf(a);
  const y = idOf(b);
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/** 按列表顺序：相邻两人一场（8 人 → 1v2、3v4、5v6、7v8 同波） */
export function buildSequentialAdjacentSinglesWave<T>(
  ordered: readonly T[],
): [T, T][] {
  const wave: [T, T][] = [];
  for (let i = 0; i + 1 < ordered.length; i += 2) {
    wave.push([ordered[i], ordered[i + 1]]);
  }
  return wave;
}

/** 按列表顺序：每 2 队一场（8 人四队 → 12vs34，再 56vs78） */
export function buildSequentialAdjacentTeamRounds<T>(
  teams: readonly T[],
): [T, T][][] {
  const rounds: [T, T][][] = [];
  for (let i = 0; i + 1 < teams.length; i += 2) {
    rounds.push([[teams[i], teams[i + 1]]]);
  }
  return rounds;
}

/** 单打循环赛顺序：加权软约束（公平、休息、顺序亲和） */
export function buildMatchOrderWithSequentialFirst<T>(
  ordered: readonly T[],
  idOf: (e: T) => string,
  seedMode: ScheduleSeedMode,
): [T, T][] {
  const ids = ordered.map(idOf);
  const scheduled = buildSinglesRoundRobinSchedule(ids, seedMode);
  const byId = new Map(ordered.map((e) => [idOf(e), e]));
  return scheduled.map(([a, b]) => [byId.get(a)!, byId.get(b)!]);
}

/** 按顺序：双打固定队 — 先 12vs34、56vs78，再排其余队际对局 */
export function buildTeamMatchOrderWithSequentialFirst<T>(
  teams: readonly T[],
  idOf: (e: T) => string,
  seedMode: ScheduleSeedMode,
): [T, T][] {
  const full = flattenRoundRobinRounds(buildCircleRoundRobinRounds(teams));
  if (seedMode !== 'sequential') {
    return orderByRestAndFairness(full, ([a, b]) => [idOf(a), idOf(b)]);
  }

  const firstMatches = buildSequentialAdjacentTeamRounds(teams).flat();
  const used = new Set(firstMatches.map(([a, b]) => pairingKey(a, b, idOf)));
  const rest = full.filter(([a, b]) => !used.has(pairingKey(a, b, idOf)));
  const restOrdered = orderByRestAndFairness(rest, ([a, b]) => [idOf(a), idOf(b)]);
  return [...firstMatches, ...restOrdered];
}

/** 圈赛分轮：每轮每人最多打一场，轮与轮之间休息场次一致 */
export function buildCircleRoundRobinRounds<T>(
  entities: readonly T[],
): [T, T][][] {
  const n = entities.length;
  if (n < 2) return [];

  const slots: (T | null)[] = [...entities];
  if (n % 2 === 1) slots.push(null);

  const size = slots.length;
  const roundCount = size - 1;
  const half = size / 2;
  const rounds: [T, T][][] = [];

  for (let r = 0; r < roundCount; r++) {
    const round: [T, T][] = [];
    for (let i = 0; i < half; i++) {
      const a = slots[i];
      const b = slots[size - 1 - i];
      if (a != null && b != null) round.push([a, b]);
    }
    rounds.push(round);

    if (r < roundCount - 1) {
      const fixed = slots[0];
      const tail = slots.slice(1);
      const last = tail.pop()!;
      tail.unshift(last);
      slots.length = 0;
      slots.push(fixed, ...tail);
    }
  }

  return rounds;
}

export function flattenRoundRobinRounds<T>(rounds: [T, T][][]): [T, T][] {
  return rounds.flat();
}

/** 多组圈赛：按轮交错排列，避免整组打完才轮到下一组 */
export function interleaveRoundRobinRounds<T>(
  roundsPerGroup: [T, T][][][],
): [T, T][] {
  const maxRounds = Math.max(
    0,
    ...roundsPerGroup.map((rounds) => rounds.length),
  );
  const ordered: [T, T][] = [];
  for (let ri = 0; ri < maxRounds; ri++) {
    for (const rounds of roundsPerGroup) {
      if (ri < rounds.length) ordered.push(...rounds[ri]);
    }
  }
  return ordered;
}

export type MatchOrderStats = {
  /** 每人出场次数 */
  playCount: Map<string, number>;
  /** 相邻两场之间的间隔（场次数），不含首场 */
  restGaps: Map<string, number[]>;
  /** 是否出现连场 */
  hasBackToBack: boolean;
};

export function analyzeMatchOrder(
  ordered: readonly { participants: readonly string[] }[],
): MatchOrderStats {
  const playCount = new Map<string, number>();
  const restGaps = new Map<string, number[]>();
  const lastSlot = new Map<string, number>();
  let hasBackToBack = false;

  ordered.forEach((item, slot) => {
    for (const id of item.participants) {
      playCount.set(id, (playCount.get(id) ?? 0) + 1);
      const prev = lastSlot.get(id);
      if (prev !== undefined) {
        const gap = slot - prev;
        if (gap <= 1) hasBackToBack = true;
        const gaps = restGaps.get(id) ?? [];
        gaps.push(gap);
        restGaps.set(id, gaps);
      }
      lastSlot.set(id, slot);
    }
  });

  return { playCount, restGaps, hasBackToBack };
}

export type RestOrderInitialState = {
  lastSlot: Map<string, number>;
  playCount: Map<string, number>;
  consecutiveRun?: Map<string, number>;
  slot: number;
};

/**
 * 贪心排程：以软约束尽量减轻连场，优先让休息最久的球员上场。
 * 无法完全避免连场时仍会选择相对更优的对阵。
 */
export function orderByRestAndFairness<T>(
  items: readonly T[],
  participants: (item: T) => readonly string[],
  initial?: RestOrderInitialState,
): T[] {
  if (items.length <= 1) return [...items];

  const remaining = [...items];
  const ordered: T[] = [];
  const lastSlot = new Map(initial?.lastSlot ?? []);
  const playCount = new Map(initial?.playCount ?? []);
  const consecutiveRun = new Map(initial?.consecutiveRun ?? []);

  const score = (ids: readonly string[], slot: number): number => {
    let minGap = Number.POSITIVE_INFINITY;
    let maxGap = 0;
    let matchCountSum = 0;
    let backToBack = 0;
    let shortRest = 0;
    let streakPenalty = 0;

    for (const id of ids) {
      const played = playCount.get(id) ?? 0;
      matchCountSum += played;
      const prev = lastSlot.get(id);
      if (prev === undefined) {
        minGap = Math.min(minGap, slot + 3);
        maxGap = Math.max(maxGap, slot + 3);
      } else {
        const gap = slot - prev;
        if (gap <= 1) {
          backToBack++;
          const run = consecutiveRun.get(id) ?? 1;
          streakPenalty += run * run * 55;
        } else if (gap === 2) shortRest++;
        minGap = Math.min(minGap, gap);
        maxGap = Math.max(maxGap, gap);
      }
    }

    if (!Number.isFinite(minGap)) {
      minGap = slot + 3;
      maxGap = slot + 3;
    }

    return (
      minGap * 5 +
      maxGap * 1.2 -
      matchCountSum * 0.35 -
      backToBack * 75 -
      shortRest * 15 -
      streakPenalty
    );
  };

  let slot = initial?.slot ?? 0;
  while (remaining.length > 0) {
    let pick = 0;
    let best = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = score(participants(remaining[i]), slot);
      if (s > best) {
        best = s;
        pick = i;
      }
    }
    const item = remaining.splice(pick, 1)[0]!;
    const ids = participants(item);
    ordered.push(item);
    for (const id of ids) {
      playCount.set(id, (playCount.get(id) ?? 0) + 1);
      const prev = lastSlot.get(id);
      if (prev === slot - 1) {
        consecutiveRun.set(id, (consecutiveRun.get(id) ?? 1) + 1);
      } else {
        consecutiveRun.set(id, 1);
      }
      lastSlot.set(id, slot);
    }
    slot++;
  }

  return ordered;
}

/**
 * 按场地数分轮打包：每轮最多 courtCount 场，同一参与者不重复出现在同轮。
 * 保持输入顺序优先（同轮内按原序选取）。
 */
export function packItemsByCourtCount<T>(
  items: readonly T[],
  courtCount: number,
  participants: (item: T) => readonly string[],
): T[] {
  return scheduleItemsByCourtWaves(items, courtCount, participants, {
    restAware: false,
  });
}

function scoreWaveCandidate(
  ids: readonly string[],
  waveIndex: number,
  lastWave: Map<string, number>,
  playCount: Map<string, number>,
): number {
  let minGap = Number.POSITIVE_INFINITY;
  let backToBack = 0;
  let shortRest = 0;
  let countSum = 0;

  for (const id of ids) {
    countSum += playCount.get(id) ?? 0;
    const prev = lastWave.get(id);
    if (prev === undefined) {
      minGap = Math.min(minGap, waveIndex + 3);
    } else {
      const gap = waveIndex - prev;
      if (gap <= 1) backToBack++;
      else if (gap === 2) shortRest++;
      minGap = Math.min(minGap, gap);
    }
  }

  if (!Number.isFinite(minGap)) {
    minGap = waveIndex + 3;
  }

  return (
    minGap * 8 -
    backToBack * 75 -
    shortRest * 15 -
    countSum * 0.35
  );
}

/**
 * 按场地数分轮排程：每轮最多 courtCount 场，同轮不重复参与者；
 * restAware 时优先让上一轮刚上场的选手休息，便于多场地并行。
 */
export function scheduleItemsByCourtWaves<T>(
  items: readonly T[],
  courtCount: number,
  participants: (item: T) => readonly string[],
  options: { restAware?: boolean } = {},
): T[] {
  return scheduleItemsIntoCourtWaves(items, courtCount, participants, options).flat();
}

export function scheduleItemsIntoCourtWaves<T>(
  items: readonly T[],
  courtCount: number,
  participants: (item: T) => readonly string[],
  options: { restAware?: boolean } = {},
): T[][] {
  const restAware = options.restAware !== false;
  if (items.length <= 1) return [items.slice()];

  if (courtCount <= 1) {
    return [items.slice()];
  }

  const remaining = items.map((item, index) => ({ item, index }));
  const waves: T[][] = [];
  const lastWave = new Map<string, number>();
  const playCount = new Map<string, number>();
  let waveIndex = 0;

  while (remaining.length > 0) {
    const wave: T[] = [];
    const busy = new Set<string>();

    const pickFrom = (candidateIndices: Set<number>) => {
      let bestIdx = -1;
      let bestScore = -Infinity;
      for (const i of candidateIndices) {
        const entry = remaining[i];
        if (!entry) continue;
        const { item, index } = entry;
        const ids = participants(item);
        if (ids.some((id) => busy.has(id))) continue;

        const score = restAware
          ? scoreWaveCandidate(ids, waveIndex, lastWave, playCount) -
            index * 0.001
          : -index;

        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      return bestIdx;
    };

    const allIndices = () => new Set(remaining.map((_, index) => index));

    while (wave.length < courtCount) {
      const bestIdx = pickFrom(allIndices());
      if (bestIdx < 0) break;

      const [picked] = remaining.splice(bestIdx, 1);
      wave.push(picked.item);
      for (const id of participants(picked.item)) busy.add(id);
    }

    if (wave.length === 0) {
      if (remaining.length === 0) break;
      const [picked] = remaining.splice(0, 1)!;
      wave.push(picked.item);
    }

    waves.push(wave);
    for (const item of wave) {
      for (const id of participants(item)) {
        lastWave.set(id, waveIndex);
        playCount.set(id, (playCount.get(id) ?? 0) + 1);
      }
    }
    waveIndex++;
  }

  return waves;
}

/** @deprecated 使用圈赛或 orderByRestAndFairness */
export function orderPairingsNoBackToBack<T>(
  pairings: [T, T][],
  idOf: (e: T) => string,
): [T, T][] {
  return orderByRestAndFairness(
    pairings,
    ([a, b]) => [idOf(a), idOf(b)],
  );
}
