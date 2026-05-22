/**
 * 单打排程：加权软约束，追求公平与自然轮换，不追求数学完美。
 */

import type { ScheduleSeedMode } from '../types';
import {
  buildCircleRoundRobinRounds,
  flattenRoundRobinRounds,
  pairingKey,
} from './matchOrder';

export type SinglesPairing = readonly [string, string];

export type PlayerScheduleState = {
  id: string;
  orderIndex: number;
  matchCount: number;
  lastSlot: number;
};

export type SinglesScheduleState = {
  players: Map<string, PlayerScheduleState>;
  slot: number;
};

/** 软约束权重（越大 = 该因素对总分影响越强） */
export const SOFT_WEIGHTS = {
  matchCount: 55,
  restMin: 42,
  restMax: 14,
  backToBack: 75,
  shortRest: 18,
  sequentialAdjacent: 22,
  sequentialWave: 16,
} as const;

export type SinglesScoreBreakdown = {
  total: number;
  matchCountPenalty: number;
  restBonus: number;
  backToBackPenalty: number;
  shortRestPenalty: number;
  sequentialBonus: number;
};

export function createSinglesScheduleState(
  playerIds: readonly string[],
): SinglesScheduleState {
  const players = new Map<string, PlayerScheduleState>();
  playerIds.forEach((id, index) => {
    players.set(id, {
      id,
      orderIndex: index,
      matchCount: 0,
      lastSlot: -1,
    });
  });
  return { players, slot: 0 };
}

export function applyPairingToScheduleState(
  state: SinglesScheduleState,
  pair: SinglesPairing,
  options?: { slotOverride?: number; advanceSlot?: boolean },
): void {
  const slot = options?.slotOverride ?? state.slot;
  for (const id of pair) {
    const p = state.players.get(id);
    if (!p) continue;
    p.matchCount++;
    p.lastSlot = slot;
  }
  if (options?.advanceSlot !== false) {
    state.slot++;
  }
}

/** 顺序模式：相邻两人一场 (1v2, 3v4, …) */
export function buildSequentialAdjacentSinglesPairs(
  playerIds: readonly string[],
): SinglesPairing[] {
  const wave: SinglesPairing[] = [];
  for (let i = 0; i + 1 < playerIds.length; i += 2) {
    wave.push([playerIds[i], playerIds[i + 1]]);
  }
  return wave;
}

const adjacentWaveKeySetCache = new WeakMap<readonly string[], Set<string>>();

function adjacentWaveKeySet(playerIds: readonly string[]): Set<string> {
  let cached = adjacentWaveKeySetCache.get(playerIds);
  if (!cached) {
    cached = new Set(
      buildSequentialAdjacentSinglesPairs(playerIds).map(([a, b]) =>
        pairingKey(a, b, (x) => x),
      ),
    );
    adjacentWaveKeySetCache.set(playerIds, cached);
  }
  return cached;
}

function sequentialAffinityBonus(
  state: SinglesScheduleState,
  pair: SinglesPairing,
): number {
  const ia = state.players.get(pair[0])?.orderIndex ?? 0;
  const ib = state.players.get(pair[1])?.orderIndex ?? 0;
  const adjacent = Math.abs(ia - ib) === 1;
  return adjacent ? SOFT_WEIGHTS.sequentialAdjacent : 0;
}

export function scoreSinglesPairing(
  state: SinglesScheduleState,
  pair: SinglesPairing,
  options?: { sequential?: boolean; playerIds?: readonly string[] },
): number {
  return scoreSinglesPairingDetailed(state, pair, options).total;
}

export function scoreSinglesPairingDetailed(
  state: SinglesScheduleState,
  pair: SinglesPairing,
  options?: { sequential?: boolean; playerIds?: readonly string[] },
): SinglesScoreBreakdown {
  const ids = [...pair];
  const slot = state.slot;
  const avgCount =
    ids.reduce((s, id) => s + (state.players.get(id)?.matchCount ?? 0), 0) /
    ids.length;

  let minRest = Number.POSITIVE_INFINITY;
  let maxRest = 0;
  let backToBackPlayers = 0;
  let shortRestPlayers = 0;

  for (const id of ids) {
    const p = state.players.get(id);
    if (!p) continue;
    if (p.lastSlot < 0) {
      minRest = Math.min(minRest, slot + 3);
      maxRest = Math.max(maxRest, slot + 3);
    } else {
      const gap = slot - p.lastSlot;
      if (gap <= 1) backToBackPlayers++;
      else if (gap === 2) shortRestPlayers++;
      minRest = Math.min(minRest, gap);
      maxRest = Math.max(maxRest, gap);
    }
  }

  if (!Number.isFinite(minRest)) {
    minRest = slot + 3;
    maxRest = slot + 3;
  }

  const matchCountPenalty =
    SOFT_WEIGHTS.matchCount *
    ids.reduce((s, id) => {
      const c = state.players.get(id)?.matchCount ?? 0;
      return s + Math.max(0, c - avgCount + 0.5);
    }, 0);

  const restBonus =
    SOFT_WEIGHTS.restMin * minRest + SOFT_WEIGHTS.restMax * maxRest;

  const backToBackPenalty = SOFT_WEIGHTS.backToBack * backToBackPlayers;
  const shortRestPenalty = SOFT_WEIGHTS.shortRest * shortRestPlayers;

  let sequentialBonus = 0;
  if (options?.sequential) {
    sequentialBonus += sequentialAffinityBonus(state, pair);
    const pids = options.playerIds;
    if (pids && adjacentWaveKeySet(pids).has(pairingKey(pair[0], pair[1], (x) => x))) {
      sequentialBonus +=
        SOFT_WEIGHTS.sequentialWave * Math.max(0, 14 - state.slot);
    }
  }

  const total =
    restBonus +
    sequentialBonus -
    matchCountPenalty -
    backToBackPenalty -
    shortRestPenalty;

  return {
    total,
    matchCountPenalty,
    restBonus,
    backToBackPenalty,
    shortRestPenalty,
    sequentialBonus,
  };
}

function pickBestPairing(
  pool: readonly SinglesPairing[],
  state: SinglesScheduleState,
  options: { sequential: boolean; playerIds: readonly string[] },
): number {
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < pool.length; i++) {
    const s = scoreSinglesPairing(state, pool[i], options);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function refineTimelineSoft(
  timeline: SinglesPairing[],
  playerIds: readonly string[],
  seedMode: ScheduleSeedMode,
  pinThrough = 0,
): SinglesPairing[] {
  const arr = [...timeline];
  const opts = {
    sequential: seedMode === 'sequential',
    playerIds,
  };

  const totalScore = (list: SinglesPairing[]) => {
    const st = createSinglesScheduleState(playerIds);
    let sum = 0;
    for (const p of list) {
      sum += scoreSinglesPairing(st, p, opts);
      applyPairingToScheduleState(st, p, { advanceSlot: true });
    }
    return sum;
  };

  let best = totalScore(arr);
  for (let pass = 0; pass < arr.length; pass++) {
    let improved = false;
    for (let i = Math.max(0, pinThrough); i < arr.length - 1; i++) {
      const trial = [...arr];
      [trial[i], trial[i + 1]] = [trial[i + 1], trial[i]];
      const s = totalScore(trial);
      if (s > best) {
        best = s;
        arr.splice(0, arr.length, ...trial);
        improved = true;
      }
    }
    if (!improved) break;
  }
  return arr;
}

function pairingKeyIds(a: string, b: string): string {
  return pairingKey(a, b, (x) => x);
}

/** 顺序模式：相邻签位波次，固定顺序、不参与局部交换 */
function sequentialPrefixPairs(
  playerIds: readonly string[],
  candidates: readonly SinglesPairing[],
): SinglesPairing[] {
  const candidateKeys = new Set(
    candidates.map(([a, b]) => pairingKeyIds(a, b)),
  );
  return buildSequentialAdjacentSinglesPairs(playerIds).filter(([a, b]) =>
    candidateKeys.has(pairingKeyIds(a, b)),
  );
}

export function scheduleSinglesTimeline(
  candidates: readonly SinglesPairing[],
  playerIds: readonly string[],
  seedMode: ScheduleSeedMode,
): SinglesPairing[] {
  const state = createSinglesScheduleState(playerIds);
  const remaining = [...candidates];
  const ordered: SinglesPairing[] = [];
  const opts = {
    sequential: seedMode === 'sequential',
    playerIds,
  };

  while (remaining.length > 0) {
    const pick = pickBestPairing(remaining, state, opts);
    const [pair] = remaining.splice(pick, 1);
    ordered.push(pair);
    applyPairingToScheduleState(state, pair, { advanceSlot: true });
  }

  const pin =
    seedMode === 'sequential' ? sequentialPrefixPairs(playerIds, candidates).length : 0;
  return refineTimelineSoft(ordered, playerIds, seedMode, pin);
}

export type ScheduledSinglesRound = {
  roundIndex: number;
  matches: SinglesPairing[];
};

export function scheduleSinglesByRounds(
  candidates: readonly SinglesPairing[],
  playerIds: readonly string[],
  seedMode: ScheduleSeedMode,
): { rounds: ScheduledSinglesRound[]; timeline: SinglesPairing[] } {
  const state = createSinglesScheduleState(playerIds);
  const prefix =
    seedMode === 'sequential'
      ? sequentialPrefixPairs(playerIds, candidates)
      : [];
  const usedPrefix = new Set(prefix.map(([a, b]) => pairingKeyIds(a, b)));
  let remaining = candidates.filter(
    ([a, b]) => !usedPrefix.has(pairingKeyIds(a, b)),
  );
  const rounds: ScheduledSinglesRound[] = [];
  const timeline: SinglesPairing[] = [...prefix];
  const opts = {
    sequential: seedMode === 'sequential',
    playerIds,
  };
  let roundIndex = 0;

  for (const pair of prefix) {
    applyPairingToScheduleState(state, pair, { advanceSlot: true });
  }
  if (prefix.length > 0) {
    rounds.push({ roundIndex: roundIndex++, matches: [...prefix] });
  }

  while (remaining.length > 0) {
    const roundMatches: SinglesPairing[] = [];
    const busy = new Set<string>();

    while (true) {
      let bestIdx = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const [a, b] = remaining[i];
        if (busy.has(a) || busy.has(b)) continue;
        const s = scoreSinglesPairing(state, remaining[i], opts);
        if (s > bestScore) {
          bestScore = s;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) break;
      const [pair] = remaining.splice(bestIdx, 1);
      roundMatches.push(pair);
      busy.add(pair[0]);
      busy.add(pair[1]);
      timeline.push(pair);
    }

    if (roundMatches.length === 0) {
      const pick = pickBestPairing(remaining, state, opts);
      const [pair] = remaining.splice(pick, 1);
      roundMatches.push(pair);
      timeline.push(pair);
    }

    const roundSlot = state.slot;
    for (const pair of roundMatches) {
      applyPairingToScheduleState(state, pair, {
        slotOverride: roundSlot,
        advanceSlot: false,
      });
    }
    state.slot++;

    rounds.push({ roundIndex: roundIndex++, matches: roundMatches });
  }

  return {
    rounds,
    timeline: refineTimelineSoft(timeline, playerIds, seedMode, prefix.length),
  };
}

function shuffleIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 单打循环赛：圈赛候选 + 加权软约束排程 */
export function buildSinglesRoundRobinSchedule(
  playerIds: readonly string[],
  seedMode: ScheduleSeedMode,
): SinglesPairing[] {
  if (playerIds.length < 2) return [];
  const ordered =
    seedMode === 'random' ? shuffleIds([...playerIds]) : [...playerIds];
  const candidates = flattenRoundRobinRounds(
    buildCircleRoundRobinRounds(ordered),
  ) as SinglesPairing[];
  return scheduleSinglesByRounds(candidates, ordered, seedMode).timeline;
}

export type SinglesScheduleQuality = {
  backToBackCount: number;
  shortRestCount: number;
  matchCountSpread: number;
  averageRestGap: number;
};

export function evaluateSinglesScheduleQuality(
  timeline: readonly SinglesPairing[],
  playerIds: readonly string[],
): SinglesScheduleQuality {
  const state = createSinglesScheduleState(playerIds);
  let backToBackCount = 0;
  let shortRestCount = 0;
  const gaps: number[] = [];

  for (const pair of timeline) {
    for (const id of pair) {
      const p = state.players.get(id);
      if (p && p.lastSlot >= 0) {
        const gap = state.slot - p.lastSlot;
        gaps.push(gap);
        if (gap <= 1) backToBackCount++;
        else if (gap === 2) shortRestCount++;
      }
    }
    applyPairingToScheduleState(state, pair);
  }

  const counts = [...state.players.values()].map((p) => p.matchCount);
  const spread =
    counts.length > 0 ? Math.max(...counts) - Math.min(...counts) : 0;
  const averageRestGap =
    gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

  return {
    backToBackCount,
    shortRestCount,
    matchCountSpread: spread,
    averageRestGap,
  };
}
